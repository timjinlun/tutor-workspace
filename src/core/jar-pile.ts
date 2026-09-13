export interface PileCoin {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface VisualPileCoin extends PileCoin {
  tiltX: number;
  tiltZ: number;
}

/** Dense visible shell for historical value; layers nearly touch and avoid a flat grid look. */
export function buildJarVisualPile(
  fill: number,
  height: number,
  radius: number,
  halfHeight: number,
): VisualPileCoin[] {
  const safeFill = Math.max(0, Math.min(1, fill));
  if (!safeFill) return [];
  const target = Math.max(radius, safeFill * height * 0.82);
  const result: VisualPileCoin[] = [];
  const layerStep = halfHeight * 2.02;
  for (let layer = 0; layer * layerStep + halfHeight <= target && result.length < 1200; layer++) {
    const beforeLayer = result.length;
    const y = halfHeight + layer * layerStep;
    for (let column = 0; column < 12 && result.length < 1200; column++) {
      const x = -0.76 + column * 0.138 + (layer % 2) * 0.025;
      const availableDepth = Math.sqrt(Math.max(0, 0.82 ** 2 - x ** 2));
      const z = Math.sin(column * 7.13 + layer * 3.71) * availableDepth * 0.88;
      const radial = Math.hypot(x, z);
      const localTop = target * (0.14 + 0.86 * Math.max(0, 1 - radial / 0.82) ** 1.35);
      if (radial > 0.82 || y > localTop) continue;
      const index = layer * 12 + column;
      result.push({
        x,
        y,
        z,
        yaw: ((index * 0.61803398875) % 1) * Math.PI * 2,
        tiltX: Math.sin(index * 2.17) * 0.055,
        tiltZ: Math.cos(index * 1.73) * 0.055,
      });
    }
    if (result.length === beforeLayer) break;
  }
  return result;
}

/** Deterministic bounded coin columns with a higher center and tapered edge. */
export function buildJarPile(fill: number, count: number, radius: number, halfHeight: number): PileCoin[] {
  const safeFill = Math.max(0, Math.min(1, fill));
  const total = Math.max(0, Math.min(240, Math.floor(count)));
  if (!total) return [];
  const spacingX = radius * 2.08;
  const spacingZ = radius * Math.sqrt(3) * 1.04;
  const columns: { x: number; z: number; radial: number; levels: number }[] = [];
  const rows = Math.ceil(0.82 / spacingZ);
  const cols = Math.ceil(0.82 / spacingX);
  for (let row = -rows; row <= rows; row++) {
    for (let col = -cols; col <= cols; col++) {
      const x = col * spacingX + (Math.abs(row) % 2) * spacingX / 2;
      const z = row * spacingZ;
      const radial = Math.hypot(x, z);
      if (radial <= 0.82) columns.push({ x, z, radial, levels: 0 });
    }
  }
  columns.sort((a, b) => a.radial - b.radial || Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const result: PileCoin[] = [];
  const thickness = halfHeight * 2.08;
  for (let i = 0; i < total; i++) {
    let selected = columns[0]!;
    let score = Number.POSITIVE_INFINITY;
    for (const column of columns) {
      const next = column.levels * thickness + column.radial * safeFill * 0.24;
      if (next < score) {
        score = next;
        selected = column;
      }
    }
    result.push({
      x: selected.x,
      y: halfHeight + selected.levels * thickness,
      z: selected.z,
      yaw: ((i * 0.61803398875) % 1) * Math.PI * 2,
    });
    selected.levels++;
  }
  return result;
}

export function selectStablePileRemoval(pile: CoinPilePose[], lessonId: string, count: number, hasActiveCoins: boolean) {
  const exact = pile.filter((coin) => coin.lessonId === lessonId);
  if (exact.length) return exact;
  if (hasActiveCoins) return [];
  return pile.filter((coin) => !coin.lessonId).slice(-count);
}
import type { CoinPilePose } from "./types";
