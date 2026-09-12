/**
 * 一节课的生命周期。三种来源（固定课表 / 临时排课 / 事后补记）在这里汇成同一个状态机：
 *   scheduled ──complete──► done ──undo──► scheduled（或删除，若是补记）
 *   scheduled ──cancel────► cancelled
 * 这里只做纯计算并返回新数组和审计条目，不碰 IO。
 */
import type { AuditEntry, ID, ISODate, Lesson, LessonTemplate, State } from "./types";
import { addDays, weekdayOf } from "./date";
import { uid } from "./id";

/** 「今天」列表里的一项：可能是尚未落库的模板课（virtual） */
export type DayItem = Lesson & { virtual?: boolean };

const byTime = (a: { time: string }, b: { time: string }) => a.time.localeCompare(b.time);

function courseOf(state: State, id: ID) {
  return state.courses.find((c) => c.id === id);
}

/** 某天的课：已落库的 + 模板生成但还没落库的 */
export function lessonsOn(state: State, date: ISODate): DayItem[] {
  const wd = weekdayOf(date);
  const real = state.lessons.filter((l) => l.date === date);
  const covered = new Set(real.map((l) => l.templateId).filter(Boolean));
  const virtual: DayItem[] = state.templates
    .filter((t) => t.active && t.weekday === wd && !covered.has(t.id))
    .filter((t) => state.students.some((s) => s.id === t.studentId && !s.archived))
    .map((t) => materialize(state, t, date));
  return [...real, ...virtual].sort(byTime);
}

export function materialize(state: State, t: LessonTemplate, date: ISODate): DayItem {
  const c = courseOf(state, t.courseId);
  return {
    id: `tpl:${t.id}:${date}`,
    studentId: t.studentId,
    courseId: t.courseId,
    teacherId: t.teacherId,
    date,
    time: t.time,
    status: "scheduled",
    units: c?.unitsPerLesson ?? 1,
    price: c?.price ?? 0,
    source: "template",
    templateId: t.id,
    createdAt: "",
    virtual: true,
  };
}

export interface LessonChange {
  lessons: Lesson[];
  audit: AuditEntry;
}

function studentName(state: State, id: ID) {
  return state.students.find((s) => s.id === id)?.name ?? "未知学员";
}

/** 打卡：把一节课标为已上。虚拟的模板课会在此刻落库。 */
export function completeLesson(state: State, item: DayItem, at: string = new Date().toISOString()): LessonChange {
  const base = stripVirtual(item);
  const record: Lesson = item.virtual
    ? { ...base, id: uid("l"), status: "done", doneAt: at, createdAt: at }
    : { ...base, status: "done", doneAt: at };
  const lessons = item.virtual ? [...state.lessons, record] : state.lessons.map((l) => (l.id === item.id ? record : l));
  return {
    lessons,
    audit: entry("lesson.done", `${studentName(state, record.studentId)} · ${record.date} ${record.time} · ${record.units} 课时`, record, at),
  };
}

export interface LogLessonInput {
  studentId: ID;
  courseId: ID;
  teacherId?: ID;
  date: ISODate;
  time: string;
  units?: number;
  note?: string;
}

/** 补记：没排过课，上完直接记一节（以 done 创建） */
export function logLesson(state: State, input: LogLessonInput, at: string = new Date().toISOString()): LessonChange {
  const c = courseOf(state, input.courseId);
  const record: Lesson = {
    id: uid("l"),
    studentId: input.studentId,
    courseId: input.courseId,
    teacherId: input.teacherId,
    date: input.date,
    time: input.time,
    status: "done",
    units: input.units && input.units > 0 ? input.units : (c?.unitsPerLesson ?? 1),
    price: c?.price ?? 0,
    source: "backfill",
    doneAt: at,
    createdAt: at,
    note: input.note,
  };
  return {
    lessons: [...state.lessons, record],
    audit: entry("lesson.log", `${studentName(state, record.studentId)} · ${record.date} ${record.time} · 补记 ${record.units} 课时`, record, at),
  };
}

