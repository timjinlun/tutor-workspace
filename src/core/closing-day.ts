import type { Lesson, State } from "./types";
import { addDays } from "./date";
import { addMinutes, lessonMinutes, lessonsOn } from "./lesson";
import { groupItems } from "./klass";

export function streakDays(lessons: Lesson[], date: string): number {
  const dates = new Set(lessons.filter((l) => l.status === "done").map((l) => l.date));
  let days = 0;
  while (dates.has(addDays(date, -days))) days++;
  return days;
}

export function closingDayData(s: State, date: string) {
  const items = lessonsOn(s, date);
  const done = items.filter((l) => l.status === "done");
  const groups = groupItems(done);
  const month = groupItems(s.lessons.filter((l) => l.status === "done" && l.date.slice(0, 7) === date.slice(0, 7)).map((l) => ({ ...l, virtual: false })));
  const rows = groups.map((g) => {
    const first = g.items[0]!;
    const units = Math.max(...g.items.map((l) => l.units));
    const title = g.classId ? `${s.classes.find((c) => c.id === g.classId)?.name ?? "班课"} · ${g.items.length} 人` : `${s.students.find((st) => st.id === first.studentId)?.name ?? "已删除学员"} · ${s.courses.find((c) => c.id === first.courseId)?.name ?? "课程"}`;
    return { title, start: g.time, end: addMinutes(g.time, Math.max(...g.items.map((l) => lessonMinutes(s, l)))), units };
  });
  return { date, eligible: done.length > 0 && !items.some((l) => l.status === "scheduled"), lessons: groups.length, units: rows.reduce((n, r) => n + r.units, 0), monthLessons: month.length, streak: streakDays(s.lessons, date), rows };
}
export type ClosingDayData = ReturnType<typeof closingDayData>;
