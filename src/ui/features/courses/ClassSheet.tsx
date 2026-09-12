/**
 * 开班 / 改班：名字、课程、本班单价、缺席规则、成员。
 * 定价和缺席扣不扣都是老师自己定，这里只提供开关，规则在 core/klass 里执行。
 */
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "@/store";
import type { Class } from "@/core/types";
import { Avatar, Button, Field, Input, Select, Sheet } from "@/ui/primitives";
import { selfTeacher } from "@/core/teacher";

export function ClassSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Class }) {
  const s = useStore((x) => x.s);
  const ent = useStore((x) => x.ent);
  const { addClass, updateClass } = useStore(useShallow((x) => ({ addClass: x.addClass, updateClass: x.updateClass })));
  const [name, setName] = useState(editing?.name ?? "");
  const [courseId, setCourseId] = useState(editing?.courseId ?? s.courses[0]?.id ?? "");
  const [price, setPrice] = useState(editing?.pricePerUnit != null ? String(editing.pricePerUnit) : "");
  const [deduct, setDeduct] = useState(editing?.deductOnAbsence ?? true);
  const [members, setMembers] = useState<string[]>(editing?.studentIds ?? []);
  const [teacherId, setTeacherId] = useState(editing?.teacherId ?? selfTeacher(s)?.id ?? s.teachers[0]?.id);
  const [err, setErr] = useState("");
  const course = s.courses.find((c) => c.id === courseId);
  const candidates = s.students.filter((st) => !st.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const max = ent.limit("classSize");
  const toggle = (id: string) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const submit = () => {
    if (!name.trim() || !courseId) return;
    const p = parseFloat(price);
    const patch = { name: name.trim(), courseId, studentIds: members, pricePerUnit: Number.isFinite(p) && p >= 0 && price !== "" ? p : undefined, deductOnAbsence: deduct, teacherId };
    const r = editing ? updateClass(editing.id, patch) : addClass(patch);
    if (!r.ok) { setErr(r.reason); return; }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} wide title={editing ? "编辑班级" : "开一个班"} sub="几个人一起上，打卡时各扣各的课时。">
      {err && <div className="banner-error">{err}</div>}
      <div className="grid-2">
        <Field label="班级名"><Input autoFocus value={name} placeholder="初二数学小班" onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="课程">
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {s.courses.map((c) => <option key={c.id} value={c.id}>{c.name} · ¥{c.price}/课时</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid-2">
        <Field label="本班单价（每人每课时，可空）"><Input type="number" min={0} value={price} placeholder={course ? `${course.price}（同课程）` : "0"} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="学员缺席时">
          <Select value={deduct ? "1" : "0"} onChange={(e) => setDeduct(e.target.value === "1")}>
            <option value="1">照扣课时、算收入</option>
            <option value="0">不扣课时、不算收入</option>
          </Select>
        </Field>
      </div>
      {s.teachers.length > 1 && (
        <Field label="谁上的">
          <Select value={teacherId ?? ""} onChange={(e) => setTeacherId(e.target.value)}>
            {s.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.self ? "（我）" : ""}</option>)}
          </Select>
        </Field>
      )}
      <Field label={`成员 · ${members.length}${Number.isFinite(max) ? ` / ${max}` : ""} 人`}>
        {candidates.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>还没有在读学员，先去「学员」添加。</div>
        ) : (
          <div className="member-pick">
            {candidates.map((st) => {
              const on = members.includes(st.id);
              return (
                <button key={st.id} className={`member ${on ? "on" : ""}`} onClick={() => toggle(st.id)}>
                  <Avatar name={st.name} size="sm" />{st.name}
                </button>
              );
            })}
          </div>
        )}
      </Field>
      <div className="sheet-actions">
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={submit} disabled={!name.trim() || !courseId}>{editing ? "保存" : "开班"}</Button>
      </div>
    </Sheet>
  );
}
