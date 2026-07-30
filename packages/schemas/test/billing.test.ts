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
  isBillingIdentifier,
  isHttpsUrl,
  validateCheckoutCompletedEvent,
  validateCheckoutSessionIntent,
  validateCreditPack,
  validateCreditPackCatalog,
  validateCreditPackCatalogArchive,
  validateStripeCustomerLink,
} from "@sceneaxi/schemas";

const PACK = {
  packId: "starter",
  credits: 100,
  unitAmount: 500,
  currency: "usd",
  stripePriceId: "price_test_starter_100",
} as const;

const REVISION_V1 = { revisionId: "starter-v1", ...PACK } as const;
const REVISION_V2 = {
  revisionId: "starter-v2",
  ...PACK,
  credits: 120,
  unitAmount: 600,
  stripePriceId: "price_test_starter_120",
} as const;

/**
 * A superseded `starter-v1` retained beside the current `starter-v2` — the shape
 * every archive refusal below patches, so each failure is caused by its patch alone.
 */
const archive = (
  patch: Record<string, unknown> = {},
): Record<string, unknown> => ({
  schemaVersion: 1,
  mode: "test",
  currentRevisionIds: ["starter-v2"],
  packRevisions: [REVISION_V1, REVISION_V2],
  ...patch,
});

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
  purpose: "credit-pack",
  itemId: "starter",
  credits: 100,
  unitAmount: 500,
  currency: "usd",
  stripePriceId: "price_test_starter_100",
  mode: "test",
  successUrl: "https://sceneaxi.example/checkout/success",
  cancelUrl: "https://sceneaxi.example/checkout/cancel",
  idempotencyKey: "checkout:int_01",
  createdAt: "2026-07-25T10:00:00Z",
} as const;

/** A catalog-listing intent, which must carry no credits at all. */
const LISTING_INTENT = {
  schemaVersion: 1,
  kind: CHECKOUT_SESSION_INTENT_KIND,
  intentId: "int_02",
  userId: "usr_01",
  purpose: "catalog-listing",
  itemId: "harbour-diorama",
  unitAmount: 1200,
  currency: "usd",
  stripePriceId: "price_test_harbour_diorama",
  mode: "test",
  successUrl: "https://sceneaxi.example/checkout/success",
  cancelUrl: "https://sceneaxi.example/checkout/cancel",
  idempotencyKey: "sale:sale_02",
  createdAt: "2026-07-25T10:00:00Z",
} as const;

const EVENT = {
  schemaVersion: 1,
  kind: CHECKOUT_COMPLETED_EVENT_KIND,
  eventId: "evt_01",
  type: CHECKOUT_COMPLETED_EVENT_TYPE,
  mode: "test",
  checkoutSessionId: "cs_test_01",
  intentId: "int_01",
  userId: "usr_01",
  purpose: "credit-pack",
  itemId: "starter",
  credits: 100,
  unitAmount: 500,
  currency: "usd",
  stripePriceId: "price_test_starter_100",
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
    const result = validateCreditPackCatalogArchive(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.packRevisions.length).toBeGreaterThan(0);
    expect(result.value.currentRevisionIds.length).toBeGreaterThan(0);
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

  it("publishes positive bounds for credits and unit amounts", () => {
    const schema = JSON.parse(
      readFileSync(
        new URL("../contracts/credit-packs.schema.json", import.meta.url),
        "utf8",
      ),
    ) as {
      properties: {
        packRevisions: {
          items: {
            properties: {
              credits: { minimum: number };
              unitAmount: { minimum: number };
            };
          };
        };
      };
    };
    expect(
      schema.properties.packRevisions.items.properties.credits.minimum,
    ).toBe(1);
    expect(
      schema.properties.packRevisions.items.properties.unitAmount.minimum,
    ).toBe(1);
  });
});

