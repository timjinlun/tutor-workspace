import type { Course, Teacher } from "./types";

type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };
export interface CourseDraft { name: string; price: string; units: string; minutes: string }
export interface TeacherDraft { name: string; color: string; pay: string }

export function parseCourseDraft(draft: CourseDraft): Parsed<Omit<Course, "id">> {
  if (!draft.name.trim()) return { ok: false, reason: "请填写课程名称。" };
  const price = Number(draft.price), units = Number(draft.units), minutes = Number(draft.minutes);
  if (!draft.price.trim() || !Number.isFinite(price) || price < 0) return { ok: false, reason: "请填写有效的每课时单价，可以为 0。" };
  if (!Number.isFinite(units) || units < 0.5) return { ok: false, reason: "每节至少扣 0.5 课时。" };
  if (draft.minutes.trim() && (!Number.isFinite(minutes) || minutes < 5)) return { ok: false, reason: "每课时至少 5 分钟，或留空使用默认规则。" };
  return { ok: true, value: { name: draft.name.trim(), price, unitsPerLesson: units, unitMinutes: draft.minutes.trim() ? minutes : undefined } };
}

export function parseTeacherDraft(draft: TeacherDraft): Parsed<Omit<Teacher, "id" | "self">> {
  if (!draft.name.trim()) return { ok: false, reason: "请填写老师姓名。" };
  if (!/^#[0-9a-f]{6}$/i.test(draft.color)) return { ok: false, reason: "请选择老师的课表颜色。" };
  const pay = Number(draft.pay);
  if (draft.pay.trim() && (!Number.isFinite(pay) || pay < 0)) return { ok: false, reason: "课时费不能为负数，留空表示只统计课时。" };
  return { ok: true, value: { name: draft.name.trim(), color: draft.color, payPerUnit: draft.pay.trim() ? pay : undefined } };
}
