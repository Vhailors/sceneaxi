/**
 * The scene composition boundary for the packaged desktop app.
 *
 * One `composeScene()` result feeds both the renderer-process viewport and the
 * main-process kernel open path, whether it is the initial starter composition or
 * one re-read from the active Scene Document.
 *
 * Placement stays a projection (ADR 0014): the committed starter artifact is
 * reconstructed through `@sceneaxi/authoring-core` and never rewritten to place it,
 * because its evidence binds its exact spec bytes.
 */
import { composeScene, type ApplyDiagnostic } from "@sceneaxi/authoring-core";
import {
  COMPOSED_SCENE_DOCUMENT_DATA_KEY,
  DESKTOP_SCENE_HIERARCHY_KIND,
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  DESKTOP_SCENE_HIERARCHY_SCHEMA_VERSION,
  DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  SCENE_MAXIMUM_INSTANCES,
  SCENE_MINIMUM_INSTANCES,
  composedSceneFromDocumentData,
  deriveCanonicalLocalSculptTransform,
  desktopSceneTransformProperty,
  digestSceneArtifact,
  identitySculptTransform,
  isDesktopSceneEditOperation,
  isDesktopSceneEditProfile,
  isDesktopSceneReparentPolicy,
  isJsonObject,
  resolveDesktopSceneSelection,
  defineScenePrefab,
  emptyScenePrefabCatalog,
  inspectScenePrefab,
  instanceScenePrefab,
  overrideScenePrefab,
  parseScenePrefabCatalog,
  refreshScenePrefab,
  SCENE_PREFAB_CATALOG_KEY,
  SCENE_PREFAB_REFUSALS,
  SCENE_ANIMATION_CATALOG_KEY,
  SCENE_ANIMATION_REFUSALS,
  applySceneAnimationMutation,
  emptySceneAnimationCatalog,
  evaluateSceneAnimation,
  inspectSceneAnimation,
  parseSceneAnimationCatalog,
  SCENE_PHYSICS_CATALOG_KEY,
  SCENE_PHYSICS_REFUSALS,
  applyScenePhysicsMutation,
  emptyScenePhysicsCatalog,
  evaluateScenePhysics,
  inspectScenePhysics,
  parseScenePhysicsCatalog,
  SCENE_ENVIRONMENT_CATALOG_KEY,
  SCENE_ENVIRONMENT_REFUSALS,
  applySceneEnvironmentMutation,
  emptySceneEnvironmentCatalog,
  inspectSceneEnvironment,
  parseSceneEnvironmentCatalog,
  SCENE_MATERIALS_CATALOG_KEY,
  SCENE_MATERIALS_REFUSALS,
  applySceneMaterialsMutation,
  emptySceneMaterialsCatalog,
  inspectSceneMaterials,
  parseSceneMaterialsCatalog,
  SCENE_EFFECTS_CATALOG_KEY,
  SCENE_EFFECTS_REFUSALS,
  applySceneEffectsMutation,
  emptySceneEffectsCatalog,
  inspectSceneEffects,
  parseSceneEffectsCatalog,
  ASSISTANT_ASK_REFUSALS,
  SCENE_ASSISTANT_BUILD_CATALOG_KEY,
  answerAssistantAsk,
  applyAssistantBuildEntry,
  parseSceneAssistantBuildCatalog,
  type SceneAssistantBuildEntry,
  SCENE_PACKAGE_CATALOG_KEY,
  SCENE_PACKAGE_REFUSALS,
  SHIPPED_PLUGIN_CAPABILITY_IDS,
  applyScenePackageMutation,
  discoverScenePackage,
  isDeclaredExtensionCapability,
  refuseUndeclaredExtensionGrant,
  emptyScenePackageCatalog,
  inspectScenePackages,
  parseScenePackageCatalog,
  type ScenePackageMutation,
  type ComposedScene,
  type ScenePhysicsCatalog,
  type ScenePhysicsMutation,
  type SceneEnvironmentCatalog,
  type SceneEnvironmentMutation,
  type SceneMaterialsCatalog,
  type SceneMaterialsMutation,
  type SceneEffectsCatalog,
  type SceneEffectsMutation,
  type SceneAnimationCatalog,
  type SceneAnimationMutation,
  type ScenePrefabCatalog,
  type ComposedSceneInstance,
  type DesktopSceneEditOperation,
  type DesktopSceneEditProfile,
  type DesktopSceneHierarchyRefusal,
  type DesktopSceneSelection,
  type DesktopSceneTransformPropertyId,
  type SceneCompositionIntake,
  type SculptArtifact,
  type SculptTransform,
  type Vector3,
} from "@sceneaxi/schemas";
import {
  mountableScene,
  webEditorStarterArtifact,
  type ComposedSceneOk,
  type MountableScene,
} from "@sceneaxi/site-kit";
import {
  PROJECT_ASSET_MANIFEST_KEY,
  projectAssetManifestEntry,
  projectAssetManifestFromDocumentData,
  type ImportedAssetRenderMesh,
  type ProjectAssetManifestEntry,
} from "@sceneaxi/importers";
import { DESKTOP_ACTIVE_DOCUMENT_PATH } from "./bridge-contract.js";

/** Document id of the composed scene the desktop app opens. */
export const DESKTOP_OPEN_SCENE_ID = "desktop-linux-open-scene";

export const DESKTOP_ASSISTANT_SCENE_ID = "desktop-assistant-output-scene";

export const DESKTOP_ASSISTANT_INSTANCE_ID = "assistant-live-output";

/** Existing ProductManifest identity carried by the canonical Scene Document. */
export const DESKTOP_RARITY_PRODUCT_ID = "desktop-linux-rarity" as const;
export const DESKTOP_RARITY_PROJECT_SEED = 20260809 as const;

/** Refusal minted when the pipeline rejects the desktop composition. */
export const DESKTOP_SCENE_NOT_COMPOSABLE = "DESKTOP_SCENE_NOT_COMPOSABLE";

export type DesktopSceneEditableProperty = Readonly<{
  id: DesktopSceneTransformPropertyId;
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
}>;

export type DesktopSceneEditableEntity = Readonly<{
  id: string;
  label: string;
  artifactId: string;
  parentInstanceId: string | null;
  depth: number;
  localTransform: SculptTransform;
  worldTransform: SculptTransform;
  canRemove: boolean;
  properties: readonly DesktopSceneEditableProperty[];
}>;

export type DesktopSceneHierarchySnapshot = Readonly<{
  schemaVersion: typeof DESKTOP_SCENE_HIERARCHY_SCHEMA_VERSION;
  kind: typeof DESKTOP_SCENE_HIERARCHY_KIND;
  sceneId: string;
  rootInstanceId: string;
  objects: readonly Readonly<{
    id: string;
    artifactId: string;
    parentId: string | null;
    depth: number;
    localTransform: SculptTransform;
    worldTransform: SculptTransform;
  }>[];
}>;

export type DesktopScenePropertyInspection =
  | Readonly<{
      ok: true;
      contentHash: string;
      entities: readonly DesktopSceneEditableEntity[];
      hierarchy: DesktopSceneHierarchySnapshot;
      selection: DesktopSceneSelection;
    }>
  | Readonly<{
      ok: false;
      reason?: DesktopSceneHierarchyRefusal;
      diagnostics: readonly ApplyDiagnostic[];
      contentHash?: string;
      entities?: readonly DesktopSceneEditableEntity[];
      hierarchy?: DesktopSceneHierarchySnapshot;
    }>;

export type DesktopScenePropertyProposalInput = Readonly<{
  documentPath: string;
  jsonPointer: typeof DESKTOP_SCENE_TRANSLATION_X_PROPERTY.jsonPointer;
  expectedContentHash: string;
  newValue: unknown;
}>;

export type DesktopScenePropertyStageResult =
  | Readonly<{
      ok: true;
      edit: DesktopScenePropertyProposalInput;
      entity: DesktopSceneEditableEntity;
      inspection: Extract<DesktopScenePropertyInspection, { readonly ok: true }>;
      sceneDigest: string;
    }>
  | Readonly<{
      ok: false;
      reason?: DesktopSceneHierarchyRefusal;
      diagnostics: readonly ApplyDiagnostic[];
    }>;

export type DesktopSceneEditStageResult =
  | Readonly<{
      ok: true;
      operation: DesktopSceneEditOperation;
      edit: DesktopScenePropertyProposalInput;
      inspection: DesktopScenePropertyInspection;
      selectedInstanceId: string;
      selectedInstanceIds: readonly string[];
      sceneDigest: string;
    }>
  | Readonly<{
      ok: false;
      reason?: DesktopSceneHierarchyRefusal;
      diagnostics: readonly ApplyDiagnostic[];
    }>;

