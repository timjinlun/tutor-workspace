import { expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteStore } from "../electron/db/store";
import { emptyState, normalizeState, type State } from "../src/core/types";
import { parentReport } from "../src/core/report";
import { useStore } from "../src/store";

const fixture = () => {
  const s = emptyState();
  s.students = [{ id: "s", name: "测试学员", note: "费用敏感内部备注", tags: ["中考"], goal: "应用题", grade: "初二", courseIds: [], sortOrder: 0, archived: false, createdAt: "2026-09-01" }];
  s.learningRecords = [{ id: "a", studentId: "s", date: "2026-09-14", text: "能独立列式", visibility: "parent", createdAt: "2026-09-14", updatedAt: "2026-09-14" }];
  return s;
};
it("旧 v3 库追加独立记录表，资料与观察在重开、备份和 JSON 往返后仍存在", () => {
  const dir = mkdtempSync(join(tmpdir(), "lessonlog-dossier-test-")); const file = join(dir, "data.db");
  let db: SqliteStore | undefined;
  try {
    db = new SqliteStore(file); db.save({ ...emptyState(), settings: { ...emptyState().settings } }); db.close(); db = undefined;
    const old = new DatabaseSync(file); old.exec("DROP TABLE learningRecords"); old.close();
    db = new SqliteStore(file); expect(db.load()?.learningRecords).toEqual([]);
    const s = fixture(); db.save({ ...s, settings: { ...s.settings } });
    db.backupTo(join(dir, "backup.db")); db.close(); db = new SqliteStore(file);
    expect(normalizeState(db.load() as unknown as State).learningRecords).toEqual(s.learningRecords);
    expect((db.load()?.students as State["students"])[0]).toMatchObject({ tags: ["中考"], grade: "初二", goal: "应用题" });
    const backup = new SqliteStore(join(dir, "backup.db"));
    try { expect(backup.load()?.learningRecords).toEqual(s.learningRecords); } finally { backup.close(); }
    expect(normalizeState(JSON.parse(JSON.stringify(db.load()))).learningRecords).toEqual(s.learningRecords);
  } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
});
it("家长报告只收集本学员所选日期内明确可分享的记录", () => {
  const s = fixture();
  s.learningRecords.push({ ...s.learningRecords[0]!, id: "b", text: "不对外的观察", visibility: "internal" }, { ...s.learningRecords[0]!, id: "c", text: "上个月的记录", date: "2026-08-14" }, { ...s.learningRecords[0]!, id: "d", studentId: "other", text: "另一学生的记录" });
  const text = parentReport(s, { studentId: "s", ym: "2026-09", teacherName: "老师", start: "2026-09-01", end: "2026-09-14" });
  expect(text).toContain("能独立列式");
  expect(text).not.toMatch(/费用敏感|不对外|上个月|另一学生/);
  expect(parentReport(s, { studentId: "s", ym: "2026-09", teacherName: "老师", start: "2026-09-15", end: "2026-09-14" })).toBe("");
});
it("结课保留学习记录；删除学员和清空数据同时清理对应记录", () => {
  useStore.setState({ s: fixture() });
  useStore.getState().updateStudent("s", { archived: true });
  expect(useStore.getState().s.learningRecords).toHaveLength(1);
  useStore.getState().removeStudent("s");
  expect(useStore.getState().s.learningRecords).toEqual([]);
  useStore.setState({ s: fixture() }); useStore.getState().clearAll();
  expect(useStore.getState().s.learningRecords).toEqual([]);
});
