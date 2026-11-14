import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { SqliteStore } from "../electron/db/store";

it("备份到已存在的文件：直接替换", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-backup-"));
  const store = new SqliteStore(path.join(dir, "data.db"));
  store.save({ version: 3, settings: {}, students: [{ id: "s1", name: "张明" }] });
  const target = path.join(dir, "backup.db");
  store.backupTo(target);
  store.backupTo(target);
  expect(new SqliteStore(target).load()!.students).toHaveLength(1);
  store.close();
});
