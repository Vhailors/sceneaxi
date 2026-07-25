import { describe, expect, it } from "vitest";
import {
  COMPOSED_SCENE_DOCUMENT_DATA_KEY,
  COMPOSED_SCENE_KIND,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  SCENE_MAXIMUM_DEPTH,
  SCENE_MAXIMUM_INSTANCES,
  composeSculptTransforms,
  composedSceneFromDocumentData,
  contracts,
  digestComposedScene,
  digestSceneArtifact,
  digestScenePlacements,
  identitySculptTransform,
  projectSceneInstanceHierarchy,
  resolveScenePlacements,
  validateComposedScene,
  validateSceneCompositionIntake,
  validateSculptArtifact,
  type ComposedScene,
  type ComposedSceneInstance,
  type SceneCompositionDiagnosticCode,
  type SceneCompositionIntake,
  type SceneCompositionValidationResult,
  type SculptArtifact,
} from "@sceneaxi/schemas";
import {
  sceneCompositionArtifactFixture as artifactFixture,
  sceneCompositionFixtureDigest as digest,
  sceneCompositionIdentityTransform as identity,
  sceneCompositionTransformFixture as transform,
} from "@sceneaxi/schemas/testing/scene-composition";

function exhaustSceneDiagnostic(code: SceneCompositionDiagnosticCode) {
  switch (code) {
    case "not-object":
    case "schema-major-mismatch":
    case "invalid-kind":
    case "missing-field":
    case "unexpected-field":
    case "invalid-field":
    case "instance-count-below-minimum":
    case "duplicate-instance-id":
    case "unknown-artifact-reference":
    case "unplaced-artifact":
    case "invalid-artifact":
    case "missing-parent-instance":
    case "invalid-scene-root":
    case "scene-hierarchy-cycle":
    case "rotated-parent-unsupported":
    case "scene-budget-exceeded":
      return code;
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}

const crateArtifact = artifactFixture("crate-artifact");
const droneArtifact = artifactFixture("drone-artifact");

function intakeFixture(): SceneCompositionIntake {
  return {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: "bay",
    rootInstanceId: "bay-floor-crate",
    placements: [
      {
        instanceId: "bay-floor-crate",
        artifactId: "crate-artifact",
        parentInstanceId: null,
        transform: transform([1, 0, 2], [2, 2, 2]),
      },
      {
        instanceId: "bay-stacked-crate",
        artifactId: "crate-artifact",
        parentInstanceId: "bay-floor-crate",
        transform: transform([0, 1, 0]),
      },
      {
        instanceId: "bay-drone",
        artifactId: "drone-artifact",
        parentInstanceId: "bay-stacked-crate",
        transform: transform([0, 2, 0], [1, 1, 1], [0, 45, 0]),
      },
    ],
  };
}

function composedSceneFixture(): ComposedScene {
  const resolved = resolveScenePlacements(intakeFixture());
  if (!resolved.ok) throw new Error("fixture intake refused");
  const artifacts = new Map<string, SculptArtifact>([
    ["crate-artifact", crateArtifact],
    ["drone-artifact", droneArtifact],
  ]);
  const instances = resolved.value.map((placement): ComposedSceneInstance => {
    const artifact = artifacts.get(placement.artifactId);
    if (artifact === undefined) throw new Error("fixture artifact missing");
    return { ...placement, artifact };
  });
  const scene = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: COMPOSED_SCENE_KIND,
    sceneId: "bay",
    rootInstanceId: "bay-floor-crate",
    instances,
    evidence: {
      intakeDigest: digest("e"),
      placementDigest: digestScenePlacements(resolved.value),
      artifactDigests: instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactDigest: digestSceneArtifact(instance.artifact),
      })),
      sceneDigest: digest("0"),
    },
  } satisfies ComposedScene;
  return { ...scene, evidence: { ...scene.evidence, sceneDigest: digestComposedScene(scene) } };
}

function refusalOf(
  result: SceneCompositionValidationResult<unknown>,
  label: string,
) {
  if (result.ok) throw new Error(`${label} unexpectedly succeeded`);
  const first = result.diagnostics[0];
  if (first === undefined) throw new Error(`${label} produced no diagnostic`);
  return first;
}

function intakeRefusal(mutate: (intake: SceneCompositionIntake) => unknown, label: string) {
  return refusalOf(validateSceneCompositionIntake(mutate(intakeFixture())), label);
}

