/**
 * Decorative, seeded particle emitters. Presentation-only: never kernel state.
 * three.quarks was evaluated and declined for v1 because its RNG is not
 * injectable; sampleAt is a closed, digest-stamped evaluation instead.
 */
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier } from "./sculpt.js";
import { snapshotPlainRecord, isPlainRecord } from "./record-validation.js";

export const SCENE_EFFECTS_SCHEMA_VERSION = 1 as const;

export const SCENE_EFFECTS_CATALOG_KIND = "sceneaxi.scene-effects-catalog" as const;

export const SCENE_EFFECTS_CATALOG_KEY = "sceneEffects" as const;

export const SCENE_EFFECT_EMITTER_KINDS = Object.freeze(["point", "box", "cone"] as const);

export const SCENE_EFFECTS_REFUSALS = Object.freeze({
  catalogInvalid: "EFFECTS_CATALOG_INVALID",
  targetMissing: "EFFECTS_TARGET_MISSING",
  inputUnsupported: "EFFECTS_INPUT_UNSUPPORTED",
  kidsDenied: "EFFECTS_KIDS_DENIED",
  capabilityMissing: "EFFECTS_CAPABILITY_MISSING",
  sampleUnstable: "EFFECTS_SAMPLE_UNSTABLE",
} as const);

export type SceneEffectsRefusal =
  (typeof SCENE_EFFECTS_REFUSALS)[keyof typeof SCENE_EFFECTS_REFUSALS];

export type SceneEffectEmitter = Readonly<{
  emitterId: string;
  kind: (typeof SCENE_EFFECT_EMITTER_KINDS)[number];
  rate: number;
  lifetimeMs: number;
  speed: number;
  spread: number;
  instanceId?: string;
  color?: string;
  size?: number;
}>;

export type SceneEffectsCatalog = Readonly<{
  schemaVersion: typeof SCENE_EFFECTS_SCHEMA_VERSION;
  kind: typeof SCENE_EFFECTS_CATALOG_KIND;
  seed: number;
  emitters: readonly SceneEffectEmitter[];
}>;

export type SceneEffectSample = Readonly<{
  emitterId: string;
  count: number;
  /** Local positions; presentation applies the carrier's world transform. */
  positions: readonly (readonly [number, number, number])[];
  instanceId?: string;
  color?: string;
  size?: number;
}>;

export type SceneEffectsEvaluation = Readonly<{
  schemaVersion: typeof SCENE_EFFECTS_SCHEMA_VERSION;
  kind: "sceneaxi.scene-effects-evaluation";
  timeMs: number;
  samples: readonly SceneEffectSample[];
  digest: string;
  savedBytesWritten: false;
}>;

type Failure = Readonly<{ ok: false; reason: SceneEffectsRefusal; message: string }>;

const fail = (reason: SceneEffectsRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message });

export function emptySceneEffectsCatalog(): SceneEffectsCatalog {
  return Object.freeze({
    schemaVersion: 1,
    kind: SCENE_EFFECTS_CATALOG_KIND,
    seed: 1,
    emitters: Object.freeze([]),
  });
}

