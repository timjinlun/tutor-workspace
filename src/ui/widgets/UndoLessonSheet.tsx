/** 撤销打卡的二次确认：把后果写清楚，再让人点。 */
import type { Lesson } from "@/core/types";
import { fmtMoney } from "@/core/finance";
import { useStore } from "@/store";
import { ConfirmSheet } from "./ConfirmSheet";

export function UndoLessonSheet({ lesson, onClose }: { lesson: Lesson | null; onClose: () => void }) {
  const s = useStore((x) => x.s);
  const undo = useStore((x) => x.undo);
  const name = s.students.find((x) => x.id === lesson?.studentId)?.name ?? "";
  return (
    <ConfirmSheet open={!!lesson} onClose={onClose} onConfirm={() => lesson && undo(lesson.id)} title="撤销这节课的打卡？" confirmLabel="撤销打卡">
      {lesson && (
        <div style={{ background: "var(--red-soft)", color: "var(--red)", padding: "12px 14px", borderRadius: "var(--radius-sm)", fontSize: 13.5, lineHeight: 1.7 }}>
          <div>
            <b>{name}</b> · {lesson.date} {lesson.time}
          </div>
          <div>已上课时 −{lesson.units} 节，确认收入 −{fmtMoney(lesson.units * lesson.price)}，剩余课时 +{lesson.units} 节。</div>
          <div>{lesson.source === "backfill" ? "这节课是补记的，撤销后会直接删除。" : "这节课会退回「待上」。"}此操作会记入流水，无法再撤回。</div>
        </div>
      )}
    </ConfirmSheet>
  );
}
