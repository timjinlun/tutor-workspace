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
}

export interface Student {
  id: ID;
  name: string;
  courseIds: ID[];
  note: string;
  /** 推荐人（转介绍） */
  referrerId?: ID;
  createdAt: ISODate;
  archived: boolean;
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
  studentId: ID;
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
  doneAt?: string;
  createdAt: string;
  note?: string;
}

export interface AuditEntry {
  id: ID;
  at: string;
  kind: "lesson.done" | "lesson.undo" | "lesson.cancel" | "lesson.log" | "payment.add" | "payment.remove" | "student.remove" | "data.import" | "data.reset";
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

export interface Settings {
  teacherName: string;
  accent: Accent;
  appearance: Appearance;
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
  lowBalanceThreshold: 4,
  remindAhead: 2,
  onboarded: false,
};

export function emptyState(): State {
  return {
    version: 3,
    teachers: [],
    courses: [],
    students: [],
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
