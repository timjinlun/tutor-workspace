import type { ClosingDayData } from "@/core/closing-day";

export interface PosterPalette { paper: string; ink: string; muted: string; line: string; accent: string }
export function drawClosingPoster(canvas: HTMLCanvasElement, d: ClosingDayData, colors: PosterPalette, watermark: boolean) {
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法绘制海报，请重新打开收工卡片");
  const font = (weight: number, size: number) => `${weight} ${size}px -apple-system, "PingFang SC", system-ui, sans-serif`;
  const text = (value: string, x: number, y: number, size: number, weight = 500, color = colors.ink) => { ctx.font = font(weight, size); ctx.fillStyle = color; ctx.fillText(value, x, y); };
  const fit = (value: string, width: number) => {
    if (ctx.measureText(value).width <= width) return value;
    let out = value;
    while (out.length && ctx.measureText(out + "…").width > width) out = out.slice(0, -1);
    return out + "…";
  };
  ctx.fillStyle = colors.paper; ctx.fillRect(0, 0, 1080, 1350);
  // Deterministic fine grain, rendered once into the exported bitmap.
  ctx.fillStyle = colors.ink; ctx.globalAlpha = 0.018;
  for (let i = 0; i < 12000; i++) ctx.fillRect((i * 73.13) % 1080, (i * 119.71) % 1350, 1, 1);
  ctx.globalAlpha = 1;
  const date = new Date(d.date + "T00:00:00");
  text(`${date.getMonth() + 1}月${date.getDate()}日 · 周${"日一二三四五六"[date.getDay()]}`, 80, 104, 30, 500, colors.muted);
  ctx.textAlign = "right"; text("今日收工", 1000, 104, 28, 500, colors.muted); ctx.textAlign = "left";
  ctx.fillStyle = colors.line; ctx.fillRect(80, 140, 920, 1);
  text("今天，又完成了", 80, 235, 38, 500);
  text(String(d.lessons), 74, 412, 156, 700);
  ctx.font = font(700, 156); const numberWidth = ctx.measureText(String(d.lessons)).width;
  text("节课", 96 + numberWidth, 405, 46, 600);
  ctx.textAlign = "right"; text(`${Number(d.units.toFixed(2))} 课时`, 1000, 405, 42, 500, colors.muted); ctx.textAlign = "left";
  for (let i = 0; i < 29; i++) {
    ctx.fillStyle = colors.accent; ctx.globalAlpha = 0.5 + (i % 5) * 0.1;
    ctx.beginPath(); ctx.ellipse(96 + i * 31, 486, 11, 5, -0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(96 + i * 31, 483, 11, 5, -0.18, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  text("每一节，都记得", 80, 576, 24, 500, colors.muted);
  const maxRows = 6;
  const visible = d.rows.slice(0, d.rows.length > maxRows ? maxRows - 1 : maxRows);
  visible.forEach((row, i) => {
    const y = 642 + i * 65;
    ctx.font = font(500, 29); text(fit(row.title, 620), 80, y, 29);
    ctx.textAlign = "right"; text(`${row.start} – ${row.end}`, 1000, y, 26, 500, colors.muted); ctx.textAlign = "left";
    ctx.fillStyle = colors.line; ctx.fillRect(80, y + 24, 920, 1);
  });
  if (d.rows.length > maxRows) text(`另有 ${d.rows.length - visible.length} 节课`, 80, 642 + visible.length * 65, 28, 500, colors.muted);
  ctx.fillStyle = colors.line; ctx.fillRect(80, 1070, 920, 1);
  text(`这个月已经上了 ${d.monthLessons} 节`, 80, 1152, 35, 600);
  text(`连续第 ${d.streak} 天有课`, 80, 1210, 28, 500, colors.muted);
  if (watermark) { ctx.textAlign = "right"; text("记一课", 1000, 1280, 25, 600, colors.muted); ctx.textAlign = "left"; }
}
