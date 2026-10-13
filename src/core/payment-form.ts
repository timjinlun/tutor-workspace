import type { Payment } from "./types";
import type { Parsed } from "./catalog-forms";
import { validISODate } from "./date";

export interface PaymentDraft { hours: string; amount: string; date: string; note: string }

/** 课时不填按 0 算：包月等不按课时收费的学生，只记一笔钱。金额不填按「课时 × 单价」。 */
export function parsePaymentDraft(draft: PaymentDraft, price: number): Parsed<Omit<Payment, "id" | "studentId">> {
  const hours = draft.hours.trim() ? Number(draft.hours) : 0;
  if (!Number.isFinite(hours) || hours < 0) return { ok: false, reason: "课时数不能为负数。" };
  const amount = draft.amount.trim() ? Number(draft.amount) : hours * price;
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, reason: "金额不能为负数。" };
  if (hours === 0 && amount === 0) return { ok: false, reason: "课时和金额至少填一个。" };
  if (!validISODate(draft.date)) return { ok: false, reason: "请选择有效的日期。" };
  return { ok: true, value: { hours, amount, date: draft.date, note: draft.note.trim() } };
}