const propertyDiagnostic = (
  message: string,
  documentPath: string,
  code: ApplyDiagnostic["code"] = "validation-failed",
) =>
  Object.freeze({
    ok: false as const,
    diagnostics: Object.freeze([
      Object.freeze({
        code,
        message,
        documentPath,
      }),
    ]),
  });

/**
 * A request fault, not a rejected value: the caller named something this
 * release cannot edit, or handed over an argument that is not a content hash.
 * It carries a different code from `validation-failed` so a consumer can tell
 * "that number is invalid" from "that is not an editable property".
 */
const propertyRequestDiagnostic = (message: string, documentPath: string) =>
  propertyDiagnostic(message, documentPath, "invalid-proposal");

const hierarchyDiagnostic = (
  reason: DesktopSceneHierarchyRefusal,
  message: string,
  documentPath: string,
) => Object.freeze({
  ...propertyRequestDiagnostic(message, documentPath),
  reason,
});

/** Refusal passed through when the committed starter artifact fails reconstruction. */
export type DesktopSceneResult =
  | { readonly ok: true; readonly composed: ComposedSceneOk; readonly mountable: DesktopMountableScene }
  | { readonly ok: false; readonly reason: string; readonly message: string };

export type DesktopImportedAsset = Readonly<{
  instanceId: string;
  digest: string;
  meshes: readonly ImportedAssetRenderMesh[];
}>;

export type DesktopMountableScene = MountableScene & Readonly<{
  importedAssets?: readonly DesktopImportedAsset[];
}>;

function consistentProjectAssetManifest(
  data: unknown,
  stored: ComposedScene,
):
  | Readonly<{
      ok: true;
      assets: readonly ProjectAssetManifestEntry[];
      instanceIds: ReadonlySet<string>;
    }>
  | Readonly<{ ok: false; reason: DesktopSceneHierarchyRefusal; message: string }> {
  const manifest = projectAssetManifestFromDocumentData(data);
  if (!manifest.ok) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.manifestInconsistent,
      message: manifest.message,
    });
  }
  const instanceIds = new Set<string>();
  for (const entry of manifest.value.assets) {
    if (entry.instanceId === null && entry.artifactId === null) continue;
    const instance = stored.instances.find(
      (candidate) => candidate.instanceId === entry.instanceId,
    );
    if (instance?.artifactId !== entry.artifactId) {
      return Object.freeze({
        ok: false as const,
        reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.manifestInconsistent,
        message: `Asset manifest instance "${entry.instanceId}" does not match the accepted composition.`,
      });
    }
    if (entry.instanceId !== null) instanceIds.add(entry.instanceId);
  }
  return Object.freeze({
    ok: true as const,
    assets: manifest.value.assets,
    instanceIds,
  });
}

function withImportedAssets(
  data: unknown,
  composed: ComposedSceneOk,
  mountable: MountableScene,
): DesktopSceneResult {
  const manifest = consistentProjectAssetManifest(data, composed.scene);
  if (!manifest.ok) {
    return Object.freeze({ ok: false as const, reason: manifest.reason, message: manifest.message });
  }
  const importedAssets: DesktopImportedAsset[] = [];
  for (const entry of manifest.assets) {
    if (entry.family !== "model") continue;
    if (entry.instanceId === null || entry.artifactId === null) {
      return Object.freeze({
        ok: false as const,
        reason: DESKTOP_SCENE_NOT_COMPOSABLE,
        message: `Model asset manifest entry "${entry.assetId}" has no stable composition identities.`,
      });
    }
    const instance = composed.scene.instances.find((candidate) => candidate.instanceId === entry.instanceId);
    if (instance?.artifactId !== entry.artifactId) {
      return Object.freeze({
        ok: false as const,
        reason: DESKTOP_SCENE_NOT_COMPOSABLE,
        message: `Asset manifest instance "${entry.instanceId}" is absent from the accepted composition.`,
      });
    }
    const projected = projectAssetManifestEntry(entry);
    if (!projected.ok) return Object.freeze({ ok: false as const, reason: projected.reason, message: projected.message });
    if (!("meshes" in projected.value)) {
      return Object.freeze({ ok: false as const, reason: DESKTOP_SCENE_NOT_COMPOSABLE, message: `Model asset "${entry.assetId}" produced no geometry projection.` });
    }
    importedAssets.push(Object.freeze({
      instanceId: entry.instanceId,
      digest: entry.digest,
      meshes: projected.value.meshes,
    }));
  }
  return Object.freeze({
    ok: true as const,
    composed,
    mountable: importedAssets.length === 0
      ? mountable
      : Object.freeze({ ...mountable, importedAssets: Object.freeze(importedAssets) }),
  });
}

/**
 * Placements of the desktop open scene, hierarchical per ADR 0014. Three instances
 * of one artifact — multi-object is the point; a one-instance scene is a sculpt.
 */
export const DESKTOP_OPEN_PLACEMENTS = Object.freeze([
  Object.freeze({
    instanceId: "desktop-crate-root",
    parentInstanceId: null,
    translation: Object.freeze([0, 0, 0] as const),
    label: "Root instance",
  }),
  Object.freeze({
    instanceId: "desktop-crate-beside",
    parentInstanceId: "desktop-crate-root",
    translation: Object.freeze([-4.4, 0, 0] as const),
    label: "Placed beside the root",
  }),
  Object.freeze({
    instanceId: "desktop-crate-stacked",
    parentInstanceId: "desktop-crate-root",
    translation: Object.freeze([0, 2.3, 0] as const),
    label: "Stacked on the root",
  }),
] as const);

/** The bounded Scene Document property shipped by the first desktop edit vertical. */
export const DESKTOP_SCENE_TRANSLATION_X_PROPERTY = Object.freeze({
  id: "translation-x" as const,
  label: "Translation X",
  entityId: DESKTOP_OPEN_PLACEMENTS[1].instanceId,
  entityLabel: DESKTOP_OPEN_PLACEMENTS[1].instanceId,
  jsonPointer: "/data/composedScene" as const,
  step: 0.1,
});

function placementTransform(translation: Vector3): SculptTransform {
  const placed: Vector3 = [translation[0], translation[1], translation[2]];
  return Object.freeze({ ...identitySculptTransform(), translation: Object.freeze(placed) });
}

function artifactIdOf(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  const descriptor = Object.getOwnPropertyDescriptor(value, "artifactId");
  return descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "string"
    ? descriptor.value
    : "";
}

/**
 * Rebuild the intake for an already-validated composition and run it back through
 * the pipeline, one placement transform at a time.
 *
 * `transformFor` returns `unknown` on purpose: an edited transform carries a
 * caller-supplied value, and `composeScene()` — not this module — owns the
 * validation diagnostic that value must produce.
 */
type DesktopStoredPlacement = Readonly<{
  instanceId: string;
  artifactId: string;
  parentInstanceId: string | null;
  transform: unknown;
}>;

function composeStoredPlacements(
  stored: ComposedScene,
  placements: readonly DesktopStoredPlacement[],
  extraArtifacts: readonly SculptArtifact[] = [],
) {
  const intake = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: stored.sceneId,
    rootInstanceId: stored.rootInstanceId,
    placements,
  };
  const placedArtifactIds = new Set(placements.map((placement) => placement.artifactId));
  const artifacts = new Map<string, SculptArtifact>();
  for (const instance of stored.instances) {
    if (!placedArtifactIds.has(instance.artifactId)) continue;
    artifacts.set(instance.artifactId, instance.artifact);
  }
  for (const artifact of extraArtifacts) {
    const artifactId = artifactIdOf(artifact);
    if (placedArtifactIds.has(artifactId)) artifacts.set(artifactId, artifact);
  }
  const composed = composeScene(intake, [...artifacts.values()]);
  if (!composed.ok) return composed;
  // The composition evidence binds intake order. Persist the same depth/id
  // traversal the accepted scene exposes so save/reopen recomputes identical
  // canonical bytes even when reparenting changes depths.
  return composeScene(
    {
      ...intake,
      placements: composed.scene.instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactId: instance.artifactId,
        parentInstanceId: instance.parentInstanceId,
        transform: instance.localTransform,
      })),
    },
    [...artifacts.values()],
  );
}

