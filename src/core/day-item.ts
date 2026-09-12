/** 一天里的一节课：可能是落库的，也可能是固定课表刚生成、还没落库的（virtual） */
import type { AuditEntry, Lesson } from "./types";

export type DayItem = Lesson & { virtual?: boolean };

export interface LessonChange {
  lessons: Lesson[];
  audit: AuditEntry;
}

/** 同一次班课的记录归为一组；一对一每节自成一组 */
export function groupKeyOf(l: Pick<Lesson, "id" | "groupId">): string {
  return l.groupId ?? l.id;
}

export function stripVirtual(item: DayItem): Lesson {
  const copy: DayItem = { ...item };
  delete copy.virtual;
  return copy;
}
