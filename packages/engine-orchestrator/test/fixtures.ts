/**
 * Deterministic fixtures for the orchestrator tests.
 *
 * Everything here is structural and offline: the shared scene-composition test
 * fixtures from `@sceneaxi/schemas/testing/scene-composition` plus a two-entity
 * product manifest. No file is read, no clock is drawn, no seed is random, so a
 * digest asserted in one run is the digest of every run.
 */
import {
  COMPOSED_SCENE_KIND,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  digestComposedScene,
  digestSceneArtifact,
  digestScenePlacements,
  resolveScenePlacements,
  type ComposedScene,
  type ComposedSceneInstance,
  type ProductManifest,
  type SculptArtifact,
} from "@sceneaxi/schemas";
import {
  sceneCompositionArtifactFixture,
  sceneCompositionFixtureDigest,
  sceneCompositionTransformFixture as transform,
} from "@sceneaxi/schemas/testing/scene-composition";

/** A fixed host: the orchestrator stamps this reading into every bootstrap record. */
export const FIXED_NOW_MS = 1_753_334_400_000;

export const fixedHost = { nowMs: () => FIXED_NOW_MS };

export function productManifestFixture(
  productId = "orchestrated-product",
): ProductManifest {
  return {
    productId,
    seed: 7,
    entities: [
      { id: "hero", x: 2, y: 1 },
      { id: "crate", x: -1, y: 0 },
    ],
  };
}

export function sculptArtifactFixture(
  artifactId = "crate-artifact",
): SculptArtifact {
  return sceneCompositionArtifactFixture(artifactId);
}

export function composedSceneFixture(sceneId = "orchestrated-bay"): ComposedScene {
  const crate = sculptArtifactFixture("crate-artifact");
  const drone = sculptArtifactFixture("drone-artifact");
  const resolved = resolveScenePlacements({
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId,
    rootInstanceId: "bay-floor-crate",
    placements: [
      {
        instanceId: "bay-floor-crate",
        artifactId: "crate-artifact",
        parentInstanceId: null,
        transform: transform([1, 0, 2]),
      },
      {
        instanceId: "bay-drone",
        artifactId: "drone-artifact",
        parentInstanceId: "bay-floor-crate",
        transform: transform([0, 3, 0]),
      },
    ],
  });
  if (!resolved.ok) throw new Error("scene fixture refused");

  const artifacts = new Map([
    ["crate-artifact", crate],
    ["drone-artifact", drone],
  ]);
  const instances = resolved.value.map((placement): ComposedSceneInstance => {
    const artifact = artifacts.get(placement.artifactId);
    if (artifact === undefined) throw new Error("fixture artifact missing");
    return { ...placement, artifact };
  });
  const draft = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: COMPOSED_SCENE_KIND,
    sceneId,
    rootInstanceId: "bay-floor-crate",
    instances,
    evidence: {
      intakeDigest: sceneCompositionFixtureDigest("e"),
      placementDigest: digestScenePlacements(resolved.value),
      artifactDigests: instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactDigest: digestSceneArtifact(instance.artifact),
      })),
      sceneDigest: sceneCompositionFixtureDigest("0"),
    },
  } satisfies ComposedScene;

  return {
    ...draft,
    evidence: { ...draft.evidence, sceneDigest: digestComposedScene(draft) },
  };
}
