/**
 * Deterministic static Web export for one contained desktop project.
 *
 * The export is a content-addressed directory. It carries the exact source
 * Scene Document, every referenced project asset, a validated MountableScene,
 * the packaged desktop renderer bytes, and a Delivery Handoff manifest. It
 * never contacts a provider or delivery service and never overwrites an
 * existing, non-identical directory.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { contentHash, parseDocumentText } from "@sceneaxi/authoring-core";
import {
  DESKTOP_PRODUCT_REFUSALS,
  DESKTOP_WEB_STAGE_CONFIG,
} from "@sceneaxi/desktop-shell";
import {
  PROJECT_ASSET_MAX_BYTES,
  projectAssetManifestFromDocumentData,
  type ProjectAssetManifestEntry,
} from "@sceneaxi/importers";
import {
  DELIVERY_HANDOFF_KIND,
  DELIVERY_HANDOFF_SCHEMA_VERSION,
  computeDeliveryArtifactSetDigest,
  validateDeliveryHandoff,
  type DeliveryHandoff,
  type DeliveryHandoffArtifact,
  type DeliveryHandoffArtifacts,
  type JsonValue,
  type SceneDocument,
} from "@sceneaxi/schemas";
import { DESKTOP_ACTIVE_DOCUMENT_PATH } from "./bridge-contract.js";
import { desktopSceneFromDocumentData } from "./desktop-scene.js";

export const DESKTOP_WEB_EXPORT_VERSION = 1 as const;
export const DESKTOP_WEB_EXPORT_TOOL_VERSION = "0.0.0" as const;
export const DESKTOP_WEB_EXPORT_ROOT = "exports/web" as const;
export const DESKTOP_WEB_EXPORT_HANDOFF_PATH = "delivery-handoff.json" as const;

export const DESKTOP_WEB_EXPORT_REFUSALS = Object.freeze({
  requestMalformed: "DESKTOP_WEB_EXPORT_REQUEST_MALFORMED",
  projectDirty: DESKTOP_PRODUCT_REFUSALS.exportDirty,
  projectChanged: "DESKTOP_WEB_EXPORT_PROJECT_CHANGED",
  sceneInvalid: "DESKTOP_WEB_EXPORT_SCENE_INVALID",
  assetManifestInvalid: "DESKTOP_WEB_EXPORT_ASSET_MANIFEST_INVALID",
  assetMissing: "DESKTOP_WEB_EXPORT_ASSET_MISSING",
  assetInvalid: "DESKTOP_WEB_EXPORT_ASSET_INVALID",
  unsafePath: "DESKTOP_WEB_EXPORT_UNSAFE_PATH",
  runtimeMissing: "DESKTOP_WEB_EXPORT_RUNTIME_MISSING",
  handoffInvalid: "DESKTOP_WEB_EXPORT_HANDOFF_INVALID",
  destinationConflict: "DESKTOP_WEB_EXPORT_DESTINATION_CONFLICT",
  writeFailed: "DESKTOP_WEB_EXPORT_WRITE_FAILED",
} as const);

export type DesktopWebExportRefusalReason =
  (typeof DESKTOP_WEB_EXPORT_REFUSALS)[keyof typeof DESKTOP_WEB_EXPORT_REFUSALS];

export type DesktopWebExportRefusal = Readonly<{
  ok: false;
  reason: DesktopWebExportRefusalReason;
  message: string;
}>;

export type DesktopWebExportSuccess = Readonly<{
  ok: true;
  replayed: boolean;
  outputDirectory: string;
  handoffPath: string;
  sourceProject: Readonly<{
    documentId: string;
    contentHash: string;
    sceneDigest: string;
  }>;
  bundleDigest: string;
  artifactPaths: readonly string[];
  handoff: DeliveryHandoff;
}>;

export type DesktopWebExportResult =
  | DesktopWebExportSuccess
  | DesktopWebExportRefusal;

export type DesktopWebExportInput = Readonly<{
  projectRoot: string;
  documentPath: typeof DESKTOP_ACTIVE_DOCUMENT_PATH;
  expectedContentHash: string;
  runtimeJavaScript: Uint8Array;
  publisherExecutable: string;
}>;

type ExportFile = Readonly<{
  path: string;
  byteLength: number;
  bytes?: Uint8Array;
  artifact: DeliveryHandoffArtifact;
}>;

type ExpectedFile = Readonly<{
  byteLength: number;
  digest: string;
  bytes?: Uint8Array;
}>;

type ExportParent = Readonly<{
  rootDescriptor: number;
  exportsDescriptor: number;
  webDescriptor: number;
  webDirectory: string;
}>;

type ExportWorkspace = Readonly<{
  stagingDescriptor: number;
  stagingDirectory: string;
  stagingName: string;
}>;

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const SAFE_ASSET_PATH_RE = new RegExp(DESKTOP_WEB_STAGE_CONFIG.assetPathPattern);
const CREATED_AT = "1970-01-01T00:00:00.000Z";
const STREAM_BUFFER_BYTES = 64 * 1024;

class UnsafeExportPathError extends Error {}

function refuse(
  reason: DesktopWebExportRefusalReason,
  message: string,
): DesktopWebExportRefusal {
  return Object.freeze({ ok: false as const, reason, message });
}

function exportPreparationRefusal(error: unknown, operation: string) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : null;
  const unsafe =
    error instanceof UnsafeExportPathError ||
    code === "ELOOP" ||
    code === "ENOTDIR" ||
    code === "ENOENT";
  return refuse(
    unsafe
      ? DESKTOP_WEB_EXPORT_REFUSALS.unsafePath
      : DESKTOP_WEB_EXPORT_REFUSALS.writeFailed,
    `The project-owned export ${operation} could not be prepared: ${error instanceof Error ? error.message : String(error)}`,
  );
}

function sha256(bytes: Uint8Array | string) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as Readonly<Record<string, JsonValue>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key] ?? null)}`)
    .join(",")}}`;
}

function utf8(value: string): Uint8Array {
  return Buffer.from(value, "utf8");
}

function runtimeBoundToolVersion(runtimeDigest: string): string {
  return `${DESKTOP_WEB_EXPORT_TOOL_VERSION}+export.${String(DESKTOP_WEB_EXPORT_VERSION)}.renderer.${runtimeDigest.slice("sha256:".length)}`;
}

function deliveryDisplayName(document: SceneDocument): string {
  const source = document.title?.trim() || document.id;
  const scalars: string[] = [];
  for (let index = 0; index < source.length && scalars.length < 200;) {
    const first = source.charCodeAt(index);
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = source.charCodeAt(index + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        scalars.push(source.slice(index, index + 2));
        index += 2;
      } else {
        scalars.push("\ufffd");
        index += 1;
      }
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      scalars.push("\ufffd");
      index += 1;
    } else {
      scalars.push(source[index] ?? "");
      index += 1;
    }
  }
  return scalars.join("");
}

function contentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html";
    case ".js":
      return "application/javascript";
    case ".json":
      return "application/json";
    case ".glb":
      return "model/gltf-binary";
    case ".gltf":
      return "model/gltf+json";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function within(parent: string, candidate: string): boolean {
  const rel = relative(parent, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function pathEntryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) return false;
    throw error;
  }
}

type ContainedFileRead =
  | Readonly<{ ok: true; bytes: Buffer }>
  | Readonly<{ ok: false; kind: "missing" | "unsafe" | "invalid"; detail: string }>;

function openContainedRegularFile(root: string, target: string) {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(
      target,
      constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
    );
    const stats = fstatSync(descriptor);
    if (!stats.isFile()) {
      return Object.freeze({
        ok: false as const,
        kind: "unsafe" as const,
        detail: "the opened path is not a regular file",
      });
    }
    const canonical = realpathSync(`/proc/self/fd/${String(descriptor)}`);
    if (!within(root, canonical)) {
      return Object.freeze({
        ok: false as const,
        kind: "unsafe" as const,
        detail: "the opened file resolves outside the project root",
      });
    }
    const openedDescriptor = descriptor;
    descriptor = null;
    return Object.freeze({
      ok: true as const,
      descriptor: openedDescriptor,
      stats,
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : null;
    return Object.freeze({
      ok: false as const,
      kind:
        code === "ENOENT"
          ? "missing" as const
          : code === "ELOOP"
            ? "unsafe" as const
            : "invalid" as const,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function readContainedFile(
  root: string,
  target: string,
  limits: Readonly<{ maximumBytes?: number; expectedBytes?: number }> = {},
): ContainedFileRead {
  let descriptor: number | null = null;
  try {
    const opened = openContainedRegularFile(root, target);
    if (!opened.ok) return opened;
    descriptor = opened.descriptor;
    const before = opened.stats;
    if (
      !Number.isSafeInteger(before.size) ||
      before.size < 0 ||
      (limits.maximumBytes !== undefined && before.size > limits.maximumBytes) ||
      (limits.expectedBytes !== undefined && before.size !== limits.expectedBytes)
    ) {
      return Object.freeze({
        ok: false as const,
        kind: "invalid" as const,
        detail: "the opened file length is outside its accepted bounds",
      });
    }
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(
        descriptor,
        bytes,
        offset,
        bytes.byteLength - offset,
        null,
      );
      if (count === 0) {
        return Object.freeze({
          ok: false as const,
          kind: "invalid" as const,
          detail: "the opened file ended before its verified length",
        });
      }
      offset += count;
    }
    const trailing = Buffer.alloc(1);
    if (readSync(descriptor, trailing, 0, trailing.byteLength, null) !== 0) {
      return Object.freeze({
        ok: false as const,
        kind: "invalid" as const,
        detail: "the opened file grew beyond its verified length",
      });
    }
    const after = fstatSync(descriptor);
    if (bytes.byteLength !== before.size || after.size !== before.size) {
      return Object.freeze({
        ok: false as const,
        kind: "invalid" as const,
        detail: "the opened file length changed while it was being read",
      });
    }
    return Object.freeze({ ok: true as const, bytes });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : null;
    return Object.freeze({
      ok: false as const,
      kind:
        code === "ENOENT"
          ? "missing" as const
          : code === "ELOOP"
            ? "unsafe" as const
            : "invalid" as const,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch {
        descriptor = null;
      }
    }
  }
}

function openContainedDirectory(root: string, target: string) {
  const descriptor = openSync(
    target,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    if (!fstatSync(descriptor).isDirectory()) {
      throw new UnsafeExportPathError("the opened path is not a directory");
    }
    const canonical = realpathSync(`/proc/self/fd/${String(descriptor)}`);
    if (!within(root, canonical)) {
      throw new UnsafeExportPathError(
        "the opened directory resolves outside its containment root",
      );
    }
    return descriptor;
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
}

function openOrCreateDirectory(
  parentDescriptor: number,
  parent: string,
  name: string,
) {
  const target = join(`/proc/self/fd/${String(parentDescriptor)}`, name);
  try {
    mkdirSync(target);
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "EEXIST"
    ) throw error;
  }
  const directory = join(parent, name);
  const descriptor = openContainedDirectory(directory, target);
  if (realpathSync(`/proc/self/fd/${String(descriptor)}`) !== directory) {
    closeSync(descriptor);
    throw new UnsafeExportPathError(
      "the prepared export directory moved unexpectedly",
    );
  }
  return Object.freeze({ descriptor, directory });
}

function prepareExportParent(
  root: string,
): ExportParent | DesktopWebExportRefusal {
  let rootDescriptor: number | null = null;
  let exportsDescriptor: number | null = null;
  let webDescriptor: number | null = null;
  try {
    rootDescriptor = openContainedDirectory(root, root);
    const exports = openOrCreateDirectory(rootDescriptor, root, "exports");
    exportsDescriptor = exports.descriptor;
    const web = openOrCreateDirectory(exportsDescriptor, exports.directory, "web");
    webDescriptor = web.descriptor;
    return Object.freeze({
      rootDescriptor,
      exportsDescriptor,
      webDescriptor,
      webDirectory: web.directory,
    });
  } catch (error) {
    for (const descriptor of [
      webDescriptor,
      exportsDescriptor,
      rootDescriptor,
    ]) {
      if (descriptor === null) continue;
      try {
        closeSync(descriptor);
      } catch {}
    }
    return exportPreparationRefusal(error, "workspace");
  }
}

function prepareExportWorkspace(
  parent: ExportParent,
): ExportWorkspace | DesktopWebExportRefusal {
  try {
    const stableWeb = `/proc/self/fd/${String(parent.webDescriptor)}`;
    const stagingAccess = mkdtempSync(join(stableWeb, ".sceneaxi-export-"));
    const stagingName = basename(stagingAccess);
    const stagingDirectory = join(parent.webDirectory, stagingName);
    const stagingDescriptor = openContainedDirectory(
      stagingDirectory,
      stagingAccess,
    );
    return Object.freeze({
      stagingDescriptor,
      stagingDirectory,
      stagingName,
    });
  } catch (error) {
    return exportPreparationRefusal(error, "staging directory");
  }
}

function cleanupExportWorkspace(
  workspace: ExportWorkspace,
  parent: ExportParent,
  publisherExecutable: string,
  published: boolean,
) {
  try {
    const held = fstatSync(workspace.stagingDescriptor);
    const occupant = lstatSync(
      join(
        `/proc/self/fd/${String(parent.webDescriptor)}`,
        workspace.stagingName,
      ),
    );
    if (
      held.isDirectory() &&
      occupant.isDirectory() &&
      held.dev === occupant.dev &&
      held.ino === occupant.ino &&
      !published
    ) {
      execFileSync(publisherExecutable, ["clean"], {
        stdio: ["ignore", "ignore", "ignore", workspace.stagingDescriptor],
      });
    }
  } catch {}
  try {
    closeSync(workspace.stagingDescriptor);
  } catch {}
}

function cleanupExportParent(parent: ExportParent) {
  for (const descriptor of [parent.webDescriptor, parent.exportsDescriptor, parent.rootDescriptor]) {
    try {
      closeSync(descriptor);
    } catch {}
  }
}

function matchesContainedFileSet(
  root: string,
  directory: string,
  expectedPaths: ReadonlySet<string>,
): boolean {
  const expectedDirectories = new Set<string>();
  for (const path of expectedPaths) {
    const segments = path.split("/");
    if (segments.some((segment) => segment === "")) return false;
    for (let index = 1; index < segments.length; index += 1) {
      expectedDirectories.add(segments.slice(0, index).join("/"));
    }
  }
  let foundFiles = 0;
  const visit = (target: string, prefix: string): boolean => {
    let descriptor: number | null = null;
    let entries: ReturnType<typeof opendirSync> | null = null;
    try {
      descriptor = openContainedDirectory(root, target);
      const stableDirectory = `/proc/self/fd/${String(descriptor)}`;
      entries = opendirSync(stableDirectory);
      for (
        let entry = entries.readSync();
        entry !== null;
        entry = entries.readSync()
      ) {
        const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
        if (entry.isDirectory()) {
          if (!expectedDirectories.has(path)) return false;
          if (!visit(join(stableDirectory, entry.name), path)) return false;
        } else if (entry.isFile()) {
          if (!expectedPaths.has(path)) return false;
          foundFiles += 1;
        } else {
          return false;
        }
      }
      return within(root, realpathSync(stableDirectory));
    } catch {
      return false;
    } finally {
      if (entries !== null) entries.closeSync();
      if (descriptor !== null) closeSync(descriptor);
    }
  };
  return visit(directory, "") && foundFiles === expectedPaths.size;
}

function openOutputFile(
  rootDescriptor: number,
  destination: string,
  path: string,
) {
  const segments = path.split("/");
  const name = segments.pop();
  if (name === undefined || name === "") throw new Error("invalid export path");
  let descriptor = rootDescriptor;
  const opened: number[] = [];
  try {
    for (const segment of segments) {
      const target = join(`/proc/self/fd/${String(descriptor)}`, segment);
      try {
        mkdirSync(target);
      } catch (error) {
        if (
          typeof error !== "object" ||
          error === null ||
          !("code" in error) ||
          error.code !== "EEXIST"
        ) throw error;
      }
      descriptor = openContainedDirectory(destination, target);
      opened.push(descriptor);
    }
    const stableDirectory = `/proc/self/fd/${String(descriptor)}`;
    if (!within(destination, realpathSync(stableDirectory))) {
      throw new Error("the export directory moved outside its destination");
    }
    return openSync(
      join(stableDirectory, name),
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
  } finally {
    for (const openedDescriptor of opened.reverse()) closeSync(openedDescriptor);
  }
}

function writeOutputFile(
  rootDescriptor: number,
  destination: string,
  path: string,
  bytes: Uint8Array,
) {
  const descriptor = openOutputFile(rootDescriptor, destination, path);
  try {
    writeFileSync(descriptor, bytes);
  } finally {
    closeSync(descriptor);
  }
}

type StreamedFile =
  | Readonly<{ ok: true; byteLength: number; digest: string }>
  | Readonly<{ ok: false; kind: "missing" | "unsafe" | "invalid"; detail: string }>;

function streamContainedFile(
  root: string,
  source: string,
  limits: Readonly<{ maximumBytes?: number; expectedBytes?: number }>,
  destination?: Readonly<{
    descriptor: number;
    directory: string;
    path: string;
  }>,
): StreamedFile {
  let sourceDescriptor: number | null = null;
  let destinationDescriptor: number | null = null;
  try {
    const opened = openContainedRegularFile(root, source);
    if (!opened.ok) return opened;
    sourceDescriptor = opened.descriptor;
    const before = opened.stats;
    if (
      !Number.isSafeInteger(before.size) ||
      before.size < 0 ||
      (limits.maximumBytes !== undefined && before.size > limits.maximumBytes) ||
      (limits.expectedBytes !== undefined && before.size !== limits.expectedBytes)
    ) {
      return Object.freeze({
        ok: false as const,
        kind: "invalid" as const,
        detail: "the opened file length is outside its accepted bounds",
      });
    }
    if (destination !== undefined) {
      destinationDescriptor = openOutputFile(
        destination.descriptor,
        destination.directory,
        destination.path,
      );
    }
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(Math.min(STREAM_BUFFER_BYTES, Math.max(1, before.size)));
    let byteLength = 0;
    while (byteLength < before.size) {
      const count = readSync(
        sourceDescriptor,
        buffer,
        0,
        Math.min(buffer.byteLength, before.size - byteLength),
        null,
      );
      if (count === 0) {
        return Object.freeze({
          ok: false as const,
          kind: "invalid" as const,
          detail: "the opened file ended before its verified length",
        });
      }
      hash.update(buffer.subarray(0, count));
      if (destinationDescriptor !== null) {
        let written = 0;
        while (written < count) {
          const next = writeSync(
            destinationDescriptor,
            buffer,
            written,
            count - written,
          );
          if (next === 0) throw new Error("the export file write made no progress");
          written += next;
        }
      }
      byteLength += count;
    }
    const trailing = Buffer.alloc(1);
    if (readSync(sourceDescriptor, trailing, 0, 1, null) !== 0) {
      return Object.freeze({
        ok: false as const,
        kind: "invalid" as const,
        detail: "the opened file grew beyond its verified length",
      });
    }
    if (fstatSync(sourceDescriptor).size !== before.size) {
      return Object.freeze({
        ok: false as const,
        kind: "invalid" as const,
        detail: "the opened file length changed while it was being read",
      });
    }
    return Object.freeze({
      ok: true as const,
      byteLength,
      digest: `sha256:${hash.digest("hex")}`,
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : null;
    return Object.freeze({
      ok: false as const,
      kind:
        code === "ENOENT"
          ? "missing" as const
          : code === "ELOOP"
            ? "unsafe" as const
            : "invalid" as const,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (destinationDescriptor !== null) closeSync(destinationDescriptor);
    if (sourceDescriptor !== null) closeSync(sourceDescriptor);
  }
}

function readProjectDocument(
  root: string,
  expectedBytes?: number,
): Readonly<{ ok: true; bytes: Buffer }> | DesktopWebExportRefusal {
  const documentFile = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
  const read = readContainedFile(
    root,
    documentFile,
    expectedBytes === undefined ? {} : { expectedBytes },
  );
  if (!read.ok) {
    if (read.kind === "unsafe") {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
        "The active Scene Document must be a regular project file.",
      );
    }
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid,
      `The active Scene Document could not be read: ${read.detail}`,
    );
  }
  return read;
}

function referencedWebAssets(data: Readonly<Record<string, unknown>>):
  | Readonly<{ ok: true; paths: readonly string[] }>
  | DesktopWebExportRefusal {
  const value = data["webExperience"];
  if (value === undefined) return Object.freeze({ ok: true as const, paths: Object.freeze([]) });
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid,
      "The stored webExperience value is not an object.",
    );
  }
  const record = value as Record<string, unknown>;
  const html = record["html"];
  const assets = record["assets"];
  if (
    typeof html !== "string" ||
    html.length > DESKTOP_WEB_STAGE_CONFIG.htmlMaxLength ||
    html.includes("\0") ||
    !Array.isArray(assets) ||
    assets.length > DESKTOP_WEB_STAGE_CONFIG.assetMaxCount ||
    !assets.every(
      (path) =>
        typeof path === "string" &&
        path.length <= DESKTOP_WEB_STAGE_CONFIG.assetPathMaxLength &&
        SAFE_ASSET_PATH_RE.test(path),
    )
  ) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid,
      "The stored Web Experience HTML or asset list is outside the accepted desktop bounds.",
    );
  }
  return Object.freeze({
    ok: true as const,
    paths: Object.freeze(assets.map((path) => String(path)).sort()),
  });
}

function readProjectAsset(
  root: string,
  path: string,
  manifestEntry?: ProjectAssetManifestEntry,
  workspace?: ExportWorkspace,
): ExportFile | DesktopWebExportRefusal {
  if (!SAFE_ASSET_PATH_RE.test(path)) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
      `Referenced asset path ${JSON.stringify(path)} is not a normalized project-relative assets/ path.`,
    );
  }
  const target = resolve(root, path);
  if (!within(root, target)) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
      `Referenced project asset ${path} resolves outside the project root.`,
    );
  }
  const read = streamContainedFile(
    root,
    target,
    {
      maximumBytes: PROJECT_ASSET_MAX_BYTES,
      ...(manifestEntry === undefined
        ? {}
        : { expectedBytes: manifestEntry.byteLength }),
    },
    workspace === undefined
      ? undefined
      : {
          descriptor: workspace.stagingDescriptor,
          directory: workspace.stagingDirectory,
          path,
        },
  );
  if (!read.ok) {
    if (read.kind === "missing") {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.assetMissing,
        `Referenced project asset ${path} is missing.`,
      );
    }
    if (read.kind === "unsafe") {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
        `Referenced project asset ${path} must be a contained regular file: ${read.detail}.`,
      );
    }
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.assetInvalid,
      `Referenced project asset ${path} could not be verified: ${read.detail}.`,
    );
  }
  const digest = read.digest;
  if (manifestEntry !== undefined && digest !== manifestEntry.digest) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.assetInvalid,
      `Referenced project asset ${path} does not match its accepted manifest digest and length.`,
    );
  }
  return Object.freeze({
    path,
    byteLength: read.byteLength,
    artifact: Object.freeze({
      role: "asset-bundle" as const,
      contentType: manifestEntry?.mediaType ?? contentType(path),
      digest,
    }),
  });
}

function stageProjectAsset(
  root: string,
  captured: ExportFile,
  workspace: ExportWorkspace,
  manifestEntry?: ProjectAssetManifestEntry,
): DesktopWebExportRefusal | null {
  const target = join(
    `/proc/self/fd/${String(workspace.stagingDescriptor)}`,
    ...captured.path.split("/"),
  );
  if (pathEntryExists(target)) {
    const staged = streamContainedFile(
      workspace.stagingDirectory,
      target,
      { expectedBytes: captured.byteLength },
    );
    if (staged.ok && staged.digest === captured.artifact.digest) return null;
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.writeFailed,
      `Retained export staging for ${captured.path} has unexpected bytes.`,
    );
  }
  const staged = readProjectAsset(
    root,
    captured.path,
    manifestEntry,
    workspace,
  );
  if ("ok" in staged) return staged;
  if (
    staged.byteLength !== captured.byteLength ||
    staged.artifact.digest !== captured.artifact.digest
  ) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.assetInvalid,
      `Referenced project asset ${captured.path} changed while export staging was prepared.`,
    );
  }
  return null;
}

function revalidateProjectAssets(
  root: string,
  files: readonly ExportFile[],
  manifestByPath: ReadonlyMap<string, ProjectAssetManifestEntry>,
): DesktopWebExportRefusal | null {
  for (const captured of files) {
    const target = resolve(root, captured.path);
    const manifestEntry = manifestByPath.get(captured.path);
    const current = streamContainedFile(root, target, {
      maximumBytes: PROJECT_ASSET_MAX_BYTES,
      ...(manifestEntry === undefined
        ? {}
        : { expectedBytes: manifestEntry.byteLength }),
    });
    if (!current.ok) {
      return refuse(
        current.kind === "missing"
          ? DESKTOP_WEB_EXPORT_REFUSALS.assetMissing
          : current.kind === "unsafe"
            ? DESKTOP_WEB_EXPORT_REFUSALS.unsafePath
            : DESKTOP_WEB_EXPORT_REFUSALS.assetInvalid,
        `Referenced project asset ${captured.path} could not be revalidated: ${current.detail}.`,
      );
    }
    if (
      current.byteLength !== captured.byteLength ||
      current.digest !== captured.artifact.digest
    ) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.assetInvalid,
        `Referenced project asset ${captured.path} changed while the static Web export was being written.`,
      );
    }
  }
  return null;
}

function staticIndex(document: SceneDocument, sourceDigest: string): string {
  const title = document.title?.trim() || document.id;
  const escapedTitle = title
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="sceneaxi-static-web-export" content="v${String(DESKTOP_WEB_EXPORT_VERSION)}">
  <meta name="sceneaxi-source-project-digest" content="${sourceDigest}">
  <meta name="sceneaxi-pixels-drawn" content="false">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>${escapedTitle} · SceneAxi Web Export</title>
  <style>
    :root{color-scheme:dark;font-family:ui-sans-serif,system-ui,sans-serif;background:#111113;color:#f2f0eb}
    *{box-sizing:border-box}html,body{height:100%;margin:0}body{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}
    header{display:flex;align-items:center;gap:14px;padding:12px 16px;border-bottom:1px solid #36363b;background:#19191d}
    h1{font-size:14px;margin:0;font-weight:650}header p{margin:0;color:#aaa7a0;font:11px ui-monospace,SFMono-Regular,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    header a{margin-left:auto;color:#ffb65c;text-underline-offset:3px}.viewport{position:relative;min-height:0;overflow:hidden;background:radial-gradient(circle at 50% 42%,#29272b 0,#161619 58%,#111113 100%)}
    .viewport-backdrop{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:32px 32px}
    .viewport-note{position:absolute;left:16px;right:16px;bottom:12px;z-index:3;margin:0;padding:8px 10px;border:1px solid #55483a;border-radius:4px;background:#171719dd;color:#d8d4cd;font:11px/1.45 ui-monospace,SFMono-Regular,monospace}
  </style>
</head>
<body>
  <header><h1>${escapedTitle}</h1><p>${document.id} · ${sourceDigest}</p><a href="./delivery-handoff.json">Delivery Handoff</a></header>
  <main class="viewport" aria-label="Exported SceneAxi scene"><div class="viewport-backdrop" aria-hidden="true"></div><p class="viewport-note viewport-note-inert">Opening the contained exported scene…</p></main>
  <script src="./sceneaxi-scene.js"></script>
  <script src="./sceneaxi-web.js"></script>
</body>
</html>
`;
}

function sceneBridgeJavaScript(scene: JsonValue): string {
  return `(() => {
  "use strict";
  const scene = Object.freeze(${canonicalJson(scene)});
  const refusal = Object.freeze({
    ok: false,
    reason: "STATIC_WEB_KERNEL_UNAVAILABLE",
    message: "This deterministic static export draws the exported scene but carries no live kernel session or deployment authority.",
    detail: null
  });
  const port = Object.freeze({
    request: async (request) => {
      if (request && request.action === "scene") return Object.freeze({ ok: true, action: "scene", data: scene });
      if (request && request.action === "frame-report") return Object.freeze({ ok: true, action: "frame-report", data: Object.freeze({ received: true }) });
      return refusal;
    }
  });
  Object.defineProperty(globalThis, "sceneaxiDesktopLinux", { value: port, configurable: false, enumerable: false, writable: false });
})();
`;
}

function verifyExistingOutput(
  directory: string,
  expected: ReadonlyMap<string, ExpectedFile>,
  accessPath = directory,
): boolean {
  try {
    const expectedPaths = new Set(expected.keys());
    if (!matchesContainedFileSet(directory, accessPath, expectedPaths)) {
      return false;
    }
    for (const [path, file] of expected) {
      const actual = streamContainedFile(
        directory,
        join(accessPath, ...path.split("/")),
        { expectedBytes: file.byteLength },
      );
      if (!actual.ok || actual.digest !== file.digest) return false;
    }
    return matchesContainedFileSet(directory, accessPath, expectedPaths);
  } catch {
    return false;
  }
}

function inspectExistingOutput(
  parent: ExportParent,
  destination: string,
  expected: ReadonlyMap<string, ExpectedFile>,
): Readonly<{ ok: true; replayed: true }> | DesktopWebExportRefusal | null {
  const destinationName = relative(parent.webDirectory, destination);
  const stableParent = `/proc/self/fd/${String(parent.webDescriptor)}`;
  const stableDestination = join(stableParent, destinationName);
  try {
    if (
      destinationName === "" ||
      destinationName === ".." ||
      destinationName.startsWith(`..${sep}`) ||
      destinationName.includes(sep) ||
      realpathSync(stableParent) !== parent.webDirectory
    ) {
      throw new Error("the export parent moved or the destination name is unsafe");
    }
    if (!pathEntryExists(stableDestination)) return null;
    if (verifyExistingOutput(destination, expected, stableDestination)) {
      return Object.freeze({ ok: true as const, replayed: true as const });
    }
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
      `The content-addressed export directory already exists with different or unsafe bytes: ${destination}`,
    );
  } catch (error) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
      `The content-addressed export destination could not be inspected safely: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function writeOutput(
  parent: ExportParent,
  workspace: ExportWorkspace,
  destination: string,
  expected: ReadonlyMap<string, ExpectedFile>,
  publisherExecutable: string,
): Readonly<{ ok: true; replayed: boolean }> | DesktopWebExportRefusal {
  const stableParent = `/proc/self/fd/${String(parent.webDescriptor)}`;
  const destinationName = relative(parent.webDirectory, destination);
  const stableDestination = join(stableParent, destinationName);
  const stableStaging = join(stableParent, workspace.stagingName);
  try {
    if (
      destinationName === "" ||
      destinationName === ".." ||
      destinationName.startsWith(`..${sep}`) ||
      destinationName.includes(sep) ||
      realpathSync(stableParent) !== parent.webDirectory
    ) {
      throw new Error("the export parent moved or the destination name is unsafe");
    }
    if (pathEntryExists(stableDestination)) {
      if (verifyExistingOutput(destination, expected, stableDestination)) {
        return Object.freeze({ ok: true as const, replayed: true });
      }
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
        `The content-addressed export directory already exists with different or unsafe bytes: ${destination}`,
      );
    }

    for (const [path, file] of expected) {
      const target = join(stableStaging, ...path.split("/"));
      if (pathEntryExists(target)) {
        const staged = streamContainedFile(
          workspace.stagingDirectory,
          target,
          { expectedBytes: file.byteLength },
        );
        if (!staged.ok || staged.digest !== file.digest) {
          throw new Error(`staged export file ${path} has unexpected bytes`);
        }
      } else if (file.bytes !== undefined) {
        writeOutputFile(
          workspace.stagingDescriptor,
          workspace.stagingDirectory,
          path,
          file.bytes,
        );
      } else {
        throw new Error(`staged export file ${path} is missing`);
      }
    }

    if (!verifyExistingOutput(workspace.stagingDirectory, expected, stableStaging)) {
      throw new Error("the completed staging directory failed verification");
    }

    execFileSync(
      publisherExecutable,
      [
        "publish",
        workspace.stagingName,
        destinationName,
      ],
      {
        stdio: [
          "ignore",
          "ignore",
          "ignore",
          parent.rootDescriptor,
          parent.webDescriptor,
          workspace.stagingDescriptor,
        ],
      },
    );

    if (pathEntryExists(stableStaging)) {
      if (verifyExistingOutput(destination, expected, stableDestination)) {
        return Object.freeze({ ok: true as const, replayed: true });
      }
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
        `The content-addressed export directory was occupied during publication: ${destination}`,
      );
    }
    if (realpathSync(stableParent) !== parent.webDirectory) {
      throw new Error("the export parent moved during commit");
    }
    if (!verifyExistingOutput(destination, expected, stableDestination)) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
        `The published content-addressed export changed before verification: ${destination}`,
      );
    }
    return Object.freeze({ ok: true as const, replayed: false });
  } catch (error) {
    try {
      if (
        realpathSync(stableParent) === parent.webDirectory &&
        pathEntryExists(stableDestination)
      ) {
        if (verifyExistingOutput(destination, expected, stableDestination)) {
          return Object.freeze({
            ok: true as const,
            replayed: pathEntryExists(stableStaging),
          });
        }
        return refuse(
          DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
          `The content-addressed export directory was occupied during publication: ${destination}`,
        );
      }
    } catch {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
        `The content-addressed export destination could not be inspected after a failed commit: ${destination}`,
      );
    }
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.writeFailed,
      `The static Web export could not be committed exclusively: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Export one validated, clean project without deploying or overwriting bytes. */
