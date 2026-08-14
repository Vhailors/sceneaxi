/**
 * The payload a browser needs to mount a composed scene, and nothing else.
 *
 * Two umbrella surfaces draw pixels — the public live open path and the entitled
 * Minimum E2 editor — and both hand the browser the *same* shape: validated Sculpt
 * Artifacts plus the composition pipeline's own world transforms. Owning that shape
 * once is what keeps the two viewports one code path over one presentation core
 * (ADR 0017/0022) instead of two drifting ones.
 *
 * Nothing here is presentational and nothing here needs a browser, so `pnpm gate`
 * decides all of it. In particular the world transforms are read from `composeScene()`
 * output — this module does no placement arithmetic of its own, and it rewrites no
 * artifact, because an artifact's evidence binds its exact spec bytes.
 */
import type { SceneCompositionResult } from "@sceneaxi/authoring-core";
import type {
  SceneEffectEmitter,
  SceneEnvironmentCatalog,
  SceneMaterialOverride,
  SculptArtifact,
  SculptTransform,
} from "@sceneaxi/schemas";

/** A composition the pipeline accepted; the only input a mountable scene is built from. */
export type ComposedSceneOk = Extract<SceneCompositionResult, { readonly ok: true }>;

/** One instance the browser mounts, carrying the pipeline's own world transform. */
export type MountableSceneInstance = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly parentInstanceId: string | null;
  readonly depth: number;
  /** A human placement annotation. Defaults to the instance id when none is supplied. */
  readonly label: string;
  readonly worldTransform: SculptTransform;
};

/**
 * Everything a browser needs to open a composed scene.
 *
 * Artifacts are carried once and referenced by id rather than repeated per instance,
 * so mounting N instances of one artifact costs one artifact on the wire.
 */
export type MountableScene = {
  readonly sceneId: string;
  readonly rootInstanceId: string;
  readonly sceneDigest: string;
  readonly artifacts: Readonly<Record<string, SculptArtifact>>;
  readonly instances: readonly MountableSceneInstance[];
  readonly environment?: SceneEnvironmentCatalog;
  readonly environmentDigest?: string;
  readonly materials?: readonly SceneMaterialOverride[];
  readonly materialsDigest?: string;
  readonly effects?: readonly SceneEffectEmitter[];
  readonly effectsDigest?: string;
};

/**
 * Project an accepted composition into the browser mount payload.
 *
 * Callers own their own refusal for a composition the pipeline rejected, because the
 * two surfaces refuse for different published reasons; this function only ever sees a
 * scene that composed.
 */
export function mountableScene(
  composed: ComposedSceneOk,
  labels: ReadonlyMap<string, string> = new Map(),
): MountableScene {
  const artifacts: Record<string, SculptArtifact> = {};
  for (const instance of composed.scene.instances) {
    artifacts[instance.artifactId] = instance.artifact;
  }

  return Object.freeze({
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
  });
}
