/**
 * The credit-pack webhook path: a signed Stripe event becomes ledger credits, once.
 *
 * Every security-relevant step is owned by `@sceneaxi/billing` and merely *sequenced*
 * here — signature verification over the raw bytes, binding the event to the persisted
 * intent, and the idempotent grant. This module adds no verification of its own, and
 * deliberately cannot skip any: `applyCheckoutCompletedGrant` accepts only the output of
 * `parseCheckoutCompletedEvent`, which accepts only the output of
 * `verifyStripeWebhookSignature` — each checked at runtime by object identity, not only
 * by type (sceneaxi#126). An unsigned or replayed body has no path to a grant at all,
 * and neither does a copy of a genuine completion.
 *
 * The order below is the security design, not a convenience:
 *
 *   1. secret present        — an unconfigured endpoint refuses, never accepts
 *   2. signature over bytes  — before the body is parsed as anything
 *   3. intent + settlement   — the price snapshot, not the event, names the credits
 *   4. grant and commit      — one call, `persistCheckoutCompletedGrant`, which is the
 *                              only commit boundary credits have anywhere (D4)
 *
 * Step 4 used to be two steps here — decide, then hand the entry to `appendEntry` and
 * reconcile a throw by re-reading the ledger. That reconciliation existed because
 * `appendEntry` reports an ordinary redelivery race and a genuine store failure
 * identically, so only the ledger could tell them apart. `persistCheckoutCompletedGrant`
 * commits through `appendOrReplayEntry` instead, which answers the race itself — the row
 * already committed under this event's key is handed back as `replayed: true`, checked
 * against the entry that was requested and the ledger position it was requested for. A
 * throw is therefore what it says it is: a store failure, refused `CREDIT_STORE_FAILED`
 * with no grant claimed, which Stripe retries and the ledger answers on redelivery. The
 * guarantee this module used to implement itself is unchanged and now has one owner.
 *
 * One endpoint receives every event Stripe is configured to send, so what is *not* this
 * endpoint's work — another event type, or a completion whose purpose settles on the
 * revenue-share path — is acknowledged, never refused: no grant is owed, and a non-2xx
 * would ask Stripe to redeliver a condition redelivery cannot change. Each of those is
 * decided at the earliest point that can decide it, and never behind a read that may
 * fail: both the event type and a purpose that settles elsewhere are read from the
 * verified body before any adapter or store is consulted. An event this path owes
 * nothing must not become a permanent retry because an unrelated port was unreachable.
 *
 * Only `checkout.session.completed` grants credits here, which keeps this endpoint's
 * Checkout card-only: a delayed-notification payment method completes the session before
 * the money confirms, and settling it would need grant and idempotency semantics this
 * step does not have. That boundary is a scope decision, recorded in
 * `docs/websites-deploy.md`, not an omission — the later confirmation event stays
 * unhandled rather than being half-supported.
 *
 * `live` mode is never authorized from here. `applyCheckoutCompletedGrant` refuses a
 * livemode event without an explicit captain go-live decision, and this module has no
 * parameter that could supply one.
 */
import {
  BILLING_REFUSE_REASONS,
  CHECKOUT_METADATA_KEYS,
  checkoutPurposeGrantsCredits,
  checkoutPurposeSettlesElsewhere,
  loadLedgerState,
  parseCheckoutCompletedEvent,
  persistCheckoutCompletedGrant,
  verifyStripeWebhookSignature,
  type CheckoutSettlement,
  type CreditStore,
} from "@sceneaxi/billing";

/** The header Stripe signs every webhook body with. */
export const STRIPE_SIGNATURE_HEADER = "stripe-signature" as const;

/** The environment variable holding the endpoint's signing secret. */
export const STRIPE_WEBHOOK_SECRET_ENV = "STRIPE_WEBHOOK_SECRET" as const;

/**
 * The persisted intent for a checkout, and the settlement retrieved from the provider.
 *
 * Both are injected: the intent was written when the checkout was created, and the
 * settlement is a Stripe API read, because a signed `checkout.session.completed` body
 * does not carry line items. Neither is trusted from the event.
 */
export type CheckoutEvidencePort = {
  findIntent(intentId: string): Promise<unknown> | unknown;
  retrieveSettlement(
    sessionId: string,
  ): Promise<CheckoutSettlement | undefined> | CheckoutSettlement | undefined;
};