function recomposeStoredScene(
  stored: ComposedScene,
  transformFor: (instance: ComposedSceneInstance) => unknown,
) {
  return composeStoredPlacements(
    stored,
    stored.instances.map((instance) => ({
      instanceId: instance.instanceId,
      artifactId: instance.artifactId,
      parentInstanceId: instance.parentInstanceId,
      transform: transformFor(instance),
    })),
  );
}

/**
 * Compose the desktop open scene from the committed starter artifact.
 *
 * Deterministic for the fixed starter seed, so the packaged app always opens the
 * same scene and the golden test can pin its digest.
 */
export function desktopOpenScene(): DesktopSceneResult {
  const artifact = webEditorStarterArtifact();
  if (!artifact.ok) {
    return Object.freeze({
      ok: false as const,
      reason: artifact.reason,
      message: artifact.message,
    });
  }

  const artifactId = artifactIdOf(artifact.value);
  const intake: SceneCompositionIntake = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: DESKTOP_OPEN_SCENE_ID,
    rootInstanceId: DESKTOP_OPEN_PLACEMENTS[0].instanceId,
    placements: DESKTOP_OPEN_PLACEMENTS.map((placement) => ({
      instanceId: placement.instanceId,
      artifactId,
      parentInstanceId: placement.parentInstanceId,
      transform: placementTransform(placement.translation),
    })),
  };

  const composed = composeScene(intake, [artifact.value]);
  if (!composed.ok) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_NOT_COMPOSABLE,
      message: "The scene composition pipeline rejected the desktop open scene.",
    });
  }

  return withImportedAssets({}, composed, mountableScene(composed));
}

export function desktopSceneFromDocumentData(data: unknown): DesktopSceneResult {
  if (!isJsonObject(data)) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_NOT_COMPOSABLE,
      message: "The active Scene Document data is not a JSON object.",
    });
  }
  const stored = composedSceneFromDocumentData(data);
  if (!stored.ok) {
    const diagnostic = stored.diagnostics[0];
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_NOT_COMPOSABLE,
      message: diagnostic?.message ?? "The active Scene Document has no valid composition.",
    });
  }

  const composed = recomposeStoredScene(
    stored.value,
    (instance) => instance.localTransform,
  );
  if (!composed.ok || composed.sceneDigest !== stored.value.evidence.sceneDigest) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_NOT_COMPOSABLE,
      message: "The active Scene Document composition could not be reproduced.",
    });
  }
  return withImportedAssets(data, composed, mountableScene(composed));
}

type DesktopEditableCompositionRead =
  | Readonly<{
      ok: true;
      stored: ComposedScene;
      manifestInstanceIds: ReadonlySet<string>;
    }>
  | Readonly<{ ok: false; diagnostics: readonly ApplyDiagnostic[] }>;

/**
 * The one validated read behind inspection and staged edits: a content hash
 * plus the digest-bound composition and its selectable instances. Every
 * document-level refusal is minted here, so the public seams cannot drift on
 * which document they accept.
 */
function readEditableComposition(
  documentData: unknown,
  contentHash: string,
  documentPath: string,
): DesktopEditableCompositionRead {
  if (!/^sha256:[0-9a-f]{64}$/.test(contentHash)) {
    return propertyRequestDiagnostic(
      "The open Scene Document is missing its validated content hash.",
      documentPath,
    );
  }
  if (!isJsonObject(documentData)) {
    return propertyDiagnostic(
      "The active Scene Document data is not a JSON object.",
      documentPath,
    );
  }
  const stored = composedSceneFromDocumentData(documentData);
  if (!stored.ok) {
    const diagnostic = stored.diagnostics[0];
    return propertyDiagnostic(
      `${diagnostic?.path ?? `$.${COMPOSED_SCENE_DOCUMENT_DATA_KEY}`}: ${diagnostic?.message ?? "The active Scene Document has no valid composition."}`,
      documentPath,
    );
  }
  const manifest = consistentProjectAssetManifest(documentData, stored.value);
  if (!manifest.ok) {
    return hierarchyDiagnostic(manifest.reason, manifest.message, documentPath);
  }
  return Object.freeze({
    ok: true as const,
    stored: stored.value,
    manifestInstanceIds: manifest.instanceIds,
  });
}

function editableEntityOf(
  stored: ComposedScene,
  instance: ComposedSceneInstance,
): DesktopSceneEditableEntity {
  return Object.freeze({
    id: instance.instanceId,
    label: `Object ${instance.artifactId} · Instance ${instance.instanceId}`,
    artifactId: instance.artifactId,
    parentInstanceId: instance.parentInstanceId,
    depth: instance.depth,
    localTransform: instance.localTransform,
    worldTransform: instance.worldTransform,
    canRemove:
      instance.instanceId !== stored.rootInstanceId &&
      stored.instances.length > SCENE_MINIMUM_INSTANCES &&
      !stored.instances.some((candidate) => candidate.parentInstanceId === instance.instanceId),
    properties: Object.freeze(
      DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS.map((definition) =>
        Object.freeze({
          id: definition.id,
          label: definition.label,
          value: instance.localTransform[definition.field][definition.axis],
          step: definition.step,
          min: definition.min,
          max: definition.max,
        }),
      ),
    ),
  });
}

export function desktopSceneHierarchySnapshot(
  stored: ComposedScene,
): DesktopSceneHierarchySnapshot {
  return Object.freeze({
    schemaVersion: DESKTOP_SCENE_HIERARCHY_SCHEMA_VERSION,
    kind: DESKTOP_SCENE_HIERARCHY_KIND,
    sceneId: stored.sceneId,
    rootInstanceId: stored.rootInstanceId,
    objects: Object.freeze(stored.instances.map((instance) => Object.freeze({
      id: instance.instanceId,
      artifactId: instance.artifactId,
      parentId: instance.parentInstanceId,
      depth: instance.depth,
      localTransform: instance.localTransform,
      worldTransform: instance.worldTransform,
    }))),
  });
}

/**
 * The inspection shape both the read path and the staged-edit path answer with.
 *
 * A staged proposal has no document on disk to re-read, so the host reports all
 * instances from the recomposed result rather than leaving the surface to derive
 * values of its own. That prevents a second, unvalidated authoring answer.
 */
export function desktopScenePropertyInspection(
  contentHash: string,
  stored: ComposedScene,
  requestedSelection?: unknown,
): DesktopScenePropertyInspection {
  const hierarchy = desktopSceneHierarchySnapshot(stored);
  const defaultSelection = stored.instances.find(
    (instance) => instance.instanceId !== stored.rootInstanceId,
  )?.instanceId ?? stored.rootInstanceId;
  const selected = resolveDesktopSceneSelection(
    requestedSelection ?? [defaultSelection],
    hierarchy.objects.map((object) => object.id),
  );
  if (!selected.ok) {
    return Object.freeze({
      ...hierarchyDiagnostic(
        selected.reason,
        selected.message,
        DESKTOP_ACTIVE_DOCUMENT_PATH,
      ),
      contentHash,
      entities: Object.freeze(
        stored.instances.map((instance) => editableEntityOf(stored, instance)),
      ),
      hierarchy,
    });
  }
  return Object.freeze({
    ok: true as const,
    contentHash,
    entities: Object.freeze(
      stored.instances.map((instance) => editableEntityOf(stored, instance)),
    ),
    hierarchy,
    selection: selected.selection,
  });
}

/**
 * Inspect the hierarchy and primary-selection transform surface this vertical
 * supports.
 *
 * Values come from the validated, digest-bound composition rather than the
 * legacy sample fields beside it. Play therefore mounts the values shown after
 * an accepted Save.
 */
export function inspectDesktopSceneProperties(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  selection?: unknown;
}>): DesktopScenePropertyInspection {
  const read = readEditableComposition(
    input.documentData,
    input.contentHash,
    input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH,
  );
  if (!read.ok) return read;
  return desktopScenePropertyInspection(
    input.contentHash,
    read.stored,
    input.selection,
  );
}

