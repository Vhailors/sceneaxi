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
import {
  SCENE_EFFECTS_CATALOG_KEY,
  SCENE_ENVIRONMENT_CATALOG_KEY,
  SCENE_MATERIALS_CATALOG_KEY,
  inspectSceneEffects,
  isJsonObject,
  parseSceneEffectsCatalog,
  parseSceneEnvironmentCatalog,
  parseSceneMaterialsCatalog,
  sceneEnvironmentCatalogDigest,
  sceneMaterialsCatalogDigest,
  type SceneEffectsCatalog,
  type SceneEnvironmentCatalog,
  type SceneMaterialsCatalog,
  type SculptArtifact,
  type SculptTransform,
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
  readonly materials?: SceneMaterialsCatalog;
  readonly materialsDigest?: string;
  readonly effects?: SceneEffectsCatalog;
  readonly effectsDigest?: string;
};

export type MountableSceneCatalogs = Readonly<{
  environment: SceneEnvironmentCatalog;
  materials: SceneMaterialsCatalog;
  effects: SceneEffectsCatalog;
}>;

export function sceneCatalogsFromDocumentData(
  value: unknown,
): MountableSceneCatalogs | null | undefined {
  if (value === undefined) return undefined;
  if (!isJsonObject(value)) return null;
  const keys = [SCENE_ENVIRONMENT_CATALOG_KEY, SCENE_MATERIALS_CATALOG_KEY, SCENE_EFFECTS_CATALOG_KEY];
  if (!keys.some((key) => Object.hasOwn(value, key))) return undefined;
  const environment = parseSceneEnvironmentCatalog(value[SCENE_ENVIRONMENT_CATALOG_KEY]);
  const materials = parseSceneMaterialsCatalog(value[SCENE_MATERIALS_CATALOG_KEY]);
  const effects = parseSceneEffectsCatalog(value[SCENE_EFFECTS_CATALOG_KEY]);
  if (environment === null || materials === null || effects === null) return null;
  return Object.freeze({ environment, materials, effects });
}

/**
 * Project an accepted composition into the browser mount payload.
 *
 * Callers own their own refusal for a composition the pipeline rejected, because the
 * two surfaces refuse for different published reasons; this function only ever sees a
 * scene that composed.
 */
export function mountableSceneFromDocumentData(
  composed: ComposedSceneOk,
  data: unknown,
  labels: ReadonlyMap<string, string> = new Map(),
): MountableScene | null {
  const catalogs = sceneCatalogsFromDocumentData(data);
  return catalogs === null ? null : mountableScene(composed, labels, catalogs);
}

export function mountableScene(
  composed: ComposedSceneOk,
  labels: ReadonlyMap<string, string> = new Map(),
  catalogs?: MountableSceneCatalogs,
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
    ...(catalogs === undefined ? {} : {
      environment: catalogs.environment,
      environmentDigest: sceneEnvironmentCatalogDigest(catalogs.environment),
      materials: catalogs.materials,
      materialsDigest: sceneMaterialsCatalogDigest(catalogs.materials),
      effects: catalogs.effects,
      effectsDigest: inspectSceneEffects(catalogs.effects).digest,
    }),
  });
}
