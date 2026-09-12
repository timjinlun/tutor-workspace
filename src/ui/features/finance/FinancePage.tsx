/** 收支：这一版先把本月的数摆对。图表、支出录入下一版。 */
import { useStore } from "@/store";
import { cashInMonth, expenseInMonth, fmtMoney, incomeInMonth, doneUnitsInMonth } from "@/core/finance";
import { monthKey, todayISO } from "@/core/date";
import { Chip } from "@/ui/primitives";

export function FinancePage() {
  const s = useStore((x) => x.s);
  const ym = monthKey(todayISO());
  const income = incomeInMonth(s, ym);
  const cash = cashInMonth(s, ym);
  const exp = expenseInMonth(s, ym);
  const cards = [
    { l: "本月确认收入", v: income, hint: `${doneUnitsInMonth(s, ym)} 课时 × 单价` },
    { l: "本月到账", v: cash, hint: "缴费 + 其他收入" },
    { l: "本月支出", v: exp, hint: "" },
    { l: "本月净收入", v: cash - exp, hint: "到账 − 支出" },
  ];
  return (
    <div className="page">
      <div className="page-head">
        <h1>收支</h1>
        <div className="sub">{ym.replace("-", " 年 ")} 月</div>
      </div>
      <div className="grid-2">
        {cards.map((c) => (
          <div className="card" key={c.l}>
            <div className="section-title">{c.l}</div>
            <div className="num" style={{ fontSize: 32, fontWeight: 700, color: c.v < 0 ? "var(--red)" : "var(--label)" }}>{fmtMoney(c.v)}</div>
            {c.hint && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{c.hint}</div>}
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">下一版 <Chip>开发中</Chip></div>
        <div className="muted">近 6 个月收支对比、支出分类、记支出与其他收入。数据模型已就位，界面还没画。</div>
      </div>
    </div>
  );
}
