import { ColliderDesc, JointData, RigidBodyDesc, World, type RigidBody } from "@dimforge/rapier3d-compat";
import {
  PHYSICS_WORLD_HOST_REFUSALS,
  SCENE_PHYSICS_BODY_KINDS,
  SCENE_PHYSICS_CATALOG_KIND,
  SCENE_PHYSICS_CONSTRAINT_KINDS,
  SCENE_PHYSICS_REFUSALS,
  SCENE_PHYSICS_COLLIDER_KINDS,
  isSculptIdentifier,
  type PhysicsWorldHandle,
  type ScenePhysicsCatalog,
  type ScenePhysicsCollider,
} from "@sceneaxi/schemas";

export type RapierBodyPose = Readonly<{ bodyId: string; translation: readonly [number, number, number]; rotation: readonly [number, number, number, number] }>;

export type RapierJointFrame = Readonly<{ constraintId: string; anchorA: readonly [number, number, number]; anchorB: readonly [number, number, number]; axis?: readonly [number, number, number]; rotationA?: readonly [number, number, number, number]; rotationB?: readonly [number, number, number, number] }>;

export type RapierWorldOptions = Readonly<{ poses?: readonly RapierBodyPose[]; jointFrames?: readonly RapierJointFrame[] }>;

export type RapierBodySnapshot = RapierBodyPose & Readonly<{ linearVelocity: readonly [number, number, number]; angularVelocity: readonly [number, number, number] }>;

export type RapierWorldSave = Readonly<{ schemaVersion: 1; kind: "sceneaxi.rapier-replay"; catalog: ScenePhysicsCatalog; options: RapierWorldOptions; steps: readonly Readonly<{ animation: readonly RapierBodyPose[] }>[]; terminal: string }>;

export type RapierWorldHandle = PhysicsWorldHandle & {
  queueAnimation(poses: readonly RapierBodyPose[]): void;
  poses(): readonly RapierBodySnapshot[];
  save(): RapierWorldSave;
};

function isBoundedCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1_000_000;
}

function isReplayTerminal(value: unknown): value is string {
  return typeof value === "string";
}

function boundedVector(v: readonly number[], length: number) {
  return Array.isArray(v) && v.length === length && Array.from(v).every(isBoundedCoordinate);
}

function validatePoses(poses: readonly RapierBodyPose[], ids: ReadonlySet<string>): readonly RapierBodyPose[] {
  if (!Array.isArray(poses) || poses.length > 4096) throw new Error("Invalid Rapier poses.");
  const seen = new Set<string>();

  return Object.freeze(poses.map(p => {
    if (!p || !ids.has(p.bodyId) || seen.has(p.bodyId) || !boundedVector(p.translation, 3) || !boundedVector(p.rotation, 4) || Math.abs(p.rotation.reduce((sum: number, n: number) => sum + n * n, 0) - 1) > 0.00001) throw new Error("Invalid Rapier body pose.");
    seen.add(p.bodyId);

    // SAFETY: boundedVector above checked translation length 3 and rotation length 4 with finite coordinates; spreading preserves their lengths.
    return Object.freeze({ bodyId: p.bodyId, translation: Object.freeze([...p.translation] as [number, number, number]), rotation: Object.freeze([...p.rotation] as [number, number, number, number]) });
  }));
}

const finiteFloat = (value: number) => Number.isFinite(value) && Number.isFinite(Math.fround(value));

const positiveFloat = (value: number) => finiteFloat(value) && Math.fround(value) > 0;

function uniqueIds(ids: readonly string[]) {
  return ids.every(isSculptIdentifier) && new Set(ids).size === ids.length;
}

