import { describe, expect, it } from "vitest";
import {
  validateCheckoutSessionIntent,
  type CreditAccount,
  type CreditPackCatalog,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  CHECKOUT_METADATA_KEYS,
  STRIPE_EVENT_IDEMPOTENCY_PREFIX,
  STRIPE_SIGNATURE_TOLERANCE_SECONDS,
  applyCheckoutCompletedGrant,
  createCheckoutSessionIntent,
  createLedgerState,
  loadCreditPackCatalog,
  lookupCreditPack,
  parseCheckoutCompletedEvent,
  signStripeWebhookPayload,
  verifyStripeWebhookSignature,
} from "@sceneaxi/billing";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const NOW_SECONDS = Math.floor(NOW / 1000);
const SECRET = "whsec_test_fixture_secret";

const ACCOUNT = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.credit-account",
  accountId: "acc_crew",
  userId: "usr_crew",
  createdAt: "2026-07-25T09:00:00Z",
}) as CreditAccount;

const catalog = (): CreditPackCatalog => {
  const loaded = loadCreditPackCatalog();
  if (!loaded.ok) throw new Error(`catalog load failed: ${loaded.message}`);
  return loaded.value;
};

const intentRequest = (overrides: Record<string, unknown> = {}) => ({
  catalog: catalog(),
  packId: "starter",
  userId: "usr_crew",
  successUrl: "https://sceneaxi.example/checkout/success",
  cancelUrl: "https://sceneaxi.example/checkout/cancel",
  idempotencyKey: "checkout:usr_crew:starter",
  now: NOW,
  ...overrides,
});

/** A Stripe-shaped checkout.session.completed body. */
const eventBody = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "evt_test_01",
    type: "checkout.session.completed",
    created: NOW_SECONDS,
    livemode: false,
    data: {
      object: {
        id: "cs_test_01",
        metadata: {
          [CHECKOUT_METADATA_KEYS.userId]: "usr_crew",
          [CHECKOUT_METADATA_KEYS.purpose]: "credit-pack",
          [CHECKOUT_METADATA_KEYS.itemId]: "starter",
          [CHECKOUT_METADATA_KEYS.intentId]: "int_checkout-usr_crew-starter",
        },
      },
    },
    ...overrides,
  });

describe("credit pack catalog", () => {
  it("loads the canonical committed test-mode catalog", () => {
    const loaded = loadCreditPackCatalog();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.mode).toBe("test");
    expect(loaded.value.packs.length).toBeGreaterThan(0);
  });

  it("looks a pack up and refuses an unknown one", () => {
    const hit = lookupCreditPack(catalog(), "starter");
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    expect(hit.value.credits).toBeGreaterThan(0);

    for (const packId of ["nope", "", 42, undefined]) {
      const miss = lookupCreditPack(catalog(), packId);
      expect(miss.ok).toBe(false);
      if (miss.ok) return;
      expect(miss.reason).toBe(BILLING_REFUSE_REASONS.packUnknown);
    }
  });

  it("refuses an invalid catalog", () => {
    const result = lookupCreditPack({ packs: [] }, "starter");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.catalogInvalid);
  });
});

