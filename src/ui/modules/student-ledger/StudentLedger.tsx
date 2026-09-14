import { useState } from "react";
import type { Lesson, Payment } from "@/core/types";
import { fmtMoney } from "@/core/finance";
import { Button } from "@/ui/primitives";
import { HistorySheet } from "@/ui/primitives/HistorySheet";
import "./ledger.css";

export function StudentLedger({ lessons, payments, purchased, used, remaining, paid, income, label, hasRecord, onFeedback, onUndo, onPay, onRemovePayment }: {
  lessons: Lesson[]; payments: Payment[]; purchased: number; used: number; remaining: number; paid: number; income: number;
  label(lesson: Lesson): string; hasRecord(id: string): boolean; onFeedback(lesson: Lesson): void; onUndo(lesson: Lesson): void; onPay(): void; onRemovePayment(payment: Payment): void;
}) {
  const [history, setHistory] = useState<"lessons" | "payments" | null>(null);
  const lessonRow = (lesson: Lesson) => <div className="ledger-row" data-lesson-id={lesson.id}>
    <div className="ledger-description"><b>{lesson.date} <span className="muted">{lesson.time}</span></b><p>{label(lesson)} · {lesson.units} 课时 · {fmtMoney(lesson.units * lesson.price)}{lesson.attendance === "absent" && " · 缺席照扣"}{lesson.source === "backfill" && " · 补记"}</p></div>
    <Button size="sm" variant="ghost" onClick={() => onFeedback(lesson)}>{hasRecord(lesson.id) ? "查看评语" : "补写评语"}</Button>
    <details className="ledger-more"><summary aria-label="课程操作">⋯</summary><Button size="sm" variant="ghost" onClick={() => onUndo(lesson)}>撤销打卡</Button></details>
  </div>;
  const paymentRow = (payment: Payment) => <div className="ledger-row"><div className="ledger-description"><b>{payment.date}</b><p>{payment.hours} 课时{payment.note && ` · ${payment.note}`}</p></div><strong>{fmtMoney(payment.amount)}</strong><Button variant="ghost" size="sm" onClick={() => onRemovePayment(payment)}>删除</Button></div>;
  return <div className="student-ledger">
    <div className="card ledger-totals"><span>已购 <b>{purchased}</b></span><span>已用 <b>{used}</b></span><span>剩余 <b>{remaining}</b> 课时</span><small>累计缴费 {fmtMoney(paid)} · 确认收入 {fmtMoney(income)}</small></div>
    <section className="card"><div className="section-title">最近上课记录 <span className="right">{lessons.length} 次</span></div>{lessons.slice(0, 3).map((l) => <div key={l.id}>{lessonRow(l)}</div>)}{!lessons.length && <p className="muted">还没有打卡记录。</p>}{!!lessons.length && <Button variant="ghost" onClick={() => setHistory("lessons")}>查看全部上课记录（{lessons.length}）</Button>}</section>
    <section className="card"><div className="section-title">最近缴费记录 <span className="right"><Button size="sm" onClick={onPay}>＋ 缴费</Button></span></div>{payments.slice(0, 2).map((p) => <div key={p.id}>{paymentRow(p)}</div>)}{!payments.length && <p className="muted">还没有缴费记录。</p>}{!!payments.length && <Button variant="ghost" onClick={() => setHistory("payments")}>查看全部缴费记录（{payments.length}）</Button>}</section>
    {history === "lessons" && <HistorySheet title="全部上课记录" items={lessons} render={lessonRow} onClose={() => setHistory(null)} />}
    {history === "payments" && <HistorySheet title="全部缴费记录" items={payments} render={paymentRow} onClose={() => setHistory(null)} />}
  </div>;
}