function validateCatalog(catalog: ScenePhysicsCatalog) {
  const invalid = SCENE_PHYSICS_REFUSALS.catalogInvalid;

  if (catalog?.schemaVersion !== 1 || catalog.kind !== SCENE_PHYSICS_CATALOG_KIND ||
    !catalog.world || !Array.isArray(catalog.bodies) || !Array.isArray(catalog.colliders) ||
    !Array.isArray(catalog.materials) || !Array.isArray(catalog.constraints)) {
    throw new Error(invalid);
  }

  if (catalog.bodies.length > 4096 || catalog.colliders.length > 8192 || catalog.materials.length > 4096 || catalog.constraints.length > 4096) throw new Error(invalid);

  if (catalog.world.engine !== "rapier") throw new Error(PHYSICS_WORLD_HOST_REFUSALS.kindUnknown);

  if (!finiteFloat(catalog.world.gravityY) || !Number.isSafeInteger(catalog.world.seed)) throw new Error(invalid);

  if (!Number.isFinite(catalog.world.stepMs) || catalog.world.stepMs < 1 || catalog.world.stepMs > 32) {
    throw new Error(SCENE_PHYSICS_REFUSALS.stepUnstable);
  }

  if (!uniqueIds(catalog.bodies.map((body) => body?.bodyId)) ||
    catalog.bodies.some((body) => !isSculptIdentifier(body.instanceId) ||
      !SCENE_PHYSICS_BODY_KINDS.includes(body.kind) || !positiveFloat(body.mass))) {
    throw new Error(invalid);
  }

  const ids = new Set(catalog.bodies.map((body) => body.bodyId));

  if (!uniqueIds(catalog.colliders.map((collider) => collider?.colliderId))) throw new Error(invalid);

  for (const collider of catalog.colliders) {
    if (!ids.has(collider.bodyId)) throw new Error(SCENE_PHYSICS_REFUSALS.bodyUnknown);

    if (!SCENE_PHYSICS_COLLIDER_KINDS.includes(collider.kind) || !positiveFloat(collider.size) || !positiveFloat(collider.size / 2)) {
      throw new Error(SCENE_PHYSICS_REFUSALS.colliderInvalid);
    }
  }

  if (!uniqueIds(catalog.materials.map((material) => material?.bodyId))) throw new Error(invalid);

  for (const material of catalog.materials) {
    if (!ids.has(material.bodyId)) throw new Error(SCENE_PHYSICS_REFUSALS.bodyUnknown);

    if (!finiteFloat(material.friction) || material.friction < 0 ||
      !finiteFloat(material.restitution) || material.restitution < 0 || material.restitution > 1) {
      throw new Error(invalid);
    }
  }

  if (!uniqueIds(catalog.constraints.map((constraint) => constraint?.constraintId))) throw new Error(invalid);

  for (const constraint of catalog.constraints) {
    if (!ids.has(constraint.bodyA) || !ids.has(constraint.bodyB)) {
      throw new Error(SCENE_PHYSICS_REFUSALS.bodyUnknown);
    }

    if (!SCENE_PHYSICS_CONSTRAINT_KINDS.includes(constraint.kind) || constraint.bodyA === constraint.bodyB) {
      throw new Error(SCENE_PHYSICS_REFUSALS.constraintUnsupported);
    }
  }
}

function colliderDescriptor(collider: ScenePhysicsCollider) {
  switch (collider.kind) {
    case "box": return ColliderDesc.cuboid(collider.size / 2, collider.size / 2, collider.size / 2);
    case "sphere": return ColliderDesc.ball(collider.size);
    case "capsule": return ColliderDesc.capsule(collider.size / 2, collider.size);
  }
}

function round(value: number) {
  if (!Number.isFinite(value)) throw new Error(SCENE_PHYSICS_REFUSALS.stepUnstable);

  return Math.round(value * 1e6) / 1e6 || 0;
}

