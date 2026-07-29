/**
 * The one configuration source a deployment may authorize Stripe `live` mode from.
 *
 * `assertModeAuthorized` takes a bare boolean, and the repository used to be
 * *silent* about where a deployment could get one — which reads as "any
 * expression you like" to anyone wiring an adapter. The captain closed that
 * silence by choosing configuration over a code-only literal (decision D5,
 * `live-mode-authorization-source`), and attached the mitigations this module
 * implements. It resolves exactly one named variable and nothing else:
 *
 *   SCENEAXI_STRIPE_LIVE_AUTHORIZED=live-mode-authorized:<email>:<YYYY-MM-DD>
 *
 * Four properties make that safe enough to be configuration at all.
 *
 * **It is one variable, and an alias is refused by its presence alone.** The
 * admin identity refuses a plural `SCENEAXI_ADMIN_EMAILS` even when it holds a
 * single valid address, because honoring a second spelling quietly normalizes
 * the thing the single spelling exists to prevent. A second way to say "live is
 * authorized" is the same defect, so every plausible alias below refuses before
 * the real variable is read.
 *
 * **The affirmative names its author.** There is no `true`, no `1`, and no
 * `yes`: the only accepted value states who authorized live mode and on what
 * day. A value that names nobody is not an affirmative, so live mode cannot be
 * switched on anonymously — which is what makes it an auditable act rather than
 * a silent environment edit.
 *
 * **The audit record is a precondition, not a side effect.** The caller injects
 * the sink that records the authorization; an absent sink, a sink that is not a
 * function, one that throws, and one that answers with a promise all refuse —
 * this resolver is synchronous, so a record it would have to await is a record
 * it cannot witness, and a rejection arriving after the fact would leave an
 * authorization already issued. No deployment can hold an authorization it
 * never wrote down.
 *
 * **Nothing else is an input.** The mode, the price, the Stripe key's own
 * `sk_live_` prefix, `NODE_ENV`, and every other value that merely correlates
 * with production are not read here and must not become inputs: a gate that
 * infers its own authorization is not a gate. And because the resolved value is
 * runtime-witnessed (sceneaxi#126), a hand-built look-alike yields no
 * authorization either — `liveModeAuthorizedFlag` answers `true` only for the
 * exact object this resolver issued.
 *
 * **This does not enable live mode.** No call site in this repository passes the
 * result of `liveModeAuthorizedFlag` to anything, so `assertModeAuthorized`
 * refuses `STRIPE_LIVE_MODE_NOT_AUTHORIZED` at both ends — intent creation and
 * grant — exactly as before. Live activation itself remains a separate captain
 * decision under ADR 0021, and reaching it needs a deliberate wiring change on
 * top of the variable.
 */

import { createHash } from "node:crypto";
import { createProvenanceWitness, snapshotPlainRecord } from "@sceneaxi/schemas";
import { isPlausibleEmail, normalizeEmail, type EnvLike } from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";

/** The single, explicitly named variable live-mode authorization may come from. */
export const STRIPE_LIVE_MODE_ENV_VAR = "SCENEAXI_STRIPE_LIVE_AUTHORIZED" as const;

/**
 * Names that would be a *second* way to authorize live mode.
 *
 * Refused by presence alone, even holding a correct affirmative, for the reason
 * `MULTI_ADMIN_ENV_VARS` is: the guarantee is that exactly one key decides, and
 * a deployment that sets two of these has already lost track of which one did.
 */
export const STRIPE_LIVE_MODE_ALIAS_ENV_VARS: readonly string[] = Object.freeze([
  "SCENEAXI_STRIPE_LIVE_AUTHORIZATIONS",
  "SCENEAXI_STRIPE_LIVE_AUTHORIZED_BY",
  "SCENEAXI_STRIPE_LIVE_MODE",
  "SCENEAXI_STRIPE_LIVE_MODE_AUTHORIZED",
  "SCENEAXI_STRIPE_MODE",
  "STRIPE_LIVE_AUTHORIZED",
  "STRIPE_LIVE_MODE_AUTHORIZED",
]);

