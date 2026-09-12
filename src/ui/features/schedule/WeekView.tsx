/**
 * 周视图：真正的时间网格。列是真实日期，块的高度就是课的时长，颜色就是状态。
 * 点课块打开操作；点空白处按那个时间安排一节课。
 */
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "@/store";
import { lessonMinutes, lessonsOn } from "@/core/lesson";
import { classById, groupItems, groupStatus, type DayGroup } from "@/core/klass";
import { isOtherTeacher, teacherOfLesson } from "@/core/teacher";
import { gridBounds, placeBlocks, timeToMin } from "@/core/calendar";
import { WEEKDAY_CN, nowHHMM, todayISO, weekdayOf } from "@/core/date";
import type { ISODate } from "@/core/types";
import "./week.css";

const HOUR = 52;

export function WeekView({ days, onPick, onEmpty }: { days: ISODate[]; onPick: (group: DayGroup) => void; onEmpty: (date: ISODate, time: string) => void }) {
  const s = useStore((x) => x.s);
  const today = todayISO();
  const columns = useMemo(() => {
    const cols = days.map((date) => {
      const items = groupItems(lessonsOn(s, date)).map((group) => {
        const start = timeToMin(group.time);
        return { id: group.key, group, start, end: start + lessonMinutes(s, group.items[0]!) };
      });
      return { date, blocks: placeBlocks(items) };
    });
    const [lo, hi] = gridBounds(cols.flatMap((c) => c.blocks));
    return { cols, lo, hi };
  }, [s, days]);
  const { cols, lo, hi } = columns;
  const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const height = (hi - lo) * HOUR;
  const nowMin = timeToMin(nowHHMM());
  const showNow = days.includes(today) && nowMin >= lo * 60 && nowMin <= hi * 60;
  const students = s.students, courses = s.courses;
  /* 打开时滚到第一节课上方一点，别让老师从早上 8 点开始找 */
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = Math.min(...cols.flatMap((c) => c.blocks.map((b) => b.start)));
    const target = Number.isFinite(first) ? ((first - lo * 60) / 60) * HOUR - HOUR : 0;
    scrollRef.current?.scrollTo({ top: Math.max(0, target) });
  }, [cols, lo]);

  const clickEmpty = (date: ISODate, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const y = e.nativeEvent.offsetY;
    const min = lo * 60 + Math.floor(y / (HOUR / 2)) * 30;
    onEmpty(date, `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`);
  };

  return (
    <div className="card week-grid" style={{ "--n": days.length, "--hour": `${HOUR}px` } as React.CSSProperties}>
      <div className="wg-head">
        <div />
        {days.map((d) => (
          <div key={d} className={`wg-day ${d === today ? "today" : ""} ${weekdayOf(d) === 0 || weekdayOf(d) === 6 ? "wk" : ""}`}>
            <span>周{WEEKDAY_CN[weekdayOf(d)]}</span>
            <b className="num">{Number(d.slice(8))}</b>
          </div>
        ))}
      </div>
      <div className="wg-scroll" ref={scrollRef}>
        <div className="wg-body" style={{ height }}>
          <div className="wg-gutter">
            {hours.map((h) => <span key={h} className="wg-hour num" style={{ top: (h - lo) * HOUR }}>{String(h).padStart(2, "0")}:00</span>)}
          </div>
          {cols.map(({ date, blocks }) => (
            <div key={date} className={`wg-col ${date === today ? "today" : ""} ${date < today ? "past" : ""}`} onClick={(e) => clickEmpty(date, e)}>
              {blocks.map((b) => {
                const item = b.group.items[0]!;
                const cls = classById(s, b.group.classId);
                const status = groupStatus(b.group);
                const st = students.find((x) => x.id === item.studentId);
                const c = courses.find((x) => x.id === item.courseId);
                const name = cls ? `${cls.name} · ${b.group.items.length} 人` : (st?.name ?? "已删除");
                const other = isOtherTeacher(s, item) ? teacherOfLesson(s, item) : undefined;
                const top = ((b.start - lo * 60) / 60) * HOUR;
                const h = Math.max(22, ((b.end - b.start) / 60) * HOUR - 2);
                const w = 100 / b.cols;
                return (
                  <button
                    key={b.id}
                    className={`blk ${status} ${item.source === "template" ? "tpl" : ""} ${cls ? "klass" : ""} ${other ? "other" : ""} ${h < 44 ? "short" : ""}`}
                    style={{ top, height: h, left: `calc(${w * b.col}% + 2px)`, width: `calc(${w}% - 4px)`, ...(other ? ({ "--tc": other.color } as React.CSSProperties) : {}) }}
                    onClick={() => onPick(b.group)}
                    title={`${item.time} ${name} ${c?.name ?? ""}${other ? ` · ${other.name}` : ""}`}
                  >
                    <span className="t num">{item.time}</span>
                    <span className="n">{name}</span>
                    <span className="c">{other ? other.name : c?.name}</span>
                  </button>
                );
              })}
              {showNow && date === today && <div className="now-line" style={{ top: ((nowMin - lo * 60) / 60) * HOUR }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
