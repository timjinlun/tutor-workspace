import RAPIER from "@dimforge/rapier3d-compat";

export interface JarPhysicsOptions {
  height: number;
  radius: number;
}

export interface AddPhysicsCoinOptions {
  radius: number;
  halfHeight: number;
  lessonId?: string;
  random: () => number;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  linearVelocity?: { x: number; y: number; z: number };
  /** 原地放下、不带初始旋转：把已经堆好的金币重新变成可以碰的刚体时用 */
  atRest?: boolean;
}

type Vec3 = { x: number; y: number; z: number };

/**
 * 手感参数。金币在画面里有十几厘米宽，按真实重力算会像在水里飘；
 * 把重力放大到和它的视觉尺寸相称，再给一点弹性和很小的阻尼，才是硬币落在桌面上的样子。
 */
const GRAVITY = -42;
const SUBSTEPS = 2;
const FIELD_RADIUS_FACTOR = 1.2;
const RAMP_SLOPE = 0.7;
const DRAG_STIFFNESS = 22;
const DRAG_MAX_SPEED = 16;
const THROW_MAX_SPEED = 9;
/* 停稳的判据：连续两个窗口里，每枚金币的位移和转动都小于这个量 */
const CALM_WINDOW = 10;
const CALM_SHIFT = 0.004;
const CALM_TURN = 0.0004;
const TOPPLE_PUSH = 0.5;

export interface PhysicsCoinPose {
  id: string;
  lessonId?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  radius: number;
  halfHeight: number;
}

export function coinAxisVertical(rotation: PhysicsCoinPose["rotation"]) {
  return Math.abs(1 - 2 * (rotation.x ** 2 + rotation.z ** 2));
}

interface PhysicsCoin {
  id: string;
  lessonId?: string;
  radius: number;
  halfHeight: number;
  body: RAPIER.RigidBody;
  sample?: { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number };
}

let rapierReady: Promise<void> | undefined;

function coinCollider(radius: number, halfHeight: number) {
  /* 边缘做成整圈圆弧：立着的时候没有平的棱可以站稳，会像真硬币那样晃几下倒下去 */
  const bevel = halfHeight * 0.9;
  return RAPIER.ColliderDesc.roundCylinder(halfHeight - bevel, radius - bevel, bevel);
}

async function initRapier() {
  rapierReady ??= RAPIER.init();
  await rapierReady;
}

