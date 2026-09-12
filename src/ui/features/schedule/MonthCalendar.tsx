/**
 * 月历：7 列日历格，每格看得到当天几节课、谁。点一格看当天全部并直接操作。
 */
import { useMemo, useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "@/store";
import { addMinutes, lessonMinutes, lessonsOn, type DayItem } from "@/core/lesson";
import { monthGrid, sameMonth, dayNumber, WEEK_ORDER } from "@/core/calendar";
import { WEEKDAY_CN, formatCN, todayISO } from "@/core/date";
import type { ISODate } from "@/core/types";
import { Avatar, Button, Chip, Sheet, Stamp } from "@/ui/primitives";
import { LogLessonSheet } from "@/ui/widgets/LogLessonSheet";
import "./month-calendar.css";

const MAX_CHIPS = 3;

export function MonthCalendar({ ym, onPick }: { ym: string; onPick: (item: DayItem) => void }) {
  const s = useStore((x) => x.s);
  const today = todayISO();
  const rows = useMemo(() => monthGrid(ym), [ym]);
  const first = `${ym}-01`;
  const byDate = useMemo(() => new Map(rows.flat().map((d) => [d, lessonsOn(s, d)])), [s, rows]);
  const [day, setDay] = useState<ISODate | null>(null);
  const nameOf = (id: string) => s.students.find((x) => x.id === id)?.name ?? "已删除";

  return (
    <>
      <div className="card mcal">
        <div className="mcal-head">{WEEK_ORDER.map((wd) => <div key={wd} className={wd === 0 || wd === 6 ? "wk" : ""}>周{WEEKDAY_CN[wd]}</div>)}</div>
        {rows.map((row, i) => (
          <div className="mcal-row" key={i}>
            {row.map((d) => {
              const items = byDate.get(d) ?? [];
              const out = !sameMonth(d, first);
              return (
                <div key={d} className={`mcal-cell ${out ? "out" : ""} ${d === today ? "today" : ""} ${d < today ? "past" : ""}`} onClick={() => setDay(d)}>
                  <div className="d num">{dayNumber(d)}</div>
                  {items.slice(0, MAX_CHIPS).map((it) => (
                    <span key={it.id} className={`mchip ${it.status}`}><span className="num">{it.time}</span> {nameOf(it.studentId)}</span>
                  ))}
                  {items.length > MAX_CHIPS && <span className="mcal-more">还有 {items.length - MAX_CHIPS} 节</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {day && <DaySheet date={day} onClose={() => setDay(null)} onPick={onPick} />}
    </>
  );
}

function DaySheet({ date, onClose, onPick }: { date: ISODate; onClose: () => void; onPick: (item: DayItem) => void }) {
  const s = useStore((x) => x.s);
  const { complete, cancel } = useStore(useShallow((x) => ({ complete: x.complete, cancel: x.cancel })));
  const items = useMemo(() => lessonsOn(s, date), [s, date]);
  const today = todayISO();
  const [add, setAdd] = useState<"schedule" | "log" | null>(null);
  const done = items.filter((i) => i.status === "done").length;
  return (
    <>
      <Sheet open onClose={onClose} title={formatCN(date)} sub={items.length ? `${items.length} 节 · 已上 ${done}` : "这天没有课"}>
        {items.map((it) => {
          const st = s.students.find((x) => x.id === it.studentId);
          const c = s.courses.find((x) => x.id === it.courseId);
          return (
            <div key={it.id} className="row clickable" onClick={() => onPick(it)}>
              <Avatar name={st?.name ?? "?"} size="sm" />
              <div className="grow">
                <div className="title">{st?.name ?? "已删除"} <span className="muted" style={{ fontWeight: 400 }}>{c?.name}</span></div>
                <div className="meta num">{it.time} – {addMinutes(it.time, lessonMinutes(s, it))} · {it.units} 课时</div>
              </div>
              {it.status === "scheduled" && (
                <span onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 4 }}>
                  <Button variant="ghost" size="sm" icon={<X />} onClick={() => cancel(it)} title="这次不上了" />
                  <Button variant="primary" size="sm" icon={<Check strokeWidth={3} />} onClick={() => complete(it)}>上完了</Button>
                </span>
              )}
              {it.status === "done" && <Stamp />}
              {it.status === "cancelled" && <Chip>已取消</Chip>}
            </div>
          );
        })}
        <div className="sheet-actions">
          <Button onClick={onClose}>关闭</Button>
          {date <= today && <Button onClick={() => setAdd("log")}>补记一节</Button>}
          <Button variant="primary" icon={<Plus />} onClick={() => setAdd("schedule")}>安排一节课</Button>
        </div>
      </Sheet>
      <LogLessonSheet key={add ?? "none"} open={!!add} onClose={() => setAdd(null)} presetDate={date} presetTime="16:00" mode={add ?? "schedule"} />
    </>
  );
}
