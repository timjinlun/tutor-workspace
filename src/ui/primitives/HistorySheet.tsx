import { useState, type ReactNode } from "react";
import { Button, Select, Sheet } from "./index";
import "./history-sheet.css";

/** 只负责有限展示与月份分页，不知道学习、课时或缴费实体。 */
export function HistorySheet<T extends { id: string; date: string }>({ title, items, onClose, render }: {
  title: string; items: T[]; onClose(): void; render(item: T): ReactNode;
}) {
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(0);
  const months = [...new Set(items.map((item) => item.date.slice(0, 7)))].sort().reverse();
  const filtered = items.filter((item) => !month || item.date.startsWith(month));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const current = Math.min(page, pages - 1);
  return <Sheet open onClose={onClose} title={title} className="history-sheet" wide>
    <div className="history-toolbar"><label>月份<Select aria-label="筛选月份" value={month} onChange={(e) => { setMonth(e.target.value); setPage(0); }}><option value="">全部月份</option>{months.map((m) => <option key={m}>{m}</option>)}</Select></label><span className="muted">共 {filtered.length} 条</span></div>
    <div className="history-scroll">{filtered.slice(current * 12, (current + 1) * 12).map((item) => <div key={item.id}>{render(item)}</div>)}{!filtered.length && <p className="muted">这个月份没有记录。</p>}</div>
    <div className="history-toolbar"><Button disabled={!current} onClick={() => setPage(current - 1)}>上一页</Button><span>{current + 1} / {pages}</span><Button disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>下一页</Button></div>
    <div className="sheet-actions"><Button onClick={onClose}>关闭</Button></div>
  </Sheet>;
}
