/**
 * Scene composition public contracts (v1).
 *
 * A Scene Composition Intake places several already-validated Sculpt Artifacts
 * relative to one another; a ComposedScene is the resolved, digest-bound result.
 * Both payloads are backend-neutral: nothing here exposes a renderer type, and
 * placement never rewrites a Sculpt Artifact — see `projectSceneInstanceHierarchy`.
 */
import { isJsonObject, isJsonValue, type JsonObject, type JsonValue } from "./document.js";
import {
  digestSculptJson,
  exactContractFields,
  isDenseArray,
  sculptJsonEqual,
  snapshotSculptJson,
} from "./sculpt-json.js";
import {
  isSculptIdentifier,
  isSculptTransform,
  validateSculptArtifact,
  type SculptArtifact,
  type SculptHierarchyNode,
  type SculptTransform,
  type Vector3,
} from "./sculpt.js";

export const SCENE_COMPOSITION_SCHEMA_VERSION = 1 as const;

export const SCENE_COMPOSITION_INTAKE_KIND =
  "sceneaxi.scene-composition-intake" as const;

export const COMPOSED_SCENE_KIND = "sceneaxi.composed-scene" as const;

/**
 * Reserved key under a text-canonical `SceneDocument.data` that carries the
 * ComposedScene. The document contract itself is unchanged.
 */
export const COMPOSED_SCENE_DOCUMENT_DATA_KEY = "composedScene" as const;

/** Multi-object is the point: a one-instance scene is a sculpt, not a scene. */
export const SCENE_MINIMUM_INSTANCES = 2 as const;

export const SCENE_MAXIMUM_INSTANCES = 32 as const;

export const SCENE_MAXIMUM_DEPTH = 8 as const;

export const SCENE_MINIMUM_SCALE = 0.000001 as const;

export const SCENE_MAXIMUM_COMPONENT_MAGNITUDE = 9_007_199_254 as const;

type SceneSource =
  | { readonly kind?: never; readonly artifactId: string }
  | { readonly kind: "node"; readonly artifactId?: never };

export type ScenePlacement = SceneSource & {
  readonly name?: string;
  readonly instanceId: string;
  readonly parentInstanceId: string | null;
  readonly transform: SculptTransform;
};

export type SceneCompositionIntake = {
  readonly schemaVersion: typeof SCENE_COMPOSITION_SCHEMA_VERSION;
  readonly kind: typeof SCENE_COMPOSITION_INTAKE_KIND;
  readonly sceneId: string;
  readonly rootInstanceId: string;
  readonly placements: ReadonlyArray<ScenePlacement>;
};

/** Runtime projection: nodes carry a canonical, composition-owned empty artifact. */
export type ResolvedScenePlacement = {
  readonly name?: string;
  readonly instanceId: string;
  readonly parentInstanceId: string | null;
  readonly depth: number;
  readonly localTransform: SculptTransform;
  readonly worldTransform: SculptTransform;
} & (
    | { readonly kind?: never; readonly artifactId: string }
    | { readonly kind: "node"; readonly artifactId: string; readonly artifact: SculptArtifact }
  );

export type ComposedSceneInstance = ResolvedScenePlacement & {
  readonly artifact: SculptArtifact;
};

export type ComposedSceneArtifactDigest = {
  readonly instanceId: string;
  readonly artifactDigest: string;
};

export type ComposedSceneEvidence = {
  readonly intakeDigest: string;
  readonly placementDigest: string;
  readonly artifactDigests: ReadonlyArray<ComposedSceneArtifactDigest>;
  readonly sceneDigest: string;
};

export type ComposedScene = {
  readonly schemaVersion: typeof SCENE_COMPOSITION_SCHEMA_VERSION;
  readonly kind: typeof COMPOSED_SCENE_KIND;
  readonly sceneId: string;
  readonly rootInstanceId: string;
  readonly instances: ReadonlyArray<ComposedSceneInstance>;
  readonly evidence: ComposedSceneEvidence;
};

/**
 * One instance's hierarchy expressed in scene space. The source artifact is
 * never modified: its evidence digests bind its exact spec bytes (ADR 0011), so
 * a rewritten artifact would correctly refuse its own validator.
 */
export type PlacedSceneInstanceHierarchy = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly rootNodeId: string;
  readonly worldTransform: SculptTransform;
  readonly nodes: ReadonlyArray<SculptHierarchyNode>;
};

export type SceneCompositionDiagnosticCode =
  | "not-object"
  | "schema-major-mismatch"
  | "invalid-kind"
  | "missing-field"
  | "unexpected-field"
  | "invalid-field"
  | "instance-count-below-minimum"
  | "duplicate-instance-id"
  | "unknown-artifact-reference"
  | "unplaced-artifact"
  | "invalid-artifact"
  | "missing-parent-instance"
  | "invalid-scene-root"
  | "scene-hierarchy-cycle"
  | "rotated-parent-unsupported"
  | "scene-budget-exceeded";

export type SceneCompositionDiagnostic = {
  readonly code: SceneCompositionDiagnosticCode;
  readonly path: string;
  readonly message: string;
};

export type SceneCompositionValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
    readonly ok: false;
    readonly diagnostics: readonly SceneCompositionDiagnostic[];
  };

/** Raw values are admitted only by the validators and descriptor-only capture below. */
type SceneRawInput = Parameters<typeof isJsonObject>[0];

function isSceneNumber(value: SceneRawInput): value is number {
  return typeof value === "number";
}

function isSceneString(value: SceneRawInput): value is string {
  return typeof value === "string";
}

function isSceneBoolean(value: SceneRawInput): value is boolean {
  return typeof value === "boolean";
}

function isSceneObject(value: SceneRawInput): value is object {
  return typeof value === "object" && value !== null;
}

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

function refuse<T>(
  code: SceneCompositionDiagnosticCode,
  path: string,
  message: string,
): SceneCompositionValidationResult<T> {
  return { ok: false, diagnostics: [{ code, path, message }] };
}

function isDigest(value: unknown): value is string {
  return isSceneString(value) && DIGEST_RE.test(value);
}

/** Round to the kernel's 1e-6 grid and collapse negative zero. */
function round6(value: number) {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;

  return rounded === 0 ? 0 : rounded;
}

function normalizeDegrees(value: number) {
  const rounded = round6(((value % 360) + 360) % 360);

  return rounded === 360 ? 0 : rounded;
}

function vector(values: readonly [number, number, number]): Vector3 {
  return Object.freeze(values);
}

/**
 * Axis-aligned v1 placement composition. Child offsets are deliberately not
 * rotated; a rotating parent refuses instead of producing wrong nesting.
 */
export function composeSculptTransforms(
  parent: SculptTransform,
  local: SculptTransform,
): SculptTransform {
  const result = tryComposeSculptTransforms(parent, local);

  if (!result.ok) {
    throw new RangeError(result.message);
  }

  return result.value;
}

type TransformCompositionResult =
  | { readonly ok: true; readonly value: SculptTransform }
  | {
    readonly ok: false;
    readonly field: "translation" | "scale";
    readonly message: string;
  };

export type CanonicalLocalSculptTransformResult =
  | { readonly ok: true; readonly value: SculptTransform }
  | { readonly ok: false; readonly message: string };

function tryComposeSculptTransforms(
  parent: SculptTransform,
  local: SculptTransform,
): TransformCompositionResult {
  const axes = [0, 1, 2] as const;

  // SAFETY: mapping the fixed three-axis tuple preserves exactly three numeric entries.
    const rawTranslation = axes.map(
    (axis) =>
      parent.translation[axis] +
      parent.scale[axis] * local.translation[axis],
  ) as [number, number, number];

  if (
    rawTranslation.some(
      (value) =>
        !Number.isFinite(value) ||
        Math.abs(value) > SCENE_MAXIMUM_COMPONENT_MAGNITUDE,
    )
  ) {
    return {
      ok: false,
      field: "translation",
      message: "Composed translation exceeds the scene numeric domain.",
    };
  }

  // SAFETY: mapping the fixed three-axis tuple preserves exactly three numeric entries.
    const translation = rawTranslation.map(round6) as [number, number, number];

  // SAFETY: mapping the fixed three-axis tuple preserves exactly three numeric entries.
    const rotation = axes.map((axis) =>
    normalizeDegrees(
      parent.rotationEulerDegrees[axis] + local.rotationEulerDegrees[axis],
    ),
  ) as [number, number, number];

  // SAFETY: mapping the fixed three-axis tuple preserves exactly three numeric entries.
    const rawScale = axes.map(
    (axis) => parent.scale[axis] * local.scale[axis],
  ) as [number, number, number];

  if (
    rawScale.some(
      (value) =>
        !Number.isFinite(value) ||
        value < SCENE_MINIMUM_SCALE ||
        value > SCENE_MAXIMUM_COMPONENT_MAGNITUDE,
    )
  ) {
    return {
      ok: false,
      field: "scale",
      message: "Composed scale exceeds the scene numeric domain.",
    };
  }

  // SAFETY: mapping the fixed three-axis tuple preserves exactly three numeric entries.
    const scale = rawScale.map(round6) as [number, number, number];

  return {
    ok: true,
    value: Object.freeze({
      translation: vector(translation),
      rotationEulerDegrees: vector(rotation),
      scale: vector(scale),
    }),
  };
}

