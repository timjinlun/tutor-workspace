/** 持久化端口。store 只认这个接口，不知道背后是 SQLite 还是 localStorage。 */
import type { AuditEntry, State } from "@/core/types";

export interface Repository {
  readonly kind: "sqlite" | "localStorage" | "memory";
  /** 全新安装返回 null */
  load(): Promise<State | null>;
  save(state: State): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
  recentAudit(limit: number): Promise<AuditEntry[]>;
}
