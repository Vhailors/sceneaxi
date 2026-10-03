import {
  SCENE_PHYSICS_REFUSALS,
  applyScenePhysicsMutation,
  createToyPhysicsWorldHost,
  emptyScenePhysicsCatalog,
  evaluateScenePhysics,
  parseScenePhysicsCatalog,
} from "@sceneaxi/schemas";
import { describe, expect, it } from "vitest";

const hash = `sha256:${"cd".repeat(32)}`;

describe("desktop scene physics catalog", () => {
  it("refuses missing targets, invalid colliders, unsupported constraints, and unstable steps", () => {
    const catalog = emptyScenePhysicsCatalog();
    expect(applyScenePhysicsMutation({
      catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: { kind: "body-upsert", bodyId: "b1", instanceId: "missing", bodyKind: "dynamic", mass: 1 },
    })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.targetMissing });

    const body = applyScenePhysicsMutation({
      catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: { kind: "body-upsert", bodyId: "b1", instanceId: "desktop-crate-beside", bodyKind: "dynamic", mass: 1 },
    });

    if (!body.ok) throw new Error(body.message);
    expect(applyScenePhysicsMutation({
      catalog: body.catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: { kind: "shape-upsert", colliderId: "s1", bodyId: "b1", colliderKind: "mesh", size: 1 },
    })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.colliderInvalid });
    expect(applyScenePhysicsMutation({
      catalog: body.catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: { kind: "constraint-upsert", constraintId: "c1", constraintKind: "spring", bodyA: "b1", bodyB: "b1" },
    })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.constraintUnsupported });
    expect(applyScenePhysicsMutation({
      catalog: body.catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: { kind: "world-set", gravityY: -9.81, stepMs: 100, seed: 1 },
    })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.stepUnstable });
  });

  it("replays a fixed-seed fixture with identical snapshots and animation-then-physics order", () => {
    let catalog = emptyScenePhysicsCatalog();

    const body = applyScenePhysicsMutation({
      catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: { kind: "body-upsert", bodyId: "b1", instanceId: "desktop-crate-beside", bodyKind: "dynamic", mass: 1 },
    });

    if (!body.ok) throw new Error(body.message);
    catalog = body.catalog;

    const collider = applyScenePhysicsMutation({
      catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: { kind: "shape-upsert", colliderId: "s1", bodyId: "b1", colliderKind: "sphere", size: 0.5 },
    });

    if (!collider.ok) throw new Error(collider.message);
    const first = evaluateScenePhysics({ catalog: collider.catalog, sourceContentHash: hash, steps: 4 });
    const second = evaluateScenePhysics({ catalog: collider.catalog, sourceContentHash: hash, steps: 4 });
    expect(first).toMatchObject({ ok: true, evaluation: { order: "animation-then-physics", savedBytesWritten: false } });
    expect(second).toEqual(first);

    if (!first.ok) throw new Error(first.message);
    expect(first.evaluation.snapshots).toHaveLength(4);
  });
});

const legacy = {
  schemaVersion: 1,
  kind: "sceneaxi.scene-physics-catalog",
  world: { gravityY: -9.81, stepMs: 16, seed: 1 },
  bodies: [{ bodyId: "ball", instanceId: "ball", kind: "dynamic", mass: 1 }],
  "shapes": [{ "shapeId": "ball-shape", bodyId: "ball", kind: "sphere", size: 0.5 }],
  materials: [],
  constraints: [],
} as const;

describe("schema-v1 physics legacy and hostile boundaries", () => {
  it("normalizes legacy shapes with stable IDs, saves/reloads and evaluates without changing the source", () => {
    const bytes = JSON.stringify(legacy);
    const parsed = parseScenePhysicsCatalog(legacy);
    expect(parsed?.colliders).toEqual([{ colliderId: "ball-shape", bodyId: "ball", kind: "sphere", size: 0.5 }]);
    expect(parsed).toMatchObject({ "shapes": legacy["shapes"], world: { engine: "toy" } });
    const reloaded = parseScenePhysicsCatalog(JSON.parse(JSON.stringify(parsed)));
    expect(reloaded).toEqual(parsed);
    expect(evaluateScenePhysics({ catalog: legacy, sourceContentHash: hash, steps: 4 })).toEqual(
      evaluateScenePhysics({ catalog: reloaded ?? legacy, sourceContentHash: hash, steps: 4 }),
    );
    const host = createToyPhysicsWorldHost();
    const first = host.create(legacy);
    const second = host.create(reloaded ?? legacy);

    try {
      for (let step = 0; step < 4; step += 1) { first.step(0.016); second.step(0.016); }

      expect(second.serialize()).toBe(first.serialize());
    } finally { first.dispose(); second.dispose(); }

    expect(JSON.stringify(legacy)).toBe(bytes);
  });

  it("supports the former shape-upsert fields without losing shape IDs", () => {
    const changed = applyScenePhysicsMutation({
      catalog: legacy, instanceIds: ["ball"],
      mutation: { kind: "shape-upsert", "shapeId": "ball-shape", bodyId: "ball", "shapeKind": "box", size: 2 }
    });

    expect(changed).toMatchObject({
      ok: true, catalog: {
        "shapes": [{ "shapeId": "ball-shape", bodyId: "ball", kind: "box", size: 2 }],
        colliders: [{ colliderId: "ball-shape", bodyId: "ball", kind: "box", size: 2 }],
      }
    });
  });

  it("rejects null world, accessors, revoked/throwing proxies and sparse arrays without invoking getters", () => {
    let reads = 0;
    const accessor = { ...legacy, get world() { reads += 1; throw new Error("secret"); } };
    const nested = { ...legacy, world: { ...legacy.world, get engine() { reads += 1; throw new Error("secret"); } } };
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const hostile = new Proxy({}, { ownKeys() { throw new Error("secret"); } });
    const sparse: unknown[] = [];
      sparse.length = 1;

    for (const value of [{ ...legacy, world: null }, accessor, nested, revoked.proxy, hostile,
    { ...legacy, bodies: sparse }, { ...legacy, "shapes": null }]) {
      expect(() => parseScenePhysicsCatalog(value)).not.toThrow();
      expect(parseScenePhysicsCatalog(value)).toBeNull();
      expect(evaluateScenePhysics({ catalog: value, sourceContentHash: hash, steps: 4 }))
        .toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.catalogInvalid });
      expect(() => createToyPhysicsWorldHost().create(value)).toThrow(SCENE_PHYSICS_REFUSALS.catalogInvalid);
    }

    expect(reads).toBe(0);
    expect(legacy["shapes"][0]["shapeId"]).toBe("ball-shape");
  });

  it("rejects contradictory aliases, duplicate IDs and invalid nested fields instead of discarding them", () => {
    for (const value of [
      { ...legacy, colliders: [{ colliderId: "different", bodyId: "ball", kind: "sphere", size: 0.5 }] },
      { ...legacy, "shapes": [...legacy["shapes"], ...legacy["shapes"]] },
      { ...legacy, bodies: [{ ...legacy.bodies[0], mass: Infinity }] },
      { ...legacy, world: { ...legacy.world, stepMs: 33 } },
      { ...legacy, materials: [{ bodyId: "missing", friction: 0, restitution: 0 }] },
    ]) expect(parseScenePhysicsCatalog(value)).toBeNull();
  });
});

