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

export interface MonthPoint {
  ym: string;
  label: string;
  income: number;
  cash: number;
  expense: number;
}

/** 最近 N 个月（含本月）的确认收入 / 到账 / 支出 */
export function monthlySeries(state: State, today: ISODate, months = 6): MonthPoint[] {
  const [y, m] = today.split("-").map(Number);
  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(y ?? 2026, (m ?? 1) - 1 - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ ym, label: `${d.getMonth() + 1}月`, income: incomeInMonth(state, ym), cash: cashInMonth(state, ym), expense: expenseInMonth(state, ym) });
  }
  return out;
}

/** 支出按分类汇总（ym 为空则全部） */
export function expenseByCategory(state: State, ym?: string): { category: string; amount: number; share: number }[] {
  const map = new Map<string, number>();
  for (const e of state.expenses) {
    if (ym && monthKey(e.date) !== ym) continue;
    map.set(e.category || "其他", (map.get(e.category || "其他") ?? 0) + e.amount);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()].map(([category, amount]) => ({ category, amount, share: total ? amount / total : 0 })).sort((a, b) => b.amount - a.amount);
}

export const EXPENSE_CATEGORIES = ["房租", "广告投放", "教材物料", "交通", "餐饮", "平台佣金", "其他"] as const;
export const INCOME_SOURCES = ["资料售卖", "课程咨询", "其他"] as const;

/** −¥150 / ¥1,040 */
export function fmtMoney(n: number): string {
  const v = Math.abs(Math.round(n)).toLocaleString("zh-CN");
  return (n < 0 ? "−¥" : "¥") + v;
}
