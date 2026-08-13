/**
 * Bounded animation authoring: clips, tracks, keyframes, scrub preview, and
 * deterministic Play evaluation. Imported animation-data is metadata only until
 * an explicit bind command records it in this catalog.
 */
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier } from "./sculpt.js";
import { desktopSceneTransformProperty } from "./desktop-scene-edit.js";

export const SCENE_ANIMATION_SCHEMA_VERSION = 1 as const;
export const SCENE_ANIMATION_CATALOG_KIND = "sceneaxi.scene-animation-catalog" as const;
export const SCENE_ANIMATION_CATALOG_KEY = "sceneAnimation" as const;

export const SCENE_ANIMATION_INTERPOLATIONS = Object.freeze(["step", "linear"] as const);
export type SceneAnimationInterpolation = (typeof SCENE_ANIMATION_INTERPOLATIONS)[number];

export const SCENE_ANIMATION_REFUSALS = Object.freeze({
  catalogInvalid: "ANIMATION_CATALOG_INVALID",
  clipUnknown: "ANIMATION_CLIP_UNKNOWN",
  trackUnknown: "ANIMATION_TRACK_UNKNOWN",
  keyframeUnknown: "ANIMATION_KEYFRAME_UNKNOWN",
  targetMissing: "ANIMATION_TARGET_MISSING",
  timeRangeInvalid: "ANIMATION_TIME_RANGE_INVALID",
  interpolationUnsupported: "ANIMATION_INTERPOLATION_UNSUPPORTED",
  staleVersion: "ANIMATION_STALE_VERSION",
  assetUnbound: "ANIMATION_ASSET_UNBOUND",
  assetMissing: "ANIMATION_ASSET_MISSING",
  inputUnsupported: "ANIMATION_INPUT_UNSUPPORTED",
  kidsDenied: "ANIMATION_KIDS_DENIED",
  capabilityMissing: "ANIMATION_CAPABILITY_MISSING",
} as const);

export type SceneAnimationRefusal =
  (typeof SCENE_ANIMATION_REFUSALS)[keyof typeof SCENE_ANIMATION_REFUSALS];

export type SceneAnimationClip = Readonly<{
  clipId: string;
  name: string;
  startMs: number;
  durationMs: number;
}>;

export type SceneAnimationTrack = Readonly<{
  trackId: string;
  clipId: string;
  targetInstanceId: string;
  propertyId: string;
}>;

export type SceneAnimationKeyframe = Readonly<{
  keyframeId: string;
  trackId: string;
  timeMs: number;
  value: number;
  interpolation: SceneAnimationInterpolation;
}>;

export type SceneAnimationBinding = Readonly<{
  assetId: string;
  digest: string;
  clipIds: readonly string[];
}>;

export type SceneAnimationCatalog = Readonly<{
  schemaVersion: typeof SCENE_ANIMATION_SCHEMA_VERSION;
  kind: typeof SCENE_ANIMATION_CATALOG_KIND;
  clips: readonly SceneAnimationClip[];
  tracks: readonly SceneAnimationTrack[];
  keyframes: readonly SceneAnimationKeyframe[];
  bindings: readonly SceneAnimationBinding[];
}>;

export type SceneAnimationSample = Readonly<{
  instanceId: string;
  propertyId: string;
  value: number;
}>;

export type SceneAnimationEvaluation = Readonly<{
  schemaVersion: typeof SCENE_ANIMATION_SCHEMA_VERSION;
  kind: "sceneaxi.scene-animation-evaluation";
  sourceContentHash: string;
  timeMs: number;
  samples: readonly SceneAnimationSample[];
  digest: string;
  savedBytesWritten: false;
}>;

type Failure = Readonly<{ ok: false; reason: SceneAnimationRefusal; message: string }>;
const fail = (reason: SceneAnimationRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message });

export function emptySceneAnimationCatalog(): SceneAnimationCatalog {
  return Object.freeze({
    schemaVersion: 1,
    kind: SCENE_ANIMATION_CATALOG_KIND,
    clips: Object.freeze([]),
    tracks: Object.freeze([]),
    keyframes: Object.freeze([]),
    bindings: Object.freeze([]),
  });
}

