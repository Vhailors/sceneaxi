/** Pure scene light contracts. Carriers may be mesh objects or mesh-less nodes. */
import type { JsonValue } from "./document.js";
import { isPlainRecord } from "./record-validation.js";
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier } from "./sculpt.js";

export const SCENE_LIGHTS_SCHEMA_VERSION = 1 as const;

export const SCENE_LIGHTS_CATALOG_KIND = "sceneaxi.scene-lights-catalog" as const;

export const SCENE_LIGHTS_CATALOG_KEY = "sceneLights" as const;

export const SCENE_LIGHT_KINDS = Object.freeze(["directional", "point", "spot", "hemisphere"] as const);

export const SCENE_LIGHTS_REFUSALS = Object.freeze({
  kidsDenied: "SCENE_LIGHTS_KIDS_DENIED",
  catalogInvalid: "SCENE_LIGHTS_CATALOG_INVALID",
  targetMissing: "SCENE_LIGHTS_TARGET_MISSING",
  inputUnsupported: "SCENE_LIGHTS_INPUT_UNSUPPORTED",
  limitExceeded: "SCENE_LIGHTS_LIMIT_EXCEEDED",
  shadowLimitExceeded: "SCENE_LIGHTS_SHADOW_LIMIT_EXCEEDED",
} as const);

export type SceneLightsRefusal = (typeof SCENE_LIGHTS_REFUSALS)[keyof typeof SCENE_LIGHTS_REFUSALS];

export type SceneLight = Readonly<{
  instanceId: string;
  kind: (typeof SCENE_LIGHT_KINDS)[number];
  color: string;
  intensity: number;
  range: number;
  /** Spot cone half-angle in degrees, matching the inspector's degree unit. */
  angle: number;
  penumbra: number;
  castShadow: boolean;
}>;

export type SceneLightsCatalog = Readonly<{
  schemaVersion: typeof SCENE_LIGHTS_SCHEMA_VERSION;
  kind: typeof SCENE_LIGHTS_CATALOG_KIND;
  lights: readonly SceneLight[];
}>;

export type SceneLightsMutation =
  | Readonly<{ kind: "upsert"; light: SceneLight }>
  | Readonly<{ kind: "remove"; instanceId: string }>;

type Failure = Readonly<{ ok: false; reason: SceneLightsRefusal; message: string }>;

const fail = (reason: SceneLightsRefusal, message: string): Failure =>
  Object.freeze({ ok: false, reason, message });

function validLight(light: SceneLight): boolean {
  return isPlainRecord(light) && isSculptIdentifier(light.instanceId)
    && SCENE_LIGHT_KINDS.includes(light.kind) && /^#[0-9a-f]{6}$/i.test(light.color)
    && Number.isFinite(light.intensity) && light.intensity >= 0
    && Number.isFinite(light.range) && light.range >= 0
    && Number.isFinite(light.angle) && light.angle > 0 && light.angle <= 90
    && Number.isFinite(light.penumbra) && light.penumbra >= 0 && light.penumbra <= 1
    && (light.castShadow === false || (light.castShadow === true && light.kind === "directional"));
}

export function emptySceneLightsCatalog(): SceneLightsCatalog {
  return Object.freeze({ schemaVersion: 1, kind: SCENE_LIGHTS_CATALOG_KIND, lights: Object.freeze([]) });
}

export function parseSceneLightsCatalog(value: JsonValue | undefined): SceneLightsCatalog | null {
  if (value === undefined || value === null) return emptySceneLightsCatalog();

  if (!isPlainRecord(value)) return null;

  // SAFETY: this boundary validates the version, array and every light before returning it.
  const catalog = value as Partial<SceneLightsCatalog>;

  if (catalog.schemaVersion !== 1 || catalog.kind !== SCENE_LIGHTS_CATALOG_KIND
    || !Array.isArray(catalog.lights) || catalog.lights.length > 8
    || !catalog.lights.every(validLight)
    || new Set(catalog.lights.map((light) => light.instanceId)).size !== catalog.lights.length
    || catalog.lights.filter((light) => light.castShadow).length > 1) return null;

  return Object.freeze({ schemaVersion: 1, kind: SCENE_LIGHTS_CATALOG_KIND,
    lights: Object.freeze(catalog.lights.map((light) => Object.freeze({ ...light }))) });
}

export function applySceneLightsMutation(input: Readonly<{
  catalog: SceneLightsCatalog;
  mutation: SceneLightsMutation;
  instanceIds: readonly string[];
  profile?: "game" | "web" | "kids";
}>): Readonly<{ ok: true; catalog: SceneLightsCatalog }> | Failure {
  if (input.profile === "kids") return fail(SCENE_LIGHTS_REFUSALS.kidsDenied, "Kids refuses light authoring.");

  const catalog = parseSceneLightsCatalog(input.catalog);

  if (!catalog) return fail(SCENE_LIGHTS_REFUSALS.catalogInvalid, "The light catalog is invalid.");

  const mutation = input.mutation;
  const instanceId = mutation.kind === "remove" ? mutation.instanceId : mutation.light.instanceId;

  if (!isSculptIdentifier(instanceId)) return fail(SCENE_LIGHTS_REFUSALS.inputUnsupported, "A light requires a lowercase instance id.");

  if (!input.instanceIds.includes(instanceId)) return fail(SCENE_LIGHTS_REFUSALS.targetMissing, "The light carrier is absent from the hierarchy.");

  const lights = catalog.lights.filter((light) => light.instanceId !== instanceId);

  if (mutation.kind === "upsert") {
    if (!validLight(mutation.light)) return fail(SCENE_LIGHTS_REFUSALS.inputUnsupported, "Light fields are invalid; only directional lights may cast a shadow.");

    if (lights.length >= 8) return fail(SCENE_LIGHTS_REFUSALS.limitExceeded, "A scene admits at most eight lights.");

    if (mutation.light.castShadow && lights.some((light) => light.castShadow)) return fail(SCENE_LIGHTS_REFUSALS.shadowLimitExceeded, "A scene admits at most one shadow caster.");

    lights.push(Object.freeze({ ...mutation.light }));
  }

  return Object.freeze({ ok: true, catalog: Object.freeze({ ...catalog, lights: Object.freeze(lights) }) });
}

export function sceneLightsCatalogDigest(catalog: SceneLightsCatalog): string {
  return digestSculptJson(catalog);
}

export function inspectSceneLights(catalog: SceneLightsCatalog) {
  return Object.freeze({ schemaVersion: 1, kind: "sceneaxi.scene-lights-inspection", catalog,
    digest: sceneLightsCatalogDigest(catalog), savedBytesWritten: false as const });
}
