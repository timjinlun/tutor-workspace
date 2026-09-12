import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../electron/db/store";

/** 照 v2 的真实建表语句造一个旧库 */
function makeV2(file: string, withData: boolean) {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT NOT NULL);
    INSERT INTO meta VALUES('schema_version','1'),('created_at','2026-08-20');
    CREATE TABLE settings(k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE courses(id TEXT PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0, units_per_session REAL NOT NULL DEFAULT 1, ord INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE students(id TEXT PRIMARY KEY, name TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', ord INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE student_courses(student_id TEXT NOT NULL, course_id TEXT NOT NULL, ord INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(student_id, course_id));
    CREATE TABLE payments(id TEXT PRIMARY KEY, student_id TEXT NOT NULL, date TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, hours REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', ord INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX idx_payments_student ON payments(student_id);
    CREATE TABLE teachers(id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', ord INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE schedules(id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL DEFAULT '', student_id TEXT NOT NULL DEFAULT '', course_id TEXT NOT NULL DEFAULT '', date TEXT NOT NULL DEFAULT '', time TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', note TEXT NOT NULL DEFAULT '', ord INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE attendance(student_id TEXT NOT NULL, date TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT 0, time TEXT NOT NULL DEFAULT '', course_id TEXT NOT NULL DEFAULT '', price REAL, units REAL NOT NULL DEFAULT 1, schedule_id TEXT NOT NULL DEFAULT '', marked_at TEXT NOT NULL DEFAULT '', PRIMARY KEY(student_id, date, seq));
    CREATE TABLE attendance_log(id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, action TEXT NOT NULL, student_id TEXT, student_name TEXT, date TEXT, time TEXT, course_id TEXT, course_name TEXT, units REAL, fee REAL);
    CREATE TABLE todos(id TEXT PRIMARY KEY, title TEXT, due TEXT, priority TEXT, done INTEGER, note TEXT, ord INTEGER);
    CREATE TABLE expenses(id TEXT PRIMARY KEY, date TEXT, category TEXT, amount REAL, note TEXT, ord INTEGER);
    CREATE TABLE other_incomes(id TEXT PRIMARY KEY, date TEXT, source TEXT, amount REAL, note TEXT, ord INTEGER);
    CREATE TABLE leads(id TEXT PRIMARY KEY, name TEXT, phone TEXT, source TEXT, domain TEXT, stage TEXT, intent REAL, note TEXT, referrer TEXT, student_id TEXT, created_at TEXT, last_follow TEXT, ord INTEGER);
    CREATE TABLE materials(id TEXT PRIMARY KEY, title TEXT, course_id TEXT, student_id TEXT, type TEXT, url TEXT, content TEXT, tags TEXT, attachment TEXT, file_name TEXT, created_at TEXT, ord INTEGER);
    CREATE TABLE referral_rewarded(ref TEXT PRIMARY KEY);
    CREATE TABLE snapshots(id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL);
    INSERT INTO snapshots(at,reason,payload) VALUES('2026-08-27T09:00:00.000Z','启动','{}');
  `);
  if (withData) {
    db.exec(`
      INSERT INTO settings VALUES('teacherName','"王老师"'),('lowBalanceThreshold','4'),('remindAheadClasses','2');
      INSERT INTO courses VALUES('c1','数学1对1辅导',280,1,0);
      INSERT INTO students VALUES('s1','张明','赠送一节',0);
      INSERT INTO student_courses VALUES('s1','c1',0);
      INSERT INTO payments VALUES('p1','s1','2026-02-01',5600,20,'',0);
      INSERT INTO attendance VALUES('s1','2026-02-03',0,'18:00','c1',280,1,'','2026-02-03T10:00:00.000Z');
      INSERT INTO attendance VALUES('s1','2026-02-10',0,'','c1',NULL,1,'sc1','');
      INSERT INTO schedules VALUES('sc1','t1','s1','c1','2026-02-10','18:00','done','',0);
      INSERT INTO schedules VALUES('sc2','t1','s1','c1','2026-02-17','18:00','pending','',1);
      INSERT INTO leads VALUES('l1','王女士','138****001','小红书','公域','跟进中',12000,'','', '', '2026-08-01','2026-08-09',0);
    `);
  }
  db.close();
}

describe("v2 数据库自动升级到 v3", () => {
  it("空的 v2 库：打开不报错，视为全新安装（会灌示例数据）", () => {
    const dir = mkdtempSync(join(tmpdir(), "tw-mig-"));
    const file = join(dir, "工作台.db");
    makeV2(file, false);
    const store = new SqliteStore(file);
    expect(store.hasState()).toBe(false);
    expect(store.migratedFromV2).toBeNull();
    /* 旧表已改名保留，v3 表建好了 */
    const db = new DatabaseSync(file);
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name);
    expect(names).toContain("v2_students");
    expect(names).toContain("students");
    expect((db.prepare("PRAGMA table_info(students)").all() as { name: string }[]).map((c) => c.name)).toContain("k1");
    expect((db.prepare("SELECT v FROM meta WHERE k='schema_version'").get() as { v: string }).v).toBe("3");
    db.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("有数据的 v2 库：学员、缴费、考勤、排课、线索全部转过来", () => {
    const dir = mkdtempSync(join(tmpdir(), "tw-mig-"));
    const file = join(dir, "工作台.db");
    makeV2(file, true);
    const store = new SqliteStore(file);
    expect(store.hasState()).toBe(true);
    const st = store.load()!;
    expect(st.students).toHaveLength(1);
    expect((st.students as { courseIds: string[] }[])[0]!.courseIds).toEqual(["c1"]);
    expect(st.payments).toHaveLength(1);
    const lessons = st.lessons as { status: string; source: string; price: number; date: string }[];
    /* 两条考勤 → done；已完成的排课不重复；待上的排课 → scheduled */
    expect(lessons.filter((l) => l.status === "done")).toHaveLength(2);
    expect(lessons.filter((l) => l.status === "scheduled")).toHaveLength(1);
    expect(lessons.find((l) => l.date === "2026-02-10")!.source).toBe("template");
    expect(lessons.find((l) => l.date === "2026-02-10")!.price).toBe(280); // price 为 NULL 时按课程单价补
    expect((st.leads as { status: string }[])[0]!.status).toBe("contacted");
    expect(st.settings.teacherName).toBe("王老师");
    expect(st.settings.remindAhead).toBe(2);
    /* 二次打开不再迁移 */
    store.close();
    const again = new SqliteStore(file);
    expect(again.migratedFromV2).toBeNull();
    expect(again.load()!.students).toHaveLength(1);
    again.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("全新的 v3 库照常工作", () => {
    const dir = mkdtempSync(join(tmpdir(), "tw-mig-"));
    const store = new SqliteStore(join(dir, "x.db"));
    expect(store.hasState()).toBe(false);
    store.save({ version: 3, settings: { teacherName: "A" }, students: [{ id: "s1", name: "x" }] });
    expect(store.load()!.settings.teacherName).toBe("A");
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
