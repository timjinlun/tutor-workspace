/** 成绩卡的数据：本月的几个可以晒的数。纯函数，画图在 ui/widgets 里。 */
import type { State } from "./types";
import { incomeInMonth, doneUnitsInMonth } from "./finance";
import { monthKey } from "./date";

export interface ScorecardData {
  ym: string;
  lessons: number;
  units: number;
  income: number;
  students: number;
  /** 本月上课最多的学员 */
  topStudent: { name: string; units: number } | null;
  /** 本月连续有课的最长周数 */
  weeks: number;
  teacherName: string;
}

export function scorecardData(state: State, ym: string): ScorecardData {
  const done = state.lessons.filter((l) => l.status === "done" && monthKey(l.date) === ym);
  const per = new Map<string, number>();
  for (const l of done) per.set(l.studentId, (per.get(l.studentId) ?? 0) + l.units);
  let top: ScorecardData["topStudent"] = null;
  for (const [id, units] of per) {
    const name = state.students.find((s) => s.id === id)?.name;
    if (name && (!top || units > top.units)) top = { name, units };
  }
  const weekSet = new Set(done.map((l) => weekIndex(l.date)));
  return {
    ym,
    lessons: done.length,
    units: doneUnitsInMonth(state, ym),
    income: incomeInMonth(state, ym),
    students: per.size,
    topStudent: top,
    weeks: weekSet.size,
    teacherName: state.settings.teacherName,
  };
}

function weekIndex(date: string): number {
  const d = new Date(date + "T00:00:00");
  return Math.floor((d.getTime() / 86400000 + 4) / 7);
}
