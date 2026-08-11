/**
 * Privileged, local-only browser for one contained SceneAxi project root.
 *
 * It projects the active Scene Document and the accepted asset manifest. It
 * never scans the directory and never creates another project or asset identity.
 * File contents never cross the browser seam: only canonical digests, typed
 * provenance, validation state, and project-relative paths do.
 */
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { contentHash, parseDocumentText } from "@sceneaxi/authoring-core";
import {
  CONTAINED_GLTF_REFUSALS,
  projectAssetManifestFromDocumentData,
} from "@sceneaxi/importers";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  type DesktopBridgeResponse,
} from "./bridge-contract.js";
import { readContainedRegularFile } from "./contained-file.js";
import {
  DESKTOP_PROJECT_BROWSER_ACTIONS,
  DESKTOP_PROJECT_BROWSER_REFUSALS,
  DESKTOP_PROJECT_BROWSER_STATE_SCHEMA_VERSION,
  projectBrowserRefuse,
  type DesktopProjectAssetFile,
  type DesktopProjectBrowserFile,
  type DesktopProjectBrowserResponse,
  type DesktopProjectBrowserStatus,
  type DesktopProjectBrowserValidation,
} from "./project-browser-contract.js";

const STATE_FILE = "project-browser.json";

type StoredBrowserState = Readonly<{
  schemaVersion: typeof DESKTOP_PROJECT_BROWSER_STATE_SCHEMA_VERSION;
  root: string;
  selectedPath: string;
}>;

export type DesktopProjectBrowserOptions = Readonly<{
  root: string;
  stateDirectory: string;
  isDirty?: () => boolean;
  openAsset?: (request: Readonly<{
    profile: "game" | "web";
    documentPath: typeof DESKTOP_ACTIVE_DOCUMENT_PATH;
    asset: DesktopProjectAssetFile;
  }>) => DesktopBridgeResponse;
}>;

export type DesktopProjectBrowser = Readonly<{
  handle(request: unknown): DesktopProjectBrowserResponse;
}>;

function own(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function valid(message = "Canonical bytes and metadata are valid."):
  DesktopProjectBrowserValidation {
  return Object.freeze({ state: "valid" as const, reason: null, message });
}

function invalid(
  state: Exclude<DesktopProjectBrowserValidation["state"], "valid">,
  reason: NonNullable<DesktopProjectBrowserValidation["reason"]>,
  message: string,
): DesktopProjectBrowserValidation {
  return Object.freeze({ state, reason, message });
}

function within(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function requestPath(value: unknown):
  | Readonly<{ ok: true; value: string }>
  | DesktopProjectBrowserResponse {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    return projectBrowserRefuse(
      DESKTOP_PROJECT_BROWSER_REFUSALS.requestMalformed,
      "A project-browser operation requires a non-empty project-relative path.",
    );
  }
  if (isAbsolute(value)) {
    return projectBrowserRefuse(
      DESKTOP_PROJECT_BROWSER_REFUSALS.pathOutsideRoot,
      "Project-browser paths must stay relative to the active contained root.",
      value,
    );
  }
  if (value.includes("\\") || value.split("/").includes("..")) {
    return projectBrowserRefuse(
      DESKTOP_PROJECT_BROWSER_REFUSALS.pathTraversal,
      "Project-browser paths may not contain traversal or platform-specific separators.",
      value,
    );
  }
  const resolved = resolve("/", value).slice(1);
  if (resolved !== value || value === "." || value.startsWith("/")) {
    return projectBrowserRefuse(
      DESKTOP_PROJECT_BROWSER_REFUSALS.pathTraversal,
      "The requested path is not a canonical project-relative path.",
      value,
    );
  }
  return Object.freeze({ ok: true as const, value });
}

function exactStoredState(value: unknown): StoredBrowserState | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  if (Object.keys(value).sort().join(",") !== "root,schemaVersion,selectedPath") return null;
  const schemaVersion = own(value, "schemaVersion");
  const root = own(value, "root");
  const selectedPath = own(value, "selectedPath");
  if (
    schemaVersion !== DESKTOP_PROJECT_BROWSER_STATE_SCHEMA_VERSION ||
    typeof root !== "string" ||
    typeof selectedPath !== "string"
  ) return null;
  return Object.freeze({ schemaVersion, root, selectedPath });
}