export function deriveCanonicalLocalSculptTransform(
  parent: SculptTransform,
  world: SculptTransform,
): CanonicalLocalSculptTransformResult {
  const axes = [0, 1, 2] as const;

  // SAFETY: mapping the fixed three-axis tuple preserves exactly three numeric entries.
    const local = Object.freeze({
    translation: vector(axes.map((axis) => round6(
      (world.translation[axis] - parent.translation[axis]) / parent.scale[axis],
    )) as [number, number, number]),
    rotationEulerDegrees: vector(axes.map((axis) => round6(
      world.rotationEulerDegrees[axis] - parent.rotationEulerDegrees[axis],
    )) as [number, number, number]),
    scale: vector(axes.map((axis) => round6(
      world.scale[axis] / parent.scale[axis],
    )) as [number, number, number]),
  });

  if (!isSculptTransform(local)) {
    return { ok: false, message: "The canonical local transform is outside the scene numeric domain." };
  }

  const recomposed = tryComposeSculptTransforms(parent, local);

  if (!recomposed.ok) return { ok: false, message: recomposed.message };

  const exact = axes.every((axis) =>
    recomposed.value.translation[axis] === world.translation[axis] &&
    recomposed.value.rotationEulerDegrees[axis] === world.rotationEulerDegrees[axis] &&
    recomposed.value.scale[axis] === world.scale[axis]
  );

  return exact
    ? { ok: true, value: local }
    : { ok: false, message: "No canonical local transform reproduces the exact world transform." };
}

const IDENTITY_TRANSFORM: SculptTransform = Object.freeze({
  translation: vector([0, 0, 0]),
  rotationEulerDegrees: vector([0, 0, 0]),
  scale: vector([1, 1, 1]),
});

/** The neutral parent every scene root composes against. */
export function identitySculptTransform(): SculptTransform {
  return IDENTITY_TRANSFORM;
}

function isRotated(transform: SculptTransform) {
  return transform.rotationEulerDegrees.some(
    (degrees) => normalizeDegrees(degrees) !== 0,
  );
}

function duplicate(values: readonly string[]) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }

  return undefined;
}

function byDepthThenId(
  left: { readonly depth: number; readonly instanceId: string },
  right: { readonly depth: number; readonly instanceId: string },
) {
  if (left.depth !== right.depth) return left.depth - right.depth;

  return left.instanceId < right.instanceId
    ? -1
    : left.instanceId > right.instanceId
      ? 1
      : 0;
}

function sceneName(name: string | undefined) {
  return name === undefined ? {} : { name };
}

function isSceneName(value: unknown): value is string {
  return isSceneString(value) && value === value.trim() &&
    Array.from(value).length >= 1 && Array.from(value).length <= 64 &&
    !/\p{Cc}/u.test(value);
}

type IndexedScenePlacement = ScenePlacement & { readonly sourceIndex: number };

// D12's empty carrier is not a standalone Sculpt asset. Only this exact value
// may bypass Sculpt's non-empty-component rule, and it is never persisted.
const NODE_SPEC = snapshotSculptJson({
  schemaVersion: 1,
  kind: "sceneaxi.object-sculpt-spec",
  id: "sceneaxi-empty-node-spec",
  rootNodeId: "sceneaxi-empty-node-root",
  components: [],
  materials: [],
  sockets: [],
  hierarchy: [{
    id: "sceneaxi-empty-node-root",
    parentId: null,
    componentId: "sceneaxi-empty-node",
    transform: IDENTITY_TRANSFORM,
  }],
} as const);

const NODE_SPEC_DIGEST = digestSculptJson(NODE_SPEC);

const NODE_ARTIFACT: SculptArtifact = snapshotSculptJson({
  schemaVersion: 1,
  kind: "sceneaxi.sculpt-artifact",
  artifactId: "sceneaxi-empty-node",
  spec: NODE_SPEC,
  // An inert identity, never a module to load or execute.
  proceduralModule: {
    moduleId: "sceneaxi/empty-node",
    exportName: "emptyNode",
    sourceDigest: NODE_SPEC_DIGEST,
  },
  runtimeHierarchy: { rootNodeId: NODE_SPEC.rootNodeId, nodes: NODE_SPEC.hierarchy },
  evidence: {
    method: "structured-fixture",
    intakeDigest: NODE_SPEC_DIGEST,
    specDigest: NODE_SPEC_DIGEST,
    proceduralModuleDigest: NODE_SPEC_DIGEST,
    qualityGates: [{ id: "scene-node", status: "passed", digest: NODE_SPEC_DIGEST }],
  },
});

function sceneSource(placement: SceneSource | ResolvedScenePlacement): SceneSource {
  if (placement.kind === "node") return { kind: "node" };

  return { artifactId: placement.artifactId };
}

function validateSceneTransform(
  value: SceneRawInput,
  path: string,
): SceneCompositionValidationResult<SculptTransform> {
  if (!isSculptTransform(value)) {
    return refuse("invalid-field", path, "Placement transform is invalid.");
  }

  for (const key of ["translation", "rotationEulerDegrees"] as const) {
    const invalidIndex = value[key].findIndex(
      (component) =>
        Math.abs(component) > SCENE_MAXIMUM_COMPONENT_MAGNITUDE,
    );

    if (invalidIndex !== -1) {
      return refuse(
        "invalid-field",
        `${path}.${key}[${String(invalidIndex)}]`,
        `${key} exceeds the scene numeric domain.`,
      );
    }
  }

  const invalidScaleIndex = value.scale.findIndex(
    (component) =>
      component < SCENE_MINIMUM_SCALE ||
      component > SCENE_MAXIMUM_COMPONENT_MAGNITUDE,
  );

  if (invalidScaleIndex !== -1) {
    return refuse(
      "invalid-field",
      `${path}.scale[${String(invalidScaleIndex)}]`,
      "scale exceeds the scene numeric domain.",
    );
  }

  return { ok: true, value };
}

function validatePlacementEntries(
  placements: readonly unknown[],
  path: string,
): SceneCompositionValidationResult<readonly IndexedScenePlacement[]> {
  const entries: IndexedScenePlacement[] = [];

  for (const [index, placement] of placements.entries()) {
    const entryPath = `${path}[${index}]`;

    if (!isJsonObject(placement)) {
      return refuse("invalid-field", entryPath, "Placement must be an object.");
    }

    const fields = exactContractFields(
      placement,
      placement["kind"] === "node"
        ? ["instanceId", "kind", "parentInstanceId", "transform"]
        : ["instanceId", "artifactId", "parentInstanceId", "transform"],
      ["name"],
      entryPath,
    );

    if (fields !== null) return { ok: false, diagnostics: [fields] };
    const name = placement["name"];

    if (Object.hasOwn(placement, "name") && !isSceneName(name)) {
      return refuse("invalid-field", `${entryPath}.name`, "name must be trimmed, contain 1-64 characters and no control characters.");
    }

    if (!isSculptIdentifier(placement["instanceId"])) {
      return refuse(
        "invalid-field",
        `${entryPath}.instanceId`,
        "instanceId must be a lowercase slug.",
      );
    }

    if (placement["kind"] !== "node" && !isSculptIdentifier(placement["artifactId"])) {
      return refuse(
        "invalid-field",
        `${entryPath}.artifactId`,
        "artifactId must be a lowercase slug.",
      );
    }

    const parentInstanceId = placement["parentInstanceId"];

    if (parentInstanceId !== null && !isSculptIdentifier(parentInstanceId)) {
      return refuse(
        "invalid-field",
        `${entryPath}.parentInstanceId`,
        "parentInstanceId must be null or a lowercase slug.",
      );
    }

    const transform = validateSceneTransform(
      placement["transform"],
      `${entryPath}.transform`,
    );

    if (!transform.ok) return transform;
    entries.push({
      ...sceneName(isSceneName(name) ? name : undefined),
      ...sceneSource(placement["kind"] === "node"
        ? { kind: "node" } : { artifactId: String(placement["artifactId"]) }),
      instanceId: placement["instanceId"],
      parentInstanceId,
      transform: transform.value,
      sourceIndex: index,
    });
  }

  return { ok: true, value: entries };
}

