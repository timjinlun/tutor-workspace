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
 * 把 userData 钉在固定目录上，并把旧目录里的东西复制过来。
 * 必须在任何人读 userData 之前调用（也就是 app.whenReady 之前）。
 */
export function setupUserData(): { movedFrom?: string } {
  const target = userDataDir();
  app.setPath("userData", target);

  renameLegacyDb(target);
  if (fs.existsSync(path.join(target, "data", DB_FILE))) return {};

  const appData = app.getPath("appData");
  for (const legacy of LEGACY_DIR_NAMES) {
    const from = path.join(appData, legacy);
    if (from === target || !fs.existsSync(path.join(from, "data"))) continue;
    fs.mkdirSync(target, { recursive: true });
    /* 保留旧目录；如果上次迁移只搬了一部分，补齐目标目录里缺少的文件 */
    for (const entry of fs.readdirSync(from)) {
      const src = path.join(from, entry);
      const dst = path.join(target, entry);
      copyMissing(src, dst);
    }
    renameLegacyDb(target);
    return { movedFrom: from };
  }
  return {};
}

function copyMissing(src: string, dst: string) {
  if (fs.existsSync(dst)) {
    if (fs.statSync(src).isDirectory() && fs.statSync(dst).isDirectory()) {
      for (const entry of fs.readdirSync(src)) copyMissing(path.join(src, entry), path.join(dst, entry));
    }
    return;
  }
  fs.cpSync(src, dst, { recursive: true });
}

/** 主库与 WAL/SHM 必须一起改名，避免最近的课时记录被遗漏。 */
function renameLegacyDb(root: string) {
  const dir = path.join(root, "data");
  if (fs.existsSync(path.join(dir, DB_FILE))) return;
  for (const old of LEGACY_DB_FILES) {
    if (!fs.existsSync(path.join(dir, old))) continue;
    for (const suffix of ["", "-wal", "-shm"]) {
      const src = path.join(dir, old + suffix);
      if (fs.existsSync(src)) fs.renameSync(src, path.join(dir, DB_FILE + suffix));
    }
    return;
  }
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
