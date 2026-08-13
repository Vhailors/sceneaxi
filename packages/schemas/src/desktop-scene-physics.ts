/**
 * Bounded physics authoring: bodies, shapes, materials, constraints, gravity,
 * and fixed-step evaluation. Preview and Play never write simulation state
 * back to the authoring catalog.
 */
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier } from "./sculpt.js";

export const SCENE_PHYSICS_SCHEMA_VERSION = 1 as const;
export const SCENE_PHYSICS_CATALOG_KIND = "sceneaxi.scene-physics-catalog" as const;
export const SCENE_PHYSICS_CATALOG_KEY = "scenePhysics" as const;

export const SCENE_PHYSICS_BODY_KINDS = Object.freeze(["static", "dynamic", "kinematic"] as const);
export const SCENE_PHYSICS_SHAPE_KINDS = Object.freeze(["box", "sphere", "capsule"] as const);
export const SCENE_PHYSICS_CONSTRAINT_KINDS = Object.freeze(["fixed", "hinge"] as const);

export const SCENE_PHYSICS_REFUSALS = Object.freeze({
  catalogInvalid: "PHYSICS_CATALOG_INVALID",
  bodyUnknown: "PHYSICS_BODY_UNKNOWN",
  targetMissing: "PHYSICS_TARGET_MISSING",
  shapeInvalid: "PHYSICS_SHAPE_INVALID",
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

export type ScenePhysicsShape = Readonly<{
  shapeId: string;
  bodyId: string;
  kind: (typeof SCENE_PHYSICS_SHAPE_KINDS)[number];
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

export type ScenePhysicsWorld = Readonly<{
  gravityY: number;
  stepMs: number;
  seed: number;
}>;

export type ScenePhysicsCatalog = Readonly<{
  schemaVersion: typeof SCENE_PHYSICS_SCHEMA_VERSION;
  kind: typeof SCENE_PHYSICS_CATALOG_KIND;
  world: ScenePhysicsWorld;
  bodies: readonly ScenePhysicsBody[];
  shapes: readonly ScenePhysicsShape[];
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
    world: Object.freeze({ gravityY: -9.81, stepMs: 16, seed: 1 }),
    bodies: Object.freeze([]),
    shapes: Object.freeze([]),
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
  return value as ScenePhysicsCatalog;
}

export type ScenePhysicsMutation =
  | Readonly<{ kind: "body-upsert"; bodyId: string; instanceId: string; bodyKind: string; mass: number }>
  | Readonly<{ kind: "shape-upsert"; shapeId: string; bodyId: string; shapeKind: string; size: number }>
  | Readonly<{ kind: "material-upsert"; bodyId: string; friction: number; restitution: number }>
  | Readonly<{ kind: "constraint-upsert"; constraintId: string; constraintKind: string; bodyA: string; bodyB: string }>
  | Readonly<{ kind: "world-set"; gravityY: number; stepMs: number; seed: number }>
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
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        world: Object.freeze({ gravityY: mutation.gravityY, stepMs: mutation.stepMs, seed: mutation.seed }),
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
    if (!SCENE_PHYSICS_SHAPE_KINDS.some((kind) => kind === mutation.shapeKind)) {
      return fail(SCENE_PHYSICS_REFUSALS.shapeInvalid, `Shape kind "${mutation.shapeKind}" is unsupported.`);
    }
    if (!Number.isFinite(mutation.size) || mutation.size <= 0) {
      return fail(SCENE_PHYSICS_REFUSALS.shapeInvalid, "A shape size must be a positive finite number.");
    }
    const shape: ScenePhysicsShape = Object.freeze({
      shapeId: mutation.shapeId,
      bodyId: mutation.bodyId,
      kind: mutation.shapeKind as ScenePhysicsShape["kind"],
      size: mutation.size,
    });
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        shapes: Object.freeze([
          ...input.catalog.shapes.filter((candidate) => candidate.shapeId !== shape.shapeId),
          shape,
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
      shapes: Object.freeze(input.catalog.shapes.filter((shape) => shape.bodyId !== mutation.bodyId)),
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
}>):
  | Readonly<{ ok: true; evaluation: ScenePhysicsEvaluation }>
  | Failure {
  if (!/^sha256:[0-9a-f]{64}$/.test(input.sourceContentHash)) {
    return fail(SCENE_PHYSICS_REFUSALS.staleVersion, "Evaluation requires the exact project content hash.");
  }
  if (!Number.isInteger(input.steps) || input.steps < 1 || input.steps > 64) {
    return fail(SCENE_PHYSICS_REFUSALS.stepUnstable, "Replay must request 1 to 64 inclusive fixed steps.");
  }
  const dt = input.catalog.world.stepMs / 1000;
  const snapshots: ScenePhysicsSnapshot[] = [];
  const state = input.catalog.bodies.map((body, index) => {
    const shape = input.catalog.shapes.find((candidate) => candidate.bodyId === body.bodyId);
    const grounded = body.kind === "static" || (shape !== undefined && shape.kind === "box" && shape.size >= 100);
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
  const frozen = Object.freeze(snapshots);
  return Object.freeze({
    ok: true as const,
    evaluation: Object.freeze({
      schemaVersion: 1,
      kind: "sceneaxi.scene-physics-evaluation",
      sourceContentHash: input.sourceContentHash,
      order: "animation-then-physics" as const,
      savedBytesWritten: false as const,
      snapshots: frozen,
      digest: digestSculptJson({
        sourceContentHash: input.sourceContentHash,
        world: input.catalog.world,
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
