import { describe, expect, it } from "vitest";
import { digestSessionToken } from "@sceneaxi/auth";
import {
  validateCheckoutSessionIntent,
  type CheckoutSessionIntent,
  type CreditAccount,
  type CreditPackCatalog,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  CHECKOUT_METADATA_KEYS,
  STRIPE_EVENT_IDEMPOTENCY_PREFIX,
  STRIPE_SIGNATURE_TOLERANCE_SECONDS,
  applyCheckoutCompletedGrant,
  checkoutPurposeSettlesElsewhere,
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

const admin = {
  email: "captain@example.com",
  source: "SCENEAXI_ADMIN_EMAIL",
} as const;

/** A valid usr_crew principal; the guard re-derives its `user` role. */
const principal = () =>
  ({
    user: {
      schemaVersion: 1,
      kind: "sceneaxi.user",
      userId: "usr_crew",
      email: "crew@example.com",
      emailVerified: true,
      disabled: false,
      createdAt: "2026-07-25T09:00:00Z",
    },
    role: {
      schemaVersion: 1,
      kind: "sceneaxi.role-assignment",
      userId: "usr_crew",
      role: "user",
      source: "default-user",
      assignedAt: "2026-07-25T09:30:00Z",
    },
    session: {
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: "ses_crew",
      userId: "usr_crew",
      surface: "web-shell",
      issuedAt: "2026-07-25T09:00:00Z",
      expiresAt: "2026-07-26T10:00:00Z",
      tokenDigest: digestSessionToken("tok"),
    },
  }) as unknown;

/** Sign and verify a body, returning the branded verified webhook. */
const verified = (body: string) => {
  const result = verifyStripeWebhookSignature({
    payload: body,
    header: signStripeWebhookPayload({
      payload: body,
      secret: SECRET,
      timestamp: NOW_SECONDS,
    }),
    secret: SECRET,
    now: NOW,
  });
  if (!result.ok) throw new Error(`verify fixture failed: ${result.message}`);
  return result.value;
};

/** Settlement evidence matching an intent, retrieved through the adapter boundary. */
const settlementFor = (
  intent: CheckoutSessionIntent,
  overrides: Record<string, unknown> = {},
) =>
  ({
    paymentStatus: "paid",
    amountTotal: intent.unitAmount,
    currency: intent.currency,
    quantity: 1,
    stripePriceId: intent.stripePriceId,
    ...overrides,
  }) as never;

const intentRequest = (overrides: Record<string, unknown> = {}) => ({
  principal: principal(),
  admin,
  catalog: catalog(),
  packId: "starter",
  successUrl: "https://sceneaxi.example/checkout/success",
  cancelUrl: "https://sceneaxi.example/checkout/cancel",
  idempotencyKey: "checkout:usr_crew:starter",
  now: NOW,
  ...overrides,
});

const checkoutIntent = (
  overrides: Record<string, unknown> = {},
): CheckoutSessionIntent => {
  const result = createCheckoutSessionIntent(intentRequest(overrides) as never);
  if (!result.ok) throw new Error(`intent fixture failed: ${result.message}`);
  return result.value;
};

const eventBody = (
  overrides: Record<string, unknown> = {},
  intent = checkoutIntent(),
) =>
  JSON.stringify({
    id: "evt_test_01",
    type: "checkout.session.completed",
    created: NOW_SECONDS,
    livemode: false,
    data: {
      object: {
        id: "cs_test_01",
        payment_status: "paid",
        amount_total: intent.unitAmount,
        currency: intent.currency,
        line_items: {
          data: [
            {
              quantity: 1,
              price: { id: intent.stripePriceId },
            },
          ],
        },
        metadata: {
          [CHECKOUT_METADATA_KEYS.userId]: intent.userId,
          [CHECKOUT_METADATA_KEYS.purpose]: intent.purpose,
          [CHECKOUT_METADATA_KEYS.itemId]: intent.itemId,
          [CHECKOUT_METADATA_KEYS.intentId]: intent.intentId,
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
      { principal: null },
      { principal: { user: {} } },
      { idempotencyKey: "" },
      { now: Number.NaN },
      { now: Number.MAX_VALUE },
    ]) {
      expect(createCheckoutSessionIntent(intentRequest(patch) as never).ok).toBe(
        false,
      );
    }
  });

  it("refuses accessor-bearing requests without invoking getters", () => {
    const request = intentRequest() as Record<string, unknown>;
    Object.defineProperty(request, "catalog", {
      enumerable: true,
      get() {
        throw new Error("untrusted getter");
      },
    });

    const result = createCheckoutSessionIntent(request as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
  });

  it("uses one descriptor snapshot for proxy-backed requests", () => {
    const request = new Proxy(intentRequest(), {
      get() {
        throw new Error("a later proxy read escaped the snapshot");
      },
    });
    const result = createCheckoutSessionIntent(request as never);
    expect(result.ok).toBe(true);
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

  it("keeps intent ids distinct when keys sanitize alike", () => {
    const colon = checkoutIntent({ idempotencyKey: "checkout:a:b" });
    const dash = checkoutIntent({ idempotencyKey: "checkout:a-b" });
    expect(colon.intentId).not.toBe(dash.intentId);
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
        now: Number.MAX_VALUE,
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
    const intent = checkoutIntent();
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody({}, intent)),
      intent,
      settlement: settlementFor(intent),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.eventId).toBe("evt_test_01");
    expect(result.value.mode).toBe("test");
    expect(result.value.userId).toBe("usr_crew");
    expect(result.value.purpose).toBe("credit-pack");
    expect(result.value.itemId).toBe("starter");
  });

  it("takes credits from the persisted intent, never from the event", () => {
    const intent = checkoutIntent();
    const inflated = JSON.parse(eventBody({}, intent)) as {
      credits?: number;
      data: {
        object: {
          credits?: number;
          metadata: Record<string, unknown>;
        };
      };
    };
    inflated.credits = 1_000_000;
    inflated.data.object.credits = 1_000_000;
    inflated.data.object.metadata["credits"] = "1000000";
    const result = parseCheckoutCompletedEvent({
      verified: verified(JSON.stringify(inflated)),
      intent,
      settlement: settlementFor(intent),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pack = lookupCreditPack(catalog(), "starter");
    expect(pack.ok).toBe(true);
    if (!pack.ok) return;
    expect(result.value.credits).toBe(pack.value.credits);
  });

  it("maps livemode to the billing mode", () => {
    const intent = checkoutIntent({
      mode: "live",
      liveModeAuthorized: true,
    });
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody({ livemode: true }, intent)),
      intent,
      settlement: settlementFor(intent),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mode).toBe("live");
  });

  it("refuses unpaid or mismatched settlements", () => {
    const intent = checkoutIntent();
    const settlements = [
      settlementFor(intent, { paymentStatus: "unpaid" }),
      settlementFor(intent, { amountTotal: intent.unitAmount - 1 }),
      settlementFor(intent, { currency: "eur" }),
      settlementFor(intent, { stripePriceId: "price_test_other" }),
      settlementFor(intent, { quantity: 2 }),
    ];
    for (const settlement of settlements) {
      const result = parseCheckoutCompletedEvent({
        verified: verified(eventBody({}, intent)),
        intent,
        settlement,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.webhookPayloadInvalid);
    }
  });

  it("refuses an absent livemode flag rather than assuming test", () => {
    const intent = checkoutIntent();
    const body = Object.fromEntries(
      Object.entries(
        JSON.parse(eventBody({}, intent)) as Record<string, unknown>,
      ).filter(
        ([name]) => name !== "livemode",
      ),
    );
    const result = parseCheckoutCompletedEvent({
      verified: verified(JSON.stringify(body)),
      intent,
      settlement: settlementFor(intent),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.webhookPayloadInvalid);
  });

  it("refuses any other event type", () => {
    const intent = checkoutIntent();
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody({ type: "payment_intent.succeeded" }, intent)),
      intent,
      settlement: settlementFor(intent),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.webhookEventTypeUnsupported,
    );
  });

  it("refuses non-JSON, a non-object, a missing id, and missing metadata", () => {
    const intent = checkoutIntent();
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
        verified: verified(payload),
        intent,
        settlement: settlementFor(intent),
      });
      expect(result.ok).toBe(false);
    }
  });

  it("refuses metadata missing any SceneAxi key", () => {
    const intent = checkoutIntent();
    for (const drop of Object.values(CHECKOUT_METADATA_KEYS)) {
      const body = JSON.parse(eventBody({}, intent)) as {
        data: { object: { metadata: Record<string, unknown> } };
      };
      body.data.object.metadata = Object.fromEntries(
        Object.entries(body.data.object.metadata).filter(
          ([name]) => name !== drop,
        ),
      );
      const result = parseCheckoutCompletedEvent({
        verified: verified(JSON.stringify(body)),
        intent,
        settlement: settlementFor(intent),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.webhookPayloadInvalid);
    }
  });

  it("refuses a settlement that does not match the persisted intent", () => {
    // The persisted intent is the immutable price snapshot; a settlement naming a
    // different Stripe price than the intent is refused even if it is internally
    // consistent, so a repriced catalog cannot redirect a paid session.
    const intent = checkoutIntent();
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody({}, intent)),
      intent,
      settlement: settlementFor(intent, { stripePriceId: "price_test_other" }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.webhookPayloadInvalid);
  });
});

