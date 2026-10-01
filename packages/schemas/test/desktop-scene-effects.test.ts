import { describe, expect, it } from "vitest";
import {
  SCENE_EFFECTS_REFUSALS,
  applySceneEffectsMutation,
  emptySceneEffectsCatalog,
  sampleSceneEffects,
  inspectSceneEffects,
  parseSceneEffectsCatalog,
  type SceneEffectsMutation,
} from "@sceneaxi/schemas";

const legacy = { kind: "upsert", emitterId: "sparks", emitterKind: "point", rate: 8, lifetimeMs: 800, speed: 1, spread: 0.4 } as const;

function apply(mutation: SceneEffectsMutation) {
  return applySceneEffectsMutation({ catalog: emptySceneEffectsCatalog(), instanceIds: ["mesh", "node"], mutation });
}

describe("desktop scene effects catalog", () => {
  it("preserves legacy emitter bytes and catalog digest without new fields", () => {
    const result = apply(legacy);
    if (!result.ok) throw new Error(result.message);
    expect(result.catalog.emitters[0]).toEqual({ emitterId: "sparks", kind: "point", rate: 8, lifetimeMs: 800, speed: 1, spread: 0.4 });
    expect(inspectSceneEffects(result.catalog).digest).toBe("sha256:0f7dd55d0c1b1162df54a6053c3fb22559d0012cf318cb956e62bd47194e822a");
  });

  it("roundtrips attachment and appearance and carries them in local-space samples", () => {
    for (const instanceId of ["mesh", "node"]) {
      const result = apply({ ...legacy, instanceId, color: "#ff9900", size: 0.25 });
      if (!result.ok) throw new Error(result.message);
      expect(parseSceneEffectsCatalog(JSON.parse(JSON.stringify(result.catalog)))).toEqual(result.catalog);
      expect(Object.isFrozen(result.catalog.emitters[0])).toBe(true);
      expect(sampleSceneEffects({ catalog: result.catalog, timeMs: 250 })).toMatchObject({ ok: true, evaluation: { samples: [{ instanceId, color: "#ff9900", size: 0.25 }] } });
    }
  });

  it("refuses dangling attachments and invalid appearance or motion values", () => {
    expect(apply({ ...legacy, instanceId: "missing" })).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.targetMissing });
    expect(applySceneEffectsMutation({ catalog: emptySceneEffectsCatalog(), mutation: { ...legacy, instanceId: "mesh" } })).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.targetMissing });
    for (const patch of [{ instanceId: "Bad Id" }, { color: "orange" }, { size: 0 }, { size: Infinity }, { speed: NaN }, { spread: -1 }]) {
      expect(apply({ ...legacy, ...patch })).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.inputUnsupported });
    }
    expect(parseSceneEffectsCatalog({ ...emptySceneEffectsCatalog(), emitters: [{ emitterId: "sparks", kind: "point", rate: 8, lifetimeMs: 800, speed: 1, spread: 0.4, size: 0 }] })).toBeNull();
  });

  it("samples distinct seeded point, box and cone geometry within their bounds", () => {
    const outputs = [];
    for (const emitterKind of ["point", "box", "cone"]) {
      const result = apply({ ...legacy, emitterKind });
      if (!result.ok) throw new Error(result.message);
      const sampled = sampleSceneEffects({ catalog: result.catalog, timeMs: 250 });
      if (!sampled.ok) throw new Error(sampled.message);
      expect(sampleSceneEffects({ catalog: result.catalog, timeMs: 250 })).toEqual(sampled);
      const positions = sampled.evaluation.samples[0]?.positions;
      expect(positions).toHaveLength(6);
      for (const [x, y, z] of positions ?? []) {
        expect(Number.isFinite(x + y + z)).toBe(true);
        if (emitterKind === "point") {
          expect(x).toBe(0);
          expect(z).toBe(0);
        } else if (emitterKind === "box") {
          expect(Math.abs(x)).toBeLessThanOrEqual(0.4);
          expect(Math.abs(z)).toBeLessThanOrEqual(0.4);
          expect(y).toBeGreaterThanOrEqual(-0.4);
          expect(y).toBeLessThanOrEqual(1.2);
        } else {
          expect(Math.hypot(x, z)).toBeCloseTo(y * 0.4 / 0.8, 12);
        }
      }
      outputs.push(JSON.stringify(positions));
      const reseeded = { ...result.catalog, seed: 2 };
      expect(sampleSceneEffects({ catalog: reseeded, timeMs: 250 })).not.toEqual(sampled);
    }
    expect(new Set(outputs).size).toBe(3);
  });

  it("refuses Kids before emitter or hierarchy access", () => {
    expect(applySceneEffectsMutation({ profile: "kids", get catalog(): never { throw new Error("catalog read"); }, get mutation(): never { throw new Error("mutation read"); }, get instanceIds(): never { throw new Error("targets read"); } })).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.kidsDenied });
  });

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
