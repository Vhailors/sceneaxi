/** Non-spatial Play sources. The host supplies ids from admitted audio assets only. */
import type { JsonValue } from "./document.js";
import { isNonEmptyString, isPlainRecord } from "./record-validation.js";
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier } from "./sculpt.js";

export const SCENE_AUDIO_SCHEMA_VERSION = 1 as const;

export const SCENE_AUDIO_CATALOG_KIND = "sceneaxi.scene-audio-catalog" as const;

export const SCENE_AUDIO_CATALOG_KEY = "sceneAudio" as const;

export const SCENE_AUDIO_REFUSALS = Object.freeze({
  kidsDenied: "SCENE_AUDIO_KIDS_DENIED",
  catalogInvalid: "SCENE_AUDIO_CATALOG_INVALID",
  targetMissing: "SCENE_AUDIO_TARGET_MISSING",
  clipMissing: "SCENE_AUDIO_CLIP_MISSING",
  inputUnsupported: "SCENE_AUDIO_INPUT_UNSUPPORTED",
} as const);

export type SceneAudioRefusal = (typeof SCENE_AUDIO_REFUSALS)[keyof typeof SCENE_AUDIO_REFUSALS];

export type SceneAudioSource = Readonly<{
  instanceId: string;
  clip: string;
  volume: number;
  loop: boolean;
  playOnStart: boolean;
}>;

export type SceneAudioCatalog = Readonly<{
  schemaVersion: typeof SCENE_AUDIO_SCHEMA_VERSION;
  kind: typeof SCENE_AUDIO_CATALOG_KIND;
  sources: readonly SceneAudioSource[];
}>;

export type SceneAudioMutation =
  | Readonly<{ kind: "upsert"; source: SceneAudioSource }>
  | Readonly<{ kind: "remove"; instanceId: string }>;

type Failure = Readonly<{ ok: false; reason: SceneAudioRefusal; message: string }>;

const fail = (reason: SceneAudioRefusal, message: string): Failure =>
  Object.freeze({ ok: false, reason, message });

function validSource(source: SceneAudioSource): boolean {
  return isPlainRecord(source) && isSculptIdentifier(source.instanceId)
    && Object.keys(source).every((key) => ["instanceId", "clip", "volume", "loop", "playOnStart"].includes(key))
    && isNonEmptyString(source.clip)
    && Number.isFinite(source.volume) && source.volume >= 0 && source.volume <= 1
    && (source.loop === true || source.loop === false)
    && (source.playOnStart === true || source.playOnStart === false);
}

export function emptySceneAudioCatalog(): SceneAudioCatalog {
  return Object.freeze({ schemaVersion: 1, kind: SCENE_AUDIO_CATALOG_KIND, sources: Object.freeze([]) });
}

export function parseSceneAudioCatalog(value: JsonValue | undefined): SceneAudioCatalog | null {
  if (value === undefined || value === null) return emptySceneAudioCatalog();

  if (!isPlainRecord(value)) return null;

  // SAFETY: this boundary validates the version, array and every source before returning it.
  const catalog = value as Partial<SceneAudioCatalog>;

  if (catalog.schemaVersion !== 1 || catalog.kind !== SCENE_AUDIO_CATALOG_KIND
    || !Array.isArray(catalog.sources) || !catalog.sources.every(validSource)
    || new Set(catalog.sources.map((source) => source.instanceId)).size !== catalog.sources.length) return null;

  return Object.freeze({ schemaVersion: 1, kind: SCENE_AUDIO_CATALOG_KIND,
    sources: Object.freeze(catalog.sources.map((source) => Object.freeze({ ...source }))) });
}

export function applySceneAudioMutation(input: Readonly<{
  catalog: SceneAudioCatalog;
  mutation: SceneAudioMutation;
  instanceIds: readonly string[];
  audioAssetIds: readonly string[];
  profile?: "game" | "web" | "kids";
}>): Readonly<{ ok: true; catalog: SceneAudioCatalog }> | Failure {
  if (input.profile === "kids") return fail(SCENE_AUDIO_REFUSALS.kidsDenied, "Kids refuses audio authoring.");

  const catalog = parseSceneAudioCatalog(input.catalog);

  if (!catalog) return fail(SCENE_AUDIO_REFUSALS.catalogInvalid, "The audio catalog is invalid.");

  const mutation = input.mutation;
  const instanceId = mutation.kind === "remove" ? mutation.instanceId : mutation.source.instanceId;

  if (!isSculptIdentifier(instanceId)) return fail(SCENE_AUDIO_REFUSALS.inputUnsupported, "An audio source requires a lowercase instance id.");

  if (!input.instanceIds.includes(instanceId)) return fail(SCENE_AUDIO_REFUSALS.targetMissing, "The audio carrier is absent from the hierarchy.");

  const sources = catalog.sources.filter((source) => source.instanceId !== instanceId);

  if (mutation.kind === "upsert") {
    if (!validSource(mutation.source)) return fail(SCENE_AUDIO_REFUSALS.inputUnsupported, "Audio requires a clip, volume in 0..1 and boolean playback flags; spatial audio is unsupported.");

    if (!input.audioAssetIds.includes(mutation.source.clip)) return fail(SCENE_AUDIO_REFUSALS.clipMissing, "The clip is not an admitted audio asset.");

    sources.push(Object.freeze({ ...mutation.source }));
  }

  return Object.freeze({ ok: true, catalog: Object.freeze({ ...catalog, sources: Object.freeze(sources) }) });
}

export function sceneAudioCatalogDigest(catalog: SceneAudioCatalog): string {
  return digestSculptJson(catalog);
}

export function inspectSceneAudio(catalog: SceneAudioCatalog) {
  return Object.freeze({ schemaVersion: 1, kind: "sceneaxi.scene-audio-inspection", catalog,
    digest: sceneAudioCatalogDigest(catalog), savedBytesWritten: false as const });
}
