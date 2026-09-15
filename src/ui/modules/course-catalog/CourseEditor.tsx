import { useState } from "react";
import type { Course } from "@/core/types";
import type { CommandResult } from "@/core/command-result";
import { parseCourseDraft } from "@/core/catalog-forms";
import { Button, Field, Input, Sheet } from "@/ui/primitives";

export function CourseEditor({ course, unitMinutes, onSave, onClose, onDelete }: { course?: Course; unitMinutes: number; onSave: (value: Omit<Course, "id">) => CommandResult; onClose: () => void; onDelete?: () => void }) {
  const [draft, setDraft] = useState({ name: course?.name ?? "", price: course ? String(course.price) : "", units: String(course?.unitsPerLesson ?? 1), minutes: course?.unitMinutes == null ? "" : String(course.unitMinutes) });
  const [error, setError] = useState("");
  const parsed = parseCourseDraft(draft);
  const save = () => {
    if (!parsed.ok) { setError(parsed.reason); return; }
    const result = onSave(parsed.value);
    if (!result.ok) { setError(result.reason); return; }
    onClose();
  };
  return <Sheet open onClose={onClose} title={course ? "编辑课程" : "新课程"} sub="设置以后排课使用的单价与课时规则。">
    {error && <div className="banner-error" role="alert">{error}</div>}
    <Field label="课程名称"><Input aria-label="课程名称" autoFocus value={draft.name} placeholder="例如：初中数学" onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
    <div className="grid-2">
      <Field label="单价 / 课时（元）"><Input aria-label="课程单价" type="number" min={0} value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} /></Field>
      <Field label="每节扣几课时"><Input aria-label="每节课时" type="number" min={0.5} step={0.5} value={draft.units} onChange={e => setDraft({ ...draft, units: e.target.value })} /></Field>
    </div>
    <Field label={`1 课时多少分钟（留空沿用默认 ${unitMinutes} 分钟）`}><Input aria-label="课程课时分钟" type="number" min={5} step={5} placeholder={String(unitMinutes)} value={draft.minutes} onChange={e => setDraft({ ...draft, minutes: e.target.value })} /></Field>
    <div className="setup-form-note">{parsed.ok ? <>每节课 <b>¥{parsed.value.price * parsed.value.unitsPerLesson}</b> · <b>{(parsed.value.unitMinutes ?? unitMinutes) * parsed.value.unitsPerLesson} 分钟</b><br /></> : null}调整不会改动已打卡记录中的课时和单价。</div>
    <div className="sheet-actions"><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={save}>保存课程</Button></div>
    {onDelete && <div className="setup-danger"><Button variant="ghost" onClick={onDelete}>删除这门课程…</Button></div>}
  </Sheet>;
}
