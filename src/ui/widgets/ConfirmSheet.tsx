/** 危险操作的二次确认。撤销打卡、删除学员都走这里。 */
import type { ReactNode } from "react";
import { Button, Sheet } from "@/ui/primitives";

export function ConfirmSheet({ open, onClose, onConfirm, title, children, confirmLabel = "确认", danger = true }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; children?: ReactNode; confirmLabel?: string; danger?: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {children}
      <div className="sheet-actions">
        <Button onClick={onClose}>取消</Button>
        <Button variant={danger ? "danger" : "primary"} solid={danger} onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
