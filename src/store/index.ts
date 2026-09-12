/**
 * 状态与 Command。
 * 每个改数据的操作都是一个具名 action；涉及课的操作把审计条目交给 Repository。
 * UI 不能直接 set 状态，只能调 action。
 */
import { create } from "zustand";
import type { AuditEntry, Course, ID, ISODate, LessonTemplate, Payment, Settings, State, Student, Teacher, Todo } from "@/core/types";
import { emptyState } from "@/core/types";
import { uid } from "@/core/id";
import { todayISO } from "@/core/date";
import { demoState } from "@/core/demo";
import { cancelLesson, completeLesson, copyFromLastWeek, logLesson, undoLesson, type DayItem, type LogLessonInput } from "@/core/lesson";
import { createEntitlements, type Entitlements, type Tier } from "@/entitlements";
import type { Repository } from "@/data/repository";

export type Page = "today" | "students" | "schedule" | "finance" | "more" | "settings";
export interface Route {
  page: Page;
  studentId?: ID;
}

export interface Store {
  s: State;
  ready: boolean;
  saveError: string | null;
  route: Route;
  ent: Entitlements;
  /* 生命周期 */
  hydrate(repo: Repository): Promise<void>;
  /* 导航 */
  go(route: Route): void;
  /* 课 */
  complete(item: DayItem): void;
  undo(lessonId: ID): void;
  cancel(item: DayItem): void;
  log(input: LogLessonInput): void;
  copyLastWeek(date: ISODate): number;
  /* 学员 / 缴费 */
  addStudent(input: Pick<Student, "name" | "courseIds" | "note">): Student;
  updateStudent(id: ID, patch: Partial<Student>): void;
  removeStudent(id: ID): void;
  addPayment(input: Omit<Payment, "id">): void;
  removePayment(id: ID): void;
  /* 课表 / 课程 / 老师 */
  addTemplate(input: Omit<LessonTemplate, "id" | "active">): void;
  updateTemplate(id: ID, patch: Partial<LessonTemplate>): void;
  removeTemplate(id: ID): void;
  addCourse(input: Omit<Course, "id">): Course;
  updateCourse(id: ID, patch: Partial<Course>): void;
  addTeacher(input: Omit<Teacher, "id">): { ok: true } | { ok: false; reason: string };
  /* 待办 */
  toggleTodo(id: ID): void;
  addTodo(input: Omit<Todo, "id" | "done">): void;
  /* 设置 / 数据 */
  updateSettings(patch: Partial<Settings>): void;
  replaceState(next: State, reason: AuditEntry["kind"]): void;
  loadDemo(): void;
  clearAll(): void;
  setTier(t: Tier): void;
}

let repo: Repository | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist(get: () => Store, set: (p: Partial<Store>) => void) {
  if (!repo) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await repo!.save(get().s);
      if (get().saveError) set({ saveError: null });
    } catch (e) {
      set({ saveError: e instanceof Error ? e.message : String(e) });
    }
  }, 150);
}

function recordAudit(entry: AuditEntry) {
  void repo?.audit(entry);
}

