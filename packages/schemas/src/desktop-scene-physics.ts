/**
 * Bounded physics authoring: bodies, colliders, materials, constraints, gravity,
 * and fixed-step evaluation. Preview and Play never write simulation state
 * back to the authoring catalog.
 */
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier } from "./sculpt.js";
import { snapshotPlainArray, snapshotPlainRecord } from "./record-validation.js";
import { PHYSICS_WORLD_HOST_REFUSALS, type PhysicsWorldHost } from "./physics-world-host.js";

export const SCENE_PHYSICS_SCHEMA_VERSION = 1 as const;

export const SCENE_PHYSICS_CATALOG_KIND = "sceneaxi.scene-physics-catalog" as const;

export const SCENE_PHYSICS_CATALOG_KEY = "scenePhysics" as const;

export const SCENE_PHYSICS_BODY_KINDS = Object.freeze(["static", "dynamic", "kinematic"] as const);

export const SCENE_PHYSICS_COLLIDER_KINDS = Object.freeze(["box", "sphere", "capsule"] as const);

/** Schema-v1 public name retained alongside collider terminology. */
export { SCENE_PHYSICS_COLLIDER_KINDS as "SCENE_PHYSICS_SHAPE_KINDS" };

export const SCENE_PHYSICS_CONSTRAINT_KINDS = Object.freeze(["fixed", "hinge"] as const);

