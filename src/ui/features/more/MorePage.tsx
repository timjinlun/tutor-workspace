/** 更多：招生、报表、资料、转介绍。每个板块有免费 / 商业版边界，由 entitlements 决定。 */
import { Megaphone, FileText, FolderOpen, Gift, Image } from "lucide-react";
import { useStore } from "@/store";
import { Chip } from "@/ui/primitives";

export function MorePage() {
  const ent = useStore((x) => x.ent);
  const s = useStore((x) => x.s);
  const modules = [
    { icon: <Megaphone />, name: "潜在学员", desc: `${s.leads.length} 条线索 · 免费版记录状态，商业版有看板和跟进提醒`, pro: !ent.can("recruit.kanban") },
    { icon: <FileText />, name: "报告", desc: "家长报告、月度经营报告 · 商业版可自定周期、导出 PDF", pro: !ent.can("reports.pdf") },
    { icon: <FolderOpen />, name: "资料", desc: "文本笔记与链接 · 商业版支持文件附件", pro: !ent.can("library.files") },
    { icon: <Gift />, name: "转介绍", desc: "记录推荐人 · 商业版自动结算奖励", pro: !ent.can("referral.autoReward") },
    { icon: <Image />, name: "成绩卡", desc: "月底一键生成好看的图，发小红书或朋友圈", pro: false },
  ];
  return (
    <div className="page">
      <div className="page-head">
        <h1>更多</h1>
        <div className="sub">当前：免费版</div>
      </div>
      <div className="grid-2">
        {modules.map((m) => (
          <div className="card" key={m.name} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: "flex", gap: 8, alignItems: "center" }}>{m.name} <Chip>下一版</Chip>{m.pro && <Chip tone="accent">部分商业版</Chip>}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{m.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