function assetValidation(root: string, path: string, expected: {
  readonly byteLength: number;
  readonly digest: string;
}): DesktopProjectBrowserValidation {
  const absolute = join(root, ...path.split("/"));
  if (!within(root, absolute)) {
    return invalid(
      "refused",
      DESKTOP_PROJECT_BROWSER_REFUSALS.pathOutsideRoot,
      "The admitted asset path resolves outside the contained project root.",
    );
  }
  const read = readContainedRegularFile(root, absolute, {
    expectedBytes: expected.byteLength,
  });
  if (!read.ok) {
    if (read.kind === "missing") {
      return invalid(
        "missing",
        DESKTOP_PROJECT_BROWSER_REFUSALS.fileMissing,
        "The manifest admits this asset, but its project copy is missing.",
      );
    }
    if (read.kind === "unsafe" && read.cause !== "nonregular") {
      return invalid(
        "refused",
        DESKTOP_PROJECT_BROWSER_REFUSALS.symlinkEscape,
        "Project asset symlinks and paths resolving outside the contained root are refused.",
      );
    }
    return invalid(
      "invalid",
      DESKTOP_PROJECT_BROWSER_REFUSALS.fileInvalid,
      "The admitted project copy could not be validated.",
    );
  }
  if (sha256(read.bytes) !== expected.digest) {
    return invalid(
      "invalid",
      DESKTOP_PROJECT_BROWSER_REFUSALS.fileInvalid,
      "The project copy does not match the manifest's canonical byte length and digest.",
    );
  }
  return valid("Project copy matches the accepted manifest bytes and digest.");
}

