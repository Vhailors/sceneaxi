import { describe, expect, it } from "vitest";
import {
  SCENE_AUDIO_REFUSALS,
  applySceneAudioMutation,
  emptySceneAudioCatalog,
  inspectSceneAudio,
  parseSceneAudioCatalog,
  sceneAudioCatalogDigest,
  type SceneAudioSource,
} from "@sceneaxi/schemas";

const source: SceneAudioSource = { instanceId: "speaker", clip: "audio-clip", volume: 0.5, loop: true, playOnStart: true };

function apply(row: SceneAudioSource) {
  return applySceneAudioMutation({ catalog: emptySceneAudioCatalog(), instanceIds: ["speaker"], audioAssetIds: ["audio-clip"], mutation: { kind: "upsert", source: row } });
}

describe("desktop scene audio catalog", () => {
  it("refuses Kids before any catalog, mutation, hierarchy or asset access", () => {
    expect(applySceneAudioMutation({
      profile: "kids",
      get catalog(): never { throw new Error("catalog read"); },
      get mutation(): never { throw new Error("mutation read"); },
      get instanceIds(): never { throw new Error("targets read"); },
      get audioAssetIds(): never { throw new Error("assets read"); },
    })).toMatchObject({ ok: false, reason: "SCENE_AUDIO_KIDS_DENIED" });
  });

  it("roundtrips admitted non-spatial sources with immutable deterministic evidence", () => {
    const row = { ...source };
    const result = apply(row);
    if (!result.ok) throw new Error(result.message);
    expect(result.catalog.sources).toEqual([source]);
    expect(Object.isFrozen(result.catalog.sources[0])).toBe(true);
    expect(parseSceneAudioCatalog(JSON.parse(JSON.stringify(result.catalog)))).toEqual(result.catalog);
    expect(inspectSceneAudio(result.catalog)).toMatchObject({ digest: sceneAudioCatalogDigest(result.catalog), savedBytesWritten: false });
    expect(sceneAudioCatalogDigest(result.catalog)).not.toBe(sceneAudioCatalogDigest(emptySceneAudioCatalog()));
    row.volume = 1;
    expect(result.catalog.sources[0]?.volume).toBe(0.5);
    expect(applySceneAudioMutation({ catalog: result.catalog, instanceIds: ["speaker"], audioAssetIds: [], mutation: { kind: "remove", instanceId: "speaker" } })).toEqual({ ok: true, catalog: emptySceneAudioCatalog() });
  });

  it("refuses unadmitted clips, missing carriers and invalid volume", () => {
    expect(apply({ ...source, clip: "texture-asset" })).toMatchObject({ ok: false, reason: SCENE_AUDIO_REFUSALS.clipMissing });
    expect(apply({ ...source, instanceId: "missing" })).toMatchObject({ ok: false, reason: SCENE_AUDIO_REFUSALS.targetMissing });
    for (const volume of [-0.1, 1.1, NaN, Infinity]) expect(apply({ ...source, volume })).toMatchObject({ ok: false, reason: SCENE_AUDIO_REFUSALS.inputUnsupported });
    for (const volume of [0, 1]) expect(apply({ ...source, volume })).toMatchObject({ ok: true });
  });

  it("rejects malformed or duplicate sources", () => {
    expect(parseSceneAudioCatalog(undefined)).toEqual(emptySceneAudioCatalog());
    for (const value of [false, [], {}, { ...emptySceneAudioCatalog(), sources: [null] },
      { ...emptySceneAudioCatalog(), sources: [source, source] },
      { ...emptySceneAudioCatalog(), sources: [{ ...source, loop: 1 }] },
      { ...emptySceneAudioCatalog(), sources: [{ ...source, clip: "" }] },
      { ...emptySceneAudioCatalog(), sources: [{ ...source, spatial: true }] },
    ]) expect(parseSceneAudioCatalog(value)).toBeNull();
  });
});
