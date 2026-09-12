import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { jarState } from "@/core/jar";
import { fmtMoney } from "@/core/finance";
import { addCoins, createWorld, stepWorld, type Coin } from "@/core/jar-physics";
import "./savings-jar.css";

function coin(ctx: CanvasRenderingContext2D, c: Coin, color: string, opacity = 1) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(Math.sin(c.x * 13 + c.y) * 0.35);
  ctx.globalAlpha = opacity * 0.7; ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, 1.6, c.r, c.r * 0.46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = opacity;
  ctx.beginPath(); ctx.ellipse(0, 0, c.r, c.r * 0.46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = opacity * 0.25; ctx.strokeStyle = color; ctx.lineWidth = 0.65;
  ctx.beginPath(); ctx.ellipse(0, -0.5, c.r * 0.75, c.r * 0.3, 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.restore();
}

export function SavingsJar() {
  const ref = useRef<HTMLCanvasElement>(null);
  const s = useStore((x) => x.s);
  const state = jarState(s);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const base = document.createElement("canvas");
    base.width = 320; base.height = 280;
    const b = base.getContext("2d");
    if (!b) return;
    let raf = 0, start = 0, last = 0, emitted = 0;
    let world = createWorld();
    let groups: { count: number; radius: number }[] = [];
    let total = 0, reverse = false;
    let accent = "", line = "", highlight = "", shadow = "", tint = "";
    let current = jarState(useStore.getState().s);
    const resize = () => { const dpr = window.devicePixelRatio || 1; canvas.width = Math.round(160 * dpr); canvas.height = Math.round(140 * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const colors = () => { const css = getComputedStyle(canvas); accent = css.getPropertyValue("--jar-coin").trim(); line = css.getPropertyValue("--line-strong").trim(); highlight = css.getPropertyValue("--jar-highlight").trim(); shadow = css.getPropertyValue("--jar-shadow").trim(); tint = css.getPropertyValue("--jar-tint").trim(); };
    const ellipse = (y: number, ry: number) => { ctx.beginPath(); ctx.ellipse(80, y, 57, ry, 0, 0, Math.PI * 2); };
    const rebuild = () => {
      current = jarState(useStore.getState().s);
      b.setTransform(2, 0, 0, 2, 0, 0); b.clearRect(0, 0, 160, 140);
      // A bounded texture represents accumulated money, independently of coin denomination.
      const height = current.fill * 82;
      for (let row = 0; row < Math.ceil(height / 3); row++) {
        for (let col = 0; col < 12; col++) {
          const x = 30 + col * 9 + (row % 2) * 3;
          const y = 121 - row * 3 + Math.sin(col * 7 + row * 3) * 1.4;
          if (x < 132 && y >= 123 - height) coin(b, { x, y, px: x, py: y, r: 4.7 + Math.sin(col + row) * 0.5 }, accent, 0.7 + ((row + col) % 4) * 0.1);
        }
      }
    };
    const draw = (progress = 0) => {
      ctx.clearRect(0, 0, 160, 140);
      ctx.strokeStyle = line; ctx.lineWidth = 0.8; ellipse(124, 12); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(23, 25, 114, 100); ctx.clip();
      ctx.drawImage(base, 0, 0, 160, 140);
      if (reverse) {
        for (let i = 0; i < Math.min(total, 240); i++) {
          const x = 30 + (i * 17 % 100), y = 122 - current.fill * 82;
          coin(ctx, { x: x + (80 - x) * progress, y: y + (15 - y) * progress, px: 0, py: 0, r: 4.5 }, accent, 1 - progress);
        }
      } else for (const c of world.coins) coin(ctx, c, accent, 0.85);
      ctx.restore();
      ctx.fillStyle = tint; ctx.fillRect(23, 25, 114, 99);
      for (const x of [24, 127]) { const g = ctx.createLinearGradient(x, 0, x + 9, 0); g.addColorStop(0, highlight); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.fillRect(x, 27, 9, 96); }
      ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(23, 25); ctx.lineTo(23, 124); ctx.moveTo(137, 25); ctx.lineTo(137, 124); ctx.stroke();
      ellipse(25, 14); ctx.stroke(); ellipse(27, 14); ctx.stroke(); ellipse(124, 12); ctx.stroke(); ellipse(127, 11); ctx.stroke();
      ctx.fillStyle = shadow; ellipse(124, 9); ctx.fill();
      ctx.beginPath(); ctx.roundRect(57, 23, 46, 3, 1.5); ctx.stroke();
      ctx.strokeStyle = highlight; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(80, 25, 55, 13, 0, Math.PI * 1.12, Math.PI * 1.6); ctx.stroke();
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; world = createWorld(); canvas.dataset.animating = "false"; };
    const finish = () => { stop(); rebuild(); draw(); };
    const tick = (now: number) => {
      const elapsed = now - start;
      if (reverse) { draw(Math.min(1, elapsed / 300)); if (elapsed >= 300) { finish(); return; } }
      else {
        const wanted = Math.min(total, Math.floor(elapsed / Math.min(18, 600 / Math.max(1, total))) + 1);
        while (emitted < wanted) {
          let offset = emitted, radius = 4.5;
          for (const g of groups) { if (offset < g.count) { radius = g.radius; break; } offset -= g.count; }
          world = addCoins(world, 1, radius, Math.random); emitted++;
          for (const c of world.deposited) coin(b, c, accent, 0.8);
        }
        let steps = 0;
        while (now - last >= 1000 / 60 && steps++ < 4) { world = stepWorld(world); last += 1000 / 60; }
        if (steps >= 4) last = now;
        draw();
        if (elapsed >= 900 || (emitted === total && world.sleeping)) { finish(); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    resize(); colors(); rebuild(); draw(); canvas.dataset.animating = "false";
    const unsubscribe = useStore.subscribe((next, prev) => {
      if (next.s === prev.s) return;
      if (next.jarFeedback.seq !== prev.jarFeedback.seq && next.jarFeedback.changes.length && !reduce.matches) {
        stop(); rebuild();
        const changes = next.jarFeedback.changes;
        reverse = changes.reduce((n, c) => n + c.amount, 0) < 0;
        const value = next.s.settings.coinValue.amount;
        groups = changes.map((c) => ({ count: Math.min(240, Math.max(1, Math.round(Math.abs(c.amount) / value))), radius: 4.5 * Math.max(0.85, Math.min(1.15, Math.abs(c.amount) / (value * 30))) }));
        total = Math.min(1000, groups.reduce((n, g) => n + g.count, 0));
        if (!reverse) { current = jarState(prev.s); const restore = current; /* Draw old balance until the new coins settle. */
          const height = restore.fill * 82;
          b.clearRect(0, 0, 160, 140);
          for (let row = 0; row < Math.ceil(height / 3); row++) for (let col = 0; col < 12; col++) {
            const x = 30 + col * 9 + (row % 2) * 3, y = 121 - row * 3;
            if (x < 132) coin(b, { x, y, px: x, py: y, r: 4.7 }, accent, 0.75 + (col % 3) * 0.1);
          }
        }
        world = createWorld(Math.max(40, 124 - current.fill * 82));
        emitted = 0; start = last = performance.now(); canvas.dataset.animating = "true"; raf = requestAnimationFrame(tick);
      } else { finish(); }
    });
    const redraw = () => { stop(); resize(); colors(); rebuild(); draw(); };
    const observer = new MutationObserver(redraw);
    observer.observe(root, { attributes: true, attributeFilter: ["data-appearance", "data-accent", "style"] });
    reduce.addEventListener("change", redraw); window.addEventListener("resize", redraw);
    const refresh = () => useStore.getState().refreshJarSettings();
    window.addEventListener("focus", refresh); refresh();
    return () => { stop(); unsubscribe(); observer.disconnect(); reduce.removeEventListener("change", redraw); window.removeEventListener("resize", redraw); window.removeEventListener("focus", refresh); };
  }, []);
  return <div className="savings-jar" title={`已确认收入 ${fmtMoney(state.amount)}，容量 ${fmtMoney(state.capacity)}`}>
    <canvas ref={ref} aria-label={`储蓄罐，${Math.round(state.fill * 100)}% 满，${fmtMoney(state.amount)}`} role="img" />
    <div className="jar-caption"><b>{fmtMoney(state.amount)}</b><span> / {fmtMoney(state.capacity)}</span></div>
  </div>;
}
