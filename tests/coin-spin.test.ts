import { expect, it } from "vitest";
import { createWorld, addCoins, stepWorld } from "../src/core/jar-physics";
it("落币翻转连续变化，不从每帧位置重新随机生成角度", () => {
  const first = addCoins(createWorld(), 1, 6, () => 0.5);
  const second = stepWorld(first);
  expect(first.coins[0]!.phase).toBeTypeOf("number");
  expect(second.coins[0]!.phase).not.toBe(first.coins[0]!.phase);
  expect(Math.abs(second.coins[0]!.phase! - first.coins[0]!.phase!)).toBeLessThan(0.2);
});
