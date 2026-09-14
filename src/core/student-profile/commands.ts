import type { State, Student } from "../types";
import type { StudentProfileInput } from "./types";
import { cleanTags } from "./selectors";

export function editStudentProfile(s: State, id: string, input: StudentProfileInput): { ok: true; students: Student[] } | { ok: false; reason: string } {
  if (!s.students.some((st) => st.id === id)) return { ok: false, reason: "学员不存在，请重新选择" };
  if (!input.name.trim()) return { ok: false, reason: "请填写学员姓名" };
  if (input.courseIds.some((courseId) => !s.courses.some((c) => c.id === courseId))) return { ok: false, reason: "课程已变化，请重新选择" };
  if (input.referrerId && (input.referrerId === id || !s.students.some((st) => st.id === input.referrerId))) return { ok: false, reason: "请选择有效的推荐人" };
  const fields = {
    name: input.name.trim(), courseIds: [...new Set(input.courseIds)], note: input.note.trim(),
    grade: input.grade?.trim() ?? "", school: input.school?.trim() ?? "", goal: input.goal?.trim() ?? "",
    guardian: input.guardian?.trim() ?? "", contact: input.contact?.trim() ?? "", communication: input.communication?.trim() ?? "",
    tags: cleanTags(input.tags), referrerId: input.referrerId || undefined,
  };
  return { ok: true, students: s.students.map((st) => st.id === id ? { ...st, ...fields } : st) };
}
