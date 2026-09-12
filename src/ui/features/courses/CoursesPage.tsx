/** 课程与老师：单价、每节扣几课时、1 课时多少分钟。都是排课和算账的前置对象，放一页。 */
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Plus, Trash2, Clock } from "lucide-react";
import { useStore } from "@/store";
import { Button, Chip, Empty, Field, Input, Sheet } from "@/ui/primitives";
import "./courses.css";

export function CoursesPage() {
  const s = useStore((x) => x.s);
  const ent = useStore((x) => x.ent);
  const { updateCourse, removeCourse, addTeacher, updateSettings } = useStore(useShallow((x) => ({ updateCourse: x.updateCourse, removeCourse: x.removeCourse, addTeacher: x.addTeacher, updateSettings: x.updateSettings })));
  const [addOpen, setAddOpen] = useState(false);
  const [err, setErr] = useState("");
  const [newTeacher, setNewTeacher] = useState("");
  const usersOf = (courseId: string) => s.students.filter((st) => !st.archived && st.courseIds.includes(courseId)).length;

  return (
    <div className="page">
      <div className="page-head">
        <h1>课程</h1>
        <div className="sub">{s.courses.length} 门 · 默认 1 课时 = {s.settings.unitMinutes} 分钟</div>
        <div className="actions">
          <Button variant="primary" icon={<Plus />} onClick={() => setAddOpen(true)}>新课程</Button>
        </div>
      </div>
      {err && <div className="banner-error">{err}</div>}

      <div className="card">
        <div className="section-title"><Clock size={14} /> 1 课时默认多少分钟</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Input type="number" min={5} step={5} style={{ width: 120 }} value={s.settings.unitMinutes} onChange={(e) => updateSettings({ unitMinutes: Math.max(5, Number(e.target.value) || 60) })} />
          <span className="muted">分钟。单门课可以在下面单独设。「今天」和课表用它算每节课的结束时间。</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">课程与单价</div>
        {s.courses.length === 0 ? (
          <Empty title="还没有课程" desc="先建课，学员和缴费都挂在课程下。" actions={<Button variant="primary" icon={<Plus />} onClick={() => setAddOpen(true)}>新课程</Button>} />
        ) : (
          <>
            <div className="course-head">
              <span>课程</span><span>单价 / 课时</span><span>每节扣</span><span>1 课时 =</span><span>在读</span><span />
            </div>
            {s.courses.map((c) => (
              <div className="course-row" key={c.id}>
                <Input value={c.name} onChange={(e) => updateCourse(c.id, { name: e.target.value })} />
                <div className="with-unit"><span>¥</span><Input type="number" min={0} value={c.price} onChange={(e) => updateCourse(c.id, { price: Number(e.target.value) || 0 })} /></div>
                <div className="with-unit"><Input type="number" min={0.5} step={0.5} value={c.unitsPerLesson} onChange={(e) => updateCourse(c.id, { unitsPerLesson: Math.max(0.5, Number(e.target.value) || 1) })} /><span>课时</span></div>
                <div className="with-unit"><Input type="number" min={5} step={5} placeholder={String(s.settings.unitMinutes)} value={c.unitMinutes ?? ""} onChange={(e) => updateCourse(c.id, { unitMinutes: e.target.value ? Math.max(5, Number(e.target.value)) : undefined })} /><span>分钟</span></div>
                <div className="num muted">{usersOf(c.id)} 人</div>
                <Button variant="ghost" size="sm" icon={<Trash2 />} title="删除" onClick={() => { const r = removeCourse(c.id); setErr(r.ok ? "" : r.reason); }} />
              </div>
            ))}
            <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              一节课的费用 = 每节扣的课时 × 单价。比如物理每节扣 2 课时、单价 ¥150，一节就是 ¥300，时长 2 × 45 = 90 分钟。已经打卡的课不受改动影响。
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">老师 <Chip>免费版最多 {ent.limit("teachers")} 位</Chip></div>
        {s.teachers.map((t) => (
          <div className="row" key={t.id}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.color }} />
            <div className="grow title">{t.name}</div>
          </div>
        ))}
        <div className="row">
          <div className="grow"><Input placeholder="老师姓名" value={newTeacher} onChange={(e) => setNewTeacher(e.target.value)} /></div>
          <Button icon={<Plus />} disabled={!newTeacher.trim()} onClick={() => { const r = addTeacher({ name: newTeacher.trim(), color: "#4f6bff" }); setErr(r.ok ? "" : r.reason); if (r.ok) setNewTeacher(""); }}>添加</Button>
        </div>
      </div>

      <AddCourseSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function AddCourseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCourse = useStore((x) => x.addCourse);
  const unitMinutes = useStore((x) => x.s.settings.unitMinutes);
  const [v, setV] = useState({ name: "", price: "", units: "1", minutes: "" });
  const submit = () => {
    if (!v.name.trim()) return;
    addCourse({ name: v.name.trim(), price: Number(v.price) || 0, unitsPerLesson: Math.max(0.5, Number(v.units) || 1), unitMinutes: v.minutes ? Math.max(5, Number(v.minutes)) : undefined });
    setV({ name: "", price: "", units: "1", minutes: "" });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="新课程">
      <div className="grid-2">
        <Field label="课程名"><Input autoFocus value={v.name} placeholder="数学" onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="单价（每课时）"><Input type="number" min={0} value={v.price} placeholder="280" onChange={(e) => setV({ ...v, price: e.target.value })} /></Field>
      </div>
      <div className="grid-2">
        <Field label="每节扣几课时"><Input type="number" min={0.5} step={0.5} value={v.units} onChange={(e) => setV({ ...v, units: e.target.value })} /></Field>
        <Field label="1 课时多少分钟（可空）"><Input type="number" min={5} step={5} value={v.minutes} placeholder={String(unitMinutes)} onChange={(e) => setV({ ...v, minutes: e.target.value })} /></Field>
      </div>
      <div className="sheet-actions">
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={submit} disabled={!v.name.trim()}>添加</Button>
      </div>
    </Sheet>
  );
}
