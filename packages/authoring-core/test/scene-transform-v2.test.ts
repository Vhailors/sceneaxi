import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { reconstructSculpt } from "@sceneaxi/authoring-core";
import { composeScene, composeSceneV2, migrateComposedSceneV1ToV2, serializeComposedScene, serializeComposedSceneV2, sceneDocumentFromComposedSceneV2 } from "@sceneaxi/authoring-core";
import { validateComposedSceneV2, composedSceneV2FromDocumentData, validateComposedScene, digestComposedSceneV2 } from "@sceneaxi/schemas";
import { resolveScenePresentationV2 } from "@sceneaxi/engine-presentation";
import { sceneCompositionArtifactFixture as artifactFixture, sceneCompositionTransformFixture as transform } from "@sceneaxi/schemas/testing/scene-composition";

function requireValue<T>(value: T | undefined): T { if (value === undefined) throw new Error("Missing test fixture entry"); return value; }

const artifact = artifactFixture("crate");
function intake() {
  return { schemaVersion: 2, kind: "sceneaxi.scene-composition-intake", sceneId: "rotated", rootInstanceId: "root",
    placements: [
      { instanceId: "root", artifactId: "crate", parentInstanceId: null, transform: transform([1, 2, 3], [2, 3, 4], [0, 0, 90]) },
      { instanceId: "child", artifactId: "crate", parentInstanceId: "root", transform: transform([1, 0, 0], [1, 2, 1], [20, 30, 40]) },
    ] };
}
function composed() {
  const result = composeSceneV2(intake(), [artifact]);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result;
}
describe("real authoring composition v2", () => {
  it("composes a rotated hierarchy to the existing document and deterministic bytes", () => {
    const before = JSON.stringify(artifact);
    const result = composed();
    expect(result.scene.schemaVersion).toBe(2);
    expect(requireValue(result.scene.instances[1]).worldMatrix.slice(12, 15)).toEqual([1, 4, 3]);
    expect(composeSceneV2(intake(), [artifact])).toEqual(result);
    expect(validateComposedSceneV2(result.scene).ok).toBe(true);
    expect(serializeComposedSceneV2(result.scene)).toBe(result.sceneBytes);
    expect(composedSceneV2FromDocumentData(JSON.parse(JSON.stringify(result.document)).data)).toEqual({ ok: true, value: result.scene });
    expect(JSON.stringify(artifact)).toBe(before);
    expect(Object.isFrozen(requireValue(result.scene.instances[0]).worldMatrix)).toBe(true);
  });
  it("feeds validated matrix poses and bounds to the presentation helper", () => {
    const result = composed();
    const presentation = resolveScenePresentationV2(result.scene);
    expect(presentation.ok).toBe(true);
    if (!presentation.ok) throw new Error("presentation refused");
    expect(presentation.value).toHaveLength(2);
    expect(requireValue(presentation.value[1]).worldMatrix).toEqual(requireValue(result.scene.instances[1]).worldMatrix);
    expect(requireValue(presentation.value[1]).bounds).toEqual(requireValue(result.scene.instances[1]).bounds);
    expect(requireValue(requireValue(presentation.value[0]).nodes[1]).worldMatrix.slice(12, 15)).toEqual([-3.5, 2, 3]);
  });
  it("does not silently upgrade v1 entry points or accept v2 in v1 validators", () => {
    expect(composeScene(intake(), [artifact])).toMatchObject({ ok: false, code: "schema-major-mismatch" });
    expect(validateComposedScene(composed().scene)).toMatchObject({ ok: false, diagnostics: [{ code: "schema-major-mismatch" }] });
  });
  it("retains the exact committed v1 workshop scene digest/bytes", () => {
    const read = (path: string) => JSON.parse(readFileSync(new URL(`../../../tests/e2e/fixtures/${path}`, import.meta.url), "utf8"));
    const intakeV1 = read("scene-composition/workshop-bay.scene.json");
    const artifacts = [
      ["hard-surface-service-crate.intake.json", 8001], ["richer-field-drone.intake.json", 8002],
    ].map(([path, seed]) => {
      const result = reconstructSculpt(read(`sculpt-quality/${path}`), { seed: Number(seed) });
      if (!result.ok) throw new Error(result.message);
      return result.artifact;
    });
    const result = composeScene(intakeV1, artifacts);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    const golden = read("scene-composition/golden-digests.json");
    expect(result.sceneDigest).toBe(golden.scene.sceneDigest);
    expect(`sha256:${createHash("sha256").update(result.sceneBytes).digest("hex")}`).toBe(golden.scene.sceneBytesDigest);
  });
  it.each(["worldMatrix", "bounds", "depth", "artifactDigests", "placementDigest", "sceneDigest"])("refuses tampered %s even if sceneDigest is recomputed", key => {
    const scene = JSON.parse(composed().sceneBytes);
    if (key === "worldMatrix") scene.instances[1].worldMatrix[12] += 1;
    else if (key === "bounds") scene.instances[0].bounds.max[0] += 1;
    else if (key === "depth") scene.instances[1].depth = 0;
    else if (key === "artifactDigests") scene.evidence.artifactDigests[0].artifactDigest = `sha256:${"a".repeat(64)}`;
    else scene.evidence[key] = `sha256:${"a".repeat(64)}`;
    if (key !== "sceneDigest") scene.evidence.sceneDigest = digestComposedSceneV2(scene);
    expect(validateComposedSceneV2(scene).ok).toBe(false);
    expect(resolveScenePresentationV2(scene).ok).toBe(false);
  });
  it("rejects artifact reference mismatch, unused and duplicate artifacts", () => {
    expect(composeSceneV2(intake(), [])).toMatchObject({ ok: false, code: "unknown-artifact-reference" });
    expect(composeSceneV2(intake(), [artifact, artifact])).toMatchObject({ ok: false, code: "unknown-artifact-reference" });
    expect(composeSceneV2(intake(), [artifact, artifactFixture("unused")])).toMatchObject({ ok: false, code: "unplaced-artifact" });
  });
  it("rejects deep accessors without invocation across intake/artifact/options/document", () => {
    let reads = 0;
    const bad = () => { reads += 1; throw new Error("getter invoked"); };
    const value = intake();
    Object.defineProperty(requireValue(value.placements[0]).transform, "rotationEulerDegrees", { enumerable: true, get: bad });
    expect(composeSceneV2(value, [artifact]).ok).toBe(false);
    const badArtifact = { ...artifact };
    Object.defineProperty(badArtifact, "spec", { enumerable: true, get: bad });
    expect(composeSceneV2(intake(), [badArtifact]).ok).toBe(false);
    const options = {}; Object.defineProperty(options, "title", { enumerable: true, get: bad });
    expect(composeSceneV2(intake(), [artifact], options).ok).toBe(false);
    const data = {}; Object.defineProperty(data, "composedScene", { enumerable: true, get: bad });
    expect(composedSceneV2FromDocumentData(data).ok).toBe(false);
    expect(reads).toBe(0);
  });
  it("refuses out-of-domain artifact rest bounds and invalid document options", () => {
    const value = intake();
    const out = { ...value, placements: value.placements.map(p => ({ ...p, transform: transform([9_007_199_254, 0, 0]) })) };
    expect(composeSceneV2(out, [artifact])).toMatchObject({ ok: false, code: "invalid-field" });
    expect(composeSceneV2(intake(), [artifact], { documentId: "../escape" })).toMatchObject({ ok: false, code: "invalid-field" });
    const scene = JSON.parse(composed().sceneBytes); scene.instances[0].bounds.min[0] = NaN;
    expect(() => sceneDocumentFromComposedSceneV2(scene)).toThrow();
  });
});


it("migrates a persisted v1 scene explicitly and keeps source artifact bytes", () => {
  const value = intake();
  requireValue(value.placements[0]).transform = transform([1, 2, 3], [2, 3, 4]);
  const legacy = composeScene({ ...value, schemaVersion: 1 }, [artifact]);
  if (!legacy.ok) throw new Error(legacy.message);
  const bytes = legacy.sceneBytes;
  const migrated = migrateComposedSceneV1ToV2(legacy.scene);
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) throw new Error(migrated.message);
  expect(migrated.scene.schemaVersion).toBe(2);
  expect(migrated.scene.instances.map(i => i.artifact)).toEqual(legacy.scene.instances.map(i => i.artifact));
  expect(serializeComposedScene(legacy.scene)).toBe(bytes);
  expect(validateComposedSceneV2(migrated.scene).ok).toBe(true);
  expect(migrateComposedSceneV1ToV2(migrated.scene)).toMatchObject({ ok: false, code: "schema-major-mismatch" });
});
