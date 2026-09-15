import { useState } from "react";
import { Plus } from "lucide-react";
import type { Teacher } from "@/core/types";
import type { CommandResult } from "@/core/command-result";
import { Button, Chip } from "@/ui/primitives";
import { SetupPanel } from "@/ui/primitives/SetupPanel";
import { TeacherEditor } from "./TeacherEditor";
import "./teachers.css";

export function TeacherManagement({ teachers, defaultColor, limit, onSave, onDelete }: { teachers: Teacher[]; defaultColor: string; limit: number; onSave: (id: string | undefined, value: Omit<Teacher, "id" | "self">) => CommandResult; onDelete: (teacher: Teacher) => void }) {
  const [editor, setEditor] = useState<{ teacher?: Teacher } | null>(null);
  return <SetupPanel title="授课老师" description="一个人教，或与其他老师合作，都能清楚分配与结算。" actions={<Button variant="primary" icon={<Plus />} onClick={() => setEditor({})}>添加老师</Button>} footer={<>当前 {teachers.length} 位老师（含你自己）{Number.isFinite(limit) ? `，最多 ${limit} 位` : ""}。排课和打卡时可以指定授课老师。</>}>
    <div className="setup-list">{teachers.map(teacher => <article className="setup-item" key={teacher.id} data-teacher-id={teacher.id}>
      <div className="setup-item-heading"><div className="setup-item-title"><span className="teacher-identity" style={{ background: teacher.color }}>{teacher.name.slice(-2) || "师"}</span><h3>{teacher.name}</h3><Chip tone={teacher.self ? "accent" : undefined}>{teacher.self ? "我自己" : "合作老师"}</Chip></div><Button size="sm" aria-label={`编辑老师 ${teacher.name}`} onClick={() => setEditor({ teacher })}>编辑老师</Button></div>
      <dl className="setup-item-meta"><div><dt>结算方式</dt><dd>{teacher.self ? "无需结算" : teacher.payPerUnit == null ? "只统计课时" : `¥${teacher.payPerUnit} / 课时`}</dd></div><div><dt>课表标识</dt><dd><span style={{ color: teacher.color }}>●</span> 专属颜色</dd></div></dl>
      <p className="setup-item-note">{teacher.self ? "称呼与设置同步，不计入合作老师课时费。" : "已上课时与应付课时费，可在收支页查看。"}</p>
    </article>)}</div>
    {editor && <TeacherEditor teacher={editor.teacher} defaultColor={defaultColor} onClose={() => setEditor(null)} onSave={value => onSave(editor.teacher?.id, value)} onDelete={editor.teacher && !editor.teacher.self ? () => { onDelete(editor.teacher!); setEditor(null); } : undefined} />}
  </SetupPanel>;
}
