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
import { composeScene } from "@sceneaxi/authoring-core";
import {
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  composedSceneFromDocumentData,
  digestSceneArtifact,
  identitySculptTransform,
  isJsonObject,
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

/** Document id of the composed scene the desktop app opens. */
export const DESKTOP_OPEN_SCENE_ID = "desktop-linux-open-scene";

export const DESKTOP_ASSISTANT_SCENE_ID = "desktop-assistant-output-scene";

export const DESKTOP_ASSISTANT_INSTANCE_ID = "assistant-live-output";

/** Refusal minted when the pipeline rejects the desktop composition. */
export const DESKTOP_SCENE_NOT_COMPOSABLE = "DESKTOP_SCENE_NOT_COMPOSABLE";

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

  const intake: SceneCompositionIntake = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: stored.value.sceneId,
    rootInstanceId: stored.value.rootInstanceId,
    placements: stored.value.instances.map((instance) => ({
      instanceId: instance.instanceId,
      artifactId: instance.artifactId,
      parentInstanceId: instance.parentInstanceId,
      transform: instance.localTransform,
    })),
  };
  const artifacts = new Map<string, SculptArtifact>();
  for (const instance of stored.value.instances) {
    artifacts.set(instance.artifactId, instance.artifact);
  }
  const composed = composeScene(intake, [...artifacts.values()]);
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
