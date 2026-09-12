/** 页面与主进程之间唯一的桥。contextIsolation + sandbox 都开着。 */
import { contextBridge, ipcRenderer } from "electron";

const bridge = {
  data: {
    load: () => ipcRenderer.invoke("data:load"),
    save: (state: unknown) => ipcRenderer.invoke("data:save", state),
    audit: (entry: unknown) => ipcRenderer.invoke("data:audit", entry),
    recentAudit: (limit: number) => ipcRenderer.invoke("data:recentAudit", limit),
    info: () => ipcRenderer.invoke("data:info"),
    backup: () => ipcRenderer.invoke("data:backup"),
    exportJSON: (state: unknown) => ipcRenderer.invoke("data:exportJSON", state),
    importJSON: () => ipcRenderer.invoke("data:importJSON"),
    reveal: () => ipcRenderer.invoke("data:reveal"),
    savePng: (dataUrl: string, filename: string) => ipcRenderer.invoke("data:savePng", dataUrl, filename),
    onImported: (fn: (state: unknown) => void) => {
      const h = (_e: unknown, state: unknown) => fn(state);
      ipcRenderer.on("data:imported", h);
      return () => ipcRenderer.removeListener("data:imported", h);
    },
  },
  wallpaper: {
    get: () => ipcRenderer.invoke("wallpaper:get"),
    set: (dataUrl: string) => ipcRenderer.invoke("wallpaper:set", dataUrl),
    clear: () => ipcRenderer.invoke("wallpaper:clear"),
  },
  system: {
    accentColor: () => ipcRenderer.invoke("system:accentColor"),
    onAccentChange: (fn: (hex: string) => void) => {
      const h = (_e: unknown, hex: string) => fn(hex);
      ipcRenderer.on("system:accentChanged", h);
      return () => ipcRenderer.removeListener("system:accentChanged", h);
    },
    setAppearance: (a: string) => ipcRenderer.invoke("system:setAppearance", a),
    openExternal: (url: string) => ipcRenderer.invoke("system:openExternal", url),
    platform: process.platform,
  },
};

contextBridge.exposeInMainWorld("tw", bridge);
