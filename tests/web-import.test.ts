import { describe, expect, it } from "vitest";
import { normalizeState, type State } from "@/core/types";
import { balance, confirmedIncome, purchasedHours, usedUnits } from "@/core/finance";
import webExport from "./fixtures/web-export-v4.json";

/** 导入入口会先剥掉 { version, exportedAt, data } 外壳，这里照做 */
const load = () => normalizeState(structuredClone(webExport.data) as unknown as Partial<State>);

describe("网页版导出的 JSON", () => {
  it("上过的课（attendance）展开成已上的 lessons", () => {
    const s = load();
    const done = s.lessons.filter((l) => l.status === "done");
    expect(done.filter((l) => l.studentId === "s1").map((l) => [l.date, l.time])).toEqual([
      ["2026-09-01", ""],
      ["2026-09-02", ""],
      ["2026-09-03", "10:00"],
      ["2026-09-03", ""],
    ]);
    expect(done.every((l) => l.source === "backfill")).toBe(true);
  });

  it("一节课的课时和单价：记录里有就用记录的，没有就用课程的", () => {
    const s = load();
    const plain = s.lessons.find((l) => l.studentId === "s1" && l.date === "2026-09-01")!;
    expect(plain).toMatchObject({ courseId: "c1", units: 1, price: 100 });
    const v8 = s.lessons.find((l) => l.studentId === "s2")!;
    expect(v8).toMatchObject({ courseId: "c2", units: 2, price: 180 });
  });

  it("剩余课时 = 已购 − 已上，不再虚高", () => {
    expect(balance(load(), "s1")).toBe(16);
  });

  it("待上的排课带过来，已完成和已取消的不重复生成", () => {
    const scheduled = load().lessons.filter((l) => l.status === "scheduled");
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toMatchObject({ studentId: "s1", date: "2026-10-08", time: "16:00", courseId: "c1", units: 1, price: 100 });
  });

  it("课程、学员字段换成 App 的名字", () => {
    const s = load();
    expect(s.courses.map((c) => c.unitsPerLesson)).toEqual([1, 2]);
    expect(s.students.find((st) => st.id === "s3")!.courseIds).toEqual(["c1"]);
    expect(s.students.find((st) => st.id === "s2")!.note).toBe("包月 2000/月");
    expect(s.payments).toHaveLength(2);
  });

  it("App 自己导出的数据不当成网页版处理", () => {
    const app = load();
    expect(normalizeState(structuredClone(app)).lessons).toEqual(app.lessons);
  });
});

/* 这两份文件是用网页版（商品版、v8）自己的 exportData 生成的，expected 是网页版自己算的每人课时和收入 */
describe.each([
  ["商品版", "./fixtures/web-real-shop.json"],
  ["v8", "./fixtures/web-real-v8.json"],
])("网页版%s的真实导出", (_name, file) => {
  it("导入后每个学员的已购、已上、确认收入和网页版一致", async () => {
    const { payload, expected } = (await import(file)).default as { payload: { data: unknown }; expected: Record<string, { bought: number; used: number; income: number }> };
    const s = normalizeState(structuredClone(payload.data) as Partial<State>);
    for (const [id, want] of Object.entries(expected)) {
      expect({ id, bought: purchasedHours(s, id), used: usedUnits(s, id), income: confirmedIncome(s, id) }).toEqual({ id, bought: want.bought, used: want.used, income: want.income });
    }
  });
});
