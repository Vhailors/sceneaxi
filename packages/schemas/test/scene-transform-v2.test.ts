import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
const { Matrix4, Euler, Quaternion, Vector3 } = createRequire(new URL("../../engine-presentation/package.json", import.meta.url))("three");
import * as composition from "@sceneaxi/schemas";
import { sceneCompositionArtifactFixture as artifactFixture, sceneCompositionTransformFixture as transform } from "@sceneaxi/schemas/testing/scene-composition";

function requireValue<T>(value: T | undefined): T { if (value === undefined) throw new Error("Missing test fixture entry"); return value; }

const intake = (rotation: readonly [number, number, number] = [0, 0, 90]) => ({
  schemaVersion: 2, kind: "sceneaxi.scene-composition-intake", sceneId: "rotated", rootInstanceId: "root",
  placements: [
    { instanceId: "root", artifactId: "crate", parentInstanceId: null, transform: transform([1, 2, 3], [2, 3, 4], rotation) },
    { instanceId: "child", artifactId: "crate", parentInstanceId: "root", transform: transform([1, 0, 0], [1, 2, 1], [25, 40, 15]) },
  ],
});

describe("explicit scene placement v2", () => {
  it("records the unchanged current v1 gap and refuses silent version upgrade", () => {
    expect(composition.validateSceneCompositionIntake({ ...intake(), schemaVersion: 1 })).toMatchObject({ ok: false, diagnostics: [{ code: "rotated-parent-unsupported" }] });
    expect(composition.validateSceneCompositionIntake(intake())).toMatchObject({ ok: false, diagnostics: [{ code: "schema-major-mismatch" }] });
  });
  it("resolves rotated parent * child without pretending shear is TRS", () => {
    const result = composition.resolveScenePlacementsV2(intake());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const child = result.value[1];
    expect(child?.worldMatrix.slice(12, 15)).toEqual([1, 4, 3]);
    const matrices = intake().placements.map(p => new Matrix4().compose(
      new Vector3(...p.transform.translation),
      new Quaternion().setFromEuler(new Euler(p.transform.rotationEulerDegrees[0] * Math.PI / 180, p.transform.rotationEulerDegrees[1] * Math.PI / 180, p.transform.rotationEulerDegrees[2] * Math.PI / 180, "XYZ")),
      new Vector3(...p.transform.scale),
    ));
    const expected = requireValue(matrices[0]).multiply(requireValue(matrices[1])).elements;
    child?.worldMatrix.forEach((n, i) => expect(n).toBeCloseTo(requireValue(expected[i]), 10));
    expect(composition.resolveScenePlacementsV2(intake())).toEqual(result);
  });
});