function nextCopyInstanceId(stored: ComposedScene, sourceInstanceId: string) {
  const used = new Set(stored.instances.map((instance) => instance.instanceId));
  for (let sequence = 1; sequence <= stored.instances.length + 1; sequence += 1) {
    const candidate = `${sourceInstanceId}-copy-${String(sequence)}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Stage one canonical hierarchy operation as an ordinary E1 edit.
 *
 * Create copies only an already-validated local artifact under an explicit
 * parent. Ordered removal protects the root, refuses orphaned children, and
 * preserves the composition minimum. Reparenting requires an explicit transform
 * policy. The legacy add/remove forms remain for compatible callers.
 */
export function stageDesktopSceneEdit(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  profile: unknown;
  operation: unknown;
}>): DesktopSceneEditStageResult {
  const documentPath = input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH;
  if (!isDesktopSceneEditProfile(input.profile)) {
    return propertyRequestDiagnostic(
      "Selected-instance editing is supported only by the Game and Web desktop profiles.",
      documentPath,
    );
  }
  if (
    typeof input.operation === "object" && input.operation !== null &&
    Object.getOwnPropertyDescriptor(input.operation, "kind")?.value === "reparent-object" &&
    !isDesktopSceneReparentPolicy(
      Object.getOwnPropertyDescriptor(input.operation, "transformPolicy")?.value,
    )
  ) {
    return hierarchyDiagnostic(
      DESKTOP_SCENE_HIERARCHY_REFUSALS.policyInvalid,
      "Reparenting requires transformPolicy preserve-world or preserve-local.",
      documentPath,
    );
  }
  if (!isDesktopSceneEditOperation(input.operation)) {
    return propertyRequestDiagnostic(
      "The selected-instance edit operation is malformed or outside its numeric range.",
      documentPath,
    );
  }
  const operation = Object.freeze({ ...input.operation }) as DesktopSceneEditOperation;
  const read = readEditableComposition(input.documentData, input.contentHash, documentPath);
  if (!read.ok) return read;
  const manifestInstanceIds = read.manifestInstanceIds;
  let selectedInstanceId: string;
  let selectedInstanceIds: readonly string[];
  let composed;

  if (operation.kind === "set-transform-component") {
    const selected = read.stored.instances.find(
      (instance) => instance.instanceId === operation.instanceId,
    );
    const definition = desktopSceneTransformProperty(operation.propertyId);
    if (selected === undefined) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
        `The selected instance is stale: ${operation.instanceId}.`,
        documentPath,
      );
    }
    if (definition === null) {
      return propertyRequestDiagnostic(
        `The selected transform property is unsupported: ${operation.instanceId}.${operation.propertyId}.`,
        documentPath,
      );
    }
    composed = recomposeStoredScene(read.stored, (instance) => {
      if (instance.instanceId !== operation.instanceId) return instance.localTransform;
      const vector = [...instance.localTransform[definition.field]] as [number, number, number];
      vector[definition.axis] = operation.value;
      return {
        ...instance.localTransform,
        [definition.field]: Object.freeze(vector),
      };
    });
    selectedInstanceId = selected.instanceId;
    selectedInstanceIds = Object.freeze([selected.instanceId]);
  } else if (operation.kind === "apply-transform") {
    const byId = new Map(operation.components.map((component) => {
      const current = operation.components.filter(
        (candidate) => candidate.instanceId === component.instanceId &&
          candidate.propertyId === component.propertyId,
      );
      return [`${component.instanceId}:${component.propertyId}`, current[current.length - 1]];
    }));
    const values = new Map<string, Map<string, number>>();
    for (const component of byId.values()) {
      if (component === undefined) continue;
      const selected = read.stored.instances.find(
        (instance) => instance.instanceId === component.instanceId,
      );
      if (selected === undefined) {
        return hierarchyDiagnostic(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
          `The selected instance is stale: ${component.instanceId}.`,
          documentPath,
        );
      }
      const definition = desktopSceneTransformProperty(component.propertyId);
      if (definition === null) {
        return propertyRequestDiagnostic(
          `The selected transform property is unsupported: ${component.instanceId}.${component.propertyId}.`,
          documentPath,
        );
      }
      const instanceValues = values.get(component.instanceId) ?? new Map<string, number>();
      instanceValues.set(component.propertyId, component.value);
      values.set(component.instanceId, instanceValues);
    }
    composed = recomposeStoredScene(read.stored, (instance) => {
      const instanceValues = values.get(instance.instanceId);
      if (instanceValues === undefined) return instance.localTransform;
      const next = {
        translation: [...instance.localTransform.translation] as [number, number, number],
        rotationEulerDegrees: [...instance.localTransform.rotationEulerDegrees] as [number, number, number],
        scale: [...instance.localTransform.scale] as [number, number, number],
      };
      for (const definition of DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS) {
        const value = instanceValues.get(definition.id);
        if (value === undefined) continue;
        next[definition.field][definition.axis] = value;
      }
      return Object.freeze({
        translation: Object.freeze(next.translation),
        rotationEulerDegrees: Object.freeze(next.rotationEulerDegrees),
        scale: Object.freeze(next.scale),
      });
    });
    selectedInstanceIds = Object.freeze([...operation.instanceIds]);
    selectedInstanceId = selectedInstanceIds[0] ?? operation.components[0]?.instanceId ?? "";
  } else if (operation.kind === "add-instance") {
    const source = read.stored.instances.find(
      (instance) => instance.instanceId === operation.sourceInstanceId,
    );
    if (source === undefined) {
      return propertyRequestDiagnostic(
        `The selected local artifact source is missing: ${operation.sourceInstanceId}.`,
        documentPath,
      );
    }
    if (manifestInstanceIds.has(source.instanceId)) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        `Imported asset instance ${source.instanceId} remains owned by its asset manifest.`,
        documentPath,
      );
    }
    if (read.stored.instances.length >= SCENE_MAXIMUM_INSTANCES) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        `Object creation cannot exceed the v1 maximum of ${String(SCENE_MAXIMUM_INSTANCES)} instances.`,
        documentPath,
      );
    }
    const addedInstanceId = nextCopyInstanceId(read.stored, source.instanceId);
    if (addedInstanceId === null) {
      return propertyRequestDiagnostic(
        "No canonical instance identifier is available for the selected local artifact.",
        documentPath,
      );
    }
    const placements = [
      ...read.stored.instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactId: instance.artifactId,
        parentInstanceId: instance.parentInstanceId,
        transform: instance.localTransform,
        depth: instance.depth,
      })),
      {
        instanceId: addedInstanceId,
        artifactId: source.artifactId,
        parentInstanceId: read.stored.rootInstanceId,
        transform: identitySculptTransform(),
        depth: 1,
      },
    ].sort(
      (left, right) =>
        left.depth - right.depth ||
        (left.instanceId < right.instanceId
          ? -1
          : left.instanceId > right.instanceId
            ? 1
            : 0),
    );
    composed = composeStoredPlacements(
      read.stored,
      placements.map((placement) => ({
        instanceId: placement.instanceId,
        artifactId: placement.artifactId,
        parentInstanceId: placement.parentInstanceId,
        transform: placement.transform,
      })),
    );
    selectedInstanceId = addedInstanceId;
    selectedInstanceIds = Object.freeze([addedInstanceId]);
  } else if (operation.kind === "remove-instance") {
    const selected = read.stored.instances.find(
      (instance) => instance.instanceId === operation.instanceId,
    );
    if (selected === undefined) {
      const stale = desktopScenePropertyInspection(
        input.contentHash,
        read.stored,
        [operation.instanceId],
      );
      return stale.ok
        ? hierarchyDiagnostic(
            DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
            `The selected instance is stale: ${operation.instanceId}.`,
            documentPath,
          )
        : stale;
    }
    if (manifestInstanceIds.has(selected.instanceId)) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        `Imported asset instance ${selected.instanceId} remains owned by its asset manifest.`,
        documentPath,
      );
    }
    if (selected.instanceId === read.stored.rootInstanceId) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.protectedRoot,
        "The project hierarchy root is protected and cannot be removed.",
        documentPath,
      );
    }
    if (
      read.stored.instances.length <= SCENE_MINIMUM_INSTANCES ||
      read.stored.instances.some(
        (instance) => instance.parentInstanceId === selected.instanceId,
      )
    ) {
      return propertyRequestDiagnostic(
        "Remove supports only a non-root leaf while at least two composed instances remain.",
        documentPath,
      );
    }
    composed = composeStoredPlacements(
      read.stored,
      read.stored.instances
        .filter((instance) => instance.instanceId !== selected.instanceId)
        .map((instance) => ({
          instanceId: instance.instanceId,
          artifactId: instance.artifactId,
          parentInstanceId: instance.parentInstanceId,
          transform: instance.localTransform,
        })),
    );
    selectedInstanceId = selected.parentInstanceId ?? read.stored.rootInstanceId;
    selectedInstanceIds = Object.freeze([selectedInstanceId]);
  } else if (operation.kind === "create-object") {
    const source = read.stored.instances.find(
      (instance) => instance.instanceId === operation.sourceInstanceId,
    );
    if (source === undefined) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
        `The selected local artifact source is stale: ${operation.sourceInstanceId}.`,
        documentPath,
      );
    }
    if (manifestInstanceIds.has(source.instanceId)) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        `Imported asset instance ${source.instanceId} remains owned by its asset manifest.`,
        documentPath,
      );
    }
    const parent = read.stored.instances.find(
      (instance) => instance.instanceId === operation.parentInstanceId,
    );
    if (parent === undefined) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.parentMissing,
        `The requested parent is missing: ${operation.parentInstanceId}.`,
        documentPath,
      );
    }
    if (read.stored.instances.length >= SCENE_MAXIMUM_INSTANCES) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        `Object creation cannot exceed the v1 maximum of ${String(SCENE_MAXIMUM_INSTANCES)} instances.`,
        documentPath,
      );
    }
    const addedInstanceId = nextCopyInstanceId(read.stored, source.instanceId);
    if (addedInstanceId === null) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        "No canonical object identifier is available for the selected local artifact.",
        documentPath,
      );
    }
    composed = composeStoredPlacements(read.stored, [
      ...read.stored.instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactId: instance.artifactId,
        parentInstanceId: instance.parentInstanceId,
        transform: instance.localTransform,
      })),
      {
        instanceId: addedInstanceId,
        artifactId: source.artifactId,
        parentInstanceId: parent.instanceId,
        transform: identitySculptTransform(),
      },
    ]);
    selectedInstanceId = addedInstanceId;
    selectedInstanceIds = Object.freeze([addedInstanceId]);
  } else if (operation.kind === "remove-objects") {
    const selection = resolveDesktopSceneSelection(
      operation.instanceIds,
      read.stored.instances.map((instance) => instance.instanceId),
    );
    if (!selection.ok) {
      return hierarchyDiagnostic(selection.reason, selection.message, documentPath);
    }
    const removed = new Set(selection.selection.instanceIds);
    const imported = selection.selection.instanceIds.find((instanceId) =>
      manifestInstanceIds.has(instanceId)
    );
    if (imported !== undefined) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        `Imported asset instance ${imported} remains owned by its asset manifest.`,
        documentPath,
      );
    }
    if (removed.has(read.stored.rootInstanceId)) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.protectedRoot,
        "The project hierarchy root is protected and cannot be removed.",
        documentPath,
      );
    }
    if (read.stored.instances.length - removed.size < SCENE_MINIMUM_INSTANCES) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        "Object removal must leave at least two composed instances.",
        documentPath,
      );
    }
    const orphan = read.stored.instances.find(
      (instance) => instance.parentInstanceId !== null &&
        removed.has(instance.parentInstanceId) && !removed.has(instance.instanceId),
    );
    if (orphan !== undefined) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        `Removing the selection would orphan ${orphan.instanceId}; select its descendants too.`,
        documentPath,
      );
    }
    composed = composeStoredPlacements(
      read.stored,
      read.stored.instances.filter((instance) => !removed.has(instance.instanceId)).map(
        (instance) => ({
          instanceId: instance.instanceId,
          artifactId: instance.artifactId,
          parentInstanceId: instance.parentInstanceId,
          transform: instance.localTransform,
        }),
      ),
    );
    selectedInstanceId = read.stored.rootInstanceId;
    selectedInstanceIds = Object.freeze([selectedInstanceId]);
  } else {
    const child = read.stored.instances.find(
      (instance) => instance.instanceId === operation.instanceId,
    );
    if (child === undefined) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
        `The selected child is stale: ${operation.instanceId}.`,
        documentPath,
      );
    }
    if (child.instanceId === read.stored.rootInstanceId) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.protectedRoot,
        "The project hierarchy root is protected and cannot be reparented.",
        documentPath,
      );
    }
    const parent = read.stored.instances.find(
      (instance) => instance.instanceId === operation.parentInstanceId,
    );
    if (parent === undefined) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.parentMissing,
        `The requested parent is missing: ${operation.parentInstanceId}.`,
        documentPath,
      );
    }
    let ancestor: ComposedSceneInstance | undefined = parent;
    while (ancestor !== undefined) {
      if (ancestor.instanceId === child.instanceId) {
        return hierarchyDiagnostic(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.cycle,
          `Reparenting ${child.instanceId} below ${parent.instanceId} would create a cycle.`,
          documentPath,
        );
      }
      ancestor = ancestor.parentInstanceId === null
        ? undefined
        : read.stored.instances.find(
            (instance) => instance.instanceId === ancestor?.parentInstanceId,
          );
    }
    const derived = operation.transformPolicy === "preserve-world"
      ? deriveCanonicalLocalSculptTransform(parent.worldTransform, child.worldTransform)
      : null;
    if (derived !== null && !derived.ok) {
      return hierarchyDiagnostic(
        DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
        derived.message,
        documentPath,
      );
    }
    const localTransform = derived?.ok === true ? derived.value : child.localTransform;
    composed = composeStoredPlacements(
      read.stored,
      read.stored.instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactId: instance.artifactId,
        parentInstanceId: instance.instanceId === child.instanceId
          ? parent.instanceId
          : instance.parentInstanceId,
        transform: instance.instanceId === child.instanceId
          ? localTransform
          : instance.localTransform,
      })),
    );
    selectedInstanceId = child.instanceId;
    selectedInstanceIds = Object.freeze([child.instanceId]);
  }

  if (!composed.ok) {
    return operation.kind === "reparent-object" ||
      operation.kind === "create-object" ||
      operation.kind === "add-instance"
      ? hierarchyDiagnostic(
          DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
          `${composed.path}: ${composed.message}`,
          documentPath,
        )
      : propertyDiagnostic(`${composed.path}: ${composed.message}`, documentPath);
  }
  const editedDocumentData = isJsonObject(input.documentData) &&
      Object.hasOwn(input.documentData, PROJECT_ASSET_MANIFEST_KEY)
    ? Object.freeze({
        ...composed.document.data,
        [PROJECT_ASSET_MANIFEST_KEY]: input.documentData[PROJECT_ASSET_MANIFEST_KEY],
      })
    : composed.document.data;
  const edited = readEditableComposition(editedDocumentData, input.contentHash, documentPath);
  if (!edited.ok) return edited;
  if (operation.kind === "add-instance" || operation.kind === "create-object") {
    const sourceArtifact = read.stored.instances.find(
      (instance) => instance.instanceId === operation.sourceInstanceId,
    )?.artifact;
    const addedArtifact = edited.stored.instances.find(
      (instance) => instance.instanceId === selectedInstanceId,
    )?.artifact;
    if (
      sourceArtifact === undefined ||
      addedArtifact === undefined ||
      digestSceneArtifact(sourceArtifact) !== digestSceneArtifact(addedArtifact)
    ) {
      return propertyDiagnostic(
        "The add operation did not preserve the validated local artifact bytes.",
        documentPath,
      );
    }
  }
  const inspection = desktopScenePropertyInspection(
    input.contentHash,
    edited.stored,
    selectedInstanceIds,
  );
  return Object.freeze({
    ok: true as const,
    operation,
    edit: Object.freeze({
      documentPath,
      jsonPointer: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.jsonPointer,
      expectedContentHash: input.contentHash,
      newValue: composed.scene,
    }),
    inspection,
    selectedInstanceId,
    selectedInstanceIds,
    sceneDigest: composed.sceneDigest,
  });
}

export type DesktopScenePrefabStageResult =
  | Readonly<{
      ok: true;
      catalog: ScenePrefabCatalog;
      inspection: ReturnType<typeof inspectScenePrefab>;
      documentData: Record<string, unknown>;
    }>
  | Readonly<{ ok: false; reason: string; message: string }>;

function prefabSources(stored: ComposedScene) {
  return stored.instances.map((instance) => Object.freeze({
    instanceId: instance.instanceId,
    artifactId: instance.artifactId,
    parentInstanceId: instance.parentInstanceId,
    localTransform: instance.localTransform,
  }));
}

function catalogFromData(documentData: unknown): ScenePrefabCatalog | null {
  if (!isJsonObject(documentData)) return null;
  return parseScenePrefabCatalog(documentData[SCENE_PREFAB_CATALOG_KEY]);
}

function mergePrefabDocument(
  documentData: unknown,
  stored: ComposedScene,
  catalog: ScenePrefabCatalog,
  placements?: readonly Readonly<{
    instanceId: string;
    artifactId: string;
    parentInstanceId: string | null;
    localTransform: SculptTransform;
  }>[],
): DesktopScenePrefabStageResult {
  const nextPlacements = placements === undefined
    ? stored.instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactId: instance.artifactId,
        parentInstanceId: instance.parentInstanceId,
        transform: instance.localTransform,
      }))
    : [
        ...stored.instances
          .filter((instance) => !placements.some((placement) => placement.instanceId === instance.instanceId))
          .map((instance) => ({
            instanceId: instance.instanceId,
            artifactId: instance.artifactId,
            parentInstanceId: instance.parentInstanceId,
            transform: instance.localTransform,
          })),
        ...placements.map((placement) => ({
          instanceId: placement.instanceId,
          artifactId: placement.artifactId,
          parentInstanceId: placement.parentInstanceId,
          transform: placement.localTransform,
        })),
      ];
  const composed = composeStoredPlacements(stored, nextPlacements);
  if (!composed.ok) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_PREFAB_REFUSALS.inputUnsupported,
      message: `${composed.path}: ${composed.message}`,
    });
  }
  const base = isJsonObject(documentData) ? documentData : {};
  const nextData = Object.freeze({
    ...base,
    [COMPOSED_SCENE_DOCUMENT_DATA_KEY]: composed.scene,
    [SCENE_PREFAB_CATALOG_KEY]: catalog,
  });
  return Object.freeze({
    ok: true as const,
    catalog,
    inspection: inspectScenePrefab(catalog),
    documentData: nextData,
  });
}

export function inspectDesktopScenePrefabs(documentData: unknown) {
  const catalog = catalogFromData(documentData) ?? emptyScenePrefabCatalog();
  return inspectScenePrefab(catalog);
}

export function stageDesktopScenePrefab(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  operation:
    | Readonly<{ kind: "define"; definitionId: string; instanceIds: readonly string[] }>
    | Readonly<{ kind: "instance"; definitionId: string; parentInstanceId: string; instanceKey: string }>
    | Readonly<{
        kind: "override";
        instanceId: string;
        sourceInstanceId: string;
        propertyId: string;
        value: number;
      }>
    | Readonly<{ kind: "refresh"; definitionId: string }>;
}>): DesktopScenePrefabStageResult {
  const documentPath = input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH;
  const read = readEditableComposition(input.documentData, input.contentHash, documentPath);
  if (!read.ok) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_PREFAB_REFUSALS.catalogInvalid,
      message: read.diagnostics[0]?.message ?? "The Scene Document could not be read.",
    });
  }
  const catalog = catalogFromData(input.documentData);
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_PREFAB_REFUSALS.catalogInvalid,
      message: "The reusable-content catalog is not a valid versioned document.",
    });
  }
  const sources = prefabSources(read.stored);
  if (input.operation.kind === "define") {
    const defined = defineScenePrefab({
      catalog,
      sources,
      selectedIds: input.operation.instanceIds,
      definitionId: input.operation.definitionId,
    });
    if (!defined.ok) return defined;
    return mergePrefabDocument(input.documentData, read.stored, defined.catalog);
  }
  if (input.operation.kind === "instance") {
    const instanced = instanceScenePrefab({
      catalog,
      occupiedInstanceIds: read.stored.instances.map((instance) => instance.instanceId),
      definitionId: input.operation.definitionId,
      parentInstanceId: input.operation.parentInstanceId,
      instanceKey: input.operation.instanceKey,
    });
    if (!instanced.ok) return instanced;
    return mergePrefabDocument(input.documentData, read.stored, instanced.catalog, instanced.placements);
  }
  if (input.operation.kind === "override") {
    const operation = input.operation;
    const overridden = overrideScenePrefab({
      catalog,
      instanceId: operation.instanceId,
      sourceInstanceId: operation.sourceInstanceId,
      propertyId: operation.propertyId,
      value: operation.value,
    });
    if (!overridden.ok) return overridden;
    const parent = read.stored.instances.find(
      (instance) => instance.instanceId === operation.instanceId,
    )?.parentInstanceId;
    const resolved = inspectScenePrefab(
      overridden.catalog,
      typeof parent === "string" ? { [operation.instanceId]: parent } : {},
    ).resolved[0];
    return mergePrefabDocument(
      input.documentData,
      read.stored,
      overridden.catalog,
      resolved?.placements,
    );
  }
  const refreshed = refreshScenePrefab({
    catalog,
    sources,
    definitionId: input.operation.definitionId,
  });
  if (!refreshed.ok) return refreshed;
  return mergePrefabDocument(input.documentData, read.stored, refreshed.catalog);
}

export type DesktopSceneAnimationStageResult =
  | Readonly<{
      ok: true;
      catalog: SceneAnimationCatalog;
      inspection: ReturnType<typeof inspectSceneAnimation>;
      documentData: Record<string, unknown>;
    }>
  | Readonly<{ ok: false; reason: string; message: string }>;

function animationCatalogFromData(documentData: unknown): SceneAnimationCatalog | null {
  if (!isJsonObject(documentData)) return null;
  return parseSceneAnimationCatalog(documentData[SCENE_ANIMATION_CATALOG_KEY]);
}

export function inspectDesktopSceneAnimation(documentData: unknown) {
  return inspectSceneAnimation(animationCatalogFromData(documentData) ?? emptySceneAnimationCatalog());
}

export function evaluateDesktopSceneAnimation(input: Readonly<{
  documentData: unknown;
  sourceContentHash: string;
  timeMs: number;
  requireBoundAsset?: boolean;
}>) {
  const catalog = animationCatalogFromData(input.documentData);
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_ANIMATION_REFUSALS.catalogInvalid,
      message: "The animation catalog is not a valid versioned document.",
    });
  }
  return evaluateSceneAnimation({
    catalog,
    timeMs: input.timeMs,
    sourceContentHash: input.sourceContentHash,
    ...(input.requireBoundAsset === undefined ? {} : { requireBoundAsset: input.requireBoundAsset }),
  });
}

export function stageDesktopSceneAnimation(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  mutation: unknown;
}>): DesktopSceneAnimationStageResult {
  const documentPath = input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH;
  const read = readEditableComposition(input.documentData, input.contentHash, documentPath);
  if (!read.ok) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_ANIMATION_REFUSALS.staleVersion,
      message: read.diagnostics[0]?.message ?? "The Scene Document could not be read.",
    });
  }
  const catalog = animationCatalogFromData(input.documentData);
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_ANIMATION_REFUSALS.catalogInvalid,
      message: "The animation catalog is not a valid versioned document.",
    });
  }
  if (typeof input.mutation !== "object" || input.mutation === null || Array.isArray(input.mutation)) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_ANIMATION_REFUSALS.inputUnsupported,
      message: "An animation mutation must be an object.",
    });
  }
  const manifest = isJsonObject(input.documentData)
    ? projectAssetManifestFromDocumentData(input.documentData)
    : { ok: false as const };
  const animationAssetIds = manifest.ok
    ? manifest.value.assets.filter((asset) => asset.family === "animation").map((asset) => asset.assetId)
    : [];
  const applied = applySceneAnimationMutation({
    catalog,
    instanceIds: read.stored.instances.map((instance) => instance.instanceId),
    animationAssetIds,
    mutation: input.mutation as SceneAnimationMutation,
  });
  if (!applied.ok) return applied;
  const base = isJsonObject(input.documentData) ? input.documentData : {};
  return Object.freeze({
    ok: true as const,
    catalog: applied.catalog,
    inspection: inspectSceneAnimation(applied.catalog),
    documentData: Object.freeze({
      ...base,
      [SCENE_ANIMATION_CATALOG_KEY]: applied.catalog,
    }),
  });
}

function physicsCatalogFromData(documentData: unknown): ScenePhysicsCatalog | null {
  if (!isJsonObject(documentData)) return null;
  return parseScenePhysicsCatalog(documentData[SCENE_PHYSICS_CATALOG_KEY]);
}

export function inspectDesktopScenePhysics(documentData: unknown) {
  return inspectScenePhysics(physicsCatalogFromData(documentData) ?? emptyScenePhysicsCatalog());
}

export function evaluateDesktopScenePhysics(input: Readonly<{
  documentData: unknown;
  sourceContentHash: string;
  steps: number;
  animationOffsetY?: number;
}>) {
  const catalog = physicsCatalogFromData(input.documentData);
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_PHYSICS_REFUSALS.catalogInvalid,
      message: "The physics catalog is not a valid versioned document.",
    });
  }
  return evaluateScenePhysics({
    catalog,
    sourceContentHash: input.sourceContentHash,
    steps: input.steps,
    ...(input.animationOffsetY === undefined ? {} : { animationOffsetY: input.animationOffsetY }),
  });
}

export function stageDesktopScenePhysics(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  mutation: unknown;
}>) {
  const documentPath = input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH;
  const read = readEditableComposition(input.documentData, input.contentHash, documentPath);
  if (!read.ok) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_PHYSICS_REFUSALS.staleVersion,
      message: read.diagnostics[0]?.message ?? "The Scene Document could not be read.",
    });
  }
  const catalog = physicsCatalogFromData(input.documentData);
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_PHYSICS_REFUSALS.catalogInvalid,
      message: "The physics catalog is not a valid versioned document.",
    });
  }
  if (typeof input.mutation !== "object" || input.mutation === null || Array.isArray(input.mutation)) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_PHYSICS_REFUSALS.inputUnsupported,
      message: "A physics mutation must be an object.",
    });
  }
  const applied = applyScenePhysicsMutation({
    catalog,
    instanceIds: read.stored.instances.map((instance) => instance.instanceId),
    mutation: input.mutation as ScenePhysicsMutation,
  });
  if (!applied.ok) return applied;
  const base = isJsonObject(input.documentData) ? input.documentData : {};
  return Object.freeze({
    ok: true as const,
    catalog: applied.catalog,
    inspection: inspectScenePhysics(applied.catalog),
    documentData: Object.freeze({
      ...base,
      [SCENE_PHYSICS_CATALOG_KEY]: applied.catalog,
    }),
  });
}

function environmentCatalogFromData(documentData: unknown): SceneEnvironmentCatalog | null {
  if (!isJsonObject(documentData)) return null;
  return parseSceneEnvironmentCatalog(documentData[SCENE_ENVIRONMENT_CATALOG_KEY]);
}

export function inspectDesktopSceneEnvironment(documentData: unknown) {
  return inspectSceneEnvironment(environmentCatalogFromData(documentData) ?? emptySceneEnvironmentCatalog());
}

export function stageDesktopSceneEnvironment(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  mutation: unknown;
}>) {
  const catalog = environmentCatalogFromData(input.documentData);
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_ENVIRONMENT_REFUSALS.catalogInvalid,
      message: "The environment catalog is not a valid versioned document.",
    });
  }
  if (typeof input.mutation !== "object" || input.mutation === null || Array.isArray(input.mutation)) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_ENVIRONMENT_REFUSALS.inputUnsupported,
      message: "An environment mutation must be an object.",
    });
  }
  const applied = applySceneEnvironmentMutation({
    catalog,
    mutation: input.mutation as SceneEnvironmentMutation,
  });
  if (!applied.ok) return applied;
  const base = isJsonObject(input.documentData) ? input.documentData : {};
  return Object.freeze({
    ok: true as const,
    catalog: applied.catalog,
    inspection: inspectSceneEnvironment(applied.catalog),
    documentData: Object.freeze({
      ...base,
      [SCENE_ENVIRONMENT_CATALOG_KEY]: applied.catalog,
    }),
  });
}

function materialsCatalogFromData(documentData: unknown): SceneMaterialsCatalog | null {
  if (!isJsonObject(documentData)) return null;
  return parseSceneMaterialsCatalog(documentData[SCENE_MATERIALS_CATALOG_KEY]);
}

export function inspectDesktopSceneMaterials(documentData: unknown) {
  return inspectSceneMaterials(materialsCatalogFromData(documentData) ?? emptySceneMaterialsCatalog());
}

export function stageDesktopSceneMaterials(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  mutation: unknown;
}>) {
  const documentPath = input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH;
  const read = readEditableComposition(input.documentData, input.contentHash, documentPath);
  if (!read.ok) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_MATERIALS_REFUSALS.catalogInvalid,
      message: read.diagnostics[0]?.message ?? "The Scene Document could not be read.",
    });
  }
  const catalog = materialsCatalogFromData(input.documentData);
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_MATERIALS_REFUSALS.catalogInvalid,
      message: "The materials catalog is not a valid versioned document.",
    });
  }
  if (typeof input.mutation !== "object" || input.mutation === null || Array.isArray(input.mutation)) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_MATERIALS_REFUSALS.inputUnsupported,
      message: "A material mutation must be an object.",
    });
  }
  const applied = applySceneMaterialsMutation({
    catalog,
    instanceIds: read.stored.instances.map((instance) => instance.instanceId),
    mutation: input.mutation as SceneMaterialsMutation,
  });
  if (!applied.ok) return applied;
  const base = isJsonObject(input.documentData) ? input.documentData : {};
  return Object.freeze({
    ok: true as const,
    catalog: applied.catalog,
    inspection: inspectSceneMaterials(applied.catalog),
    documentData: Object.freeze({
      ...base,
      [SCENE_MATERIALS_CATALOG_KEY]: applied.catalog,
    }),
  });
}

function effectsCatalogFromData(documentData: unknown): SceneEffectsCatalog | null {
  if (!isJsonObject(documentData)) return null;
  return parseSceneEffectsCatalog(documentData[SCENE_EFFECTS_CATALOG_KEY]);
}

export function inspectDesktopSceneEffects(documentData: unknown) {
  return inspectSceneEffects(effectsCatalogFromData(documentData) ?? emptySceneEffectsCatalog());
}

export function stageDesktopSceneEffects(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  mutation: unknown;
}>) {
  const catalog = effectsCatalogFromData(input.documentData);
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_EFFECTS_REFUSALS.catalogInvalid,
      message: "The effects catalog is not a valid versioned document.",
    });
  }
  if (typeof input.mutation !== "object" || input.mutation === null || Array.isArray(input.mutation)) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_EFFECTS_REFUSALS.inputUnsupported,
      message: "An effect mutation must be an object.",
    });
  }
  const applied = applySceneEffectsMutation({
    catalog,
    mutation: input.mutation as SceneEffectsMutation,
  });
  if (!applied.ok) return applied;
  const base = isJsonObject(input.documentData) ? input.documentData : {};
  return Object.freeze({
    ok: true as const,
    catalog: applied.catalog,
    inspection: inspectSceneEffects(applied.catalog),
    documentData: Object.freeze({
      ...base,
      [SCENE_EFFECTS_CATALOG_KEY]: applied.catalog,
    }),
  });
}

export function collectDesktopAssistantAskState(input: Readonly<{
  documentData: unknown;
  playActive: boolean;
}>) {
  const documentData = isJsonObject(input.documentData) ? input.documentData : {};
  const stored = composedSceneFromDocumentData(documentData);
  const animation = parseSceneAnimationCatalog(documentData[SCENE_ANIMATION_CATALOG_KEY]);
  const physics = parseScenePhysicsCatalog(documentData[SCENE_PHYSICS_CATALOG_KEY]);
  const assets = projectAssetManifestFromDocumentData(documentData);
  const assetIds = assets.ok
    ? assets.value.assets.map((entry) => entry.assetId)
    : [];
  return Object.freeze({
    instanceIds: Object.freeze(stored.ok ? stored.value.instances.map((instance) => instance.instanceId) : []),
    assetIds: Object.freeze(assetIds),
    clipIds: Object.freeze(animation?.clips.map((clip) => clip.clipId) ?? []),
    bodyIds: Object.freeze(physics?.bodies.map((body) => body.bodyId) ?? []),
    playActive: input.playActive,
  });
}

export function answerDesktopAssistantAsk(input: Readonly<{
  documentData: unknown;
  sourceContentHash: string;
  profile: unknown;
  prompt: string;
  scope: unknown;
  playActive: boolean;
}>) {
  return answerAssistantAsk({
    prompt: input.prompt,
    scope: input.scope,
    sourceContentHash: input.sourceContentHash,
    profile: input.profile,
    state: collectDesktopAssistantAskState({
      documentData: input.documentData,
      playActive: input.playActive,
    }),
  });
}

function nextAssistantInstanceId(stored: ComposedScene, artifactId: string) {
  const used = new Set(stored.instances.map((instance) => instance.instanceId));
  const base = `assistant-${artifactId.replace(/[^a-z0-9-]+/gi, "").slice(0, 24) || "build"}`;
  if (!used.has(base)) return base;
  for (let sequence = 2; sequence <= stored.instances.length + 2; sequence += 1) {
    const candidate = `${base}-${String(sequence)}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

export function stageDesktopAssistantBuild(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  entry: SceneAssistantBuildEntry;
  artifact?: SculptArtifact;
}>) {
  const documentPath = input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH;
  const read = readEditableComposition(input.documentData, input.contentHash, documentPath);
  if (!read.ok) {
    return Object.freeze({
      ok: false as const,
      reason: ASSISTANT_ASK_REFUSALS.staleVersion,
      message: read.diagnostics[0]?.message ?? "The Scene Document could not be read.",
    });
  }
  const catalog = parseSceneAssistantBuildCatalog(
    isJsonObject(input.documentData) ? input.documentData[SCENE_ASSISTANT_BUILD_CATALOG_KEY] : undefined,
  );
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: ASSISTANT_ASK_REFUSALS.inputUnsupported,
      message: "The assistant Build catalog is not a valid versioned document.",
    });
  }
  const next = applyAssistantBuildEntry({ catalog, entry: input.entry });
  const base = isJsonObject(input.documentData) ? input.documentData : {};
  if (input.artifact === undefined) {
    return Object.freeze({
      ok: true as const,
      catalog: next,
      documentData: Object.freeze({
        ...base,
        [SCENE_ASSISTANT_BUILD_CATALOG_KEY]: next,
      }),
    });
  }
  const artifactId = artifactIdOf(input.artifact);
  if (artifactId.length === 0) {
    return Object.freeze({
      ok: false as const,
      reason: ASSISTANT_ASK_REFUSALS.inputUnsupported,
      message: "The retained assistant Build artifact has no artifact identity.",
    });
  }
  const alreadyPlaced = read.stored.instances.some(
    (instance) => instance.artifactId === artifactId,
  );
  if (alreadyPlaced) {
    return Object.freeze({
      ok: true as const,
      catalog: next,
      documentData: Object.freeze({
        ...base,
        [SCENE_ASSISTANT_BUILD_CATALOG_KEY]: next,
      }),
    });
  }
  if (read.stored.instances.length >= SCENE_MAXIMUM_INSTANCES) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
      message: `Assistant apply cannot exceed the v1 maximum of ${String(SCENE_MAXIMUM_INSTANCES)} instances.`,
    });
  }
  const addedInstanceId = nextAssistantInstanceId(read.stored, artifactId);
  if (addedInstanceId === null) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
      message: "No canonical object identifier is available for the assistant Build artifact.",
    });
  }
  const composed = composeStoredPlacements(
    read.stored,
    [
      ...read.stored.instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactId: instance.artifactId,
        parentInstanceId: instance.parentInstanceId,
        transform: instance.localTransform,
      })),
      {
        instanceId: addedInstanceId,
        artifactId,
        parentInstanceId: read.stored.rootInstanceId,
        transform: placementTransform([6, 0, 0]),
      },
    ],
    [input.artifact],
  );
  if (!composed.ok) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_SCENE_NOT_COMPOSABLE,
      message: `${composed.path}: ${composed.message}`,
    });
  }
  return Object.freeze({
    ok: true as const,
    catalog: next,
    documentData: Object.freeze({
      ...base,
      ...composed.document.data,
      [SCENE_ASSISTANT_BUILD_CATALOG_KEY]: next,
    }),
  });
}

