"use strict";
/**
 * 主进程：开窗口、建菜单、管数据库。
 *
 * 数据库文件放在系统的「应用数据目录」，不是浏览器缓存：
 *   macOS   ~/Library/Application Support/独立老师工作台/data/工作台.db
 *   Windows %APPDATA%\独立老师工作台\data\工作台.db
 * 清浏览器缓存、换浏览器、重装浏览器，都碰不到它。
 */

const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const db = require("./db");

const IS_MAC = process.platform === "darwin";
let win = null;
let dbReady = false;

function dataDir() { return path.join(app.getPath("userData"), "data"); }
function dbFile() { return path.join(dataDir(), "工作台.db"); }

function openDb() {
  db.open(dbFile());
  dbReady = true;
}

/* ============================== 窗口 ============================== */

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "独立老师工作台",
    backgroundColor: "#f1f5f9",
    titleBarStyle: IS_MAC ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  /* 页面里的外部链接一律用系统浏览器打开，不在应用里开新窗口 */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) { e.preventDefault(); shell.openExternal(url); }
  });
}

/* ============================== 菜单 ============================== */

function buildMenu() {
  const dataMenu = {
    label: "数据",
    submenu: [
      { label: "立即备份到文件…", click: () => doBackup() },
      { label: "导出 JSON…", click: () => doExportJson() },
      { type: "separator" },
      { label: "从 JSON 导入…", click: () => doImport() },
      { type: "separator" },
      { label: "打开数据文件夹", click: () => shell.openPath(dataDir()) },
      {
        label: "数据库位置",
        click: () => dialog.showMessageBox(win, {
          type: "info",
          title: "数据库位置",
          message: "你的全部数据存在这里：",
          detail: dbFile() + "\n\n这是一个 SQLite 数据库文件。想手动备份，直接复制走这个文件夹就行。",
          buttons: ["知道了", "打开文件夹"],
        }).then((r) => { if (r.response === 1) shell.openPath(dataDir()); }),
      },
    ],
  };

  const template = [
    ...(IS_MAC ? [{
      label: app.name,
      submenu: [
        { role: "about", label: "关于 独立老师工作台" },
        { type: "separator" },
        { role: "hide", label: "隐藏" },
        { role: "hideOthers", label: "隐藏其他" },
        { role: "unhide", label: "全部显示" },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ],
    }] : []),
    {
      label: "文件",
      submenu: IS_MAC ? [{ role: "close", label: "关闭窗口" }] : [{ role: "quit", label: "退出" }],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" }, { role: "redo", label: "重做" }, { type: "separator" },
        { role: "cut", label: "剪切" }, { role: "copy", label: "复制" }, { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    dataMenu,
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "重新载入" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "全屏" },
        { role: "toggleDevTools", label: "开发者工具" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ============================== 备份 / 导入导出 ============================== */

async function doBackup() {
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "备份数据库",
    defaultPath: `独立老师工作台备份_${stamp}.db`,
    filters: [{ name: "SQLite 数据库", extensions: ["db"] }],
  });
  if (canceled || !filePath) return;
  try {
    db.backupTo(filePath);
    dialog.showMessageBox(win, { type: "info", message: "备份完成", detail: filePath });
  } catch (e) {
    dialog.showErrorBox("备份失败", String(e && e.message ? e.message : e));
  }
}

async function doExportJson() {
  /* 数据始终是已保存状态，所以直接从数据库导出即可，不用问渲染进程要 */
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "导出 JSON",
    defaultPath: `独立老师工作台数据_${stamp}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return;
  try {
    const payload = { version: db.SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: db.loadState() };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    dialog.showMessageBox(win, { type: "info", message: "导出完成", detail: filePath });
  } catch (e) {
    dialog.showErrorBox("导出失败", String(e && e.message ? e.message : e));
  }
}

async function doImport() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: "从 JSON 导入",
    filters: [{ name: "JSON 备份", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths || !filePaths[0]) return;
  const ok = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["取消", "确认导入并覆盖"],
    defaultId: 0,
    cancelId: 0,
    message: "导入会覆盖当前全部数据",
    detail: "导入前会自动存一份快照，出问题可以从「数据 → 快照」回滚。",
  });
  if (ok.response !== 1) return;
  try {
    const raw = JSON.parse(fs.readFileSync(filePaths[0], "utf8"));
    const state = raw && raw.data ? raw.data : raw;
    if (!state || typeof state !== "object") throw new Error("文件格式不对");
    db.snapshot(db.loadState(), "导入前");
    db.saveState(state);
    if (win) win.webContents.send("app:reload-state", db.loadState());
    dialog.showMessageBox(win, { type: "info", message: "导入完成" });
  } catch (e) {
    dialog.showErrorBox("导入失败", String(e && e.message ? e.message : e));
  }
}

/* ============================== IPC ============================== */

function wireIpc() {
  ipcMain.on("app:version", (e) => { e.returnValue = app.getVersion(); });

  ipcMain.on("db:load-sync", (e) => {
    try {
      /* 全新安装（还没 seed 过）返回 null，页面会自己灌示例数据 */
      e.returnValue = db.isSeeded() ? db.loadState() : null;
    } catch (err) {
      console.error("[db:load-sync]", err);
      e.returnValue = null;
    }
  });

  ipcMain.handle("db:save", (_e, state) => {
    try {
      db.saveState(state);
      db.markSeeded();
      return { ok: true };
    } catch (err) {
      console.error("[db:save]", err);
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle("db:info", () => {
    try { return { ok: true, ...db.stats(), version: app.getVersion(), dataDir: dataDir() }; }
    catch (err) { return { ok: false, error: String(err) }; }
  });

  ipcMain.handle("db:log", (_e, limit) => {
    try { return { ok: true, rows: db.attendanceLog(limit) }; }
    catch (err) { return { ok: false, error: String(err) }; }
  });

  ipcMain.handle("db:snapshots", () => {
    try { return { ok: true, rows: db.listSnapshots() }; }
    catch (err) { return { ok: false, error: String(err) }; }
  });

  ipcMain.handle("db:snapshot-now", (_e, state) => {
    try { db.snapshot(state || db.loadState(), "手动"); return { ok: true }; }
    catch (err) { return { ok: false, error: String(err) }; }
  });

  ipcMain.handle("db:restore-snapshot", async (_e, id) => {
    const state = db.readSnapshot(id);
    if (!state) return { ok: false, error: "找不到这份快照" };
    const r = await dialog.showMessageBox(win, {
      type: "warning",
      buttons: ["取消", "确认回滚"],
      defaultId: 0, cancelId: 0,
      message: "回滚到这份快照？",
      detail: "当前数据会先自动存一份快照，所以这一步也是可以再撤回的。",
    });
    if (r.response !== 1) return { ok: false, cancelled: true };
    try {
      db.snapshot(db.loadState(), "回滚前");
      db.saveState(state);
      return { ok: true, state: db.loadState() };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle("db:backup", async () => { await doBackup(); return { ok: true }; });

  ipcMain.handle("db:export-json", async (_e, state) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "导出 JSON",
      defaultPath: `独立老师工作台数据_${stamp}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { ok: false, cancelled: true };
    try {
      const payload = { version: db.SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: state || db.loadState() };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
      return { ok: true, path: filePath };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle("db:import-json", async () => { await doImport(); return { ok: true }; });

  ipcMain.handle("db:reveal", () => { shell.openPath(dataDir()); return { ok: true }; });
}

/* ============================== 生命周期 ============================== */

/* 同一份数据库不允许两个实例同时写 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    try {
      openDb();
    } catch (err) {
      dialog.showErrorBox("数据库打开失败", `${err && err.message ? err.message : err}\n\n路径：${dbFile()}`);
      app.exit(1);
      return;
    }
    /* 每次启动先存一份快照，等于「开机自动备份」 */
    try { db.snapshot(db.loadState(), "启动"); } catch (e) { console.error(e); }

    wireIpc();
    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => { if (!IS_MAC) app.quit(); });
  app.on("before-quit", () => { if (dbReady) db.close(); });
}
