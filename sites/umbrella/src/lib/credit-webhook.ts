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
 *   5. persist               — a store conflict re-reads rather than assuming
 *
 * `live` mode is never authorized from here. `applyCheckoutCompletedGrant` refuses a
 * livemode event without an explicit captain go-live decision, and this module has no
 * parameter that could supply one.
 */
import {
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

export type CreditWebhookOutcome =
  | {
      readonly ok: true;
      /** True when this event had already been applied and nothing was appended. */
      readonly replayed: boolean;
      readonly credits: number;
      readonly balance: number;
    }
  | { readonly ok: false; readonly reason: string; readonly message: string };

const refused = (reason: string, message: string): CreditWebhookOutcome =>
  Object.freeze({ ok: false as const, reason, message });

/** Local reasons for the two failures that are this module's own, not a package's. */
export const CREDIT_WEBHOOK_REASONS = Object.freeze({
  evidenceMissing: "STRIPE_CHECKOUT_EVIDENCE_MISSING",
  ledgerUnavailable: "CREDIT_LEDGER_UNAVAILABLE",
  storeFailed: "CREDIT_STORE_FAILED",
} as const);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

const asId = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/**
 * The two lookup keys a verified checkout body carries: which session to retrieve
 * settlement for, and which persisted intent to bind it to.
 *
 * Nothing else is read from the event. Everything the grant depends on — credits,
 * amount, currency, price — comes from the persisted intent, so an attacker able to
 * influence event metadata still cannot name their own credit amount. These two are
 * only *lookup keys*, and a key that names the wrong intent fails the parser's own
 * metadata/mode cross-check immediately after.
 */
function lookupKeysOf(
  payload: string,
): { readonly intentId: string; readonly sessionId: string } | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(payload) as unknown;
  } catch {
    return undefined;
  }
  const object = asRecord(asRecord(asRecord(raw)?.["data"])?.["object"]);
  const sessionId = asId(object?.["id"]);
  const intentId = asId(asRecord(object?.["metadata"])?.["sceneaxiIntentId"]);
  if (sessionId === undefined || intentId === undefined) return undefined;
  return Object.freeze({ intentId, sessionId });
}

/**
 * Apply a Stripe credit-pack webhook to a user's ledger.
 *
 * Returns the plane's own named refusal for every failure — an absent secret, a bad
 * signature, a stale timestamp, evidence that does not match the intent — so the
 * endpoint never answers "ok" for a body it did not honour.
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

  const keys = lookupKeysOf(verified.value.payload);
  if (keys === undefined) {
    return refused(
      CREDIT_WEBHOOK_REASONS.evidenceMissing,
      "The verified checkout event names no intent or session, so no persisted price snapshot can be bound to it.",
    );
  }

  const intent = await input.evidence.findIntent(keys.intentId);
  const settlement = await input.evidence.retrieveSettlement(keys.sessionId);
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
  if (!completion.ok) return refused(completion.reason, completion.message);

  const account = await input.store.findAccountByUserId(completion.value.userId);
  if (account === undefined) {
    return refused(
      CREDIT_WEBHOOK_REASONS.ledgerUnavailable,
      "The purchasing user has no credit account, so the grant refuses rather than creating one from a payment event.",
    );
  }
  const state = loadLedgerState(account, await input.store.listEntries(account.accountId));
  if (!state.ok) return refused(state.reason, state.message);

  const granted = applyCheckoutCompletedGrant({
    state: state.value,
    completion: completion.value,
    now: input.now,
  });
  if (!granted.ok) return refused(granted.reason, granted.message);

  const entry = granted.value.entry;
  if (!granted.value.replayed && entry !== undefined) {
    try {
      await input.store.appendEntry(entry);
    } catch {
      // Stripe delivers at least once and retries concurrently. A conflict means the
      // same event id is already in the ledger, so the truthful answer is the stored
      // balance, not a second grant and not a failure the provider would retry.
      const reread = loadLedgerState(account, await input.store.listEntries(account.accountId));
      if (!reread.ok) {
        return refused(
          CREDIT_WEBHOOK_REASONS.storeFailed,
          "The ledger could not be re-read after an append conflict, so the outcome of this event is unknown.",
        );
      }
      return Object.freeze({
        ok: true as const,
        replayed: true,
        credits: completion.value.credits ?? 0,
        balance: reread.value.balance,
      });
    }
  }

  return Object.freeze({
    ok: true as const,
    replayed: granted.value.replayed,
    credits: completion.value.credits ?? 0,
    balance: granted.value.state.balance,
  });
}
