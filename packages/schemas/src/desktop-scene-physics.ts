/**
 * Bounded physics authoring: bodies, colliders, materials, constraints, gravity,
 * and fixed-step evaluation. Preview and Play never write simulation state
 * back to the authoring catalog.
 */
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier } from "./sculpt.js";
import { PHYSICS_WORLD_HOST_REFUSALS, type PhysicsWorldHost } from "./physics-world-host.js";

export const SCENE_PHYSICS_SCHEMA_VERSION = 1 as const;
export const SCENE_PHYSICS_CATALOG_KIND = "sceneaxi.scene-physics-catalog" as const;
export const SCENE_PHYSICS_CATALOG_KEY = "scenePhysics" as const;

export const SCENE_PHYSICS_BODY_KINDS = Object.freeze(["static", "dynamic", "kinematic"] as const);
export const SCENE_PHYSICS_COLLIDER_KINDS = Object.freeze(["box", "sphere", "capsule"] as const);
export const SCENE_PHYSICS_CONSTRAINT_KINDS = Object.freeze(["fixed", "hinge"] as const);

export const SCENE_PHYSICS_REFUSALS = Object.freeze({
  catalogInvalid: "PHYSICS_CATALOG_INVALID",
  bodyUnknown: "PHYSICS_BODY_UNKNOWN",
  targetMissing: "PHYSICS_TARGET_MISSING",
  colliderInvalid: "PHYSICS_SHAPE_INVALID",
  constraintUnsupported: "PHYSICS_CONSTRAINT_UNSUPPORTED",
  stepUnstable: "PHYSICS_STEP_UNSTABLE",
  assetMissing: "PHYSICS_ASSET_MISSING",
  inputUnsupported: "PHYSICS_INPUT_UNSUPPORTED",
  staleVersion: "PHYSICS_STALE_VERSION",
  kidsDenied: "PHYSICS_KIDS_DENIED",
  capabilityMissing: "PHYSICS_CAPABILITY_MISSING",
} as const);

export type ScenePhysicsRefusal =
  (typeof SCENE_PHYSICS_REFUSALS)[keyof typeof SCENE_PHYSICS_REFUSALS];

export type ScenePhysicsBody = Readonly<{
  bodyId: string;
  instanceId: string;
  kind: (typeof SCENE_PHYSICS_BODY_KINDS)[number];
  mass: number;
}>;

export type ScenePhysicsCollider = Readonly<{
  colliderId: string;
  bodyId: string;
  kind: (typeof SCENE_PHYSICS_COLLIDER_KINDS)[number];
  size: number;
}>;

export type ScenePhysicsMaterial = Readonly<{
  bodyId: string;
  friction: number;
  restitution: number;
}>;

export type ScenePhysicsConstraint = Readonly<{
  constraintId: string;
  kind: (typeof SCENE_PHYSICS_CONSTRAINT_KINDS)[number];
  bodyA: string;
  bodyB: string;
}>;

export const SCENE_PHYSICS_ENGINES = Object.freeze(["toy", "rapier"] as const);
export type ScenePhysicsEngine = (typeof SCENE_PHYSICS_ENGINES)[number];

export type ScenePhysicsWorld = Readonly<{
  gravityY: number;
  stepMs: number;
  seed: number;
  engine: ScenePhysicsEngine;
}>;

export type ScenePhysicsCatalog = Readonly<{
  schemaVersion: typeof SCENE_PHYSICS_SCHEMA_VERSION;
  kind: typeof SCENE_PHYSICS_CATALOG_KIND;
  world: ScenePhysicsWorld;
  bodies: readonly ScenePhysicsBody[];
  colliders: readonly ScenePhysicsCollider[];
  materials: readonly ScenePhysicsMaterial[];
  constraints: readonly ScenePhysicsConstraint[];
}>;

export type ScenePhysicsSnapshot = Readonly<{
  step: number;
  timeMs: number;
  bodies: readonly Readonly<{ bodyId: string; y: number; vy: number }>[];
}>;

export type ScenePhysicsEvaluation = Readonly<{
  schemaVersion: typeof SCENE_PHYSICS_SCHEMA_VERSION;
  kind: "sceneaxi.scene-physics-evaluation";
  sourceContentHash: string;
  order: "animation-then-physics";
  savedBytesWritten: false;
  snapshots: readonly ScenePhysicsSnapshot[];
  digest: string;
}>;

type Failure = Readonly<{ ok: false; reason: ScenePhysicsRefusal; message: string }>;
const fail = (reason: ScenePhysicsRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message });

