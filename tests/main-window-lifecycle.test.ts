import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("main window lifecycle", () => {
  it("does not focus a destroyed window when a second instance starts", () => {
    const source = fs.readFileSync(path.resolve("electron/main.ts"), "utf8");
    const handler = source.match(/app\.on\("second-instance",[\s\S]*?\n\s*}\);/)?.[0];

    expect(handler).toBeDefined();
    expect(handler).toContain("!win.isDestroyed()");
  });
});
