import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { scheduleCoins, type CoinEmission } from "@/core/coin-queue";
import { feedbackTiming } from "@/core/lesson-feedback";
import { jarState } from "@/core/jar";
import { fmtMoney } from "@/core/finance";
import { buildJarPile, selectStablePileRemoval } from "@/core/jar-pile";
import { coinAxisVertical, createJarPhysics3D, type PhysicsCoinPose } from "@/core/jar-physics-3d";
import type { CoinPilePose, PendingCoinDrop } from "@/core/types";
import { useLocalDay } from "./useLocalDay";
import { createJarRenderer } from "./jar-webgl";
import "./savings-jar.css";

const COIN_RADIUS = 0.082;
const COIN_HALF_HEIGHT = 0.018;

function legacyPile(fill: number, count: number): PhysicsCoinPose[] {
  return buildJarPile(fill, count, COIN_RADIUS, COIN_HALF_HEIGHT).map((coin, index) => {
    const halfYaw = coin.yaw / 2;
    return {
      id: `stable-${index}`,
      position: { x: coin.x, y: coin.y, z: coin.z },
      rotation: { x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) },
      radius: COIN_RADIUS,
      halfHeight: COIN_HALF_HEIGHT,
    };
  });
}

function poseSignature(poses: PhysicsCoinPose[]) {
  const sample = poses.length > 48 ? [...poses.slice(0, 24), ...poses.slice(-24)] : poses;
  return sample.map((pose) => [
    pose.position.x, pose.position.y, pose.position.z,
    pose.rotation.x, pose.rotation.z,
  ].map((value) => value.toFixed(3)).join(",")).join(";");
}

function clonePile(poses: CoinPilePose[]): PhysicsCoinPose[] {
  return poses.map((pose) => ({
    ...pose,
    position: { ...pose.position },
    rotation: { ...pose.rotation },
  }));
}

