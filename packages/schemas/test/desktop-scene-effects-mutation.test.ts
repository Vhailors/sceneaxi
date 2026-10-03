import { describe, expect, it } from "vitest";
import { parseSceneEffectsMutation, applySceneEffectsMutation, emptySceneEffectsCatalog, SCENE_EFFECTS_REFUSALS } from "@sceneaxi/schemas";

const fixtures = [
  {
    "kind": "upsert",
    "emitterId": "spark",
    "emitterKind": "point",
    "rate": 8,
    "lifetimeMs": 800,
    "speed": 1,
    "spread": 0.4,
    "instanceId": "desktop-crate-beside",
    "color": "#ffffff",
    "size": 1
  },
  {
    "kind": "remove",
    "emitterId": "spark"
  },
  {
    "kind": "seed-set",
    "seed": 1
  }
];

const wrongValues = [undefined, null, false, 7, "text", [], {}, 1n, Symbol("field"), () => 1, new Date()];

type MutationFieldValue = (typeof fixtures)[number][keyof (typeof fixtures)[number]];

type WrongFieldValue = (typeof wrongValues)[number];

function isNullableText(value: MutationFieldValue | WrongFieldValue): value is string | null {
  return value === null || isBoundaryTextValue(value);
}

function sameFieldType(original: MutationFieldValue, candidate: WrongFieldValue): boolean {
  if (original === null) return isNullableText(candidate);

  if (Array.isArray(original)) return Array.isArray(candidate);

  return hasSameFieldCategory(original, candidate);
}

describe("checked effects mutation intake", () => {
  it.each(fixtures)("snapshots the complete $kind variant and every consumed field", (fixture) => {
    const parsed = parseSceneEffectsMutation(fixture);
    expect(parsed).toEqual(fixture);
    expect(parsed).not.toBe(fixture);
    expect(Object.isFrozen(parsed)).toBe(true);

    for (const [field, original] of Object.entries(fixture)) {
      for (const candidate of wrongValues) {
        if (sameFieldType(original, candidate)) continue;

        // Optional undefined fields retain their existing omission semantics.
        if (candidate === undefined && parseSceneEffectsMutation({ ...fixture, [field]: undefined }) !== null) continue;
        expect(parseSceneEffectsMutation({ ...fixture, [field]: candidate }), field).toBeNull();
      }

      let hooks = 0;
      const accessor = Object.defineProperty({ ...fixture }, field, { enumerable: true, get() { hooks += 1; throw new Error("raw getter"); } });
      expect(parseSceneEffectsMutation(accessor)).toBeNull();
      expect(hooks).toBe(0);
    }
  });

  it.each(wrongValues)("refuses unsupported roots without coercion: %s", (value) => {
    expect(parseSceneEffectsMutation(value)).toBeNull();
  });

  it("refuses unknown discriminants, reflection-failing/revoked proxies and inherited fields", () => {
    expect(parseSceneEffectsMutation({ ...fixtures[0], kind: "unknown" })).toBeNull();
    const prototype = fixtures[0];

    if (prototype === undefined) throw new Error("missing fixture");
    expect(parseSceneEffectsMutation(Object.create(prototype))).toBeNull();
    const throwing = new Proxy({ ...fixtures[0] }, { getOwnPropertyDescriptor() { throw new Error("proxy"); } });
    expect(parseSceneEffectsMutation(throwing)).toBeNull();
    const revoked = Proxy.revocable({ ...fixtures[0] }, {});
    revoked.revoke();
    expect(parseSceneEffectsMutation(revoked.proxy)).toBeNull();
    let rawReads = 0;
    const snapshotOnly = new Proxy({ ...fixtures[0] }, { get() { rawReads += 1; throw new Error("raw proxy read"); } });
    expect(parseSceneEffectsMutation(snapshotOnly)).toEqual(fixtures[0]);
    expect(rawReads).toBe(0);
  });



  it("direct schema application rechecks snapshots before reading any mutation field", () => {
    const catalog = emptySceneEffectsCatalog();
    const mutation = parseSceneEffectsMutation(fixtures[0]);

    if (mutation === null) throw new Error("positive fixture");
    const malformed = Object.defineProperty({ ...mutation }, "kind", { enumerable: true, get() { throw new Error("must not read"); } });
    expect(applySceneEffectsMutation({ catalog, mutation: malformed, instanceIds: ["desktop-crate-beside"] })).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.inputUnsupported });
    expect(applySceneEffectsMutation({ catalog, mutation: malformed, profile: "kids", instanceIds: ["desktop-crate-beside"] })).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.kidsDenied });
    expect(catalog).toEqual(emptySceneEffectsCatalog());
  });


});

function hasSameFieldCategory(original: MutationFieldValue, candidate: WrongFieldValue): candidate is MutationFieldValue {
  return (
    (isBoundaryTextValue(original) && isBoundaryTextValue(candidate)) ||
    (isBoundaryNumericValue(original) && isBoundaryNumericValue(candidate)) ||
    (isBoundaryBooleanValue(original) && isBoundaryBooleanValue(candidate)) ||
    (isBoundaryBigIntValue(original) && isBoundaryBigIntValue(candidate)) ||
    (isBoundarySymbolValue(original) && isBoundarySymbolValue(candidate)) ||
    (isBoundaryObjectValue(original) && isBoundaryObjectValue(candidate)) ||
    (isBoundaryCallableValue(original) && isBoundaryCallableValue(candidate)) ||
    (isBoundaryUndefinedValue(original) && isBoundaryUndefinedValue(candidate))
  );
}

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryTextValue<Input>(value: Input): value is Input & string {
  return typeof value === "string";
}

function isBoundaryNumericValue<Input>(value: Input): value is Input & number {
  return typeof value === "number";
}

function isBoundaryBooleanValue<Input>(value: Input): value is Input & boolean {
  return typeof value === "boolean";
}

function isBoundaryBigIntValue<Input>(value: Input): value is Input & bigint {
  return typeof value === "bigint";
}

function isBoundarySymbolValue<Input>(value: Input): value is Input & symbol {
  return typeof value === "symbol";
}

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}

function isBoundaryUndefinedValue<Input>(value: Input): value is Input & undefined {
  return typeof value === "undefined";
}
