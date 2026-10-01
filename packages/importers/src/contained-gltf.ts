/**
 * Offline, contained glTF 2.0 ingestion.
 *
 * The accepted bytes remain canonical in the Scene Document. The file under
 * `assets/` is a deterministic project-owned copy that can be restored from
 * that manifest after an interrupted materialization. No path, credential,
 * provider response, or network location is persisted.
 */
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import {
  type Stats,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import {
  composeScene,
  contentHash,
  parseDocumentText,
  propose,
  reconstructSculpt,
  type JsonObject,
  type JsonValue,
  type Proposal,
} from "@sceneaxi/authoring-core";
import {
  COMPOSED_SCENE_DOCUMENT_DATA_KEY,
  COMPOSED_SCENE_KIND,
  DOCUMENT_KIND,
  OBJECT_SCULPT_SPEC_KIND,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  SCENE_MAXIMUM_INSTANCES,
  SCULPT_ARTIFACT_KIND,
  SCULPT_INTAKE_KIND,
  SCULPT_SCHEMA_VERSION,
  composedSceneFromDocumentData,
  identitySculptTransform,
  isJsonObject,
  parseUnambiguousJson,
  validateComposedScene,
  validateDocument,
  validateSculptArtifact,
  validateSculptIntake,
  type ComposedScene,
  type AssetRenderMesh,
  type BaseColorTexture,
  type SculptArtifact,
  type SculptTransform,
  type GltfAnimationChannel,
  type GltfAnimationClip,
} from "@sceneaxi/schemas";

export const CONTAINED_GLTF_PROFILE_ID =
  "sceneaxi.gltf-contained-triangles-v1" as const;

export const PROJECT_ASSET_MANIFEST_KEY = "assetManifest" as const;

export const PROJECT_ASSET_MANIFEST_KIND =
  "sceneaxi.project-asset-manifest" as const;

export const PROJECT_ASSET_MANIFEST_SCHEMA_VERSION = 2 as const;

export const LEGACY_PROJECT_ASSET_MANIFEST_SCHEMA_VERSION = 1 as const;

export const PROJECT_ASSET_COPY_POLICY = "copy" as const;

export const PROJECT_ASSET_MAX_BYTES = 8 * 1024 * 1024;

export const PROJECT_ASSET_MAX_COUNT = 16;

export const PROJECT_ASSET_DIRECTORY = "assets" as const;

export const PROJECT_ASSET_SUPPORTED_PROFILES = Object.freeze(["game", "web"] as const);

export const PROJECT_ASSET_PROFILES = Object.freeze({
  sceneaxi: "sceneaxi.artifact-json-v1",
  model: CONTAINED_GLTF_PROFILE_ID,
  image: "sceneaxi.image-raster-v1",
  audio: "sceneaxi.audio-contained-v1",
  font: "sceneaxi.font-contained-v1",
  animation: "sceneaxi.animation-data-json-v1",
} as const);

export type ProjectAssetFamily = keyof typeof PROJECT_ASSET_PROFILES;

export type ProjectAssetProfile = (typeof PROJECT_ASSET_PROFILES)[ProjectAssetFamily];

export const CONTAINED_GLTF_REFUSALS = Object.freeze({
  requestMalformed: "ASSET_IMPORT_REQUEST_MALFORMED",
  projectRootInvalid: "ASSET_IMPORT_PROJECT_ROOT_INVALID",
  documentOutsideRoot: "ASSET_IMPORT_DOCUMENT_OUTSIDE_ROOT",
  sourcePathInvalid: "ASSET_IMPORT_SOURCE_PATH_INVALID",
  sourceUnreadable: "ASSET_IMPORT_SOURCE_UNREADABLE",
  sourceSymlink: "ASSET_IMPORT_SOURCE_SYMLINK",
  unsupportedFormat: "ASSET_IMPORT_FORMAT_UNSUPPORTED",
  oversize: "ASSET_IMPORT_OVERSIZE",
  malformed: "ASSET_IMPORT_MALFORMED",
  notContained: "ASSET_IMPORT_NOT_CONTAINED",
  manifestInvalid: "ASSET_IMPORT_MANIFEST_INVALID",
  duplicatePath: "ASSET_IMPORT_DUPLICATE_PATH",
  duplicateContent: "ASSET_IMPORT_DUPLICATE_CONTENT",
  identityConflict: "ASSET_IMPORT_IDENTITY_CONFLICT",
  assetLimit: "ASSET_IMPORT_ASSET_LIMIT",
  sceneInvalid: "ASSET_IMPORT_SCENE_INVALID",
  sceneLimit: "ASSET_IMPORT_SCENE_LIMIT",
  destinationEscape: "ASSET_IMPORT_DESTINATION_ESCAPE",
  destinationSymlink: "ASSET_IMPORT_DESTINATION_SYMLINK",
  destinationConflict: "ASSET_IMPORT_DESTINATION_CONFLICT",
  proposalRefused: "ASSET_IMPORT_PROPOSAL_REFUSED",
  copyFailed: "ASSET_IMPORT_COPY_FAILED",
  sourceUnchanged: "ASSET_HOT_RELOAD_SOURCE_UNCHANGED",
  familyChanged: "ASSET_HOT_RELOAD_FAMILY_CHANGED",
  projectCopyChanged: "ASSET_HOT_RELOAD_PROJECT_COPY_CHANGED",
} as const);

export type ContainedGltfRefusal =
  (typeof CONTAINED_GLTF_REFUSALS)[keyof typeof CONTAINED_GLTF_REFUSALS];

export type ImportedAssetRenderMesh = AssetRenderMesh;

type AssetStageRequest = { -readonly [Key in keyof Parameters<typeof stageProjectAssetImport>[0]]: Parameters<typeof stageProjectAssetImport>[0][Key] };

type MutableRenderMesh = { -readonly [Key in keyof ImportedAssetRenderMesh]: ImportedAssetRenderMesh[Key] };

export type ProjectAssetPreview = Readonly<{
  kind: "metadata";
  label: string;
  properties: Readonly<Record<string, string | number | boolean>>;
}>;

export type ProjectAssetManifestEntry = Readonly<{
  assetId: string;
  sourceName: string;
  relativePath: string;
  family: ProjectAssetFamily;
  mediaType: string;
  byteLength: number;
  digest: string;
  canonicalBytesBase64: string;
  copyPolicy: typeof PROJECT_ASSET_COPY_POLICY;
  profile: ProjectAssetProfile;
  supportedProfiles: typeof PROJECT_ASSET_SUPPORTED_PROFILES;
  artifactId: string | null;
  instanceId: string | null;
  validation: Readonly<{
    status: "validated";
    validator: ProjectAssetProfile;
    replacesDigest: string | null;
  }>;
  preview: ProjectAssetPreview;
  provenance: Readonly<{
    importer: "@sceneaxi/importers";
    importerVersion: 2;
    sourceDigest: string;
    formatVersion: string;
    contained: true;
  }>;
}>;

export type ProjectAssetManifest = Readonly<{
  schemaVersion: typeof PROJECT_ASSET_MANIFEST_SCHEMA_VERSION;
  kind: typeof PROJECT_ASSET_MANIFEST_KIND;
  assets: readonly ProjectAssetManifestEntry[];
}>;

export type ContainedGltfNode = Readonly<{ node: number; parent: number | null; matrix: readonly number[]; matrixAuthored: boolean; translation: readonly number[]; rotation: readonly number[]; scale: readonly number[] }>;

export type ContainedGltfProjection = Readonly<{
  entry: ProjectAssetManifestEntry & Readonly<{
    family: "model";
    mediaType: "model/gltf-binary" | "model/gltf+json";
    profile: typeof CONTAINED_GLTF_PROFILE_ID;
    artifactId: string;
    instanceId: string;
  }>;
  meshes: readonly ImportedAssetRenderMesh[];
  nodes: readonly ContainedGltfNode[];
  animations: readonly GltfAnimationClip[];
  bounds: Readonly<{
    minimum: readonly [number, number, number];
    maximum: readonly [number, number, number];
  }>;
}>;

export type ProjectAssetProjection =
  | ContainedGltfProjection
  | Readonly<{ entry: ProjectAssetManifestEntry; preview: ProjectAssetPreview }>;

export type ContainedGltfStageResult =
  | Readonly<{
      ok: true;
      replayed: boolean;
      entry: ProjectAssetManifestEntry;
      projection: ContainedGltfProjection;
      edit: Readonly<{
        documentPath: string;
        jsonPointer: "/data";
        expectedContentHash: string;
        newValue: JsonObject;
      }> | null;
    }>
  | Readonly<{
      ok: false;
      reason: ContainedGltfRefusal;
      message: string;
    }>;

export type ProjectAssetStageResult =
  | Readonly<{
      ok: true;
      replayed: boolean;
      hotReload: boolean;
      entry: ProjectAssetManifestEntry;
      projection: ProjectAssetProjection;
      edit: Readonly<{
        documentPath: string;
        jsonPointer: "/data";
        expectedContentHash: string;
        newValue: JsonObject;
      }> | null;
    }>
  | Readonly<{ ok: false; reason: ContainedGltfRefusal; message: string }>;

export type ContainedGltfProposalResult =
  | Readonly<{
      ok: true;
      replayed: boolean;
      entry: ProjectAssetManifestEntry;
      projection: ContainedGltfProjection;
      proposal: Proposal | null;
      unifiedDiff: string;
    }>
  | Extract<ContainedGltfStageResult, { readonly ok: false }>;

export type ProjectAssetProposalResult =
  | Readonly<{
      ok: true;
      replayed: boolean;
      hotReload: boolean;
      entry: ProjectAssetManifestEntry;
      projection: ProjectAssetProjection;
      proposal: Proposal | null;
      unifiedDiff: string;
    }>
  | Extract<ContainedGltfStageResult, { readonly ok: false }>;

export type MaterializeAssetCopiesResult =
  | Readonly<{
      ok: true;
      copiedPaths: readonly string[];
      existingPaths: readonly string[];
    }>
  | Readonly<{
      ok: false;
      reason: ContainedGltfRefusal;
      message: string;
    }>;

type ParsedGltf = Readonly<{
  mediaType: "model/gltf-binary" | "model/gltf+json";
  meshes: readonly ImportedAssetRenderMesh[];
  nodes: readonly ContainedGltfNode[];
  bounds: ContainedGltfProjection["bounds"];
  animations: readonly GltfAnimationClip[];
}>;

type ParsedAsset = Readonly<{
  family: ProjectAssetFamily;
  mediaType: string;
  profile: ProjectAssetProfile;
  formatVersion: string;
  extension: string;
  preview: ProjectAssetPreview;
  gltf: ParsedGltf | null;
}>;

type Refusal = Extract<ContainedGltfStageResult, { readonly ok: false }>;

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const BASE64_INVALID_CHARACTER_RE = /[^A-Za-z0-9+/=]/;

const GLB_MAGIC = 0x46546c67;

const GLB_JSON_CHUNK = 0x4e4f534a;

const GLB_BIN_CHUNK = 0x004e4942;

const GLTF_JSON_MAXIMUM_DEPTH = 64;

const GLTF_MAXIMUM_VERTICES = 250_000;

const GLTF_MAXIMUM_TRIANGLES = 250_000;

// Flat JSON can encode a deep graph. Bound work independently of JSON depth.
const GLTF_MAXIMUM_NODES = 4096;

const GLTF_MAXIMUM_NODE_DEPTH = 256;

const GLTF_MAXIMUM_NODE_OPERATIONS = 8192;

const PROJECT_ASSET_MANIFEST_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "assets",
]);

const PROJECT_ASSET_MANIFEST_ENTRY_KEYS = Object.freeze([
  "assetId",
  "sourceName",
  "relativePath",
  "family",
  "mediaType",
  "byteLength",
  "digest",
  "canonicalBytesBase64",
  "copyPolicy",
  "profile",
  "supportedProfiles",
  "artifactId",
  "instanceId",
  "validation",
  "preview",
  "provenance",
]);

const LEGACY_PROJECT_ASSET_MANIFEST_ENTRY_KEYS = Object.freeze([
  "assetId", "sourceName", "relativePath", "mediaType", "byteLength", "digest",
  "canonicalBytesBase64", "copyPolicy", "profile", "artifactId", "instanceId", "provenance",
]);

const PROJECT_ASSET_PROVENANCE_KEYS = Object.freeze([
  "importer",
  "importerVersion",
  "sourceDigest",
  "formatVersion",
  "contained",
]);

const PROJECT_ASSET_VALIDATION_KEYS = Object.freeze(["status", "validator", "replacesDigest"]);

const PROJECT_ASSET_PREVIEW_KEYS = Object.freeze(["kind", "label", "properties"]);

function refuse(reason: ContainedGltfRefusal, message: string): Refusal {
  return Object.freeze({ ok: false as const, reason, message });
}

function sha256(bytes: Uint8Array) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

type AssetJsonValue = JsonValue | undefined;

