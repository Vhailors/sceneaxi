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
 *   4. current ledger      — persistence is resolved; absent or stale refuses
 *   5. replay              — an already-charged key returns its prior debit
 *   6. entitlement         — capability, account, and the **persisted balance**,
 *                            all pre-flight
 *   7. metering readiness  — store, reason, and key checked before spending money
 *   8. provider            — the injected call, and only now
 *   9. debit               — exactly the credits the decision named
 *
 * Steps 6 and 8 in that order are the load-bearing part: an unfunded account is
 * refused *before* the provider runs, so a zero balance costs nothing and appends
 * nothing. The inverse — call first, discover the balance after — is what
 * produces either an unpaid call or a ledger entry invented to cover it.
 *
 * That only holds if the balance being judged is both real and current, so step
 * 4 validates the caller's ledger against persistence. A missing ledger or any
 * stale copy refuses before replay, entitlement, or provider dispatch, including
 * for an admin whose allowance will not append a debit. The same current ledger
 * is handed to `meterCredits`, so the balance that authorized the call is the
 * balance the debit lands on.
 *
 * Step 5 makes a retry safe once the caller has refreshed its ledger. The
 * ledger's own idempotency sits at the *bottom* of the stack, below the balance
 * gate and below the provider, so a caller retrying a timed-out turn would be
 * told "you cannot afford this" out of the balance the first attempt already
 * spent, and would pay the upstream provider again for an answer it could never
 * be charged for. Looking the account-scoped key up first answers the retry from
 * the debit that already exists: the balance is judged as it stood when that
 * debit was authorized, the provider is not run, and nothing is charged twice.
 * The model's answer is *not* replayed — the ledger records debits, never
 * responses, and inventing one would be worse than admitting it is gone. A
 * timed-out caller must refresh the ledger before retrying; re-sending its
 * pre-debit view refuses as stale and cannot re-enter the provider.
 *
 * Reading persistence is itself privileged, so the authenticated identity is
 * settled before the store is touched: the account id comes out of a caller-
 * supplied state, and an expired, disabled, or wrong-user principal must not be
 * able to drive a lookup against an account it has no claim to. Every identity
 * refusal is still spoken by `evaluateEntitlement` immediately below, which owns
 * that vocabulary — this step only declines to read, so one defect keeps one
 * voice.
 *
 * The provider is an injected thunk, deliberately not a Model Provider Port type.
 * Billing must not learn what a model is to charge for one, and the port lives
 * above this package in the dependency matrix; a caller wires the two together
 * (see `tests/e2e/hosted-ai-metering-golden.test.ts`). That also keeps every
 * credential and every network decision outside the credit plane. Because the
 * thunk is provider-neutral, only a **throw** means failure here: an adapter that
 * reports refusals as a value (the Model Provider Port's `{ ok: false, reason }`
 * among them) must be translated by the caller's own integration before it
 * reaches this gate, or a refused call would be billed as a completed one.
 *
 * BYO keys are free and never reach step 7: the user already pays their own
 * provider, so `byo-model-keys` resolves on the entitlement matrix's
 * free-without-account path and the ledger is not read, let alone written.
 */

import {
  requireAuthenticated,
  type AdminIdentity,
  type Awaitable,
} from "@sceneaxi/auth";
import {
  isEpochMilliseconds,
  snapshotPlainRecord,
  type CreditAccount,
  type CreditLedgerEntry,
  type EntitlementCapability,
  type EntitlementDecision,
  type IdentitySurface,
} from "@sceneaxi/schemas";
import { evaluateEntitlement } from "./entitlements.js";
import {
  loadLedgerState,
  validateLedgerState,
  type LedgerState,
} from "./ledger.js";
import {
  meterCredits,
  meteringIdempotencyKey,
  sameLedgerState,
} from "./metering.js";
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
 *
 * That is the whole contract, and it puts one obligation on the caller: **a
 * returned value is a completed call and will be charged for.** Provider layers
 * that report refusals as data rather than as a throw — the Model Provider Port's
 * `{ ok: false, reason }` is the one in this repo — must be translated by the
 * caller's own provider integration:
 *
 * ```ts
 * const call = async () => {
 *   const result = await port.complete(request);
 *   if (!result.ok) throw new Error(result.reason);
 *   return result;
 * };
 * ```
 *
 * Billing cannot do that translation itself without learning the shape of a
 * model refusal, which is exactly the coupling this thunk exists to avoid; and it
 * cannot guess, because "false", "empty", and "`ok: false`" are ordinary
 * successful answers for some other provider. So the translation is the
 * integration's job, and an untranslated refusal is billed as a success.
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
  /**
   * Which credit account this call is charged against. Hosted route only.
   *
   * Required and checked against persistence on the hosted route. An absent or
   * stale state refuses before replay, entitlement, or provider dispatch.
   */
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

