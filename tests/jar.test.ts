import { describe, expect, it } from "vitest";
import { emptyState, type Lesson } from "../src/core/types";
import { coinValue, jarState, jarSettings, incomeChanges } from "../src/core/jar";
import { createWorld, addCoins, stepWorld } from "../src/core/jar-physics";

const lesson = (id: string, price = 280): Lesson => ({ id, price, units: 1, studentId: id, courseId: "c", date: "2026-09-12", time: "12:00", status: "done", source: "manual", createdAt: "2026-09-12T12:00:00Z" });

describe("储蓄罐账目", () => {
  it("按最近20条完成记录选币值，不受待上课影响", () => {
    expect(coinValue([lesson("a")])).toBe(10);
    expect(coinValue([lesson("a", 1200)])).toBe(50);
    expect(coinValue([lesson("a", 80)])).toBe(2);
    expect(coinValue([])).toBe(10);
    expect(coinValue([{ ...lesson("x", 99999), status: "scheduled" }])).toBe(10);
  });
  it("满罐保留实际收入，撤销后回落", () => {
    const s = emptyState();
    s.lessons = [lesson("a", 12000)];
    expect(jarState(s)).toMatchObject({ amount: 12000, fill: 1 });
    s.lessons = [];
    expect(jarState(s)).toMatchObject({ amount: 0, fill: 0 });
  });
  it("同月币值锁定，跨月重算，容量不跟随改动", () => {
    const s = emptyState();
    s.settings.coinValue = { amount: 5, month: "2026-09" };
    s.settings.jarCapacity = 20000;
    s.lessons = [lesson("a", 1200)];
    expect(jarSettings(s, "2026-09-30").coinValue.amount).toBe(5);
    expect(jarSettings(s, "2026-10-01")).toMatchObject({ coinValue: { amount: 50, month: "2026-10" }, jarCapacity: 20000 });
  });
  it("仅识别真实金额变化，重复状态和重新排序不落币", () => {
    const a = lesson("a");
    expect(incomeChanges([a], [a])).toEqual([]);
    expect(incomeChanges([], [a])).toEqual([{ id: "a", amount: 280 }]);
    expect(incomeChanges([a], [])).toEqual([{ id: "a", amount: -280 }]);
  });
});

describe("储蓄罐物理", () => {
  it("长圆柱最后发射的币能在剩余300ms内接近罐底", () => {
    let w = addCoins(createWorld(300), 1, 4, () => 0.5);
    for (let i = 0; i < 18; i++) w = stepWorld(w);
    expect(w.coins[0]!.y).toBeGreaterThan(270);
  });
  it("活跃粒子不超过240，超额沉积", () => {
    const w = addCoins(createWorld(), 300, 4, () => 0.5);
    expect(w.coins.length).toBe(240);
    expect(w.deposited.length).toBe(60);
  });
  it("有限时间休眠且边界内数值稳定", () => {
    let w = addCoins(createWorld(), 30, 4, () => 0.5);
    for (let i = 0; i < 300 && !w.sleeping; i++) w = stepWorld(w);
    expect(w.sleeping).toBe(true);
    for (const c of w.coins) {
      expect(Number.isFinite(c.x + c.y)).toBe(true);
      expect(c.x).toBeGreaterThanOrEqual(24 + c.r);
      expect(c.x).toBeLessThanOrEqual(136 - c.r);
      expect(c.y).toBeLessThanOrEqual(124 - c.r);
    }
    expect(stepWorld(w)).toBe(w);
  });
});
