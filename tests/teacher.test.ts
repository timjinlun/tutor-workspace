import { describe, expect, it } from "vitest";
import { emptyState, normalizeState, type State } from "@/core/types";
import { isOtherTeacher, payableInMonth, selfTeacher, teacherMonth, teacherOfLesson } from "@/core/teacher";

function base(): State {
  const s = emptyState();
  s.settings.teacherName = "王老师";
  s.teachers = [
    { id: "me", name: "王老师", color: "#ff6b4a", self: true },
    { id: "li", name: "李老师", color: "#4f6bff", payPerUnit: 90 },
    { id: "zhao", name: "赵老师", color: "#34c759" },
  ];
  const L = (id: string, teacherId: string | undefined, units: number, price: number, date = "2026-09-03") =>
    s.lessons.push({ id, studentId: "s1", courseId: "c1", teacherId, date, time: "10:00", status: "done", units, price, source: "manual", createdAt: "" });
  L("a", "me", 1, 280);
  L("b", "li", 2, 150);
  L("c", "li", 2, 150);
  L("d", undefined, 1, 280); // 旧记录没写老师
  L("e", "zhao", 1, 200);
  L("f", "li", 2, 150, "2026-08-03"); // 上个月，不该算进来
  s.lessons.push({ id: "g", studentId: "s1", courseId: "c1", teacherId: "li", date: "2026-09-04", time: "10:00", status: "cancelled", units: 2, price: 150, source: "manual", createdAt: "" });
  return s;
}

describe("老师与课时费", () => {
  it("没写老师的旧记录算在「我」头上", () => {
    const s = base();
    expect(teacherOfLesson(s, { teacherId: undefined })?.id).toBe("me");
    expect(isOtherTeacher(s, { teacherId: undefined })).toBe(false);
    expect(isOtherTeacher(s, { teacherId: "li" })).toBe(true);
  });

  it("按月统计：只算已上的、本月的；我不结算课时费", () => {
    const rows = teacherMonth(base(), "2026-09");
    const by = Object.fromEntries(rows.map((r) => [r.teacher.id, r]));
    expect(by.me).toMatchObject({ lessons: 2, units: 2, income: 560, pay: 0 });     // a + d
    expect(by.li).toMatchObject({ lessons: 2, units: 4, income: 600, pay: 360 });   // 4 课时 × 90
    expect(by.li!.margin).toBe(240);
    expect(by.zhao).toMatchObject({ units: 1, income: 200, pay: 0 });               // 没设课时费
    expect(rows[0]!.teacher.self).toBe(true);                                        // 我排最前
    expect(payableInMonth(base(), "2026-09")).toBe(360);
  });

  it("normalizeState 保证有且只有一位「我」，名字跟着称呼走", () => {
    const a = normalizeState({ settings: { teacherName: "张老师" } } as Partial<State>);
    expect(a.teachers.filter((t) => t.self)).toHaveLength(1);
    expect(selfTeacher(a)!.name).toBe("张老师");

    const b = normalizeState({ settings: { teacherName: "张老师" }, teachers: [{ id: "x", name: "旧名字", color: "#000" }] } as Partial<State>);
    expect(b.teachers).toHaveLength(1);
    expect(b.teachers[0]).toMatchObject({ id: "x", self: true, name: "张老师" });
  });
});

describe("课时费判重", () => {
  it("认 ref，不认名字：老师改名之后仍然算已记过", async () => {
    const { payRecorded, payRef, TEACHER_PAY_CATEGORY } = await import("@/core/teacher");
    const s = base();
    const li = s.teachers[1]!;
    s.expenses = [{ id: "e1", date: "2026-09-30", category: TEACHER_PAY_CATEGORY, amount: 360, note: "李老师 2026-09 · 4 课时", ref: payRef(li.id, "2026-09") }];
    expect(payRecorded(s, "2026-09", li)).toBe(true);
    expect(payRecorded(s, "2026-09", { ...li, name: "李老师（周末）" })).toBe(true); // 改名后照样认出来
    expect(payRecorded(s, "2026-08", li)).toBe(false);
  });

  it("3.4 及更早没有 ref 的老数据，退回按名字认，不会重复记", async () => {
    const { payRecorded, TEACHER_PAY_CATEGORY } = await import("@/core/teacher");
    const s = base();
    const li = s.teachers[1]!;
    s.expenses = [{ id: "e1", date: "2026-09-30", category: TEACHER_PAY_CATEGORY, amount: 360, note: "李老师 2026-09 · 4 课时" }];
    expect(payRecorded(s, "2026-09", li)).toBe(true);
  });
});