/**
 * What this plane did with a webhook body. Three states, not two.
 *
 * "Granted nothing" is not the same as "failed": an event this endpoint is deliberately
 * not built to act on — a type it does not handle, a purpose that settles elsewhere, a
 * checkout session this deployment never created — *was* honoured, by taking no action.
 * Answering it non-2xx would make Stripe redeliver a condition no redelivery can change,
 * and those permanent failures count against the health of the same endpoint every real
 * grant depends on. `ignored` states that outcome rather than overloading `replayed`, so
 * the honesty invariant still holds: `ignored: false` means credits are in the ledger.
 */
export type CreditWebhookOutcome =
  | {
      readonly ok: true;
      readonly ignored: false;
      /** True when this event had already been applied and nothing was appended. */
      readonly replayed: boolean;
      readonly credits: number;
      readonly balance: number;
    }
  | {
      readonly ok: true;
      readonly ignored: true;
      readonly reason: string;
      readonly message: string;
    }
  | { readonly ok: false; readonly reason: string; readonly message: string };

const refused = (reason: string, message: string): CreditWebhookOutcome =>
  Object.freeze({ ok: false as const, reason, message });

const ignored = (reason: string, message: string): CreditWebhookOutcome =>
  Object.freeze({ ok: true as const, ignored: true as const, reason, message });

/** Local reasons for the failures that are this module's own, not a package's. */
export const CREDIT_WEBHOOK_REASONS = Object.freeze({
  evidenceMissing: "STRIPE_CHECKOUT_EVIDENCE_MISSING",
  evidenceUnavailable: "STRIPE_CHECKOUT_EVIDENCE_UNAVAILABLE",
  eventUnrelated: "STRIPE_WEBHOOK_EVENT_UNRELATED",
  ledgerUnavailable: "CREDIT_LEDGER_UNAVAILABLE",
  storeFailed: "CREDIT_STORE_FAILED",
} as const);

/**
 * The reasons that name an event this endpoint takes no action on, by design.
 *
 * `STRIPE_WEBHOOK_EVENT_TYPE_UNSUPPORTED` is the billing package's own name for both
 * halves of that: a body that is not a `checkout.session.completed`, and a completion
 * whose purpose settles on the revenue-share path instead of the ledger. Neither is a
 * fault, and neither can become handleable on redelivery.
 */
const UNHANDLED_EVENT_REASONS: ReadonlySet<string> = Object.freeze(
  new Set<string>([
    BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
    CREDIT_WEBHOOK_REASONS.eventUnrelated,
  ]),
);

/**
 * The refusals that mean *this deployment* could not complete a well-formed event.
 *
 * The sender did nothing wrong in any of them: the endpoint has no signing secret
 * configured, its clock is unusable, an adapter threw, its own checkout adapter never
 * persisted the intent the grant must be bound to, its own settlement adapter answered
 * for a different Checkout Session than the one asked about or did not echo the session
 * id at all, its own ledger rows do not load, its own bundled credit-pack archive does not
 * validate, or the purchasing user has no provisioned credit account. They are separated from the request-fault refusals so the transport can
 * answer a status that names the failing side — an operator who forgot
 * `STRIPE_WEBHOOK_SECRET`, or whose adapter forgot to persist intents, must not see their
 * own omission reported as a bad request from Stripe.
 *
 * The settlement one is server-side because both sides of that comparison come from one
 * signature-verified body: this module reads the session id out of the verified payload
 * and asks its own `retrieveSettlement` for exactly that id, so only the adapter's answer
 * can disagree. A sender cannot reach it — a forged or replayed body is refused by
 * signature verification first, and that stays a request fault.
 *
 * `CREDIT_REQUEST_INVALID` is here for the same reason the store failures are: the commit
 * boundary refuses it for a request *this module* built, never for anything the inbound
 * bytes decided, so a sender must not be told they sent a bad request — and money may
 * already have moved, so it must stay retryable.
 */
const SERVER_SIDE_REASONS: ReadonlySet<string> = Object.freeze(
  new Set<string>([
    CREDIT_WEBHOOK_REASONS.evidenceMissing,
    CREDIT_WEBHOOK_REASONS.evidenceUnavailable,
    CREDIT_WEBHOOK_REASONS.ledgerUnavailable,
    CREDIT_WEBHOOK_REASONS.storeFailed,
    BILLING_REFUSE_REASONS.requestInvalid,
    BILLING_REFUSE_REASONS.webhookSecretMissing,
    BILLING_REFUSE_REASONS.settlementSessionMismatch,
    BILLING_REFUSE_REASONS.clockInvalid,
    BILLING_REFUSE_REASONS.storeFailed,
    BILLING_REFUSE_REASONS.ledgerStateInvalid,
    BILLING_REFUSE_REASONS.ledgerOrderInvalid,
    BILLING_REFUSE_REASONS.entryInvalid,
    BILLING_REFUSE_REASONS.catalogInvalid,
    BILLING_REFUSE_REASONS.catalogRevisionUnresolvable,
    BILLING_REFUSE_REASONS.catalogRevisionCreditsMismatch,
  ]),
);

