/**
 * Presentation-authored scene environment. Changes the project content hash
 * and never a kernel digest. Kids is refused independently on every mutation.
 */
import { digestSculptJson } from "./sculpt-json.js";
import { snapshotPlainRecord, snapshotPlainArray, isPlainRecord } from "./record-validation.js";

export const SCENE_ENVIRONMENT_SCHEMA_VERSION = 1 as const;

export const SCENE_ENVIRONMENT_CATALOG_KIND = "sceneaxi.scene-environment-catalog" as const;

export const SCENE_ENVIRONMENT_CATALOG_KEY = "sceneEnvironment" as const;

export const SCENE_ENVIRONMENT_TONE_MAPS = Object.freeze([
  "none",
  "linear",
  "reinhard",
  "aces",
] as const);

export const SCENE_ENVIRONMENT_EFFECTS = Object.freeze(["bloom", "vignette"] as const);

export const SCENE_ENVIRONMENT_REFUSALS = Object.freeze({
  catalogInvalid: "ENVIRONMENT_CATALOG_INVALID",
  inputUnsupported: "ENVIRONMENT_INPUT_UNSUPPORTED",
  kidsDenied: "ENVIRONMENT_KIDS_DENIED",
  capabilityMissing: "ENVIRONMENT_CAPABILITY_MISSING",
} as const);

export type SceneEnvironmentRefusal =
  (typeof SCENE_ENVIRONMENT_REFUSALS)[keyof typeof SCENE_ENVIRONMENT_REFUSALS];

export type SceneEnvironmentCatalog = Readonly<{
  schemaVersion: typeof SCENE_ENVIRONMENT_SCHEMA_VERSION;
  kind: typeof SCENE_ENVIRONMENT_CATALOG_KIND;
  background: string;
  ambientIntensity: number;
  ambientColor: string;
  keyIntensity: number;
  keyColor: string;
  keyDirection: readonly [number, number, number];
  fillIntensity: number;
  exposure: number;
  toneMapping: (typeof SCENE_ENVIRONMENT_TONE_MAPS)[number];
  shadows: boolean;
  fog: Readonly<{ enabled: boolean; color: string; near: number; far: number }>;
  effects: readonly (typeof SCENE_ENVIRONMENT_EFFECTS)[number][];
  sky?: Readonly<{ top: string; horizon: string; ground: string }>;
  shadowBudget?: Readonly<{ mapSize: 1024 | 2048; maxDistance: number }>;
  bloom?: Readonly<{ strength: number; threshold: number; radius: number }>;
}>;

type Failure = Readonly<{ ok: false; reason: SceneEnvironmentRefusal; message: string }>;

const fail = (reason: SceneEnvironmentRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message });

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function emptySceneEnvironmentCatalog(): SceneEnvironmentCatalog {
  return Object.freeze({
    schemaVersion: 1,
    kind: SCENE_ENVIRONMENT_CATALOG_KIND,
    background: "#101318",
    ambientIntensity: 0.45,
    ambientColor: "#ffffff",
    keyIntensity: 2.2,
    keyColor: "#ffffff",
    keyDirection: Object.freeze([4, 6, 5] as const),
    fillIntensity: 0.6,
    exposure: 1,
    toneMapping: "none",
    shadows: false,
    fog: Object.freeze({ enabled: false, color: "#101318", near: 8, far: 40 }),
    effects: Object.freeze([]),
  });
}

type SceneEnvironmentInput = Parameters<typeof snapshotPlainRecord>[0];

export function parseSceneEnvironmentCatalog(value: SceneEnvironmentInput): SceneEnvironmentCatalog | null {
  if (value === undefined || value === null) return emptySceneEnvironmentCatalog();

  if (!isBoundaryObjectOrNull(value) || Array.isArray(value)) return null;
  // SAFETY: the preceding object check admits only raw optional envelope fields; values remain untrusted.
  const record = value as { schemaVersion?: unknown; kind?: unknown };

  if (record["schemaVersion"] !== 1 || record["kind"] !== SCENE_ENVIRONMENT_CATALOG_KIND) {
    return null;
  }

  // SAFETY: the catalog envelope was checked above; extensions are validated below.
  const catalog = value as SceneEnvironmentCatalog;

  return validEnvironmentExtensions(catalog) ? catalog : null;
}

