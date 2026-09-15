import { useState } from "react";
import { Plus, Users } from "lucide-react";
import type { Class, Course, Student, Teacher } from "@/core/types";
import type { CommandResult } from "@/core/command-result";
import { Button, Chip, Empty } from "@/ui/primitives";
import { SetupPanel } from "@/ui/primitives/SetupPanel";
import { ClassEditor } from "./ClassEditor";
import "./classes.css";

export function ClassManagement({ classes, courses, students, teachers, limit, memberLimit, onSave, onToggle, onDelete, onCourses }: { classes: Class[]; courses: Course[]; students: Student[]; teachers: Teacher[]; limit: number; memberLimit: number; onSave: (id: string | undefined, value: Omit<Class, "id" | "active">) => CommandResult; onToggle: (cls: Class) => CommandResult; onDelete: (cls: Class) => void; onCourses: () => void }) {
  const [editor, setEditor] = useState<{ cls?: Class } | null>(null);
  const [error, setError] = useState("");
  return <SetupPanel title="我的班级" description="哪些学员一起上课，谁来教、如何收费，在一个班级里管理。" actions={<Button variant="primary" icon={<Plus />} onClick={() => { if (!courses.length) { setError("开班前需要先创建一门课程。"); return; } setEditor({}); }}>开一个班</Button>} footer={<>{classes.filter(k => k.active).length} 个开课中{Number.isFinite(limit) ? ` / 最多 ${limit} 个` : ""} · {Number.isFinite(memberLimit) ? `每班最多 ${memberLimit} 人` : "班级人数不限"}。班课打卡时，按成员分别记录课时与收入。</>}>
    {error && <div className="banner-error" role="alert">{error}</div>}
    <div className="setup-list">
      {!classes.length && <Empty title="把一起上课的学员组成班级" desc="独立设置班级价格、授课老师和缺席规则。" actions={!courses.length ? <Button onClick={onCourses}>先去创建课程</Button> : <Button onClick={() => setEditor({})}>创建第一个班级</Button>} />}
      {classes.map(cls => {
        const course = courses.find(c => c.id === cls.courseId);
        const teacher = teachers.find(t => t.id === cls.teacherId) ?? teachers.find(t => t.self);
        const members = students.filter(st => cls.studentIds.includes(st.id));
        return <article className="setup-item" key={cls.id} data-class-id={cls.id}>
          <div className="setup-item-heading"><div className="setup-item-title"><span className="setup-item-icon"><Users size={19} /></span><h3>{cls.name}</h3><Chip tone={cls.active ? "green" : undefined}>{cls.active ? "开课中" : "已暂停"}</Chip></div><Button size="sm" aria-label={`管理班级 ${cls.name}`} onClick={() => setEditor({ cls })}>管理班级</Button></div>
          <dl className="setup-item-meta"><div><dt>课程</dt><dd>{course?.name ?? "课程已移除"}</dd></div><div><dt>在读成员</dt><dd>{members.filter(st => !st.archived).length} 人</dd></div><div><dt>每人每课时</dt><dd>¥{cls.pricePerUnit ?? course?.price ?? 0}</dd></div><div><dt>授课老师</dt><dd>{teacher?.name ?? "尚未指定"}</dd></div></dl>
          <p className="setup-item-note">成员：{members.map(st => `${st.name}${st.archived ? "（已结课）" : ""}`).join("、") || "还未添加"}<br />缺席{cls.deductOnAbsence ? "照扣课时" : "不扣课时"} · {cls.pricePerUnit == null ? "沿用课程单价" : "使用本班单价"}</p>
          <div className="class-item-controls"><Button size="sm" variant="ghost" onClick={() => { const r = onToggle(cls); setError(r.ok ? "" : r.reason); }}>{cls.active ? "暂停开课" : "恢复开课"}</Button><span className="class-delete"><Button size="sm" variant="ghost" onClick={() => onDelete(cls)}>删除班级…</Button></span></div>
        </article>;
      })}
    </div>
    {editor && <ClassEditor editing={editor.cls} courses={courses} students={students} teachers={teachers} maxMembers={memberLimit} onClose={() => setEditor(null)} onSave={value => onSave(editor.cls?.id, value)} />}
  </SetupPanel>;
}