function own(value: AssetJsonValue, key: string): AssetJsonValue {
  if (!isObjectRepresentation(value) || value === null || Array.isArray(value)) {
    return undefined;
  }

  const descriptor = Object.getOwnPropertyDescriptor(value, key);

  return descriptor !== undefined && "value" in descriptor
    ? descriptor.value
    : undefined;
}

function plainRecord(value: AssetJsonValue): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype: object | null = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: JsonObject,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);

  return keys.length === expected.length &&
    keys.every((key) => expected.includes(key));
}

function finiteNumber(value: AssetJsonValue): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonNegativeInteger(value: AssetJsonValue): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function contained(parent: string, child: string): boolean {
  const rel = relative(parent, child);

  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function canonicalExistingDirectory(path: string): string | null {
  try {
    if (!isAbsolute(path) || path.includes("\0")) return null;
    const real = realpathSync(path);

    return statSync(real).isDirectory() ? real : null;
  } catch {
    return null;
  }
}

function canonicalTarget(path: string): string | null {
  const missing: string[] = [];
  let cursor = resolve(path);

  for (;;) {
    try {
      return resolve(realpathSync(cursor), ...missing);
    } catch {
      const parent = dirname(cursor);

      if (parent === cursor) return null;
      missing.unshift(basename(cursor));
      cursor = parent;
    }
  }
}

function decodeBase64(value: string): Uint8Array | null {
  // Repeated-group regexes exhaust the native regexp stack for admitted 8 MiB
  // payloads. Length/alphabet preflight plus the exact roundtrip below retains
  // strict canonical padding validation without recursive matching.
  if (value.length % 4 !== 0 || value.length > Math.ceil(PROJECT_ASSET_MAX_BYTES / 3) * 4 || BASE64_INVALID_CHARACTER_RE.test(value)) return null;

  try {
    const bytes = Buffer.from(value, "base64");

    return bytes.toString("base64") === value
      ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : null;
  } catch {
    return null;
  }
}

function dataUriBytes(uri: string): Uint8Array | null {
  const match = /^data:(?:application\/(?:octet-stream|gltf-buffer));base64,([A-Za-z0-9+/]*={0,2})$/.exec(
    uri,
  );

  return match?.[1] === undefined ? null : decodeBase64(match[1]);
}

function jsonDepth(value: AssetJsonValue, depth = 0): number {
  if (depth > GLTF_JSON_MAXIMUM_DEPTH) return depth;

  if (!isObjectRepresentation(value) || value === null) return depth;
  const children = Array.isArray(value) ? value : Object.values(value);

  return children.reduce(
    (maximum, child) => Math.max(maximum, jsonDepth(child, depth + 1)),
    depth,
  );
}

function parseJsonBytes(bytes: Uint8Array): JsonObject | null {
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);

    while (text.endsWith(" ") || text.endsWith(String.fromCharCode(0))) text = text.slice(0, -1);
  } catch {
    return null;
  }

  const unambiguous = parseUnambiguousJson(text);

  if (!unambiguous.ok) return null;
  let decoded: JsonValue;

  try {
    decoded = JSON.parse(text);
  } catch {
    return null;
  }

  return plainRecord(decoded) && jsonDepth(decoded) <= GLTF_JSON_MAXIMUM_DEPTH
    ? decoded
    : null;
}

function metadataPreview(
  label: string,
  properties: Readonly<Record<string, string | number | boolean>>,
): ProjectAssetPreview {
  return Object.freeze({ kind: "metadata" as const, label, properties: Object.freeze(properties) });
}

function uint32Big(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function uint32Little(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function parseImage(bytes: Uint8Array, extension: string): ParsedAsset | Refusal {
  let mediaType: string;
  let width = 0;
  let height = 0;

  if (extension === ".png") {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];

    if (
      bytes.byteLength < 45 ||
      !signature.every((value, index) => bytes[index] === value) ||
      uint32Big(bytes, 8) !== 13 || ascii(bytes, 12, 4) !== "IHDR" ||
      ascii(bytes, bytes.byteLength - 8, 4) !== "IEND"
    ) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The PNG signature, IHDR, or terminal IEND chunk is invalid.");
    width = uint32Big(bytes, 16);
    height = uint32Big(bytes, 20);
    mediaType = "image/png";
  } else if (extension === ".jpg" || extension === ".jpeg") {
    if (bytes.byteLength < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The JPEG start or end marker is invalid.");
    }

    let offset = 2;

    while (offset + 9 < bytes.byteLength - 2) {
      if (bytes[offset] !== 0xff) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The JPEG marker stream is invalid.");
      const marker = bytes[offset + 1] ?? 0;

      if (marker === 0xda) break;
      const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);

      if (length < 2 || offset + 2 + length > bytes.byteLength) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "A JPEG segment has invalid bounds.");

      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 7) {
        height = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
        width = ((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0);
        break;
      }

      offset += 2 + length;
    }

    mediaType = "image/jpeg";
  } else if (extension === ".webp") {
    if (bytes.byteLength < 30 || ascii(bytes, 0, 4) !== "RIFF" || uint32Little(bytes, 4) + 8 !== bytes.byteLength || ascii(bytes, 8, 4) !== "WEBP" || ascii(bytes, 12, 4) !== "VP8X") {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The bounded WebP profile requires one valid RIFF/WEBP VP8X header.");
    }

    width = 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16);
    height = 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16);
    mediaType = "image/webp";
  } else {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Supported raster images are PNG, JPEG, and WebP; stored SVG/markup is not admitted.");
  }

  if (width <= 0 || height <= 0 || width > 16_384 || height > 16_384) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The image dimensions are absent or outside the bounded 16384×16384 profile.");
  }

  return Object.freeze({
    family: "image" as const,
    mediaType,
    profile: PROJECT_ASSET_PROFILES.image,
    formatVersion: "raster-v1",
    extension: extension === ".jpeg" ? "jpg" : extension.slice(1),
    preview: metadataPreview(`${String(width)} × ${String(height)}`, { width, height }),
    gltf: null,
  });
}

function parseAudio(bytes: Uint8Array, extension: string): ParsedAsset | Refusal {
  let mediaType: string;
  let label: string;
  const properties: Record<string, string | number | boolean> = {};

  if (extension === ".wav") {
    if (bytes.byteLength < 44 || ascii(bytes, 0, 4) !== "RIFF" || uint32Little(bytes, 4) + 8 !== bytes.byteLength || ascii(bytes, 8, 4) !== "WAVE") {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The WAV RIFF header or declared length is invalid.");
    }

    let offset = 12;
    let dataBytes = -1;
    let channels = 0;
    let sampleRate = 0;
    let byteRate = 0;

    while (offset + 8 <= bytes.byteLength) {
      const kind = ascii(bytes, offset, 4);
      const length = uint32Little(bytes, offset + 4);
      const end = offset + 8 + length;

      if (end > bytes.byteLength) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "A WAV chunk has invalid bounds.");

      if (kind === "fmt " && length >= 16) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset + 8, length);
        channels = view.getUint16(2, true);
        sampleRate = view.getUint32(4, true);
        byteRate = view.getUint32(8, true);
      }

      if (kind === "data") dataBytes = length;
      offset = end + (length % 2);
    }

    if (channels < 1 || channels > 8 || sampleRate < 8_000 || sampleRate > 192_000 || byteRate <= 0 || dataBytes < 0) {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The WAV format/data chunks are absent or outside the bounded audio profile.");
    }

    const durationMs = Math.floor((dataBytes / byteRate) * 1000);
    Object.assign(properties, { channels, sampleRate, durationMs });
    label = `${String(channels)} ch · ${String(sampleRate)} Hz · ${String(durationMs)} ms`;
    mediaType = "audio/wav";
  } else if (extension === ".ogg") {
    if (bytes.byteLength < 27 || ascii(bytes, 0, 4) !== "OggS" || bytes[4] !== 0 || 27 + (bytes[26] ?? 0) > bytes.byteLength) {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The Ogg page header or segment table is invalid.");
    }

    mediaType = "audio/ogg";
    label = "Validated Ogg container";
    properties.container = "ogg";
  } else if (extension === ".mp3") {
    const id3 = bytes.byteLength >= 10 && ascii(bytes, 0, 3) === "ID3";
    const frame = bytes.byteLength >= 4 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;

    if (!id3 && !frame) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The MP3 has neither a valid ID3 header nor MPEG audio frame sync.");
    mediaType = "audio/mpeg";
    label = "Validated MPEG audio";
    properties.container = "mpeg-audio";
  } else {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Supported audio formats are WAV, Ogg, and MP3.");
  }

  return Object.freeze({ family: "audio" as const, mediaType, profile: PROJECT_ASSET_PROFILES.audio, formatVersion: "audio-v1", extension: extension.slice(1), preview: metadataPreview(label, properties), gltf: null });
}

function parseFont(bytes: Uint8Array, extension: string): ParsedAsset | Refusal {
  const tag = bytes.byteLength >= 4 ? ascii(bytes, 0, 4) : "";
  let mediaType: string;
  let flavor: string;
  let tables: number;

  if (extension === ".woff2") {
    if (bytes.byteLength < 48 || tag !== "wOF2" || uint32Big(bytes, 8) !== bytes.byteLength) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The WOFF2 header or declared length is invalid.");
    tables = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(12, false);
    mediaType = "font/woff2";
    flavor = "woff2";
  } else if (extension === ".woff") {
    if (bytes.byteLength < 44 || tag !== "wOFF" || uint32Big(bytes, 8) !== bytes.byteLength) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The WOFF header or declared length is invalid.");
    tables = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(12, false);
    mediaType = "font/woff";
    flavor = "woff";
  } else if (extension === ".ttf" || extension === ".otf") {
    const scalar = uint32Big(bytes, 0);

    if (bytes.byteLength < 12 || (scalar !== 0x00010000 && tag !== "OTTO" && tag !== "true")) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The OpenType/TrueType sfnt header is invalid.");
    tables = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(4, false);

    if (12 + tables * 16 > bytes.byteLength) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The font table directory exceeds the admitted bytes.");
    mediaType = extension === ".otf" ? "font/otf" : "font/ttf";
    flavor = extension.slice(1);
  } else {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Supported fonts are WOFF2, WOFF, TTF, and OTF.");
  }

  if (tables <= 0 || tables > 4096) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The font table count is absent or outside the bounded profile.");

  return Object.freeze({ family: "font" as const, mediaType, profile: PROJECT_ASSET_PROFILES.font, formatVersion: "font-v1", extension: extension.slice(1), preview: metadataPreview(`${flavor.toUpperCase()} · ${String(tables)} tables`, { flavor, tables }), gltf: null });
}

function parseJsonAsset(bytes: Uint8Array, sourceName: string): ParsedAsset | Refusal {
  const value = parseJsonBytes(bytes);

  if (value === null) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The JSON asset is not unambiguous bounded UTF-8 JSON.");
  const kind = value["kind"];

  if (kind === "sceneaxi.animation-data") {
    const clips = value["clips"];

    if (value["schemaVersion"] !== 1 || !Array.isArray(clips) || clips.length > 256 || !clips.every((clip) => plainRecord(clip) && isText(clip["id"]) && ID_RE.test(clip["id"]) && finiteNumber(clip["durationMs"]) && clip["durationMs"] >= 0 && Array.isArray(clip["tracks"]))) {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "Animation data must be schema v1 with bounded id, durationMs, and tracks metadata.");
    }

    return Object.freeze({ family: "animation" as const, mediaType: "application/vnd.sceneaxi.animation+json", profile: PROJECT_ASSET_PROFILES.animation, formatVersion: "1", extension: "anim.json", preview: metadataPreview(`${String(clips.length)} animation clips`, { clipCount: clips.length }), gltf: null });
  }

  let valid = false;
  let identity = "SceneAxi artifact";

  if (kind === DOCUMENT_KIND) {
    const checked = validateDocument(value);
    valid = checked.ok;
    identity = checked.ok ? checked.document.id : identity;
  } else if (kind === SCULPT_ARTIFACT_KIND) {
    const checked = validateSculptArtifact(value);
    valid = checked.ok;
    identity = checked.ok ? checked.value.artifactId : identity;
  } else if (kind === SCULPT_INTAKE_KIND) {
    const checked = validateSculptIntake(value);
    valid = checked.ok;
    identity = checked.ok ? checked.value.intakeId : identity;
  } else if (kind === COMPOSED_SCENE_KIND) {
    const checked = validateComposedScene(value);
    valid = checked.ok;
    identity = checked.ok ? checked.value.sceneId : identity;
  }

  if (!valid || !isText(kind)) {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, `JSON asset ${JSON.stringify(sourceName)} is not one of the admitted SceneAxi document, sculpt, or composed-scene artifacts, or animation-data v1.`);
  }

  return Object.freeze({ family: "sceneaxi" as const, mediaType: "application/vnd.sceneaxi.artifact+json", profile: PROJECT_ASSET_PROFILES.sceneaxi, formatVersion: "1", extension: "sceneaxi.json", preview: metadataPreview(`${kind} · ${identity}`, { artifactKind: kind, identity }), gltf: null });
}

