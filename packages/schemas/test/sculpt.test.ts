import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as schemas from "@sceneaxi/schemas";
import {
  OBJECT_SCULPT_SPEC_KIND,
  SCULPT_PROCEDURAL_EXPORT_NAME,
  SCULPT_PROCEDURAL_MODULE_ID,
  SCULPT_PROCEDURAL_SOURCE_DIGEST,
  SCULPT_ARTIFACT_KIND,
  SCULPT_INTAKE_KIND,
  SCULPT_SCHEMA_VERSION,
  contracts,
  digestObjectSculptSpec,
  isSculptQualityObjectSculptSpec,
  normalizeObjectSculptSpec,
  projectAnimationReadyHierarchy,
  validateObjectSculptSpec,
  validateSculptArtifact,
  validateSculptIntake,
  validateSculptProceduralEmit,
  validateSculptQualityArtifact,
  validateSculptQualityObjectSculptSpec,
  type LegacyObjectSculptSpec,
  type ObjectSculptSpec,
  type SculptArtifact,
  type SculptDiagnosticCode,
  type SculptQualityArtifact,
  type SculptQualityObjectSculptSpec,
  type SculptQualityRuntimeHierarchy,
  type SculptProceduralModuleRef,
  type SculptRuntimeHierarchy,
} from "@sceneaxi/schemas";

interface LegacySculptArtifactExtension extends SculptArtifact {
  readonly consumerTag: string;
}

interface LegacyObjectSculptSpecExtension extends ObjectSculptSpec {
  readonly consumerTag: string;
}

interface LegacySculptProceduralModuleRefExtension
  extends SculptProceduralModuleRef {
  readonly consumerTag: string;
}

function exhaustLegacySculptDiagnostic(code: SculptDiagnosticCode) {
  switch (code) {
    case "not-object":
    case "schema-major-mismatch":
    case "invalid-kind":
    case "missing-field":
    case "unexpected-field":
    case "invalid-mode":
    case "invalid-field":
    case "duplicate-id":
    case "invalid-reference":
    case "invalid-hierarchy":
      return code;
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}

const digest = (character: string) => `sha256:${character.repeat(64)}`;

const transform = {
  translation: [0, 0, 0],
  rotationEulerDegrees: [0, 0, 0],
  scale: [1, 1, 1],
} as const;

const qualityPasses = [
  { id: "blockout", deterministic: true, steps: ["establish-volume"] },
  { id: "structure", deterministic: true, steps: ["place-components"] },
  { id: "materials", deterministic: true, steps: ["assign-materials"] },
  { id: "sockets", deterministic: true, steps: ["bind-sockets"] },
] as const;

const fixtureSpec = {
  schemaVersion: SCULPT_SCHEMA_VERSION,
  kind: OBJECT_SCULPT_SPEC_KIND,
  id: "fixture-crate",
  rootNodeId: "crate-body",
  complexityClass: "simple",
  passes: qualityPasses,
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
    {
      id: "lid-attachment",
      nodeId: "crate-lid",
      kind: "attachment",
      axis: "x",
      amplitude: 0,
      frequencyHz: 0,
    },
  ],
} as const satisfies ObjectSculptSpec;

function nonTrivialFixtureSpec(): SculptQualityObjectSculptSpec {
  return {
    ...fixtureSpec,
    complexityClass: "non-trivial",
    materials: [
      ...fixtureSpec.materials,
      { id: "metal", baseColor: "#555b63", metallic: 0.8, roughness: 0.3 },
    ],
    components: [
      ...fixtureSpec.components,
      { id: "latch", primitive: "cylinder", dimensions: [0.2, 0.4, 0.2], materialId: "metal" },
    ],
    hierarchy: [
      ...fixtureSpec.hierarchy,
      {
        id: "crate-latch",
        parentId: "crate-lid",
        componentId: "latch",
        transform: { ...transform, translation: [0, 0, 1] },
      },
    ],
    detailInventory: {
      silhouetteFeatures: ["raised-lid", "front-latch"],
      structuralFeatures: ["crate-body", "hinged-lid", "latch-housing"],
      surfaceFeatures: ["wood-panels", "metal-latch"],
      materialIds: ["wood", "metal"],
      socketIds: ["lid-hinge"],
    },
  };
}

