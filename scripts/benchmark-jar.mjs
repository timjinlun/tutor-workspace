import { createWorld, addCoins, stepWorld } from '../src/core/jar-physics.ts';
import { writeFileSync } from 'node:fs';
function run(staged) {
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
const result = { actualEmission240Over600ms: run(true), extraStress240Simultaneous: run(false), note: 'Local Node measurement; includes no canvas drawing. Timing depends on runtime/JIT/hardware.' };
writeFileSync('docs/qa/jar/performance.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
