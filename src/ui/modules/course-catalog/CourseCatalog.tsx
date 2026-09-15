import { useState } from "react";
import { BookOpen, Plus, SlidersHorizontal } from "lucide-react";
import type { Course, Student } from "@/core/types";
import type { CommandResult } from "@/core/command-result";
import { Button, Empty, Field, Input, Sheet } from "@/ui/primitives";
import { SetupPanel } from "@/ui/primitives/SetupPanel";
import { CourseEditor } from "./CourseEditor";

export function CourseCatalog({ courses, students, unitMinutes, onSave, onDelete, onRules }: { courses: Course[]; students: Student[]; unitMinutes: number; onSave: (id: string | undefined, value: Omit<Course, "id">) => CommandResult; onDelete: (course: Course) => void; onRules: (minutes: number) => void }) {
  const [editor, setEditor] = useState<{ course?: Course } | null>(null);
  const [rules, setRules] = useState(false);
  return <SetupPanel title="课程目录" description="教什么、每节多少钱、上多久，在这里一目了然。" actions={<><Button icon={<SlidersHorizontal />} onClick={() => setRules(true)}>课时规则</Button><Button variant="primary" icon={<Plus />} onClick={() => setEditor({})}>新课程</Button></>} footer="课程价格是默认值；班级可以单独定价。已有课程不会因为切换页面而发生修改。">
    <div className="setup-list">
      {!courses.length && <Empty title="先创建你的第一门课" desc="设置名称和价格后，就可以添加学员或开班。" actions={<Button onClick={() => setEditor({})}>创建课程</Button>} />}
      {courses.map(course => <article className="setup-item" key={course.id} data-course-id={course.id}>
        <div className="setup-item-heading"><div className="setup-item-title"><span className="setup-item-icon"><BookOpen size={19} /></span><h3>{course.name}</h3></div><Button size="sm" aria-label={`编辑课程 ${course.name}`} onClick={() => setEditor({ course })}>编辑课程</Button></div>
        <dl className="setup-item-meta"><div><dt>每节费用</dt><dd>¥{course.price * course.unitsPerLesson}</dd></div><div><dt>每节时长</dt><dd>{(course.unitMinutes ?? unitMinutes) * course.unitsPerLesson} 分钟</dd></div><div><dt>每节扣除</dt><dd>{course.unitsPerLesson} 课时</dd></div><div><dt>在读学员</dt><dd>{students.filter(st => !st.archived && st.courseIds.includes(course.id)).length} 人</dd></div></dl>
        <p className="setup-item-note">¥{course.price} / 课时 · 1 课时 = {course.unitMinutes ?? unitMinutes} 分钟{course.unitMinutes == null ? "（沿用默认）" : "（单独设置）"}</p>
      </article>)}
    </div>
    {editor && <CourseEditor course={editor.course} unitMinutes={unitMinutes} onClose={() => setEditor(null)} onSave={value => onSave(editor.course?.id, value)} onDelete={editor.course ? () => { onDelete(editor.course!); setEditor(null); } : undefined} />}
    {rules && <CourseRules minutes={unitMinutes} onClose={() => setRules(false)} onSave={onRules} />}
  </SetupPanel>;
}

function CourseRules({ minutes, onClose, onSave }: { minutes: number; onClose: () => void; onSave: (minutes: number) => void }) {
  const [value, setValue] = useState(String(minutes));
  const [error, setError] = useState("");
  return <Sheet open onClose={onClose} title="默认课时规则" sub="没有单独设置时长的课程会沿用这里的值。">
    <Field label="1 课时多少分钟"><Input aria-label="默认课时分钟" autoFocus type="number" min={5} step={5} value={value} onChange={e => setValue(e.target.value)} /></Field>
    <p className="setup-form-note">它用于计算课表中的结束时间，不改变每节扣除的课时或单价。</p>
    {error && <div role="alert" className="banner-error">{error}</div>}
    <div className="sheet-actions"><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={() => { const n = Number(value); if (!Number.isFinite(n) || n < 5) { setError("请填写至少 5 分钟的有效时长。"); return; } onSave(n); onClose(); }}>保存规则</Button></div>
  </Sheet>;
}
