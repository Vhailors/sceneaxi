import { describe, expect, it } from "vitest";
import { parseSceneEnvironmentMutation, applySceneEnvironmentMutation, emptySceneEnvironmentCatalog, SCENE_ENVIRONMENT_REFUSALS } from "@sceneaxi/schemas";

const fixtures = [
  {
    "kind": "set",
    "background": "#112233",
    "ambientIntensity": 0.4,
    "ambientColor": "#ffffff",
    "keyIntensity": 2,
    "keyColor": "#ffffff",
    "keyDirection": [
      4,
      6,
      5
    ],
    "fillIntensity": 0.6,
    "exposure": 1,
    "toneMapping": "none",
    "shadows": false,
    "fog": {
      "enabled": true,
      "color": "#ffffff",
      "near": 1,
      "far": 10
    },
    "effects": [
      "bloom"
    ],
    "sky": {
      "top": "#112233",
      "horizon": "#445566",
      "ground": "#778899"
    },
    "shadowBudget": {
      "mapSize": 1024,
      "maxDistance": 50
    },
    "bloom": {
      "strength": 1,
      "threshold": 0.5,
      "radius": 0.5
    }
  }
];

const wrongValues = [undefined, null, false, 7, "text", [], {}, 1n, Symbol("field"), () => 1, new Date()];

type FixtureValue<Row> = Row extends Row ? Row[keyof Row] : never;

type MutationFixtureField = FixtureValue<(typeof fixtures)[number]> | undefined;

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

describe("checked environment mutation intake", () => {
  it.each(fixtures)("snapshots the complete $kind variant and every consumed field", (fixture) => {
    const parsed = parseSceneEnvironmentMutation(fixture);
    expect(parsed).toEqual(fixture);
    expect(parsed).not.toBe(fixture);
    expect(Object.isFrozen(parsed)).toBe(true);

    for (const [field, original] of Object.entries(fixture)) {
      for (const candidate of wrongValues) {
        if (sameFieldType(original, candidate)) continue;

        // Optional undefined fields retain their existing omission semantics.
        if (candidate === undefined && parseSceneEnvironmentMutation({ ...fixture, [field]: undefined }) !== null) continue;
        expect(parseSceneEnvironmentMutation({ ...fixture, [field]: candidate }), field).toBeNull();
      }

      let hooks = 0;
      const accessor = Object.defineProperty({ ...fixture }, field, { enumerable: true, get() { hooks += 1; throw new Error("raw getter"); } });
      expect(parseSceneEnvironmentMutation(accessor)).toBeNull();
      expect(hooks).toBe(0);
    }
  });

  it.each(wrongValues)("refuses unsupported roots without coercion: %s", (value) => {
    expect(parseSceneEnvironmentMutation(value)).toBeNull();
  });

  it("refuses unknown discriminants, reflection-failing/revoked proxies and inherited fields", () => {
    expect(parseSceneEnvironmentMutation({ ...fixtures[0], kind: "unknown" })).toBeNull();
    const prototype = fixtures[0];

    if (prototype === undefined) throw new Error("missing fixture");
    expect(parseSceneEnvironmentMutation(Object.create(prototype))).toBeNull();
    const throwing = new Proxy({ ...fixtures[0] }, { getOwnPropertyDescriptor() { throw new Error("proxy"); } });
    expect(parseSceneEnvironmentMutation(throwing)).toBeNull();
    const revoked = Proxy.revocable({ ...fixtures[0] }, {});
    revoked.revoke();
    expect(parseSceneEnvironmentMutation(revoked.proxy)).toBeNull();
    let rawReads = 0;
    const snapshotOnly = new Proxy({ ...fixtures[0] }, { get() { rawReads += 1; throw new Error("raw proxy read"); } });
    expect(parseSceneEnvironmentMutation(snapshotOnly)).toEqual(fixtures[0]);
    expect(rawReads).toBe(0);
  });



  it("direct schema application rechecks snapshots before reading any mutation field", () => {
    const catalog = emptySceneEnvironmentCatalog();
    const mutation = parseSceneEnvironmentMutation(fixtures[0]);

    if (mutation === null) throw new Error("positive fixture");
    const malformed = Object.defineProperty({ ...mutation }, "kind", { enumerable: true, get() { throw new Error("must not read"); } });
    expect(applySceneEnvironmentMutation({ catalog, mutation: malformed })).toMatchObject({ ok: false, reason: SCENE_ENVIRONMENT_REFUSALS.inputUnsupported });
    expect(applySceneEnvironmentMutation({ catalog, mutation: malformed, profile: "kids" })).toMatchObject({ ok: false, reason: SCENE_ENVIRONMENT_REFUSALS.kidsDenied });
    expect(catalog).toEqual(emptySceneEnvironmentCatalog());
  });


});

