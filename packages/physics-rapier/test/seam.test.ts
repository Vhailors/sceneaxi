import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRapierPhysicsWorldHost, seam } from "@sceneaxi/physics-rapier";
import {
  emptyScenePhysicsCatalog,
  PHYSICS_WORLD_HOST_REFUSALS,
  SCENE_PHYSICS_REFUSALS,
  type ScenePhysicsCatalog,
} from "@sceneaxi/schemas";

function catalog(): ScenePhysicsCatalog {
  return {
    ...emptyScenePhysicsCatalog(),
    world: { gravityY: -9.81, stepMs: 16, seed: 1, engine: "rapier" },
    bodies: [
      { bodyId: "floor", instanceId: "floor", kind: "static", mass: 1 },
      { bodyId: "ball", instanceId: "ball", kind: "dynamic", mass: 2 },
      { bodyId: "capsule", instanceId: "capsule", kind: "kinematic", mass: 3 },
    ],
    colliders: [
      { colliderId: "floor", bodyId: "floor", kind: "box", size: 1 },
      { colliderId: "ball", bodyId: "ball", kind: "sphere", size: 0.25 },
      { colliderId: "capsule", bodyId: "capsule", kind: "capsule", size: 0.25 },
    ],
    materials: [
      { bodyId: "floor", friction: 0.8, restitution: 1 },
      { bodyId: "ball", friction: 0.2, restitution: 1 },
    ],
  };
}

describe("Rapier PhysicsWorldHost public seam", () => {
  it("exports the frozen seam and confines the adapter to browser-safe source", () => {
    expect(seam).toEqual({ name: "@sceneaxi/physics-rapier", releaseGroup: "core-train" });
    expect(Object.isFrozen(seam)).toBe(true);
    const source = new URL("../src/", import.meta.url);

    for (const file of readdirSync(source)) {
      const text = readFileSync(new URL(file, source), "utf8");
      expect(text).not.toMatch(/node:|\b(?:process|Buffer|require|__dirname)\b/);
    }

    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(manifest.dependencies["@dimforge/rapier3d-compat"])
      .toBe("npm:@dimforge/rapier3d-deterministic-compat@0.21.0");
  });

  it("uses real collision and restitution while static and kinematic bodies stay put", async () => {
    const host = await createRapierPhysicsWorldHost();
    expect(host.kind).toBe("rapier");
    expect(Object.isFrozen(host)).toBe(true);
    const world = host.create(catalog());

    try {
      expect(world.snapshot()).toEqual([
        { bodyId: "floor", y: 1.01, vy: 0 },
        { bodyId: "ball", y: 2.01, vy: 0 },
        { bodyId: "capsule", y: 3.01, vy: 0 },
      ]);
      const speeds: number[] = [];

      for (let step = 0; step < 32; step += 1) {
        world.step(0.016);
        const snapshot = world.snapshot();
        expect(snapshot[0]).toEqual({ bodyId: "floor", y: 1.01, vy: 0 });
        expect(snapshot[2]).toEqual({ bodyId: "capsule", y: 3.01, vy: 0 });
        speeds.push(snapshot[1]?.vy ?? NaN);
      }

      expect(speeds.some((speed) => speed < -1)).toBe(true);
      expect(speeds.some((speed) => speed > 1)).toBe(true);
    } finally {
      world.dispose();
    }

    world.dispose();
    expect(() => world.step(0.016)).toThrow(PHYSICS_WORLD_HOST_REFUSALS.notReady);
    expect(() => world.snapshot()).toThrow(PHYSICS_WORLD_HOST_REFUSALS.notReady);
    expect(() => world.serialize()).toThrow(PHYSICS_WORLD_HOST_REFUSALS.notReady);
  });

  it.each(["fixed", "hinge"] as const)("enforces an authored %s constraint", async (kind) => {
    const host = await createRapierPhysicsWorldHost();
    const input = catalog();

    const world = host.create({
      ...input,
      colliders: [],
      constraints: [{ constraintId: "link", kind, bodyA: "floor", bodyB: "ball" }],
    });

    try {
      for (let step = 0; step < 64; step += 1) world.step(0.016);
      expect(world.snapshot()[1]?.y).toBeCloseTo(2.01, 4);
      expect(world.snapshot()[1]?.vy).toBeCloseTo(0, 4);
    } finally {
      world.dispose();
    }
  });

  it("pins the fixed step and does not retain caller-owned world settings", async () => {
    const host = await createRapierPhysicsWorldHost();
    const input = { ...catalog(), world: { ...catalog().world } };
    const world = host.create(input);

    try {
      const before = world.serialize();

      for (const dt of [0, -0.016, 0.032, NaN, Infinity]) {
        expect(() => world.step(dt)).toThrow(SCENE_PHYSICS_REFUSALS.stepUnstable);
        expect(world.serialize()).toBe(before);
      }

      input.world.stepMs = 32;
      input.world.gravityY = 0;
      world.step(0.016);
      expect(world.snapshot()[1]?.vy).toBeLessThan(0);
    } finally {
      world.dispose();
    }
  });

  it("refuses invalid catalogs rather than dropping unsupported state", async () => {
    const host = await createRapierPhysicsWorldHost();
    const input = catalog();
    expect(() => host.create({ ...input, world: { ...input.world, engine: "toy" } }))
      .toThrow(PHYSICS_WORLD_HOST_REFUSALS.kindUnknown);
    expect(() => host.create({ ...input, world: { ...input.world, stepMs: 40 } }))
      .toThrow(SCENE_PHYSICS_REFUSALS.stepUnstable);
    expect(() => host.create({ ...input, world: { ...input.world, gravityY: Infinity } }))
      .toThrow(SCENE_PHYSICS_REFUSALS.catalogInvalid);
    expect(() => host.create({ ...input, bodies: [...input.bodies, ...input.bodies] }))
      .toThrow(SCENE_PHYSICS_REFUSALS.catalogInvalid);
    expect(() => host.create({ ...input, colliders: [{ colliderId: "bad", bodyId: "absent", kind: "box", size: 1 }] }))
      .toThrow(SCENE_PHYSICS_REFUSALS.bodyUnknown);
    expect(() => host.create({ ...input, colliders: [{ colliderId: "bad", bodyId: "ball", kind: "box", size: -1 }] }))
      .toThrow(SCENE_PHYSICS_REFUSALS.colliderInvalid);
    expect(() => host.create({ ...input, materials: [{ bodyId: "ball", friction: -1, restitution: 0 }] }))
      .toThrow(SCENE_PHYSICS_REFUSALS.catalogInvalid);
    expect(() => host.create({ ...input, constraints: [{ constraintId: "bad", kind: "fixed", bodyA: "ball", bodyB: "ball" }] }))
      .toThrow(SCENE_PHYSICS_REFUSALS.constraintUnsupported);
  });
});
