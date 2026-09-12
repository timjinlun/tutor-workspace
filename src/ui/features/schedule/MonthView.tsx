/** 月视图：一个月的考勤一览。点空格补记，点已上的撤销（二次确认）。 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useStore } from "@/store";
import { lessonsOn, type DayItem } from "@/core/lesson";
import { fmtMoney } from "@/core/finance";
import { WEEKDAY_CN, monthKey, todayISO, weekdayOf } from "@/core/date";
import type { Lesson } from "@/core/types";
import { Avatar } from "@/ui/primitives";
import { LogLessonSheet } from "@/ui/widgets/LogLessonSheet";
import { UndoLessonSheet } from "@/ui/widgets/UndoLessonSheet";

const shiftMonth = (ym: string, d: number) => {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y ?? 2026, (m ?? 1) - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

export function MonthView() {
  const s = useStore((x) => x.s);
  const today = todayISO();
  const [ym, setYm] = useState(monthKey(today));
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y ?? 2026, m ?? 1, 0).getDate();
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`), [ym, days]);
  const byDate = useMemo(() => new Map(dates.map((d) => [d, lessonsOn(s, d)])), [s, dates]);
  const students = s.students.filter((x) => !x.archived);
  const [log, setLog] = useState<{ studentId: string; date: string } | null>(null);
  const [undo, setUndo] = useState<Lesson | null>(null);

  const cellOf = (studentId: string, date: string): DayItem[] => (byDate.get(date) ?? []).filter((l) => l.studentId === studentId);
  const onCell = (studentId: string, date: string) => {
    const items = cellOf(studentId, date);
    const done = items.find((i) => i.status === "done" && !i.virtual);
    if (done) setUndo(done);
    else if (date <= today) setLog({ studentId, date });
  };

  return (
    <>
      <div className="month-head">
        <button onClick={() => setYm(shiftMonth(ym, -1))} aria-label="上个月"><ChevronLeft size={16} /></button>
        <span className="num">{y} 年 {m} 月</span>
        <button onClick={() => setYm(shiftMonth(ym, 1))} aria-label="下个月"><ChevronRight size={16} /></button>
        <span className="month-legend"><i className="done" /> 已上 <i className="sched" /> 待上 <i className="canc" /> 取消</span>
      </div>
      <div className="card month-wrap">
        <table className="month">
          <thead>
            <tr>
              <th className="nm">学员</th>
              {dates.map((d) => {
                const wd = weekdayOf(d);
                return (
                  <th key={d} className={`${wd === 0 || wd === 6 ? "wk" : ""} ${d === today ? "today" : ""}`}>
                    <span className="num">{Number(d.slice(8))}</span>
                    <small>{WEEKDAY_CN[wd]}</small>
                  </th>
                );
              })}
              <th className="sum">课时</th>
              <th className="sum">费用</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => {
              const done = dates.flatMap((d) => cellOf(st.id, d)).filter((l) => l.status === "done");
              const units = done.reduce((a, l) => a + l.units, 0);
              const fee = done.reduce((a, l) => a + l.units * l.price, 0);
              return (
                <tr key={st.id}>
                  <td className="nm"><Avatar name={st.name} size="sm" /><span>{st.name}</span></td>
                  {dates.map((d) => {
                    const items = cellOf(st.id, d);
                    const wd = weekdayOf(d);
                    const status = items.some((i) => i.status === "done") ? "done" : items.some((i) => i.status === "scheduled") ? "sched" : items.some((i) => i.status === "cancelled") ? "canc" : "";
                    return (
                      <td key={d} className={`${wd === 0 || wd === 6 ? "wk" : ""} ${d === today ? "today" : ""}`}>
                        <button className={`cell ${status}`} onClick={() => onCell(st.id, d)} title={status === "done" ? "已上 · 点击撤销" : d <= today ? "点击补记" : ""}>
                          {status === "done" && <Check strokeWidth={3.5} />}
                          {items.length > 1 && <i className="n">{items.length}</i>}
                        </button>
                      </td>
                    );
                  })}
                  <td className="sum num">{units}</td>
                  <td className="sum num fee">{fmtMoney(fee)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {students.length === 0 && <div className="muted" style={{ padding: 20, textAlign: "center" }}>还没有学员。</div>}
      </div>
      <LogLessonSheet key={log ? log.studentId + log.date : "none"} open={!!log} onClose={() => setLog(null)} presetStudentId={log?.studentId} presetDate={log?.date} />
      <UndoLessonSheet lesson={undo} onClose={() => setUndo(null)} />
    </>
  );
}
