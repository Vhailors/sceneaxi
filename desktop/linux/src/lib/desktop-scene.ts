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
  DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  SCENE_MINIMUM_INSTANCES,
  composedSceneFromDocumentData,
  desktopSceneTransformProperty,
  digestSceneArtifact,
  identitySculptTransform,
  isDesktopSceneEditOperation,
  isDesktopSceneEditProfile,
  isJsonObject,
  type ComposedScene,
  type ComposedSceneInstance,
  type DesktopSceneEditOperation,
  type DesktopSceneEditProfile,
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
  projectAssetManifestEntry,
  projectAssetManifestFromDocumentData,
  type ImportedAssetRenderMesh,
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
  canRemove: boolean;
  properties: readonly DesktopSceneEditableProperty[];
}>;

export type DesktopScenePropertyInspection =
  | Readonly<{ ok: true; contentHash: string; entities: readonly DesktopSceneEditableEntity[] }>
  | Readonly<{ ok: false; diagnostics: readonly ApplyDiagnostic[] }>;

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
      sceneDigest: string;
    }>
  | Readonly<{ ok: false; diagnostics: readonly ApplyDiagnostic[] }>;

export type DesktopSceneEditStageResult =
  | Readonly<{
      ok: true;
      operation: DesktopSceneEditOperation;
      edit: DesktopScenePropertyProposalInput;
      inspection: DesktopScenePropertyInspection;
      selectedInstanceId: string;
      sceneDigest: string;
    }>
  | Readonly<{ ok: false; diagnostics: readonly ApplyDiagnostic[] }>;

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

function withImportedAssets(
  data: unknown,
  composed: ComposedSceneOk,
  mountable: MountableScene,
): DesktopSceneResult {
  const manifest = projectAssetManifestFromDocumentData(data);
  if (!manifest.ok) {
    return Object.freeze({ ok: false as const, reason: manifest.reason, message: manifest.message });
  }
  const importedAssets: DesktopImportedAsset[] = [];
  for (const entry of manifest.value.assets) {
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
  entityLabel: DESKTOP_OPEN_PLACEMENTS[1].label,
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

function desktopPlacementLabels(): ReadonlyMap<string, string> {
  return new Map(
    DESKTOP_OPEN_PLACEMENTS.map((placement) => [placement.instanceId, placement.label]),
  );
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
  return composeScene(intake, [...artifacts.values()]);
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

  return withImportedAssets({}, composed, mountableScene(composed, desktopPlacementLabels()));
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
  return withImportedAssets(data, composed, mountableScene(composed, desktopPlacementLabels()));
}

type DesktopEditableCompositionRead =
  | Readonly<{ ok: true; stored: ComposedScene }>
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
  return Object.freeze({ ok: true as const, stored: stored.value });
}

function editableEntityOf(
  stored: ComposedScene,
  instance: ComposedSceneInstance,
): DesktopSceneEditableEntity {
  const knownLabel = desktopPlacementLabels().get(instance.instanceId);
  return Object.freeze({
    id: instance.instanceId,
    label: knownLabel ?? `Local ${instance.artifactId}`,
    artifactId: instance.artifactId,
    parentInstanceId: instance.parentInstanceId,
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

/**
 * The inspection shape both the read path and the staged-edit path answer with.
 *
 * A staged proposal has no document on disk to re-read, so the host reports all
 * instances from the recomposed result rather than leaving the surface to derive
 * values of its own. That prevents a second, unvalidated authoring answer.
 */
export function desktopScenePropertyInspection(
  contentHash: string,
  entities: DesktopSceneEditableEntity | readonly DesktopSceneEditableEntity[],
): DesktopScenePropertyInspection {
  return Object.freeze({
    ok: true as const,
    contentHash,
    entities: Object.freeze(Array.isArray(entities) ? [...entities] : [entities]),
  });
}

/**
 * Inspect the selected-instance transform surface this vertical supports.
 *
 * Values come from the validated, digest-bound composition rather than the
 * legacy sample fields beside it. Play therefore mounts the values shown after
 * an accepted Save.
 */
export function inspectDesktopSceneProperties(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
}>): DesktopScenePropertyInspection {
  const read = readEditableComposition(
    input.documentData,
    input.contentHash,
    input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH,
  );
  if (!read.ok) return read;
  return desktopScenePropertyInspection(
    input.contentHash,
    read.stored.instances.map((instance) => editableEntityOf(read.stored, instance)),
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
 * Stage one canonical selected-instance operation as an ordinary E1 edit.
 *
 * Add copies only the selected instance's already-validated local artifact and
 * uses an identity placement under the existing root. Remove is deliberately
 * smaller than general composition authoring: only a non-root leaf may be
 * removed, and the scene must remain above the composition minimum.
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
  if (!isDesktopSceneEditOperation(input.operation)) {
    return propertyRequestDiagnostic(
      "The selected-instance edit operation is malformed or outside its numeric range.",
      documentPath,
    );
  }
  const read = readEditableComposition(input.documentData, input.contentHash, documentPath);
  if (!read.ok) return read;
  const operation = Object.freeze({ ...input.operation }) as DesktopSceneEditOperation;
  let selectedInstanceId: string;
  let composed;

  if (operation.kind === "set-transform-component") {
    const selected = read.stored.instances.find(
      (instance) => instance.instanceId === operation.instanceId,
    );
    const definition = desktopSceneTransformProperty(operation.propertyId);
    if (selected === undefined || definition === null) {
      return propertyRequestDiagnostic(
        `The selected instance or transform property is stale: ${operation.instanceId}.${operation.propertyId}.`,
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
  } else {
    const selected = read.stored.instances.find(
      (instance) => instance.instanceId === operation.instanceId,
    );
    if (selected === undefined) {
      return propertyRequestDiagnostic(
        `The selected instance is stale: ${operation.instanceId}.`,
        documentPath,
      );
    }
    if (
      selected.instanceId === read.stored.rootInstanceId ||
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
  }

  if (!composed.ok) {
    return propertyDiagnostic(`${composed.path}: ${composed.message}`, documentPath);
  }
  const edited = readEditableComposition(composed.document.data, input.contentHash, documentPath);
  if (!edited.ok) return edited;
  if (operation.kind === "add-instance") {
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
    edited.stored.instances.map((instance) => editableEntityOf(edited.stored, instance)),
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
    sceneDigest: composed.sceneDigest,
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
