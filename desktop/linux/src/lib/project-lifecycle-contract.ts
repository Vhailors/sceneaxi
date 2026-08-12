/** Browser-safe contract for the desktop project's privileged lifecycle host. */
import {
  OPEN_PATH_REFUSE_CODES,
  type ProjectManifestDiagnosticCode,
  type ProjectVersionCapabilityResult,
} from "@sceneaxi/schemas";

export const DESKTOP_PROJECT_CHANNEL = "sceneaxi:desktop-project";
export const DESKTOP_PROJECT_STATE_SCHEMA_VERSION = 1;

export const DESKTOP_PROJECT_ACTIONS = Object.freeze([
  "status",
  "choose-new",
  "choose-open",
  "open-recent",
  "remove-recent",
] as const);

export type DesktopProjectAction = (typeof DESKTOP_PROJECT_ACTIONS)[number];

export const DESKTOP_PROJECT_REFUSALS = Object.freeze({
  requestMalformed: "DESKTOP_PROJECT_REQUEST_MALFORMED",
  rootNotAbsolute: "DESKTOP_PROJECT_ROOT_NOT_ABSOLUTE",
  rootTraversal: "DESKTOP_PROJECT_ROOT_TRAVERSAL",
  rootMissing: "DESKTOP_PROJECT_ROOT_MISSING",
  rootNotDirectory: "DESKTOP_PROJECT_ROOT_NOT_DIRECTORY",
  rootInaccessible: "DESKTOP_PROJECT_ROOT_INACCESSIBLE",
  documentMissing: "DESKTOP_PROJECT_DOCUMENT_MISSING",
  documentInvalid: "DESKTOP_PROJECT_DOCUMENT_INVALID",
  documentEscape: "DESKTOP_PROJECT_DOCUMENT_ESCAPE",
  documentExists: "DESKTOP_PROJECT_DOCUMENT_EXISTS",
  recentUnknown: "DESKTOP_PROJECT_RECENT_UNKNOWN",
  stateInvalid: "DESKTOP_PROJECT_STATE_INVALID",
  stateWriteFailed: "DESKTOP_PROJECT_STATE_WRITE_FAILED",
  activationFailed: "DESKTOP_PROJECT_ACTIVATION_FAILED",
  projectRequired: "DESKTOP_PROJECT_REQUIRED",
  kidsDenied: OPEN_PATH_REFUSE_CODES.kidsRefused,
} as const);

export type DesktopProjectRefusalReason =
  | (typeof DESKTOP_PROJECT_REFUSALS)[keyof typeof DESKTOP_PROJECT_REFUSALS]
  | ProjectManifestDiagnosticCode;

export type DesktopProjectSource = "new" | "opened" | "recent" | "restored";

export type DesktopProjectSummary = Readonly<{
  name: string;
  root: string;
  documentPath: "scene.json";
  source: DesktopProjectSource;
  inspection: ProjectVersionCapabilityResult;
}>;

export type DesktopProjectRecovery = Readonly<{
  reason: DesktopProjectRefusalReason;
  root: string | null;
  choices: readonly ["new", "open"];
}>;

export type DesktopProjectStatus = Readonly<{
  schemaVersion: typeof DESKTOP_PROJECT_STATE_SCHEMA_VERSION;
  active: DesktopProjectSummary | null;
  recents: readonly DesktopProjectSummary[];
  recovery: DesktopProjectRecovery | null;
}>;

export type DesktopProjectRequest = Readonly<{
  action: DesktopProjectAction;
  profile: "game" | "web" | "kids";
  root?: string;
}>;

export type DesktopProjectHostResult = Readonly<{
  outcome: "ready" | "cancelled" | "removed";
  status: DesktopProjectStatus;
}>;

export type DesktopProjectResponse =
  | Readonly<{ ok: true; action: "project"; data: DesktopProjectHostResult }>
  | Readonly<{
      ok: false;
      reason: DesktopProjectRefusalReason;
      message: string;
      detail: string | null;
    }>;

export function projectOk(
  outcome: DesktopProjectHostResult["outcome"],
  status: DesktopProjectStatus,
): DesktopProjectResponse {
  return Object.freeze({
    ok: true as const,
    action: "project" as const,
    data: Object.freeze({ outcome, status }),
  });
}

export function projectRefuse(
  reason: DesktopProjectRefusalReason,
  message: string,
  detail: string | null = null,
): DesktopProjectResponse {
  return Object.freeze({ ok: false as const, reason, message, detail });
}
