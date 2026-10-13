import { useState } from "react";
import type { Payment } from "@/core/types";
import { todayISO } from "@/core/date";
import { parsePaymentDraft } from "@/core/payment-form";
import { Button, Field, Input, Sheet } from "@/ui/primitives";

export function PaymentSheet({ studentId, name, price, onSubmit, onClose }: { studentId: string; name: string; price: number; onSubmit(p: Omit<Payment, "id">): void; onClose(): void }) {
  const [hours, setHours] = useState(""); const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO()); const [note, setNote] = useState("");
  const parsed = parsePaymentDraft({ hours, amount, date, note }, price);
  const suggested = (Number(hours) || 0) * price;
  return <Sheet open onClose={onClose} title={`${name} 缴费`}>
    <div className="grid-2"><Field label="课时数"><Input aria-label="缴费课时" autoFocus type="number" min={0} value={hours} placeholder="0" onChange={(e) => setHours(e.target.value)} /></Field><Field label="金额"><Input aria-label="缴费金额" type="number" min={0} value={amount} placeholder={String(suggested)} onChange={(e) => setAmount(e.target.value)} /></Field></div>
    {parsed.ok && parsed.value.hours === 0 && <p className="muted" style={{ margin: "-4px 0 10px", fontSize: 12.5 }}>不计课时，只记一笔收款（适合包月）。</p>}
    <Field label="日期"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="备注"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    <div className="sheet-actions"><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!parsed.ok} onClick={() => { if (parsed.ok) { onSubmit({ studentId, ...parsed.value }); onClose(); } }}>记入</Button></div>
  </Sheet>;
}
