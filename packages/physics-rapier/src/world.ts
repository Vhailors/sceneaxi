import { ColliderDesc, JointData, RigidBodyDesc, World, type RigidBody } from "@dimforge/rapier3d-compat";
import {
  PHYSICS_WORLD_HOST_REFUSALS,
  SCENE_PHYSICS_BODY_KINDS,
  SCENE_PHYSICS_CATALOG_KIND,
  SCENE_PHYSICS_CONSTRAINT_KINDS,
  SCENE_PHYSICS_REFUSALS,
  SCENE_PHYSICS_SHAPE_KINDS,
  isSculptIdentifier,
  type PhysicsWorldHandle,
  type ScenePhysicsCatalog,
  type ScenePhysicsShape,
} from "@sceneaxi/schemas";

const finiteFloat = (value: number) => Number.isFinite(value) && Number.isFinite(Math.fround(value));

const positiveFloat = (value: number) => finiteFloat(value) && Math.fround(value) > 0;

function uniqueIds(ids: readonly string[]) {
  return ids.every(isSculptIdentifier) && new Set(ids).size === ids.length;
}

function validateCatalog(catalog: ScenePhysicsCatalog) {
  const invalid = SCENE_PHYSICS_REFUSALS.catalogInvalid;

  if (catalog?.schemaVersion !== 1 || catalog.kind !== SCENE_PHYSICS_CATALOG_KIND ||
    !catalog.world || !Array.isArray(catalog.bodies) || !Array.isArray(catalog.shapes) ||
    !Array.isArray(catalog.materials) || !Array.isArray(catalog.constraints)) {
    throw new Error(invalid);
  }

  if (catalog.world.engine !== "rapier") throw new Error(PHYSICS_WORLD_HOST_REFUSALS.kindUnknown);

  if (!finiteFloat(catalog.world.gravityY) || !Number.isFinite(catalog.world.seed)) throw new Error(invalid);

  if (!Number.isFinite(catalog.world.stepMs) || catalog.world.stepMs < 1 || catalog.world.stepMs > 32) {
    throw new Error(SCENE_PHYSICS_REFUSALS.stepUnstable);
  }

  if (!uniqueIds(catalog.bodies.map((body) => body?.bodyId)) ||
    catalog.bodies.some((body) => !isSculptIdentifier(body.instanceId) ||
      !SCENE_PHYSICS_BODY_KINDS.includes(body.kind) || !positiveFloat(body.mass))) {
    throw new Error(invalid);
  }

  const ids = new Set(catalog.bodies.map((body) => body.bodyId));

  if (!uniqueIds(catalog.shapes.map((shape) => shape?.shapeId))) throw new Error(invalid);

  for (const shape of catalog.shapes) {
    if (!ids.has(shape.bodyId)) throw new Error(SCENE_PHYSICS_REFUSALS.bodyUnknown);

    if (!SCENE_PHYSICS_SHAPE_KINDS.includes(shape.kind) || !positiveFloat(shape.size) || !positiveFloat(shape.size / 2)) {
      throw new Error(SCENE_PHYSICS_REFUSALS.shapeInvalid);
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

function colliderDescriptor(shape: ScenePhysicsShape) {
  switch (shape.kind) {
    case "box": return ColliderDesc.cuboid(shape.size / 2, shape.size / 2, shape.size / 2);
    case "sphere": return ColliderDesc.ball(shape.size);
    case "capsule": return ColliderDesc.capsule(shape.size / 2, shape.size);
  }
}

function round(value: number) {
  if (!Number.isFinite(value)) throw new Error(SCENE_PHYSICS_REFUSALS.stepUnstable);

  return Math.round(value * 1e6) / 1e6 || 0;
}

export function createWorld(catalog: ScenePhysicsCatalog): PhysicsWorldHandle {
  validateCatalog(catalog);
  const dt = catalog.world.stepMs / 1000;
  const world = new World({ x: 0, y: catalog.world.gravityY, z: 0 });
  world.timestep = dt;
  const bodies = new Map<string, RigidBody>();

  try {
    for (const [index, body] of catalog.bodies.entries()) {
      const desc = body.kind === "dynamic" ? RigidBodyDesc.dynamic()
        : body.kind === "static" ? RigidBodyDesc.fixed() : RigidBodyDesc.kinematicPositionBased();

      desc.setTranslation(0, index + 1 + (catalog.world.seed % 3) * 0.01, 0);
      const shapes = catalog.shapes.filter((shape) => shape.bodyId === body.bodyId);

      if (!positiveFloat(body.mass / Math.max(1, shapes.length))) {
        throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid);
      }

      if (shapes.length === 0) desc.setAdditionalMass(body.mass);
      const rigidBody = world.createRigidBody(desc);
      bodies.set(body.bodyId, rigidBody);
      const material = catalog.materials.find((candidate) => candidate.bodyId === body.bodyId);

      for (const shape of shapes) {
        world.createCollider(colliderDescriptor(shape)
          .setMass(body.mass / shapes.length)
          .setFriction(material?.friction ?? 0.5)
          .setRestitution(material?.restitution ?? 0), rigidBody);
      }
    }

    for (const constraint of catalog.constraints) {
      const bodyA = bodies.get(constraint.bodyA);
      const bodyB = bodies.get(constraint.bodyB);

      if (bodyA === undefined || bodyB === undefined) throw new Error(SCENE_PHYSICS_REFUSALS.bodyUnknown);
      const anchorA = { x: 0, y: bodyB.translation().y - bodyA.translation().y, z: 0 };
      const anchorB = { x: 0, y: 0, z: 0 };
      const identity = { x: 0, y: 0, z: 0, w: 1 };

      const joint = constraint.kind === "fixed"
        ? JointData.fixed(anchorA, identity, anchorB, identity)
        : JointData.revolute(anchorA, anchorB, { x: 1, y: 0, z: 0 });

      world.createImpulseJoint(joint, bodyA, bodyB, true).setContactsEnabled(false);
    }
  } catch (error) {
    world.free();
    throw error;
  }

  let disposed = false;

  function assertReady() {
    if (disposed) throw new Error(PHYSICS_WORLD_HOST_REFUSALS.notReady);
  }

  return Object.freeze({
    step(dtSeconds: number) {
      assertReady();

      if (dtSeconds !== dt) throw new Error(SCENE_PHYSICS_REFUSALS.stepUnstable);
      world.step();
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
      world.free();
    },
  });
}
