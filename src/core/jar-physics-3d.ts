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

function coinCollider(radius: number, halfHeight: number) {
  const bevel = Math.min(halfHeight * 0.25, radius * 0.06);
  return RAPIER.ColliderDesc.roundCylinder(halfHeight - bevel, radius - bevel, bevel);
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
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(options.radius * 2.25, 0.06, options.radius * 1.45)
      .setTranslation(0, -0.06, 0)
      .setFriction(0.86)
      .setRestitution(0.04),
    ground,
  );
  const coins = new Map<string, PhysicsCoin>();
  let staticPileBodies: RAPIER.RigidBody[] = [];
  let nextId = 1;
  return {
    sceneKind: "open-ground" as const,
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
          .setRotation(localRotation)
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
        coinCollider(input.radius, input.halfHeight)
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
