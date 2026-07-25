/**
 * Scene composition public contracts (v1).
 *
 * A Scene Composition Intake places several already-validated Sculpt Artifacts
 * relative to one another; a ComposedScene is the resolved, digest-bound result.
 * Both payloads are backend-neutral: nothing here exposes a renderer type, and
 * placement never rewrites a Sculpt Artifact — see `projectSceneInstanceHierarchy`.
 */
import { isJsonObject, type JsonObject, type JsonValue } from "./document.js";
import {
  digestSculptJson,
  exactContractFields,
  isDenseArray,
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

export type ScenePlacement = {
  readonly instanceId: string;
  readonly artifactId: string;
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

/** A placement with its resolved depth and world transform. */
export type ResolvedScenePlacement = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly parentInstanceId: string | null;
  readonly depth: number;
  readonly localTransform: SculptTransform;
  readonly worldTransform: SculptTransform;
};

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

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

function refuse<T>(
  code: SceneCompositionDiagnosticCode,
  path: string,
  message: string,
): SceneCompositionValidationResult<T> {
  return { ok: false, diagnostics: [{ code, path, message }] };
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_RE.test(value);
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

function tryComposeSculptTransforms(
  parent: SculptTransform,
  local: SculptTransform,
): TransformCompositionResult {
  const axes = [0, 1, 2] as const;
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
  const translation = rawTranslation.map(round6) as [number, number, number];
  const rotation = axes.map((axis) =>
    normalizeDegrees(
      parent.rotationEulerDegrees[axis] + local.rotationEulerDegrees[axis],
    ),
  ) as [number, number, number];
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

const IDENTITY_TRANSFORM: SculptTransform = Object.freeze({
  translation: vector([0, 0, 0]),
  rotationEulerDegrees: vector([0, 0, 0]),
  scale: vector([1, 1, 1]),
});

/** The neutral parent every scene root composes against. */
export function identitySculptTransform(): SculptTransform {
  return IDENTITY_TRANSFORM;
}

function isIdentityTransform(transform: SculptTransform) {
  return (
    transform.translation.every((component) => component === 0) &&
    transform.rotationEulerDegrees.every((component) => component === 0) &&
    transform.scale.every((component) => component === 1)
  );
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

type PlacementShape = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly parentInstanceId: string | null;
  readonly transform: SculptTransform;
  readonly sourceIndex: number;
};

function validateSceneTransform(
  value: unknown,
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
): SceneCompositionValidationResult<readonly PlacementShape[]> {
  const entries: PlacementShape[] = [];
  for (const [index, placement] of placements.entries()) {
    const entryPath = `${path}[${index}]`;
    if (!isJsonObject(placement)) {
      return refuse("invalid-field", entryPath, "Placement must be an object.");
    }
    const fields = exactContractFields(
      placement,
      ["instanceId", "artifactId", "parentInstanceId", "transform"],
      [],
      entryPath,
    );
    if (fields !== null) return { ok: false, diagnostics: [fields] };
    if (!isSculptIdentifier(placement["instanceId"])) {
      return refuse(
        "invalid-field",
        `${entryPath}.instanceId`,
        "instanceId must be a lowercase slug.",
      );
    }
    if (!isSculptIdentifier(placement["artifactId"])) {
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
      instanceId: placement["instanceId"],
      artifactId: placement["artifactId"],
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
  placements: readonly PlacementShape[],
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
    const chain: PlacementShape[] = [];
    const visiting = new Set<string>();
    let cursor: PlacementShape | undefined = placement;
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

  const parented = new Set(
    placements
      .map((placement) => placement.parentInstanceId)
      .filter((parentInstanceId): parentInstanceId is string =>
        parentInstanceId !== null,
      ),
  );
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
        instanceId: entry.placement.instanceId,
        artifactId: entry.placement.artifactId,
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
  value: unknown,
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
  return {
    ok: true,
    value: snapshotSculptJson(value as unknown as SceneCompositionIntake),
  };
}

/**
 * Resolve a Scene Composition Intake into ordered placements carrying depth and
 * world transforms. Artifact binding is the composition pipeline's job.
 */
export function resolveScenePlacements(
  value: unknown,
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
  return digestSculptJson(
    placements.map((placement) => ({
      instanceId: placement.instanceId,
      artifactId: placement.artifactId,
      parentInstanceId: placement.parentInstanceId,
      depth: placement.depth,
      localTransform: placement.localTransform,
      worldTransform: placement.worldTransform,
    })) as unknown as JsonValue,
  );
}

/** Canonical digest of one Sculpt Artifact as embedded in a scene. */
export function digestSceneArtifact(artifact: SculptArtifact): string {
  return digestSculptJson(artifact as unknown as JsonValue);
}

/**
 * Canonical digest of a ComposedScene with `evidence.sceneDigest` omitted, so
 * the recorded digest is independently recomputable and tamper-evident.
 */
export function digestComposedScene(scene: ComposedScene): string {
  return digestSculptJson({
    schemaVersion: scene.schemaVersion,
    kind: scene.kind,
    sceneId: scene.sceneId,
    rootInstanceId: scene.rootInstanceId,
    instances: scene.instances,
    evidence: {
      intakeDigest: scene.evidence.intakeDigest,
      placementDigest: scene.evidence.placementDigest,
      artifactDigests: scene.evidence.artifactDigests,
    },
  } as unknown as JsonValue);
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
        "artifactId",
        "parentInstanceId",
        "depth",
        "localTransform",
        "worldTransform",
        "artifact",
      ],
      [],
      path,
    );
    if (fields !== null) return { ok: false, diagnostics: [fields] };
    if (!isSculptIdentifier(instance["instanceId"])) {
      return refuse(
        "invalid-field",
        `${path}.instanceId`,
        "instanceId must be a lowercase slug.",
      );
    }
    if (!isSculptIdentifier(instance["artifactId"])) {
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
    const artifact = validateSculptArtifact(instance["artifact"]);
    if (!artifact.ok) {
      return refuse(
        "invalid-artifact",
        `${path}.artifact`,
        artifact.diagnostics[0]?.message ??
          "Scene instance Sculpt Artifact refused.",
      );
    }
    if (artifact.value.artifactId !== instance["artifactId"]) {
      return refuse(
        "unknown-artifact-reference",
        `${path}.artifactId`,
        `Scene instance "${String(instance["instanceId"])}" names artifact "${String(instance["artifactId"])}" but embeds "${artifact.value.artifactId}".`,
      );
    }
    const artifactDigest = digestSceneArtifact(artifact.value);
    const priorArtifactDigest = digestByArtifactId.get(artifact.value.artifactId);
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
    digestByArtifactId.set(artifact.value.artifactId, artifactDigest);
    const rootNodeIndex = artifact.value.runtimeHierarchy.nodes.findIndex(
      (node) => node.id === artifact.value.runtimeHierarchy.rootNodeId,
    );
    const rootNode = artifact.value.runtimeHierarchy.nodes[rootNodeIndex];
    if (
      rootNode === undefined ||
      !isIdentityTransform(rootNode.transform)
    ) {
      return refuse(
        "invalid-artifact",
        `${path}.artifact.runtimeHierarchy.nodes[${String(rootNodeIndex)}].transform`,
        "Artifact root transform must be identity for renderer-neutral scene projection.",
      );
    }
    const localTransform = transforms.get("localTransform");
    const worldTransform = transforms.get("worldTransform");
    if (localTransform === undefined || worldTransform === undefined) {
      return refuse(
        "invalid-field",
        path,
        "Scene instance transforms are missing.",
      );
    }
    entries.push({
      instanceId: instance["instanceId"],
      artifactId: instance["artifactId"],
      parentInstanceId,
      depth: Number(depth),
      localTransform,
      worldTransform,
      artifact: artifact.value,
    });
  }
  return { ok: true, value: entries };
}

function validateSceneEvidence(
  value: unknown,
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
  return { ok: true, value: value as unknown as ComposedSceneEvidence };
}

/** Validate a ComposedScene, recomputing every structural and digest binding. */
export function validateComposedScene(
  value: unknown,
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
      instanceId: instance.instanceId,
      artifactId: instance.artifactId,
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
      digestSculptJson(actual.worldTransform as unknown as JsonValue) !==
      digestSculptJson(expected.worldTransform as unknown as JsonValue)
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

  const scene = value as unknown as ComposedScene;
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
