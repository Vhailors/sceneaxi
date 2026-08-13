import { describe, expect, it } from "vitest";
import {
  SCENE_PREFAB_REFUSALS,
  defineScenePrefab,
  emptyScenePrefabCatalog,
  inspectScenePrefab,
  instanceScenePrefab,
  overrideScenePrefab,
  refreshScenePrefab,
  scenePrefabChildInstanceId,
  scenePrefabRootInstanceId,
} from "@sceneaxi/schemas";

const transform = (x: number) => Object.freeze({
  translation: Object.freeze([x, 0, 0]) as [number, number, number],
  rotationEulerDegrees: Object.freeze([0, 0, 0]) as [number, number, number],
  scale: Object.freeze([1, 1, 1]) as [number, number, number],
});

const sources = Object.freeze([
  Object.freeze({
    instanceId: "root",
    artifactId: "crate",
    parentInstanceId: null,
    localTransform: transform(0),
  }),
  Object.freeze({
    instanceId: "child",
    artifactId: "crate",
    parentInstanceId: "root",
    localTransform: transform(2),
  }),
]);

describe("desktop scene prefab catalog", () => {
  it("snapshots a connected subtree and instances it with deterministic ids", () => {
    const defined = defineScenePrefab({
      catalog: emptyScenePrefabCatalog(),
      sources,
      selectedIds: ["root", "child"],
      definitionId: "crate-pair",
    });
    expect(defined).toMatchObject({ ok: true, definition: { definitionId: "crate-pair" } });
    if (!defined.ok) throw new Error(defined.message);
    const first = instanceScenePrefab({
      catalog: defined.catalog,
      occupiedInstanceIds: ["root", "child"],
      definitionId: "crate-pair",
      parentInstanceId: "root",
      instanceKey: "alpha",
    });
    const second = instanceScenePrefab({
      catalog: defined.catalog,
      occupiedInstanceIds: ["root", "child"],
      definitionId: "crate-pair",
      parentInstanceId: "root",
      instanceKey: "alpha",
    });
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    if (!first.ok || !second.ok) throw new Error("instance refused");
    expect(first.rootInstanceId).toBe(scenePrefabRootInstanceId("crate-pair", "alpha"));
    expect(first.placements.map((row) => row.instanceId)).toEqual([
      first.rootInstanceId,
      scenePrefabChildInstanceId(first.rootInstanceId, "child"),
    ]);
    expect(first.placements).toEqual(second.placements);
    expect(inspectScenePrefab(first.catalog).resolved[0]).toMatchObject({
      instanceId: first.rootInstanceId,
      stale: false,
    });
  });

  it("keeps overrides as explicit data and refuses structural or conflicting source updates", () => {
    const defined = defineScenePrefab({
      catalog: emptyScenePrefabCatalog(),
      sources,
      selectedIds: ["root", "child"],
      definitionId: "crate-pair",
    });
    if (!defined.ok) throw new Error(defined.message);
    const instanced = instanceScenePrefab({
      catalog: defined.catalog,
      occupiedInstanceIds: ["root", "child"],
      definitionId: "crate-pair",
      parentInstanceId: "root",
      instanceKey: "alpha",
    });
    if (!instanced.ok) throw new Error(instanced.message);
    expect(overrideScenePrefab({
      catalog: instanced.catalog,
      instanceId: instanced.rootInstanceId,
      sourceInstanceId: "missing-member",
      propertyId: "translation-x",
      value: 4,
    })).toMatchObject({ ok: false, reason: SCENE_PREFAB_REFUSALS.overrideUnsupported });
    const overridden = overrideScenePrefab({
      catalog: instanced.catalog,
      instanceId: instanced.rootInstanceId,
      sourceInstanceId: "child",
      propertyId: "translation-x",
      value: 4,
    });
    expect(overridden).toMatchObject({ ok: true });
    if (!overridden.ok) throw new Error(overridden.message);
    expect(overridden.catalog.instances[0]?.overrides).toEqual([
      { sourceInstanceId: "child", propertyId: "translation-x", value: 4 },
    ]);
    const shrunk = defineScenePrefab({
      catalog: overridden.catalog,
      sources,
      selectedIds: ["root"],
      definitionId: "crate-pair",
    });
    if (!shrunk.ok) throw new Error(shrunk.message);
    expect(refreshScenePrefab({
      catalog: shrunk.catalog,
      sources,
      definitionId: "crate-pair",
    })).toMatchObject({ ok: false, reason: SCENE_PREFAB_REFUSALS.sourceConflict });
  });
});
