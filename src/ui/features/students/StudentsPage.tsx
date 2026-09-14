/** 聚合层只组装模块与流程，不实现表单、列表或持久化。 */
import { useMemo, useState } from "react";
import { useStore } from "@/store";
import type { Lesson, Payment, Student } from "@/core/types";
import type { LearningRecord } from "@/core/learning-records/types";
import { recordsForStudent } from "@/core/learning-records/selectors";
import { filterStudents, studentTags } from "@/core/student-profile/selectors";
import { balance, balanceLevel, confirmedIncome, paidTotal, purchasedHours, usedUnits } from "@/core/finance";
import { Button, Empty } from "@/ui/primitives";
import { StudentDirectory, type DirectoryStudent } from "@/ui/modules/student-directory";
import { AddStudentSheet, ProfileEditor, ProfileHeader } from "@/ui/modules/student-profile";
import { LearningRecords, LearningRecordEditor } from "@/ui/modules/learning-records";
import { StudentLedger, PaymentSheet } from "@/ui/modules/student-ledger";
import { RenewalSheet } from "@/ui/modules/renewal";
import { LogLessonSheet } from "@/ui/widgets/LogLessonSheet";
import { UndoLessonSheet } from "@/ui/widgets/UndoLessonSheet";
import { ConfirmSheet } from "@/ui/widgets/ConfirmSheet";
import { ParentReportSheet } from "@/ui/widgets/ReportSheets";
import { platform } from "@/platform";
import "./students.css";

