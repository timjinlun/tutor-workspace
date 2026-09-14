import { useState } from "react";
import type { State } from "@/core/types";
import { parentReport } from "@/core/report";
import { monthKey, todayISO, validISODate } from "@/core/date";
import { Button, Field, Input, MonthPicker, Sheet } from "@/ui/primitives";

export function ParentReport({ state, studentId, customRangeAllowed, copyText, onClose }: {
  state: State; studentId: string; customRangeAllowed: boolean; copyText(text: string): Promise<boolean>; onClose(): void;
}) {
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [custom, setCustom] = useState(false);
  const [start, setStart] = useState(`${monthKey(todayISO())}-01`); const [end, setEnd] = useState(todayISO());
  const valid = !custom || (validISODate(start) && validISODate(end) && start <= end);
  const generated = valid ? parentReport(state, { studentId, ym: month, teacherName: state.settings.teacherName, ...(custom ? { start, end } : {}) }) : "";
  return <Sheet open onClose={onClose} title="家长报告" sub="只纳入已勾选“可用于家长反馈”的学习记录。请核对、编辑后复制。" wide>
    {customRangeAllowed && <label><input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />自选日期范围</label>}
    {custom ? <div className="grid-2"><Field label="开始日期"><Input aria-label="报告开始日期" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label="结束日期"><Input aria-label="报告结束日期" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field></div> : <Field label="月份"><MonthPicker value={month} onChange={setMonth} max={monthKey(todayISO())} /></Field>}
    <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>切换时间范围会重新生成草稿。没有记录的变化不会自动编写。</p>
    {!valid ? <p role="alert">请选择有效日期，结束日期不能早于开始日期。</p> : <ReportDraft key={`${month}:${custom}:${start}:${end}`} generated={generated} copyText={copyText} onClose={onClose} />}
  </Sheet>;
}
function ReportDraft({ generated, copyText, onClose }: { generated: string; copyText(text: string): Promise<boolean>; onClose(): void }) {
  const [draft, setDraft] = useState(generated); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const copy = async () => { setBusy(true); try { setStatus(await copyText(draft) ? "已复制，请粘贴给家长" : "复制失败，请选中文字手动复制"); } catch { setStatus("复制失败，请选中文字手动复制"); } finally { setBusy(false); } };
  return <><textarea className="input select-text" aria-label="家长报告草稿" style={{ minHeight: 320, maxHeight: "48vh" }} value={draft} onChange={(e) => { setDraft(e.target.value); setStatus(""); }} /><p role="status">{status}</p><div className="sheet-actions"><Button onClick={onClose}>关闭</Button><Button variant="primary" disabled={busy || !draft.trim()} onClick={() => void copy()}>复制报告</Button></div></>;
}
