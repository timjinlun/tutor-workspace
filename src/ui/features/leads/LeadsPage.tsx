/** 潜在学员：免费版是带状态的列表；看板和跟进提醒属于商业版。 */
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Plus, Trash2, Lock, UserPlus } from "lucide-react";
import { useStore } from "@/store";
import type { Lead, LeadStatus } from "@/core/types";
import { Avatar, Button, Chip, Empty, Field, Input, Segmented, Select, Sheet } from "@/ui/primitives";

const STATUS: { value: LeadStatus; label: string; tone?: "accent" | "green" | "orange" | "red" }[] = [
  { value: "new", label: "新线索" },
  { value: "contacted", label: "跟进中", tone: "accent" },
  { value: "trial", label: "试听", tone: "orange" },
  { value: "won", label: "已成交", tone: "green" },
  { value: "lost", label: "流失", tone: "red" },
];
const SOURCES = ["小红书", "抖音", "微信朋友圈", "转介绍", "大众点评", "地推", "其他"];

export function LeadsPage() {
  const s = useStore((x) => x.s);
  const ent = useStore((x) => x.ent);
  const { addLead, updateLead, removeLead, addStudent, go } = useStore(useShallow((x) => ({ addLead: x.addLead, updateLead: x.updateLead, removeLead: x.removeLead, addStudent: x.addStudent, go: x.go })));
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const list = useMemo(() => s.leads.filter((l) => filter === "all" || l.status === filter).sort((a, b) => b.lastFollow.localeCompare(a.lastFollow)), [s.leads, filter]);
  const convert = (l: Lead) => {
    const st = addStudent({ name: l.name, courseIds: s.courses[0] ? [s.courses[0].id] : [], note: l.note });
    updateLead(l.id, { status: "won" });
    go({ page: "students", studentId: st.id });
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>潜在学员</h1>
        <div className="sub">{s.leads.length} 条 · 免费版最多 {ent.limit("leads")} 条</div>
        <div className="actions">
          {!ent.can("recruit.kanban") && <Chip><Lock size={11} /> 看板 · 商业版</Chip>}
          <Button variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>新线索</Button>
        </div>
      </div>
      {err && <div className="banner-error">{err}</div>}
      <div style={{ marginBottom: 14 }}>
        <Segmented value={filter} options={[{ value: "all", label: "全部" }, ...STATUS.map((x) => ({ value: x.value, label: x.label }))]} onChange={setFilter} />
      </div>
      <div className="card">
        {list.length === 0 ? (
          <Empty title="还没有线索" desc="小红书、朋友圈来的咨询记在这里，成交后一键转成学员。" actions={<Button variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>新线索</Button>} />
        ) : (
          list.map((l) => {
            const st = STATUS.find((x) => x.value === l.status)!;
            return (
              <div className="row" key={l.id}>
                <Avatar name={l.name} size="sm" />
                <div className="grow">
                  <div className="title">{l.name} <Chip tone={st.tone}>{st.label}</Chip></div>
                  <div className="meta">{[l.source, l.phone, l.intent ? `意向 ¥${l.intent.toLocaleString("zh-CN")}` : "", l.note].filter(Boolean).join(" · ")} · 最近跟进 {l.lastFollow}</div>
                </div>
                <Select value={l.status} style={{ width: 110, height: 32 }} onChange={(e) => updateLead(l.id, { status: e.target.value as LeadStatus })}>
                  {STATUS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </Select>
                {l.status !== "won" && <Button size="sm" icon={<UserPlus />} onClick={() => convert(l)}>转为学员</Button>}
                <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => removeLead(l.id)} title="删除" />
              </div>
            );
          })
        )}
      </div>
      <LeadSheet open={open} onClose={() => setOpen(false)} onSubmit={(v) => { const r = addLead(v); setErr(r.ok ? "" : r.reason); return r.ok; }} />
    </div>
  );
}

function LeadSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (v: Omit<Lead, "id" | "createdAt" | "lastFollow">) => boolean }) {
  const [v, setV] = useState({ name: "", phone: "", source: SOURCES[0]!, status: "new" as LeadStatus, intent: "", note: "" });
  const submit = () => {
    if (!v.name.trim()) return;
    if (onSubmit({ name: v.name.trim(), phone: v.phone, source: v.source, status: v.status, intent: Number(v.intent) || 0, note: v.note })) {
      setV({ name: "", phone: "", source: SOURCES[0]!, status: "new", intent: "", note: "" });
    }
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="新线索">
      <div className="grid-2">
        <Field label="姓名 / 称呼"><Input autoFocus value={v.name} placeholder="周女士" onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="联系方式"><Input value={v.phone} placeholder="微信 / 手机" onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
      </div>
      <div className="grid-2">
        <Field label="来源"><Select value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="意向金额"><Input type="number" min={0} value={v.intent} placeholder="8000" onChange={(e) => setV({ ...v, intent: e.target.value })} /></Field>
      </div>
      <Field label="备注"><Input value={v.note} placeholder="初三英语，周末有空" onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      <div className="sheet-actions">
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={submit} disabled={!v.name.trim()}>添加</Button>
      </div>
    </Sheet>
  );
}
