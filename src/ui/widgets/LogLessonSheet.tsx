/** 「记一节课」：选学员 → 课程和单价自动带出 → 盖章。三秒完成。 */
import { useMemo, useState } from "react";
import { Button, Field, Input, Select, Sheet } from "@/ui/primitives";
import { useStore } from "@/store";
import { balance } from "@/core/finance";
import { nowHHMM, todayISO } from "@/core/date";

export function LogLessonSheet({ open, onClose, presetStudentId, presetDate }: { open: boolean; onClose: () => void; presetStudentId?: string; presetDate?: string }) {
  const s = useStore((x) => x.s);
  const log = useStore((x) => x.log);
  const students = useMemo(() => s.students.filter((x) => !x.archived), [s.students]);
  const [studentId, setStudentId] = useState(presetStudentId ?? students[0]?.id ?? "");
  const student = students.find((x) => x.id === studentId);
  const courseOptions = useMemo(() => s.courses.filter((c) => (student ? student.courseIds.includes(c.id) : true)), [s.courses, student]);
  const [courseId, setCourseId] = useState(courseOptions[0]?.id ?? "");
  const effectiveCourse = courseOptions.some((c) => c.id === courseId) ? courseId : (courseOptions[0]?.id ?? "");
  const [date, setDate] = useState(presetDate ?? todayISO());
  const [time, setTime] = useState(nowHHMM());
  const [units, setUnits] = useState("");
  const course = s.courses.find((c) => c.id === effectiveCourse);
  const teacherId = s.teachers[0]?.id;

  const submit = () => {
    if (!studentId || !effectiveCourse) return;
    const u = parseFloat(units);
    log({ studentId, courseId: effectiveCourse, teacherId, date, time, units: Number.isFinite(u) && u > 0 ? u : undefined });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="记一节课" sub="上完了直接记，不用先排课。">
      <Field label="学员">
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {students.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name} · 剩 {balance(s, st.id)} 课时
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid-2">
        <Field label="课程">
          <Select value={effectiveCourse} onChange={(e) => setCourseId(e.target.value)}>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · ¥{c.price}/课时
              </option>
            ))}
          </Select>
        </Field>
        <Field label="消耗课时">
          <Input type="number" min={0.5} step={0.5} placeholder={String(course?.unitsPerLesson ?? 1)} value={units} onChange={(e) => setUnits(e.target.value)} />
        </Field>
      </div>
      <div className="grid-2">
        <Field label="日期">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="时间">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <div className="sheet-actions">
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={submit} disabled={!studentId || !effectiveCourse}>
          记为已上
        </Button>
      </div>
    </Sheet>
  );
}
