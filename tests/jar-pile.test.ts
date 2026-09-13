import { describe, expect, it } from "vitest";
import { buildJarPile } from "../src/core/jar-pile";

describe("三维金币小山堆", () => {
  it("确定性生成有界的圆形币堆", () => {
    const first = buildJarPile(0.75, 500, 0.1, 0.025);
    const second = buildJarPile(0.75, 500, 0.1, 0.025);

    expect(first).toEqual(second);
    expect(first).toHaveLength(240);
    expect(first.every((coin) => Number.isFinite(coin.x + coin.y + coin.z))).toBe(true);
    expect(first.every((coin) => Math.hypot(coin.x, coin.z) <= 0.82)).toBe(true);
  });

  it("中心堆顶高于边缘形成小山轮廓", () => {
    const pile = buildJarPile(0.8, 240, 0.1, 0.025);
    const center = pile.filter((coin) => Math.hypot(coin.x, coin.z) < 0.3);
    const edge = pile.filter((coin) => Math.hypot(coin.x, coin.z) > 0.6);

    expect(center.length).toBeGreaterThan(0);
    expect(edge.length).toBeGreaterThan(0);
    expect(Math.max(...center.map((coin) => coin.y))).toBeGreaterThan(Math.max(...edge.map((coin) => coin.y)));
  });
});