export function emptyScenePhysicsCatalog(): ScenePhysicsCatalog {
  return Object.freeze({
    schemaVersion: 1,
    kind: SCENE_PHYSICS_CATALOG_KIND,
    world: Object.freeze({ gravityY: -9.81, stepMs: 16, seed: 1, engine: "toy" }),
    bodies: Object.freeze([]),
    colliders: Object.freeze([]),
    materials: Object.freeze([]),
    constraints: Object.freeze([]),
  });
}

export function parseScenePhysicsCatalog(value: unknown): ScenePhysicsCatalog | null {
  if (value === undefined || value === null) return emptyScenePhysicsCatalog();
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record["schemaVersion"] !== 1 ||
    record["kind"] !== SCENE_PHYSICS_CATALOG_KIND ||
    typeof record["world"] !== "object" ||
    !Array.isArray(record["bodies"])
  ) {
    return null;
  }
  const catalog = value as ScenePhysicsCatalog;
  if (catalog.world.engine === undefined) {
    return Object.freeze({
      ...catalog,
      world: Object.freeze({ ...catalog.world, engine: "toy" as const }),
    });
  }
  return catalog;
}

export type ScenePhysicsMutation =
  | Readonly<{ kind: "body-upsert"; bodyId: string; instanceId: string; bodyKind: string; mass: number }>
  | Readonly<{ kind: "shape-upsert"; colliderId: string; bodyId: string; colliderKind: string; size: number }>
  | Readonly<{ kind: "material-upsert"; bodyId: string; friction: number; restitution: number }>
  | Readonly<{ kind: "constraint-upsert"; constraintId: string; constraintKind: string; bodyA: string; bodyB: string }>
  | Readonly<{ kind: "world-set"; gravityY: number; stepMs: number; seed: number; engine?: string }>
  | Readonly<{ kind: "body-remove"; bodyId: string }>;

