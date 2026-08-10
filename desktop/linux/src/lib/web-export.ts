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
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { contentHash, parseDocumentText } from "@sceneaxi/authoring-core";
import {
  DESKTOP_PRODUCT_REFUSALS,
  DESKTOP_WEB_STAGE_CONFIG,
} from "@sceneaxi/desktop-shell";
import {
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
}>;

type ExportFile = Readonly<{
  path: string;
  bytes: Uint8Array;
  artifact: DeliveryHandoffArtifact;
}>;

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const SAFE_ASSET_PATH_RE = new RegExp(DESKTOP_WEB_STAGE_CONFIG.assetPathPattern);
const CREATED_AT = "1970-01-01T00:00:00.000Z";

function refuse(
  reason: DesktopWebExportRefusalReason,
  message: string,
): DesktopWebExportRefusal {
  return Object.freeze({ ok: false as const, reason, message });
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

function readProjectDocument(
  root: string,
): Readonly<{ ok: true; bytes: Buffer }> | DesktopWebExportRefusal {
  const documentFile = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
  try {
    if (lstatSync(documentFile).isSymbolicLink() || !statSync(documentFile).isFile()) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
        "The active Scene Document must be a regular project file.",
      );
    }
    const canonicalDocument = realpathSync(documentFile);
    if (!within(root, canonicalDocument)) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
        "The active Scene Document resolves outside the project root.",
      );
    }
    return Object.freeze({ ok: true as const, bytes: readFileSync(canonicalDocument) });
  } catch (error) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid,
      `The active Scene Document could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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
): ExportFile | DesktopWebExportRefusal {
  if (!SAFE_ASSET_PATH_RE.test(path)) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
      `Referenced asset path ${JSON.stringify(path)} is not a normalized project-relative assets/ path.`,
    );
  }
  const target = resolve(root, path);
  if (!within(root, target) || !existsSync(target)) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.assetMissing,
      `Referenced project asset ${path} is missing.`,
    );
  }
  try {
    if (lstatSync(target).isSymbolicLink() || !statSync(target).isFile()) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
        `Referenced project asset ${path} must be a regular file, not a link or special file.`,
      );
    }
    const canonical = realpathSync(target);
    if (!within(root, canonical)) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
        `Referenced project asset ${path} resolves outside the project root.`,
      );
    }
    const bytes = readFileSync(canonical);
    const digest = sha256(bytes);
    if (
      manifestEntry !== undefined &&
      (digest !== manifestEntry.digest || bytes.byteLength !== manifestEntry.byteLength)
    ) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.assetInvalid,
        `Referenced project asset ${path} does not match its accepted manifest digest and length.`,
      );
    }
    return Object.freeze({
      path,
      bytes,
      artifact: Object.freeze({
        role: "asset-bundle" as const,
        contentType: manifestEntry?.mediaType ?? contentType(path),
        digest,
      }),
    });
  } catch (error) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.assetInvalid,
      `Referenced project asset ${path} could not be verified: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function revalidateProjectAssets(
  root: string,
  files: readonly ExportFile[],
  manifestByPath: ReadonlyMap<string, ProjectAssetManifestEntry>,
): DesktopWebExportRefusal | null {
  for (const captured of files) {
    const current = readProjectAsset(
      root,
      captured.path,
      manifestByPath.get(captured.path),
    );
    if ("ok" in current) return current;
    if (
      current.bytes.byteLength !== captured.bytes.byteLength ||
      current.artifact.digest !== captured.artifact.digest
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

function walkFiles(root: string, at = root): string[] {
  return readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
    const target = join(at, entry.name);
    const path = relative(root, target).split(sep).join("/");
    if (entry.isSymbolicLink()) return [`!${path}`];
    if (entry.isDirectory()) return walkFiles(root, target);
    return entry.isFile() ? [path] : [`!${path}`];
  });
}

function verifyExistingOutput(
  directory: string,
  expected: ReadonlyMap<string, Uint8Array>,
): boolean {
  try {
    if (lstatSync(directory).isSymbolicLink() || !statSync(directory).isDirectory()) return false;
    const actualPaths = walkFiles(directory).sort();
    const expectedPaths = [...expected.keys()].sort();
    if (
      actualPaths.length !== expectedPaths.length ||
      actualPaths.some((path, index) => path !== expectedPaths[index])
    ) return false;
    for (const [path, bytes] of expected) {
      const actual = readFileSync(join(directory, ...path.split("/")));
      if (!actual.equals(Buffer.from(bytes))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function ensureDirectory(parent: string, name: string): string | DesktopWebExportRefusal {
  const directory = join(parent, name);
  try {
    if (!pathEntryExists(directory)) mkdirSync(directory);
    if (lstatSync(directory).isSymbolicLink() || !statSync(directory).isDirectory()) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
        `Export path ${directory} is not a regular directory owned by the project.`,
      );
    }
    const canonical = realpathSync(directory);
    if (!within(parent, canonical)) {
      return refuse(
        DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
        `Export path ${directory} resolves outside its project-owned parent.`,
      );
    }
    return canonical;
  } catch (error) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.writeFailed,
      `Export directory ${directory} could not be prepared: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function writeOutput(
  parent: string,
  destination: string,
  expected: ReadonlyMap<string, Uint8Array>,
): Readonly<{ ok: true; replayed: boolean }> | DesktopWebExportRefusal {
  try {
    if (pathEntryExists(destination)) {
      return verifyExistingOutput(destination, expected)
        ? Object.freeze({ ok: true as const, replayed: true })
        : refuse(
            DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
            `The content-addressed export directory already exists with different or unsafe bytes: ${destination}`,
          );
    }
  } catch (error) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
      `The content-addressed export destination could not be inspected safely: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let temporary: string | null = null;
  try {
    temporary = mkdtempSync(join(parent, ".sceneaxi-export-"));
    for (const [path, bytes] of expected) {
      const target = join(temporary, ...path.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes, { flag: "wx" });
    }
    renameSync(temporary, destination);
    return Object.freeze({ ok: true as const, replayed: false });
  } catch (error) {
    if (temporary !== null && existsSync(temporary)) {
      rmSync(temporary, { recursive: true, force: true });
    }
    try {
      if (pathEntryExists(destination)) {
        return verifyExistingOutput(destination, expected)
          ? Object.freeze({ ok: true as const, replayed: true })
          : refuse(
              DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
              `The content-addressed export directory was occupied during commit: ${destination}`,
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
      `The static Web export could not be committed atomically: ${error instanceof Error ? error.message : String(error)}`,
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
    !DIGEST_RE.test(input.expectedContentHash)
  ) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.requestMalformed,
      "Web export requires an absolute project root, scene.json, and the exact current content hash.",
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
  if (sourceDigest !== exactHash) {
    return refuse(
      DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid,
      "The source project byte digest disagrees with the authoring content hash.",
    );
  }
  const coreFiles: ExportFile[] = [
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
      path: "source/scene.json",
      bytes: documentBytes,
      artifact: Object.freeze({ role: "metadata" as const, contentType: "application/json", digest: sourceDigest }),
    }),
  ].map((file) =>
    file.artifact.digest === ""
      ? Object.freeze({ ...file, artifact: Object.freeze({ ...file.artifact, digest: sha256(file.bytes) }) })
      : file,
  );
  const files = [...coreFiles, ...assetFiles].sort((left, right) =>
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
  const expected = new Map<string, Uint8Array>(
    files.map((file) => [file.path, file.bytes] as const),
  );
  expected.set(DESKTOP_WEB_EXPORT_HANDOFF_PATH, handoffBytes);

  const exportsDirectory = ensureDirectory(root, "exports");
  if (typeof exportsDirectory !== "string") return exportsDirectory;
  const webDirectory = ensureDirectory(exportsDirectory, "web");
  if (typeof webDirectory !== "string") return webDirectory;
  const destination = join(
    webDirectory,
    validated.handoff.artifactSetDigest.slice("sha256:".length),
  );
  const written = writeOutput(webDirectory, destination, expected);
  if (!written.ok) return written;

  const movedAsset = revalidateProjectAssets(root, assetFiles, manifestByPath);
  if (movedAsset !== null) return movedAsset;

  // A source change during output construction refuses the result. The
  // content-addressed output remains valid evidence for the earlier bytes, but
  // it is not reported as the current project export.
  const currentDocument = readProjectDocument(root);
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
}
