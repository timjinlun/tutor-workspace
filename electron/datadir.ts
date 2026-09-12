/**
 * 数据目录的位置。
 *
 * 教训：以前数据目录跟着 productName 走（Electron 默认行为），
 * 于是「显示名」和「数据地址」变成了同一个值——改个名字，用户的数据就找不到了。
 * 现在把两者拆开：
 *   - 显示名（productName）随时可以改，只管给人看
 *   - 目录名 DATA_DIR_NAME 一次定死，ASCII，永不修改，也不给人看
 *
 * ⚠️ 改 DATA_DIR_NAME = 让所有老用户的数据消失。除非同时写迁移，否则不要碰。
 * 同理 db 文件名也用 ASCII 固定名，不再叫「工作台.db」。
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/** 永不修改 */
const DATA_DIR_NAME = "LessonLog";
const DB_FILE = "data.db";

/** 历史上用过的目录名和库文件名，按新到旧排；只用于一次性搬家 */
const LEGACY_DIR_NAMES = ["记一课", "独立老师工作台"];
const LEGACY_DB_FILES = ["工作台.db"];

export function userDataDir(): string {
  return path.join(app.getPath("appData"), DATA_DIR_NAME);
}

export function dataDir(): string {
  return path.join(app.getPath("userData"), "data");
}

export function dbFile(): string {
  return path.join(dataDir(), DB_FILE);
}

export function wallpaperFile(): string {
  return path.join(app.getPath("userData"), "wallpaper.txt");
}

/**
 * 把 userData 钉在固定目录上，并把旧目录里的东西搬过来。
 * 必须在任何人读 userData 之前调用（也就是 app.whenReady 之前）。
 */
export function setupUserData(): { movedFrom?: string } {
  const target = userDataDir();
  app.setPath("userData", target);

  if (fs.existsSync(path.join(target, "data", DB_FILE))) return {};

  const appData = app.getPath("appData");
  for (const legacy of LEGACY_DIR_NAMES) {
    const from = path.join(appData, legacy);
    if (from === target || !fs.existsSync(path.join(from, "data"))) continue;
    fs.mkdirSync(target, { recursive: true });
    /* 整目录搬：数据库、壁纸、以及以后可能加的任何东西 */
    for (const entry of fs.readdirSync(from)) {
      const src = path.join(from, entry);
      const dst = path.join(target, entry);
      if (fs.existsSync(dst)) continue;
      try {
        fs.renameSync(src, dst);
      } catch {
        /* 跨卷或占用时退化成复制 */
        fs.cpSync(src, dst, { recursive: true });
      }
    }
    /* 顺手把库文件名也改成固定的 ASCII 名 */
    for (const old of LEGACY_DB_FILES) {
      const oldPath = path.join(target, "data", old);
      if (fs.existsSync(oldPath) && !fs.existsSync(path.join(target, "data", DB_FILE))) {
        fs.renameSync(oldPath, path.join(target, "data", DB_FILE));
      }
    }
    /* 搬空了就把旧目录删掉；只有空目录才删得掉，删不掉就留着，不冒险 */
    try { fs.rmdirSync(from); } catch { /* 还有东西，留着 */ }
    return { movedFrom: from };
  }
  return {};
}
