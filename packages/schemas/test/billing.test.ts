import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BILLING_MODES,
  BILLING_REFUSE_CODES,
  BILLING_SCHEMA_VERSION,
  CHECKOUT_COMPLETED_EVENT_KIND,
  CHECKOUT_COMPLETED_EVENT_TYPE,
  CHECKOUT_SESSION_INTENT_KIND,
  CREDIT_PACKS_FIXTURES_PATH,
  DEFAULT_BILLING_MODE,
  STRIPE_CUSTOMER_LINK_KIND,
  isHttpsUrl,
  validateCheckoutCompletedEvent,
  validateCheckoutSessionIntent,
  validateCreditPack,
  validateCreditPackCatalog,
  validateStripeCustomerLink,
} from "@sceneaxi/schemas";

const PACK = {
  packId: "starter",
  credits: 100,
  unitAmount: 500,
  currency: "usd",
  stripePriceId: "price_test_starter_100",
} as const;

/** A record with one required key removed, for missing-property refusals. */
const without = (record: object, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

const LINK = {
  schemaVersion: 1,
  kind: STRIPE_CUSTOMER_LINK_KIND,
  userId: "usr_01",
  stripeCustomerId: "cus_test_01",
  mode: "test",
  linkedAt: "2026-07-25T10:00:00Z",
} as const;

const INTENT = {
  schemaVersion: 1,
  kind: CHECKOUT_SESSION_INTENT_KIND,
  intentId: "int_01",
  userId: "usr_01",
  packId: "starter",
  credits: 100,
  mode: "test",
  successUrl: "https://sceneaxi.example/checkout/success",
  cancelUrl: "https://sceneaxi.example/checkout/cancel",
  idempotencyKey: "checkout:int_01",
  createdAt: "2026-07-25T10:00:00Z",
} as const;

const EVENT = {
  schemaVersion: 1,
  kind: CHECKOUT_COMPLETED_EVENT_KIND,
  eventId: "evt_01",
  type: CHECKOUT_COMPLETED_EVENT_TYPE,
  mode: "test",
  intentId: "int_01",
  userId: "usr_01",
  packId: "starter",
  credits: 100,
  occurredAt: "2026-07-25T10:05:00Z",
} as const;

describe("billing mode", () => {
  it("defaults to test and never implies live", () => {
    expect(DEFAULT_BILLING_MODE).toBe("test");
    expect([...BILLING_MODES]).toEqual(["test", "live"]);
  });
});

describe("isHttpsUrl", () => {
  it("accepts absolute https and refuses everything else", () => {
    expect(isHttpsUrl("https://sceneaxi.example/ok")).toBe(true);
    for (const value of [
      "http://sceneaxi.example/ok",
      "/relative",
      "javascript:alert(1)",
      "",
      42,
    ]) {
      expect(isHttpsUrl(value)).toBe(false);
    }
  });
});

describe("credit pack catalog", () => {
  it("validates the canonical committed fixture", () => {
    const raw: unknown = JSON.parse(
      readFileSync(
        new URL(`../${CREDIT_PACKS_FIXTURES_PATH}`, import.meta.url),
        "utf8",
      ),
    );
    const result = validateCreditPackCatalog(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.packs.length).toBeGreaterThan(0);
    expect(result.value.mode).toBe("test");
  });

  it("refuses a live-mode catalog — live price ids are not committed", () => {
    const result = validateCreditPackCatalog({
      schemaVersion: 1,
      mode: "live",
      packs: [PACK],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
  });

  it("refuses duplicate pack ids and an empty catalog", () => {
    const duplicate = validateCreditPackCatalog({
      schemaVersion: 1,
      mode: "test",
      packs: [PACK, { ...PACK, stripePriceId: "price_test_other" }],
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
    }
    const empty = validateCreditPackCatalog({
      schemaVersion: 1,
      mode: "test",
      packs: [],
    });
    expect(empty.ok).toBe(false);
  });

  it("refuses non-positive credits, non-positive prices, and a bad currency", () => {
    for (const patch of [
      { credits: 0 },
      { credits: -1 },
      { unitAmount: 0 },
      { currency: "USD" },
      { currency: "dollars" },
      { stripePriceId: "" },
    ]) {
      const result = validateCreditPack({ ...PACK, ...patch });
      expect(result.ok).toBe(false);
    }
  });
});

describe("validateStripeCustomerLink", () => {
  it("accepts a test-mode link", () => {
    expect(validateStripeCustomerLink(LINK).ok).toBe(true);
  });

  it("refuses an unknown mode and an empty customer id", () => {
    for (const patch of [{ mode: "sandbox" }, { stripeCustomerId: "" }]) {
      const result = validateStripeCustomerLink({ ...LINK, ...patch });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
    }
  });
});

describe("validateCheckoutSessionIntent", () => {
  it("accepts a canonical test-mode intent", () => {
    const result = validateCheckoutSessionIntent(INTENT);
    expect(result.ok).toBe(true);
  });

  it("refuses a plaintext http redirect rather than upgrading it", () => {
    for (const key of ["successUrl", "cancelUrl"] as const) {
      const result = validateCheckoutSessionIntent({
        ...INTENT,
        [key]: "http://sceneaxi.example/x",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(BILLING_REFUSE_CODES.insecureRedirectUrl);
    }
  });

  it("carries no secret-shaped field", () => {
    const result = validateCheckoutSessionIntent(INTENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const keys = Object.keys(result.value);
    for (const forbidden of [
      "secret",
      "apiKey",
      "signature",
      "stripeSecretKey",
      "email",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("refuses a missing idempotency key and a non-slug pack id", () => {
    expect(
      validateCheckoutSessionIntent(without(INTENT, "idempotencyKey")).ok,
    ).toBe(false);
    expect(
      validateCheckoutSessionIntent({ ...INTENT, packId: "Starter Pack" }).ok,
    ).toBe(false);
  });
});

describe("validateCheckoutCompletedEvent", () => {
  it("accepts the normalized completion event", () => {
    expect(validateCheckoutCompletedEvent(EVENT).ok).toBe(true);
  });

  it("refuses any other event type", () => {
    const result = validateCheckoutCompletedEvent({
      ...EVENT,
      type: "payment_intent.succeeded",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
  });

  it("refuses non-positive credits", () => {
    for (const credits of [0, -5, 1.5]) {
      expect(validateCheckoutCompletedEvent({ ...EVENT, credits }).ok).toBe(
        false,
      );
    }
  });
});

describe("billing contract version", () => {
  it("is major version 1", () => {
    expect(BILLING_SCHEMA_VERSION).toBe(1);
  });
});
