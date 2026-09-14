import { useState } from "react";
import type { Course, Student, Payment } from "@/core/types";
import { todayISO } from "@/core/date";
import { Button, Field, Input, Select, Sheet } from "@/ui/primitives";

export function AddStudentSheet({ courses, onAdd, onPayment, onClose }: {
  courses: Course[]; onAdd(input: Pick<Student, "name" | "courseIds" | "note">): Student;
  onPayment(input: Omit<Payment, "id">): void; onClose(): void;
}) {
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [hours, setHours] = useState(""); const [amount, setAmount] = useState("");
  const course = courses.find((c) => c.id === courseId);
  const h = Number(hours); const suggested = h * (course?.price ?? 0);
  const valid = !!name.trim() && (!hours || (Number.isFinite(h) && h > 0)) && (!amount || (Number.isFinite(Number(amount)) && Number(amount) >= 0));
  const submit = () => {
    if (!valid) return;
    const st = onAdd({ name: name.trim(), courseIds: course ? [course.id] : [], note: "" });
    if (hours) onPayment({ studentId: st.id, date: todayISO(), hours: h, amount: amount ? Number(amount) : suggested, note: "首次" });
    onClose();
  };
  return <Sheet open onClose={onClose} title="添加学员" sub="先添加姓名与课程，更多资料可以随时补充。">
    <Field label="姓名"><Input autoFocus aria-label="学员姓名" value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <Field label="课程"><Select value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">暂不选择</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
    <div className="grid-2"><Field label="购买课时（可选）"><Input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} /></Field><Field label="金额"><Input type="number" min={0} value={amount} placeholder={String(suggested || 0)} onChange={(e) => setAmount(e.target.value)} /></Field></div>
    <div className="sheet-actions"><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!valid} onClick={submit}>添加</Button></div>
  </Sheet>;
}
