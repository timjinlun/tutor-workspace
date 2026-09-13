import { describe, expect, it } from "vitest";
import { buildJarPile, buildJarVisualPile } from "../src/core/jar-pile";

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

  it("历史可见币层接近真实厚度并带有自然倾角", () => {
    const halfHeight = 0.018;
    const pile = buildJarVisualPile(0.5, 4.6, 0.082, halfHeight);
    const levels = [...new Set(pile.map((coin) => coin.y))].sort((a, b) => a - b);
    const largestGap = Math.max(...levels.slice(1).map((level, index) => level - levels[index]!));

    expect(largestGap).toBeLessThanOrEqual(halfHeight * 2.03);
    expect(pile.some((coin) => Math.abs(coin.tiltX) + Math.abs(coin.tiltZ) > 0.03)).toBe(true);
  });

  it("历史金币堆从宽底座向中心形成明显坡面", () => {
    const fill = 0.5;
    const height = 4.6;
    const pile = buildJarVisualPile(fill, height, 0.082, 0.018);
    const centerTop = Math.max(...pile.filter((coin) => Math.hypot(coin.x, coin.z) < 0.3).map((coin) => coin.y));
    const edgeTop = Math.max(...pile.filter((coin) => Math.hypot(coin.x, coin.z) > 0.65).map((coin) => coin.y));

    expect(centerTop - edgeTop).toBeGreaterThan(fill * height * 0.82 * 0.4);
  });
});
