/**
 * 固定课表的管理抽屉：按星期分组列出来，可暂停 / 恢复 / 删除，底部直接加。
 * 它只是"每周的规则"，真正的课在周视图和月历里看。
 */
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Plus, Trash2, Pause, Play } from "lucide-react";
import { useStore } from "@/store";
import { WEEK_ORDER } from "@/core/calendar";
import { WEEKDAY_CN } from "@/core/date";
import { Avatar, Button, Field, Input, Select, Sheet } from "@/ui/primitives";

export function TemplatesDrawer({ open, onClose, presetWeekday }: { open: boolean; onClose: () => void; presetWeekday?: number }) {
  const s = useStore((x) => x.s);
  const { addTemplate, updateTemplate, removeTemplate } = useStore(useShallow((x) => ({ addTemplate: x.addTemplate, updateTemplate: x.updateTemplate, removeTemplate: x.removeTemplate })));
  const students = s.students.filter((x) => !x.archived);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const student = students.find((x) => x.id === studentId) ?? students[0];
  const courses = s.courses.filter((c) => (student ? student.courseIds.includes(c.id) : true));
  const [courseId, setCourseId] = useState("");
  const effCourse = courses.some((c) => c.id === courseId) ? courseId : (courses[0]?.id ?? "");
  const [wd, setWd] = useState(presetWeekday ?? 1);
  const [time, setTime] = useState("18:00");
  const sid = student?.id ?? "";
  const active = s.templates.filter((t) => t.active).length;

  const submit = () => {
    if (!sid || !effCourse) return;
    addTemplate({ studentId: sid, courseId: effCourse, teacherId: s.teachers[0]?.id, weekday: wd, time });
  };

  return (
    <Sheet open={open} onClose={onClose} wide title="固定课表" sub={`每周 ${active} 节。设一次，之后每周自动出现在课表和「今天」。`}>
      <div className="tpl-list">
        {WEEK_ORDER.map((d) => {
          const items = s.templates.filter((t) => t.weekday === d).sort((a, b) => a.time.localeCompare(b.time));
          if (items.length === 0) return null;
          return (
            <div key={d} className="tpl-group">
              <div className="tpl-day">周{WEEKDAY_CN[d]}</div>
              {items.map((t) => {
                const st = s.students.find((x) => x.id === t.studentId);
                const c = s.courses.find((x) => x.id === t.courseId);
                return (
                  <div key={t.id} className={`row tpl-row ${t.active ? "" : "paused"}`}>
                    <span className="num tpl-time">{t.time}</span>
                    <Avatar name={st?.name ?? "?"} size="sm" />
                    <div className="grow"><div className="title">{st?.name ?? "已删除"}</div><div className="meta">{c?.name}{!t.active && " · 已暂停"}</div></div>
                    <Button variant="ghost" size="sm" icon={t.active ? <Pause /> : <Play />} title={t.active ? "暂停（比如放假）" : "恢复"} onClick={() => updateTemplate(t.id, { active: !t.active })} />
                    <Button variant="ghost" size="sm" icon={<Trash2 />} title="删除" onClick={() => removeTemplate(t.id)} />
                  </div>
                );
              })}
            </div>
          );
        })}
        {s.templates.length === 0 && <div className="muted" style={{ padding: "8px 0 14px" }}>还没有固定课。有固定上课时间的学员在下面加一条就行。</div>}
      </div>
      <div className="tpl-add">
        <div className="section-title">加一节固定课</div>
        <div className="grid-2">
          <Field label="学员">
            <Select value={sid} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </Select>
          </Field>
          <Field label="课程">
            <Select value={effCourse} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid-2">
          <Field label="每周">
            <Select value={wd} onChange={(e) => setWd(Number(e.target.value))}>
              {WEEK_ORDER.map((d) => <option key={d} value={d}>周{WEEKDAY_CN[d]}</option>)}
            </Select>
          </Field>
          <Field label="时间"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <div className="sheet-actions">
          <Button onClick={onClose}>完成</Button>
          <Button variant="primary" icon={<Plus />} onClick={submit} disabled={!sid || !effCourse}>加入固定课表</Button>
        </div>
      </div>
    </Sheet>
  );
}
