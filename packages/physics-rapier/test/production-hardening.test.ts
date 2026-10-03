import { describe, expect, it } from "vitest";
import { createRapierPhysicsWorldHost, type RapierWorldOptions } from "@sceneaxi/physics-rapier";
import { emptyScenePhysicsCatalog, evaluateScenePhysics, parseScenePhysicsCatalog, SCENE_PHYSICS_REFUSALS, type ScenePhysicsCatalog } from "@sceneaxi/schemas";

const catalog: ScenePhysicsCatalog = { ...emptyScenePhysicsCatalog(), world: { gravityY: -9.81, stepMs: 16, seed: 1, engine: "rapier" }, bodies: [{bodyId:"floor",instanceId:"floor",kind:"static",mass:1},{bodyId:"ball",instanceId:"ball",kind:"dynamic",mass:1}], colliders: [{colliderId:"floor",bodyId:"floor",kind:"box",size:2},{colliderId:"ball",bodyId:"ball",kind:"sphere",size:0.5}], materials: [{bodyId:"ball",friction:0.5,restitution:0.5}] };

describe("posed Rapier persistence through the public host", () => {
  it("accepts explicit full poses, collides, JSON save/replays exact solver state then continues identically", async () => {
    const host = await createRapierPhysicsWorldHost();
    const a = host.create(catalog, { poses: [{bodyId:"floor",translation:[3,0,4],rotation:[0,0,0,1]},{bodyId:"ball",translation:[3,3,4],rotation:[0,0,0,1]}] });

    try {
      expect(a.poses()[1]?.translation).toEqual([3,3,4]);

      for(let i=0;i<100;i++) a.step(0.016);
      expect(a.poses()[1]?.translation[1]).toBeGreaterThanOrEqual(1.4);
      const b = host.replay(JSON.parse(JSON.stringify(a.save())));

      try { expect(b.serialize()).toBe(a.serialize()); expect(b.poses()).toEqual(a.poses());

 for(let i=0;i<20;i++) { a.step(0.016); b.step(0.016); }

 expect(b.serialize()).toBe(a.serialize()); } finally { b.dispose(); }

      expect(() => host.replay({...a.save(), terminal:"tampered"})).toThrow(/mismatch/);
    } finally { a.dispose(); }

    expect(() => a.poses()).toThrow(/READY/);
  });
  it("queues animation before physics without premature pose writes and persists those events", async () => {
    const host = await createRapierPhysicsWorldHost(); const a = host.create(catalog);

    try {
      const before = a.serialize(); a.queueAnimation([{bodyId:"ball",translation:[4,8,3],rotation:[0,0,0,1]}]); expect(a.serialize()).toBe(before); expect(() => a.save()).toThrow(/pending/);
      a.step(0.016); expect(a.poses()[1]?.translation[0]).toBe(4); expect(a.poses()[1]?.translation[1]).toBeLessThan(8);
      const b=host.replay(a.save());

 try { expect(b.serialize()).toBe(a.serialize()); } finally { b.dispose(); }

      expect(() => a.queueAnimation([{bodyId:"ball",translation:[NaN,0,0],rotation:[0,0,0,1]}])).toThrow();
    } finally { a.dispose(); }
  });
});

