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

  it("圆柱金币落下后被罐底托住", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.addCoin({ radius: 0.11, halfHeight: 0.025, random: () => 0.5 });

    for (let i = 0; i < 240; i++) physics.step();

    expect(physics.poses()[0]!.position.y).toBeGreaterThanOrEqual(0.02);
    physics.dispose();
  });

  it("金币在三维空间分离并受圆形罐壁约束", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.addCoin({
      radius: 0.11,
      halfHeight: 0.025,
      random: () => 0.5,
      position: { x: 0.72, y: 2.2, z: 0 },
      linearVelocity: { x: 8, y: 0, z: 0 },
    });
    physics.addCoin({
      radius: 0.11,
      halfHeight: 0.025,
      random: () => 0.5,
      position: { x: 0, y: 2.2, z: 0.18 },
    });

    physics.step();
    expect(physics.poses()[0]!.position.x).toBeGreaterThan(0.73);
    for (let i = 1; i < 180; i++) physics.step();

    const poses = physics.poses();
    expect(poses[1]!.position.z).not.toBe(0);
    expect(poses[0]!.position.x).toBeLessThan(0.72);
    for (const pose of poses) {
      expect(Math.hypot(pose.position.x, pose.position.z)).toBeLessThanOrEqual(0.95 - pose.radius + 0.02);
    }
    physics.dispose();
  });

  it("重叠的圆柱金币产生体积接触并分开", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    const options = {
      radius: 0.11,
      halfHeight: 0.025,
      random: () => 0.5,
      position: { x: 0, y: 1, z: 0 },
    };
    physics.addCoin(options);
    physics.addCoin(options);

    for (let i = 0; i < 30; i++) physics.step();

    const [a, b] = physics.poses();
    expect(Math.hypot(a!.position.x - b!.position.x, a!.position.y - b!.position.y, a!.position.z - b!.position.z)).toBeGreaterThan(0.04);
    physics.dispose();
  });

  it("撤销只移除对应课程的刚体", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.addCoin({ radius: 0.11, halfHeight: 0.025, lessonId: "a", random: () => 0.5 });
    physics.addCoin({ radius: 0.11, halfHeight: 0.025, lessonId: "b", random: () => 0.5 });

    physics.removeLesson("a");

    expect(physics.poses().map((pose) => pose.lessonId)).toEqual(["b"]);
    physics.dispose();
  });

  it("罐体倾斜后表层金币滑动并翻滚", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.setBulkFill(0.35);
    physics.addCoin({
      radius: 0.11,
      halfHeight: 0.025,
      random: () => 0.5,
      position: { x: 0.08, y: 2, z: 0.06 },
    });
    for (let i = 0; i < 180; i++) physics.step();
    const before = physics.poses()[0]!;

    physics.setJarTilt(0.32, -0.18);
    for (let i = 0; i < 120; i++) physics.step();
    const after = physics.poses()[0]!;

    expect(Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z)).toBeGreaterThan(0.03);
    expect(Math.abs(after.rotation.x - before.rotation.x) + Math.abs(after.rotation.z - before.rotation.z)).toBeGreaterThan(0.02);
    for (let i = 0; i < 480 && physics.hasActiveBodies(); i++) physics.step();
    expect(physics.hasActiveBodies()).toBe(false);
    physics.dispose();
  });
});