/**
 * The HTTP status a *refusal* should be answered with. Acknowledged no-ops never reach
 * here — they are 2xx, decided by the outcome's `ignored` flag rather than by a reason.
 *
 * Stripe retries every non-2xx either way, so no grant depends on this — the status is
 * a diagnostic. A forged signature and an unreachable database must not look identical
 * in the provider dashboard or in status-code alerting, so the reasons this deployment
 * owns answer 503 and the ones the request owns answer 400.
 */
export function creditWebhookHttpStatus(reason: string): 400 | 503 {
  return SERVER_SIDE_REASONS.has(reason) ? 503 : 400;
}

/**
 * Report a package refusal, acknowledging the ones that name an event this endpoint is
 * not built to act on. Every security refusal — signature, payload, intent mismatch,
 * live mode — falls through to a genuine refusal, because none of them is in the
 * unhandled set.
 */
const settle = (reason: string, message: string): CreditWebhookOutcome =>
  UNHANDLED_EVENT_REASONS.has(reason) ? ignored(reason, message) : refused(reason, message);

/**
 * Await an injected adapter call, reporting a throw rather than propagating it.
 *
 * Every port sequenced below — the checkout evidence adapter and the credit store —
 * is a provider-backed handle this repository does not own, so each can throw on a
 * transport failure the caller cannot see. This module answers with a named refusal
 * for every failure, so no such throw may escape as an unnamed framework error: the
 * endpoint must be able to say which step failed, and Stripe must see a non-2xx it
 * retries rather than a crash.
 */
