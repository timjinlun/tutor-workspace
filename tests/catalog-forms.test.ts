import { describe, expect, it } from "vitest";
import { parseCourseDraft, parseTeacherDraft } from "@/core/catalog-forms";

describe("catalog editor drafts", () => {
  const course = { name: " 数学 ", price: "280", units: "2", minutes: "45" };
  it("converts validated fields without modifying the draft", () => {
    expect(parseCourseDraft(course)).toEqual({ ok: true, value: { name: "数学", price: 280, unitsPerLesson: 2, unitMinutes: 45 } });
    expect(course.name).toBe(" 数学 ");
  });
  it("supports zero price and inherited duration", () => {
    expect(parseCourseDraft({ ...course, price: "0", minutes: "" })).toEqual({ ok: true, value: { name: "数学", price: 0, unitsPerLesson: 2, unitMinutes: undefined } });
  });
  it.each([{ name: " " }, { price: "" }, { price: "-1" }, { price: "Infinity" }, { units: "0" }, { minutes: "2" }])("rejects invalid course values %j", (patch) => {
    expect(parseCourseDraft({ ...course, ...patch }).ok).toBe(false);
  });
  it("distinguishes unspecified teacher pay from explicit zero", () => {
    expect(parseTeacherDraft({ name: " 李老师 ", color: "#4f6bff", pay: "" })).toEqual({ ok: true, value: { name: "李老师", color: "#4f6bff", payPerUnit: undefined } });
    expect(parseTeacherDraft({ name: "李老师", color: "#4f6bff", pay: "0" })).toEqual({ ok: true, value: { name: "李老师", color: "#4f6bff", payPerUnit: 0 } });
  });
  it("rejects invalid teacher names, colors and pay", () => {
    for (const patch of [{ name: " " }, { color: "invalid" }, { pay: "-1" }, { pay: "NaN" }]) {
      expect(parseTeacherDraft({ name: "老师", color: "#4f6bff", pay: "80", ...patch }).ok).toBe(false);
    }
  });
});
