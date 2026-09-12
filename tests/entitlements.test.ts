import { describe, expect, it } from "vitest";
import { createEntitlements } from "@/entitlements";

describe("免费版 / 商业版边界", () => {
  it("免费版最多 5 位老师，第 6 位被拦下并给出说明", () => {
    const free = createEntitlements("free");
    expect(free.check("teachers", 4).ok).toBe(true);
    const r = free.check("teachers", 5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("5");
  });
  it("商业版不限", () => {
    expect(createEntitlements("pro").check("teachers", 500).ok).toBe(true);
    expect(createEntitlements("pro").can("recruit.kanban")).toBe(true);
  });
  it("免费版拿不到商业版功能", () => {
    expect(createEntitlements("free").can("reports.pdf")).toBe(false);
  });
});