export function applyScenePhysicsMutation(input: Readonly<{
  catalog: ScenePhysicsCatalog;
  mutation: ScenePhysicsMutation;
  instanceIds: readonly string[];
}>):
  | Readonly<{ ok: true; catalog: ScenePhysicsCatalog }>
  | Failure {
  const mutation = input.mutation;
  if (mutation.kind === "world-set") {
    if (!Number.isFinite(mutation.gravityY) || !Number.isFinite(mutation.stepMs) || !Number.isFinite(mutation.seed)) {
      return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, "World settings must be finite.");
    }
    if (mutation.stepMs < 1 || mutation.stepMs > 32) {
      return fail(SCENE_PHYSICS_REFUSALS.stepUnstable, "Fixed step must be between 1ms and 32ms inclusive.");
    }
    const engine = mutation.engine ?? input.catalog.world.engine ?? "toy";
    if (!SCENE_PHYSICS_ENGINES.some((known) => known === engine)) {
      return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, `Physics engine "${engine}" is unsupported.`);
    }
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        world: Object.freeze({
          gravityY: mutation.gravityY,
          stepMs: mutation.stepMs,
          seed: mutation.seed,
          engine: engine as ScenePhysicsEngine,
        }),
      }),
    });
  }
  if (mutation.kind === "body-upsert") {
    if (!isSculptIdentifier(mutation.bodyId) || !isSculptIdentifier(mutation.instanceId)) {
      return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, "A body requires lowercase ids.");
    }
    if (!input.instanceIds.includes(mutation.instanceId)) {
      return fail(SCENE_PHYSICS_REFUSALS.targetMissing, `Body target "${mutation.instanceId}" is absent from the hierarchy.`);
    }
    if (!SCENE_PHYSICS_BODY_KINDS.some((kind) => kind === mutation.bodyKind)) {
      return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, `Body kind "${mutation.bodyKind}" is unsupported.`);
    }
    if (!Number.isFinite(mutation.mass) || mutation.mass <= 0) {
      return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, "Dynamic and kinematic bodies require a positive mass.");
    }
    const body: ScenePhysicsBody = Object.freeze({
      bodyId: mutation.bodyId,
      instanceId: mutation.instanceId,
      kind: mutation.bodyKind as ScenePhysicsBody["kind"],
      mass: mutation.mass,
    });
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        bodies: Object.freeze([
          ...input.catalog.bodies.filter((candidate) => candidate.bodyId !== body.bodyId),
          body,
        ]),
      }),
    });
  }
  if (mutation.kind === "shape-upsert") {
    if (!input.catalog.bodies.some((body) => body.bodyId === mutation.bodyId)) {
      return fail(SCENE_PHYSICS_REFUSALS.bodyUnknown, `Shape body "${mutation.bodyId}" is not authored.`);
    }
    if (!SCENE_PHYSICS_COLLIDER_KINDS.some((kind) => kind === mutation.colliderKind)) {
      return fail(SCENE_PHYSICS_REFUSALS.colliderInvalid, `Shape kind "${mutation.colliderKind}" is unsupported.`);
    }
    if (!Number.isFinite(mutation.size) || mutation.size <= 0) {
      return fail(SCENE_PHYSICS_REFUSALS.colliderInvalid, "A shape size must be a positive finite number.");
    }
    const collider: ScenePhysicsCollider = Object.freeze({
      colliderId: mutation.colliderId,
      bodyId: mutation.bodyId,
      kind: mutation.colliderKind as ScenePhysicsCollider["kind"],
      size: mutation.size,
    });
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        colliders: Object.freeze([
          ...input.catalog.colliders.filter((candidate) => candidate.colliderId !== collider.colliderId),
          collider,
        ]),
      }),
    });
  }
  if (mutation.kind === "material-upsert") {
    if (!input.catalog.bodies.some((body) => body.bodyId === mutation.bodyId)) {
      return fail(SCENE_PHYSICS_REFUSALS.bodyUnknown, `Material body "${mutation.bodyId}" is not authored.`);
    }
    if (!Number.isFinite(mutation.friction) || mutation.friction < 0 ||
      !Number.isFinite(mutation.restitution) || mutation.restitution < 0 || mutation.restitution > 1) {
      return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, "Friction must be >= 0 and restitution must be in [0, 1].");
    }
    const material: ScenePhysicsMaterial = Object.freeze({
      bodyId: mutation.bodyId,
      friction: mutation.friction,
      restitution: mutation.restitution,
    });
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        materials: Object.freeze([
          ...input.catalog.materials.filter((candidate) => candidate.bodyId !== material.bodyId),
          material,
        ]),
      }),
    });
  }
  if (mutation.kind === "constraint-upsert") {
    if (!SCENE_PHYSICS_CONSTRAINT_KINDS.some((kind) => kind === mutation.constraintKind)) {
      return fail(
        SCENE_PHYSICS_REFUSALS.constraintUnsupported,
        `Constraint kind "${mutation.constraintKind}" is unsupported; admitted values are fixed and hinge.`,
      );
    }
    if (!input.catalog.bodies.some((body) => body.bodyId === mutation.bodyA) ||
      !input.catalog.bodies.some((body) => body.bodyId === mutation.bodyB)) {
      return fail(SCENE_PHYSICS_REFUSALS.bodyUnknown, "Both constraint bodies must already exist.");
    }
    const constraint: ScenePhysicsConstraint = Object.freeze({
      constraintId: mutation.constraintId,
      kind: mutation.constraintKind as ScenePhysicsConstraint["kind"],
      bodyA: mutation.bodyA,
      bodyB: mutation.bodyB,
    });
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        constraints: Object.freeze([
          ...input.catalog.constraints.filter((candidate) => candidate.constraintId !== constraint.constraintId),
          constraint,
        ]),
      }),
    });
  }
  if (!input.catalog.bodies.some((body) => body.bodyId === mutation.bodyId)) {
    return fail(SCENE_PHYSICS_REFUSALS.bodyUnknown, `Body "${mutation.bodyId}" is not authored.`);
  }
  return Object.freeze({
    ok: true as const,
    catalog: Object.freeze({
      ...input.catalog,
      bodies: Object.freeze(input.catalog.bodies.filter((body) => body.bodyId !== mutation.bodyId)),
      colliders: Object.freeze(input.catalog.colliders.filter((collider) => collider.bodyId !== mutation.bodyId)),
      materials: Object.freeze(input.catalog.materials.filter((material) => material.bodyId !== mutation.bodyId)),
      constraints: Object.freeze(
        input.catalog.constraints.filter((constraint) =>
          constraint.bodyA !== mutation.bodyId && constraint.bodyB !== mutation.bodyId
        ),
      ),
    }),
  });
}

