import { describe, expect, it } from "vitest";
import { parsePaymentDraft } from "@/core/payment-form";

const draft = { hours: "10", amount: "", date: "2026-09-23", note: "" };

describe("缴费表单", () => {
  it("只填课时，金额按单价算", () => {
    expect(parsePaymentDraft(draft, 100)).toEqual({ ok: true, value: { hours: 10, amount: 1000, date: "2026-09-23", note: "" } });
  });

  it("包月学生：课时填 0 或不填，只记一笔钱", () => {
    expect(parsePaymentDraft({ ...draft, hours: "0", amount: "100" }, 100)).toEqual({ ok: true, value: { hours: 0, amount: 100, date: "2026-09-23", note: "" } });
    expect(parsePaymentDraft({ ...draft, hours: "", amount: "100" }, 100)).toMatchObject({ ok: true, value: { hours: 0, amount: 100 } });
  });

  it.each([
    { hours: "0", amount: "" },
    { hours: "", amount: "0" },
    { hours: "-1" },
    { amount: "-5" },
    { hours: "abc" },
    { date: "2026-13-01" },
  ])("拒绝无效输入 %j", (patch) => {
    expect(parsePaymentDraft({ ...draft, ...patch }, 100).ok).toBe(false);
  });
});
