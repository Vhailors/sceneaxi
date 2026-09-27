import { describe, expect, it } from "vitest";
import {
  createCreditStore,
  createInMemoryCreditStore,
  persistCreditPackChargeEvent,
  signStripeWebhookPayload,
  verifyStripeWebhookSignature,
  type CreditStore,
} from "@sceneaxi/billing";

const now = Date.parse("2026-07-26T12:00:00Z");

const secret = "whsec_reconciliation_fixture";

const intent = Object.freeze({
  schemaVersion: 1 as const,
  kind: "sceneaxi.checkout-session-intent" as const,
  intentId: "int_reconciliation",
  userId: "member-1",
  purpose: "credit-pack" as const,
  itemId: "starter",
  credits: 100,
  unitAmount: 500,
  currency: "usd",
  stripePriceId: "price_test_starter_100",
  mode: "test" as const,
  successUrl: "https://sceneaxi.example/account",
  cancelUrl: "https://sceneaxi.example/pricing",
  idempotencyKey: "pack:reconciliation",
  createdAt: new Date(now).toISOString(),
});

const charge = Object.freeze({
  id: "ch_reconciliation",
  amount: 500,
  currency: "usd",
  livemode: false,
  metadata: {
    sceneaxiUserId: intent.userId,
    sceneaxiPurpose: intent.purpose,
    sceneaxiItemId: intent.itemId,
    sceneaxiIntentId: intent.intentId,
  },
});

function verifiedEvent(type = "charge.dispute.created", overrides = {}) {
  const payload = JSON.stringify({
    id: `evt_${type}`,
    type,
    created: now / 1000,
    livemode: false,
    data: {
      object: type === "charge.refunded"
        ? { ...charge, refunded: false, amount_refunded: 100, ...overrides }
        : { id: "dp_reconciliation", charge: charge.id, amount: 500, currency: "usd", status: "needs_response", ...overrides },
    },
  });

  const result = verifyStripeWebhookSignature({
    payload,
    header: signStripeWebhookPayload({ payload, secret, timestamp: now / 1000 }),
    secret,
    now,
  });

  if (!result.ok) throw new Error(result.message);

  return result.value;
}

const request = () => ({
  verified: verifiedEvent(),
  intent,
  charge,
  store: createInMemoryCreditStore(),
  now,
});

describe("Stripe reconciliation records", () => {
  it.each(["charge.dispute.created", "charge.dispute.closed", "charge.refunded"])(
    "persists and replays %s without needing an account or moving credits",
    async (type) => {
      const input = { ...request(), verified: verifiedEvent(type) };
      const first = await persistCreditPackChargeEvent(input);
      expect(first).toMatchObject({ ok: true, value: {
        kind: "reconciliation-required", replayed: false,
        record: { eventId: `evt_${type}`, eventType: type, intentId: intent.intentId, userId: intent.userId, chargeId: charge.id, mode: "test" },
      } });
      expect(await persistCreditPackChargeEvent(input)).toMatchObject({
        ok: true, value: { kind: "reconciliation-required", replayed: true },
      });
      expect(await input.store.listReconciliations()).toHaveLength(1);
      expect(await input.store.listEntries("absent")).toEqual([]);
    },
  );

  it("binds retrieved evidence to the exact disputed Charge", async () => {
    const input = { ...request(), charge: { ...charge, id: "ch_other" } };
    expect(await persistCreditPackChargeEvent(input)).toMatchObject({
      ok: false, reason: "STRIPE_CHARGE_EVIDENCE_MISMATCH",
    });
    expect(await input.store.listReconciliations()).toEqual([]);
  });

  it.each([
    { currency: "invalid" },
    { amount: -1 },
    { status: "" },
    { charge: "" },
  ])("refuses malformed dispute evidence %j", async (overrides) => {
    const input = { ...request(), verified: verifiedEvent("charge.dispute.created", overrides) };
    expect(await persistCreditPackChargeEvent(input)).toMatchObject({ ok: false });
    expect(await input.store.listReconciliations()).toEqual([]);
  });

  it("does not trust dispute metadata instead of the Charge metadata", async () => {
    const input = { ...request(), charge: { ...charge, metadata: { ...charge.metadata, sceneaxiIntentId: "int_other" } } };
    expect(await persistCreditPackChargeEvent(input)).toMatchObject({ ok: false, reason: "STRIPE_WEBHOOK_PAYLOAD_INVALID" });
    expect(await input.store.listReconciliations()).toEqual([]);
  });

  it("refuses copied verification evidence", async () => {
    const input = request();
    expect(await persistCreditPackChargeEvent({ ...input, verified: { ...input.verified } })).toMatchObject({
      ok: false, reason: "STRIPE_WEBHOOK_NOT_VERIFIED",
    });
    expect(await input.store.listReconciliations()).toEqual([]);
  });

  it("rejects a same-id event with changed evidence rather than overwriting it", async () => {
    const input = request();
    expect((await persistCreditPackChargeEvent(input)).ok).toBe(true);
    expect(await persistCreditPackChargeEvent({ ...input, verified: verifiedEvent("charge.dispute.created", { status: "won" }) })).toMatchObject({
      ok: false, reason: "CREDIT_STORE_FAILED",
    });
    expect(await input.store.listReconciliations()).toMatchObject([{ disputeStatus: "needs_response" }]);
  });

  it("retries a lost append response and never acknowledges an unconfirmed record", async () => {
    const input = request();
    let fail = true;

    const store = createCreditStore({
      ...input.store,
      async appendOrReplayReconciliation(record) {
        const result = await input.store.appendOrReplayReconciliation(record);

        if (fail) { fail = false; throw new Error("lost response"); }

        return result;
      },
    });

    expect(await persistCreditPackChargeEvent({ ...input, store })).toMatchObject({ ok: false, reason: "CREDIT_STORE_FAILED" });
    expect(await persistCreditPackChargeEvent({ ...input, store })).toMatchObject({ ok: true, value: { kind: "reconciliation-required", replayed: true } });
    expect(await input.store.listReconciliations()).toHaveLength(1);
  });

  it("checks a structural store's answer rather than trusting a success flag", async () => {
    const input = request();

    const store = {
      ...input.store,
      appendOrReplayReconciliation: (record) => ({ replayed: false, record: { ...record, eventId: "evt_wrong" } }),
    } satisfies CreditStore;

    expect(await persistCreditPackChargeEvent({ ...input, store })).toMatchObject({ ok: false, reason: "CREDIT_STORE_FAILED" });
  });
});
