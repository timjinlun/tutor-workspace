/** 家长报告 / 经营月报：生成文字，复制即用。PDF 导出属于商业版。 */
import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { useStore } from "@/store";
import { monthlyReport } from "@/core/report";
import { Button, Sheet } from "@/ui/primitives";
import { platform } from "@/platform";
import { ParentReport } from "@/ui/modules/parent-report";

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
  return open ? <ParentReport state={s} studentId={studentId} customRangeAllowed={ent.can("reports.customRange")} copyText={platform.copyText} onClose={onClose} /> : null;
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
