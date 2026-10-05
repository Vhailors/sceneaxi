/** Read-only transport over the one deployment-owned verified identity seam.
 * No provider credential, ambient cookie, URL-derived authority, login or SSO.
 */
import {
  CLIENT_ROLE_CLAIM_KEYS, SITE_COOKIE_OCTET_RE, SITE_SESSION_HEADER,
  SITE_REFUSAL_REASONS,
  type SiteFormOriginSignals, type SiteIdentityPort, type SitePrincipal,
  type SiteRefusalReason, type SiteResult,
} from "@sceneaxi/site-kit";

export const OWN_SESSION_PATH = "/api/auth/own-session";
export const OWN_SESSION_RESPONSE_MAX_BYTES = 16_384;
export const OWN_SESSION_CREDENTIAL_MAX_LENGTH = 4_096;

/** Structurally satisfied by the existing request-authority facade. */
export type OwnSessionAuthority = Readonly<{
  verifyFormOrigin(signals: Omit<SiteFormOriginSignals, "configuredOrigin">): SiteResult<string>;
  plane(request: Readonly<{ sessionToken: string }>): Readonly<{ identity: SiteIdentityPort }>;
}>;
export type OwnSessionEnvelope =
  | Readonly<{ version: 1; ok: true; value: SitePrincipal }>
  | Readonly<{ version: 1; ok: false; reason: SiteRefusalReason }>;

