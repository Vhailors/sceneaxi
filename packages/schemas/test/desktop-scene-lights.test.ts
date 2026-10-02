import { describe, expect, it } from "vitest";
import {
  SCENE_LIGHTS_REFUSALS,
  applySceneLightsMutation,
  emptySceneLightsCatalog,
  inspectSceneLights,
  parseSceneLightsCatalog,
  sceneLightsCatalogDigest,
  type SceneLight,
} from "@sceneaxi/schemas";

const light: SceneLight = {
  instanceId: "sun", kind: "directional", color: "#ffffff", intensity: 2,
  range: 10, angle: 45, penumbra: 0.2, castShadow: true,
};

function apply(row: SceneLight, catalog = emptySceneLightsCatalog()) {
  return applySceneLightsMutation({
    catalog, instanceIds: ["sun", "mesh", "node"],
    mutation: { kind: "upsert", light: row },
  });
}

describe("desktop scene lights catalog", () => {
  it("refuses Kids before reading any catalog, target or mutation", () => {
    expect(applySceneLightsMutation({
      profile: "kids",
      get catalog(): never { throw new Error("catalog read"); },
      get instanceIds(): never { throw new Error("targets read"); },
      get mutation(): never { throw new Error("mutation read"); },
    })).toMatchObject({ ok: false, reason: "SCENE_LIGHTS_KIDS_DENIED" });
  });

  it("roundtrips all kinds on mesh and node carriers without mutating inputs", () => {
    for (const kind of ["directional", "point", "spot", "hemisphere"] as const) {
      for (const instanceId of ["mesh", "node"]) {
        const row = { ...light, instanceId, kind, castShadow: kind === "directional" };
        const result = apply(row);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.message);
        expect(result.catalog.lights).toEqual([row]);
        expect(Object.isFrozen(result.catalog.lights[0])).toBe(true);
        expect(parseSceneLightsCatalog(JSON.parse(JSON.stringify(result.catalog)))).toEqual(result.catalog);
        expect(inspectSceneLights(result.catalog)).toMatchObject({
          digest: sceneLightsCatalogDigest(result.catalog), savedBytesWritten: false,
        });
        expect(sceneLightsCatalogDigest(result.catalog)).not.toBe(sceneLightsCatalogDigest(emptySceneLightsCatalog()));
        row.intensity = 4;
        expect(result.catalog.lights[0]?.intensity).toBe(2);
        const removed = applySceneLightsMutation({ catalog: result.catalog, instanceIds: [instanceId], mutation: { kind: "remove", instanceId } });
        expect(removed).toEqual({ ok: true, catalog: emptySceneLightsCatalog() });
      }
    }
  });

  it("refuses invalid fields and missing targets", () => {
    for (const patch of [
      { color: "white" }, { intensity: -1 }, { intensity: NaN }, { range: Infinity },
      { range: -1 }, { angle: 0 }, { angle: 91 }, { penumbra: 2 },
      { kind: "point" as const, castShadow: true },
    ]) {
      expect(apply({ ...light, ...patch })).toMatchObject({ ok: false, reason: SCENE_LIGHTS_REFUSALS.inputUnsupported });
    }
    expect(apply({ ...light, instanceId: "missing" })).toMatchObject({ ok: false, reason: SCENE_LIGHTS_REFUSALS.targetMissing });
  });

  it("refuses a ninth light and a second shadow caster but allows replacement", () => {
    const catalog = { ...emptySceneLightsCatalog(), lights: Array.from({ length: 8 }, (_, i) => ({ ...light, instanceId: `light-${i}`, castShadow: i === 0 })) };
    const instanceIds = [...catalog.lights.map((row) => row.instanceId), "sun"];
    expect(applySceneLightsMutation({ catalog, instanceIds, mutation: { kind: "upsert", light: { ...light, castShadow: false } } })).toMatchObject({ ok: false, reason: SCENE_LIGHTS_REFUSALS.limitExceeded });
    expect(applySceneLightsMutation({ catalog, instanceIds, mutation: { kind: "upsert", light: { ...light, instanceId: "light-1" } } })).toMatchObject({ ok: false, reason: SCENE_LIGHTS_REFUSALS.shadowLimitExceeded });
    expect(applySceneLightsMutation({ catalog, instanceIds, mutation: { kind: "upsert", light: { ...light, instanceId: "light-0" } } })).toMatchObject({ ok: true });
  });

  it("rejects malformed and duplicate catalogs instead of trusting a version tag", () => {
    expect(parseSceneLightsCatalog(undefined)).toEqual(emptySceneLightsCatalog());
    for (const value of [false, [], {}, { ...emptySceneLightsCatalog(), schemaVersion: 2 },
      { ...emptySceneLightsCatalog(), lights: [null] },
      { ...emptySceneLightsCatalog(), lights: [light, light] },
      { ...emptySceneLightsCatalog(), lights: [{ ...light, intensity: "2" }] },
    ]) expect(parseSceneLightsCatalog(value)).toBeNull();
  });
});
