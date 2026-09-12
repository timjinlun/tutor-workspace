/** 收支：本月四个数、近 6 个月对比、支出分类、明细录入、月度经营报告。 */
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Plus, Trash2, FileText } from "lucide-react";
import { useStore } from "@/store";
import { cashInMonth, expenseByCategory, expenseInMonth, EXPENSE_CATEGORIES, fmtMoney, incomeInMonth, INCOME_SOURCES, monthlySeries, doneUnitsInMonth } from "@/core/finance";
import { monthKey, todayISO } from "@/core/date";
import { Button, Chip, Field, Input, MonthPicker, Select, Sheet } from "@/ui/primitives";
import { MonthlyReportSheet } from "@/ui/widgets/ReportSheets";
import "./finance.css";


export function FinancePage() {
  const s = useStore((x) => x.s);
  const { addExpense, removeExpense, addOtherIncome, removeOtherIncome } = useStore(useShallow((x) => ({ addExpense: x.addExpense, removeExpense: x.removeExpense, addOtherIncome: x.addOtherIncome, removeOtherIncome: x.removeOtherIncome })));
  const today = todayISO();
  const [ym, setYm] = useState(monthKey(today));
  const [expOpen, setExpOpen] = useState(false);
  const [incOpen, setIncOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const income = incomeInMonth(s, ym);
  const cash = cashInMonth(s, ym);
  const exp = expenseInMonth(s, ym);
  const series = useMemo(() => monthlySeries(s, `${ym}-01`, 6), [s, ym]);
  const cats = useMemo(() => expenseByCategory(s, ym), [s, ym]);
  const expenses = useMemo(() => s.expenses.filter((e) => monthKey(e.date) === ym).sort((a, b) => b.date.localeCompare(a.date)), [s.expenses, ym]);
  const incomes = useMemo(() => s.otherIncomes.filter((e) => monthKey(e.date) === ym).sort((a, b) => b.date.localeCompare(a.date)), [s.otherIncomes, ym]);
  const cards = [
    { l: "确认收入", v: income, hint: `${doneUnitsInMonth(s, ym)} 课时 × 单价` },
    { l: "到账", v: cash, hint: "缴费 + 其他收入" },
    { l: "支出", v: exp, hint: `${expenses.length} 笔` },
    { l: "净收入", v: cash - exp, hint: "到账 − 支出" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <h1>收支</h1>
        <MonthPicker value={ym} onChange={setYm} max={monthKey(today)} />
        <div className="actions">
          <Button icon={<FileText />} onClick={() => setReportOpen(true)}>经营月报</Button>
          <Button variant="primary" icon={<Plus />} onClick={() => setExpOpen(true)}>记支出</Button>
        </div>
      </div>

      <div className="grid-4 fin-cards">
        {cards.map((c) => (
          <div className="card fin-card" key={c.l}>
            <div className="lbl">{c.l}</div>
            <div className={`val num ${c.v < 0 ? "neg" : ""}`}>{fmtMoney(c.v)}</div>
            <div className="hint">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">近 6 个月 <span className="right legend"><i className="sw accent" /> 到账 <i className="sw gray" /> 支出</span></div>
          <BarChart data={series} />
        </div>
        <div className="card">
          <div className="section-title">支出分类</div>
          {cats.length === 0 ? (
            <div className="muted" style={{ padding: "8px 0" }}>本月还没有支出。</div>
          ) : (
            cats.map((c) => (
              <div className="cat-row" key={c.category}>
                <div className="cat-head"><span>{c.category}</span><span className="num">{fmtMoney(c.amount)} <span className="muted">{Math.round(c.share * 100)}%</span></span></div>
                <div className="cat-bar"><i style={{ width: `${Math.max(2, c.share * 100)}%` }} /></div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title">支出明细 <button className="right link" onClick={() => setExpOpen(true)}>+ 记一笔</button></div>
          {expenses.length === 0 ? (
            <div className="muted" style={{ padding: "8px 0" }}>还没有。</div>
          ) : (
            expenses.map((e) => (
              <div className="row" key={e.id}>
                <div className="grow">
                  <div className="title" style={{ fontWeight: 500 }}>{e.category}{e.note && <span className="muted"> · {e.note}</span>}</div>
                  <div className="meta num">{e.date}</div>
                </div>
                <span className="num amt neg">−{fmtMoney(e.amount).slice(1)}</span>
                <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => removeExpense(e.id)} title="删除" />
              </div>
            ))
          )}
        </div>
        <div className="card">
          <div className="section-title">其他收入 <button className="right link" onClick={() => setIncOpen(true)}>+ 记一笔</button></div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>学员缴费不用在这记，缴费记录自动算进到账。</div>
          {incomes.length === 0 ? (
            <div className="muted" style={{ padding: "8px 0" }}>还没有。</div>
          ) : (
            incomes.map((e) => (
              <div className="row" key={e.id}>
                <div className="grow">
                  <div className="title" style={{ fontWeight: 500 }}>{e.source}{e.note && <span className="muted"> · {e.note}</span>}</div>
                  <div className="meta num">{e.date}</div>
                </div>
                <span className="num amt pos">+{fmtMoney(e.amount)}</span>
                <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => removeOtherIncome(e.id)} title="删除" />
              </div>
            ))
          )}
        </div>
      </div>

      <EntrySheet open={expOpen} onClose={() => setExpOpen(false)} title="记一笔支出" options={EXPENSE_CATEGORIES} optionLabel="分类" onSubmit={(v) => addExpense({ date: v.date, category: v.kind, amount: v.amount, note: v.note })} />
      <EntrySheet open={incOpen} onClose={() => setIncOpen(false)} title="记一笔其他收入" options={INCOME_SOURCES} optionLabel="来源" onSubmit={(v) => addOtherIncome({ date: v.date, source: v.kind, amount: v.amount, note: v.note })} />
      <MonthlyReportSheet open={reportOpen} onClose={() => setReportOpen(false)} ym={ym} />
    </div>
  );
}

function BarChart({ data }: { data: { label: string; cash: number; expense: number }[] }) {
  const W = 460, H = 180, pl = 8, pb = 24, pt = 10;
  const max = Math.max(1, ...data.map((d) => Math.max(d.cash, d.expense)));
  const gw = (W - pl * 2) / data.length;
  const bw = Math.min(18, gw / 3);
  const ch = H - pt - pb;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="barchart">
      {[0.5, 1].map((f) => <line key={f} x1={pl} x2={W - pl} y1={pt + ch - ch * f} y2={pt + ch - ch * f} className="grid" />)}
      <line x1={pl} x2={W - pl} y1={pt + ch} y2={pt + ch} className="base" />
      {data.map((d, i) => {
        const cx = pl + gw * i + gw / 2;
        const h1 = (d.cash / max) * ch, h2 = (d.expense / max) * ch;
        return (
          <g key={d.label}>
            <rect x={cx - bw - 2} y={pt + ch - h1} width={bw} height={h1} rx={4} className="bar accent" />
            <rect x={cx + 2} y={pt + ch - h2} width={bw} height={h2} rx={4} className="bar gray" />
            <text x={cx} y={H - 6} textAnchor="middle" className="lab">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function EntrySheet({ open, onClose, title, options, optionLabel, onSubmit }: { open: boolean; onClose: () => void; title: string; options: readonly string[]; optionLabel: string; onSubmit: (v: { date: string; kind: string; amount: number; note: string }) => void }) {
  const [date, setDate] = useState(todayISO());
  const [kind, setKind] = useState<string>(options[0] ?? "其他");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const a = parseFloat(amount);
  const submit = () => {
    if (!(a > 0)) return;
    onSubmit({ date, kind, amount: a, note });
    setAmount(""); setNote("");
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid-2">
        <Field label="金额"><Input autoFocus type="number" min={0} value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label={optionLabel}><Select value={kind} onChange={(e) => setKind(e.target.value)}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
      </div>
      <div className="grid-2">
        <Field label="日期"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="备注"><Input value={note} placeholder="可选" onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <div className="sheet-actions">
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={submit} disabled={!(a > 0)}>记入</Button>
      </div>
    </Sheet>
  );
}

export function FinanceHint() {
  return <Chip>免费版</Chip>;
}
