export interface PileCoin {
  x: number;
  y: number;
  z: number;
  yaw: number;
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