it("retains empty and parsed schema-v1 shape access while admitting collider-only spread fixtures", () => {
  const empty = emptyScenePhysicsCatalog();
  expect(empty["shapes"]).toEqual([]);
  const input = { ...empty, bodies: legacy.bodies, colliders: [{ colliderId: "stable", bodyId: "ball", kind: "sphere", size: 0.5 }] };
  expect(parseScenePhysicsCatalog(input)?.["shapes"]).toEqual([{ "shapeId": "stable", bodyId: "ball", kind: "sphere", size: 0.5 }]);
});

it("toy host pins fixed steps and refuses terminal use without changing a live snapshot", () => {
  const host = createToyPhysicsWorldHost(), world = host.create(legacy);
  const before = world.serialize();

  try {
    for (const delta of [0, -0.016, 0.032, NaN, Infinity]) {
      expect(() => world.step(delta)).toThrow("PHYSICS_STEP_UNSTABLE");
      expect(world.serialize()).toBe(before);
    }

    world.step(0.016);
    expect(world.snapshot()[0]?.vy).toBeLessThan(0);
  } finally { world.dispose(); }

  world.dispose();
  expect(() => world.step(0.016)).toThrow("PHYSICS_HOST_NOT_READY");
  expect(() => world.snapshot()).toThrow("PHYSICS_HOST_NOT_READY");
  expect(() => world.serialize()).toThrow("PHYSICS_HOST_NOT_READY");
});

describe("physics mutation canonical save/reload admission", () => {
  it.each([
    { kind: "world-set", gravityY: -9.81, stepMs: 16, seed: 1.5 },
    { kind: "body-upsert", bodyId: "ball", instanceId: "ball", bodyKind: "dynamic", mass: 1e100 },
    { kind: "shape-upsert", colliderId: "ball-shape", bodyId: "ball", colliderKind: "sphere", size: 1e100 },
    { kind: "material-upsert", bodyId: "ball", friction: 1e100, restitution: 0 },
    { kind: "constraint-upsert", constraintId: "self", constraintKind: "fixed", bodyA: "ball", bodyB: "ball" },
  ] satisfies readonly import("@sceneaxi/schemas").ScenePhysicsMutation[])("refuses non-reloadable mutation %j without changing saved bytes", (mutation) => {
    const before = JSON.stringify(legacy);
    const result = applyScenePhysicsMutation({ catalog: legacy, instanceIds: ["ball"], mutation });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(legacy)).toBe(before);
  });
  it("keeps legacy guaranteed shape access and all admitted mutations reloadable", () => {
    const legacyColliderIds = (catalog: import("@sceneaxi/schemas").ScenePhysicsCatalog) => catalog["shapes"].map((collider) => collider["shapeId"]);
    expect(legacyColliderIds(legacy)).toEqual(["ball-shape"]);

    for (const mutation of [
      { kind: "world-set", gravityY: -9.81, stepMs: 16, seed: 2 },
      { kind: "body-upsert", bodyId: "other", instanceId: "other", bodyKind: "static", mass: 2 },
      { kind: "shape-upsert", "shapeId": "ball-shape", bodyId: "ball", "shapeKind": "box", size: 2 },
      { kind: "material-upsert", bodyId: "ball", friction: 0.5, restitution: 0.2 },
      { kind: "body-remove", bodyId: "ball" },
    ] satisfies readonly import("@sceneaxi/schemas").ScenePhysicsMutation[]) {
      const result = applyScenePhysicsMutation({ catalog: legacy, instanceIds: ["ball", "other"], mutation });
      expect(result.ok).toBe(true);

      if (!result.ok) throw new Error(result.message);
      expect(parseScenePhysicsCatalog(JSON.parse(JSON.stringify(result.catalog)))).toEqual(result.catalog);
    }
  });
});