export const SCENE_PHYSICS_REFUSALS = Object.freeze({
  catalogInvalid: "PHYSICS_CATALOG_INVALID",
  bodyUnknown: "PHYSICS_BODY_UNKNOWN",
  targetMissing: "PHYSICS_TARGET_MISSING",
  colliderInvalid: "PHYSICS_SHAPE_INVALID",
  "shapeInvalid": "PHYSICS_SHAPE_INVALID",
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

export type ScenePhysicsLegacyCollider = Readonly<{
  "shapeId": string;
  bodyId: string;
  kind: (typeof SCENE_PHYSICS_COLLIDER_KINDS)[number];
  size: number;
}>;

export type { ScenePhysicsLegacyCollider as "ScenePhysicsShape" };

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

export type ScenePhysicsColliderCatalog = Readonly<{
  schemaVersion: typeof SCENE_PHYSICS_SCHEMA_VERSION;
  kind: typeof SCENE_PHYSICS_CATALOG_KIND;
  world: ScenePhysicsWorld;
  bodies: readonly ScenePhysicsBody[];
  colliders: readonly ScenePhysicsCollider[];
  "shapes"?: readonly ScenePhysicsLegacyCollider[];
  materials: readonly ScenePhysicsMaterial[];
  constraints: readonly ScenePhysicsConstraint[];
}>;

export type ScenePhysicsNormalizedCatalog = ScenePhysicsColliderCatalog & Readonly<{ "shapes": readonly ScenePhysicsLegacyCollider[] }>;

export type ScenePhysicsLegacyCatalog = Readonly<{
  schemaVersion: typeof SCENE_PHYSICS_SCHEMA_VERSION;
  kind: typeof SCENE_PHYSICS_CATALOG_KIND;
  world: Omit<ScenePhysicsWorld, "engine"> & Readonly<{ engine?: ScenePhysicsEngine }>;
  bodies: readonly ScenePhysicsBody[];
  "shapes": readonly ScenePhysicsLegacyCollider[];
  materials: readonly ScenePhysicsMaterial[];
  constraints: readonly ScenePhysicsConstraint[];
}>;

/** Both previously shipped schema-v1 public catalog representations. */
export type ScenePhysicsCatalog = ScenePhysicsLegacyCatalog & Readonly<{ colliders?: readonly ScenePhysicsCollider[] }>;

export type ScenePhysicsCatalogInput = ScenePhysicsColliderCatalog | ScenePhysicsLegacyCatalog;

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

export function emptyScenePhysicsCatalog(): ScenePhysicsNormalizedCatalog {
  return Object.freeze({
    schemaVersion: 1,
    kind: SCENE_PHYSICS_CATALOG_KIND,
    world: Object.freeze({ gravityY: -9.81, stepMs: 16, seed: 1, engine: "toy" }),
    bodies: Object.freeze([]),
    colliders: Object.freeze([]),
    "shapes": Object.freeze([]),
    materials: Object.freeze([]),
    constraints: Object.freeze([]),
  });
}

/** Snapshot descriptors before inspecting any untrusted field. Never mutate saved v1 bytes. */
type ScenePhysicsRawInput = Parameters<typeof snapshotPlainRecord>[0];

export function requireScenePhysicsCatalog(value: ScenePhysicsRawInput): ScenePhysicsNormalizedCatalog {
  const invalid = () => { throw new Error(SCENE_PHYSICS_REFUSALS.catalogInvalid); };

  const record = snapshotPlainRecord(value);

  if (!record || record["schemaVersion"] !== 1 || record["kind"] !== SCENE_PHYSICS_CATALOG_KIND) return invalid();
  const world = snapshotPlainRecord(record["world"]);

  if (!world || !isMutationNumber(world["gravityY"]) || !Number.isFinite(Math.fround(world["gravityY"])) ||
    !isMutationNumber(world["seed"]) || !Number.isSafeInteger(world["seed"])) return invalid();

  if (!isMutationNumber(world["stepMs"]) || !Number.isFinite(world["stepMs"]) || world["stepMs"] < 1 || world["stepMs"] > 32) {
    throw new Error(SCENE_PHYSICS_REFUSALS.stepUnstable);
  }

  const engine = world["engine"] === undefined ? "toy" : world["engine"];

  if (engine !== "toy" && engine !== "rapier") throw new Error(PHYSICS_WORLD_HOST_REFUSALS.kindUnknown);

  function records(key: string, maximum: number) {
    const value = record?.[key];
    // Check descriptor length before allocating a bounded snapshot.
    let length: ScenePhysicsRawInput;

    try { length = isPhysicsObject(value) ? Object.getOwnPropertyDescriptor(value, "length")?.value : undefined; }
    catch { return invalid(); }

    if (!isMutationNumber(length) || !Number.isSafeInteger(length) || length < 0 || length > maximum) return invalid();
    const array = snapshotPlainArray(value);

    if (!array) return invalid();

    return array.map((item) => snapshotPlainRecord(item) ?? invalid());
  }

  const bodies: ScenePhysicsBody[] = records("bodies", 4096).map((body) => {
    const bodyId = body["bodyId"], instanceId = body["instanceId"], kind = body["kind"], mass = body["mass"];

    if (!isSculptIdentifier(bodyId) || !isSculptIdentifier(instanceId) ||
      (kind !== "static" && kind !== "dynamic" && kind !== "kinematic") ||
      !isMutationNumber(mass) || !Number.isFinite(Math.fround(mass)) || Math.fround(mass) <= 0) return invalid();

    return Object.freeze({ bodyId, instanceId, kind, mass });
  });

  const ids = new Set(bodies.map((body) => body.bodyId));

  if (ids.size !== bodies.length) return invalid();
  const hasColliders = Object.hasOwn(record, "colliders"), hasLegacyColliders = Object.hasOwn(record, "shapes");

  if (!hasColliders && !hasLegacyColliders) return invalid();

  function colliders(key: "colliders" | "shapes"): readonly ScenePhysicsCollider[] {
    const output = records(key, 8192).map((item) => {
      const colliderId = item[key === "shapes" ? "shapeId" : "colliderId"], bodyId = item["bodyId"], kind = item["kind"], size = item["size"];

      if (!isSculptIdentifier(colliderId) || !isSculptIdentifier(bodyId)) return invalid();

      if (!ids.has(bodyId)) throw new Error(SCENE_PHYSICS_REFUSALS.bodyUnknown);

      if ((kind !== "box" && kind !== "sphere" && kind !== "capsule") || !isMutationNumber(size) ||
        !Number.isFinite(Math.fround(size)) || Math.fround(size / 2) <= 0) throw new Error(SCENE_PHYSICS_REFUSALS.colliderInvalid);

      return Object.freeze({ colliderId, bodyId, kind, size });
    });

    if (new Set(output.map((item) => item.colliderId)).size !== output.length) return invalid();

    return Object.freeze(output);
  }

  let normalized = hasColliders ? colliders("colliders") : colliders("shapes");

  if (hasColliders && hasLegacyColliders) {
    const alias = colliders("shapes");

    // An empty alternate representation is the placeholder from the public empty
    // catalog. Admit either legacy or collider-only spread construction losslessly.
    if (normalized.length === 0) normalized = alias;

    if (alias.length > 0 && normalized.length > 0) {
    const byId = new Map(normalized.map((item) => [item.colliderId, item]));

    if (alias.length !== normalized.length || alias.some((item) => {
      const collider = byId.get(item.colliderId);

      return !collider || collider.bodyId !== item.bodyId || collider.kind !== item.kind || collider.size !== item.size;
    })) return invalid();
    }
  }

  const materials: ScenePhysicsMaterial[] = records("materials", 4096).map((item) => {
    const bodyId = item["bodyId"], friction = item["friction"], restitution = item["restitution"];

    if (!isSculptIdentifier(bodyId)) return invalid();

    if (!ids.has(bodyId)) throw new Error(SCENE_PHYSICS_REFUSALS.bodyUnknown);

    if (!isMutationNumber(friction) || !Number.isFinite(Math.fround(friction)) || friction < 0 ||
      !isMutationNumber(restitution) || !Number.isFinite(restitution) || restitution < 0 || restitution > 1) return invalid();

    return Object.freeze({ bodyId, friction, restitution });
  });

  if (new Set(materials.map((item) => item.bodyId)).size !== materials.length) return invalid();

  const constraints: ScenePhysicsConstraint[] = records("constraints", 4096).map((item) => {
    const constraintId = item["constraintId"], bodyA = item["bodyA"], bodyB = item["bodyB"], kind = item["kind"];

    if (!isSculptIdentifier(constraintId) || !isSculptIdentifier(bodyA) || !isSculptIdentifier(bodyB)) return invalid();

    if (!ids.has(bodyA) || !ids.has(bodyB)) throw new Error(SCENE_PHYSICS_REFUSALS.bodyUnknown);

    if ((kind !== "fixed" && kind !== "hinge") || bodyA === bodyB) throw new Error(SCENE_PHYSICS_REFUSALS.constraintUnsupported);

    return Object.freeze({ constraintId, bodyA, bodyB, kind });
  });

  if (new Set(constraints.map((item) => item.constraintId)).size !== constraints.length) return invalid();

  return Object.freeze({
    schemaVersion: 1, kind: SCENE_PHYSICS_CATALOG_KIND,
    world: Object.freeze({ gravityY: world["gravityY"], stepMs: world["stepMs"], seed: world["seed"], engine }),
    bodies: Object.freeze(bodies), colliders: normalized,
    "shapes": Object.freeze(normalized.map(({ colliderId, ...item }) => Object.freeze({ "shapeId": colliderId, ...item }))),
    materials: Object.freeze(materials), constraints: Object.freeze(constraints),
  });
}

export function parseScenePhysicsCatalog(value: ScenePhysicsRawInput): ScenePhysicsNormalizedCatalog | null {
  if (value === undefined || value === null) return emptyScenePhysicsCatalog();

  try { return requireScenePhysicsCatalog(value); } catch { return null; }
}

export type ScenePhysicsMutation =
  | Readonly<{ kind: "body-upsert"; bodyId: string; instanceId: string; bodyKind: string; mass: number }>
  | Readonly<{ kind: "shape-upsert"; colliderId: string; bodyId: string; colliderKind: string; size: number }>
  | Readonly<{ kind: "shape-upsert"; "shapeId": string; bodyId: string; "shapeKind": string; size: number }>
  | Readonly<{ kind: "material-upsert"; bodyId: string; friction: number; restitution: number }>
  | Readonly<{ kind: "constraint-upsert"; constraintId: string; constraintKind: string; bodyA: string; bodyB: string }>
  | Readonly<{ kind: "world-set"; gravityY: number; stepMs: number; seed: number; engine?: string }>
  | Readonly<{ kind: "body-remove"; bodyId: string }>;

/** Every successful authoring mutation must obey the same save/reload validator. */
function physicsMutationResult(candidate: ScenePhysicsRawInput): Readonly<{ ok: true; catalog: ScenePhysicsNormalizedCatalog }> | Failure {
  try {
    return Object.freeze({ ok: true as const, catalog: requireScenePhysicsCatalog(candidate) });
  } catch (error) {
    const reason = Object.values(SCENE_PHYSICS_REFUSALS).find((known) => error instanceof Error && error.message === known) ?? SCENE_PHYSICS_REFUSALS.inputUnsupported;

    return fail(reason, "Physics mutation cannot be saved as a valid schema-v1 catalog.");
  }
}

type ScenePhysicsMutationBuilder = { -readonly [Key in keyof Extract<ScenePhysicsMutation, { kind: "world-set" }>]: Extract<ScenePhysicsMutation, { kind: "world-set" }>[Key] };

function isPhysicsObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function isMutationString(value: unknown): value is string {
  return typeof value === "string";
}

function isMutationNumber(value: ScenePhysicsRawInput): value is number {
  return typeof value === "number";
}

/** Snapshot and check every consumed field; domain diagnostics remain in apply. */
export function parseScenePhysicsMutation(value: ScenePhysicsRawInput): ScenePhysicsMutation | null {
  const record = snapshotPlainRecord(value);

  if (record === undefined) return null;

  if (record["kind"] === "body-upsert") {
    const bodyId = record["bodyId"];
    const instanceId = record["instanceId"];
    const bodyKind = record["bodyKind"];
    const mass = record["mass"];

    if (!isMutationString(bodyId)) return null;

    if (!isMutationString(instanceId)) return null;

    if (!isMutationString(bodyKind)) return null;

    if (!isMutationNumber(mass)) return null;

    return Object.freeze({ kind: "body-upsert", bodyId, instanceId, bodyKind, mass });
  }

  if (record["kind"] === "shape-upsert") {
    // Match the existing apply guard's alias precedence, using snapshot fields only.
    const modernId = Object.hasOwn(record, "colliderId");
    const modernKind = Object.hasOwn(record, "colliderKind");
    const colliderId = modernId ? record["colliderId"] : record["shapeId"];
    const bodyId = record["bodyId"];
    const colliderKind = modernKind ? record["colliderKind"] : record["shapeKind"];
    const size = record["size"];

    if (!isMutationString(colliderId)) return null;

    if (!isMutationString(bodyId)) return null;

    if (!isMutationString(colliderKind)) return null;

    if (!isMutationNumber(size)) return null;

    return modernId || modernKind
      ? Object.freeze({ kind: "shape-upsert", colliderId, bodyId, colliderKind, size })
      : Object.freeze({ kind: "shape-upsert", "shapeId": colliderId, bodyId, "shapeKind": colliderKind, size });
  }

  if (record["kind"] === "material-upsert") {
    const bodyId = record["bodyId"];
    const friction = record["friction"];
    const restitution = record["restitution"];

    if (!isMutationString(bodyId)) return null;

    if (!isMutationNumber(friction)) return null;

    if (!isMutationNumber(restitution)) return null;

    return Object.freeze({ kind: "material-upsert", bodyId, friction, restitution });
  }

  if (record["kind"] === "constraint-upsert") {
    const constraintId = record["constraintId"];
    const constraintKind = record["constraintKind"];
    const bodyA = record["bodyA"];
    const bodyB = record["bodyB"];

    if (!isMutationString(constraintId)) return null;

    if (!isMutationString(constraintKind)) return null;

    if (!isMutationString(bodyA)) return null;

    if (!isMutationString(bodyB)) return null;

    return Object.freeze({ kind: "constraint-upsert", constraintId, constraintKind, bodyA, bodyB });
  }

  if (record["kind"] === "world-set") {
    const gravityY = record["gravityY"];
    const stepMs = record["stepMs"];
    const seed = record["seed"];
    const engine = record["engine"];

    if (!isMutationNumber(gravityY)) return null;

    if (!isMutationNumber(stepMs)) return null;

    if (!isMutationNumber(seed)) return null;

    if (engine !== undefined && !isMutationString(engine)) return null;
    const mutation: ScenePhysicsMutationBuilder = { kind: "world-set", gravityY, stepMs, seed };

    if (engine !== undefined) mutation.engine = engine;

    return Object.freeze(mutation);
  }

  if (record["kind"] === "body-remove") {
    const bodyId = record["bodyId"];

    if (!isMutationString(bodyId)) return null;

    return Object.freeze({ kind: "body-remove", bodyId });
  }

  return null;
}

export function applyScenePhysicsMutation(input: Readonly<{
  catalog: unknown;
  mutation: ScenePhysicsMutation;
  instanceIds: readonly string[];
}>):
  | Readonly<{ ok: true; catalog: ScenePhysicsNormalizedCatalog }>
  | Failure {
  const catalog = parseScenePhysicsCatalog(input.catalog);

  if (!catalog) return fail(SCENE_PHYSICS_REFUSALS.catalogInvalid, "Invalid physics catalog.");
  const mutation = parseScenePhysicsMutation(input.mutation);

  if (mutation === null) {
    return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, "The mutation fields do not match a supported variant.");
  }

  if (mutation.kind === "world-set") {
    if (!Number.isFinite(mutation.gravityY) || !Number.isFinite(mutation.stepMs) || !Number.isFinite(mutation.seed)) {
      return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, "World settings must be finite.");
    }

    if (mutation.stepMs < 1 || mutation.stepMs > 32) {
      return fail(SCENE_PHYSICS_REFUSALS.stepUnstable, "Fixed step must be between 1ms and 32ms inclusive.");
    }

    const engine = mutation.engine ?? catalog.world.engine ?? "toy";

    if (!SCENE_PHYSICS_ENGINES.some((known) => known === engine)) {
      return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, `Physics engine "${engine}" is unsupported.`);
    }

    // SAFETY: engine was matched against every admitted SCENE_PHYSICS_ENGINES value above.
    return physicsMutationResult(Object.freeze({
        ...catalog,
        world: Object.freeze({
          gravityY: mutation.gravityY,
          stepMs: mutation.stepMs,
          seed: mutation.seed,
          engine: engine as ScenePhysicsEngine,
        }),
      }));
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

    // SAFETY: bodyKind was matched against SCENE_PHYSICS_BODY_KINDS above.
    const body: ScenePhysicsBody = Object.freeze({
      bodyId: mutation.bodyId,
      instanceId: mutation.instanceId,
      kind: mutation.bodyKind as ScenePhysicsBody["kind"],
      mass: mutation.mass,
    });

    return physicsMutationResult(Object.freeze({
        ...catalog,
        bodies: Object.freeze([
          ...catalog.bodies.filter((candidate) => candidate.bodyId !== body.bodyId),
          body,
        ]),
      }));
  }

  if (mutation.kind === "shape-upsert") {
    if (!catalog.bodies.some((body) => body.bodyId === mutation.bodyId)) {
      return fail(SCENE_PHYSICS_REFUSALS.bodyUnknown, `Shape body "${mutation.bodyId}" is not authored.`);
    }

    const colliderId = "colliderId" in mutation ? mutation.colliderId : mutation.shapeId;
    const colliderKind = "colliderKind" in mutation ? mutation.colliderKind : mutation.shapeKind;

    if (!isSculptIdentifier(colliderId)) return fail(SCENE_PHYSICS_REFUSALS.colliderInvalid, "A shape requires a lowercase id.");

    if (!SCENE_PHYSICS_COLLIDER_KINDS.some((kind) => kind === colliderKind)) {
      return fail(SCENE_PHYSICS_REFUSALS.colliderInvalid, `Shape kind "${colliderKind}" is unsupported.`);
    }

    if (!Number.isFinite(mutation.size) || mutation.size <= 0) {
      return fail(SCENE_PHYSICS_REFUSALS.colliderInvalid, "A shape size must be a positive finite number.");
    }

    // SAFETY: colliderKind was matched against SCENE_PHYSICS_COLLIDER_KINDS above.
    const collider: ScenePhysicsCollider = Object.freeze({
      colliderId,
      bodyId: mutation.bodyId,
      kind: colliderKind as ScenePhysicsCollider["kind"],
      size: mutation.size,
    });

    const candidate: ScenePhysicsColliderCatalog = {
      ...catalog,
      colliders: Object.freeze([
        ...catalog.colliders.filter((item) => item.colliderId !== collider.colliderId),
        collider,
      ]),
    };

    let result = candidate;

    if (catalog.shapes) result = {
      ...candidate,
      "shapes": Object.freeze([
        ...catalog.shapes.filter((item) => item.shapeId !== collider.colliderId),
        Object.freeze({ "shapeId": collider.colliderId, bodyId: collider.bodyId, kind: collider.kind, size: collider.size }),
      ]),
    };

    return physicsMutationResult(Object.freeze(result));
  }

  if (mutation.kind === "material-upsert") {
    if (!catalog.bodies.some((body) => body.bodyId === mutation.bodyId)) {
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

    return physicsMutationResult(Object.freeze({
        ...catalog,
        materials: Object.freeze([
          ...catalog.materials.filter((candidate) => candidate.bodyId !== material.bodyId),
          material,
        ]),
      }));
  }

  if (mutation.kind === "constraint-upsert") {
    if (!SCENE_PHYSICS_CONSTRAINT_KINDS.some((kind) => kind === mutation.constraintKind)) {
      return fail(
        SCENE_PHYSICS_REFUSALS.constraintUnsupported,
        `Constraint kind "${mutation.constraintKind}" is unsupported; admitted values are fixed and hinge.`,
      );
    }

    if (!catalog.bodies.some((body) => body.bodyId === mutation.bodyA) ||
      !catalog.bodies.some((body) => body.bodyId === mutation.bodyB)) {
      return fail(SCENE_PHYSICS_REFUSALS.bodyUnknown, "Both constraint bodies must already exist.");
    }

    // SAFETY: constraintKind was matched against SCENE_PHYSICS_CONSTRAINT_KINDS above.
    const constraint: ScenePhysicsConstraint = Object.freeze({
      constraintId: mutation.constraintId,
      kind: mutation.constraintKind as ScenePhysicsConstraint["kind"],
      bodyA: mutation.bodyA,
      bodyB: mutation.bodyB,
    });

    return physicsMutationResult(Object.freeze({
        ...catalog,
        constraints: Object.freeze([
          ...catalog.constraints.filter((candidate) => candidate.constraintId !== constraint.constraintId),
          constraint,
        ]),
      }));
  }

  if (!catalog.bodies.some((body) => body.bodyId === mutation.bodyId)) {
    return fail(SCENE_PHYSICS_REFUSALS.bodyUnknown, `Body "${mutation.bodyId}" is not authored.`);
  }

  const candidate: ScenePhysicsColliderCatalog = {
      ...catalog,
      bodies: Object.freeze(catalog.bodies.filter((body) => body.bodyId !== mutation.bodyId)),
      colliders: Object.freeze(catalog.colliders.filter((collider) => collider.bodyId !== mutation.bodyId)),
      materials: Object.freeze(catalog.materials.filter((material) => material.bodyId !== mutation.bodyId)),
      constraints: Object.freeze(
        catalog.constraints.filter((constraint) =>
          constraint.bodyA !== mutation.bodyId && constraint.bodyB !== mutation.bodyId
        ),
      ),
    };

  let result = candidate;

  if (catalog.shapes) result = { ...candidate, "shapes": Object.freeze(catalog.shapes.filter((collider) => collider.bodyId !== mutation.bodyId)) };

  return physicsMutationResult(Object.freeze(result));
}

