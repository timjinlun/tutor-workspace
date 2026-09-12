/**
 * v2 → v3 迁移。
 * v2（schema_version = 1）是全列展开的表；v3 是 JSON 文档表（ADR-0003）。
 * 做法：先把 v2 的数据读成 v3 的 State，把旧表改名为 v2_*（保留不删），再由调用方建 v3 表并写入。
 */
import type { DatabaseSync } from "node:sqlite";
import type { StateLike } from "./store";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const V2_TABLES = ["courses", "students", "student_courses", "payments", "teachers", "schedules", "attendance", "attendance_log", "todos", "expenses", "other_incomes", "leads", "materials", "referral_rewarded", "settings"];

export function isV2(db: DatabaseSync): boolean {
  const v = db.prepare("SELECT v FROM meta WHERE k='schema_version'").get() as { v: string } | undefined;
  if (v?.v !== "1") return false;
  /* 双重确认：v2 的 students 表有 name 列而没有 data 列 */
  const cols = db.prepare("PRAGMA table_info(students)").all() as { name: string }[];
  return cols.some((c) => c.name === "name") && !cols.some((c) => c.name === "data");
}

const LEAD_STATUS: Record<string, string> = { 线索池: "new", 跟进中: "contacted", 试听: "trial", 成交: "won", 流失: "lost" };

/** 把 v2 的表读成 v3 的 State。表可能不存在（更早的库），逐个容错。 */
export function readV2State(db: DatabaseSync): StateLike | null {
  const all = (table: string): Row[] => {
    try {
      return db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() as Row[];
    } catch {
      return [];
    }
  };
  const courses = all("courses").map((r) => ({ id: s(r.id), name: s(r.name), price: n(r.price), unitsPerLesson: n(r.units_per_session) || 1 }));
  const sc = all("student_courses");
  const students = all("students").map((r) => ({
    id: s(r.id),
    name: s(r.name),
    courseIds: sc.filter((x) => x.student_id === r.id).map((x) => s(x.course_id)),
    note: s(r.note),
    createdAt: "",
    archived: false,
  }));
  if (students.length === 0 && courses.length === 0) return null;

  const payments = all("payments").map((r) => ({ id: s(r.id), studentId: s(r.student_id), date: s(r.date), amount: n(r.amount), hours: n(r.hours), note: s(r.note) }));
  const teachers = all("teachers").map((r) => ({ id: s(r.id), name: s(r.name), color: s(r.color) || "#ff6b4a" }));

  /* 考勤 → 已上的课；排课 → 待上 / 已取消的课（已完成的排课由考勤那条代表，跳过） */
  const lessons: Row[] = [];
  for (const r of all("attendance")) {
    const price = r.price === null || r.price === undefined ? (courses.find((c) => c.id === r.course_id)?.price ?? 0) : n(r.price);
    const at = s(r.marked_at) || `${s(r.date)}T12:00:00.000Z`;
    lessons.push({
      id: `v2a_${s(r.student_id)}_${s(r.date)}_${n(r.seq)}`,
      studentId: s(r.student_id),
      courseId: s(r.course_id),
      date: s(r.date),
      time: s(r.time) || "00:00",
      status: "done",
      units: n(r.units) || 1,
      price,
      source: s(r.schedule_id) ? "template" : "backfill",
      doneAt: at,
      createdAt: at,
    });
  }
  for (const r of all("schedules")) {
    if (r.status === "done") continue;
    const price = courses.find((c) => c.id === r.course_id)?.price ?? 0;
    lessons.push({
      id: `v2s_${s(r.id)}`,
      studentId: s(r.student_id),
      courseId: s(r.course_id),
      teacherId: s(r.teacher_id) || undefined,
      date: s(r.date),
      time: s(r.time) || "00:00",
      status: r.status === "cancelled" ? "cancelled" : "scheduled",
      units: courses.find((c) => c.id === r.course_id)?.unitsPerLesson ?? 1,
      price,
      source: "manual",
      createdAt: `${s(r.date)}T00:00:00.000Z`,
      note: s(r.note) || undefined,
    });
  }

  const settingsRows = all("settings");
  const set: Record<string, unknown> = {};
  for (const r of settingsRows) {
    try {
      set[s(r.k)] = JSON.parse(s(r.v));
    } catch {
      set[s(r.k)] = r.v;
    }
  }

  return {
    version: 3,
    teachers,
    courses,
    students,
    payments,
    templates: [],
    lessons,
    todos: all("todos").map((r) => ({ id: s(r.id), title: s(r.title), due: s(r.due), priority: s(r.priority) || "P2", done: !!n(r.done), note: s(r.note) })),
    expenses: all("expenses").map((r) => ({ id: s(r.id), date: s(r.date), category: s(r.category) || "其他", amount: n(r.amount), note: s(r.note) })),
    otherIncomes: all("other_incomes").map((r) => ({ id: s(r.id), date: s(r.date), source: s(r.source) || "其他", amount: n(r.amount), note: s(r.note) })),
    leads: all("leads").map((r) => ({
      id: s(r.id), name: s(r.name), phone: s(r.phone), source: s(r.source) || "其他",
      status: LEAD_STATUS[s(r.stage)] ?? "new", intent: n(r.intent), note: s(r.note),
      referrerId: s(r.referrer) || undefined, createdAt: s(r.created_at), lastFollow: s(r.last_follow),
    })),
    materials: all("materials").map((r) => ({
      id: s(r.id), title: s(r.title), type: s(r.type) || "其他", courseId: s(r.course_id) || undefined, studentId: s(r.student_id) || undefined,
      content: s(r.content), url: s(r.url), tags: s(r.tags), createdAt: s(r.created_at),
    })),
    settings: {
      teacherName: s(set.teacherName) || "老师",
      lowBalanceThreshold: n(set.lowBalanceThreshold) || 4,
      remindAhead: n(set.remindAheadClasses) || 2,
      accent: "coral",
      appearance: "system",
      onboarded: true,
    },
  };
}

/** 旧表改名保留：v2_courses …；同名的 meta / snapshots 结构兼容，原地保留 */
export function archiveV2Tables(db: DatabaseSync) {
  for (const t of V2_TABLES) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
    if (!exists) continue;
    db.exec(`DROP TABLE IF EXISTS v2_${t}`);
    db.exec(`ALTER TABLE ${t} RENAME TO v2_${t}`);
  }
  /* v2 的索引会随表改名，不用管 */
}
