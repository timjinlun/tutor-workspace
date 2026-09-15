import { useState } from "react";
import type { Class, Course, Student, Teacher } from "@/core/types";
import type { CommandResult } from "@/core/command-result";
import { Avatar, Button, Field, Input, Select, Sheet } from "@/ui/primitives";
import "./classes.css";

export function ClassEditor({ editing, courses, students, teachers, maxMembers, onSave, onClose }: { editing?: Class; courses: Course[]; students: Student[]; teachers: Teacher[]; maxMembers: number; onSave: (value: Omit<Class, "id" | "active">) => CommandResult; onClose: () => void }) {
  const [draft, setDraft] = useState({ name: editing?.name ?? "", courseId: editing?.courseId ?? courses[0]?.id ?? "", price: editing?.pricePerUnit == null ? "" : String(editing.pricePerUnit), teacherId: editing?.teacherId ?? teachers.find(t => t.self)?.id ?? teachers[0]?.id ?? "", deduct: editing?.deductOnAbsence ?? true });
  const [members, setMembers] = useState(editing?.studentIds ?? []);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const course = courses.find(c => c.id === draft.courseId);
  // Retain already selected archived students; editing other fields must not drop them.
  const candidates = students.filter(st => (!st.archived || members.includes(st.id)) && st.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const save = () => {
    const price = Number(draft.price);
    if (!draft.name.trim() || !course) { setError("请填写班级名称并选择课程。"); return; }
    if (draft.price.trim() && (!Number.isFinite(price) || price < 0)) { setError("请填写有效单价，或留空沿用课程价格。"); return; }
    const result = onSave({ name: draft.name.trim(), courseId: draft.courseId, studentIds: members, pricePerUnit: draft.price.trim() ? price : undefined, deductOnAbsence: draft.deduct, teacherId: draft.teacherId || undefined });
    if (!result.ok) { setError(result.reason); return; }
    onClose();
  };
  return <Sheet open onClose={onClose} wide title={editing ? "管理班级" : "开一个班"} sub="集中设置成员、授课老师、定价和缺席规则。">
    {error && <div role="alert" className="banner-error">{error}</div>}
    <div className="grid-2"><Field label="班级名称"><Input aria-label="班级名称" autoFocus value={draft.name} placeholder="例如：初二数学小班" onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field><Field label="所教课程"><Select aria-label="班级课程" value={draft.courseId} onChange={e => setDraft({ ...draft, courseId: e.target.value })}>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field></div>
    <div className="grid-2"><Field label="本班单价 / 人 / 课时（元）"><Input aria-label="班级单价" type="number" min={0} value={draft.price} placeholder={`留空沿用 ¥${course?.price ?? 0}`} onChange={e => setDraft({ ...draft, price: e.target.value })} /></Field><Field label="授课老师"><Select aria-label="班级老师" value={draft.teacherId} onChange={e => setDraft({ ...draft, teacherId: e.target.value })}>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}{t.self ? "（我）" : ""}</option>)}</Select></Field></div>
    <Field label="学员缺席时"><Select aria-label="缺席规则" value={draft.deduct ? "deduct" : "keep"} onChange={e => setDraft({ ...draft, deduct: e.target.value === "deduct" })}><option value="deduct">照扣课时、算收入</option><option value="keep">不扣课时、不算收入</option></Select></Field>
    <Field label={`班级成员 · 已选 ${members.length} 人${Number.isFinite(maxMembers) ? ` / 上限 ${maxMembers} 人` : ""}`}>
      <Input aria-label="搜索班级学员" placeholder="搜索学员姓名" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="class-member-picker">{candidates.map(st => <button type="button" key={st.id} className="class-member-choice" aria-label={st.name} aria-pressed={members.includes(st.id)} onClick={() => setMembers(list => list.includes(st.id) ? list.filter(id => id !== st.id) : [...list, st.id])}><Avatar name={st.name} size="sm" />{st.name}{st.archived ? "（已结课）" : ""}</button>)}</div>
      {!candidates.length && <p className="muted">{students.length ? "没有匹配的学员。" : "还没有学员，可先保存班级，再去学员页添加。"}</p>}
    </Field>
    <div className="sheet-actions"><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={save}>保存班级</Button></div>
  </Sheet>;
}
