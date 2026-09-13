import { createWorld, addCoins, stepWorld } from '../src/core/jar-physics.ts';
import { createJarPhysics3D } from '../src/core/jar-physics-3d.ts';
import { buildJarVisualPile } from '../src/core/jar-pile.ts';
import { writeFileSync } from 'node:fs';
function runLegacy(staged) {
  let seed = 1;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let world = staged ? createWorld() : addCoins(createWorld(), 240, 4, random);
  let emitted = 0;
  const times = [];
  for (let frame = 0; frame < 54; frame++) {
    if (staged) {
      const wanted = Math.min(240, Math.floor(frame * 1000 / 60 / 2.5) + 1);
      if (wanted > emitted) world = addCoins(world, wanted - emitted, 4, random);
      emitted = wanted;
    }
    const start = performance.now(); world = stepWorld(world); times.push(performance.now() - start);
  }
  return { active: world.coins.length, meanMs: times.reduce((a,b)=>a+b) / times.length, maxMs: Math.max(...times) };
}
async function runRapier(staged) {
  let seed = 1;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
  const staticPile = buildJarVisualPile(1, 4.6, 0.082, 0.018).map((coin, index) => ({
    id: `stable-${index}`,
    position: { x: coin.x, y: coin.y, z: coin.z },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    radius: 0.082,
    halfHeight: 0.018,
  }));
  physics.setStaticPile(staticPile);
  let emitted = 0;
  if (!staged) {
    for (let i = 0; i < 240; i++) physics.addCoin({ radius: 0.082, halfHeight: 0.018, random });
    emitted = 240;
  }
  const times = [];
  for (let frame = 0; frame < 54; frame++) {
    if (staged) {
      const wanted = Math.min(240, Math.floor(frame * 1000 / 60 / 2.5) + 1);
      for (let i = emitted; i < wanted; i++) physics.addCoin({ radius: 0.082, halfHeight: 0.018, random });
      emitted = wanted;
    }
    const start = performance.now(); physics.step(); times.push(performance.now() - start);
  }
  const active = physics.poses().length;
  physics.dispose();
  return { active, static: staticPile.length, meanMs: times.reduce((a, b) => a + b) / times.length, maxMs: Math.max(...times) };
}
const result = {
  rapier3dEmission240Over600ms: await runRapier(true),
  rapier3dStress240Simultaneous: await runRapier(false),
  legacyPbdEmission240Over600ms: runLegacy(true),
  note: 'Local Node CPU measurement; excludes WebGL drawing. Timing depends on runtime, JIT, and hardware.',
};
writeFileSync('docs/qa/jar/performance.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
