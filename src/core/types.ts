/** 领域模型。纯类型，无逻辑。所有日期为 YYYY-MM-DD，时间为 HH:mm。 */

export type ID = string;
export type ISODate = string;
export type HHMM = string;

export interface Teacher {
  id: ID;
  name: string;
  color: string;
}

export interface Course {
  id: ID;
  name: string;
  /** 每课时单价 */
  price: number;
  /** 一节课折算几个课时，默认 1 */
  unitsPerLesson: number;
  /** 这门课 1 课时多少分钟；不填用 Settings.unitMinutes */
  unitMinutes?: number;
}

/**
 * 班级（小班课）。打卡仍然按人落 Lesson 记录（各扣各的课时），班级只负责成员、定价和缺席规则。
 * UI 在 3.3 做，模型先定好。
 */
export interface Class {
  id: ID;
  name: string;
  courseId: ID;
  teacherId?: ID;
  studentIds: ID[];
  /** 每人每课时价格；不填用课程单价 */
  pricePerUnit?: number;
  /** 缺席的学员是否也扣课时 */
  deductOnAbsence: boolean;
  active: boolean;
}

export interface Student {
  id: ID;
  name: string;
  courseIds: ID[];
  note: string;
  /** 推荐人（转介绍） */
  referrerId?: ID;
  createdAt: ISODate;
  /** 已结课：排到最后，可恢复 */
  archived: boolean;
  /** 手动排序位次 */
  sortOrder: number;
}

export interface Payment {
  id: ID;
  studentId: ID;
  date: ISODate;
  amount: number;
  /** 购买的课时数 */
  hours: number;
  note: string;
}

/** 固定课表：每周几、几点、谁、什么课 */
export interface LessonTemplate {
  id: ID;
  /** 一对一：学员；班课：classId，studentId 留空 */
  studentId: ID;
  classId?: ID;
  courseId: ID;
  teacherId?: ID;
  /** 0 = 周日 … 6 = 周六，与 Date#getDay 一致 */
  weekday: number;
  time: HHMM;
  active: boolean;
}

export type LessonStatus = "scheduled" | "done" | "cancelled";
/** template：由固定课表生成；manual：临时排的；backfill：上完才补记的 */
export type LessonSource = "template" | "manual" | "backfill";

/** 一节课。打卡 = 把它从 scheduled 变成 done。 */
export interface Lesson {
  id: ID;
  studentId: ID;
  courseId: ID;
  teacherId?: ID;
  date: ISODate;
  time: HHMM;
  status: LessonStatus;
  /** 本节消耗课时 */
  units: number;
  /** 打卡时锁定的单价，之后改课程价格不影响历史 */
  price: number;
  source: LessonSource;
  templateId?: ID;
  /** 班课：属于哪个班；同一次班课的各学员记录共享 groupId */
  classId?: ID;
  groupId?: ID;
  /** 班课点名结果；一对一没有这个字段 */
  attendance?: "present" | "absent";
  doneAt?: string;
  createdAt: string;
  note?: string;
}

export interface AuditEntry {
  id: ID;
  at: string;
  kind: "lesson.done" | "lesson.undo" | "lesson.cancel" | "lesson.log" | "lesson.schedule" | "lesson.move" | "payment.add" | "payment.remove" | "student.remove" | "data.import" | "data.reset";
  summary: string;
  payload: Record<string, unknown>;
}

export interface Todo {
  id: ID;
  title: string;
  due: ISODate;
  priority: "P0" | "P1" | "P2";
  done: boolean;
  note: string;
}

export interface Expense {
  id: ID;
  date: ISODate;
  category: string;
  amount: number;
  note: string;
}

export interface OtherIncome {
  id: ID;
  date: ISODate;
  source: string;
  amount: number;
  note: string;
}

export type LeadStatus = "new" | "contacted" | "trial" | "won" | "lost";

export interface Lead {
  id: ID;
  name: string;
  phone: string;
  source: string;
  status: LeadStatus;
  intent: number;
  note: string;
  referrerId?: ID;
  createdAt: ISODate;
  lastFollow: ISODate;
}

export interface Material {
  id: ID;
  title: string;
  type: string;
  courseId?: ID;
  studentId?: ID;
  content: string;
  url: string;
  tags: string;
  createdAt: ISODate;
}

export type Accent = "coral" | "indigo" | "system";
export type Appearance = "system" | "light" | "dark";
/** 主界面背景：无 / 极光 / 网格 / 自定义图片 */
export type Background = "none" | "aurora" | "mesh" | "custom";

export interface Settings {
  teacherName: string;
  accent: Accent;
  appearance: Appearance;
  background: Background;
  /** 默认 1 课时 = 多少分钟 */
  unitMinutes: number;
  /** 剩余课时 ≤ 该值：红色提醒 */
  lowBalanceThreshold: number;
  /** 剩余课时 ≤ 阈值 + 该值：黄色提醒 */
  remindAhead: number;
  onboarded: boolean;
}

export interface State {
  version: 3;
  teachers: Teacher[];
  courses: Course[];
  students: Student[];
  classes: Class[];
  payments: Payment[];
  templates: LessonTemplate[];
  lessons: Lesson[];
  todos: Todo[];
  expenses: Expense[];
  otherIncomes: OtherIncome[];
  leads: Lead[];
  materials: Material[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  teacherName: "老师",
  accent: "coral",
  appearance: "system",
  background: "aurora",
  unitMinutes: 60,
  lowBalanceThreshold: 4,
  remindAhead: 2,
  onboarded: false,
};

/** 读入旧存档时补齐新字段；每次加字段都在这里补默认值，别处不用管 */
export function normalizeState(raw: Partial<State> | null | undefined): State {
  const base = emptyState();
  const s: State = { ...base, ...(raw ?? {}), version: 3, settings: { ...DEFAULT_SETTINGS, ...(raw?.settings ?? {}) } };
  s.classes = Array.isArray(s.classes) ? s.classes : [];
  s.students = s.students.map((st, i) => ({ ...st, sortOrder: typeof st.sortOrder === "number" ? st.sortOrder : i, archived: !!st.archived }));
  return s;
}

export function emptyState(): State {
  return {
    version: 3,
    teachers: [],
    courses: [],
    students: [],
    classes: [],
    payments: [],
    templates: [],
    lessons: [],
    todos: [],
    expenses: [],
    otherIncomes: [],
    leads: [],
    materials: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}