export function createDesktopProjectBrowser(
  options: DesktopProjectBrowserOptions,
): DesktopProjectBrowser {
  const root = realpathSync(options.root);
  const stateFile = join(options.stateDirectory, STATE_FILE);
  let initialized = false;
  let stateInvalid = false;
  let selectedPath = DESKTOP_ACTIVE_DOCUMENT_PATH;
  let writeSequence = 0;

  const initialize = (): DesktopProjectBrowserResponse | null => {
    if (initialized) return stateInvalid
      ? projectBrowserRefuse(
          DESKTOP_PROJECT_BROWSER_REFUSALS.stateInvalid,
          "The project-browser recent state is invalid and was left byte-identical.",
        )
      : null;
    initialized = true;
    const read = readContainedRegularFile(resolve(options.stateDirectory), stateFile);
    if (!read.ok) {
      stateInvalid = read.kind !== "missing";
    } else {
      try {
        const parsed = exactStoredState(JSON.parse(read.bytes.toString("utf8")));
        if (parsed === null) stateInvalid = true;
        else if (parsed.root === root) selectedPath = parsed.selectedPath;
      } catch {
        stateInvalid = true;
      }
    }
    return stateInvalid
      ? projectBrowserRefuse(
          DESKTOP_PROJECT_BROWSER_REFUSALS.stateInvalid,
          "The project-browser recent state is invalid and was left byte-identical.",
        )
      : null;
  };

  const persist = (): DesktopProjectBrowserResponse | null => {
    const bytes = `${JSON.stringify({
      schemaVersion: DESKTOP_PROJECT_BROWSER_STATE_SCHEMA_VERSION,
      root,
      selectedPath,
    })}\n`;
    const temporary = `${stateFile}.tmp-${process.pid}-${writeSequence++}`;
    let descriptor: number | null = null;
    try {
      mkdirSync(options.stateDirectory, { recursive: true });
      descriptor = openSync(temporary, "wx", 0o600);
      writeFileSync(descriptor, bytes, "utf8");
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = null;
      renameSync(temporary, stateFile);
      return null;
    } catch (error) {
      if (descriptor !== null) closeSync(descriptor);
      if (existsSync(temporary)) unlinkSync(temporary);
      return projectBrowserRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.stateWriteFailed,
        "The project-browser recent state could not be persisted atomically.",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const status = (): DesktopProjectBrowserStatus | DesktopProjectBrowserResponse => {
    const documentFile = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const read = readContainedRegularFile(root, documentFile);
    if (!read.ok) {
      if (read.kind === "missing") {
        return projectBrowserRefuse(
          DESKTOP_PROJECT_BROWSER_REFUSALS.documentMissing,
          `The contained root has no ${DESKTOP_ACTIVE_DOCUMENT_PATH}.`,
        );
      }
      if (read.kind === "unsafe") {
        return projectBrowserRefuse(
          DESKTOP_PROJECT_BROWSER_REFUSALS.symlinkEscape,
          `${DESKTOP_ACTIVE_DOCUMENT_PATH} must be a regular file directly inside the contained root.`,
        );
      }
      return projectBrowserRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.documentInvalid,
        `The active ${DESKTOP_ACTIVE_DOCUMENT_PATH} could not be read safely.`,
      );
    }
    const text = read.bytes.toString("utf8");
    const parsed = parseDocumentText(text);
    if (!parsed.ok) {
      return projectBrowserRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.documentInvalid,
        `${DESKTOP_ACTIVE_DOCUMENT_PATH} is not a valid Scene Document.`,
        parsed.message,
      );
    }
    const manifest = projectAssetManifestFromDocumentData(parsed.document.data);
    if (!manifest.ok) {
      return projectBrowserRefuse(
        manifest.reason === CONTAINED_GLTF_REFUSALS.duplicatePath
          ? DESKTOP_PROJECT_BROWSER_REFUSALS.duplicatePath
          : DESKTOP_PROJECT_BROWSER_REFUSALS.manifestInvalid,
        "The accepted project asset manifest is invalid, so assets were not enumerated.",
        manifest.message,
      );
    }
    const documentFileRecord: DesktopProjectBrowserFile = Object.freeze({
      kind: "document" as const,
      path: DESKTOP_ACTIVE_DOCUMENT_PATH,
      fileType: "scene-document" as const,
      mediaType: "application/vnd.sceneaxi.scene+json" as const,
      byteLength: Buffer.byteLength(text, "utf8"),
      digest: contentHash(text),
      provenance: Object.freeze({
        authority: "scene-document" as const,
        documentId: parsed.document.id,
        schemaVersion: parsed.document.schemaVersion,
        kind: parsed.document.kind,
      }),
      validation: valid("The active text-canonical Scene Document is valid."),
      mutable: false as const,
    });
    const assets: DesktopProjectAssetFile[] = manifest.value.assets.map((entry) =>
      Object.freeze({
        kind: "asset" as const,
        path: entry.relativePath,
        fileType: entry.mediaType === "model/gltf-binary"
          ? "contained-glb" as const
          : "contained-gltf" as const,
        mediaType: entry.mediaType,
        byteLength: entry.byteLength,
        digest: entry.digest,
        assetId: entry.assetId,
        sourceName: entry.sourceName,
        artifactId: entry.artifactId,
        instanceId: entry.instanceId,
        copyPolicy: entry.copyPolicy,
        provenance: entry.provenance,
        validation: assetValidation(root, entry.relativePath, entry),
        mutable: false as const,
      }),
    );
    const files = Object.freeze([documentFileRecord, ...assets]);
    if (!files.some((file) => file.path === selectedPath)) {
      selectedPath = DESKTOP_ACTIVE_DOCUMENT_PATH;
    }
    return Object.freeze({
      schemaVersion: DESKTOP_PROJECT_BROWSER_STATE_SCHEMA_VERSION,
      root,
      activeDocumentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      selectedPath,
      files,
    });
  };

  const ok = (
    outcome: "listed" | "selected" | "opened",
    value: DesktopProjectBrowserStatus,
  ): DesktopProjectBrowserResponse => Object.freeze({
    ok: true as const,
    action: "project-browser" as const,
    data: Object.freeze({ outcome, status: value }),
  });

  const selectedFile = (
    value: DesktopProjectBrowserStatus,
    path: string,
  ): DesktopProjectBrowserFile | DesktopProjectBrowserResponse => {
    const file = value.files.find((candidate) => candidate.path === path);
    if (file === undefined) {
      return projectBrowserRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.fileMissing,
        "The requested file is not the active Scene Document or an admitted manifest asset.",
        path,
      );
    }
    if (file.validation.state !== "valid") {
      return projectBrowserRefuse(
        file.validation.reason ?? DESKTOP_PROJECT_BROWSER_REFUSALS.fileInvalid,
        file.validation.message,
        path,
      );
    }
    return file;
  };

  return Object.freeze({
    handle(request: unknown): DesktopProjectBrowserResponse {
      const action = own(request, "action");
      const profile = own(request, "profile");
      if (profile === "kids") {
        return projectBrowserRefuse(
          DESKTOP_PROJECT_BROWSER_REFUSALS.kidsDenied,
          "The shared desktop Kids profile is refuse-only; project files were not read or changed.",
        );
      }
      if (
        (profile !== "game" && profile !== "web") ||
        typeof action !== "string" ||
        !(DESKTOP_PROJECT_BROWSER_ACTIONS as readonly string[]).includes(action)
      ) {
        return projectBrowserRefuse(
          DESKTOP_PROJECT_BROWSER_REFUSALS.requestMalformed,
          "A project-browser request requires a known action and the active game or web profile.",
        );
      }
      const initializedState = initialize();
      if (initializedState !== null) return initializedState;
      const current = status();
      if ("ok" in current) return current;
      if (action === "status") return ok("listed", current);

      const path = requestPath(own(request, "path"));
      if (!("value" in path)) return path;
      const file = selectedFile(current, path.value);
      if ("ok" in file) return file;

      if (action === "select" || action === "open") {
        if (action === "open" && file.kind === "asset") {
          let opened: DesktopBridgeResponse;
          try {
            opened = options.openAsset?.({
              profile,
              documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
              asset: file,
            }) ?? projectBrowserRefuse(
              DESKTOP_PROJECT_BROWSER_REFUSALS.openFailed,
              "The packaged desktop has no asset-open bridge operation bound.",
              file.path,
            );
          } catch (error) {
            return projectBrowserRefuse(
              DESKTOP_PROJECT_BROWSER_REFUSALS.openFailed,
              "The existing desktop scene bridge failed while opening the admitted asset.",
              error instanceof Error ? error.message : String(error),
            );
          }
          const instances = opened.ok ? own(opened.data, "instances") : undefined;
          if (
            !opened.ok ||
            !Array.isArray(instances) ||
            !instances.some((instance) => own(instance, "instanceId") === file.instanceId)
          ) {
            return projectBrowserRefuse(
              DESKTOP_PROJECT_BROWSER_REFUSALS.openFailed,
              "The existing desktop scene bridge did not open the admitted asset's canonical scene instance.",
              opened.ok
                ? file.instanceId
                : `${opened.reason}: ${opened.message}`,
            );
          }
        }
        const previous = selectedPath;
        selectedPath = file.path;
        const written = persist();
        if (written !== null) {
          selectedPath = previous;
          return written;
        }
        return ok(action === "select" ? "selected" : "opened", {
          ...current,
          selectedPath,
        });
      }

      if (options.isDirty?.() === true) {
        return projectBrowserRefuse(
          DESKTOP_PROJECT_BROWSER_REFUSALS.dirty,
          "Rename and delete refuse while Change Review, recovery, or another unsaved authoring change is active.",
          file.path,
        );
      }
      if (own(request, "confirmed") !== true) {
        return projectBrowserRefuse(
          DESKTOP_PROJECT_BROWSER_REFUSALS.confirmationRequired,
          `Explicit confirmation is required before ${action} can be considered.`,
          file.path,
        );
      }
      if (action === "rename") {
        const target = requestPath(own(request, "targetPath"));
        if (!("value" in target)) return target;
        if (current.files.some((candidate) => candidate.path === target.value)) {
          return projectBrowserRefuse(
            DESKTOP_PROJECT_BROWSER_REFUSALS.duplicatePath,
            "Rename refuses a path already owned by the active document or admitted asset manifest.",
            target.value,
          );
        }
      }
      return projectBrowserRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.operationNotPermitted,
        file.kind === "document"
          ? `The one active ${DESKTOP_ACTIVE_DOCUMENT_PATH} is the canonical authoring target and cannot be renamed or deleted.`
          : "The accepted asset manifest owns this asset identity and copy path; no rename/delete transaction exists in the approved asset contract.",
        file.path,
      );
    },
  });
}

export const DESKTOP_PROJECT_BROWSER_STATE_FILE = STATE_FILE;