function packageCatalogFromData(documentData: unknown) {
  if (!isJsonObject(documentData)) return null;
  const value = documentData[SCENE_PACKAGE_CATALOG_KEY];
  if (value === undefined) return emptyScenePackageCatalog();
  if (value === null) return null;
  return parseScenePackageCatalog(value);
}


export function inspectDesktopScenePackages(documentData: unknown):
  | ReturnType<typeof inspectScenePackages>
  | Readonly<{ ok: false; reason: string; message: string }> {
  const catalog = packageCatalogFromData(documentData);
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_PACKAGE_REFUSALS.catalogInvalid,
      message: "The package catalog is not a valid versioned document.",
    });
  }
  return inspectScenePackages({ catalog });
}

export function stageDesktopScenePackage(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  profile: unknown;
  mutation: ScenePackageMutation;
}>) {
  const documentPath = input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH;
  const read = readEditableComposition(input.documentData, input.contentHash, documentPath);
  if (!read.ok) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_PACKAGE_REFUSALS.staleVersion,
      message: read.diagnostics[0]?.message ?? "The Scene Document could not be read.",
    });
  }
  const catalog = packageCatalogFromData(input.documentData);
  if (catalog === null) {
    return Object.freeze({
      ok: false as const,
      reason: SCENE_PACKAGE_REFUSALS.catalogInvalid,
      message: "The package catalog is not a valid versioned document.",
    });
  }
  const applied = applyScenePackageMutation({
    catalog,
    mutation: input.mutation,
    profile: input.profile,
  });
  if (!applied.ok) return applied;
  const base = isJsonObject(input.documentData) ? input.documentData : {};
  return Object.freeze({
    ok: true as const,
    catalog: applied.catalog,
    inspection: inspectScenePackages({ catalog: applied.catalog }),
    documentData: Object.freeze({
      ...base,
      [SCENE_PACKAGE_CATALOG_KEY]: applied.catalog,
    }),
  });
}

