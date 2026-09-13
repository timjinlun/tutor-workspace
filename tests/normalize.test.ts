import { describe, expect, it } from "vitest";
import { normalizeState, type State } from "@/core/types";

describe("旧存档补齐字段", () => {
  it("缺 sortOrder / classes / unitMinutes 的存档读入后都有默认值", () => {
    const raw = {
      version: 3,
      students: [{ id: "a", name: "A", courseIds: [], note: "", createdAt: "2026-01-01" }, { id: "b", name: "B", courseIds: [], note: "", createdAt: "2026-01-01", archived: true }],
      settings: { teacherName: "T" },
    } as unknown as Partial<State>;
    const s = normalizeState(raw);
    expect(s.students.map((x) => x.sortOrder)).toEqual([0, 1]);
    expect(s.students[1]!.archived).toBe(true);
    expect(s.classes).toEqual([]);
    expect(s.settings.unitMinutes).toBe(60);
    expect(s.settings.teacherName).toBe("T");
    expect(s.settings.coinPile).toEqual([]);
    expect(s.settings.pendingCoinDrops).toEqual([]);
    expect(s.lessons).toEqual([]);
  });

  it("保留有效金币姿态并过滤损坏的持久化物理数据", () => {
    const valid = {
      id: "coin-a",
      lessonId: "lesson-a",
      position: { x: 0.1, y: 0.25, z: -0.1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      radius: 0.082,
      halfHeight: 0.018,
    };
    const s = normalizeState({
      settings: {
        teacherName: "T",
        coinPile: [valid, { ...valid, id: "broken", position: { x: Number.NaN, y: 1, z: 0 } }],
        pendingCoinDrops: [
          { lessonId: "lesson-a", amount: 280, coinValue: 10, count: 28, radius: 4.5 },
          { lessonId: "broken", amount: 280, coinValue: 10, count: 0, radius: 4.5 },
        ],
      },
    } as unknown as Partial<State>);

    expect(s.settings.coinPile).toEqual([valid]);
    expect(s.settings.pendingCoinDrops).toEqual([
      { lessonId: "lesson-a", amount: 280, coinValue: 10, count: 28, radius: 4.5 },
    ]);
  });
});
