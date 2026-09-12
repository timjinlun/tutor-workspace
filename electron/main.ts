/**
 * 主进程：窗口、菜单、平台能力、数据库。
 * 数据在 ~/Library/Application Support/独立老师工作台/data/工作台.db，与浏览器缓存无关。
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell, systemPreferences } from "electron";
import fs from "node:fs";
import path from "node:path";
import { SqliteStore } from "./db/store";

const IS_MAC = process.platform === "darwin";
let win: BrowserWindow | null = null;
let store: SqliteStore | null = null;

const dataDir = () => path.join(app.getPath("userData"), "data");
const dbFile = () => path.join(dataDir(), "工作台.db");
const wallpaperFile = () => path.join(app.getPath("userData"), "wallpaper.txt");

/* ============================== 窗口 ============================== */

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 920,
    minHeight: 600,
    title: "独立老师工作台",
    show: false,
    /* 苹果感的三件事：隐藏标题栏、侧栏毛玻璃、跟随深浅色 */
    titleBarStyle: IS_MAC ? "hiddenInset" : "default",
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: IS_MAC ? "sidebar" : undefined,
    visualEffectState: "active",
    backgroundColor: IS_MAC ? "#00000000" : "#f5f5f7",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.once("ready-to-show", () => win?.show());

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(path.join(__dirname, "../renderer/index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
}

/* ============================== 菜单 ============================== */

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(IS_MAC
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const, label: "关于 独立老师工作台" },
              { type: "separator" as const },
              { role: "hide" as const, label: "隐藏" },
              { role: "hideOthers" as const, label: "隐藏其他" },
              { type: "separator" as const },
              { role: "quit" as const, label: "退出" },
            ],
          },
        ]
      : []),
    {
      label: "文件",
      submenu: [
        { label: "备份到文件…", accelerator: "CmdOrCtrl+Shift+B", click: () => void doBackup() },
        { label: "导出 JSON…", click: () => void doExportFromDb() },
        { label: "从 JSON 导入…", click: () => void doImport() },
        { type: "separator" },
        { label: "打开数据文件夹", click: () => void shell.openPath(dataDir()) },
        { type: "separator" },
        IS_MAC ? { role: "close", label: "关闭窗口" } : { role: "quit", label: "退出" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "显示",
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
    { role: "windowMenu", label: "窗口" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ============================== 数据操作 ============================== */

async function doBackup() {
  if (!store) return { ok: false as const, error: "数据未就绪" };
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    title: "备份你的数据",
    defaultPath: `独立老师工作台备份_${stamp}.db`,
    filters: [{ name: "数据库备份", extensions: ["db"] }],
  });
  if (canceled || !filePath) return { ok: false as const, cancelled: true };
  try {
    store.backupTo(filePath);
    return { ok: true as const, path: filePath };
  } catch (e) {
    return { ok: false as const, error: String(e instanceof Error ? e.message : e) };
  }
}

async function exportJSON(state: unknown) {
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    title: "导出 JSON",
    defaultPath: `独立老师工作台_${stamp}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return { ok: false as const, cancelled: true };
  fs.writeFileSync(filePath, JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), data: state }, null, 2), "utf8");
  return { ok: true as const, path: filePath };
}

async function doExportFromDb() {
  if (!store) return;
  const r = await exportJSON(store.load());
  if (r.ok) void dialog.showMessageBox(win!, { type: "info", message: "导出完成", detail: r.path });
}

/** 读文件并交给页面处理；页面负责确认与替换 */
async function doImport(): Promise<unknown | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    title: "从 JSON 导入",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths[0]) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(filePaths[0], "utf8"));
    const state = raw?.data ?? raw;
    if (!state || typeof state !== "object") throw new Error("文件格式不对");
    if (store) store.snapshot(store.load() ?? { version: 3, settings: {} }, "before-import");
    win?.webContents.send("data:imported", state);
    return state;
  } catch (e) {
    dialog.showErrorBox("导入失败", String(e instanceof Error ? e.message : e));
    return null;
  }
}

/* ============================== IPC ============================== */

function wireIpc() {
  ipcMain.handle("data:load", () => store?.load() ?? null);
  ipcMain.handle("data:save", (_e, state) => {
    try {
      store?.save(state);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
  });
  ipcMain.handle("data:audit", (_e, entry) => store?.audit(entry));
  ipcMain.handle("data:recentAudit", (_e, limit) => store?.recentAudit(limit) ?? []);
  ipcMain.handle("data:info", () => store?.info());
  ipcMain.handle("data:backup", () => doBackup());
  ipcMain.handle("data:exportJSON", (_e, state) => exportJSON(state));
  ipcMain.handle("data:importJSON", () => doImport());
  ipcMain.handle("data:reveal", () => shell.openPath(dataDir()));
  ipcMain.handle("data:savePng", async (_e, dataUrl: string, filename: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win!, { title: "保存图片", defaultPath: filename, filters: [{ name: "PNG 图片", extensions: ["png"] }] });
    if (canceled || !filePath) return { ok: false, cancelled: true };
    try {
      fs.writeFileSync(filePath, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
      return { ok: true, path: filePath };
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
  });

  /* 壁纸：一个 data URL 存成文件，不塞进数据库，避免每次保存都拖着几 MB */
  ipcMain.handle("wallpaper:get", () => {
    try {
      return fs.readFileSync(wallpaperFile(), "utf8");
    } catch {
      return null;
    }
  });
  ipcMain.handle("wallpaper:set", (_e, dataUrl: string) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/") || dataUrl.length > 12 * 1024 * 1024) return { ok: false };
    fs.writeFileSync(wallpaperFile(), dataUrl, "utf8");
    return { ok: true };
  });
  ipcMain.handle("wallpaper:clear", () => {
    try {
      fs.unlinkSync(wallpaperFile());
    } catch {
      /* ignore */
    }
  });

  ipcMain.handle("system:accentColor", () => accentHex());
  ipcMain.handle("system:setAppearance", (_e, a: string) => {
    nativeTheme.themeSource = a === "light" || a === "dark" ? a : "system";
  });
  ipcMain.handle("system:openExternal", (_e, url: string) => {
    if (/^https?:\/\//.test(url)) return shell.openExternal(url);
  });
}

/** macOS 系统强调色：RRGGBBAA → #RRGGBB */
function accentHex(): string | null {
  if (!IS_MAC) return null;
  try {
    return "#" + systemPreferences.getAccentColor().slice(0, 6);
  } catch {
    return null;
  }
}

/* ============================== 生命周期 ============================== */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    try {
      store = new SqliteStore(dbFile());
      const loaded = store.load();
      if (loaded) store.snapshot(loaded, "launch");
    } catch (e) {
      dialog.showErrorBox("数据打开失败", `${e instanceof Error ? e.message : e}\n\n${dbFile()}`);
      app.exit(1);
      return;
    }
    wireIpc();
    buildMenu();
    createWindow();
    if (IS_MAC) {
      systemPreferences.subscribeNotification("AppleColorPreferencesChangedNotification", () => {
        const hex = accentHex();
        if (hex) win?.webContents.send("system:accentChanged", hex);
      });
    }
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (!IS_MAC) app.quit();
  });
  app.on("before-quit", () => store?.close());
}
