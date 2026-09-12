/**
 * 班课点名：一人一个小胶囊，点一下在「到 / 缺」之间切换。
 * 打过卡之后变成只读，显示当时的结果和是否扣了课时。
 */
import { Check, X } from "lucide-react";
import { useStore } from "@/store";
import type { DayItem } from "@/core/lesson";
import type { Attendance } from "@/core/klass";
import "./attendance.css";

export function AttendanceChips({ items, attendance, onToggle }: { items: DayItem[]; attendance?: Attendance; onToggle?: (studentId: string) => void }) {
  const students = useStore((x) => x.s.students);
  const editable = !!onToggle && items.every((i) => i.status === "scheduled");
  return (
    <div className="att-chips">
      {items.map((it) => {
        const name = students.find((s) => s.id === it.studentId)?.name ?? "已删除";
        if (editable) {
          const absent = attendance?.[it.studentId] === "absent";
          return (
            <button key={it.id} className={`att ${absent ? "absent" : "present"}`} onClick={(e) => { e.stopPropagation(); onToggle!(it.studentId); }} title={absent ? "标为到场" : "标为缺席"}>
              {absent ? <X size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}{name}
            </button>
          );
        }
        const absent = it.attendance === "absent";
        const deducted = it.status === "done";
        const cls = it.status === "cancelled" && !absent ? "off" : absent ? (deducted ? "absent deducted" : "absent") : "present";
        return (
          <span key={it.id} className={`att ${cls}`}>
            {absent ? <X size={12} strokeWidth={3} /> : it.status === "done" ? <Check size={12} strokeWidth={3} /> : null}
            {name}
            {absent && <small>{deducted ? "缺 · 照扣" : "缺 · 不扣"}</small>}
          </span>
        );
      })}
    </div>
  );
}
