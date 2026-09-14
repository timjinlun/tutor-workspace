import { useState } from "react";
import type { LearningRecord, LearningRecordInput } from "@/core/learning-records/types";
import type { CommandResult } from "@/core/command-result";
import { todayISO } from "@/core/date";
import { Button, Field, Input, Select, Sheet } from "@/ui/primitives";
import "./learning-records.css";

export function LearningRecordEditor({ studentId, record, lessonId, lessons, onSave, onDelete, onClose }: {
  studentId: string; record?: LearningRecord; lessonId?: string; lessons: { id: string; date: string; label: string }[];
  onSave(input: LearningRecordInput, id?: string): CommandResult; onDelete(id: string): void; onClose(): void;
}) {
  const [date, setDate] = useState(record?.date ?? lessons.find((l) => l.id === lessonId)?.date ?? todayISO());
  const [text, setText] = useState(record?.text ?? "");
  const [linked, setLinked] = useState(record?.lessonId ?? lessonId ?? "");
  const [parent, setParent] = useState(record?.visibility === "parent");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const submit = () => {
    const result = onSave({ studentId, date, text, lessonId: linked || undefined, visibility: parent ? "parent" : "internal" }, record?.id);
    if (result.ok) onClose(); else setError(result.reason);
  };
  return <Sheet open onClose={onClose} title={record ? "学习记录" : "写学习记录"} sub="记录具体观察，一段话也可以。" wide>
    <div className="grid-2"><Field label="记录日期"><Input aria-label="记录日期" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="关联课程（可选）"><Select aria-label="关联课程" value={linked} onChange={(e) => setLinked(e.target.value)}><option value="">不关联课程</option>{linked && !lessons.some((l) => l.id === linked) && <option value={linked}>原课程已撤销，请重新选择</option>}{lessons.map((l) => <option value={l.id} key={l.id}>{l.label}</option>)}</Select></Field></div>
    <Field label="本次观察"><textarea autoFocus className="input learning-editor" aria-label="本次观察" value={text} maxLength={4000} placeholder="今天哪里有进步？什么地方仍需提示？下次准备怎么教？" onChange={(e) => setText(e.target.value)} /></Field>
    <label className="learning-visibility"><input type="checkbox" checked={parent} onChange={(e) => setParent(e.target.checked)} />可用于家长反馈</label>
    <p className="muted">默认仅自己可见。勾选后可纳入家长报告，不会自动发送。</p>
    {error && <p role="alert">{error}</p>}
    {confirmDelete && <p role="alert">删除后不能恢复。<Button variant="danger" onClick={() => { if (record) onDelete(record.id); onClose(); }}>确认删除</Button><Button onClick={() => setConfirmDelete(false)}>保留</Button></p>}
    <div className="sheet-actions">{record && <Button variant="ghost" onClick={() => setConfirmDelete(true)}>删除记录</Button>}<Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!text.trim() || !date} onClick={submit}>保存记录</Button></div>
  </Sheet>;
}
