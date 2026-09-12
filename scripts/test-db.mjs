/**
 * 数据层往返测试：saveState → loadState 必须一模一样，审计流水必须对得上。
 * 直接用 Node 24 跑（node:sqlite 是内置的），不需要起 Electron：
 *     node scripts/test-db.mjs
 */
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const db = require("../electron/db.js");

const dir = mkdtempSync(join(tmpdir(), "tw-test-"));
const file = join(dir, "t.db");
let failed = 0;
const t = (name, fn) => {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n      " + (e.message || e)); }
};

const fixture = () => ({
  courses: [
    { id: "c1", name: "数学1对1辅导", price: 280, unitsPerSession: 1 },
    { id: "c2", name: "英语1对1辅导", price: 260, unitsPerSession: 1.5 },
  ],
  students: [
    { id: "s1", name: "张明", note: "赠送一节", courseIds: ["c1", "c2"], courseId: "c1" },
    { id: "s2", name: "李华", note: "", courseIds: ["c2"], courseId: "c2" },
  ],
  payments: [
    { id: "p1", studentId: "s1", date: "2026-02-01", amount: 5600, hours: 20, note: "" },
    { id: "p2", studentId: "s2", date: "2026-02-08", amount: 7800, hours: 30, note: "含试听" },
  ],
  attendance: {
    s1: {
      "2026-02-03": { time: "18:00", courseId: "c1", price: 280, units: 1, scheduleId: "", markedAt: "2026-02-03T10:00:00.000Z" },
      /* 同一天两节课 —— 数组形态必须能原样还原 */
      "2026-02-10": [
        { time: "09:00", courseId: "c1", price: 280, units: 1, scheduleId: "sc1", markedAt: "2026-02-10T01:00:00.000Z" },
        { time: "15:00", courseId: "c2", price: 260, units: 1.5, scheduleId: "", markedAt: "2026-02-10T07:00:00.000Z" },
      ],
    },
    s2: { "2026-02-12": { time: 1, courseId: "c2", price: 260, units: 1.5, scheduleId: "", markedAt: "" } },
  },
  teachers: [{ id: "t1", name: "王老师", color: "#3b82f6", note: "" }],
  schedules: [{ id: "sc1", teacherId: "t1", studentId: "s1", courseId: "c1", date: "2026-02-10", time: "09:00", status: "done", note: "" }],
  todos: [{ id: "td1", title: "催续费", due: "2026-02-20", priority: "P0", done: false, note: "剩 2 节" },
          { id: "td2", title: "备课", due: "2026-02-21", priority: "P2", done: true, note: "" }],
  expenses: [{ id: "e1", date: "2026-02-05", category: "广告投放", amount: 1200, note: "小红书" }],
  otherIncomes: [{ id: "i1", date: "2026-02-06", source: "资料售卖", amount: 500, note: "" }],
  leads: [{ id: "l1", name: "王女士", phone: "138****001", source: "小红书", domain: "公域", stage: "跟进中", intent: 12000, note: "初二数学", referrer: "", studentId: "", createdAt: "2026-02-01", lastFollow: "2026-02-09" }],
  materials: [{ id: "m1", title: "复习提纲", courseId: "c1", studentId: "", type: "教案", url: "", content: "二次函数\n圆", tags: "期中", attachment: "", fileName: "", createdAt: "2026-02-02" }],
  referralRewarded: ["s1"],
  settings: { teacherName: "王老师", lowBalanceThreshold: 4, remindAheadClasses: 2, referralRewardType: "课时", referralRewardValue: 2 },
});

console.log("数据层往返测试");
db.open(file);

const A = fixture();
db.saveState(A);
const B = db.loadState();

t("courses 往返一致", () => assert.deepEqual(B.courses, A.courses));
t("students（含多课程）往返一致", () => assert.deepEqual(B.students, A.students));
t("payments 往返一致", () => assert.deepEqual(B.payments, A.payments));
t("teachers 往返一致", () => assert.deepEqual(B.teachers, A.teachers));
t("schedules 往返一致", () => assert.deepEqual(B.schedules, A.schedules));
t("todos 往返一致（priority / done 布尔）", () => assert.deepEqual(B.todos, A.todos));
t("expenses 往返一致", () => assert.deepEqual(B.expenses, A.expenses));
t("otherIncomes 往返一致", () => assert.deepEqual(B.otherIncomes, A.otherIncomes));
t("leads 往返一致", () => assert.deepEqual(B.leads, A.leads));
t("materials（含换行符）往返一致", () => assert.deepEqual(B.materials, A.materials));
t("referralRewarded 往返一致", () => assert.deepEqual(B.referralRewarded, A.referralRewarded));
t("settings 往返一致（数字不变字符串）", () => assert.deepEqual(B.settings, A.settings));
t("attendance 单条 / 数组两种形态都原样还原", () => assert.deepEqual(B.attendance, A.attendance));
t("同一天两节课仍是数组且顺序不变", () => {
  assert.ok(Array.isArray(B.attendance.s1["2026-02-10"]));
  assert.equal(B.attendance.s1["2026-02-10"][1].units, 1.5);
});

/* ---- 审计流水 ---- */
t("首次保存 → 4 条打卡记录全部记入审计", () => {
  const rows = db.attendanceLog(100).filter((r) => r.action === "mark");
  assert.equal(rows.length, 4);
});

/* ---- 取消一条打卡 ---- */
const C = db.loadState();
delete C.attendance.s1["2026-02-03"];
db.saveState(C);

t("取消打卡后数据确实少了一条", () => {
  const D = db.loadState();
  assert.equal(D.attendance.s1["2026-02-03"], undefined);
  assert.ok(D.attendance.s1["2026-02-10"]);
});
t("取消动作写进了审计流水，且金额算对", () => {
  const rows = db.attendanceLog(100).filter((r) => r.action === "cancel");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].studentName, "张明");
  assert.equal(rows[0].date, "2026-02-03");
  assert.equal(rows[0].fee, 280);
});
t("审计表只增不删：总条数 = 4 打卡 + 1 取消", () => {
  assert.equal(db.attendanceLog(100).length, 5);
});

/* ---- 快照 / 回滚 ---- */
db.snapshot(A, "测试");
t("快照能列出来", () => assert.ok(db.listSnapshots().length >= 1));
t("快照能读回原始数据", () => {
  const id = db.listSnapshots()[0].id;
  assert.deepEqual(db.readSnapshot(id).attendance.s1["2026-02-03"].units, 1);
});

/* ---- 事务原子性：写坏数据不能留下半截 ---- */
t("保存失败时整体回滚，旧数据不受影响", () => {
  const before = db.loadState();
  const bad = db.loadState();
  bad.courses = [{ id: "c9", name: "坏课", price: 1, unitsPerSession: 1 },
                 { id: "c9", name: "重复主键", price: 1, unitsPerSession: 1 }]; // 触发 PRIMARY KEY 冲突
  assert.throws(() => db.saveState(bad));
  assert.deepEqual(db.loadState(), before);
});

/* ---- 空库 ---- */
t("新库 isSeeded() 为 false，标记后为 true", () => {
  const f2 = join(dir, "t2.db");
  db.close();
  db.open(f2);
  assert.equal(db.isSeeded(), false);
  db.markSeeded();
  assert.equal(db.isSeeded(), true);
});

db.close();
rmSync(dir, { recursive: true, force: true });
console.log(failed === 0 ? "\n全部通过 ✅" : `\n${failed} 项失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
