/** 审计条目的工厂：lesson.ts 和 klass.ts 共用 */
import type { AuditEntry, Lesson } from "./types";
import { uid } from "./id";

export function entry(kind: AuditEntry["kind"], summary: string, lesson: Lesson, at: string): AuditEntry {
  return {
    id: uid("a"),
    at,
    kind,
    summary,
    payload: { lessonId: lesson.id, studentId: lesson.studentId, date: lesson.date, time: lesson.time, units: lesson.units, price: lesson.price, status: lesson.status, groupId: lesson.groupId },
  };
}