/** A call that reached the provider: its answer is here. */
export type MeteredModelCallCompleted<Response> = Readonly<{
  replayed: false;
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
}>;

/**
 * A call whose account-scoped idempotency key had already been charged.
 *
 * There is deliberately no `response` field to read: the ledger persists debits,
 * not model answers, so the original response is gone and this module will not
 * fabricate one. Making that a compile-time fact rather than an `undefined` a
 * caller might forget to check is the point of the separate shape.
 */
export type MeteredModelCallReplayed = Readonly<{
  replayed: true;
  route: HostedAiRoute;
  capability: EntitlementCapability;
  /** The entitlement conclusion the *original* call was authorized under. */
  decision: EntitlementDecision;
  /** Always true: a replay is only detected from a debit that exists. */
  metered: true;
  /** The debit the original call appended; nothing was appended now. */
  entry: CreditLedgerEntry;
  /** The current ledger, unchanged by this call. */
  state: LedgerState;
  /** The current balance, unchanged by this call. */
  balance: number;
}>;

export type RunMeteredModelCallOutcome<Response> =
  | MeteredModelCallCompleted<Response>
  | MeteredModelCallReplayed;

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
 * instance carries `appendOrReplayEntry` on its prototype, and `meterCredits`
 * calls the three methods without caring where they live. Requiring a plain
 * own-property object here would refuse a store the debit path itself would
 * accept. The three checked are exactly the three the debit path calls, so this
 * cannot accept a store that would then crash mid-debit. A throwing accessor
 * still fails closed.
 */
function isCreditStore(value: unknown): value is CreditStore {
  if (value === null || typeof value !== "object") return false;
  try {
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate["findAccountById"] === "function" &&
      typeof candidate["listEntries"] === "function" &&
      typeof candidate["appendOrReplayEntry"] === "function"
    );
  } catch {
    return false;
  }
}

type ReplayedDebit = Readonly<{
  /** The debit the caller's key already produced. */
  entry: CreditLedgerEntry;
  /**
   * The ledger as it stood immediately before that debit.
   *
   * Entitlement is re-evaluated against this rather than against the current
   * balance, because the balance question for a retry is not "can this account
   * afford the charge now" — it already paid it — but "was it entitled when it
   * did". The prefix answers that from the ledger's own history instead of
   * skipping the check, so capability, identity, ownership, and the guard's own
   * refusals all still apply to a retry. A debit can never be the first entry
   * (it would have driven the balance negative), so the prefix is never empty
   * and its derived balance is exactly the balance that authorized the charge.
   */
  priorState: LedgerState;
}>;

type HostedLedger = Readonly<{
  /** The account history as persistence has it, not as the caller reported it. */
  persisted: LedgerState;
  /** Present when this call's account-scoped key has already been charged. */
  replayed?: ReplayedDebit | undefined;
}>;

/**
 * Resolve the persisted ledger and look the account-scoped metering key up in it.
 *
 * The store read makes the answer authoritative, and equality with the supplied
 * state makes it current. An absent or stale ledger refuses before any replay,
 * entitlement, or provider dispatch. A store that cannot be read refuses here
 * because "we do not know whether this was already charged" is not a licence to
 * charge upstream again.
 *
 * The mutated-replay check mirrors the ledger's, so a key re-sent with a
 * different price or reason still conflicts here rather than quietly returning
 * the cheaper original.
 *
 * Returns `undefined` whenever the request is not yet known to be an
 * authenticated, account-owning hosted call; entitlement owns the identity and
 * ownership refusals. An unauthenticated caller cannot make persistence answer
 * questions about an account id it merely named. An authenticated one gets no
 * further unless persistence returns an account owned by that same user.
 */