export type SceneEnvironmentMutation = Readonly<{
  kind: "set";
  background?: string;
  ambientIntensity?: number;
  ambientColor?: string;
  keyIntensity?: number;
  keyColor?: string;
  keyDirection?: readonly [number, number, number];
  fillIntensity?: number;
  exposure?: number;
  toneMapping?: string;
  shadows?: boolean;
  fog?: Readonly<{ enabled: boolean; color: string; near: number; far: number }>;
  effects?: readonly string[];
  sky?: NonNullable<SceneEnvironmentCatalog["sky"]>;
  shadowBudget?: NonNullable<SceneEnvironmentCatalog["shadowBudget"]>;
  bloom?: NonNullable<SceneEnvironmentCatalog["bloom"]>;
}>;

function validEnvironmentExtensions(fields: Pick<SceneEnvironmentCatalog, "sky" | "shadowBudget" | "bloom">): boolean {
  const { sky, shadowBudget, bloom } = fields;

  return (sky === undefined || (isPlainRecord(sky) && HEX.test(sky.top) && HEX.test(sky.horizon) && HEX.test(sky.ground)))
    && (shadowBudget === undefined || (isPlainRecord(shadowBudget)
      && (shadowBudget.mapSize === 1024 || shadowBudget.mapSize === 2048)
      && Number.isFinite(shadowBudget.maxDistance) && shadowBudget.maxDistance > 0))
    && (bloom === undefined || (isPlainRecord(bloom)
      && Number.isFinite(bloom.strength) && bloom.strength >= 0
      && Number.isFinite(bloom.threshold) && bloom.threshold >= 0 && bloom.threshold <= 1
      && Number.isFinite(bloom.radius) && bloom.radius >= 0 && bloom.radius <= 1));
}

type SceneEnvironmentMutationBuilder = { -readonly [Key in keyof SceneEnvironmentMutation]: SceneEnvironmentMutation[Key] };

function isMutationString(value: SceneEnvironmentInput): value is string {
  return typeof value === "string";
}

function isMutationNumber(value: SceneEnvironmentInput): value is number {
  return typeof value === "number";
}

function isMutationBoolean(value: SceneEnvironmentInput): value is boolean {
  return typeof value === "boolean";
}

function parseMutationDirection(value: SceneEnvironmentInput): readonly [number, number, number] | null {
  const entries = snapshotPlainArray(value);

  if (entries === undefined || entries.length !== 3) return null;
  const [x, y, z] = entries;

  if (!isMutationNumber(x) || !isMutationNumber(y) || !isMutationNumber(z)) return null;

  return Object.freeze([x, y, z]);
}

function parseMutationEffects(value: SceneEnvironmentInput): readonly string[] | null {
  const entries = snapshotPlainArray(value);

  if (entries === undefined) return null;
  const effects: string[] = [];

  for (const entry of entries) {
    if (!isMutationString(entry)) return null;
    effects.push(entry);
  }

  return Object.freeze(effects);
}

function parseMutationFog(value: SceneEnvironmentInput): NonNullable<SceneEnvironmentMutation["fog"]> | null {
  const record = snapshotPlainRecord(value);

  if (record === undefined) return null;
  const enabled = record["enabled"];
  const color = record["color"];
  const near = record["near"];
  const far = record["far"];

  if (!isMutationBoolean(enabled)) return null;

  if (!isMutationString(color)) return null;

  if (!isMutationNumber(near)) return null;

  if (!isMutationNumber(far)) return null;

  return Object.freeze({ enabled, color, near, far });
}

function parseMutationSky(value: SceneEnvironmentInput): NonNullable<SceneEnvironmentMutation["sky"]> | null {
  const record = snapshotPlainRecord(value);

  if (record === undefined) return null;
  const top = record["top"];
  const horizon = record["horizon"];
  const ground = record["ground"];

  if (!isMutationString(top)) return null;

  if (!isMutationString(horizon)) return null;

  if (!isMutationString(ground)) return null;

  return Object.freeze({ top, horizon, ground });
}

function parseMutationShadowBudget(value: SceneEnvironmentInput): NonNullable<SceneEnvironmentMutation["shadowBudget"]> | null {
  const record = snapshotPlainRecord(value);

  if (record === undefined) return null;
  const mapSize = record["mapSize"];
  const maxDistance = record["maxDistance"];

  if (mapSize !== 1024 && mapSize !== 2048) return null;

  if (!isMutationNumber(maxDistance)) return null;

  return Object.freeze({ mapSize, maxDistance });
}

