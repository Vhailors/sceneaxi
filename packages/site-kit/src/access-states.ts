/**
 * Named access states: what a visitor is told when a guarded surface refuses.
 *
 * A refusal reason is precise but machine-shaped. This module projects each one
 * onto a designed, *named* state — who you are to the plane, what actually
 * happened, and the one action that can change it — so a guarded page renders a
 * specific outcome ("you are signed out", "your session expired", "this
 * deployment has no identity provider") instead of a wall every visitor reads
 * the same way. The projection is total over the refusal registry: a reason
 * added without a mapping still renders, carrying its own registry message, so
 * no refusal can regress into an unexplained dead end.
 *
 * Nothing here decides access. The decision is the ports' and the entitlement
 * module's; this is the vocabulary a page uses to say it out loud.
 */
import { SITE_REFUSALS, type SiteRefusalReason } from "./refusals.js";

/** Where the umbrella hosts its sign-in form. */
export const SITE_LOGIN_PATH = "/login" as const;

export type SiteAccessStateKey =
  | "signed-out"
  | "session-expired"
  | "session-invalid"
  | "user-disabled"
  | "kids-denied"
  | "identity-unavailable"
  | "identity-not-wired"
  | "no-credits"
  | "credentials-required"
  | "credentials-rejected"
  | "sign-in-not-issued"
  | "cross-origin"
  | "refused";

export type SiteAccessAction = {
  readonly label: string;
  readonly href: string;
};

export type SiteAccessState = {
  readonly key: SiteAccessStateKey;
  /** The registry reason this state was projected from, for evidence readouts. */
  readonly reason: SiteRefusalReason;
  readonly title: string;
  readonly body: string;
  /** The one action a visitor can take from here, or `null` when none exists. */
  readonly action: SiteAccessAction | null;
};

/**
 * Confine a destination to this site, or refuse it.
 *
 * Only a same-site relative path survives: no scheme, no authority, no
 * protocol-relative `//`, no backslash trickery, no whitespace, and no control
 * character — a byte no `Location` header may carry is not a destination, so it
 * degrades to the fallback here instead of throwing at the response.
 *
 * It lives here rather than in a site because both ends of the round trip need
 * the same answer — the surface that *emits* a sign-in link carrying a destination and
 * the login flow that *reads* one back — and two implementations of that rule
 * would eventually disagree about which paths are safe.
 *
 * Because both ends confine, the answer must also be **idempotent**: the value a
 * sign-in form carries is confined again when it comes back, and a second pass
 * that re-escaped the first pass's `%` would redirect a signed-in visitor to a
 * path that does not exist. So percent-escapes are decoded before anything is
 * judged and the ASCII form is produced from that — a lone `%` first standing in
 * for itself, since it is a literal the previous pass would have escaped. An
 * escape therefore cannot smuggle a byte past the rules above, because they all
 * read the decoded path, and it cannot manufacture an authority either, because
 * the value must already be relative before a single escape is decoded.
 */
export function confineSiteRelativePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  let path: string;
  try {
    path = decodeURIComponent(raw.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
  } catch {
    return null;
  }
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.includes("\\") || /\s/.test(path)) return null;
  for (const char of path) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return null;
  }
  try {
    return encodeURI(path);
  } catch {
    return null;
  }
}

/**
 * The sign-in link, carrying where the visitor was headed when they were
 * refused.
 *
 * A destination that is not same-site relative is dropped rather than refused,
 * so a hostile `next` degrades to the plain form. `/login` itself is dropped
 * too: sending a visitor back to the page they are already on is not a
 * destination.
 */
export function siteLoginHref(next?: unknown): string {
  const path = confineSiteRelativePath(next);
  if (path === null) return SITE_LOGIN_PATH;
  if (path === SITE_LOGIN_PATH || path.startsWith(`${SITE_LOGIN_PATH}?`)) {
    return SITE_LOGIN_PATH;
  }
  return `${SITE_LOGIN_PATH}?next=${encodeURIComponent(path)}`;
}

const signInAction = (next?: unknown): SiteAccessAction =>
  Object.freeze({ label: "Sign in", href: siteLoginHref(next) });

const BUY_CREDITS: SiteAccessAction = Object.freeze({
  label: "Buy credits",
  href: "/pricing",
});

const state = (
  key: SiteAccessStateKey,
  reason: SiteRefusalReason,
  title: string,
  body: string,
  action: SiteAccessAction | null,
): SiteAccessState => Object.freeze({ key, reason, title, body, action });

/**
 * Reasons that mean "no live session was presented" — an ordinary visitor who
 * has not signed in, not a fault of any kind.
 */
const SIGNED_OUT_REASONS: ReadonlyArray<SiteRefusalReason> = Object.freeze([
  "IDENTITY_SESSION_ABSENT",
  "EDITOR_ENTITLEMENT_ANONYMOUS",
]);

/**
 * Reasons that mean "a session was presented but is not one the plane will
 * trust" — distinct from expiry, because the visitor's move is the same (sign
 * in again) while the copy must not claim their session merely timed out.
 */
const SESSION_INVALID_REASONS: ReadonlyArray<SiteRefusalReason> = Object.freeze([
  "IDENTITY_SESSION_NOT_YET_VALID",
  "IDENTITY_SESSION_SURFACE_MISMATCH",
  "IDENTITY_ADAPTER_OUTPUT_INVALID",
  "IDENTITY_ROLE_UNKNOWN",
]);

