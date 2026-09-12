/**
 * 日历的纯几何：一周几天、一个月几行、时间网格上下界、重叠课块怎么分列。
 * 不认识 React，也不认识 State 之外的东西，方便单测。
 */
import type { ISODate } from "./types";
import { addDays, parseISO, toISODate, weekRange } from "./date";

export function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 从 start 起连续 n 天 */
export function daysFrom(start: ISODate, n: number): ISODate[] {
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

/** 包含 date 的那一周（周一起）往后 weeks 周 */
export function weeksAround(date: ISODate, weeks: 1 | 2): ISODate[] {
  const [start] = weekRange(date);
  return daysFrom(start, 7 * weeks);
}

/** 月历格子：从该月 1 号所在周的周一起，到月末所在周的周日止，每行 7 天 */
export function monthGrid(ym: string): ISODate[][] {
  const [y, m] = ym.split("-").map(Number);
  const first = toISODate(new Date(y ?? 2026, (m ?? 1) - 1, 1));
  const last = toISODate(new Date(y ?? 2026, m ?? 1, 0));
  const [start] = weekRange(first);
  const [, end] = weekRange(last);
  const rows: ISODate[][] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) rows.push(daysFrom(d, 7));
  return rows;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y ?? 2026, (m ?? 1) - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function monthOf(date: ISODate): string {
  return date.slice(0, 7);
}

/** 星期几（0 = 周日）对应的中文，按周一起的顺序 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export interface TimeBlock {
  id: string;
  /** 从 0:00 起的分钟数 */
  start: number;
  end: number;
}

export interface PlacedBlock extends TimeBlock {
  col: number;
  cols: number;
}

/**
 * 时间网格的上下界（整点）。默认 8:00–22:00，有课超出就扩，让课永远看得见。
 */
export function gridBounds(blocks: TimeBlock[], defaults: [number, number] = [8, 22]): [number, number] {
  let lo = defaults[0], hi = defaults[1];
  for (const b of blocks) {
    lo = Math.min(lo, Math.floor(b.start / 60));
    hi = Math.max(hi, Math.ceil(b.end / 60));
  }
  return [lo, Math.max(hi, lo + 1)];
}

/**
 * 同一天里时间重叠的课并排显示：按开始时间扫一遍，能塞进已有列就塞，塞不下就开新列。
 * 一组互相重叠的课共用 cols，这样宽度一致。
 */
export function placeBlocks<T extends TimeBlock>(blocks: T[]): (T & PlacedBlock)[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: (T & PlacedBlock)[] = [];
  let cluster: (T & PlacedBlock)[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) c.cols = cols;
    out.push(...cluster);
    cluster = [];
  };
  const colEnds: number[] = [];
  for (const b of sorted) {
    if (b.start >= clusterEnd && cluster.length) { flush(); colEnds.length = 0; }
    let col = colEnds.findIndex((e) => e <= b.start);
    if (col < 0) { col = colEnds.length; colEnds.push(0); }
    colEnds[col] = b.end;
    cluster.push({ ...b, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  if (cluster.length) flush();
  return out;
}

export function sameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function dayNumber(date: ISODate): number {
  return parseISO(date).getDate();
}
