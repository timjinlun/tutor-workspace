import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { expect, it } from "vitest";

// Electron requires a display server on Linux (run under xvfb in headless CI).
it.skipIf(process.platform === "linux" && !process.env.DISPLAY)("selects and decodes wallpapers under the production CSP", async () => {
  const electron = createRequire(import.meta.url)("electron") as string;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const { stdout } = await promisify(execFile)(electron, ["scripts/verify-wallpaper.cjs"], { env, timeout: 25000 });
  expect(stdout).toContain("Wallpaper regression: PASS");
}, 30000);
