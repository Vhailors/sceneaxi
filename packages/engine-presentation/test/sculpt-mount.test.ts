import { readFileSync } from "node:fs";
import { BufferGeometry, Material, Vector3 } from "three";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  EXPERIMENTAL_THREE_NON_DECISION_LABEL,
  SculptMountError,
  createExperimentalThreeSculptPresentationBackend,
  createNullSculptPresentationBackend,
  createSculptMountApi,
  type SculptMountApi,
} from "@sceneaxi/engine-presentation";
import {
  OBJECT_SCULPT_SPEC_KIND,
  SCULPT_ARTIFACT_KIND,
  SCULPT_SCHEMA_VERSION,
  type SculptArtifact,
} from "@sceneaxi/schemas";

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const transform = {
  translation: [0, 0, 0],
  rotationEulerDegrees: [0, 0, 0],
  scale: [1, 1, 1],
} as const;

function fixtureArtifact(): SculptArtifact {
  const hierarchy = [
    { id: "crate", parentId: null, componentId: "body", transform },
    {
      id: "cap",
      parentId: "crate",
      componentId: "cap",
      transform: { ...transform, translation: [0, 1.25, 0] },
    },
  ] as const;
  return {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: SCULPT_ARTIFACT_KIND,
    artifactId: "fixture-crate-artifact",
    spec: {
      schemaVersion: SCULPT_SCHEMA_VERSION,
      kind: OBJECT_SCULPT_SPEC_KIND,
      id: "fixture-crate",
      rootNodeId: "crate",
      materials: [
        { id: "wood", baseColor: "#885522", metallic: 0, roughness: 0.8 },
      ],
      components: [
        { id: "body", primitive: "box", dimensions: [2, 2, 2], materialId: "wood" },
        { id: "cap", primitive: "cylinder", dimensions: [1, 0.5, 1], materialId: "wood" },
      ],
      hierarchy,
      sockets: [],
    },
    proceduralModule: {
      moduleId: "sceneaxi/fixture-crate",
      exportName: "buildFixtureCrate",
      sourceDigest: digest("c"),
    },
    runtimeHierarchy: { rootNodeId: "crate", nodes: hierarchy },
    evidence: {
      method: "structured-fixture",
      intakeDigest: digest("a"),
      specDigest: digest("b"),
      proceduralModuleDigest: digest("c"),
      qualityGates: [{ id: "contract", status: "passed", digest: digest("d") }],
    },
  };
}

describe("Sculpt Mount API", () => {
  it("mounts, updates, lists, renders, and removes through the null path", () => {
    const mounts = createSculptMountApi(createNullSculptPresentationBackend());
    mounts.mount({ instanceId: "crate-one", artifact: fixtureArtifact() });
    expect(mounts.list().map((instance) => instance.instanceId)).toEqual(["crate-one"]);
    expect(mounts.render()).toMatchObject({ backend: "null", drawCalls: 0 });

    const updated = mounts.updateTransform("crate-one", {
      ...transform,
      translation: [3, 0, -1],
    });
    expect(updated.transform.translation).toEqual([3, 0, -1]);
    mounts.unmount("crate-one");
    expect(mounts.list()).toEqual([]);
    mounts.dispose();
  });

  it("renders mounted primitives through an actual experimental Three scene", () => {
    const mounts = createSculptMountApi(
      createExperimentalThreeSculptPresentationBackend(),
    );
    mounts.mount({ instanceId: "crate-one", artifact: fixtureArtifact() });
    const frame = mounts.render();
    expect(frame).toEqual({
      backend: "experimental-three",
      label: EXPERIMENTAL_THREE_NON_DECISION_LABEL,
      frame: 1,
      instanceIds: ["crate-one"],
      drawCalls: 2,
    });
    expect(frame.label).toContain("non-decision");
    expect(frame.label).toContain("Stage 1 has not run");
    mounts.dispose();
  });

  it("updates instance transforms without rebuilding mounted primitives", () => {
    const geometryDispose = vi.spyOn(BufferGeometry.prototype, "dispose");
    const materialDispose = vi.spyOn(Material.prototype, "dispose");
    const vectorSet = vi.spyOn(Vector3.prototype, "set");
    const mounts = createSculptMountApi(
      createExperimentalThreeSculptPresentationBackend(),
    );
    mounts.mount({ instanceId: "crate-one", artifact: fixtureArtifact() });
    vectorSet.mockClear();

    mounts.updateTransform("crate-one", {
      ...transform,
      translation: [3, 0, -1],
    });

    expect(vectorSet).toHaveBeenCalledTimes(2);
    expect(vectorSet).toHaveBeenNthCalledWith(1, 3, 0, -1);
    expect(vectorSet).toHaveBeenNthCalledWith(2, 1, 1, 1);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();

    mounts.unmount("crate-one");
    expect(geometryDispose).toHaveBeenCalledTimes(2);
    expect(materialDispose).toHaveBeenCalledTimes(2);
    mounts.dispose();
  });

  it("fails closed for invalid artifacts and duplicate instance ids", () => {
    const mounts = createSculptMountApi(createNullSculptPresentationBackend());
    const artifact = fixtureArtifact();
    mounts.mount({ instanceId: "crate-one", artifact });
    expect(() => mounts.mount({ instanceId: "crate-one", artifact })).toThrow(
      new SculptMountError("already-mounted", 'Sculpt instance "crate-one" is already mounted.'),
    );
    expect(() =>
      createSculptMountApi(createNullSculptPresentationBackend()).mount({
        instanceId: "bad",
        artifact: { ...artifact, schemaVersion: 2 } as unknown as SculptArtifact,
      }),
    ).toThrow(SculptMountError);
    mounts.dispose();
  });

  it("keeps renderer library types out of the public Mount API", () => {
    expectTypeOf<Parameters<SculptMountApi["mount"]>[0]>().not.toBeAny();
    const publicIndex = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(publicIndex).not.toMatch(/from ["']three["']/);
    expect(publicIndex).not.toContain("Object3D");
    expect(publicIndex).not.toContain("Mesh");
  });
});
