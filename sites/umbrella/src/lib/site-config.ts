/**
 * Umbrella site configuration and editor access wiring.
 *
 * Non-presentational behaviour lives in `@sceneaxi/site-kit`; this module holds the
 * umbrella's presentational brand and a thin adapter from the umbrella identity plane to
 * the shared editor-session orchestration. The `src/app/` tree is the only place a
 * framework appears.
 */
import {
  resolveEditorSession,
  resolveFamilyLinks as resolveFamilyLinksBase,
  type EditorSessionAccess,
  type FamilyLinks,
} from "@sceneaxi/site-kit";
import type { UmbrellaIdentityPlane } from "./request-authority.js";

export const UMBRELLA_BRAND = Object.freeze({
  name: "SceneAxi",
  tagline: "An interactive engine and library, with versioned profiles.",
  summary:
    "Sculpt objects, compose them into an openable scene, and ship the result through a profile. The engine SDK and the CLI are free; hosted AI and catalog assets are paid.",
});

export type { FamilyLinks };

export const resolveFamilyLinks = resolveFamilyLinksBase;

export type UmbrellaEditorAccess = EditorSessionAccess;

/**
 * Resolve editor access for a request, delegating to the shared site-kit orchestration.
 *
 * The preview flag is read from the **server** environment only. A client value cannot
 * reach it, because nothing here reads a request parameter.
 */
export async function resolveUmbrellaEditorAccess(input: {
  readonly plane: UmbrellaIdentityPlane;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly sessionToken?: string | null;
}): Promise<UmbrellaEditorAccess> {
  return resolveEditorSession({
    identity: input.plane.identity,
    credits: input.plane.credits,
    env: input.env,
    // Spread conditionally: under exactOptionalPropertyTypes an absent token is not
    // the same as an explicit `undefined`.
    ...(input.sessionToken === undefined ? {} : { sessionToken: input.sessionToken }),
  });
}
