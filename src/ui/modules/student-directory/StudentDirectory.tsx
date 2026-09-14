import { useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Student } from "@/core/types";
import type { StudentTag } from "@/core/student-profile/selectors";
import type { BalanceLevel } from "@/core/finance";
import { Avatar, Button, Select } from "@/ui/primitives";
import "./directory.css";

export interface DirectoryStudent { student: Student; remaining: number; level: BalanceLevel; courses: string }
export function StudentDirectory({ active, archived, selectedId, tags, selectedTags, query, sort, onQuery, onTags, onSort, onSelect, onReorder }: {
  active: DirectoryStudent[]; archived: DirectoryStudent[]; selectedId?: string; tags: StudentTag[]; selectedTags: string[]; query: string; sort: "manual" | "balance";
  onQuery(value: string): void; onTags(value: string[]): void; onSort(value: "manual" | "balance"): void; onSelect(id: string): void; onReorder(ids: string[]): void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const draggable = sort === "manual" && !query.trim() && !selectedTags.length;
  return <aside className="student-directory card">
    <input className="input directory-search" aria-label="搜索学员" placeholder="搜索姓名、课程或标签" value={query} onChange={(e) => onQuery(e.target.value)} />
    <div className="directory-tools"><Button size="sm" variant="ghost" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>筛选{selectedTags.length ? ` · ${selectedTags.length}` : ""}</Button><Select aria-label="学员排序" value={sort} onChange={(e) => onSort(e.target.value as "manual" | "balance")}><option value="manual">手动排序</option><option value="balance">按余额</option></Select></div>
    {filtersOpen && <div className="directory-filters"><p>同时满足所选标签</p>{(["course", "format", "custom"] as const).map((kind) => <fieldset key={kind}><legend>{{ course: "课程", format: "授课方式", custom: "自定义" }[kind]}</legend>{tags.filter((t) => t.kind === kind).map((t) => <label key={t.key}><input type="checkbox" checked={selectedTags.includes(t.key)} onChange={(e) => onTags(e.target.checked ? [...selectedTags, t.key] : selectedTags.filter((key) => key !== t.key))} />{t.label}</label>)}</fieldset>)}</div>}
    {!!selectedTags.length && <div className="directory-selected"><span>{selectedTags.map((key) => tags.find((t) => t.key === key)?.label ?? key.replace(/^.*?:/, "")).join(" · ")}</span><Button size="sm" variant="ghost" onClick={() => onTags([])}>清除</Button></div>}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active: a, over }) => {
      if (!draggable || !over || a.id === over.id) return;
      const ids = active.map((row) => row.student.id); const from = ids.indexOf(String(a.id)); const to = ids.indexOf(String(over.id));
      if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to));
    }}><SortableContext items={active.map((row) => row.student.id)} strategy={verticalListSortingStrategy}>{active.map((row) => <DirectoryRow key={row.student.id} row={row} selected={selectedId === row.student.id} draggable={draggable} onSelect={() => onSelect(row.student.id)} />)}</SortableContext></DndContext>
    {!active.length && <p className="directory-empty">{query || selectedTags.length ? "没有匹配的在读学员" : "还没有在读学员"}</p>}
    {!!archived.length && <details className="directory-archived"><summary>已结课（{archived.length}）</summary>{archived.map((row) => <button key={row.student.id} className={`directory-archived-row ${selectedId === row.student.id ? "selected" : ""}`} onClick={() => onSelect(row.student.id)}>{row.student.name}<span>{row.remaining} 课时</span></button>)}</details>}
  </aside>;
}
function DirectoryRow({ row, selected, draggable, onSelect }: { row: DirectoryStudent; selected: boolean; draggable: boolean; onSelect(): void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.student.id, disabled: !draggable });
  return <div ref={setNodeRef} className={`directory-row ${selected ? "selected" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}>
    {draggable && <button className="directory-grip" {...attributes} {...listeners} aria-label={`拖动排序 ${row.student.name}`}><GripVertical size={13} /></button>}
    <button className="directory-person" aria-pressed={selected} onClick={onSelect}><Avatar name={row.student.name} size="sm" /><span className="directory-name"><b>{row.student.name}</b><small>{row.courses || "未选课程"}</small></span><span className={`directory-balance ${row.level}`}>{row.remaining}<small>课时</small></span></button>
  </div>;
}
