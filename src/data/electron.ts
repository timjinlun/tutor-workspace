import type { Repository } from "./repository";

/** App 版：通过 preload 暴露的 window.tw 走 IPC，SQLite 在主进程 */
export function electronRepository(): Repository {
  const tw = window.tw!;
  return {
    kind: "sqlite",
    load: () => tw.data.load(),
    async save(s) {
      const r = await tw.data.save(s);
      if (!r.ok) throw new Error(r.error ?? "保存失败");
    },
    audit: (e) => tw.data.audit(e),
    recentAudit: (n) => tw.data.recentAudit(n),
  };
}
