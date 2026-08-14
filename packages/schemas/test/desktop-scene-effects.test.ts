import { describe, expect, it } from "vitest";
import {
  SCENE_EFFECTS_REFUSALS,
  applySceneEffectsMutation,
  emptySceneEffectsCatalog,
  sampleSceneEffects,
} from "@sceneaxi/schemas";

describe("desktop scene effects catalog", () => {
  it("refuses Kids and unknown emitter kinds", () => {
    expect(
      applySceneEffectsMutation({
        catalog: emptySceneEffectsCatalog(),
        profile: "kids",
        mutation: {
          kind: "upsert",
          emitterId: "sparks",
          emitterKind: "point",
          rate: 8,
          lifetimeMs: 800,
          speed: 1,
          spread: 0.4,
        },
      }),
    ).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.kidsDenied });
    expect(
      applySceneEffectsMutation({
        catalog: emptySceneEffectsCatalog(),
        mutation: {
          kind: "upsert",
          emitterId: "sparks",
          emitterKind: "gpu",
          rate: 8,
          lifetimeMs: 800,
          speed: 1,
          spread: 0.4,
        },
      }),
    ).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.inputUnsupported });
  });

  it("samples the same seeded positions twice", () => {
    const applied = applySceneEffectsMutation({
      catalog: emptySceneEffectsCatalog(),
      mutation: {
        kind: "upsert",
        emitterId: "sparks",
        emitterKind: "point",
        rate: 8,
        lifetimeMs: 800,
        speed: 1,
        spread: 0.4,
      },
    });
    if (!applied.ok) throw new Error(applied.message);
    const first = sampleSceneEffects({ catalog: applied.catalog, timeMs: 250 });
    const second = sampleSceneEffects({ catalog: applied.catalog, timeMs: 250 });
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, evaluation: { savedBytesWritten: false } });
  });
});
