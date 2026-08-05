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
  isJsonValue,
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
  refusal: Readonly<{ code: string; message: string }> | null;
}>;

export const DESKTOP_PRODUCT_REFUSALS = Object.freeze({
  webCapabilityRequired: "DESKTOP_WEB_CAPABILITY_REQUIRED",
  webAssetPathInvalid: "DESKTOP_WEB_ASSET_PATH_INVALID",
  webHtmlInvalid: "DESKTOP_WEB_HTML_INVALID",
  documentDataInvalid: "DESKTOP_DOCUMENT_DATA_INVALID",
  runtimeUnavailable: "DESKTOP_RUNTIME_UNAVAILABLE",
} as const);

export type DesktopProductRefusal =
  (typeof DESKTOP_PRODUCT_REFUSALS)[keyof typeof DESKTOP_PRODUCT_REFUSALS];

export type DesktopAuthoringRequest = Readonly<{
  action: "authoring";
  payload: Readonly<{
    op: "propose";
    documentPath: typeof DESKTOP_PROJECT.activeFile;
    jsonPointer: "/data";
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

function projectAssetPath(value: string): boolean {
  if (value.trim() !== value || !value.startsWith("assets/")) return false;
  if (value.includes("\\") || value.includes(":")) return false;
  const segments = value.split("/");
  return (
    segments.length > 1 &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment),
    )
  );
}

function webExperienceData(value: unknown): Readonly<{
  html: string;
  assets: readonly string[];
}> | null {
  if (value === undefined) {
    return Object.freeze({
      html: DESKTOP_WEB_STARTER.html,
      assets: Object.freeze([]),
    });
  }
  if (!isJsonObject(value)) return null;
  const html = value["html"];
  const assets = value["assets"];
  if (
    typeof html !== "string" ||
    !Array.isArray(assets) ||
    !assets.every((asset) => typeof asset === "string" && projectAssetPath(asset))
  ) {
    return null;
  }
  return Object.freeze({ html, assets: Object.freeze([...assets]) });
}

function stageWebData(input: Readonly<{
  profile: DesktopProfileId;
  documentData: unknown;
  update: (
    current: Readonly<{ html: string; assets: readonly string[] }>,
  ) => Readonly<{ html: string; assets: readonly string[] }>;
}>): DesktopStageDecision {
  if (input.profile !== "web") {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_PRODUCT_REFUSALS.webCapabilityRequired,
      message: "This authoring operation is available only on the Web Experience profile.",
    });
  }
  if (!isJsonObject(input.documentData) || !isJsonValue(input.documentData)) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_PRODUCT_REFUSALS.documentDataInvalid,
      message: "The open Scene Document data is not finite JSON object data.",
    });
  }
  const currentWeb = webExperienceData(input.documentData["webExperience"]);
  if (currentWeb === null) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_PRODUCT_REFUSALS.documentDataInvalid,
      message: "The existing webExperience data is malformed and cannot be replaced implicitly.",
    });
  }
  const updated = input.update(currentWeb);
  const newValue: JsonObject = {
    ...structuredClone(input.documentData),
    webExperience: {
      html: updated.html,
      assets: [...updated.assets],
    },
  };
  return Object.freeze({
    ok: true as const,
    request: Object.freeze({
      action: "authoring" as const,
      payload: Object.freeze({
        op: "propose" as const,
        documentPath: DESKTOP_PROJECT.activeFile,
        jsonPointer: "/data" as const,
        newValue,
      }),
    }),
  });
}

/**
 * Build the one authoring-core proposal used by Web asset injection.
 * Stored markup remains data; the desktop chrome never executes it.
 */
export function stageWebAssetInjection(input: Readonly<{
  profile: DesktopProfileId;
  documentData: unknown;
  assetPath: string;
}>): DesktopStageDecision {
  if (input.profile !== "web") {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_PRODUCT_REFUSALS.webCapabilityRequired,
      message: "Asset injection is available only on the Web Experience profile.",
    });
  }
  if (!projectAssetPath(input.assetPath)) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_PRODUCT_REFUSALS.webAssetPathInvalid,
      message: "An injected asset must be a normalized project-relative path under assets/.",
    });
  }
  return stageWebData({
    profile: input.profile,
    documentData: input.documentData,
    update: (current) => ({
      html: current.html,
      assets: current.assets.includes(input.assetPath)
        ? current.assets
        : [...current.assets, input.assetPath],
    }),
  });
}

/** Stage Web Experience markup as inert Scene Document data. */
export function stageWebHtml(input: Readonly<{
  profile: DesktopProfileId;
  documentData: unknown;
  html: string;
}>): DesktopStageDecision {
  if (input.profile !== "web") {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_PRODUCT_REFUSALS.webCapabilityRequired,
      message: "HTML authoring is available only on the Web Experience profile.",
    });
  }
  if (input.html.length > 100_000 || input.html.includes("\u0000")) {
    return Object.freeze({
      ok: false as const,
      reason: DESKTOP_PRODUCT_REFUSALS.webHtmlInvalid,
      message: "Stored HTML must be at most 100,000 characters and contain no null byte.",
    });
  }
  return stageWebData({
    profile: input.profile,
    documentData: input.documentData,
    update: (current) => ({ html: input.html, assets: current.assets }),
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
