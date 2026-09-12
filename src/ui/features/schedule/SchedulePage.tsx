/**
 * 课表：三种看法（周 / 月 / 按学员），一个来源（lessonsOn：固定课表 + 临时排的 + 补记的）。
 * 固定课表本身收进右上角的抽屉，主界面永远是真实日期上的真实的课。
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { useStore } from "@/store";
import { lessonsOn } from "@/core/lesson";
import { groupItems, groupStatus, type DayGroup } from "@/core/klass";
import { ClassLessonSheet } from "@/ui/widgets/ClassLessonSheet";
import { monthOf, shiftMonth, weeksAround } from "@/core/calendar";
import { addDays, formatCN, todayISO } from "@/core/date";
import type { ISODate } from "@/core/types";
import { Button, Segmented } from "@/ui/primitives";
import { LogLessonSheet } from "@/ui/widgets/LogLessonSheet";
import { LessonSheet } from "@/ui/widgets/LessonSheet";
import { WeekView } from "./WeekView";
import { MonthCalendar } from "./MonthCalendar";
import { StudentTable } from "./StudentTable";
import { TemplatesDrawer } from "./TemplatesDrawer";
import "./schedule.css";
import "./student-table.css";

type View = "week" | "month" | "students";
type Span = "1" | "2";

const shortCN = (d: ISODate) => formatCN(d).split(" ")[0];

export function SchedulePage() {
  const s = useStore((x) => x.s);
  const today = todayISO();
  const [view, setView] = useState<View>("week");
  const [span, setSpan] = useState<Span>("1");
  const [anchor, setAnchor] = useState<ISODate>(today);
  const [ym, setYm] = useState(monthOf(today));
  const [picked, setPicked] = useState<DayGroup | null>(null);
  const [add, setAdd] = useState<{ date: ISODate; time: string } | null>(null);
  const [drawer, setDrawer] = useState(false);

  const days = useMemo(() => weeksAround(anchor, span === "2" ? 2 : 1), [anchor, span]);
  const weekStats = useMemo(() => {
    const all = days.flatMap((d) => groupItems(lessonsOn(s, d)));
    return { total: all.filter((g) => groupStatus(g) !== "cancelled").length, done: all.filter((g) => groupStatus(g) === "done").length };
  }, [s, days]);
  const activeTemplates = s.templates.filter((t) => t.active).length;

  const step = (dir: 1 | -1) => {
    if (view === "week") setAnchor(addDays(anchor, dir * 7 * (span === "2" ? 2 : 1)));
    else setYm(shiftMonth(ym, dir));
  };
  const goToday = () => { setAnchor(today); setYm(monthOf(today)); };
  const [y, m] = ym.split("-");
  const title = view === "week" ? `${shortCN(days[0]!)} – ${shortCN(days[days.length - 1]!)}` : `${y} 年 ${Number(m)} 月`;
  const isNow = view === "week" ? days.includes(today) : ym === monthOf(today);

  return (
    <div className="page">
      <div className="page-head">
        <h1>课表</h1>
        <div className="sub">{view === "week" ? `${span === "2" ? "两周" : "本周"} ${weekStats.total} 节 · 已上 ${weekStats.done}` : view === "month" ? "点一天看当天的课" : "考勤一览"}</div>
        <div className="actions">
          <Segmented<View> value={view} options={[{ value: "week", label: "周" }, { value: "month", label: "月" }, { value: "students", label: "按学员" }]} onChange={setView} />
          <Button icon={<Repeat />} onClick={() => setDrawer(true)}>固定课表{activeTemplates > 0 && <span className="muted"> · {activeTemplates}</span>}</Button>
          <Button variant="primary" icon={<Plus />} onClick={() => setAdd({ date: today, time: "16:00" })}>安排一节课</Button>
        </div>
      </div>

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button onClick={() => step(-1)} aria-label="上一页"><ChevronLeft size={16} /></button>
          <span className="cal-title num">{title}</span>
          <button onClick={() => step(1)} aria-label="下一页"><ChevronRight size={16} /></button>
        </div>
        {!isNow && <Button size="sm" onClick={goToday}>回到今天</Button>}
        <span style={{ flex: 1 }} />
        {view === "week" && <Segmented<Span> value={span} options={[{ value: "1", label: "一周" }, { value: "2", label: "两周" }]} onChange={setSpan} />}
        {view !== "students" && <span className="cal-legend"><i className="sched" /> 待上 <i className="done" /> 已上 <i className="canc" /> 已取消 <i className="tpl" /> 固定课</span>}
      </div>

      {view === "week" && <WeekView days={days} onPick={setPicked} onEmpty={(date, time) => { if (date >= today) setAdd({ date, time }); }} />}
      {view === "month" && <MonthCalendar ym={ym} onPick={setPicked} />}
      {view === "students" && <StudentTable ym={ym} />}

      <LessonSheet item={picked && !picked.classId ? picked.items[0]! : null} onClose={() => setPicked(null)} />
      <ClassLessonSheet group={picked?.classId ? picked : null} onClose={() => setPicked(null)} />
      <LogLessonSheet key={add ? add.date + add.time : "none"} open={!!add} onClose={() => setAdd(null)} presetDate={add?.date} presetTime={add?.time} mode="schedule" />
      <TemplatesDrawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  );
}