export function parseSceneAnimationCatalog(value: unknown): SceneAnimationCatalog | null {
  if (value === undefined || value === null) return emptySceneAnimationCatalog();
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record["schemaVersion"] !== 1 ||
    record["kind"] !== SCENE_ANIMATION_CATALOG_KIND ||
    !Array.isArray(record["clips"]) ||
    !Array.isArray(record["tracks"]) ||
    !Array.isArray(record["keyframes"]) ||
    !Array.isArray(record["bindings"])
  ) {
    return null;
  }
  return value as SceneAnimationCatalog;
}

export function sceneAnimationCatalogDigest(catalog: SceneAnimationCatalog): string {
  return digestSculptJson(catalog);
}

function finiteMs(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export type SceneAnimationMutation =
  | Readonly<{ kind: "clip-upsert"; clipId: string; name: string; startMs: number; durationMs: number }>
  | Readonly<{ kind: "clip-remove"; clipId: string }>
  | Readonly<{
      kind: "track-upsert";
      trackId: string;
      clipId: string;
      targetInstanceId: string;
      propertyId: string;
    }>
  | Readonly<{ kind: "track-remove"; trackId: string }>
  | Readonly<{
      kind: "keyframe-upsert";
      keyframeId: string;
      trackId: string;
      timeMs: number;
      value: number;
      interpolation: string;
    }>
  | Readonly<{ kind: "keyframe-remove"; keyframeId: string }>
  | Readonly<{ kind: "bind-asset"; assetId: string; digest: string; clipIds: readonly string[] }>;

export function applySceneAnimationMutation(input: Readonly<{
  catalog: SceneAnimationCatalog;
  mutation: SceneAnimationMutation;
  instanceIds: readonly string[];
  animationAssetIds?: readonly string[];
}>):
  | Readonly<{ ok: true; catalog: SceneAnimationCatalog }>
  | Failure {
  const mutation = input.mutation;
  if (mutation.kind === "clip-upsert") {
    if (!isSculptIdentifier(mutation.clipId) || mutation.name.trim().length === 0) {
      return fail(SCENE_ANIMATION_REFUSALS.inputUnsupported, "A clip requires a lowercase id and a name.");
    }
    if (!finiteMs(mutation.startMs) || !finiteMs(mutation.durationMs) || mutation.durationMs <= 0) {
      return fail(SCENE_ANIMATION_REFUSALS.timeRangeInvalid, "Clip startMs must be finite and durationMs must be positive.");
    }
    const clip: SceneAnimationClip = Object.freeze({
      clipId: mutation.clipId,
      name: mutation.name.trim(),
      startMs: mutation.startMs,
      durationMs: mutation.durationMs,
    });
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        clips: Object.freeze([
          ...input.catalog.clips.filter((candidate) => candidate.clipId !== clip.clipId),
          clip,
        ]),
      }),
    });
  }
  if (mutation.kind === "clip-remove") {
    if (!input.catalog.clips.some((clip) => clip.clipId === mutation.clipId)) {
      return fail(SCENE_ANIMATION_REFUSALS.clipUnknown, `Clip "${mutation.clipId}" is not in the catalog.`);
    }
    const tracks = input.catalog.tracks.filter((track) => track.clipId !== mutation.clipId);
    const trackIds = new Set(tracks.map((track) => track.trackId));
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        clips: Object.freeze(input.catalog.clips.filter((clip) => clip.clipId !== mutation.clipId)),
        tracks: Object.freeze(tracks),
        keyframes: Object.freeze(input.catalog.keyframes.filter((keyframe) => trackIds.has(keyframe.trackId))),
      }),
    });
  }
  if (mutation.kind === "track-upsert") {
    if (!isSculptIdentifier(mutation.trackId) || !isSculptIdentifier(mutation.clipId)) {
      return fail(SCENE_ANIMATION_REFUSALS.inputUnsupported, "A track requires lowercase clip and track ids.");
    }
    if (!input.catalog.clips.some((clip) => clip.clipId === mutation.clipId)) {
      return fail(SCENE_ANIMATION_REFUSALS.clipUnknown, `Clip "${mutation.clipId}" is not in the catalog.`);
    }
    if (!input.instanceIds.includes(mutation.targetInstanceId)) {
      return fail(
        SCENE_ANIMATION_REFUSALS.targetMissing,
        `Track target "${mutation.targetInstanceId}" is absent from the current hierarchy.`,
      );
    }
    if (desktopSceneTransformProperty(mutation.propertyId) === null) {
      return fail(
        SCENE_ANIMATION_REFUSALS.inputUnsupported,
        `Track property "${mutation.propertyId}" is not a supported transform component.`,
      );
    }
    const track: SceneAnimationTrack = Object.freeze({
      trackId: mutation.trackId,
      clipId: mutation.clipId,
      targetInstanceId: mutation.targetInstanceId,
      propertyId: mutation.propertyId,
    });
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        tracks: Object.freeze([
          ...input.catalog.tracks.filter((candidate) => candidate.trackId !== track.trackId),
          track,
        ]),
      }),
    });
  }
  if (mutation.kind === "track-remove") {
    if (!input.catalog.tracks.some((track) => track.trackId === mutation.trackId)) {
      return fail(SCENE_ANIMATION_REFUSALS.trackUnknown, `Track "${mutation.trackId}" is not in the catalog.`);
    }
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        tracks: Object.freeze(input.catalog.tracks.filter((track) => track.trackId !== mutation.trackId)),
        keyframes: Object.freeze(
          input.catalog.keyframes.filter((keyframe) => keyframe.trackId !== mutation.trackId),
        ),
      }),
    });
  }
  if (mutation.kind === "keyframe-upsert") {
    if (!isSculptIdentifier(mutation.keyframeId) || !isSculptIdentifier(mutation.trackId)) {
      return fail(SCENE_ANIMATION_REFUSALS.inputUnsupported, "A keyframe requires lowercase ids.");
    }
    const track = input.catalog.tracks.find((candidate) => candidate.trackId === mutation.trackId);
    if (track === undefined) {
      return fail(SCENE_ANIMATION_REFUSALS.trackUnknown, `Track "${mutation.trackId}" is not in the catalog.`);
    }
    const clip = input.catalog.clips.find((candidate) => candidate.clipId === track.clipId);
    if (clip === undefined) {
      return fail(SCENE_ANIMATION_REFUSALS.clipUnknown, `Clip "${track.clipId}" is not in the catalog.`);
    }
    if (!finiteMs(mutation.timeMs) || mutation.timeMs > clip.durationMs) {
      return fail(
        SCENE_ANIMATION_REFUSALS.timeRangeInvalid,
        `Keyframe time ${String(mutation.timeMs)} is outside clip "${clip.clipId}".`,
      );
    }
    if (!Number.isFinite(mutation.value)) {
      return fail(SCENE_ANIMATION_REFUSALS.inputUnsupported, "A keyframe value must be finite.");
    }
    if (!SCENE_ANIMATION_INTERPOLATIONS.some((item) => item === mutation.interpolation)) {
      return fail(
        SCENE_ANIMATION_REFUSALS.interpolationUnsupported,
        `Interpolation "${mutation.interpolation}" is unsupported; admitted values are step and linear.`,
      );
    }
    const keyframe: SceneAnimationKeyframe = Object.freeze({
      keyframeId: mutation.keyframeId,
      trackId: mutation.trackId,
      timeMs: mutation.timeMs,
      value: mutation.value,
      interpolation: mutation.interpolation as SceneAnimationInterpolation,
    });
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        keyframes: Object.freeze([
          ...input.catalog.keyframes.filter((candidate) => candidate.keyframeId !== keyframe.keyframeId),
          keyframe,
        ]),
      }),
    });
  }
  if (mutation.kind === "keyframe-remove") {
    if (!input.catalog.keyframes.some((keyframe) => keyframe.keyframeId === mutation.keyframeId)) {
      return fail(
        SCENE_ANIMATION_REFUSALS.keyframeUnknown,
        `Keyframe "${mutation.keyframeId}" is not in the catalog.`,
      );
    }
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        keyframes: Object.freeze(
          input.catalog.keyframes.filter((keyframe) => keyframe.keyframeId !== mutation.keyframeId),
        ),
      }),
    });
  }
  const assets = input.animationAssetIds ?? [];
  if (!isSculptIdentifier(mutation.assetId) || !/^sha256:[0-9a-f]{64}$/.test(mutation.digest)) {
    return fail(SCENE_ANIMATION_REFUSALS.inputUnsupported, "Binding requires a lowercase asset id and sha256 digest.");
  }
  if (!assets.includes(mutation.assetId)) {
    return fail(
      SCENE_ANIMATION_REFUSALS.assetMissing,
      `Animation asset "${mutation.assetId}" is not in the project manifest.`,
    );
  }
  if (mutation.clipIds.some((clipId) => !input.catalog.clips.some((clip) => clip.clipId === clipId))) {
    return fail(SCENE_ANIMATION_REFUSALS.clipUnknown, "A bind may only name clips already authored in the catalog.");
  }
  const binding: SceneAnimationBinding = Object.freeze({
    assetId: mutation.assetId,
    digest: mutation.digest,
    clipIds: Object.freeze([...mutation.clipIds]),
  });
  return Object.freeze({
    ok: true as const,
    catalog: Object.freeze({
      ...input.catalog,
      bindings: Object.freeze([
        ...input.catalog.bindings.filter((candidate) => candidate.assetId !== binding.assetId),
        binding,
      ]),
    }),
  });
}

