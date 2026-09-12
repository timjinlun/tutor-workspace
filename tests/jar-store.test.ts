import { beforeEach, expect, it } from "vitest";
import { useStore } from "../src/store";
import { emptyState } from "../src/core/types";
import type { DayItem } from "../src/core/lesson";

const item: DayItem = { id: "virtual", studentId: "s", courseId: "c", units: 1, price: 280, date: "2026-09-12", time: "10:00", status: "scheduled", source: "template", templateId: "t", virtual: true, createdAt: "" };
beforeEach(() => useStore.setState({ s: emptyState(), jarFeedback: { seq: 0, changes: [] } }));
it("快速重复点击同一虚拟课不会重复收费和落币", () => {
  useStore.getState().complete(item);
  useStore.getState().complete(item);
  expect(useStore.getState().s.lessons).toHaveLength(1);
  expect(useStore.getState().jarFeedback.seq).toBe(1);
});
it("撤销产生负反馈，导入只恢复静态状态", () => {
  useStore.getState().complete(item);
  const id = useStore.getState().s.lessons[0]!.id;
  useStore.getState().undo(id);
  expect(useStore.getState().jarFeedback.changes).toEqual([{ id, amount: -280 }]);
  useStore.getState().replaceState(emptyState(), "data.import");
  expect(useStore.getState().jarFeedback.changes).toEqual([]);
});
