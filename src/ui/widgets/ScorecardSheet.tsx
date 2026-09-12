/**
 * 成绩卡：把本月的几个数画成一张 1080×1350（小红书 4:5）的图，保存后直接发。
 * 画在 canvas 上，不依赖任何库；免费版带角标水印。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Lock } from "lucide-react";
import { useStore } from "@/store";
import { scorecardData, type ScorecardData } from "@/core/scorecard";
import { monthKey, todayISO } from "@/core/date";
import { Button, Chip, Field, Input, Sheet } from "@/ui/primitives";
import { platform } from "@/platform";

const W = 1080, H = 1350;

export function ScorecardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore((x) => x.s);
  const ent = useStore((x) => x.ent);
  const [ym, setYm] = useState(monthKey(todayISO()));
  const data = useMemo(() => scorecardData(s, ym), [s, ym]);
  const ref = useRef<HTMLCanvasElement>(null);
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff6b4a";
  const watermark = !ent.can("scorecard.noWatermark");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || !ref.current) return;
    draw(ref.current, data, accent, watermark);
  }, [open, data, accent, watermark]);

  const save = async () => {
    const c = ref.current;
    if (!c) return;
    const ok = await platform.data.saveImage(c.toDataURL("image/png"), `成绩卡_${ym}.png`);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 1800); }
  };

  return (
    <Sheet open={open} onClose={onClose} title="成绩卡" sub="月底晒一张，发小红书或朋友圈。" wide>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <canvas ref={ref} width={W} height={H} style={{ width: 270, height: 337, borderRadius: 14, boxShadow: "var(--shadow-card)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <Field label="月份"><Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} /></Field>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
            上课 {data.lessons} 次 · {data.units} 课时<br />确认收入 ¥{data.income.toLocaleString("zh-CN")}<br />{data.students} 位学员{data.topStudent ? ` · 最勤奋：${data.topStudent.name}` : ""}
          </div>
          <div style={{ marginTop: 12 }}>{watermark ? <Chip><Lock size={11} /> 去水印 · 商业版</Chip> : <Chip tone="green">无水印</Chip>}</div>
        </div>
      </div>
      <div className="sheet-actions">
        <Button onClick={onClose}>关闭</Button>
        <Button variant="primary" icon={<Download />} onClick={save}>{saved ? "已保存" : "保存图片"}</Button>
      </div>
    </Sheet>
  );
}

function draw(canvas: HTMLCanvasElement, d: ScorecardData, accent: string, watermark: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const font = (w: number, size: number, rounded = false) => `${w} ${size}px ${rounded ? 'ui-rounded, "SF Pro Rounded", ' : ""}-apple-system, "PingFang SC", system-ui, sans-serif`;
  /* 背景：强调色渐变 */
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, accent);
  g.addColorStop(1, shade(accent, -0.28));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  /* 柔光圆 */
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath(); ctx.arc(W * 0.85, H * 0.18, 260, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath(); ctx.arc(W * 0.15, H * 0.9, 320, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = font(600, 40);
  const [y, m] = d.ym.split("-");
  ctx.fillText(`${y} 年 ${Number(m)} 月`, 88, 150);
  ctx.font = font(500, 34);
  ctx.fillText(`${d.teacherName} 的教学月报`, 88, 205);

  ctx.fillStyle = "#fff";
  ctx.font = font(800, 300, true);
  ctx.fillText(String(d.lessons), 80, 560);
  ctx.font = font(600, 44);
  ctx.fillText("节课", 88 + ctx.measureText(String(d.lessons)).width * 0 + measure(ctx, String(d.lessons), font(800, 300, true)) + 20, 560);

  const stats: [string, string][] = [
    ["课时", String(d.units)],
    ["学员", String(d.students)],
    ["有课的周", String(d.weeks)],
  ];
  stats.forEach(([label, val], i) => {
    const x = 88 + i * 300;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = font(500, 30);
    ctx.fillText(label, x, 700);
    ctx.fillStyle = "#fff";
    ctx.font = font(700, 84, true);
    ctx.fillText(val, x, 790);
  });

  /* 白卡：最勤奋 + 收入 */
  roundRect(ctx, 72, 880, W - 144, 300, 36);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.font = font(500, 30);
  ctx.fillText("最勤奋的学员", 120, 955);
  ctx.fillText("本月确认收入", 560, 955);
  ctx.fillStyle = "#1d1d1f";
  ctx.font = font(700, 64, true);
  ctx.fillText(d.topStudent ? `${d.topStudent.name} · ${d.topStudent.units} 课时` : "—", 120, 1040);
  ctx.fillText(`¥${d.income.toLocaleString("zh-CN")}`, 560, 1040);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.font = font(500, 28);
  ctx.fillText("坚持每一节课，才有这样的月份。", 120, 1130);

  if (watermark) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = font(500, 26);
    ctx.textAlign = "right";
    ctx.fillText("独立老师工作台", W - 80, H - 60);
    ctx.textAlign = "left";
  }
}

function measure(ctx: CanvasRenderingContext2D, text: string, f: string) {
  const prev = ctx.font;
  ctx.font = f;
  const w = ctx.measureText(text).width;
  ctx.font = prev;
  return w;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex: string, amt: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}