export function evaluateScenePhysics(input: Readonly<{
  catalog: ScenePhysicsCatalog;
  sourceContentHash: string;
  steps: number;
  animationOffsetY?: number;
  host?: PhysicsWorldHost;
}>):
  | Readonly<{ ok: true; evaluation: ScenePhysicsEvaluation }>
  | Failure
  | Readonly<{ ok: false; reason: (typeof PHYSICS_WORLD_HOST_REFUSALS)[keyof typeof PHYSICS_WORLD_HOST_REFUSALS]; message: string }> {
  if (!/^sha256:[0-9a-f]{64}$/.test(input.sourceContentHash)) {
    return fail(SCENE_PHYSICS_REFUSALS.staleVersion, "Evaluation requires the exact project content hash.");
  }
  if (!Number.isInteger(input.steps) || input.steps < 1 || input.steps > 64) {
    return fail(SCENE_PHYSICS_REFUSALS.stepUnstable, "Replay must request 1 to 64 inclusive fixed steps.");
  }
  if (input.catalog.world.engine === "rapier") {
    if (input.host === undefined) {
      return Object.freeze({ ok: false, reason: PHYSICS_WORLD_HOST_REFUSALS.notReady, message: "Rapier initialization must complete before evaluation." });
    }
    if (input.host.kind !== "rapier") {
      return Object.freeze({ ok: false, reason: PHYSICS_WORLD_HOST_REFUSALS.kindUnknown, message: "The injected physics host does not match the catalog engine." });
    }
    if ((input.animationOffsetY ?? 0) !== 0) {
      return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, "Rapier v1 cannot receive animation poses through PhysicsWorldHost; nonzero offsets refuse.");
    }
    try {
      const world = input.host.create(input.catalog);
      try {
        const snapshots: ScenePhysicsSnapshot[] = [];
        for (let step = 1; step <= input.steps; step += 1) {
          world.step(input.catalog.world.stepMs / 1000);
          snapshots.push(Object.freeze({ step, timeMs: step * input.catalog.world.stepMs, bodies: world.snapshot() }));
        }
        return physicsEvaluation(input.catalog, input.sourceContentHash, snapshots);
      } finally {
        world.dispose();
      }
    } catch (error) {
      const reason = [...Object.values(SCENE_PHYSICS_REFUSALS), ...Object.values(PHYSICS_WORLD_HOST_REFUSALS)]
        .find((candidate) => error instanceof Error && candidate === error.message) ?? SCENE_PHYSICS_REFUSALS.catalogInvalid;
      return Object.freeze({ ok: false, reason, message: `Rapier evaluation refused: ${reason}.` });
    }
  }
  if (input.catalog.world.engine !== "toy") {
    return Object.freeze({ ok: false, reason: PHYSICS_WORLD_HOST_REFUSALS.kindUnknown, message: "The catalog physics engine is unknown." });
  }
  const dt = input.catalog.world.stepMs / 1000;
  const snapshots: ScenePhysicsSnapshot[] = [];
  const state = input.catalog.bodies.map((body, index) => {
    const collider = input.catalog.colliders.find((candidate) => candidate.bodyId === body.bodyId);
    const grounded = body.kind === "static" || (collider !== undefined && collider.kind === "box" && collider.size >= 100);
    return {
      bodyId: body.bodyId,
      y: (input.animationOffsetY ?? 0) + (index + 1) + (input.catalog.world.seed % 3) * 0.01,
      vy: 0,
      dynamic: body.kind === "dynamic" && !grounded,
    };
  });
  for (let step = 1; step <= input.steps; step += 1) {
    for (const body of state) {
      if (!body.dynamic) continue;
      body.vy += input.catalog.world.gravityY * dt;
      body.y += body.vy * dt;
      if (body.y < 0) {
        const material = input.catalog.materials.find((candidate) => candidate.bodyId === body.bodyId);
        body.y = 0;
        body.vy = -body.vy * (material?.restitution ?? 0);
      }
    }
    snapshots.push(Object.freeze({
      step,
      timeMs: step * input.catalog.world.stepMs,
      bodies: Object.freeze(state.map((body) => Object.freeze({
        bodyId: body.bodyId,
        y: body.y,
        vy: body.vy,
      }))),
    }));
  }
  return physicsEvaluation(input.catalog, input.sourceContentHash, snapshots);
}

function physicsEvaluation(catalog: ScenePhysicsCatalog, sourceContentHash: string, snapshots: ScenePhysicsSnapshot[]) {
  const frozen = Object.freeze(snapshots);
  return Object.freeze({
    ok: true as const,
    evaluation: Object.freeze({
      schemaVersion: SCENE_PHYSICS_SCHEMA_VERSION,
      kind: "sceneaxi.scene-physics-evaluation" as const,
      sourceContentHash,
      order: "animation-then-physics" as const,
      savedBytesWritten: false as const,
      snapshots: frozen,
      digest: digestSculptJson({
        sourceContentHash,
        world: catalog.world,
        snapshots: frozen,
        order: "animation-then-physics",
      }),
    }),
  });
}

export function inspectScenePhysics(catalog: ScenePhysicsCatalog) {
  return Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.scene-physics-inspection",
    catalog,
    savedBytesWritten: false as const,
  });
}
