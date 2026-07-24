import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  OBJECT_SCULPT_SPEC_KIND,
  SCULPT_ARTIFACT_KIND,
  SCULPT_INTAKE_KIND,
  SCULPT_SCHEMA_VERSION,
  contracts,
  validateObjectSculptSpec,
  validateSculptArtifact,
  validateSculptIntake,
  type ObjectSculptSpec,
  type SculptArtifact,
} from "@sceneaxi/schemas";

const digest = (character: string) => `sha256:${character.repeat(64)}`;

const transform = {
  translation: [0, 0, 0],
  rotationEulerDegrees: [0, 0, 0],
  scale: [1, 1, 1],
} as const;

const fixtureSpec = {
  schemaVersion: SCULPT_SCHEMA_VERSION,
  kind: OBJECT_SCULPT_SPEC_KIND,
  id: "fixture-crate",
  rootNodeId: "crate-body",
  materials: [
    { id: "wood", baseColor: "#9b6a3c", metallic: 0, roughness: 0.8 },
  ],
  components: [
    { id: "body", primitive: "box", dimensions: [2, 2, 2], materialId: "wood" },
    { id: "lid", primitive: "box", dimensions: [2, 0.25, 2], materialId: "wood" },
  ],
  hierarchy: [
    { id: "crate-body", parentId: null, componentId: "body", transform },
    {
      id: "crate-lid",
      parentId: "crate-body",
      componentId: "lid",
      transform: { ...transform, translation: [0, 1.125, 0] },
    },
  ],
  sockets: [
    {
      id: "lid-hinge",
      nodeId: "crate-lid",
      kind: "animation",
      axis: "x",
      amplitude: 30,
      frequencyHz: 0.5,
    },
  ],
} as const satisfies ObjectSculptSpec;

function fixtureArtifact(): SculptArtifact {
  return {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: SCULPT_ARTIFACT_KIND,
    artifactId: "fixture-crate-artifact",
    spec: fixtureSpec,
    proceduralModule: {
      moduleId: "sceneaxi/fixture-crate",
      exportName: "buildFixtureCrate",
      sourceDigest: digest("c"),
    },
    runtimeHierarchy: {
      rootNodeId: fixtureSpec.rootNodeId,
      nodes: fixtureSpec.hierarchy,
    },
    evidence: {
      method: "structured-fixture",
      intakeDigest: digest("a"),
      specDigest: digest("b"),
      proceduralModuleDigest: digest("c"),
      qualityGates: [
        { id: "contract", status: "passed", digest: digest("d") },
      ],
    },
  };
}

