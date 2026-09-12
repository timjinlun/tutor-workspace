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
    /*
     * 把库文件名改成固定的 ASCII 名。
     * ⚠️ SQLite 的 WAL 模式下，<db>-wal 里可能有还没 checkpoint 的事务，
     *    只改主库名会让它变成孤儿——库还在，但最近的改动全部读不到。
     *    三个文件必须一起改。
     */
    for (const old of LEGACY_DB_FILES) {
      const dir = path.join(target, "data");
      if (!fs.existsSync(path.join(dir, old)) || fs.existsSync(path.join(dir, DB_FILE))) continue;
      for (const suffix of ["", "-wal", "-shm"]) {
        const from2 = path.join(dir, old + suffix);
        if (fs.existsSync(from2)) fs.renameSync(from2, path.join(dir, DB_FILE + suffix));
      }
    }
    /* 搬空了就把旧目录删掉；只有空目录才删得掉，删不掉就留着，不冒险 */
    try { fs.rmdirSync(from); } catch { /* 还有东西，留着 */ }
    return { movedFrom: from };
  }
  return {};
}

/**
 * 修复 3.5.0 留下的孤儿 WAL：那一版只改了主库名，把 <旧名>-wal / -shm 落在原地，
 * 导致最近一次 checkpoint 之后的改动读不出来。这里把它们认回去。
 * 只在主库没有自己的 -wal 时才做，避免覆盖正在用的那份。
 */
export function adoptOrphanWal(): boolean {
  const dir = dataDir();
  if (!fs.existsSync(path.join(dir, DB_FILE)) || fs.existsSync(path.join(dir, DB_FILE + "-wal"))) return false;
  for (const old of LEGACY_DB_FILES) {
    const orphan = path.join(dir, old + "-wal");
    if (!fs.existsSync(orphan)) continue;
    for (const suffix of ["-wal", "-shm"]) {
      const from = path.join(dir, old + suffix);
      if (fs.existsSync(from)) fs.renameSync(from, path.join(dir, DB_FILE + suffix));
    }
    return true;
  }
  return false;
}
