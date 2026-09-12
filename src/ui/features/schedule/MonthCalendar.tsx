/**
 * 月历：7 列日历格，每格看得到当天几节课、谁。点一格看当天全部并直接操作。
 */
import { useMemo, useState } from "react";
import { Plus, Check, X, Users } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "@/store";
import { addMinutes, lessonMinutes, lessonsOn } from "@/core/lesson";
import { classById, groupItems, groupStatus, type DayGroup } from "@/core/klass";
import { monthGrid, sameMonth, dayNumber, WEEK_ORDER } from "@/core/calendar";
import { WEEKDAY_CN, formatCN, todayISO } from "@/core/date";
import type { ISODate } from "@/core/types";
import { Avatar, Button, Chip, Sheet, Stamp } from "@/ui/primitives";
import { LogLessonSheet } from "@/ui/widgets/LogLessonSheet";
import "./month-calendar.css";

const MAX_CHIPS = 3;

export function MonthCalendar({ ym, onPick }: { ym: string; onPick: (group: DayGroup) => void }) {
  const s = useStore((x) => x.s);
  const today = todayISO();
  const rows = useMemo(() => monthGrid(ym), [ym]);
  const first = `${ym}-01`;
  const byDate = useMemo(() => new Map(rows.flat().map((d) => [d, groupItems(lessonsOn(s, d))])), [s, rows]);
  const [day, setDay] = useState<ISODate | null>(null);
  const nameOf = (g: DayGroup) => (g.classId ? (classById(s, g.classId)?.name ?? "班课") : (s.students.find((x) => x.id === g.items[0]!.studentId)?.name ?? "已删除"));

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
                  {items.slice(0, MAX_CHIPS).map((g) => (
                    <span key={g.key} className={`mchip ${groupStatus(g)} ${g.classId ? "klass" : ""}`}><span className="num">{g.time}</span> {nameOf(g)}</span>
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

function DaySheet({ date, onClose, onPick }: { date: ISODate; onClose: () => void; onPick: (group: DayGroup) => void }) {
  const s = useStore((x) => x.s);
  const { complete, cancel, cancelGroup } = useStore(useShallow((x) => ({ complete: x.complete, cancel: x.cancel, cancelGroup: x.cancelGroup })));
  const items = useMemo(() => groupItems(lessonsOn(s, date)), [s, date]);
  const today = todayISO();
  const [add, setAdd] = useState<"schedule" | "log" | null>(null);
  const done = items.filter((g) => groupStatus(g) === "done").length;
  return (
    <>
      <Sheet open onClose={onClose} title={formatCN(date)} sub={items.length ? `${items.length} 节 · 已上 ${done}` : "这天没有课"}>
        {items.map((g) => {
          const it = g.items[0]!;
          const cls = classById(s, g.classId);
          const st = s.students.find((x) => x.id === it.studentId);
          const c = s.courses.find((x) => x.id === it.courseId);
          const status = groupStatus(g);
          return (
            <div key={g.key} className="row clickable" onClick={() => onPick(g)}>
              {cls ? <div className="klass-badge" style={{ width: 28, height: 28, borderRadius: 8 }}><Users size={13} /></div> : <Avatar name={st?.name ?? "?"} size="sm" />}
              <div className="grow">
                <div className="title">{cls ? cls.name : (st?.name ?? "已删除")} <span className="muted" style={{ fontWeight: 400 }}>{c?.name}{cls && ` · ${g.items.length} 人`}</span></div>
                <div className="meta num">{g.time} – {addMinutes(g.time, lessonMinutes(s, it))} · {it.units} 课时{cls && "/人"}</div>
              </div>
              {status === "scheduled" && (
                <span onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 4 }}>
                  <Button variant="ghost" size="sm" icon={<X />} onClick={() => (cls ? cancelGroup(g.items) : cancel(it))} title="这次不上了" />
                  <Button variant="primary" size="sm" icon={<Check strokeWidth={3} />} onClick={() => (cls ? onPick(g) : complete(it))}>{cls ? "点名" : "上完了"}</Button>
                </span>
              )}
              {status === "done" && <Stamp />}
              {status === "cancelled" && <Chip>已取消</Chip>}
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
