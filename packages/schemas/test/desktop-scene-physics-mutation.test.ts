import { describe, expect, it } from "vitest";
import { parseScenePhysicsMutation, parseScenePhysicsCatalog, applyScenePhysicsMutation, emptyScenePhysicsCatalog, SCENE_PHYSICS_REFUSALS } from "@sceneaxi/schemas";

const fixtures = [
  {
    "kind": "body-upsert",
    "bodyId": "b1",
    "instanceId": "desktop-crate-beside",
    "bodyKind": "dynamic",
    "mass": 1
  },
  {
    "kind": "shape-upsert",
    "shapeId": "s1",
    "bodyId": "b1",
    "shapeKind": "box",
    "size": 1
  },
  {
    "kind": "shape-upsert",
    "colliderId": "s1",
    "bodyId": "b1",
    "colliderKind": "box",
    "size": 1
  },
  {
    "kind": "material-upsert",
    "bodyId": "b1",
    "friction": 1,
    "restitution": 0.5
  },
  {
    "kind": "constraint-upsert",
    "constraintId": "c1",
    "constraintKind": "fixed",
    "bodyA": "b1",
    "bodyB": "b1"
  },
  {
    "kind": "world-set",
    "gravityY": -9.81,
    "stepMs": 16,
    "seed": 1,
    "engine": "toy"
  },
  {
    "kind": "body-remove",
    "bodyId": "b1"
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

describe("checked physics mutation intake", () => {
  it.each(fixtures)("snapshots the complete $kind variant and every consumed field", (fixture) => {
    const parsed = parseScenePhysicsMutation(fixture);
    expect(parsed).toEqual(fixture);
    expect(parsed).not.toBe(fixture);
    expect(Object.isFrozen(parsed)).toBe(true);

    for (const [field, original] of Object.entries(fixture)) {
      for (const candidate of wrongValues) {
        if (sameFieldType(original, candidate)) continue;

        // Optional undefined fields retain their existing omission semantics.
        if (candidate === undefined && parseScenePhysicsMutation({ ...fixture, [field]: undefined }) !== null) continue;
        expect(parseScenePhysicsMutation({ ...fixture, [field]: candidate }), field).toBeNull();
      }

      let hooks = 0;
      const accessor = Object.defineProperty({ ...fixture }, field, { enumerable: true, get() { hooks += 1; throw new Error("raw getter"); } });
      expect(parseScenePhysicsMutation(accessor)).toBeNull();
      expect(hooks).toBe(0);
    }
  });

  it.each(wrongValues)("refuses unsupported roots without coercion: %s", (value) => {
    expect(parseScenePhysicsMutation(value)).toBeNull();
  });

  it("refuses unknown discriminants, reflection-failing/revoked proxies and inherited fields", () => {
    expect(parseScenePhysicsMutation({ ...fixtures[0], kind: "unknown" })).toBeNull();
    const prototype = fixtures[0];

    if (prototype === undefined) throw new Error("missing fixture");
    expect(parseScenePhysicsMutation(Object.create(prototype))).toBeNull();
    const throwing = new Proxy({ ...fixtures[0] }, { getOwnPropertyDescriptor() { throw new Error("proxy"); } });
    expect(parseScenePhysicsMutation(throwing)).toBeNull();
    const revoked = Proxy.revocable({ ...fixtures[0] }, {});
    revoked.revoke();
    expect(parseScenePhysicsMutation(revoked.proxy)).toBeNull();
    let rawReads = 0;
    const snapshotOnly = new Proxy({ ...fixtures[0] }, { get() { rawReads += 1; throw new Error("raw proxy read"); } });
    expect(parseScenePhysicsMutation(snapshotOnly)).toEqual(fixtures[0]);
    expect(rawReads).toBe(0);
  });



  it("direct schema application rechecks snapshots before reading any mutation field", () => {
    const catalog = emptyScenePhysicsCatalog();
    const mutation = parseScenePhysicsMutation(fixtures[0]);

    if (mutation === null) throw new Error("positive fixture");
    const malformed = Object.defineProperty({ ...mutation }, "kind", { enumerable: true, get() { throw new Error("must not read"); } });
    expect(applyScenePhysicsMutation({ catalog, mutation: malformed, instanceIds: ["desktop-crate-beside"] })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.inputUnsupported });
    expect(catalog).toEqual(emptyScenePhysicsCatalog());
  });


  it("preserves both aliases, modern precedence and catalog/save-reload invariants", () => {
    const withBody = applyScenePhysicsMutation({ catalog: emptyScenePhysicsCatalog(), mutation: { kind: "body-upsert", bodyId: "b1", instanceId: "target", bodyKind: "dynamic", mass: 1 }, instanceIds: ["target"] });

    if (!withBody.ok) throw new Error(withBody.message);
    const legacy = parseScenePhysicsMutation({ kind: "shape-upsert", "shapeId": "s1", bodyId: "b1", "shapeKind": "box", size: 1 });
    const modern = parseScenePhysicsMutation({ kind: "shape-upsert", colliderId: "s1", bodyId: "b1", colliderKind: "box", size: 1 });

    if (!legacy || !modern) throw new Error("positive aliases refused");
    const appliedLegacy = applyScenePhysicsMutation({ catalog: withBody.catalog, mutation: legacy, instanceIds: ["target"] });
    const appliedModern = applyScenePhysicsMutation({ catalog: withBody.catalog, mutation: modern, instanceIds: ["target"] });
    expect(appliedModern).toEqual(appliedLegacy);
    expect(appliedModern).toMatchObject({ ok: true, catalog: { colliders: [{ colliderId: "s1", bodyId: "b1", kind: "box", size: 1 }], "shapes": [{ "shapeId": "s1", bodyId: "b1", kind: "box", size: 1 }] } });

    if (!appliedModern.ok) throw new Error(appliedModern.message);
    expect(parseScenePhysicsCatalog(JSON.parse(JSON.stringify(appliedModern.catalog)))).toEqual(appliedModern.catalog);
    expect(parseScenePhysicsMutation({ ...legacy, colliderId: "new", colliderKind: "sphere" })).toEqual({ kind: "shape-upsert", colliderId: "new", bodyId: "b1", colliderKind: "sphere", size: 1 });
    expect(parseScenePhysicsMutation({ ...legacy, colliderId: null })).toBeNull();
    expect(parseScenePhysicsMutation({ ...legacy, colliderKind: null })).toBeNull();
    const invalid = parseScenePhysicsMutation({ kind: "shape-upsert", colliderId: "BAD", bodyId: "missing", colliderKind: "mesh", size: -1 });

    if (!invalid) throw new Error("domain errors must survive structural intake");
    expect(applyScenePhysicsMutation({ catalog: withBody.catalog, mutation: invalid, instanceIds: ["target"] })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.bodyUnknown });
    let hooks = 0;
    const getter = Object.defineProperty({ ...modern }, "colliderId", { enumerable: true, get() { hooks += 1; throw new Error("getter"); } });
    expect(parseScenePhysicsMutation(getter)).toBeNull();
    expect(hooks).toBe(0);
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
