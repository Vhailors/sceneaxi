/**
 * The hosted-AI credit gate: the one path a SceneAxi-hosted model call may take.
 *
 * A model call is not a new kind of money. This module owns no ledger, no second
 * entitlement table, and no provider abstraction — it composes the two that
 * already exist (`evaluateEntitlement`, `meterCredits`) into the single ordering
 * a hosted call is allowed to happen in, so no surface can assemble a different
 * one:
 *
 *   1. Kids                — denied by name before identity, provider, or ledger
 *   2. route               — `hosted` or `byo`, an enumeration with no default
 *   3. hosted opt-in       — off unless a caller explicitly enables it
 *   4. entitlement         — capability, account, and **balance**, all pre-flight
 *   5. metering readiness  — store, reason, and key checked before spending money
 *   6. provider            — the injected call, and only now
 *   7. debit               — exactly the credits the decision named
 *
 * Steps 4 and 6 in that order are the load-bearing part: an unfunded account is
 * refused *before* the provider runs, so a zero balance costs nothing and appends
 * nothing. The inverse — call first, discover the balance after — is what
 * produces either an unpaid call or a ledger entry invented to cover it.
 *
 * The provider is an injected thunk, deliberately not a Model Provider Port type.
 * Billing must not learn what a model is to charge for one, and the port lives
 * above this package in the dependency matrix; a caller wires the two together
 * (see `tests/e2e/hosted-ai-metering-golden.test.ts`). That also keeps every
 * credential and every network decision outside the credit plane.
 *
 * BYO keys are free and never reach step 7: the user already pays their own
 * provider, so `byo-model-keys` resolves on the entitlement matrix's
 * free-without-account path and the ledger is not read, let alone written.
 */

import type { AdminIdentity, Awaitable } from "@sceneaxi/auth";
import {
  isEpochMilliseconds,
  snapshotPlainRecord,
  type CreditLedgerEntry,
  type EntitlementCapability,
  type EntitlementDecision,
  type IdentitySurface,
} from "@sceneaxi/schemas";
import { evaluateEntitlement } from "./entitlements.js";
import type { LedgerState } from "./ledger.js";
import { meterCredits } from "./metering.js";
import type { CreditStore } from "./store.js";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";

/** How a model call is paid for. A closed enumeration; there is no default. */
export const HOSTED_AI_ROUTES = Object.freeze(["hosted", "byo"] as const);

export type HostedAiRoute = (typeof HOSTED_AI_ROUTES)[number];

/**
 * Which entitlement capabilities each route may be billed under.
 *
 * Per-route allow-lists rather than one capability per route, because the matrix
 * prices two distinct hosted products — a hosted assistant turn and a direct
 * metered Model Provider Port call — and the caller, not this module, knows which
 * one it is selling. A capability outside its route's list refuses; nothing is
 * inferred.
 */
export const HOSTED_AI_ROUTE_CAPABILITIES = Object.freeze({
  hosted: Object.freeze([
    "hosted-ai-assistant",
    "metered-model-port",
  ] as const),
  byo: Object.freeze(["byo-model-keys"] as const),
}) satisfies Readonly<
  Record<HostedAiRoute, ReadonlyArray<EntitlementCapability>>
>;

/**
 * Whether the hosted route may run at all.
 *
 * A separate, explicit switch — not derived from "is an adapter configured" or
 * "is an API key present". Possessing an OpenRouter key is not a decision to
 * spend a user's credits, so configuration alone can never turn hosted AI on.
 */
export type HostedAiConfig = Readonly<{ enabled: boolean }>;

/** The shipped default: hosted AI is off. */
export const HOSTED_AI_DEFAULT_CONFIG: HostedAiConfig = Object.freeze({
  enabled: false,
});

/**
 * The injected provider call.
 *
 * Returns whatever the caller's provider layer returns; billing never inspects
 * it. A throw is a provider failure and refuses without a debit.
 */
export type HostedAiProviderCall<Response> = () => Awaitable<Response>;

