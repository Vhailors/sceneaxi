import { describe, expect, it } from "vitest";
import {
  SCENE_MATERIALS_REFUSALS,
  applySceneMaterialsMutation,
  emptySceneMaterialsCatalog,
} from "@sceneaxi/schemas";

describe("desktop scene materials catalog", () => {
  it("refuses missing instances, Kids, and out-of-range opacity", () => {
    const catalog = emptySceneMaterialsCatalog();
    expect(
      applySceneMaterialsMutation({
        catalog,
        instanceIds: ["crate"],
        profile: "kids",
        mutation: {
          kind: "upsert",
          instanceId: "crate",
          emissiveColor: "#112233",
          emissiveIntensity: 0,
          opacity: 1,
          baseColorMapAssetId: null,
          normalMapAssetId: null,
          roughnessMapAssetId: null,
        },
      }),
    ).toMatchObject({ ok: false, reason: SCENE_MATERIALS_REFUSALS.kidsDenied });
    expect(
      applySceneMaterialsMutation({
        catalog,
        instanceIds: ["crate"],
        mutation: {
          kind: "upsert",
          instanceId: "missing",
          emissiveColor: "#112233",
          emissiveIntensity: 0,
          opacity: 1,
          baseColorMapAssetId: null,
          normalMapAssetId: null,
          roughnessMapAssetId: null,
        },
      }),
    ).toMatchObject({ ok: false, reason: SCENE_MATERIALS_REFUSALS.targetMissing });
    expect(
      applySceneMaterialsMutation({
        catalog,
        instanceIds: ["crate"],
        mutation: {
          kind: "upsert",
          instanceId: "crate",
          emissiveColor: "#112233",
          emissiveIntensity: 0,
          opacity: 2,
          baseColorMapAssetId: null,
          normalMapAssetId: null,
          roughnessMapAssetId: null,
        },
      }),
    ).toMatchObject({ ok: false, reason: SCENE_MATERIALS_REFUSALS.inputUnsupported });
  });

  it("upserts an override without rewriting artifact bytes", () => {
    const applied = applySceneMaterialsMutation({
      catalog: emptySceneMaterialsCatalog(),
      instanceIds: ["crate"],
      mutation: {
        kind: "upsert",
        instanceId: "crate",
        emissiveColor: "#46D8EC",
        emissiveIntensity: 0.4,
        opacity: 1,
        baseColorMapAssetId: null,
        normalMapAssetId: null,
        roughnessMapAssetId: null,
      },
    });
    expect(applied).toMatchObject({ ok: true });
    if (!applied.ok) throw new Error(applied.message);
    expect(applied.catalog.overrides).toHaveLength(1);
    expect(applied.catalog.overrides[0]?.instanceId).toBe("crate");
  });
});
