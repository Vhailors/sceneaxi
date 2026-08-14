/**
 * Decorative, seeded particle emitters. Presentation-only: never kernel state.
 * three.quarks was evaluated and declined for v1 because its RNG is not
 * injectable; sampleAt is a closed, digest-stamped evaluation instead.
 */
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier } from "./sculpt.js";

export const SCENE_EFFECTS_SCHEMA_VERSION = 1 as const;
export const SCENE_EFFECTS_CATALOG_KIND = "sceneaxi.scene-effects-catalog" as const;
export const SCENE_EFFECTS_CATALOG_KEY = "sceneEffects" as const;

export const SCENE_EFFECT_EMITTER_KINDS = Object.freeze(["point", "box", "cone"] as const);

export const SCENE_EFFECTS_REFUSALS = Object.freeze({
  catalogInvalid: "EFFECTS_CATALOG_INVALID",
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
  positions: readonly (readonly [number, number, number])[];
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

export function parseSceneEffectsCatalog(value: unknown): SceneEffectsCatalog | null {
  if (value === undefined || value === null) return emptySceneEffectsCatalog();
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record["schemaVersion"] !== 1 || record["kind"] !== SCENE_EFFECTS_CATALOG_KIND) {
    return null;
  }
  return value as SceneEffectsCatalog;
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
    }>
  | Readonly<{ kind: "remove"; emitterId: string }>
  | Readonly<{ kind: "seed-set"; seed: number }>;

export function applySceneEffectsMutation(input: Readonly<{
  catalog: SceneEffectsCatalog;
  mutation: SceneEffectsMutation;
  profile?: "game" | "web" | "kids";
}>):
  | Readonly<{ ok: true; catalog: SceneEffectsCatalog }>
  | Failure {
  if (input.profile === "kids") {
    return fail(SCENE_EFFECTS_REFUSALS.kidsDenied, "Kids refuses effect authoring.");
  }
  const mutation = input.mutation;
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
  const emitter: SceneEffectEmitter = Object.freeze({
    emitterId: mutation.emitterId,
    kind: mutation.emitterKind as SceneEffectEmitter["kind"],
    rate: mutation.rate,
    lifetimeMs: mutation.lifetimeMs,
    speed: mutation.speed,
    spread: mutation.spread,
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
      const radius = emitter.spread * (0.25 + phase * 0.75);
      const angle = phase * Math.PI * 2;
      return Object.freeze([
        Math.cos(angle) * radius,
        (phase * emitter.speed * emitter.lifetimeMs) / 1000,
        Math.sin(angle) * radius,
      ] as const);
    });
    return Object.freeze({
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
