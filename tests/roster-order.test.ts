import { expect, it } from "vitest";
import { activeStudentsInOrder } from "@/core/student-profile/selectors";
import { emptyState, type Student } from "@/core/types";

const st = (id: string, sortOrder: number, archived = false): Student => ({ id, name: id, courseIds: [], note: "", createdAt: "", archived, sortOrder });

it("划课表和学员名单用同一个手动顺序，已结课的不出现", () => {
  const s = emptyState();
  s.students = [st("c", 2), st("a", 0), st("gone", 1, true), st("b", 1)];
  expect(activeStudentsInOrder(s).map((x) => x.id)).toEqual(["a", "b", "c"]);
});