function parseMutationBloom(value: SceneEnvironmentInput): NonNullable<SceneEnvironmentMutation["bloom"]> | null {
  const record = snapshotPlainRecord(value);

  if (record === undefined) return null;
  const strength = record["strength"];
  const threshold = record["threshold"];
  const radius = record["radius"];

  if (!isMutationNumber(strength)) return null;

  if (!isMutationNumber(threshold)) return null;

  if (!isMutationNumber(radius)) return null;

  return Object.freeze({ strength, threshold, radius });
}

/** Snapshot nested containers before checking the complete set mutation shape. */
export function parseSceneEnvironmentMutation(value: SceneEnvironmentInput): SceneEnvironmentMutation | null {
  const record = snapshotPlainRecord(value);

  if (record === undefined || record["kind"] !== "set") return null;
  const background = record["background"];

  if (background !== undefined && !isMutationString(background)) return null;
  const ambientIntensity = record["ambientIntensity"];

  if (ambientIntensity !== undefined && !isMutationNumber(ambientIntensity)) return null;
  const ambientColor = record["ambientColor"];

  if (ambientColor !== undefined && !isMutationString(ambientColor)) return null;
  const keyIntensity = record["keyIntensity"];

  if (keyIntensity !== undefined && !isMutationNumber(keyIntensity)) return null;
  const keyColor = record["keyColor"];

  if (keyColor !== undefined && !isMutationString(keyColor)) return null;
  const keyDirection = record["keyDirection"] === undefined ? undefined : parseMutationDirection(record["keyDirection"]);

  if (keyDirection === null) return null;
  const fillIntensity = record["fillIntensity"];

  if (fillIntensity !== undefined && !isMutationNumber(fillIntensity)) return null;
  const exposure = record["exposure"];

  if (exposure !== undefined && !isMutationNumber(exposure)) return null;
  const toneMapping = record["toneMapping"];

  if (toneMapping !== undefined && !isMutationString(toneMapping)) return null;
  const shadows = record["shadows"];

  if (shadows !== undefined && !isMutationBoolean(shadows)) return null;
  const fog = record["fog"] === undefined ? undefined : parseMutationFog(record["fog"]);

  if (fog === null) return null;
  const effects = record["effects"] === undefined ? undefined : parseMutationEffects(record["effects"]);

  if (effects === null) return null;
  const sky = record["sky"] === undefined ? undefined : parseMutationSky(record["sky"]);

  if (sky === null) return null;
  const shadowBudget = record["shadowBudget"] === undefined ? undefined : parseMutationShadowBudget(record["shadowBudget"]);

  if (shadowBudget === null) return null;
  const bloom = record["bloom"] === undefined ? undefined : parseMutationBloom(record["bloom"]);

  if (bloom === null) return null;
  const mutation: SceneEnvironmentMutationBuilder = { kind: "set" };

  if (background !== undefined) mutation.background = background;

  if (ambientIntensity !== undefined) mutation.ambientIntensity = ambientIntensity;

  if (ambientColor !== undefined) mutation.ambientColor = ambientColor;

  if (keyIntensity !== undefined) mutation.keyIntensity = keyIntensity;

  if (keyColor !== undefined) mutation.keyColor = keyColor;

  if (keyDirection !== undefined) mutation.keyDirection = keyDirection;

  if (fillIntensity !== undefined) mutation.fillIntensity = fillIntensity;

  if (exposure !== undefined) mutation.exposure = exposure;

  if (toneMapping !== undefined) mutation.toneMapping = toneMapping;

  if (shadows !== undefined) mutation.shadows = shadows;

  if (fog !== undefined) mutation.fog = fog;

  if (effects !== undefined) mutation.effects = effects;

  if (sky !== undefined) mutation.sky = sky;

  if (shadowBudget !== undefined) mutation.shadowBudget = shadowBudget;

  if (bloom !== undefined) mutation.bloom = bloom;

  return Object.freeze(mutation);
}

