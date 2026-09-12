"use strict";
/**
 * 数据层：SQLite（Node 24 内置 node:sqlite，零 native 依赖）
 *
 * 设计要点：
 * 1. 真·关系表，不是把一坨 JSON 塞进一个字段。这样以后能直接写 SQL 查、能加索引和约束、
 *    也为将来的云同步留了路。
 * 2. 但对外只暴露 loadState() / saveState(S) 两个函数，返回的对象形状和原来 localStorage 里
 *    那个 S 一模一样 —— 所以前端 1100 行 UI 代码一行都不用改。
 * 3. 每次保存都在一个事务里完成：要么全成、要么全不动，不会写到一半断电留下半截数据。
 * 4. 考勤的每一次「打卡 / 取消打卡」自动写进 attendance_log 审计表。审计发生在数据层，
 *    不管 UI 以后怎么改都漏不掉。
 */

const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = 1;
const SNAPSHOT_KEEP = 30;          // 自动快照保留份数
const SNAPSHOT_MIN_GAP_MS = 60 * 60 * 1000; // 自动快照最短间隔：1 小时

let db = null;
let dbPath = null;

/* ---------- 小工具：node:sqlite 只接受 null/number/string/bigint/Uint8Array ---------- */
const s = (v) => (v === undefined || v === null ? "" : String(v));
const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const nOrNull = (v) => (v === undefined || v === null || v === "" ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const b = (v) => (v ? 1 : 0);
const nowISO = () => new Date().toISOString();

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS courses(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  units_per_session REAL NOT NULL DEFAULT 1,
  ord INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS student_courses(
  student_id TEXT NOT NULL,
  course_id  TEXT NOT NULL,
  ord INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(student_id, course_id)
);

CREATE TABLE IF NOT EXISTS payments(
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  hours REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);

CREATE TABLE IF NOT EXISTS teachers(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schedules(
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL DEFAULT '',
  student_id TEXT NOT NULL DEFAULT '',
  course_id  TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);

/* 考勤：一个学员一天可以有多条（seq 区分），带打卡时间戳 */
CREATE TABLE IF NOT EXISTS attendance(
  student_id TEXT NOT NULL,
  date TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  time TEXT NOT NULL DEFAULT '',
  course_id TEXT NOT NULL DEFAULT '',
  price REAL,
  units REAL NOT NULL DEFAULT 1,
  schedule_id TEXT NOT NULL DEFAULT '',
  marked_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(student_id, date, seq)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

/* 审计流水：打卡 / 取消打卡都留痕，只增不删 */
CREATE TABLE IF NOT EXISTS attendance_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'mark' | 'cancel'
  student_id TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  course_id TEXT NOT NULL DEFAULT '',
  course_name TEXT NOT NULL DEFAULT '',
  units REAL NOT NULL DEFAULT 0,
  fee REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_attlog_at ON attendance_log(at);

CREATE TABLE IF NOT EXISTS todos(
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  due TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'P2',
  done INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expenses(
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '其他',
  amount REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

CREATE TABLE IF NOT EXISTS other_incomes(
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '其他',
  amount REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON other_incomes(date);

CREATE TABLE IF NOT EXISTS leads(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '其他',
  domain TEXT NOT NULL DEFAULT '公域',
  stage TEXT NOT NULL DEFAULT '线索池',
  intent REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  student_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  last_follow TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS materials(
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  course_id TEXT NOT NULL DEFAULT '',
  student_id TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '其他',
  url TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  attachment TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS referral_rewarded(ref TEXT PRIMARY KEY);

/* 自动快照：整份数据的 JSON，误删了可以回滚 */
CREATE TABLE IF NOT EXISTS snapshots(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL
);
`;

/* ============================== 打开 / 初始化 ============================== */

function open(file) {
  dbPath = file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const cur = db.prepare("SELECT v FROM meta WHERE k='schema_version'").get();
  if (!cur) {
    db.prepare("INSERT INTO meta(k,v) VALUES('schema_version',?)").run(String(SCHEMA_VERSION));
    db.prepare("INSERT OR REPLACE INTO meta(k,v) VALUES('created_at',?)").run(nowISO());
  }
  return db;
}

function close() {
  if (db) { try { db.close(); } catch (e) { /* ignore */ } db = null; }
}

function isEmpty() {
  const r = db.prepare("SELECT COUNT(*) c FROM students").get();
  return n(r.c) === 0;
}

function getDbPath() { return dbPath; }

/** 是否已经初始化过（用于区分「全新安装」和「用户自己把数据删光了」） */
function isSeeded() {
  const r = db.prepare("SELECT v FROM meta WHERE k='seeded'").get();
  return !!(r && r.v === "1");
}
function markSeeded() {
  db.prepare("INSERT OR REPLACE INTO meta(k,v) VALUES('seeded','1')").run();
}

/* ============================== 读取 ============================== */

function loadState() {
  const courses = db.prepare("SELECT * FROM courses ORDER BY ord, rowid").all().map((r) => ({
    id: r.id, name: r.name, price: n(r.price), unitsPerSession: n(r.units_per_session) || 1,
  }));

  const scRows = db.prepare("SELECT * FROM student_courses ORDER BY ord, rowid").all();
  const byStudent = new Map();
  for (const r of scRows) {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, []);
    byStudent.get(r.student_id).push(r.course_id);
  }

  const students = db.prepare("SELECT * FROM students ORDER BY ord, rowid").all().map((r) => {
    const ids = byStudent.get(r.id) || [];
    return { id: r.id, name: r.name, note: r.note, courseIds: ids, courseId: ids[0] || "" };
  });

  const payments = db.prepare("SELECT * FROM payments ORDER BY ord, rowid").all().map((r) => ({
    id: r.id, studentId: r.student_id, date: r.date, amount: n(r.amount), hours: n(r.hours), note: r.note,
  }));

  const teachers = db.prepare("SELECT * FROM teachers ORDER BY ord, rowid").all().map((r) => ({
    id: r.id, name: r.name, color: r.color, note: r.note,
  }));

  const schedules = db.prepare("SELECT * FROM schedules ORDER BY ord, rowid").all().map((r) => ({
    id: r.id, teacherId: r.teacher_id, studentId: r.student_id, courseId: r.course_id,
    date: r.date, time: r.time, status: r.status, note: r.note,
  }));

  /* attendance 还原成 {sid: {date: rec | [rec,...]}} */
  const attendance = {};
  for (const r of db.prepare("SELECT * FROM attendance ORDER BY student_id, date, seq").all()) {
    const rec = {
      time: r.time || 1,
      courseId: r.course_id,
      units: n(r.units) || 1,
      scheduleId: r.schedule_id,
      markedAt: r.marked_at,
    };
    if (r.price !== null && r.price !== undefined) rec.price = n(r.price);
    if (!attendance[r.student_id]) attendance[r.student_id] = {};
    const day = attendance[r.student_id][r.date];
    if (day === undefined) attendance[r.student_id][r.date] = rec;
    else if (Array.isArray(day)) day.push(rec);
    else attendance[r.student_id][r.date] = [day, rec];
  }

  const todos = db.prepare("SELECT * FROM todos ORDER BY ord, rowid").all().map((r) => ({
    id: r.id, title: r.title, due: r.due, priority: r.priority, done: !!r.done, note: r.note,
  }));

  const expenses = db.prepare("SELECT * FROM expenses ORDER BY ord, rowid").all().map((r) => ({
    id: r.id, date: r.date, category: r.category, amount: n(r.amount), note: r.note,
  }));

  const otherIncomes = db.prepare("SELECT * FROM other_incomes ORDER BY ord, rowid").all().map((r) => ({
    id: r.id, date: r.date, source: r.source, amount: n(r.amount), note: r.note,
  }));

  const leads = db.prepare("SELECT * FROM leads ORDER BY ord, rowid").all().map((r) => ({
    id: r.id, name: r.name, phone: r.phone, source: r.source, domain: r.domain, stage: r.stage,
    intent: n(r.intent), note: r.note, referrer: r.referrer, studentId: r.student_id,
    createdAt: r.created_at, lastFollow: r.last_follow,
  }));

  const materials = db.prepare("SELECT * FROM materials ORDER BY ord, rowid").all().map((r) => ({
    id: r.id, title: r.title, courseId: r.course_id, studentId: r.student_id, type: r.type,
    url: r.url, content: r.content, tags: r.tags, attachment: r.attachment,
    fileName: r.file_name, createdAt: r.created_at,
  }));

  const referralRewarded = db.prepare("SELECT ref FROM referral_rewarded").all().map((r) => r.ref);

  const settings = {};
  for (const r of db.prepare("SELECT * FROM settings").all()) {
    try { settings[r.k] = JSON.parse(r.v); } catch (e) { settings[r.k] = r.v; }
  }

  return {
    courses, students, payments, attendance, teachers, schedules,
    todos, expenses, otherIncomes, leads, materials, referralRewarded, settings,
  };
}

/* ============================== 写入 ============================== */

/** 把 attendance 树摊平成行，顺便算好 seq */
function flattenAttendance(attendance) {
  const rows = [];
  for (const sid of Object.keys(attendance || {})) {
    const days = attendance[sid] || {};
    for (const date of Object.keys(days)) {
      const v = days[date];
      const list = Array.isArray(v) ? v : [v];
      list.forEach((raw, i) => {
        const rec = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : { time: raw || 1 };
        rows.push({
          student_id: sid,
          date,
          seq: i,
          time: s(rec.time === undefined || rec.time === 1 ? "" : rec.time),
          course_id: s(rec.courseId),
          price: nOrNull(rec.price),
          units: n(rec.units) > 0 ? n(rec.units) : 1,
          schedule_id: s(rec.scheduleId),
          marked_at: s(rec.markedAt),
        });
      });
    }
  }
  return rows;
}

const attKey = (r) => [r.student_id, r.date, r.seq, r.course_id, r.time, r.units].join("|");

function saveState(state) {
  if (!db) throw new Error("数据库未打开");
  const S = state || {};

  /* 保存前先拍下考勤旧状态，用于生成审计流水 */
  const before = new Map();
  for (const r of db.prepare("SELECT * FROM attendance").all()) {
    const row = {
      student_id: r.student_id, date: r.date, seq: n(r.seq), time: s(r.time),
      course_id: s(r.course_id), price: nOrNull(r.price), units: n(r.units) || 1,
    };
    before.set(attKey(row), row);
  }

  const attRows = flattenAttendance(S.attendance);
  const after = new Map(attRows.map((r) => [attKey(r), r]));

  const studentName = new Map((S.students || []).map((x) => [x.id, x.name]));
  const courseOf = new Map((S.courses || []).map((x) => [x.id, x]));
  const feeOf = (r) => {
    const base = r.price !== null && r.price !== undefined
      ? n(r.price)
      : n((courseOf.get(r.course_id) || {}).price);
    return base * (n(r.units) || 1);
  };

  db.exec("BEGIN IMMEDIATE");
  try {
    /* ---- 各表整体重写。数据量在几百 KB 量级，事务内全量 upsert 只要几毫秒，
           换来的是「前端不用做增量 diff」，UI 代码零改动。 ---- */
    for (const t of ["courses", "students", "student_courses", "payments", "teachers",
      "schedules", "attendance", "todos", "expenses", "other_incomes",
      "leads", "materials", "referral_rewarded", "settings"]) {
      db.exec(`DELETE FROM ${t}`);
    }

    let st = db.prepare("INSERT INTO courses(id,name,price,units_per_session,ord) VALUES(?,?,?,?,?)");
    (S.courses || []).forEach((c, i) => st.run(s(c.id), s(c.name), n(c.price), n(c.unitsPerSession) || 1, i));

    st = db.prepare("INSERT INTO students(id,name,note,ord) VALUES(?,?,?,?)");
    const stSC = db.prepare("INSERT OR IGNORE INTO student_courses(student_id,course_id,ord) VALUES(?,?,?)");
    (S.students || []).forEach((x, i) => {
      st.run(s(x.id), s(x.name), s(x.note), i);
      const ids = Array.isArray(x.courseIds) && x.courseIds.length ? x.courseIds : (x.courseId ? [x.courseId] : []);
      ids.filter(Boolean).forEach((cid, j) => stSC.run(s(x.id), s(cid), j));
    });

    st = db.prepare("INSERT INTO payments(id,student_id,date,amount,hours,note,ord) VALUES(?,?,?,?,?,?,?)");
    (S.payments || []).forEach((p, i) => st.run(s(p.id), s(p.studentId), s(p.date), n(p.amount), n(p.hours), s(p.note), i));

    st = db.prepare("INSERT INTO teachers(id,name,color,note,ord) VALUES(?,?,?,?,?)");
    (S.teachers || []).forEach((t, i) => st.run(s(t.id), s(t.name), s(t.color), s(t.note), i));

    st = db.prepare("INSERT INTO schedules(id,teacher_id,student_id,course_id,date,time,status,note,ord) VALUES(?,?,?,?,?,?,?,?,?)");
    (S.schedules || []).forEach((x, i) => st.run(s(x.id), s(x.teacherId), s(x.studentId), s(x.courseId), s(x.date), s(x.time), s(x.status) || "pending", s(x.note), i));

    st = db.prepare("INSERT INTO attendance(student_id,date,seq,time,course_id,price,units,schedule_id,marked_at) VALUES(?,?,?,?,?,?,?,?,?)");
    attRows.forEach((r) => st.run(r.student_id, r.date, r.seq, r.time, r.course_id, r.price, r.units, r.schedule_id, r.marked_at));

    st = db.prepare("INSERT INTO todos(id,title,due,priority,done,note,ord) VALUES(?,?,?,?,?,?,?)");
    (S.todos || []).forEach((t, i) => st.run(s(t.id), s(t.title), s(t.due), s(t.priority) || "P2", b(t.done), s(t.note), i));

    st = db.prepare("INSERT INTO expenses(id,date,category,amount,note,ord) VALUES(?,?,?,?,?,?)");
    (S.expenses || []).forEach((e, i) => st.run(s(e.id), s(e.date), s(e.category), n(e.amount), s(e.note), i));

    st = db.prepare("INSERT INTO other_incomes(id,date,source,amount,note,ord) VALUES(?,?,?,?,?,?)");
    (S.otherIncomes || []).forEach((e, i) => st.run(s(e.id), s(e.date), s(e.source), n(e.amount), s(e.note), i));

    st = db.prepare("INSERT INTO leads(id,name,phone,source,domain,stage,intent,note,referrer,student_id,created_at,last_follow,ord) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)");
    (S.leads || []).forEach((l, i) => st.run(s(l.id), s(l.name), s(l.phone), s(l.source), s(l.domain), s(l.stage), n(l.intent), s(l.note), s(l.referrer), s(l.studentId), s(l.createdAt), s(l.lastFollow), i));

    st = db.prepare("INSERT INTO materials(id,title,course_id,student_id,type,url,content,tags,attachment,file_name,created_at,ord) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
    (S.materials || []).forEach((m, i) => st.run(s(m.id), s(m.title), s(m.courseId), s(m.studentId), s(m.type), s(m.url), s(m.content), s(m.tags), s(m.attachment), s(m.fileName), s(m.createdAt), i));

    st = db.prepare("INSERT OR IGNORE INTO referral_rewarded(ref) VALUES(?)");
    (S.referralRewarded || []).forEach((r) => st.run(s(r)));

    st = db.prepare("INSERT INTO settings(k,v) VALUES(?,?)");
    const set = S.settings || {};
    Object.keys(set).forEach((k) => st.run(s(k), JSON.stringify(set[k] === undefined ? null : set[k])));

    /* ---- 考勤审计流水 ---- */
    const logSt = db.prepare(
      "INSERT INTO attendance_log(at,action,student_id,student_name,date,time,course_id,course_name,units,fee) VALUES(?,?,?,?,?,?,?,?,?,?)"
    );
    const at = nowISO();
    const writeLog = (row, action) => logSt.run(
      at, action, row.student_id, s(studentName.get(row.student_id)), row.date, s(row.time),
      row.course_id, s((courseOf.get(row.course_id) || {}).name), n(row.units) || 1, feeOf(row)
    );
    for (const [k, row] of after) if (!before.has(k)) writeLog(row, "mark");
    for (const [k, row] of before) if (!after.has(k)) writeLog(row, "cancel");

    db.exec("COMMIT");
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch (e) { /* ignore */ }
    throw err;
  }

  maybeSnapshot(S);
  return true;
}

/* ============================== 快照 / 备份 ============================== */

function snapshot(state, reason) {
  const payload = JSON.stringify({ version: SCHEMA_VERSION, exportedAt: nowISO(), data: state });
  db.prepare("INSERT INTO snapshots(at,reason,payload) VALUES(?,?,?)").run(nowISO(), s(reason), payload);
  db.exec(
    `DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT ${SNAPSHOT_KEEP})`
  );
  return true;
}

function maybeSnapshot(state) {
  const last = db.prepare("SELECT at FROM snapshots ORDER BY id DESC LIMIT 1").get();
  if (last) {
    const gap = Date.now() - new Date(last.at).getTime();
    if (Number.isFinite(gap) && gap < SNAPSHOT_MIN_GAP_MS) return false;
  }
  return snapshot(state, "自动");
}

function listSnapshots() {
  return db.prepare("SELECT id, at, reason, LENGTH(payload) AS size FROM snapshots ORDER BY id DESC").all()
    .map((r) => ({ id: n(r.id), at: r.at, reason: r.reason, size: n(r.size) }));
}

function readSnapshot(id) {
  const r = db.prepare("SELECT payload FROM snapshots WHERE id=?").get(n(id));
  if (!r) return null;
  try { return JSON.parse(r.payload).data; } catch (e) { return null; }
}

/* ============================== 审计查询 ============================== */

function attendanceLog(limit) {
  const lim = Math.max(1, Math.min(2000, n(limit) || 200));
  return db.prepare(`SELECT * FROM attendance_log ORDER BY id DESC LIMIT ${lim}`).all().map((r) => ({
    id: n(r.id), at: r.at, action: r.action, studentName: r.student_name, date: r.date,
    time: r.time, courseName: r.course_name, units: n(r.units), fee: n(r.fee),
  }));
}

function stats() {
  const one = (sql) => n((db.prepare(sql).get() || {}).c);
  let size = 0;
  try { size = fs.statSync(dbPath).size; } catch (e) { /* ignore */ }
  return {
    path: dbPath,
    sizeBytes: size,
    students: one("SELECT COUNT(*) c FROM students"),
    attendance: one("SELECT COUNT(*) c FROM attendance"),
    payments: one("SELECT COUNT(*) c FROM payments"),
    schedules: one("SELECT COUNT(*) c FROM schedules"),
    logEntries: one("SELECT COUNT(*) c FROM attendance_log"),
    snapshots: one("SELECT COUNT(*) c FROM snapshots"),
  };
}

/** 用 SQLite 官方的在线备份把整个库复制到目标路径（比复制文件安全，WAL 也不会漏） */
function backupTo(target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  return target;
}

module.exports = {
  open, close, isEmpty, isSeeded, markSeeded, getDbPath, loadState, saveState,
  snapshot, listSnapshots, readSnapshot, attendanceLog, stats, backupTo,
  SCHEMA_VERSION,
};