/** The one token that opens the affirmative. Nothing else is an affirmative. */
export const STRIPE_LIVE_MODE_AFFIRMATIVE = "live-mode-authorized" as const;

const AUTHORIZED_ON_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The record a deployment must write when live mode is authorized.
 *
 * It carries who authorized it and when, plus a fingerprint of that statement,
 * so an operator reading the deployment's own log can tell one authorization
 * from another and from a re-deploy of the same one.
 */
export type LiveModeAuthorizationAudit = Readonly<{
  schemaVersion: 1;
  kind: "sceneaxi.stripe-live-mode-authorization-audit";
  /** The variable the authorization was read from; never inferred. */
  source: typeof STRIPE_LIVE_MODE_ENV_VAR;
  /** The normalized address the affirmative named as authorizing live mode. */
  authorizedBy: string;
  /** The `YYYY-MM-DD` the affirmative named. */
  authorizedOn: string;
  /** `sha256` over the canonical statement, so two records are comparable. */
  fingerprint: string;
  /** One line, ready to record verbatim. */
  record: string;
}>;

/**
 * A resolved live-mode authorization.
 *
 * Runtime-witnessed: only `resolveLiveModeAuthorization` issues one, and a copy
 * of it — spread, `structuredClone`, JSON round-trip, `Proxy` — is a different
 * object and authorizes nothing.
 */
export type LiveModeAuthorization = Readonly<{
  authorizedBy: string;
  authorizedOn: string;
  source: typeof STRIPE_LIVE_MODE_ENV_VAR;
  audit: LiveModeAuthorizationAudit;
}>;

export type ResolveLiveModeAuthorizationRequest = Readonly<{
  /** The process environment, injected so nothing here reads a global. */
  env: EnvLike;
  /**
   * Where the deployment records the authorization. Required: an authorization
   * nobody can observe afterwards is the silent environment edit this exists to
   * prevent, so a missing sink and a throwing sink both refuse.
   */
  recordAudit: (audit: LiveModeAuthorizationAudit) => unknown;
}>;

const liveModeAuthorizationProvenance =
  createProvenanceWitness<LiveModeAuthorization>();

/** Whether this exact object is one `resolveLiveModeAuthorization` issued. */
export function hasLiveModeAuthorizationProvenance(
  value: unknown,
): value is LiveModeAuthorization {
  return liveModeAuthorizationProvenance.holds(value);
}

const notAuthorized = (detail: string): BillingOutcome<never> =>
  billingRefuse(
    BILLING_REFUSE_REASONS.liveModeNotAuthorized,
    `Live-mode billing is not authorized: ${detail}`,
  );

/**
 * Whether a value is one this resolver would have to await.
 *
 * Fail-closed on a `then` accessor that throws: a sink whose answer cannot even
 * be inspected is not one that proved it recorded anything.
 */
function isThenable(value: unknown): boolean {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  ) {
    return false;
  }
  try {
    return typeof (value as { then?: unknown }).then === "function";
  } catch {
    return true;
  }
}

