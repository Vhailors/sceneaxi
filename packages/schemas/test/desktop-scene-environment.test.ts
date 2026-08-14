import { describe, expect, it } from "vitest";
import {
  SCENE_ENVIRONMENT_REFUSALS,
  applySceneEnvironmentMutation,
  emptySceneEnvironmentCatalog,
  sceneEnvironmentCatalogDigest,
} from "@sceneaxi/schemas";

describe("desktop scene environment catalog", () => {
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