function parseAsset(bytes: Uint8Array, sourceName: string): ParsedAsset | Refusal {
  if (bytes.byteLength === 0 || bytes.byteLength > PROJECT_ASSET_MAX_BYTES) {
    return refuse(bytes.byteLength > PROJECT_ASSET_MAX_BYTES ? CONTAINED_GLTF_REFUSALS.oversize : CONTAINED_GLTF_REFUSALS.malformed, bytes.byteLength > PROJECT_ASSET_MAX_BYTES ? `Asset bytes exceed the ${String(PROJECT_ASSET_MAX_BYTES)} byte v1 limit.` : "An empty asset is not admitted.");
  }

  const extension = extname(sourceName).toLowerCase();

  if (extension === ".glb" || extension === ".gltf") {
    const gltf = parseGltf(bytes, sourceName);

    if ("ok" in gltf) return gltf;

    return Object.freeze({ family: "model" as const, mediaType: gltf.mediaType, profile: PROJECT_ASSET_PROFILES.model, formatVersion: "2.0", extension: extension.slice(1), preview: metadataPreview(`${String(gltf.meshes.length)} meshes`, { meshCount: gltf.meshes.length, minimum: gltf.bounds.minimum.join(","), maximum: gltf.bounds.maximum.join(",") }), gltf });
  }

  if ([".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(extension)) return parseImage(bytes, extension);

  if ([".wav", ".ogg", ".mp3", ".flac"].includes(extension)) return parseAudio(bytes, extension);

  if ([".woff2", ".woff", ".ttf", ".otf", ".eot"].includes(extension)) return parseFont(bytes, extension);

  if (extension === ".json" || sourceName.toLowerCase().endsWith(".anim.json") || sourceName.toLowerCase().endsWith(".sceneaxi.json")) return parseJsonAsset(bytes, sourceName);

  return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "The asset format is unsupported; admitted families are SceneAxi JSON, contained glTF/GLB, PNG/JPEG/WebP, WAV/Ogg/MP3, WOFF2/WOFF/TTF/OTF, and animation-data JSON.");
}

function parseContainer(
  bytes: Uint8Array,
  sourceName: string,
):
  | Readonly<{
      ok: true;
      mediaType: "model/gltf-binary" | "model/gltf+json";
      json: JsonObject;
      binaryChunk: Uint8Array | null;
    }>
  | Refusal {
  const extension = extname(sourceName).toLowerCase();

  if (extension !== ".glb" && extension !== ".gltf") {
    return refuse(
      CONTAINED_GLTF_REFUSALS.unsupportedFormat,
      "Only .glb and .gltf files in the contained glTF 2.0 profile are supported.",
    );
  }

  if (bytes.byteLength === 0 || bytes.byteLength > PROJECT_ASSET_MAX_BYTES) {
    return refuse(
      bytes.byteLength > PROJECT_ASSET_MAX_BYTES
        ? CONTAINED_GLTF_REFUSALS.oversize
        : CONTAINED_GLTF_REFUSALS.malformed,
      bytes.byteLength > PROJECT_ASSET_MAX_BYTES
        ? `Asset bytes exceed the ${String(PROJECT_ASSET_MAX_BYTES)} byte v1 limit.`
        : "An empty asset is not a glTF document.",
    );
  }

  if (extension === ".gltf") {
    const json = parseJsonBytes(bytes);

    return json === null
      ? refuse(CONTAINED_GLTF_REFUSALS.malformed, "The .gltf file is not unambiguous UTF-8 JSON.")
      : Object.freeze({
          ok: true as const,
          mediaType: "model/gltf+json" as const,
          json,
          binaryChunk: null,
        });
  }

  if (bytes.byteLength < 20) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The GLB header is truncated.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== 2) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The GLB magic or version is invalid.");
  }

  if (view.getUint32(8, true) !== bytes.byteLength) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The GLB declared length does not match its bytes.");
  }

  let offset = 12;
  let json: JsonObject | null = null;
  let binaryChunk: Uint8Array | null = null;

  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The GLB chunk header is truncated.");
    }

    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    offset += 8;

    if (length % 4 !== 0 || offset + length > bytes.byteLength) {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "A GLB chunk has invalid bounds or padding.");
    }

    const chunk = bytes.subarray(offset, offset + length);
    offset += length;

    if (json === null) {
      if (type !== GLB_JSON_CHUNK) {
        return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The first GLB chunk must be JSON.");
      }

      json = parseJsonBytes(chunk);

      if (json === null) {
        return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The GLB JSON chunk is invalid.");
      }
    } else if (type === GLB_BIN_CHUNK && binaryChunk === null) {
      binaryChunk = chunk;
    } else {
      return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "The contained GLB profile allows one JSON chunk and at most one BIN chunk.");
    }
  }

  return json === null
    ? refuse(CONTAINED_GLTF_REFUSALS.malformed, "The GLB contains no JSON chunk.")
    : Object.freeze({
        ok: true as const,
        mediaType: "model/gltf-binary" as const,
        json,
        binaryChunk,
      });
}

type Matrix4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

const IDENTITY_MATRIX: Matrix4 = Object.freeze([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

function numberAt(values: readonly number[], index: number): number {
  const value = values[index];

  if (value === undefined) throw new Error("A previously validated numeric tuple became incomplete.");

  return value;
}

function multiplyMatrix(left: Matrix4, right: Matrix4): Matrix4 {
  const out = Array.from({ length: 16 }, () => 0);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;

      for (let index = 0; index < 4; index += 1) {
        value += numberAt(left, index * 4 + row) * numberAt(right, column * 4 + index);
      }

      out[column * 4 + row] = value;
    }
  }

  // SAFETY: The output starts with 16 numeric elements and the bounded 4-by-4 loops fill exactly those elements.
  return Object.freeze(out) as Matrix4;
}

function vector(value: AssetJsonValue, length: number, fallback: readonly number[]): readonly number[] | null {
  if (value === undefined) return fallback;

  return Array.isArray(value) && value.length === length && value.every(finiteNumber)
    ? value
    : null;
}

function matrixForNode(node: JsonObject): Matrix4 | null {
  if (node["matrix"] !== undefined) {
    const matrix = vector(node["matrix"], 16, IDENTITY_MATRIX);

    // SAFETY: vector above validated exactly 16 finite numbers; copying and freezing preserves their order and length.
    return matrix === null ? null : (Object.freeze([...matrix]) as Matrix4);
  }

  const translation = vector(node["translation"], 3, [0, 0, 0]);
  const rotation = vector(node["rotation"], 4, [0, 0, 0, 1]);
  const scale = vector(node["scale"], 3, [1, 1, 1]);

  if (translation === null || rotation === null || scale === null) return null;
  const x = numberAt(rotation, 0);
  const y = numberAt(rotation, 1);
  const z = numberAt(rotation, 2);
  const w = numberAt(rotation, 3);
  const length = Math.hypot(x, y, z, w);

  if (!Number.isFinite(length) || Math.abs(length - 1) > 0.0001) return null;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  // SAFETY: This literal lists exactly 16 numeric matrix components computed from the validated TRS tuples.
  return Object.freeze([
    (1 - (yy + zz)) * numberAt(scale, 0),
    (xy + wz) * numberAt(scale, 0),
    (xz - wy) * numberAt(scale, 0),
    0,
    (xy - wz) * numberAt(scale, 1),
    (1 - (xx + zz)) * numberAt(scale, 1),
    (yz + wx) * numberAt(scale, 1),
    0,
    (xz + wy) * numberAt(scale, 2),
    (yz - wx) * numberAt(scale, 2),
    (1 - (xx + yy)) * numberAt(scale, 2),
    0,
    numberAt(translation, 0),
    numberAt(translation, 1),
    numberAt(translation, 2),
    1,
  ]) as Matrix4;
}

function transformPosition(matrix: Matrix4, x: number, y: number, z: number) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ] as const;
}

