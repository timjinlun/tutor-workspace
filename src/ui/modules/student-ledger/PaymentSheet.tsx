import { useState } from "react";
import type { Payment } from "@/core/types";
import { todayISO, validISODate } from "@/core/date";
import { Button, Field, Input, Sheet } from "@/ui/primitives";

export function PaymentSheet({ studentId, name, price, onSubmit, onClose }: { studentId: string; name: string; price: number; onSubmit(p: Omit<Payment, "id">): void; onClose(): void }) {
  const [hours, setHours] = useState(""); const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO()); const [note, setNote] = useState("");
  const h = Number(hours); const a = amount ? Number(amount) : h * price;
  const valid = Number.isFinite(h) && h > 0 && Number.isFinite(a) && a >= 0 && validISODate(date);
  return <Sheet open onClose={onClose} title={`${name} 缴费`}>
    <div className="grid-2"><Field label="课时数"><Input aria-label="缴费课时" autoFocus type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} /></Field><Field label="金额"><Input aria-label="缴费金额" type="number" min={0} value={amount} placeholder={String(h * price || 0)} onChange={(e) => setAmount(e.target.value)} /></Field></div>
    <Field label="日期"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="备注"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    <div className="sheet-actions"><Button onClick={onClose}>取消</Button><Button variant="primary" disabled={!valid} onClick={() => { if (valid) { onSubmit({ studentId, date, hours: h, amount: a, note }); onClose(); } }}>记入</Button></div>
  </Sheet>;
}
