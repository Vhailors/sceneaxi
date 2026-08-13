import { describe, expect, it } from "vitest";
import {
  SCENE_PHYSICS_REFUSALS,
  applyScenePhysicsMutation,
  emptyScenePhysicsCatalog,
  evaluateScenePhysics,
} from "@sceneaxi/schemas";

const hash = `sha256:${"cd".repeat(32)}`;

describe("desktop scene physics catalog", () => {
  it("refuses missing targets, invalid shapes, unsupported constraints, and unstable steps", () => {
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
      mutation: { kind: "shape-upsert", shapeId: "s1", bodyId: "b1", shapeKind: "mesh", size: 1 },
    })).toMatchObject({ ok: false, reason: SCENE_PHYSICS_REFUSALS.shapeInvalid });
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
    const shape = applyScenePhysicsMutation({
      catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: { kind: "shape-upsert", shapeId: "s1", bodyId: "b1", shapeKind: "sphere", size: 0.5 },
    });
    if (!shape.ok) throw new Error(shape.message);
    const first = evaluateScenePhysics({ catalog: shape.catalog, sourceContentHash: hash, steps: 4 });
    const second = evaluateScenePhysics({ catalog: shape.catalog, sourceContentHash: hash, steps: 4 });
    expect(first).toMatchObject({ ok: true, evaluation: { order: "animation-then-physics", savedBytesWritten: false } });
    expect(second).toEqual(first);
    if (!first.ok) throw new Error(first.message);
    expect(first.evaluation.snapshots).toHaveLength(4);
  });
});