describe("environment nested snapshots", () => {
  it("checks every nested scalar and array element without getters or proxy reads", () => {
    const fixture = fixtures[0];

    if (fixture === undefined) throw new Error("missing fixture");

    for (const field of ["fog", "sky", "shadowBudget", "bloom"] as const) {
      for (const [key, original] of Object.entries(fixture[field])) {
        for (const candidate of wrongValues) {
          if (sameFieldType(original, candidate)) continue;
          expect(parseSceneEnvironmentMutation({ ...fixture, [field]: { ...fixture[field], [key]: candidate } })).toBeNull();
        }

        let hooks = 0;
        const nested = Object.defineProperty({ ...fixture[field] }, key, { enumerable: true, get() { hooks += 1; throw new Error("nested"); } });
        expect(parseSceneEnvironmentMutation({ ...fixture, [field]: nested })).toBeNull();
        expect(hooks).toBe(0);
      }
    }

    for (const field of ["keyDirection", "effects"] as const) {
      let hooks = 0;
      const nested = Object.defineProperty([...fixture[field]], "0", { enumerable: true, get() { hooks += 1; throw new Error("array"); } });
      expect(parseSceneEnvironmentMutation({ ...fixture, [field]: nested })).toBeNull();
      const proxy = new Proxy([...fixture[field]], { get() { hooks += 1; throw new Error("read"); } });
      expect(parseSceneEnvironmentMutation({ ...fixture, [field]: proxy })).not.toBeNull();
      expect(hooks).toBe(0);

      for (const candidate of wrongValues) {
        if (sameFieldType(fixture[field][0], candidate)) continue;
        const entries: unknown[] = [...fixture[field]];
        entries[0] = candidate;
        expect(parseSceneEnvironmentMutation({ ...fixture, [field]: entries })).toBeNull();
      }
    }

    expect(parseSceneEnvironmentMutation({ kind: "set", keyDirection: [1, 2] })).toBeNull();
    expect(parseSceneEnvironmentMutation({ kind: "set", shadowBudget: { mapSize: 512, maxDistance: 50 } })).toBeNull();
  });

  it("preserves range/enum refusals and never commits earlier valid fields", () => {
    const catalog = emptySceneEnvironmentCatalog();
    const before = JSON.stringify(catalog);

    for (const mutation of [{kind: "set", background: "#ffffff", exposure: -1}, {kind: "set", exposure: 17}, {kind: "set", exposure: NaN}, {kind: "set", exposure: Infinity}, {kind: "set", toneMapping: "unknown"}, {kind: "set", effects: ["unknown"]}, {kind: "set", fog: {enabled: true, color: "#ffffff", near: 10, far: 1}}]) {
      const parsed = parseSceneEnvironmentMutation(mutation);

      if (parsed === null) throw new Error("primitive-shaped domain negative rejected structurally");
      expect(applySceneEnvironmentMutation({ catalog, mutation: parsed })).toMatchObject({ok: false, reason: SCENE_ENVIRONMENT_REFUSALS.inputUnsupported});
      expect(JSON.stringify(catalog)).toBe(before);
    }
  });
});

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
