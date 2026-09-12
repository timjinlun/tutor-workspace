import { expect, it } from "vitest";
import { untilNextDay } from "../src/core/local-day";
it("跨午夜只安排下一次唤醒，不持续轮询", () => {
  expect(untilNextDay(new Date(2026, 8, 12, 23, 59, 59, 500))).toBe(500);
  expect(untilNextDay(new Date(2026, 8, 12, 0, 0, 0))).toBe(86400000);
});
