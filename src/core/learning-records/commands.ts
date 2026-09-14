import type { State } from "../types";
import type { LearningRecord, LearningRecordInput } from "./types";
import { validISODate } from "../date";

export function saveLearningRecord(s: State, input: LearningRecordInput, id: string, now: string, editing = false): { ok: true; records: LearningRecord[] } | { ok: false; reason: string } {
  if (!s.students.some((st) => st.id === input.studentId)) return { ok: false, reason: "学员不存在" };
  if (!validISODate(input.date)) return { ok: false, reason: "请填写有效日期" };
  if (!input.text.trim()) return { ok: false, reason: "请写下本次观察" };
  if (input.text.length > 4000) return { ok: false, reason: "单条记录请控制在 4000 字以内" };
  if (input.visibility !== "internal" && input.visibility !== "parent") return { ok: false, reason: "请选择记录可见范围" };
  if (input.lessonId && !s.lessons.some((l) => l.id === input.lessonId && l.studentId === input.studentId && l.status === "done")) return { ok: false, reason: "关联课程已变化，请重新选择已完成的课程" };
  const existing = s.learningRecords.find((r) => r.id === id);
  if (editing && (!existing || existing.studentId !== input.studentId)) return { ok: false, reason: "记录不存在或不属于该学员" };
  const record: LearningRecord = { ...input, lessonId: input.lessonId || undefined, text: input.text.trim(), id, createdAt: existing?.createdAt ?? now, updatedAt: now };
  return { ok: true, records: existing ? s.learningRecords.map((r) => r.id === id ? record : r) : [...s.learningRecords, record] };
}
