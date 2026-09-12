import { expect, it } from "vitest";
import { closingDayData, streakDays } from "../src/core/closing-day";
import { emptyState, type Lesson } from "../src/core/types";
const lesson = (id: string, date = "2026-09-12"): Lesson => ({ id, date, studentId: id, courseId: "c", time: "16:00", units: 2, price: 100, status: "done", source: "manual", createdAt: "" });
it("没有课或还有待上课程时不能收工，取消不阻碍收工", () => {
  const s = emptyState();
  expect(closingDayData(s, "2026-09-12").eligible).toBe(false);
  s.lessons = [lesson("a"), { ...lesson("b"), status: "scheduled" }];
  expect(closingDayData(s, "2026-09-12").eligible).toBe(false);
  s.lessons[1]!.status = "cancelled";
  expect(closingDayData(s, "2026-09-12").eligible).toBe(true);
});
it("三人班课计1节2课时；同组有人待上也不能提前收工", () => {
  const s = emptyState();
  s.lessons = ["a", "b", "c"].map((id) => ({ ...lesson(id), classId: "k", groupId: "g" }));
  expect(closingDayData(s, "2026-09-12")).toMatchObject({ lessons: 1, units: 2, monthLessons: 1, eligible: true });
  s.lessons[2]!.status = "scheduled";
  expect(closingDayData(s, "2026-09-12").eligible).toBe(false);
});
it("固定课表的虚拟待上课也阻止收工", () => {
  const s = emptyState(); s.lessons = [lesson("a")];
  s.students = [{ id: "s", name: "学生", courseIds: ["c"], note: "", createdAt: "", archived: false, sortOrder: 0 }];
  s.templates = [{ id: "t", studentId: "s", courseId: "c", weekday: 6, time: "18:00", active: true }];
  expect(closingDayData(s, "2026-09-12").eligible).toBe(false);
});
it("连续天数跨年，同日多条不重复；今天没课就是0", () => {
  const lessons = [lesson("a", "2025-12-31"), lesson("b", "2026-01-01"), lesson("c", "2026-01-01")];
  expect(streakDays(lessons, "2026-01-01")).toBe(2);
  expect(streakDays(lessons, "2026-01-02")).toBe(0);
});
