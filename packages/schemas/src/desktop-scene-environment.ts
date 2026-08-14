/**
 * Presentation-authored scene environment. Changes the project content hash
 * and never a kernel digest. Kids is refused independently on every mutation.
 */
import { digestSculptJson } from "./sculpt-json.js";

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

export function parseSceneEnvironmentCatalog(value: unknown): SceneEnvironmentCatalog | null {
  if (value === undefined || value === null) return emptySceneEnvironmentCatalog();
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record["schemaVersion"] !== 1 || record["kind"] !== SCENE_ENVIRONMENT_CATALOG_KIND) {
    return null;
  }
  return value as SceneEnvironmentCatalog;
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
}>;

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
  const mutation = input.mutation;
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
    next.keyDirection = Object.freeze([...mutation.keyDirection] as [number, number, number]);
  }
  if (mutation.toneMapping !== undefined) {
    if (!SCENE_ENVIRONMENT_TONE_MAPS.some((tone) => tone === mutation.toneMapping)) {
      return fail(SCENE_ENVIRONMENT_REFUSALS.inputUnsupported, `Tone mapping "${mutation.toneMapping}" is unsupported.`);
    }
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
