import { describe, expect, it } from "vitest";
import { emptyState } from "@/core/types";
import { balance, balanceLevel, confirmedIncome, fmtMoney, incomeInMonth, lowBalanceStudents } from "@/core/finance";
import { toISODate } from "@/core/date";

function s() {
  const st = emptyState();
  st.settings.lowBalanceThreshold = 4;
  st.settings.remindAhead = 2;
  st.students = [
    { id: "a", name: "A", courseIds: [], note: "", createdAt: "2026-01-01", archived: false, sortOrder: 0 },
    { id: "b", name: "B", courseIds: [], note: "", createdAt: "2026-01-01", archived: false, sortOrder: 0 },
  ];
  st.payments = [
    { id: "p1", studentId: "a", date: "2026-09-01", amount: 5600, hours: 20, note: "" },
    { id: "p2", studentId: "b", date: "2026-09-02", amount: 1400, hours: 5, note: "" },
  ];
  for (let i = 0; i < 15; i++) st.lessons.push({ id: `a${i}`, studentId: "a", courseId: "c", date: "2026-09-03", time: "10:00", status: "done", units: 1, price: 280, source: "backfill", createdAt: "" });
  st.lessons.push({ id: "b1", studentId: "b", courseId: "c", date: "2026-09-03", time: "10:00", status: "done", units: 1, price: 280, source: "backfill", createdAt: "" });
  st.lessons.push({ id: "x", studentId: "a", courseId: "c", date: "2026-09-04", time: "10:00", status: "cancelled", units: 1, price: 280, source: "manual", createdAt: "" });
  return st;
}

describe("余额与收入", () => {
  it("余额 = 购买 − 已上，取消的课不算", () => {
    expect(balance(s(), "a")).toBe(5);
    expect(balance(s(), "b")).toBe(4);
  });
  it("预警等级按阈值分层", () => {
    expect(balanceLevel(s(), "a")).toBe("low"); // 5 ≤ 4+2
    expect(balanceLevel(s(), "b")).toBe("danger"); // 4 ≤ 4
    const low = lowBalanceStudents(s());
    expect(low.map((x) => x.student.id)).toEqual(["b", "a"]);
  });
  it("确认收入按打卡时锁定的单价算", () => {
    expect(confirmedIncome(s(), "a")).toBe(15 * 280);
    expect(incomeInMonth(s(), "2026-09")).toBe(16 * 280);
  });
  it("负数货币写成 −¥150", () => {
    expect(fmtMoney(-150)).toBe("−¥150");
    expect(fmtMoney(24080)).toBe("¥24,080");
  });
  it("日期按本地时区切，不按 UTC", () => {
    expect(toISODate(new Date(2026, 8, 11, 23, 30))).toBe("2026-09-11");
  });
});