export async function createJarPhysics3D(options: JarPhysicsOptions) {
  await initRapier();
  const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
  world.timestep = 1 / 60 / SUBSTEPS;
  world.maxCcdSubsteps = 4;
  let currentHeight = options.height;
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(options.radius * 8, 0.06, options.radius * 8)
      .setTranslation(0, -0.06, 0)
      .setFriction(0.7)
      .setRestitution(0.3),
    ground,
  );
  /*
   * 地面是敞开的，没有罐壁。但被扔出去的金币不能滚出画面找不回来：
   * 画面边缘外是一圈看不见的缓坡，金币冲上去会自己滑回来。用坡不用墙，金币就不会斜靠在空气上。
   */
  const fieldRadius = options.radius * FIELD_RADIUS_FACTOR;
  const RAMP_SEGMENTS = 24;
  const RAMP_HALF_LENGTH = 1.2;
  const RAMP_HALF_THICKNESS = 0.04;
  const rampCos = Math.cos(RAMP_SLOPE);
  const rampSin = Math.sin(RAMP_SLOPE);
  const rampCenterRadius = fieldRadius + rampCos * RAMP_HALF_LENGTH + rampSin * RAMP_HALF_THICKNESS;
  const rampCenterHeight = rampSin * RAMP_HALF_LENGTH - rampCos * RAMP_HALF_THICKNESS;
  const rampHalfWidth = (fieldRadius + 2 * RAMP_HALF_LENGTH) * Math.tan(Math.PI / RAMP_SEGMENTS) + 0.05;
  for (let i = 0; i < RAMP_SEGMENTS; i++) {
    const angle = (i / RAMP_SEGMENTS) * Math.PI * 2;
    const s1 = Math.sin(-angle / 2), c1 = Math.cos(-angle / 2), s2 = Math.sin(RAMP_SLOPE / 2), c2 = Math.cos(RAMP_SLOPE / 2);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(RAMP_HALF_LENGTH, RAMP_HALF_THICKNESS, rampHalfWidth)
        .setTranslation(Math.cos(angle) * rampCenterRadius, rampCenterHeight, Math.sin(angle) * rampCenterRadius)
        .setRotation({ x: s1 * s2, y: s1 * c2, z: c1 * s2, w: c1 * c2 })
        .setFriction(0.12)
        .setRestitution(0.1),
      ground,
    );
  }
  let grabbed: { coin: PhysicsCoin; target: Vec3 } | undefined;
  let calmWindows = 0;
  let frame = 0;
  const coins = new Map<string, PhysicsCoin>();
  let staticPileBodies: RAPIER.RigidBody[] = [];
  let nextId = 1;
  return {
    sceneKind: "open-ground" as const,
    addCoin(input: AddPhysicsCoinOptions) {
      const id = `coin-${nextId++}`;
      const localPosition = {
        x: (input.random() - 0.5) * 0.6,
        /* 从画面上沿外面掉进来，而不是凭空出现在半空 */
        y: currentHeight + 0.55 + input.random() * 0.5,
        z: (input.random() - 0.5) * 0.7,
      };
      const position = input.position ?? localPosition;
      const tiltX = (input.random() - 0.5) * 1.1;
      const tiltZ = (input.random() - 0.5) * 1.1;
      const localRotation = {
        x: Math.cos(tiltZ / 2) * Math.sin(tiltX / 2),
        y: Math.sin(tiltZ / 2) * Math.sin(tiltX / 2),
        z: Math.sin(tiltZ / 2) * Math.cos(tiltX / 2),
        w: Math.cos(tiltZ / 2) * Math.cos(tiltX / 2),
      };
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(position.x, position.y, position.z)
          .setRotation(input.rotation ?? localRotation)
          /* 像被人弹出来的硬币：绕水平轴翻着跟头下来 */
          .setAngvel(input.atRest ? { x: 0, y: 0, z: 0 } : {
            x: (input.random() - 0.5) * 22,
            y: (input.random() - 0.5) * 5,
            z: (input.random() - 0.5) * 22,
          })
          .setCcdEnabled(true)
          .setLinearDamping(1.2)
          .setAngularDamping(2.2),
      );
      world.createCollider(
        coinCollider(input.radius, input.halfHeight)
          .setFriction(0.9)
          .setRestitution(0.15)
          .setDensity(1),
        body,
      );
      if (input.linearVelocity) body.setLinvel(input.linearVelocity, true);
      else if (!input.atRest && !input.position) body.setLinvel({ x: (input.random() - 0.5) * 1.2, y: -6, z: (input.random() - 0.5) * 1.2 }, true);
      coins.set(id, { id, lessonId: input.lessonId, radius: input.radius, halfHeight: input.halfHeight, body });
      calmWindows = 0;
      return id;
    },
    /** 走一帧（1/60 秒），内部分成更细的子步，薄薄的硬币在大重力下才不会互相穿过去 */
    step() {
      for (let i = 0; i < SUBSTEPS; i++) {
        if (grabbed) {
          const { body } = grabbed.coin;
          const at = body.translation();
          const pull = { x: (grabbed.target.x - at.x) * DRAG_STIFFNESS, y: (grabbed.target.y - at.y) * DRAG_STIFFNESS, z: (grabbed.target.z - at.z) * DRAG_STIFFNESS };
          const speed = Math.hypot(pull.x, pull.y, pull.z);
          const k = speed > DRAG_MAX_SPEED ? DRAG_MAX_SPEED / speed : 1;
          body.setLinvel({ x: pull.x * k, y: pull.y * k, z: pull.z * k }, true);
          const spin = body.angvel();
          body.setAngvel({ x: spin.x * 0.9, y: spin.y * 0.9, z: spin.z * 0.9 }, true);
        }
        world.step();
      }
      for (const coin of coins.values()) {
        if (coin.body.isSleeping() || grabbed?.coin === coin) continue;
        const v = coin.body.linvel();
        const w = coin.body.angvel();
        /*
         * 理想圆柱立着能一直滚下去，真硬币做不到：边缘不平，晃两下就倒。
         * 立着贴地滚的金币，每帧轻轻推它一把，让它像真的一样晃倒，而不是瞬移放平。
         */
        const q = coin.body.rotation();
        const axis = { x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z), z: 2 * (q.y * q.z + q.w * q.x) };
        const flatness = Math.hypot(axis.x, axis.z);
        if (Math.abs(axis.y) < 0.5 && Math.abs(v.y) < 1.5 && flatness > 0) {
          /* 正好立直时没有「已经在往哪边倒」可言，就按编号固定挑一边，免得每帧来回抵消 */
          const leaning = Math.abs(axis.y) > 0.04 ? axis.y > 0 : Number(coin.id.replace(/\D/g, "")) % 2 === 0;
          const push = (leaning ? -1 : 1) * TOPPLE_PUSH / flatness;
          coin.body.setAngvel({ x: w.x + axis.z * push, y: w.y, z: w.z - axis.x * push }, true);
        }
      }
      /* 每隔几帧比一次位置：引擎里叠着的硬币速度会一直抖，但位置其实没动，看位移才准 */
      if (++frame % CALM_WINDOW === 0) {
        let moving = !!grabbed;
        for (const coin of coins.values()) {
          const at = coin.body.translation();
          const q = coin.body.rotation();
          const was = coin.sample;
          coin.sample = { x: at.x, y: at.y, z: at.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w };
          if (!was) { moving = true; continue; }
          const turned = 1 - Math.abs(was.qx * q.x + was.qy * q.y + was.qz * q.z + was.qw * q.w);
          if (Math.hypot(at.x - was.x, at.y - was.y, at.z - was.z) > CALM_SHIFT || turned > CALM_TURN) moving = true;
        }
        calmWindows = moving ? 0 : calmWindows + 1;
      }
    },
    /** 所有金币都已经停稳（或者根本没有在动的金币） */
    isCalm() {
      return coins.size === 0 || calmWindows >= 2;
    },
    /** 捏住一枚金币。之后每帧它会被拉向 dragTo 给的位置，仍然会撞开别的金币 */
    grab(id: string) {
      const coin = coins.get(id)!;
      grabbed = { coin, target: { ...coin.body.translation() } };
      coin.body.wakeUp();
    },
    dragTo(target: Vec3) {
      const limit = fieldRadius;
      const reach = Math.hypot(target.x, target.z);
      const k = reach > limit ? limit / reach : 1;
      grabbed!.target = { x: target.x * k, y: Math.max(grabbed!.coin.halfHeight, target.y), z: target.z * k };
    },
    /** 松手：保留手上的速度甩出去 */
    release() {
      const body = grabbed!.coin.body;
      grabbed = undefined;
      const v = body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed > THROW_MAX_SPEED) body.setLinvel({ x: v.x * THROW_MAX_SPEED / speed, y: v.y * THROW_MAX_SPEED / speed, z: v.z * THROW_MAX_SPEED / speed }, true);
    },
    grabbedId() {
      return grabbed?.coin.id;
    },
    /** 点一下：像用拇指弹硬币，翻着跟头跳起来 */
    flip(id: string, random: () => number) {
      const { body } = coins.get(id)!;
      const heading = random() * Math.PI * 2;
      body.setLinvel({ x: Math.cos(heading) * 0.9, y: 7.5 + random() * 2, z: Math.sin(heading) * 0.9 }, true);
      calmWindows = 0;
      body.setAngvel({ x: Math.cos(heading + Math.PI / 2) * 30, y: (random() - 0.5) * 6, z: Math.sin(heading + Math.PI / 2) * 30 }, true);
    },
    poses(): PhysicsCoinPose[] {
      return [...coins.values()].map((coin) => {
        const position = coin.body.translation();
        const rotation = coin.body.rotation();
        return {
          id: coin.id,
          lessonId: coin.lessonId,
          position: { x: position.x, y: position.y, z: position.z },
          rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
          radius: coin.radius,
          halfHeight: coin.halfHeight,
        };
      });
    },
    hasActiveBodies() {
      return [...coins.values()].some((coin) => !coin.body.isSleeping());
    },
    tipUprightCoins(minAxisVertical = 0.45) {
      let tipped = 0;
      for (const coin of coins.values()) {
        if (coinAxisVertical(coin.body.rotation()) >= minAxisVertical) continue;
        const position = coin.body.translation();
        const direction = Number(coin.id.replace(/\D/g, "")) % 2 ? 1 : -1;
        const tilt = direction * 0.08;
        coin.body.setTranslation({ x: position.x, y: position.y + coin.radius * 0.75, z: position.z }, true);
        coin.body.setRotation({ x: Math.sin(tilt / 2), y: 0, z: 0, w: Math.cos(tilt / 2) }, true);
        coin.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        coin.body.setAngvel({ x: 0, y: 0, z: direction * 0.35 }, true);
        tipped++;
      }
      return tipped;
    },
    setStaticPile(pile: PhysicsCoinPose[]) {
      for (const body of staticPileBodies) world.removeRigidBody(body);
      staticPileBodies = pile.map((coin) => {
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(coin.position.x, coin.position.y, coin.position.z)
            .setRotation(coin.rotation),
        );
        world.createCollider(
          coinCollider(coin.radius, coin.halfHeight)
            .setFriction(0.72)
            .setRestitution(0.04),
          body,
        );
        return body;
      });
      for (const coin of coins.values()) coin.body.wakeUp();
    },
    setHeight(height: number) {
      const nextHeight = Math.max(0.5, height);
      if (Math.abs(nextHeight - currentHeight) < 0.001) return;
      currentHeight = nextHeight;
      for (const coin of coins.values()) coin.body.wakeUp();
    },
    removeLesson(lessonId: string) {
      for (const [id, coin] of coins) {
        if (coin.lessonId !== lessonId) continue;
        if (grabbed?.coin === coin) grabbed = undefined;
        world.removeRigidBody(coin.body);
        coins.delete(id);
      }
    },
    clearCoins() {
      grabbed = undefined;
      for (const coin of coins.values()) world.removeRigidBody(coin.body);
      coins.clear();
    },
    dispose() {
      coins.clear();
      world.free();
    },
  };
}

export type JarPhysics3D = Awaited<ReturnType<typeof createJarPhysics3D>>;
