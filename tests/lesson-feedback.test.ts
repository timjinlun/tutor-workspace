import { expect, it } from "vitest";
import { feedbackTiming } from "../src/core/lesson-feedback";
it("本月打卡从按钮出发，500ms后落币", () => {
  expect(feedbackTiming(280, true, false)).toEqual({ flight: 500, number: 300, jarDelay: 500 });
});
it("撤销、历史补记、缺少起点或减少动态效果不飞金额", () => {
  expect(feedbackTiming(-280, true, false).flight).toBe(0);
  expect(feedbackTiming(0, true, false).jarDelay).toBe(0);
  expect(feedbackTiming(280, false, false).flight).toBe(0);
  expect(feedbackTiming(280, true, true)).toEqual({ flight: 0, number: 0, jarDelay: 0 });
});
