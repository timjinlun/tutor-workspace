/**
 * 平台能力的唯一入口。App 版走 window.tw，浏览器版给出退化实现。
 * 这里不含任何业务逻辑。
 */
import type { Appearance, State } from "@/core/types";
import type { LanAddress, ShareResult } from "@/core/poster-share-types";

export const isApp = typeof window !== "undefined" && !!window.tw;

export const platform = {
  posterShare: {
    async addresses(): Promise<LanAddress[]> { return isApp ? window.tw!.posterShare.addresses() : []; },
    async start(dataUrl: string, address?: string): Promise<ShareResult> {
      return isApp ? window.tw!.posterShare.start(dataUrl, address) : { ok: false, error: "浏览器版请保存到电脑，扫码传图需要桌面版" };
    },
    async stop(sessionId?: string): Promise<void> { if (isApp) await window.tw!.posterShare.stop(sessionId); },
  },
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
  wallpaper: {
    async get(): Promise<string | null> {
      if (isApp) return window.tw!.wallpaper.get();
      try {
        return localStorage.getItem("tutor-workspace-wallpaper");
      } catch {
        return null;
      }
    },
    async set(dataUrl: string): Promise<boolean> {
      if (isApp) return (await window.tw!.wallpaper.set(dataUrl)).ok;
      try {
        localStorage.setItem("tutor-workspace-wallpaper", dataUrl);
        return true;
      } catch {
        return false;
      }
    },
    async clear() {
      if (isApp) await window.tw!.wallpaper.clear();
      else localStorage.removeItem("tutor-workspace-wallpaper");
    },
    /** 让用户选一张图，等比缩到 2000px 以内，转成 JPEG data URL */
    pick(): Promise<string | null> {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const f = input.files?.[0];
          if (!f) return resolve(null);
          const img = new Image();
          img.onload = () => {
            const max = 2000;
            const k = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * k);
            c.height = Math.round(img.height * k);
            c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", 0.86));
            URL.revokeObjectURL(img.src);
          };
          img.onerror = () => resolve(null);
          img.src = URL.createObjectURL(f);
        };
        input.click();
      });
    },
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
      a.download = `记一课_${state.settings.teacherName}_${new Date().toISOString().slice(0, 10)}.json`;
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
