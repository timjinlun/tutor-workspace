import { useState } from "react";
import { Button, Sheet } from "@/ui/primitives";

export function RenewalSheet({ name, remaining, copyText, onClose }: { name: string; remaining: number; copyText(text: string): Promise<boolean>; onClose(): void }) {
  const [text, setText] = useState(`${name}家长您好，${name}的课时还剩 ${remaining} 课时。方便时我们可以一起回顾最近的学习情况，并沟通下一阶段的安排。`);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = async () => {
    setBusy(true);
    try { setStatus(await copyText(text) ? "已复制，去微信粘贴发送" : "复制失败，请选中文案手动复制"); }
    catch { setStatus("复制失败，请选中文案手动复制"); }
    finally { setBusy(false); }
  };
  return <Sheet open onClose={onClose} title="续费提醒" sub="先修改文案，再复制给家长。不会自动发送。" wide>
    <textarea className="input" aria-label="续费提醒文案" style={{ minHeight: 180, userSelect: "text" }} value={text} onChange={(e) => { setText(e.target.value); setStatus(""); }} />
    <p role="status" style={{ marginTop: 12 }}>{status}</p>
    <div className="sheet-actions"><Button onClick={onClose}>关闭</Button><Button variant="primary" disabled={busy || !text.trim()} onClick={() => void copy()}>复制文案</Button></div>
  </Sheet>;
}
