import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  reconstructSculpt,
  serializeSculptArtifact,
} from "@sceneaxi/authoring-core";
import {
  OBJECT_SCULPT_SPEC_KIND,
  SCULPT_INTAKE_KIND,
  SCULPT_SCHEMA_VERSION,
  validateSculptArtifact,
  type ObjectSculptSpec,
} from "@sceneaxi/schemas";

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const transform = {
  translation: [0, 0, 0],
  rotationEulerDegrees: [0, 0, 0],
  scale: [1, 1, 1],
} as const;

function fixtureSpec(): ObjectSculptSpec {
  return {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: OBJECT_SCULPT_SPEC_KIND,
    id: "fixture-crate",
    rootNodeId: "crate",
    materials: [
      { id: "wood", baseColor: "#8b5a2b", metallic: 0, roughness: 0.8 },
    ],
    components: [
      { id: "body", primitive: "box", dimensions: [2, 2, 2], materialId: "wood" },
    ],
    hierarchy: [
      { id: "crate", parentId: null, componentId: "body", transform },
    ],
    sockets: [
      {
        id: "crate-bob",
        nodeId: "crate",
        kind: "animation",
        axis: "y",
        amplitude: 0.1,
        frequencyHz: 1,
      },
    ],
  };
}

describe("SceneAxi sculpt reconstruction", () => {
  it("produces byte-stable fixture artifacts and digests", () => {
    const intake = {
      schemaVersion: 1,
      kind: SCULPT_INTAKE_KIND,
      intakeId: "fixture-crate",
      mode: "structured-spec",
      structuredSpec: fixtureSpec(),
    };
    const first = reconstructSculpt(intake);
    const second = reconstructSculpt(structuredClone(intake));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.artifactBytes).toBe(second.artifactBytes);
    expect(first.artifactDigest).toBe(second.artifactDigest);
    expect(serializeSculptArtifact(first.artifact)).toBe(first.artifactBytes);
    expect(first.artifact.evidence.method).toBe("structured-fixture");
    expect(validateSculptArtifact(first.artifact).ok).toBe(true);
  });

  it("turns image+brief intake into an openable demo-grade artifact", () => {
    const result = reconstructSculpt({
      schemaVersion: 1,
      kind: SCULPT_INTAKE_KIND,
      intakeId: "demo-lantern",
      mode: "image+brief",
      image: {
        mediaType: "image/png",
        uri: "fixtures/demo-lantern.png",
        digest: digest("a"),
      },
      brief: "A compact lantern with a warm cap that gently bobs.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.artifactId).toBe("demo-lantern-artifact");
    expect(result.artifact.evidence.method).toBe("image-brief-reconstruction");
    expect(result.artifact.spec.hierarchy).toHaveLength(2);
    expect(result.artifact.spec.sockets).toHaveLength(1);
    expect(validateSculptArtifact(result.artifact).ok).toBe(true);
  });

  it("fails closed with named intake and unsupported-mode refusals", () => {
    expect(reconstructSculpt({ mode: "image+brief" })).toMatchObject({
      ok: false,
      code: "invalid-intake",
    });
    expect(
      reconstructSculpt({
        schemaVersion: 1,
        kind: SCULPT_INTAKE_KIND,
        intakeId: "image-only",
        mode: "image",
        image: { mediaType: "image/png", uri: "x.png", digest: digest("b") },
      }),
    ).toMatchObject({ ok: false, code: "unsupported-intake-mode" });
  });

  it("names the quality gate that refused an otherwise valid spec", () => {
    const spec = fixtureSpec() as {
      components: Array<{
        id: string;
        primitive: "box";
        dimensions: readonly [number, number, number];
        materialId: string;
      }>;
    } & ObjectSculptSpec;
    spec.components = Array.from({ length: 65 }, (_, index) => ({
      id: index === 0 ? "body" : `body-${index}`,
      primitive: "box",
      dimensions: [1, 1, 1],
      materialId: "wood",
    }));
    const result = reconstructSculpt({
      schemaVersion: 1,
      kind: SCULPT_INTAKE_KIND,
      intakeId: "too-many-components",
      mode: "structured-spec",
      structuredSpec: spec,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "quality-gate-refused",
      gate: "component-budget",
    });
  });

  it("has no img2threejs product runtime dependency", () => {
    const manifest = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    expect(manifest.toLowerCase()).not.toContain("img2threejs");
    expect(manifest.toLowerCase()).not.toContain("hoainho");
  });
});
