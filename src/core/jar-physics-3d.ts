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
  linearVelocity?: { x: number; y: number; z: number };
}

export interface PhysicsCoinPose {
  id: string;
  lessonId?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  radius: number;
  halfHeight: number;
}

interface PhysicsCoin {
  id: string;
  lessonId?: string;
  radius: number;
  halfHeight: number;
  body: RAPIER.RigidBody;
}

let rapierReady: Promise<void> | undefined;

type Rotation = { x: number; y: number; z: number; w: number };

function rotateVector(vector: { x: number; y: number; z: number }, rotation: Rotation) {
  const { x, y, z, w } = rotation;
  const tx = 2 * (y * vector.z - z * vector.y);
  const ty = 2 * (z * vector.x - x * vector.z);
  const tz = 2 * (x * vector.y - y * vector.x);
  return {
    x: vector.x + w * tx + (y * tz - z * ty),
    y: vector.y + w * ty + (z * tx - x * tz),
    z: vector.z + w * tz + (x * ty - y * tx),
  };
}

function multiplyRotation(a: Rotation, b: Rotation): Rotation {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

async function initRapier() {
  rapierReady ??= RAPIER.init();
  await rapierReady;
}

export async function createJarPhysics3D(options: JarPhysicsOptions) {
  await initRapier();
  const world = new RAPIER.World({ x: 0, y: -32, z: 0 });
  world.timestep = 1 / 60;
  world.maxCcdSubsteps = 2;
  let currentHeight = options.height;
  const container = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.06, options.radius)
      .setTranslation(0, -0.06, 0)
      .setFriction(0.86)
      .setRestitution(0.04),
    container,
  );
  const wallSegments = 32;
  const wallThickness = 0.035;
  const halfTangent = Math.tan(Math.PI / wallSegments) * (options.radius + wallThickness) * 1.05;
  const wallColliders: RAPIER.Collider[] = [];
  const coins = new Map<string, PhysicsCoin>();
  const bulkColliders: RAPIER.Collider[] = [];
  let bulkFill = 0;
  let jarRotation = { x: 0, y: 0, z: 0, w: 1 };
  let nextId = 1;

  const rebuildWalls = () => {
    for (let i = 0; i < wallSegments; i++) {
      const angle = i / wallSegments * Math.PI * 2;
      const rotation = Math.PI / 2 - angle;
      const distance = options.radius + wallThickness;
      const translation = { x: Math.cos(angle) * distance, y: currentHeight / 2, z: Math.sin(angle) * distance };
      const existing = wallColliders[i];
      if (existing) {
        existing.setHalfExtents({ x: halfTangent, y: currentHeight / 2, z: wallThickness });
        existing.setTranslationWrtParent(translation);
      } else {
        wallColliders.push(world.createCollider(
          RAPIER.ColliderDesc.cuboid(halfTangent, currentHeight / 2, wallThickness)
          .setTranslation(Math.cos(angle) * distance, currentHeight / 2, Math.sin(angle) * distance)
          .setRotation({ x: 0, y: Math.sin(rotation / 2), z: 0, w: Math.cos(rotation / 2) })
          .setFriction(0.78)
          .setRestitution(0.04),
          container,
        ));
      }
    }
  };
  const rebuildBulk = () => {
    const target = bulkFill * currentHeight * 0.82;
    if (!target) {
      for (const collider of bulkColliders) collider.setEnabled(false);
      return;
    }
    const terraces = [
      { radius: options.radius * 0.82, height: target * 0.58 },
      { radius: options.radius * 0.58, height: target * 0.8 },
      { radius: options.radius * 0.32, height: target },
    ];
    for (const [index, terrace] of terraces.entries()) {
      let collider = bulkColliders[index];
      if (!collider) {
        collider = world.createCollider(
          RAPIER.ColliderDesc.cylinder(terrace.height / 2, terrace.radius)
          .setTranslation(0, terrace.height / 2, 0)
          .setFriction(0.26)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
          .setRestitution(0.02),
          container,
        );
        bulkColliders.push(collider);
      }
      collider.setEnabled(target > 0);
      if (target > 0) {
        collider.setHalfHeight(terrace.height / 2);
        collider.setRadius(terrace.radius);
        collider.setTranslationWrtParent({ x: 0, y: terrace.height / 2, z: 0 });
      }
    }
  };
  rebuildWalls();

  return {
    addCoin(input: AddPhysicsCoinOptions) {
      while (coins.size >= 240) {
        const oldest = coins.entries().next().value as [string, PhysicsCoin] | undefined;
        if (!oldest) break;
        world.removeRigidBody(oldest[1].body);
        coins.delete(oldest[0]);
      }
      const id = `coin-${nextId++}`;
      const localPosition = {
        x: (input.random() - 0.5) * 0.22,
        y: currentHeight - 0.25,
        z: (input.random() - 0.5) * 0.22,
      };
      const position = input.position ?? rotateVector(localPosition, jarRotation);
      const tiltX = (input.random() - 0.5) * 1.1;
      const tiltZ = (input.random() - 0.5) * 1.1;
      const localRotation = {
        x: Math.cos(tiltZ / 2) * Math.sin(tiltX / 2),
        y: Math.sin(tiltZ / 2) * Math.sin(tiltX / 2),
        z: Math.sin(tiltZ / 2) * Math.cos(tiltX / 2),
        w: Math.cos(tiltZ / 2) * Math.cos(tiltX / 2),
      };
      const rotation = multiplyRotation(jarRotation, localRotation);
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(position.x, position.y, position.z)
          .setRotation(rotation)
          .setAngvel({
            x: (input.random() - 0.5) * 9,
            y: (input.random() - 0.5) * 9,
            z: (input.random() - 0.5) * 9,
          })
          .setCcdEnabled(true)
          .setLinearDamping(0.16)
          .setAngularDamping(0.22),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cylinder(input.halfHeight, input.radius)
          .setFriction(0.72)
          .setRestitution(0.08)
          .setDensity(1),
        body,
      );
      if (input.linearVelocity) body.setLinvel(input.linearVelocity, true);
      coins.set(id, { id, lessonId: input.lessonId, radius: input.radius, halfHeight: input.halfHeight, body });
      return id;
    },
    step() {
      world.step();
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
    setBulkFill(fill: number) {
      bulkFill = Math.max(0, Math.min(1, fill));
      rebuildBulk();
    },
    setHeight(height: number) {
      const nextHeight = Math.max(0.5, height);
      if (Math.abs(nextHeight - currentHeight) < 0.001) return;
      currentHeight = nextHeight;
      rebuildWalls();
      rebuildBulk();
      for (const coin of coins.values()) coin.body.wakeUp();
    },
    setJarTilt(x: number, z: number) {
      const hx = x / 2;
      const hz = z / 2;
      jarRotation = {
        x: Math.cos(hz) * Math.sin(hx),
        y: Math.sin(hz) * Math.sin(hx),
        z: Math.sin(hz) * Math.cos(hx),
        w: Math.cos(hz) * Math.cos(hx),
      };
      container.setNextKinematicRotation(jarRotation);
      for (const coin of coins.values()) coin.body.wakeUp();
    },
    jarRotation() {
      return { ...jarRotation };
    },
    removeLesson(lessonId: string) {
      for (const [id, coin] of coins) {
        if (coin.lessonId !== lessonId) continue;
        world.removeRigidBody(coin.body);
        coins.delete(id);
      }
    },
    clearCoins() {
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
