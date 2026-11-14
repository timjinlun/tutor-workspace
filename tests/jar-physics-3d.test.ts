import { describe, expect, it } from "vitest";
import { coinAxisVertical, createJarPhysics3D, type PhysicsCoinPose } from "../src/core/jar-physics-3d";
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
    /* 从画面上沿外面掉进来：场景高度 + 0.55 + 0.5 × 随机数 */
    expect(pose!.position.y).toBeCloseTo(5.4);

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
      for (let pass = 0; pass < 6; pass++) {
        for (let i = 0; i < 600 && !physics.isCalm(); i++) physics.step();
        if (physics.tipUprightCoins() === 0) break;
      }
      for (let i = 0; i < 600 && !physics.isCalm(); i++) physics.step();

      const added = physics.poses();
      expect(added).toHaveLength(28);
      /* 金币现在会弹、会滑，最高的那枚不一定正好停在旧堆顶上，但一定有金币留在堆上而不是全滚到地面 */
      expect(Math.max(...added.map((coin) => coin.position.y))).toBeGreaterThan(oldPileMaxY * 0.8);
      for (const coin of added) {
        expect(coin.position.y).toBeGreaterThanOrEqual(0);
        expect(Math.hypot(coin.position.x, coin.position.z)).toBeLessThan(2);
        expect(coinAxisVertical(coin.rotation)).toBeGreaterThanOrEqual(0.45);
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

  it("接近竖立的金币会被放倒后重新参与物理结算", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.addCoin({
      radius: 0.082,
      halfHeight: 0.018,
      random: () => 0.5,
      position: { x: 0, y: 0.082, z: 0 },
      rotation: { x: Math.sin(Math.PI / 4), y: 0, z: 0, w: Math.cos(Math.PI / 4) },
    });

    expect(physics.tipUprightCoins()).toBe(1);
    for (let i = 0; i < 240 && physics.hasActiveBodies(); i++) physics.step();

    const rotation = physics.poses()[0]!.rotation;
    expect(Math.abs(1 - 2 * (rotation.x ** 2 + rotation.z ** 2))).toBeGreaterThanOrEqual(0.45);
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
    expect(physics.poses()[1]!.position.y).toBeCloseTo(3.1, 4);
    physics.dispose();
  });

  it("金币落地后会停稳", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 30; i++) { physics.addCoin({ radius: 0.082, halfHeight: 0.018, random }); physics.step(); }
    expect(physics.isCalm()).toBe(false);
    let frames = 0;
    while (!physics.isCalm() && frames++ < 600) physics.step();
    expect(frames).toBeLessThan(600);
    for (const pose of physics.poses()) expect(pose.position.y).toBeGreaterThan(0);
    physics.dispose();
  });

  it("捏住金币拖动：金币跟着走，松手后带着速度飞出去", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    const id = physics.addCoin({ radius: 0.082, halfHeight: 0.018, random: () => 0.5, position: { x: 0, y: 0.018, z: 0 }, atRest: true });
    physics.grab(id);
    expect(physics.grabbedId()).toBe(id);
    physics.dragTo({ x: 0.6, y: 1.2, z: 0 });
    for (let i = 0; i < 40; i++) physics.step();
    const lifted = physics.poses()[0]!.position;
    expect(lifted.x).toBeCloseTo(0.6, 1);
    expect(lifted.y).toBeCloseTo(1.2, 1);
    expect(physics.isCalm()).toBe(false);

    physics.dragTo({ x: -0.6, y: 1.2, z: 0 });
    for (let i = 0; i < 3; i++) physics.step();
    physics.release();
    expect(physics.grabbedId()).toBeUndefined();
    const released = physics.poses()[0]!.position.x;
    for (let i = 0; i < 6; i++) physics.step();
    expect(physics.poses()[0]!.position.x).toBeLessThan(released - 0.1);
    physics.dispose();
  });

  it("被拖着的金币会撞开别的金币", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    const hand = physics.addCoin({ radius: 0.082, halfHeight: 0.018, random: () => 0.5, position: { x: -0.5, y: 0.018, z: 0 }, atRest: true });
    physics.addCoin({ radius: 0.082, halfHeight: 0.018, random: () => 0.5, position: { x: 0, y: 0.018, z: 0 }, atRest: true });
    physics.grab(hand);
    physics.dragTo({ x: 0.5, y: 0.018, z: 0 });
    for (let i = 0; i < 60; i++) physics.step();
    const other = physics.poses()[1]!.position;
    /* 薄硬币多半是擦着滑过去，不会像台球一样被推很远，但一定被碰动了 */
    expect(Math.hypot(other.x, other.z)).toBeGreaterThan(0.005);
    physics.dispose();
  });

  it("点一下金币：弹起来翻面", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    const id = physics.addCoin({ radius: 0.082, halfHeight: 0.018, random: () => 0.5, position: { x: 0, y: 0.018, z: 0 }, atRest: true });
    for (let i = 0; i < 30; i++) physics.step();
    physics.flip(id, () => 0.5);
    let top = 0;
    let tumbled = 1;
    for (let i = 0; i < 30; i++) {
      physics.step();
      const pose = physics.poses()[0]!;
      top = Math.max(top, pose.position.y);
      tumbled = Math.min(tumbled, coinAxisVertical(pose.rotation));
    }
    expect(top).toBeGreaterThan(0.4);
    expect(tumbled).toBeLessThan(0.5);
    physics.dispose();
  });

  it("用力扔出去的金币被画面外的挡板拦住，不会丢", async () => {
    const physics = await createJarPhysics3D({ height: 4.6, radius: 0.95 });
    physics.addCoin({ radius: 0.082, halfHeight: 0.018, random: () => 0.5, position: { x: 0, y: 0.5, z: 0 }, linearVelocity: { x: 9, y: 3, z: 0 } });
    for (let i = 0; i < 400; i++) physics.step();
    const pose = physics.poses()[0]!.position;
    expect(Math.hypot(pose.x, pose.z)).toBeLessThan(0.95 * 1.45);
    expect(pose.y).toBeGreaterThan(0);
    physics.dispose();
  });
});