/**
 * Resolve instance parentage into depths and world transforms.
 * Every structural rule of the scene graph is enforced here, once.
 */
function resolveGraph(
  placements: readonly IndexedScenePlacement[],
  rootInstanceId: string,
  path: string,
  transformField: "transform" | "localTransform",
): SceneCompositionValidationResult<readonly ResolvedScenePlacement[]> {
  const duplicateInstance = duplicate(
    placements.map((placement) => placement.instanceId),
  );

  if (duplicateInstance !== undefined) {
    return refuse(
      "duplicate-instance-id",
      path,
      `Duplicate scene instance id "${duplicateInstance}".`,
    );
  }

  const byId = new Map(
    placements.map((placement) => [placement.instanceId, placement]),
  );

  const roots = placements.filter(
    (placement) => placement.parentInstanceId === null,
  );

  if (roots.length !== 1) {
    return refuse(
      "invalid-scene-root",
      path,
      `A scene must declare exactly one root placement; found ${String(roots.length)}.`,
    );
  }

  const root = roots[0];

  if (root === undefined || root.instanceId !== rootInstanceId) {
    return refuse(
      "invalid-scene-root",
      "$.rootInstanceId",
      `rootInstanceId must name the placement whose parentInstanceId is null.`,
    );
  }

  for (const placement of placements) {
    const parentInstanceId = placement.parentInstanceId;

    if (parentInstanceId === null) continue;

    if (parentInstanceId === placement.instanceId) {
      return refuse(
        "scene-hierarchy-cycle",
        `${path}[${String(placement.sourceIndex)}].parentInstanceId`,
        `Scene instance "${placement.instanceId}" parents itself.`,
      );
    }

    if (!byId.has(parentInstanceId)) {
      return refuse(
        "missing-parent-instance",
        `${path}[${String(placement.sourceIndex)}].parentInstanceId`,
        `Scene instance "${placement.instanceId}" references missing parent "${parentInstanceId}".`,
      );
    }
  }

  const depths = new Map<string, number>([[rootInstanceId, 0]]);

  for (const placement of placements) {
    if (depths.has(placement.instanceId)) continue;
    const chain: IndexedScenePlacement[] = [];
    const visiting = new Set<string>();
    let cursor: IndexedScenePlacement | undefined = placement;

    while (cursor !== undefined && !depths.has(cursor.instanceId)) {
      if (visiting.has(cursor.instanceId)) {
        return refuse(
          "scene-hierarchy-cycle",
          path,
          `Scene instance parentage cycle includes "${cursor.instanceId}".`,
        );
      }

      visiting.add(cursor.instanceId);
      chain.push(cursor);
      const parentInstanceId: string | null = cursor.parentInstanceId;
      cursor = parentInstanceId === null ? undefined : byId.get(parentInstanceId);
    }

    let depth = cursor === undefined ? 0 : (depths.get(cursor.instanceId) ?? 0);

    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const entry = chain[index];

      if (entry === undefined) continue;
      depth += 1;

      if (depth > SCENE_MAXIMUM_DEPTH) {
        return refuse(
          "scene-budget-exceeded",
          path,
          `Scene instance depth ${String(depth)} exceeds the v1 maximum of ${String(SCENE_MAXIMUM_DEPTH)}.`,
        );
      }

      depths.set(entry.instanceId, depth);
    }
  }

  const parented = new Set<string>();

  for (const placement of placements) {
    if (placement.parentInstanceId !== null) parented.add(placement.parentInstanceId);
  }

  for (const placement of placements) {
    if (!parented.has(placement.instanceId)) continue;

    if (isRotated(placement.transform)) {
      return refuse(
        "rotated-parent-unsupported",
        `${path}[${String(placement.sourceIndex)}].${transformField}.rotationEulerDegrees`,
        `Scene instance "${placement.instanceId}" has children and a non-zero rotation; v1 composition is axis-aligned and refuses rather than mis-nesting children.`,
      );
    }
  }

  const ordered = [...placements]
    .map((placement) => ({
      placement,
      depth: depths.get(placement.instanceId) ?? 0,
    }))
    .sort((left, right) =>
      byDepthThenId(
        { depth: left.depth, instanceId: left.placement.instanceId },
        { depth: right.depth, instanceId: right.placement.instanceId },
      ),
    );

  const world = new Map<string, SculptTransform>();
  const resolved: ResolvedScenePlacement[] = [];

  for (const entry of ordered) {
    const parentInstanceId = entry.placement.parentInstanceId;

    const parentTransform =
      parentInstanceId === null
        ? IDENTITY_TRANSFORM
        : world.get(parentInstanceId);

    if (parentTransform === undefined) {
      return refuse(
        "scene-hierarchy-cycle",
        path,
        `Scene instance "${entry.placement.instanceId}" resolved before its parent; parentage is not a tree.`,
      );
    }

    const worldTransform = tryComposeSculptTransforms(
      parentTransform,
      entry.placement.transform,
    );

    if (!worldTransform.ok) {
      return refuse(
        "invalid-field",
        `${path}[${String(entry.placement.sourceIndex)}].${transformField}.${worldTransform.field}`,
        worldTransform.message,
      );
    }

    world.set(entry.placement.instanceId, worldTransform.value);
    resolved.push(
      snapshotSculptJson({
        ...sceneName(entry.placement.name),
        instanceId: entry.placement.instanceId,
        ...(entry.placement.kind === "node"
          ? { kind: "node" as const, artifactId: NODE_ARTIFACT.artifactId, artifact: NODE_ARTIFACT }
          : { artifactId: entry.placement.artifactId }),
        parentInstanceId,
        depth: entry.depth,
        localTransform: entry.placement.transform,
        worldTransform: worldTransform.value,
      }),
    );
  }

  return { ok: true, value: Object.freeze(resolved) };
}

/** Validate an exact Scene Composition Intake envelope. */
export function validateSceneCompositionIntake(
  value: SceneRawInput,
): SceneCompositionValidationResult<SceneCompositionIntake> {
  if (!isJsonObject(value)) {
    return refuse(
      "not-object",
      "$",
      "Scene Composition Intake must be a JSON object.",
    );
  }

  const fields = exactContractFields(
    value,
    ["schemaVersion", "kind", "sceneId", "rootInstanceId", "placements"],
    [],
    "$",
  );

  if (fields !== null) return { ok: false, diagnostics: [fields] };

  if (value["schemaVersion"] !== SCENE_COMPOSITION_SCHEMA_VERSION) {
    return refuse(
      "schema-major-mismatch",
      "$.schemaVersion",
      `Scene composition schema major must be ${String(SCENE_COMPOSITION_SCHEMA_VERSION)}.`,
    );
  }

  if (value["kind"] !== SCENE_COMPOSITION_INTAKE_KIND) {
    return refuse(
      "invalid-kind",
      "$.kind",
      `kind must be "${SCENE_COMPOSITION_INTAKE_KIND}".`,
    );
  }

  if (!isSculptIdentifier(value["sceneId"])) {
    return refuse(
      "invalid-field",
      "$.sceneId",
      "sceneId must be a lowercase slug.",
    );
  }

  if (!isSculptIdentifier(value["rootInstanceId"])) {
    return refuse(
      "invalid-field",
      "$.rootInstanceId",
      "rootInstanceId must be a lowercase slug.",
    );
  }

  const placements = value["placements"];

  if (!Array.isArray(placements) || !isDenseArray(placements)) {
    return refuse(
      "invalid-field",
      "$.placements",
      "placements must be a dense array.",
    );
  }

  if (placements.length < SCENE_MINIMUM_INSTANCES) {
    return refuse(
      "instance-count-below-minimum",
      "$.placements",
      `A composed scene requires at least ${String(SCENE_MINIMUM_INSTANCES)} placements; found ${String(placements.length)}.`,
    );
  }

  if (placements.length > SCENE_MAXIMUM_INSTANCES) {
    return refuse(
      "scene-budget-exceeded",
      "$.placements",
      `Scene instance count ${String(placements.length)} exceeds the v1 maximum of ${String(SCENE_MAXIMUM_INSTANCES)}.`,
    );
  }

  const entries = validatePlacementEntries(placements, "$.placements");

  if (!entries.ok) return entries;

  const graph = resolveGraph(
    entries.value,
    value["rootInstanceId"],
    "$.placements",
    "transform",
  );

  if (!graph.ok) return graph;

  // SAFETY: envelope, placement fields, transforms, and graph constraints have all been checked above.
  return {
    ok: true,
    value: snapshotSculptJson({
      schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
      kind: SCENE_COMPOSITION_INTAKE_KIND,
      sceneId: value["sceneId"],
      rootInstanceId: value["rootInstanceId"],
      placements: entries.value.map((placement) => ({
        ...sceneName(placement.name),
        instanceId: placement.instanceId,
        ...sceneSource(placement),
        parentInstanceId: placement.parentInstanceId,
        transform: placement.transform,
      })),
    }),
  };
}

