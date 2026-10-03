import { ColliderDesc, JointData, RigidBodyDesc, World, type RigidBody } from "@dimforge/rapier3d-compat";
import {
  PHYSICS_WORLD_HOST_REFUSALS,
  SCENE_PHYSICS_BODY_KINDS,
  SCENE_PHYSICS_CATALOG_KIND,
  SCENE_PHYSICS_CONSTRAINT_KINDS,
  SCENE_PHYSICS_REFUSALS,
  SCENE_PHYSICS_COLLIDER_KINDS,
  isSculptIdentifier,
  requireScenePhysicsCatalog,
  snapshotPlainArray,
  snapshotPlainRecord,
  type PhysicsWorldHandle,
  type ScenePhysicsCatalog,
  type ScenePhysicsCollider,
} from "@sceneaxi/schemas";

type RapierBoundaryInput = Parameters<typeof snapshotPlainRecord>[0];

export type RapierBodyPose = Readonly<{ bodyId: string; translation: readonly [number, number, number]; rotation: readonly [number, number, number, number] }>;

export type RapierJointFrame = Readonly<{ constraintId: string; anchorA: readonly [number, number, number]; anchorB: readonly [number, number, number]; axis?: readonly [number, number, number]; rotationA?: readonly [number, number, number, number]; rotationB?: readonly [number, number, number, number] }>;

export type RapierWorldOptions = Readonly<{ poses?: readonly RapierBodyPose[]; jointFrames?: readonly RapierJointFrame[] }>;

export type RapierBodySnapshot = RapierBodyPose & Readonly<{ linearVelocity: readonly [number, number, number]; angularVelocity: readonly [number, number, number] }>;

export type RapierWorldSave = Readonly<{ schemaVersion: 1; kind: "sceneaxi.rapier-replay"; catalog: ScenePhysicsCatalog; options: RapierWorldOptions; steps: readonly Readonly<{ animation: readonly RapierBodyPose[] }>[]; terminal: string }>;

export type RapierWorldHandle = PhysicsWorldHandle & {
  queueAnimation(poses: RapierBoundaryInput): void;
  poses(): readonly RapierBodySnapshot[];
  save(): RapierWorldSave;
};

function isBoundedCoordinate(value: RapierBoundaryInput): value is number {
  return isBoundaryNumber(value) && Number.isFinite(value) && Math.abs(value) <= 1_000_000;
}

function isReplayTerminal(value: RapierBoundaryInput): value is string {
  return typeof value === "string";
}

function boundedArray(value: RapierBoundaryInput, maximum: number): readonly unknown[] {
  try {
    const length: unknown = value !== null && isBoundaryObjectOrNull(value) ? Object.getOwnPropertyDescriptor(value, "length")?.value : undefined;

    if (!isBoundaryNumber(length) || !Number.isSafeInteger(length) || length < 0 || length > maximum) throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);
    const result = snapshotPlainArray(value);

    if (result) return result;
  } catch { /* Descriptor traps become the named refusal below. */ }

  throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);
}

function vector3(value: RapierBoundaryInput): readonly [number, number, number] {
  const values = boundedArray(value, 3), [x, y, z] = values;

  if (values.length !== 3 || !isBoundedCoordinate(x) || !isBoundedCoordinate(y) || !isBoundedCoordinate(z)) throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);

  return Object.freeze([x, y, z]);
}

function quaternion(value: RapierBoundaryInput): readonly [number, number, number, number] {
  const values = boundedArray(value, 4), [x, y, z, w] = values;

  if (values.length !== 4 || !isBoundedCoordinate(x) || !isBoundedCoordinate(y) || !isBoundedCoordinate(z) || !isBoundedCoordinate(w) ||
    Math.abs(x*x + y*y + z*z + w*w - 1) > 0.00001) throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);

  return Object.freeze([x, y, z, w]);
}

function validatePoses(value: RapierBoundaryInput, ids: ReadonlySet<string>): readonly RapierBodyPose[] {
  const seen = new Set<string>();

  return Object.freeze(boundedArray(value, 4096).map((item) => {
    const pose = snapshotPlainRecord(item), bodyId = pose?.["bodyId"];

    if (!pose || !isBoundaryString(bodyId) || !ids.has(bodyId) || seen.has(bodyId)) throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);
    seen.add(bodyId);

    return Object.freeze({ bodyId, translation: vector3(pose["translation"]), rotation: quaternion(pose["rotation"]) });
  }));
}

