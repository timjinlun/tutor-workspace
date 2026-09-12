/**
 * 班课。原则：班级只是"一群人 + 定价 + 缺席规则"，打卡仍然按人落 Lesson 记录，
 * 同一次班课的记录共享 groupId。这样余额、收入、报表一行代码都不用改。
 * （文件名叫 klass 是因为 class 是保留字。）
 */
import type { Class, ID, ISODate, Lesson, LessonTemplate, State } from "./types";
import { uid } from "./id";
import { type DayItem, type LessonChange, groupKeyOf, stripVirtual } from "./day-item";
import { entry } from "./audit";

export type Attendance = Record<ID, "present" | "absent">;

export function classById(state: State, id: ID | undefined): Class | undefined {
  return id ? state.classes.find((c) => c.id === id) : undefined;
}

/** 每人每课时的价格：班级自己定的优先，没定就用课程单价 */
export function classPrice(state: State, cls: Class): number {
  return cls.pricePerUnit ?? state.courses.find((c) => c.id === cls.courseId)?.price ?? 0;
}

/** 班里还在读的成员 */
export function classMembers(state: State, cls: Class) {
  return cls.studentIds.map((id) => state.students.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s && !s.archived);
}

/** 固定课表里的班课，在某一天生成每个成员一条虚拟记录，共享 groupId */
export function materializeClass(state: State, t: LessonTemplate, cls: Class, date: ISODate): DayItem[] {
  const c = state.courses.find((x) => x.id === cls.courseId);
  const groupId = `grp:${t.id}:${date}`;
  return classMembers(state, cls).map((st) => ({
    id: `tpl:${t.id}:${date}:${st.id}`,
    studentId: st.id,
    courseId: cls.courseId,
    teacherId: t.teacherId ?? cls.teacherId,
    date,
    time: t.time,
    status: "scheduled",
    units: c?.unitsPerLesson ?? 1,
    price: classPrice(state, cls),
    source: "template",
    templateId: t.id,
    classId: cls.id,
    groupId,
    createdAt: "",
    virtual: true,
  }));
}

export interface ClassLessonInput {
  classId: ID;
  date: ISODate;
  time: string;
}

function buildRows(state: State, input: ClassLessonInput, status: Lesson["status"], source: Lesson["source"], at: string): Lesson[] {
  const cls = classById(state, input.classId);
  if (!cls) return [];
  const c = state.courses.find((x) => x.id === cls.courseId);
  const groupId = uid("g");
  return classMembers(state, cls).map((st) => ({
    id: uid("l"),
    studentId: st.id,
    courseId: cls.courseId,
    teacherId: cls.teacherId,
    date: input.date,
    time: input.time,
    status,
    units: c?.unitsPerLesson ?? 1,
    price: classPrice(state, cls),
    source,
    classId: cls.id,
    groupId,
    createdAt: at,
    ...(status === "done" ? { doneAt: at, attendance: "present" as const } : {}),
  }));
}

/** 临时排一次班课（scheduled） */
export function scheduleClass(state: State, input: ClassLessonInput, at: string = new Date().toISOString()): LessonChange | null {
  const rows = buildRows(state, input, "scheduled", "manual", at);
  if (rows.length === 0) return null;
  const cls = classById(state, input.classId)!;
  return { lessons: [...state.lessons, ...rows], audit: entry("lesson.schedule", `${cls.name} · ${input.date} ${input.time} · 排班课 ${rows.length} 人`, rows[0]!, at) };
}

/** 补记一次班课：全员到场，直接 done */
export function logClass(state: State, input: ClassLessonInput, at: string = new Date().toISOString()): LessonChange | null {
  const rows = buildRows(state, input, "done", "backfill", at);
  if (rows.length === 0) return null;
  const cls = classById(state, input.classId)!;
  return { lessons: [...state.lessons, ...rows], audit: entry("lesson.log", `${cls.name} · ${input.date} ${input.time} · 补记班课 ${rows.length} 人`, rows[0]!, at) };
}

/**
 * 班课打卡。到场的扣课时；缺席的按本班规则：
 *   deductOnAbsence = true  → 也记 done（扣课时、算收入），attendance 标 absent
 *   deductOnAbsence = false → 记 cancelled，不扣
 * 一次落库整组记录，虚拟的顺便落库。
 */
export function completeClass(state: State, items: DayItem[], attendance: Attendance, at: string = new Date().toISOString()): LessonChange | null {
  const first = items[0];
  if (!first?.classId) return null;
  const cls = classById(state, first.classId);
  if (!cls) return null;
  const groupId = first.groupId ?? uid("g");
  const updated = new Map<ID, Lesson>();
  const added: Lesson[] = [];
  let present = 0, absent = 0;
  for (const item of items) {
    if (item.status !== "scheduled") continue;
    const att = attendance[item.studentId] ?? "present";
    if (att === "present") present++; else absent++;
    const deduct = att === "present" || cls.deductOnAbsence;
    const rec: Lesson = { ...stripVirtual(item), groupId, attendance: att, status: deduct ? "done" : "cancelled", ...(deduct ? { doneAt: at } : {}) };
    if (item.virtual) added.push({ ...rec, id: uid("l"), createdAt: at });
    else updated.set(item.id, rec);
  }
  if (added.length === 0 && updated.size === 0) return null;
  const lessons = [...state.lessons.map((l) => updated.get(l.id) ?? l), ...added];
  const summary = `${cls.name} · ${first.date} ${first.time} · 到 ${present} 人${absent ? `，缺 ${absent} 人${cls.deductOnAbsence ? "（照扣）" : "（不扣）"}` : ""}`;
  return { lessons, audit: entry("lesson.done", summary, added[0] ?? [...updated.values()][0]!, at) };
}

/** 整组取消（这次班课不上了） */
export function cancelGroup(state: State, items: DayItem[], at: string = new Date().toISOString()): LessonChange | null {
  const first = items[0];
  if (!first) return null;
  const updated = new Map<ID, Lesson>();
  const added: Lesson[] = [];
  for (const item of items) {
    if (item.status !== "scheduled") continue;
    const rec: Lesson = { ...stripVirtual(item), status: "cancelled" };
    if (item.virtual) added.push({ ...rec, id: uid("l"), createdAt: at });
    else updated.set(item.id, rec);
  }
  if (added.length === 0 && updated.size === 0) return null;
  const lessons = [...state.lessons.map((l) => updated.get(l.id) ?? l), ...added];
  const cls = classById(state, first.classId);
  return { lessons, audit: entry("lesson.cancel", `取消 ${cls?.name ?? "班课"} · ${first.date} ${first.time}`, added[0] ?? [...updated.values()][0]!, at) };
}

/** 一天里的课按组折叠：班课一组多人，一对一每节自成一组 */
export interface DayGroup {
  key: string;
  classId?: ID;
  time: string;
  items: DayItem[];
}

export function groupItems(items: DayItem[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const it of items) {
    const key = groupKeyOf(it);
    const g = map.get(key);
    if (g) g.items.push(it);
    else map.set(key, { key, classId: it.classId, time: it.time, items: [it] });
  }
  return [...map.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/** 一组的整体状态：有人 done 就算上过；否则有人待上就是待上；否则全取消 */
export function groupStatus(g: DayGroup): Lesson["status"] {
  if (g.items.some((i) => i.status === "done")) return "done";
  if (g.items.some((i) => i.status === "scheduled")) return "scheduled";
  return "cancelled";
}
