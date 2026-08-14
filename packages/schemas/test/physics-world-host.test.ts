import { describe, expect, it } from "vitest";
import {
  applyScenePhysicsMutation,
  createToyPhysicsWorldHost,
  emptyScenePhysicsCatalog,
} from "@sceneaxi/schemas";

describe("toy physics world host", () => {
  it("steps the same way twice from one catalog", () => {
    const body = applyScenePhysicsMutation({
      catalog: emptyScenePhysicsCatalog(),
      instanceIds: ["crate"],
      mutation: {
        kind: "body-upsert",
        bodyId: "falling",
        instanceId: "crate",
        bodyKind: "dynamic",
        mass: 1,
      },
    });
    if (!body.ok) throw new Error(body.message);
    const host = createToyPhysicsWorldHost();
    const first = host.create(body.catalog);
    const second = host.create(body.catalog);
    first.step(0.016);
    second.step(0.016);
    expect(first.snapshot()).toEqual(second.snapshot());
    first.dispose();
    second.dispose();
  });
});
