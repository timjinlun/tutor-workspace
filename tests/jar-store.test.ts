import { beforeEach, expect, it } from "vitest";
import { useStore } from "../src/store";
import { emptyState, type CoinPilePose } from "../src/core/types";
import type { DayItem } from "../src/core/lesson";

const item: DayItem = { id: "virtual", studentId: "s", courseId: "c", units: 1, price: 280, date: "2026-09-12", time: "10:00", status: "scheduled", source: "template", templateId: "t", virtual: true, createdAt: "" };
beforeEach(() => useStore.setState({ s: emptyState(), jarFeedback: { seq: 0, changes: [] } }));
it("快速重复点击同一虚拟课不会重复收费和落币", () => {
  useStore.getState().complete(item);
  useStore.getState().complete(item);
  expect(useStore.getState().s.lessons).toHaveLength(1);
  expect(useStore.getState().jarFeedback.seq).toBe(1);
  expect(useStore.getState().s.settings.pendingCoinDrops).toHaveLength(1);
  expect(useStore.getState().s.settings.pendingCoinDrops[0]).toMatchObject({ amount: 280, coinValue: 10, count: 28 });
});
it("撤销产生负反馈，导入只恢复静态状态", () => {
  useStore.getState().complete(item);
  const id = useStore.getState().s.lessons[0]!.id;
  useStore.getState().undo(id);
  expect(useStore.getState().jarFeedback.changes).toEqual([{ id, amount: -280 }]);
  expect(useStore.getState().s.settings.pendingCoinDrops).toEqual([]);
  useStore.getState().replaceState(emptyState(), "data.import");
  expect(useStore.getState().jarFeedback.changes).toEqual([]);
});

it("保存金币休眠姿态并隔离调用方后续修改", () => {
  const pose: CoinPilePose = {
    id: "coin-a",
    lessonId: "lesson-a",
    position: { x: 0.1, y: 0.25, z: -0.1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    radius: 0.082,
    halfHeight: 0.018,
  };
  const store = useStore.getState() as typeof useStore extends { getState(): infer S } ? S & { saveCoinPile?: (coins: CoinPilePose[]) => void } : never;

  expect(typeof store.saveCoinPile).toBe("function");
  if (!store.saveCoinPile) return;
  store.saveCoinPile([pose]);
  pose.position.y = 99;

  expect(useStore.getState().s.settings.coinPile[0]!.position.y).toBe(0.25);
});

it("清空账目时同时清空金币物理快照", () => {
  useStore.getState().complete(item);
  useStore.getState().saveCoinPile([{
    id: "coin-a",
    position: { x: 0, y: 0.25, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    radius: 0.082,
    halfHeight: 0.018,
  }]);

  useStore.getState().clearAll();

  expect(useStore.getState().s.settings.coinPile).toEqual([]);
  expect(useStore.getState().s.settings.pendingCoinDrops).toEqual([]);
});

it("保存落地姿态时原子清除对应待结算批次", () => {
  useStore.getState().complete(item);
  const lessonId = useStore.getState().s.lessons[0]!.id;
  useStore.getState().saveCoinPile([{
    id: "coin-a",
    lessonId,
    position: { x: 0, y: 0.25, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    radius: 0.082,
    halfHeight: 0.018,
  }], [lessonId]);

  expect(useStore.getState().s.settings.pendingCoinDrops).toEqual([]);
  expect(useStore.getState().s.settings.coinPile[0]!.lessonId).toBe(lessonId);
});