/**
 * Resolve a Scene Composition Intake into ordered placements carrying depth and
 * world transforms. Artifact binding is the composition pipeline's job.
 */
export function resolveScenePlacements(
  value: SceneRawInput,
): SceneCompositionValidationResult<readonly ResolvedScenePlacement[]> {
  const intake = validateSceneCompositionIntake(value);

  if (!intake.ok) return intake;

  return resolveGraph(
    intake.value.placements.map((placement, sourceIndex) => ({
      ...placement,
      sourceIndex,
    })),
    intake.value.rootInstanceId,
    "$.placements",
    "transform",
  );
}

/** Canonical digest of the placement projection, independent of artifact bytes. */
export function digestScenePlacements(
  placements: ReadonlyArray<ResolvedScenePlacement>,
): string {
  const projection = placements.map((placement) => ({
      ...sceneName(placement.name),
      instanceId: placement.instanceId,
      ...sceneSource(placement),
      parentInstanceId: placement.parentInstanceId,
      depth: placement.depth,
      localTransform: placement.localTransform,
      worldTransform: placement.worldTransform,
    }));

  if (!isJsonValue(projection)) {
    throw new TypeError("Scene placement digest requires validated JSON fields.");
  }

  return digestSculptJson(projection);
}

/** Canonical digest of one Sculpt Artifact as embedded in a scene. */
export function digestSceneArtifact(artifact: SculptArtifact): string {
  // SAFETY: SculptArtifact's contract contains only canonical JSON fields.
  return digestSculptJson(artifact as JsonValue);
}

/**
 * Canonical digest of a ComposedScene with `evidence.sceneDigest` omitted, so
 * the recorded digest is independently recomputable and tamper-evident.
 */
export function digestComposedScene(scene: ComposedScene): string {
  // SAFETY: this explicit digest projection contains only the ComposedScene contract's canonical JSON fields.
  return digestSculptJson({
    schemaVersion: scene.schemaVersion,
    kind: scene.kind,
    sceneId: scene.sceneId,
    rootInstanceId: scene.rootInstanceId,
    instances: scene.instances.map((instance) => instance.kind === "node"
      ? {
        ...sceneName(instance.name),
        kind: instance.kind,
        instanceId: instance.instanceId,
        parentInstanceId: instance.parentInstanceId,
        depth: instance.depth,
        localTransform: instance.localTransform,
        worldTransform: instance.worldTransform,
      }
      : instance),
    evidence: {
      intakeDigest: scene.evidence.intakeDigest,
      placementDigest: scene.evidence.placementDigest,
      artifactDigests: scene.evidence.artifactDigests,
    },
  } as JsonValue);
}

/**
 * Express one instance's hierarchy in scene space by composing the world
 * transform into the root node only. The artifact is returned untouched.
 */
export function projectSceneInstanceHierarchy(
  instance: ComposedSceneInstance,
): PlacedSceneInstanceHierarchy {
  const rootNodeId = instance.artifact.runtimeHierarchy.rootNodeId;

  return snapshotSculptJson({
    instanceId: instance.instanceId,
    artifactId: instance.artifactId,
    rootNodeId,
    worldTransform: instance.worldTransform,
    nodes: instance.artifact.runtimeHierarchy.nodes.map((node) =>
      node.id === rootNodeId
        ? {
          ...node,
          transform: composeSculptTransforms(
            instance.worldTransform,
            node.transform,
          ),
        }
        : node,
    ),
  });
}

function validateInstanceEntries(
  instances: readonly unknown[],
): SceneCompositionValidationResult<readonly ComposedSceneInstance[]> {
  const entries: ComposedSceneInstance[] = [];
  const digestByArtifactId = new Map<string, string>();

  for (const [index, instance] of instances.entries()) {
    const path = `$.instances[${String(index)}]`;

    if (!isJsonObject(instance)) {
      return refuse("invalid-field", path, "Scene instance must be an object.");
    }

    const fields = exactContractFields(
      instance,
      [
        "instanceId",
        "parentInstanceId",
        "depth",
        "localTransform",
        "worldTransform",
        ...(instance["kind"] === "node" ? ["kind"] : ["artifactId", "artifact"]),
      ],
      instance["kind"] === "node" ? ["name", "artifactId", "artifact"] : ["name"],
      path,
    );

    if (fields !== null) return { ok: false, diagnostics: [fields] };
    const name = instance["name"];

    if (Object.hasOwn(instance, "name") && !isSceneName(name)) {
      return refuse("invalid-field", `${path}.name`, "name must be trimmed, contain 1-64 characters and no control characters.");
    }

    if (!isSculptIdentifier(instance["instanceId"])) {
      return refuse(
        "invalid-field",
        `${path}.instanceId`,
        "instanceId must be a lowercase slug.",
      );
    }

    if (instance["kind"] !== "node" && !isSculptIdentifier(instance["artifactId"])) {
      return refuse(
        "invalid-field",
        `${path}.artifactId`,
        "artifactId must be a lowercase slug.",
      );
    }

    const parentInstanceId = instance["parentInstanceId"];

    if (parentInstanceId !== null && !isSculptIdentifier(parentInstanceId)) {
      return refuse(
        "invalid-field",
        `${path}.parentInstanceId`,
        "parentInstanceId must be null or a lowercase slug.",
      );
    }

    const depth = instance["depth"];

    if (
      !Number.isInteger(depth) ||
      Number(depth) < 0 ||
      Number(depth) > SCENE_MAXIMUM_DEPTH
    ) {
      return refuse(
        "invalid-field",
        `${path}.depth`,
        `depth must be an integer between 0 and ${String(SCENE_MAXIMUM_DEPTH)}.`,
      );
    }

    const transforms = new Map<"localTransform" | "worldTransform", SculptTransform>();

    for (const key of ["localTransform", "worldTransform"] as const) {
      const transform = validateSceneTransform(instance[key], `${path}.${key}`);

      if (!transform.ok) return transform;
      transforms.set(key, transform.value);
    }

    const node = instance["kind"] === "node";

    if (node && (
      (Object.hasOwn(instance, "artifactId") && instance["artifactId"] !== NODE_ARTIFACT.artifactId) ||
      (Object.hasOwn(instance, "artifact") && !sculptJsonEqual(instance["artifact"], NODE_ARTIFACT))
    )) {
      return refuse("invalid-artifact", `${path}.artifact`, "A node may carry only the canonical empty runtime artifact.");
    }

    const artifact = node
      ? { ok: true as const, value: NODE_ARTIFACT }
      : validateSculptArtifact(instance["artifact"]);

    if (!artifact.ok) {
      return refuse(
        "invalid-artifact",
        `${path}.artifact`,
        artifact.diagnostics[0]?.message ??
        "Scene instance Sculpt Artifact refused.",
      );
    }

    if (!node && artifact.value.artifactId !== instance["artifactId"]) {
      return refuse(
        "unknown-artifact-reference",
        `${path}.artifactId`,
        `Scene instance "${String(instance["instanceId"])}" names artifact "${String(instance["artifactId"])}" but embeds "${artifact.value.artifactId}".`,
      );
    }

    const artifactDigest = digestSceneArtifact(artifact.value);
    const priorArtifactDigest = node ? undefined : digestByArtifactId.get(artifact.value.artifactId);

    if (
      priorArtifactDigest !== undefined &&
      priorArtifactDigest !== artifactDigest
    ) {
      return refuse(
        "invalid-artifact",
        `${path}.artifact`,
        `Every instance of Sculpt Artifact "${artifact.value.artifactId}" must embed the same artifact bytes.`,
      );
    }

    if (!node) digestByArtifactId.set(artifact.value.artifactId, artifactDigest);
    const localTransform = transforms.get("localTransform");
    const worldTransform = transforms.get("worldTransform");

    if (localTransform === undefined || worldTransform === undefined) {
      return refuse(
        "invalid-field",
        path,
        "Scene instance transforms are missing.",
      );
    }

    const rootNodeIndex = artifact.value.runtimeHierarchy.nodes.findIndex(
      (node) => node.id === artifact.value.runtimeHierarchy.rootNodeId,
    );

    const rootNode = artifact.value.runtimeHierarchy.nodes[rootNodeIndex];

    if (
      rootNode === undefined ||
      !tryComposeSculptTransforms(worldTransform, rootNode.transform).ok
    ) {
      return refuse(
        "invalid-artifact",
        `${path}.artifact.runtimeHierarchy.nodes[${String(rootNodeIndex)}].transform`,
        "Artifact root transform cannot be represented after scene projection.",
      );
    }

    const entry = {
      ...sceneName(isSceneName(name) ? name : undefined),
      instanceId: instance["instanceId"],
      artifactId: artifact.value.artifactId,
      parentInstanceId,
      depth: Number(depth),
      localTransform,
      worldTransform,
      artifact: artifact.value,
    };

    entries.push(node ? { ...entry, kind: "node" } : entry);
  }

  return { ok: true, value: entries };
}

