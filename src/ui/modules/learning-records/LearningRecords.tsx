import { useState } from "react";
import type { LearningRecord } from "@/core/learning-records/types";
import { Button } from "@/ui/primitives";
import { HistorySheet } from "@/ui/primitives/HistorySheet";
import "./learning-records.css";

export function LearningRecords({ records, onAdd, onEdit, lessonLabel }: { records: LearningRecord[]; onAdd(): void; onEdit(record: LearningRecord): void; lessonLabel(id: string): string }) {
  const [history, setHistory] = useState(false);
  const row = (record: LearningRecord, compact = false) => <article className="learning-row">
    <div className="learning-meta"><time>{record.date}</time><span>{record.visibility === "parent" ? "可用于家长反馈" : "仅自己可见"}</span><Button variant="ghost" size="sm" onClick={() => onEdit(record)}>编辑</Button></div>
    {record.lessonId && <div className="learning-lesson">{lessonLabel(record.lessonId)}</div>}
    <p className={compact ? "learning-excerpt" : "learning-text"}>{record.text}</p>
    {compact && record.text.length > 100 && <Button size="sm" variant="ghost" onClick={() => onEdit(record)}>展开查看</Button>}
  </article>;
  return <section className="learning-records card">
    <div className="section-title">最近学习记录 <span className="right"><Button size="sm" onClick={onAdd}>＋ 写记录</Button></span></div>
    {!records.length ? <div className="learning-empty"><h3>多了解一点，就记下一点。</h3><p>可以写进步、仍有困难的地方，或下次想尝试的方法。写一段话就够了。</p><Button onClick={onAdd}>写下第一条观察</Button></div> : records.slice(0, 3).map((r) => <div key={r.id}>{row(r, true)}</div>)}
    {!!records.length && <Button variant="ghost" onClick={() => setHistory(true)}>查看全部学习记录（{records.length}）</Button>}
    {history && <HistorySheet title="全部学习记录" items={records} onClose={() => setHistory(false)} render={(r) => row(r)} />}
  </section>;
}