type Tab = "learning" | "ledger";
export function StudentsPage() {
  const s = useStore((x) => x.s); const route = useStore((x) => x.route);
  const [query, setQuery] = useState(""); const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<"manual" | "balance">("manual");
  const [add, setAdd] = useState(false); const [tab, setTab] = useState<Tab>("learning");
  const visible = useMemo(() => filterStudents(s, query, tags), [s, query, tags]);
  const active = visible.filter((st) => !st.archived).sort((a, b) => sort === "manual" ? a.sortOrder - b.sortOrder : balance(s, a.id) - balance(s, b.id));
  const archived = visible.filter((st) => st.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const selected = visible.find((st) => st.id === route.studentId) ?? active[0] ?? archived[0];
  const allTags = [...new Map(s.students.flatMap((st) => studentTags(s, st)).map((tag) => [tag.key, tag])).values()];
  const row = (student: Student): DirectoryStudent => ({ student, remaining: balance(s, student.id), level: balanceLevel(s, student.id), courses: s.courses.filter((c) => student.courseIds.includes(c.id)).map((c) => c.name).join(" · ") });
  const actions = useStore.getState();
  return <div className="page students">
    <div className="page-head"><h1>学员</h1><div className="sub">{s.students.filter((st) => !st.archived).length} 人在读 · {s.students.filter((st) => st.archived).length} 人已结课</div><div className="actions"><Button variant="primary" onClick={() => setAdd(true)}>＋ 添加学员</Button></div></div>
    <div className="students-body">
      <StudentDirectory active={active.map(row)} archived={archived.map(row)} selectedId={selected?.id} tags={allTags} selectedTags={tags} query={query} sort={sort} onQuery={setQuery} onTags={setTags} onSort={setSort} onSelect={(id) => actions.go({ page: "students", studentId: id })} onReorder={actions.reorderStudents} />
      <div className="students-detail">{selected ? <StudentDossier key={`${selected.id}:${route.recordLessonId ?? ""}`} student={selected} tab={tab} onTab={setTab} recordLessonId={route.recordLessonId} /> : <div className="card"><Empty title="没有匹配的学员" desc="试试清除筛选，或添加一位学员。" /></div>}</div>
    </div>
    {add && <AddStudentSheet courses={s.courses} onAdd={(input) => { const st = actions.addStudent(input); setQuery(""); setTags([]); actions.go({ page: "students", studentId: st.id }); return st; }} onPayment={actions.addPayment} onClose={() => setAdd(false)} />}
  </div>;
}

function StudentDossier({ student, tab, onTab, recordLessonId }: { student: Student; tab: Tab; onTab(tab: Tab): void; recordLessonId?: string }) {
  const s = useStore((x) => x.s); const actions = useStore.getState();
  const [dialog, setDialog] = useState<"edit" | "pay" | "renewal" | "report" | "delete" | "archive" | null>(null);
  const [log, setLog] = useState(false); const [undo, setUndo] = useState<Lesson | null>(null);
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);
  const [editor, setEditor] = useState<{ record?: LearningRecord; lessonId?: string } | null>(() => recordLessonId && s.lessons.some((l) => l.id === recordLessonId && l.studentId === student.id && l.status === "done") ? { lessonId: recordLessonId, record: recordsForStudent(s.learningRecords, student.id).find((r) => r.lessonId === recordLessonId) } : null);
  const lessons = useMemo(() => s.lessons.filter((l) => l.studentId === student.id && l.status === "done").sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [s.lessons, student.id]);
  const payments = useMemo(() => s.payments.filter((p) => p.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date)), [s.payments, student.id]);
  const records = useMemo(() => recordsForStudent(s.learningRecords, student.id), [s.learningRecords, student.id]);
  const label = (l: Lesson) => `${s.courses.find((c) => c.id === l.courseId)?.name ?? "课程"}${l.classId ? ` · ${s.classes.find((c) => c.id === l.classId)?.name ?? "小班"}` : " · 1 对 1"}`;
  const feedback = (lesson: Lesson) => setEditor({ record: records.find((r) => r.lessonId === lesson.id), lessonId: lesson.id });
  const close = () => setDialog(null);
  return <>
    <ProfileHeader student={student} tags={studentTags(s, student)} remaining={balance(s, student.id)} level={balanceLevel(s, student.id)} onEdit={() => setDialog("edit")} />
    <div className="dossier-actions">{!student.archived && <><Button variant="primary" onClick={() => setLog(true)}>记一节课</Button><Button onClick={() => setDialog("pay")}>缴费</Button></>}
      <Button variant="ghost" onClick={() => setDialog("renewal")}>续费提醒</Button><Button variant="ghost" onClick={() => setDialog("report")}>家长报告</Button>
      <details className="dossier-more"><summary>更多 ⋯</summary><div><Button variant="ghost" onClick={() => student.archived ? actions.updateStudent(student.id, { archived: false }) : setDialog("archive")}>{student.archived ? "恢复为在读" : "标为已结课"}</Button><Button variant="ghost" onClick={() => setDialog("delete")}>删除学员</Button></div></details>
    </div>
    <div className="dossier-tabs" role="tablist" aria-label="学员档案">{([{ id: "learning", label: "学习记录" }, { id: "ledger", label: "课时与缴费" }] as const).map((t) => <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => onTab(t.id)} onKeyDown={(e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? "learning" : e.key === "End" ? "ledger" : tab === "learning" ? "ledger" : "learning"; onTab(next); document.getElementById(`tab-${next}`)?.focus(); }
    }} tabIndex={tab === t.id ? 0 : -1}>{t.label}</button>)}</div>
    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === "learning" ? <LearningRecords records={records} onAdd={() => setEditor({})} onEdit={(record) => setEditor({ record })} lessonLabel={(id) => { const l = s.lessons.find((item) => item.id === id); return l ? `${l.date} ${l.time} · ${label(l)}${l.status !== "done" ? "（已撤销打卡）" : ""}` : "原课程已删除"; }} />
        : <StudentLedger lessons={lessons} payments={payments} purchased={purchasedHours(s, student.id)} used={usedUnits(s, student.id)} remaining={balance(s, student.id)} paid={paidTotal(s, student.id)} income={confirmedIncome(s, student.id)} label={label} hasRecord={(id) => records.some((r) => r.lessonId === id)} onFeedback={feedback} onUndo={setUndo} onPay={() => setDialog("pay")} onRemovePayment={setDeletePayment} />}
    </div>
    {editor && <LearningRecordEditor key={editor.record?.id ?? editor.lessonId ?? "new"} studentId={student.id} record={editor.record} lessonId={editor.lessonId} lessons={lessons.map((l) => ({ id: l.id, date: l.date, label: `${l.date} ${l.time} · ${label(l)}` }))} onSave={actions.saveLearningRecord} onDelete={actions.removeLearningRecord} onClose={() => setEditor(null)} />}
    {dialog === "edit" && <ProfileEditor student={student} courses={s.courses} students={s.students} onSave={(input) => actions.editStudentProfile(student.id, input)} onClose={close} />}
    {dialog === "pay" && <PaymentSheet studentId={student.id} name={student.name} price={s.courses.find((c) => c.id === student.courseIds[0])?.price ?? 0} onSubmit={actions.addPayment} onClose={close} />}
    {dialog === "renewal" && <RenewalSheet name={student.name} remaining={balance(s, student.id)} copyText={platform.copyText} onClose={close} />}
    {dialog === "report" && <ParentReportSheet open studentId={student.id} onClose={close} />}
    <LogLessonSheet open={log} onClose={() => setLog(false)} presetStudentId={student.id} />
    <UndoLessonSheet lesson={undo} onClose={() => setUndo(null)} />
    <ConfirmSheet open={!!deletePayment} onClose={() => setDeletePayment(null)} title="删除这笔缴费？" onConfirm={() => { if (deletePayment) actions.removePayment(deletePayment.id); setDeletePayment(null); }} confirmLabel="删除缴费"><p>会影响课时余额，删除后无法恢复。</p></ConfirmSheet>
    <ConfirmSheet open={dialog === "archive"} onClose={close} title={`将 ${student.name} 标为已结课？`} onConfirm={() => { actions.updateStudent(student.id, { archived: true }); close(); }} confirmLabel="标为已结课"><p>档案与历史记录会保留，可从已结课名单恢复。</p></ConfirmSheet>
    <ConfirmSheet open={dialog === "delete"} onClose={close} title={`删除 ${student.name}？`} onConfirm={() => { actions.removeStudent(student.id); actions.go({ page: "students" }); }} confirmLabel="删除学员"><p>将删除这位学员的资料、学习记录、缴费和打卡记录，无法恢复。保留历史请选择标为已结课。</p></ConfirmSheet>
  </>;
}
