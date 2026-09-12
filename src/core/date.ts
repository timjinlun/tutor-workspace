import type { ISODate } from "./types";

const p2 = (n: number) => String(n).padStart(2, "0");

/** 本地日期，不走 toISOString（那会按 UTC 切日，晚上十点会变成明天） */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function parseISO(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = parseISO(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function weekdayOf(date: ISODate): number {
  return parseISO(date).getDay();
}

export const WEEKDAY_CN = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** 9月11日 周四 */
export function formatCN(date: ISODate): string {
  const d = parseISO(date);
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAY_CN[d.getDay()]}`;
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

export function nowHHMM(now: Date = new Date()): string {
  return `${p2(now.getHours())}:${p2(now.getMinutes())}`;
}

/** 本周一到本周日（周一起） */
export function weekRange(date: ISODate): [ISODate, ISODate] {
  const wd = weekdayOf(date);
  const offset = wd === 0 ? -6 : 1 - wd;
  const start = addDays(date, offset);
  return [start, addDays(start, 6)];
}
