import { useState } from "react";
import type { Course, Student, Payment } from "@/core/types";
import { todayISO } from "@/core/date";
import { parsePaymentDraft } from "@/core/payment-form";
import { Button, Field, Input, Select, Sheet } from "@/ui/primitives";

export function AddStudentSheet({ courses, onAdd, onPayment, onClose }: {
  courses: Course[]; onAdd(input: Pick<Student, "name" | "courseIds" | "note">): Student;
  onPayment(input: Omit<Payment, "id">): void; onClose(): void;
}) {
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [hours, setHours] = useState(""); const [amount, setAmount] = useState("");
  const course = courses.find((c) => c.id === courseId);
  const suggested = (Number(hours) || 0) * (course?.price ?? 0);
  /* 课时、金额都没填就不记缴费；只填金额也算一笔（包月） */
  const wantsPayment = !!hours.trim() || !!amount.trim();
  const payment = parsePaymentDraft({ hours, amount, date: todayISO(), note: "首次" }, course?.price ?? 0);
  const valid = !!name.trim() && (!wantsPayment || payment.ok);
  const submit = () => {
    if (!valid) return;
    const st = onAdd({ name: name.trim(), courseIds: course ? [course.id] : [], note: "" });
    if (wantsPayment && payment.ok) onPayment({ studentId: st.id, ...payment.value });
    onClose();
  };
  return <Sheet open onClose={onClose} title="添加学员" sub="先添加姓名与课程，更多资料可以随时补充。">
    <Field label="姓名"><Input autoFocus aria-label="学员姓名" value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <Field label="课程"><Select value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">暂不选择</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
    <div className="grid-2"><Field label="购买课时（可选）"><Input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} /></Field><Field label="金额"><Input type="number" min={0} value={amount} placeholder={String(suggested)} onChange={(e) => setAmount(e.target.value)} /></Field></div>
    <div className="sheet-actions"><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!valid} onClick={submit}>添加</Button></div>
  </Sheet>;
}
