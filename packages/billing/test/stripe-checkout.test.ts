import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  digestSessionToken,
  resolveAdminIdentity,
} from "@sceneaxi/auth";
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
  STRIPE_LIVE_MODE_ENV_VAR,
  STRIPE_SIGNATURE_TOLERANCE_SECONDS,
  applyCheckoutCompletedGrant,
  checkoutPurposeSettlesElsewhere,
  createCheckoutSessionIntent,
  createInMemoryCreditStore,
  createLedgerState,
  liveModeAuthorizedFlag,
  loadCreditPackCatalog,
  lookupCreditPack,
  parseCheckoutCompletedEvent,
  persistCheckoutCompletedGrant,
  resolveLiveModeAuthorization,
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

const adminResolution = resolveAdminIdentity({
  [ADMIN_EMAIL_ENV_VAR]: "captain@example.com",
});
if (!adminResolution.ok) throw new Error(adminResolution.message);
// Resolved, never hand-built: guards check the identity's runtime provenance,
// so a structurally identical `{ email, source }` literal is refused.
const admin = adminResolution.value;

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

/** Sign and verify a body, returning the runtime-witnessed webhook. */
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

/** The Checkout Session id every fixture event body carries. */
const SESSION_ID = "cs_test_01";

/** Settlement evidence matching an intent, retrieved through the adapter boundary. */
const settlementFor = (
  intent: CheckoutSessionIntent,
  overrides: Record<string, unknown> = {},
) =>
  ({
    sessionId: SESSION_ID,
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
  sessionId: string = SESSION_ID,
) =>
  JSON.stringify({
    id: "evt_test_01",
    type: "checkout.session.completed",
    created: NOW_SECONDS,
    livemode: false,
    data: {
      object: {
        id: sessionId,
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

  it("carries the event's Checkout Session id onto the completion", () => {
    const intent = checkoutIntent();
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody({}, intent)),
      intent,
      settlement: settlementFor(intent),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checkoutSessionId).toBe(SESSION_ID);
  });

  it("refuses settlement from a different session even when the price matches", () => {
    const intent = checkoutIntent();
    // Two genuinely paid sessions for the same pack agree on amount, currency,
    // quantity, and price. Only the session id can tell them apart.
    const otherSession = settlementFor(intent, { sessionId: "cs_test_other" });
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody({}, intent)),
      intent,
      settlement: otherSession,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.settlementSessionMismatch,
    );
  });

  it("refuses settlement that names no session at all", () => {
    const intent = checkoutIntent();
    const unbound = settlementFor(intent) as Record<string, unknown>;
    delete unbound["sessionId"];
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody({}, intent)),
      intent,
      settlement: unbound,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.settlementSessionMismatch,
    );
  });

  it("refuses an event whose session object carries no id", () => {
    const intent = checkoutIntent();
    const body = JSON.parse(eventBody({}, intent)) as {
      data: { object: Record<string, unknown> };
    };
    delete body.data.object["id"];
    const result = parseCheckoutCompletedEvent({
      verified: verified(JSON.stringify(body)),
      intent,
      settlement: settlementFor(intent),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.checkoutSessionIdMissing,
    );
  });

  it("refuses a session id that is empty, blank, or not a string", () => {
    // Blank counts as empty here because the completion contract says so, and
    // the parser reads presence through that same predicate — otherwise a
    // whitespace id would pass here, be compared against the settlement, and
    // refuse later under a different name than the one the refusal table
    // promises for an id-less event.
    const intent = checkoutIntent();
    for (const sessionId of ["", "   ", "\t\n", 7, null]) {
      const body = JSON.parse(eventBody({}, intent)) as {
        data: { object: Record<string, unknown> };
      };
      body.data.object["id"] = sessionId;
      const result = parseCheckoutCompletedEvent({
        verified: verified(JSON.stringify(body)),
        intent,
        settlement: settlementFor(intent, { sessionId }),
      });
      expect(result.ok, String(sessionId)).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(
        BILLING_REFUSE_REASONS.checkoutSessionIdMissing,
      );
    }
  });

  it("accepts a long, opaque provider session id and binds settlement to it", () => {
    // Stripe owns this id's shape and guarantees neither its length nor its
    // charset, so a SceneAxi format rule here would refuse a genuinely paid
    // webhook for good. Presence, and exact equality with the settlement, is
    // the whole of what the binding needs.
    const intent = checkoutIntent();
    const sessionId = `cs_live_${"a".repeat(240)}/b+c=d%e`;
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody({}, intent, sessionId)),
      intent,
      settlement: settlementFor(intent, { sessionId }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checkoutSessionId).toBe(sessionId);

    // The same id must still be the thing settlement is checked against: a
    // settlement differing only in its last character refuses.
    const mismatched = parseCheckoutCompletedEvent({
      verified: verified(eventBody({}, intent, sessionId)),
      intent,
      settlement: settlementFor(intent, { sessionId: `${sessionId}x` }),
    });
    expect(mismatched.ok).toBe(false);
    if (mismatched.ok) return;
    expect(mismatched.reason).toBe(
      BILLING_REFUSE_REASONS.settlementSessionMismatch,
    );
  });

  it("refuses a wholly absent settlement as a payload fault, not a session mismatch", () => {
    const intent = checkoutIntent();
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody({}, intent)),
      intent,
      settlement: undefined,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.webhookPayloadInvalid);
  });

  it("carries the paid session's own id onto the completion", () => {
    const intent = checkoutIntent();
    const first = parseCheckoutCompletedEvent({
      verified: verified(eventBody({}, intent)),
      intent,
      settlement: settlementFor(intent),
    });
    const second = parseCheckoutCompletedEvent({
      verified: verified(eventBody({}, intent, "cs_test_second")),
      intent,
      settlement: settlementFor(intent, { sessionId: "cs_test_second" }),
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.checkoutSessionId).not.toBe(
      second.value.checkoutSessionId,
    );
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

/** A completion whose provenance is real: parsed from a signed fixture body. */
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

describe("applyCheckoutCompletedGrant", () => {
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

  /**
   * A genuinely re-parsed completion carrying the *same* event id but different
   * normalized evidence — what a redelivery would produce if the intent or the
   * signed body under it had changed.
   *
   * Hand-editing a real completion would test the wrong boundary now: provenance
   * refuses a copy before the fingerprint is ever computed, so the fingerprint
   * binding has to be exercised with completions the parser actually issued.
   */
  const reparsed = (
    intentOverrides: Record<string, unknown>,
    bodyOverrides: Record<string, unknown> = {},
    sessionId: string = SESSION_ID,
  ) => {
    const intent = {
      ...checkoutIntent(),
      ...intentOverrides,
    } as CheckoutSessionIntent;
    const result = parseCheckoutCompletedEvent({
      verified: verified(eventBody(bodyOverrides, intent, sessionId)),
      intent,
      settlement: settlementFor(intent, { sessionId }),
    });
    if (!result.ok) throw new Error(`fixture parse failed: ${result.message}`);
    return result.value;
  };

  it("binds replay to the complete normalized completion", () => {
    const completion = parsed();
    const first = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      completion,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const variants = [
      reparsed({ intentId: "intent_other" }),
      reparsed({ unitAmount: completion.unitAmount + 1 }),
      reparsed({ currency: "eur" }),
      reparsed({ stripePriceId: "price_test_other" }),
      reparsed({}, { created: NOW_SECONDS + 1 }),
      reparsed({}, {}, "cs_test_second"),
      reparsed({}, {}, `cs_live_${"a".repeat(240)}/b+c=d%e`),
    ];
    for (const variant of variants) {
      expect(variant.eventId).toBe(completion.eventId);
      const replay = applyCheckoutCompletedGrant({
        state: first.value.state,
        completion: variant,
        now: NOW,
      });
      expect(replay.ok).toBe(false);
      if (replay.ok) return;
      expect(replay.reason).toBe(BILLING_REFUSE_REASONS.idempotencyConflict);
    }
  });

  it("refuses a copy of the completion it just granted", () => {
    const completion = parsed();
    const first = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      completion,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Byte-identical to a completion this very call granted, and still refused:
    // provenance is object identity, so no copy of verified evidence is verified
    // evidence. `tests/e2e/runtime-provenance-refusal.test.ts` owns the matrix.
    const replay = applyCheckoutCompletedGrant({
      state: first.value.state,
      completion: { ...completion } as never,
      now: NOW,
    });
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.reason).toBe(BILLING_REFUSE_REASONS.completionNotVerified);
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

/**
 * The persisted grant boundary (sceneaxi#128).
 *
 * `applyCheckoutCompletedGrant` decides and cannot commit. An endpoint that
 * answered Stripe 2xx on its result alone would claim a purchase was honored
 * against a ledger that never changed, and Stripe would never redeliver it.
 */
describe("persistCheckoutCompletedGrant", () => {
  const storeWithAccount = () =>
    createInMemoryCreditStore({ accounts: [ACCOUNT] });

  it("reports success only after the grant is in the ledger", async () => {
    const store = storeWithAccount();
    const completion = parsed();
    const result = await persistCheckoutCompletedGrant({
      store,
      state: createLedgerState(ACCOUNT),
      completion,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.replayed).toBe(false);
    expect(result.value.state.balance).toBe(completion.credits);

    const persisted = await store.listEntries(ACCOUNT.accountId);
    expect(persisted.length).toBe(1);
    expect(persisted[0]?.idempotencyKey).toBe(
      `${STRIPE_EVENT_IDEMPOTENCY_PREFIX}evt_test_01`,
    );
    expect(persisted[0]?.delta).toBe(completion.credits);
  });

  it("names a store failure and grants nothing", async () => {
    const backing = storeWithAccount();
    let attempts = 0;
    const store = Object.freeze({
      ...backing,
      appendOrReplayEntry() {
        attempts += 1;
        throw new Error("transaction rolled back");
      },
    });

    const result = await persistCheckoutCompletedGrant({
      store,
      state: createLedgerState(ACCOUNT),
      completion: parsed(),
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.storeFailed);
    expect(attempts).toBe(1);
    expect(backing.entryCount(ACCOUNT.accountId)).toBe(0);
  });

  it("replays a redelivery whose first response was lost, granting once", async () => {
    const store = storeWithAccount();
    const completion = parsed();
    const request = {
      store,
      state: createLedgerState(ACCOUNT),
      completion,
      now: NOW,
    };

    const first = await persistCheckoutCompletedGrant(request);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.replayed).toBe(false);

    // Stripe redelivers; this caller's ledger read still predates its own commit,
    // so the pure path would append again and only the store can tell it not to.
    const redelivery = await persistCheckoutCompletedGrant({
      ...request,
      now: NOW + 5_000,
    });
    expect(redelivery.ok).toBe(true);
    if (!redelivery.ok) return;
    expect(redelivery.value.replayed).toBe(true);
    expect(redelivery.value.entry).toEqual(first.value.entry);
    expect(redelivery.value.state.balance).toBe(completion.credits);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(1);
  });

  it("commits nothing when the grant itself refuses", async () => {
    const store = storeWithAccount();
    const result = await persistCheckoutCompletedGrant({
      store,
      state: createLedgerState(ACCOUNT),
      // A completion that was never parsed from a verified webhook.
      completion: { ...parsed() } as never,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.completionNotVerified);
    expect(store.entryCount(ACCOUNT.accountId)).toBe(0);
  });

  it("requires a credit store", async () => {
    const result = await persistCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      completion: parsed(),
      now: NOW,
    } as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
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

/**
 * D5 requirement 2, proven at **both** ends against the real paths.
 *
 * The captain allowed live-mode authorization to be sourced from one named
 * configuration variable. The mitigation is that an absent or malformed variable
 * changes nothing: `assertModeAuthorized` must still refuse
 * `STRIPE_LIVE_MODE_NOT_AUTHORIZED` when creating an intent *and* when honoring
 * an event. `live-mode.test.ts` owns the resolver's own contract; this is the
 * end-to-end half, because both ends live here.
 */
describe("live-mode authorization sourced from configuration (D5)", () => {
  const flagFor = (env: Readonly<Record<string, string | undefined>>) =>
    liveModeAuthorizedFlag(
      (() => {
        const resolved = resolveLiveModeAuthorization({
          env,
          recordAudit: () => undefined,
        });
        return resolved.ok ? resolved.value : undefined;
      })(),
    );

  const AUTHORIZED = {
    [STRIPE_LIVE_MODE_ENV_VAR]: "live-mode-authorized:captain@example.com:2026-07-29",
  };

  /** Environments that authorize nothing: unset, and three plausible mistakes. */
  const UNAUTHORIZED: ReadonlyArray<Readonly<Record<string, string | undefined>>> = [
    {},
    { [STRIPE_LIVE_MODE_ENV_VAR]: "true" },
    { [STRIPE_LIVE_MODE_ENV_VAR]: "live-mode-authorized" },
    { [STRIPE_LIVE_MODE_ENV_VAR]: "live-mode-authorized:captain@example.com:soon" },
  ];

  it("refuses intent creation for every environment that is not the affirmative", () => {
    for (const env of UNAUTHORIZED) {
      const result = createCheckoutSessionIntent(
        intentRequest({ mode: "live", liveModeAuthorized: flagFor(env) }) as never,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
    }
  });

  it("refuses the grant for every environment that is not the affirmative", () => {
    const completion = parsed({ livemode: true });
    for (const env of UNAUTHORIZED) {
      const result = applyCheckoutCompletedGrant({
        state: createLedgerState(ACCOUNT),
        completion,
        now: NOW,
        liveModeAuthorized: flagFor(env),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
    }
  });

  it("is a usable source at both ends when the variable is the exact affirmative", () => {
    // This is what the captain decided the mechanism may be. It is not live
    // activation: no shipped call site derives a flag this way (ADR 0021), and this
    // test builds the environment itself rather than reading one.
    const intent = createCheckoutSessionIntent(
      intentRequest({ mode: "live", liveModeAuthorized: flagFor(AUTHORIZED) }) as never,
    );
    expect(intent.ok).toBe(true);
    if (intent.ok) expect(intent.value.mode).toBe("live");

    const granted = applyCheckoutCompletedGrant({
      state: createLedgerState(ACCOUNT),
      completion: parsed({ livemode: true }),
      now: NOW,
      liveModeAuthorized: flagFor(AUTHORIZED),
    });
    expect(granted.ok).toBe(true);
  });
});

describe("gate hygiene", () => {
  it("needs no Stripe credentials in the environment", () => {
    expect(process.env["STRIPE_SECRET_KEY"]).toBeUndefined();
    expect(process.env["STRIPE_WEBHOOK_SECRET"]).toBeUndefined();
  });

  it("carries no live-mode authorization", () => {
    expect(process.env[STRIPE_LIVE_MODE_ENV_VAR]).toBeUndefined();
  });
});
