/**
 * Product-loop vocabulary for the Engine Desktop chrome (sceneaxi#196).
 *
 * This module deliberately describes only the shell-owned project experience.
 * The packaged host supplies authoring, orchestration, and presentation through
 * its existing bridge; no engine, profile, site, billing, or Kids package is
 * reachable from here.
 */
import {
  OPEN_PATH_REFUSE_CODES,
  isJsonObject,
  openPathPolicyRowFor,
  type JsonObject,
} from "@sceneaxi/schemas";
import type { DesktopProfileId } from "./visual-model.js";

export const DESKTOP_PROJECT = Object.freeze({
  name: "SceneAxi Project",
  activeFile: "scene.json",
  files: Object.freeze([
    Object.freeze({
      path: "scene.json",
      label: "Scene document",
      active: true as const,
    }),
  ]),
});

export const DESKTOP_VIEWPORT_PLAY_EVENT = "sceneaxi:desktop-viewport-play";

export const DESKTOP_PRODUCT_CAPABILITY_IDS = Object.freeze([
  "scene-authoring",
  "composed-scene-play",
  "freejs",
  "html",
  "site-canvas",
  "asset-injection",
] as const);
export type DesktopProductCapabilityId =
  (typeof DESKTOP_PRODUCT_CAPABILITY_IDS)[number];

export type DesktopProductCapability = Readonly<{
  id: DesktopProductCapabilityId;
  label: string;
  detail: string;
}>;

const CAPABILITIES: Readonly<
  Record<DesktopProductCapabilityId, DesktopProductCapability>
> = Object.freeze({
  "scene-authoring": Object.freeze({
    id: "scene-authoring",
    label: "Scene authoring",
    detail: "Open and save the active Scene Document through the shared authoring session.",
  }),
  "composed-scene-play": Object.freeze({
    id: "composed-scene-play",
    label: "Composed scene play",
    detail: "Run the composed scene through the existing orchestrated kernel path.",
  }),
  freejs: Object.freeze({
    id: "freejs",
    label: "FreeJS behavior",
    detail: "Game behavior remains project-local and never becomes a site dependency.",
  }),
  html: Object.freeze({
    id: "html",
    label: "HTML",
    detail: "Author stored markup as data; the desktop never executes it in the chrome.",
  }),
  "site-canvas": Object.freeze({
    id: "site-canvas",
    label: "Site canvas",
    detail: "Compose the Web Experience around the same live scene viewport.",
  }),
  "asset-injection": Object.freeze({
    id: "asset-injection",
    label: "Asset injection",
    detail: "Stage project-relative asset references through propose/review/save.",
  }),
});

const PROFILE_CAPABILITIES: Readonly<
  Record<DesktopProfileId, readonly DesktopProductCapabilityId[]>
> = Object.freeze({
  game: Object.freeze([
    "scene-authoring",
    "composed-scene-play",
    "freejs",
  ] as const),
  web: Object.freeze([
    "html",
    "site-canvas",
    "asset-injection",
    "composed-scene-play",
  ] as const),
  kids: Object.freeze([] as const),
});

export type DesktopProductSurface = Readonly<{
  profile: DesktopProfileId;
  project: typeof DESKTOP_PROJECT;
  capabilities: readonly DesktopProductCapability[];
  refusal: Readonly<{
    code: typeof OPEN_PATH_REFUSE_CODES.kidsRefused;
    message: string;
  }> | null;
}>;

/**
 * Every name the product loop can refuse with, on either side of the bridge.
 *
 * The emitted chrome script reads these out of its serialized table rather than
 * writing string literals of its own, so a refusal the browser can print is a
 * refusal `refusalLegend()` explains and `DESKTOP_PRODUCT_REFUSAL_MESSAGES`
 * owns. `webCapabilityRequired` is re-exported by `DESKTOP_VISUAL_REFUSALS`
 * rather than restated there — one code, one owner.
 */