describe("applyCheckoutCompletedGrant", () => {
  const parsed = (overrides: Record<string, unknown> = {}) => {
    const intent = checkoutIntent(
      overrides["livemode"] === true
        ? { mode: "live", liveModeAuthorized: true }
        : overrides["packId"] === undefined
          ? {}
          : { packId: overrides["packId"] },
    );
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody(overrides, intent)),
      intent,
      settlement: settlementFor(intent),
    });
    if (!result.ok) throw new Error(`fixture parse failed: ${result.message}`);
    return result.value;
  };

  it("grants exactly the pack's credits once", () => {
    const completion = parsed();
    const result = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      completion,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(completion.credits).toBeDefined();
    expect(result.value.state.balance).toBe(completion.credits);
    expect(result.value.replayed).toBe(false);
    expect(result.value.entry?.idempotencyKey).toBe(
      `${STRIPE_EVENT_IDEMPOTENCY_PREFIX}evt_test_01`,
    );
  });

  it("grants nothing on an identical redelivery", () => {
    const completion = parsed();
    const first = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      completion,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = applyCheckoutCompletedGrant({
      state: first.value.state,
      completion,
      now: NOW + 5_000,
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(replay.value.state.balance).toBe(completion.credits);
    expect(replay.value.state.entries.length).toBe(
      first.value.state.entries.length,
    );
  });

  it("refuses a mutated replay of the same event id", () => {
    const first = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      completion: parsed(),
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Same event id, different credit amount: a second pack re-parsed against the
    // same signed body carries the same stripe-event id but different money.
    const mutated = applyCheckoutCompletedGrant({
      state: first.value.state,
      completion: parsed({ packId: "maker" }),
      now: NOW,
    });
    expect(mutated.ok).toBe(false);
    if (mutated.ok) return;
    expect(mutated.reason).toBe(BILLING_REFUSE_REASONS.idempotencyConflict);
    expect(first.value.state.balance).toBe(parsed().credits);
  });

  it("binds replay to the complete normalized completion", () => {
    const completion = parsed();
    const first = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      completion,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const mutations = [
      { intentId: "intent_other" },
      { unitAmount: completion.unitAmount + 1 },
      { currency: "eur" },
      { stripePriceId: "price_test_other" },
      { occurredAt: "2026-07-25T10:00:01Z" },
    ];
    for (const mutation of mutations) {
      const replay = applyCheckoutCompletedGrant({
        state: first.value.state,
        completion: { ...completion, ...mutation } as never,
        now: NOW,
      });
      expect(replay.ok).toBe(false);
      if (replay.ok) return;
      expect(replay.reason).toBe(BILLING_REFUSE_REASONS.idempotencyConflict);
    }
  });

  it("refuses a live event without explicit go-live authorization", () => {
    const completion = parsed({ livemode: true });
    const refused = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      completion,
      now: NOW,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
    }

    const gated = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      completion,
      now: NOW,
      liveModeAuthorized: true,
    });
    expect(gated.ok).toBe(true);
  });

  it("refuses an event naming another user's account", () => {
    const completion = parsed();
    const result = applyCheckoutCompletedGrant({
      state: createLedgerState({ ...ACCOUNT, userId: "usr_someone" }),
      completion,
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
        completion: { eventId: "evt" } as never,
        now: NOW,
      }).ok,
    ).toBe(false);
    expect(
      applyCheckoutCompletedGrant({
        state: { entries: [] } as never,
        completion: parsed(),
        now: NOW,
      }).ok,
    ).toBe(false);
  });
});

describe("checkoutPurposeSettlesElsewhere", () => {
  it("names only the known purposes the credit ledger does not settle", () => {
    expect(checkoutPurposeSettlesElsewhere("catalog-listing")).toBe(true);
    expect(checkoutPurposeSettlesElsewhere("credit-pack")).toBe(false);
  });

  it("claims nothing about a purpose it does not know", () => {
    // A caller routes on this before reading any evidence, so it must only ever send a
    // body away from the grant path. An absent, malformed, or unknown purpose therefore
    // keeps its normal path and is still refused by `parseCheckoutCompletedEvent`.
    for (const purpose of [undefined, null, "", "  ", "creditpack", 7, {}, ["catalog-listing"]]) {
      expect(checkoutPurposeSettlesElsewhere(purpose)).toBe(false);
    }
  });
});

describe("gate hygiene", () => {
  it("needs no Stripe credentials in the environment", () => {
    expect(process.env["STRIPE_SECRET_KEY"]).toBeUndefined();
    expect(process.env["STRIPE_WEBHOOK_SECRET"]).toBeUndefined();
  });
});
