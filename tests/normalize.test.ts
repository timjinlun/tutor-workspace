import { describe, expect, it } from "vitest";
import { normalizeState, type State } from "@/core/types";

describe("旧存档补齐字段", () => {
  it("缺 sortOrder / classes / unitMinutes 的存档读入后都有默认值", () => {
    const raw = {
      version: 3,
      students: [{ id: "a", name: "A", courseIds: [], note: "", createdAt: "2026-01-01" }, { id: "b", name: "B", courseIds: [], note: "", createdAt: "2026-01-01", archived: true }],
      settings: { teacherName: "T" },
    } as unknown as Partial<State>;
    const s = normalizeState(raw);
    expect(s.students.map((x) => x.sortOrder)).toEqual([0, 1]);
    expect(s.students[1]!.archived).toBe(true);
    expect(s.classes).toEqual([]);
    expect(s.settings.unitMinutes).toBe(60);
    expect(s.settings.teacherName).toBe("T");
    expect(s.lessons).toEqual([]);
  });
});
