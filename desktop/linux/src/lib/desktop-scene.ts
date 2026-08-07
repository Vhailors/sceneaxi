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
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  composedSceneFromDocumentData,
  digestSceneArtifact,
  identitySculptTransform,
  isJsonObject,
  type ComposedScene,
  type ComposedSceneInstance,
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
import { DESKTOP_ACTIVE_DOCUMENT_PATH } from "./bridge-contract.js";

/** Document id of the composed scene the desktop app opens. */
export const DESKTOP_OPEN_SCENE_ID = "desktop-linux-open-scene";

export const DESKTOP_ASSISTANT_SCENE_ID = "desktop-assistant-output-scene";

export const DESKTOP_ASSISTANT_INSTANCE_ID = "assistant-live-output";

/** Refusal minted when the pipeline rejects the desktop composition. */
export const DESKTOP_SCENE_NOT_COMPOSABLE = "DESKTOP_SCENE_NOT_COMPOSABLE";

export type DesktopSceneEditableProperty = Readonly<{
  id: typeof DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id;
  label: string;
  value: number;
  step: number;
}>;

export type DesktopSceneEditableEntity = Readonly<{
  id: string;
  label: string;
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
  | { readonly ok: true; readonly composed: ComposedSceneOk; readonly mountable: MountableScene }
  | { readonly ok: false; readonly reason: string; readonly message: string };

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
function recomposeStoredScene(
  stored: ComposedScene,
  transformFor: (instance: ComposedSceneInstance) => unknown,
) {
  const intake = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: stored.sceneId,
    rootInstanceId: stored.rootInstanceId,
    placements: stored.instances.map((instance) => ({
      instanceId: instance.instanceId,
      artifactId: instance.artifactId,
      parentInstanceId: instance.parentInstanceId,
      transform: transformFor(instance),
    })),
  };
  const artifacts = new Map<string, SculptArtifact>();
  for (const instance of stored.instances) {
    artifacts.set(instance.artifactId, instance.artifact);
  }
  return composeScene(intake, [...artifacts.values()]);
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

  return Object.freeze({
    ok: true as const,
    composed,
    mountable: mountableScene(composed, desktopPlacementLabels()),
  });
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
  return Object.freeze({
    ok: true as const,
    composed,
    mountable: mountableScene(composed, desktopPlacementLabels()),
  });
}

type DesktopEditableCompositionRead =
  | Readonly<{ ok: true; stored: ComposedScene; instance: ComposedSceneInstance }>
  | Readonly<{ ok: false; diagnostics: readonly ApplyDiagnostic[] }>;

/**
 * The one validated read behind both the inspection and the staged edit: a
 * content hash, a composition, and the editable starter entity inside it.
 * Every refusal on the property path is minted here, so the two public seams
 * cannot drift apart on which document they will accept.
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
  const instance = stored.value.instances.find(
    (candidate) =>
      candidate.instanceId === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
  );
  if (instance === undefined) {
    return propertyDiagnostic(
      `The active composition has no editable starter entity "${DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId}".`,
      documentPath,
    );
  }
  return Object.freeze({ ok: true as const, stored: stored.value, instance });
}

function editableEntityOf(instance: ComposedSceneInstance): DesktopSceneEditableEntity {
  return Object.freeze({
    id: instance.instanceId,
    label: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityLabel,
    properties: Object.freeze([
      Object.freeze({
        id: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
        label: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.label,
        value: instance.localTransform.translation[0],
        step: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.step,
      }),
    ]),
  });
}

/**
 * The inspection shape both the read path and the staged-edit path answer with.
 *
 * A staged proposal has no document on disk to re-read, so the host reports the
 * entity the edit recomposed rather than leaving the surface to derive a value
 * of its own — a second, unvalidated authoring answer is exactly what this
 * vertical must not grow.
 */
export function desktopScenePropertyInspection(
  contentHash: string,
  entity: DesktopSceneEditableEntity,
): DesktopScenePropertyInspection {
  return Object.freeze({
    ok: true as const,
    contentHash,
    entities: Object.freeze([entity]),
  });
}

/**
 * Inspect the one typed property this vertical supports.
 *
 * The property is taken from the validated, digest-bound composition rather
 * than the legacy sample fields beside it. That is what makes the displayed
 * value the value Play will actually mount after an accepted save.
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
    editableEntityOf(read.instance),
  );
}

/**
 * Recompose one supported translation into a new digest-bound composed-scene
 * value, then describe the ordinary E1 edit the shared session must stage.
 * This function writes nothing and owns no proposal state.
 */
export function stageDesktopScenePropertyEdit(input: Readonly<{
  documentData: unknown;
  contentHash: string;
  documentPath?: string;
  entityId: unknown;
  propertyId: unknown;
  newValue: unknown;
}>): DesktopScenePropertyStageResult {
  const documentPath = input.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH;
  const read = readEditableComposition(
    input.documentData,
    input.contentHash,
    documentPath,
  );
  if (!read.ok) return read;
  if (
    input.entityId !== DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId ||
    input.propertyId !== DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id
  ) {
    return propertyRequestDiagnostic(
      `Only ${DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId}.${DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id} is editable in this release.`,
      documentPath,
    );
  }

  const composed = recomposeStoredScene(read.stored, (instance) =>
    instance.instanceId === input.entityId
      ? {
          ...instance.localTransform,
          translation: Object.freeze([
            input.newValue,
            instance.localTransform.translation[1],
            instance.localTransform.translation[2],
          ]),
        }
      : instance.localTransform,
  );
  if (!composed.ok) {
    return propertyDiagnostic(
      `${composed.path}: ${composed.message}`,
      documentPath,
    );
  }
  const edited = readEditableComposition(
    composed.document.data,
    input.contentHash,
    documentPath,
  );
  if (!edited.ok) return edited;

  return Object.freeze({
    ok: true as const,
    edit: Object.freeze({
      documentPath,
      jsonPointer: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.jsonPointer,
      expectedContentHash: input.contentHash,
      newValue: composed.scene,
    }),
    entity: editableEntityOf(edited.instance),
    sceneDigest: composed.sceneDigest,
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
