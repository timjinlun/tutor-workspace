/**
 * 「今天」：老师早上打开只问一件事：今天几节课、谁、几点、上完了怎么记。
 * 三种课的来源在这里合流；没课表的老师也不会看到空白。
 */
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Plus, Copy, CalendarPlus, Bell, Check, Undo2, X } from "lucide-react";
import { useStore } from "@/store";
import { addMinutes, lessonMinutes, lessonsOn, suggestionsFor, type DayItem } from "@/core/lesson";
import { balance, doneLessonsInWeek, incomeInMonth, lowBalanceStudents, fmtMoney } from "@/core/finance";
import { formatCN, monthKey, nowHHMM, todayISO } from "@/core/date";
import type { Lesson } from "@/core/types";
import { Avatar, Button, Chip, Empty, Num, Stamp } from "@/ui/primitives";
import { LogLessonSheet } from "@/ui/widgets/LogLessonSheet";
import { UndoLessonSheet } from "@/ui/widgets/UndoLessonSheet";
import { platform } from "@/platform";
import "./today.css";

export function TodayPage() {
  const s = useStore((x) => x.s);
  const { complete, cancel, log, copyLastWeek, toggleTodo, go } = useStore(useShallow((x) => ({ complete: x.complete, cancel: x.cancel, log: x.log, copyLastWeek: x.copyLastWeek, toggleTodo: x.toggleTodo, go: x.go })));
  const today = todayISO();
  const items = useMemo(() => lessonsOn(s, today), [s, today]);
  const suggestions = useMemo(() => suggestionsFor(s, today), [s, today]);
  const low = useMemo(() => lowBalanceStudents(s), [s]);
  const todos = useMemo(() => s.todos.filter((t) => !t.done && t.due <= today).sort((a, b) => a.due.localeCompare(b.due)), [s.todos, today]);
  const [logOpen, setLogOpen] = useState(false);
  const [undoTarget, setUndoTarget] = useState<Lesson | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const studentOf = (id: string) => s.students.find((x) => x.id === id);
  const courseOf = (id: string) => s.courses.find((x) => x.id === id);
  const doneCount = items.filter((i) => i.status === "done").length;
  const pending = items.filter((i) => i.status === "scheduled");
  const now = nowHHMM();
  const nextUp = pending.find((i) => i.time >= now) ?? pending[0];

  const onComplete = (item: DayItem) => {
    complete(item);
    setFresh(`${item.studentId}|${item.time}`);
  };
  const remind = async (name: string, remaining: number) => {
    const text = `${name}家长您好，${name}的课时还剩 ${remaining} 节，为了不打断学习节奏，建议提前安排续费，方便的话随时联系我～`;
    if (await platform.copyText(text)) flash("续费提醒已复制，去微信粘贴就行");
  };
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>今天</h1>
        <div className="sub">{formatCN(today)}</div>
        <div className="actions">
          <Button variant="primary" icon={<Plus />} onClick={() => setLogOpen(true)}>
            记一节课
          </Button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">今天 <b>{doneCount}/{items.filter((i) => i.status !== "cancelled").length}</b> 节</div>
        <div className="stat">本周已上 <b>{doneLessonsInWeek(s, today)}</b> 节</div>
        <div className="stat">本月确认收入 <b>{fmtMoney(incomeInMonth(s, monthKey(today)))}</b></div>
        {low.length > 0 && <div className={`stat ${low.some((l) => l.level === "danger") ? "danger" : "warn"}`}>该提醒续费 <b>{low.length}</b> 人</div>}
      </div>

      {/* ---------- 时间轴 ---------- */}
      <div className="card timeline">
        {items.length === 0 ? (
          <Empty
            title="今天还没安排课"
            desc="上完直接记一节，或者把上周的课复制过来，也可以设一次固定课表以后自动出现。"
            actions={
              <>
                <Button variant="primary" icon={<Plus />} onClick={() => setLogOpen(true)}>记一节课</Button>
                <Button icon={<Copy />} onClick={() => flash(copyLastWeek(today) ? "已复制上周的课" : "上周这天没有课")}>从上周复制</Button>
                <Button icon={<CalendarPlus />} onClick={() => go({ page: "schedule" })}>设固定课表</Button>
              </>
            }
          />
        ) : (
          items.map((item) => {
            const st = studentOf(item.studentId);
            const c = courseOf(item.courseId);
            const key = `${item.studentId}|${item.time}`;
            return (
              <div key={item.id} className={`lesson ${item.status} ${nextUp && nextUp.id === item.id ? "next" : ""}`}>
                <div className="lesson-time num">{item.time}<span className="lesson-end">– {addMinutes(item.time, lessonMinutes(s, item))}</span>{nextUp && nextUp.id === item.id && <span className="next-tag">接下来</span>}</div>
                <div className="lesson-rail"><span className="dot" /></div>
                <Avatar name={st?.name ?? "?"} />
                <div className="lesson-main">
                  <div className="lesson-title">
                    {st?.name ?? "已删除学员"}
                    <span className="lesson-course">{c?.name}</span>
                    {item.source === "backfill" && <Chip>补记</Chip>}
                  </div>
                  <div className="lesson-meta">
                    {item.units} 课时 · {fmtMoney(item.units * item.price)}
                    {st && ` · 剩 ${balance(s, st.id)} 课时`}
                  </div>
                </div>
                <div className="lesson-actions">
                  {item.status === "scheduled" && (
                    <>
                      <Button variant="ghost" size="sm" icon={<X />} onClick={() => cancel(item)} title="今天不上了" />
                      <Button variant="primary" icon={<Check strokeWidth={3} />} onClick={() => onComplete(item)}>
                        上完了
                      </Button>
                    </>
                  )}
                  {item.status === "done" && (
                    <>
                      <Stamp fresh={fresh === key} />
                      {!item.virtual && (
                        <Button variant="ghost" size="sm" icon={<Undo2 />} onClick={() => setUndoTarget(item)} title="撤销打卡（需确认）" />
                      )}
                    </>
                  )}
                  {item.status === "cancelled" && <Chip>已取消</Chip>}
                </div>
              </div>
            );
          })
        )}
        {items.length > 0 && pending.length === 0 && doneCount > 0 && <div className="timeline-done">今天的课都上完了 🎉</div>}
      </div>

      {/* ---------- 从历史推断的建议 ---------- */}
      {suggestions.length > 0 && (
        <div className="card">
          <div className="section-title">可能还有这些课</div>
          {suggestions.map((sg) => {
            const st = studentOf(sg.studentId);
            return (
              <div className="row" key={`${sg.studentId}-${sg.time}`}>
                <Avatar name={st?.name ?? "?"} size="sm" />
                <div className="grow">
                  <div className="title">{st?.name} 通常这个时间上课</div>
                  <div className="meta">最近 {sg.hits} 周的今天都在 {sg.time} 上课</div>
                </div>
                <Button size="sm" onClick={() => { log({ studentId: sg.studentId, courseId: sg.courseId, date: today, time: sg.time }); flash("已记为已上"); }}>记为已上</Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid-2">
        {/* ---------- 该提醒续费 ---------- */}
        <div className="card">
          <div className="section-title"><Bell size={14} /> 该提醒续费</div>
          {low.length === 0 ? (
            <div className="muted" style={{ padding: "8px 0" }}>所有学员课时都充足。</div>
          ) : (
            low.map(({ student, remaining, level }) => (
              <div className="row" key={student.id}>
                <Avatar name={student.name} size="sm" />
                <div className="grow">
                  <div className="title">{student.name}</div>
                  <div className="meta">剩 <Num>{remaining}</Num> 课时</div>
                </div>
                <Chip tone={level === "danger" ? "red" : "orange"}>{level === "danger" ? "快用完" : "即将用完"}</Chip>
                <Button size="sm" onClick={() => remind(student.name, remaining)}>发提醒</Button>
              </div>
            ))
          )}
        </div>

        {/* ---------- 今天到期 ---------- */}
        <div className="card">
          <div className="section-title">今天要做</div>
          {todos.length === 0 ? (
            <div className="muted" style={{ padding: "8px 0" }}>没有到期的待办。</div>
          ) : (
            todos.map((t) => (
              <div className="row" key={t.id}>
                <button className={`check ${t.done ? "on" : ""}`} onClick={() => toggleTodo(t.id)} aria-label="完成">
                  <Check strokeWidth={3} />
                </button>
                <div className="grow">
                  <div className="title">{t.title}</div>
                  <div className="meta">{t.due < today ? <span style={{ color: "var(--red)" }}>已逾期 · {t.due}</span> : "今天到期"}{t.priority === "P0" && " · 紧急"}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <LogLessonSheet open={logOpen} onClose={() => setLogOpen(false)} />
      <UndoLessonSheet lesson={undoTarget} onClose={() => setUndoTarget(null)} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
