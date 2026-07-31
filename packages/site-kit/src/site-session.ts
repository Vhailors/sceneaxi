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

/**
 * RFC 6265 cookie-octets: what a Set-Cookie value can carry unescaped.
 *
 * Exported because the login plane vets an adapter's credential against exactly
 * this class before handing it over, and the cookie builder refuses anything
 * outside it. One definition keeps those two checks from silently drifting into
 * a credential that passes issuance and then cannot be sent.
 */
export const SITE_COOKIE_OCTET_RE = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/;

export type SiteSessionCookieInput = {
  /** The opaque credential a login grant returned. */
  readonly credential: string;
  /** ISO expiry of the underlying session; the cookie must not outlive it. */
  readonly expiresAt: string;
  /** Whether the deployment is reached over https; `Secure` is stamped when it is. */
  readonly secure: boolean;
};

/**
 * The signals a deployment's transport can be read from, most trustworthy first.
 *
 * `configuredOrigin` is the site's own server-configured origin — a deployment
 * fact, not something a request can influence — and is why it wins.
 */
export type SiteSessionCookieSecuritySignals = {
  readonly configuredOrigin?: string | null | undefined;
  /** The `x-forwarded-proto` header value, if a proxy sets one. */
  readonly forwardedProto?: string | null | undefined;
  /** The absolute request URL, as the framework saw it. */
  readonly requestUrl?: string | null | undefined;
};

const urlProtocol = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || value.trim().length === 0) return null;
  try {
    return new URL(value).protocol;
  } catch {
    return null;
  }
};

/**
 * Decide whether the session cookie may be stamped `Secure`.
 *
 * The request's own protocol is the **last** resort, because behind a
 * TLS-terminating proxy the request the framework sees is plain http even though
 * the browser spoke https — deriving the flag from it would drop `Secure` on
 * every self-hosted deployment and let the raw credential ride a plaintext
 * request to the same host. The configured origin answers first for the same
 * reason checkout redirects come from configuration rather than a request
 * `Host`: it is a deployment fact. A forwarded protocol is consulted only when
 * no origin is configured, and it can only describe the attacker's own
 * connection, never a victim's.
 */
export function resolveSiteSessionCookieSecurity(
  signals: SiteSessionCookieSecuritySignals,
): boolean {
  const configured = urlProtocol(signals.configuredOrigin);
  if (configured !== null) return configured === "https:";
  const forwarded = signals.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (forwarded !== undefined && forwarded.length > 0) return forwarded === "https";
  return urlProtocol(signals.requestUrl) === "https:";
}

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
  if (!SITE_COOKIE_OCTET_RE.test(input.credential)) return null;
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