/**
 * 撤销打卡。锁定规则：只能通过这个函数撤销，调用方（UI）负责二次确认。
 * 模板课 / 临时课退回 scheduled；补记的课直接删除（它本来就不存在于计划里）。
 */
export function undoLesson(state: State, lessonId: ID, at: string = new Date().toISOString()): LessonChange | null {
  const l = state.lessons.find((x) => x.id === lessonId);
  if (!l || l.status !== "done") return null;
  const lessons =
    l.source === "backfill"
      ? state.lessons.filter((x) => x.id !== lessonId)
      : state.lessons.map((x) => (x.id === lessonId ? { ...x, status: "scheduled" as const, doneAt: undefined } : x));
  return {
    lessons,
    audit: entry("lesson.undo", `撤销 ${studentName(state, l.studentId)} · ${l.date} ${l.time} · ${l.units} 课时`, l, at),
  };
}

export function cancelLesson(state: State, item: DayItem, at: string = new Date().toISOString()): LessonChange {
  const base = stripVirtual(item);
  const record: Lesson = item.virtual ? { ...base, id: uid("l"), status: "cancelled", createdAt: at } : { ...base, status: "cancelled" };
  const lessons = item.virtual ? [...state.lessons, record] : state.lessons.map((l) => (l.id === item.id ? record : l));
  return { lessons, audit: entry("lesson.cancel", `取消 ${studentName(state, record.studentId)} · ${record.date} ${record.time}`, record, at) };
}

/** 从历史推断：这个学员通常在今天这个星期几的几点上课？ */
export interface Suggestion {
  studentId: ID;
  courseId: ID;
  time: string;
  hits: number;
}

export function suggestionsFor(state: State, date: ISODate, weeksBack = 8): Suggestion[] {
  const wd = weekdayOf(date);
  const since = addDays(date, -7 * weeksBack);
  const already = new Set(lessonsOn(state, date).map((l) => l.studentId));
  const tally = new Map<string, Suggestion>();
  for (const l of state.lessons) {
    if (l.status !== "done" || l.date < since || l.date >= date || weekdayOf(l.date) !== wd) continue;
    if (already.has(l.studentId)) continue;
    const key = `${l.studentId}|${l.time}`;
    const cur = tally.get(key) ?? { studentId: l.studentId, courseId: l.courseId, time: l.time, hits: 0 };
    cur.hits += 1;
    tally.set(key, cur);
  }
  return [...tally.values()].filter((s) => s.hits >= 2).sort((a, b) => b.hits - a.hits || byTime(a, b));
}

/** 从上周同一天复制课（作为临时排课，scheduled） */
export function copyFromLastWeek(state: State, date: ISODate, at: string = new Date().toISOString()): Lesson[] {
  const src = lessonsOn(state, addDays(date, -7)).filter((l) => l.status !== "cancelled");
  const existing = new Set(lessonsOn(state, date).map((l) => `${l.studentId}|${l.time}`));
  return src
    .filter((l) => !existing.has(`${l.studentId}|${l.time}`))
    .map((l) => ({
      id: uid("l"),
      studentId: l.studentId,
      courseId: l.courseId,
      teacherId: l.teacherId,
      date,
      time: l.time,
      status: "scheduled",
      units: l.units,
      price: courseOf(state, l.courseId)?.price ?? l.price,
      source: "manual",
      createdAt: at,
    }));
}

function stripVirtual(item: DayItem): Lesson {
  const copy: DayItem = { ...item };
  delete copy.virtual;
  return copy;
}

function entry(kind: AuditEntry["kind"], summary: string, lesson: Lesson, at: string): AuditEntry {
  return {
    id: uid("a"),
    at,
    kind,
    summary,
    payload: { lessonId: lesson.id, studentId: lesson.studentId, date: lesson.date, time: lesson.time, units: lesson.units, price: lesson.price, source: lesson.source },
  };
}