function validateSceneEvidence(
  value: SceneRawInput,
  instances: readonly ComposedSceneInstance[],
): SceneCompositionValidationResult<ComposedSceneEvidence> {
  if (!isJsonObject(value)) {
    return refuse("invalid-field", "$.evidence", "evidence must be an object.");
  }

  const fields = exactContractFields(
    value,
    ["intakeDigest", "placementDigest", "artifactDigests", "sceneDigest"],
    [],
    "$.evidence",
  );

  if (fields !== null) return { ok: false, diagnostics: [fields] };

  for (const key of [
    "intakeDigest",
    "placementDigest",
    "sceneDigest",
  ] as const) {
    if (!isDigest(value[key])) {
      return refuse(
        "invalid-field",
        `$.evidence.${key}`,
        `${key} must be sha256:<64 lowercase hex>.`,
      );
    }
  }

  const artifactDigests = value["artifactDigests"];

  if (
    !Array.isArray(artifactDigests) ||
    !isDenseArray(artifactDigests) ||
    artifactDigests.length !== instances.length
  ) {
    return refuse(
      "invalid-field",
      "$.evidence.artifactDigests",
      "artifactDigests must list exactly one dense entry per scene instance.",
    );
  }

  for (const [index, entry] of artifactDigests.entries()) {
    const path = `$.evidence.artifactDigests[${String(index)}]`;
    const instance = instances[index];

    if (instance === undefined) {
      return refuse("invalid-field", path, "Artifact digest has no instance.");
    }

    if (!isJsonObject(entry)) {
      return refuse("invalid-field", path, "Artifact digest must be an object.");
    }

    const entryFields = exactContractFields(
      entry,
      ["instanceId", "artifactDigest"],
      [],
      path,
    );

    if (entryFields !== null) return { ok: false, diagnostics: [entryFields] };

    if (entry["instanceId"] !== instance.instanceId) {
      return refuse(
        "invalid-field",
        `${path}.instanceId`,
        "artifactDigests must follow the scene instance order.",
      );
    }

    if (entry["artifactDigest"] !== digestSceneArtifact(instance.artifact)) {
      return refuse(
        "invalid-artifact",
        `${path}.artifactDigest`,
        `Artifact digest for "${instance.instanceId}" does not bind the embedded artifact.`,
      );
    }
  }

  if (value["placementDigest"] !== digestScenePlacements(instances)) {
    return refuse(
      "invalid-field",
      "$.evidence.placementDigest",
      "placementDigest does not bind the resolved placements.",
    );
  }

  // SAFETY: exact evidence fields, digest formats, order, and artifact/placement bindings were checked above.
  return { ok: true, value: value as ComposedSceneEvidence };
}

/** Validate a ComposedScene, recomputing every structural and digest binding. */
export function validateComposedScene(
  value: SceneRawInput,
): SceneCompositionValidationResult<ComposedScene> {
  if (!isJsonObject(value)) {
    return refuse("not-object", "$", "ComposedScene must be a JSON object.");
  }

  const fields = exactContractFields(
    value,
    ["schemaVersion", "kind", "sceneId", "rootInstanceId", "instances", "evidence"],
    [],
    "$",
  );

  if (fields !== null) return { ok: false, diagnostics: [fields] };

  if (value["schemaVersion"] !== SCENE_COMPOSITION_SCHEMA_VERSION) {
    return refuse(
      "schema-major-mismatch",
      "$.schemaVersion",
      `Scene composition schema major must be ${String(SCENE_COMPOSITION_SCHEMA_VERSION)}.`,
    );
  }

  if (value["kind"] !== COMPOSED_SCENE_KIND) {
    return refuse(
      "invalid-kind",
      "$.kind",
      `kind must be "${COMPOSED_SCENE_KIND}".`,
    );
  }

  if (!isSculptIdentifier(value["sceneId"])) {
    return refuse("invalid-field", "$.sceneId", "sceneId must be a lowercase slug.");
  }

  if (!isSculptIdentifier(value["rootInstanceId"])) {
    return refuse(
      "invalid-field",
      "$.rootInstanceId",
      "rootInstanceId must be a lowercase slug.",
    );
  }

  const rawInstances = value["instances"];

  if (!Array.isArray(rawInstances) || !isDenseArray(rawInstances)) {
    return refuse("invalid-field", "$.instances", "instances must be a dense array.");
  }

  if (rawInstances.length < SCENE_MINIMUM_INSTANCES) {
    return refuse(
      "instance-count-below-minimum",
      "$.instances",
      `A composed scene requires at least ${String(SCENE_MINIMUM_INSTANCES)} instances; found ${String(rawInstances.length)}.`,
    );
  }

  if (rawInstances.length > SCENE_MAXIMUM_INSTANCES) {
    return refuse(
      "scene-budget-exceeded",
      "$.instances",
      `Scene instance count ${String(rawInstances.length)} exceeds the v1 maximum of ${String(SCENE_MAXIMUM_INSTANCES)}.`,
    );
  }

  const instances = validateInstanceEntries(rawInstances);

  if (!instances.ok) return instances;

  const resolved = resolveGraph(
    instances.value.map((instance, sourceIndex) => ({
      ...sceneName(instance.name),
      instanceId: instance.instanceId,
      ...sceneSource(instance),
      parentInstanceId: instance.parentInstanceId,
      transform: instance.localTransform,
      sourceIndex,
    })),
    value["rootInstanceId"],
    "$.instances",
    "localTransform",
  );

  if (!resolved.ok) return resolved;

  if (resolved.value.length !== instances.value.length) {
    return refuse(
      "invalid-field",
      "$.instances",
      "Resolved instance count drifted from the declared instances.",
    );
  }

  for (const [index, expected] of resolved.value.entries()) {
    const actual = instances.value[index];

    if (actual === undefined) continue;
    const path = `$.instances[${String(index)}]`;

    if (actual.instanceId !== expected.instanceId) {
      return refuse(
        "invalid-field",
        "$.instances",
        "instances must be ordered by ascending depth then ascending instanceId.",
      );
    }

    if (actual.depth !== expected.depth) {
      return refuse(
        "invalid-field",
        `${path}.depth`,
        `Declared depth ${String(actual.depth)} does not match the resolved depth ${String(expected.depth)}.`,
      );
    }

    if (
      digestSculptJson(actual.worldTransform) !==
      digestSculptJson(expected.worldTransform)
    ) {
      return refuse(
        "invalid-field",
        `${path}.worldTransform`,
        `Declared world transform for "${actual.instanceId}" does not match deterministic composition.`,
      );
    }
  }

  const evidence = validateSceneEvidence(value["evidence"], instances.value);

  if (!evidence.ok) return evidence;

  // SAFETY: all envelope fields and hydrated instances have been checked above.
  const scene = { ...value, instances: instances.value } as ComposedScene;

  if (evidence.value.sceneDigest !== digestComposedScene(scene)) {
    return refuse(
      "invalid-field",
      "$.evidence.sceneDigest",
      "sceneDigest does not bind the composed scene contents.",
    );
  }

  return { ok: true, value: snapshotSculptJson(scene) };
}

/** Narrow a text-canonical document body that carries a ComposedScene. */
export function composedSceneFromDocumentData(
  data: JsonObject,
): SceneCompositionValidationResult<ComposedScene> {
  if (!Object.hasOwn(data, COMPOSED_SCENE_DOCUMENT_DATA_KEY)) {
    return refuse(
      "missing-field",
      `$.${COMPOSED_SCENE_DOCUMENT_DATA_KEY}`,
      `Document data must carry "${COMPOSED_SCENE_DOCUMENT_DATA_KEY}".`,
    );
  }

  const validated = validateComposedScene(
    data[COMPOSED_SCENE_DOCUMENT_DATA_KEY],
  );

  if (validated.ok) return validated;

  return {
    ok: false,
    diagnostics: validated.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      path: `$.${COMPOSED_SCENE_DOCUMENT_DATA_KEY}${diagnostic.path.slice(1)}`,
    })),
  };
}

function requiredSceneEntryV2<T>(value: T | undefined): T {
  if (value === undefined) throw new RangeError("Validated scene entry is missing.");

  return value;
}

/** Explicit opt-in: v1 contracts and digest bytes remain unchanged. */
export const SCENE_COMPOSITION_SCHEMA_VERSION_V2 = 2 as const;

/** Matrices act on column vectors; local TRS uses Three-compatible XYZ Euler. */
export const SCENE_MATRIX_CONVENTION_V2 = "column-major-xyz-trs" as const;

