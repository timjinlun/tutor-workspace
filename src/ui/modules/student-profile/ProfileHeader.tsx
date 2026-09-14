import type { Student } from "@/core/types";
import type { StudentTag } from "@/core/student-profile/selectors";
import type { BalanceLevel } from "@/core/finance";
import { Avatar, Button, Chip } from "@/ui/primitives";
import "./profile.css";

export function ProfileHeader({ student, tags, remaining, level, onEdit }: { student: Student; tags: StudentTag[]; remaining: number; level: BalanceLevel; onEdit(): void }) {
  return <header className="card dossier-header">
    <Avatar name={student.name} size="lg" />
    <div className="dossier-identity"><div className="dossier-name"><h2>{student.name}</h2>{student.archived && <Chip>已结课</Chip>}<Button variant="ghost" size="sm" onClick={onEdit}>编辑资料</Button></div>
      <p className="muted dossier-school">{[student.grade, student.school].filter(Boolean).join(" · ") || "随时补充你对这位学员的了解"}</p>
      <div className="dossier-tags">{tags.slice(0, 4).map((t) => <Chip key={t.key}>{t.label}</Chip>)}{tags.length > 4 && <Button size="sm" variant="ghost" onClick={onEdit}>＋{tags.length - 4}</Button>}</div>
      {student.goal && <p className="dossier-goal" title={student.goal}>学习目标：{student.goal}</p>}
    </div><div className={`dossier-balance ${level}`}><b>{remaining}</b><span>剩余课时</span></div>
  </header>;
}