export function evaluateScenePhysics(input: Readonly<{
  catalog: unknown;
  sourceContentHash: string;
  steps: number;
  animationOffsetY?: number;
  host?: PhysicsWorldHost;
}>):
  | Readonly<{ ok: true; evaluation: ScenePhysicsEvaluation }>
  | Failure
  | Readonly<{ ok: false; reason: (typeof PHYSICS_WORLD_HOST_REFUSALS)[keyof typeof PHYSICS_WORLD_HOST_REFUSALS]; message: string }> {
  const catalog = parseScenePhysicsCatalog(input.catalog);

  if (!catalog) return fail(SCENE_PHYSICS_REFUSALS.catalogInvalid, "Invalid physics catalog.");

  if (!Number.isFinite(input.animationOffsetY ?? 0) || Math.abs(input.animationOffsetY ?? 0) > 1_000_000) {
    return fail(SCENE_PHYSICS_REFUSALS.inputUnsupported, "Animation offset must be bounded and finite.");
  }

  if (!/^sha256:[0-9a-f]{64}$/.test(input.sourceContentHash)) {
    return fail(SCENE_PHYSICS_REFUSALS.staleVersion, "Evaluation requires the exact project content hash.");
  }

  if (!Number.isInteger(input.steps) || input.steps < 1 || input.steps > 64) {
    return fail(SCENE_PHYSICS_REFUSALS.stepUnstable, "Replay must request 1 to 64 inclusive fixed steps.");
  }

  if (catalog.world.engine === "rapier") {
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
      const world = input.host.create(catalog);

      try {
        const snapshots: ScenePhysicsSnapshot[] = [];

        for (let step = 1; step <= input.steps; step += 1) {
          world.step(catalog.world.stepMs / 1000);
          snapshots.push(Object.freeze({ step, timeMs: step * catalog.world.stepMs, bodies: world.snapshot() }));
        }

        return physicsEvaluation(catalog, input.sourceContentHash, snapshots);
      } finally {
        world.dispose();
      }
    } catch (error) {
      const reason = [...Object.values(SCENE_PHYSICS_REFUSALS), ...Object.values(PHYSICS_WORLD_HOST_REFUSALS)]
        .find((candidate) => error instanceof Error && candidate === error.message) ?? SCENE_PHYSICS_REFUSALS.catalogInvalid;

      return Object.freeze({ ok: false, reason, message: `Rapier evaluation refused: ${reason}.` });
    }
  }

  if (catalog.world.engine !== "toy") {
    return Object.freeze({ ok: false, reason: PHYSICS_WORLD_HOST_REFUSALS.kindUnknown, message: "The catalog physics engine is unknown." });
  }

  const dt = catalog.world.stepMs / 1000;
  const snapshots: ScenePhysicsSnapshot[] = [];

  const state = catalog.bodies.map((body, index) => {
    const collider = catalog.colliders.find((candidate) => candidate.bodyId === body.bodyId);
    const grounded = body.kind === "static" || (collider !== undefined && collider.kind === "box" && collider.size >= 100);

    return {
      bodyId: body.bodyId,
      y: (input.animationOffsetY ?? 0) + (index + 1) + (catalog.world.seed % 3) * 0.01,
      vy: 0,
      dynamic: body.kind === "dynamic" && !grounded,
    };
  });

  for (let step = 1; step <= input.steps; step += 1) {
    for (const body of state) {
      if (!body.dynamic) continue;
      body.vy += catalog.world.gravityY * dt;
      body.y += body.vy * dt;

      if (body.y < 0) {
        const material = catalog.materials.find((candidate) => candidate.bodyId === body.bodyId);
        body.y = 0;
        body.vy = -body.vy * (material?.restitution ?? 0);
      }
    }

    snapshots.push(Object.freeze({
      step,
      timeMs: step * catalog.world.stepMs,
      bodies: Object.freeze(state.map((body) => Object.freeze({
        bodyId: body.bodyId,
        y: body.y,
        vy: body.vy,
      }))),
    }));
  }

  return physicsEvaluation(catalog, input.sourceContentHash, snapshots);
}

function physicsEvaluation(catalog: ScenePhysicsNormalizedCatalog, sourceContentHash: string, snapshots: ScenePhysicsSnapshot[]) {
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