export function applySceneEnvironmentMutation(input: Readonly<{
  catalog: SceneEnvironmentCatalog;
  mutation: SceneEnvironmentMutation;
  profile?: "game" | "web" | "kids";
}>):
  | Readonly<{ ok: true; catalog: SceneEnvironmentCatalog }>
  | Failure {
  if (input.profile === "kids") {
    return fail(SCENE_ENVIRONMENT_REFUSALS.kidsDenied, "Kids refuses environment authoring.");
  }

  const next = { ...input.catalog };
  const mutation = parseSceneEnvironmentMutation(input.mutation);

  if (mutation === null) {
    return fail(SCENE_ENVIRONMENT_REFUSALS.inputUnsupported, "The mutation fields do not match a supported variant.");
  }

  if (!validEnvironmentExtensions(mutation)) {
    return fail(SCENE_ENVIRONMENT_REFUSALS.inputUnsupported, "Sky requires hex colours; shadows require 1024/2048 and a positive distance; bloom requires finite strength >= 0 and threshold/radius in 0..1.");
  }

  if (mutation.sky !== undefined) next.sky = Object.freeze({ ...mutation.sky });

  if (mutation.shadowBudget !== undefined) next.shadowBudget = Object.freeze({ ...mutation.shadowBudget });

  if (mutation.bloom !== undefined) next.bloom = Object.freeze({ ...mutation.bloom });

  if (mutation.background !== undefined) {
    if (!HEX.test(mutation.background)) {
      return fail(SCENE_ENVIRONMENT_REFUSALS.inputUnsupported, "Background must be a #rrggbb colour.");
    }

    next.background = mutation.background;
  }

  for (const key of ["ambientIntensity", "keyIntensity", "fillIntensity", "exposure"] as const) {
    const value = mutation[key];

    if (value === undefined) continue;

    if (!Number.isFinite(value) || value < 0 || value > 16) {
      return fail(SCENE_ENVIRONMENT_REFUSALS.inputUnsupported, `${key} must be a finite number in 0..16.`);
    }

    next[key] = value;
  }

  for (const key of ["ambientColor", "keyColor"] as const) {
    const value = mutation[key];

    if (value === undefined) continue;

    if (!HEX.test(value)) {
      return fail(SCENE_ENVIRONMENT_REFUSALS.inputUnsupported, `${key} must be a #rrggbb colour.`);
    }

    next[key] = value;
  }

  if (mutation.keyDirection !== undefined) {
    if (
      mutation.keyDirection.length !== 3 ||
      mutation.keyDirection.some((value) => !Number.isFinite(value))
    ) {
      return fail(SCENE_ENVIRONMENT_REFUSALS.inputUnsupported, "Key direction must be three finite numbers.");
    }

    // SAFETY: keyDirection has exactly three finite elements, and this copy preserves its length.
    next.keyDirection = Object.freeze([...mutation.keyDirection] as [number, number, number]);
  }

  if (mutation.toneMapping !== undefined) {
    if (!SCENE_ENVIRONMENT_TONE_MAPS.some((tone) => tone === mutation.toneMapping)) {
      return fail(SCENE_ENVIRONMENT_REFUSALS.inputUnsupported, `Tone mapping "${mutation.toneMapping}" is unsupported.`);
    }

    // SAFETY: the toneMapping value was matched against SCENE_ENVIRONMENT_TONE_MAPS above.
    next.toneMapping = mutation.toneMapping as SceneEnvironmentCatalog["toneMapping"];
  }

  if (mutation.shadows !== undefined) next.shadows = mutation.shadows;

  if (mutation.fog !== undefined) {
    if (!HEX.test(mutation.fog.color) || mutation.fog.near < 0 || mutation.fog.far <= mutation.fog.near) {
      return fail(SCENE_ENVIRONMENT_REFUSALS.inputUnsupported, "Fog requires a colour and far > near ≥ 0.");
    }

    next.fog = Object.freeze({ ...mutation.fog });
  }

  if (mutation.effects !== undefined) {
    if (mutation.effects.some((effect) => !SCENE_ENVIRONMENT_EFFECTS.some((known) => known === effect))) {
      return fail(SCENE_ENVIRONMENT_REFUSALS.inputUnsupported, "Unknown post-process effect.");
    }

    // SAFETY: every effect was matched against SCENE_ENVIRONMENT_EFFECTS; Set only removes duplicate known values.
    next.effects = Object.freeze(
      [...new Set(mutation.effects)] as SceneEnvironmentCatalog["effects"],
    );
  }

  return Object.freeze({
    ok: true as const,
    catalog: Object.freeze(next),
  });
}

export function inspectSceneEnvironment(catalog: SceneEnvironmentCatalog) {
  return Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.scene-environment-inspection",
    catalog,
    digest: sceneEnvironmentCatalogDigest(catalog),
    savedBytesWritten: false as const,
  });
}

export function sceneEnvironmentCatalogDigest(catalog: SceneEnvironmentCatalog): string {
  return digestSculptJson(catalog);
}

function isBoundaryObjectOrNull(value: SceneEnvironmentInput): value is object | null {
  return isBoundaryObjectValue(value);
}

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