function isEffectEmitter(value: unknown): value is SceneEffectEmitter {
  const row = snapshotPlainRecord(value);

  return row !== undefined && isMutationString(row["emitterId"])
    && (row["kind"] === "point" || row["kind"] === "box" || row["kind"] === "cone")
    && isMutationNumber(row["rate"]) && isMutationNumber(row["lifetimeMs"])
    && isMutationNumber(row["speed"]) && Number.isFinite(row["speed"]) && row["speed"] >= 0
    && isMutationNumber(row["spread"]) && Number.isFinite(row["spread"]) && row["spread"] >= 0
    && (row["instanceId"] === undefined || isSculptIdentifier(row["instanceId"]))
    && (row["color"] === undefined || (isMutationString(row["color"]) && /^#[0-9a-f]{6}$/i.test(row["color"])))
    && (row["size"] === undefined || (isMutationNumber(row["size"]) && Number.isFinite(row["size"]) && row["size"] > 0));
}

function isEffectsCatalog<Input>(value: Input): value is Input & (SceneEffectsCatalog) {
  const row = snapshotPlainRecord(value);

  return row !== undefined && row["schemaVersion"] === 1 && row["kind"] === SCENE_EFFECTS_CATALOG_KIND
    && isMutationNumber(row["seed"]) && Array.isArray(row["emitters"]) && row["emitters"].every(isEffectEmitter);
}

export function parseSceneEffectsCatalog(value: Parameters<typeof snapshotPlainRecord>[0]): SceneEffectsCatalog | null {
  if (value === undefined || value === null) return emptySceneEffectsCatalog();

  return isEffectsCatalog(value) ? value : null;
}

function validEmitterExtensions(emitter: Pick<SceneEffectEmitter, "instanceId" | "color" | "size" | "speed" | "spread">): boolean {
  return isPlainRecord(emitter)
    && (emitter.instanceId === undefined || isSculptIdentifier(emitter.instanceId))
    && (emitter.color === undefined || /^#[0-9a-f]{6}$/i.test(emitter.color))
    && (emitter.size === undefined || (Number.isFinite(emitter.size) && emitter.size > 0))
    && Number.isFinite(emitter.speed) && emitter.speed >= 0
    && Number.isFinite(emitter.spread) && emitter.spread >= 0;
}

export type SceneEffectsMutation =
  | Readonly<{
      kind: "upsert";
      emitterId: string;
      emitterKind: string;
      rate: number;
      lifetimeMs: number;
      speed: number;
      spread: number;
      instanceId?: string;
      color?: string;
      size?: number;
    }>
  | Readonly<{ kind: "remove"; emitterId: string }>
  | Readonly<{ kind: "seed-set"; seed: number }>;

type SceneEffectsMutationBuilder = { -readonly [Key in keyof Extract<SceneEffectsMutation, { kind: "upsert" }>]: Extract<SceneEffectsMutation, { kind: "upsert" }>[Key] };

function isMutationString(value: unknown): value is string {
  return typeof value === "string";
}

function isMutationNumber(value: unknown): value is number {
  return typeof value === "number";
}

/** Snapshot and check every consumed field; domain diagnostics remain in apply. */
export function parseSceneEffectsMutation(value: Parameters<typeof snapshotPlainRecord>[0]): SceneEffectsMutation | null {
  const record = snapshotPlainRecord(value);

  if (record === undefined) return null;

  if (record["kind"] === "upsert") {
    const emitterId = record["emitterId"];
    const emitterKind = record["emitterKind"];
    const rate = record["rate"];
    const lifetimeMs = record["lifetimeMs"];
    const speed = record["speed"];
    const spread = record["spread"];
    const instanceId = record["instanceId"];
    const color = record["color"];
    const size = record["size"];

    if (!isMutationString(emitterId)) return null;

    if (!isMutationString(emitterKind)) return null;

    if (!isMutationNumber(rate)) return null;

    if (!isMutationNumber(lifetimeMs)) return null;

    if (!isMutationNumber(speed)) return null;

    if (!isMutationNumber(spread)) return null;

    if (instanceId !== undefined && !isMutationString(instanceId)) return null;

    if (color !== undefined && !isMutationString(color)) return null;

    if (size !== undefined && !isMutationNumber(size)) return null;
    const mutation: SceneEffectsMutationBuilder = { kind: "upsert", emitterId, emitterKind, rate, lifetimeMs, speed, spread };

    if (instanceId !== undefined) mutation.instanceId = instanceId;

    if (color !== undefined) mutation.color = color;

    if (size !== undefined) mutation.size = size;

    return Object.freeze(mutation);
  }

  if (record["kind"] === "remove") {
    const emitterId = record["emitterId"];

    if (!isMutationString(emitterId)) return null;

    return Object.freeze({ kind: "remove", emitterId });
  }

  if (record["kind"] === "seed-set") {
    const seed = record["seed"];

    if (!isMutationNumber(seed)) return null;

    return Object.freeze({ kind: "seed-set", seed });
  }

  return null;
}

export function applySceneEffectsMutation(input: Readonly<{
  catalog: SceneEffectsCatalog;
  mutation: SceneEffectsMutation;
  instanceIds?: readonly string[];
  profile?: "game" | "web" | "kids";
}>):
  | Readonly<{ ok: true; catalog: SceneEffectsCatalog }>
  | Failure {
  if (input.profile === "kids") {
    return fail(SCENE_EFFECTS_REFUSALS.kidsDenied, "Kids refuses effect authoring.");
  }

  const mutation = parseSceneEffectsMutation(input.mutation);

  if (mutation === null) {
    return fail(SCENE_EFFECTS_REFUSALS.inputUnsupported, "The mutation fields do not match a supported variant.");
  }

  if (mutation.kind === "seed-set") {
    if (!Number.isInteger(mutation.seed) || mutation.seed < 0) {
      return fail(SCENE_EFFECTS_REFUSALS.inputUnsupported, "Seed must be a non-negative integer.");
    }

    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({ ...input.catalog, seed: mutation.seed }),
    });
  }

  if (mutation.kind === "remove") {
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        emitters: Object.freeze(
          input.catalog.emitters.filter((row) => row.emitterId !== mutation.emitterId),
        ),
      }),
    });
  }

  if (!isSculptIdentifier(mutation.emitterId)) {
    return fail(SCENE_EFFECTS_REFUSALS.inputUnsupported, "An emitter requires a lowercase id.");
  }

  if (!SCENE_EFFECT_EMITTER_KINDS.some((kind) => kind === mutation.emitterKind)) {
    return fail(SCENE_EFFECTS_REFUSALS.inputUnsupported, `Emitter kind "${mutation.emitterKind}" is unsupported.`);
  }

  if (!Number.isFinite(mutation.rate) || mutation.rate <= 0 || mutation.rate > 200) {
    return fail(SCENE_EFFECTS_REFUSALS.inputUnsupported, "Rate must be in (0, 200].");
  }

  if (!Number.isFinite(mutation.lifetimeMs) || mutation.lifetimeMs < 16 || mutation.lifetimeMs > 8000) {
    return fail(SCENE_EFFECTS_REFUSALS.inputUnsupported, "Lifetime must be in 16..8000 ms.");
  }

  if (!validEmitterExtensions(mutation)) {
    return fail(SCENE_EFFECTS_REFUSALS.inputUnsupported, "Emitter attachment and colour must be valid; size must be positive, speed and spread non-negative and finite.");
  }

  if (mutation.instanceId !== undefined && !input.instanceIds?.includes(mutation.instanceId)) {
    return fail(SCENE_EFFECTS_REFUSALS.targetMissing, "The emitter carrier is absent from the hierarchy.");
  }

  const appearance: { -readonly [Key in "instanceId" | "color" | "size"]?: SceneEffectEmitter[Key] } = {};

  if (mutation.instanceId !== undefined) appearance.instanceId = mutation.instanceId;

  if (mutation.color !== undefined) appearance.color = mutation.color;

  if (mutation.size !== undefined) appearance.size = mutation.size;

  // SAFETY: emitterKind membership was checked against SCENE_EFFECT_EMITTER_KINDS above.
  const emitter: SceneEffectEmitter = Object.freeze({
    emitterId: mutation.emitterId,
    kind: mutation.emitterKind as SceneEffectEmitter["kind"],
    rate: mutation.rate,
    lifetimeMs: mutation.lifetimeMs,
    speed: mutation.speed,
    spread: mutation.spread,
    ...appearance,
  });

  return Object.freeze({
    ok: true as const,
    catalog: Object.freeze({
      ...input.catalog,
      emitters: Object.freeze([
        ...input.catalog.emitters.filter((row) => row.emitterId !== emitter.emitterId),
        emitter,
      ]),
    }),
  });
}

