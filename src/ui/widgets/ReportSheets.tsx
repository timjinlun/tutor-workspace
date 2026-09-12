/** 家长报告 / 经营月报：生成文字，复制即用。PDF 导出属于商业版。 */
import { useMemo, useState } from "react";
import { Copy, Lock } from "lucide-react";
import { useStore } from "@/store";
import { monthlyReport, parentReport } from "@/core/report";
import { monthKey, todayISO } from "@/core/date";
import { Button, Chip, Field, Input, Sheet } from "@/ui/primitives";
import { platform } from "@/platform";

function useCopy() {
  const [done, setDone] = useState(false);
  return {
    done,
    copy: async (text: string) => {
      if (await platform.copyText(text)) {
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }
    },
  };
}

export function ParentReportSheet({ open, onClose, studentId }: { open: boolean; onClose: () => void; studentId: string }) {
  const s = useStore((x) => x.s);
  const ent = useStore((x) => x.ent);
  const [ym, setYm] = useState(monthKey(todayISO()));
  const [note, setNote] = useState("");
  const text = useMemo(() => parentReport(s, { studentId, ym, teacherName: s.settings.teacherName, note }), [s, studentId, ym, note]);
  const { done, copy } = useCopy();
  return (
    <Sheet open={open} onClose={onClose} title="家长报告" sub="生成一段可以直接发给家长的文字。" wide>
      <div className="grid-2">
        <Field label="月份"><Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} /></Field>
        <Field label="老师的话（可选）"><Input value={note} placeholder="这个月进步很大…" onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <pre className="report-pre select-text">{text}</pre>
      <div className="sheet-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <Chip>{ent.can("reports.pdf") ? "可导出 PDF" : <><Lock size={11} /> 导出 PDF · 商业版</>}</Chip>
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={onClose}>关闭</Button>
          <Button variant="primary" icon={<Copy />} onClick={() => copy(text)}>{done ? "已复制" : "复制"}</Button>
        </div>
      </div>
    </Sheet>
  );
}

export function MonthlyReportSheet({ open, onClose, ym }: { open: boolean; onClose: () => void; ym: string }) {
  const s = useStore((x) => x.s);
  const text = useMemo(() => monthlyReport(s, ym), [s, ym]);
  const { done, copy } = useCopy();
  return (
    <Sheet open={open} onClose={onClose} title="经营月报" wide>
      <pre className="report-pre select-text">{text}</pre>
      <div className="sheet-actions">
        <Button onClick={onClose}>关闭</Button>
        <Button variant="primary" icon={<Copy />} onClick={() => copy(text)}>{done ? "已复制" : "复制"}</Button>
      </div>
    </Sheet>
  );
}
