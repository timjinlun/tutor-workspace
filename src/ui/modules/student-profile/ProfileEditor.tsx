import { useState } from "react";
import type { Course, Student } from "@/core/types";
import type { StudentProfileInput } from "@/core/student-profile/types";
import type { CommandResult } from "@/core/command-result";
import { Button, Field, Input, Select, Sheet } from "@/ui/primitives";
import "./profile.css";

export function ProfileEditor({ student, courses, students, onSave, onClose }: {
  student: Student; courses: Course[]; students: Student[]; onSave(input: StudentProfileInput): CommandResult; onClose(): void;
}) {
  const [draft, setDraft] = useState<StudentProfileInput>({ ...student, courseIds: [...student.courseIds] });
  const [tags, setTags] = useState((student.tags ?? []).join("，"));
  const [error, setError] = useState("");
  const field = (key: "name" | "grade" | "school" | "guardian" | "contact", label: string) => <Field label={label}><Input aria-label={label} value={draft[key] ?? ""} maxLength={100} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></Field>;
  const save = () => {
    const result = onSave({ ...draft, tags: tags.split(/[,，\n]/) });
    if (result.ok) onClose(); else setError(result.reason);
  };
  return <Sheet open onClose={onClose} title="编辑学员资料" sub="资料可以随时补充；学习过程请另写学习记录。" wide>
    <div className="grid-2">{field("name", "姓名")}{field("grade", "年级")}{field("school", "学校")}{field("guardian", "家长称呼")}{field("contact", "联系方式")}</div>
    <Field label="所学课程"><div className="profile-course-choices">{courses.map((c) => <label key={c.id}><input type="checkbox" checked={draft.courseIds.includes(c.id)} onChange={(e) => setDraft({ ...draft, courseIds: e.target.checked ? [...draft.courseIds, c.id] : draft.courseIds.filter((id) => id !== c.id) })} />{c.name}</label>)}</div></Field>
    <Field label="自定义标签（用逗号分隔）"><Input aria-label="自定义标签" value={tags} maxLength={500} placeholder="准备中考，需要每周反馈" onChange={(e) => setTags(e.target.value)} /></Field>
    <p className="muted">课程、1 对 1、小班标签由实际课程关系生成，不需要重复填写。</p>
    <Field label="学习目标"><textarea className="input" aria-label="学习目标" value={draft.goal ?? ""} maxLength={1500} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} /></Field>
    <Field label="沟通偏好"><Input aria-label="沟通偏好" value={draft.communication ?? ""} onChange={(e) => setDraft({ ...draft, communication: e.target.value })} placeholder="例如：每周五微信反馈" /></Field>
    <Field label="内部备注（不会进入家长报告）"><textarea className="input" aria-label="内部备注" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
    <Field label="推荐人"><Select aria-label="推荐人" value={draft.referrerId ?? ""} onChange={(e) => setDraft({ ...draft, referrerId: e.target.value || undefined })}><option value="">不是转介绍</option>{students.filter((st) => st.id !== student.id).map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</Select></Field>
    {error && <p role="alert">{error}</p>}
    <div className="sheet-actions"><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!draft.name.trim()} onClick={save}>保存资料</Button></div>
  </Sheet>;
}