function recoverPendingDrops(drops: PendingCoinDrop[], stable: PhysicsCoinPose[], now: number) {
  const savedByLesson = new Map<string, number>();
  for (const coin of stable) {
    if (coin.lessonId) savedByLesson.set(coin.lessonId, (savedByLesson.get(coin.lessonId) ?? 0) + 1);
  }
  const missing = drops.map((drop) => ({
    ...drop,
    missing: Math.max(0, drop.count - (savedByLesson.get(drop.lessonId) ?? 0)),
  }));
  const total = missing.reduce((sum, drop) => sum + drop.missing, 0);
  const interval = Math.min(18, 600 / Math.max(1, total));
  let index = 0;
  const emissions = missing.flatMap((drop) => Array.from({ length: drop.missing }, () => ({
    id: drop.lessonId,
    at: now + index++ * interval,
    radius: drop.radius,
  })));
  return {
    emissions,
    unsettled: new Map(missing.filter((drop) => drop.missing > 0).map((drop) => [drop.lessonId, drop.amount])),
    pendingAmount: missing.filter((drop) => drop.missing > 0).reduce((sum, drop) => sum + drop.amount, 0),
    fulfilledLessonIds: missing.filter((drop) => drop.missing === 0).map((drop) => drop.lessonId),
  };
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
      const initialState = useStore.getState().s;
      let stable: PhysicsCoinPose[] = clonePile(initialState.settings.coinPile);
      let recovery = recoverPendingDrops(initialState.settings.pendingCoinDrops, stable, performance.now());
      let fulfilledRecoveryLessonIds = recovery.fulfilledLessonIds;
      let outgoing: { pose: PhysicsCoinPose; start: number }[] = [];
      let pending: CoinEmission[] = recovery.emissions;
      const unsettled = recovery.unsettled;
      let delayTimer: ReturnType<typeof setTimeout> | undefined;
      let raf = 0;
      let last = performance.now();
      let hardStopAt = 0;
      let emitted = 0;
      let physicsFrames = 0;
      let current = jarState(useStore.getState().s);

      const saveStable = (settledLessonIds: string[] = []) => {
        canvas.dataset.stableBodies = String(stable.length);
        canvas.dataset.pileSignature = poseSignature(stable);
        useStore.getState().saveCoinPile(stable, settledLessonIds);
      };
      const repairUprightStableCoins = () => {
        const upright = stable.filter((pose) => coinAxisVertical(pose.rotation) < 0.45);
        if (!upright.length) return false;
        const uprightIds = new Set(upright.map((pose) => pose.id));
        stable = stable.filter((pose) => !uprightIds.has(pose.id));
        physics.setStaticPile(stable);
        for (const pose of upright) {
          physics.addCoin({
            radius: pose.radius,
            halfHeight: pose.halfHeight,
            lessonId: pose.lessonId,
            position: { ...pose.position },
            rotation: { ...pose.rotation },
            random: () => 0.5,
          });
        }
        physics.tipUprightCoins();
        unsettled.set("__upright-pose-repair__", upright.length);
        return true;
      };

      const updateEvidence = () => {
        const positions = stable.map((pose) => pose.position);
        const center = positions.filter((p) => Math.hypot(p.x, p.z) < 0.3).map((p) => p.y);
        const edge = positions.filter((p) => Math.hypot(p.x, p.z) > 0.58).map((p) => p.y);
        const depth = positions.map((p) => p.z);
        canvas.dataset.depthSpread = String(depth.length ? Math.max(...depth) - Math.min(...depth) : 0);
        canvas.dataset.moundCenter = String(center.length ? Math.max(...center) : 0);
        canvas.dataset.moundEdge = String(edge.length ? Math.max(...edge) : 0);
        canvas.dataset.stableBodies = String(stable.length);
        canvas.dataset.pileSignature = poseSignature(stable);
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
      const initializePile = () => {
        const storeState = useStore.getState().s;
        current = jarState(storeState);
        if (!stable.length && current.amount > 0) {
          const historicalAmount = Math.max(0, current.amount - recovery.pendingAmount);
          stable = legacyPile(historicalAmount / current.capacity, Math.round(historicalAmount / Math.max(1, storeState.settings.coinValue.amount)));
          saveStable();
        }
        physics.setStaticPile(stable);
        const repairingUprightCoins = repairUprightStableCoins();
        updateEvidence();
        draw();
        if (recovery.fulfilledLessonIds.length && !repairingUprightCoins) saveStable(recovery.fulfilledLessonIds);
      };
      const stopLoop = () => {
        clearTimeout(delayTimer);
        delayTimer = undefined;
        cancelAnimationFrame(raf);
        raf = 0;
        canvas.dataset.animating = "false";
      };
      const addEmission = (entry: CoinEmission) => {
        const radius = Math.max(0.065, Math.min(0.11, entry.radius / 56));
        physics.addCoin({ radius, halfHeight: radius * 0.22, lessonId: entry.id, random: Math.random });
        emitted++;
        canvas.dataset.emitted = String(emitted);
      };
      const finishLedgerAnimation = () => {
        stopLoop();
        for (const entry of pending) addEmission(entry);
        pending = [];
        canvas.dataset.pendingCoins = "0";
        for (let pass = 0; pass < 6; pass++) {
          for (let i = 0; i < 600 && physics.hasActiveBodies(); i++) physics.step();
          if (physics.tipUprightCoins() === 0) break;
        }
        for (let i = 0; i < 600 && physics.hasActiveBodies(); i++) physics.step();
        const settledAt = Date.now();
        const dynamic = physics.poses();
        const settledLessonIds = [...new Set([
          ...fulfilledRecoveryLessonIds,
          ...dynamic.flatMap((pose) => pose.lessonId ? [pose.lessonId] : []),
        ])];
        const settled = dynamic.map((pose, index) => ({
          ...pose,
          id: `saved-${settledAt}-${index}-${pose.id}`,
          position: { ...pose.position },
          rotation: { ...pose.rotation },
        }));
        if (settled.length) stable = [...stable, ...settled];
        physics.clearCoins();
        physics.setStaticPile(stable);
        pending = [];
        outgoing = [];
        unsettled.clear();
        updateEvidence();
        draw();
        saveStable(settledLessonIds);
      };
      const tick = (now: number) => {
        delayTimer = undefined;
        physicsFrames++;
        canvas.dataset.physicsFrames = String(physicsFrames);
        while (pending[0] && pending[0].at <= now) {
          const entry = pending.shift()!;
          addEmission(entry);
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

      initializePile();
      if (pending.length > 0 || unsettled.size > 0 || physics.hasActiveBodies()) startLoop();
      else canvas.dataset.animating = "false";
      const unsubscribe = useStore.subscribe((next, previous) => {
        if (next.s === previous.s) return;
        if (next.jarFeedback.seq === previous.jarFeedback.seq) {
          if (next.s.settings.jarCapacity !== previous.s.settings.jarCapacity) finishLedgerAnimation();
          return;
        }
        if (!next.jarFeedback.changes.length) {
          stopLoop();
          pending = [];
          outgoing = [];
          unsettled.clear();
          physics.clearCoins();
          stable = clonePile(next.s.settings.coinPile);
          recovery = recoverPendingDrops(next.s.settings.pendingCoinDrops, stable, performance.now());
          fulfilledRecoveryLessonIds = recovery.fulfilledLessonIds;
          pending = recovery.emissions;
          for (const [lessonId, amount] of recovery.unsettled) unsettled.set(lessonId, amount);
          current = jarState(next.s);
          if (!stable.length && current.amount > 0) {
            const historicalAmount = Math.max(0, current.amount - recovery.pendingAmount);
            stable = legacyPile(historicalAmount / current.capacity, Math.round(historicalAmount / Math.max(1, next.s.settings.coinValue.amount)));
          }
          physics.setStaticPile(stable);
          const repairingUprightCoins = repairUprightStableCoins();
          updateEvidence();
          draw();
          if (recovery.fulfilledLessonIds.length && !repairingUprightCoins) saveStable(recovery.fulfilledLessonIds);
          if (pending.length > 0 || unsettled.size > 0 || physics.hasActiveBodies()) startLoop();
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
            const exactCount = stable.filter((pose) => pose.lessonId === change.id).length;
            const count = Math.min(240, Math.max(1, active.length || exactCount || Math.round(-change.amount / value)));
            const removed = selectStablePileRemoval(stable, change.id, count, active.length > 0);
            outgoing.push(...[...active, ...removed].slice(0, count).map((pose) => ({ pose, start: now })));
            const removedIds = new Set(removed.map((pose) => pose.id));
            stable = stable.filter((pose) => !removedIds.has(pose.id));
            physics.setStaticPile(stable);
            physics.removeLesson(change.id);
            unsettled.delete(change.id);
            saveStable();
          }
        }
        if (reduce.matches) {
          pending = scheduleCoins(pending, changes, value, now, 0);
          finishLedgerAnimation();
          return;
        }
        pending = scheduleCoins(pending, changes, value, now, delay);
        canvas.dataset.pendingCoins = String(pending.length);
        canvas.dataset.nextCoinDelay = String((pending[0]?.at ?? now) - now);
        draw(now);
        startLoop(now, outgoing.length ? 0 : Math.max(0, (pending[0]?.at ?? now) - now));
      });

      const redraw = () => {
        const nextHeight = resize();
        if (Math.abs(nextHeight - physicsHeight) >= 0.001) {
          const ledgerAnimationInProgress = pending.length > 0 || outgoing.length > 0 || unsettled.size > 0;
          physicsHeight = nextHeight;
          physics.setHeight(physicsHeight);
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
        physics.setStaticPile(stable);
        updateEvidence();
        draw();
        if (pending.length > 0 || outgoing.length > 0 || unsettled.size > 0 || physics.hasActiveBodies()) startLoop();
        else canvas.dataset.animating = "false";
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
