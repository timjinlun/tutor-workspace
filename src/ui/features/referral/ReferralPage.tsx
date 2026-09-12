/** 转介绍：谁推荐了谁。免费版只记录和统计；自动结算奖励属于商业版。 */
import { useMemo } from "react";
import { Lock, Gift } from "lucide-react";
import { useStore } from "@/store";
import { Avatar, Chip, Empty } from "@/ui/primitives";

export function ReferralPage() {
  const s = useStore((x) => x.s);
  const ent = useStore((x) => x.ent);
  const go = useStore((x) => x.go);
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const st of s.students) if (st.referrerId) map.set(st.referrerId, [...(map.get(st.referrerId) ?? []), st.id]);
    return [...map.entries()].map(([ref, ids]) => ({ referrer: s.students.find((x) => x.id === ref), ids })).filter((g) => g.referrer).sort((a, b) => b.ids.length - a.ids.length);
  }, [s.students]);
  const total = groups.reduce((a, g) => a + g.ids.length, 0);

  return (
    <div className="page">
      <div className="page-head">
        <h1>转介绍</h1>
        <div className="sub">共 {total} 位学员由老学员推荐</div>
        <div className="actions">{!ent.can("referral.autoReward") && <Chip><Lock size={11} /> 自动结算奖励 · 商业版</Chip>}</div>
      </div>
      <div className="card">
        {groups.length === 0 ? (
          <Empty title="还没有转介绍记录" desc="在学员档案里填「推荐人」，这里会自动汇总每位老学员带来了几个人。" />
        ) : (
          groups.map((g) => (
            <div className="row" key={g.referrer!.id}>
              <Avatar name={g.referrer!.name} size="sm" />
              <div className="grow">
                <div className="title">{g.referrer!.name} <Chip tone="accent"><Gift size={11} /> 推荐了 {g.ids.length} 人</Chip></div>
                <div className="meta">{g.ids.map((id) => s.students.find((x) => x.id === id)?.name).filter(Boolean).join("、")}</div>
              </div>
              <button className="link" onClick={() => go({ page: "students", studentId: g.referrer!.id })}>查看</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
