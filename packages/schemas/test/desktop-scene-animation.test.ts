import { describe, expect, it } from "vitest";
import {
  SCENE_ANIMATION_REFUSALS,
  applySceneAnimationMutation,
  emptySceneAnimationCatalog,
  evaluateSceneAnimation,
} from "@sceneaxi/schemas";

const hash = `sha256:${"ab".repeat(32)}`;

function authored() {
  let catalog = emptySceneAnimationCatalog();
  const clip = applySceneAnimationMutation({
    catalog,
    instanceIds: ["desktop-crate-beside"],
    mutation: { kind: "clip-upsert", clipId: "idle", name: "Idle", startMs: 0, durationMs: 1000 },
  });
  if (!clip.ok) throw new Error(clip.message);
  catalog = clip.catalog;
  const track = applySceneAnimationMutation({
    catalog,
    instanceIds: ["desktop-crate-beside"],
    mutation: {
      kind: "track-upsert",
      trackId: "tx",
      clipId: "idle",
      targetInstanceId: "desktop-crate-beside",
      propertyId: "translation-x",
    },
  });
  if (!track.ok) throw new Error(track.message);
  catalog = track.catalog;
  const start = applySceneAnimationMutation({
    catalog,
    instanceIds: ["desktop-crate-beside"],
    mutation: {
      kind: "keyframe-upsert",
      keyframeId: "k0",
      trackId: "tx",
      timeMs: 0,
      value: 0,
      interpolation: "linear",
    },
  });
  if (!start.ok) throw new Error(start.message);
  catalog = start.catalog;
  const end = applySceneAnimationMutation({
    catalog,
    instanceIds: ["desktop-crate-beside"],
    mutation: {
      kind: "keyframe-upsert",
      keyframeId: "k1",
      trackId: "tx",
      timeMs: 1000,
      value: 10,
      interpolation: "linear",
    },
  });
  if (!end.ok) throw new Error(end.message);
  return end.catalog;
}

describe("desktop scene animation catalog", () => {
  it("refuses missing targets, invalid ranges, and unsupported interpolation before mutation", () => {
    const catalog = emptySceneAnimationCatalog();
    expect(applySceneAnimationMutation({
      catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: { kind: "clip-upsert", clipId: "idle", name: "Idle", startMs: 0, durationMs: 0 },
    })).toMatchObject({ ok: false, reason: SCENE_ANIMATION_REFUSALS.timeRangeInvalid });
    const clip = applySceneAnimationMutation({
      catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: { kind: "clip-upsert", clipId: "idle", name: "Idle", startMs: 0, durationMs: 1000 },
    });
    if (!clip.ok) throw new Error(clip.message);
    expect(applySceneAnimationMutation({
      catalog: clip.catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: {
        kind: "track-upsert",
        trackId: "tx",
        clipId: "idle",
        targetInstanceId: "missing",
        propertyId: "translation-x",
      },
    })).toMatchObject({ ok: false, reason: SCENE_ANIMATION_REFUSALS.targetMissing });
    const track = applySceneAnimationMutation({
      catalog: clip.catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: {
        kind: "track-upsert",
        trackId: "tx",
        clipId: "idle",
        targetInstanceId: "desktop-crate-beside",
        propertyId: "translation-x",
      },
    });
    if (!track.ok) throw new Error(track.message);
    expect(applySceneAnimationMutation({
      catalog: track.catalog,
      instanceIds: ["desktop-crate-beside"],
      mutation: {
        kind: "keyframe-upsert",
        keyframeId: "k0",
        trackId: "tx",
        timeMs: 0,
        value: 1,
        interpolation: "cubic",
      },
    })).toMatchObject({ ok: false, reason: SCENE_ANIMATION_REFUSALS.interpolationUnsupported });
  });

  it("samples linear keyframes identically across two evaluations of one catalog", () => {
    const catalog = authored();
    const first = evaluateSceneAnimation({ catalog, timeMs: 250, sourceContentHash: hash });
    const second = evaluateSceneAnimation({ catalog, timeMs: 250, sourceContentHash: hash });
    expect(first).toMatchObject({ ok: true });
    expect(second).toEqual(first);
    if (!first.ok) throw new Error(first.message);
    expect(first.evaluation.savedBytesWritten).toBe(false);
    expect(first.evaluation.samples[0]).toMatchObject({
      instanceId: "desktop-crate-beside",
      propertyId: "translation-x",
      value: 2.5,
    });
  });

  it("requires an explicit bind before imported animation data can drive Play", () => {
    const catalog = authored();
    expect(evaluateSceneAnimation({
      catalog,
      timeMs: 0,
      sourceContentHash: hash,
      requireBoundAsset: true,
    })).toMatchObject({ ok: false, reason: SCENE_ANIMATION_REFUSALS.assetUnbound });
    expect(applySceneAnimationMutation({
      catalog,
      instanceIds: ["desktop-crate-beside"],
      animationAssetIds: [],
      mutation: { kind: "bind-asset", assetId: "walk", digest: hash, clipIds: ["idle"] },
    })).toMatchObject({ ok: false, reason: SCENE_ANIMATION_REFUSALS.assetMissing });
    const bound = applySceneAnimationMutation({
      catalog,
      instanceIds: ["desktop-crate-beside"],
      animationAssetIds: ["walk"],
      mutation: { kind: "bind-asset", assetId: "walk", digest: hash, clipIds: ["idle"] },
    });
    expect(bound).toMatchObject({ ok: true });
    if (!bound.ok) throw new Error(bound.message);
    expect(evaluateSceneAnimation({
      catalog: bound.catalog,
      timeMs: 0,
      sourceContentHash: hash,
      requireBoundAsset: true,
    })).toMatchObject({ ok: true });
  });
});