const HEADERS = Object.freeze({
  "cache-control": "no-store",
  "pragma": "no-cache",
  "vary": `Origin, ${SITE_SESSION_HEADER}`,
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
});
function refusalStatus(reason: SiteRefusalReason): number {
  if (reason === "SITE_REQUEST_MALFORMED" || reason === "SITE_SURFACE_UNKNOWN") return 400;
  if (reason === "IDENTITY_SESSION_ABSENT" || reason === "IDENTITY_SESSION_EXPIRED" || reason === "IDENTITY_SESSION_NOT_YET_VALID") return 401;
  if (reason === "SITE_REQUEST_CROSS_ORIGIN" || reason === "ROLE_CLAIM_FROM_CLIENT_DENIED" || reason === "KIDS_SURFACE_DENIED" || reason === "IDENTITY_USER_DISABLED" || reason === "IDENTITY_SESSION_SURFACE_MISMATCH") return 403;
  return 503;
}
function denied(reason: SiteRefusalReason, status = refusalStatus(reason)): Response {
  return new Response(JSON.stringify({ version: 1, ok: false, reason } satisfies OwnSessionEnvelope), {
    status, headers: { ...HEADERS, ...(status === 405 ? { allow: "GET" } : {}) },
  });
}
function fixedOrigin(raw: string, allowLoopbackDevelopment: boolean): string | null {
  if (raw.length === 0 || raw.length > 512) return null;
  try {
    const url = new URL(raw);
    if (raw !== url.origin || url.username !== "" || url.password !== "") return null;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (loopback) return allowLoopbackDevelopment && url.protocol === "http:" ? url.origin : null;
    // Production authority is a canonical DNS name, never an IP literal or a
    // local/pseudo-domain. Match the catalogue transport's fixed-origin policy.
    if (url.protocol !== "https:" || url.hostname.endsWith(".") ||
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/.test(url.hostname) ||
      /\.(?:localhost|local|internal)$/.test(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}
function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && Array.from(value).every((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127);
}
/** Explicit public projection, never serialization of the provider-owned object. */
function publicPrincipal(value: SitePrincipal, carriedSessionId: string): SitePrincipal | null {
  const { user, session, role } = value;
  if (!user || !session || !boundedText(user.userId, 256) || !boundedText(user.email, 320) ||
    typeof user.emailVerified !== "boolean" || user.disabled !== false ||
    !boundedText(session.sessionId, 256) || session.sessionId !== carriedSessionId ||
    session.userId !== user.userId || session.surface !== "site" ||
    !boundedText(session.issuedAt, 32) || !boundedText(session.expiresAt, 32) ||
    (role !== "admin" && role !== "user")) return null;
  return Object.freeze({
    user: Object.freeze({ userId: user.userId, email: user.email, emailVerified: user.emailVerified, disabled: user.disabled }),
    role,
    session: Object.freeze({ sessionId: session.sessionId, userId: session.userId, surface: session.surface, issuedAt: session.issuedAt, expiresAt: session.expiresAt }),
  });
}
/** Injectable real Request/Response boundary; dependencies issue no second authority.
 * Origin verification intentionally supplies NO requestUrl/fetchSite: the existing
 * facade must resolve deployment configuration, never its development URL fallback.
 */
export function createOwnSessionHandler(
  authority: OwnSessionAuthority,
  options: Readonly<{
    allowLoopbackDevelopment?: boolean;
    /** Raw deployment value, read before reaching the authority or any key/provider.
     * Missing configuration refuses even with an injected origin verifier. */
    configuredOrigin?: () => string | null | undefined;
  }> = {},
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      if (request.method !== "GET") return denied("SITE_REQUEST_MALFORMED", 405);
      const url = new URL(request.url);
      if (url.pathname !== OWN_SESSION_PATH) return denied("SITE_REQUEST_MALFORMED");
      const origin = request.headers.get("origin");
      if (origin === null || fixedOrigin(origin, options.allowLoopbackDevelopment === true) === null) return denied("SITE_REQUEST_CROSS_ORIGIN");
      const raw = options.configuredOrigin?.();
      if (typeof raw !== "string" || fixedOrigin(raw, options.allowLoopbackDevelopment === true) !== origin) return denied("SITE_REQUEST_CROSS_ORIGIN");
      const verifiedOrigin = authority.verifyFormOrigin({ origin });
      if (!verifiedOrigin.ok || verifiedOrigin.value !== origin || url.origin !== origin) return denied("SITE_REQUEST_CROSS_ORIGIN");
      if (url.searchParams.get("surface") === "kids" || request.headers.get("x-sceneaxi-surface") === "kids") return denied("KIDS_SURFACE_DENIED");
      for (const key of CLIENT_ROLE_CLAIM_KEYS) {
        if (url.searchParams.has(key) || request.headers.has(key) || request.headers.has(`x-sceneaxi-${key.toLowerCase()}`)) return denied("ROLE_CLAIM_FROM_CLIENT_DENIED");
      }
      if (url.search !== "") return denied("SITE_REQUEST_MALFORMED");
      const surface = request.headers.get("x-sceneaxi-surface");
      if (surface !== null && surface !== "site") return denied("SITE_SURFACE_UNKNOWN");
      const carry = request.headers.get(SITE_SESSION_HEADER);
      if (carry === null || carry.length === 0) return denied("IDENTITY_SESSION_ABSENT");
      const separator = carry.indexOf(".");
      if (carry.length > OWN_SESSION_CREDENTIAL_MAX_LENGTH || !SITE_COOKIE_OCTET_RE.test(carry) || separator <= 0 || separator === carry.length - 1) return denied("SITE_REQUEST_MALFORMED");
      const result = await authority.plane({ sessionToken: carry }).identity.resolvePrincipal({ surface: "site", sessionToken: carry });
      if (!result.ok) {
        return SITE_REFUSAL_REASONS.includes(result.reason) ? denied(result.reason) : denied("IDENTITY_ADAPTER_OUTPUT_INVALID");
      }
      const value = publicPrincipal(result.value, carry.slice(0, separator));
      if (value === null) return denied("IDENTITY_ADAPTER_OUTPUT_INVALID");
      const text = JSON.stringify({ version: 1, ok: true, value } satisfies OwnSessionEnvelope);
      if (new TextEncoder().encode(text).byteLength > OWN_SESSION_RESPONSE_MAX_BYTES) return denied("IDENTITY_ADAPTER_OUTPUT_INVALID");
      return new Response(text, { status: 200, headers: HEADERS });
    } catch {
      // No error message, credential or provider-owned data crosses the boundary.
      return denied("IDENTITY_PLANE_UNAVAILABLE");
    }
  };
}
