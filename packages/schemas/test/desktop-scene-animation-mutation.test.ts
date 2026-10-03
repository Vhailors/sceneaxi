import { describe, expect, it } from "vitest";
import { parseSceneAnimationCatalog, parseSceneAnimationMutation, applySceneAnimationMutation, emptySceneAnimationCatalog, SCENE_ANIMATION_REFUSALS } from "@sceneaxi/schemas";

const fixtures = [
  {
    "kind": "clip-upsert",
    "clipId": "idle",
    "name": "Idle",
    "startMs": 0,
    "durationMs": 1000
  },
  {
    "kind": "clip-remove",
    "clipId": "idle"
  },
  {
    "kind": "track-upsert",
    "trackId": "tx",
    "clipId": "idle",
    "targetInstanceId": "desktop-crate-beside",
    "propertyId": "translation-x"
  },
  {
    "kind": "track-remove",
    "trackId": "tx"
  },
  {
    "kind": "keyframe-upsert",
    "keyframeId": "k0",
    "trackId": "tx",
    "timeMs": 0,
    "value": 1,
    "interpolation": "linear"
  },
  {
    "kind": "keyframe-remove",
    "keyframeId": "k0"
  },
  {
    "kind": "bind-asset",
    "assetId": "motion",
    "digest": "sha256:abababababababababababababababababababababababababababababababab",
    "clipIds": [
      "idle"
    ]
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

describe("checked animation mutation intake", () => {
  it.each(fixtures)("snapshots the complete $kind variant and every consumed field", (fixture) => {
    const parsed = parseSceneAnimationMutation(fixture);
    expect(parsed).toEqual(fixture);
    expect(parsed).not.toBe(fixture);
    expect(Object.isFrozen(parsed)).toBe(true);

    for (const [field, original] of Object.entries(fixture)) {
      for (const candidate of wrongValues) {
        if (sameFieldType(original, candidate)) continue;

        // Optional undefined fields retain their existing omission semantics.
        if (candidate === undefined && parseSceneAnimationMutation({ ...fixture, [field]: undefined }) !== null) continue;
        expect(parseSceneAnimationMutation({ ...fixture, [field]: candidate }), field).toBeNull();
      }

      let hooks = 0;
      const accessor = Object.defineProperty({ ...fixture }, field, { enumerable: true, get() { hooks += 1; throw new Error("raw getter"); } });
      expect(parseSceneAnimationMutation(accessor)).toBeNull();
      expect(hooks).toBe(0);
    }
  });

  it.each(wrongValues)("refuses unsupported roots without coercion: %s", (value) => {
    expect(parseSceneAnimationMutation(value)).toBeNull();
  });

  it("refuses unknown discriminants, reflection-failing/revoked proxies and inherited fields", () => {
    expect(parseSceneAnimationMutation({ ...fixtures[0], kind: "unknown" })).toBeNull();
    const prototype = fixtures[0];

    if (prototype === undefined) throw new Error("missing fixture");
    expect(parseSceneAnimationMutation(Object.create(prototype))).toBeNull();
    const throwing = new Proxy({ ...fixtures[0] }, { getOwnPropertyDescriptor() { throw new Error("proxy"); } });
    expect(parseSceneAnimationMutation(throwing)).toBeNull();
    const revoked = Proxy.revocable({ ...fixtures[0] }, {});
    revoked.revoke();
    expect(parseSceneAnimationMutation(revoked.proxy)).toBeNull();
    let rawReads = 0;
    const snapshotOnly = new Proxy({ ...fixtures[0] }, { get() { rawReads += 1; throw new Error("raw proxy read"); } });
    expect(parseSceneAnimationMutation(snapshotOnly)).toEqual(fixtures[0]);
    expect(rawReads).toBe(0);
  });



  it("direct schema application rechecks snapshots before reading any mutation field", () => {
    const catalog = emptySceneAnimationCatalog();
    const mutation = parseSceneAnimationMutation(fixtures[0]);

    if (mutation === null) throw new Error("positive fixture");
    const malformed = Object.defineProperty({ ...mutation }, "kind", { enumerable: true, get() { throw new Error("must not read"); } });
    expect(applySceneAnimationMutation({ catalog, mutation: malformed, instanceIds: ["desktop-crate-beside"] })).toMatchObject({ ok: false, reason: SCENE_ANIMATION_REFUSALS.inputUnsupported });
    expect(catalog).toEqual(emptySceneAnimationCatalog());
  });


});

it("bind snapshots array elements without raw array getters and preserves domain refusal order", () => {
  const fixture = fixtures[6];
  let hooks = 0;
  const entries = Object.defineProperty(["idle"], "0", { enumerable: true, get() { hooks += 1; throw new Error("array"); } });
  expect(parseSceneAnimationMutation({ ...fixture, clipIds: entries })).toBeNull();
  const proxy = new Proxy(["idle"], { get() { hooks += 1; throw new Error("raw"); } });
  expect(parseSceneAnimationMutation({ ...fixture, clipIds: proxy })).not.toBeNull();
  expect(parseSceneAnimationMutation({ ...fixture, clipIds: [1] })).toBeNull();
  expect(hooks).toBe(0);
  const catalog = emptySceneAnimationCatalog();

  for (const interpolation of ["unknown", "linear"]) {
    const mutation = parseSceneAnimationMutation({ kind: "keyframe-upsert", keyframeId: "k0", trackId: "unknown", timeMs: NaN, value: Infinity, interpolation });

    if (mutation === null) throw new Error("valid raw shape");
    expect(applySceneAnimationMutation({catalog, mutation, instanceIds: []})).toMatchObject({ok: false, reason: SCENE_ANIMATION_REFUSALS.trackUnknown});
  }
});

it("validates every animation catalog member before exposing the domain contract", () => {
  const empty = emptySceneAnimationCatalog();
  expect(parseSceneAnimationCatalog(empty)).toBe(empty);
  expect(parseSceneAnimationCatalog({ ...empty, clips: [{ clipId: "idle", name: "Idle", startMs: 0, durationMs: "bad" }] })).toBeNull();
  expect(parseSceneAnimationCatalog({ ...empty, tracks: [{ trackId: "move", clipId: "idle", targetInstanceId: "hero", propertyId: null }] })).toBeNull();
  expect(parseSceneAnimationCatalog({ ...empty, keyframes: [{ keyframeId: "frame", trackId: "move", timeMs: 0, value: 1, interpolation: "unsupported" }] })).toBeNull();
  expect(parseSceneAnimationCatalog({ ...empty, bindings: [{ assetId: "motion", digest: "fixture", clipIds: [1] }] })).toBeNull();
});

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
