# Savings Jar 3D Physics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the savings jar's 2D collision simulation with bounded Rapier 3D cylinder rigid bodies that fall, collide, mound, sleep, and respond when the jar tilts.

**Architecture:** A renderer-owned `JarPhysics3D` adapter wraps Rapier and exposes serializable coin poses to WebGL. A kinematic compound container supplies the bottom and circular wall; a deterministic terraced mound represents merged historical volume while up to 240 dynamic cylinder coins form the moving surface. The ledger remains authoritative and no rigid-body state is persisted.

**Tech Stack:** Electron 43, React 19, TypeScript, WebGL 2, `@dimforge/rapier3d-compat@0.20.0`, Vitest.

---

### Task 1: Add the Rapier adapter contract

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/core/jar-physics-3d.ts`
- Create: `tests/jar-physics-3d.test.ts`

**Step 1: Install the runtime dependency**

Run: `npm install @dimforge/rapier3d-compat@0.20.0`

**Step 2: Write the failing adapter test**

Test an async `createJarPhysics3D({ height: 4.6, radius: 0.95 })` contract. Require `addCoin()` to return a stable ID and `poses()` to expose `{ id, position: {x,y,z}, rotation: {x,y,z,w}, radius, halfHeight }`.

**Step 3: Run the test to verify RED**

Run: `npx vitest run tests/jar-physics-3d.test.ts`

Expected: FAIL because `jar-physics-3d.ts` does not exist.

**Step 4: Implement the minimal initialized world**

Import the compat build, await its initializer once, create `new RAPIER.World({ x: 0, y: -32, z: 0 })`, and implement `addCoin`, `poses`, `step`, `hasActiveBodies`, `removeLesson`, and `dispose`. A coin uses `RigidBodyDesc.dynamic().setCcdEnabled(true)` and `ColliderDesc.cylinder(halfHeight, radius)` with friction and low restitution.

**Step 5: Verify GREEN and commit**

Run: `npx vitest run tests/jar-physics-3d.test.ts && npm run typecheck`

Commit: `feat: add Rapier savings jar physics adapter`

### Task 2: Build a closed cylindrical container and volume contacts

**Files:**
- Modify: `src/core/jar-physics-3d.ts`
- Modify: `tests/jar-physics-3d.test.ts`

**Step 1: Write failing physics tests**

Add tests proving that:

- a coin spawned above the jar moves downward and remains above the bottom;
- coins spawned with different `z` values retain three-dimensional separation;
- two overlapping cylinder coins separate after fixed steps;
- every settled center stays inside the circular inner wall;
- `removeLesson(id)` removes only matching rigid bodies.

**Step 2: Run tests to verify RED**

Run: `npx vitest run tests/jar-physics-3d.test.ts`

Expected: FAIL on floor, wall, or overlap assertions.

**Step 3: Implement the compound container**

Create one kinematic-position-based body. Attach a bottom cylinder and 32 tangential narrow cuboids around the inner radius. Give the wall and bottom high friction. Step at `1 / 60` seconds with bounded catch-up and enable two CCD substeps.

**Step 4: Verify GREEN and commit**

Run: `npx vitest run tests/jar-physics-3d.test.ts`

Commit: `feat: add cylindrical jar volume collisions`

### Task 3: Create a bounded mound and tilt response

**Files:**
- Create: `src/core/jar-pile.ts`
- Create: `tests/jar-pile.test.ts`
- Modify: `src/core/jar-physics-3d.ts`
- Modify: `tests/jar-physics-3d.test.ts`

**Step 1: Write failing mound tests**

Test `buildJarPile(fill, count, radius, halfHeight)` for deterministic output, circular bounds, finite values, and a center region whose maximum height exceeds the outer region. Test that the count is capped at 240.

Add a physics test that calls `setJarTilt(x, z)`, steps the world, and verifies at least one surface coin changes both horizontal position and rotation before the world sleeps again.

**Step 2: Run tests to verify RED**

Run: `npx vitest run tests/jar-pile.test.ts tests/jar-physics-3d.test.ts`

**Step 3: Implement pile sampling and collision volume**

Generate seeded concentric hex layers that narrow toward the top. Add a small set of concentric cylinder colliders to the kinematic container as a terraced bulk mound. Rebuild it when fill changes, leaving the upper dynamic bodies free to collide and roll. Rotate the kinematic container with `setNextKinematicRotation`; wake surface bodies on tilt.

**Step 4: Verify GREEN and commit**

Run: `npx vitest run tests/jar-pile.test.ts tests/jar-physics-3d.test.ts && node scripts/benchmark-jar.mjs`

Commit: `feat: form a bounded physical coin mound`

### Task 4: Render complete rigid-body poses

**Files:**
- Modify: `src/ui/widgets/jar-webgl.ts`
- Modify: `src/core/jar-mesh.ts`
- Modify: `tests/jar-mesh.test.ts`

**Step 1: Write the failing transform test**

Add a pure matrix test showing that a non-identity quaternion changes the world-space coin normal while preserving its length.

**Step 2: Run test to verify RED**

Run: `npx vitest run tests/jar-mesh.test.ts`

**Step 3: Implement quaternion rendering**

Pass each coin's Rapier quaternion to the vertex shader and rotate position and normal with a quaternion-to-matrix conversion. Pass the same jar tilt quaternion to body and lid rendering. Keep depth testing, transparent glass blending, gold material, resource cleanup, and WebGL context restoration.

**Step 4: Verify GREEN and commit**

Run: `npx vitest run tests/jar-mesh.test.ts && npm run typecheck && npm run build`

Commit: `feat: render rigid-body coin rotations`

### Task 5: Connect ledger feedback and drag tilt

**Files:**
- Modify: `src/ui/widgets/SavingsJar.tsx`
- Modify: `src/ui/widgets/savings-jar.css`
- Modify: `scripts/verify-jar.cjs`
- Modify: `tests/coin-queue.test.ts`

**Step 1: Extend the failing Electron acceptance assertions**

Require the canvas to expose `data-physics="rapier3d"`, confirm a falling frame contains coins with nonzero depth and non-identity rotation, confirm a settled pile has center height above its edge, and confirm drag tilt changes coin positions before reaching an idle state.

**Step 2: Run acceptance to verify RED**

Run: `npm run build && npx electron scripts/verify-jar.cjs`

Expected: FAIL because the current component still uses `jar-physics.ts` and camera-only dragging.

**Step 3: Integrate the async physics adapter**

Initialize Rapier once after canvas mount. Feed scheduled emissions into `addCoin`; map ledger undo to `removeLesson`; rebuild deterministic pile from current fill; feed `poses()` directly to WebGL. During pointer drag update `setJarTilt`, and keep stepping until all bodies sleep. On reduced motion, update the stable pile without starting a frame loop. Dispose the world on unmount and context loss.

**Step 4: Verify GREEN and commit**

Run: `npm test && npm run typecheck && npm run build && npx electron scripts/verify-jar.cjs`

Commit: `feat: connect savings jar to real 3D physics`

### Task 6: Final QA, documentation, and local package

**Files:**
- Modify: `docs/spec-储蓄罐.md`
- Modify: `docs/储蓄罐交付.md`
- Modify: `HANDOFF.md`
- Modify: `docs/qa/jar/evidence.json`
- Create: `docs/qa/jar/falling-3d.png`
- Create: `docs/qa/jar/mound-3d.png`
- Create: `docs/qa/jar/tilted-3d.png`

**Step 1: Run complete verification**

Run: `npm test && npm run typecheck && npm run lint && npm run build`

Run: `node scripts/benchmark-jar.mjs`

Run: `npx electron scripts/verify-jar.cjs`

Run: `npx electron scripts/verify-closing.cjs`

**Step 2: Inspect screenshots and evidence**

Confirm the jar remains directly below “更多”, the gold coins visibly occupy depth, the pile has an uneven mound silhouette, tilt causes redistribution, compact layout does not overlap settings, reduced motion emits no animated bodies, and idle rAF delta remains zero.

**Step 3: Update documentation**

Record Rapier as a runtime dependency, distinguish dynamic rigid-body surface coins from the bounded bulk mound, and report measured limits without claiming every historical currency unit maps to a persistent body.

**Step 4: Build the local app and inspect its bundle**

Run: `npm run pack`

Confirm `dist/mac-arm64/记一课.app` is signed and its renderer bundle contains the Rapier integration.

**Step 5: Verify docs and commit**

Run: `git diff --check && git status --short`

Commit: `docs: record real 3D savings jar physics delivery`

