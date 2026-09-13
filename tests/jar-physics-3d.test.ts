import { describe, expect, it } from "vitest";
import { createJarPhysics3D, type PhysicsCoinPose } from "../src/core/jar-physics-3d";
import { buildJarPile } from "../src/core/jar-pile";

describe("Rapier 开放金币堆物理适配层", () => {
  it("声明开放地面场景", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });

    expect(physics.sceneKind).toBe("open-ground");
    physics.dispose();
  });

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
    expect(pose!.position.y).toBeCloseTo(0.9);

    physics.dispose();
  });

  it("圆柱金币从空中落下后被地面托住", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.addCoin({ radius: 0.11, halfHeight: 0.025, random: () => 0.5 });

    for (let i = 0; i < 240; i++) physics.step();
    expect(physics.poses()[0]!.position.y).toBeGreaterThanOrEqual(0.02);
    physics.dispose();
  });

  it("金币在三维空间碰撞后能越过旧罐壁范围并留在宽地面上", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.addCoin({
      radius: 0.11,
      halfHeight: 0.025,
      random: () => 0.5,
      position: { x: 0.72, y: 0.5, z: 0 },
      linearVelocity: { x: 3, y: 0, z: 0 },
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
    expect(poses[0]!.position.x).toBeGreaterThan(0.95);
    expect(poses[0]!.position.y).toBeGreaterThanOrEqual(0.02);
    for (const pose of poses) {
      expect(Math.hypot(pose.position.x, pose.position.z)).toBeLessThan(2.2);
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

  it("新金币直接落在历史可见金币的真实圆柱碰撞体上", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    const setStaticPile = (physics as unknown as {
      setStaticPile?: (coins: PhysicsCoinPose[]) => void;
    }).setStaticPile;

    expect(typeof setStaticPile).toBe("function");
    if (!setStaticPile) return;
    setStaticPile([{
      id: "stable-1",
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      radius: 0.11,
      halfHeight: 0.025,
    }]);
    physics.addCoin({
      radius: 0.11,
      halfHeight: 0.025,
      random: () => 0.5,
      position: { x: 0, y: 2, z: 0 },
    });

    for (let i = 0; i < 240; i++) physics.step();
    expect(physics.poses()[0]!.position.y).toBeCloseTo(1.05, 2);
    physics.dispose();
  });

  it("一课金币落在历史金币堆上后全部留在可见地面", async () => {
    const radius = 0.082;
    const halfHeight = 0.018;
    const stable = buildJarPile(0.5, 240, radius, halfHeight).map((coin, index) => ({
      id: `stable-${index}`,
      position: { x: coin.x, y: coin.y, z: coin.z },
      rotation: { x: 0, y: Math.sin(coin.yaw / 2), z: 0, w: Math.cos(coin.yaw / 2) },
      radius,
      halfHeight,
    }));
    const oldPileMaxY = Math.max(...stable.map((coin) => coin.position.y));
    for (const initialSeed of [1, 17, 73, 997, 4099, 65537, 0x12345678, 0xdeadbeef]) {
      const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
      physics.setStaticPile(stable);
      let seed = initialSeed;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
      };
      for (let i = 0; i < 28; i++) {
        physics.addCoin({ radius, halfHeight: radius * 0.22, lessonId: "lesson-stack", random });
        physics.step();
      }
      for (let i = 0; i < 600 && physics.hasActiveBodies(); i++) physics.step();

      const added = physics.poses();
      expect(added).toHaveLength(28);
      expect(Math.max(...added.map((coin) => coin.position.y))).toBeGreaterThan(oldPileMaxY);
      for (const coin of added) {
        expect(coin.position.y).toBeGreaterThanOrEqual(0);
        expect(Math.hypot(coin.position.x, coin.position.z)).toBeLessThan(2);
      }
      physics.dispose();
    }
  });

  it("撤销只移除对应课程的刚体", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.addCoin({ radius: 0.11, halfHeight: 0.025, lessonId: "a", random: () => 0.5 });
    physics.addCoin({ radius: 0.11, halfHeight: 0.025, lessonId: "b", random: () => 0.5 });

    physics.removeLesson("a");

    expect(physics.poses().map((pose) => pose.lessonId)).toEqual(["b"]);
    physics.dispose();
  });

  it("动态刚体超过240枚时也不会静默丢失并可清空重建", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    for (let i = 0; i < 250; i++) {
      physics.addCoin({ radius: 0.11, halfHeight: 0.025, lessonId: String(i), random: () => 0.5 });
    }

    expect(physics.poses()).toHaveLength(250);
    physics.clearCoins();
    expect(physics.poses()).toEqual([]);
    physics.dispose();
  });

  it("新金币带有初始倾角和角速度", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.addCoin({ radius: 0.11, halfHeight: 0.025, random: () => 0.75 });
    const before = physics.poses()[0]!.rotation;

    physics.step();
    const after = physics.poses()[0]!.rotation;

    expect(Math.abs(before.x) + Math.abs(before.y) + Math.abs(before.z)).toBeGreaterThan(0.05);
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y) + Math.abs(after.z - before.z)).toBeGreaterThan(0.005);
    physics.dispose();
  });

  it("场景高度变化时同步现有金币和空中生成点", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.addCoin({
      radius: 0.11,
      halfHeight: 0.025,
      random: () => 0.5,
      position: { x: 0, y: 2.3, z: 0 },
    });

    physics.setHeight(2.3);
    expect(physics.poses()[0]!.position.y).toBeCloseTo(2.3, 4);

    for (let i = 0; i < 240 && physics.hasActiveBodies(); i++) physics.step();
    expect(physics.poses()[0]!.position.y).toBeGreaterThanOrEqual(0.02);
    expect(physics.hasActiveBodies()).toBe(false);

    physics.addCoin({ radius: 0.11, halfHeight: 0.025, random: () => 0.5 });
    expect(physics.poses()[1]!.position.y).toBeCloseTo(0.9, 4);
    physics.dispose();
  });
});