/** Reasons that mean the provider was asked and did not answer usably. */
const IDENTITY_UNAVAILABLE_REASONS: ReadonlyArray<SiteRefusalReason> = Object.freeze([
  "IDENTITY_PLANE_UNAVAILABLE",
  "CREDITS_PLANE_UNAVAILABLE",
  "EDITOR_ENTITLEMENT_UNAVAILABLE",
  "CREDIT_ADAPTER_OUTPUT_INVALID",
  "CREDIT_BALANCE_INVALID",
  "EDITOR_ENTITLEMENT_BALANCE_INVALID",
]);

/** Reasons that mean this deployment has no identity provider wired at all. */
const NOT_WIRED_REASONS: ReadonlyArray<SiteRefusalReason> = Object.freeze([
  "IDENTITY_PLANE_NOT_WIRED",
  "CREDITS_PLANE_NOT_WIRED",
]);

export type SiteAccessStateOptions = {
  /**
   * Where the visitor was headed when this refusal happened. A confinable
   * same-site path is carried on the sign-in action so signing in returns them
   * to the surface that refused instead of the generic default.
   */
  readonly next?: unknown;
};

/**
 * Project one refusal reason onto its named access state.
 *
 * Total: every registry reason maps, and one outside the groups above renders
 * as a generic-but-named `refused` state carrying the registry's own message —
 * specific where the difference changes what the visitor should do, honest
 * everywhere else.
 */
export function describeSiteAccessState(
  reason: SiteRefusalReason,
  options: SiteAccessStateOptions = {},
): SiteAccessState {
  const SIGN_IN = signInAction(options.next);
  if (SIGNED_OUT_REASONS.includes(reason)) {
    return state(
      "signed-out",
      reason,
      "You are signed out",
      "This surface needs a signed-in account. Signing in is free; the engine SDK, the docs, and both catalogs stay open without one.",
      SIGN_IN,
    );
  }
  if (reason === "IDENTITY_SESSION_EXPIRED") {
    return state(
      "session-expired",
      reason,
      "Your session has expired",
      "The session this browser carried has run out and was not renewed. Sign in again to continue; nothing about your account has changed.",
      SIGN_IN,
    );
  }
  if (SESSION_INVALID_REASONS.includes(reason)) {
    return state(
      "session-invalid",
      reason,
      "That session could not be trusted",
      "The credential this browser presented is not one the identity plane will accept, so it was discarded. Sign in again to get a fresh session.",
      SIGN_IN,
    );
  }
  if (reason === "IDENTITY_USER_DISABLED") {
    return state(
      "user-disabled",
      reason,
      "This account is disabled",
      "The account exists but has been disabled, so sign-in and every entitled surface refuse. Signing in again will not change this outcome.",
      null,
    );
  }
  if (reason === "KIDS_SURFACE_DENIED") {
    return state(
      "kids-denied",
      reason,
      "Kids has no sign-in here",
      "The Kids surface keeps a separate identity plane by design. No session is minted for it and none is accepted from it, on any SceneAxi surface.",
      null,
    );
  }
  if (IDENTITY_UNAVAILABLE_REASONS.includes(reason)) {
    return state(
      "identity-unavailable",
      reason,
      "The identity provider did not answer",
      "This deployment has an identity plane, but it failed to answer for this request — so whether you are signed in is unknown, not decided against you. Try again shortly.",
      null,
    );
  }
  if (NOT_WIRED_REASONS.includes(reason)) {
    return state(
      "identity-not-wired",
      reason,
      "Sign-in is not activated on this deployment",
      "This deployment has not supplied the identity plane's provider handles, so no session can be created or verified. This is a deployment fact, not an account problem.",
      null,
    );
  }
  if (reason === "EDITOR_ENTITLEMENT_NO_CREDITS") {
    return state(
      "no-credits",
      reason,
      "No credits remain on this account",
      "You are signed in, but the editor needs credits above zero or an unused starter allotment. Administrators are unrestricted.",
      BUY_CREDITS,
    );
  }
  if (reason === "LOGIN_CREDENTIALS_REQUIRED") {
    return state(
      "credentials-required",
      reason,
      "Enter an email and password",
      "Both fields are required before anything is sent to the identity plane.",
      null,
    );
  }
  if (reason === "LOGIN_CREDENTIALS_REJECTED") {
    return state(
      "credentials-rejected",
      reason,
      "That email and password did not match",
      "The identity provider did not authenticate those credentials. Which of the two was wrong is deliberately not disclosed.",
      null,
    );
  }
  if (reason === "LOGIN_SESSION_NOT_ISSUED") {
    return state(
      "sign-in-not-issued",
      reason,
      "Sign-in could not be completed on this deployment",
      "Sign-in reached this deployment's identity provider, but what came back is not a session this site can hand a browser, so none was issued and nothing was signed in. This is a deployment fault, not an account problem, and trying again will end the same way until it is fixed.",
      null,
    );
  }
  if (reason === "SITE_REQUEST_CROSS_ORIGIN") {
    return state(
      "cross-origin",
      reason,
      "That submission did not come from SceneAxi",
      "The sign-in or sign-out request arrived from another site, so nothing was signed in, out, or revoked. Use the form on this page; if you got here from a link somewhere else, that link was not one of ours.",
      null,
    );
  }
  return state("refused", reason, "This request was refused", SITE_REFUSALS[reason], null);
}
