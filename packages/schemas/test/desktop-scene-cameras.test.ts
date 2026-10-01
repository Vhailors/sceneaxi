import { describe, expect, it } from "vitest";
import {
  SCENE_CAMERAS_REFUSALS,
  applySceneCamerasMutation,
  emptySceneCamerasCatalog,
  inspectSceneCameras,
  parseSceneCamerasCatalog,
  sceneCamerasCatalogDigest,
  type SceneCamera,
} from "@sceneaxi/schemas";

const camera: SceneCamera = { instanceId: "camera", kind: "perspective", fovDegrees: 60, orthoSize: 10, near: 0.1, far: 100, active: true };

function apply(row: SceneCamera, catalog = emptySceneCamerasCatalog()) {
  return applySceneCamerasMutation({ catalog, instanceIds: ["camera", "node", "mesh"], mutation: { kind: "upsert", camera: row } });
}

describe("desktop scene cameras catalog", () => {
  it("refuses Kids before any catalog, target or mutation access", () => {
    expect(applySceneCamerasMutation({
      profile: "kids",
      get catalog(): never { throw new Error("catalog read"); },
      get instanceIds(): never { throw new Error("targets read"); },
      get mutation(): never { throw new Error("mutation read"); },
    })).toMatchObject({ ok: false, reason: "SCENE_CAMERAS_KIDS_DENIED" });
  });

  it("roundtrips both projections on either carrier and removes them", () => {
    for (const kind of ["perspective", "orthographic"] as const) {
      for (const instanceId of ["mesh", "node"]) {
        const row = { ...camera, kind, instanceId };
        const result = apply(row);
        if (!result.ok) throw new Error(result.message);
        expect(result.catalog.cameras).toEqual([row]);
        expect(Object.isFrozen(result.catalog.cameras[0])).toBe(true);
        expect(parseSceneCamerasCatalog(JSON.parse(JSON.stringify(result.catalog)))).toEqual(result.catalog);
        expect(inspectSceneCameras(result.catalog)).toMatchObject({ digest: sceneCamerasCatalogDigest(result.catalog), savedBytesWritten: false });
        expect(sceneCamerasCatalogDigest(result.catalog)).not.toBe(sceneCamerasCatalogDigest(emptySceneCamerasCatalog()));
        row.fovDegrees = 90;
        expect(result.catalog.cameras[0]?.fovDegrees).toBe(60);
        expect(applySceneCamerasMutation({ catalog: result.catalog, instanceIds: [instanceId], mutation: { kind: "remove", instanceId } })).toEqual({ ok: true, catalog: emptySceneCamerasCatalog() });
      }
    }
  });

  it("refuses invalid projection ranges and missing carriers", () => {
    for (const patch of [{ fovDegrees: 0 }, { fovDegrees: 180 }, { fovDegrees: NaN }, { orthoSize: 0 }, { near: 0 }, { near: Infinity }, { far: 0.1 }]) {
      expect(apply({ ...camera, ...patch })).toMatchObject({ ok: false, reason: SCENE_CAMERAS_REFUSALS.inputUnsupported });
    }
    expect(apply({ ...camera, instanceId: "missing" })).toMatchObject({ ok: false, reason: SCENE_CAMERAS_REFUSALS.targetMissing });
  });

  it("allows one active camera and refuses conflicts without silently switching", () => {
    const first = apply(camera);
    if (!first.ok) throw new Error(first.message);
    expect(apply({ ...camera, instanceId: "node" }, first.catalog)).toMatchObject({ ok: false, reason: SCENE_CAMERAS_REFUSALS.activeConflict });
    expect(apply({ ...camera, instanceId: "node", active: false }, first.catalog)).toMatchObject({ ok: true });
    expect(apply({ ...camera, fovDegrees: 70 }, first.catalog)).toMatchObject({ ok: true });
  });

  it("rejects malformed, duplicate and multiply active catalogs", () => {
    expect(parseSceneCamerasCatalog(null)).toEqual(emptySceneCamerasCatalog());
    for (const value of [false, [], {}, { ...emptySceneCamerasCatalog(), cameras: [null] },
      { ...emptySceneCamerasCatalog(), cameras: [camera, camera] },
      { ...emptySceneCamerasCatalog(), cameras: [camera, { ...camera, instanceId: "node" }] },
      { ...emptySceneCamerasCatalog(), cameras: [{ ...camera, active: "true" }] },
    ]) expect(parseSceneCamerasCatalog(value)).toBeNull();
  });
});