export const DESKTOP_PRODUCT_REFUSALS = Object.freeze({
  webCapabilityRequired: "DESKTOP_WEB_CAPABILITY_REQUIRED",
  webAssetPathInvalid: "DESKTOP_WEB_ASSET_PATH_INVALID",
  webHtmlInvalid: "DESKTOP_WEB_HTML_INVALID",
  documentDataInvalid: "DESKTOP_DOCUMENT_DATA_INVALID",
  runtimeUnavailable: "DESKTOP_RUNTIME_UNAVAILABLE",
  runtimeRequestFailed: "DESKTOP_RUNTIME_REQUEST_FAILED",
  runtimeRequestRefused: "DESKTOP_RUNTIME_REQUEST_REFUSED",
  viewportUnavailable: "DESKTOP_VIEWPORT_UNAVAILABLE",
  authoringRefused: "DESKTOP_AUTHORING_REFUSED",
  proposalNotReviewing: "DESKTOP_PROPOSAL_NOT_REVIEWING",
  proposalNotDiscarded: "DESKTOP_PROPOSAL_NOT_DISCARDED",
  profileSwitchDirty: "DESKTOP_PROFILE_SWITCH_DIRTY",
  applyNotCompleted: "DESKTOP_APPLY_NOT_COMPLETED",
  recoveryPending: "DESKTOP_RECOVERY_PENDING",
  openPathEvidenceInvalid: "DESKTOP_OPEN_PATH_EVIDENCE_INVALID",
  requestInFlight: "DESKTOP_PRODUCT_REQUEST_IN_FLIGHT",
} as const);

export type DesktopProductRefusal =
  (typeof DESKTOP_PRODUCT_REFUSALS)[keyof typeof DESKTOP_PRODUCT_REFUSALS];

export const DESKTOP_PRODUCT_REFUSAL_MESSAGES: Readonly<
  Record<DesktopProductRefusal, string>
> = Object.freeze({
  [DESKTOP_PRODUCT_REFUSALS.webCapabilityRequired]:
    "HTML, site-canvas, and asset-injection authoring are available only on the Web Experience profile.",
  [DESKTOP_PRODUCT_REFUSALS.webAssetPathInvalid]:
    "Injected assets must stay within the bounded normalized project-relative assets/ subset.",
  [DESKTOP_PRODUCT_REFUSALS.webHtmlInvalid]:
    "Stored HTML must be at most 100,000 characters and contain no null byte.",
  [DESKTOP_PRODUCT_REFUSALS.documentDataInvalid]:
    "The open Scene Document data is not the JSON object data this loop can edit.",
  [DESKTOP_PRODUCT_REFUSALS.runtimeUnavailable]:
    "No packaged desktop host is attached, so this surface opens, saves, and plays nothing.",
  [DESKTOP_PRODUCT_REFUSALS.runtimeRequestFailed]:
    "The packaged host threw instead of answering, so no project state changed here.",
  [DESKTOP_PRODUCT_REFUSALS.runtimeRequestRefused]:
    "The packaged host refused the request by name; its own reason is shown beside this one.",
  [DESKTOP_PRODUCT_REFUSALS.viewportUnavailable]:
    "The orchestrated playback completed, but no live viewport acknowledged the synchronized frame.",
  [DESKTOP_PRODUCT_REFUSALS.authoringRefused]:
    "The shared authoring session refused the edit; its first diagnostic is shown beside this one.",
  [DESKTOP_PRODUCT_REFUSALS.proposalNotReviewing]:
    "The host did not park the edit for review, so nothing is staged to save.",
  [DESKTOP_PRODUCT_REFUSALS.proposalNotDiscarded]:
    "A staged proposal is still held by the host, so re-opening would abandon an edit the host still has.",
  [DESKTOP_PRODUCT_REFUSALS.profileSwitchDirty]:
    "One proposal is already staged; save it or re-open the project to discard it before staging another edit, changing the project, or switching profiles.",
  [DESKTOP_PRODUCT_REFUSALS.applyNotCompleted]:
    "The host did not report the apply as completed, so the staged edit is still pending.",
  [DESKTOP_PRODUCT_REFUSALS.recoveryPending]:
    "Durable apply recovery is still pending; save to refresh it or open to re-read in a fresh session before staging another edit, changing the project, or switching profiles.",
  [DESKTOP_PRODUCT_REFUSALS.openPathEvidenceInvalid]:
    "The play response carried no closed session with observed tick digests, so nothing is reported as played.",
  [DESKTOP_PRODUCT_REFUSALS.requestInFlight]:
    "Another project request is still open; the host holds one session and one proposal, so this control waits rather than racing it.",
});

export type DesktopAuthoringRequest = Readonly<{
  action: "authoring";
  payload: Readonly<{
    op: "propose";
    documentPath: typeof DESKTOP_PROJECT.activeFile;
    jsonPointer: "/data";
    expectedContentHash: string;
    newValue: JsonObject;
  }>;
}>;

