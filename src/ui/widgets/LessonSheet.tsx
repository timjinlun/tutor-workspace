/**
 * 点开一节课：看清楚是谁、几点、几课时，然后打卡 / 取消 / 改时间 / 撤销。
 * 周视图、月历、当天列表都用它，动作全部走 store，规则在 core/lesson。
 */
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Check, X, Clock, Undo2 } from "lucide-react";
import { useStore } from "@/store";
import { addMinutes, lessonMinutes, type DayItem } from "@/core/lesson";
import { balance, fmtMoney } from "@/core/finance";
import { formatCN } from "@/core/date";
import type { Lesson } from "@/core/types";
import { Avatar, Button, Chip, Field, Input, Sheet, Stamp } from "@/ui/primitives";
import { UndoLessonSheet } from "./UndoLessonSheet";

const SOURCE_LABEL = { template: "固定课表", manual: "临时排的", backfill: "补记" } as const;

export function LessonSheet({ item, onClose }: { item: DayItem | null; onClose: () => void }) {
  return item ? <Body key={item.id} item={item} onClose={onClose} /> : null;
}

function Body({ item, onClose }: { item: DayItem; onClose: () => void }) {
  const s = useStore((x) => x.s);
  const { complete, cancel, reschedule } = useStore(useShallow((x) => ({ complete: x.complete, cancel: x.cancel, reschedule: x.reschedule })));
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(item.date);
  const [time, setTime] = useState(item.time);
  const [undoTarget, setUndoTarget] = useState<Lesson | null>(null);
  const st = s.students.find((x) => x.id === item.studentId);
  const c = s.courses.find((x) => x.id === item.courseId);
  const end = addMinutes(item.time, lessonMinutes(s, item));
  const changed = date !== item.date || time !== item.time;

  return (
    <>
      <Sheet open onClose={onClose} title={`${st?.name ?? "已删除学员"} · ${c?.name ?? ""}`} sub={`${formatCN(item.date)} ${item.time} – ${end}`}>
        <div className="lesson-sheet-head">
          <Avatar name={st?.name ?? "?"} size="lg" />
          <div className="grow">
            <div className="lesson-sheet-meta">{item.units} 课时 · {fmtMoney(item.units * item.price)}{st && ` · 剩 ${balance(s, st.id)} 课时`}</div>
            <div className="lesson-sheet-chips">
              <Chip>{SOURCE_LABEL[item.source]}</Chip>
              {item.status === "done" && <Stamp />}
              {item.status === "cancelled" && <Chip>已取消</Chip>}
            </div>
            {item.note && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{item.note}</div>}
          </div>
        </div>

        {item.status === "scheduled" && moving && (
          <div className="lesson-sheet-move">
            <div className="grid-2">
              <Field label="改到哪天"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="几点"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
            </div>
            {item.templateId && date !== item.date && <div className="muted" style={{ fontSize: 12.5 }}>只挪这一次，固定课表不变；原来那天会标成「已取消」。</div>}
          </div>
        )}

        <div className="sheet-actions">
          {item.status === "scheduled" && !moving && (
            <>
              <Button variant="ghost" icon={<X />} onClick={() => { cancel(item); onClose(); }}>这次不上了</Button>
              <Button icon={<Clock />} onClick={() => setMoving(true)}>改时间</Button>
              <Button variant="primary" icon={<Check strokeWidth={3} />} onClick={() => { complete(item); onClose(); }}>上完了</Button>
            </>
          )}
          {item.status === "scheduled" && moving && (
            <>
              <Button onClick={() => setMoving(false)}>算了</Button>
              <Button variant="primary" disabled={!changed} onClick={() => { reschedule(item, { date, time }); onClose(); }}>确认改期</Button>
            </>
          )}
          {item.status === "done" && (
            <>
              <Button onClick={onClose}>关闭</Button>
              {!item.virtual && <Button variant="ghost" icon={<Undo2 />} onClick={() => setUndoTarget(item)}>撤销打卡</Button>}
            </>
          )}
          {item.status === "cancelled" && <Button onClick={onClose}>关闭</Button>}
        </div>
      </Sheet>
      <UndoLessonSheet lesson={undoTarget} onClose={() => { setUndoTarget(null); onClose(); }} />
    </>
  );
}
