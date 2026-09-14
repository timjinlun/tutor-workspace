import type { LearningRecord } from "./types";
import { validISODate } from "../date";
export const recordsForStudent = (records: LearningRecord[], studentId: string) => records.filter((r) => r.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
export function normalizeLearningRecords(value: unknown, studentIds: Set<string>, lessonOwners: Map<string, string>): LearningRecord[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Partial<LearningRecord>;
    if (typeof r.id !== "string" || ids.has(r.id) || typeof r.studentId !== "string" || !studentIds.has(r.studentId) || typeof r.date !== "string" || !validISODate(r.date) || typeof r.text !== "string" || !r.text.trim()) return [];
    ids.add(r.id);
    return [{ id: r.id, studentId: r.studentId, date: r.date, text: r.text, visibility: r.visibility === "parent" ? "parent" as const : "internal" as const,
      lessonId: typeof r.lessonId === "string" && lessonOwners.get(r.lessonId) === r.studentId ? r.lessonId : undefined,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : r.date,
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : r.date }];
  });
}