function fixtureArtifact(): SculptQualityArtifact {
  const emitted = validateSculptProceduralEmit(fixtureSpec, { seed: 0 });
  if (!emitted.ok) throw new Error(emitted.diagnostics[0]?.message);
  return {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: SCULPT_ARTIFACT_KIND,
    artifactId: "fixture-crate-artifact",
    spec: fixtureSpec,
    proceduralModule: {
      moduleId: SCULPT_PROCEDURAL_MODULE_ID,
      exportName: SCULPT_PROCEDURAL_EXPORT_NAME,
      sourceDigest: SCULPT_PROCEDURAL_SOURCE_DIGEST,
      seed: 0,
      emitDigest: emitted.value.digest,
    },
    runtimeHierarchy: projectAnimationReadyHierarchy(fixtureSpec),
    evidence: {
      method: "structured-fixture",
      intakeDigest: digest("a"),
      specDigest: digestObjectSculptSpec(fixtureSpec),
      proceduralModuleDigest: SCULPT_PROCEDURAL_SOURCE_DIGEST,
      qualityGates: [
        { id: "contract", status: "passed", digest: digest("d") },
        { id: "procedural-emit", status: "passed", digest: emitted.value.digest },
      ],
    },
  };
}

function reverseMemberOrder<Value extends object>(value: Value): Value {
  return Object.fromEntries(Object.entries(value).reverse()) as Value;
}

function sparseCopy<Value>(values: readonly Value[]) {
  const sparse = [...values];
  Reflect.deleteProperty(sparse, 0);
  return sparse;
}

