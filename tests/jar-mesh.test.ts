import { describe, expect, it } from 'vitest';
import { jarBody, jarLid, goldCoin } from '../src/core/jar-mesh';
describe('true 3D models', () => {
  it('exports finite indexed geometry with normalized normals and depth', () => {
    for (const mesh of [jarBody(4.8), jarLid(4.8), goldCoin()]) {
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      expect(mesh.normals.length).toBe(mesh.positions.length);
      expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length / 3);
      for(let i=0;i<mesh.normals.length;i+=3) expect(Math.hypot(...mesh.normals.slice(i,i+3))).toBeCloseTo(1);
      expect(Math.max(...mesh.positions.filter((_,i)=>i%3===2))).toBeGreaterThan(.9);
    }
  });
  it('aligns triangle winding with lighting normals', () => {
    for(const m of [jarBody(4.8),jarLid(4.8),goldCoin()]) for(let i=0;i<m.indices.length;i+=3){
      const [a,b,c]=m.indices.slice(i,i+3).map(k=>m.positions.slice(k*3,k*3+3));
      const u=b!.map((v,k)=>v-a![k]!),v=c!.map((v,k)=>v-a![k]!);
      const cross=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!];
      const n=m.normals.slice(m.indices[i]!*3,m.indices[i]!*3+3);
      if(Math.hypot(...cross)>1e-8) expect(cross.reduce((sum,v,k)=>sum+v*n[k]!,0)).toBeGreaterThan(0);
    }
  });
  it('keeps the slot open through both surfaces of the lid', () => {
    const m=jarLid(4.8);
    for(let i=0;i<m.indices.length;i+=3){
      const vertices=m.indices.slice(i,i+3).map(index=>m.positions.slice(index*3,index*3+3));
      const x=vertices.reduce((n,v)=>n+v[0]!,0)/3,z=vertices.reduce((n,v)=>n+v[2]!,0)/3;
      expect(Math.abs(x)<.429 && Math.abs(z)<.054).toBe(false);
    }
  });
});