describe("v2 validation budgets and hierarchy", () => {
  it.each([[13, 27, 71], [-37, 204, 5], [0.0000001, 90.125, 17.3333333]])("matches XYZ quaternion oracle for %j", (x, y, z) => {
    const value = intake([x, y, z]);
    const result = composition.resolveScenePlacementsV2(value);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("refused");
    const matrices = value.placements.map(p => new Matrix4().compose(new Vector3(...p.transform.translation),
      new Quaternion().setFromEuler(new Euler(...p.transform.rotationEulerDegrees.map(n => n * Math.PI / 180), "XYZ")), new Vector3(...p.transform.scale)));
    const expected = requireValue(matrices[0]).multiply(requireValue(matrices[1])).elements;
    requireValue(result.value[1]).worldMatrix.forEach((n, i) => expect(n).toBeCloseTo(requireValue(expected[i]), 10));
  });
  it("canonicalizes input order only for resolved placement evidence", () => {
    const value = intake();
    const shuffled = { ...value, placements: [...value.placements].reverse() };
    expect(composition.resolveScenePlacementsV2(shuffled)).toEqual(composition.resolveScenePlacementsV2(value));
  });
  it.each([
    ["unknown version", (v: ReturnType<typeof intake>) => ({ ...v, schemaVersion: 3 }), "schema-major-mismatch"],
    ["extra field", (v: ReturnType<typeof intake>) => ({ ...v, extra: true }), "unexpected-field"],
    ["one instance", (v: ReturnType<typeof intake>) => ({ ...v, placements: v.placements.slice(0, 1) }), "instance-count-below-minimum"],
    ["missing parent", (v: ReturnType<typeof intake>) => ({ ...v, placements: [v.placements[0], { ...v.placements[1], parentInstanceId: "absent" }] }), "missing-parent-instance"],
    ["duplicate", (v: ReturnType<typeof intake>) => ({ ...v, placements: [v.placements[0], v.placements[0]] }), "duplicate-instance-id"],
    ["self-cycle", (v: ReturnType<typeof intake>) => ({ ...v, placements: [v.placements[0], { ...v.placements[1], parentInstanceId: "child" }] }), "scene-hierarchy-cycle"],
    ["NaN", (v: ReturnType<typeof intake>) => ({ ...v, placements: [{ ...v.placements[0], transform: transform([NaN, 0, 0]) }, v.placements[1]] }), "invalid-field"],
    ["scale underflow", (v: ReturnType<typeof intake>) => ({ ...v, placements: v.placements.map(p => ({ ...p, transform: transform([0, 0, 0], [0.000001, 0.000001, 0.000001]) })) }), "invalid-field"],
    ["scale overflow", (v: ReturnType<typeof intake>) => ({ ...v, placements: v.placements.map(p => ({ ...p, transform: transform([0, 0, 0], [1e6, 1e6, 1e6]) })) }), "invalid-field"],
  ] as const)("refuses %s", (_label, modify, code) => {
    expect(composition.validateSceneCompositionIntakeV2(modify(intake()))).toMatchObject({ ok: false, diagnostics: [{ code }] });
  });
  it("refuses detached cycles", () => {
    const value = intake();
    expect(composition.resolveScenePlacementsV2({ ...value, placements: [value.placements[0],
      { ...value.placements[1], parentInstanceId: "other" }, { ...value.placements[1], instanceId: "other", parentInstanceId: "child" }] }))
      .toMatchObject({ ok: false, diagnostics: [{ code: "scene-hierarchy-cycle" }] });
  });
  it("admits exactly 32 instances and refuses instance 33, retaining depth 8", () => {
    const value = intake();
    const placements = [value.placements[0], ...Array.from({ length: 31 }, (_, i) => ({ ...value.placements[1], instanceId: `child-${i}` }))];
    expect(composition.resolveScenePlacementsV2({ ...value, placements }).ok).toBe(true);
    expect(composition.resolveScenePlacementsV2({ ...value, placements: [...placements, { ...value.placements[1], instanceId: "extra" }] }))
      .toMatchObject({ ok: false, diagnostics: [{ code: "scene-budget-exceeded" }] });
    const chain = [value.placements[0], ...Array.from({ length: 8 }, (_, i) => ({ ...value.placements[1],
      instanceId: `node-${i}`, parentInstanceId: i === 0 ? "root" : `node-${i - 1}`, transform: transform([1, 0, 0]) }))];
    expect(composition.resolveScenePlacementsV2({ ...value, placements: chain }).ok).toBe(true);
    expect(composition.resolveScenePlacementsV2({ ...value, placements: [...chain, { ...value.placements[1], instanceId: "too-deep", parentInstanceId: "node-7" }] }))
      .toMatchObject({ ok: false, diagnostics: [{ code: "scene-budget-exceeded" }] });
  });
  it("rejects deep accessors without invoking them and cyclic JSON", () => {
    const value = intake();
    let reads = 0;
    Object.defineProperty(requireValue(value.placements[1]).transform, "translation", { enumerable: true, get() { reads += 1; throw new Error("getter"); } });
    expect(composition.validateSceneCompositionIntakeV2(value).ok).toBe(false);
    expect(reads).toBe(0);
    const cycle: { child?: unknown } = {}; cycle.child = cycle;
    expect(composition.validateSceneCompositionIntakeV2(cycle).ok).toBe(false);
  });
  it("migrates only explicit valid v1 without changing original bytes", () => {
    const legacy = { ...intake([0, 0, 0]), schemaVersion: 1 };
    const bytes = JSON.stringify(legacy);
    const migrated = composition.migrateSceneCompositionIntakeV1ToV2(legacy);
    expect(migrated.ok).toBe(true);
    expect(JSON.stringify(legacy)).toBe(bytes);
    expect(composition.migrateSceneCompositionIntakeV1ToV2(intake()).ok).toBe(false);
  });
  it("projects artifact node hierarchy and conservative geometry bounds without rewriting it", () => {
    const artifact = artifactFixture("crate", transform([1, 0, 0]), transform([0, 2, 0]));
    const bytes = JSON.stringify(artifact);
    const result = composition.resolveScenePlacementsV2(intake());
    if (!result.ok) throw new Error("fixture");
    const hierarchy = composition.projectSceneInstanceHierarchyV2({ ...requireValue(result.value[0]), artifact });
    expect(requireValue(hierarchy.nodes[0]).worldMatrix.slice(12, 15)).toEqual([1, 4, 3]);
    expect(requireValue(hierarchy.nodes[1]).worldMatrix.slice(12, 15)).toEqual([-5, 4, 3]);
    expect(hierarchy.bounds.min).toEqual([-6.5, 2, -1]);
    expect(hierarchy.bounds.max).toEqual([4, 6, 7]);
    expect(JSON.stringify(artifact)).toBe(bytes);
  });
});


