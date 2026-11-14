import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../electron/db/store";

const paths = vi.hoisted(() => ({ appData: "", userData: "" }));
vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => name === "appData" ? paths.appData : paths.userData,
    setPath: (_name: string, value: string) => { paths.userData = value; },
  },
}));

import { dbFile, setupUserData } from "../electron/datadir";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lessonlog-upgrade-"));
  paths.appData = root;
  paths.userData = "";
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function oldV3Database(dirName: string, fileName: string) {
  const file = join(root, dirName, "data", fileName);
  const store = new SqliteStore(file);
  store.save({
    version: 3,
    settings: { teacherName: "王老师" },
    students: [{ id: "s1", name: "小明", courseIds: ["c1"], note: "包月", archived: false, sortOrder: 0 }],
    courses: [{ id: "c1", name: "英语", price: 100, unitsPerLesson: 1 }],
    payments: [{ id: "p1", studentId: "s1", date: "2026-01-01", amount: 1000, hours: 10, note: "" }],
    lessons: [{ id: "l1", studentId: "s1", courseId: "c1", date: "2026-01-02", time: "18:00", status: "done", units: 1, price: 100, source: "manual", createdAt: "2026-01-02T18:00:00Z" }],
  });
  store.close();
  const db = new DatabaseSync(file);
  db.exec("DROP TABLE learningRecords"); // 3.6 之前没有学员学习记录表
  db.close();
  return file;
}

describe("旧版桌面数据原地升级", () => {
  it("3.5–3.6 固定目录中的记录原地保留", () => {
    const file = oldV3Database("LessonLog", "data.db");
    expect(setupUserData()).toEqual({});
    expect(dbFile()).toBe(file);
    const upgraded = new SqliteStore(file);
    expect(upgraded.load()!.students).toHaveLength(1);
    expect(upgraded.load()!.payments).toHaveLength(1);
    expect(upgraded.load()!.lessons).toHaveLength(1);
    upgraded.close();
  });

  it("3.0–3.4 旧目录和旧库名自动迁移，原件保留", () => {
    const old = oldV3Database("独立老师工作台", "工作台.db");
    expect(setupUserData().movedFrom).toBe(join(root, "独立老师工作台"));
    const upgraded = new SqliteStore(dbFile());
    const state = upgraded.load()!;
    expect((state.students as { name: string; note: string }[])[0]).toMatchObject({ name: "小明", note: "包月" });
    expect(state.payments).toHaveLength(1);
    expect(state.lessons).toHaveLength(1);
    expect(state.learningRecords).toEqual([]);
    expect(existsSync(old)).toBe(true);
    upgraded.close();
  });

  it("迁移中留下的目标数据目录不会挡住旧库", () => {
    const old = oldV3Database("记一课", "工作台.db");
    const target = join(root, "LessonLog", "data");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "other-file.txt"), "keep");
    setupUserData();
    const upgraded = new SqliteStore(dbFile());
    expect(upgraded.load()!.lessons).toHaveLength(1);
    expect(existsSync(old)).toBe(true);
    expect(existsSync(join(target, "other-file.txt"))).toBe(true);
    upgraded.close();
  });

  it("固定目录里遗留的旧库名连同 WAL 和 SHM 一起改名", () => {
    const dir = join(root, "LessonLog", "data");
    mkdirSync(dir, { recursive: true });
    for (const suffix of ["", "-wal", "-shm"]) writeFileSync(join(dir, `工作台.db${suffix}`), "fixture");
    setupUserData();
    for (const suffix of ["", "-wal", "-shm"]) {
      expect(existsSync(join(dir, `data.db${suffix}`))).toBe(true);
      expect(existsSync(join(dir, `工作台.db${suffix}`))).toBe(false);
    }
  });
});
