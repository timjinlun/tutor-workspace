/**
 * 点开一次班课：谁来了谁没来，一键打卡；打过卡的能按人撤销。
 */
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Check, X, Undo2, Users } from "lucide-react";
import { useStore } from "@/store";
import { addMinutes, lessonMinutes } from "@/core/lesson";
import { classById, groupStatus, type Attendance, type DayGroup } from "@/core/klass";
import { fmtMoney } from "@/core/finance";
import { formatCN } from "@/core/date";
import type { Lesson } from "@/core/types";
import { Button, Chip, Sheet, Stamp } from "@/ui/primitives";
import { AttendanceChips } from "./AttendanceChips";
import { UndoLessonSheet } from "./UndoLessonSheet";

export function ClassLessonSheet({ group, onClose }: { group: DayGroup | null; onClose: () => void }) {
  return group ? <Body key={group.key} group={group} onClose={onClose} /> : null;
}

function Body({ group, onClose }: { group: DayGroup; onClose: () => void }) {
  const s = useStore((x) => x.s);
  const { completeClass, cancelGroup } = useStore(useShallow((x) => ({ completeClass: x.completeClass, cancelGroup: x.cancelGroup })));
  const [attendance, setAttendance] = useState<Attendance>({});
  const [undoTarget, setUndoTarget] = useState<Lesson | null>(null);
  const cls = classById(s, group.classId);
  const first = group.items[0]!;
  const c = s.courses.find((x) => x.id === first.courseId);
  const status = groupStatus(group);
  const end = addMinutes(first.time, lessonMinutes(s, first));
  const toggle = (id: string) => setAttendance((a) => ({ ...a, [id]: a[id] === "absent" ? "present" : "absent" }));
  const absentCount = Object.values(attendance).filter((v) => v === "absent").length;
  const doneItems = group.items.filter((i) => i.status === "done" && !i.virtual);
  const income = doneItems.reduce((a, l) => a + l.units * l.price, 0);

  return (
    <>
      <Sheet open onClose={onClose} title={cls?.name ?? "班课"} sub={`${formatCN(first.date)} ${first.time} – ${end} · ${c?.name ?? ""}`}>
        <div className="lesson-sheet-head">
          <div className="klass-badge lg"><Users size={20} /></div>
          <div className="grow">
            <div className="lesson-sheet-meta">{group.items.length} 人 · 每人 {first.units} 课时 · {fmtMoney(first.price)}/课时{cls && ` · 缺席${cls.deductOnAbsence ? "照扣" : "不扣"}`}</div>
            <div className="lesson-sheet-chips">
              <Chip tone="accent">班课</Chip>
              {status === "done" && <Stamp />}
              {status === "cancelled" && <Chip>已取消</Chip>}
              {status === "done" && <span className="muted" style={{ fontSize: 12.5 }}>确认收入 {fmtMoney(income)}</span>}
            </div>
          </div>
        </div>

        <AttendanceChips items={group.items} attendance={attendance} onToggle={status === "scheduled" ? toggle : undefined} />
        {status === "scheduled" && absentCount > 0 && cls && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            {absentCount} 人缺席，按本班规则{cls.deductOnAbsence ? "照样扣课时、算收入" : "不扣课时，不算收入"}。规则在「课程 → 班级」里改。
          </div>
        )}

        {status === "done" && doneItems.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {doneItems.map((l) => {
              const st = s.students.find((x) => x.id === l.studentId);
              return (
                <div className="row" key={l.id} style={{ padding: "8px 0" }}>
                  <div className="grow"><span className="title" style={{ fontSize: 13.5 }}>{st?.name ?? "已删除"}</span> <span className="muted" style={{ fontSize: 12.5 }}>{l.attendance === "absent" ? "缺席 · 照扣" : "到"} · {l.units} 课时 · {fmtMoney(l.units * l.price)}</span></div>
                  <Button variant="ghost" size="sm" icon={<Undo2 />} onClick={() => setUndoTarget(l)} title="撤销这个人的打卡（需确认）" />
                </div>
              );
            })}
          </div>
        )}

        <div className="sheet-actions">
          {status === "scheduled" ? (
            <>
              <Button variant="ghost" icon={<X />} onClick={() => { cancelGroup(group.items); onClose(); }}>这次不上了</Button>
              <Button variant="primary" icon={<Check strokeWidth={3} />} onClick={() => { completeClass(group.items, attendance); onClose(); }}>上完了{absentCount > 0 && ` · 缺 ${absentCount}`}</Button>
            </>
          ) : (
            <Button onClick={onClose}>关闭</Button>
          )}
        </div>
      </Sheet>
      <UndoLessonSheet lesson={undoTarget} onClose={() => setUndoTarget(null)} />
    </>
  );
}
