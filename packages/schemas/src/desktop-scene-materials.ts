/**
 * Scene-level parametric material overrides. Projected at mount; never rewrite
 * Sculpt Artifact spec bytes.
 */
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier } from "./sculpt.js";

export const SCENE_MATERIALS_SCHEMA_VERSION = 1 as const;
export const SCENE_MATERIALS_CATALOG_KIND = "sceneaxi.scene-materials-catalog" as const;
export const SCENE_MATERIALS_CATALOG_KEY = "sceneMaterials" as const;

export const SCENE_MATERIAL_PARAMETERS = Object.freeze([
  "emissiveColor",
  "emissiveIntensity",
  "opacity",
  "baseColorMapAssetId",
  "normalMapAssetId",
  "roughnessMapAssetId",
] as const);

export const SCENE_MATERIALS_REFUSALS = Object.freeze({
  catalogInvalid: "MATERIALS_CATALOG_INVALID",
  targetMissing: "MATERIALS_TARGET_MISSING",
  inputUnsupported: "MATERIALS_INPUT_UNSUPPORTED",
  kidsDenied: "MATERIALS_KIDS_DENIED",
  capabilityMissing: "MATERIALS_CAPABILITY_MISSING",
} as const);

export type SceneMaterialsRefusal =
  (typeof SCENE_MATERIALS_REFUSALS)[keyof typeof SCENE_MATERIALS_REFUSALS];

export type SceneMaterialOverride = Readonly<{
  instanceId: string;
  emissiveColor: string;
  emissiveIntensity: number;
  opacity: number;
  baseColorMapAssetId: string | null;
  normalMapAssetId: string | null;
  roughnessMapAssetId: string | null;
}>;

export type SceneMaterialsCatalog = Readonly<{
  schemaVersion: typeof SCENE_MATERIALS_SCHEMA_VERSION;
  kind: typeof SCENE_MATERIALS_CATALOG_KIND;
  overrides: readonly SceneMaterialOverride[];
}>;

type Failure = Readonly<{ ok: false; reason: SceneMaterialsRefusal; message: string }>;
const fail = (reason: SceneMaterialsRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message });

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function emptySceneMaterialsCatalog(): SceneMaterialsCatalog {
  return Object.freeze({
    schemaVersion: 1,
    kind: SCENE_MATERIALS_CATALOG_KIND,
    overrides: Object.freeze([]),
  });
}

export function parseSceneMaterialsCatalog(value: unknown): SceneMaterialsCatalog | null {
  if (value === undefined || value === null) return emptySceneMaterialsCatalog();
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record["schemaVersion"] !== 1 || record["kind"] !== SCENE_MATERIALS_CATALOG_KIND) {
    return null;
  }
  return value as SceneMaterialsCatalog;
}

export type SceneMaterialsMutation =
  | Readonly<{
      kind: "upsert";
      instanceId: string;
      emissiveColor: string;
      emissiveIntensity: number;
      opacity: number;
      baseColorMapAssetId: string | null;
      normalMapAssetId: string | null;
      roughnessMapAssetId: string | null;
    }>
  | Readonly<{ kind: "remove"; instanceId: string }>;

export function applySceneMaterialsMutation(input: Readonly<{
  catalog: SceneMaterialsCatalog;
  mutation: SceneMaterialsMutation;
  instanceIds: readonly string[];
  profile?: "game" | "web" | "kids";
}>):
  | Readonly<{ ok: true; catalog: SceneMaterialsCatalog }>
  | Failure {
  if (input.profile === "kids") {
    return fail(SCENE_MATERIALS_REFUSALS.kidsDenied, "Kids refuses material authoring.");
  }
  const mutation = input.mutation;
  if (!isSculptIdentifier(mutation.instanceId)) {
    return fail(SCENE_MATERIALS_REFUSALS.inputUnsupported, "A material override requires a lowercase instance id.");
  }
  if (!input.instanceIds.includes(mutation.instanceId)) {
    return fail(
      SCENE_MATERIALS_REFUSALS.targetMissing,
      `Material target "${mutation.instanceId}" is absent from the hierarchy.`,
    );
  }
  if (mutation.kind === "remove") {
    return Object.freeze({
      ok: true as const,
      catalog: Object.freeze({
        ...input.catalog,
        overrides: Object.freeze(
          input.catalog.overrides.filter((row) => row.instanceId !== mutation.instanceId),
        ),
      }),
    });
  }
  if (!HEX.test(mutation.emissiveColor)) {
    return fail(SCENE_MATERIALS_REFUSALS.inputUnsupported, "Emissive colour must be #rrggbb.");
  }
  if (!Number.isFinite(mutation.emissiveIntensity) || mutation.emissiveIntensity < 0 || mutation.emissiveIntensity > 16) {
    return fail(SCENE_MATERIALS_REFUSALS.inputUnsupported, "Emissive intensity must be in 0..16.");
  }
  if (!Number.isFinite(mutation.opacity) || mutation.opacity < 0 || mutation.opacity > 1) {
    return fail(SCENE_MATERIALS_REFUSALS.inputUnsupported, "Opacity must be in 0..1.");
  }
  const override: SceneMaterialOverride = Object.freeze({
    instanceId: mutation.instanceId,
    emissiveColor: mutation.emissiveColor,
    emissiveIntensity: mutation.emissiveIntensity,
    opacity: mutation.opacity,
    baseColorMapAssetId: mutation.baseColorMapAssetId,
    normalMapAssetId: mutation.normalMapAssetId,
    roughnessMapAssetId: mutation.roughnessMapAssetId,
  });
  return Object.freeze({
    ok: true as const,
    catalog: Object.freeze({
      ...input.catalog,
      overrides: Object.freeze([
        ...input.catalog.overrides.filter((row) => row.instanceId !== override.instanceId),
        override,
      ]),
    }),
  });
}

export function inspectSceneMaterials(catalog: SceneMaterialsCatalog) {
  return Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.scene-materials-inspection",
    catalog,
    digest: sceneMaterialsCatalogDigest(catalog),
    savedBytesWritten: false as const,
  });
}

export function sceneMaterialsCatalogDigest(catalog: SceneMaterialsCatalog): string {
  return digestSculptJson(catalog);
}