it("keeps explicitly rotated fixed-joint local frames through JSON resume", async () => {
  const host = await createRapierPhysicsWorldHost(), q = Math.SQRT1_2;
  const joined = { ...catalog, constraints: [{ constraintId: "weld", kind: "fixed" as const, bodyA: "floor", bodyB: "ball" }] };
  const options: RapierWorldOptions = { poses: [{ bodyId: "floor", translation: [0,0,0], rotation: [0,0,0,1] }, { bodyId: "ball", translation: [0,2,0], rotation: [0,0,q,q] }], jointFrames: [{ constraintId: "weld", anchorA: [0,2,0], anchorB: [0,0,0], rotationA: [0,0,0,1], rotationB: [0,0,-q,q] }] };
  const a = host.create(joined, options);

  try {
    for (let i = 0; i < 20; i++) a.step(0.016);
    expect(a.poses()[1]?.rotation[2]).toBeCloseTo(q, 4);
    const b = host.replay(JSON.parse(JSON.stringify(a.save())));

    try { expect(b.poses()).toEqual(a.poses());

 for (let i = 0; i < 20; i++) { a.step(0.016); b.step(0.016); }

 expect(b.serialize()).toBe(a.serialize()); } finally { b.dispose(); }

    const frame = options.jointFrames?.[0];

    if (!frame) throw new Error("Missing fixed-joint test fixture.");
    expect(() => host.create(joined, { ...options, jointFrames: [{ ...frame, rotationB: [NaN,0,0,1] }] })).toThrow();
  } finally { a.dispose(); }
});

it("refuses sparse pose coordinates rather than entering a nonfinite solver state", async () => {
  const host = await createRapierPhysicsWorldHost();
  const sparse: [number, number, number] = [0, 0, 0];

  for (const index of sparse.keys()) Reflect.deleteProperty(sparse, index);
  expect(() => host.create(catalog, { poses: [{ bodyId: "ball", translation: sparse, rotation: [0,0,0,1] }] })).toThrow();
});

describe("legacy schema-v1 Rapier boundary", () => {
  const legacyColliderKey = "shapes";
  const legacyColliderIdKey = "shapeId";

  const legacy = {
    schemaVersion: 1, kind: "sceneaxi.scene-physics-catalog",
    world: { gravityY: -9.81, stepMs: 16, seed: 1, engine: "rapier" },
    bodies: [{ bodyId: "ball", instanceId: "ball", kind: "dynamic", mass: 1 }],
    [legacyColliderKey]: [{ [legacyColliderIdKey]: "original-ball", bodyId: "ball", kind: "sphere", size: 0.5 }],
    materials: [], constraints: [],
  } as const;

  it("evaluates, serializes and resumes a saved shapes/shapeId fixture with stable IDs and exact continuation", async () => {
    const host = await createRapierPhysicsWorldHost();
    const bytes = JSON.stringify(legacy);
    const a = host.create(legacy);

    try {
      for (let step = 0; step < 4; step += 1) a.step(0.016);
      const saved = JSON.parse(JSON.stringify(a.save()));
      expect(saved.catalog.shapes).toEqual(legacy.shapes);
      expect(saved.catalog.colliders[0].colliderId).toBe("original-ball");
      const b = host.replay(saved);

      try {
        expect(b.serialize()).toBe(a.serialize());
        a.step(0.016); b.step(0.016);
        expect(b.serialize()).toBe(a.serialize());
      } finally { b.dispose(); }

      expect(evaluateScenePhysics({ catalog: legacy, sourceContentHash: `sha256:${"cd".repeat(32)}`, steps: 4, host }))
        .toEqual(evaluateScenePhysics({ catalog: parseScenePhysicsCatalog(JSON.parse(bytes)), sourceContentHash: `sha256:${"cd".repeat(32)}`, steps: 4, host }));
    } finally { a.dispose(); }

    expect(JSON.stringify(legacy)).toBe(bytes);
  });

  it("refuses null/accessor/proxy catalogs before allocation without reading getters", async () => {
    const host = await createRapierPhysicsWorldHost();
    let reads = 0;
    const accessor = { ...legacy, get world() { reads += 1; throw new Error("private"); } };
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const proxy = new Proxy({}, { ownKeys() { throw new Error("private"); } });

    for (const bad of [{ ...legacy, world: null }, accessor, revoked.proxy, proxy]) {
      expect(() => host.create(bad)).toThrow(SCENE_PHYSICS_REFUSALS.catalogInvalid);
    }

    expect(reads).toBe(0);
  });
});