export function discoverDesktopScenePackage(input: Readonly<{
  locator: string;
  manifest: unknown;
  digest: string;
}>) {
  const capabilities = typeof input.manifest === "object" && input.manifest !== null && !Array.isArray(input.manifest)
    ? (input.manifest as { capabilities?: unknown }).capabilities
    : undefined;
  if (Array.isArray(capabilities)) {
    const undeclared = capabilities.find((capability): capability is string =>
      typeof capability === "string" && isDeclaredExtensionCapability(capability),
    );
    if (undeclared !== undefined) return refuseUndeclaredExtensionGrant(undeclared);
  }
  return discoverScenePackage({
    locator: input.locator,
    manifest: input.manifest,
    digest: input.digest,
    admittedCapabilities: SHIPPED_PLUGIN_CAPABILITY_IDS,
  });
}

/** Backward-compatible property facade over the canonical operation. */
export function stageDesktopScenePropertyEdit(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  entityId: unknown;
  propertyId: unknown;
  newValue: unknown;
}>): DesktopScenePropertyStageResult {
  const documentPath = input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH;
  if (typeof input.newValue !== "number" || !Number.isFinite(input.newValue)) {
    return propertyDiagnostic(
      "$.placements[1].transform: Placement transform is invalid.",
      documentPath,
    );
  }
  const staged = stageDesktopSceneEdit({
    documentData: input.documentData,
    contentHash: input.contentHash,
    documentPath,
    profile: "game" satisfies DesktopSceneEditProfile,
    operation: {
      kind: "set-transform-component",
      instanceId: input.entityId,
      propertyId: input.propertyId,
      value: input.newValue,
    },
  });
  if (!staged.ok) return staged;
  if (!staged.inspection.ok) return staged.inspection;
  const entity = staged.inspection.entities.find(
    (candidate) => candidate.id === staged.selectedInstanceId,
  );
  if (entity === undefined) {
    return propertyRequestDiagnostic("The edited instance is no longer selectable.", documentPath);
  }
  return Object.freeze({
    ok: true as const,
    edit: staged.edit,
    entity,
    inspection: staged.inspection,
    sceneDigest: staged.sceneDigest,
  });
}

