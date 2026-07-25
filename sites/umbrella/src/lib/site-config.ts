/**
 * Umbrella site configuration and editor access, read from the server environment.
 *
 * Pure TypeScript with no React and no Next import, so the hermetic gate type-checks
 * and tests it. The `src/app/` tree is the only place a framework appears.
 */
import {
  type EditorAccessDecision,
  type SiteAccess,
  decideEditorAccess,
  readEditorPreviewFlag,
  resolveEditorAccess,
} from "@sceneaxi/site-kit";
import type { UmbrellaIdentityPlane } from "./identity-plane.js";

export const UMBRELLA_BRAND = Object.freeze({
  name: "SceneAxi",
  tagline: "An interactive engine and library, with versioned profiles.",
  summary:
    "Sculpt objects, compose them into an openable scene, and ship the result through a profile. The engine SDK and the CLI are free; hosted AI and catalog assets are paid.",
});

/** Family cross-links. Kids is deliberately absent and never linked. */
export type FamilyLinks = {
  readonly gameCatalog: string | null;
  readonly webCatalog: string | null;
};

const httpsOriginOrNull = (value: string | undefined): string | null => {
  if (value === undefined || value.trim().length === 0) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.origin;
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return url.origin;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Resolve family cross-links.
 *
 * A non-https or malformed origin becomes `null` rather than a rendered broken link,
 * and the locked topology means these links never carry identity, session, or
 * telemetry — and never point at Kids.
 */
export function resolveFamilyLinks(
  env: Readonly<Record<string, string | undefined>>,
): FamilyLinks {
  return Object.freeze({
    gameCatalog: httpsOriginOrNull(env["NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN"]),
    webCatalog: httpsOriginOrNull(env["NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN"]),
  });
}

export type UmbrellaEditorAccess = {
  readonly access: SiteAccess;
  readonly decision: EditorAccessDecision;
  readonly previewEnabled: boolean;
};

/**
 * Resolve editor access for a request.
 *
 * The preview flag is read from the **server** environment only. A client value
 * cannot reach it, because nothing here reads a request parameter.
 */
export async function resolveUmbrellaEditorAccess(input: {
  readonly plane: UmbrellaIdentityPlane;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly sessionToken?: string | null;
}): Promise<UmbrellaEditorAccess> {
  const access = await resolveEditorAccess({
    identity: input.plane.identity,
    credits: input.plane.credits,
    request: {
      surface: "umbrella",
      ...(input.sessionToken === undefined ? {} : { sessionToken: input.sessionToken }),
    },
  });
  const previewEnabled = readEditorPreviewFlag(input.env);
  return Object.freeze({
    access,
    decision: decideEditorAccess({ entitlement: access.entitlement, previewEnabled }),
    previewEnabled,
  });
}