function digestUint32(label: string): number {
  let hash = 2166136261;

  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function sampleSceneEffects(input: Readonly<{
  catalog: SceneEffectsCatalog;
  timeMs: number;
}>):
  | Readonly<{ ok: true; evaluation: SceneEffectsEvaluation }>
  | Failure {
  if (!Number.isFinite(input.timeMs) || input.timeMs < 0 || input.timeMs > 60_000) {
    return fail(SCENE_EFFECTS_REFUSALS.sampleUnstable, "Sample time must be in 0..60000 ms.");
  }

  const samples = input.catalog.emitters.map((emitter) => {
    const seed = digestUint32(`sceneaxi.effect:${input.catalog.seed}:${emitter.emitterId}`);
    const alive = Math.min(32, Math.max(1, Math.floor((emitter.rate * emitter.lifetimeMs) / 1000)));

    const positions = Array.from({ length: alive }, (_, index) => {
      const phase = ((seed + index * 997 + Math.floor(input.timeMs)) % 1000) / 1000;
      const height = (phase * emitter.speed * emitter.lifetimeMs) / 1000;

      if (emitter.kind === "point") return Object.freeze([0, height, 0] as const);

      if (emitter.kind === "box") {
        const offset = (axis: string) => (digestUint32(`${seed}:${index}:${axis}`) / 0xffffffff * 2 - 1) * emitter.spread;

        return Object.freeze([offset("x"), offset("y") + height, offset("z")] as const);
      }

      const radius = emitter.spread * phase;
      const angle = (digestUint32(`${seed}:${index}:angle`) / 0xffffffff) * Math.PI * 2;

      return Object.freeze([Math.cos(angle) * radius, height, Math.sin(angle) * radius] as const);
    });

    const appearance: { -readonly [Key in "instanceId" | "color" | "size"]?: SceneEffectEmitter[Key] } = {};

    if (emitter.instanceId !== undefined) appearance.instanceId = emitter.instanceId;

    if (emitter.color !== undefined) appearance.color = emitter.color;

    if (emitter.size !== undefined) appearance.size = emitter.size;

    return Object.freeze({
      ...appearance,
      emitterId: emitter.emitterId,
      count: alive,
      positions: Object.freeze(positions),
    });
  });

  const frozen = Object.freeze(samples);

  return Object.freeze({
    ok: true as const,
    evaluation: Object.freeze({
      schemaVersion: 1,
      kind: "sceneaxi.scene-effects-evaluation" as const,
      timeMs: input.timeMs,
      samples: frozen,
      digest: digestSculptJson({
        seed: input.catalog.seed,
        timeMs: input.timeMs,
        samples: frozen,
      }),
      savedBytesWritten: false as const,
    }),
  });
}

export function inspectSceneEffects(catalog: SceneEffectsCatalog) {
  return Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.scene-effects-inspection",
    catalog,
    digest: digestSculptJson(catalog),
    savedBytesWritten: false as const,
  });
}
