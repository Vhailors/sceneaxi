import { describe, expect, it } from "vitest";
import { parseSceneMaterialsCatalog, emptySceneEffectsCatalog, parseSceneEffectsCatalog, parseSceneMaterialsMutation, applySceneMaterialsMutation, emptySceneMaterialsCatalog, SCENE_MATERIALS_REFUSALS } from "@sceneaxi/schemas";

const fixtures = [
  {
    "kind": "upsert",
    "instanceId": "desktop-crate-beside",
    "emissiveColor": "#ffffff",
    "emissiveIntensity": 1,
    "opacity": 0.5,
    "baseColorMapAssetId": null,
    "normalMapAssetId": null,
    "roughnessMapAssetId": null,
    "baseColor": "#112233",
    "metallic": 0.4,
    "roughness": 0.5
  },
  {
    "kind": "remove",
    "instanceId": "desktop-crate-beside"
  }
];

const wrongValues = [undefined, null, false, 7, "text", [], {}, 1n, Symbol("field"), () => 1, new Date()];

type FixtureValue<Row> = Row extends Row ? Row[keyof Row] : never;

type MutationFixtureField = FixtureValue<(typeof fixtures)[number]>;

type RejectedFieldCandidate = (typeof wrongValues)[number];

function isFieldText<Input>(value: Input): value is Input & (string) { return typeof value === "string"; }

function isFieldNumber<Input>(value: Input): value is Input & (number) { return typeof value === "number"; }

function isFieldBoolean<Input>(value: Input): value is Input & (boolean) { return typeof value === "boolean"; }

function isFieldBigInt<Input>(value: Input): value is Input & (bigint) { return typeof value === "bigint"; }

function isFieldSymbol<Input>(value: Input): value is Input & (symbol) { return typeof value === "symbol"; }

function isFieldFunction<Input>(value: Input): value is Input & (() => number) { return isBoundaryCallableValue(value); }

function isFieldObject<Input>(value: Input): value is Input & (object | null) { return isBoundaryObjectValue(value); }

function sameFieldType(original: MutationFixtureField, candidate: RejectedFieldCandidate): boolean {
  if (original === null) return candidate === null || isFieldText(candidate);

  if (Array.isArray(original)) return Array.isArray(candidate);

  return (original === undefined && candidate === undefined)
    || (isFieldText(original) && isFieldText(candidate))
    || (isFieldNumber(original) && isFieldNumber(candidate))
    || (isFieldBoolean(original) && isFieldBoolean(candidate))
    || (isFieldBigInt(original) && isFieldBigInt(candidate))
    || (isFieldSymbol(original) && isFieldSymbol(candidate))
    || (isFieldFunction(original) && isFieldFunction(candidate))
    || (isFieldObject(original) && isFieldObject(candidate));
}

describe("checked materials mutation intake", () => {
  it.each(fixtures)("snapshots the complete $kind variant and every consumed field", (fixture) => {
    const parsed = parseSceneMaterialsMutation(fixture);
    expect(parsed).toEqual(fixture);
    expect(parsed).not.toBe(fixture);
    expect(Object.isFrozen(parsed)).toBe(true);

    for (const [field, original] of Object.entries(fixture)) {
      for (const candidate of wrongValues) {
        if (sameFieldType(original, candidate)) continue;

        // Optional undefined fields retain their existing omission semantics.
        if (candidate === undefined && parseSceneMaterialsMutation({ ...fixture, [field]: undefined }) !== null) continue;
        expect(parseSceneMaterialsMutation({ ...fixture, [field]: candidate }), field).toBeNull();
      }

      let hooks = 0;
      const accessor = Object.defineProperty({ ...fixture }, field, { enumerable: true, get() { hooks += 1; throw new Error("raw getter"); } });
      expect(parseSceneMaterialsMutation(accessor)).toBeNull();
      expect(hooks).toBe(0);
    }
  });

  it.each(wrongValues)("refuses unsupported roots without coercion: %s", (value) => {
    expect(parseSceneMaterialsMutation(value)).toBeNull();
  });

  it("refuses unknown discriminants, reflection-failing/revoked proxies and inherited fields", () => {
    expect(parseSceneMaterialsMutation({ ...fixtures[0], kind: "unknown" })).toBeNull();
    const prototype = fixtures[0];

    if (prototype === undefined) throw new Error("missing fixture");
    expect(parseSceneMaterialsMutation(Object.create(prototype))).toBeNull();
    const throwing = new Proxy({ ...fixtures[0] }, { getOwnPropertyDescriptor() { throw new Error("proxy"); } });
    expect(parseSceneMaterialsMutation(throwing)).toBeNull();
    const revoked = Proxy.revocable({ ...fixtures[0] }, {});
    revoked.revoke();
    expect(parseSceneMaterialsMutation(revoked.proxy)).toBeNull();
    let rawReads = 0;
    const snapshotOnly = new Proxy({ ...fixtures[0] }, { get() { rawReads += 1; throw new Error("raw proxy read"); } });
    expect(parseSceneMaterialsMutation(snapshotOnly)).toEqual(fixtures[0]);
    expect(rawReads).toBe(0);
  });



  it("direct schema application rechecks snapshots before reading any mutation field", () => {
    const catalog = emptySceneMaterialsCatalog();
    const mutation = parseSceneMaterialsMutation(fixtures[0]);

    if (mutation === null) throw new Error("positive fixture");
    const malformed = Object.defineProperty({ ...mutation }, "kind", { enumerable: true, get() { throw new Error("must not read"); } });
    expect(applySceneMaterialsMutation({ catalog, mutation: malformed, instanceIds: ["desktop-crate-beside"] })).toMatchObject({ ok: false, reason: SCENE_MATERIALS_REFUSALS.inputUnsupported });
    expect(applySceneMaterialsMutation({ catalog, mutation: malformed, profile: "kids", instanceIds: ["desktop-crate-beside"] })).toMatchObject({ ok: false, reason: SCENE_MATERIALS_REFUSALS.kidsDenied });
    expect(catalog).toEqual(emptySceneMaterialsCatalog());
  });


});

it("checks complete material and emitter records at catalog intake", () => {
  const materials = emptySceneMaterialsCatalog();
  expect(parseSceneMaterialsCatalog(materials)).toBe(materials);
  expect(parseSceneMaterialsCatalog({ ...materials, overrides: [null] })).toBeNull();
  expect(parseSceneMaterialsCatalog({ ...materials, overrides: [{ instanceId: "hero", emissiveColor: "#000000", emissiveIntensity: 0, opacity: 1, baseColorMapAssetId: null, normalMapAssetId: null, roughnessMapAssetId: 1 }] })).toBeNull();
  const effects = emptySceneEffectsCatalog();
  expect(parseSceneEffectsCatalog(effects)).toBe(effects);
  expect(parseSceneEffectsCatalog({ ...effects, seed: "bad" })).toBeNull();
  expect(parseSceneEffectsCatalog({ ...effects, emitters: [null] })).toBeNull();
  expect(parseSceneEffectsCatalog({ ...effects, emitters: [{ emitterId: "sparks", kind: "point", rate: 1, lifetimeMs: "bad", speed: 1, spread: 1 }] })).toBeNull();
});

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
