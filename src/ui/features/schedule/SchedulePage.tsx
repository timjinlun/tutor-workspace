/** 课表：固定周课表。设一次，「今天」以后每天自动生成。月视图（考勤表）在下一版。 */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/store";
import { WEEKDAY_CN } from "@/core/date";
import { Avatar, Button, Empty, Field, Input, Select, Sheet } from "@/ui/primitives";
import "./schedule.css";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function SchedulePage() {
  const s = useStore((x) => x.s);
  const removeTemplate = useStore((x) => x.removeTemplate);
  const [open, setOpen] = useState(false);
  const [presetWd, setPresetWd] = useState(1);
  const todayWd = new Date().getDay();

  return (
    <div className="page">
      <div className="page-head">
        <h1>课表</h1>
        <div className="sub">固定周课表 · {s.templates.filter((t) => t.active).length} 节/周</div>
        <div className="actions">
          <Button variant="primary" icon={<Plus />} onClick={() => { setPresetWd(todayWd); setOpen(true); }}>加一节固定课</Button>
        </div>
      </div>
      {s.templates.length === 0 ? (
        <div className="card">
          <Empty title="还没有固定课表" desc="有固定上课时间的学员在这里设一次，之后「今天」会自动列出当天的课。没有固定时间的，直接在「今天」记就行。" actions={<Button variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>加一节固定课</Button>} />
        </div>
      ) : (
        <div className="week">
          {ORDER.map((wd) => {
            const items = s.templates.filter((t) => t.weekday === wd && t.active).sort((a, b) => a.time.localeCompare(b.time));
            return (
              <div key={wd} className={`day card ${wd === todayWd ? "today" : ""}`}>
                <div className="day-head">
                  <span>周{WEEKDAY_CN[wd]}</span>
                  {wd === todayWd && <span className="chip accent">今天</span>}
                  <button className="add" onClick={() => { setPresetWd(wd); setOpen(true); }} aria-label="添加"><Plus size={14} /></button>
                </div>
                {items.length === 0 && <div className="day-empty">—</div>}
                {items.map((t) => {
                  const st = s.students.find((x) => x.id === t.studentId);
                  const c = s.courses.find((x) => x.id === t.courseId);
                  return (
                    <div key={t.id} className="slot">
                      <div className="slot-top"><span className="slot-time num">{t.time}</span><button className="slot-del" onClick={() => removeTemplate(t.id)} aria-label="删除"><Trash2 size={13} /></button></div>
                      <div className="slot-body"><Avatar name={st?.name ?? "?"} size="sm" /><div className="grow"><div className="slot-name">{st?.name ?? "已删除"}</div><div className="slot-course">{c?.name}</div></div></div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      <TemplateSheet key={presetWd} open={open} onClose={() => setOpen(false)} weekday={presetWd} />
    </div>
  );
}

function TemplateSheet({ open, onClose, weekday }: { open: boolean; onClose: () => void; weekday: number }) {
  const s = useStore((x) => x.s);
  const addTemplate = useStore((x) => x.addTemplate);
  const students = s.students.filter((x) => !x.archived);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const student = students.find((x) => x.id === studentId) ?? students[0];
  const courses = s.courses.filter((c) => (student ? student.courseIds.includes(c.id) : true));
  const [courseId, setCourseId] = useState("");
  const effCourse = courses.some((c) => c.id === courseId) ? courseId : (courses[0]?.id ?? "");
  const [wd, setWd] = useState(weekday);
  const [time, setTime] = useState("18:00");
  const sid = student?.id ?? "";
  const submit = () => {
    if (!sid || !effCourse) return;
    addTemplate({ studentId: sid, courseId: effCourse, teacherId: s.teachers[0]?.id, weekday: wd, time });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="加一节固定课" sub="每周同一时间自动出现在「今天」。">
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
      <div className="grid-2">
        <Field label="每周">
          <Select value={wd} onChange={(e) => setWd(Number(e.target.value))}>
            {ORDER.map((d) => <option key={d} value={d}>周{WEEKDAY_CN[d]}</option>)}
          </Select>
        </Field>
        <Field label="时间"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <div className="sheet-actions">
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={submit} disabled={!sid || !effCourse}>加入课表</Button>
      </div>
    </Sheet>
  );
}
