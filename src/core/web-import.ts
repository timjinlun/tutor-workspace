/**
 * 网页版（学员课时统计面板）导出的 JSON → 记一课的 State 字段。
 * 网页版把上过的课存成 attendance[学员id][日期]，值可能是数字、一条记录或记录数组；这里展开成 lessons。
 * 缴费两边字段一样，原样保留。
 */
import type { Course, Lesson, State, Student, Teacher } from "./types";

type Rec = Record<string, unknown>;

const HHMM = /^\d{2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const list = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter((x): x is Rec => !!x && typeof x === "object") : []);
const positive = (v: unknown): number | undefined => (typeof v === "number" && v > 0 ? v : undefined);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const time = (v: unknown): string => (typeof v === "string" && HHMM.test(v) ? v : "");

/** 网页版的特征：有 attendance、没有 lessons */
export function isWebExport(raw: unknown): raw is Rec {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Rec;
  return !!r.attendance && typeof r.attendance === "object" && !Array.isArray(r.lessons);
}

export function fromWebExport(raw: Rec): Partial<State> {
  const courses: Course[] = list(raw.courses).map((c) => ({
    id: str(c.id),
    name: str(c.name),
    price: typeof c.price === "number" ? c.price : 0,
    unitsPerLesson: positive(c.unitsPerSession) ?? 1,
  }));
  const courseOf = new Map(courses.map((c) => [c.id, c]));
  const firstCourse = courses[0]?.id ?? "";

  const students: Student[] = list(raw.students).map((st, i) => {
    const { courseId, courseIds, ...rest } = st;
    const ids = Array.isArray(courseIds) && courseIds.length ? courseIds.map(str) : courseId ? [str(courseId)] : firstCourse ? [firstCourse] : [];
    return { ...rest, id: str(st.id), name: str(st.name), courseIds: [...new Set(ids.filter(Boolean))], note: str(st.note), createdAt: "", archived: false, sortOrder: i } as Student;
  });
  const primaryCourse = new Map(students.map((st) => [st.id, st.courseIds[0] ?? firstCourse]));

  const teachers: Teacher[] = list(raw.teachers).map((t) => ({ id: str(t.id), name: str(t.name), color: str(t.color) || "#3b82f6" }));
  const schedules = list(raw.schedules);
  const teacherOfSchedule = new Map(schedules.map((sc) => [str(sc.id), str(sc.teacherId) || undefined]));

  const lessons: Lesson[] = [];
  for (const [studentId, byDate] of Object.entries((raw.attendance ?? {}) as Record<string, unknown>)) {
    if (!byDate || typeof byDate !== "object") continue;
    for (const date of Object.keys(byDate).filter((d) => DATE.test(d)).sort()) {
      const value = (byDate as Rec)[date];
      if (!value) continue;
      (Array.isArray(value) ? value : [value]).forEach((v, i) => {
        const r: Rec = v && typeof v === "object" ? (v as Rec) : { time: v };
        const courseId = str(r.courseId) || primaryCourse.get(studentId) || firstCourse;
        lessons.push({
          id: `web-${studentId}-${date}-${i}`,
          studentId,
          courseId,
          teacherId: teacherOfSchedule.get(str(r.scheduleId)),
          date,
          time: time(r.time),
          status: "done",
          /* 网页版老记录没有 units，一条就算 1 课时 */
          units: positive(r.units) ?? 1,
          price: typeof r.price === "number" ? r.price : (courseOf.get(courseId)?.price ?? 0),
          source: "backfill",
          doneAt: date,
          createdAt: date,
        });
      });
    }
  }
  /* 已完成的排课在 attendance 里已经有了，取消的不用带 */
  for (const sc of schedules.filter((x) => x.status === "pending" && DATE.test(str(x.date)))) {
    const studentId = str(sc.studentId);
    const courseId = str(sc.courseId) || primaryCourse.get(studentId) || firstCourse;
    const course = courseOf.get(courseId);
    lessons.push({
      id: `web-${str(sc.id)}`,
      studentId,
      courseId,
      teacherId: str(sc.teacherId) || undefined,
      date: str(sc.date),
      time: time(sc.time),
      status: "scheduled",
      units: course?.unitsPerLesson ?? 1,
      price: course?.price ?? 0,
      source: "manual",
      createdAt: str(sc.date),
      note: str(sc.note) || undefined,
    });
  }

  const rest: Rec = { ...raw };
  delete rest.attendance;
  delete rest.schedules;
  return { ...(rest as Partial<State>), courses, students, teachers, lessons };
}