describe("scene composition contracts", () => {
  it("publishes the scene composition contract path", () => {
    expect(contracts.sceneComposition).toBe(
      "contracts/scene-composition.schema.json",
    );
  });

  it("accepts a canonical multi-instance intake and freezes it", () => {
    const result = validateSceneCompositionIntake(intakeFixture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.placements)).toBe(true);
    expect(result.value.placements).toHaveLength(3);
  });

  it("composes transforms deterministically on the 1e-6 grid", () => {
    const parent = transform([1, 0, 2], [2, 2, 2]);
    const child = transform([0, 1, 0], [0.5, 0.5, 0.5], [0, 350, 0]);
    const composed = composeSculptTransforms(parent, child);
    expect(composed).toEqual({
      translation: [1, 2, 2],
      rotationEulerDegrees: [0, 350, 0],
      scale: [1, 1, 1],
    });
    expect(composeSculptTransforms(parent, child)).toEqual(composed);

    // Rotation wraps into [0, 360) instead of drifting.
    expect(
      composeSculptTransforms(
        transform([0, 0, 0], [1, 1, 1], [0, 350, 0]),
        transform([0, 0, 0], [1, 1, 1], [0, 20, 0]),
      ).rotationEulerDegrees,
    ).toEqual([0, 10, 0]);

    // Three levels compose exactly, with no accumulated float noise.
    const level3 = composeSculptTransforms(
      composeSculptTransforms(
        transform([0.1, 0, 0], [3, 3, 3]),
        transform([0.2, 0, 0]),
      ),
      transform([0.3, 0, 0]),
    );
    expect(level3.translation).toEqual([1.6, 0, 0]);
    expect(identitySculptTransform()).toEqual(identity);
  });

  it("resolves depth, order, and world transforms", () => {
    const resolved = resolveScenePlacements(intakeFixture());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.map((placement) => placement.instanceId)).toEqual([
      "bay-floor-crate",
      "bay-stacked-crate",
      "bay-drone",
    ]);
    expect(resolved.value.map((placement) => placement.depth)).toEqual([0, 1, 2]);
    expect(resolved.value[0]?.worldTransform.translation).toEqual([1, 0, 2]);
    expect(resolved.value[1]?.worldTransform.translation).toEqual([1, 2, 2]);
    expect(resolved.value[2]?.worldTransform.translation).toEqual([1, 6, 2]);
    // A leaf may rotate freely.
    expect(resolved.value[2]?.worldTransform.rotationEulerDegrees).toEqual([0, 45, 0]);
  });

  it("treats a reused artifactId as legal instancing", () => {
    const resolved = resolveScenePlacements(intakeFixture());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const crateInstances = resolved.value.filter(
      (placement) => placement.artifactId === "crate-artifact",
    );
    expect(crateInstances).toHaveLength(2);
    expect(new Set(crateInstances.map((placement) => placement.instanceId)).size).toBe(2);
  });

  it("refuses every intake-reachable failure with a stable code and path", () => {
    expect(refusalOf(validateSceneCompositionIntake([]), "array intake")).toMatchObject({
      code: exhaustSceneDiagnostic("not-object"),
      path: "$",
    });
    expect(
      intakeRefusal((intake) => ({ ...intake, schemaVersion: 2 }), "schema drift"),
    ).toMatchObject({ code: "schema-major-mismatch", path: "$.schemaVersion" });
    expect(
      intakeRefusal((intake) => ({ ...intake, kind: "sceneaxi.other" }), "kind drift"),
    ).toMatchObject({ code: "invalid-kind", path: "$.kind" });
    expect(
      intakeRefusal((intake) => {
        const withoutSceneId: Record<string, unknown> = { ...intake };
        Reflect.deleteProperty(withoutSceneId, "sceneId");
        return withoutSceneId;
      }, "missing sceneId"),
    ).toMatchObject({ code: "missing-field", path: "$.sceneId" });
    expect(
      intakeRefusal((intake) => ({ ...intake, extra: 1 }), "unexpected field"),
    ).toMatchObject({ code: "unexpected-field", path: "$.extra" });
    expect(
      intakeRefusal((intake) => ({ ...intake, sceneId: "Bay" }), "bad sceneId"),
    ).toMatchObject({ code: "invalid-field", path: "$.sceneId" });
    expect(
      intakeRefusal(
        (intake) => ({
          ...intake,
          placements: intake.placements.map((placement, index) =>
            index === 2 ? { ...placement, transform: { translation: [0, 0, 0] } } : placement,
          ),
        }),
        "bad transform",
      ),
    ).toMatchObject({ code: "invalid-field", path: "$.placements[2].transform" });
    expect(
      intakeRefusal(
        (intake) => ({ ...intake, placements: intake.placements.slice(0, 1) }),
        "single placement",
      ),
    ).toMatchObject({ code: "instance-count-below-minimum", path: "$.placements" });
    expect(
      intakeRefusal(
        (intake) => ({
          ...intake,
          placements: intake.placements.map((placement) => ({
            ...placement,
            instanceId: "bay-floor-crate",
            parentInstanceId: null,
          })),
        }),
        "duplicate instance",
      ),
    ).toMatchObject({ code: "duplicate-instance-id", path: "$.placements" });
    expect(
      intakeRefusal(
        (intake) => ({
          ...intake,
          placements: intake.placements.map((placement, index) =>
            index === 1 ? { ...placement, parentInstanceId: "bay-ghost" } : placement,
          ),
        }),
        "missing parent",
      ),
    ).toMatchObject({
      code: "missing-parent-instance",
      path: "$.placements[1].parentInstanceId",
    });
    expect(
      intakeRefusal(
        (intake) => ({ ...intake, rootInstanceId: "bay-drone" }),
        "root mismatch",
      ),
    ).toMatchObject({ code: "invalid-scene-root", path: "$.rootInstanceId" });
    expect(
      intakeRefusal(
        (intake) => ({
          ...intake,
          placements: intake.placements.map((placement, index) =>
            index === 0 ? { ...placement, parentInstanceId: "bay-drone" } : placement,
          ),
        }),
        "no root",
      ),
    ).toMatchObject({ code: "invalid-scene-root", path: "$.placements" });
    expect(
      intakeRefusal(
        (intake) => ({
          ...intake,
          placements: intake.placements.map((placement, index) =>
            index === 1 ? { ...placement, parentInstanceId: "bay-stacked-crate" } : placement,
          ),
        }),
        "self parent",
      ),
    ).toMatchObject({
      code: "scene-hierarchy-cycle",
      path: "$.placements[1].parentInstanceId",
    });
    expect(
      intakeRefusal(
        (intake) => ({
          ...intake,
          placements: intake.placements.map((placement, index) =>
            index === 1
              ? { ...placement, transform: transform([0, 1, 0], [1, 1, 1], [0, 30, 0]) }
              : placement,
          ),
        }),
        "rotated parent",
      ),
    ).toMatchObject({
      code: "rotated-parent-unsupported",
      path: "$.placements[1].transform.rotationEulerDegrees",
    });
  });

  it("refuses a two-instance parentage cycle that never reaches the root", () => {
    const intake = intakeFixture();
    const cycled = {
      ...intake,
      placements: [
        ...intake.placements,
        {
          instanceId: "bay-loop-a",
          artifactId: "crate-artifact",
          parentInstanceId: "bay-loop-b",
          transform: identity,
        },
        {
          instanceId: "bay-loop-b",
          artifactId: "crate-artifact",
          parentInstanceId: "bay-loop-a",
          transform: identity,
        },
      ],
    };
    expect(refusalOf(validateSceneCompositionIntake(cycled), "cycle")).toMatchObject({
      code: "scene-hierarchy-cycle",
      path: "$.placements",
    });
  });

  it("refuses instance-count and depth budget overruns", () => {
    const wide = {
      ...intakeFixture(),
      placements: [
        {
          instanceId: "bay-floor-crate",
          artifactId: "crate-artifact",
          parentInstanceId: null,
          transform: identity,
        },
        ...Array.from({ length: SCENE_MAXIMUM_INSTANCES }, (_unused, index) => ({
          instanceId: `bay-extra-${String(index)}`,
          artifactId: "crate-artifact",
          parentInstanceId: "bay-floor-crate",
          transform: identity,
        })),
      ],
    };
    expect(refusalOf(validateSceneCompositionIntake(wide), "wide scene")).toMatchObject({
      code: "scene-budget-exceeded",
      path: "$.placements",
    });

    const deep = {
      ...intakeFixture(),
      placements: [
        {
          instanceId: "bay-floor-crate",
          artifactId: "crate-artifact",
          parentInstanceId: null,
          transform: identity,
        },
        ...Array.from({ length: SCENE_MAXIMUM_DEPTH + 1 }, (_unused, index) => ({
          instanceId: `bay-deep-${String(index)}`,
          artifactId: "crate-artifact",
          parentInstanceId:
            index === 0 ? "bay-floor-crate" : `bay-deep-${String(index - 1)}`,
          transform: identity,
        })),
      ],
    };
    expect(refusalOf(validateSceneCompositionIntake(deep), "deep scene")).toMatchObject({
      code: "scene-budget-exceeded",
      path: "$.placements",
    });
  });

  it("projects an instance into scene space without touching its artifact", () => {
    const scene = composedSceneFixture();
    const instance = scene.instances[2];
    if (instance === undefined) throw new Error("fixture instance missing");
    const placed = projectSceneInstanceHierarchy(instance);
    expect(placed.instanceId).toBe("bay-drone");
    expect(placed.rootNodeId).toBe("drone-artifact-root");

    const rootNode = placed.nodes.find((node) => node.id === placed.rootNodeId);
    const childNode = placed.nodes.find((node) => node.id !== placed.rootNodeId);
    expect(rootNode?.transform.translation).toEqual([1, 6, 2]);
    expect(rootNode?.transform.rotationEulerDegrees).toEqual([0, 45, 0]);
    // Child locals stay local — only the root reaches world space.
    expect(childNode?.transform.translation).toEqual([0, 1.5, 0]);

    // The source artifact is untouched and still validates.
    expect(instance.artifact.runtimeHierarchy.nodes[0]?.transform).toEqual(identity);
    expect(validateSculptArtifact(instance.artifact).ok).toBe(true);
    expect(digestSceneArtifact(instance.artifact)).toBe(
      digestSceneArtifact(droneArtifact),
    );
  });

  it("round-trips a composed scene and exposes it through document data", () => {
    const scene = composedSceneFixture();
    const result = validateComposedScene(scene);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.instances.map((instance) => instance.instanceId)).toEqual([
      "bay-floor-crate",
      "bay-stacked-crate",
      "bay-drone",
    ]);
    expect(Object.isFrozen(result.value)).toBe(true);

    const fromDocument = composedSceneFromDocumentData({
      [COMPOSED_SCENE_DOCUMENT_DATA_KEY]: scene as never,
    });
    expect(fromDocument.ok).toBe(true);
    expect(
      refusalOf(composedSceneFromDocumentData({ other: 1 }), "missing key"),
    ).toMatchObject({
      code: "missing-field",
      path: `$.${COMPOSED_SCENE_DOCUMENT_DATA_KEY}`,
    });
  });

  it("keeps digestComposedScene stable and sensitive", () => {
    const scene = composedSceneFixture();
    expect(digestComposedScene(scene)).toBe(digestComposedScene(scene));
    expect(digestComposedScene(scene)).toBe(scene.evidence.sceneDigest);
    expect(
      digestComposedScene({ ...scene, sceneId: "other-bay" }),
    ).not.toBe(scene.evidence.sceneDigest);
  });

  it("refuses composed scenes whose recomputable bindings drift", () => {
    const scene = composedSceneFixture();
    expect(
      refusalOf(
        validateComposedScene({
          ...scene,
          evidence: { ...scene.evidence, sceneDigest: digest("f") },
        }),
        "tampered scene digest",
      ),
    ).toMatchObject({ code: "invalid-field", path: "$.evidence.sceneDigest" });

    expect(
      refusalOf(
        validateComposedScene({
          ...scene,
          instances: [...scene.instances].reverse(),
        }),
        "reordered instances",
      ),
    ).toMatchObject({ code: "invalid-field", path: "$.instances" });

    const driftedWorld = {
      ...scene,
      instances: scene.instances.map((instance, index) =>
        index === 1
          ? { ...instance, worldTransform: transform([9, 9, 9]) }
          : instance,
      ),
    };
    expect(
      refusalOf(validateComposedScene(driftedWorld), "drifted world transform"),
    ).toMatchObject({
      code: "invalid-field",
      path: "$.instances[1].worldTransform",
    });

    const mismatchedArtifact = {
      ...scene,
      instances: scene.instances.map((instance, index) =>
        index === 2 ? { ...instance, artifactId: "crate-artifact" } : instance,
      ),
    };
    expect(
      refusalOf(validateComposedScene(mismatchedArtifact), "artifact id mismatch"),
    ).toMatchObject({
      code: "unknown-artifact-reference",
      path: "$.instances[2].artifactId",
    });

    const brokenArtifact = {
      ...scene,
      instances: scene.instances.map((instance, index) =>
        index === 0
          ? { ...instance, artifact: { ...instance.artifact, artifactId: "Bad Id" } }
          : instance,
      ),
    };
    expect(
      refusalOf(validateComposedScene(brokenArtifact), "invalid artifact"),
    ).toMatchObject({ code: "invalid-artifact", path: "$.instances[0].artifact" });

    expect(
      refusalOf(
        validateComposedScene({
          ...scene,
          evidence: { ...scene.evidence, placementDigest: digest("f") },
        }),
        "tampered placement digest",
      ),
    ).toMatchObject({ code: "invalid-field", path: "$.evidence.placementDigest" });

    expect(
      refusalOf(
        validateComposedScene({
          ...scene,
          evidence: {
            ...scene.evidence,
            artifactDigests: scene.evidence.artifactDigests.map((entry, index) =>
              index === 0 ? { ...entry, artifactDigest: digest("f") } : entry,
            ),
          },
        }),
        "tampered artifact digest",
      ),
    ).toMatchObject({
      code: "invalid-artifact",
      path: "$.evidence.artifactDigests[0].artifactDigest",
    });

    expect(
      refusalOf(validateComposedScene({ ...scene, kind: "sceneaxi.other" }), "kind"),
    ).toMatchObject({ code: "invalid-kind", path: "$.kind" });
  });
});
