/**
 * 学员：左边名单（可拖拽排序，已结课折叠在底部），右边档案。
 * 档案布局 2/3 + 1/3：左边上课历史按月分组，右边缴费、备注、推荐人竖着堆。
 */
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Search, Trash2, Bell, Share2, GripVertical, ChevronDown, ChevronRight, ArchiveRestore } from "lucide-react";
import { useStore } from "@/store";
import { balance, balanceLevel, confirmedIncome, paidTotal, purchasedHours, fmtMoney, usedUnits } from "@/core/finance";
import { monthKey, todayISO } from "@/core/date";
import type { Lesson, Student } from "@/core/types";
import { Avatar, Button, Chip, Empty, Field, Input, Num, Segmented, Select, Sheet } from "@/ui/primitives";
import { LogLessonSheet } from "@/ui/widgets/LogLessonSheet";
import { UndoLessonSheet } from "@/ui/widgets/UndoLessonSheet";
import { ConfirmSheet } from "@/ui/widgets/ConfirmSheet";
import { ParentReportSheet } from "@/ui/widgets/ReportSheets";
import { platform } from "@/platform";
import "./students.css";

const LEVEL_CHIP = { ok: null, low: <Chip tone="orange">即将用完</Chip>, danger: <Chip tone="red">快用完</Chip>, done: <Chip>已用完</Chip> } as const;
type SortMode = "manual" | "balance";

