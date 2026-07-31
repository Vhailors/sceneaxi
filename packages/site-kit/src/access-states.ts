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

const SIGN_IN: SiteAccessAction = Object.freeze({
  label: "Sign in",
  href: SITE_LOGIN_PATH,
});

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

/**
 * Project one refusal reason onto its named access state.
 *
 * Total: every registry reason maps, and one outside the groups above renders
 * as a generic-but-named `refused` state carrying the registry's own message —
 * specific where the difference changes what the visitor should do, honest
 * everywhere else.
 */
export function describeSiteAccessState(reason: SiteRefusalReason): SiteAccessState {
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
  return state("refused", reason, "This request was refused", SITE_REFUSALS[reason], null);
}
