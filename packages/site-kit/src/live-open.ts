/**
 * The public live open path: the real artifact the umbrella opens in a browser.
 *
 * This module owns everything about that path that is **not** presentational: which
 * committed fixture is opened, how its instances are placed, what the composition
 * pipeline says about them, and the honest vocabulary the page is allowed to use for
 * the presentation core. The umbrella's `src/app/` tree adds a canvas and a render
 * loop over it; nothing decided here needs a browser, so `pnpm gate` tests all of it.
 *
 * Two properties matter and are asserted rather than described:
 *
 * - The scene is **real**. The artifact is reconstructed from the committed starter
 *   intake through `@sceneaxi/authoring-core`, and the placements are resolved by
 *   `composeScene()` — the same pipeline ADRs 0014-0015 govern. World transforms are
 *   the pipeline's, not this module's arithmetic.
 * - Placement stays a **projection**. No artifact is rewritten to place it, because
 *   its evidence binds its exact spec bytes.
 */
import { composeScene } from "@sceneaxi/authoring-core";
import {
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  identitySculptTransform,
  type SceneCompositionIntake,
  type SculptArtifact,
  type SculptTransform,
  type Vector3,
} from "@sceneaxi/schemas";
import { type SiteResult, ok, refuse } from "./refusals.js";
import { webEditorStarterArtifact } from "./starter-artifact.js";

/** Route the umbrella serves the live open path on. */
export const LIVE_OPEN_PATH = "/open";

/** Document id of the composed scene this path opens. */
export const LIVE_OPEN_SCENE_ID = "umbrella-live-open-scene";

/**
 * Vocabulary the live open path is allowed to use for the presentation core.
 *
 * Held here, and asserted by the gate, so the shipped copy cannot drift back toward
 * the retired "experimental preview / non-decision" framing (ADR 0008 amendment) or
 * toward implying a renderer contest that was never run.
 */
export const LIVE_OPEN_PRESENTATION = Object.freeze({
  /** The label a product surface must show for a frame with pixels. */
  coreLabel: "Three presentation core",
  /** The label the no-pixel gate surface identifies itself with. */
  headlessLabel: "Three presentation core — headless surface, no pixels drawn",
  decision:
    "Three.js is the SceneAxi product presentation core (ADR 0017), a captain product decision.",
  seam:
    "It stays behind the unchanged ADR 0002 Presentation Runtime seam — mount / present / capture / dispose — plus the Sculpt Mount boundary. No Three type crosses those exports.",
  notClaimed:
    "Choosing the product core is not a Stage 1 result: run authorization and adjudication stay held elsewhere, and no renderer contest is claimed.",
  /** Strings a product surface must never reintroduce. */
  retiredLabels: Object.freeze([
    "Experimental Three preview",
    "non-decision",
  ] as const),
});

/**
 * Placements of the live open scene, hierarchical per ADR 0014: a child transform is
 * read relative to its parent. Three instances of one artifact, because multi-object
 * is the point — a one-instance scene is a sculpt, not a scene.
 */
const LIVE_OPEN_PLACEMENTS = Object.freeze([
  Object.freeze({
    instanceId: "service-crate-root",
    parentInstanceId: null,
    translation: Object.freeze([0, 0, 0] as const),
    label: "Root instance",
  }),
  Object.freeze({
    instanceId: "service-crate-left",
    parentInstanceId: "service-crate-root",
    translation: Object.freeze([-4.4, 0, 0] as const),
    label: "Placed beside the root",
  }),
  Object.freeze({
    instanceId: "service-crate-stacked",
    parentInstanceId: "service-crate-root",
    translation: Object.freeze([0, 2.3, 0] as const),
    label: "Stacked on the root",
  }),
] as const);

/** One instance the browser mounts, carrying the pipeline's own world transform. */
export type LiveOpenInstance = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly parentInstanceId: string | null;
  readonly depth: number;
  readonly label: string;
  readonly worldTransform: SculptTransform;
};

/**
 * Everything a browser needs to open the scene, and nothing else.
 *
 * Artifacts are carried once and referenced by id rather than repeated per instance,
 * so mounting N instances of one artifact costs one artifact on the wire.
 */
export type LiveOpenScene = {
  readonly sceneId: string;
  readonly rootInstanceId: string;
  readonly sceneDigest: string;
  readonly artifacts: Readonly<Record<string, SculptArtifact>>;
  readonly instances: readonly LiveOpenInstance[];
};

function placementTransform(translation: Vector3): SculptTransform {
  const placed: Vector3 = [translation[0], translation[1], translation[2]];
  return Object.freeze({ ...identitySculptTransform(), translation: Object.freeze(placed) });
}

/**
 * The artifact id a placement must reference.
 *
 * Read structurally from an unknown value rather than asserted, so a value that is not
 * an artifact produces an intake the pipeline refuses instead of a cast that lies.
 */
function artifactIdOf(value: unknown): string {
  return typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly artifactId?: unknown }).artifactId === "string"
    ? (value as { readonly artifactId: string }).artifactId
    : "";
}

/**
 * Compose the live open scene from a supplied artifact.
 *
 * Exported so the refuse matrix can reach `LIVE_OPEN_NOT_COMPOSABLE` with an artifact
 * the pipeline rejects, instead of the shipped starter intake having to be corrupted
 * to prove the refusal is wired.
 */
export function composeLiveOpenScene(artifactValue: unknown): SiteResult<LiveOpenScene> {
  const artifactId = artifactIdOf(artifactValue);
  const intake: SceneCompositionIntake = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: LIVE_OPEN_SCENE_ID,
    rootInstanceId: LIVE_OPEN_PLACEMENTS[0].instanceId,
    placements: LIVE_OPEN_PLACEMENTS.map((placement) => ({
      instanceId: placement.instanceId,
      artifactId,
      parentInstanceId: placement.parentInstanceId,
      transform: placementTransform(placement.translation),
    })),
  };

  const composed = composeScene(intake, [artifactValue]);
  if (!composed.ok) return refuse("LIVE_OPEN_NOT_COMPOSABLE");

  const labels = new Map<string, string>(
    LIVE_OPEN_PLACEMENTS.map((placement) => [placement.instanceId, placement.label]),
  );
  const artifacts: Record<string, SculptArtifact> = {};
  for (const instance of composed.scene.instances) {
    artifacts[instance.artifactId] = instance.artifact;
  }

  return ok(
    Object.freeze({
      sceneId: composed.scene.sceneId,
      rootInstanceId: composed.scene.rootInstanceId,
      sceneDigest: composed.sceneDigest,
      artifacts: Object.freeze(artifacts),
      instances: Object.freeze(
        composed.scene.instances.map((instance) =>
          Object.freeze({
            instanceId: instance.instanceId,
            artifactId: instance.artifactId,
            parentInstanceId: instance.parentInstanceId,
            depth: instance.depth,
            label: labels.get(instance.instanceId) ?? instance.instanceId,
            worldTransform: instance.worldTransform,
          }),
        ),
      ),
    }),
  );
}

/**
 * The scene the public live open path serves.
 *
 * Deterministic for the fixed starter seed, so the same deploy always opens the same
 * scene and the published digest is checkable.
 */
export function liveOpenScene(): SiteResult<LiveOpenScene> {
  const artifact = webEditorStarterArtifact();
  if (!artifact.ok) return artifact;
  return composeLiveOpenScene(artifact.value);
}
