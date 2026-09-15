/** Composition root: route navigation and injected commands, no form logic. */
import { useState } from "react";
import { BookOpen, Users, GraduationCap } from "lucide-react";
import { useStore } from "@/store";
import type { Class, Course, Teacher } from "@/core/types";
import { nextTeacherColor } from "@/core/teacher";
import { CourseCatalog } from "@/ui/modules/course-catalog";
import { ClassManagement } from "@/ui/modules/class-management";
import { TeacherManagement } from "@/ui/modules/teacher-management";
import { ConfirmSheet } from "@/ui/widgets/ConfirmSheet";
import "./courses.css";

type Tab = "courses" | "classes" | "teachers";
type Deletion = { kind: "course"; item: Course } | { kind: "class"; item: Class } | { kind: "teacher"; item: Teacher };

export function CoursesPage() {
  const s = useStore(x => x.s);
  const ent = useStore(x => x.ent);
  const [tab, setTab] = useState<Tab>("courses");
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [error, setError] = useState("");
  const tabs = [
    { id: "courses" as const, label: "课程", description: "教什么 · 如何收费", count: s.courses.length, icon: <BookOpen size={20} /> },
    { id: "classes" as const, label: "班级", description: "一起上课 · 集中管理", count: s.classes.length, icon: <Users size={20} /> },
    { id: "teachers" as const, label: "老师", description: "谁来授课 · 如何结算", count: s.teachers.length, icon: <GraduationCap size={20} /> },
  ];
  const switchTab = (next: Tab) => { setTab(next); setError(""); };
  const remove = () => {
    if (!deletion) return;
    const actions = useStore.getState();
    if (deletion.kind === "class") { actions.removeClass(deletion.item.id); return; }
    if (deletion.kind === "course" && actions.s.classes.some(c => c.courseId === deletion.item.id)) {
      setError("还有班级使用这门课，请先修改或删除关联班级。"); return;
    }
    const result = deletion.kind === "course" ? actions.removeCourse(deletion.item.id) : actions.removeTeacher(deletion.item.id);
    setError(result.ok ? "" : result.reason);
  };
  return <div className="page teaching-page">
    <header className="page-head teaching-heading"><div><h1>教学管理</h1><p>把课程、班级和授课老师安排清楚。</p></div></header>
    <div className="teaching-tabs" role="tablist" aria-label="教学管理分类">
      {tabs.map((item, index) => <button type="button" key={item.id} id={`teaching-tab-${item.id}`} role="tab" aria-controls={`teaching-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => switchTab(item.id)} onKeyDown={event => {
        const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
        if (next < 0) return;
        event.preventDefault(); const id = tabs[next]!.id; switchTab(id); document.getElementById(`teaching-tab-${id}`)?.focus();
      }}><span className="teaching-tab-icon">{item.icon}</span><span className="teaching-tab-copy"><span className="teaching-tab-title">{item.label}<span className="teaching-tab-count">{item.count}</span></span><span className="teaching-tab-desc">{item.description}</span></span></button>)}
    </div>
    {error && <div className="banner-error" role="alert">{error}</div>}
    <div className="teaching-content" role="tabpanel" tabIndex={0} id={`teaching-panel-${tab}`} aria-labelledby={`teaching-tab-${tab}`}>
      {tab === "courses" && <CourseCatalog courses={s.courses} students={s.students} unitMinutes={s.settings.unitMinutes} onSave={(id, value) => { const actions = useStore.getState(); if (id) actions.updateCourse(id, value); else actions.addCourse(value); return { ok: true }; }} onDelete={item => setDeletion({ kind: "course", item })} onRules={unitMinutes => useStore.getState().updateSettings({ unitMinutes })} />}
      {tab === "classes" && <ClassManagement classes={s.classes} courses={s.courses} students={s.students} teachers={s.teachers} limit={ent.limit("classes")} memberLimit={ent.limit("classSize")} onCourses={() => switchTab("courses")} onSave={(id, value) => { const actions = useStore.getState(); return id ? actions.updateClass(id, value) : actions.addClass(value); }} onToggle={cls => {
        const actions = useStore.getState();
        if (!cls.active) { const check = actions.ent.check("classes", actions.s.classes.filter(c => c.active).length); if (!check.ok) return check; }
        return actions.updateClass(cls.id, { active: !cls.active });
      }} onDelete={item => setDeletion({ kind: "class", item })} />}
      {tab === "teachers" && <TeacherManagement teachers={s.teachers} defaultColor={nextTeacherColor(s)} limit={ent.limit("teachers")} onSave={(id, value) => {
        const actions = useStore.getState();
        if (!id) return actions.addTeacher(value);
        const self = actions.s.teachers.find(t => t.id === id)?.self;
        if (self) { actions.updateTeacher(id, { color: value.color }); actions.updateSettings({ teacherName: value.name }); }
        else actions.updateTeacher(id, value);
        return { ok: true };
      }} onDelete={item => setDeletion({ kind: "teacher", item })} />}
    </div>
    <ConfirmSheet open={!!deletion} onClose={() => setDeletion(null)} onConfirm={remove} title={`删除 ${deletion?.item.name ?? ""}？`} confirmLabel="确认删除">
      <p className="muted">{deletion?.kind === "class" ? "班级和它的固定课会被移除，已经打卡的记录保留。" : deletion?.kind === "teacher" ? "已上课记录保留，以后的排课和班级会改回由你授课。" : "存在关联学员或班级时不能删除。删除后，该课程的固定课也会移除。"}</p>
    </ConfirmSheet>
  </div>;
}