async function attempt<T>(
  call: () => Promise<T> | T,
): Promise<{ readonly ok: true; readonly value: T } | { readonly ok: false }> {
  try {
    return { ok: true as const, value: await call() };
  } catch {
    return { ok: false as const };
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

const asId = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/**
 * What a verified body offers this endpoint: the two lookup keys, or the reason there
 * are none.
 *
 * The five non-key answers are deliberately distinct. A body whose type this path does
 * not handle owes no work regardless of what it carries, so it is decided here — before
 * an adapter is consulted — rather than after two provider reads that a non-completed
 * session cannot satisfy: an expired credit-pack checkout carries the same session id and
 * the same SceneAxi metadata as the completion, but no settlement, so diagnosing it later
 * turns an acknowledgeable event into a permanent retry. A completion whose purpose
 * settles on the revenue-share path owes this endpoint nothing for the same reason, and
 * is decided here too: its intent lives in that path's own store and its settlement is
 * still a provider read that can fail, so waiting for either would make an event that
 * grants nothing depend on ports it never needed. A signed body carrying no
 * SceneAxi metadata key at all is simply an event this deployment did not create — the
 * same Stripe account may serve other products — so it too is acknowledged, not failed.
 * A body that *does* carry a SceneAxi key but cannot be routed is the opposite: this
 * deployment created that checkout, money moved, and acknowledging it would silently
 * strand a paid-but-ungranted purchase Stripe would never redeliver. It is refused
 * exactly like the other three metadata keys, which `parseCheckoutCompletedEvent` already
 * refuses as an invalid payload, so one contract does not have two opposite failure
 * modes. A signed body that is not a JSON event object, or carries no event type at all,
 * is a fault worth surfacing, because Stripe does not send one.
 */
type CheckoutLookup =
  | { readonly kind: "keys"; readonly intentId: string; readonly sessionId: string }
  | { readonly kind: "unhandledType"; readonly eventType: string }
  | { readonly kind: "unhandledPurpose"; readonly purpose: string }
  | { readonly kind: "incomplete" }
  | { readonly kind: "unrelated" }
  | { readonly kind: "unreadable"; readonly detail: string };

/** The one event type that can carry a completed checkout this path grants credits for. */
const HANDLED_EVENT_TYPE = "checkout.session.completed" as const;

const unreadable = (detail: string): CheckoutLookup =>
  Object.freeze({ kind: "unreadable" as const, detail });

/** Every metadata key SceneAxi stamps on a checkout session it created. */
const SCENEAXI_METADATA_KEYS: readonly string[] = Object.freeze(
  Object.values(CHECKOUT_METADATA_KEYS),
);

/**
 * Whether a session's metadata claims this deployment created the checkout.
 *
 * Presence, not validity, is the question: a key stamped with an empty or malformed
 * value still says the session is SceneAxi's, and must not be mistaken for a foreign
 * product's event and permanently acknowledged.
 */
const claimsSceneAxiCheckout = (metadata: Record<string, unknown> | undefined): boolean =>
  metadata !== undefined && SCENEAXI_METADATA_KEYS.some((key) => Object.hasOwn(metadata, key));

/**
 * The two lookup keys a verified checkout body carries: which session to retrieve
 * settlement for, and which persisted intent to bind it to.
 *
 * Nothing else is read from the event. The persisted intent supplies the lookup tuple
 * and settlement comparison, while the committed archive supplies the credits that may
 * be granted; an attacker able to influence event metadata still cannot name their own
 * credit amount. These two are only *lookup keys*, and a key that names the wrong intent
 * fails the parser's own
 * metadata/mode cross-check immediately after. The event type and the purpose are read at
 * that same trust level and for the same reason — to route, never to admit: each can only
 * send a body away from the grant path, an unknown or absent purpose keeps its existing
 * path, and `parseCheckoutCompletedEvent` still owns the authoritative check — including
 * the purpose cross-check against the persisted intent — for every body that stays on it.
 */
function lookupKeysOf(payload: string): CheckoutLookup {
  let raw: unknown;
  try {
    raw = JSON.parse(payload) as unknown;
  } catch {
    raw = undefined;
  }
  const event = asRecord(raw);
  if (event === undefined) {
    return unreadable(
      "The verified body is not a JSON event object, so no persisted price snapshot can be bound to it.",
    );
  }
  const eventType = event["type"];
  if (typeof eventType !== "string" || eventType.length === 0) {
    return unreadable(
      "The verified event carries no type, so which path owes it work cannot be decided; Stripe does not send such a body.",
    );
  }
  if (eventType !== HANDLED_EVENT_TYPE) {
    return Object.freeze({ kind: "unhandledType" as const, eventType });
  }
  const object = asRecord(asRecord(event["data"])?.["object"]);
  const metadata = asRecord(object?.["metadata"]);
  const sessionId = asId(object?.["id"]);
  const intentId = asId(metadata?.[CHECKOUT_METADATA_KEYS.intentId]);
  if (sessionId === undefined || intentId === undefined) {
    return Object.freeze({
      kind: claimsSceneAxiCheckout(metadata) ? ("incomplete" as const) : ("unrelated" as const),
    });
  }
  const purpose = metadata?.[CHECKOUT_METADATA_KEYS.purpose];
  if (typeof purpose === "string" && checkoutPurposeSettlesElsewhere(purpose)) {
    return Object.freeze({ kind: "unhandledPurpose" as const, purpose });
  }
  return Object.freeze({ kind: "keys" as const, intentId, sessionId });
}

/**
 * Apply a Stripe credit-pack webhook to a user's ledger.
 *
 * Returns the plane's own named refusal for every failure — an absent secret, a bad
 * signature, a stale timestamp, evidence that does not match the intent, an injected
 * adapter that throws — so the endpoint never answers "ok" for a body it did not
 * honour, and never answers an unnamed error for a step it can name. Events this
 * endpoint is not built to act on are the one 2xx that grants nothing, and they say so
 * with `ignored: true` and their own reason.
 */
export async function applyCreditPackWebhook(input: {
  /** The **raw** request body. Re-serialising it invalidates the signature, by design. */
  readonly payload: string;
  readonly signatureHeader: string | null;
  readonly secret: string | undefined;
  readonly store: CreditStore;
  readonly evidence: CheckoutEvidencePort;
  /** Epoch milliseconds. */
  readonly now: number;
}): Promise<CreditWebhookOutcome> {
  const verified = verifyStripeWebhookSignature({
    payload: input.payload,
    header: input.signatureHeader ?? "",
    secret: input.secret ?? "",
    now: input.now,
  });
  if (!verified.ok) return refused(verified.reason, verified.message);

  const lookup = lookupKeysOf(verified.value.payload);
  if (lookup.kind === "unreadable") {
    return refused(BILLING_REFUSE_REASONS.webhookPayloadInvalid, lookup.detail);
  }
  if (lookup.kind === "unhandledType") {
    return ignored(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
      `Webhook event type "${lookup.eventType}" is not handled; only ${HANDLED_EVENT_TYPE} grants credits. Nothing was read or granted, and redelivery would not change that.`,
    );
  }
  if (lookup.kind === "unhandledPurpose") {
    return ignored(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
      `A ${lookup.purpose} completion grants no credits and settles on the revenue-share path, so no intent, settlement, or ledger was read and redelivery would not change that.`,
    );
  }
  if (lookup.kind === "incomplete") {
    return refused(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The verified event carries SceneAxi checkout metadata but no usable session id and intent id, so a checkout this deployment created cannot be bound to its persisted price snapshot.",
    );
  }
  if (lookup.kind === "unrelated") {
    return ignored(
      CREDIT_WEBHOOK_REASONS.eventUnrelated,
      "The verified event carries no SceneAxi checkout metadata, so it is not a checkout this deployment created. Nothing was granted, and redelivery would not change that.",
    );
  }
  const keys = lookup;

  const read = await attempt(async () =>
    Object.freeze({
      intent: await input.evidence.findIntent(keys.intentId),
      settlement: await input.evidence.retrieveSettlement(keys.sessionId),
    }),
  );
  if (!read.ok) {
    return refused(
      CREDIT_WEBHOOK_REASONS.evidenceUnavailable,
      "The persisted intent or the provider settlement could not be read, so the price snapshot this event must be bound to is unknown and no grant is attempted.",
    );
  }
  const { intent, settlement } = read.value;
  if (intent === undefined || settlement === undefined) {
    return refused(
      CREDIT_WEBHOOK_REASONS.evidenceMissing,
      "The persisted intent or the provider settlement is missing; credits are granted only against the price snapshot the checkout was created with.",
    );
  }

  const completion = parseCheckoutCompletedEvent({
    verified: verified.value,
    intent,
    settlement,
  });
  if (!completion.ok) return settle(completion.reason, completion.message);

  // The routing above already sent every known non-crediting purpose to the acknowledged
  // path, and the parser cross-checks the metadata purpose against the persisted intent,
  // so a completion reaching here is a credit-pack one. This re-asks the same question of
  // the parsed completion — the authoritative purpose — so that the ledger is never read
  // for an event owed no credits even if those two ever diverge.
  // `applyCheckoutCompletedGrant` still owns the authoritative refusal for the purposes
  // that do reach it.
  if (!checkoutPurposeGrantsCredits(completion.value.purpose)) {
    return ignored(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
      `A ${completion.value.purpose} completion grants no credits and settles on the revenue-share path, so no ledger was read and redelivery would not change that.`,
    );
  }

  const found = await attempt(() => input.store.findAccountByUserId(completion.value.userId));
  if (!found.ok) {
    return refused(
      CREDIT_WEBHOOK_REASONS.storeFailed,
      "The credit account for the purchasing user could not be read, so this event is unapplied and must be retried.",
    );
  }
  const account = found.value;
  if (account === undefined) {
    return refused(
      CREDIT_WEBHOOK_REASONS.ledgerUnavailable,
      "The purchasing user has no credit account, so the grant refuses rather than creating one from a payment event.",
    );
  }
  const entries = await attempt(() => input.store.listEntries(account.accountId));
  if (!entries.ok) {
    return refused(
      CREDIT_WEBHOOK_REASONS.storeFailed,
      "The ledger could not be read, so whether this event was already applied is unknown and no grant is attempted.",
    );
  }
  const state = loadLedgerState(account, entries.value);
  if (!state.ok) return refused(state.reason, state.message);

  // The one commit boundary for credits (sceneaxi#128, captain decision D4). Deciding
  // the grant and committing it are the same call here, so this module holds no second
  // path to the ledger: `applyCheckoutCompletedGrant` still decides, and success is
  // reported only once the store holds the entry.
  const commit = await attempt(() =>
    persistCheckoutCompletedGrant({
      store: input.store,
      state: state.value,
      completion: completion.value,
      now: input.now,
    }),
  );
  if (!commit.ok) {
    return refused(
      CREDIT_WEBHOOK_REASONS.storeFailed,
      "The commit of the checkout grant threw, so whether the credits reached the ledger is unknown; this event is unacknowledged and must be retried.",
    );
  }
  const granted = commit.value;
  if (!granted.ok) return settle(granted.reason, granted.message);

  return Object.freeze({
    ok: true as const,
    ignored: false as const,
    replayed: granted.value.replayed,
    credits: completion.value.credits ?? 0,
    balance: granted.value.state.balance,
  });
}