describe("hybrid sculpt contracts", () => {
  it("keeps concrete procedural computation off the schemas package root", () => {
    expect("computeSculptProceduralEmit" in schemas).toBe(false);
    expect(validateSculptProceduralEmit(fixtureSpec, { seed: -1 })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "invalid-field", path: "$.seed" }],
    });
  });

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

  it("preserves and explicitly normalizes legacy PR 75 specs", () => {
    const legacy = Object.fromEntries(
      Object.entries(fixtureSpec).filter(
        ([key]) => key !== "complexityClass" && key !== "passes",
      ),
    ) as unknown as LegacyObjectSculptSpec;
    const extendedLegacy: LegacyObjectSculptSpecExtension = {
      ...legacy,
      consumerTag: "legacy-consumer",
    };
    const extendedModule: LegacySculptProceduralModuleRefExtension = {
      moduleId: "sceneaxi/procedural/crate",
      exportName: "buildCrate",
      sourceDigest: digest("b"),
      consumerTag: "legacy-consumer",
    };
    expect(extendedLegacy.consumerTag).toBe("legacy-consumer");
    expect(extendedModule.consumerTag).toBe("legacy-consumer");
    expect(validateObjectSculptSpec(legacy)).toEqual({
      ok: true,
      value: legacy,
    });

    const normalized = normalizeObjectSculptSpec(legacy);
    expect(normalized.passes.map((pass) => pass.id)).toEqual([
      "blockout",
      "structure",
      "materials",
      "sockets",
    ]);
    expect(normalized.complexityClass).toBe("simple");
    expect(normalized.sockets.some((socket) => socket.kind === "attachment")).toBe(
      true,
    );

    const legacyRuntimeHierarchy = {
      rootNodeId: legacy.rootNodeId,
      nodes: legacy.hierarchy,
    } satisfies SculptRuntimeHierarchy;
    const qualityRuntimeHierarchy: SculptQualityRuntimeHierarchy =
      projectAnimationReadyHierarchy(normalized);
    expect(qualityRuntimeHierarchy.kind).toBe(
      "sceneaxi.animation-ready-hierarchy",
    );

    const legacyArtifact: SculptArtifact = {
      schemaVersion: 1,
      kind: SCULPT_ARTIFACT_KIND,
      artifactId: "legacy-crate-artifact",
      spec: legacy,
      proceduralModule: {
        moduleId: "sceneaxi/legacy-crate",
        exportName: "buildLegacyCrate",
        sourceDigest: digest("c"),
      },
      runtimeHierarchy: legacyRuntimeHierarchy,
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
    expect(validateSculptArtifact(legacyArtifact)).toEqual({
      ok: true,
      value: legacyArtifact,
    });
    const extended: LegacySculptArtifactExtension = {
      ...legacyArtifact,
      consumerTag: "legacy-consumer",
    };
    const annotatedSpec: SculptArtifact["spec"] = legacy;
    const annotatedModule: SculptArtifact["proceduralModule"] =
      legacyArtifact.proceduralModule;
    const annotatedRuntime: SculptArtifact["runtimeHierarchy"] =
      legacyRuntimeHierarchy;
    expect([
      extended.consumerTag,
      annotatedSpec.id,
      annotatedModule.moduleId,
      annotatedRuntime.rootNodeId,
    ]).toEqual([
      "legacy-consumer",
      "fixture-crate",
      "sceneaxi/legacy-crate",
      "crate-body",
    ]);
    expect(validateSculptQualityArtifact(legacyArtifact)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "invalid-field", path: "$.spec" }],
    });
    expect(validateSculptQualityArtifact(fixtureArtifact())).toEqual({
      ok: true,
      value: fixtureArtifact(),
    });
  });

  it("narrows only complete sculpt-quality field correlations", () => {
    const nonTrivial = nonTrivialFixtureSpec();
    const partials = [
      Object.fromEntries(
        Object.entries(fixtureSpec).filter(
          ([key]) => key !== "complexityClass",
        ),
      ),
      Object.fromEntries(
        Object.entries(fixtureSpec).filter(([key]) => key !== "passes"),
      ),
      { ...fixtureSpec, complexityClass: "non-trivial" },
      Object.fromEntries(
        Object.entries(nonTrivial).filter(([key]) => key !== "passes"),
      ),
      Object.fromEntries(
        Object.entries(nonTrivial).filter(
          ([key]) => key !== "complexityClass",
        ),
      ),
    ] as ObjectSculptSpec[];

    expect(isSculptQualityObjectSculptSpec(fixtureSpec)).toBe(true);
    expect(isSculptQualityObjectSculptSpec(nonTrivial)).toBe(true);

    for (const partial of partials) {
      expect(isSculptQualityObjectSculptSpec(partial)).toBe(false);
      const normalized = normalizeObjectSculptSpec(partial);
      expect(isSculptQualityObjectSculptSpec(normalized)).toBe(true);
      expect(normalized.complexityClass).toBe("simple");
      expect(normalized.passes.map((pass) => pass.id)).toEqual([
        "blockout",
        "structure",
        "materials",
        "sockets",
      ]);
    }
  });

  it("publishes closed ordered pass sequences in the authoritative schema", () => {
    const schema = JSON.parse(
      readFileSync(
        new URL("../contracts/object-sculpt-spec.schema.json", import.meta.url),
        "utf8",
      ),
    ) as {
      oneOf: Array<{
        properties?: {
          passes?: {
            oneOf?: Array<{
              prefixItems: Array<{ $ref: string }>;
            }>;
          };
        };
      }>;
    };
    const sequences = schema.oneOf
      .flatMap((branch) => branch.properties?.passes?.oneOf ?? [])
      .map((sequence) =>
        sequence.prefixItems.map((item) => item.$ref.split("/").at(-1)),
      );
    expect(sequences).toEqual([
      ["blockoutPass", "structurePass", "materialsPass", "socketsPass"],
      [
        "blockoutPass",
        "structurePass",
        "materialsPass",
        "surfaceDetailPass",
        "socketsPass",
      ],
    ]);
  });

  it("aligns inventory strings and procedural seeds with runtime validation", () => {
    const specSchema = JSON.parse(
      readFileSync(
        new URL("../contracts/object-sculpt-spec.schema.json", import.meta.url),
        "utf8",
      ),
    ) as {
      $defs: {
        trimmedNonBlank: { pattern: string };
        detailInventory: {
          properties: Record<string, { items: { $ref: string } }>;
        };
      };
    };
    const artifactSchema = JSON.parse(
      readFileSync(
        new URL("../contracts/sculpt-artifact.schema.json", import.meta.url),
        "utf8",
      ),
    ) as {
      $defs: {
        qualityProceduralModule: {
          properties: {
            seed: { type: string; minimum: number; maximum: number };
            sourceDigest: { const: string };
          };
        };
      };
    };
    const trimmedNonBlank = new RegExp(
      specSchema.$defs.trimmedNonBlank.pattern,
    );

    expect(trimmedNonBlank.test("raised lid")).toBe(true);
    expect(trimmedNonBlank.test(" raised lid")).toBe(false);
    expect(trimmedNonBlank.test("raised lid ")).toBe(false);
    for (const field of [
      "silhouetteFeatures",
      "structuralFeatures",
      "surfaceFeatures",
    ]) {
      expect(
        specSchema.$defs.detailInventory.properties[field]?.items.$ref,
      ).toBe("#/$defs/trimmedNonBlank");
    }
    expect(
      artifactSchema.$defs.qualityProceduralModule.properties.seed,
    ).toEqual({
      type: "integer",
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    });
    expect(
      artifactSchema.$defs.qualityProceduralModule.properties.sourceDigest,
    ).toEqual({ const: SCULPT_PROCEDURAL_SOURCE_DIGEST });
  });

  it("accepts the required multi-pass order and a reference-checked non-trivial inventory", () => {
    const base = nonTrivialFixtureSpec();
    const spec = {
      ...base,
      passes: [
        ...base.passes.slice(0, 3),
        { id: "surface-detail", deterministic: true as const, steps: ["bevel-edges"] },
        qualityPasses[3],
      ],
    };
    expect(validateObjectSculptSpec(spec)).toEqual({ ok: true, value: spec });
  });

  it.each([
    [
      "missing pass ledger",
      Object.fromEntries(
        Object.entries(fixtureSpec).filter(([key]) => key !== "passes"),
      ),
      "missing-sculpt-pass",
    ],
    [
      "missing required pass",
      { ...fixtureSpec, passes: qualityPasses.slice(0, 3) },
      "missing-sculpt-pass",
    ],
    [
      "out-of-order required passes",
      { ...fixtureSpec, passes: [...qualityPasses].reverse() },
      "out-of-order-sculpt-pass",
    ],
    [
      "empty pass",
      {
        ...fixtureSpec,
        passes: qualityPasses.map((pass) =>
          pass.id === "materials" ? { ...pass, steps: [] } : pass,
        ),
      },
      "empty-sculpt-pass",
    ],
    [
      "missing attachment socket",
      {
        ...fixtureSpec,
        sockets: fixtureSpec.sockets.filter(
          (socket) => socket.kind !== "attachment",
        ),
      },
      "missing-attachment-socket",
    ],
    [
      "missing non-trivial inventory",
      { ...fixtureSpec, complexityClass: "non-trivial" },
      "missing-detail-inventory",
    ],
    [
      "shallow non-trivial inventory",
      {
        ...nonTrivialFixtureSpec(),
        detailInventory: {
          silhouetteFeatures: ["raised-lid"],
          structuralFeatures: ["crate-body"],
          surfaceFeatures: ["wood-panels"],
          materialIds: ["wood"],
          socketIds: [],
        },
      },
      "shallow-detail-inventory",
    ],
    [
      "shallow non-trivial spec",
      {
        ...nonTrivialFixtureSpec(),
        components: fixtureSpec.components,
        hierarchy: fixtureSpec.hierarchy,
      },
      "shallow-sculpt-spec",
    ],
  ])("refuses %s with a stable quality code", (_name, spec, code) => {
    const result = validateSculptQualityObjectSculptSpec(spec);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe(code);
  });

  it("keeps legacy diagnostics exhaustive beside quality diagnostics", () => {
    expect(exhaustLegacySculptDiagnostic("invalid-hierarchy")).toBe(
      "invalid-hierarchy",
    );
    const quality = validateSculptQualityObjectSculptSpec({
      ...fixtureSpec,
      passes: qualityPasses.slice(0, 3),
    });
    expect(quality).toMatchObject({
      ok: false,
      diagnostics: [{ code: "missing-sculpt-pass" }],
    });
    expect(
      validateObjectSculptSpec({
        ...fixtureSpec,
        passes: qualityPasses.slice(0, 3),
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "invalid-field" }],
    });
  });

  it("refuses sparse holes in every required quality inventory", () => {
    const sparsePasses = [...qualityPasses];
    Reflect.deleteProperty(sparsePasses, 1);
    const steps = ["establish-volume"];
    Reflect.deleteProperty(steps, 0);
    const sparseSteps = qualityPasses.map((pass, index) =>
      index === 0 ? { ...pass, steps } : pass,
    );
    const sparseInventory = structuredClone(
      nonTrivialFixtureSpec(),
    ) as SculptQualityArtifact["spec"];
    const silhouetteFeatures = [
      ...(sparseInventory.detailInventory?.silhouetteFeatures ?? []),
    ];
    Reflect.deleteProperty(silhouetteFeatures, 0);

    for (const spec of [
      { ...fixtureSpec, passes: sparsePasses },
      { ...fixtureSpec, passes: sparseSteps },
      { ...fixtureSpec, materials: sparseCopy(fixtureSpec.materials) },
      { ...fixtureSpec, components: sparseCopy(fixtureSpec.components) },
      { ...fixtureSpec, hierarchy: sparseCopy(fixtureSpec.hierarchy) },
      { ...fixtureSpec, sockets: sparseCopy(fixtureSpec.sockets) },
      {
        ...sparseInventory,
        detailInventory: {
          ...sparseInventory.detailInventory,
          silhouetteFeatures,
        },
      },
    ]) {
      expect(validateObjectSculptSpec(spec).ok).toBe(false);
    }
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

  it("validates a deep hierarchy without repeated ancestor walks", () => {
    const deep = structuredClone(fixtureSpec) as unknown as {
      rootNodeId: string;
      hierarchy: Array<{
        id: string;
        parentId: string | null;
        componentId: string;
        transform: typeof transform;
      }>;
      sockets: Array<{
        id: string;
        nodeId: string;
        kind: "attachment";
        axis: "y";
        amplitude: number;
        frequencyHz: number;
      }>;
    };
    deep.rootNodeId = "node-0";
    deep.hierarchy = Array.from({ length: 5_000 }, (_, index) => ({
      id: `node-${index}`,
      parentId: index === 0 ? null : `node-${index - 1}`,
      componentId: "body",
      transform,
    }));
    deep.sockets = [
      {
        id: "root-attachment",
        nodeId: "node-0",
        kind: "attachment",
        axis: "y",
        amplitude: 0,
        frequencyHz: 0,
      },
    ];

    expect(validateObjectSculptSpec(deep)).toEqual({ ok: true, value: deep });
  });

  it("accepts a package whose runtime graph and evidence bind the spec", () => {
    const artifact = fixtureArtifact();
    expect(validateSculptArtifact(artifact)).toEqual({ ok: true, value: artifact });
  });

  it("accepts semantic runtime projections with reordered object members", () => {
    const artifact = fixtureArtifact();
    const runtimeHierarchy = {
      ...artifact.runtimeHierarchy,
      nodes: artifact.runtimeHierarchy.nodes.map((node) =>
        reverseMemberOrder({
          ...node,
          transform: reverseMemberOrder({ ...node.transform }),
        }),
      ),
      pivots: artifact.runtimeHierarchy.pivots.map((pivot) =>
        reverseMemberOrder({ ...pivot }),
      ),
      sockets: artifact.runtimeHierarchy.sockets.map((socket) =>
        reverseMemberOrder({ ...socket }),
      ),
      colliders: artifact.runtimeHierarchy.colliders.map((collider) =>
        reverseMemberOrder({ ...collider }),
      ),
      materials: artifact.runtimeHierarchy.materials.map((material) =>
        reverseMemberOrder({ ...material }),
      ),
      attachments: artifact.runtimeHierarchy.attachments.map((attachment) =>
        reverseMemberOrder({ ...attachment }),
      ),
    };
    const reordered = { ...artifact, runtimeHierarchy };

    expect(validateSculptArtifact(reordered)).toEqual({
      ok: true,
      value: reordered,
    });
  });

  it("returns an immutable runtime projection detached from its spec", () => {
    const mutableSpec = structuredClone(fixtureSpec);
    const runtimeHierarchy = projectAnimationReadyHierarchy(mutableSpec);
    const runtimeNode = runtimeHierarchy.nodes[0];
    const runtimePivot = runtimeHierarchy.pivots[0];
    const runtimeCollider = runtimeHierarchy.colliders[0];
    expect(runtimeNode).toBeDefined();
    expect(runtimePivot).toBeDefined();
    expect(runtimeCollider).toBeDefined();
    if (
      runtimeNode === undefined ||
      runtimePivot === undefined ||
      runtimeCollider === undefined
    ) {
      return;
    }

    expect(Reflect.set(mutableSpec.hierarchy[0]!.transform.translation, 0, 99)).toBe(true);
    expect(Reflect.set(mutableSpec.components[0]!.dimensions, 0, 99)).toBe(true);
    expect(runtimeNode.transform.translation).toEqual([0, 0, 0]);
    expect(runtimeCollider.dimensions).toEqual([2, 2, 2]);
    expect(Reflect.set(runtimePivot.origin, 0, 99)).toBe(false);
    expect(Object.isFrozen(runtimeHierarchy)).toBe(true);
    expect(Object.isFrozen(runtimeHierarchy.nodes)).toBe(true);
    expect(Object.isFrozen(runtimeNode)).toBe(true);
    expect(Object.isFrozen(runtimeNode.transform)).toBe(true);
    expect(Object.isFrozen(runtimeNode.transform.translation)).toBe(true);
    expect(Object.isFrozen(runtimeHierarchy.pivots)).toBe(true);
    expect(Object.isFrozen(runtimePivot)).toBe(true);
    expect(Object.isFrozen(runtimePivot.origin)).toBe(true);
    expect(Object.isFrozen(runtimeHierarchy.sockets)).toBe(true);
    expect(Object.isFrozen(runtimeHierarchy.colliders)).toBe(true);
    expect(Object.isFrozen(runtimeCollider)).toBe(true);
    expect(Object.isFrozen(runtimeCollider.dimensions)).toBe(true);
    expect(Object.isFrozen(runtimeHierarchy.materials)).toBe(true);
    expect(Object.isFrozen(runtimeHierarchy.attachments)).toBe(true);
  });

  it("refuses sparse runtime projection arrays", () => {
    const artifact = structuredClone(fixtureArtifact());
    const sparsePivots = [...artifact.runtimeHierarchy.pivots];
    delete sparsePivots[0];
    const result = validateSculptArtifact({
      ...artifact,
      runtimeHierarchy: {
        ...artifact.runtimeHierarchy,
        pivots: sparsePivots,
      },
    });

    expect(result.ok).toBe(false);
  });

  it.each([
    ["pivots", "missing-runtime-pivot"],
    ["sockets", "missing-runtime-socket"],
    ["colliders", "missing-runtime-collider"],
    ["materials", "missing-runtime-material"],
    ["attachments", "missing-runtime-attachment"],
  ] as const)("refuses incomplete animation-ready %s with a stable code", (field, code) => {
    const artifact = structuredClone(fixtureArtifact());
    const result = validateSculptQualityArtifact({
      ...artifact,
      runtimeHierarchy: { ...artifact.runtimeHierarchy, [field]: [] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe(code);
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

    const emitDrift = structuredClone(fixtureArtifact());
    const emitResult = validateSculptArtifact({
      ...emitDrift,
      proceduralModule: { ...emitDrift.proceduralModule, emitDigest: digest("f") },
    });
    expect(emitResult.ok).toBe(false);
    if (!emitResult.ok) expect(emitResult.diagnostics[0]?.code).toBe("invalid-reference");

    const fabricated = structuredClone(fixtureArtifact());
    Reflect.set(fabricated.proceduralModule, "emitDigest", digest("f"));
    const proceduralGate = fabricated.evidence.qualityGates.find(
      (gate) => gate.id === "procedural-emit",
    );
    expect(proceduralGate).toBeDefined();
    if (proceduralGate === undefined) return;
    Reflect.set(proceduralGate, "digest", digest("f"));
    const fabricatedResult = validateSculptArtifact(fabricated);
    expect(fabricatedResult.ok).toBe(false);
    if (!fabricatedResult.ok) {
      expect(fabricatedResult.diagnostics[0]?.code).toBe("invalid-reference");
    }
  });

  it("contains no renderer-specific public field vocabulary", () => {
    const surface = JSON.stringify(fixtureArtifact()).toLowerCase();
    expect(surface).not.toContain("three");
    expect(surface).not.toContain("object3d");
    expect(surface).not.toContain("meshstandardmaterial");
  });
});
