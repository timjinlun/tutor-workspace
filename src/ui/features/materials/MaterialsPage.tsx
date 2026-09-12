/** 资料：教案、课件、笔记，文本和链接。文件附件属于商业版，且不会塞进数据库。 */
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Plus, Trash2, Lock, ExternalLink } from "lucide-react";
import { useStore } from "@/store";
import type { Material } from "@/core/types";
import { Button, Chip, Empty, Field, Input, Select, Sheet } from "@/ui/primitives";
import { platform } from "@/platform";

const TYPES = ["教案", "课件", "试卷", "笔记", "其他"];

export function MaterialsPage() {
  const s = useStore((x) => x.s);
  const ent = useStore((x) => x.ent);
  const { addMaterial, updateMaterial, removeMaterial } = useStore(useShallow((x) => ({ addMaterial: x.addMaterial, updateMaterial: x.updateMaterial, removeMaterial: x.removeMaterial })));
  const [editing, setEditing] = useState<Material | null | "new">(null);
  const [q, setQ] = useState("");
  const list = useMemo(() => s.materials.filter((m) => !q || m.title.includes(q) || m.tags.includes(q)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [s.materials, q]);
  const name = (id?: string, kind: "course" | "student" = "course") => (kind === "course" ? s.courses.find((c) => c.id === id)?.name : s.students.find((x) => x.id === id)?.name);

  return (
    <div className="page">
      <div className="page-head">
        <h1>资料</h1>
        <div className="sub">{s.materials.length} 份</div>
        <div className="actions">
          {!ent.can("library.files") && <Chip><Lock size={11} /> 文件附件 · 商业版</Chip>}
          <Button variant="primary" icon={<Plus />} onClick={() => setEditing("new")}>新资料</Button>
        </div>
      </div>
      <div className="card">
        <div className="search" style={{ marginBottom: 6 }}><input placeholder="搜标题或标签" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {list.length === 0 ? (
          <Empty title="还没有资料" desc="教案提纲、错题本、课件链接都可以放这里，按学员或课程归档。" />
        ) : (
          list.map((m) => (
            <div className="row clickable" key={m.id} onClick={() => setEditing(m)}>
              <div className="grow">
                <div className="title">{m.title} <Chip>{m.type}</Chip></div>
                <div className="meta">{[name(m.courseId), name(m.studentId, "student"), m.tags].filter(Boolean).join(" · ") || "未归档"} · {m.createdAt}</div>
              </div>
              {m.url && <Button variant="ghost" size="sm" icon={<ExternalLink />} onClick={(e) => { e.stopPropagation(); platform.openExternal(m.url); }} title="打开链接" />}
              <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={(e) => { e.stopPropagation(); removeMaterial(m.id); }} title="删除" />
            </div>
          ))
        )}
      </div>
      <MaterialSheet key={editing === "new" ? "new" : (editing?.id ?? "none")} open={editing !== null} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSubmit={(v, id) => (id ? updateMaterial(id, v) : addMaterial(v))} />
    </div>
  );
}

function MaterialSheet({ open, onClose, initial, onSubmit }: { open: boolean; onClose: () => void; initial: Material | null; onSubmit: (v: Omit<Material, "id" | "createdAt">, id?: string) => void }) {
  const s = useStore((x) => x.s);
  const [v, setV] = useState({ title: initial?.title ?? "", type: initial?.type ?? TYPES[0]!, courseId: initial?.courseId ?? "", studentId: initial?.studentId ?? "", content: initial?.content ?? "", url: initial?.url ?? "", tags: initial?.tags ?? "" });
  const submit = () => {
    if (!v.title.trim()) return;
    onSubmit({ ...v, title: v.title.trim(), courseId: v.courseId || undefined, studentId: v.studentId || undefined }, initial?.id);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={initial ? "编辑资料" : "新资料"} wide>
      <div className="grid-2">
        <Field label="标题"><Input autoFocus value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="类型"><Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
      </div>
      <div className="grid-2">
        <Field label="课程"><Select value={v.courseId} onChange={(e) => setV({ ...v, courseId: e.target.value })}><option value="">不指定</option>{s.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="学员"><Select value={v.studentId} onChange={(e) => setV({ ...v, studentId: e.target.value })}><option value="">不指定</option>{s.students.filter((x) => !x.archived).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
      </div>
      <Field label="内容"><textarea className="input" value={v.content} placeholder="提纲、要点、错题…" onChange={(e) => setV({ ...v, content: e.target.value })} /></Field>
      <div className="grid-2">
        <Field label="链接（网盘 / 文档）"><Input value={v.url} placeholder="https://…" onChange={(e) => setV({ ...v, url: e.target.value })} /></Field>
        <Field label="标签"><Input value={v.tags} placeholder="期中,复习" onChange={(e) => setV({ ...v, tags: e.target.value })} /></Field>
      </div>
      <div className="sheet-actions">
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={submit} disabled={!v.title.trim()}>{initial ? "保存" : "添加"}</Button>
      </div>
    </Sheet>
  );
}
