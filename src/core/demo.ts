/** 示例数据：第一次打开时灌入，让老师看到它能干什么。全是虚构的。 */
import type { State } from "./types";
import { emptyState } from "./types";
import { addDays, todayISO, weekdayOf } from "./date";

export function demoState(today = todayISO()): State {
  const s = emptyState();
  s.settings = { ...s.settings, teacherName: "王老师", onboarded: true };
  s.teachers = [{ id: "t1", name: "王老师", color: "#FF6B4A" }];
  s.courses = [
    { id: "c1", name: "数学", price: 280, unitsPerLesson: 1 },
    { id: "c2", name: "英语", price: 260, unitsPerLesson: 1, unitMinutes: 45 },
    { id: "c3", name: "物理", price: 150, unitsPerLesson: 2, unitMinutes: 45 },
  ];
  const d = (n: number) => addDays(today, n);
  s.students = [
    { id: "s1", name: "张明", courseIds: ["c1"], note: "初二，二次函数偏弱", createdAt: d(-120), archived: false, sortOrder: 0 },
    { id: "s2", name: "李华", courseIds: ["c2"], note: "备考 FCE", createdAt: d(-90), archived: false, sortOrder: 1 },
    { id: "s3", name: "刘洋", courseIds: ["c3"], note: "", createdAt: d(-60), archived: false, sortOrder: 2 },
    { id: "s4", name: "陈晨", courseIds: ["c1"], note: "家长要求每周反馈", createdAt: d(-45), archived: false, sortOrder: 3 },
    { id: "s5", name: "周雨", courseIds: ["c2"], note: "已结课，暑假班", createdAt: d(-200), archived: true, sortOrder: 4 },
  ];
  s.payments = [
    { id: "p1", studentId: "s1", date: d(-120), amount: 5600, hours: 20, note: "" },
    { id: "p2", studentId: "s2", date: d(-90), amount: 7800, hours: 30, note: "含一节试听" },
    { id: "p3", studentId: "s3", date: d(-60), amount: 7200, hours: 24, note: "" },
    { id: "p4", studentId: "s4", date: d(-45), amount: 4480, hours: 16, note: "" },
  ];
  /* 固定课表：今天这个星期几安排两节，方便第一眼就看到「今天」在工作 */
  const wd = weekdayOf(today);
  s.templates = [
    { id: "tp1", studentId: "s1", courseId: "c1", teacherId: "t1", weekday: wd, time: "16:00", active: true },
    { id: "tp2", studentId: "s2", courseId: "c2", teacherId: "t1", weekday: wd, time: "18:00", active: true },
    { id: "tp3", studentId: "s3", courseId: "c3", teacherId: "t1", weekday: (wd + 2) % 7, time: "19:30", active: true },
    { id: "tp4", studentId: "s4", courseId: "c1", teacherId: "t1", weekday: (wd + 4) % 7, time: "10:00", active: true },
  ];
  /* 过去八周的打卡历史 */
  let n = 0;
  for (let w = 1; w <= 8; w++) {
    for (const t of s.templates) {
      const date = d(-7 * w + ((t.weekday - wd + 7) % 7) - (t.weekday >= wd ? 7 : 0));
      if (date >= today) continue;
      const c = s.courses.find((x) => x.id === t.courseId)!;
      s.lessons.push({
        id: `l${++n}`,
        studentId: t.studentId,
        courseId: t.courseId,
        teacherId: t.teacherId,
        date,
        time: t.time,
        status: w === 3 && t.id === "tp2" ? "cancelled" : "done",
        units: c.unitsPerLesson,
        price: c.price,
        source: "template",
        templateId: t.id,
        doneAt: `${date}T12:00:00.000Z`,
        createdAt: `${date}T12:00:00.000Z`,
      });
    }
  }
  /* 李华快上完了：多补几节 */
  for (let i = 0; i < 20; i++) {
    const date = d(-90 + i * 4);
    if (date >= today) break;
    if (s.lessons.some((l) => l.studentId === "s2" && l.date === date)) continue;
    s.lessons.push({ id: `lx${i}`, studentId: "s2", courseId: "c2", teacherId: "t1", date, time: "18:00", status: "done", units: 1, price: 260, source: "backfill", doneAt: `${date}T12:00:00.000Z`, createdAt: `${date}T12:00:00.000Z` });
  }
  s.todos = [
    { id: "td1", title: "给李华家长发续费提醒", due: today, priority: "P0", done: false, note: "" },
    { id: "td2", title: "准备周末公开课课件", due: d(1), priority: "P1", done: false, note: "" },
  ];
  s.expenses = [
    { id: "e1", date: d(-20), category: "广告投放", amount: 1200, note: "小红书信息流" },
    { id: "e2", date: d(-3), category: "交通", amount: 150, note: "" },
  ];
  s.leads = [
    { id: "ld1", name: "周女士", phone: "138****0001", source: "小红书", status: "contacted", intent: 8000, note: "初三英语", createdAt: d(-6), lastFollow: d(-1) },
  ];
  return s;
}
