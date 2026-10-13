/** 导入 JSON 前的预览：先算出会导入什么，老师确认后再整体覆盖。 */
import { normalizeState, type Settings, type State } from "./types";

export interface ImportPreview {
  state: State;
  students: number;
  payments: number;
  doneLessons: number;
  scheduledLessons: number;
}

export function previewImport(current: Settings, raw: unknown): ImportPreview | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const state = normalizeState(raw as Partial<State>);
  /* 网页版文件没有设置：称呼、外观沿用这台电脑的；金币堆跟着新账目重算 */
  if (!(raw as Partial<State>).settings) state.settings = { ...current, coinPile: [], pendingCoinDrops: [] };
  return {
    state,
    students: state.students.length,
    payments: state.payments.length,
    doneLessons: state.lessons.filter((l) => l.status === "done").length,
    scheduledLessons: state.lessons.filter((l) => l.status === "scheduled").length,
  };
}