export function exportDesktopWebProject(
  input: DesktopWebExportInput,
): DesktopWebExportResult {
  if (
    input.documentPath !== DESKTOP_ACTIVE_DOCUMENT_PATH ||
    !isAbsolute(input.projectRoot) ||
    !DIGEST_RE.test(input.expectedContentHash) ||
    !isAbsolute(input.publisherExecutable)
  ) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.requestMalformed,
      "Web export requires absolute project and publisher paths, scene.json, and the exact current content hash.",
    );
  }
  if (input.runtimeJavaScript.byteLength === 0) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.runtimeMissing,
      "The packaged static Web renderer bytes are unavailable.",
    );
  }

  let root: string;
  try {
    root = realpathSync(input.projectRoot);
    if (!statSync(root).isDirectory()) throw new Error("project root is not a directory");
  } catch (error) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid,
      `The project root could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const sourceDocument = readProjectDocument(root);
  if (!sourceDocument.ok) return sourceDocument;
  const documentBytes = sourceDocument.bytes;

  const exactHash = contentHash(documentBytes.toString("utf8"));
  if (exactHash !== input.expectedContentHash) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.projectChanged,
      "scene.json changed after the desktop authoring status was read; reopen it before exporting.",
    );
  }
  const parsed = parseDocumentText(documentBytes.toString("utf8"));
  if (!parsed.ok) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid,
      `The active Scene Document is invalid: ${parsed.message}`,
    );
  }
  const scene = desktopSceneFromDocumentData(parsed.document.data);
  if (!scene.ok) {
    return refuse(DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid, scene.message);
  }

  const manifest = projectAssetManifestFromDocumentData(parsed.document.data);
  if (!manifest.ok) {
    return refuse(DESKTOP_WEB_EXPORT_REFUSALS.assetManifestInvalid, manifest.message);
  }
  const webAssets = referencedWebAssets(parsed.document.data);
  if (!webAssets.ok) return webAssets;

  const manifestByPath = new Map(
    manifest.value.assets.map((entry) => [entry.relativePath, entry] as const),
  );
  const assetPaths = [...new Set([
    ...manifest.value.assets.map((entry) => entry.relativePath),
    ...webAssets.paths,
  ])].sort();
  const assetFiles: ExportFile[] = [];
  for (const path of assetPaths) {
    const file = readProjectAsset(root, path, manifestByPath.get(path));
    if ("ok" in file) return file;
    assetFiles.push(file);
  }

  const sourceDigest = sha256(documentBytes);
  const runtimeDigest = sha256(input.runtimeJavaScript);
  const toolVersion = runtimeBoundToolVersion(runtimeDigest);
  const toolVersionBytes = utf8(`${toolVersion}\n`);
  if (sourceDigest !== exactHash) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid,
      "The source project byte digest disagrees with the authoring content hash.",
    );
  }
  const coreFiles = [
    Object.freeze({
      path: "index.html",
      bytes: utf8(staticIndex(parsed.document, sourceDigest)),
      artifact: Object.freeze({ role: "application" as const, contentType: "text/html", digest: "" }),
    }),
    Object.freeze({
      path: "sceneaxi-scene.js",
      bytes: utf8(sceneBridgeJavaScript(scene.mountable as unknown as JsonValue)),
      artifact: Object.freeze({ role: "asset-bundle" as const, contentType: "application/javascript", digest: "" }),
    }),
    Object.freeze({
      path: "sceneaxi-web.js",
      bytes: Buffer.from(input.runtimeJavaScript),
      artifact: Object.freeze({ role: "application" as const, contentType: "application/javascript", digest: runtimeDigest }),
    }),
    Object.freeze({
      path: "sceneaxi-tool-version.txt",
      bytes: toolVersionBytes,
      artifact: Object.freeze({ role: "metadata" as const, contentType: "text/plain", digest: sha256(toolVersionBytes) }),
    }),
    Object.freeze({
      path: "source/scene.json",
      bytes: documentBytes,
      artifact: Object.freeze({ role: "metadata" as const, contentType: "application/json", digest: sourceDigest }),
    }),
  ].map((file) =>
    Object.freeze({
      ...file,
      byteLength: file.bytes.byteLength,
      artifact: file.artifact.digest === ""
        ? Object.freeze({ ...file.artifact, digest: sha256(file.bytes) })
        : file.artifact,
    }),
  );
  const files: ExportFile[] = [...coreFiles, ...assetFiles].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  const artifacts = Object.freeze(
    Object.fromEntries(files.map((file) => [file.path, file.artifact])),
  ) as DeliveryHandoffArtifacts;
  const handoff: DeliveryHandoff = Object.freeze({
    schemaVersion: DELIVERY_HANDOFF_SCHEMA_VERSION,
    kind: DELIVERY_HANDOFF_KIND,
    product: Object.freeze({
      id: parsed.document.id,
      displayName: deliveryDisplayName(parsed.document),
      version: toolVersion,
    }),
    target: "web",
    artifacts,
    artifactSetDigest: computeDeliveryArtifactSetDigest(artifacts),
    provenance: Object.freeze({
      createdAt: CREATED_AT,
      build: Object.freeze({
        id: `web-${sourceDigest.slice("sha256:".length)}`,
        tool: `@sceneaxi/desktop-linux@${toolVersion}/export-web-v${String(DESKTOP_WEB_EXPORT_VERSION)}`,
        startedAt: CREATED_AT,
        completedAt: CREATED_AT,
      }),
    }),
    notes:
      "Deterministic offline export. Provenance timestamps are the fixed v1 build epoch, not a wall-clock claim. source/scene.json contains the exact source project bytes. Creating this handoff performed no upload, deployment, signing, approval, or release.",
  });
  const validated = validateDeliveryHandoff(handoff);
  if (!validated.ok) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.handoffInvalid,
      validated.diagnostics[0]?.message ?? "The generated Delivery Handoff failed validation.",
    );
  }
  const handoffBytes = utf8(`${JSON.stringify(validated.handoff, null, 2)}\n`);
  const expected = new Map<string, ExpectedFile>(
    files.map((file) => [
      file.path,
      Object.freeze({
        byteLength: file.byteLength,
        digest: file.artifact.digest,
        ...(file.bytes === undefined ? {} : { bytes: file.bytes }),
      }),
    ] as const),
  );
  expected.set(
    DESKTOP_WEB_EXPORT_HANDOFF_PATH,
    Object.freeze({
      byteLength: handoffBytes.byteLength,
      digest: sha256(handoffBytes),
      bytes: handoffBytes,
    }),
  );

  const parent = prepareExportParent(root);
  if ("ok" in parent) return parent;
  let workspace: ExportWorkspace | null = null;
  let workspacePublished = false;
  try {
    const digestName = validated.handoff.artifactSetDigest.slice("sha256:".length);
    const destination = join(parent.webDirectory, digestName);
    const existing = inspectExistingOutput(parent, destination, expected);
    let written: Readonly<{ ok: true; replayed: boolean }>;
    if (existing !== null) {
      if (!existing.ok) return existing;
      written = existing;
    } else {
      const prepared = prepareExportWorkspace(parent);
      if ("ok" in prepared) return prepared;
      workspace = prepared;
      for (const asset of assetFiles) {
        const staged = stageProjectAsset(
          root,
          asset,
          workspace,
          manifestByPath.get(asset.path),
        );
        if (staged !== null) return staged;
      }
      const result = writeOutput(
        parent,
        workspace,
        destination,
        expected,
        input.publisherExecutable,
      );
      if (!result.ok) return result;
      workspacePublished = !result.replayed;
      written = result;
    }

    const movedAsset = revalidateProjectAssets(root, assetFiles, manifestByPath);
    if (movedAsset !== null) return movedAsset;

    // A source change during output construction refuses the result. The
    // content-addressed output remains valid evidence for the earlier bytes, but
    // it is not reported as the current project export.
    const currentDocument = readProjectDocument(root, documentBytes.byteLength);
    if (!currentDocument.ok) {
      if (currentDocument.reason === DESKTOP_WEB_EXPORT_REFUSALS.unsafePath) {
        return currentDocument;
      }
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.projectChanged,
        "scene.json could not be re-read after the static Web export was written.",
      );
    }
    if (sha256(currentDocument.bytes) !== sourceDigest) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.projectChanged,
        "scene.json changed while the static Web export was being written; the result was not reported as current.",
      );
    }

    if (!verifyExistingOutput(destination, expected)) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
        `The content-addressed export directory changed before it could be reported: ${destination}`,
      );
    }

    return Object.freeze({
      ok: true as const,
      replayed: written.replayed,
      outputDirectory: destination,
      handoffPath: join(destination, DESKTOP_WEB_EXPORT_HANDOFF_PATH),
      sourceProject: Object.freeze({
        documentId: parsed.document.id,
        contentHash: sourceDigest,
        sceneDigest: scene.mountable.sceneDigest,
      }),
      bundleDigest: validated.handoff.artifactSetDigest,
      artifactPaths: Object.freeze(files.map((file) => file.path)),
      handoff: validated.handoff,
    });
  } finally {
    if (workspace !== null) {
      cleanupExportWorkspace(
        workspace,
        parent,
        input.publisherExecutable,
        workspacePublished,
      );
    }
    cleanupExportParent(parent);
  }
}
