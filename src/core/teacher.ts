/**
 * 老师：谁上的课，以及该结多少课时费。
 * 「我」是一位特殊的老师（self），课时费不结算（钱本来就是我的）。
 * 没写 teacherId 的旧记录一律算在「我」头上，不然历史数据会凭空多出一个"未知老师"。
 */
import type { ID, Lesson, State, Teacher } from "./types";
import { monthKey } from "./date";

/** 老师配色：加老师时按顺序取，保证课表上一眼分得开 */
export const TEACHER_COLORS = ["#ff6b4a", "#4f6bff", "#34c759", "#ff9f0a", "#af52de", "#00b8d4"] as const;

export function selfTeacher(state: State): Teacher | undefined {
  return state.teachers.find((t) => t.self);
}

/** 这节课算谁的：没指定就是我 */
export function teacherOfLesson(state: State, l: Pick<Lesson, "teacherId">): Teacher | undefined {
  return (l.teacherId ? state.teachers.find((t) => t.id === l.teacherId) : undefined) ?? selfTeacher(state);
}

/** 是不是"别人上的课"——只有这种才需要在界面上标出来 */
export function isOtherTeacher(state: State, l: Pick<Lesson, "teacherId">): boolean {
  const t = teacherOfLesson(state, l);
  return !!t && !t.self;
}

export function nextTeacherColor(state: State): string {
  const used = new Set(state.teachers.map((t) => t.color));
  return TEACHER_COLORS.find((c) => !used.has(c)) ?? TEACHER_COLORS[0];
}

export interface TeacherMonth {
  teacher: Teacher;
  /** 上了多少节 */
  lessons: number;
  /** 多少课时 */
  units: number;
  /** 这些课产生的学费 */
  income: number;
  /** 该结给这位老师多少；没设课时费就是 0 */
  pay: number;
  /** 学费减去课时费，我这边还剩多少 */
  margin: number;
}

/** 某个月每位老师上了多少、该结多少。没上课的老师不出现。 */
export function teacherMonth(state: State, ym: string): TeacherMonth[] {
  const tally = new Map<ID, { lessons: number; units: number; income: number }>();
  for (const l of state.lessons) {
    if (l.status !== "done" || monthKey(l.date) !== ym) continue;
    const t = teacherOfLesson(state, l);
    if (!t) continue;
    const cur = tally.get(t.id) ?? { lessons: 0, units: 0, income: 0 };
    cur.lessons += 1;
    cur.units += l.units;
    cur.income += l.units * l.price;
    tally.set(t.id, cur);
  }
  return state.teachers
    .filter((t) => tally.has(t.id))
    .map((t) => {
      const x = tally.get(t.id)!;
      const pay = t.self ? 0 : x.units * (t.payPerUnit ?? 0);
      return { teacher: t, ...x, pay, margin: x.income - pay };
    })
    .sort((a, b) => Number(!!b.teacher.self) - Number(!!a.teacher.self) || b.units - a.units);
}

/** 这个月一共要给合作老师结多少 */
export function payableInMonth(state: State, ym: string): number {
  return teacherMonth(state, ym).reduce((a, x) => a + x.pay, 0);
}

export const TEACHER_PAY_CATEGORY = "老师课时费";

/** 这笔课时费支出的身份：跟老师的 id 和月份绑定，改名字不影响 */
export function payRef(teacherId: ID, ym: string): string {
  return `teacher:${teacherId}:${ym}`;
}

/**
 * 这个月这位老师的课时费是不是已经记过支出了。
 * 认 ref；3.4 及更早记的那批没有 ref，退回按名字匹配，免得老用户重复记账。
 */
export function payRecorded(state: State, ym: string, teacher: Teacher): boolean {
  const ref = payRef(teacher.id, ym);
  return state.expenses.some(
    (e) => e.ref === ref || (!e.ref && e.category === TEACHER_PAY_CATEGORY && monthKey(e.date) === ym && e.note.includes(teacher.name)),
  );
}
