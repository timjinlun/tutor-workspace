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

async function initRapier() {
  rapierReady ??= RAPIER.init();
  await rapierReady;
}

export async function createJarPhysics3D(options: JarPhysicsOptions) {
  await initRapier();
  const world = new RAPIER.World({ x: 0, y: -32, z: 0 });
  world.timestep = 1 / 60;
  world.maxCcdSubsteps = 2;
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
  for (let i = 0; i < wallSegments; i++) {
    const angle = i / wallSegments * Math.PI * 2;
    const rotation = Math.PI / 2 - angle;
    const distance = options.radius + wallThickness;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfTangent, options.height / 2, wallThickness)
        .setTranslation(Math.cos(angle) * distance, options.height / 2, Math.sin(angle) * distance)
        .setRotation({ x: 0, y: Math.sin(rotation / 2), z: 0, w: Math.cos(rotation / 2) })
        .setFriction(0.78)
        .setRestitution(0.04),
      container,
    );
  }
  const coins = new Map<string, PhysicsCoin>();
  let nextId = 1;

  return {
    addCoin(input: AddPhysicsCoinOptions) {
      const id = `coin-${nextId++}`;
      const position = input.position ?? {
        x: (input.random() - 0.5) * 0.22,
        y: options.height - 0.25,
        z: (input.random() - 0.5) * 0.22,
      };
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(position.x, position.y, position.z)
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
    removeLesson(lessonId: string) {
      for (const [id, coin] of coins) {
        if (coin.lessonId !== lessonId) continue;
        world.removeRigidBody(coin.body);
        coins.delete(id);
      }
    },
    dispose() {
      coins.clear();
      world.free();
    },
  };
}

export type JarPhysics3D = Awaited<ReturnType<typeof createJarPhysics3D>>;
