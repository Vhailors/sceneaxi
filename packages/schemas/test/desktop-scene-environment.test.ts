import { describe, expect, it } from "vitest";
import {
  SCENE_ENVIRONMENT_REFUSALS,
  applySceneEnvironmentMutation,
  emptySceneEnvironmentCatalog,
  sceneEnvironmentCatalogDigest,
  parseSceneEnvironmentCatalog,
  type SceneEnvironmentMutation,
} from "@sceneaxi/schemas";

describe("desktop scene environment catalog", () => {
  it("keeps legacy serialized fields and digest when additions are absent", () => {
    const catalog = emptySceneEnvironmentCatalog();
    expect(sceneEnvironmentCatalogDigest(catalog)).toBe("sha256:b45e996ad3caec286c192e05b18d02e5e67880cf57d649b1103b8c08bbf911de");
    const applied = applySceneEnvironmentMutation({ catalog, mutation: { kind: "set" } });
    if (!applied.ok) throw new Error(applied.message);
    expect(JSON.stringify(applied.catalog)).toBe(JSON.stringify(catalog));
    expect(parseSceneEnvironmentCatalog(JSON.parse(JSON.stringify(catalog)))).toEqual(catalog);
    expect(Object.keys(catalog)).not.toContain("sky");
    expect(Object.keys(catalog)).not.toContain("shadowBudget");
    expect(Object.keys(catalog)).not.toContain("bloom");
  });

  it("sets and preserves immutable sky, directional shadow budget and bloom parameters", () => {
    const sky = { top: "#112233", horizon: "#445566", ground: "#778899" };
    const shadowBudget = { mapSize: 2048 as const, maxDistance: 50 };
    const bloom = { strength: 1.5, threshold: 0.6, radius: 0.4 };
    const result = applySceneEnvironmentMutation({ catalog: emptySceneEnvironmentCatalog(), mutation: { kind: "set", sky, shadowBudget, bloom } });
    if (!result.ok) throw new Error(result.message);
    expect(result.catalog).toMatchObject({ sky, shadowBudget, bloom });
    expect(parseSceneEnvironmentCatalog(JSON.parse(JSON.stringify(result.catalog)))).toEqual(result.catalog);
    for (const field of [result.catalog.sky, result.catalog.shadowBudget, result.catalog.bloom]) expect(Object.isFrozen(field)).toBe(true);
    sky.top = "#000000";
    expect(result.catalog.sky?.top).toBe("#112233");
    const edited = applySceneEnvironmentMutation({ catalog: result.catalog, mutation: { kind: "set", exposure: 2 } });
    expect(edited).toMatchObject({ ok: true, catalog: { sky: result.catalog.sky, shadowBudget, bloom } });
    expect(sceneEnvironmentCatalogDigest(result.catalog)).not.toBe(sceneEnvironmentCatalogDigest(emptySceneEnvironmentCatalog()));
  });

  it("refuses invalid extension values in mutations and stored catalogs", () => {
    const invalid: SceneEnvironmentMutation[] = [
      { kind: "set", sky: { top: "blue", horizon: "#445566", ground: "#778899" } },
      { kind: "set", shadowBudget: { mapSize: 1024, maxDistance: 0 } },
      { kind: "set", shadowBudget: { mapSize: 2048, maxDistance: Infinity } },
      { kind: "set", bloom: { strength: -1, threshold: 0, radius: 0 } },
      { kind: "set", bloom: { strength: NaN, threshold: 0, radius: 0 } },
      { kind: "set", bloom: { strength: 1, threshold: 2, radius: 0 } },
      { kind: "set", bloom: { strength: 1, threshold: 0, radius: 2 } },
    ];
    for (const mutation of invalid) {
      expect(applySceneEnvironmentMutation({ catalog: emptySceneEnvironmentCatalog(), mutation })).toMatchObject({ ok: false, reason: SCENE_ENVIRONMENT_REFUSALS.inputUnsupported });
      expect(parseSceneEnvironmentCatalog({ ...emptySceneEnvironmentCatalog(), ...mutation, kind: "sceneaxi.scene-environment-catalog" })).toBeNull();
    }
    expect(parseSceneEnvironmentCatalog({ ...emptySceneEnvironmentCatalog(), shadowBudget: { mapSize: 4096, maxDistance: 10 } })).toBeNull();
    expect(parseSceneEnvironmentCatalog({ ...emptySceneEnvironmentCatalog(), sky: null })).toBeNull();
  });

  it("refuses Kids before reading new environment data", () => {
    expect(applySceneEnvironmentMutation({ profile: "kids", get catalog(): never { throw new Error("catalog read"); }, get mutation(): never { throw new Error("mutation read"); } })).toMatchObject({ ok: false, reason: SCENE_ENVIRONMENT_REFUSALS.kidsDenied });
  });

  it("refuses Kids, unknown effects, and bad colours independently", () => {
    const catalog = emptySceneEnvironmentCatalog();
    expect(
      applySceneEnvironmentMutation({
        catalog,
        profile: "kids",
        mutation: { kind: "set", background: "#112233" },
      }),
    ).toMatchObject({ ok: false, reason: SCENE_ENVIRONMENT_REFUSALS.kidsDenied });
    expect(
      applySceneEnvironmentMutation({
        catalog,
        mutation: { kind: "set", background: "blue" },
      }),
    ).toMatchObject({ ok: false, reason: SCENE_ENVIRONMENT_REFUSALS.inputUnsupported });
    expect(
      applySceneEnvironmentMutation({
        catalog,
        mutation: { kind: "set", effects: ["bloom", "ssao"] },
      }),
    ).toMatchObject({ ok: false, reason: SCENE_ENVIRONMENT_REFUSALS.inputUnsupported });
  });

  it("applies a closed environment and pins the digest", () => {
    const applied = applySceneEnvironmentMutation({
      catalog: emptySceneEnvironmentCatalog(),
      mutation: {
        kind: "set",
        background: "#0A0F1A",
        exposure: 1.2,
        toneMapping: "aces",
        effects: ["bloom", "vignette"],
      },
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) throw new Error(applied.message);
    expect(applied.catalog.effects).toEqual(["bloom", "vignette"]);
    expect(sceneEnvironmentCatalogDigest(applied.catalog)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(sceneEnvironmentCatalogDigest(applied.catalog)).toBe(
      sceneEnvironmentCatalogDigest(applied.catalog),
    );
  });
});