export const useStore = create<Store>((set, get) => {
  /** 所有变更走这里：更新状态 + 触发持久化 */
  const commit = (patch: Partial<State>) => {
    set({ s: { ...get().s, ...patch } });
    persist(get, set);
  };
  const audited = (entry: AuditEntry) => {
    recordAudit(entry);
    return entry;
  };

  return {
    s: emptyState(),
    ready: false,
    saveError: null,
    route: { page: "today" },
    ent: createEntitlements("free"),

    async hydrate(r) {
      repo = r;
      const loaded = await r.load();
      set({ s: loaded ?? demoState(), ready: true });
      if (!loaded) persist(get, set);
    },

    go: (route) => set({ route }),

    complete(item) {
      const { lessons, audit } = completeLesson(get().s, item);
      commit({ lessons });
      audited(audit);
    },
    undo(lessonId) {
      const r = undoLesson(get().s, lessonId);
      if (!r) return;
      commit({ lessons: r.lessons });
      audited(r.audit);
    },
    cancel(item) {
      const { lessons, audit } = cancelLesson(get().s, item);
      commit({ lessons });
      audited(audit);
    },
    log(input) {
      const { lessons, audit } = logLesson(get().s, input);
      commit({ lessons });
      audited(audit);
    },
    copyLastWeek(date) {
      const added = copyFromLastWeek(get().s, date);
      if (added.length) commit({ lessons: [...get().s.lessons, ...added] });
      return added.length;
    },

    addStudent(input) {
      const st: Student = { id: uid("s"), ...input, createdAt: todayISO(), archived: false };
      commit({ students: [...get().s.students, st] });
      return st;
    },
    updateStudent(id, patch) {
      commit({ students: get().s.students.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
    },
    removeStudent(id) {
      const s = get().s;
      const st = s.students.find((x) => x.id === id);
      commit({
        students: s.students.filter((x) => x.id !== id),
        payments: s.payments.filter((x) => x.studentId !== id),
        lessons: s.lessons.filter((x) => x.studentId !== id),
        templates: s.templates.filter((x) => x.studentId !== id),
      });
      audited({ id: uid("a"), at: new Date().toISOString(), kind: "student.remove", summary: `删除学员 ${st?.name ?? id}`, payload: { studentId: id } });
    },
    addPayment(input) {
      const p: Payment = { id: uid("p"), ...input };
      commit({ payments: [...get().s.payments, p] });
      const name = get().s.students.find((x) => x.id === p.studentId)?.name ?? "";
      audited({ id: uid("a"), at: new Date().toISOString(), kind: "payment.add", summary: `${name} 缴费 ¥${p.amount} · ${p.hours} 课时`, payload: { ...p } });
    },
    removePayment(id) {
      const p = get().s.payments.find((x) => x.id === id);
      commit({ payments: get().s.payments.filter((x) => x.id !== id) });
      if (p) audited({ id: uid("a"), at: new Date().toISOString(), kind: "payment.remove", summary: `删除缴费 ¥${p.amount}`, payload: { ...p } });
    },

    addTemplate(input) {
      commit({ templates: [...get().s.templates, { id: uid("tp"), active: true, ...input }] });
    },
    updateTemplate(id, patch) {
      commit({ templates: get().s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
    },
    removeTemplate(id) {
      commit({ templates: get().s.templates.filter((t) => t.id !== id) });
    },
    addCourse(input) {
      const c: Course = { id: uid("c"), ...input };
      commit({ courses: [...get().s.courses, c] });
      return c;
    },
    updateCourse(id, patch) {
      commit({ courses: get().s.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
    },
    addTeacher(input) {
      const check = get().ent.check("teachers", get().s.teachers.length);
      if (!check.ok) return { ok: false, reason: check.reason };
      commit({ teachers: [...get().s.teachers, { id: uid("t"), ...input }] });
      return { ok: true };
    },

    toggleTodo(id) {
      commit({ todos: get().s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });
    },
    addTodo(input) {
      commit({ todos: [...get().s.todos, { id: uid("td"), done: false, ...input }] });
    },

    updateSettings(patch) {
      commit({ settings: { ...get().s.settings, ...patch } });
    },
    replaceState(next, reason) {
      set({ s: { ...emptyState(), ...next, version: 3 } });
      persist(get, set);
      audited({ id: uid("a"), at: new Date().toISOString(), kind: reason, summary: reason === "data.import" ? "导入数据" : "重置数据", payload: {} });
    },
    loadDemo() {
      get().replaceState(demoState(), "data.reset");
    },
    clearAll() {
      const keep = get().s.settings;
      get().replaceState({ ...emptyState(), settings: { ...keep, onboarded: true } }, "data.reset");
    },
    setTier: (t) => set({ ent: createEntitlements(t) }),
  };
});

/* ---------- 便捷 selector ---------- */
export const useState_ = () => useStore((x) => x.s);
export const useRoute = () => useStore((x) => x.route);
