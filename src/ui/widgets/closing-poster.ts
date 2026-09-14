import type { ClosingDayData } from "@/core/closing-day";

export interface PosterPalette { paper: string; ink: string; muted: string; line: string; accent: string }
export interface PosterOptions { showIncome?: boolean; income?: number; encouragement?: string }

export function drawClosingPoster(canvas: HTMLCanvasElement, d: ClosingDayData, colors: PosterPalette, watermark: boolean, options: PosterOptions = {}) {
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法绘制海报，请重新打开收工卡片");
  const font = (weight: number, size: number) => `${weight} ${size}px -apple-system, "PingFang SC", system-ui, sans-serif`;
  const text = (value: string, x: number, y: number, size: number, weight = 500, color = colors.ink) => {
    ctx.font = font(weight, size); ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string | CanvasGradient) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  };
  ctx.fillStyle = colors.paper; ctx.fillRect(0, 0, 1080, 1350);
  // Local, deterministic artwork: no image downloads or student details in exports.
  ctx.globalAlpha = 0.07;
  ellipse(930, 480, 560, 560, colors.accent);
  ctx.globalAlpha = 0.035;
  ellipse(120, 700, 440, 440, colors.accent);
  ctx.fillStyle = colors.ink; ctx.globalAlpha = 0.025;
  for (let i = 0; i < 16000; i++) ctx.fillRect((i * 73.13) % 1080, (i * 119.71) % 1350, 1, 1);
  ctx.globalAlpha = 1;
  text("独立授课 · 每日收获", 76, 90, 25, 600, colors.muted);
  ctx.textAlign = "right"; text(d.date.replaceAll("-", "."), 1004, 90, 25, 500, colors.muted); ctx.textAlign = "left";
  text("今日收工", 72, 225, 104, 800);
  text("认真教课，也认真经营自己的生活。", 80, 288, 29, 500, colors.muted);
  ctx.save(); ctx.translate(907, 198); ctx.rotate(-0.13);
  ctx.strokeStyle = colors.accent; ctx.lineWidth = 4; ctx.strokeRect(-72, -47, 144, 88);
  ctx.textAlign = "center"; text("有收获", 0, 10, 34, 700, colors.accent); ctx.restore();

  ctx.textAlign = "center";
  text(options.showIncome ? "今日授课收入" : "今天认真完成", 540, 392, 29, 600, colors.muted);
  const headline = options.showIncome ? `¥${(options.income ?? 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}` : `${d.lessons} 节课`;
  let size = 130;
  ctx.font = font(800, size);
  while (ctx.measureText(headline).width > 910 && size > 36) { size -= 2; ctx.font = font(800, size); }
  text(headline, 540, 541, size, 800);
  text(options.showIncome ? `完成 ${d.lessons} 节课  /  ${Number(d.units.toFixed(2))} 课时` : `${Number(d.units.toFixed(2))} 课时的专注，今天已交付`, 540, 601, 29, 500, colors.muted);

  // Fixed decorative pile: hiding income must not leak its magnitude through artwork.
  const shadow = ctx.createRadialGradient(540, 867, 20, 540, 867, 310);
  shadow.addColorStop(0, "#72532935"); shadow.addColorStop(1, "#72532900");
  ellipse(540, 867, 335, 53, shadow);
  for (let stack = 0; stack < 9; stack++) {
    const x = 285 + stack * 64;
    const count = [2, 4, 3, 6, 7, 5, 4, 3, 2][stack]!;
    for (let level = 0; level < count; level++) {
      const y = 852 - level * 21 + (stack % 2) * 9;
      const edge = ctx.createLinearGradient(x - 62, y, x + 62, y);
      edge.addColorStop(0, "#926026"); edge.addColorStop(0.32, "#eac176"); edge.addColorStop(0.7, "#ae762e"); edge.addColorStop(1, "#d6a44f");
      ellipse(x, y + 13, 65, 24, edge);
      const face = ctx.createLinearGradient(x - 50, y - 22, x + 40, y + 20);
      face.addColorStop(0, "#fff0bd"); face.addColorStop(0.45, "#e7bb66"); face.addColorStop(1, "#c99136");
      ellipse(x, y, 65, 24, face);
      ctx.strokeStyle = "#fff0bc"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, 55, 18, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.textAlign = "left";
  ctx.fillStyle = colors.line; ctx.fillRect(80, 952, 920, 2);
  text("把今天的认真，存成明天的底气。", 80, 1020, 35, 700);
  const quote = options.encouragement || "你认真上完的每一节课，都在为自己的生活积攒底气。";
  ctx.font = font(500, 28);
  const lines: string[] = []; let line = "";
  for (const char of quote) {
    if (ctx.measureText(line + char).width > 900 && line) { lines.push(line); line = char; }
    else line += char;
  }
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((value, i) => text(value, 80, 1081 + i * 43, 28, 500, colors.muted));
  text(`本月已完成 ${d.monthLessons} 节课`, 80, 1280, 25, 600, colors.muted);
  if (watermark) { ctx.textAlign = "right"; text("记一课", 1000, 1280, 25, 600, colors.muted); }
  ctx.textAlign = "left";
}