/** Whether `YYYY-MM-DD` names a real calendar day, not merely four-two-two digits. */
function isCalendarDate(value: string): boolean {
  if (!AUTHORIZED_ON_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/**
 * Resolve live-mode authorization from the one named variable, or refuse.
 *
 * Every refusal is `STRIPE_LIVE_MODE_NOT_AUTHORIZED` with a message naming which
 * step failed. One reason on purpose: "the variable is malformed" and "the
 * variable is absent" have exactly the same consequence, and a caller that could
 * tell them apart might be tempted to treat one as recoverable.
 *
 * The order is the contract — alias, presence, shape, authorship, date, audit —
 * and the audit sink runs last, so it is only asked to record an authorization
 * that is otherwise complete, and its failure still refuses.
 */
export function resolveLiveModeAuthorization(
  request: ResolveLiveModeAuthorizationRequest,
): BillingOutcome<LiveModeAuthorization> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return notAuthorized(
      "a live-mode authorization request must be a plain object.",
    );
  }
  const { env, recordAudit } = record as ResolveLiveModeAuthorizationRequest;

  if (env === null || typeof env !== "object") {
    return notAuthorized("no environment was supplied to read it from.");
  }
  for (const alias of STRIPE_LIVE_MODE_ALIAS_ENV_VARS) {
    if (Object.hasOwn(env, alias) && env[alias] !== undefined) {
      return notAuthorized(
        `${alias} is set, but live mode is authorized from ${STRIPE_LIVE_MODE_ENV_VAR} alone; a second name for the same decision is refused by its presence.`,
      );
    }
  }

  const raw = env[STRIPE_LIVE_MODE_ENV_VAR];
  if (raw === undefined) {
    return notAuthorized(`${STRIPE_LIVE_MODE_ENV_VAR} is not set.`);
  }
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return notAuthorized(
      `${STRIPE_LIVE_MODE_ENV_VAR} is empty or whitespace-only.`,
    );
  }

  const parts = raw.trim().split(":");
  if (parts.length !== 3 || parts[0] !== STRIPE_LIVE_MODE_AFFIRMATIVE) {
    return notAuthorized(
      `${STRIPE_LIVE_MODE_ENV_VAR} must be exactly "${STRIPE_LIVE_MODE_AFFIRMATIVE}:<email>:<YYYY-MM-DD>"; no other value is an affirmative.`,
    );
  }
  const [, authorizer, authorizedOn] = parts as [string, string, string];
  if (!isPlausibleEmail(authorizer)) {
    return notAuthorized(
      `${STRIPE_LIVE_MODE_ENV_VAR} names no plausible address as authorizing live mode; it may not be switched on anonymously.`,
    );
  }
  if (!isCalendarDate(authorizedOn)) {
    return notAuthorized(
      `${STRIPE_LIVE_MODE_ENV_VAR} names no valid YYYY-MM-DD authorization date.`,
    );
  }
  if (typeof recordAudit !== "function") {
    return notAuthorized(
      "no audit sink was supplied, and an authorization the deployment cannot observe afterwards is exactly the silent environment edit this gate exists to prevent.",
    );
  }

  const authorizedBy = normalizeEmail(authorizer);
  const fingerprint = createHash("sha256")
    .update(
      `${STRIPE_LIVE_MODE_ENV_VAR}\n${authorizedBy}\n${authorizedOn}`,
      "utf8",
    )
    .digest("hex");
  const audit: LiveModeAuthorizationAudit = Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.stripe-live-mode-authorization-audit" as const,
    source: STRIPE_LIVE_MODE_ENV_VAR,
    authorizedBy,
    authorizedOn,
    fingerprint,
    record: `${STRIPE_LIVE_MODE_ENV_VAR}: Stripe live mode authorized by ${authorizedBy} on ${authorizedOn} (sha256:${fingerprint})`,
  });

  let recorded: unknown;
  try {
    recorded = recordAudit(audit);
  } catch {
    return notAuthorized(
      "the audit sink failed, so the authorization was not recorded and is not honored.",
    );
  }
  if (isThenable(recorded)) {
    void Promise.resolve(recorded).catch(() => undefined);
    return notAuthorized(
      "the audit sink answered with a promise, and a synchronous resolver cannot wait for it, so the authorization would be issued before the record it depends on either exists or fails.",
    );
  }

  return billingOk(
    liveModeAuthorizationProvenance.issue({
      authorizedBy,
      authorizedOn,
      source: STRIPE_LIVE_MODE_ENV_VAR,
      audit,
    }),
  );
}

/**
 * The `liveModeAuthorized` argument `assertModeAuthorized` takes, derived from a
 * resolved authorization and from nothing else.
 *
 * Returns `true` only for an authorization this module issued, and `undefined`
 * for everything else — a refused resolution, `undefined`, or an object shaped
 * exactly like one. Fail-closed by construction: `assertModeAuthorized` refuses
 * `live` on anything that is not exactly `true`.
 */
export function liveModeAuthorizedFlag(
  authorization: unknown,
): boolean | undefined {
  return hasLiveModeAuthorizationProvenance(authorization) ? true : undefined;
}
