import { useState } from "react";
import type { Teacher } from "@/core/types";
import type { CommandResult } from "@/core/command-result";
import { TEACHER_COLORS } from "@/core/teacher";
import { parseTeacherDraft } from "@/core/catalog-forms";
import { Button, Field, Input, Sheet } from "@/ui/primitives";
import "./teachers.css";

const COLOR_NAMES = ["珊瑚", "靛蓝", "绿色", "橙色", "紫色", "青色"];
export function TeacherEditor({ teacher, defaultColor, onClose, onSave, onDelete }: { teacher?: Teacher; defaultColor: string; onClose: () => void; onSave: (value: Omit<Teacher, "id" | "self">) => CommandResult; onDelete?: () => void }) {
  const [draft, setDraft] = useState({ name: teacher?.name ?? "", color: teacher?.color ?? defaultColor, pay: teacher?.payPerUnit == null ? "" : String(teacher.payPerUnit) });
  const [error, setError] = useState("");
  return <Sheet open onClose={onClose} title={teacher ? "编辑老师" : "添加合作老师"} sub={teacher?.self ? "你的称呼会同步到设置和家长沟通文案。" : "设置排课时使用的称呼、颜色与结算课时费。"}>
    {error && <div role="alert" className="banner-error">{error}</div>}
    <Field label="老师姓名"><Input aria-label="老师姓名" autoFocus value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
    <Field label="课表颜色"><div className="teacher-color-options" role="group" aria-label="课表颜色">{TEACHER_COLORS.map((color, index) => <button type="button" key={color} aria-label={COLOR_NAMES[index]} aria-pressed={draft.color === color} style={{ "--teacher-color": color } as React.CSSProperties} onClick={() => setDraft({ ...draft, color })}><span />{COLOR_NAMES[index]}</button>)}</div></Field>
    {!teacher?.self && <Field label="每课时支付给这位老师（元）"><Input aria-label="老师课时费" type="number" min={0} placeholder="留空：只统计课时，不结算" value={draft.pay} onChange={e => setDraft({ ...draft, pay: e.target.value })} /></Field>}
    <div className="setup-form-note">{teacher?.self ? "你自己的课不计算合作老师支出。" : "课时费不是向学员收取的单价。收支页会根据已上课时计算应付金额；修改费率也会影响历史月份的应付统计。"}</div>
    <div className="sheet-actions"><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={() => { const parsed = parseTeacherDraft(draft); if (!parsed.ok) { setError(parsed.reason); return; } const r = onSave(parsed.value); if (!r.ok) { setError(r.reason); return; } onClose(); }}>保存老师</Button></div>
    {onDelete && !teacher?.self && <div className="setup-danger"><Button variant="ghost" onClick={onDelete}>删除这位老师…</Button></div>}
  </Sheet>;
}
