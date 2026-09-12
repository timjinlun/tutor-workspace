import type { Appearance, AuditEntry, State } from "@/core/types";

/** preload 暴露给页面的桥。页面拿不到 Node，只有这些。 */
export interface TutorBridge {
  data: {
    load(): Promise<State | null>;
    save(state: State): Promise<{ ok: true } | { ok: false; error: string }>;
    audit(entry: AuditEntry): Promise<void>;
    recentAudit(limit: number): Promise<AuditEntry[]>;
    info(): Promise<{ path: string; sizeBytes: number; snapshots: number }>;
    backup(): Promise<{ ok: true; path: string } | { ok: false; error?: string; cancelled?: boolean }>;
    exportJSON(state: State): Promise<{ ok: true; path?: string } | { ok: false; error?: string; cancelled?: boolean }>;
    importJSON(): Promise<State | null>;
    reveal(): Promise<void>;
    onImported(fn: (state: State) => void): () => void;
  };
  system: {
    accentColor(): Promise<string | null>;
    onAccentChange(fn: (hex: string) => void): () => void;
    setAppearance(a: Appearance): Promise<void>;
    openExternal(url: string): Promise<void>;
    platform: NodeJS.Platform;
  };
}

declare global {
  interface Window {
    tw?: TutorBridge;
  }
}
