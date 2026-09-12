import { describe, expect, it } from "vitest";
import { emptyState, type State } from "@/core/types";
import { cancelLesson, completeLesson, copyFromLastWeek, lessonsOn, logLesson, suggestionsFor, undoLesson } from "@/core/lesson";
import { addDays, weekdayOf } from "@/core/date";

const TODAY = "2026-09-11"; // 周五

function base(): State {
  const s = emptyState();
  s.courses = [{ id: "c1", name: "数学", price: 280, unitsPerLesson: 1 }];
  s.students = [{ id: "s1", name: "张明", courseIds: ["c1"], note: "", createdAt: "2026-01-01", archived: false, sortOrder: 0 }];
  s.templates = [{ id: "tp1", studentId: "s1", courseId: "c1", weekday: weekdayOf(TODAY), time: "16:00", active: true }];
  return s;
}

describe("一节课的生命周期", () => {
  it("固定课表在当天生成一节虚拟的待上课", () => {
    const items = lessonsOn(base(), TODAY);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ status: "scheduled", virtual: true, templateId: "tp1", price: 280, units: 1 });
  });

  it("打卡把虚拟课落库为 done，并产生审计条目", () => {
    const s = base();
    const item = lessonsOn(s, TODAY)[0]!;
    const { lessons, audit } = completeLesson(s, item, "2026-09-11T08:00:00.000Z");
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toMatchObject({ status: "done", source: "template", templateId: "tp1", doneAt: "2026-09-11T08:00:00.000Z" });
    expect(lessons[0]!.id).not.toMatch(/^tpl:/);
    expect(audit.kind).toBe("lesson.done");
    /* 落库后当天不再重复生成虚拟课 */
    const again = lessonsOn({ ...s, lessons }, TODAY);
    expect(again).toHaveLength(1);
    expect(again[0]!.virtual).toBeUndefined();
  });

  it("撤销模板课退回待上；撤销补记课直接删除", () => {
    const s = base();
    const done = completeLesson(s, lessonsOn(s, TODAY)[0]!).lessons;
    const s2 = { ...s, lessons: done };
    const r1 = undoLesson(s2, done[0]!.id)!;
    expect(r1.lessons[0]!.status).toBe("scheduled");
    expect(r1.audit.kind).toBe("lesson.undo");

    const logged = logLesson(s, { studentId: "s1", courseId: "c1", date: TODAY, time: "20:00" }).lessons;
    const r2 = undoLesson({ ...s, lessons: logged }, logged[0]!.id)!;
    expect(r2.lessons).toHaveLength(0);
  });

  it("没打卡的课不能撤销", () => {
    const s = base();
    const item = lessonsOn(s, TODAY)[0]!;
    expect(undoLesson(s, item.id)).toBeNull();
  });

  it("打卡时锁定单价，之后改课程价格不影响历史", () => {
    const s = base();
    const done = completeLesson(s, lessonsOn(s, TODAY)[0]!).lessons;
    const s2 = { ...s, lessons: done, courses: [{ ...s.courses[0]!, price: 999 }] };
    expect(lessonsOn(s2, TODAY)[0]!.price).toBe(280);
  });

  it("取消虚拟课会落库为 cancelled，当天不再生成", () => {
    const s = base();
    const { lessons } = cancelLesson(s, lessonsOn(s, TODAY)[0]!);
    const items = lessonsOn({ ...s, lessons }, TODAY);
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe("cancelled");
  });

  it("从历史推断：连续两周同一时间上课就建议", () => {
    const s = base();
    s.templates = [];
    for (const w of [1, 2, 3]) {
      const date = addDays(TODAY, -7 * w);
      s.lessons.push({ id: `l${w}`, studentId: "s1", courseId: "c1", date, time: "16:00", status: "done", units: 1, price: 280, source: "backfill", createdAt: "" });
    }
    const sg = suggestionsFor(s, TODAY);
    expect(sg).toHaveLength(1);
    expect(sg[0]).toMatchObject({ studentId: "s1", time: "16:00", hits: 3 });
    /* 今天已经有这个学员的课就不再建议 */
    const withToday = logLesson(s, { studentId: "s1", courseId: "c1", date: TODAY, time: "16:00" }).lessons;
    expect(suggestionsFor({ ...s, lessons: withToday }, TODAY)).toHaveLength(0);
  });

  it("从上周复制：只复制没被取消的，且不重复", () => {
    const s = base();
    s.templates = [];
    const lastWeek = addDays(TODAY, -7);
    s.lessons.push({ id: "a", studentId: "s1", courseId: "c1", date: lastWeek, time: "16:00", status: "done", units: 1, price: 280, source: "manual", createdAt: "" });
    s.lessons.push({ id: "b", studentId: "s1", courseId: "c1", date: lastWeek, time: "18:00", status: "cancelled", units: 1, price: 280, source: "manual", createdAt: "" });
    const added = copyFromLastWeek(s, TODAY);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ date: TODAY, time: "16:00", status: "scheduled", source: "manual" });
    expect(copyFromLastWeek({ ...s, lessons: [...s.lessons, ...added] }, TODAY)).toHaveLength(0);
  });
});

describe("课时时长", () => {
  it("时长 = 课时数 × 每课时分钟（课程覆盖全局）", async () => {
    const { lessonMinutes, addMinutes } = await import("@/core/lesson");
    const s = base();
    s.settings.unitMinutes = 60;
    s.courses.push({ id: "c2", name: "物理", price: 150, unitsPerLesson: 2, unitMinutes: 45 });
    expect(lessonMinutes(s, { courseId: "c1", units: 1 })).toBe(60);
    expect(lessonMinutes(s, { courseId: "c2", units: 2 })).toBe(90);
    expect(addMinutes("16:00", 90)).toBe("17:30");
    expect(addMinutes("23:30", 60)).toBe("00:30");
  });
});
