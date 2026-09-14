import { expect, it } from "vitest";
import { closingEncouragement } from "../src/core/closing-encouragement";
import type { ClosingDayData } from "../src/core/closing-day";

const day: ClosingDayData = {
  date: "2026-09-13",
  eligible: true,
  lessons: 3,
  units: 4.5,
  monthLessons: 18,
  streak: 6,
  rows: [],
};

it("收工文案会把今天完成的具体事实写进去，而不是泛泛鼓励", () => {
  expect(closingEncouragement(day, () => 0)).toContain("3 节课");
  expect(closingEncouragement(day, () => 0.999)).toContain("18 节");
});

it("收工文案在相同随机值下保持稳定，便于一次打开只展示一句", () => {
  expect(closingEncouragement(day, () => 0.42)).toBe(closingEncouragement(day, () => 0.42));
});