describe("createCheckoutSessionIntent", () => {
  it("builds a test-mode intent carrying the catalog's credits", () => {
    const result = createCheckoutSessionIntent(intentRequest() as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mode).toBe("test");
    expect(result.value.purpose).toBe("credit-pack");
    expect(result.value.itemId).toBe("starter");
    expect(result.value.credits).toBe(
      lookupCreditPack(catalog(), "starter").ok
        ? (lookupCreditPack(catalog(), "starter") as { value: { credits: number } })
            .value.credits
        : -1,
    );
    expect(validateCheckoutSessionIntent(result.value).ok).toBe(true);
  });

  it("defaults to test mode and cannot reach live without explicit authorization", () => {
    const defaulted = createCheckoutSessionIntent(intentRequest() as never);
    expect(defaulted.ok).toBe(true);
    if (defaulted.ok) expect(defaulted.value.mode).toBe("test");

    const live = createCheckoutSessionIntent(
      intentRequest({ mode: "live" }) as never,
    );
    expect(live.ok).toBe(false);
    if (!live.ok) {
      expect(live.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
    }

    const gated = createCheckoutSessionIntent(
      intentRequest({ mode: "live", liveModeAuthorized: true }) as never,
    );
    expect(gated.ok).toBe(true);
    if (gated.ok) expect(gated.value.mode).toBe("live");
  });

  it("refuses a truthy-but-not-true live authorization", () => {
    for (const liveModeAuthorized of [1, "yes", {}]) {
      const result = createCheckoutSessionIntent(
        intentRequest({ mode: "live", liveModeAuthorized }) as never,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
    }
  });

  it("refuses an unknown pack", () => {
    const result = createCheckoutSessionIntent(
      intentRequest({ packId: "platinum" }) as never,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.packUnknown);
  });

  it("refuses a plaintext or relative redirect URL", () => {
    for (const patch of [
      { successUrl: "http://sceneaxi.example/ok" },
      { cancelUrl: "http://sceneaxi.example/no" },
      { successUrl: "/relative" },
      { cancelUrl: "javascript:alert(1)" },
    ]) {
      const result = createCheckoutSessionIntent(
        intentRequest(patch) as never,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.redirectUrlInsecure);
    }
  });

  it("refuses a missing user, a missing key, and a bad clock", () => {
    for (const patch of [
      { userId: "" },
      { userId: 42 },
      { idempotencyKey: "" },
      { now: Number.NaN },
    ]) {
      expect(createCheckoutSessionIntent(intentRequest(patch) as never).ok).toBe(
        false,
      );
    }
  });

  it("carries no secret-shaped field", () => {
    const result = createCheckoutSessionIntent(intentRequest() as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.value);
    for (const forbidden of ["secret", "sk_", "whsec", "apiKey", "signature"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("verifyStripeWebhookSignature", () => {
  const signed = (payload: string, timestamp = NOW_SECONDS) =>
    signStripeWebhookPayload({ payload, secret: SECRET, timestamp });

  it("accepts a correctly signed raw payload", () => {
    const payload = eventBody();
    const result = verifyStripeWebhookSignature({
      payload,
      header: signed(payload),
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.timestamp).toBe(NOW_SECONDS);
    expect(result.value.payload).toBe(payload);
  });

  it("accepts a byte-array payload identically", () => {
    const payload = eventBody();
    const result = verifyStripeWebhookSignature({
      payload: new TextEncoder().encode(payload),
      header: signed(payload),
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("verifies the raw bytes — re-serialising the JSON must fail", () => {
    // Same JSON value, different bytes: an extra space after the colon.
    const payload = '{"id":"evt_1", "type":"checkout.session.completed"}';
    const header = signed(payload);
    const reserialized = JSON.stringify(JSON.parse(payload) as unknown);
    expect(reserialized).not.toBe(payload);

    const result = verifyStripeWebhookSignature({
      payload: reserialized,
      header,
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.signatureMismatch);
  });

  it("refuses a missing secret rather than accepting an unsigned event", () => {
    const payload = eventBody();
    for (const secret of ["", undefined as never]) {
      const result = verifyStripeWebhookSignature({
        payload,
        header: signed(payload),
        secret,
        now: NOW,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.webhookSecretMissing);
    }
  });

  it("refuses an absent header", () => {
    for (const header of ["", "   ", undefined as never]) {
      const result = verifyStripeWebhookSignature({
        payload: eventBody(),
        header,
        secret: SECRET,
        now: NOW,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.signatureHeaderMissing);
    }
  });

  it("refuses a malformed header", () => {
    for (const header of [
      "nonsense",
      "=v1",
      "t=notanumber,v1=abc",
      "v1=abc",
    ]) {
      const result = verifyStripeWebhookSignature({
        payload: eventBody(),
        header,
        secret: SECRET,
        now: NOW,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect([
        BILLING_REFUSE_REASONS.signatureHeaderMalformed,
        BILLING_REFUSE_REASONS.signatureSchemeMissing,
      ]).toContain(result.reason);
    }
  });

  it("refuses a header with no v1 scheme, accepting no substitute", () => {
    const result = verifyStripeWebhookSignature({
      payload: eventBody(),
      header: `t=${NOW_SECONDS},v0=deadbeef`,
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.signatureSchemeMissing);
  });

  it("refuses the wrong secret", () => {
    const payload = eventBody();
    const result = verifyStripeWebhookSignature({
      payload,
      header: signStripeWebhookPayload({
        payload,
        secret: "whsec_wrong",
        timestamp: NOW_SECONDS,
      }),
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.signatureMismatch);
  });

  it("refuses a payload modified after signing", () => {
    const payload = eventBody();
    const header = signed(payload);
    const result = verifyStripeWebhookSignature({
      payload: `${payload} `,
      header,
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.signatureMismatch);
  });

  it("refuses a stale signature outside the tolerance", () => {
    const payload = eventBody();
    const stale = NOW_SECONDS - STRIPE_SIGNATURE_TOLERANCE_SECONDS - 1;
    const result = verifyStripeWebhookSignature({
      payload,
      header: signed(payload, stale),
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.signatureTimestampStale);
  });

  it("refuses a signature dated too far in the future", () => {
    const payload = eventBody();
    const future = NOW_SECONDS + STRIPE_SIGNATURE_TOLERANCE_SECONDS + 1;
    const result = verifyStripeWebhookSignature({
      payload,
      header: signed(payload, future),
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.signatureTimestampFuture);
  });

  it("honours a custom tolerance", () => {
    const payload = eventBody();
    const slightlyOld = NOW_SECONDS - 60;
    const tight = verifyStripeWebhookSignature({
      payload,
      header: signed(payload, slightlyOld),
      secret: SECRET,
      now: NOW,
      toleranceSeconds: 30,
    });
    expect(tight.ok).toBe(false);

    const loose = verifyStripeWebhookSignature({
      payload,
      header: signed(payload, slightlyOld),
      secret: SECRET,
      now: NOW,
      toleranceSeconds: 120,
    });
    expect(loose.ok).toBe(true);
  });

  it("accepts a rotated secret when both v1 signatures are present", () => {
    const payload = eventBody();
    const stale = signStripeWebhookPayload({
      payload,
      secret: "whsec_old",
      timestamp: NOW_SECONDS,
    });
    const fresh = signed(payload);
    const combined = `${stale},${fresh.slice(fresh.indexOf("v1="))}`;
    const result = verifyStripeWebhookSignature({
      payload,
      header: combined,
      secret: SECRET,
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a bad clock and a non-body payload", () => {
    const payload = eventBody();
    expect(
      verifyStripeWebhookSignature({
        payload,
        header: signed(payload),
        secret: SECRET,
        now: Number.NaN,
      }).ok,
    ).toBe(false);
    expect(
      verifyStripeWebhookSignature({
        payload: { id: "evt" } as never,
        header: signed(payload),
        secret: SECRET,
        now: NOW,
      }).ok,
    ).toBe(false);
  });
});

describe("parseCheckoutCompletedEvent", () => {
  it("normalizes a verified body into SceneAxi vocabulary", () => {
    const result = parseCheckoutCompletedEvent({
      payload: eventBody(),
      catalog: catalog(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.eventId).toBe("evt_test_01");
    expect(result.value.mode).toBe("test");
    expect(result.value.userId).toBe("usr_crew");
    expect(result.value.purpose).toBe("credit-pack");
    expect(result.value.itemId).toBe("starter");
  });

  it("takes credits from the catalog, never from the event", () => {
    const inflated = JSON.stringify({
      id: "evt_test_02",
      type: "checkout.session.completed",
      created: NOW_SECONDS,
      livemode: false,
      credits: 1_000_000,
      data: {
        object: {
          id: "cs_test_02",
          credits: 1_000_000,
          metadata: {
            [CHECKOUT_METADATA_KEYS.userId]: "usr_crew",
            [CHECKOUT_METADATA_KEYS.purpose]: "credit-pack",
            [CHECKOUT_METADATA_KEYS.itemId]: "starter",
            [CHECKOUT_METADATA_KEYS.intentId]: "int_02",
            credits: "1000000",
          },
        },
      },
    });
    const result = parseCheckoutCompletedEvent({
      payload: inflated,
      catalog: catalog(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pack = lookupCreditPack(catalog(), "starter");
    expect(pack.ok).toBe(true);
    if (!pack.ok) return;
    expect(result.value.credits).toBe(pack.value.credits);
  });

  it("maps livemode to the billing mode", () => {
    const result = parseCheckoutCompletedEvent({
      payload: eventBody({ livemode: true }),
      catalog: catalog(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mode).toBe("live");
  });

  it("refuses an absent livemode flag rather than assuming test", () => {
    const body = Object.fromEntries(
      Object.entries(JSON.parse(eventBody()) as Record<string, unknown>).filter(
        ([name]) => name !== "livemode",
      ),
    );
    const result = parseCheckoutCompletedEvent({
      payload: JSON.stringify(body),
      catalog: catalog(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.webhookPayloadInvalid);
  });

  it("refuses any other event type", () => {
    const result = parseCheckoutCompletedEvent({
      payload: eventBody({ type: "payment_intent.succeeded" }),
      catalog: catalog(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
    );
  });

  it("refuses non-JSON, a non-object, a missing id, and missing metadata", () => {
    for (const payload of [
      "not json",
      "[]",
      JSON.stringify({ type: "checkout.session.completed", created: 1, livemode: false }),
      JSON.stringify({
        id: "evt_x",
        type: "checkout.session.completed",
        created: NOW_SECONDS,
        livemode: false,
        data: { object: {} },
      }),
    ]) {
      const result = parseCheckoutCompletedEvent({
        payload,
        catalog: catalog(),
      });
      expect(result.ok).toBe(false);
    }
  });

  it("refuses metadata missing any SceneAxi key", () => {
    for (const drop of Object.values(CHECKOUT_METADATA_KEYS)) {
      const body = JSON.parse(eventBody()) as {
        data: { object: { metadata: Record<string, unknown> } };
      };
      body.data.object.metadata = Object.fromEntries(
        Object.entries(body.data.object.metadata).filter(
          ([name]) => name !== drop,
        ),
      );
      const result = parseCheckoutCompletedEvent({
        payload: JSON.stringify(body),
        catalog: catalog(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.webhookPayloadInvalid);
    }
  });

  it("refuses an unknown pack in metadata", () => {
    const body = JSON.parse(eventBody()) as {
      data: { object: { metadata: Record<string, unknown> } };
    };
    body.data.object.metadata[CHECKOUT_METADATA_KEYS.itemId] = "platinum";
    const result = parseCheckoutCompletedEvent({
      payload: JSON.stringify(body),
      catalog: catalog(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.packUnknown);
  });
});

describe("applyCheckoutCompletedGrant", () => {
  const parsed = (overrides: Record<string, unknown> = {}) => {
    const result = parseCheckoutCompletedEvent({
      payload: eventBody(overrides),
      catalog: catalog(),
    });
    if (!result.ok) throw new Error(`fixture parse failed: ${result.message}`);
    return result.value;
  };

  it("grants exactly the pack's credits once", () => {
    const event = parsed();
    const result = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      event,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(event.credits).toBeDefined();
    expect(result.value.state.balance).toBe(event.credits);
    expect(result.value.replayed).toBe(false);
    expect(result.value.entry.idempotencyKey).toBe(
      `${STRIPE_EVENT_IDEMPOTENCY_PREFIX}evt_test_01`,
    );
  });

  it("grants nothing on an identical redelivery", () => {
    const event = parsed();
    const first = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      event,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = applyCheckoutCompletedGrant({
      state: first.value.state,
      event,
      now: NOW + 5_000,
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(replay.value.state.balance).toBe(event.credits);
    expect(replay.value.state.entries.length).toBe(
      first.value.state.entries.length,
    );
  });

  it("refuses a mutated replay of the same event id", () => {
    const event = parsed();
    const first = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      event,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const mutated = applyCheckoutCompletedGrant({
      state: first.value.state,
      event: { ...event, credits: (event.credits ?? 0) + 1_000 },
      now: NOW,
    });
    expect(mutated.ok).toBe(false);
    if (mutated.ok) return;
    expect(mutated.reason).toBe(BILLING_REFUSE_REASONS.idempotencyConflict);
    expect(first.value.state.balance).toBe(event.credits);
  });

  it("refuses a live event without explicit go-live authorization", () => {
    const event = parsed({ livemode: true });
    const refused = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      event,
      now: NOW,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
    }

    const gated = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      event,
      now: NOW,
      liveModeAuthorized: true,
    });
    expect(gated.ok).toBe(true);
  });

  it("refuses an event naming another user's account", () => {
    const event = parsed();
    const result = applyCheckoutCompletedGrant({
      state: createLedgerState({ ...ACCOUNT, userId: "usr_someone" }),
      event,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountNotOwned);
  });

  it("refuses an invalid event and an invalid ledger state", () => {
    expect(
      applyCheckoutCompletedGrant({
        state: createLedgerState(ACCOUNT),
        event: { eventId: "evt" } as never,
        now: NOW,
      }).ok,
    ).toBe(false);
    expect(
      applyCheckoutCompletedGrant({
        state: { entries: [] } as never,
        event: parsed(),
        now: NOW,
      }).ok,
    ).toBe(false);
  });
});

describe("gate hygiene", () => {
  it("needs no Stripe credentials in the environment", () => {
    expect(process.env["STRIPE_SECRET_KEY"]).toBeUndefined();
    expect(process.env["STRIPE_WEBHOOK_SECRET"]).toBeUndefined();
  });
});
