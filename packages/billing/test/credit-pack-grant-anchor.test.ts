import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckoutSessionIntent } from "@sceneaxi/schemas";

const ARCHIVE = Object.freeze({
  schemaVersion: 1,
  mode: "test",
  currentRevisionIds: ["starter-v2", "maker-v1"],
  packRevisions: [
    {
      revisionId: "starter-v1",
      packId: "starter",
      credits: 100,
      unitAmount: 500,
      currency: "usd",
      stripePriceId: "price_test_starter_v1",
    },
    {
      revisionId: "starter-v2",
      packId: "starter",
      credits: 120,
      unitAmount: 600,
      currency: "usd",
      stripePriceId: "price_test_starter_v2",
    },
    {
      revisionId: "maker-v1",
      packId: "maker",
      credits: 500,
      unitAmount: 2000,
      currency: "usd",
      stripePriceId: "price_test_maker_v1",
    },
  ],
});

const NOW = Date.parse("2026-07-25T10:00:00Z");
const NOW_SECONDS = Math.floor(NOW / 1000);
const SECRET = "whsec_credit_pack_archive_fixture";
const ACCOUNT = Object.freeze({
  schemaVersion: 1 as const,
  kind: "sceneaxi.credit-account" as const,
  accountId: "acc_archive_fixture",
  userId: "usr_archive_fixture",
  createdAt: "2026-07-25T09:00:00Z",
});

const intentFor = (
  intentId: string,
  itemId: string,
  credits: number,
  unitAmount: number,
  stripePriceId: string,
): CheckoutSessionIntent => ({
  schemaVersion: 1,
  kind: "sceneaxi.checkout-session-intent",
  intentId,
  userId: ACCOUNT.userId,
  purpose: "credit-pack",
  itemId,
  credits,
  unitAmount,
  currency: "usd",
  stripePriceId,
  mode: "test",
  successUrl: "https://sceneaxi.example/checkout/success",
  cancelUrl: "https://sceneaxi.example/checkout/cancel",
  idempotencyKey: `checkout:${intentId}`,
  createdAt: new Date(NOW).toISOString(),
});

const eventBody = (intent: CheckoutSessionIntent, eventId: string) =>
  JSON.stringify({
    id: eventId,
    type: "checkout.session.completed",
    created: NOW_SECONDS,
    livemode: false,
    data: {
      object: {
        id: `cs_${intent.intentId}`,
        metadata: {
          sceneaxiUserId: intent.userId,
          sceneaxiPurpose: intent.purpose,
          sceneaxiItemId: intent.itemId,
          sceneaxiIntentId: intent.intentId,
        },
      },
    },
  });

const loadBillingWithArchive = async () => {
  vi.resetModules();
  vi.doMock("@sceneaxi/schemas", async () => {
    const actual = await vi.importActual<typeof import("@sceneaxi/schemas")>(
      "@sceneaxi/schemas",
    );
    return { ...actual, CREDIT_PACK_CATALOG_DATA: ARCHIVE };
  });
  return {
    ledger: await import("../src/ledger.js"),
    webhook: await import("../src/stripe-webhook.js"),
  };
};

afterEach(() => {
  vi.doUnmock("@sceneaxi/schemas");
  vi.resetModules();
});

describe("credit-pack grant archive anchor", () => {
  it("grants both current and retained revisions from archived credits", async () => {
    const { ledger, webhook } = await loadBillingWithArchive();
    const cases = [
      {
        intent: intentFor(
          "int_current_revision",
          "starter",
          120,
          600,
          "price_test_starter_v2",
        ),
        credits: 120,
      },
      {
        intent: intentFor(
          "int_retired_revision",
          "starter",
          100,
          500,
          "price_test_starter_v1",
        ),
        credits: 100,
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      const body = eventBody(testCase.intent, `evt_archive_${index}`);
      const verified = webhook.verifyStripeWebhookSignature({
        payload: body,
        header: webhook.signStripeWebhookPayload({
          payload: body,
          secret: SECRET,
          timestamp: NOW_SECONDS,
        }),
        secret: SECRET,
        now: NOW,
      });
      expect(verified.ok).toBe(true);
      if (!verified.ok) return;

      const completion = webhook.parseCheckoutCompletedEvent({
        verified: verified.value,
        intent: testCase.intent,
        settlement: {
          sessionId: `cs_${testCase.intent.intentId}`,
          paymentStatus: "paid",
          amountTotal: testCase.intent.unitAmount,
          currency: testCase.intent.currency,
          quantity: 1,
          stripePriceId: testCase.intent.stripePriceId,
        },
      });
      expect(completion.ok).toBe(true);
      if (!completion.ok) return;

      const granted = webhook.applyCheckoutCompletedGrant({
        state: ledger.createLedgerState(ACCOUNT),
        completion: completion.value,
        now: NOW,
      });
      expect(granted.ok).toBe(true);
      if (!granted.ok) return;
      expect(granted.value.entry?.delta).toBe(testCase.credits);
      expect(granted.value.state.balance).toBe(testCase.credits);
    }
  });
});