export type RunMeteredModelCallRequest<Response> = Readonly<{
  route: unknown;
  capability: unknown;
  /** The provider work to run once the call is entitled. */
  call: HostedAiProviderCall<Response>;
  /** Epoch milliseconds. */
  now: number;
  /** Absent or `{ enabled: false }` keeps the hosted route off. */
  hostedAi?: HostedAiConfig | undefined;
  /** The single resolved admin identity; required on any route that bills. */
  admin?: AdminIdentity | undefined;
  /** Absent means anonymous — valid for BYO, refused for hosted. */
  principal?: unknown;
  /** The ledger the debit would land on. Hosted route only. */
  state?: LedgerState | undefined;
  /** Where the debit is persisted. Hosted route only. */
  store?: CreditStore | undefined;
  /** The exact integer credit cost of this call. Hosted route only. */
  creditAmount?: number | undefined;
  /** Attribution for the ledger entry. Hosted route only. */
  reason?: string | undefined;
  /** Caller replay key; scoped to the account by `meterCredits`. */
  idempotencyKey?: string | undefined;
  /** The surface the request arrives on. `kids` refuses every route. */
  surface?: IdentitySurface | undefined;
}>;

export type RunMeteredModelCallOutcome<Response> = Readonly<{
  route: HostedAiRoute;
  capability: EntitlementCapability;
  /** The entitlement conclusion this call was authorized under. */
  decision: EntitlementDecision;
  /** What the provider returned; untouched by billing. */
  response: Response;
  /**
   * False when nothing was charged — the free BYO route, or an admin's unlimited
   * allowance. Reported explicitly rather than as a zero-credit ledger row.
   */
  metered: boolean;
  /** The debit, when one was appended. */
  entry?: CreditLedgerEntry | undefined;
  /** The ledger after the debit. Absent when nothing was metered. */
  state?: LedgerState | undefined;
  /** The balance after the debit. Absent when nothing was metered. */
  balance?: number | undefined;
  /** True when the idempotency key had already been applied. */
  replayed: boolean;
}>;

function isHostedAiRoute(value: unknown): value is HostedAiRoute {
  return HOSTED_AI_ROUTES.some((route) => route === value);
}

/** Kids detection, matching `evaluateEntitlement`'s own read of a request. */
function isKidsRequest(principal: unknown, surface: unknown): boolean {
  if (surface === "kids") return true;
  const principalRecord = snapshotPlainRecord(principal);
  const session = snapshotPlainRecord(principalRecord?.["session"]);
  return session?.["surface"] === "kids";
}

/**
 * The store is an injected persistence adapter, so its shape is duck-typed the
 * way this repo duck-types every other injected adapter: a Neon-backed class
 * instance carries `appendEntry` on its prototype, and `meterCredits` calls the
 * three methods without caring where they live. Requiring a plain own-property
 * object here would refuse a store the debit path itself would accept. A
 * throwing accessor still fails closed.
 */
