import { describe, expect, it } from "vitest";
import { demoState } from "@/core/demo";
import { monthlyReport, parentReport } from "@/core/report";
import { scorecardData } from "@/core/scorecard";
import { expenseByCategory, monthlySeries } from "@/core/finance";

const TODAY = "2026-09-11";

describe("报告与成绩卡", () => {
  it("家长报告包含本月课次、剩余课时和老师寄语", () => {
    const s = demoState(TODAY);
    const t = parentReport(s, { studentId: "s2", ym: "2026-08", teacherName: "王老师", note: "进步很大" });
    expect(t).toContain("李华 学习月报 · 2026 年 8 月");
    expect(t).toMatch(/本月上课 \d+ 次/);
    expect(t).toContain("剩余");
    expect(t).toContain("进步很大");
    expect(t.trim().endsWith("—— 王老师")).toBe(true);
  });
  it("经营月报有四个数和各学员课时", () => {
    const t = monthlyReport(demoState(TODAY), "2026-08");
    expect(t).toContain("经营月报 · 2026 年 8 月");
    expect(t).toContain("确认收入");
    expect(t).toContain("各学员课时");
  });
  it("成绩卡数据：本月课次、学员数、最勤奋", () => {
    const d = scorecardData(demoState(TODAY), "2026-08");
    expect(d.lessons).toBeGreaterThan(0);
    expect(d.students).toBeGreaterThan(0);
    expect(d.topStudent?.units).toBeGreaterThan(0);
  });
  it("月度序列共 6 个月且末月是当月", () => {
    const se = monthlySeries(demoState(TODAY), TODAY, 6);
    expect(se).toHaveLength(6);
    expect(se[5]!.ym).toBe("2026-09");
    expect(se[0]!.ym).toBe("2026-04");
  });
  it("支出分类占比合计为 1", () => {
    const c = expenseByCategory(demoState(TODAY));
    expect(c.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 5);
  });
});
