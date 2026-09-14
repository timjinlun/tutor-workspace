import { expect, it } from "vitest";
import { emptyState, normalizeState, type State } from "../src/core/types";
import { editStudentProfile } from "../src/core/student-profile/commands";
import { filterStudents, studentTags } from "../src/core/student-profile/selectors";
import { createLearningRecordActions } from "../src/store/learning-records";
import { createStudentProfileActions } from "../src/store/student-profile";

export function dossierFixture(): State {
  const s = emptyState();
  s.students = [{ id: "s", name: "陈晨", courseIds: ["c"], note: "内部信息", tags: ["中考"], createdAt: "2026-01-01", archived: false, sortOrder: 0 }];
  s.courses = [{ id: "c", name: "数学", price: 280, unitsPerLesson: 1 }];
  s.lessons = [{ id: "l", studentId: "s", courseId: "c", date: "2026-09-14", time: "10:00", price: 280, units: 1, source: "manual", status: "done", createdAt: "" }];
  return s;
}
it("从实际授课关系推断格式，标签跨维度 AND 筛选且不改顺序", () => {
  const s = dossierFixture();
  s.classes = [{ id: "k", name: "小班", courseId: "c", studentIds: ["s"], active: true, deductOnAbsence: false }];
  expect(studentTags(s, s.students[0]!).map((t) => t.label)).toEqual(["数学", "1 对 1", "小班", "中考"]);
  expect(filterStudents(s, "陈", ["course:c", "format:individual", "custom:中考"])).toHaveLength(1);
  expect(filterStudents(s, "", ["custom:不存在"])).toHaveLength(0);
  s.lessons = []; s.classes = [];
  expect(studentTags(s, s.students[0]!).some((t) => t.kind === "format")).toBe(false);
});
it("编辑资料保留身份、历史定价与记录，清理重复标签", () => {
  let s = dossierFixture();
  const actions = createStudentProfileActions(() => s, (p) => { s = { ...s, ...p }; });
  expect(actions.editStudentProfile("s", { ...s.students[0]!, name: " 陈晨同学 ", grade: "初二", tags: [" 中考 ", "中考", ""] }).ok).toBe(true);
  expect(s.students[0]).toMatchObject({ id: "s", name: "陈晨同学", grade: "初二", tags: ["中考"], createdAt: "2026-01-01" });
  expect(s.lessons[0]!.price).toBe(280);
  expect(editStudentProfile(s, "s", { ...s.students[0]!, name: " " }).ok).toBe(false);
  expect(editStudentProfile(s, "s", { ...s.students[0]!, courseIds: ["missing"] }).ok).toBe(false);
});
it("记录追加和修改互不覆盖，拒绝空内容、非法日期和跨学员关联", () => {
  let s = dossierFixture();
  const actions = createLearningRecordActions(() => s, (p) => { s = { ...s, ...p }; });
  const input = { studentId: "s", date: "2026-09-14", text: "能独立列式", visibility: "parent" as const, lessonId: "l" };
  expect(actions.saveLearningRecord(input).ok).toBe(true);
  const id = s.learningRecords[0]!.id;
  expect(actions.saveLearningRecord({ ...input, text: "下一次观察" }).ok).toBe(true);
  expect(actions.saveLearningRecord({ ...input, text: "修改第一条" }, id).ok).toBe(true);
  expect(s.learningRecords).toHaveLength(2);
  expect(s.learningRecords[0]!.text).toBe("修改第一条");
  for (const patch of [{ text: " " }, { date: "2026-02-30" }, { lessonId: "other-student-lesson" }]) expect(actions.saveLearningRecord({ ...input, ...patch }).ok).toBe(false);
  actions.removeLearningRecord(id);
  expect(s.learningRecords).toHaveLength(1);
});
it("旧存档缺少新集合时安全补齐；删除学员后的孤儿观察被过滤", () => {
  const raw = dossierFixture() as Partial<State>;
  delete raw.learningRecords;
  expect(normalizeState(raw).learningRecords).toEqual([]);
  raw.learningRecords = [{ id: "r", studentId: "gone", text: "记录", date: "2026-09-14", visibility: "parent", createdAt: "", updatedAt: "" }];
  expect(normalizeState(raw).learningRecords).toEqual([]);
});
