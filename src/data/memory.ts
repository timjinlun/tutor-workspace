import type { AuditEntry, State } from "@/core/types";
import type { Repository } from "./repository";

/** 测试和演示用 */
export function memoryRepository(initial: State | null = null): Repository {
  let state = initial;
  const audit: AuditEntry[] = [];
  return {
    kind: "memory",
    load: async () => (state ? structuredClone(state) : null),
    save: async (s) => {
      state = structuredClone(s);
    },
    audit: async (e) => {
      audit.unshift(e);
    },
    recentAudit: async (n) => audit.slice(0, n),
  };
}
