/**
 * The credit-pack webhook path: a signed Stripe event becomes ledger credits, once.
 *
 * Every security-relevant step is owned by `@sceneaxi/billing` and merely *sequenced*
 * here — signature verification over the raw bytes, binding the event to the persisted
 * intent, and the idempotent grant. This module adds no verification of its own, and
 * deliberately cannot skip any: `applyCheckoutCompletedGrant` accepts only the branded
 * output of `parseCheckoutCompletedEvent`, which accepts only the branded output of
 * `verifyStripeWebhookSignature`. An unsigned or replayed body has no path to a grant
 * that type-checks.
 *
 * The order below is the security design, not a convenience:
 *
 *   1. secret present        — an unconfigured endpoint refuses, never accepts
 *   2. signature over bytes  — before the body is parsed as anything
 *   3. intent + settlement   — the price snapshot, not the event, names the credits
 *   4. grant, keyed by event — Stripe delivers at least once, so replay is expected
 *   5. persist               — a store conflict re-reads and answers only what the
 *                              ledger proves, so an unapplied event is retried
 *
 * One endpoint receives every event Stripe is configured to send, so step 3 also decides
 * what is *not* this endpoint's work — another event type, or a completion whose purpose
 * settles on the revenue-share path. Those are acknowledged, never refused: no grant is
 * owed, and a non-2xx would ask Stripe to redeliver a condition redelivery cannot change.
 *
 * `live` mode is never authorized from here. `applyCheckoutCompletedGrant` refuses a
 * livemode event without an explicit captain go-live decision, and this module has no
 * parameter that could supply one.
 */
import {
  BILLING_REFUSE_REASONS,
  CHECKOUT_METADATA_KEYS,
  applyCheckoutCompletedGrant,
  loadLedgerState,
  parseCheckoutCompletedEvent,
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
 * configured, its clock is unusable, an adapter threw, its own ledger rows do not load,
 * or the purchasing user has no provisioned credit account. They are separated from the
 * request-fault refusals so the transport can answer a status that names the failing
 * side — an operator who forgot `STRIPE_WEBHOOK_SECRET` must not see their own omission
 * reported as a bad request from Stripe.
 */
const SERVER_SIDE_REASONS: ReadonlySet<string> = Object.freeze(
  new Set<string>([
    CREDIT_WEBHOOK_REASONS.evidenceUnavailable,
    CREDIT_WEBHOOK_REASONS.ledgerUnavailable,
    CREDIT_WEBHOOK_REASONS.storeFailed,
    BILLING_REFUSE_REASONS.webhookSecretMissing,
    BILLING_REFUSE_REASONS.clockInvalid,
    BILLING_REFUSE_REASONS.storeFailed,
    BILLING_REFUSE_REASONS.ledgerStateInvalid,
    BILLING_REFUSE_REASONS.ledgerOrderInvalid,
    BILLING_REFUSE_REASONS.entryInvalid,
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
 * `unrelated` and `unparseable` are deliberately distinct. A signed body carrying no
 * SceneAxi intent id is simply an event this deployment did not create — the same
 * Stripe account may serve other products, and other event types carry other objects —
 * so it is acknowledged, not failed. A signed body that is not JSON at all is a fault
 * worth surfacing, because Stripe does not send one.
 */
type CheckoutLookup =
  | { readonly kind: "keys"; readonly intentId: string; readonly sessionId: string }
  | { readonly kind: "unrelated" }
  | { readonly kind: "unparseable" };

/**
 * The two lookup keys a verified checkout body carries: which session to retrieve
 * settlement for, and which persisted intent to bind it to.
 *
 * Nothing else is read from the event. Everything the grant depends on — credits,
 * amount, currency, price — comes from the persisted intent, so an attacker able to
 * influence event metadata still cannot name their own credit amount. These two are
 * only *lookup keys*, and a key that names the wrong intent fails the parser's own
 * metadata/mode cross-check immediately after. In particular, the event *type* is not
 * decided here: `parseCheckoutCompletedEvent` still owns that check, so a body whose
 * metadata happens to carry an intent id is routed, never trusted.
 */
function lookupKeysOf(payload: string): CheckoutLookup {
  let raw: unknown;
  try {
    raw = JSON.parse(payload) as unknown;
  } catch {
    return Object.freeze({ kind: "unparseable" as const });
  }
  const object = asRecord(asRecord(asRecord(raw)?.["data"])?.["object"]);
  const sessionId = asId(object?.["id"]);
  const intentId = asId(asRecord(object?.["metadata"])?.[CHECKOUT_METADATA_KEYS.intentId]);
  if (sessionId === undefined || intentId === undefined) {
    return Object.freeze({ kind: "unrelated" as const });
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
  if (lookup.kind === "unparseable") {
    return refused(
      BILLING_REFUSE_REASONS.webhookPayloadInvalid,
      "The verified body is not a JSON event object, so no persisted price snapshot can be bound to it.",
    );
  }
  if (lookup.kind === "unrelated") {
    return ignored(
      CREDIT_WEBHOOK_REASONS.eventUnrelated,
      "The verified event names no session or SceneAxi intent id, so it is not a checkout this deployment created. Nothing was granted, and redelivery would not change that.",
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

  const granted = applyCheckoutCompletedGrant({
    state: state.value,
    completion: completion.value,
    now: input.now,
  });
  if (!granted.ok) return settle(granted.reason, granted.message);

  const entry = granted.value.entry;
  if (!granted.value.replayed && entry !== undefined) {
    try {
      await input.store.appendEntry(entry);
    } catch {
      // Stripe delivers at least once and retries concurrently, so an append can lose a
      // race with a redelivery of this same event. It can also fail for reasons that
      // granted nothing — a sequence another writer took, a transport failure — and the
      // store throws identically for all of them. The ledger is the only thing that can
      // tell them apart, so the re-read is checked for *this* event's key: present means
      // the grant is in the ledger and the replay answer is proven; absent means the
      // outcome is a failure the provider must retry, never a 2xx for credits nobody has.
      const rereadEntries = await attempt(() => input.store.listEntries(account.accountId));
      const reread = rereadEntries.ok ? loadLedgerState(account, rereadEntries.value) : undefined;
      if (reread === undefined || !reread.ok) {
        return refused(
          CREDIT_WEBHOOK_REASONS.storeFailed,
          "The ledger could not be re-read after an append conflict, so the outcome of this event is unknown.",
        );
      }
      const persisted = reread.value.entries.some(
        (held) => held.idempotencyKey === entry.idempotencyKey,
      );
      if (!persisted) {
        return refused(
          CREDIT_WEBHOOK_REASONS.storeFailed,
          "The credit grant for this event could not be appended and is not in the ledger, so this event is unapplied and must be retried.",
        );
      }
      return Object.freeze({
        ok: true as const,
        ignored: false as const,
        replayed: true,
        credits: completion.value.credits ?? 0,
        balance: reread.value.balance,
      });
    }
  }

  return Object.freeze({
    ok: true as const,
    ignored: false as const,
    replayed: granted.value.replayed,
    credits: completion.value.credits ?? 0,
    balance: granted.value.state.balance,
  });
}
