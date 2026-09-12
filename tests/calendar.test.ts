import { describe, expect, it } from "vitest";
import { gridBounds, monthGrid, placeBlocks, shiftMonth, timeToMin, weeksAround } from "@/core/calendar";

describe("日历几何", () => {
  it("周从周一起，两周就是 14 天", () => {
    const w = weeksAround("2026-09-11", 1); // 周五
    expect(w[0]).toBe("2026-09-07");
    expect(w[6]).toBe("2026-09-13");
    expect(weeksAround("2026-09-13", 2)).toHaveLength(14); // 周日仍属于本周
    expect(weeksAround("2026-09-13", 2)[0]).toBe("2026-09-07");
  });

  it("月历补齐首尾，每行 7 天", () => {
    const g = monthGrid("2026-09"); // 9/1 是周二
    expect(g[0]![0]).toBe("2026-08-31");
    expect(g.at(-1)!.at(-1)).toBe("2026-10-04");
    expect(g.every((r) => r.length === 7)).toBe(true);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("网格默认 8–22 点，有课超出就扩", () => {
    expect(gridBounds([])).toEqual([8, 22]);
    expect(gridBounds([{ id: "a", start: timeToMin("07:30"), end: timeToMin("08:30") }])).toEqual([7, 22]);
    expect(gridBounds([{ id: "a", start: timeToMin("21:30"), end: timeToMin("23:15") }])).toEqual([8, 24]);
  });

  it("重叠的课并排，不重叠的各占整列", () => {
    const placed = placeBlocks([
      { id: "a", start: 600, end: 660 },
      { id: "b", start: 630, end: 690 },
      { id: "c", start: 700, end: 760 },
    ]);
    const by = Object.fromEntries(placed.map((p) => [p.id, p]));
    expect(by.a).toMatchObject({ col: 0, cols: 2 });
    expect(by.b).toMatchObject({ col: 1, cols: 2 });
    expect(by.c).toMatchObject({ col: 0, cols: 1 });
  });
});
