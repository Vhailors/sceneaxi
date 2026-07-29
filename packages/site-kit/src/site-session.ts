/** Framework-neutral request credential normalization for all three sites. */
export const SITE_SESSION_COOKIE = "sceneaxi.session";
export const SITE_SESSION_HEADER = "x-sceneaxi-session";

export type SiteSessionTokenSources = {
  readonly header?: string | null | undefined;
  readonly cookie?: string | null | undefined;
};

const nonEmptyToken = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const token = value.trim();
  return token.length === 0 ? null : token;
};

/** Header wins over cookie; empty credentials are absent, never invented. */
export function resolveSiteSessionToken(sources: SiteSessionTokenSources): string | null {
  return nonEmptyToken(sources.header) ?? nonEmptyToken(sources.cookie);
}
