import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { scheduleCoins, type CoinEmission } from "@/core/coin-queue";
import { feedbackTiming } from "@/core/lesson-feedback";
import { jarState } from "@/core/jar";
import { fmtMoney } from "@/core/finance";
import { buildJarVisualPile } from "@/core/jar-pile";
import { createJarPhysics3D, type PhysicsCoinPose } from "@/core/jar-physics-3d";
import type { Quaternion } from "@/core/jar-mesh";
import { useLocalDay } from "./useLocalDay";
import { createJarRenderer } from "./jar-webgl";
import "./savings-jar.css";

const COIN_RADIUS = 0.082;
const COIN_HALF_HEIGHT = 0.018;

function multiplyQuaternion(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function visualPile(fill: number, height: number): PhysicsCoinPose[] {
  return buildJarVisualPile(fill, height, COIN_RADIUS, COIN_HALF_HEIGHT).map((coin, index) => {
    const hx = coin.tiltX / 2;
    const hz = coin.tiltZ / 2;
    const tilt = {
      x: Math.cos(hz) * Math.sin(hx),
      y: Math.sin(hz) * Math.sin(hx),
      z: Math.sin(hz) * Math.cos(hx),
      w: Math.cos(hz) * Math.cos(hx),
    };
    const yaw = { x: 0, y: Math.sin(coin.yaw / 2), z: 0, w: Math.cos(coin.yaw / 2) };
    return {
      id: `stable-${index}`,
      position: { x: coin.x, y: coin.y, z: coin.z },
      rotation: multiplyQuaternion(yaw, tilt),
      radius: COIN_RADIUS,
      halfHeight: COIN_HALF_HEIGHT,
    };
  });
}

function poseSignature(poses: PhysicsCoinPose[]) {
  return poses.slice(0, 24).map((pose) => [
    pose.position.x, pose.position.y, pose.position.z,
    pose.rotation.x, pose.rotation.z,
  ].map((value) => value.toFixed(3)).join(",")).join(";");
}

export function CoinPile() {
  const ref = useRef<HTMLCanvasElement>(null);
  const s = useStore((state) => state.s);
  const state = jarState(s);
  const day = useLocalDay();
  useEffect(() => useStore.getState().refreshJarSettings(), [day]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let disposed = false;
    let teardown: (() => void) | undefined;

    const setup = async () => {
      let renderer: ReturnType<typeof createJarRenderer>;
      try {
        renderer = createJarRenderer(canvas);
      } catch {
        canvas.dataset.renderer = "unavailable";
        canvas.setAttribute("aria-label", "当前设备无法启用三维金币堆");
        return () => undefined;
      }
      let sceneHeight = Math.max(140, Math.round(canvas.getBoundingClientRect().height));
      let physicsHeight = Math.max(1.7, (sceneHeight - 45) / 56);
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        sceneHeight = Math.max(140, Math.round(canvas.getBoundingClientRect().height));
        canvas.width = Math.round(160 * dpr);
        canvas.height = Math.round(sceneHeight * dpr);
        renderer.resize(sceneHeight);
        return Math.max(1.7, (sceneHeight - 45) / 56);
      };
      physicsHeight = resize();
      let physics;
      try {
        physics = await createJarPhysics3D({ height: physicsHeight, radius: 0.95 });
      } catch (error) {
        renderer.dispose();
        canvas.dataset.physics = "unavailable";
        canvas.dataset.physicsError = error instanceof Error ? error.message : String(error);
        canvas.setAttribute("aria-label", "三维物理初始化失败，账目数据未受影响");
        return () => undefined;
      }
      canvas.dataset.scene = physics.sceneKind;
      canvas.dataset.physics = "rapier3d-ground";
      canvas.dataset.physicsHeight = physicsHeight.toFixed(4);
      const root = document.documentElement;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      let stable: PhysicsCoinPose[] = [];
      let outgoing: { pose: PhysicsCoinPose; start: number }[] = [];
      let pending: CoinEmission[] = [];
      const unsettled = new Map<string, number>();
      let delayTimer: ReturnType<typeof setTimeout> | undefined;
      let raf = 0;
      let last = performance.now();
      let hardStopAt = 0;
      let emitted = 0;
      let physicsFrames = 0;
      let current = jarState(useStore.getState().s);

      const updateEvidence = () => {
        const positions = stable.map((pose) => pose.position);
        const center = positions.filter((p) => Math.hypot(p.x, p.z) < 0.3).map((p) => p.y);
        const edge = positions.filter((p) => Math.hypot(p.x, p.z) > 0.58).map((p) => p.y);
        const depth = positions.map((p) => p.z);
        canvas.dataset.depthSpread = String(depth.length ? Math.max(...depth) - Math.min(...depth) : 0);
        canvas.dataset.moundCenter = String(center.length ? Math.max(...center) : 0);
        canvas.dataset.moundEdge = String(edge.length ? Math.max(...edge) : 0);
      };
      const draw = (now = performance.now()) => {
        const dynamic = physics.poses();
        const withdrawing = outgoing.map(({ pose, start }) => {
          const progress = Math.min(1, (now - start) / 300);
          return {
            ...pose,
            position: { ...pose.position, y: pose.position.y + (physicsHeight - pose.position.y) * progress },
            radius: pose.radius * (1 - progress),
          };
        });
        renderer.drawRigid([
          ...stable,
          ...dynamic,
          ...withdrawing,
        ]);
        canvas.dataset.physicsSignature = poseSignature(dynamic);
        canvas.dataset.dynamicBodies = String(dynamic.length);
      };
      const rebuild = (resetDynamic = true) => {
        current = jarState(useStore.getState().s);
        const pendingAmount = [...unsettled.values()].reduce((sum, amount) => sum + amount, 0);
        const fill = Math.max(0, Math.min(1, (current.amount - pendingAmount) / current.capacity));
        stable = visualPile(fill, physicsHeight);
        physics.setStaticPile(stable);
        if (resetDynamic) {
          physics.clearCoins();
        }
        updateEvidence();
        draw();
      };
      const stopLoop = () => {
        clearTimeout(delayTimer);
        delayTimer = undefined;
        cancelAnimationFrame(raf);
        raf = 0;
        canvas.dataset.animating = "false";
      };
      const finishLedgerAnimation = () => {
        stopLoop();
        pending = [];
        outgoing = [];
        unsettled.clear();
        rebuild();
      };
      const tick = (now: number) => {
        delayTimer = undefined;
        physicsFrames++;
        canvas.dataset.physicsFrames = String(physicsFrames);
        while (pending[0] && pending[0].at <= now) {
          const entry = pending.shift()!;
          const radius = Math.max(0.065, Math.min(0.11, entry.radius / 56));
          physics.addCoin({ radius, halfHeight: radius * 0.22, lessonId: entry.id, random: Math.random });
          emitted++;
          canvas.dataset.emitted = String(emitted);
        }
        canvas.dataset.pendingCoins = String(pending.length);
        let steps = 0;
        while (now - last >= 1000 / 60 && steps++ < 4) {
          physics.step();
          last += 1000 / 60;
        }
        if (steps >= 4) last = now;
        outgoing = outgoing.filter((item) => now - item.start < 300);
        draw(now);
        const noQueuedAnimation = pending.length === 0 && outgoing.length === 0;
        if (noQueuedAnimation && unsettled.size > 0 && (!physics.hasActiveBodies() || now >= hardStopAt)) {
          finishLedgerAnimation();
          return;
        }
        if (noQueuedAnimation && unsettled.size === 0 && !physics.hasActiveBodies()) {
          stopLoop();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      const startLoop = (now = performance.now(), delay = 0) => {
        canvas.dataset.animating = "true";
        hardStopAt = Math.max(hardStopAt, now + 1800);
        if (raf || delayTimer) return;
        last = now;
        delayTimer = setTimeout(() => {
          delayTimer = undefined;
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }, delay);
      };

      rebuild();
      canvas.dataset.animating = "false";
      const unsubscribe = useStore.subscribe((next, previous) => {
        if (next.s === previous.s) return;
        if (next.jarFeedback.seq === previous.jarFeedback.seq) {
          if (next.s.settings.jarCapacity !== previous.s.settings.jarCapacity) finishLedgerAnimation();
          return;
        }
        if (!next.jarFeedback.changes.length || reduce.matches) {
          finishLedgerAnimation();
          return;
        }
        const now = performance.now();
        const changes = next.jarFeedback.changes;
        const value = next.s.settings.coinValue.amount;
        const delay = feedbackTiming(next.jarFeedback.monthDelta ?? 0, !!next.jarFeedback.origin, reduce.matches).jarDelay;
        for (const change of changes) {
          if (change.amount > 0) {
            unsettled.set(change.id, (unsettled.get(change.id) ?? 0) + change.amount);
          } else {
            const active = physics.poses().filter((pose) => pose.lessonId === change.id);
            const count = Math.min(30, Math.max(1, active.length || Math.round(-change.amount / value)));
            const fallback = stable.slice(-count);
            for (let i = 0; i < count; i++) {
              const pose = active[i] ?? fallback[i % Math.max(1, fallback.length)];
              if (pose) outgoing.push({ pose, start: now });
            }
            physics.removeLesson(change.id);
            unsettled.delete(change.id);
          }
        }
        pending = scheduleCoins(pending, changes, value, now, delay);
        canvas.dataset.pendingCoins = String(pending.length);
        canvas.dataset.nextCoinDelay = String((pending[0]?.at ?? now) - now);
        rebuild(false);
        draw(now);
        startLoop(now, outgoing.length ? 0 : Math.max(0, (pending[0]?.at ?? now) - now));
      });

      const redraw = () => {
        const nextHeight = resize();
        if (Math.abs(nextHeight - physicsHeight) >= 0.001) {
          const ledgerAnimationInProgress = pending.length > 0 || outgoing.length > 0 || unsettled.size > 0;
          physicsHeight = nextHeight;
          physics.setHeight(physicsHeight);
          rebuild(false);
          canvas.dataset.physicsHeight = physicsHeight.toFixed(4);
          if (!ledgerAnimationInProgress || reduce.matches) {
            for (let i = 0; i < 240 && physics.hasActiveBodies(); i++) physics.step();
            draw();
            stopLoop();
          } else {
            startLoop();
          }
          return;
        }
        draw();
      };
      const lost = (event: Event) => {
        event.preventDefault();
        stopLoop();
        canvas.dataset.renderer = "context-lost";
      };
      const restored = () => {
        renderer.dispose();
        renderer = createJarRenderer(canvas);
        physicsHeight = resize();
        physics.setHeight(physicsHeight);
        canvas.dataset.physicsHeight = physicsHeight.toFixed(4);
        finishLedgerAnimation();
      };
      canvas.addEventListener("webglcontextlost", lost);
      canvas.addEventListener("webglcontextrestored", restored);
      const observer = new MutationObserver(redraw);
      observer.observe(root, { attributes: true, attributeFilter: ["data-appearance", "data-accent", "style"] });
      const sizeObserver = new ResizeObserver(redraw);
      sizeObserver.observe(canvas);
      const reduceChanged = () => finishLedgerAnimation();
      reduce.addEventListener("change", reduceChanged);
      window.addEventListener("resize", redraw);
      const refresh = () => useStore.getState().refreshJarSettings();
      window.addEventListener("focus", refresh);
      refresh();

      return () => {
        stopLoop();
        unsubscribe();
        physics.dispose();
        renderer.dispose();
        observer.disconnect();
        sizeObserver.disconnect();
        reduce.removeEventListener("change", reduceChanged);
        window.removeEventListener("resize", redraw);
        window.removeEventListener("focus", refresh);
        canvas.removeEventListener("webglcontextlost", lost);
        canvas.removeEventListener("webglcontextrestored", restored);
      };
    };

    void setup().then((cleanup) => {
      if (disposed) cleanup();
      else teardown = cleanup;
    });
    return () => {
      disposed = true;
      teardown?.();
    };
  }, []);
  return <div className="coin-pile" title={`已确认收入 ${fmtMoney(state.amount)}，目标 ${fmtMoney(state.capacity)}`}>
    <canvas ref={ref} aria-label={`金币堆，已达目标的 ${Math.round(state.fill * 100)}%，${fmtMoney(state.amount)}`} role="img" />
    <div className="coin-pile-caption"><b>{fmtMoney(state.amount)}</b><span> / {fmtMoney(state.capacity)}</span></div>
  </div>;
}
