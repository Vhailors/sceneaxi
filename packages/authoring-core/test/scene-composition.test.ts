import { describe, expect, it } from "vitest";
import {
  composeScene,
  sceneDocumentFromComposedScene,
  serializeComposedScene,
  validateDocument,
  type SceneCompositionOptions,
  type SceneCompositionRefusalCode,
  type SceneCompositionResult,
} from "@sceneaxi/authoring-core";
import {
  COMPOSED_SCENE_DOCUMENT_DATA_KEY,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  composedSceneFromDocumentData,
  validateComposedScene,
  type SceneCompositionIntake,
} from "@sceneaxi/schemas";
import {
  sceneCompositionArtifactFixture as artifactFixture,
  sceneCompositionFixtureDigest as digest,
  sceneCompositionIdentityTransform as identity,
  sceneCompositionTransformFixture as transform,
} from "@sceneaxi/schemas/testing/scene-composition";

const crateArtifact = artifactFixture("crate-artifact");
const droneArtifact = artifactFixture("drone-artifact");
const artifacts = [crateArtifact, droneArtifact];

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

function refusal(result: SceneCompositionResult, label: string) {
  if (result.ok) throw new Error(`${label} unexpectedly composed`);
  return { code: result.code, path: result.path };
}

function composedFixture() {
  const result = composeScene(intakeFixture(), artifacts);
  if (!result.ok) throw new Error(`fixture refused: ${result.message}`);
  return result;
}

