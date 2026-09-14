import { expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

it("边界检查实际拦截兄弟模块、私有入口和直接 Store 依赖", () => {
  const dir = mkdtempSync(join(tmpdir(), "dossier-boundaries-"));
  try {
    mkdirSync(join(dir, "src/ui/modules/a"), { recursive: true }); mkdirSync(join(dir, "src/ui/features/students"), { recursive: true });
    const file = join(dir, "src/ui/modules/a/index.ts");
    const check = () => spawnSync(process.execPath, [resolve("scripts/check-module-boundaries.mjs")], { cwd: dir, encoding: "utf8" });
    writeFileSync(file, 'import {x} from "@/ui/modules/b";'); expect(check().status).toBe(1);
    writeFileSync(file, 'import {x} from "@/store";'); expect(check().status).toBe(1);
    writeFileSync(file, 'import type {x} from "@/core/types";'); expect(check().status).toBe(0);
    writeFileSync(join(dir, "src/ui/features/students/index.ts"), 'import {x} from "@/ui/modules/a/Private";'); expect(check().status).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