export type SceneMatrixV2 = readonly [
  number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number,
];

export type SceneCompositionIntakeV2 = Omit<SceneCompositionIntake, "schemaVersion"> & {
  readonly schemaVersion: typeof SCENE_COMPOSITION_SCHEMA_VERSION_V2;
};

type ScenePlacementWithoutWorldTransform<Placement> = Placement extends ResolvedScenePlacement
  ? Omit<Placement, "worldTransform">
  : never;

export type ResolvedScenePlacementV2 = ScenePlacementWithoutWorldTransform<ResolvedScenePlacement> & {
  /** Retains shear from nonuniformly scaled, rotated hierarchies. Never decompose. */
  readonly worldMatrix: SceneMatrixV2;
};

export type SceneBoundsV2 = { readonly min: Vector3; readonly max: Vector3 };

export type ComposedSceneInstanceV2 = ResolvedScenePlacementV2 & {
  readonly artifact: SculptArtifact;
  /** Conservative rest-pose AABB of all component boxes, not animated bounds. */
  readonly bounds: SceneBoundsV2;
};

export type ComposedSceneV2 = Omit<ComposedScene, "schemaVersion" | "instances"> & {
  readonly schemaVersion: typeof SCENE_COMPOSITION_SCHEMA_VERSION_V2;
  readonly instances: readonly ComposedSceneInstanceV2[];
};

export type PlacedSceneInstanceHierarchyV2 = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly rootNodeId: string;
  readonly worldMatrix: SceneMatrixV2;
  readonly nodes: readonly (SculptHierarchyNode & { readonly worldMatrix: SceneMatrixV2 })[];
  readonly bounds: SceneBoundsV2;
};

const IDENTITY_MATRIX_V2: SceneMatrixV2 = Object.freeze([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

function checkedSceneMatrixV2(matrix: SceneRawInput): SceneMatrixV2 {
  const captured = captureSceneV2(matrix);

  if (!captured.ok || !Array.isArray(captured.value) || captured.value.length !== 16 ||
    captured.value.some(n => !isSceneNumber(n) || !Number.isFinite(n) || Math.abs(n) > SCENE_MAXIMUM_COMPONENT_MAGNITUDE) ||
    captured.value[3] !== 0 || captured.value[7] !== 0 || captured.value[11] !== 0 || captured.value[15] !== 1) {
    throw new RangeError("Expected a bounded column-major affine scene matrix.");
  }

  const entries = captured.value;

  const n = (index: number): number => {
    const value = entries[index];

    if (!isSceneNumber(value)) throw new RangeError("Missing numeric matrix entry.");

    return value === 0 ? 0 : value;
  };

  const result: SceneMatrixV2 = [n(0), n(1), n(2), n(3), n(4), n(5), n(6), n(7),
  n(8), n(9), n(10), n(11), n(12), n(13), n(14), n(15)];

  return Object.freeze(result);
}

/** Spectral upper bound of a 3x3 matrix via fixed Jacobi sweeps on A^T A.
 * Scaling avoids overflow; final Gershgorin radii conservatively cover residue.
 */
function sceneLinearNormV2(a: readonly number[]): number {
  const scale = Math.max(...a.map(Math.abs));

  if (scale === 0) return 0;
  const n = a.map(v => v / scale);
  const gram = Array<number>(9).fill(0);

  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
    for (let k = 0; k < 3; k += 1) gram[i * 3 + j] = requiredSceneEntryV2(gram[i * 3 + j]) + requiredSceneEntryV2(n[k * 3 + i]) * requiredSceneEntryV2(n[k * 3 + j]);
  }

  for (let sweep = 0; sweep < 12; sweep += 1) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]] as const) {
      const off = requiredSceneEntryV2(gram[p * 3 + q]);

      if (off === 0) continue;
      const tau = (requiredSceneEntryV2(gram[q * 3 + q]) - requiredSceneEntryV2(gram[p * 3 + p])) / (2 * off);
      const t = tau === 0 ? 1 : Math.sign(tau) / (Math.abs(tau) + Math.hypot(1, tau));
      const c = 1 / Math.hypot(1, t);
      const r = t * c;
      const pp = requiredSceneEntryV2(gram[p * 3 + p]);
      const qq = requiredSceneEntryV2(gram[q * 3 + q]);
      gram[p * 3 + p] = pp - t * off;
      gram[q * 3 + q] = qq + t * off;
      gram[p * 3 + q] = 0; gram[q * 3 + p] = 0;

      for (let k = 0; k < 3; k += 1) {
        if (k === p || k === q) continue;
        const kp = requiredSceneEntryV2(gram[k * 3 + p]); const kq = requiredSceneEntryV2(gram[k * 3 + q]);
        gram[k * 3 + p] = c * kp - r * kq;
        gram[p * 3 + k] = requiredSceneEntryV2(gram[k * 3 + p]);
        gram[k * 3 + q] = r * kp + c * kq;
        gram[q * 3 + k] = requiredSceneEntryV2(gram[k * 3 + q]);
      }
    }
  }

  let eigenBound = 0;

  for (let i = 0; i < 3; i += 1) {
    let bound = requiredSceneEntryV2(gram[i * 3 + i]);

    for (let j = 0; j < 3; j += 1) if (i !== j) bound += Math.abs(requiredSceneEntryV2(gram[i * 3 + j]));
    eigenBound = Math.max(eigenBound, bound);
  }

  return scale * Math.sqrt(eigenBound);
}

/** Apply the existing scale domain to actual affine stretches, including shear. */
function checkSceneLinearScaleV2(m: SceneMatrixV2): void {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  if (!Number.isFinite(determinant) || determinant <= 0) throw new RangeError("Scene matrix scale is singular or outside the numeric domain.");

  const inverse = [e * i - f * h, c * h - b * i, b * f - c * e,
  f * g - d * i, a * i - c * g, c * d - a * f,
  d * h - e * g, b * g - a * h, a * e - b * d].map(v => v / determinant);

  const maximum = sceneLinearNormV2([a, b, c, d, e, f, g, h, i]);
  const inverseMaximum = sceneLinearNormV2(inverse);

  if (!Number.isFinite(maximum) || !Number.isFinite(inverseMaximum) ||
    maximum > SCENE_MAXIMUM_COMPONENT_MAGNITUDE * (1 + 1e-12) ||
    inverseMaximum > (1 / SCENE_MINIMUM_SCALE) * (1 + 1e-12)) {
    throw new RangeError("Composed affine scale exceeds the scene numeric domain.");
  }
}

/** Portable affine multiplication, with no rounding of intermediate poses. */
export function multiplySceneMatricesV2(parent: SceneMatrixV2, local: SceneMatrixV2): SceneMatrixV2 {
  const safeParent = checkedSceneMatrixV2(parent);
  const safeLocal = checkedSceneMatrixV2(local);
  const out = Array<number>(16).fill(0);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;

      for (let k = 0; k < 4; k += 1) sum += requiredSceneEntryV2(safeParent[k * 4 + row]) * requiredSceneEntryV2(safeLocal[column * 4 + k]);
      out[column * 4 + row] = sum;
    }
  }

  const result = checkedSceneMatrixV2(out);
  checkSceneLinearScaleV2(result);

  return result;
}

/** T * Rx * Ry * Rz * S (XYZ intrinsic Euler), matching the existing renderer. */
export function sceneMatrixFromSculptTransformV2(transform: SculptTransform): SceneMatrixV2 {
  const validated = validateSceneTransform(transform, "$.transform");

  if (!validated.ok) throw new RangeError(validated.diagnostics[0]?.message);

  // Exact cardinal angles avoid tiny spurious translations/bounds at 90/180/270.
  const trig = (degrees: number): readonly [number, number] => {
    const n = ((degrees % 360) + 360) % 360;

    if (n === 0) return [1, 0];

    if (n === 90) return [0, 1];

    if (n === 180) return [-1, 0];

    if (n === 270) return [0, -1];

    return [Math.cos(n * Math.PI / 180), Math.sin(n * Math.PI / 180)];
  };

  const [a, b] = trig(transform.rotationEulerDegrees[0]);
  const [c, d] = trig(transform.rotationEulerDegrees[1]);
  const [e, f] = trig(transform.rotationEulerDegrees[2]);
  const [sx, sy, sz] = transform.scale;
  const [tx, ty, tz] = transform.translation;

  return checkedSceneMatrixV2([
    c * e * sx, (a * f + b * e * d) * sx, (b * f - a * e * d) * sx, 0,
    -c * f * sy, (a * e - b * f * d) * sy, (b * e + a * f * d) * sy, 0,
    d * sz, -b * c * sz, a * c * sz, 0,
    tx, ty, tz, 1,
  ]);
}

