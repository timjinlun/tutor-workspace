/** 文字报告：家长报告、月度经营报告。纯函数，输出可直接复制的文本。 */
import type { ID, State } from "./types";
import { balance, cashInMonth, confirmedIncome, doneUnitsInMonth, expenseInMonth, fmtMoney, incomeInMonth, lowBalanceStudents, purchasedHours, usedUnits } from "./finance";
import { monthKey } from "./date";

const ymCN = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y} 年 ${Number(m)} 月`;
};

export interface ParentReportInput {
  studentId: ID;
  ym: string;
  teacherName: string;
  /** 老师寄语，可空 */
  note?: string;
}

export function parentReport(state: State, input: ParentReportInput): string {
  const st = state.students.find((x) => x.id === input.studentId);
  if (!st) return "";
  const lessons = state.lessons
    .filter((l) => l.studentId === st.id && l.status === "done" && monthKey(l.date) === input.ym)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const units = lessons.reduce((a, l) => a + l.units, 0);
  const courseNames = [...new Set(lessons.map((l) => state.courses.find((c) => c.id === l.courseId)?.name).filter(Boolean))].join("、");
  const lines = [
    `【${st.name} 学习月报 · ${ymCN(input.ym)}】`,
    "",
    `本月上课 ${lessons.length} 次，共 ${units} 课时${courseNames ? `（${courseNames}）` : ""}。`,
    `累计已上 ${usedUnits(state, st.id)} 课时，剩余 ${balance(state, st.id)} 课时（已购 ${purchasedHours(state, st.id)} 课时）。`,
  ];
  if (lessons.length) {
    lines.push("", "上课记录：");
    for (const l of lessons) lines.push(`· ${l.date.slice(5).replace("-", "/")} ${l.time}${l.note ? ` · ${l.note}` : ""}`);
  }
  if (input.note?.trim()) lines.push("", "老师的话：", input.note.trim());
  const b = balance(state, st.id);
  if (b <= state.settings.lowBalanceThreshold + state.settings.remindAhead) lines.push("", `提示：剩余课时 ${b} 节，建议提前安排续费，以免打断学习节奏。`);
  lines.push("", `—— ${input.teacherName}`);
  return lines.join("\n");
}

export function monthlyReport(state: State, ym: string): string {
  const income = incomeInMonth(state, ym);
  const cash = cashInMonth(state, ym);
  const exp = expenseInMonth(state, ym);
  const units = doneUnitsInMonth(state, ym);
  const active = state.students.filter((s) => !s.archived && state.lessons.some((l) => l.studentId === s.id && l.status === "done" && monthKey(l.date) === ym));
  const perStudent = active
    .map((s) => ({ s, u: state.lessons.filter((l) => l.studentId === s.id && l.status === "done" && monthKey(l.date) === ym).reduce((a, l) => a + l.units, 0) }))
    .sort((a, b) => b.u - a.u);
  const low = lowBalanceStudents(state);
  const lines = [
    `【经营月报 · ${ymCN(ym)}】`,
    "",
    `上课 ${units} 课时 · 活跃学员 ${active.length} 人`,
    `确认收入 ${fmtMoney(income)} · 到账 ${fmtMoney(cash)} · 支出 ${fmtMoney(exp)} · 净 ${fmtMoney(cash - exp)}`,
    `累计确认收入 ${fmtMoney(confirmedIncome(state))}`,
  ];
  if (perStudent.length) {
    lines.push("", "各学员课时：");
    for (const { s, u } of perStudent) lines.push(`· ${s.name} ${u} 课时，剩 ${balance(state, s.id)}`);
  }
  if (low.length) {
    lines.push("", "该提醒续费：");
    for (const x of low) lines.push(`· ${x.student.name} 剩 ${x.remaining} 课时`);
  }
  return lines.join("\n");
}
