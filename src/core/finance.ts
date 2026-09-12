/** 课时余额、收入统计。全部纯函数。 */
import type { ID, ISODate, State, Student } from "./types";
import { monthKey, weekRange } from "./date";

export function purchasedHours(state: State, studentId: ID): number {
  return state.payments.filter((p) => p.studentId === studentId).reduce((a, p) => a + p.hours, 0);
}

export function usedUnits(state: State, studentId: ID): number {
  return state.lessons.filter((l) => l.studentId === studentId && l.status === "done").reduce((a, l) => a + l.units, 0);
}

export function balance(state: State, studentId: ID): number {
  return purchasedHours(state, studentId) - usedUnits(state, studentId);
}

export function paidTotal(state: State, studentId: ID): number {
  return state.payments.filter((p) => p.studentId === studentId).reduce((a, p) => a + p.amount, 0);
}

/** 确认收入 = 已上课 × 单价（打卡时锁定的价） */
export function confirmedIncome(state: State, studentId?: ID): number {
  return state.lessons
    .filter((l) => l.status === "done" && (!studentId || l.studentId === studentId))
    .reduce((a, l) => a + l.units * l.price, 0);
}

export type BalanceLevel = "ok" | "low" | "danger" | "done";

export function balanceLevel(state: State, studentId: ID): BalanceLevel {
  const b = balance(state, studentId);
  const { lowBalanceThreshold: t, remindAhead: a } = state.settings;
  if (purchasedHours(state, studentId) === 0) return "ok";
  if (b <= 0) return "done";
  if (b <= t) return "danger";
  if (b <= t + a) return "low";
  return "ok";
}

export interface LowBalance {
  student: Student;
  remaining: number;
  level: "low" | "danger";
}

export function lowBalanceStudents(state: State): LowBalance[] {
  return state.students
    .filter((s) => !s.archived)
    .map((s) => ({ student: s, remaining: balance(state, s.id), level: balanceLevel(state, s.id) }))
    .filter((x): x is LowBalance => x.level === "low" || x.level === "danger")
    .sort((a, b) => a.remaining - b.remaining);
}

export function doneUnitsInMonth(state: State, ym: string): number {
  return state.lessons.filter((l) => l.status === "done" && monthKey(l.date) === ym).reduce((a, l) => a + l.units, 0);
}

export function doneLessonsInWeek(state: State, date: ISODate): number {
  const [s, e] = weekRange(date);
  return state.lessons.filter((l) => l.status === "done" && l.date >= s && l.date <= e).length;
}

export function incomeInMonth(state: State, ym: string): number {
  return state.lessons.filter((l) => l.status === "done" && monthKey(l.date) === ym).reduce((a, l) => a + l.units * l.price, 0);
}

export function cashInMonth(state: State, ym: string): number {
  const pay = state.payments.filter((p) => monthKey(p.date) === ym).reduce((a, p) => a + p.amount, 0);
  const other = state.otherIncomes.filter((p) => monthKey(p.date) === ym).reduce((a, p) => a + p.amount, 0);
  return pay + other;
}

export function expenseInMonth(state: State, ym: string): number {
  return state.expenses.filter((e) => monthKey(e.date) === ym).reduce((a, e) => a + e.amount, 0);
}

/** −¥150 / ¥1,040 */
export function fmtMoney(n: number): string {
  const v = Math.abs(Math.round(n)).toLocaleString("zh-CN");
  return (n < 0 ? "−¥" : "¥") + v;
}
