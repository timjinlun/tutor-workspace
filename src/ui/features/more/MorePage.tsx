/** 更多：成绩卡、潜在学员、资料、转介绍。每个板块的免费 / 商业版边界由 entitlements 决定。 */
import { useState, type ReactElement } from "react";
import { Megaphone, FolderOpen, Gift, Image, ChevronRight, Lock } from "lucide-react";
import { useStore, type Page } from "@/store";
import { Chip } from "@/ui/primitives";
import { ScorecardSheet } from "@/ui/widgets/ScorecardSheet";
import "./more.css";

export function MorePage() {
  const ent = useStore((x) => x.ent);
  const s = useStore((x) => x.s);
  const go = useStore((x) => x.go);
  const [cardOpen, setCardOpen] = useState(false);
  const referred = s.students.filter((x) => x.referrerId).length;
  const items: { icon: ReactElement; name: string; desc: string; pro?: string; page?: Page; onClick?: () => void }[] = [
    { icon: <Image />, name: "成绩卡", desc: "月底一键生成一张图，发小红书或朋友圈", pro: ent.can("scorecard.noWatermark") ? undefined : "去水印", onClick: () => setCardOpen(true) },
    { icon: <Megaphone />, name: "潜在学员", desc: `${s.leads.length} 条线索，成交后一键转成学员`, pro: ent.can("recruit.kanban") ? undefined : "看板与跟进提醒", page: "leads" },
    { icon: <FolderOpen />, name: "资料", desc: `${s.materials.length} 份教案、课件、笔记`, pro: ent.can("library.files") ? undefined : "文件附件", page: "materials" },
    { icon: <Gift />, name: "转介绍", desc: `${referred} 位学员由老学员推荐`, pro: ent.can("referral.autoReward") ? undefined : "自动结算奖励", page: "referral" },
  ];
  return (
    <div className="page">
      <div className="page-head">
        <h1>更多</h1>
        <div className="sub">免费版 · 独立老师</div>
      </div>
      <div className="grid-2">
        {items.map((m) => (
          <button className="card more-item" key={m.name} onClick={() => (m.page ? go({ page: m.page }) : m.onClick?.())}>
            <div className="more-icon">{m.icon}</div>
            <div className="grow">
              <div className="more-name">{m.name}</div>
              <div className="more-desc">{m.desc}</div>
              {m.pro && <div className="more-pro"><Chip><Lock size={11} /> {m.pro} · 商业版</Chip></div>}
            </div>
            <ChevronRight size={16} className="more-arrow" />
          </button>
        ))}
      </div>
      <ScorecardSheet open={cardOpen} onClose={() => setCardOpen(false)} />
    </div>
  );
}