/**
 * Project one assistant artifact into the shared `MountableScene` browser payload.
 *
 * Deliberately *not* through `composeScene()`: the composition contract calls a
 * one-instance scene a sculpt rather than a scene (`SCENE_MINIMUM_INSTANCES`), so
 * that pipeline refuses a single artifact by design. The artifact still crosses
 * exactly the boundary the renderer may mount from — the same payload shape the
 * composed open scene produces — carrying an identity world transform, because
 * placement here belongs to the viewport's manipulators and not to the pipeline.
 * The artifact is never rewritten, so its evidence still binds its own bytes, and
 * `sceneDigest` is that artifact's digest since it is the whole of what mounts.
 *
 * Total for a validated artifact: there is no composition left to refuse.
 */
export function desktopAssistantScene(artifact: SculptArtifact): MountableScene {
  return Object.freeze({
    sceneId: DESKTOP_ASSISTANT_SCENE_ID,
    rootInstanceId: DESKTOP_ASSISTANT_INSTANCE_ID,
    sceneDigest: digestSceneArtifact(artifact),
    artifacts: Object.freeze({ [artifact.artifactId]: artifact }),
    instances: Object.freeze([
      Object.freeze({
        instanceId: DESKTOP_ASSISTANT_INSTANCE_ID,
        artifactId: artifact.artifactId,
        parentInstanceId: null,
        depth: 0,
        label: "Assistant output",
        worldTransform: identitySculptTransform(),
      }),
    ]),
  });
}
