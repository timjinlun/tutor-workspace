import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { scheduleCoins, type CoinEmission } from "@/core/coin-queue";
import { feedbackTiming } from "@/core/lesson-feedback";
import { jarState } from "@/core/jar";
import { fmtMoney } from "@/core/finance";
import { buildJarPile } from "@/core/jar-pile";
import { createJarPhysics3D, type PhysicsCoinPose } from "@/core/jar-physics-3d";
import { rotateVectorByQuaternion, type Quaternion } from "@/core/jar-mesh";
import { useLocalDay } from "./useLocalDay";
import { createJarRenderer } from "./jar-webgl";
import "./savings-jar.css";

const IDENTITY: Quaternion = { x: 0, y: 0, z: 0, w: 1 };
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

function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function visualPile(fill: number, height: number): PhysicsCoinPose[] {
  if (fill <= 0) return [];
  const target = Math.max(0.08, fill * height * 0.82);
  const poses: PhysicsCoinPose[] = [];
  const rowStep = COIN_HALF_HEIGHT * 2.8;
  for (let row = 0; row * rowStep + COIN_HALF_HEIGHT <= target; row++) {
    const y = COIN_HALF_HEIGHT + row * rowStep;
    for (let column = 0; column < 12; column++) {
      const x = -0.76 + column * 0.138 + (row % 2) * 0.025;
      const availableDepth = Math.sqrt(Math.max(0, 0.82 ** 2 - x ** 2));
      const z = Math.sin(column * 7.13 + row * 3.71) * availableDepth * 0.88;
      const radial = Math.hypot(x, z);
      const localTop = target * (0.7 + 0.3 * Math.max(0, 1 - radial / 0.82) ** 1.7);
      if (radial > 0.82 || y > localTop) continue;
      const yaw = ((row * 12 + column) * 0.61803398875 % 1) * Math.PI * 2;
      poses.push({
        id: `stable-${row}-${column}`,
        position: { x, y, z },
        rotation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
        radius: COIN_RADIUS,
        halfHeight: COIN_HALF_HEIGHT,
      });
    }
  }
  return poses;
}

function transformStablePose(pose: PhysicsCoinPose, jarRotation: Quaternion): PhysicsCoinPose {
  return {
    ...pose,
    position: rotateVectorByQuaternion(pose.position, jarRotation),
    rotation: multiplyQuaternion(jarRotation, pose.rotation),
  };
}

function poseSignature(poses: PhysicsCoinPose[]) {
  return poses.slice(0, 24).map((pose) => [
    pose.position.x, pose.position.y, pose.position.z,
    pose.rotation.x, pose.rotation.z,
  ].map((value) => value.toFixed(3)).join(",")).join(";");
}

export function SavingsJar() {
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
        canvas.setAttribute("aria-label", "当前设备无法启用三维储蓄罐");
        return () => undefined;
      }
      let sceneHeight = Math.max(140, Math.round(canvas.getBoundingClientRect().height));
      const physicsHeight = Math.max(1.7, (sceneHeight - 45) / 56);
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        sceneHeight = Math.max(140, Math.round(canvas.getBoundingClientRect().height));
        canvas.width = Math.round(160 * dpr);
        canvas.height = Math.round(sceneHeight * dpr);
        renderer.resize(sceneHeight);
      };
      resize();
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
      canvas.dataset.physics = "rapier3d";
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
      let tiltX = 0;
      let tiltZ = 0;
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
        const jarRotation = physics.jarRotation();
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
          ...stable.map((pose) => transformStablePose(pose, jarRotation)),
          ...dynamic,
          ...withdrawing,
        ], jarRotation);
        canvas.dataset.physicsSignature = poseSignature(dynamic);
        canvas.dataset.dynamicBodies = String(dynamic.length);
        canvas.dataset.jarRotation = [jarRotation.x, jarRotation.y, jarRotation.z, jarRotation.w].map((value) => value.toFixed(4)).join(",");
      };
      const seedSurface = (fill: number) => {
        if (fill <= 0) return;
        const random = seededRandom(Math.round(fill * 10000) + 17);
        const candidates = buildJarPile(fill, 90, 0.1, COIN_HALF_HEIGHT);
        const unique = [...new Map(candidates.map((coin) => [`${coin.x.toFixed(3)}:${coin.z.toFixed(3)}`, coin])).values()];
        const target = fill * physicsHeight * 0.82;
        for (const [index, point] of unique.slice(0, 14).entries()) {
          const radial = Math.hypot(point.x, point.z);
          const surface = target * (radial < 0.95 * 0.32 ? 1 : radial < 0.95 * 0.58 ? 0.8 : 0.58);
          physics.addCoin({
            radius: COIN_RADIUS,
            halfHeight: COIN_HALF_HEIGHT,
            random,
            position: { x: point.x, y: surface + COIN_HALF_HEIGHT + 0.02 + index * 0.002, z: point.z },
          });
        }
        for (let i = 0; i < 240 && physics.hasActiveBodies(); i++) physics.step();
      };
      const rebuild = () => {
        current = jarState(useStore.getState().s);
        const pendingAmount = [...unsettled.values()].reduce((sum, amount) => sum + amount, 0);
        const fill = Math.max(0, Math.min(1, (current.amount - pendingAmount) / current.capacity));
        stable = visualPile(fill, physicsHeight);
        physics.clearCoins();
        physics.setBulkFill(fill);
        physics.setJarTilt(tiltX, tiltZ);
        seedSurface(fill);
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
        rebuild();
        draw(now);
        startLoop(now, outgoing.length ? 0 : Math.max(0, (pending[0]?.at ?? now) - now));
      });

      let pointerX: number | null = null;
      let pointerY = 0;
      const down = (event: PointerEvent) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (pointerX === null || reduce.matches) return;
        tiltZ = Math.max(-0.22, Math.min(0.22, tiltZ - (event.clientX - pointerX) * 0.004));
        tiltX = Math.max(-0.22, Math.min(0.22, tiltX + (event.clientY - pointerY) * 0.004));
        pointerX = event.clientX;
        pointerY = event.clientY;
        physics.setJarTilt(tiltX, tiltZ);
        draw();
        startLoop();
      };
      const up = () => { pointerX = null; };
      const redraw = () => { resize(); draw(); };
      const lost = (event: Event) => {
        event.preventDefault();
        stopLoop();
        canvas.dataset.renderer = "context-lost";
      };
      const restored = () => {
        renderer.dispose();
        renderer = createJarRenderer(canvas);
        redraw();
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
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
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        canvas.removeEventListener("pointercancel", up);
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
  return <div className="savings-jar" title={`已确认收入 ${fmtMoney(state.amount)}，容量 ${fmtMoney(state.capacity)}`}>
    <canvas ref={ref} aria-label={`储蓄罐，${Math.round(state.fill * 100)}% 满，${fmtMoney(state.amount)}`} role="img" />
    <div className="jar-caption"><b>{fmtMoney(state.amount)}</b><span> / {fmtMoney(state.capacity)}</span></div>
  </div>;
}
