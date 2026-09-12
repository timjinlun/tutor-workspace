import type { AuditEntry, State } from "@/core/types";
import type { Repository } from "./repository";

const KEY = "tutor-workspace-v3";
const AUDIT_KEY = "tutor-workspace-v3-audit";

/** 浏览器单文件版：数据在 localStorage，审计只留最近 500 条 */
export function localStorageRepository(): Repository {
  return {
    kind: "localStorage",
    async load() {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as State) : null;
      } catch {
        return null;
      }
    },
    async save(s) {
      localStorage.setItem(KEY, JSON.stringify(s));
    },
    async audit(e) {
      const list = await this.recentAudit(499);
      localStorage.setItem(AUDIT_KEY, JSON.stringify([e, ...list]));
    },
    async recentAudit(n) {
      try {
        const raw = localStorage.getItem(AUDIT_KEY);
        return raw ? (JSON.parse(raw) as AuditEntry[]).slice(0, n) : [];
      } catch {
        return [];
      }
    },
  };
}