describe("validateCreditPackCatalogArchive", () => {
  it("control: accepts a superseded revision retained beside the current one", () => {
    const result = validateCreditPackCatalogArchive(archive());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.currentRevisionIds).toEqual(["starter-v2"]);
    expect(result.value.packRevisions.map((row) => row.revisionId)).toEqual([
      "starter-v1",
      "starter-v2",
    ]);
  });

  it("refuses a duplicate revisionId — a revision id must name one row", () => {
    const result = validateCreditPackCatalogArchive(
      archive({
        currentRevisionIds: ["starter-v1"],
        packRevisions: [REVISION_V1, { ...REVISION_V2, revisionId: "starter-v1" }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
    expect(result.message).toContain('duplicate revisionId "starter-v1"');
  });

  it("refuses two revisions sharing a stripePriceId — historical resolution must be deterministic", () => {
    const result = validateCreditPackCatalogArchive(
      archive({
        packRevisions: [
          REVISION_V1,
          { ...REVISION_V2, stripePriceId: PACK.stripePriceId },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
    expect(result.message).toContain(
      `duplicate stripePriceId "${PACK.stripePriceId}"`,
    );
  });

  it("refuses a current revisionId that resolves to no retained row", () => {
    const result = validateCreditPackCatalogArchive(
      archive({ currentRevisionIds: ["starter-v3"] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
    expect(result.message).toContain(
      'current revisionId "starter-v3" does not resolve',
    );
  });

  it("refuses two current revisions for one packId — a pack has one current price", () => {
    const result = validateCreditPackCatalogArchive(
      archive({ currentRevisionIds: ["starter-v1", "starter-v2"] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
    expect(result.message).toContain(
      'more than one current revision for packId "starter"',
    );
  });

  it("refuses a repeated current revisionId", () => {
    const result = validateCreditPackCatalogArchive(
      archive({ currentRevisionIds: ["starter-v2", "starter-v2"] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('repeats current revisionId "starter-v2"');
  });

  it("refuses an archive with no current revision at all — retiring the last pack is not representable", () => {
    const result = validateCreditPackCatalogArchive(
      archive({ currentRevisionIds: [] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
    expect(result.message).toContain(
      "currentRevisionIds must be a non-empty array",
    );
  });

  it("refuses an empty packRevisions archive", () => {
    const result = validateCreditPackCatalogArchive(
      archive({ currentRevisionIds: ["starter-v1"], packRevisions: [] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("packRevisions must be a non-empty array");
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

  it("refuses a missing idempotency key and a non-slug item id", () => {
    expect(
      validateCheckoutSessionIntent(without(INTENT, "idempotencyKey")).ok,
    ).toBe(false);
    expect(
      validateCheckoutSessionIntent({ ...INTENT, itemId: "Starter Pack" }).ok,
    ).toBe(false);
  });

  it("accepts a catalog-listing intent that carries no credits", () => {
    const result = validateCheckoutSessionIntent(LISTING_INTENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toHaveProperty("credits");
  });

  it("refuses a nominal credit amount on a listing sale", () => {
    const result = validateCheckoutSessionIntent({
      ...LISTING_INTENT,
      credits: 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
  });

  it("refuses a credit-pack intent with no credits", () => {
    const result = validateCheckoutSessionIntent(without(INTENT, "credits"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
  });

  it("refuses an unknown purpose", () => {
    const result = validateCheckoutSessionIntent({
      ...INTENT,
      purpose: "donation",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
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

  it("requires the Checkout Session it settles", () => {
    // Unbound evidence must not be representable: a completion that cannot name
    // its session would let one paid session's settlement validate another's.
    const missing = validateCheckoutCompletedEvent(
      without(EVENT, "checkoutSessionId"),
    );
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.code).toBe(BILLING_REFUSE_CODES.missingProperty);

    for (const checkoutSessionId of ["", 7, null]) {
      const result = validateCheckoutCompletedEvent({
        ...EVENT,
        checkoutSessionId,
      });
      expect(result.ok, String(checkoutSessionId)).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(BILLING_REFUSE_CODES.invalidProperty);
    }
  });

  it("accepts a provider session id SceneAxi's own identifier rule would refuse", () => {
    // The id is Stripe's, not ours: it guarantees no length and no charset, so
    // holding it to IDENTIFIER_RE would refuse a genuinely paid completion.
    for (const checkoutSessionId of [
      `cs_live_${"a".repeat(240)}`,
      "cs_test_a1B2/c3+d4=e5%f6",
      "_leading_underscore",
    ]) {
      const result = validateCheckoutCompletedEvent({
        ...EVENT,
        checkoutSessionId,
      });
      expect(result.ok, checkoutSessionId).toBe(true);
      if (!result.ok) return;
      expect(result.value.checkoutSessionId).toBe(checkoutSessionId);
    }
  });

  it("still holds the ids SceneAxi mints to the identifier rule", () => {
    // Relaxing the provider id must not relax ours: intentId and userId are
    // server-issued, so their shape stays SceneAxi's to enforce.
    for (const field of ["intentId", "userId", "eventId"]) {
      const result = validateCheckoutCompletedEvent({
        ...EVENT,
        [field]: `x${"y".repeat(200)}`,
      });
      expect(result.ok, field).toBe(false);
    }
  });

  it("accepts a catalog-listing completion with no credits and refuses one with them", () => {
    const listingEvent = {
      ...without(EVENT, "credits"),
      purpose: "catalog-listing",
      itemId: "harbour-diorama",
      unitAmount: 1200,
    };
    expect(validateCheckoutCompletedEvent(listingEvent).ok).toBe(true);
    expect(
      validateCheckoutCompletedEvent({ ...listingEvent, credits: 1 }).ok,
    ).toBe(false);
  });
});

describe("isBillingIdentifier", () => {
  it("is the same rule the completion contract applies to the ids SceneAxi mints", () => {
    // Pinned against intentId, not checkoutSessionId: the session id is Stripe's
    // and is deliberately held to presence alone.
    for (const usable of ["int_test_01", "evt.1-2", "A", "c".repeat(128)]) {
      expect(isBillingIdentifier(usable), usable).toBe(true);
      expect(
        validateCheckoutCompletedEvent({ ...EVENT, intentId: usable }).ok,
        usable,
      ).toBe(true);
    }
    for (const unusable of ["", "int test 01", "_leading", "c".repeat(129), 7]) {
      expect(isBillingIdentifier(unusable), String(unusable)).toBe(false);
      expect(
        validateCheckoutCompletedEvent({ ...EVENT, intentId: unusable }).ok,
        String(unusable),
      ).toBe(false);
    }
  });

  it("does not govern the provider ids on the same contract", () => {
    for (const providerId of [`cs_live_${"a".repeat(240)}`, "_leading"]) {
      expect(isBillingIdentifier(providerId), providerId).toBe(false);
      expect(
        validateCheckoutCompletedEvent({
          ...EVENT,
          checkoutSessionId: providerId,
          stripePriceId: providerId,
        }).ok,
        providerId,
      ).toBe(true);
    }
  });
});

describe("billing contract version", () => {
  it("is major version 1", () => {
    expect(BILLING_SCHEMA_VERSION).toBe(1);
  });
});