function colorHex(value: AssetJsonValue): string {
  if (value === undefined) return "#ffffff";

  if (!Array.isArray(value) || value.length !== 4 || !value.every(finiteNumber)) {
    return "#b8c4d8";
  }

  const channel = (number: number) => Math.round(Math.min(1, Math.max(0, number)) * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${channel(numberAt(value, 0))}${channel(numberAt(value, 1))}${channel(numberAt(value, 2))}`;
}

type AccessorContext = Readonly<{
  accessors: readonly JsonValue[];
  bufferViews: readonly JsonValue[];
  buffers: readonly Uint8Array[];
}>;

function accessorValues(
  context: AccessorContext,
  index: AssetJsonValue,
  expectedType: "SCALAR" | "VEC2" | "VEC3" | "VEC4",
  allowedComponents: readonly number[],
): readonly number[] | null {
  if (!nonNegativeInteger(index)) return null;
  const accessor = context.accessors[index];

  if (!plainRecord(accessor) || accessor["type"] !== expectedType) return null;
  const componentType = accessor["componentType"];
  const count = accessor["count"];
  const bufferViewIndex = accessor["bufferView"];

  if (
    !allowedComponents.includes(Number(componentType)) ||
    !nonNegativeInteger(count) ||
    count === 0 ||
    count > GLTF_MAXIMUM_VERTICES ||
    !nonNegativeInteger(bufferViewIndex) ||
    accessor["sparse"] !== undefined ||
    accessor["normalized"] === true
  ) return null;
  const bufferView = context.bufferViews[bufferViewIndex];

  if (!plainRecord(bufferView) || bufferView["byteStride"] !== undefined) return null;
  const bufferIndex = bufferView["buffer"];
  const bufferOffset = bufferView["byteOffset"] ?? 0;
  const bufferLength = bufferView["byteLength"];
  const accessorOffset = accessor["byteOffset"] ?? 0;

  if (
    !nonNegativeInteger(bufferIndex) ||
    !nonNegativeInteger(bufferOffset) ||
    !nonNegativeInteger(bufferLength) ||
    !nonNegativeInteger(accessorOffset)
  ) return null;
  const source = context.buffers[bufferIndex];

  if (source === undefined || bufferOffset + bufferLength > source.byteLength) return null;
  const components = expectedType === "VEC4" ? 4 : expectedType === "VEC3" ? 3 : expectedType === "VEC2" ? 2 : 1;

  const componentBytes = componentType === 5121
    ? 1
    : componentType === 5123
      ? 2
      : 4;

  const total = count * components * componentBytes;
  const start = bufferOffset + accessorOffset;

  if (start + total > bufferOffset + bufferLength || start + total > source.byteLength) {
    return null;
  }

  const view = new DataView(source.buffer, source.byteOffset + start, total);
  const values: number[] = [];

  for (let offset = 0; offset < total; offset += componentBytes) {
    const value = componentType === 5121
      ? view.getUint8(offset)
      : componentType === 5123
        ? view.getUint16(offset, true)
        : componentType === 5125
          ? view.getUint32(offset, true)
          : view.getFloat32(offset, true);

    if (!Number.isFinite(value)) return null;
    values.push(value);
  }

  return Object.freeze(values);
}

function pngCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function decodePng(bytes: Uint8Array): BaseColorTexture | Refusal {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];

  if (bytes.byteLength < 33 || !signature.every((byte, index) => bytes[index] === byte)) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The embedded PNG signature or required chunks are invalid.");
  }

  let width = 0;
  let height = 0;
  let colorType = -1;
  let sawHeader = false;
  let sawData = false;
  let endedData = false;
  let sawEnd = false;
  const compressed: Uint8Array[] = [];

  for (let offset = 8; offset + 12 <= bytes.byteLength;) {
    const length = view.getUint32(offset, false);
    const end = offset + 12 + length;

    if (length > bytes.byteLength || end > bytes.byteLength) {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "An embedded PNG chunk exceeds its contained image bytes.");
    }

    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    const payload = bytes.subarray(offset + 8, offset + 8 + length);

    if (pngCrc32(bytes.subarray(offset + 4, offset + 8 + length)) !== view.getUint32(offset + 8 + length, false)) {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "An embedded PNG chunk has an invalid CRC.");
    }

    if (!sawHeader && type !== "IHDR") return refuse(CONTAINED_GLTF_REFUSALS.malformed, "An embedded PNG must start with IHDR.");

    if (sawData && type !== "IDAT" && type !== "IEND") endedData = true;

    if (type === "tRNS") {
      return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Embedded PNG transparency chunks are unsupported; use RGBA pixels without tRNS.");
    }

    if (["gAMA", "cHRM", "iCCP"].includes(type)) {
      return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, `Embedded PNG color-profile chunk ${type} is unsupported.`);
    }

    if (type === "IHDR") {
      if (sawHeader || length !== 13) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The embedded PNG IHDR chunk is invalid.");
      width = view.getUint32(offset + 8, false);
      height = view.getUint32(offset + 12, false);
      const bitDepth = bytes[offset + 16];
      colorType = bytes[offset + 17] ?? -1;

      if (
        width === 0 || height === 0 || width * height * 4 > 4 * 1024 * 1024 ||
        bitDepth !== 8 || (colorType !== 2 && colorType !== 6) ||
        bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20] !== 0
      ) return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Embedded PNG textures require non-interlaced 8-bit RGB or RGBA within the 4 MiB decoded limit.");
      sawHeader = true;
    } else if (type === "IDAT") {
      if (!sawHeader || sawEnd || endedData) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The embedded PNG IDAT chunks must be consecutive.");
      sawData = true;
      compressed.push(payload);
    } else if (type === "IEND") {
      if (length !== 0 || sawEnd) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The embedded PNG IEND chunk is invalid.");
      sawEnd = true;

      if (end !== bytes.byteLength) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "An embedded PNG may not contain trailing data.");
      break;
    } else if ((typeBytes[0] ?? 0) >= 65 && (typeBytes[0] ?? 0) <= 90) {
      return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, `Embedded PNG critical chunk ${type} is unsupported.`);
    }

    offset = end;
  }

  if (!sawHeader || !sawEnd || compressed.length === 0) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The embedded PNG is missing IHDR, IDAT, or IEND.");
  }

  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  const expectedBytes = (rowBytes + 1) * height;
  let raw: Buffer;

  try {
    raw = inflateSync(Buffer.concat(compressed.map((part) => Buffer.from(part))), { maxOutputLength: expectedBytes });
  } catch {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The embedded PNG compressed pixels cannot be safely decoded within the pixel limit.");
  }

  if (raw.byteLength !== expectedBytes) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The embedded PNG decoded pixel length is invalid.");
  const rgba: number[] = Array.from({ length: width * height * 4 }, () => 0);

  for (let y = 0; y < height; y += 1) {
    const inputStart = y * (rowBytes + 1);
    const filter = raw[inputStart];

    if (filter === undefined || filter > 4) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The embedded PNG uses an invalid row filter.");
    const row = inputStart + 1;

    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= channels ? raw[row + x - channels] ?? 0 : 0;
      const above = y > 0 ? raw[row - rowBytes - 1 + x] ?? 0 : 0;
      const upperLeft = y > 0 && x >= channels ? raw[row - rowBytes - 1 + x - channels] ?? 0 : 0;
      const predictor = filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : filter === 4 ? paeth(left, above, upperLeft) : 0;
      raw[row + x] = ((raw[row + x] ?? 0) + predictor) & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      const src = row + x * channels;
      const dst = (y * width + x) * 4;
      rgba[dst] = raw[src] ?? 0;
      rgba[dst + 1] = raw[src + 1] ?? 0;
      rgba[dst + 2] = raw[src + 2] ?? 0;
      rgba[dst + 3] = channels === 4 ? raw[src + 3] ?? 0 : 255;
    }
  }

  return Object.freeze({ width, height, rgba: Object.freeze(rgba) });
}

function paeth(left: number, above: number, upperLeft: number) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
    ? left
    : aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function parseGltf(bytes: Uint8Array, sourceName: string): ParsedGltf | Refusal {
  const container = parseContainer(bytes, sourceName);

  if (!container.ok) return container;
  const json = container.json;
  const asset = own(json, "asset");

  if (!plainRecord(asset) || asset["version"] !== "2.0") {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "The contained profile requires glTF asset.version 2.0.");
  }

  for (const denied of ["extensionsUsed", "extensionsRequired", "cameras"] as const) {
    const value = json[denied];

    if (value !== undefined && (!Array.isArray(value) || value.length > 0)) {
      return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, `The contained v1 profile does not support ${denied}.`);
    }
  }

  if (json["skins"] !== undefined && (!Array.isArray(json["skins"]) || json["skins"].length > 0)) {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Skinning (skins, JOINTS_0, WEIGHTS_0) is not supported by the contained profile.");
  }

  const samplers = json["samplers"];

  if (samplers !== undefined && (!Array.isArray(samplers) || samplers.length > 0)) {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "The contained texture profile does not support glTF samplers.");
  }

  const images = json["images"];
  const textures = json["textures"];

  if ((images !== undefined && !Array.isArray(images)) || (textures !== undefined && !Array.isArray(textures))) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The glTF image and texture declarations must be arrays.");
  }

  const rawBuffers = json["buffers"];
  const bufferViews = json["bufferViews"];
  const accessors = json["accessors"];
  const meshes = json["meshes"];
  const nodes = json["nodes"];
  const scenes = json["scenes"];

  if (
    !Array.isArray(rawBuffers) || rawBuffers.length !== 1 ||
    !Array.isArray(bufferViews) ||
    !Array.isArray(accessors) ||
    !Array.isArray(meshes) || meshes.length === 0 ||
    !Array.isArray(nodes) || nodes.length === 0 ||
    !Array.isArray(scenes) || scenes.length !== 1 ||
    (json["scene"] !== undefined && json["scene"] !== 0)
  ) {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "The contained v1 profile requires one buffer, one scene, and at least one node and mesh.");
  }

  if (nodes.length > GLTF_MAXIMUM_NODES) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The contained glTF scene exceeds the 4096-node resource limit.");
  }

  const buffer = rawBuffers[0];

  if (!plainRecord(buffer) || !nonNegativeInteger(buffer["byteLength"])) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The glTF buffer declaration is invalid.");
  }

  let bufferBytes: Uint8Array | null = null;
  const uri = buffer["uri"];

  if (container.mediaType === "model/gltf-binary") {
    if (uri !== undefined || container.binaryChunk === null) {
      return refuse(CONTAINED_GLTF_REFUSALS.notContained, "A contained GLB must keep its only buffer in the BIN chunk.");
    }

    bufferBytes = container.binaryChunk;
  } else if (isText(uri)) {
    bufferBytes = dataUriBytes(uri);

    if (bufferBytes === null) {
      return refuse(CONTAINED_GLTF_REFUSALS.notContained, "A contained .gltf buffer must use an embedded base64 data URI.");
    }
  }

  const declaredByteLength = buffer["byteLength"];

  if (bufferBytes === null || !isNumber(declaredByteLength) || declaredByteLength > bufferBytes.byteLength) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The declared glTF buffer exceeds its contained bytes.");
  }

  const context: AccessorContext = {
    accessors,
    bufferViews,
    buffers: Object.freeze([bufferBytes]),
  };

  const animations: GltfAnimationClip[] = [];
  const rawAnimations = json["animations"];

  if (rawAnimations !== undefined && !Array.isArray(rawAnimations)) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "glTF animations must be an array.");

  for (const [clipIndex, rawClip] of (rawAnimations ?? []).entries()) {
    if (!plainRecord(rawClip) || !Array.isArray(rawClip["samplers"]) || !Array.isArray(rawClip["channels"])) return refuse(CONTAINED_GLTF_REFUSALS.malformed, `glTF animation ${clipIndex} is malformed.`);
    const channels: GltfAnimationChannel[] = [];
    const targets = new Set<string>();
    let duration = 0;

    for (const rawChannel of rawClip["channels"]) {
      if (!plainRecord(rawChannel) || !plainRecord(rawChannel["target"]) || !nonNegativeInteger(rawChannel["sampler"])) return refuse(CONTAINED_GLTF_REFUSALS.malformed, `glTF animation ${clipIndex} has an invalid channel.`);
      const target = rawChannel["target"];
      const sampler = rawClip["samplers"][rawChannel["sampler"]];

      if (!plainRecord(sampler)) return refuse(CONTAINED_GLTF_REFUSALS.malformed, `glTF animation ${clipIndex} references an invalid sampler.`);
      const interpolation = sampler["interpolation"] ?? "LINEAR";

      if (interpolation === "CUBICSPLINE") return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "glTF CUBICSPLINE animation interpolation is not supported.");

      if (interpolation !== "LINEAR" && interpolation !== "STEP") return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, `glTF animation interpolation ${String(interpolation)} is not supported.`);
      const path = target["path"];

      if (path !== "translation" && path !== "rotation" && path !== "scale") return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, `glTF animation target path ${String(path)} is not supported.`);
      const targetNodeIndex = target["node"];

      if (!nonNegativeInteger(targetNodeIndex)) return refuse(CONTAINED_GLTF_REFUSALS.malformed, `glTF animation ${clipIndex} targets an invalid node.`);
      const targetNode = nodes[targetNodeIndex];

      if (!plainRecord(targetNode)) return refuse(CONTAINED_GLTF_REFUSALS.malformed, `glTF animation ${clipIndex} targets an invalid node.`);

      if (own(targetNode, "matrix") !== undefined) return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, `glTF animation target node ${targetNodeIndex} uses matrix instead of TRS.`);
      const targetKey = `${String(target["node"])}:${path}`;

      if (targets.has(targetKey)) return refuse(CONTAINED_GLTF_REFUSALS.malformed, `glTF animation ${clipIndex} targets node ${target["node"]} path ${path} more than once.`);
      targets.add(targetKey);
      const times = accessorValues(context, sampler["input"], "SCALAR", [5126]);
      const values = accessorValues(context, sampler["output"], path === "rotation" ? "VEC4" : "VEC3", [5126]);

      if (times === null || values === null || values.length !== times.length * (path === "rotation" ? 4 : 3) || times.some((value, index) => { const previous = times[index - 1];

 return index > 0 && (previous === undefined || value <= previous); })) return refuse(CONTAINED_GLTF_REFUSALS.malformed, `glTF animation ${clipIndex} sampler accessors are invalid.`);

      if (path === "rotation" && Array.from({ length: times.length }, (_v, index) => Math.hypot(...values.slice(index * 4, index * 4 + 4))).some((length) => Math.abs(length - 1) > 0.0001)) return refuse(CONTAINED_GLTF_REFUSALS.malformed, `glTF animation ${clipIndex} contains a non-unit rotation quaternion.`);
      duration = Math.max(duration, times[times.length - 1] ?? 0);
      channels.push(Object.freeze({ node: targetNodeIndex, path, interpolation, times, values }));
    }

    if (channels.length === 0) return refuse(CONTAINED_GLTF_REFUSALS.malformed, `glTF animation ${clipIndex} contains no channels.`);
    animations.push(Object.freeze({ name: isText(rawClip["name"]) ? rawClip["name"] : `Animation ${clipIndex + 1}`, channels: Object.freeze(channels), duration }));
  }

  const decodedImages: BaseColorTexture[] = [];
  let decodedImageBytes = 0;

  for (const image of images ?? []) {
    if (!plainRecord(image)) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "A glTF image declaration is invalid.");

    if (image["extensions"] !== undefined) {
      return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "glTF image extensions are unsupported.");
    }

    let imageBytes: Uint8Array | null = null;

    if (image["uri"] !== undefined && image["bufferView"] !== undefined) {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "A glTF image must use either uri or bufferView, not both.");
    }

    if (image["mimeType"] !== undefined && image["mimeType"] !== "image/png") {
      return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Textured glTF models currently accept PNG images only; JPEG and WebP decoding is not supported.");
    }

    if (isText(image["uri"])) {
      const uri = image["uri"];

      if (/^data:image\/(?:jpeg|webp);base64,/i.test(uri)) {
        return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Textured glTF models currently accept PNG images only; JPEG and WebP decoding is not supported.");
      }

      const match = /^data:image\/png;base64,([A-Za-z0-9+/]*={0,2})$/.exec(uri);
      imageBytes = match === null ? null : decodeBase64(match[1] ?? "");
    } else if (nonNegativeInteger(image["bufferView"])) {
      const view = bufferViews[image["bufferView"]];

      if (plainRecord(view) && view["buffer"] === 0 && nonNegativeInteger(view["byteLength"])) {
        const offset = view["byteOffset"] === undefined ? 0 : view["byteOffset"];

        if (nonNegativeInteger(offset) && offset + view["byteLength"] <= bufferBytes.byteLength) {
          imageBytes = bufferBytes.subarray(offset, offset + view["byteLength"]);
        }
      }

      if (image["mimeType"] !== "image/png") {
        return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Embedded glTF bufferView images must declare image/png.");
      }
    }

    if (imageBytes === null) {
      return refuse(CONTAINED_GLTF_REFUSALS.notContained, "glTF images must be embedded PNG data URIs or PNG bufferViews; external and non-embedded images are refused.");
    }

    const decoded = decodePng(imageBytes);

    if ("ok" in decoded) return decoded;
    decodedImageBytes += decoded.rgba.length;

    if (decodedImageBytes > 8 * 1024 * 1024) {
      return refuse(CONTAINED_GLTF_REFUSALS.oversize, "Decoded PNG textures exceed the 8 MiB per-model RGBA limit.");
    }

    decodedImages.push(decoded);
  }

  const textureImages: BaseColorTexture[] = [];

  for (const texture of textures ?? []) {
    if (!plainRecord(texture) || !nonNegativeInteger(texture["source"]) || texture["source"] >= decodedImages.length) {
      return refuse(CONTAINED_GLTF_REFUSALS.malformed, "A glTF texture must reference a validated embedded PNG image.");
    }

    if (texture["sampler"] !== undefined || texture["extensions"] !== undefined) {
      return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "glTF texture samplers and texture extensions are unsupported.");
    }

    const image = decodedImages[texture["source"]];

    if (image === undefined) return refuse(CONTAINED_GLTF_REFUSALS.malformed, "A glTF texture references a missing PNG image.");
    textureImages.push(image);
  }

  const scene = scenes[0];
  const roots = plainRecord(scene) ? scene["nodes"] : undefined;

  if (!Array.isArray(roots) || roots.length === 0 || !roots.every(nonNegativeInteger)) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The glTF scene root list is invalid.");
  }

  if (json["materials"] !== undefined && !Array.isArray(json["materials"])) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "The glTF materials declaration must be an array.");
  }

  const materials = Array.isArray(json["materials"]) ? json["materials"] : [];
  const projected: ImportedAssetRenderMesh[] = [];
  let primitiveRefusal: Refusal | null = null;
  const minimum: [number, number, number] = [Infinity, Infinity, Infinity];
  const maximum: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let triangleCount = 0;

  type NodeWork = { index: number; matrix: Matrix4; parent: number | null; depth: number };

  const pending: NodeWork[] = roots.map((index) => ({ index, matrix: IDENTITY_MATRIX, parent: null, depth: 0 })).reverse();
  let nodeOperations = 0;
  const nodeParents = new Map<number, number | null>();
  const nodeMatrices = new Map<number, Matrix4>();

  const visit = (nodeIndex: number, parentMatrix: Matrix4, parentNode: number | null, depth: number): boolean => {
    if (depth > GLTF_MAXIMUM_NODE_DEPTH || ++nodeOperations > GLTF_MAXIMUM_NODE_OPERATIONS) return false;
    const node = nodes[nodeIndex];

    if (!plainRecord(node) || nodeParents.has(nodeIndex)) return false;
    const local = matrixForNode(node);

    if (local === null) return false;
    const world = multiplyMatrix(parentMatrix, local);
    nodeParents.set(nodeIndex, parentNode);
    nodeMatrices.set(nodeIndex, local);
    {
      const meshIndex = node["mesh"];

      if (meshIndex !== undefined) {
        if (!nonNegativeInteger(meshIndex)) return false;
        const mesh = meshes[meshIndex];
        const primitives = plainRecord(mesh) ? mesh["primitives"] : undefined;

        if (!Array.isArray(primitives) || primitives.length === 0) return false;

        for (const [primitiveIndex, primitive] of primitives.entries()) {
          if (!plainRecord(primitive) || (primitive["mode"] !== undefined && primitive["mode"] !== 4)) return false;
          const attributes = primitive["attributes"];

          if (!plainRecord(attributes)) return false;
          const attributeKeys = Object.keys(attributes);

          if (attributeKeys.includes("JOINTS_0") || attributeKeys.includes("WEIGHTS_0")) {
            primitiveRefusal = refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Skinning attributes JOINTS_0 and WEIGHTS_0 are not supported by this contained glTF profile.");

            return false;
          }

          if (attributeKeys.some((key) => key !== "POSITION" && key !== "NORMAL" && key !== "TEXCOORD_0")) return false;
          const positions = accessorValues(context, attributes["POSITION"], "VEC3", [5126]);

          if (positions === null || positions.length % 3 !== 0) return false;

          const normals = attributes["NORMAL"] === undefined
            ? undefined
            : accessorValues(context, attributes["NORMAL"], "VEC3", [5126]);

          const texcoords0 = attributes["TEXCOORD_0"] === undefined
            ? undefined
            : accessorValues(context, attributes["TEXCOORD_0"], "VEC2", [5126]);

          if (
            normals === null || (normals !== undefined && normals.length !== positions.length) ||
            texcoords0 === null || (texcoords0 !== undefined && texcoords0.length !== positions.length / 3 * 2)
          ) return false;
          const vertexCount = positions.length / 3;

          const indices = primitive["indices"] === undefined
            ? Object.freeze(Array.from({ length: vertexCount }, (_value, index) => index))
            : accessorValues(context, primitive["indices"], "SCALAR", [5121, 5123, 5125]);

          if (
            indices === null ||
            indices.length % 3 !== 0 ||
            indices.some((index) => !Number.isInteger(index) || index < 0 || index >= vertexCount)
          ) return false;
          triangleCount += indices.length / 3;

          if (triangleCount > GLTF_MAXIMUM_TRIANGLES) return false;

          for (let index = 0; index < positions.length; index += 3) {
            const point = transformPosition(
              world,
              numberAt(positions, index),
              numberAt(positions, index + 1),
              numberAt(positions, index + 2),
            );

            for (const axis of [0, 1, 2] as const) {
              minimum[axis] = Math.min(minimum[axis], point[axis]);
              maximum[axis] = Math.max(maximum[axis], point[axis]);
            }
          }

          const materialIndex = primitive["material"];

          if (materialIndex !== undefined && (!nonNegativeInteger(materialIndex) || !plainRecord(materials[materialIndex]))) {
            primitiveRefusal = refuse(CONTAINED_GLTF_REFUSALS.malformed, "A glTF primitive references a missing or invalid material.");

            return false;
          }

          const material = nonNegativeInteger(materialIndex) ? materials[materialIndex] : undefined;

          if (plainRecord(material) && material["alphaMode"] !== undefined && material["alphaMode"] !== "OPAQUE") {
            primitiveRefusal = refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "The contained glTF profile supports only OPAQUE alphaMode; BLEND, MASK, and unknown modes are refused.");

            return false;
          }

          if (plainRecord(material) && material["extensions"] !== undefined) {
            primitiveRefusal = refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "glTF material extensions are unsupported.");

            return false;
          }

          if (plainRecord(material) && ["normalTexture", "occlusionTexture", "emissiveTexture"].some((key) => material[key] !== undefined)) {
            primitiveRefusal = refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Only glTF PBR baseColorTexture is supported; other material texture slots are refused.");

            return false;
          }

          const pbr = plainRecord(material) ? material["pbrMetallicRoughness"] : undefined;

          if (pbr !== undefined && !plainRecord(pbr)) return false;
          const pbrRecord = plainRecord(pbr) ? pbr : {};

          if (pbrRecord["metallicRoughnessTexture"] !== undefined) {
            primitiveRefusal = refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "Only glTF PBR baseColorTexture is supported; metallicRoughnessTexture is refused.");

            return false;
          }

          const baseColorTexture = pbrRecord["baseColorTexture"];
          let texture: BaseColorTexture | undefined;

          if (plainRecord(baseColorTexture) && baseColorTexture["texCoord"] !== undefined && baseColorTexture["texCoord"] !== 0) {
            primitiveRefusal = refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "glTF baseColorTexture supports only the TEXCOORD_0 set.");

            return false;
          }

          if (plainRecord(baseColorTexture) && baseColorTexture["extensions"] !== undefined) {
            primitiveRefusal = refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "glTF baseColorTexture extensions are unsupported.");

            return false;
          }

          if (baseColorTexture !== undefined) {
            if (
              !plainRecord(baseColorTexture) || !nonNegativeInteger(baseColorTexture["index"]) ||
              baseColorTexture["index"] >= textureImages.length
            ) {
              primitiveRefusal = refuse(CONTAINED_GLTF_REFUSALS.malformed, "A glTF baseColorTexture reference or TEXCOORD_0 binding is invalid.");

              return false;
            }

            texture = textureImages[baseColorTexture["index"]];

            if (texcoords0 === undefined || texture === undefined) {
              primitiveRefusal = refuse(CONTAINED_GLTF_REFUSALS.malformed, "A textured glTF primitive requires matching TEXCOORD_0 vertices.");

              return false;
            }
          }

          const metallic = finiteNumber(pbrRecord["metallicFactor"])
            ? Math.min(1, Math.max(0, pbrRecord["metallicFactor"]))
            : 1;

          const roughness = finiteNumber(pbrRecord["roughnessFactor"])
            ? Math.min(1, Math.max(0, pbrRecord["roughnessFactor"]))
            : 1;

          const projectedMesh: MutableRenderMesh = {
            meshId: `node-${String(nodeIndex)}-mesh-${String(meshIndex)}-primitive-${String(primitiveIndex)}`,
            nodeIndex,
            positions,
            indices,
            matrix: world,
            baseColor: colorHex(pbrRecord["baseColorFactor"]),
            metallic,
            roughness,
          };

          if (normals !== undefined) projectedMesh.normals = normals;

          if (texcoords0 !== undefined) projectedMesh.uvs = texcoords0;

          if (texture !== undefined) projectedMesh.baseColorTexture = texture;
          projected.push(Object.freeze(projectedMesh));
        }
      }

      const children = node["children"];

      if (children !== undefined) {
        if (!Array.isArray(children) || !children.every(nonNegativeInteger)) return false;

        if (children.length + pending.length + nodeOperations > GLTF_MAXIMUM_NODE_OPERATIONS) return false;

        // Reverse push preserves the prior depth-first primitive ordering.
        for (let index = children.length - 1; index >= 0; index -= 1) {
          // SAFETY: children.every(nonNegativeInteger) validated each child; the reverse loop indexes only existing elements.
          pending.push({ index: children[index] as number, matrix: world, parent: nodeIndex, depth: depth + 1 });
        }
      }

      return true;
    }
  };

  while (pending.length > 0) {
    const work = pending.pop();

    if (work === undefined) break;

    if (!visit(work.index, work.matrix, work.parent, work.depth)) {
      return primitiveRefusal ?? refuse(CONTAINED_GLTF_REFUSALS.malformed, "The contained glTF scene graph or triangle accessor is invalid.");
    }
  }

  if (animations.some((clip) => clip.channels.some((channel) => !nodeParents.has(channel.node)))) {
    return refuse(CONTAINED_GLTF_REFUSALS.malformed, "Every glTF animation target node must be reachable from the selected scene.");
  }

  if (projected.length === 0 || minimum.some((value) => !Number.isFinite(value))) {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "The contained profile requires at least one triangle primitive reachable from the scene.");
  }

  return Object.freeze({
    mediaType: container.mediaType,
    meshes: Object.freeze(projected),
    nodes: Object.freeze([...nodeParents].sort(([a], [b]) => a - b).map(([node, parent]) => Object.freeze({ node, parent, matrix: nodeMatrices.get(node) ?? IDENTITY_MATRIX, matrixAuthored: own(nodes[node], "matrix") !== undefined, translation: vector(own(nodes[node], "translation"), 3, [0, 0, 0]) ?? [0, 0, 0], rotation: vector(own(nodes[node], "rotation"), 4, [0, 0, 0, 1]) ?? [0, 0, 0, 1], scale: vector(own(nodes[node], "scale"), 3, [1, 1, 1]) ?? [1, 1, 1] }))),
    animations: Object.freeze(animations),
    bounds: Object.freeze({
      minimum: Object.freeze(minimum),
      maximum: Object.freeze(maximum),
    }),
  });
}

function assetId(sourceName: string): string {
  const stem = basename(sourceName, extname(sourceName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return stem.length === 0 ? "imported-asset" : stem;
}

function manifestFrom(value: AssetJsonValue): ProjectAssetManifest | Refusal {
  if (value === undefined) {
    return Object.freeze({
      schemaVersion: PROJECT_ASSET_MANIFEST_SCHEMA_VERSION,
      kind: PROJECT_ASSET_MANIFEST_KIND,
      assets: Object.freeze([]),
    });
  }

  if (!plainRecord(value)) {
    return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "The project asset manifest must be an object.");
  }

  if (
    (value["schemaVersion"] !== PROJECT_ASSET_MANIFEST_SCHEMA_VERSION &&
      value["schemaVersion"] !== LEGACY_PROJECT_ASSET_MANIFEST_SCHEMA_VERSION) ||
    value["kind"] !== PROJECT_ASSET_MANIFEST_KIND ||
    !Array.isArray(value["assets"]) ||
    value["assets"].length > PROJECT_ASSET_MAX_COUNT ||
    !hasExactKeys(value, PROJECT_ASSET_MANIFEST_KEYS)
  ) {
    return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "The project asset manifest header or asset list is invalid.");
  }

  const entries: ProjectAssetManifestEntry[] = [];
  const ids = new Set<string>();
  const digests = new Set<string>();
  const relativePaths = new Set<string>();
  const artifactIds = new Set<string>();
  const instanceIds = new Set<string>();
  const legacy = value["schemaVersion"] === LEGACY_PROJECT_ASSET_MANIFEST_SCHEMA_VERSION;

  for (const entry of value["assets"]) {
    if (!plainRecord(entry)) {
      return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "Every project asset manifest entry must be an object.");
    }

    const provenance = entry["provenance"];

    if (legacy) {
      if (
        !hasExactKeys(entry, LEGACY_PROJECT_ASSET_MANIFEST_ENTRY_KEYS) ||
        !plainRecord(provenance) || !hasExactKeys(provenance, PROJECT_ASSET_PROVENANCE_KEYS) ||
        provenance["importer"] !== "@sceneaxi/importers" || provenance["importerVersion"] !== 1 ||
        provenance["formatVersion"] !== "2.0" || provenance["contained"] !== true ||
        !isText(entry["sourceName"]) || basename(entry["sourceName"]) !== entry["sourceName"] ||
        !isText(entry["canonicalBytesBase64"]) || entry["copyPolicy"] !== PROJECT_ASSET_COPY_POLICY ||
        entry["profile"] !== CONTAINED_GLTF_PROFILE_ID
      ) return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "A legacy project asset manifest entry failed its exact v1 contract.");
      const decoded = decodeBase64(entry["canonicalBytesBase64"]);
      const gltf = decoded === null ? null : parseGltf(decoded, entry["sourceName"]);
      const legacyExtension = extname(entry["sourceName"]).toLowerCase();

      const legacyMediaType = legacyExtension === ".glb"
        ? "model/gltf-binary"
        : legacyExtension === ".gltf" ? "model/gltf+json" : null;

      if (
        decoded === null || "ok" in (gltf ?? { ok: false }) ||
        !isText(entry["assetId"]) || !ID_RE.test(entry["assetId"]) ||
        !isText(entry["digest"]) || sha256(decoded) !== entry["digest"] ||
        entry["byteLength"] !== decoded.byteLength || provenance["sourceDigest"] !== entry["digest"] ||
        !isText(entry["artifactId"]) || entry["artifactId"] !== `${entry["assetId"]}-asset-artifact` ||
        !isText(entry["instanceId"]) || entry["instanceId"] !== `${entry["assetId"]}-instance` ||
        entry["mediaType"] !== legacyMediaType ||
        entry["relativePath"] !== `${PROJECT_ASSET_DIRECTORY}/${entry["assetId"]}.${legacyMediaType === "model/gltf-binary" ? "glb" : "gltf"}`
      ) return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "A legacy project asset manifest entry does not reproduce its canonical glTF bytes.");
      // SAFETY: decoded is non-null and the refusal guard excludes null and every parseGltf refusal before accessing the parsed model.
      const parsed = gltf as ParsedGltf;

      const normalized: ProjectAssetManifestEntry = Object.freeze({
        assetId: entry["assetId"],
        sourceName: entry["sourceName"],
        relativePath: String(entry["relativePath"]),
        family: "model" as const,
        mediaType: parsed.mediaType,
        byteLength: decoded.byteLength,
        digest: entry["digest"],
        canonicalBytesBase64: entry["canonicalBytesBase64"],
        copyPolicy: PROJECT_ASSET_COPY_POLICY,
        profile: CONTAINED_GLTF_PROFILE_ID,
        supportedProfiles: PROJECT_ASSET_SUPPORTED_PROFILES,
        artifactId: entry["artifactId"],
        instanceId: entry["instanceId"],
        validation: Object.freeze({ status: "validated" as const, validator: CONTAINED_GLTF_PROFILE_ID, replacesDigest: null }),
        preview: metadataPreview(`${String(parsed.meshes.length)} meshes`, { meshCount: parsed.meshes.length, minimum: parsed.bounds.minimum.join(","), maximum: parsed.bounds.maximum.join(",") }),
        provenance: Object.freeze({ importer: "@sceneaxi/importers" as const, importerVersion: 2 as const, sourceDigest: entry["digest"], formatVersion: "2.0", contained: true as const }),
      });

      const normalizedArtifactId = normalized.artifactId;
      const normalizedInstanceId = normalized.instanceId;

      if (normalizedArtifactId === null || normalizedInstanceId === null) {
        return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "A legacy model entry lost its composition identities.");
      }

      if (ids.has(normalized.assetId) || digests.has(normalized.digest) || relativePaths.has(normalized.relativePath) || artifactIds.has(normalizedArtifactId) || instanceIds.has(normalizedInstanceId)) {
        return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "Legacy project asset manifest identities, paths, and digests must be unique.");
      }

      ids.add(normalized.assetId); digests.add(normalized.digest); relativePaths.add(normalized.relativePath); artifactIds.add(normalizedArtifactId); instanceIds.add(normalizedInstanceId);
      entries.push(normalized);
      continue;
    }

    const validation = entry["validation"];
    const preview = entry["preview"];

    if (
      !ID_RE.test(String(entry["assetId"])) ||
      !isText(entry["sourceName"]) || basename(entry["sourceName"]) !== entry["sourceName"] ||
      !isText(entry["relativePath"]) ||
      !isText(entry["family"]) || !(entry["family"] in PROJECT_ASSET_PROFILES) ||
      !isText(entry["mediaType"]) ||
      !nonNegativeInteger(entry["byteLength"]) || entry["byteLength"] === 0 || entry["byteLength"] > PROJECT_ASSET_MAX_BYTES ||
      !isText(entry["digest"]) || !DIGEST_RE.test(entry["digest"]) ||
      !isText(entry["canonicalBytesBase64"]) ||
      entry["copyPolicy"] !== PROJECT_ASSET_COPY_POLICY ||
      !isText(entry["profile"]) ||
      !Array.isArray(entry["supportedProfiles"]) || entry["supportedProfiles"].length !== 2 || entry["supportedProfiles"][0] !== "game" || entry["supportedProfiles"][1] !== "web" ||
      !hasExactKeys(entry, PROJECT_ASSET_MANIFEST_ENTRY_KEYS) ||
      !plainRecord(validation) || !hasExactKeys(validation, PROJECT_ASSET_VALIDATION_KEYS) ||
      validation["status"] !== "validated" || validation["validator"] !== entry["profile"] ||
      (validation["replacesDigest"] !== null && (!isText(validation["replacesDigest"]) || !DIGEST_RE.test(validation["replacesDigest"]))) ||
      !plainRecord(preview) || !hasExactKeys(preview, PROJECT_ASSET_PREVIEW_KEYS) || preview["kind"] !== "metadata" || !isText(preview["label"]) || !plainRecord(preview["properties"]) ||
      !plainRecord(provenance) ||
      !hasExactKeys(provenance, PROJECT_ASSET_PROVENANCE_KEYS) ||
      provenance["importer"] !== "@sceneaxi/importers" ||
      provenance["importerVersion"] !== 2 ||
      provenance["sourceDigest"] !== entry["digest"] ||
      !isText(provenance["formatVersion"]) || provenance["formatVersion"].length === 0 ||
      provenance["contained"] !== true
    ) {
      return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "A project asset manifest entry failed its typed copy/provenance contract.");
    }

    const entryId = entry["assetId"];
    const entryDigest = entry["digest"];
    const entryPath = entry["relativePath"];
    const entryMediaType = entry["mediaType"];

    if (
      !isText(entryId) ||
      !isText(entryDigest) ||
      !isText(entryPath)
    ) {
      return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "A project asset manifest entry has invalid identity fields.");
    }

    if (relativePaths.has(entryPath)) {
      return refuse(
        CONTAINED_GLTF_REFUSALS.duplicatePath,
        `Project asset manifest path "${entryPath}" is owned by more than one asset identity.`,
      );
    }

    const decoded = decodeBase64(entry["canonicalBytesBase64"]);
    const reparsed = decoded === null ? null : parseAsset(decoded, entry["sourceName"]);

    if (decoded === null || reparsed === null || "ok" in reparsed) {
      return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "A project asset manifest entry does not reproduce supported canonical bytes.");
    }

    const extension = reparsed.extension;
    const isModel = reparsed.family === "model";

    if (
      entryPath !== `${PROJECT_ASSET_DIRECTORY}/${entryId}.${extension}` ||
      entry["family"] !== reparsed.family || entryMediaType !== reparsed.mediaType ||
      entry["profile"] !== reparsed.profile || provenance["formatVersion"] !== reparsed.formatVersion ||
      JSON.stringify(preview) !== JSON.stringify(reparsed.preview) ||
      (isModel
        ? entry["artifactId"] !== `${entryId}-asset-artifact` || entry["instanceId"] !== `${entryId}-instance`
        : entry["artifactId"] !== null || entry["instanceId"] !== null)
    ) {
      return refuse(
        CONTAINED_GLTF_REFUSALS.manifestInvalid,
        "A project asset manifest entry does not own its canonical path and composition identities.",
      );
    }

    if (
      decoded.byteLength !== entry["byteLength"] ||
      sha256(decoded) !== entryDigest ||
      (validation["replacesDigest"] !== null && validation["replacesDigest"] === entryDigest)
    ) {
      return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "A project asset manifest entry does not reproduce its canonical bytes.");
    }

    const artifactId = entry["artifactId"];
    const instanceId = entry["instanceId"];

    if (ids.has(entryId) || digests.has(entryDigest) ||
      isText(artifactId) && artifactIds.has(artifactId) ||
      isText(instanceId) && instanceIds.has(instanceId)) {
      return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "Project asset manifest identities and digests must be unique.");
    }

    ids.add(entryId);
    digests.add(entryDigest);
    relativePaths.add(entryPath);

    if (isText(artifactId)) artifactIds.add(artifactId);

    if (isText(instanceId)) instanceIds.add(instanceId);
    // SAFETY: The exact entry/provenance/preview keys, canonical byte digest, reparsed family/profile, metadata and composition identities were checked above.
    entries.push(Object.freeze(entry as ProjectAssetManifestEntry));
  }

  return Object.freeze({
    schemaVersion: PROJECT_ASSET_MANIFEST_SCHEMA_VERSION,
    kind: PROJECT_ASSET_MANIFEST_KIND,
    assets: Object.freeze(entries),
  });
}

function proxyArtifact(
  id: string,
  bounds: ContainedGltfProjection["bounds"],
  color: string,
): SculptArtifact | Refusal {
  // SAFETY: bounds.minimum is a validated three-element tuple; map preserves its length and produces numeric dimensions.
  const dimensions = bounds.minimum.map((value, axis) =>
    Math.max(0.001, numberAt(bounds.maximum, axis) - value),
  ) as [number, number, number];

  // SAFETY: bounds.minimum is a validated three-element tuple; map preserves its length and produces numeric center coordinates.
  const center = bounds.minimum.map((value, axis) =>
    value + numberAt(dimensions, axis) / 2,
  ) as [number, number, number];

  const rootNodeId = `${id}-node`;

  const reconstructed = reconstructSculpt({
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: "sceneaxi.sculpt-intake",
    intakeId: id,
    mode: "structured-spec",
    structuredSpec: {
      schemaVersion: SCULPT_SCHEMA_VERSION,
      kind: OBJECT_SCULPT_SPEC_KIND,
      id: `${id}-spec`,
      rootNodeId,
      components: [{ id: `${id}-bounds`, primitive: "box", dimensions, materialId: `${id}-material` }],
      materials: [{ id: `${id}-material`, baseColor: color, metallic: 0, roughness: 1 }],
      sockets: [],
      hierarchy: [{
        id: rootNodeId,
        parentId: null,
        componentId: `${id}-bounds`,
        transform: {
          ...identitySculptTransform(),
          translation: center,
        },
      }],
    },
  });

  return reconstructed.ok
    ? reconstructed.artifact
    : refuse(CONTAINED_GLTF_REFUSALS.sceneInvalid, "The imported asset projection could not become a validated Sculpt Artifact.");
}

function sceneWithAsset(
  stored: ComposedScene,
  artifact: SculptArtifact,
  instanceId: string,
): ComposedScene | Refusal {
  if (stored.instances.length >= SCENE_MAXIMUM_INSTANCES) {
    return refuse(CONTAINED_GLTF_REFUSALS.sceneLimit, "The composed scene has no remaining v1 instance capacity.");
  }

  const intake = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: stored.sceneId,
    rootInstanceId: stored.rootInstanceId,
    placements: [
      ...stored.instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactId: instance.artifactId,
        parentInstanceId: instance.parentInstanceId,
        transform: instance.localTransform,
      })),
      {
        instanceId,
        artifactId: artifact.artifactId,
        parentInstanceId: stored.rootInstanceId,
        transform: {
          ...identitySculptTransform(),
          translation: [4 + Math.max(0, stored.instances.length - 3) * 2.5, 0, 0],
        } satisfies SculptTransform,
      },
    ],
  };

  const artifacts = new Map<string, SculptArtifact>();

  for (const instance of stored.instances) artifacts.set(instance.artifactId, instance.artifact);

  if (artifacts.has(artifact.artifactId)) {
    return refuse(CONTAINED_GLTF_REFUSALS.identityConflict, "The imported asset artifact identity conflicts with the existing composition.");
  }

  artifacts.set(artifact.artifactId, artifact);
  const composed = composeScene(intake, [...artifacts.values()]);

  return composed.ok
    ? composed.scene
    : refuse(CONTAINED_GLTF_REFUSALS.sceneInvalid, `The existing composition refused the imported asset: ${composed.code}.`);
}

function sceneWithReloadedAsset(
  stored: ComposedScene,
  artifact: SculptArtifact,
  instanceId: string,
): ComposedScene | Refusal {
  const existing = stored.instances.find((instance) => instance.instanceId === instanceId);

  if (existing === undefined || existing.artifactId !== artifact.artifactId) {
    return refuse(CONTAINED_GLTF_REFUSALS.identityConflict, "The model hot reload identity is absent from the accepted composition.");
  }

  const intake = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId: stored.sceneId,
    rootInstanceId: stored.rootInstanceId,
    placements: stored.instances.map((instance) => ({
      instanceId: instance.instanceId,
      artifactId: instance.artifactId,
      parentInstanceId: instance.parentInstanceId,
      transform: instance.localTransform,
    })),
  };

  const artifacts = new Map<string, SculptArtifact>();

  for (const instance of stored.instances) {
    artifacts.set(instance.artifactId, instance.artifactId === artifact.artifactId ? artifact : instance.artifact);
  }

  const composed = composeScene(intake, [...artifacts.values()]);

  return composed.ok
    ? composed.scene
    : refuse(CONTAINED_GLTF_REFUSALS.sceneInvalid, `The existing composition refused the reloaded model: ${composed.code}.`);
}

export function stageProjectAssetImport(input: Readonly<{
  sourceName: string;
  sourceBytes: Uint8Array;
  documentPath: string;
  expectedContentHash: string;
  documentData: unknown;
  assetId?: string;
  hotReload?: boolean;
}>): ProjectAssetStageResult {
  if (
    !isText(input.sourceName) || basename(input.sourceName) !== input.sourceName ||
    !(input.sourceBytes instanceof Uint8Array) ||
    !isText(input.documentPath) || input.documentPath.length === 0 ||
    !DIGEST_RE.test(input.expectedContentHash)
  ) {
    return refuse(CONTAINED_GLTF_REFUSALS.requestMalformed, "Asset import requires a basename, bytes, contained document path, and SHA-256 base hash.");
  }

  const parsed = parseAsset(input.sourceBytes, input.sourceName);

  if ("ok" in parsed) return parsed;

  if (!isJsonObject(input.documentData)) {
    return refuse(CONTAINED_GLTF_REFUSALS.sceneInvalid, "The active Scene Document data must be a JSON object.");
  }

  const stored = composedSceneFromDocumentData(input.documentData);

  if (!stored.ok) {
    return refuse(CONTAINED_GLTF_REFUSALS.sceneInvalid, "The active Scene Document has no reproducible composed scene.");
  }

  const manifest = manifestFrom(input.documentData[PROJECT_ASSET_MANIFEST_KEY]);

  if ("ok" in manifest) return manifest;
  const id = input.assetId ?? assetId(input.sourceName);

  if (!ID_RE.test(id)) {
    return refuse(CONTAINED_GLTF_REFUSALS.requestMalformed, "Asset identity must be a lowercase slug of at most 64 characters.");
  }

  const digest = sha256(input.sourceBytes);
  const sameIdentity = manifest.assets.find((entry) => entry.assetId === id);
  const sameDigest = manifest.assets.find((entry) => entry.digest === digest);

  if (sameIdentity !== undefined) {
    if (sameIdentity.digest === digest) {
      if (input.hotReload === true) {
        return refuse(CONTAINED_GLTF_REFUSALS.sourceUnchanged, `Asset identity "${id}" still has its accepted digest.`);
      }

      const projection = projectAssetManifestEntry(sameIdentity);

      return projection.ok
        ? Object.freeze({ ok: true as const, replayed: true, hotReload: false, entry: sameIdentity, projection: projection.value, edit: null })
        : projection;
    }

    if (input.hotReload !== true) {
      return refuse(CONTAINED_GLTF_REFUSALS.identityConflict, `Asset identity "${id}" already names different canonical bytes.`);
    }

    if (sameIdentity.family !== parsed.family) {
      return refuse(CONTAINED_GLTF_REFUSALS.familyChanged, `Asset identity "${id}" cannot hot reload from ${sameIdentity.family} to ${parsed.family}.`);
    }

    if (sameIdentity.mediaType !== parsed.mediaType || sameIdentity.profile !== parsed.profile) {
      return refuse(CONTAINED_GLTF_REFUSALS.familyChanged, `Asset identity "${id}" cannot change its admitted media profile during hot reload.`);
    }
  }

  if (sameDigest !== undefined) {
    return refuse(CONTAINED_GLTF_REFUSALS.duplicateContent, `The same canonical bytes already belong to asset identity "${sameDigest.assetId}".`);
  }

  if (sameIdentity === undefined && manifest.assets.length >= PROJECT_ASSET_MAX_COUNT) {
    return refuse(CONTAINED_GLTF_REFUSALS.assetLimit, "The project asset manifest reached its v1 asset count limit.");
  }

  const artifactId = parsed.family === "model" ? `${id}-asset` : null;
  const instanceId = parsed.family === "model" ? `${id}-instance` : null;

  if (artifactId !== null && instanceId !== null && (!ID_RE.test(artifactId) || !ID_RE.test(instanceId))) {
    return refuse(CONTAINED_GLTF_REFUSALS.requestMalformed, "The asset identity is too long for derived composition identities.");
  }

  let composed = stored.value;
  let storedArtifactId: string | null = sameIdentity?.artifactId ?? null;
  let storedInstanceId: string | null = sameIdentity?.instanceId ?? null;

  if (parsed.gltf !== null && sameIdentity === undefined && artifactId !== null && instanceId !== null) {
    const proxy = proxyArtifact(artifactId, parsed.gltf.bounds, parsed.gltf.meshes[0]?.baseColor ?? "#b8c4d8");

    if ("ok" in proxy) return proxy;
    const nextComposition = sceneWithAsset(stored.value, proxy, instanceId);

    if ("ok" in nextComposition) return nextComposition;
    composed = nextComposition;
    storedArtifactId = proxy.artifactId;
    storedInstanceId = instanceId;
  } else if (
    parsed.gltf !== null && sameIdentity !== undefined &&
    sameIdentity.artifactId !== null && sameIdentity.instanceId !== null
  ) {
    const proxyBaseId = sameIdentity.artifactId.endsWith("-artifact")
      ? sameIdentity.artifactId.slice(0, -"-artifact".length)
      : `${id}-asset`;

    const proxy = proxyArtifact(proxyBaseId, parsed.gltf.bounds, parsed.gltf.meshes[0]?.baseColor ?? "#b8c4d8");

    if ("ok" in proxy) return proxy;

    if (proxy.artifactId !== sameIdentity.artifactId) {
      return refuse(CONTAINED_GLTF_REFUSALS.identityConflict, "Model hot reload could not preserve the accepted artifact identity.");
    }

    const nextComposition = sceneWithReloadedAsset(stored.value, proxy, sameIdentity.instanceId);

    if ("ok" in nextComposition) return nextComposition;
    composed = nextComposition;
  }

  const entry: ProjectAssetManifestEntry = Object.freeze({
    assetId: id,
    sourceName: input.sourceName,
    relativePath: sameIdentity?.relativePath ?? `${PROJECT_ASSET_DIRECTORY}/${id}.${parsed.extension}`,
    family: parsed.family,
    mediaType: parsed.mediaType,
    byteLength: input.sourceBytes.byteLength,
    digest,
    canonicalBytesBase64: Buffer.from(input.sourceBytes).toString("base64"),
    copyPolicy: PROJECT_ASSET_COPY_POLICY,
    profile: parsed.profile,
    supportedProfiles: PROJECT_ASSET_SUPPORTED_PROFILES,
    artifactId: storedArtifactId,
    instanceId: storedInstanceId,
    validation: Object.freeze({
      status: "validated" as const,
      validator: parsed.profile,
      replacesDigest: sameIdentity?.digest ?? null,
    }),
    preview: parsed.preview,
    provenance: Object.freeze({
      importer: "@sceneaxi/importers" as const,
      importerVersion: 2 as const,
      sourceDigest: digest,
      formatVersion: parsed.formatVersion,
      contained: true as const,
    }),
  });

  const nextManifest: ProjectAssetManifest = Object.freeze({
    schemaVersion: PROJECT_ASSET_MANIFEST_SCHEMA_VERSION,
    kind: PROJECT_ASSET_MANIFEST_KIND,
    assets: Object.freeze(sameIdentity === undefined
      ? [...manifest.assets, entry]
      : manifest.assets.map((candidate) => candidate.assetId === id ? entry : candidate)),
  });

  // SAFETY: documentData passed isJsonObject; composed and nextManifest contain only validated JSON fields, and structuredClone preserves the document JSON.
  const newValue = Object.freeze({
    ...structuredClone(input.documentData),
    [COMPOSED_SCENE_DOCUMENT_DATA_KEY]: composed,
    [PROJECT_ASSET_MANIFEST_KEY]: nextManifest,
  }) as JsonObject;

  // SAFETY: For a parsed glTF model the entry was constructed above with model media/profile and non-null artifact/instance identities.
  const projection: ProjectAssetProjection = parsed.gltf === null
    ? Object.freeze({ entry, preview: parsed.preview })
    : Object.freeze({ entry: entry as ContainedGltfProjection["entry"], meshes: parsed.gltf.meshes, nodes: parsed.gltf.nodes, animations: parsed.gltf.animations, bounds: parsed.gltf.bounds });

  return Object.freeze({
    ok: true as const,
    replayed: false,
    hotReload: sameIdentity !== undefined,
    entry,
    projection,
    edit: Object.freeze({
      documentPath: input.documentPath,
      jsonPointer: "/data" as const,
      expectedContentHash: input.expectedContentHash,
      newValue,
    }),
  });
}

export function stageContainedGltfAssetImport(input: Readonly<{
  sourceName: string;
  sourceBytes: Uint8Array;
  documentPath: string;
  expectedContentHash: string;
  documentData: unknown;
  assetId?: string;
}>): ContainedGltfStageResult {
  const result = stageProjectAssetImport(input);

  if (!result.ok) return result;

  if (result.entry.family !== "model" || !("meshes" in result.projection)) {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "The contained glTF entry point accepts only GLB or glTF model assets.");
  }

  // SAFETY: The successful result was checked to have model family and a meshes-bearing glTF projection above; all other fields are forwarded unchanged.
  return Object.freeze({
    ok: true as const,
    replayed: result.replayed,
    entry: result.entry,
    projection: result.projection,
    edit: result.edit,
  }) as ContainedGltfStageResult;
}

function validateImportPaths(projectRoot: string, documentPath: string, sourcePath: string):
  | Readonly<{ ok: true; root: string; document: string; source: string }>
  | Refusal {
  const root = canonicalExistingDirectory(projectRoot);

  if (root === null) {
    return refuse(CONTAINED_GLTF_REFUSALS.projectRootInvalid, "The project root must be an existing absolute directory.");
  }

  if (documentPath.includes("\0") || isAbsolute(documentPath)) {
    return refuse(CONTAINED_GLTF_REFUSALS.documentOutsideRoot, "The Scene Document path must be project-relative.");
  }

  const document = canonicalTarget(resolve(root, documentPath));

  if (document === null || !contained(root, document)) {
    return refuse(CONTAINED_GLTF_REFUSALS.documentOutsideRoot, "The Scene Document resolves outside the selected project root.");
  }

  if (!isAbsolute(sourcePath) || sourcePath.includes("\0")) {
    return refuse(CONTAINED_GLTF_REFUSALS.sourcePathInvalid, "A native asset selection must be an absolute path.");
  }

  try {
    if (lstatSync(sourcePath).isSymbolicLink()) {
      return refuse(CONTAINED_GLTF_REFUSALS.sourceSymlink, "A native asset selection may not be a symbolic link.");
    }

    const source = realpathSync(sourcePath);

    if (!statSync(source).isFile()) {
      return refuse(CONTAINED_GLTF_REFUSALS.sourceUnreadable, "The selected asset is not a regular file.");
    }

    return Object.freeze({ ok: true as const, root, document, source });
  } catch {
    return refuse(CONTAINED_GLTF_REFUSALS.sourceUnreadable, "The selected asset cannot be read.");
  }
}

export interface AssetCopyFilesystem {
  inspect(path: string): Stats;
  sync(descriptor: number): void;
}

const nativeAssetCopyFilesystem: AssetCopyFilesystem = {
  inspect: (path) => lstatSync(path),
  sync: (descriptor) => fsyncSync(descriptor),
};

function destinationFor(root: string, relativePath: string, filesystem = nativeAssetCopyFilesystem): string | Refusal {
  // Inspect lexical paths before realpath hides in-root or dangling aliases.
  for (const path of [join(root, PROJECT_ASSET_DIRECTORY), join(root, ...relativePath.split("/"))]) {
    try {
      if (filesystem.inspect(path).isSymbolicLink()) {
        return refuse(CONTAINED_GLTF_REFUSALS.destinationSymlink, "The project asset destination and directory may not be symbolic links.");
      }
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        return refuse(CONTAINED_GLTF_REFUSALS.destinationEscape, "The project asset destination cannot be inspected.");
      }
    }
  }

  const assetsDirectory = join(root, PROJECT_ASSET_DIRECTORY);

  try {
    if (existsSync(assetsDirectory) && filesystem.inspect(assetsDirectory).isSymbolicLink()) {
      return refuse(CONTAINED_GLTF_REFUSALS.destinationSymlink, "The project assets directory may not be a symbolic link.");
    }
  } catch {
    return refuse(CONTAINED_GLTF_REFUSALS.destinationEscape, "The project assets directory cannot be inspected.");
  }

  const target = canonicalTarget(join(root, ...relativePath.split("/")));

  if (target === null || !contained(root, target)) {
    return refuse(CONTAINED_GLTF_REFUSALS.destinationEscape, "The project asset copy resolves outside the project root.");
  }

  try {
    if (existsSync(target) && filesystem.inspect(target).isSymbolicLink()) {
      return refuse(CONTAINED_GLTF_REFUSALS.destinationSymlink, "The project asset destination may not be a symbolic link.");
    }
  } catch {
    return refuse(CONTAINED_GLTF_REFUSALS.destinationEscape, "The project asset destination cannot be inspected.");
  }

  return target;
}

export function proposeProjectAssetImport(input: Readonly<{
  projectRoot: string;
  documentPath: string;
  sourcePath: string;
  assetId?: string;
  hotReload?: boolean;
}>): ProjectAssetProposalResult {
  const paths = validateImportPaths(input.projectRoot, input.documentPath, input.sourcePath);

  if (!paths.ok) return paths;
  let sourceBytes: Uint8Array;
  let documentBytes: string;

  try {
    const size = statSync(paths.source).size;

    if (size > PROJECT_ASSET_MAX_BYTES) {
      return refuse(CONTAINED_GLTF_REFUSALS.oversize, `Asset bytes exceed the ${String(PROJECT_ASSET_MAX_BYTES)} byte v1 limit.`);
    }

    sourceBytes = readFileSync(paths.source);
    documentBytes = readFileSync(paths.document, "utf8");
  } catch {
    return refuse(CONTAINED_GLTF_REFUSALS.sourceUnreadable, "The selected asset or Scene Document cannot be read.");
  }

  const document = parseDocumentText(documentBytes);

  if (!document.ok) {
    return refuse(CONTAINED_GLTF_REFUSALS.sceneInvalid, "The active Scene Document is invalid.");
  }

  const stageInput: AssetStageRequest = {
    sourceName: basename(paths.source),
    sourceBytes,
    documentPath: input.documentPath,
    expectedContentHash: contentHash(documentBytes),
    documentData: document.document.data,
  };

  if (input.assetId !== undefined) stageInput.assetId = input.assetId;

  if (input.hotReload !== undefined) stageInput.hotReload = input.hotReload;
  const staged = stageProjectAssetImport(stageInput);

  if (!staged.ok) return staged;
  const destination = destinationFor(paths.root, staged.entry.relativePath);

  if (!isText(destination)) return destination;

  if (staged.hotReload && !existsSync(destination)) {
    return refuse(CONTAINED_GLTF_REFUSALS.projectCopyChanged, "Hot reload refuses because the accepted project copy is missing.");
  }

  if (existsSync(destination)) {
    try {
      const destinationDigest = sha256(readFileSync(destination));
      const allowedPrevious = staged.entry.validation.replacesDigest;

      if (destinationDigest !== staged.entry.digest && destinationDigest !== allowedPrevious) {
        return refuse(
          staged.hotReload ? CONTAINED_GLTF_REFUSALS.projectCopyChanged : CONTAINED_GLTF_REFUSALS.destinationConflict,
          staged.hotReload
            ? "Hot reload refuses because the project copy no longer matches the accepted manifest digest."
            : "The project asset destination already contains different bytes.",
        );
      }
    } catch {
      return refuse(CONTAINED_GLTF_REFUSALS.destinationConflict, "The project asset destination cannot be verified.");
    }
  }

  if (staged.edit === null) {
    return Object.freeze({
      ok: true as const,
      replayed: true,
      hotReload: false,
      entry: staged.entry,
      projection: staged.projection,
      proposal: null,
      unifiedDiff: "",
    });
  }

  const proposed = propose({
    documentPath: staged.edit.documentPath,
    jsonPointer: staged.edit.jsonPointer,
    newValue: staged.edit.newValue,
    cwd: paths.root,
  });

  if (!proposed.ok) {
    return refuse(CONTAINED_GLTF_REFUSALS.proposalRefused, proposed.diagnostics[0]?.message ?? "The E1 proposal was refused.");
  }

  if (proposed.proposal.edits[0]?.baseContentHash !== staged.edit.expectedContentHash) {
    return refuse(CONTAINED_GLTF_REFUSALS.proposalRefused, "The Scene Document changed while the asset proposal was prepared.");
  }

  return Object.freeze({
    ok: true as const,
    replayed: false,
    hotReload: staged.hotReload,
    entry: staged.entry,
    projection: staged.projection,
    proposal: proposed.proposal,
    unifiedDiff: proposed.unifiedDiff,
  });
}

export function proposeContainedGltfAssetImport(input: Readonly<{
  projectRoot: string;
  documentPath: string;
  sourcePath: string;
  assetId?: string;
}>): ContainedGltfProposalResult {
  const result = proposeProjectAssetImport(input);

  if (!result.ok) return result;

  if (result.entry.family !== "model" || !("meshes" in result.projection)) {
    return refuse(CONTAINED_GLTF_REFUSALS.unsupportedFormat, "The contained glTF entry point accepts only GLB or glTF model assets.");
  }

  // SAFETY: The successful result was checked to have model family and a meshes-bearing glTF projection above; proposal fields are forwarded unchanged.
  return Object.freeze({
    ok: true as const,
    replayed: result.replayed,
    entry: result.entry,
    projection: result.projection,
    proposal: result.proposal,
    unifiedDiff: result.unifiedDiff,
  }) as ContainedGltfProposalResult;
}

export function projectAssetManifestEntry(
  entry: ProjectAssetManifestEntry,
):
  | Readonly<{ ok: true; value: ProjectAssetProjection }>
  | Refusal {
  const bytes = decodeBase64(entry.canonicalBytesBase64);

  if (bytes === null || bytes.byteLength !== entry.byteLength || sha256(bytes) !== entry.digest) {
    return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "The asset manifest canonical bytes do not match their digest and length.");
  }

  const parsed = parseAsset(bytes, entry.sourceName);

  if ("ok" in parsed) return parsed;

  if (parsed.mediaType !== entry.mediaType || parsed.family !== entry.family || parsed.profile !== entry.profile) {
    return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "The asset manifest media type does not match its canonical bytes.");
  }

  if (parsed.gltf === null) {
    return Object.freeze({ ok: true as const, value: Object.freeze({ entry, preview: parsed.preview }) });
  }

  if (!isContainedModelEntry(entry)) {
    return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "The model asset manifest entry is missing its composition identities.");
  }

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({ entry, meshes: parsed.gltf.meshes, nodes: parsed.gltf.nodes, animations: parsed.gltf.animations, bounds: parsed.gltf.bounds }),
  });
}

export function projectAssetManifestFromDocumentData(
  data: JsonValue,
):
  | Readonly<{ ok: true; value: ProjectAssetManifest }>
  | Refusal {
  if (!isJsonObject(data)) {
    return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "Scene Document data must be an object before assets can be read.");
  }

  const manifest = manifestFrom(data[PROJECT_ASSET_MANIFEST_KEY]);

  return "ok" in manifest ? manifest : Object.freeze({ ok: true as const, value: manifest });
}

function syncDirectory(path: string, filesystem: AssetCopyFilesystem): void {
  const descriptor = openSync(path, "r");

  try {
    filesystem.sync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function copyEntry(root: string, entry: ProjectAssetManifestEntry, filesystem: AssetCopyFilesystem):
  | Readonly<{ copied: boolean; path: string }>
  | Refusal {
  const projected = projectAssetManifestEntry(entry);

  if (!projected.ok) return projected;
  const target = destinationFor(root, entry.relativePath, filesystem);

  if (!isText(target)) return target;

  if (existsSync(target)) {
    try {
      const currentDigest = sha256(readFileSync(target));

      if (currentDigest === entry.digest) return Object.freeze({ copied: false, path: entry.relativePath });

      if (entry.validation.replacesDigest !== currentDigest) {
        return refuse(CONTAINED_GLTF_REFUSALS.destinationConflict, `Project asset ${entry.relativePath} contains bytes that conflict with the accepted manifest.`);
      }
    } catch {
      return refuse(CONTAINED_GLTF_REFUSALS.destinationConflict, `Project asset ${entry.relativePath} cannot be verified.`);
    }
  }

  const bytes = decodeBase64(entry.canonicalBytesBase64);

  if (bytes === null) {
    return refuse(CONTAINED_GLTF_REFUSALS.manifestInvalid, "Accepted canonical bytes cannot be decoded.");
  }

  const directory = dirname(target);
  const temporary = join(directory, `.sceneaxi-import-${entry.assetId}-${process.pid}`);
  let descriptor: number | null = null;

  try {
    mkdirSync(directory, { recursive: true });
    const canonicalDirectory = realpathSync(directory);

    if (!contained(root, canonicalDirectory) || filesystem.inspect(directory).isSymbolicLink()) {
      return refuse(CONTAINED_GLTF_REFUSALS.destinationSymlink, "The project asset directory changed into an unsafe path.");
    }

    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, bytes);
    filesystem.sync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    const checkedTarget = destinationFor(root, entry.relativePath, filesystem);

    if (!isText(checkedTarget) || checkedTarget !== target) {
      unlinkSync(temporary);

      return !isText(checkedTarget) ? checkedTarget : refuse(CONTAINED_GLTF_REFUSALS.destinationEscape, "The project asset destination changed during copy.");
    }

    if (existsSync(target)) {
      const latestDigest = sha256(readFileSync(target));

      if (latestDigest !== entry.digest && latestDigest !== entry.validation.replacesDigest) {
        unlinkSync(temporary);

        return refuse(CONTAINED_GLTF_REFUSALS.destinationConflict, "The project asset copy changed during materialization.");
      }

      renameSync(temporary, target);
    }
    else {
      linkSync(temporary, target);
      unlinkSync(temporary);
    }

    syncDirectory(directory, filesystem);

    return Object.freeze({ copied: true, path: entry.relativePath });
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);

    if (existsSync(temporary)) unlinkSync(temporary);

    if (existsSync(target)) {
      try {
        if (!filesystem.inspect(target).isSymbolicLink() && sha256(readFileSync(target)) === entry.digest) {
          return Object.freeze({ copied: false, path: entry.relativePath });
        }
      } catch {
        // The fixed copy refusal below owns this boundary.
      }
    }

    return refuse(
      CONTAINED_GLTF_REFUSALS.copyFailed,
      `The accepted project asset copy could not be materialized: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function materializeProjectAssetCopies(input: Readonly<{
  projectRoot: string;
  documentPath: string;
  filesystem?: AssetCopyFilesystem;
}>): MaterializeAssetCopiesResult {
  const root = canonicalExistingDirectory(input.projectRoot);

  if (root === null) {
    return refuse(CONTAINED_GLTF_REFUSALS.projectRootInvalid, "The project root must be an existing absolute directory.");
  }

  const document = canonicalTarget(resolve(root, input.documentPath));

  if (document === null || !contained(root, document)) {
    return refuse(CONTAINED_GLTF_REFUSALS.documentOutsideRoot, "The Scene Document resolves outside the selected project root.");
  }

  let parsed;

  try {
    parsed = parseDocumentText(readFileSync(document, "utf8"));
  } catch {
    return refuse(CONTAINED_GLTF_REFUSALS.sceneInvalid, "The Scene Document cannot be read for asset recovery.");
  }

  if (!parsed.ok) {
    return refuse(CONTAINED_GLTF_REFUSALS.sceneInvalid, "The Scene Document is invalid during asset recovery.");
  }

  const manifest = projectAssetManifestFromDocumentData(parsed.document.data);

  if (!manifest.ok) return manifest;
  const copied: string[] = [];
  const existing: string[] = [];

  for (const entry of manifest.value.assets) {
    const result = copyEntry(root, entry, input.filesystem ?? nativeAssetCopyFilesystem);

    if ("ok" in result) return result;
    (result.copied ? copied : existing).push(result.path);
  }

  return Object.freeze({
    ok: true as const,
    copiedPaths: Object.freeze(copied),
    existingPaths: Object.freeze(existing),
  });
}

function isText(value: AssetJsonValue): value is string {
  return typeof value === "string";
}

function isNumber(value: AssetJsonValue): value is number {
  return typeof value === "number";
}

function isObjectRepresentation(value: AssetJsonValue): value is JsonObject | readonly JsonValue[] | null {
  return typeof value === "object";
}

function isContainedModelEntry(entry: ProjectAssetManifestEntry): entry is ContainedGltfProjection["entry"] {
  return entry.family === "model" &&
    (entry.mediaType === "model/gltf-binary" || entry.mediaType === "model/gltf+json") &&
    entry.profile === CONTAINED_GLTF_PROFILE_ID &&
    isText(entry.artifactId) && isText(entry.instanceId);
}
