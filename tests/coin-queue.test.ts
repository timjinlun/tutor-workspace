import { expect, it } from "vitest";
import { scheduleCoins } from "../src/core/coin-queue";
it("连续打卡保留两笔待落币计划，班课各组顺序发射", () => {
  const first = scheduleCoins([], [{id:"a",amount:280}], 10, 0, 500);
  const second = scheduleCoins(first, [{id:"b",amount:280}], 10, 100, 500);
  expect(second.filter((x)=>x.id==="a")).toHaveLength(28);
  expect(second.filter((x)=>x.id==="b")).toHaveLength(28);
  expect(Math.min(...second.filter((x)=>x.id==="b").map((x)=>x.at))).toBe(600);
});
it("撤销只移除对应课程的未发射币", () => {
  const pending = scheduleCoins([], [{id:"a",amount:280},{id:"b",amount:280}], 10, 0, 0);
  const next = scheduleCoins(pending,[{id:"a",amount:-280}],10,0,0);
  expect(next).toHaveLength(28);expect(next.every((x)=>x.id==="b")).toBe(true);
});
