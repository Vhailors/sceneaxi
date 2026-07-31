/**
 * The hosted login flow: one submission in, one redirect out (sceneaxi#185).
 *
 * Pure TypeScript over the identity plane, so the whole flow — field reading,
 * destination validation, the sign-in call, the Set-Cookie construction, and the
 * named refusal handoff — is gate-tested without a framework. The `src/app/`
 * route handlers are thin translations of `Request` in and `Response` out.
 *
 * Trust boundary: the browser supplies an email, a password, and a destination
 * path, and nothing else is read from it. Roles, user identity, and session
 * claims never enter here — the principal comes back out of the identity plane,
 * and the destination is confined to a same-site relative path so the login
 * form can never be used as an open redirect.
 */
import {
  SITE_LOGIN_PATH,
  SITE_REFUSAL_REASONS,
  buildSiteSessionCookie,
  clearSiteSessionCookie,
  resolveSiteSessionCookieSecurity,
  resolveUmbrellaEditorOrigin,
  type SitePrincipal,
  type SiteRefusalReason,
  type SiteResult,
} from "@sceneaxi/site-kit";
import type { UmbrellaIdentityPlane } from "./identity-plane.js";

export const LOGIN_PATH = SITE_LOGIN_PATH;

/**
 * Whether the session cookie is stamped `Secure`, as a deployment fact.
 *
 * The umbrella's own configured origin decides it — the same server-configured
 * value checkout redirects are built from — so a TLS-terminating proxy in front
 * of the app cannot cause the credential to be issued without `Secure`. Only an
 * unconfigured deployment falls back to what the request itself claims.
 */
export function resolveSessionCookieSecurity(
  env: Readonly<Record<string, string | undefined>>,
  signals: {
    readonly forwardedProto?: string | null | undefined;
    readonly requestUrl?: string | null | undefined;
  } = {},
): boolean {
  const configured = resolveUmbrellaEditorOrigin(env);
  return resolveSiteSessionCookieSecurity({
    configuredOrigin: configured.ok ? configured.value : null,
    forwardedProto: signals.forwardedProto,
    requestUrl: signals.requestUrl,
  });
}

/** Where a successful sign-in lands when the form named no destination. */
export const LOGIN_DEFAULT_DESTINATION = "/account";

/**
 * Confine a requested post-login destination to this site.
 *
 * Only a same-site relative path survives: no scheme, no authority, no
 * protocol-relative `//`, no backslash trickery, no whitespace. Anything else
 * falls back to the default rather than refusing the login over its `next`.
 */
export function resolveLoginDestination(value: unknown): string {
  if (typeof value !== "string") return LOGIN_DEFAULT_DESTINATION;
  const path = value.trim();
  if (!path.startsWith("/")) return LOGIN_DEFAULT_DESTINATION;
  if (path.startsWith("//") || path.includes("\\") || /\s/.test(path)) {
    return LOGIN_DEFAULT_DESTINATION;
  }
  return path;
}

/** The login form's fields, exactly as the route read them from the body. */
export type LoginFormFields = {
  readonly email?: unknown;
  readonly password?: unknown;
  readonly next?: unknown;
};

/** Where a refused attempt is sent: back to the form, carrying the named reason. */
export function loginRefusalHref(reason: SiteRefusalReason, next: string): string {
  const params = new URLSearchParams({ reason });
  if (next !== LOGIN_DEFAULT_DESTINATION) params.set("next", next);
  return `${LOGIN_PATH}?${params.toString()}`;
}

/**
 * Read the `reason` a refused attempt carried back to the form, or `null`.
 *
 * Validated against the refusal registry: an arbitrary query value never
 * reaches the page as copy, so the parameter cannot be used to make the site
 * print attacker-chosen text.
 */
export function readLoginRefusalReason(value: unknown): SiteRefusalReason | null {
  if (typeof value !== "string") return null;
  return (SITE_REFUSAL_REASONS as readonly string[]).includes(value)
    ? (value as SiteRefusalReason)
    : null;
}

export type LoginAttemptOutcome =
  | {
      readonly kind: "success";
      /** Same-site relative path to redirect to. */
      readonly location: string;
      /** The Set-Cookie header value carrying the session credential. */
      readonly setCookie: string;
      readonly principal: SitePrincipal;
    }
  | {
      readonly kind: "refused";
      /** Back to the form, with the named reason in the query. */
      readonly location: string;
      readonly reason: SiteRefusalReason;
    };

/**
 * Attempt a sign-in and decide the response.
 *
 * Every refusal — empty fields, rejected credentials, an unwired or failed
 * plane, a Kids surface — comes back as a redirect to the form carrying the
 * plane's own named reason. Success carries the one Set-Cookie header and the
 * confined destination; the cookie's lifetime is the session's own.
 */
export async function performLogin(input: {
  readonly plane: UmbrellaIdentityPlane;
  readonly fields: LoginFormFields;
  /** Whether the deployment is reached over https; stamps `Secure` on the cookie. */
  readonly secure: boolean;
}): Promise<LoginAttemptOutcome> {
  const next = resolveLoginDestination(input.fields.next);
  const email = typeof input.fields.email === "string" ? input.fields.email.trim() : "";
  const password = typeof input.fields.password === "string" ? input.fields.password : "";

  const granted = await input.plane.login.signIn({ surface: "site", email, password });
  if (!granted.ok) {
    return Object.freeze({
      kind: "refused" as const,
      location: loginRefusalHref(granted.reason, next),
      reason: granted.reason,
    });
  }

  const setCookie = buildSiteSessionCookie({
    credential: granted.value.sessionCredential,
    expiresAt: granted.value.principal.session.expiresAt,
    secure: input.secure,
  });
  // The login plane has already vetted the credential and expiry, so this is a
  // belt-and-suspenders refusal, not a reachable product state.
  if (setCookie === null) {
    return Object.freeze({
      kind: "refused" as const,
      location: loginRefusalHref("IDENTITY_ADAPTER_OUTPUT_INVALID", next),
      reason: "IDENTITY_ADAPTER_OUTPUT_INVALID" as const,
    });
  }

  return Object.freeze({
    kind: "success" as const,
    location: next,
    setCookie,
    principal: granted.value.principal,
  });
}

export type LogoutOutcome = {
  /** Logout always lands on the home page. */
  readonly location: string;
  /** The Set-Cookie header value that clears the session cookie. */
  readonly clearCookie: string;
  /**
   * The server-side revocation result. A refusal means the stored session may
   * still be live; the browser is signed out either way.
   */
  readonly revocation: SiteResult<null>;
};

/**
 * Sign the request's session out.
 *
 * The cookie is cleared unconditionally — a browser must always be able to
 * discard its credential — while the stored session is deleted through the
 * identity port when the plane can reach it.
 */
export async function performLogout(input: {
  readonly plane: UmbrellaIdentityPlane;
  readonly secure: boolean;
}): Promise<LogoutOutcome> {
  const revocation = await input.plane.signOut();
  return Object.freeze({
    location: "/",
    clearCookie: clearSiteSessionCookie({ secure: input.secure }),
    revocation,
  });
}
