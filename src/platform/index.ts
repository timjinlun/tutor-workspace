/**
 * 平台能力的唯一入口。App 版走 window.tw，浏览器版给出退化实现。
 * 这里不含任何业务逻辑。
 */
import type { Appearance, State } from "@/core/types";

export const isApp = typeof window !== "undefined" && !!window.tw;

export const platform = {
  /** macOS 系统强调色，取不到返回 null */
  async systemAccent(): Promise<string | null> {
    if (!isApp) return null;
    return window.tw!.system.accentColor();
  },
  onSystemAccentChange(fn: (hex: string) => void): () => void {
    if (!isApp) return () => {};
    return window.tw!.system.onAccentChange(fn);
  },
  /** 通知壳层切换深浅（毛玻璃和标题栏要跟着变） */
  setAppearance(a: Appearance): void {
    if (isApp) void window.tw!.system.setAppearance(a);
  },
  async copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
  openExternal(url: string): void {
    if (isApp) void window.tw!.system.openExternal(url);
    else window.open(url, "_blank", "noopener");
  },
  data: {
    async info() {
      return isApp ? window.tw!.data.info() : null;
    },
    async backup() {
      return isApp ? window.tw!.data.backup() : { ok: false as const, error: "浏览器版请用导出 JSON" };
    },
    async exportJSON(state: State) {
      if (isApp) return window.tw!.data.exportJSON(state);
      const blob = new Blob([JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), data: state }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `独立老师工作台_${state.settings.teacherName}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      return { ok: true as const };
    },
    async importJSON(): Promise<State | null> {
      if (isApp) return window.tw!.data.importJSON();
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = async () => {
          const f = input.files?.[0];
          if (!f) return resolve(null);
          try {
            const raw = JSON.parse(await f.text());
            resolve((raw?.data ?? raw) as State);
          } catch {
            resolve(null);
          }
        };
        input.click();
      });
    },
    async saveImage(dataUrl: string, filename: string): Promise<boolean> {
      if (isApp) return (await window.tw!.data.savePng(dataUrl, filename)).ok;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
      return true;
    },
    revealFolder() {
      if (isApp) void window.tw!.data.reveal();
    },
  },
};
