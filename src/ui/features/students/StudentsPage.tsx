/** 学员：左边名单，右边档案。缴费、上课历史、续费提醒都在档案里。 */
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Plus, Search, Trash2, Bell, Share2 } from "lucide-react";
import { useStore } from "@/store";
import { balance, balanceLevel, confirmedIncome, paidTotal, purchasedHours, fmtMoney, usedUnits } from "@/core/finance";
import { todayISO } from "@/core/date";
import type { Lesson, Student } from "@/core/types";
import { Avatar, Button, Chip, Empty, Field, Input, Num, Select, Sheet } from "@/ui/primitives";
import { LogLessonSheet } from "@/ui/widgets/LogLessonSheet";
import { UndoLessonSheet } from "@/ui/widgets/UndoLessonSheet";
import { ConfirmSheet } from "@/ui/widgets/ConfirmSheet";
import { platform } from "@/platform";
import "./students.css";

const LEVEL_CHIP = { ok: null, low: <Chip tone="orange">即将用完</Chip>, danger: <Chip tone="red">快用完</Chip>, done: <Chip>已用完</Chip> } as const;

export function StudentsPage() {
  const s = useStore((x) => x.s);
  const route = useStore((x) => x.route);
  const go = useStore((x) => x.go);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const list = useMemo(() => {
    const kw = q.trim();
    return s.students.filter((st) => !st.archived && (!kw || st.name.includes(kw))).sort((a, b) => balance(s, a.id) - balance(s, b.id));
  }, [s, q]);
  const selectedId = route.studentId ?? list[0]?.id;
  const selected = s.students.find((x) => x.id === selectedId) ?? null;

  return (
    <div className="page students">
      <div className="page-head">
        <h1>学员</h1>
        <div className="sub">{list.length} 人</div>
        <div className="actions">
          <Button variant="primary" icon={<Plus />} onClick={() => setAddOpen(true)}>添加学员</Button>
        </div>
      </div>
      <div className="students-body">
        <div className="students-list card">
          <div className="search">
            <Search size={14} />
            <input placeholder="搜索学员" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {list.length === 0 ? (
            <Empty title="还没有学员" desc="添加第一位学员，之后缴费和打卡都记在他名下。" />
          ) : (
            list.map((st) => {
              const b = balance(s, st.id);
              const lv = balanceLevel(s, st.id);
              return (
                <div key={st.id} className={`row clickable ${st.id === selectedId ? "on" : ""}`} onClick={() => go({ page: "students", studentId: st.id })}>
                  <Avatar name={st.name} size="sm" />
                  <div className="grow">
                    <div className="title">{st.name}</div>
                    <div className="meta">{st.courseIds.map((id) => s.courses.find((c) => c.id === id)?.name).filter(Boolean).join(" · ") || "未选课程"}</div>
                  </div>
                  <div className={`balance-pill ${lv}`}>
                    <Num>{b}</Num>
                    <span>节</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="students-detail">{selected ? <Profile student={selected} /> : <div className="card"><Empty title="选一位学员" /></div>}</div>
      </div>
      <AddStudentSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function Profile({ student }: { student: Student }) {
  const s = useStore((x) => x.s);
  const { addPayment, removePayment, removeStudent, updateStudent, go } = useStore(useShallow((x) => ({ addPayment: x.addPayment, removePayment: x.removePayment, removeStudent: x.removeStudent, updateStudent: x.updateStudent, go: x.go })));
  const [logOpen, setLogOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [undoTarget, setUndoTarget] = useState<Lesson | null>(null);
  const [note, setNote] = useState(student.note);
  const b = balance(s, student.id);
  const lv = balanceLevel(s, student.id);
  const lessons = useMemo(() => s.lessons.filter((l) => l.studentId === student.id && l.status === "done").sort((a, c) => (c.date + c.time).localeCompare(a.date + a.time)).slice(0, 12), [s.lessons, student.id]);
  const payments = useMemo(() => s.payments.filter((p) => p.studentId === student.id).sort((a, c) => c.date.localeCompare(a.date)), [s.payments, student.id]);

  const remind = async () => {
    const text = `${student.name}家长您好，${student.name}的课时还剩 ${b} 节，为了不打断学习节奏，建议提前安排续费，方便的话随时联系我～`;
    await platform.copyText(text);
  };

  return (
    <>
      <div className="card profile-head">
        <Avatar name={student.name} size="lg" />
        <div className="grow">
          <div className="profile-name">{student.name}</div>
          <div className="profile-courses">
            {student.courseIds.map((id) => {
              const c = s.courses.find((x) => x.id === id);
              return c ? <Chip key={id} tone="accent">{c.name} · ¥{c.price}</Chip> : null;
            })}
            {LEVEL_CHIP[lv]}
          </div>
        </div>
        <div className="profile-balance">
          <div className="big num">{b}</div>
          <div className="lbl">剩余课时</div>
        </div>
      </div>

      <div className="profile-actions">
        <Button variant="primary" icon={<Plus />} onClick={() => setLogOpen(true)}>记一节课</Button>
        <Button onClick={() => setPayOpen(true)}>缴费</Button>
        <Button icon={<Bell />} onClick={remind}>续费提醒</Button>
        <Button icon={<Share2 />} onClick={() => go({ page: "more" })} title="家长报告在下一版">家长报告</Button>
        <span style={{ flex: 1 }} />
        <Button variant="ghost" icon={<Trash2 />} onClick={() => setDelOpen(true)} title="删除学员" />
      </div>

      <div className="grid-3 profile-stats">
        <div className="card stat-card"><div className="lbl">已上 / 购买</div><div className="val num">{usedUnits(s, student.id)} <span className="muted">/ {purchasedHours(s, student.id)}</span></div></div>
        <div className="card stat-card"><div className="lbl">累计缴费</div><div className="val num">{fmtMoney(paidTotal(s, student.id))}</div></div>
        <div className="card stat-card"><div className="lbl">确认收入</div><div className="val num">{fmtMoney(confirmedIncome(s, student.id))}</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">最近上课</div>
          {lessons.length === 0 ? (
            <div className="muted" style={{ padding: "8px 0" }}>还没有打卡记录。</div>
          ) : (
            lessons.map((l) => (
              <div className="row" key={l.id}>
                <div className="grow">
                  <div className="title num" style={{ fontWeight: 500 }}>{l.date} <span className="muted">{l.time}</span></div>
                  <div className="meta">{s.courses.find((c) => c.id === l.courseId)?.name} · {l.units} 课时 · {fmtMoney(l.units * l.price)}{l.source === "backfill" && " · 补记"}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setUndoTarget(l)}>撤销</Button>
              </div>
            ))
          )}
        </div>
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
      </div>

      <div className="card">
        <div className="section-title">备注</div>
        <textarea className="input" value={note} placeholder="学习情况、家长要求…" onChange={(e) => setNote(e.target.value)} onBlur={() => note !== student.note && updateStudent(student.id, { note })} />
      </div>

      <LogLessonSheet key={student.id} open={logOpen} onClose={() => setLogOpen(false)} presetStudentId={student.id} />
      <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} studentId={student.id} onSubmit={addPayment} />
      <UndoLessonSheet lesson={undoTarget} onClose={() => setUndoTarget(null)} />
      <ConfirmSheet open={delOpen} onClose={() => setDelOpen(false)} onConfirm={() => { removeStudent(student.id); go({ page: "students" }); }} title={`删除 ${student.name}？`} confirmLabel="删除">
        <p className="muted">会一并删除这位学员的缴费和打卡记录，无法恢复。想保留记录的话，改成「已结课」更合适。</p>
        <div style={{ marginTop: 10 }}><Button size="sm" onClick={() => { updateStudent(student.id, { archived: true }); setDelOpen(false); go({ page: "students" }); }}>改为已结课</Button></div>
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
  const course = s.courses.find((c) => c.id === courseId);
  const h = parseFloat(hours);
  const suggestedAmount = course && Number.isFinite(h) ? course.price * h : 0;
  const submit = () => {
    if (!name.trim()) return;
    const st = addStudent({ name: name.trim(), courseIds: courseId ? [courseId] : [], note: "" });
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
        <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {s.courses.length === 0 && <option value="">先去「设置」加课程</option>}
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
