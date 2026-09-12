"use strict";
/**
 * 渲染进程和主进程之间唯一的桥。
 *
 * 页面里拿不到 Node、拿不到文件系统、拿不到数据库句柄，只能调用下面这几个函数
 * （contextIsolation + sandbox 都开着）。这样即使页面里哪段 JS 出问题，
 * 也碰不到用户的磁盘。
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("TWDB", {
  /** 启动时同步读一次整份数据。全新安装返回 null，页面会自己灌示例数据。 */
  loadSync: () => ipcRenderer.sendSync("db:load-sync"),

  /** 保存整份数据（主进程在一个事务里写完）。返回 {ok:true} 或 {ok:false,error} */
  save: (state) => ipcRenderer.invoke("db:save", state),

  info: () => ipcRenderer.invoke("db:info"),
  log: (limit) => ipcRenderer.invoke("db:log", limit),

  snapshots: () => ipcRenderer.invoke("db:snapshots"),
  snapshotNow: (state) => ipcRenderer.invoke("db:snapshot-now", state),
  restoreSnapshot: (id) => ipcRenderer.invoke("db:restore-snapshot", id),

  backup: () => ipcRenderer.invoke("db:backup"),
  exportJSON: (state) => ipcRenderer.invoke("db:export-json", state),
  importJSON: () => ipcRenderer.invoke("db:import-json"),
  revealDataFolder: () => ipcRenderer.invoke("db:reveal"),

  /** 主进程主动喊话：菜单点了「导入」「恢复快照」之后让页面重载数据 */
  onReload: (fn) => {
    ipcRenderer.on("app:reload-state", (_e, state) => fn(state));
  },
  onRequestSave: (fn) => {
    ipcRenderer.on("app:request-save", () => fn());
  },

  version: () => ipcRenderer.sendSync("app:version"),
});