/** Descriptor-only bounded snapshot: accessors/cycles never run or get serialized. */
function captureSceneV2(value: SceneRawInput): SceneCompositionValidationResult<JsonValue> {
  let entries = 100_000;
  const ancestors = new Set<object>();

  function visit(current: SceneRawInput, depth: number): JsonValue {
    if (depth > 64) throw new RangeError("Scene capture depth exceeded.");

    if (current === null || isSceneString(current) || isSceneBoolean(current)) return current;

    if (isSceneNumber(current) && Number.isFinite(current)) return current;

    if (!isSceneObject(current) || current === null || ancestors.has(current)) throw new TypeError("Expected acyclic JSON data.");
    const array = Array.isArray(current);
    const prototype: unknown = Object.getPrototypeOf(current);

    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new TypeError("Expected plain JSON containers.");
    const keys = Reflect.ownKeys(current);
    entries -= keys.length;

    if (entries < 0) throw new RangeError("Scene capture entry budget exceeded.");
    ancestors.add(current);

    try {
      if (array) {
        // SAFETY: a descriptor may contain arbitrary data; the numeric guard below validates this raw value.
          const length = Object.getOwnPropertyDescriptor(current, "length")?.value as unknown;

        if (!isSceneNumber(length) || !Number.isSafeInteger(length) || length < 0 || length > 100_000 || keys.length !== length + 1) throw new RangeError("Expected bounded dense JSON array.");
        const out: JsonValue[] = [];

        for (let i = 0; i < length; i += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(i));

          if (!descriptor?.enumerable || !("value" in descriptor)) throw new TypeError("Expected indexed data fields.");
          // SAFETY: the own data descriptor is checked above, then visit recursively validates its raw value.
            out.push(visit(descriptor.value as unknown, depth + 1));
        }

        return Object.freeze(out);
      }

      const out: Array<readonly [string, JsonValue]> = [];

      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);

        if (!isSceneString(key) || !descriptor?.enumerable || !("value" in descriptor)) throw new TypeError("Expected string data fields.");
        // SAFETY: the own data descriptor is checked above, then visit recursively validates its raw value.
          out.push([key, visit(descriptor.value as unknown, depth + 1)]);
      }

      return Object.freeze(Object.fromEntries(out));
    } finally { ancestors.delete(current); }
  }

  try { return { ok: true, value: visit(value, 0) }; }
  catch (error) { return refuse(error instanceof RangeError ? "scene-budget-exceeded" : "invalid-field", "$", "Scene v2 requires bounded, finite, stable JSON data."); }
}

function resolveCapturedSceneV2(value: JsonValue): SceneCompositionValidationResult<{
  readonly intake: SceneCompositionIntakeV2;
  readonly placements: readonly ResolvedScenePlacementV2[];
}> {
  if (!isJsonObject(value)) return refuse("not-object", "$", "Scene intake must be an object.");

  if (value["schemaVersion"] !== 2) return refuse("schema-major-mismatch", "$.schemaVersion", "Explicit scene v2 is required.");
  // Reuse v1 shape, count, parentage, cycle and depth rules on neutral poses.
  // Retain the v1 node/name discriminants while validating v2 affine transforms.
  const rawPlacements = value["placements"];

  if (!Array.isArray(rawPlacements) || rawPlacements.length > SCENE_MAXIMUM_INSTANCES) return refuse("scene-budget-exceeded", "$.placements", "Expected at most 32 placements.");
  const entries = validatePlacementEntries(rawPlacements, "$.placements");

  if (!entries.ok) return entries;

  const surrogate = {
    ...value, schemaVersion: 1,
    placements: entries.value.map(p => ({
      ...sceneName(p.name), ...sceneSource(p),
      instanceId: p.instanceId, parentInstanceId: p.parentInstanceId,
      transform: IDENTITY_TRANSFORM,
    })),
  };

  const legacy = validateSceneCompositionIntake(surrogate);

  if (!legacy.ok) return legacy;
  const graph = resolveScenePlacements(legacy.value);

  if (!graph.ok) return graph;
  const original = new Map(entries.value.map(p => [p.instanceId, p]));
  const world = new Map<string, SceneMatrixV2>();
  const placements: ResolvedScenePlacementV2[] = [];

  try {
    for (const p of graph.value) {
      const local = requiredSceneEntryV2(original.get(p.instanceId));
      const parent = p.parentInstanceId === null ? IDENTITY_MATRIX_V2 : requiredSceneEntryV2(world.get(p.parentInstanceId));
      const worldMatrix = multiplySceneMatricesV2(parent, sceneMatrixFromSculptTransformV2(local.transform));
      world.set(p.instanceId, worldMatrix);

      const pose = {
        ...sceneName(p.name), instanceId: p.instanceId, parentInstanceId: p.parentInstanceId,
        depth: p.depth, localTransform: local.transform, worldMatrix
      };

      if (p.kind === "node") {
        placements.push({ ...pose, kind: "node", artifactId: p.artifactId, artifact: p.artifact });
      } else {
        placements.push({ ...pose, artifactId: p.artifactId });
      }
    }
  } catch { return refuse("invalid-field", "$.placements", "Resolved matrix exceeds the scene numeric domain."); }

  // The surrogate validator checks the exact envelope; original transforms were checked above.
  const intake: SceneCompositionIntakeV2 = {
    schemaVersion: 2, kind: legacy.value.kind,
    sceneId: legacy.value.sceneId, rootInstanceId: legacy.value.rootInstanceId,
    placements: entries.value.map(p => ({
      ...sceneName(p.name), ...sceneSource(p), instanceId: p.instanceId,
      parentInstanceId: p.parentInstanceId, transform: p.transform
    }))
  };

  return { ok: true, value: snapshotSculptJson({ intake, placements }) };
}

export function validateSceneCompositionIntakeV2(value: SceneRawInput): SceneCompositionValidationResult<SceneCompositionIntakeV2> {
  const captured = captureSceneV2(value);

  if (!captured.ok) return captured;
  const resolved = resolveCapturedSceneV2(captured.value);

  return resolved.ok ? { ok: true, value: resolved.value.intake } : resolved;
}

export function resolveScenePlacementsV2(value: SceneRawInput): SceneCompositionValidationResult<readonly ResolvedScenePlacementV2[]> {
  const captured = captureSceneV2(value);

  if (!captured.ok) return captured;
  const resolved = resolveCapturedSceneV2(captured.value);

  return resolved.ok ? { ok: true, value: resolved.value.placements } : resolved;
}

/** Explicit migration, never an implicit change to v1 validators or bytes. */
export function migrateSceneCompositionIntakeV1ToV2(value: SceneRawInput): SceneCompositionValidationResult<SceneCompositionIntakeV2> {
  const captured = captureSceneV2(value);

  if (!captured.ok) return captured;
  const legacy = validateSceneCompositionIntake(captured.value);

  return legacy.ok ? validateSceneCompositionIntakeV2({ ...legacy.value, schemaVersion: 2 }) : legacy;
}

export function digestScenePlacementsV2(placements: readonly ResolvedScenePlacementV2[]): string {
  return digestSculptJson(placements.map(p => ({
    instanceId: p.instanceId, artifactId: p.artifactId,
    parentInstanceId: p.parentInstanceId, depth: p.depth, localTransform: p.localTransform, worldMatrix: p.worldMatrix
  })));
}

/** Project optional placement fields explicitly for consumers without exactOptionalPropertyTypes. */
function composedSceneInstanceJsonV2(instance: ComposedSceneInstanceV2): JsonObject {
  let value: JsonObject = {
    instanceId: instance.instanceId, artifactId: instance.artifactId,
    parentInstanceId: instance.parentInstanceId, depth: instance.depth,
    localTransform: instance.localTransform, worldMatrix: instance.worldMatrix,
    artifact: instance.artifact, bounds: instance.bounds,
  };

  if (instance.kind !== undefined) value = { ...value, kind: instance.kind };

  if (instance.name !== undefined) value = { ...value, name: instance.name };

  return value;
}

export function digestComposedSceneV2(scene: ComposedSceneV2): string {
  return digestSculptJson({
    schemaVersion: scene.schemaVersion, kind: scene.kind, sceneId: scene.sceneId,
    rootInstanceId: scene.rootInstanceId, instances: scene.instances.map(composedSceneInstanceJsonV2),
    evidence: {
      intakeDigest: scene.evidence.intakeDigest, placementDigest: scene.evidence.placementDigest,
      artifactDigests: scene.evidence.artifactDigests
    }
  });
}

