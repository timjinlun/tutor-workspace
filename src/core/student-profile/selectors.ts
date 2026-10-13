import type { State, Student } from "../types";

export function cleanTags(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))] : [];
}
/** 在读学员，按学员名单里拖出来的手动顺序。凡是列出全部在读学员的视图都用它，顺序才一致。 */
export function activeStudentsInOrder(s: State): Student[] {
  return s.students.filter((st) => !st.archived).sort((a, b) => a.sortOrder - b.sortOrder);
}
export interface StudentTag { key: string; label: string; kind: "course" | "format" | "custom" }
export function studentTags(s: State, st: Student): StudentTag[] {
  const tags: StudentTag[] = s.courses.filter((c) => st.courseIds.includes(c.id)).map((c) => ({ key: `course:${c.id}`, label: c.name, kind: "course" }));
  const lessons = s.lessons.filter((l) => l.studentId === st.id && l.status !== "cancelled");
  const templates = s.templates.filter((t) => t.active && t.studentId === st.id);
  // Course membership alone cannot tell whether a new student attends 1:1 or a class.
  if (lessons.some((l) => !l.classId) || templates.some((t) => !t.classId)) tags.push({ key: "format:individual", label: "1 对 1", kind: "format" });
  if (s.classes.some((c) => c.active && c.studentIds.includes(st.id)) || lessons.some((l) => l.classId)) tags.push({ key: "format:class", label: "小班", kind: "format" });
  return [...tags, ...cleanTags(st.tags).map((label): StudentTag => ({ key: `custom:${label}`, label, kind: "custom" }))];
}
export function filterStudents(s: State, query: string, selectedTags: string[]): Student[] {
  const keyword = query.trim().toLocaleLowerCase();
  return s.students.filter((st) => {
    const tags = studentTags(s, st);
    return (!keyword || [st.name, st.grade, st.school, ...tags.map((t) => t.label)].some((v) => v?.toLocaleLowerCase().includes(keyword)))
      && selectedTags.every((key) => tags.some((tag) => tag.key === key));
  });
}
