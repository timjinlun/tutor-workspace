import { describe, expect, it } from "vitest";
import { emptyState, type State } from "@/core/types";
import { lessonsOn } from "@/core/lesson";
import { cancelGroup, completeClass, groupItems, groupStatus, scheduleClass } from "@/core/klass";
import { balance, confirmedIncome } from "@/core/finance";
import { weekdayOf } from "@/core/date";

const TODAY = "2026-09-11";

function base(deductOnAbsence: boolean): State {
  const s = emptyState();
  s.courses = [{ id: "c1", name: "数学", price: 280, unitsPerLesson: 1 }];
  s.students = [
    { id: "a", name: "A", courseIds: ["c1"], note: "", createdAt: "", archived: false, sortOrder: 0 },
    { id: "b", name: "B", courseIds: ["c1"], note: "", createdAt: "", archived: false, sortOrder: 1 },
    { id: "z", name: "Z", courseIds: ["c1"], note: "", createdAt: "", archived: true, sortOrder: 2 },
  ];
  s.payments = [{ id: "p1", studentId: "a", date: "2026-01-01", amount: 1000, hours: 10, note: "" }, { id: "p2", studentId: "b", date: "2026-01-01", amount: 1000, hours: 10, note: "" }];
  s.classes = [{ id: "k1", name: "小班", courseId: "c1", studentIds: ["a", "b", "z"], pricePerUnit: 180, deductOnAbsence, active: true }];
  s.templates = [{ id: "tp1", studentId: "", classId: "k1", courseId: "c1", weekday: weekdayOf(TODAY), time: "20:00", active: true }];
  return s;
}

describe("班课", () => {
  it("固定班课在当天给每个在读成员生成一条虚拟课，共享 groupId，用本班单价", () => {
    const items = lessonsOn(base(true), TODAY);
    expect(items).toHaveLength(2); // 结课的 Z 不算
    expect(new Set(items.map((i) => i.groupId)).size).toBe(1);
    expect(items[0]).toMatchObject({ classId: "k1", price: 180, status: "scheduled", virtual: true });
    const groups = groupItems(items);
    expect(groups).toHaveLength(1);
    expect(groupStatus(groups[0]!)).toBe("scheduled");
  });

  it("打卡：到场扣课时；缺席按班规照扣", () => {
    const s = base(true);
    const items = lessonsOn(s, TODAY);
    const r = completeClass(s, items, { b: "absent" })!;
    const s2 = { ...s, lessons: r.lessons };
    expect(balance(s2, "a")).toBe(9);
    expect(balance(s2, "b")).toBe(9);
    expect(confirmedIncome(s2)).toBe(360);
    const b = r.lessons.find((l) => l.studentId === "b")!;
    expect(b).toMatchObject({ status: "done", attendance: "absent" });
    expect(r.audit.summary).toContain("照扣");
    /* 落库后不再重复生成 */
    expect(lessonsOn(s2, TODAY).every((i) => !i.virtual)).toBe(true);
  });

  it("打卡：缺席不扣 → 记为取消，不算钱", () => {
    const s = base(false);
    const r = completeClass(s, lessonsOn(s, TODAY), { b: "absent" })!;
    const s2 = { ...s, lessons: r.lessons };
    expect(balance(s2, "b")).toBe(10);
    expect(confirmedIncome(s2)).toBe(180);
    expect(groupStatus(groupItems(lessonsOn(s2, TODAY))[0]!)).toBe("done");
  });

  it("整组取消 + 临时排班课", () => {
    const s = base(true);
    const r = cancelGroup(s, lessonsOn(s, TODAY))!;
    expect(lessonsOn({ ...s, lessons: r.lessons }, TODAY).every((i) => i.status === "cancelled")).toBe(true);
    const r2 = scheduleClass(s, { classId: "k1", date: "2026-09-12", time: "10:00" })!;
    expect(r2.lessons.filter((l) => l.date === "2026-09-12")).toHaveLength(2);
    expect(new Set(r2.lessons.map((l) => l.groupId)).size).toBe(1);
  });
});