async function resolveHostedLedger(
  request: Readonly<{
    state: unknown;
    store: unknown;
    reason: unknown;
    creditAmount: unknown;
    idempotencyKey: unknown;
    principal: unknown;
    admin: AdminIdentity | undefined;
    now: number;
    surface: IdentitySurface | undefined;
  }>,
): Promise<BillingOutcome<HostedLedger | undefined>> {
  const {
    state,
    store,
    reason,
    creditAmount,
    idempotencyKey,
    principal,
    admin,
    now,
    surface,
  } = request;
  if (!isCreditStore(store)) return billingOk(undefined);
  const supplied = validateLedgerState(state);
  if (!supplied.ok) return billingOk(undefined);

  if (principal === undefined || principal === null || admin === undefined) {
    return billingOk(undefined);
  }
  const guarded = requireAuthenticated(
    principal,
    surface === undefined ? { now, admin } : { now, surface, admin },
  );
  if (!guarded.ok) return billingOk(undefined);
  if (supplied.value.account.userId !== guarded.value.user.userId) {
    return billingOk(undefined);
  }

  const accountId = supplied.value.account.accountId;
  let account: CreditAccount | undefined;
  let entries: ReadonlyArray<CreditLedgerEntry>;
  try {
    account = await store.findAccountById(accountId);
    if (account === undefined || account === null) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.ledgerStateInvalid,
        "The credit account does not exist in persistence; the model call refuses before the provider.",
      );
    }
    // Ownership is re-asked of the account persistence holds, not of the one the
    // caller wrote down: the two agree for every real caller, and where they do
    // not it is the caller that named an account id it does not own. Refusing
    // here, before the history is loaded and before any key is compared, is what
    // keeps that reach from turning another user's ledger into an oracle.
    if (account.userId !== guarded.value.user.userId) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.accountNotOwned,
        "The credit account belongs to a different user; the model call refuses before the provider.",
      );
    }
    entries = await store.listEntries(accountId);
  } catch {
    return billingRefuse(
      BILLING_REFUSE_REASONS.storeFailed,
      "The credit store failed while loading the account this model call would be charged against.",
    );
  }

  const persisted = loadLedgerState(account, entries);
  if (!persisted.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      `The persisted credit account is invalid: ${persisted.message}`,
    );
  }

  if (!sameLedgerState(supplied.value, persisted.value)) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      "The supplied ledger state is stale; a hosted model call requires the current persisted account state.",
    );
  }

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length === 0 ||
    typeof reason !== "string" ||
    reason.trim().length === 0 ||
    !Number.isSafeInteger(creditAmount) ||
    (creditAmount as number) < 1
  ) {
    return billingOk(Object.freeze({ persisted: persisted.value }));
  }

  const scopedKey = meteringIdempotencyKey(accountId, idempotencyKey);
  const entry = persisted.value.entries.find(
    (candidate) => candidate.idempotencyKey === scopedKey,
  );
  if (entry === undefined) {
    return billingOk(Object.freeze({ persisted: persisted.value }));
  }

  if (
    entry.movement !== "debit" ||
    entry.delta !== -(creditAmount as number) ||
    entry.reason !== reason
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.idempotencyConflict,
      `Idempotency key "${scopedKey}" was already applied with a different movement; a mutated replay is refused.`,
    );
  }

  return billingOk(
    Object.freeze({
      persisted: persisted.value,
      replayed: Object.freeze({
        entry,
        priorState: Object.freeze({
          account: persisted.value.account,
          entries: Object.freeze(
            persisted.value.entries.slice(
              0,
              persisted.value.entries.indexOf(entry),
            ),
          ),
          balance: entry.balanceAfter - entry.delta,
        }),
      }),
    }),
  );
}

/**
 * Everything a debit needs, resolved before the provider is entered.
 *
 * It exists so the charging path cannot be assembled from a ledger the store was
 * never asked about: `persisted` is the history the balance gate judged, and it
 * is the same value handed to `meterCredits`, so the balance that authorized the
 * call is the balance the debit lands on.
 */
