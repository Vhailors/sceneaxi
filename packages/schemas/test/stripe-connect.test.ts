import { describe, expect, it } from "vitest";
import {
  STRIPE_CONNECT_REFUSE_CODES,
  validateConnectPayoutIntent,
  validateConnectPayoutOutcome,
} from "@sceneaxi/schemas";

const payoutIntent = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  kind: "sceneaxi.connect-payout-intent",
  payoutIntentId: "int_connect_01",
  saleId: "sale_01",
  creatorUserId: "usr_creator",
  stripeAccountId: "acct_test_creator",
  grossMinor: 2501,
  creatorMinor: 1250,
  platformMinor: 1251,
  currency: "usd",
  basisPoints: 5000,
  mode: "test",
  idempotencyKey: "connect-payout:sale_01",
  requestedAt: "2026-08-06T10:00:00Z",
  ...overrides,
});

const payoutOutcome = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  kind: "sceneaxi.connect-payout-outcome",
  payoutOutcomeId: "out_01",
  payoutIntentId: "int_connect_01",
  status: "succeeded",
  providerPayoutId: "po_test_01",
  providerEvidenceId: "evt_paid_01",
  providerMessage: "paid in TEST mode",
  observedAt: "2026-08-06T10:01:00Z",
  ...overrides,
});

describe("Stripe Connect record contracts", () => {
  it("preserves the exact 50/50 creator split with remainder to platform", () => {
    expect(validateConnectPayoutIntent(payoutIntent()).ok).toBe(true);
    const drifted = validateConnectPayoutIntent(
      payoutIntent({ creatorMinor: 1251, platformMinor: 1250 }),
    );
    expect(drifted).toMatchObject({
      ok: false,
      code: STRIPE_CONNECT_REFUSE_CODES.splitInvalid,
    });
  });

  it("cannot represent payout success without both provider evidence ids", () => {
    expect(validateConnectPayoutOutcome(payoutOutcome()).ok).toBe(true);
    for (const overrides of [
      { providerPayoutId: null },
      { providerEvidenceId: "" },
      { status: "failed", providerPayoutId: "po_test_01" },
    ]) {
      expect(validateConnectPayoutOutcome(payoutOutcome(overrides))).toMatchObject({
        ok: false,
        code: STRIPE_CONNECT_REFUSE_CODES.payoutEvidenceMissing,
      });
    }
  });
});