describe("hybrid sculpt contracts", () => {
  it("ships three versioned public JSON Schemas", () => {
    for (const [path, expectedId] of [
      [contracts.sculptIntake, "https://sceneaxi.invalid/contracts/sculpt-intake/v1"],
      [contracts.objectSculptSpec, "https://sceneaxi.invalid/contracts/object-sculpt-spec/v1"],
      [contracts.sculptArtifact, "https://sceneaxi.invalid/contracts/sculpt-artifact/v1"],
    ] as const) {
      const schema = JSON.parse(
        readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
      ) as { $id: string };
      expect(schema.$id).toBe(expectedId);
    }
  });

  it("keeps public non-blank intake strings aligned with runtime validation", () => {
    const schema = JSON.parse(
      readFileSync(new URL("../contracts/sculpt-intake.schema.json", import.meta.url), "utf8"),
    ) as {
      $defs: { image: { properties: { uri: { pattern: string } } } };
      oneOf: Array<{ properties?: { brief?: { pattern: string } } }>;
    };
    expect(schema.$defs.image.properties.uri.pattern).toBe("\\S");
    expect(
      schema.oneOf.flatMap((variant) =>
        variant.properties?.brief === undefined ? [] : [variant.properties.brief.pattern],
      ),
    ).toEqual(["\\S", "\\S"]);

    for (const intake of [
      {
        schemaVersion: 1,
        kind: SCULPT_INTAKE_KIND,
        intakeId: "blank-uri",
        mode: "image",
        image: { mediaType: "image/png", uri: " \t ", digest: digest("1") },
      },
      {
        schemaVersion: 1,
        kind: SCULPT_INTAKE_KIND,
        intakeId: "blank-brief",
        mode: "image+brief",
        image: { mediaType: "image/png", uri: "fixture.png", digest: digest("2") },
        brief: "\n ",
      },
      {
        schemaVersion: 1,
        kind: SCULPT_INTAKE_KIND,
        intakeId: "blank-multi-view-brief",
        mode: "multi-view",
        images: [
          { mediaType: "image/png", uri: "front.png", digest: digest("3") },
          { mediaType: "image/png", uri: "side.png", digest: digest("4") },
        ],
        brief: " ",
      },
    ]) {
      expect(validateSculptIntake(intake).ok).toBe(false);
    }
  });

  it("accepts the complete ObjectSculptSpec component/material/socket/hierarchy graph", () => {
    expect(validateObjectSculptSpec(fixtureSpec)).toEqual({
      ok: true,
      value: fixtureSpec,
    });
  });

  it.each([
    {
      schemaVersion: 1,
      kind: SCULPT_INTAKE_KIND,
      intakeId: "single-image",
      mode: "image",
      image: { mediaType: "image/png", uri: "fixture.png", digest: digest("1") },
    },
    {
      schemaVersion: 1,
      kind: SCULPT_INTAKE_KIND,
      intakeId: "image-brief",
      mode: "image+brief",
      image: { mediaType: "image/jpeg", uri: "fixture.jpg", digest: digest("2") },
      brief: "A wooden crate with a hinged lid.",
    },
    {
      schemaVersion: 1,
      kind: SCULPT_INTAKE_KIND,
      intakeId: "multi-view",
      mode: "multi-view",
      images: [
        { mediaType: "image/webp", uri: "front.webp", digest: digest("3") },
        { mediaType: "image/webp", uri: "side.webp", digest: digest("4") },
      ],
    },
    {
      schemaVersion: 1,
      kind: SCULPT_INTAKE_KIND,
      intakeId: "structured",
      mode: "structured-spec",
      structuredSpec: fixtureSpec,
    },
  ])("accepts intake mode $mode", (intake) => {
    expect(validateSculptIntake(intake).ok).toBe(true);
  });

  it.each([
    ["unknown mode", { schemaVersion: 1, kind: SCULPT_INTAKE_KIND, intakeId: "bad", mode: "mesh" }, "invalid-mode"],
    ["mode field bleed", { schemaVersion: 1, kind: SCULPT_INTAKE_KIND, intakeId: "bad", mode: "image", image: { mediaType: "image/png", uri: "x", digest: digest("1") }, brief: "not allowed" }, "unexpected-field"],
    ["schema mismatch", { schemaVersion: 2, kind: SCULPT_INTAKE_KIND, intakeId: "bad", mode: "structured-spec", structuredSpec: fixtureSpec }, "schema-major-mismatch"],
    ["sparse views", { schemaVersion: 1, kind: SCULPT_INTAKE_KIND, intakeId: "bad", mode: "multi-view", images: [{ mediaType: "image/png", uri: "x", digest: digest("1") }] }, "invalid-field"],
  ])("refuses %s with a named diagnostic", (_name, intake, code) => {
    const result = validateSculptIntake(intake);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]?.code).toBe(code);
  });

  it("refuses broken spec references and hierarchy cycles", () => {
    const missingMaterial = structuredClone(fixtureSpec) as unknown as {
      components: Array<{ materialId: string }>;
    };
    const firstComponent = missingMaterial.components[0];
    expect(firstComponent).toBeDefined();
    if (firstComponent === undefined) return;
    firstComponent.materialId = "missing";
    const materialResult = validateObjectSculptSpec(missingMaterial);
    expect(materialResult.ok).toBe(false);
    if (!materialResult.ok) expect(materialResult.diagnostics[0]?.code).toBe("invalid-reference");

    const cycle = structuredClone(fixtureSpec) as unknown as {
      hierarchy: Array<{ id: string; parentId: string | null }>;
    };
    const root = cycle.hierarchy[0];
    expect(root).toBeDefined();
    if (root === undefined) return;
    root.parentId = "crate-lid";
    const cycleResult = validateObjectSculptSpec(cycle);
    expect(cycleResult.ok).toBe(false);
    if (!cycleResult.ok) expect(cycleResult.diagnostics[0]?.code).toBe("invalid-hierarchy");
  });

  it("accepts a package whose runtime graph and evidence bind the spec", () => {
    const artifact = fixtureArtifact();
    expect(validateSculptArtifact(artifact)).toEqual({ ok: true, value: artifact });
  });

  it("refuses runtime hierarchy drift and unpassed evidence", () => {
    const drift = structuredClone(fixtureArtifact()) as unknown as {
      runtimeHierarchy: {
        nodes: Array<{ transform: { translation: [number, number, number] } }>;
      };
    };
    drift.runtimeHierarchy.nodes = structuredClone(drift.runtimeHierarchy.nodes);
    const firstRuntimeNode = drift.runtimeHierarchy.nodes[0];
    expect(firstRuntimeNode).toBeDefined();
    if (firstRuntimeNode === undefined) return;
    firstRuntimeNode.transform.translation[0] = 99;
    const driftResult = validateSculptArtifact(drift);
    expect(driftResult.ok).toBe(false);
    if (!driftResult.ok) expect(driftResult.diagnostics[0]?.code).toBe("invalid-hierarchy");

    const failedGate = structuredClone(fixtureArtifact()) as unknown as {
      evidence: { qualityGates: Array<{ status: string }> };
    };
    const gate = failedGate.evidence.qualityGates[0];
    expect(gate).toBeDefined();
    if (gate === undefined) return;
    gate.status = "failed";
    const gateResult = validateSculptArtifact(failedGate);
    expect(gateResult.ok).toBe(false);
    if (!gateResult.ok) expect(gateResult.diagnostics[0]?.code).toBe("invalid-field");
  });

  it("contains no renderer-specific public field vocabulary", () => {
    const surface = JSON.stringify(fixtureArtifact()).toLowerCase();
    expect(surface).not.toContain("three");
    expect(surface).not.toContain("object3d");
    expect(surface).not.toContain("meshstandardmaterial");
  });
});
