/** Indexed triangle meshes; Y is up. Shared by WebGL and the model exporter. */
export interface Mesh { positions: number[]; normals: number[]; indices: number[] }
export interface Vector3 { x: number; y: number; z: number }
export interface Quaternion extends Vector3 { w: number }

export function rotateVectorByQuaternion(vector: Vector3, rotation: Quaternion): Vector3 {
  const tx = 2 * (rotation.y * vector.z - rotation.z * vector.y);
  const ty = 2 * (rotation.z * vector.x - rotation.x * vector.z);
  const tz = 2 * (rotation.x * vector.y - rotation.y * vector.x);
  return {
    x: vector.x + rotation.w * tx + rotation.y * tz - rotation.z * ty,
    y: vector.y + rotation.w * ty + rotation.z * tx - rotation.x * tz,
    z: vector.z + rotation.w * tz + rotation.x * ty - rotation.y * tx,
  };
}
export function lathe(profile: [number, number][], segments = 64): Mesh {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (let j = 0; j < profile.length - 1; j++) {
    const [r0, y0] = profile[j]!, [r1, y1] = profile[j + 1]!;
    const length = Math.hypot(y1 - y0, r1 - r0) || 1;
    const start = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (const [r, y] of [[r0, y0], [r1, y1]] as [number, number][]) {
        positions.push(r * c, y, r * s);
        normals.push((y1 - y0) / length * c, (r0 - r1) / length, (y1 - y0) / length * s);
      }
    }
    for (let i = 0; i < segments; i++) { const k = start + i * 2; indices.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
  }
  return { positions, normals, indices };
}
export const jarBody = (height: number) => lathe([[0, 0], [1, 0], [1, height], [.955, height], [.955, .09], [0, .09]]);
export const goldCoin = () => lathe([[0, -.14], [.84, -.14], [.94, -.17], [1, -.11], [1, .11], [.94, .17], [.84, .14], [0, .14]], 32);
/** Lid split into convex sectors around an actual rectangular opening. */
export function jarLid(height: number): Mesh {
  const mesh: Mesh = { positions: [], normals: [], indices: [] };
  type Point = [number, number];
  const circle: Point[] = Array.from({ length: 96 }, (_, i) => [Math.cos(i / 96 * Math.PI * 2), Math.sin(i / 96 * Math.PI * 2)]);
  const clip = (poly: Point[], axis: number, bound: number, sign: number) => {
    const result: Point[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
      const da = (a[axis]! - bound) * sign, db = (b[axis]! - bound) * sign;
      if (da >= 0) result.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return result;
  };
  const middle = clip(clip(circle, 1, -.055, 1), 1, .055, -1);
  const pieces = [clip(circle, 1, .055, 1), clip(circle, 1, -.055, -1), clip(middle, 0, -.43, -1), clip(middle, 0, .43, 1)];
  const face = (points: number[][], normal: number[]) => {
    const start = mesh.positions.length / 3;
    points.forEach(p => { mesh.positions.push(...p); mesh.normals.push(...normal); });
    for (let i = 1; i < points.length - 1; i++) mesh.indices.push(start, start + i, start + i + 1);
  };
  for (const p of pieces) {
    face([...p].reverse().map(([x,z]) => [x,height+.035,z]), [0,1,0]);
    face(p.map(([x,z]) => [x,height-.035,z]), [0,-1,0]);
  }
  const slot: Point[] = [[-.43,-.055],[.43,-.055],[.43,.055],[-.43,.055]];
  slot.forEach(([x,z], i) => { const [a,b] = slot[(i+1)%4]!; const len = Math.hypot(a-x,b-z); face([[x,height-.035,z],[a,height-.035,b],[a,height+.035,b],[x,height+.035,z]], [(z-b)/len,0,(a-x)/len]); });
  circle.forEach(([x,z], i) => {
    const [a,b] = circle[(i+1)%circle.length]!;
    const length = Math.hypot(x+a,z+b);
    face([[x,height-.035,z],[x,height+.035,z],[a,height+.035,b],[a,height-.035,b]],[(x+a)/length,0,(z+b)/length]);
  });
  return mesh;
}