/** Resolve artifact-local nodes in parent order, without mutating artifact evidence. */
export function projectSceneInstanceHierarchyV2(instance: ResolvedScenePlacementV2 & { readonly artifact: SculptArtifact }): PlacedSceneInstanceHierarchyV2 {
  const validated = validateSculptArtifact(instance.artifact);

  if (!validated.ok) throw new RangeError("Invalid scene artifact.");
  const artifact = validated.value;
  const byId = new Map(artifact.runtimeHierarchy.nodes.map(n => [n.id, n]));
  const matrices = new Map<string, SceneMatrixV2>();

  function resolve(id: string): SceneMatrixV2 {
    const cached = matrices.get(id);

    if (cached) return cached;
    const node = byId.get(id);

    if (!node) throw new RangeError("Missing artifact node.");
    const parent = node.parentId === null ? instance.worldMatrix : resolve(node.parentId);
    const worldMatrix = multiplySceneMatricesV2(parent, sceneMatrixFromSculptTransformV2(node.transform));
    matrices.set(id, worldMatrix);

    return worldMatrix;
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const components = new Map(artifact.spec.components.map(c => [c.id, c]));

  const nodes = artifact.runtimeHierarchy.nodes.map(node => {
    const worldMatrix = resolve(node.id);
    const component = components.get(node.componentId);

    if (!component) throw new RangeError("Missing artifact component.");
    // Match existing geometryFor(): sphere radius=max(x,y,z)/2 and tapered
    // cylinder radii=x/2,z/2, not an ellipsoid or an elliptical cylinder.
    const radius = Math.max(...component.dimensions) / 2;
    const cylinderRadius = Math.max(component.dimensions[0], component.dimensions[2]) / 2;

    const half: Vector3 = component.primitive === "sphere" ? [radius, radius, radius]
      : component.primitive === "cylinder" ? [cylinderRadius, component.dimensions[1] / 2, cylinderRadius]
        : [component.dimensions[0] / 2, component.dimensions[1] / 2, component.dimensions[2] / 2];

    for (const x of [-half[0], half[0]]) {
      for (const y of [-half[1], half[1]]) {
        for (const z of [-half[2], half[2]]) {
          for (const axis of [0, 1, 2] as const) {
            const v = worldMatrix[axis] * x + requiredSceneEntryV2(worldMatrix[4 + axis]) * y + requiredSceneEntryV2(worldMatrix[8 + axis]) * z + requiredSceneEntryV2(worldMatrix[12 + axis]);

            if (!Number.isFinite(v) || Math.abs(v) > SCENE_MAXIMUM_COMPONENT_MAGNITUDE) throw new RangeError("Projected bounds exceed the scene numeric domain.");
            min[axis] = Math.min(min[axis], v);
            max[axis] = Math.max(max[axis], v);
          }
        }
      }
    }

    return { ...node, worldMatrix };
  });

  return snapshotSculptJson({
    instanceId: instance.instanceId, artifactId: instance.artifactId,
    rootNodeId: artifact.runtimeHierarchy.rootNodeId, worldMatrix: instance.worldMatrix, nodes, bounds: { min, max }
  });
}

/** Recompute poses, rest bounds and every artifact/placement/scene digest on intake. */
export function validateComposedSceneV2(value: SceneRawInput): SceneCompositionValidationResult<ComposedSceneV2> {
  const captured = captureSceneV2(value);

  if (!captured.ok) return captured;

  if (!isJsonObject(captured.value)) return refuse("not-object", "$", "Composed scene must be an object.");
  const raw = captured.value;
  const fields = exactContractFields(raw, ["schemaVersion", "kind", "sceneId", "rootInstanceId", "instances", "evidence"], [], "$");

  if (fields) return { ok: false, diagnostics: [fields] };

  if (raw["schemaVersion"] !== 2) return refuse("schema-major-mismatch", "$.schemaVersion", "Explicit scene v2 is required.");

  if (raw["kind"] !== COMPOSED_SCENE_KIND) return refuse("invalid-kind", "$.kind", "Invalid composed scene kind.");
  const instances = raw["instances"];

  if (!Array.isArray(instances) || instances.length > SCENE_MAXIMUM_INSTANCES) return refuse("scene-budget-exceeded", "$.instances", "Expected at most 32 instances.");
  const placements: JsonObject[] = [];
  const artifacts: SculptArtifact[] = [];
  const artifactBytes = new Map<string, string>();

  for (const [index, instance] of instances.entries()) {
    const path = `$.instances[${String(index)}]`;

    if (!isJsonObject(instance)) return refuse("invalid-field", path, "Expected scene instance object.");
    const fields = exactContractFields(instance, ["instanceId", "artifactId", "parentInstanceId", "depth", "localTransform", "worldMatrix", "artifact", "bounds"], [], path);

    if (fields) return { ok: false, diagnostics: [fields] };
    const artifact = validateSculptArtifact(instance["artifact"]);

    if (!artifact.ok || artifact.value.artifactId !== instance["artifactId"]) return refuse("invalid-artifact", `${path}.artifact`, "Artifact binding refused.");
    const digest = digestSceneArtifact(artifact.value);
    const previous = artifactBytes.get(artifact.value.artifactId);

    if (previous !== undefined && previous !== digest) return refuse("invalid-artifact", `${path}.artifact`, "Instanced artifact bytes must agree.");
    artifactBytes.set(artifact.value.artifactId, digest);
    artifacts.push(artifact.value);
    placements.push({
      instanceId: requiredSceneEntryV2(instance["instanceId"]), artifactId: requiredSceneEntryV2(instance["artifactId"]),
      parentInstanceId: requiredSceneEntryV2(instance["parentInstanceId"]), transform: requiredSceneEntryV2(instance["localTransform"])
    });
  }

  const resolved = resolveScenePlacementsV2({
    schemaVersion: 2, kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: raw["sceneId"], rootInstanceId: raw["rootInstanceId"], placements
  });

  if (!resolved.ok) return resolved;
  const expected: ComposedSceneInstanceV2[] = [];

  for (const [index, placement] of resolved.value.entries()) {
    const artifact = requiredSceneEntryV2(artifacts[index]);
    let bounds: SceneBoundsV2;

    try { bounds = projectSceneInstanceHierarchyV2({ ...placement, artifact }).bounds; }
    catch { return refuse("invalid-artifact", `$.instances[${String(index)}].artifact`, "Artifact projection exceeds scene bounds."); }

    const instance = { ...placement, artifact, bounds };

    if (digestSculptJson(composedSceneInstanceJsonV2(instance)) !== digestSculptJson(requiredSceneEntryV2(instances[index]))) return refuse("invalid-field", `$.instances[${String(index)}]`, "Declared order, pose, depth or bounds does not match deterministic composition.");
    expected.push(instance);
  }

  const evidence = raw["evidence"];

  if (!isJsonObject(evidence)) return refuse("invalid-field", "$.evidence", "Expected scene evidence.");
  const evidenceFields = exactContractFields(evidence, ["intakeDigest", "placementDigest", "artifactDigests", "sceneDigest"], [], "$.evidence");

  if (evidenceFields) return { ok: false, diagnostics: [evidenceFields] };

  if (!isDigest(evidence["intakeDigest"]) || !isDigest(evidence["sceneDigest"]) || evidence["placementDigest"] !== digestScenePlacementsV2(expected)) return refuse("invalid-field", "$.evidence", "Scene evidence digest refused.");
  const artifactDigests = expected.map(i => ({ instanceId: i.instanceId, artifactDigest: digestSceneArtifact(i.artifact) }));

  if (digestSculptJson(requiredSceneEntryV2(evidence["artifactDigests"])) !== digestSculptJson(artifactDigests)) return refuse("invalid-artifact", "$.evidence.artifactDigests", "Artifact digests refused.");

  const scene: ComposedSceneV2 = {
    schemaVersion: 2, kind: COMPOSED_SCENE_KIND, sceneId: String(raw["sceneId"]),
    rootInstanceId: String(raw["rootInstanceId"]), instances: expected,
    evidence: { intakeDigest: evidence["intakeDigest"], placementDigest: digestScenePlacementsV2(expected), artifactDigests, sceneDigest: evidence["sceneDigest"] }
  };

  if (scene.evidence.sceneDigest !== digestComposedSceneV2(scene)) return refuse("invalid-field", "$.evidence.sceneDigest", "Scene digest refused.");

  return { ok: true, value: snapshotSculptJson(scene) };
}

export function composedSceneV2FromDocumentData(data: JsonObject): SceneCompositionValidationResult<ComposedSceneV2> {
  const captured = captureSceneV2(data);

  if (!captured.ok) return captured;

  if (!isJsonObject(captured.value) || !Object.hasOwn(captured.value, COMPOSED_SCENE_DOCUMENT_DATA_KEY)) return refuse("missing-field", "$.composedScene", "Document must carry composedScene.");

  return validateComposedSceneV2(captured.value[COMPOSED_SCENE_DOCUMENT_DATA_KEY]);
}
