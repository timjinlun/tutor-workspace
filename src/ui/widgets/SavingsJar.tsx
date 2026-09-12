import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { scheduleCoins, type CoinEmission } from "@/core/coin-queue";
import { feedbackTiming } from "@/core/lesson-feedback";
import { jarState } from "@/core/jar";
import { fmtMoney } from "@/core/finance";
import { addCoins, createWorld, stepWorld, type Coin } from "@/core/jar-physics";
import { useLocalDay } from "./useLocalDay";
import "./savings-jar.css";
import { createJarRenderer } from "./jar-webgl";

export function SavingsJar() {
  const ref = useRef<HTMLCanvasElement>(null);
  const s = useStore((x) => x.s);
  const state = jarState(s);
  const day = useLocalDay();
  useEffect(() => useStore.getState().refreshJarSettings(), [day]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let renderer: ReturnType<typeof createJarRenderer>;
    try { renderer = createJarRenderer(canvas); } catch { canvas.dataset.renderer = "unavailable"; canvas.setAttribute("aria-label", "当前设备无法启用三维储蓄罐"); return; }
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let sceneHeight = 300, bottom = 284;
    let settled: Coin[] = [];
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0, last = 0, finishAt = 0, emitted = 0;
    let world = createWorld();
    let pending: CoinEmission[] = [];
    let outgoing: { coin: Coin; start: number }[] = [];
    const unsettled = new Map<string, number>();
    let current = jarState(useStore.getState().s);
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      sceneHeight = Math.max(140, Math.round(canvas.getBoundingClientRect().height)); bottom = sceneHeight - 16;
      canvas.width = Math.round(160 * dpr); canvas.height = Math.round(sceneHeight * dpr);
      renderer.resize(sceneHeight);
    };
    const rebuild = () => {
      current = jarState(useStore.getState().s);
      settled = [];
      // Bounded mesh instances represent accumulated money independently of denomination.
      const pendingAmount = [...unsettled.values()].reduce((n, amount) => n + amount, 0);
      const height = Math.max(0, Math.min(1, (current.amount - pendingAmount) / current.capacity)) * (bottom - 42);
      for (let row = 0; row < Math.ceil(height / 3); row++) {
        for (let col = 0; col < 12; col++) {
          const x = 30 + col * 9 + (row % 2) * 3;
          const y = bottom - 3 - row * 3 + Math.sin(col * 7 + row * 3) * 1.4;
          if (x < 132 && y >= bottom - 1 - height) settled.push({ x, y, px: x, py: y, r: 5.8 + Math.sin(col + row) * 0.5 });
        }
      }
    };
    const draw = (now = performance.now()) => {
      renderer.draw([...settled, ...world.coins, ...outgoing.map(({coin: c, start}) => {
        const progress = Math.min(1, (now - start) / 300);
        return {...c, x: c.x + (80-c.x)*progress, y: c.y + (15-c.y)*progress, r: c.r*(1-progress)};
      })]);
    };
    const stop = () => {
      clearTimeout(delayTimer); delayTimer = undefined; cancelAnimationFrame(raf); raf = 0;
      world = createWorld(); pending = []; outgoing = []; unsettled.clear(); canvas.dataset.animating = "false";
    };
    const finish = () => { stop(); rebuild(); draw(); };
    const tick = (now: number) => {
      delayTimer = undefined;
      while (pending[0] && pending[0].at <= now) {
        const entry = pending.shift()!;
        world = addCoins(world, 1, entry.radius, Math.random, entry.id); emitted++;
        canvas.dataset.emitted = String(emitted);
        settled.push(...world.deposited);
      }
      let steps = 0;
      while (now - last >= 1000 / 60 && steps++ < 4) { world = stepWorld(world); last += 1000 / 60; }
      if (steps >= 4) last = now;
      outgoing = outgoing.filter((item) => now - item.start < 300);
      draw(now);
      if (now >= finishAt && pending.length === 0 && outgoing.length === 0) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    resize(); rebuild(); draw(); canvas.dataset.animating = "false";
    const unsubscribe = useStore.subscribe((next, prev) => {
      if (next.s === prev.s) return;
      if (next.jarFeedback.seq === prev.jarFeedback.seq) {
        if (next.s.settings.jarCapacity !== prev.s.settings.jarCapacity) finish();
        return;
      }
      if (!next.jarFeedback.changes.length || reduce.matches) { finish(); return; }
      const now = performance.now();
      const changes = next.jarFeedback.changes;
      const value = next.s.settings.coinValue.amount;
      const delay = feedbackTiming(next.jarFeedback.monthDelta ?? 0, !!next.jarFeedback.origin, reduce.matches).jarDelay;
      for (const change of changes) {
        if (change.amount > 0) unsettled.set(change.id, (unsettled.get(change.id) ?? 0) + change.amount);
        else {
          const activeCoins = world.coins.filter((c) => c.lessonId === change.id);
          const wasPending = unsettled.has(change.id);
          const count = wasPending ? activeCoins.length : Math.min(240, Math.max(1, Math.round(-change.amount / value)));
          for (let i = 0; i < count; i++) outgoing.push({ coin: activeCoins[i] ?? { x: 30 + (i * 17 % 100), y: bottom - 2 - current.fill * (bottom - 42), px: 0, py: 0, r: 4.5 }, start: now });
          world = { ...world, coins: world.coins.filter((c) => c.lessonId !== change.id) };
          unsettled.delete(change.id);
        }
      }
      pending = scheduleCoins(pending, changes, value, now, delay);
      rebuild();
      const settledFill = Math.max(0, Math.min(1, (current.amount - [...unsettled.values()].reduce((n, amount) => n + amount, 0)) / current.capacity));
      world = { ...world, floor: Math.max(40, bottom - settledFill * (bottom - 42)) };
      finishAt = Math.max(finishAt, now + (changes.some((c) => c.amount > 0) ? delay + 900 : 300));
      canvas.dataset.animating = "true"; draw(now);
      if (!raf) {
        clearTimeout(delayTimer);
        last = now;
        const wait = outgoing.length ? 0 : Math.max(0, (pending[0]?.at ?? now) - now);
        delayTimer = setTimeout(() => { delayTimer = undefined; last = performance.now(); raf = requestAnimationFrame(tick); }, wait);
      }
    });
    const redraw = () => { stop(); resize(); rebuild(); draw(); };
    let pointerX: number | null = null, pointerY = 0;
    const down = (event: PointerEvent) => { pointerX = event.clientX; pointerY = event.clientY; canvas.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (pointerX === null) return; renderer.rotate((event.clientX-pointerX)*.012,(event.clientY-pointerY)*.008); pointerX=event.clientX;pointerY=event.clientY; draw(); };
    const up = () => { pointerX = null; };
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    const lost = (event: Event) => { event.preventDefault(); stop(); canvas.dataset.renderer = "context-lost"; };
    const restored = () => { renderer.dispose(); renderer=createJarRenderer(canvas); redraw(); };
    canvas.addEventListener("webglcontextlost", lost); canvas.addEventListener("webglcontextrestored", restored);
    const observer = new MutationObserver(redraw);
    observer.observe(root, { attributes: true, attributeFilter: ["data-appearance", "data-accent", "style"] });
    const sizeObserver = new ResizeObserver(redraw); sizeObserver.observe(canvas);
    reduce.addEventListener("change", redraw); window.addEventListener("resize", redraw);
    const refresh = () => useStore.getState().refreshJarSettings();
    window.addEventListener("focus", refresh); refresh();
    return () => { stop(); renderer.dispose(); canvas.removeEventListener("webglcontextlost", lost); canvas.removeEventListener("webglcontextrestored", restored); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); unsubscribe(); observer.disconnect(); sizeObserver.disconnect(); reduce.removeEventListener("change", redraw); window.removeEventListener("resize", redraw); window.removeEventListener("focus", refresh); };
  }, []);
  return <div className="savings-jar" title={`已确认收入 ${fmtMoney(state.amount)}，容量 ${fmtMoney(state.capacity)}`}>
    <canvas ref={ref} aria-label={`储蓄罐，${Math.round(state.fill * 100)}% 满，${fmtMoney(state.amount)}`} role="img" />
    <div className="jar-caption"><b>{fmtMoney(state.amount)}</b><span> / {fmtMoney(state.capacity)}</span></div>
  </div>;
}
