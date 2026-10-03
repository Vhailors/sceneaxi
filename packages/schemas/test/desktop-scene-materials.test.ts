import {
  SCENE_MATERIALS_REFUSALS,
  applySceneMaterialsMutation,
  emptySceneMaterialsCatalog,
  parseSceneMaterialsCatalog,
  sceneMaterialsCatalogDigest,
  type SceneMaterialOverride,
} from "@sceneaxi/schemas";
import { describe, expect, it } from "vitest";

const legacy: SceneMaterialOverride = {
  instanceId: "crate", emissiveColor: "#46D8EC", emissiveIntensity: 0.4, opacity: 1,
  baseColorMapAssetId: null, normalMapAssetId: null, roughnessMapAssetId: null,
};

function apply(row: SceneMaterialOverride) {
  return applySceneMaterialsMutation({ catalog: emptySceneMaterialsCatalog(), instanceIds: ["crate"], mutation: { ...row, kind: "upsert" } });
}

describe("desktop scene materials catalog", () => {
  it("keeps absent scalar fields out of legacy bytes and digests", () => {
    const result = apply(legacy);

    if (!result.ok) throw new Error(result.message);
    expect(JSON.stringify(result.catalog.overrides[0])).toBe(JSON.stringify(legacy));
    expect(sceneMaterialsCatalogDigest(result.catalog)).toBe("sha256:75d693598f392895f493be1d36d5e8ff87102886e64589a8d8681f3e20d22edb");
  });

  it("validates and roundtrips optional base colour, metallic and roughness", () => {
    const row = { ...legacy, baseColor: "#abcdef", metallic: 0.7, roughness: 0.2 };
    const result = apply(row);

    if (!result.ok) throw new Error(result.message);
    expect(result.catalog.overrides[0]).toEqual(row);
    expect(Object.isFrozen(result.catalog.overrides[0])).toBe(true);
    expect(parseSceneMaterialsCatalog(JSON.parse(JSON.stringify(result.catalog)))).toEqual(result.catalog);
    expect(sceneMaterialsCatalogDigest(result.catalog)).not.toBe(sceneMaterialsCatalogDigest(emptySceneMaterialsCatalog()));

    for (const patch of [{ baseColor: "red" }, { metallic: -1 }, { metallic: NaN }, { roughness: 1.1 }, { roughness: Infinity }]) {
      expect(apply({ ...row, ...patch })).toMatchObject({ ok: false, reason: SCENE_MATERIALS_REFUSALS.inputUnsupported });
      expect(parseSceneMaterialsCatalog({ ...result.catalog, overrides: [{ ...row, ...patch }] })).toBeNull();
    }

    for (const value of [0, 1]) expect(apply({ ...row, metallic: value, roughness: value })).toMatchObject({ ok: true });
  });

  it("refuses Kids before reading material data", () => {
    expect(applySceneMaterialsMutation({ profile: "kids", get catalog(): never { throw new Error("catalog read"); }, get mutation(): never { throw new Error("mutation read"); }, get instanceIds(): never { throw new Error("targets read"); } })).toMatchObject({ ok: false, reason: SCENE_MATERIALS_REFUSALS.kidsDenied });
  });

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