describe("scene composition pipeline", () => {
  it("composes ordered instances with deterministic world transforms", () => {
    const composed = composedFixture();
    expect(composed.scene.instances.map((instance) => instance.instanceId)).toEqual([
      "bay-floor-crate",
      "bay-stacked-crate",
      "bay-drone",
    ]);
    expect(composed.scene.instances.map((instance) => instance.depth)).toEqual([0, 1, 2]);
    expect(
      composed.scene.instances.map((instance) => instance.worldTransform.translation),
    ).toEqual([
      [1, 0, 2],
      [1, 2, 2],
      [1, 6, 2],
    ]);
    expect(validateComposedScene(composed.scene).ok).toBe(true);
  });

  it("treats one artifact placed twice as legal instancing", () => {
    const composed = composedFixture();
    const crateInstances = composed.scene.instances.filter(
      (instance) => instance.artifactId === "crate-artifact",
    );
    expect(crateInstances).toHaveLength(2);
    expect(new Set(crateInstances.map((instance) => instance.instanceId)).size).toBe(2);
    expect(composed.scene.evidence.artifactDigests).toHaveLength(3);
  });

  it("refuses in both directions instead of dropping an artifact", () => {
    const intake = intakeFixture();
    const reordered = {
      ...intake,
      placements: [
        intake.placements[0],
        intake.placements[2],
        intake.placements[1],
      ],
    };
    expect(
      refusal(composeScene(reordered, [crateArtifact]), "missing artifact"),
    ).toEqual({
      code: "unknown-artifact-reference",
      path: "$.placements[1].artifactId",
    });

    expect(
      refusal(
        composeScene(intakeFixture(), [
          ...artifacts,
          artifactFixture("spare-artifact"),
        ]),
        "unplaced artifact",
      ),
    ).toEqual({ code: "unplaced-artifact", path: "$.artifacts" });
  });

  it("surfaces every named refusal from the shared refuse matrix", () => {
    const seen = new Set<SceneCompositionRefusalCode>();
    const record = (result: SceneCompositionResult, label: string) => {
      const { code } = refusal(result, label);
      seen.add(code);
      return code;
    };

    const intake = intakeFixture();
    const placements = intake.placements;
    const mutate = (next: unknown) => composeScene(next, artifacts);

    record(mutate([]), "array intake");
    record(mutate({ ...intake, schemaVersion: 2 }), "schema drift");
    record(mutate({ ...intake, kind: "sceneaxi.other" }), "kind drift");
    const withoutSceneId: Record<string, unknown> = { ...intake };
    Reflect.deleteProperty(withoutSceneId, "sceneId");
    record(mutate(withoutSceneId), "missing field");
    record(mutate({ ...intake, extra: true }), "unexpected field");
    record(mutate({ ...intake, sceneId: "Bay" }), "invalid field");
    record(mutate({ ...intake, placements: placements.slice(0, 1) }), "too few");
    record(
      mutate({
        ...intake,
        placements: placements.map((placement) => ({
          ...placement,
          instanceId: "bay-floor-crate",
          parentInstanceId: null,
        })),
      }),
      "duplicate instance",
    );
    record(
      mutate({
        ...intake,
        placements: placements.map((placement, index) =>
          index === 1 ? { ...placement, parentInstanceId: "bay-ghost" } : placement,
        ),
      }),
      "missing parent",
    );
    record(mutate({ ...intake, rootInstanceId: "bay-drone" }), "root mismatch");
    record(
      mutate({
        ...intake,
        placements: placements.map((placement, index) =>
          index === 1 ? { ...placement, parentInstanceId: "bay-stacked-crate" } : placement,
        ),
      }),
      "cycle",
    );
    record(
      mutate({
        ...intake,
        placements: placements.map((placement, index) =>
          index === 1
            ? { ...placement, transform: transform([0, 1, 0], [1, 1, 1], [0, 30, 0]) }
            : placement,
        ),
      }),
      "rotated parent",
    );
    record(
      mutate({
        ...intake,
        placements: [
          placements[0],
          ...Array.from({ length: 32 }, (_unused, index) => ({
            instanceId: `bay-extra-${String(index)}`,
            artifactId: "crate-artifact",
            parentInstanceId: "bay-floor-crate",
            transform: identity,
          })),
        ],
      }),
      "budget",
    );
    record(
      composeScene(intakeFixture(), [crateArtifact]),
      "unknown artifact reference",
    );
    record(
      composeScene(intakeFixture(), [...artifacts, artifactFixture("spare-artifact")]),
      "unplaced artifact",
    );
    record(
      composeScene(intakeFixture(), [
        crateArtifact,
        { ...droneArtifact, artifactId: "Bad Id" },
      ]),
      "invalid artifact",
    );

    expect([...seen].sort()).toEqual([
      "duplicate-instance-id",
      "instance-count-below-minimum",
      "invalid-artifact",
      "invalid-field",
      "invalid-kind",
      "invalid-scene-root",
      "missing-field",
      "missing-parent-instance",
      "not-object",
      "rotated-parent-unsupported",
      "scene-budget-exceeded",
      "scene-hierarchy-cycle",
      "schema-major-mismatch",
      "unexpected-field",
      "unknown-artifact-reference",
      "unplaced-artifact",
    ]);
  });

  it("refuses the same Sculpt Artifact supplied twice", () => {
    expect(
      refusal(
        composeScene(intakeFixture(), [crateArtifact, droneArtifact, crateArtifact]),
        "duplicate supply",
      ),
    ).toEqual({
      code: "unknown-artifact-reference",
      path: "$.artifacts[2].artifactId",
    });
  });

  it("refuses invalid artifact containers without throwing", () => {
    expect(
      refusal(
        composeScene(
          intakeFixture(),
          undefined as unknown as readonly unknown[],
        ),
        "missing artifact container",
      ),
    ).toEqual({
      code: "invalid-artifact",
      path: "$.artifacts",
    });
  });

  it("refuses unstable intake and artifact fields without reading them", () => {
    const throwingIntake = new Proxy(intakeFixture(), {
      ownKeys() {
        throw new Error("must not escape");
      },
    });
    expect(
      refusal(
        composeScene(throwingIntake, artifacts),
        "throwing intake reflection",
      ),
    ).toEqual({
      code: "invalid-field",
      path: "$",
    });

    let artifactReads = 0;
    const throwingArtifacts: unknown[] = [crateArtifact, droneArtifact];
    Object.defineProperty(throwingArtifacts, 1, {
      enumerable: true,
      get() {
        artifactReads += 1;
        throw new Error("must not escape");
      },
    });
    expect(
      refusal(
        composeScene(intakeFixture(), throwingArtifacts),
        "throwing artifact accessor",
      ),
    ).toEqual({
      code: "invalid-artifact",
      path: "$.artifacts[1]",
    });
    expect(artifactReads).toBe(0);
  });

  it("refuses accessor-backed options without reading them", () => {
    let reads = 0;
    const options: SceneCompositionOptions = {};
    Object.defineProperty(options, "title", {
      enumerable: true,
      get() {
        reads += 1;
        return "Changed title";
      },
    });

    expect(
      refusal(
        composeScene(intakeFixture(), artifacts, options),
        "accessor-backed options",
      ),
    ).toEqual({
      code: "invalid-field",
      path: "$.options.title",
    });
    expect(reads).toBe(0);
  });

  it("projects the scene into a text-canonical SceneDocument", () => {
    const composed = composedFixture();
    const validated = validateDocument(composed.document);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.document.id).toBe("bay-scene");

    const roundTripped = composedSceneFromDocumentData(validated.document.data);
    expect(roundTripped.ok).toBe(true);
    if (!roundTripped.ok) return;
    expect(roundTripped.value.evidence.sceneDigest).toBe(composed.sceneDigest);
    expect(Object.keys(validated.document.data)).toEqual([
      COMPOSED_SCENE_DOCUMENT_DATA_KEY,
    ]);

    const titled = sceneDocumentFromComposedScene(composed.scene, {
      documentId: "bay-demo",
      title: "Bay demo",
    });
    expect(titled).toMatchObject({ id: "bay-demo", title: "Bay demo" });

    expect(
      refusal(
        composeScene(intakeFixture(), artifacts, { documentId: "Bad Id" }),
        "invalid document id",
      ),
    ).toEqual({
      code: "invalid-field",
      path: "$.options.documentId",
    });
    expect(() =>
      sceneDocumentFromComposedScene(composed.scene, {
        documentId: "Bad Id",
      }),
    ).toThrow(TypeError);
  });

  it("reports renderer-neutral root refusals at the supplied artifact path", () => {
    const offsetDrone = artifactFixture(
      "drone-artifact",
      transform([1, 0, 0]),
    );
    expect(
      refusal(
        composeScene(intakeFixture(), [crateArtifact, offsetDrone]),
        "offset artifact root",
      ),
    ).toEqual({
      code: "invalid-artifact",
      path: "$.artifacts[1].runtimeHierarchy.nodes[0].transform",
    });
  });

  it("is byte-deterministic across repeated composition", () => {
    const first = composedFixture();
    const second = composedFixture();
    expect(second.sceneBytes).toBe(first.sceneBytes);
    expect(second.sceneDigest).toBe(first.sceneDigest);
    expect(second.document).toEqual(first.document);
  });

  it("serializes canonically and round-trips through its own validator", () => {
    const composed = composedFixture();
    expect(composed.sceneBytes.endsWith("\n")).toBe(true);
    expect(composed.sceneBytes).toBe(serializeComposedScene(composed.scene));
    expect(composed.sceneBytes.startsWith('{"evidence":')).toBe(true);

    const parsed: unknown = JSON.parse(composed.sceneBytes);
    const revalidated = validateComposedScene(parsed);
    expect(revalidated.ok).toBe(true);
    if (!revalidated.ok) return;
    expect(revalidated.value.evidence.sceneDigest).toBe(composed.sceneDigest);
  });
});
