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
 * form can never be used as an open redirect. Before any of that, the
 * submission must prove it came from this deployment's own pages: both entry
 * points take that proof as a required argument, so a route cannot forget it.
 */
import {
  SITE_LOGIN_PATH,
  SITE_REFUSAL_REASONS,
  buildSiteSessionCookie,
  clearSiteSessionCookie,
  confineSiteRelativePath,
  resolveSiteSessionCookieSecurity,
  resolveUmbrellaOriginConfiguration,
  refuse,
  verifySiteFormOrigin,
  type SiteFormOriginSignals,
  type SitePrincipal,
  type SiteRefusalReason,
  type SiteResult,
} from "@sceneaxi/site-kit";
import type { UmbrellaIdentityPlane } from "./request-authority.js";

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
  const configured = resolveUmbrellaOriginConfiguration(env).origin;
  return resolveSiteSessionCookieSecurity({
    configuredOrigin: configured.ok ? configured.value : null,
    forwardedProto: signals.forwardedProto,
    requestUrl: signals.requestUrl,
  });
}

/**
 * Whether this submission came from this deployment's own pages.
 *
 * The rule is site-kit's `verifySiteFormOrigin`; what this adds is the same
 * configured-origin precedence the cookie's `Secure` flag already uses, so both
 * answers are read off one deployment fact rather than off the request. The
 * result is passed into `performLogin` / `performLogout` as a required argument
 * rather than checked inside a route handler, because a check a route performs
 * is a check the next route can forget.
 *
 * A deployment that configured an origin gets no fallback: `verifySiteFormOrigin`
 * falls back to the request's own origin when none is configured, which is what
 * keeps localhost development working, but doing that for a *malformed* configured
 * value would quietly accept sign-ins aimed at an alias host on exactly the
 * deployment whose configuration is broken. So a supplied-but-unusable origin
 * refuses here, using site-kit's own supplied-versus-usable answer rather than a
 * second reading of the environment.
 */
export function verifyLoginRequestOrigin(
  env: Readonly<Record<string, string | undefined>>,
  signals: Omit<SiteFormOriginSignals, "configuredOrigin"> = {},
): SiteResult<string> {
  const { supplied, origin: configured } = resolveUmbrellaOriginConfiguration(env);
  if (supplied && !configured.ok) return refuse("SITE_REQUEST_CROSS_ORIGIN");
  return verifySiteFormOrigin({
    configuredOrigin: configured.ok ? configured.value : null,
    origin: signals.origin,
    fetchSite: signals.fetchSite,
    requestUrl: signals.requestUrl,
  });
}

/** Where a successful sign-in lands when the form named no destination. */
export const LOGIN_DEFAULT_DESTINATION = "/account";

/**
 * Confine a requested post-login destination to this site.
 *
 * The rule itself is site-kit's `confineSiteRelativePath` — the same one the
 * sign-in links are built from — so a destination a guarded surface emits can
 * never be one this flow then discards. Anything it refuses falls back to the
 * default rather than refusing the login over its `next`.
 */
export function resolveLoginDestination(value: unknown): string {
  return confineSiteRelativePath(value) ?? LOGIN_DEFAULT_DESTINATION;
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
 * A refused attempt, as the redirect the route hands back.
 *
 * Every outcome of the endpoint is a 303 carrying a registry reason, including
 * the ones decided before the plane is reached — a body the framework could not
 * parse into form fields is refused `SITE_REQUEST_MALFORMED` here rather than
 * escaping as an unnamed framework fault.
 */
export function loginRefusalOutcome(
  reason: SiteRefusalReason,
  next: string = LOGIN_DEFAULT_DESTINATION,
): LoginAttemptOutcome {
  return Object.freeze({
    kind: "refused" as const,
    location: loginRefusalHref(reason, resolveLoginDestination(next)),
    reason,
  });
}

/**
 * Attempt a sign-in and decide the response.
 *
 * Every refusal — a submission from another site, empty fields, rejected
 * credentials, an unwired or failed plane, a Kids surface — comes back as a
 * redirect to the form carrying the plane's own named reason. Success carries
 * the one Set-Cookie header and the confined destination; the cookie's lifetime
 * is the session's own.
 *
 * The origin proof is answered first, before a single submitted field is read,
 * so a cross-site submission influences neither the credentials dispatched nor
 * the destination the refusal carries back.
 */
export async function performLogin(input: {
  readonly plane: UmbrellaIdentityPlane;
  readonly fields: LoginFormFields;
  /** Proof the submission came from this deployment; see `verifyLoginRequestOrigin`. */
  readonly requestOrigin: SiteResult<string>;
  /** Whether the deployment is reached over https; stamps `Secure` on the cookie. */
  readonly secure: boolean;
}): Promise<LoginAttemptOutcome> {
  if (!input.requestOrigin.ok) return loginRefusalOutcome(input.requestOrigin.reason);

  const next = resolveLoginDestination(input.fields.next);
  const email = typeof input.fields.email === "string" ? input.fields.email.trim() : "";
  const password = typeof input.fields.password === "string" ? input.fields.password : "";

  const granted = await input.plane.login.signIn({ surface: "site", email, password });
  if (!granted.ok) return loginRefusalOutcome(granted.reason, next);

  const setCookie = buildSiteSessionCookie({
    credential: granted.value.sessionCredential,
    expiresAt: granted.value.principal.session.expiresAt,
    secure: input.secure,
  });
  // The login plane has already vetted the credential and expiry, so this is a
  // belt-and-suspenders refusal, not a reachable product state.
  if (setCookie === null) return loginRefusalOutcome("LOGIN_SESSION_NOT_ISSUED", next);

  return Object.freeze({
    kind: "success" as const,
    location: next,
    setCookie,
    principal: granted.value.principal,
  });
}

export type LogoutOutcome =
  | {
      readonly kind: "signed-out";
      /** Logout always lands on the home page. */
      readonly location: string;
      /** The Set-Cookie header value that clears the session cookie. */
      readonly clearCookie: string;
      /**
       * The server-side revocation result. A refusal means the stored session may
       * still be live; the browser is signed out either way.
       */
      readonly revocation: SiteResult<null>;
    }
  | {
      readonly kind: "refused";
      /** Back to the form, with the named reason in the query. */
      readonly location: string;
      readonly reason: SiteRefusalReason;
    };

/**
 * Sign the request's session out.
 *
 * The cookie is cleared unconditionally — a browser must always be able to
 * discard its credential — while the stored session is deleted through the
 * identity port when the plane can reach it.
 *
 * "Unconditionally" is about *this* browser's own request, though: a submission
 * from another site is refused before the port is reached, because a cross-site
 * page forcing a visitor's session out is an attack on them, not a sign-out
 * they asked for. Nothing is revoked and no clearing cookie is handed back.
 */
export async function performLogout(input: {
  readonly plane: UmbrellaIdentityPlane;
  /** Proof the submission came from this deployment; see `verifyLoginRequestOrigin`. */
  readonly requestOrigin: SiteResult<string>;
  readonly secure: boolean;
}): Promise<LogoutOutcome> {
  if (!input.requestOrigin.ok) {
    return Object.freeze({
      kind: "refused" as const,
      location: loginRefusalHref(input.requestOrigin.reason, LOGIN_DEFAULT_DESTINATION),
      reason: input.requestOrigin.reason,
    });
  }
  const revocation = await input.plane.signOut();
  return Object.freeze({
    kind: "signed-out" as const,
    location: "/",
    clearCookie: clearSiteSessionCookie({ secure: input.secure }),
    revocation,
  });
}
