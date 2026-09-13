import { describe, expect, it } from "vitest";
import { createJarPhysics3D } from "../src/core/jar-physics-3d";

describe("Rapier 储蓄罐物理适配层", () => {
  it("添加圆柱金币并暴露可渲染的三维姿态", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    const id = physics.addCoin({
      radius: 0.11,
      halfHeight: 0.025,
      lessonId: "lesson-a",
      random: () => 0.5,
    });

    expect(id).toBe("coin-1");
    const [pose] = physics.poses();
    expect(pose).toMatchObject({
      id: "coin-1",
      lessonId: "lesson-a",
      position: { x: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      radius: 0.11,
      halfHeight: 0.025,
    });
    expect(pose!.position.y).toBeCloseTo(4.35);

    physics.dispose();
  });
});
