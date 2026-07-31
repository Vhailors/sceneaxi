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

/** RFC 6265 cookie-octets: what a Set-Cookie value can carry unescaped. */
const COOKIE_VALUE_RE = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/;

export type SiteSessionCookieInput = {
  /** The opaque credential a login grant returned. */
  readonly credential: string;
  /** ISO expiry of the underlying session; the cookie must not outlive it. */
  readonly expiresAt: string;
  /** Whether the response travels over https; `Secure` is stamped when it does. */
  readonly secure: boolean;
};

/**
 * Build the Set-Cookie header value that hands a login grant to the browser.
 *
 * HttpOnly because no script has any business reading the credential;
 * SameSite=Lax so a cross-site POST cannot ride the session; expiry bound to
 * the session's own, so the cookie dies no later than the session it names.
 * Returns `null` for a credential or expiry a cookie cannot faithfully carry —
 * the caller treats that as a failed login, never as a cookie to send anyway.
 */
export function buildSiteSessionCookie(input: SiteSessionCookieInput): string | null {
  if (!COOKIE_VALUE_RE.test(input.credential)) return null;
  const expiresMs = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiresMs)) return null;
  const attributes = [
    `${SITE_SESSION_COOKIE}=${input.credential}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresMs).toUTCString()}`,
  ];
  if (input.secure) attributes.push("Secure");
  return attributes.join("; ");
}

/** The Set-Cookie header value that signs a browser out. */
export function clearSiteSessionCookie(options: { readonly secure: boolean }): string {
  const attributes = [
    `${SITE_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
  ];
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}