it("refuses rotated anisotropic scale underflow that axis-wise products alone miss", () => {
  const value = intake([0, 0, 0]);
  requireValue(value.placements[0]).transform = transform([0, 0, 0], [0.000001, 1, 1]);
  requireValue(value.placements[1]).transform = transform([0, 0, 0], [1, 0.000001, 1], [0, 0, 90]);
  expect(composition.resolveScenePlacementsV2(value)).toMatchObject({ ok: false, diagnostics: [{ code: "invalid-field" }] });
});

it("accepts a finite nested exact minimum uniform scale and refuses its next underflow", () => {
  const value = intake();
  requireValue(value.placements[0]).transform = transform([0, 0, 0], [0.001, 0.001, 0.001], [13, 71, 32]);
  requireValue(value.placements[1]).transform = transform([0, 0, 0], [0.001, 0.001, 0.001], [20, 31, 57]);
  expect(composition.resolveScenePlacementsV2(value).ok).toBe(true);
  requireValue(value.placements[1]).transform = transform([0, 0, 0], [0.000999, 0.001, 0.001], [20, 31, 57]);
  expect(composition.resolveScenePlacementsV2(value).ok).toBe(false);
});


it.each(["sphere", "cylinder"] as const)("bounds match existing %s primitive geometry", primitive => {
  const source = artifactFixture("crate");
  const artifact = { ...source, spec: { ...source.spec, components: source.spec.components.map(c =>
    c.id === "body" ? { ...c, primitive, dimensions: [2, 6, 4] as const } : c) } };
  const result = composition.resolveScenePlacementsV2({ ...intake(), placements: intake().placements.map(p => ({ ...p, transform: transform([0, 0, 0]) })) });
  if (!result.ok) throw new Error("fixture");
  const bounds = composition.projectSceneInstanceHierarchyV2({ ...requireValue(result.value[0]), artifact }).bounds;
  expect(bounds.min).toEqual(primitive === "sphere" ? [-3, -3, -3] : [-2, -3, -2]);
  expect(bounds.max).toEqual(primitive === "sphere" ? [3, 3, 3] : [2, 3, 2]);
});

it("matrix helpers refuse malformed/non-affine/accessor matrices without evaluating accessors", () => {
  const identity = composition.sceneMatrixFromSculptTransformV2(transform([0, 0, 0]));
  const perspective = [...identity]; perspective[3] = 1;
  // The public typed matrix function is exercised from untyped JS inputs deliberately.
  expect(() => Reflect.apply(composition.multiplySceneMatricesV2, null, [identity, perspective])).toThrow();
  const accessor = [...identity]; let reads = 0;
  Object.defineProperty(accessor, "0", { enumerable: true, get() { reads += 1; return 1; } });
  expect(() => Reflect.apply(composition.multiplySceneMatricesV2, null, [identity, accessor])).toThrow();
  expect(reads).toBe(0);
});


it("accepts bounded anisotropic nesting when rotation prevents axis-product overflow", () => {
  const value = intake([0, 0, 0]);
  requireValue(value.placements[0]).transform = transform([0, 0, 0], [1e6, 1, 1]);
  requireValue(value.placements[1]).transform = transform([0, 0, 0], [1e6, 1, 1], [0, 0, 90]);
  const result = composition.resolveScenePlacementsV2(value);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("bounded affine scene refused");
  expect(requireValue(result.value[1]).worldMatrix.slice(0, 8)).toEqual([0, 1e6, 0, 0, -1e6, 0, 0, 0]);
});