export function createWorld(catalogValue: ScenePhysicsCatalog, optionsValue: RapierWorldOptions = {}): RapierWorldHandle {
  validateCatalog(catalogValue);
  // SAFETY: validateCatalog checked the caller's ScenePhysicsCatalog above; JSON round-trip preserves its plain-data fields, checked again below before WASM allocation.
  const catalog = JSON.parse(JSON.stringify(catalogValue)) as ScenePhysicsCatalog;
  validateCatalog(catalog);
  const ids = new Set(catalog.bodies.map(b => b.bodyId));
  const poses = validatePoses(optionsValue.poses ?? [], ids);
  const frames = optionsValue.jointFrames ?? [];

  if (!Array.isArray(frames) || frames.length > 4096) throw new Error("Invalid Rapier joint frames.");
  const frameIds = new Set<string>();

  for (const f of frames) {
    if (!f || frameIds.has(f.constraintId) || !catalog.constraints.some(c => c.constraintId === f.constraintId) || !boundedVector(f.anchorA, 3) || !boundedVector(f.anchorB, 3) || (f.axis !== undefined && (!boundedVector(f.axis, 3) || Math.abs(f.axis.reduce((sum: number, n: number) => sum + n * n, 0) - 1) > 0.00001))) throw new Error("Invalid Rapier joint frame.");

    for (const rotation of [f.rotationA, f.rotationB]) if (rotation !== undefined && (!boundedVector(rotation, 4) || Math.abs(rotation.reduce((sum: number, n: number) => sum+n*n,0)-1) > 0.00001)) throw Error("Invalid Rapier joint rotation.");
    frameIds.add(f.constraintId);
  }

  // SAFETY: poses were checked by validatePoses and every joint frame was validated above; JSON round-trip preserves these numeric tuples and identifiers.
  const options = JSON.parse(JSON.stringify({ poses, jointFrames: frames })) as RapierWorldOptions;
  const poseById = new Map(poses.map(p => [p.bodyId, p]));
  const frameById = new Map(options.jointFrames?.map(f => [f.constraintId, f]));
  const dt = catalog.world.stepMs / 1000;
  const world = new World({ x: 0, y: catalog.world.gravityY, z: 0 });
  world.timestep = dt;
  const bodies = new Map<string, RigidBody>();
  const collidersByBody = new Map<string, ScenePhysicsCollider[]>();

  for (const collider of catalog.colliders) {
    const colliders = collidersByBody.get(collider.bodyId) ?? [];
    colliders.push(collider);
    collidersByBody.set(collider.bodyId, colliders);
  }

  const materialsByBody = new Map(catalog.materials.map(material => [material.bodyId, material]));

  try {
    for (const [index, body] of catalog.bodies.entries()) {
      const desc = body.kind === "dynamic" ? RigidBodyDesc.dynamic()
        : body.kind === "static" ? RigidBodyDesc.fixed() : RigidBodyDesc.kinematicPositionBased();

      const pose = poseById.get(body.bodyId);

      if (pose) {
        desc.setTranslation(...pose.translation);
        const [x, y, z, w] = pose.rotation;
        desc.setRotation({ x, y, z, w });
      } else desc.setTranslation(0, index + 1 + (catalog.world.seed % 3) * 0.01, 0);
      const colliders = collidersByBody.get(body.bodyId) ?? [];

      if (!positiveFloat(body.mass / Math.max(1, colliders.length))) {
        throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);
      }

      if (colliders.length === 0) desc.setAdditionalMass(body.mass);
      const rigidBody = world.createRigidBody(desc);
      bodies.set(body.bodyId, rigidBody);
      const material = materialsByBody.get(body.bodyId);

      for (const collider of colliders) {
        world.createCollider(colliderDescriptor(collider)
          .setMass(body.mass / colliders.length)
          .setFriction(material?.friction ?? 0.5)
          .setRestitution(material?.restitution ?? 0), rigidBody);
      }
    }

    for (const constraint of catalog.constraints) {
      const bodyA = bodies.get(constraint.bodyA);
      const bodyB = bodies.get(constraint.bodyB);

      if (bodyA === undefined || bodyB === undefined) throw new Error(SCENE_PHYSICS_REFUSALS.bodyUnknown);
      const frame = frameById.get(constraint.constraintId);
      const vec = (v: readonly number[]) => ({ x: v[0] ?? 0, y: v[1] ?? 0, z: v[2] ?? 0 });
      const anchorA = frame ? vec(frame.anchorA) : { x: 0, y: bodyB.translation().y - bodyA.translation().y, z: 0 };
      const anchorB = frame ? vec(frame.anchorB) : { x: 0, y: 0, z: 0 };
      const identity = { x: 0, y: 0, z: 0, w: 1 };

      const quaternion = (v: readonly [number, number, number, number] | undefined) => v === undefined ? identity : { x: v[0], y: v[1], z: v[2], w: v[3] };

      const joint = constraint.kind === "fixed"
        ? JointData.fixed(anchorA, quaternion(frame?.rotationA), anchorB, quaternion(frame?.rotationB))
        : JointData.revolute(anchorA, anchorB, frame?.axis ? vec(frame.axis) : { x: 1, y: 0, z: 0 });

      world.createImpulseJoint(joint, bodyA, bodyB, true).setContactsEnabled(false);
    }
  } catch (error) {
    world.free();
    throw error;
  }

  let disposed = false;
  let pending: readonly RapierBodyPose[] = Object.freeze([]);
  const steps: Array<Readonly<{ animation: readonly RapierBodyPose[] }>> = [];

  function assertReady() {
    if (disposed) throw new Error(PHYSICS_WORLD_HOST_REFUSALS.notReady);
  }

  const handle: RapierWorldHandle = Object.freeze({
    queueAnimation(input: readonly RapierBodyPose[]) {
      assertReady();
      pending = validatePoses(input, ids);
    },
    poses() {
      assertReady();

      return Object.freeze([...bodies].map(([bodyId, b]) => {
        const p = b.translation(), q = b.rotation(), v = b.linvel(), a = b.angvel();

        // SAFETY: each literal contains exactly 3 vector or 4 quaternion coordinates from Rapier; map(round) checks finiteness and preserves those lengths.
        return Object.freeze({ bodyId, translation: Object.freeze([p.x, p.y, p.z].map(round) as [number, number, number]), rotation: Object.freeze([q.x, q.y, q.z, q.w].map(round) as [number, number, number, number]), linearVelocity: Object.freeze([v.x, v.y, v.z].map(round) as [number, number, number]), angularVelocity: Object.freeze([a.x, a.y, a.z].map(round) as [number, number, number]) });
      }));
    },
    save() {
      assertReady();

      if (pending.length > 0) throw new Error("Cannot save pending Rapier animation; step first.");

      // SAFETY: catalog and options are validated local JSON snapshots created above; another JSON round-trip preserves their plain-data fields.
      return Object.freeze({ schemaVersion: 1, kind: "sceneaxi.rapier-replay", catalog: JSON.parse(JSON.stringify(catalog)) as ScenePhysicsCatalog, options: JSON.parse(JSON.stringify(options)) as RapierWorldOptions, steps: Object.freeze([...steps]), terminal: handle.serialize() });
    },
    step(dtSeconds: number) {
      assertReady();

      if (dtSeconds !== dt) throw new Error(SCENE_PHYSICS_REFUSALS.stepUnstable);

      if (steps.length >= 100_000) throw new Error("Rapier replay capacity exceeded.");

      // Animation candidates are applied before the fixed physics step.
      for (const pose of pending) {
        const body = bodies.get(pose.bodyId);

        if (!body) throw new Error(SCENE_PHYSICS_REFUSALS.bodyUnknown);
        const [x, y, z] = pose.translation;
        const [rx, ry, rz, rw] = pose.rotation;

        if (body.isKinematic()) { body.setNextKinematicTranslation({ x, y, z }); body.setNextKinematicRotation({ x: rx, y: ry, z: rz, w: rw }); }
        else { body.setTranslation({ x, y, z }, true); body.setRotation({ x: rx, y: ry, z: rz, w: rw }, true); }
      }

      world.step();
      steps.push(Object.freeze({ animation: pending }));
      pending = Object.freeze([]);
    },
    snapshot() {
      assertReady();

      return Object.freeze([...bodies].map(([bodyId, body]) => Object.freeze({
        bodyId,
        y: round(body.translation().y),
        vy: round(body.linvel().y),
      })));
    },
    serialize() {
      assertReady();

      return JSON.stringify([...bodies].map(([bodyId, body]) => {
        const position = body.translation();
        const rotation = body.rotation();
        const velocity = body.linvel();
        const angular = body.angvel();

        return [bodyId, ...[
          position.x, position.y, position.z,
          rotation.x, rotation.y, rotation.z, rotation.w,
          velocity.x, velocity.y, velocity.z,
          angular.x, angular.y, angular.z,
        ].map(round)];
      }));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      bodies.clear();
      pending = Object.freeze([]);
      steps.length = 0;
      world.free();
    },
  });

  return handle;
}

export function replayWorld(save: RapierWorldSave): RapierWorldHandle {
  if (!save || save.schemaVersion !== 1 || save.kind !== "sceneaxi.rapier-replay" || !Array.isArray(save.steps) || save.steps.length > 100_000 || !isReplayTerminal(save.terminal) || save.terminal.length > 2 * 1024 * 1024) throw new Error("Invalid Rapier save.");
  const world = createWorld(save.catalog, save.options);

  try {
    for (const step of save.steps) { world.queueAnimation(step.animation); world.step(save.catalog.world.stepMs / 1000); }

    if (world.serialize() !== save.terminal) throw new Error("Rapier replay mismatch.");

    return world;
  } catch (error) { world.dispose(); throw error; }
}