export type DesktopStageDecision =
  | Readonly<{ ok: true; request: DesktopAuthoringRequest }>
  | Readonly<{ ok: false; reason: DesktopProductRefusal; message: string }>;

export const DESKTOP_WEB_STARTER = Object.freeze({
  html: '<main id="sceneaxi-mount"></main>',
  assetPath: "assets/hero.glb",
});

/** Stored markup is data, so its size and byte content are bounded. */
export const DESKTOP_WEB_HTML_MAX_LENGTH = 100_000;
export const DESKTOP_WEB_ASSET_PATH_MAX_LENGTH = 512;
export const DESKTOP_WEB_ASSET_MAX_COUNT = 256;

export type DesktopWebStageOperation = Readonly<{
  profile: string;
  documentData: unknown;
  contentHash: string;
  kind: "html" | "asset";
  html: string;
  assetPath: string;
}>;

export type DesktopWebStageConfig = Readonly<{
  documentPath: typeof DESKTOP_PROJECT.activeFile;
  starterHtml: string;
  htmlMaxLength: number;
  assetPathMaxLength: number;
  assetMaxCount: number;
  refusals: Readonly<
    Pick<
      typeof DESKTOP_PRODUCT_REFUSALS,
      | "webCapabilityRequired"
      | "webAssetPathInvalid"
      | "webHtmlInvalid"
      | "documentDataInvalid"
    >
  >;
}>;

export const DESKTOP_WEB_STAGE_CONFIG: DesktopWebStageConfig = Object.freeze({
  documentPath: DESKTOP_PROJECT.activeFile,
  starterHtml: DESKTOP_WEB_STARTER.html,
  htmlMaxLength: DESKTOP_WEB_HTML_MAX_LENGTH,
  assetPathMaxLength: DESKTOP_WEB_ASSET_PATH_MAX_LENGTH,
  assetMaxCount: DESKTOP_WEB_ASSET_MAX_COUNT,
  refusals: DESKTOP_PRODUCT_REFUSALS,
});

/**
 * The one Web Experience staging decision — profile gate, stored-data shape,
 * project-relative asset path, markup bounds, and the proposal it builds.
 *
 * It closes over no module binding on purpose: `String(desktopWebStageDecision)`
 * is what the emitted chrome script runs, so the shipped browser path and the
 * exported functions below are the same function rather than two copies of it.
 * Everything it needs beyond its arguments is a language global.
 */
export function desktopWebStageDecision(
  operation: DesktopWebStageOperation,
  config: DesktopWebStageConfig,
): DesktopStageDecision {
  const assetPattern =
    /^assets\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/;
  const refuse = (
    reason: DesktopProductRefusal,
    message: string,
  ): DesktopStageDecision =>
    Object.freeze({ ok: false as const, reason, message });
  const htmlIsValid = (value: unknown): value is string =>
    typeof value === "string" &&
    value.length <= config.htmlMaxLength &&
    !value.includes("\u0000");
  const assetPathIsValid = (value: unknown): value is string =>
    typeof value === "string" &&
    value.length <= config.assetPathMaxLength &&
    assetPattern.test(value);
  const contentHashIsValid = (value: unknown): value is string =>
    typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);

  if (operation.profile !== "web") {
    return refuse(
      config.refusals.webCapabilityRequired,
      "HTML and asset injection are available only on the Web Experience profile.",
    );
  }
  if (!contentHashIsValid(operation.contentHash)) {
    return refuse(
      config.refusals.documentDataInvalid,
      "The open Scene Document is missing its validated content hash.",
    );
  }

  const data = operation.documentData;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return refuse(
      config.refusals.documentDataInvalid,
      "The open Scene Document data is not JSON object data.",
    );
  }
  const record = data as Record<string, unknown>;

  let html = config.starterHtml;
  let assets: string[] = [];
  const existing = record["webExperience"];
  if (existing !== undefined) {
    const web =
      typeof existing === "object" && existing !== null && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : null;
    const storedHtml = web === null ? undefined : web["html"];
    const storedAssets = web === null ? undefined : web["assets"];
    if (
      typeof storedHtml !== "string" ||
      !Array.isArray(storedAssets) ||
      storedAssets.length > config.assetMaxCount ||
      !storedAssets.every(assetPathIsValid)
    ) {
      return refuse(
        config.refusals.documentDataInvalid,
        "The existing webExperience data is malformed and cannot be replaced implicitly.",
      );
    }
    if (!htmlIsValid(storedHtml)) {
      return refuse(
        config.refusals.webHtmlInvalid,
        "Stored HTML must be at most 100,000 characters and contain no null byte.",
      );
    }
    html = storedHtml;
    assets = storedAssets.map((asset) => String(asset));
  }

  if (operation.kind === "html") {
    if (!htmlIsValid(operation.html)) {
      return refuse(
        config.refusals.webHtmlInvalid,
        "Stored HTML must be at most 100,000 characters and contain no null byte.",
      );
    }
    html = operation.html;
  } else {
    if (!assetPathIsValid(operation.assetPath)) {
      return refuse(
        config.refusals.webAssetPathInvalid,
        "An injected asset must be a bounded normalized project-relative path under assets/.",
      );
    }
    if (!assets.includes(operation.assetPath)) {
      if (assets.length >= config.assetMaxCount) {
        return refuse(
          config.refusals.webAssetPathInvalid,
          "The Web Experience asset set is full and cannot accept another path.",
        );
      }
      assets.push(operation.assetPath);
    }
  }

  let carried: Record<string, unknown>;
  try {
    carried = structuredClone(record);
  } catch {
    return refuse(
      config.refusals.documentDataInvalid,
      "The open Scene Document data holds a value that cannot be carried into a proposal.",
    );
  }
  const newValue = {
    ...carried,
    webExperience: { html, assets },
  } as JsonObject;

  return Object.freeze({
    ok: true as const,
    request: Object.freeze({
      action: "authoring" as const,
      payload: Object.freeze({
        op: "propose" as const,
        documentPath: config.documentPath,
        jsonPointer: "/data" as const,
        expectedContentHash: operation.contentHash,
        newValue,
      }),
    }),
  });
}

