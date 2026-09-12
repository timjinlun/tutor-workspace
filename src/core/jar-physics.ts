export interface Coin { x: number; y: number; px: number; py: number; r: number; lessonId?: string; phase?: number; angle?: number }
export interface World { coins: Coin[]; deposited: Coin[]; quiet: number; frames: number; sleeping: boolean; floor: number }
export const createWorld = (floor = 124): World => ({ coins: [], deposited: [], quiet: 0, frames: 0, sleeping: true, floor });

export function addCoins(world: World, count: number, radius: number, random: () => number, lessonId?: string): World {
  const coins = [...world.coins];
  const deposited: Coin[] = [];
  for (let i = 0; i < Math.min(1000, count); i++) {
    const x = 80 + (random() - 0.5) * 24;
    coins.push({ x, y: 25 - i * 0.1, px: x + (random() - 0.5) * 3, py: 23 - i * 0.1, r: radius, lessonId, phase: random() * Math.PI, angle: (random() - 0.5) * 1.2 });
    if (coins.length > 240) deposited.push(coins.shift()!);
  }
  return { ...world, coins, deposited, quiet: 0, frames: 0, sleeping: false };
}

/** Fixed 60Hz Verlet steps; a hard settling deadline bounds UI animation work. */
export function stepWorld(world: World): World {
  if (world.sleeping) return world;
  const gravity = Math.max(0.48, (world.floor - 25) * 0.007);
  const coins = world.coins.map((c) => ({ ...c, phase: (c.phase ?? 0) + Math.min(0.12, Math.hypot(c.x - c.px, c.y - c.py) * 0.018), px: c.x, py: c.y, x: c.x + (c.x - c.px) * 0.98, y: c.y + (c.y - c.py) * 0.98 + gravity }));
  for (let iteration = 0; iteration < 4; iteration++) {
    const grid = new Map<number, number[]>();
    const size = Math.max(1, ...coins.map((c) => c.r * 2));
    coins.forEach((c, i) => {
      const gx = Math.floor(c.x / size), gy = Math.floor(c.y / size);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(gx + dx + (gy + dy) * 1024) ?? []) {
          const b = coins[j]!;
          const vx = c.x - b.x, vy = c.y - b.y;
          const squared = vx * vx + vy * vy;
          const radii = c.r + b.r;
          if (squared >= radii * radii) continue;
          const distance = Math.sqrt(squared);
          const overlap = radii - distance;
          if (overlap > 0) {
            const nx = distance > 0.001 ? vx / distance : (i % 2 ? 1 : -1);
            const ny = distance > 0.001 ? vy / distance : 0;
            c.x += nx * overlap / 2; c.y += ny * overlap / 2;
            b.x -= nx * overlap / 2; b.y -= ny * overlap / 2;
          }
        }
      }
      const key = gx + gy * 1024;
      const bucket = grid.get(key);
      if (bucket) bucket.push(i); else grid.set(key, [i]);
    });
    for (const c of coins) {
      c.x = Math.max(24 + c.r, Math.min(136 - c.r, c.x));
      if (c.y > world.floor - c.r) { const v = c.y - c.py; c.y = world.floor - c.r; c.py = c.y + Math.max(0, v) * 0.25; }
      c.y = Math.max(25 + c.r, c.y);
    }
  }
  const quiet = coins.every((c, i) => Math.hypot(c.x - world.coins[i]!.x, c.y - world.coins[i]!.y) < 0.15) ? world.quiet + 1 : 0;
  const frames = world.frames + 1;
  return { ...world, coins, deposited: [], quiet, frames, sleeping: quiet >= 30 || frames >= 54 };
}
