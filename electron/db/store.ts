/**
 * SQLite 持久化（主进程）。见 ADR-0003：一实体一表，JSON 文档 + 索引键。
 * 全部同步 API（node:sqlite 的 DatabaseSync），在主进程里几毫秒完成。
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/* 与 src/core/types.ts 的 State 对齐；主进程不 import 渲染层代码，这里只需要形状 */
type Row = { id: string; [k: string]: unknown };
export interface StateLike {
  version: number;
  settings: Record<string, unknown>;
  [collection: string]: unknown;
}
export interface AuditLike {
  id: string;
  at: string;
  kind: string;
  summary: string;
  payload: Record<string, unknown>;
}

/** 每个集合按哪些键建索引 */
const COLLECTIONS: Record<string, [string?, string?]> = {
  teachers: [],
  courses: [],
  students: ["archived"],
  payments: ["studentId", "date"],
  templates: ["studentId", "weekday"],
  lessons: ["studentId", "date"],
  todos: ["due"],
  expenses: ["date"],
  otherIncomes: ["date"],
  leads: ["status"],
  materials: ["studentId"],
};

const SNAPSHOT_KEEP = 30;
const SNAPSHOT_GAP_MS = 60 * 60 * 1000;

export class SqliteStore {
  private db: DatabaseSync;
  readonly path: string;

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.path = file;
    this.db = new DatabaseSync(file);
    this.migrate();
  }

  private migrate() {
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(`CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
    for (const [name, keys] of Object.entries(COLLECTIONS)) {
      this.db.exec(`CREATE TABLE IF NOT EXISTS ${name}(id TEXT PRIMARY KEY, k1 TEXT, k2 TEXT, data TEXT NOT NULL, updated_at TEXT NOT NULL)`);
      if (keys[0]) this.db.exec(`CREATE INDEX IF NOT EXISTS idx_${name}_k1 ON ${name}(k1)`);
      if (keys[1]) this.db.exec(`CREATE INDEX IF NOT EXISTS idx_${name}_k2 ON ${name}(k2)`);
    }
    this.db.exec(`CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, summary TEXT NOT NULL, payload TEXT NOT NULL)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at)`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, reason TEXT NOT NULL, payload TEXT NOT NULL)`);
    const v = this.db.prepare("SELECT v FROM meta WHERE k='schema_version'").get() as { v: string } | undefined;
    if (!v) this.db.prepare("INSERT INTO meta(k,v) VALUES('schema_version','3')").run();
  }

  hasState(): boolean {
    const r = this.db.prepare("SELECT v FROM meta WHERE k='has_state'").get() as { v: string } | undefined;
    return r?.v === "1";
  }

  load(): StateLike | null {
    if (!this.hasState()) return null;
    const state: StateLike = { version: 3, settings: {} };
    for (const name of Object.keys(COLLECTIONS)) {
      const rows = this.db.prepare(`SELECT data FROM ${name} ORDER BY rowid`).all() as { data: string }[];
      state[name] = rows.map((r) => JSON.parse(r.data));
    }
    for (const r of this.db.prepare("SELECT k, v FROM settings").all() as { k: string; v: string }[]) {
      state.settings[r.k] = JSON.parse(r.v);
    }
    return state;
  }

  save(state: StateLike) {
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const [name, keys] of Object.entries(COLLECTIONS)) {
        this.db.exec(`DELETE FROM ${name}`);
        const ins = this.db.prepare(`INSERT INTO ${name}(id,k1,k2,data,updated_at) VALUES(?,?,?,?,?)`);
        const rows = (state[name] as Row[] | undefined) ?? [];
        for (const row of rows) {
          const k1 = keys[0] ? str(row[keys[0]]) : null;
          const k2 = keys[1] ? str(row[keys[1]]) : null;
          ins.run(String(row.id), k1, k2, JSON.stringify(row), now);
        }
      }
      this.db.exec("DELETE FROM settings");
      const ins = this.db.prepare("INSERT INTO settings(k,v) VALUES(?,?)");
      for (const [k, v] of Object.entries(state.settings ?? {})) ins.run(k, JSON.stringify(v ?? null));
      this.db.prepare("INSERT OR REPLACE INTO meta(k,v) VALUES('has_state','1')").run();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    this.maybeSnapshot(state);
  }

  audit(e: AuditLike) {
    this.db.prepare("INSERT OR IGNORE INTO audit_log(id,at,kind,summary,payload) VALUES(?,?,?,?,?)").run(e.id, e.at, e.kind, e.summary, JSON.stringify(e.payload ?? {}));
  }

  recentAudit(limit: number): AuditLike[] {
    const n = Math.max(1, Math.min(2000, limit | 0));
    return (this.db.prepare(`SELECT id, at, kind, summary, payload FROM audit_log ORDER BY at DESC LIMIT ${n}`).all() as { id: string; at: string; kind: string; summary: string; payload: string }[]).map((r) => ({
      ...r,
      payload: JSON.parse(r.payload),
    }));
  }

  snapshot(state: StateLike, reason: string) {
    this.db.prepare("INSERT INTO snapshots(at,reason,payload) VALUES(?,?,?)").run(new Date().toISOString(), reason, JSON.stringify(state));
    this.db.exec(`DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT ${SNAPSHOT_KEEP})`);
  }

  private maybeSnapshot(state: StateLike) {
    const last = this.db.prepare("SELECT at FROM snapshots ORDER BY id DESC LIMIT 1").get() as { at: string } | undefined;
    if (last && Date.now() - new Date(last.at).getTime() < SNAPSHOT_GAP_MS) return;
    this.snapshot(state, "auto");
  }

  info() {
    let sizeBytes = 0;
    try {
      sizeBytes = fs.statSync(this.path).size;
    } catch {
      /* ignore */
    }
    const snaps = (this.db.prepare("SELECT COUNT(*) c FROM snapshots").get() as { c: number }).c;
    return { path: this.path, sizeBytes, snapshots: Number(snaps) };
  }

  /** SQLite 官方在线备份：VACUUM INTO，WAL 里的内容也会带上 */
  backupTo(target: string) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    this.db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  }

  close() {
    this.db.close();
  }
}

const str = (v: unknown) => (v === undefined || v === null ? null : String(v));
