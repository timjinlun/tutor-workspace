import type { Lesson, Settings, State } from "./types";

const NICE = [1, 2, 5, 10, 20, 50, 100];
const nearest = (n: number, values: number[]) => values.reduce((a, b) => Math.abs(b - n) <= Math.abs(a - n) ? b : a);
const earned = (l: Lesson) => l.status === "done" && Number.isFinite(l.units * l.price) ? Math.max(0, l.units * l.price) : 0;

export function coinValue(lessons: Lesson[]): number {
  const recent = lessons.filter((l) => l.status === "done").sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.id.localeCompare(a.id)).slice(0, 20);
  return recent.length ? nearest(recent.reduce((n, l) => n + earned(l), 0) / recent.length / 30, NICE) : 10;
}

export function jarSettings(s: State, date: string): Pick<Settings, "coinValue" | "jarCapacity"> {
  const month = date.slice(0, 7);
  const old = s.settings.coinValue;
  const [y = 2026, m = 1] = date.split("-").map(Number);
  const months = [1, 2, 3].map((i) => { const d = new Date(y, m - 1 - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const mean = s.lessons.filter((l) => months.includes(l.date.slice(0, 7))).reduce((n, l) => n + earned(l), 0) / 3;
  const capacity = mean > 0 ? nearest(mean, Array.from({ length: 9 }, (_, i) => [1, 2, 5].map((n) => n * 10 ** i)).flat()) : 10000;
  return {
    coinValue: old?.month === month && NICE.includes(old.amount) ? old : { amount: coinValue(s.lessons), month },
    jarCapacity: Number.isFinite(s.settings.jarCapacity) && s.settings.jarCapacity > 0 ? s.settings.jarCapacity : capacity,
  };
}

export function jarState(s: State) {
  const amount = Math.round(s.lessons.reduce((n, l) => n + earned(l), 0) * 100) / 100;
  const capacity = s.settings.jarCapacity > 0 ? s.settings.jarCapacity : 10000;
  return { amount, capacity, fill: Math.min(1, amount / capacity) };
}

export function incomeChanges(before: Lesson[], after: Lesson[]): { id: string; amount: number }[] {
  const old = new Map(before.map((l) => [l.id, earned(l)]));
  const next = new Map(after.map((l) => [l.id, earned(l)]));
  return [...new Set([...old.keys(), ...next.keys()])].map((id) => ({ id, amount: Math.round(((next.get(id) ?? 0) - (old.get(id) ?? 0)) * 100) / 100 })).filter((c) => c.amount !== 0);
}
