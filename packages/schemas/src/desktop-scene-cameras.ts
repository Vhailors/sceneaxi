/** Scene cameras are keyed to any instance; the editor orbit camera is not stored here. */
import type { JsonValue } from "./document.js";
import { isPlainRecord } from "./record-validation.js";
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier } from "./sculpt.js";

export const SCENE_CAMERAS_SCHEMA_VERSION = 1 as const;

export const SCENE_CAMERAS_CATALOG_KIND = "sceneaxi.scene-cameras-catalog" as const;

export const SCENE_CAMERAS_CATALOG_KEY = "sceneCameras" as const;

export const SCENE_CAMERA_KINDS = Object.freeze(["perspective", "orthographic"] as const);

export const SCENE_CAMERAS_REFUSALS = Object.freeze({
  kidsDenied: "SCENE_CAMERAS_KIDS_DENIED",
  catalogInvalid: "SCENE_CAMERAS_CATALOG_INVALID",
  targetMissing: "SCENE_CAMERAS_TARGET_MISSING",
  inputUnsupported: "SCENE_CAMERAS_INPUT_UNSUPPORTED",
  activeConflict: "SCENE_CAMERAS_ACTIVE_CONFLICT",
} as const);

export type SceneCamerasRefusal = (typeof SCENE_CAMERAS_REFUSALS)[keyof typeof SCENE_CAMERAS_REFUSALS];

export type SceneCamera = Readonly<{
  instanceId: string;
  kind: (typeof SCENE_CAMERA_KINDS)[number];
  fovDegrees: number;
  /** Vertical span of the orthographic view in scene units. */
  orthoSize: number;
  near: number;
  far: number;
  active: boolean;
}>;

export type SceneCamerasCatalog = Readonly<{
  schemaVersion: typeof SCENE_CAMERAS_SCHEMA_VERSION;
  kind: typeof SCENE_CAMERAS_CATALOG_KIND;
  cameras: readonly SceneCamera[];
}>;

export type SceneCamerasMutation =
  | Readonly<{ kind: "upsert"; camera: SceneCamera }>
  | Readonly<{ kind: "remove"; instanceId: string }>;

type Failure = Readonly<{ ok: false; reason: SceneCamerasRefusal; message: string }>;

const fail = (reason: SceneCamerasRefusal, message: string): Failure =>
  Object.freeze({ ok: false, reason, message });

function validCamera(camera: SceneCamera): boolean {
  return isPlainRecord(camera) && isSculptIdentifier(camera.instanceId)
    && SCENE_CAMERA_KINDS.includes(camera.kind)
    && Number.isFinite(camera.fovDegrees) && camera.fovDegrees > 0 && camera.fovDegrees < 180
    && Number.isFinite(camera.orthoSize) && camera.orthoSize > 0
    && Number.isFinite(camera.near) && camera.near > 0
    && Number.isFinite(camera.far) && camera.far > camera.near
    && (camera.active === true || camera.active === false);
}

export function emptySceneCamerasCatalog(): SceneCamerasCatalog {
  return Object.freeze({ schemaVersion: 1, kind: SCENE_CAMERAS_CATALOG_KIND, cameras: Object.freeze([]) });
}

export function parseSceneCamerasCatalog(value: JsonValue | undefined): SceneCamerasCatalog | null {
  if (value === undefined || value === null) return emptySceneCamerasCatalog();

  if (!isPlainRecord(value)) return null;

  // SAFETY: this boundary validates the version, array and every camera before returning it.
  const catalog = value as Partial<SceneCamerasCatalog>;

  if (catalog.schemaVersion !== 1 || catalog.kind !== SCENE_CAMERAS_CATALOG_KIND
    || !Array.isArray(catalog.cameras) || !catalog.cameras.every(validCamera)
    || new Set(catalog.cameras.map((camera) => camera.instanceId)).size !== catalog.cameras.length
    || catalog.cameras.filter((camera) => camera.active).length > 1) return null;

  return Object.freeze({ schemaVersion: 1, kind: SCENE_CAMERAS_CATALOG_KIND,
    cameras: Object.freeze(catalog.cameras.map((camera) => Object.freeze({ ...camera }))) });
}

export function applySceneCamerasMutation(input: Readonly<{
  catalog: SceneCamerasCatalog;
  mutation: SceneCamerasMutation;
  instanceIds: readonly string[];
  profile?: "game" | "web" | "kids";
}>): Readonly<{ ok: true; catalog: SceneCamerasCatalog }> | Failure {
  if (input.profile === "kids") return fail(SCENE_CAMERAS_REFUSALS.kidsDenied, "Kids refuses camera authoring.");

  const catalog = parseSceneCamerasCatalog(input.catalog);

  if (!catalog) return fail(SCENE_CAMERAS_REFUSALS.catalogInvalid, "The camera catalog is invalid.");

  const mutation = input.mutation;
  const instanceId = mutation.kind === "remove" ? mutation.instanceId : mutation.camera.instanceId;

  if (!isSculptIdentifier(instanceId)) return fail(SCENE_CAMERAS_REFUSALS.inputUnsupported, "A camera requires a lowercase instance id.");

  if (!input.instanceIds.includes(instanceId)) return fail(SCENE_CAMERAS_REFUSALS.targetMissing, "The camera carrier is absent from the hierarchy.");

  const cameras = catalog.cameras.filter((camera) => camera.instanceId !== instanceId);

  if (mutation.kind === "upsert") {
    if (!validCamera(mutation.camera)) return fail(SCENE_CAMERAS_REFUSALS.inputUnsupported, "Camera projection requires valid finite ranges and far > near > 0.");

    if (mutation.camera.active && cameras.some((camera) => camera.active)) return fail(SCENE_CAMERAS_REFUSALS.activeConflict, "A scene admits at most one active camera.");

    cameras.push(Object.freeze({ ...mutation.camera }));
  }

  return Object.freeze({ ok: true, catalog: Object.freeze({ ...catalog, cameras: Object.freeze(cameras) }) });
}

export function sceneCamerasCatalogDigest(catalog: SceneCamerasCatalog): string {
  return digestSculptJson(catalog);
}

export function inspectSceneCameras(catalog: SceneCamerasCatalog) {
  return Object.freeze({ schemaVersion: 1, kind: "sceneaxi.scene-cameras-inspection", catalog,
    digest: sceneCamerasCatalogDigest(catalog), savedBytesWritten: false as const });
}