export function StudentsPage() {
  const s = useStore((x) => x.s);
  const route = useStore((x) => x.route);
  const { go, reorderStudents } = useStore(useShallow((x) => ({ go: x.go, reorderStudents: x.reorderStudents })));
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("manual");
  const [addOpen, setAddOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const kw = q.trim();
  const active = useMemo(() => {
    const list = s.students.filter((st) => !st.archived && (!kw || st.name.includes(kw)));
    return sort === "balance" ? [...list].sort((a, b) => balance(s, a.id) - balance(s, b.id)) : [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [s, kw, sort]);
  const archived = useMemo(() => s.students.filter((st) => st.archived && (!kw || st.name.includes(kw))).sort((a, b) => a.sortOrder - b.sortOrder), [s.students, kw]);
  const selectedId = route.studentId ?? active[0]?.id;
  const selected = s.students.find((x) => x.id === selectedId) ?? null;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const ids = active.map((x) => x.id);
    const from = ids.indexOf(String(a.id)), to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderStudents(arrayMove(ids, from, to));
  };

  return (
    <div className="page students">
      <div className="page-head">
        <h1>学员</h1>
        <div className="sub">{active.length} 人在读{archived.length > 0 && ` · ${archived.length} 人已结课`}</div>
        <div className="actions">
          <Segmented<SortMode> value={sort} options={[{ value: "manual", label: "手动排序" }, { value: "balance", label: "按余额" }]} onChange={setSort} />
          <Button variant="primary" icon={<Plus />} onClick={() => setAddOpen(true)}>添加学员</Button>
        </div>
      </div>
      <div className="students-body">
        <div className="students-list card">
          <div className="search">
            <Search size={14} />
            <input placeholder="搜索学员" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {active.length === 0 && archived.length === 0 ? (
            <Empty title="还没有学员" desc="添加第一位学员，之后缴费和打卡都记在他名下。" />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={active.map((x) => x.id)} strategy={verticalListSortingStrategy}>
                {active.map((st) => (
                  <StudentRow key={st.id} st={st} selected={st.id === selectedId} draggable={sort === "manual" && !kw} onSelect={() => go({ page: "students", studentId: st.id })} />
                ))}
              </SortableContext>
            </DndContext>
          )}
          {archived.length > 0 && (
            <div className="archived-group">
              <button className="archived-head" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 已结课 <span className="num">{archived.length}</span>
              </button>
              {showArchived && archived.map((st) => (
                <div key={st.id} className={`row clickable archived ${st.id === selectedId ? "on" : ""}`} onClick={() => go({ page: "students", studentId: st.id })}>
                  <Avatar name={st.name} size="sm" />
                  <div className="grow"><div className="title">{st.name}</div><div className="meta">已上 {usedUnits(s, st.id)} 课时</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="students-detail">{selected ? <Profile key={selected.id} student={selected} /> : <div className="card"><Empty title="选一位学员" /></div>}</div>
      </div>
      <AddStudentSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function StudentRow({ st, selected, draggable, onSelect }: { st: Student; selected: boolean; draggable: boolean; onSelect: () => void }) {
  const s = useStore((x) => x.s);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: st.id, disabled: !draggable });
  const b = balance(s, st.id);
  const lv = balanceLevel(s, st.id);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className={`row clickable ${selected ? "on" : ""} ${isDragging ? "dragging" : ""}`} onClick={onSelect}>
      {draggable && <button className="grip" {...attributes} {...listeners} aria-label="拖动排序" onClick={(e) => e.stopPropagation()}><GripVertical size={14} /></button>}
      <Avatar name={st.name} size="sm" />
      <div className="grow">
        <div className="title">{st.name}</div>
        <div className="meta">{st.courseIds.map((id) => s.courses.find((c) => c.id === id)?.name).filter(Boolean).join(" · ") || "未选课程"}</div>
      </div>
      <div className={`balance-pill ${lv}`}><Num>{b}</Num><span>节</span></div>
    </div>
  );
}

function Profile({ student }: { student: Student }) {
  const s = useStore((x) => x.s);
  const { addPayment, removePayment, removeStudent, updateStudent, go } = useStore(useShallow((x) => ({ addPayment: x.addPayment, removePayment: x.removePayment, removeStudent: x.removeStudent, updateStudent: x.updateStudent, go: x.go })));
  const [logOpen, setLogOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [undoTarget, setUndoTarget] = useState<Lesson | null>(null);
  const [note, setNote] = useState(student.note);
  const [monthsShown, setMonthsShown] = useState(3);
  const b = balance(s, student.id);
  const lv = balanceLevel(s, student.id);
  const groups = useMemo(() => {
    const done = s.lessons.filter((l) => l.studentId === student.id && l.status === "done").sort((a, c) => (c.date + c.time).localeCompare(a.date + a.time));
    const map = new Map<string, Lesson[]>();
    for (const l of done) map.set(monthKey(l.date), [...(map.get(monthKey(l.date)) ?? []), l]);
    return [...map.entries()];
  }, [s.lessons, student.id]);
  const payments = useMemo(() => s.payments.filter((p) => p.studentId === student.id).sort((a, c) => c.date.localeCompare(a.date)), [s.payments, student.id]);
  const remind = async () => {
    await platform.copyText(`${student.name}家长您好，${student.name}的课时还剩 ${b} 节，为了不打断学习节奏，建议提前安排续费，方便的话随时联系我～`);
  };

  return (
    <>
      <div className="card profile-head">
        <Avatar name={student.name} size="lg" />
        <div className="grow">
          <div className="profile-name">{student.name} {student.archived && <Chip>已结课</Chip>}</div>
          <div className="profile-courses">
            {student.courseIds.map((id) => {
              const c = s.courses.find((x) => x.id === id);
              return c ? <Chip key={id} tone="accent">{c.name} · ¥{c.price}</Chip> : null;
            })}
            {!student.archived && LEVEL_CHIP[lv]}
          </div>
          <div className="profile-nums">
            <span>已上 <b className="num">{usedUnits(s, student.id)}</b> / {purchasedHours(s, student.id)} 课时</span>
            <span>累计缴费 <b className="num">{fmtMoney(paidTotal(s, student.id))}</b></span>
            <span>确认收入 <b className="num">{fmtMoney(confirmedIncome(s, student.id))}</b></span>
          </div>
        </div>
        <div className="profile-balance">
          <div className="big num">{b}</div>
          <div className="lbl">剩余课时</div>
        </div>
      </div>

      <div className="profile-actions">
        {student.archived ? (
          <Button variant="primary" icon={<ArchiveRestore />} onClick={() => updateStudent(student.id, { archived: false })}>恢复为在读</Button>
        ) : (
          <>
            <Button variant="primary" icon={<Plus />} onClick={() => setLogOpen(true)}>记一节课</Button>
            <Button onClick={() => setPayOpen(true)}>缴费</Button>
            <Button icon={<Bell />} onClick={remind}>续费提醒</Button>
          </>
        )}
        <Button icon={<Share2 />} onClick={() => setReportOpen(true)}>家长报告</Button>
        <span style={{ flex: 1 }} />
        {!student.archived && <Button variant="ghost" size="sm" onClick={() => updateStudent(student.id, { archived: true })}>标为已结课</Button>}
        <Button variant="ghost" icon={<Trash2 />} onClick={() => setDelOpen(true)} title="删除学员" />
      </div>

      <div className="profile-grid">
        <div className="card">
          <div className="section-title">上课记录 <span className="right muted">{groups.reduce((a, [, ls]) => a + ls.length, 0)} 次</span></div>
          {groups.length === 0 ? (
            <div className="muted" style={{ padding: "8px 0" }}>还没有打卡记录。</div>
          ) : (
            <>
              {groups.slice(0, monthsShown).map(([ym, ls]) => (
                <div key={ym} className="month-group">
                  <div className="month-label num">{ym.slice(0, 4)} 年 {Number(ym.slice(5))} 月 <span className="muted">· {ls.reduce((a, l) => a + l.units, 0)} 课时</span></div>
                  {ls.map((l) => (
                    <div className="row" key={l.id}>
                      <div className="grow">
                        <div className="title num" style={{ fontWeight: 500 }}>{l.date.slice(5).replace("-", "/")} <span className="muted">{l.time}</span></div>
                        <div className="meta">{s.courses.find((c) => c.id === l.courseId)?.name} · {l.units} 课时 · {fmtMoney(l.units * l.price)}{l.source === "backfill" && " · 补记"}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setUndoTarget(l)}>撤销</Button>
                    </div>
                  ))}
                </div>
              ))}
              {groups.length > monthsShown && <button className="link" style={{ marginTop: 8 }} onClick={() => setMonthsShown(monthsShown + 3)}>显示更早的月份</button>}
            </>
          )}
        </div>
        <div className="profile-side">
          <div className="card">
            <div className="section-title">缴费记录 <button className="right link" onClick={() => setPayOpen(true)}>+ 新增</button></div>
            {payments.length === 0 ? (
              <div className="muted" style={{ padding: "8px 0" }}>还没有缴费记录。</div>
            ) : (
              payments.map((p) => (
                <div className="row" key={p.id}>
                  <div className="grow">
                    <div className="title num" style={{ fontWeight: 500 }}>{p.date}</div>
                    <div className="meta">{p.hours} 课时{p.note && ` · ${p.note}`}</div>
                  </div>
                  <Num className="pay-amt">{fmtMoney(p.amount)}</Num>
                  <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => removePayment(p.id)} title="删除" />
                </div>
              ))
            )}
          </div>
          <div className="card">
            <div className="section-title">备注</div>
            <textarea className="input" value={note} placeholder="学习情况、家长要求…" onChange={(e) => setNote(e.target.value)} onBlur={() => note !== student.note && updateStudent(student.id, { note })} />
          </div>
          <div className="card">
            <div className="section-title">推荐人</div>
            <Select value={student.referrerId ?? ""} onChange={(e) => updateStudent(student.id, { referrerId: e.target.value || undefined })}>
              <option value="">不是转介绍</option>
              {s.students.filter((x) => x.id !== student.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </div>
        </div>
      </div>

      <LogLessonSheet key={student.id} open={logOpen} onClose={() => setLogOpen(false)} presetStudentId={student.id} />
      <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} studentId={student.id} onSubmit={addPayment} />
      <UndoLessonSheet lesson={undoTarget} onClose={() => setUndoTarget(null)} />
      <ParentReportSheet key={`r-${student.id}`} open={reportOpen} onClose={() => setReportOpen(false)} studentId={student.id} />
      <ConfirmSheet open={delOpen} onClose={() => setDelOpen(false)} onConfirm={() => { removeStudent(student.id); go({ page: "students" }); }} title={`删除 ${student.name}？`} confirmLabel="删除">
        <p className="muted">会一并删除这位学员的缴费和打卡记录，无法恢复。想保留记录的话，「标为已结课」更合适。</p>
      </ConfirmSheet>
    </>
  );
}

function AddStudentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore((x) => x.s);
  const { addStudent, addPayment, go } = useStore(useShallow((x) => ({ addStudent: x.addStudent, addPayment: x.addPayment, go: x.go })));
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState(s.courses[0]?.id ?? "");
  const [hours, setHours] = useState("");
  const [amount, setAmount] = useState("");
  const course = s.courses.find((c) => c.id === courseId) ?? s.courses[0];
  const h = parseFloat(hours);
  const suggestedAmount = course && Number.isFinite(h) ? course.price * h : 0;
  const submit = () => {
    if (!name.trim()) return;
    const st = addStudent({ name: name.trim(), courseIds: course ? [course.id] : [], note: "" });
    const a = parseFloat(amount);
    if (Number.isFinite(h) && h > 0) addPayment({ studentId: st.id, date: todayISO(), hours: h, amount: Number.isFinite(a) ? a : suggestedAmount, note: "首次" });
    setName(""); setHours(""); setAmount("");
    onClose();
    go({ page: "students", studentId: st.id });
  };
  return (
    <Sheet open={open} onClose={onClose} title="添加学员" sub="顺手把第一次缴费也记上，余额就有了。">
      <Field label="姓名"><Input autoFocus value={name} placeholder="学员姓名" onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="课程">
        <Select value={course?.id ?? ""} onChange={(e) => setCourseId(e.target.value)}>
          {s.courses.length === 0 && <option value="">先去「课程」加一门课</option>}
          {s.courses.map((c) => <option key={c.id} value={c.id}>{c.name} · ¥{c.price}/课时</option>)}
        </Select>
      </Field>
      <div className="grid-2">
        <Field label="购买课时（可选）"><Input type="number" min={0} value={hours} placeholder="20" onChange={(e) => setHours(e.target.value)} /></Field>
        <Field label="金额"><Input type="number" min={0} value={amount} placeholder={suggestedAmount ? String(suggestedAmount) : "0"} onChange={(e) => setAmount(e.target.value)} /></Field>
      </div>
      <div className="sheet-actions">
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={submit} disabled={!name.trim()}>添加</Button>
      </div>
    </Sheet>
  );
}

function PaymentSheet({ open, onClose, studentId, onSubmit }: { open: boolean; onClose: () => void; studentId: string; onSubmit: (p: { studentId: string; date: string; amount: number; hours: number; note: string }) => void }) {
  const s = useStore((x) => x.s);
  const student = s.students.find((x) => x.id === studentId);
  const price = s.courses.find((c) => c.id === student?.courseIds[0])?.price ?? 0;
  const [hours, setHours] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const h = parseFloat(hours);
  const suggested = Number.isFinite(h) ? h * price : 0;
  const submit = () => {
    if (!Number.isFinite(h) || h <= 0) return;
    const a = parseFloat(amount);
    onSubmit({ studentId, date, hours: h, amount: Number.isFinite(a) ? a : suggested, note });
    setHours(""); setAmount(""); setNote("");
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={`${student?.name ?? ""} 缴费`}>
      <div className="grid-2">
        <Field label="课时数"><Input autoFocus type="number" min={0} value={hours} placeholder="20" onChange={(e) => setHours(e.target.value)} /></Field>
        <Field label="金额"><Input type="number" min={0} value={amount} placeholder={suggested ? String(suggested) : "0"} onChange={(e) => setAmount(e.target.value)} /></Field>
      </div>
      <div className="grid-2">
        <Field label="日期"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="备注"><Input value={note} placeholder="续费 / 含试听…" onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <div className="sheet-actions">
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" onClick={submit} disabled={!(h > 0)}>记入</Button>
      </div>
    </Sheet>
  );
}
