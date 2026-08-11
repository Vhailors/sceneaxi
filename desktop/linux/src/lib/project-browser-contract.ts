/** Browser-safe contract for the contained desktop project and asset browser. */
import { OPEN_PATH_REFUSE_CODES } from "@sceneaxi/schemas";

export const DESKTOP_PROJECT_BROWSER_CHANNEL = "sceneaxi:desktop-project-browser";
export const DESKTOP_PROJECT_BROWSER_STATE_SCHEMA_VERSION = 1 as const;

export const DESKTOP_PROJECT_BROWSER_ACTIONS = Object.freeze([
  "status",
  "select",
  "open",
  "rename",
  "delete",
] as const);

export type DesktopProjectBrowserAction =
  (typeof DESKTOP_PROJECT_BROWSER_ACTIONS)[number];

export const DESKTOP_PROJECT_BROWSER_REFUSALS = Object.freeze({
  requestMalformed: "DESKTOP_PROJECT_BROWSER_REQUEST_MALFORMED",
  projectRequired: "DESKTOP_PROJECT_BROWSER_PROJECT_REQUIRED",
  documentMissing: "DESKTOP_PROJECT_BROWSER_DOCUMENT_MISSING",
  documentInvalid: "DESKTOP_PROJECT_BROWSER_DOCUMENT_INVALID",
  manifestInvalid: "DESKTOP_PROJECT_BROWSER_MANIFEST_INVALID",
  pathTraversal: "DESKTOP_PROJECT_BROWSER_PATH_TRAVERSAL",
  pathOutsideRoot: "DESKTOP_PROJECT_BROWSER_PATH_OUTSIDE_ROOT",
  fileMissing: "DESKTOP_PROJECT_BROWSER_FILE_MISSING",
  fileInvalid: "DESKTOP_PROJECT_BROWSER_FILE_INVALID",
  symlinkEscape: "DESKTOP_PROJECT_BROWSER_SYMLINK_ESCAPE",
  duplicatePath: "DESKTOP_PROJECT_BROWSER_DUPLICATE_PATH",
  dirty: "DESKTOP_PROJECT_BROWSER_DIRTY",
  confirmationRequired: "DESKTOP_PROJECT_BROWSER_CONFIRMATION_REQUIRED",
  operationNotPermitted: "DESKTOP_PROJECT_BROWSER_OPERATION_NOT_PERMITTED",
  stateInvalid: "DESKTOP_PROJECT_BROWSER_STATE_INVALID",
  stateWriteFailed: "DESKTOP_PROJECT_BROWSER_STATE_WRITE_FAILED",
  kidsDenied: OPEN_PATH_REFUSE_CODES.kidsRefused,
} as const);

export type DesktopProjectBrowserRefusalReason =
  (typeof DESKTOP_PROJECT_BROWSER_REFUSALS)[keyof typeof DESKTOP_PROJECT_BROWSER_REFUSALS];

export type DesktopProjectBrowserValidation = Readonly<{
  state: "valid" | "missing" | "invalid" | "refused";
  reason: DesktopProjectBrowserRefusalReason | null;
  message: string;
}>;

export type DesktopProjectDocumentFile = Readonly<{
  kind: "document";
  path: "scene.json";
  fileType: "scene-document";
  mediaType: "application/vnd.sceneaxi.scene+json";
  byteLength: number;
  digest: string;
  provenance: Readonly<{
    authority: "scene-document";
    documentId: string;
    schemaVersion: number;
    kind: string;
  }>;
  validation: DesktopProjectBrowserValidation;
  mutable: false;
}>;

export type DesktopProjectAssetFile = Readonly<{
  kind: "asset";
  path: string;
  fileType: "contained-glb" | "contained-gltf";
  mediaType: "model/gltf-binary" | "model/gltf+json";
  byteLength: number;
  digest: string;
  assetId: string;
  sourceName: string;
  artifactId: string;
  instanceId: string;
  copyPolicy: "copy";
  provenance: Readonly<{
    importer: "@sceneaxi/importers";
    importerVersion: 1;
    sourceDigest: string;
    formatVersion: "2.0";
    contained: true;
  }>;
  validation: DesktopProjectBrowserValidation;
  mutable: false;
}>;

export type DesktopProjectBrowserFile =
  | DesktopProjectDocumentFile
  | DesktopProjectAssetFile;

export type DesktopProjectBrowserStatus = Readonly<{
  schemaVersion: typeof DESKTOP_PROJECT_BROWSER_STATE_SCHEMA_VERSION;
  root: string;
  activeDocumentPath: "scene.json";
  selectedPath: string;
  files: readonly DesktopProjectBrowserFile[];
}>;

export type DesktopProjectBrowserRequest = Readonly<{
  action: DesktopProjectBrowserAction;
  profile: "game" | "web" | "kids";
  path?: string;
  targetPath?: string;
  confirmed?: boolean;
}>;

export type DesktopProjectBrowserResponse =
  | Readonly<{
      ok: true;
      action: "project-browser";
      data: Readonly<{
        outcome: "listed" | "selected" | "opened";
        status: DesktopProjectBrowserStatus;
      }>;
    }>
  | Readonly<{
      ok: false;
      reason: DesktopProjectBrowserRefusalReason;
      message: string;
      detail: string | null;
    }>;

export function projectBrowserRefuse(
  reason: DesktopProjectBrowserRefusalReason,
  message: string,
  detail: string | null = null,
): DesktopProjectBrowserResponse {
  return Object.freeze({ ok: false as const, reason, message, detail });
}