function isCreditStore(value: unknown): value is CreditStore {
  if (value === null || typeof value !== "object") return false;
  try {
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate["findAccountById"] === "function" &&
      typeof candidate["listEntries"] === "function" &&
      typeof candidate["appendEntry"] === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Run one model call under the credit plane, or refuse without side effects.
 *
 * Every refusal keeps the identity of the layer that produced it — the guard's
 * `AUTH_SESSION_EXPIRED`, the matrix's `CREDIT_BALANCE_INSUFFICIENT`, the store's
 * `CREDIT_STORE_FAILED` — so a caller can tell "you cannot afford this" from "we
 * could not reach the ledger" and from "the model itself failed".
 */
export async function runMeteredModelCall<Response>(
  request: RunMeteredModelCallRequest<Response>,
): Promise<BillingOutcome<RunMeteredModelCallOutcome<Response>>> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A metered model call request must be a plain object.",
    );
  }
  const screened = record as RunMeteredModelCallRequest<Response>;
  const {
    route,
    capability,
    call,
    now,
    hostedAi,
    admin,
    principal,
    state,
    store,
    creditAmount,
    reason,
    idempotencyKey,
    surface,
  } = screened;

  if (!isEpochMilliseconds(now)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.clockInvalid,
      "A metered model call requires valid epoch milliseconds.",
    );
  }

  // Kids first, and independently of the entitlement matrix's own Kids denial:
  // no identity is read, no provider is reached, and no ledger is touched on the
  // Kids surface, on either route, whatever else the request asks for.
  if (isKidsRequest(principal, surface)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.kidsCommerceDenied,
      "Kids commerce is denied; no hosted or bring-your-own model call is billed or brokered on the Kids surface.",
    );
  }

  if (!isHostedAiRoute(route)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.hostedAiRouteInvalid,
      `A model call must name a route: ${HOSTED_AI_ROUTES.join(" or ")}.`,
    );
  }
  const routeCapabilities: ReadonlyArray<EntitlementCapability> =
    HOSTED_AI_ROUTE_CAPABILITIES[route];
  if (!routeCapabilities.some((allowed) => allowed === capability)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.capabilityUnknown,
      `"${String(capability)}" is not a "${route}" route capability; that route bills ${routeCapabilities.join(" or ")}.`,
    );
  }
  const routeCapability = capability as EntitlementCapability;

  if (typeof call !== "function") {
    return billingRefuse(
      BILLING_REFUSE_REASONS.requestInvalid,
      "A metered model call requires an injected provider call.",
    );
  }

  // Default-off. Reached before identity and before the ledger, so "hosted AI is
  // not enabled here" is answerable without an account and can never be mistaken
  // for a balance problem.
  if (route === "hosted" && hostedAi?.enabled !== true) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.hostedAiNotEnabled,
      "SceneAxi-hosted AI is off by default and must be enabled explicitly; a configured provider adapter or key does not enable it.",
    );
  }

  const decision = evaluateEntitlement({
    capability: routeCapability,
    now,
    ...(admin === undefined ? {} : { admin }),
    ...(principal === undefined ? {} : { principal }),
    ...(state === undefined ? {} : { state }),
    ...(creditAmount === undefined ? {} : { creditAmount }),
    ...(surface === undefined ? {} : { surface }),
  });
  if (!decision.ok) return decision;

  const charge =
    decision.value.outcome === "charge-credits"
      ? decision.value.credits
      : undefined;

  // Metering inputs are validated *before* the provider runs. A missing store or
  // idempotency key is a caller defect, and discovering it after the call would
  // mean a completed model call that can never be charged for.
  if (charge !== undefined) {
    if (!isCreditStore(store)) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.requestInvalid,
        "A credit-priced model call requires a credit store to persist the debit.",
      );
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.requestInvalid,
        "A credit-priced model call requires a non-empty reason so every debit is attributable.",
      );
    }
    if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.requestInvalid,
        "A credit-priced model call requires a non-empty idempotency key.",
      );
    }
  }

  let response: Response;
  try {
    response = await call();
  } catch {
    return billingRefuse(
      BILLING_REFUSE_REASONS.hostedAiProviderFailed,
      "The model provider call failed; nothing was charged.",
    );
  }

  // Free BYO, and the captain's unlimited allowance: no debit exists to append,
  // and saying so beats writing a zero-credit row that means nothing.
  if (charge === undefined) {
    return billingOk(
      Object.freeze({
        route,
        capability: routeCapability,
        decision: decision.value,
        response,
        metered: false,
        entry: undefined,
        state: undefined,
        balance: undefined,
        replayed: false,
      }),
    );
  }

  const metered = await meterCredits({
    principal,
    admin: admin as AdminIdentity,
    store: store as CreditStore,
    state: state as LedgerState,
    amount: charge,
    reason: reason as string,
    idempotencyKey: idempotencyKey as string,
    now,
    ...(surface === undefined ? {} : { surface }),
  });
  if (!metered.ok) return metered;

  return billingOk(
    Object.freeze({
      route,
      capability: routeCapability,
      decision: decision.value,
      response,
      metered: metered.value.metered,
      entry: metered.value.entry,
      state: metered.value.state,
      balance: metered.value.balance,
      replayed: metered.value.replayed,
    }),
  );
}