type MeteringPlan = Readonly<{
  persisted: LedgerState;
  store: CreditStore;
  reason: string;
  idempotencyKey: string;
  amount: number;
}>;

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

  // The current ledger and replay are resolved before the balance is judged and
  // before the provider is entered. The BYO route is excluded on purpose: it
  // never appends a debit, so it has no prior charge to answer with and a free
  // call is safe to simply run again.
  const resolution: BillingOutcome<HostedLedger | undefined> =
    route === "hosted"
      ? await resolveHostedLedger({
          state,
          store,
          reason,
          creditAmount,
          idempotencyKey,
          principal,
          admin,
          now,
          surface,
        })
      : billingOk(undefined);
  if (!resolution.ok) return resolution;
  const ledger = resolution.value;
  const replayed = ledger === undefined ? undefined : ledger.replayed;

  // Every ledger question is asked of the supplied state after persistence has
  // confirmed it is current. The caller's `state` remains available only where
  // identity or request validation deliberately prevented a store read.
  const entitlementState =
    replayed !== undefined
      ? replayed.priorState
      : ledger === undefined
        ? state
        : ledger.persisted;
  const decision = evaluateEntitlement({
    capability: routeCapability,
    now,
    ...(admin === undefined ? {} : { admin }),
    ...(principal === undefined ? {} : { principal }),
    ...(entitlementState === undefined ? {} : { state: entitlementState }),
    ...(creditAmount === undefined ? {} : { creditAmount }),
    ...(surface === undefined ? {} : { surface }),
  });
  if (!decision.ok) return decision;

  if (route === "hosted" && ledger === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
      "A hosted model call requires a current persisted ledger for every principal.",
    );
  }

  const charge =
    decision.value.outcome === "charge-credits"
      ? decision.value.credits
      : undefined;

  // Metering inputs are validated *before* the provider runs. A missing store or
  // idempotency key is a caller defect, and discovering it after the call would
  // mean a completed model call that can never be charged for. Resolving them
  // into one value is what makes "a charge is judged and landed on persistence"
  // a property of the code: past this block a debit either carries the persisted
  // ledger it was authorized against, or it does not exist.
  let debit: MeteringPlan | undefined;
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
    // Last, so every caller defect above still answers in its own vocabulary.
    // No credit-priced request can reach here with the ledger unresolved — the
    // shapes `resolveHostedLedger` declines to read the store for are exactly
    // the ones entitlement and the three checks above refuse — but leaving that
    // as an argument would make a later precondition added on either side of the
    // pair silently reopen a charge judged on a caller's claim.
    if (ledger === undefined) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.ledgerStateInvalid,
        "A credit-priced model call must be judged against the persisted ledger, which was not resolved for this request.",
      );
    }
    debit = Object.freeze({
      persisted: ledger.persisted,
      store,
      reason,
      idempotencyKey,
      amount: charge,
    });
  }

  // The key already bought this call. Hand back the debit that exists — no
  // second provider execution, no second charge, and no invented answer. The
  // ledger reported is the current persisted one supplied by the caller.
  if (replayed !== undefined && debit !== undefined) {
    return billingOk(
      Object.freeze({
        replayed: true,
        route,
        capability: routeCapability,
        decision: decision.value,
        metered: true,
        entry: replayed.entry,
        state: debit.persisted,
        balance: debit.persisted.balance,
      }),
    );
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
  if (debit === undefined) {
    return billingOk(
      Object.freeze({
        replayed: false,
        route,
        capability: routeCapability,
        decision: decision.value,
        response,
        metered: false,
        entry: undefined,
        state: undefined,
        balance: undefined,
      }),
    );
  }

  const metered = await meterCredits({
    principal,
    admin: admin as AdminIdentity,
    store: debit.store,
    state: debit.persisted,
    amount: debit.amount,
    reason: debit.reason,
    idempotencyKey: debit.idempotencyKey,
    now,
    ...(surface === undefined ? {} : { surface }),
  });
  if (!metered.ok) return metered;

  // Not `metered.value.replayed`: a replay is settled above against the persisted
  // ledger, and `meterCredits` requires the supplied state to equal that same
  // persisted ledger before it appends. Reaching the ledger's own replay branch
  // from here is impossible, so reporting it would be a guarantee no path can
  // produce.
  return billingOk(
    Object.freeze({
      replayed: false,
      route,
      capability: routeCapability,
      decision: decision.value,
      response,
      metered: metered.value.metered,
      entry: metered.value.entry,
      state: metered.value.state,
      balance: metered.value.balance,
    }),
  );
}