const finiteFloat = (value: number) => Number.isFinite(value) && Number.isFinite(Math.fround(value));

const positiveFloat = (value: number) => finiteFloat(value) && Math.fround(value) > 0;

function uniqueIds(ids: readonly string[]) {
  return ids.every(isSculptIdentifier) && new Set(ids).size === ids.length;
}

function validateCatalog(catalog: ReturnType<typeof requireScenePhysicsCatalog>) {
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

export function createWorld(catalogValue: RapierBoundaryInput, optionsValue: RapierBoundaryInput = {}): RapierWorldHandle {
  const catalog = requireScenePhysicsCatalog(catalogValue);
  validateCatalog(catalog);
  const ids = new Set(catalog.bodies.map(b => b.bodyId));
  const input = snapshotPlainRecord(optionsValue);

  if (!input || Object.keys(input).some((key) => key !== "poses" && key !== "jointFrames")) throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);
  const poses = validatePoses(input["poses"] ?? [], ids);
  const frameIds = new Set<string>();

  const frames = boundedArray(input["jointFrames"] ?? [], 4096).map((item): RapierJointFrame => {
    const frame = snapshotPlainRecord(item), constraintId = frame?.["constraintId"];

    if (!frame || !isBoundaryString(constraintId) || frameIds.has(constraintId) || !catalog.constraints.some((constraint) => constraint.constraintId === constraintId)) throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);
    frameIds.add(constraintId);
    const axis = frame["axis"] === undefined ? undefined : vector3(frame["axis"]);

    if (axis && Math.abs(axis[0]*axis[0] + axis[1]*axis[1] + axis[2]*axis[2] - 1) > 0.00001) throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);

    const captured: RapierJointFrameBuilder = { constraintId, anchorA: vector3(frame["anchorA"]), anchorB: vector3(frame["anchorB"]) };

    if (axis) captured.axis = axis;

    if (frame["rotationA"] !== undefined) captured.rotationA = quaternion(frame["rotationA"]);

    if (frame["rotationB"] !== undefined) captured.rotationB = quaternion(frame["rotationB"]);

    return Object.freeze(captured);
  });

  const options: RapierWorldOptions = Object.freeze({ poses, jointFrames: Object.freeze(frames) });
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
    queueAnimation(input: RapierBoundaryInput) {
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

      return Object.freeze({ schemaVersion: 1, kind: "sceneaxi.rapier-replay", catalog, options, steps: Object.freeze([...steps]), terminal: handle.serialize() });
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

export function replayWorld(value: RapierBoundaryInput): RapierWorldHandle {
  const save = snapshotPlainRecord(value);

  if (!save || save["schemaVersion"] !== 1 || save["kind"] !== "sceneaxi.rapier-replay" ||
    !isReplayTerminal(save["terminal"]) || save["terminal"].length > 2 * 1024 * 1024) throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);
  const steps = boundedArray(save["steps"], 100_000).map((item) => snapshotPlainRecord(item));

  if (steps.some((step) => !step || Object.keys(step).some((key) => key !== "animation"))) throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);
  const catalog = requireScenePhysicsCatalog(save["catalog"]);
  const ids = new Set(catalog.bodies.map((body) => body.bodyId));
  const animations = steps.map((step) => validatePoses(step?.["animation"], ids));
  const world = createWorld(catalog, save["options"]);

  try {
    for (const animation of animations) { world.queueAnimation(animation); world.step(catalog.world.stepMs / 1000); }

    if (world.serialize() !== save["terminal"]) throw new Error("Rapier replay mismatch.");

    return world;
  } catch (error) { world.dispose(); throw error; }
}

function isBoundaryNumber(value: RapierBoundaryInput): value is number {
  return typeof value === "number";
}

function isBoundaryString(value: RapierBoundaryInput): value is string {
  return typeof value === "string";
}

function isBoundaryObjectOrNull(value: RapierBoundaryInput): value is object | null {
  return isBoundaryObjectValue(value);
}

type RapierJointFrameBuilder = { -readonly [Key in keyof RapierJointFrame]: RapierJointFrame[Key] };

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