/**
 * The in-process form of the shared decision.
 *
 * The browser's document data comes from the host, which already parsed it as a
 * document; an in-process caller may hand over anything, so the deeper
 * finite-JSON check belongs here — and runs after the shared decision has
 * answered, so a refusal ordering is the same on both sides of the bridge.
 */
function stageWebEdit(operation: DesktopWebStageOperation): DesktopStageDecision {
  const decision = desktopWebStageDecision(operation, DESKTOP_WEB_STAGE_CONFIG);
  if (!decision.ok) return decision;
  if (!isJsonObject(operation.documentData)) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_PRODUCT_REFUSALS.documentDataInvalid,
      message: "The open Scene Document data is not finite JSON object data.",
    });
  }
  return decision;
}

/**
 * Build the one authoring-core proposal used by Web asset injection.
 * Stored markup remains data; the desktop chrome never executes it.
 */
export function stageWebAssetInjection(input: Readonly<{
  profile: DesktopProfileId;
  documentData: unknown;
  contentHash: string;
  assetPath: string;
}>): DesktopStageDecision {
  return stageWebEdit({
    profile: input.profile,
    documentData: input.documentData,
    contentHash: input.contentHash,
    kind: "asset",
    html: DESKTOP_WEB_STARTER.html,
    assetPath: input.assetPath,
  });
}

/** Stage Web Experience markup as inert Scene Document data. */
export function stageWebHtml(input: Readonly<{
  profile: DesktopProfileId;
  documentData: unknown;
  contentHash: string;
  html: string;
}>): DesktopStageDecision {
  return stageWebEdit({
    profile: input.profile,
    documentData: input.documentData,
    contentHash: input.contentHash,
    kind: "html",
    html: input.html,
    assetPath: DESKTOP_WEB_STARTER.assetPath,
  });
}

/** Project one profile onto the shell without importing the profile package. */
export function desktopProductSurface(
  profile: DesktopProfileId,
): DesktopProductSurface {
  const row = openPathPolicyRowFor(`@sceneaxi/profile-${profile}`);
  const refusal =
    profile === "kids"
      ? Object.freeze({
          code: OPEN_PATH_REFUSE_CODES.kidsRefused,
          message:
            row?.summary ??
            "The Kids profile is refuse-only until an explicit safety decision ships its UI.",
        })
      : null;

  return Object.freeze({
    profile,
    project: DESKTOP_PROJECT,
    capabilities: Object.freeze(
      PROFILE_CAPABILITIES[profile].map((id) => CAPABILITIES[id]),
    ),
    refusal,
  });
}