function sampleTrack(
  track: SceneAnimationTrack,
  clip: SceneAnimationClip,
  keyframes: readonly SceneAnimationKeyframe[],
  timeMs: number,
): number | null {
  const local = timeMs - clip.startMs;
  if (local < 0 || local > clip.durationMs) return null;
  const ordered = keyframes
    .filter((keyframe) => keyframe.trackId === track.trackId)
    .slice()
    .sort((left, right) => left.timeMs - right.timeMs || left.keyframeId.localeCompare(right.keyframeId));
  if (ordered.length === 0) return null;
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (first === undefined || last === undefined) return null;
  if (local <= first.timeMs) return first.value;
  if (local >= last.timeMs) return last.value;
  let previous = first;
  for (const next of ordered) {
    if (next.timeMs >= local) {
      if (previous.interpolation === "step" || next.timeMs === previous.timeMs) return previous.value;
      const span = next.timeMs - previous.timeMs;
      const t = (local - previous.timeMs) / span;
      return previous.value + (next.value - previous.value) * t;
    }
    previous = next;
  }
  return last.value;
}

export function evaluateSceneAnimation(input: Readonly<{
  catalog: SceneAnimationCatalog;
  timeMs: number;
  sourceContentHash: string;
  requireBoundAsset?: boolean;
}>):
  | Readonly<{ ok: true; evaluation: SceneAnimationEvaluation }>
  | Failure {
  if (!finiteMs(input.timeMs)) {
    return fail(SCENE_ANIMATION_REFUSALS.timeRangeInvalid, "Evaluation timeMs must be a finite non-negative number.");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(input.sourceContentHash)) {
    return fail(SCENE_ANIMATION_REFUSALS.staleVersion, "Evaluation requires the exact project content hash being previewed.");
  }
  if (input.requireBoundAsset === true && input.catalog.clips.length > 0 && input.catalog.bindings.length === 0) {
    return fail(
      SCENE_ANIMATION_REFUSALS.assetUnbound,
      "Imported animation data cannot drive Play until it is explicitly bound.",
    );
  }
  const samples: SceneAnimationSample[] = [];
  for (const track of input.catalog.tracks) {
    const clip = input.catalog.clips.find((candidate) => candidate.clipId === track.clipId);
    if (clip === undefined) continue;
    const value = sampleTrack(track, clip, input.catalog.keyframes, input.timeMs);
    if (value === null) continue;
    samples.push(Object.freeze({
      instanceId: track.targetInstanceId,
      propertyId: track.propertyId,
      value,
    }));
  }
  samples.sort((left, right) =>
    left.instanceId.localeCompare(right.instanceId) || left.propertyId.localeCompare(right.propertyId)
  );
  const frozen = Object.freeze(samples);
  return Object.freeze({
    ok: true as const,
    evaluation: Object.freeze({
      schemaVersion: 1,
      kind: "sceneaxi.scene-animation-evaluation",
      sourceContentHash: input.sourceContentHash,
      timeMs: input.timeMs,
      samples: frozen,
      digest: digestSculptJson({
        sourceContentHash: input.sourceContentHash,
        timeMs: input.timeMs,
        samples: frozen,
        catalog: sceneAnimationCatalogDigest(input.catalog),
      }),
      savedBytesWritten: false as const,
    }),
  });
}

export function inspectSceneAnimation(catalog: SceneAnimationCatalog) {
  return Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.scene-animation-inspection",
    catalog,
    digest: sceneAnimationCatalogDigest(catalog),
    savedBytesWritten: false as const,
  });
}
