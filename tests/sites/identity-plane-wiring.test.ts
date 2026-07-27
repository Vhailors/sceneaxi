/**
 * The umbrella's identity/credits/billing wiring, end to end against real plane code.
 *
 * These tests drive `@sceneaxi/auth` and `@sceneaxi/billing` themselves — the real
 * identity port, the real append-only ledger, the real Stripe signature verifier — over
 * the in-memory stores those packages ship. Nothing about identity, balance, or
 * signature checking is stubbed; only the two things ADR 0021 keeps outside this
 * repository are injected: the credential provider and the Stripe API round-trip.
 *
 * No secret appears here. The webhook secret is a fixture string, the signature is
 * produced by `signStripeWebhookPayload` (the same construction the verifier checks), and
 * the billing mode is never `live`.
 */
import { describe, expect, it } from "vitest";
import {
  createIdentityPort,
  createInMemoryIdentityStore,
  digestSessionToken,
  resolveAdminIdentity,
  type IdentityAdapter,
} from "@sceneaxi/auth";
import {
  CHECKOUT_METADATA_KEYS,
  createInMemoryCreditStore,
  signStripeWebhookPayload,
  type CheckoutSettlement,
} from "@sceneaxi/billing";
import { SITE_STARTER_CREDIT_ALLOTMENT } from "@sceneaxi/site-kit";
import {
  CREDIT_WEBHOOK_REASONS,
  applyCreditPackWebhook,
  createUmbrellaIdentityPlane,
  creditWebhookHttpStatus,
  parseSessionToken,
  siteReasonForAuthReason,
  siteReasonForBillingReason,
} from "../../sites/umbrella/src/index.ts";
import {
  CATALOG_IDENTITY_SURFACE,
  createCatalogIdentityPlane,
  resolveCatalogViewer,
} from "../../sites/catalog-game/src/index.ts";

const ADMIN_EMAIL = "captain@sceneaxi.test";
const MEMBER_EMAIL = "member@sceneaxi.test";
const NOW = Date.parse("2026-07-26T12:00:00.000Z");
const clock = () => NOW;

/**
 * A fixture string, not a secret: it is deliberately shaped so no secret scanner
 * matches it, and it matches the convention in `packages/billing/test`.
 */
const TEST_WEBHOOK_SECRET = "whsec_test_fixture_umbrella";

const iso = (offsetMs: number): string => new Date(NOW + offsetMs).toISOString();

const user = (userId: string, email: string, overrides: Record<string, unknown> = {}) =>
  Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.user" as const,
    userId,
    email,
    emailVerified: true,
    disabled: false,
    createdAt: iso(-86_400_000),
    ...overrides,
  });

const session = (sessionId: string, userId: string, token: string, overrides: Record<string, unknown> = {}) =>
  Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.session" as const,
    sessionId,
    userId,
    surface: "site" as const,
    issuedAt: iso(-3_600_000),
    expiresAt: iso(3_600_000),
    tokenDigest: digestSessionToken(token),
    ...overrides,
  });

const account = (accountId: string, userId: string) =>
  Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.credit-account" as const,
    accountId,
    userId,
    createdAt: iso(-86_400_000),
  });

/** The provider is injected; sign-in is never reachable from a site anyway. */
const noProvider: IdentityAdapter = Object.freeze({
  authenticate() {
    return undefined;
  },
});

function identityPortWith(users: ReadonlyArray<unknown>, sessions: ReadonlyArray<unknown>) {
  const admin = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: ADMIN_EMAIL });
  if (!admin.ok) throw new Error(`admin unresolved: ${admin.message}`);
  return createIdentityPort({
    adapter: noProvider,
    store: createInMemoryIdentityStore({
      users: users as never,
      sessions: sessions as never,
    }),
    admin: admin.value,
    clock,
  });
}

const ADMIN_TOKEN = "admin-session-token";
const MEMBER_TOKEN = "member-session-token";

const adminWorld = () =>
  identityPortWith(
    [user("captain", ADMIN_EMAIL), user("member-1", MEMBER_EMAIL)],
    [
      session("sess-admin", "captain", ADMIN_TOKEN),
      session("sess-member", "member-1", MEMBER_TOKEN),
    ],
  );

const ENV = Object.freeze({ SCENEAXI_ADMIN_EMAIL: ADMIN_EMAIL });

describe("acceptance 1 — admin env login on the umbrella", () => {
  it("resolves the admin role for the session whose user the env names", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: adminWorld(),
      sessionToken: `sess-admin.${ADMIN_TOKEN}`,
      clock,
    });
    expect(plane.wired.identity).toBe(true);
    expect(plane.admin?.email).toBe(ADMIN_EMAIL);

    const resolved = await plane.identity.resolvePrincipal({ surface: "site" });
    expect(resolved.ok).toBe(true);
    expect(resolved.ok && resolved.value.role).toBe("admin");
    expect(resolved.ok && resolved.value.user.email).toBe(ADMIN_EMAIL);
  });

  it("gives every other user the plain role, no matter which session is presented", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: adminWorld(),
      sessionToken: `sess-member.${MEMBER_TOKEN}`,
      clock,
    });
    const resolved = await plane.identity.resolvePrincipal({ surface: "site" });
    expect(resolved.ok && resolved.value.role).toBe("user");
  });

  it("refuses admin when the environment names nobody, rather than defaulting to one", async () => {
    // No SCENEAXI_ADMIN_EMAIL: the identity port has no admin to derive a role from.
    const plane = createUmbrellaIdentityPlane(
      {},
      {
        identityPort: createIdentityPort({
          adapter: noProvider,
          store: createInMemoryIdentityStore({
            users: [user("captain", ADMIN_EMAIL)] as never,
            sessions: [session("sess-admin", "captain", ADMIN_TOKEN)] as never,
          }),
          clock,
        }),
        sessionToken: `sess-admin.${ADMIN_TOKEN}`,
        clock,
      },
    );
    expect(plane.admin).toBeNull();
    expect(await plane.identity.resolvePrincipal({ surface: "site" })).toMatchObject({
      ok: false,
      reason: "IDENTITY_PLANE_NOT_WIRED",
    });
  });

  it("never lets a client role claim reach the identity port", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: adminWorld(),
      sessionToken: `sess-member.${MEMBER_TOKEN}`,
      clock,
    });
    for (const credentials of [
      { role: "admin" },
      { isAdmin: true },
      { nested: { user: { roles: ["admin"] } } },
    ]) {
      expect(
        await plane.identity.resolvePrincipal({ surface: "site", credentials }),
      ).toMatchObject({ ok: false, reason: "ROLE_CLAIM_FROM_CLIENT_DENIED" });
    }
  });

  it("refuses the Kids surface before any adapter or store is consulted", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: adminWorld(),
      sessionToken: `sess-admin.${ADMIN_TOKEN}`,
      clock,
    });
    expect(await plane.identity.resolvePrincipal({ surface: "kids" })).toMatchObject({
      ok: false,
      reason: "KIDS_SURFACE_DENIED",
    });
  });

  it("reads a signed-out visitor as absent, not as a broken plane", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: adminWorld(),
      sessionToken: null,
      clock,
    });
    expect(await plane.identity.resolvePrincipal({ surface: "site" })).toMatchObject({
      ok: false,
      reason: "IDENTITY_SESSION_ABSENT",
    });
  });

  it("reads an unknown or mismatched session as absent rather than naming which", async () => {
    for (const token of [`sess-admin.wrong-token`, `sess-nope.${ADMIN_TOKEN}`]) {
      const plane = createUmbrellaIdentityPlane(ENV, {
        identityPort: adminWorld(),
        sessionToken: token,
        clock,
      });
      expect(await plane.identity.resolvePrincipal({ surface: "site" })).toMatchObject({
        ok: false,
        reason: "IDENTITY_SESSION_ABSENT",
      });
    }
  });

  it("refuses an expired session with its own reason", async () => {
    const port = identityPortWith(
      [user("member-1", MEMBER_EMAIL)],
      [session("sess-old", "member-1", MEMBER_TOKEN, { expiresAt: iso(-1_000) })],
    );
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: port,
      sessionToken: `sess-old.${MEMBER_TOKEN}`,
      clock,
    });
    expect(await plane.identity.resolvePrincipal({ surface: "site" })).toMatchObject({
      ok: false,
      reason: "IDENTITY_SESSION_EXPIRED",
    });
  });

  it("refuses a disabled user even though the provider would still know them", async () => {
    const port = identityPortWith(
      [user("member-1", MEMBER_EMAIL, { disabled: true })],
      [session("sess-member", "member-1", MEMBER_TOKEN)],
    );
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: port,
      sessionToken: `sess-member.${MEMBER_TOKEN}`,
      clock,
    });
    expect(await plane.identity.resolvePrincipal({ surface: "site" })).toMatchObject({
      ok: false,
      reason: "IDENTITY_USER_DISABLED",
    });
  });

  it("splits the carried credential without interpreting either half", () => {
    expect(parseSessionToken("sess-1.abc.def")).toEqual({
      sessionId: "sess-1",
      token: "abc.def",
    });
    for (const malformed of [null, undefined, "", "   ", "no-separator", ".leading", "trailing."]) {
      expect(parseSessionToken(malformed)).toBeNull();
    }
  });
});

describe("acceptance 2 — the starter allotment is granted exactly once", () => {
  const memberStore = () =>
    createInMemoryCreditStore({ accounts: [account("acct-1", "member-1")] as never });

  it("grants 100 credits on the first balance read", async () => {
    const store = memberStore();
    const plane = createUmbrellaIdentityPlane(ENV, { creditStore: store, clock });
    expect(plane.wired.credits).toBe(true);

    const first = await plane.credits.readBalance({ userId: "member-1" });
    expect(first).toMatchObject({
      ok: true,
      value: { balance: SITE_STARTER_CREDIT_ALLOTMENT, starterGrantConsumed: true },
    });
    expect(SITE_STARTER_CREDIT_ALLOTMENT).toBe(100);
    expect(store.entryCount("acct-1")).toBe(1);
  });

  it("appends nothing on any later read, and never a second grant", async () => {
    const store = memberStore();
    const plane = createUmbrellaIdentityPlane(ENV, { creditStore: store, clock });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const balance = await plane.credits.readBalance({ userId: "member-1" });
      expect(balance).toMatchObject({
        ok: true,
        value: { balance: SITE_STARTER_CREDIT_ALLOTMENT },
      });
    }
    expect(store.entryCount("acct-1")).toBe(1);
  });

  it("grants once per user, not once per deployment", async () => {
    const store = createInMemoryCreditStore({
      accounts: [account("acct-1", "member-1"), account("acct-2", "member-2")] as never,
    });
    const plane = createUmbrellaIdentityPlane(ENV, { creditStore: store, clock });
    await plane.credits.readBalance({ userId: "member-1" });
    await plane.credits.readBalance({ userId: "member-2" });
    expect(store.entryCount("acct-1")).toBe(1);
    expect(store.entryCount("acct-2")).toBe(1);
  });

  it("survives concurrent first reads with a single grant", async () => {
    const store = memberStore();
    const plane = createUmbrellaIdentityPlane(ENV, { creditStore: store, clock });
    const results = await Promise.all(
      Array.from({ length: 4 }, () => plane.credits.readBalance({ userId: "member-1" })),
    );
    for (const result of results) {
      expect(result).toMatchObject({
        ok: true,
        value: { balance: SITE_STARTER_CREDIT_ALLOTMENT },
      });
    }
    expect(store.entryCount("acct-1")).toBe(1);
  });

  it("reports an unknown balance rather than zero when the user has no account", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      creditStore: createInMemoryCreditStore({}),
      clock,
    });
    expect(await plane.credits.readBalance({ userId: "ghost" })).toMatchObject({
      ok: false,
      reason: "CREDITS_PLANE_UNAVAILABLE",
    });
  });

  it("reports an unknown balance rather than zero when the ledger read throws", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      creditStore: {
        findAccountByUserId() {
          throw new Error("neon is unreachable");
        },
        findAccountById() {
          return undefined;
        },
        listEntries() {
          return [];
        },
        appendEntry() {
          /* unreachable in this test */
        },
        settleCreditsSale() {
          return { replayed: false };
        },
      },
      clock,
    });
    expect(await plane.credits.readBalance({ userId: "member-1" })).toMatchObject({
      ok: false,
      reason: "CREDITS_PLANE_UNAVAILABLE",
    });
  });
});

describe("acceptance 3 — TEST credit-pack checkout and the verified webhook grant", () => {
  const buyerWorld = () =>
    identityPortWith(
      [user("member-1", MEMBER_EMAIL)],
      [session("sess-member", "member-1", MEMBER_TOKEN)],
    );

  it("lists the committed credit packs without any provider handle", async () => {
    const packs = await createUmbrellaIdentityPlane(ENV).billing.listCreditPacks();
    expect(packs.ok).toBe(true);
    expect(packs.ok && packs.value.length).toBeGreaterThan(0);
    for (const pack of packs.ok ? packs.value : []) {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.unitAmount).toBeGreaterThan(0);
    }
  });

  it("creates a TEST-mode checkout for the verified buyer", async () => {
    const packs = await createUmbrellaIdentityPlane(ENV).billing.listCreditPacks();
    const packId = packs.ok ? (packs.value[0]?.packId ?? "") : "";
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: buyerWorld(),
      sessionToken: `sess-member.${MEMBER_TOKEN}`,
      checkoutSessions: {
        createCheckoutSession(intent) {
          expect(intent.mode).toBe("test");
          expect(intent.userId).toBe("member-1");
          return { redirectUrl: `https://checkout.stripe.test/${intent.intentId}` };
        },
      },
      clock,
    });
    expect(plane.wired.billing).toBe(true);

    const checkout = await plane.billing.createCheckout({
      userId: "member-1",
      packId,
      successUrl: "https://sceneaxi-umbrella.vercel.app/account",
      cancelUrl: "https://sceneaxi-umbrella.vercel.app/pricing",
      idempotencyKey: "pack:attempt:1",
    });
    expect(checkout).toMatchObject({ ok: true, value: { mode: "test" } });
  });

  it("refuses a checkout whose submitted user id is not the verified buyer", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: buyerWorld(),
      sessionToken: `sess-member.${MEMBER_TOKEN}`,
      checkoutSessions: {
        createCheckoutSession() {
          throw new Error("the provider must never be reached for a mismatched buyer");
        },
      },
      clock,
    });
    expect(
      await plane.billing.createCheckout({
        userId: "captain",
        packId: "pack-any",
        successUrl: "https://sceneaxi-umbrella.vercel.app/account",
        cancelUrl: "https://sceneaxi-umbrella.vercel.app/pricing",
        idempotencyKey: "pack:attempt:2",
      }),
    ).toMatchObject({ ok: false, reason: "BILLING_CHECKOUT_REQUEST_INVALID" });
  });

  it("refuses a checkout for a signed-out visitor", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: buyerWorld(),
      sessionToken: null,
      checkoutSessions: {
        createCheckoutSession() {
          throw new Error("the provider must never be reached without a session");
        },
      },
      clock,
    });
    expect(
      await plane.billing.createCheckout({
        userId: "member-1",
        packId: "pack-any",
        successUrl: "https://sceneaxi-umbrella.vercel.app/account",
        cancelUrl: "https://sceneaxi-umbrella.vercel.app/pricing",
        idempotencyKey: "pack:attempt:3",
      }),
    ).toMatchObject({ ok: false, reason: "IDENTITY_SESSION_ABSENT" });
  });

  it("still refuses live mode with every handle present", async () => {
    const plane = createUmbrellaIdentityPlane(
      { ...ENV, SCENEAXI_BILLING_MODE: "live" },
      {
        identityPort: buyerWorld(),
        sessionToken: `sess-member.${MEMBER_TOKEN}`,
        checkoutSessions: {
          createCheckoutSession() {
            throw new Error("live mode must never reach the provider");
          },
        },
        clock,
      },
    );
    expect(plane.billingMode).toBe("live");
    expect(await plane.billing.listCreditPacks()).toMatchObject({
      ok: false,
      reason: "BILLING_LIVE_MODE_NOT_AUTHORIZED",
    });
  });

  // --- the webhook grant --------------------------------------------------

  const PACK = Object.freeze({
    packId: "pack-webhook-test",
    credits: 500,
    unitAmount: 1500,
    currency: "usd",
    stripePriceId: "price_test_webhook",
  });

  const INTENT = Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.checkout-session-intent" as const,
    intentId: "int_pack_test_abc123456789",
    userId: "member-1",
    purpose: "credit-pack" as const,
    itemId: PACK.packId,
    credits: PACK.credits,
    unitAmount: PACK.unitAmount,
    currency: PACK.currency,
    stripePriceId: PACK.stripePriceId,
    mode: "test" as const,
    successUrl: "https://sceneaxi-umbrella.vercel.app/account",
    cancelUrl: "https://sceneaxi-umbrella.vercel.app/pricing",
    idempotencyKey: "pack:webhook:1",
    createdAt: iso(-60_000),
  });

  const SESSION_ID = "cs_test_session_1";

  const SETTLEMENT: CheckoutSettlement = Object.freeze({
    sessionId: SESSION_ID,
    paymentStatus: "paid",
    amountTotal: PACK.unitAmount,
    currency: PACK.currency,
    quantity: 1,
    stripePriceId: PACK.stripePriceId,
  });

  const eventBody = (
    eventId: string,
    overrides: Readonly<{
      type?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    }> = {},
  ): string =>
    JSON.stringify({
      id: eventId,
      type: overrides.type ?? "checkout.session.completed",
      created: Math.floor(NOW / 1000),
      livemode: false,
      data: {
        object: {
          id: overrides.sessionId ?? SESSION_ID,
          metadata: overrides.metadata ?? {
            sceneaxiUserId: "member-1",
            sceneaxiPurpose: "credit-pack",
            sceneaxiItemId: PACK.packId,
            sceneaxiIntentId: INTENT.intentId,
          },
        },
      },
    });

  const evidence = Object.freeze({
    findIntent(intentId: string) {
      return intentId === INTENT.intentId ? INTENT : undefined;
    },
    retrieveSettlement(sessionId: string) {
      return sessionId === SESSION_ID ? SETTLEMENT : undefined;
    },
  });

  type WebhookEvidence = Parameters<typeof applyCreditPackWebhook>[0]["evidence"];

  /**
   * An evidence port that fails the test if it is consulted. An event this endpoint owes
   * no work must be decided from the verified body, not behind a provider read that a
   * non-completion cannot satisfy — and not behind one that can simply be down, since a
   * throw here would otherwise become a 503 Stripe retries forever.
   */
  const unreachableEvidence: WebhookEvidence = Object.freeze({
    findIntent(): never {
      throw new Error("the evidence port must not be consulted for an event owed no work");
    },
    retrieveSettlement(): never {
      throw new Error("the evidence port must not be consulted for an event owed no work");
    },
  });

  const webhookStore = () =>
    createInMemoryCreditStore({ accounts: [account("acct-1", "member-1")] as never });

  const signedCall = (input: {
    readonly payload: string;
    readonly store: ReturnType<typeof webhookStore>;
    readonly secret?: string;
    readonly timestamp?: number;
    readonly evidence?: WebhookEvidence;
  }) =>
    applyCreditPackWebhook({
      payload: input.payload,
      signatureHeader: signStripeWebhookPayload({
        payload: input.payload,
        secret: TEST_WEBHOOK_SECRET,
        timestamp: input.timestamp ?? Math.floor(NOW / 1000),
      }),
      secret: input.secret ?? TEST_WEBHOOK_SECRET,
      store: input.store,
      evidence: input.evidence ?? evidence,
      now: NOW,
    });

  /**
   * A listing completion: signature-verified, intent-bound, and granting no credits.
   *
   * Spelled out field by field rather than spread-with-`credits`-omitted, because a
   * rest-sibling omit leaves an unused binding this repository's lint rules reject.
   */
  const LISTING_INTENT = Object.freeze({
    schemaVersion: INTENT.schemaVersion,
    kind: INTENT.kind,
    intentId: "int_listing_test_abc123456789",
    userId: INTENT.userId,
    purpose: "catalog-listing" as const,
    itemId: "listing-widget",
    unitAmount: INTENT.unitAmount,
    currency: INTENT.currency,
    stripePriceId: INTENT.stripePriceId,
    mode: INTENT.mode,
    successUrl: INTENT.successUrl,
    cancelUrl: INTENT.cancelUrl,
    idempotencyKey: INTENT.idempotencyKey,
    createdAt: INTENT.createdAt,
  });

  const listingBody = (eventId: string): string =>
    eventBody(eventId, {
      sessionId: "cs_test_listing_1",
      metadata: {
        sceneaxiUserId: "member-1",
        sceneaxiPurpose: "catalog-listing",
        sceneaxiItemId: LISTING_INTENT.itemId,
        sceneaxiIntentId: LISTING_INTENT.intentId,
      },
    });

  const listingEvidence: WebhookEvidence = Object.freeze({
    findIntent(intentId: string) {
      return intentId === LISTING_INTENT.intentId ? LISTING_INTENT : undefined;
    },
    retrieveSettlement() {
      return SETTLEMENT;
    },
  });

  it("grants the pack's credits through a signature-verified event", async () => {
    const store = webhookStore();
    const outcome = await signedCall({ payload: eventBody("evt_test_1"), store });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: false,
      replayed: false,
      credits: PACK.credits,
      balance: PACK.credits,
    });
    expect(store.entryCount("acct-1")).toBe(1);
  });

  it("binds the fixture wire keys to the metadata contract the grant path reads", () => {
    // The bodies above spell the wire keys out, and the plane reads them through
    // `CHECKOUT_METADATA_KEYS`. Pinning the two together here makes a rename of the
    // exported constant fail loudly instead of silently changing which signed bodies
    // the endpoint can bind to an intent.
    expect({ ...CHECKOUT_METADATA_KEYS }).toEqual({
      userId: "sceneaxiUserId",
      purpose: "sceneaxiPurpose",
      itemId: "sceneaxiItemId",
      intentId: "sceneaxiIntentId",
    });
  });

  it("answers deployment failures with 503 and request faults with 400", () => {
    // Stripe retries every non-2xx either way, so this is diagnosis: a forged signature
    // and an unreachable database must not be indistinguishable in the dashboard. An
    // operator who never set STRIPE_WEBHOOK_SECRET owns that omission, so it belongs on
    // the 503 side however Stripe's own dashboard would otherwise read it.
    for (const reason of [
      CREDIT_WEBHOOK_REASONS.evidenceMissing,
      CREDIT_WEBHOOK_REASONS.evidenceUnavailable,
      CREDIT_WEBHOOK_REASONS.ledgerUnavailable,
      CREDIT_WEBHOOK_REASONS.storeFailed,
      "STRIPE_WEBHOOK_SECRET_MISSING",
      "CREDIT_CLOCK_INVALID",
      "CREDIT_LEDGER_STATE_INVALID",
      "CREDIT_LEDGER_ORDER_INVALID",
      "CREDIT_ENTRY_INVALID",
    ]) {
      expect(creditWebhookHttpStatus(reason)).toBe(503);
    }
    for (const reason of [
      "STRIPE_SIGNATURE_HEADER_MISSING",
      "STRIPE_SIGNATURE_MISMATCH",
      "STRIPE_WEBHOOK_PAYLOAD_INVALID",
      "STRIPE_LIVE_MODE_NOT_AUTHORIZED",
    ]) {
      expect(creditWebhookHttpStatus(reason)).toBe(400);
    }
  });

  it("reports a missing signing secret as this deployment's failure, not the sender's", async () => {
    // The refusal itself is unchanged — an unconfigured endpoint still never accepts an
    // unsigned event. Only the surfaced status changes, so an operator investigating the
    // Stripe dashboard is pointed at their own env var rather than at Stripe.
    const store = webhookStore();
    const payload = eventBody("evt_test_nosecret_status");
    const outcome = await applyCreditPackWebhook({
      payload,
      signatureHeader: signStripeWebhookPayload({
        payload,
        secret: TEST_WEBHOOK_SECRET,
        timestamp: Math.floor(NOW / 1000),
      }),
      secret: undefined,
      store,
      evidence,
      now: NOW,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_WEBHOOK_SECRET_MISSING" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(creditWebhookHttpStatus(outcome.reason)).toBe(503);
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("acknowledges a signed event type it does not handle without consulting any adapter", async () => {
    // One endpoint receives every event the dashboard is subscribed to. Refusing the ones
    // this path is not built to act on would make Stripe redeliver a condition no
    // redelivery can change, and those permanent failures count against the health of the
    // same endpoint every real grant depends on. The object here is a payment intent, so
    // its id is a `pi_...` no settlement can ever be retrieved for: the acknowledgement
    // must come from the verified body, not from an evidence read that happens to answer.
    const store = webhookStore();
    const outcome = await signedCall({
      payload: eventBody("evt_test_other_type", {
        type: "payment_intent.succeeded",
        sessionId: "pi_test_payment_intent_1",
        metadata: {
          sceneaxiUserId: "member-1",
          sceneaxiPurpose: "credit-pack",
          sceneaxiItemId: PACK.packId,
          sceneaxiIntentId: INTENT.intentId,
        },
      }),
      store,
      evidence: unreachableEvidence,
    });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: true,
      reason: "STRIPE_WEBHOOK_EVENT_TYPE_UNSUPPORTED",
    });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("acknowledges an expired checkout, whose settlement can never exist", async () => {
    // The reachable half of the same class: an abandoned credit-pack checkout carries the
    // same session id and the same four SceneAxi keys as the completion, so metadata alone
    // cannot tell them apart — only the type can. Diagnosing it after the evidence read
    // would refuse `STRIPE_CHECKOUT_EVIDENCE_MISSING` (503) for a session that was never
    // paid, and Stripe would retry it until it gave up.
    const store = webhookStore();
    const outcome = await signedCall({
      payload: eventBody("evt_test_expired", { type: "checkout.session.expired" }),
      store,
      evidence: {
        findIntent(intentId: string) {
          return intentId === INTENT.intentId ? INTENT : undefined;
        },
        retrieveSettlement() {
          return undefined;
        },
      },
    });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: true,
      reason: "STRIPE_WEBHOOK_EVENT_TYPE_UNSUPPORTED",
    });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("still refuses a signed body that carries no event type", async () => {
    // Acknowledging unhandled types must not become a blanket 2xx for anything unlabelled:
    // Stripe always states the type, so a body without one is a fault, not a no-op.
    const store = webhookStore();
    const payload = JSON.stringify({
      id: "evt_test_typeless",
      created: Math.floor(NOW / 1000),
      livemode: false,
      data: { object: { id: "cs_test_session_1", metadata: {} } },
    });
    const outcome = await signedCall({ payload, store, evidence: unreachableEvidence });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_WEBHOOK_PAYLOAD_INVALID" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("acknowledges a checkout session this deployment never created", async () => {
    const store = webhookStore();
    const outcome = await signedCall({
      payload: eventBody("evt_test_foreign_session", {
        sessionId: "cs_test_someone_elses",
        metadata: { someOtherProduct: "yes" },
      }),
      store,
    });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: true,
      reason: CREDIT_WEBHOOK_REASONS.eventUnrelated,
    });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("refuses a SceneAxi checkout whose metadata is missing the intent id", async () => {
    // The buyer paid. Acknowledging this as "a checkout we never created" would make
    // Stripe record a success and never redeliver, stranding the grant silently. The
    // other three metadata keys are already refused as an invalid payload by
    // `parseCheckoutCompletedEvent`, so all four of one contract fail the same way.
    const store = webhookStore();
    const outcome = await signedCall({
      payload: eventBody("evt_test_partial_metadata", {
        metadata: {
          sceneaxiUserId: "member-1",
          sceneaxiPurpose: "credit-pack",
          sceneaxiItemId: PACK.packId,
        },
      }),
      store,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_WEBHOOK_PAYLOAD_INVALID" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(creditWebhookHttpStatus(outcome.reason)).toBe(400);
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("refuses a SceneAxi checkout whose intent id is present but empty", async () => {
    // Presence, not validity, decides whether the session is this deployment's: an empty
    // value still claims the checkout, so it must not fall through to the foreign-event
    // acknowledgement.
    const store = webhookStore();
    const outcome = await signedCall({
      payload: eventBody("evt_test_blank_intent", {
        metadata: {
          sceneaxiUserId: "member-1",
          sceneaxiPurpose: "credit-pack",
          sceneaxiItemId: PACK.packId,
          sceneaxiIntentId: "",
        },
      }),
      store,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_WEBHOOK_PAYLOAD_INVALID" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("acknowledges a catalog-listing completion without consulting any adapter", async () => {
    // The reachable half of the same class: a well-formed, signature-verified completion
    // that grants no credits by design. Its intent lives in the revenue-share path's own
    // store and its settlement is still a provider read that can fail, so deciding it
    // after either would turn an event owed nothing into a 503 retried until Stripe gives
    // up. It must mint nothing, read nothing, and not be retried forever.
    const store = webhookStore();
    const outcome = await signedCall({
      payload: listingBody("evt_test_listing"),
      store,
      evidence: unreachableEvidence,
    });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: true,
      reason: "STRIPE_WEBHOOK_EVENT_TYPE_UNSUPPORTED",
    });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("acknowledges a catalog-listing completion whose intent this endpoint never held", async () => {
    // A listing intent is persisted by the revenue-share path's own store, so the credit
    // endpoint's evidence port legitimately answers "nothing here". That absence must not
    // be reported as this deployment's unmet obligation: `STRIPE_CHECKOUT_EVIDENCE_MISSING`
    // answers 503, which Stripe would retry until it gave up, for an event owed no grant.
    const store = webhookStore();
    const outcome = await signedCall({
      payload: listingBody("evt_test_listing_no_intent"),
      store,
      evidence: {
        findIntent() {
          return undefined;
        },
        retrieveSettlement() {
          return undefined;
        },
      },
    });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: true,
      reason: "STRIPE_WEBHOOK_EVENT_TYPE_UNSUPPORTED",
    });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("still refuses a completion whose purpose is not one the contract names", async () => {
    // Routing on the session's purpose may only send a body *away* from the grant path. An
    // unknown value is not a purpose that settles elsewhere — it is a payload fault, and
    // acknowledging it would let a malformed credit-pack completion strand a paid grant.
    const store = webhookStore();
    const outcome = await signedCall({
      payload: eventBody("evt_test_unknown_purpose", {
        metadata: {
          sceneaxiUserId: "member-1",
          sceneaxiPurpose: "creditpack",
          sceneaxiItemId: PACK.packId,
          sceneaxiIntentId: INTENT.intentId,
        },
      }),
      store,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_WEBHOOK_PAYLOAD_INVALID" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("acknowledges a catalog-listing completion even when the buyer has no credit account", async () => {
    // Provisioning credit accounts is the deployment's own store's job, so an unprovisioned
    // buyer is a state this repository cannot fix. Deciding the acknowledgement from the
    // completion's purpose keeps that state out of the answer: an event owed no credits
    // must not become a permanent 503 retry because a ledger it never needed was absent.
    const store = createInMemoryCreditStore();
    const outcome = await signedCall({
      payload: listingBody("evt_test_listing_unprovisioned"),
      store,
      evidence: listingEvidence,
    });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: true,
      reason: "STRIPE_WEBHOOK_EVENT_TYPE_UNSUPPORTED",
    });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("still refuses a signed body that is not a JSON event object", async () => {
    // Acknowledging unhandled events must not become a blanket 2xx: Stripe does not send
    // this, so it is a fault worth surfacing rather than a no-op worth accepting.
    const store = webhookStore();
    const outcome = await signedCall({ payload: "not-json-at-all", store });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_WEBHOOK_PAYLOAD_INVALID" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("grants nothing a second time when Stripe redelivers the same event", async () => {
    const store = webhookStore();
    const payload = eventBody("evt_test_replay");
    await signedCall({ payload, store });
    const again = await signedCall({ payload, store });
    expect(again).toMatchObject({ ok: true, replayed: true, balance: PACK.credits });
    expect(store.entryCount("acct-1")).toBe(1);
  });

  /**
   * A store whose `appendEntry` throws. `persists` decides whether the row is in the
   * ledger anyway — the two outcomes the store reports identically: a redelivery of this
   * same event that another writer already committed, and an append that granted nothing.
   */
  const throwingAppendStore = (persists: boolean) => {
    const inner = webhookStore();
    return Object.freeze({
      ...inner,
      appendEntry(entry: Parameters<typeof inner.appendEntry>[0]) {
        if (persists) inner.appendEntry(entry);
        throw new Error("credit store: sequence 1 already exists for acct-1");
      },
    });
  };

  it("refuses rather than reporting a replay when a failed append left nothing in the ledger", async () => {
    const store = throwingAppendStore(false);
    const outcome = await signedCall({
      payload: eventBody("evt_test_append_lost"),
      store: store as ReturnType<typeof webhookStore>,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "CREDIT_STORE_FAILED" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("reports a replay when a failed append raced a redelivery that did persist the grant", async () => {
    const store = throwingAppendStore(true);
    const outcome = await signedCall({
      payload: eventBody("evt_test_append_raced"),
      store: store as ReturnType<typeof webhookStore>,
    });
    expect(outcome).toMatchObject({ ok: true, replayed: true, balance: PACK.credits });
    expect(store.entryCount("acct-1")).toBe(1);
  });

  it("names the failing step when a store read throws instead of escaping the plane", async () => {
    const inner = webhookStore();
    const throwOn = (method: "findAccountByUserId" | "listEntries") =>
      Object.freeze({
        ...inner,
        [method]() {
          throw new Error(`credit store: ${method} is unreachable`);
        },
      }) as ReturnType<typeof webhookStore>;

    for (const method of ["findAccountByUserId", "listEntries"] as const) {
      const outcome = await signedCall({
        payload: eventBody(`evt_test_read_${method}`),
        store: throwOn(method),
      });
      expect(outcome).toMatchObject({ ok: false, reason: "CREDIT_STORE_FAILED" });
    }
    expect(inner.entryCount("acct-1")).toBe(0);
  });

  it("names the failing step when the checkout evidence adapter throws", async () => {
    const store = webhookStore();
    const payload = eventBody("evt_test_evidence_down");
    const outcome = await applyCreditPackWebhook({
      payload,
      signatureHeader: signStripeWebhookPayload({
        payload,
        secret: TEST_WEBHOOK_SECRET,
        timestamp: Math.floor(NOW / 1000),
      }),
      secret: TEST_WEBHOOK_SECRET,
      store,
      evidence: {
        findIntent() {
          return INTENT;
        },
        retrieveSettlement() {
          throw new Error("stripe: settlement retrieval failed");
        },
      },
      now: NOW,
    });
    expect(outcome).toMatchObject({
      ok: false,
      reason: "STRIPE_CHECKOUT_EVIDENCE_UNAVAILABLE",
    });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("refuses an unsigned body without touching the ledger", async () => {
    const store = webhookStore();
    const outcome = await applyCreditPackWebhook({
      payload: eventBody("evt_test_unsigned"),
      signatureHeader: null,
      secret: TEST_WEBHOOK_SECRET,
      store,
      evidence,
      now: NOW,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_SIGNATURE_HEADER_MISSING" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("refuses a forged signature", async () => {
    const store = webhookStore();
    const payload = eventBody("evt_test_forged");
    const outcome = await applyCreditPackWebhook({
      payload,
      signatureHeader: signStripeWebhookPayload({
        payload,
        secret: "whsec_test_fixture_other",
        timestamp: Math.floor(NOW / 1000),
      }),
      secret: TEST_WEBHOOK_SECRET,
      store,
      evidence,
      now: NOW,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_SIGNATURE_MISMATCH" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("refuses a body altered after signing, because the signature covers raw bytes", async () => {
    const store = webhookStore();
    const signed = eventBody("evt_test_tamper");
    const header = signStripeWebhookPayload({
      payload: signed,
      secret: TEST_WEBHOOK_SECRET,
      timestamp: Math.floor(NOW / 1000),
    });
    const outcome = await applyCreditPackWebhook({
      payload: signed.replace('"member-1"', '"captain"'),
      signatureHeader: header,
      secret: TEST_WEBHOOK_SECRET,
      store,
      evidence,
      now: NOW,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_SIGNATURE_MISMATCH" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("refuses a captured event replayed outside the tolerance window", async () => {
    const store = webhookStore();
    const outcome = await signedCall({
      payload: eventBody("evt_test_stale"),
      store,
      timestamp: Math.floor(NOW / 1000) - 3_600,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_SIGNATURE_TIMESTAMP_STALE" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("refuses when no webhook secret is configured, rather than accepting the event", async () => {
    const store = webhookStore();
    const payload = eventBody("evt_test_nosecret");
    const outcome = await applyCreditPackWebhook({
      payload,
      signatureHeader: signStripeWebhookPayload({
        payload,
        secret: TEST_WEBHOOK_SECRET,
        timestamp: Math.floor(NOW / 1000),
      }),
      secret: undefined,
      store,
      evidence,
      now: NOW,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_WEBHOOK_SECRET_MISSING" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("refuses a signed event whose persisted intent is missing", async () => {
    const store = webhookStore();
    const payload = eventBody("evt_test_nointent");
    const outcome = await applyCreditPackWebhook({
      payload,
      signatureHeader: signStripeWebhookPayload({
        payload,
        secret: TEST_WEBHOOK_SECRET,
        timestamp: Math.floor(NOW / 1000),
      }),
      secret: TEST_WEBHOOK_SECRET,
      store,
      evidence: {
        findIntent() {
          return undefined;
        },
        retrieveSettlement() {
          return SETTLEMENT;
        },
      },
      now: NOW,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_CHECKOUT_EVIDENCE_MISSING" });
    expect(outcome.ok).toBe(false);
    // Nothing about the request is wrong: this deployment's own checkout adapter never
    // persisted the intent the grant must be bound to, so it answers on the server side.
    if (!outcome.ok) expect(creditWebhookHttpStatus(outcome.reason)).toBe(503);
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("refuses an unpaid settlement even with a valid signature and intent", async () => {
    const store = webhookStore();
    const payload = eventBody("evt_test_unpaid");
    const outcome = await applyCreditPackWebhook({
      payload,
      signatureHeader: signStripeWebhookPayload({
        payload,
        secret: TEST_WEBHOOK_SECRET,
        timestamp: Math.floor(NOW / 1000),
      }),
      secret: TEST_WEBHOOK_SECRET,
      store,
      evidence: {
        findIntent: evidence.findIntent,
        retrieveSettlement() {
          return { ...SETTLEMENT, paymentStatus: "unpaid" as const };
        },
      },
      now: NOW,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "STRIPE_WEBHOOK_PAYLOAD_INVALID" });
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("refuses a livemode event, because going live is a separate captain decision", async () => {
    const store = webhookStore();
    const payload = JSON.stringify({
      ...(JSON.parse(eventBody("evt_test_live")) as Record<string, unknown>),
      livemode: true,
    });
    const outcome = await signedCall({ payload, store });
    expect(outcome.ok).toBe(false);
    expect(store.entryCount("acct-1")).toBe(0);
  });
});

describe("acceptance 4 — catalogs accept surface: site principals", () => {
  it("pins the site identity surface", () => {
    expect(CATALOG_IDENTITY_SURFACE).toBe("site");
  });

  it("accepts a site principal through the shared port with an injected adapter", async () => {
    const principal = Object.freeze({
      user: {
        userId: "member-1",
        email: MEMBER_EMAIL,
        emailVerified: true,
        disabled: false,
      },
      role: "user" as const,
      session: {
        sessionId: "sess-member",
        userId: "member-1",
        surface: "site" as const,
        issuedAt: iso(-3_600_000),
        expiresAt: iso(3_600_000),
      },
    });
    const plane = createCatalogIdentityPlane({
      clock,
      adapter: {
        async resolvePrincipal() {
          return { ok: true as const, value: principal };
        },
      },
    });
    expect(plane.wired).toBe(true);
    const viewer = await resolveCatalogViewer(plane, "sess-member.token");
    expect(viewer).toMatchObject({ ok: true, value: { role: "user" } });
  });

  it("refuses a session minted for another surface", async () => {
    const plane = createCatalogIdentityPlane({
      clock,
      adapter: {
        async resolvePrincipal() {
          return {
            ok: true as const,
            value: {
              user: {
                userId: "member-1",
                email: MEMBER_EMAIL,
                emailVerified: true,
                disabled: false,
              },
              role: "user" as const,
              session: {
                sessionId: "sess-shell",
                userId: "member-1",
                surface: "web-shell" as const,
                issuedAt: iso(-3_600_000),
                expiresAt: iso(3_600_000),
              },
            },
          };
        },
      },
    });
    expect(await resolveCatalogViewer(plane, "sess-shell.token")).toMatchObject({
      ok: false,
      reason: "IDENTITY_SESSION_SURFACE_MISMATCH",
    });
  });

  it("refuses a client-claimed role before any adapter is consulted", async () => {
    const plane = createCatalogIdentityPlane({
      adapter: {
        resolvePrincipal() {
          throw new Error("a role claim must never reach the adapter");
        },
      },
    });
    expect(
      await plane.identity.resolvePrincipal({
        surface: "site",
        credentials: { isAdmin: true },
      }),
    ).toMatchObject({ ok: false, reason: "ROLE_CLAIM_FROM_CLIENT_DENIED" });
  });

  it("has no way to ask for the Kids surface, and refuses it if asked", async () => {
    const plane = createCatalogIdentityPlane({
      adapter: {
        resolvePrincipal() {
          throw new Error("Kids must never reach the adapter");
        },
      },
    });
    expect(await plane.identity.resolvePrincipal({ surface: "kids" })).toMatchObject({
      ok: false,
      reason: "KIDS_SURFACE_DENIED",
    });
  });

  it("refuses honestly with no adapter, holding no second auth stack", async () => {
    const plane = createCatalogIdentityPlane();
    expect(plane.wired).toBe(false);
    expect(await resolveCatalogViewer(plane, "sess-member.token")).toMatchObject({
      ok: false,
      reason: "IDENTITY_PLANE_NOT_WIRED",
    });
  });
});

describe("acceptance 5 — an unwired deployment refuses by name", () => {
  it("invents no session, balance, or checkout when nothing is supplied", async () => {
    const plane = createUmbrellaIdentityPlane({});
    expect(plane.wired).toEqual({ identity: false, credits: false, billing: false });
    expect(plane.admin).toBeNull();
    expect(await plane.identity.resolvePrincipal({ surface: "site" })).toMatchObject({
      ok: false,
      reason: "IDENTITY_PLANE_NOT_WIRED",
    });
    expect(await plane.credits.readBalance({ userId: "member-1" })).toMatchObject({
      ok: false,
      reason: "CREDITS_PLANE_NOT_WIRED",
    });
    expect(
      await plane.billing.createCheckout({
        userId: "member-1",
        packId: "pack-any",
        successUrl: "https://sceneaxi-umbrella.vercel.app/account",
        cancelUrl: "https://sceneaxi-umbrella.vercel.app/pricing",
        idempotencyKey: "pack:unwired:1",
      }),
    ).toMatchObject({ ok: false, reason: "IDENTITY_PLANE_NOT_WIRED" });
  });

  it("refuses a checkout with identity wired but no provider round-trip", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: adminWorld(),
      sessionToken: `sess-member.${MEMBER_TOKEN}`,
      clock,
    });
    expect(plane.wired.billing).toBe(false);
    expect(
      await plane.billing.createCheckout({
        userId: "member-1",
        packId: "pack-any",
        successUrl: "https://sceneaxi-umbrella.vercel.app/account",
        cancelUrl: "https://sceneaxi-umbrella.vercel.app/pricing",
        idempotencyKey: "pack:nosessions:1",
      }),
    ).toMatchObject({ ok: false, reason: "BILLING_PLANE_NOT_WIRED" });
  });

  it("reports an identity store failure as unavailable, never as signed out", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: {
        async signIn() {
          throw new Error("unused");
        },
        async verifySession() {
          throw new Error("neon is unreachable");
        },
        async signOut() {
          throw new Error("unused");
        },
      },
      sessionToken: `sess-member.${MEMBER_TOKEN}`,
      clock,
    });
    expect(await plane.identity.resolvePrincipal({ surface: "site" })).toMatchObject({
      ok: false,
      reason: "IDENTITY_PLANE_UNAVAILABLE",
    });
  });

  it("maps every auth refusal onto a named site reason, never onto silence", () => {
    for (const reason of Object.values({
      adapterMissing: "AUTH_ADAPTER_MISSING",
      storeMissing: "AUTH_STORE_MISSING",
      sessionExpired: "AUTH_SESSION_EXPIRED",
      sessionNotFound: "AUTH_SESSION_NOT_FOUND",
      kidsSurfaceDenied: "KIDS_IDENTITY_SURFACE_DENIED",
      roleClaimFromClient: "ROLE_CLAIM_FROM_CLIENT_DENIED",
      userDisabled: "AUTH_USER_DISABLED",
      storeFailed: "AUTH_STORE_FAILED",
    } as const)) {
      expect(typeof siteReasonForAuthReason(reason)).toBe("string");
    }
    expect(siteReasonForAuthReason("KIDS_IDENTITY_SURFACE_DENIED")).toBe("KIDS_SURFACE_DENIED");
    expect(siteReasonForAuthReason("AUTH_STORE_FAILED")).toBe("IDENTITY_PLANE_UNAVAILABLE");
    expect(siteReasonForAuthReason("AUTH_SESSION_NOT_FOUND")).toBe("IDENTITY_SESSION_ABSENT");
  });

  it("reports each billing refusal on the plane that was read, not on the checkout", () => {
    // The pack catalog is a committed contract fixture. An unreadable one is the
    // billing plane being unavailable, which is what the throw path already reports —
    // never a checkout handoff that came back malformed.
    expect(siteReasonForBillingReason("BILLING_CATALOG_INVALID")).toBe(
      "BILLING_PLANE_UNAVAILABLE",
    );
    // Ledger reasons describe the balance wherever they surface.
    for (const reason of [
      "CREDIT_DELTA_SIGN_MISMATCH",
      "CREDIT_AMOUNT_INVALID",
      "CREDIT_ENTRY_INVALID",
      "CREDIT_LEDGER_STATE_INVALID",
    ] as const) {
      expect(siteReasonForBillingReason(reason, "credits")).toBe("CREDIT_ADAPTER_OUTPUT_INVALID");
      expect(siteReasonForBillingReason(reason)).toBe("CREDIT_ADAPTER_OUTPUT_INVALID");
    }
    // `@sceneaxi/billing` raises these from both the ledger and the checkout builder,
    // so the plane the caller was reading decides which one is unavailable.
    expect(siteReasonForBillingReason("CREDIT_CLOCK_INVALID", "credits")).toBe(
      "CREDITS_PLANE_UNAVAILABLE",
    );
    expect(siteReasonForBillingReason("CREDIT_CLOCK_INVALID")).toBe("BILLING_PLANE_UNAVAILABLE");
    expect(siteReasonForBillingReason("CREDIT_REQUEST_INVALID", "credits")).toBe(
      "CREDITS_PLANE_UNAVAILABLE",
    );
    expect(siteReasonForBillingReason("CREDIT_REQUEST_INVALID")).toBe(
      "BILLING_CHECKOUT_REQUEST_INVALID",
    );
    // Nothing read through the credits plane may claim a checkout failed.
    expect(siteReasonForBillingReason("STRIPE_WEBHOOK_PAYLOAD_INVALID", "credits")).toBe(
      "CREDITS_PLANE_UNAVAILABLE",
    );
    // Checkout reasons keep their own plane, and auth reasons still win outright.
    expect(siteReasonForBillingReason("STRIPE_CREDIT_PACK_UNKNOWN")).toBe(
      "BILLING_CHECKOUT_REQUEST_INVALID",
    );
    expect(siteReasonForBillingReason("KIDS_COMMERCE_DENIED")).toBe("KIDS_SURFACE_DENIED");
    expect(siteReasonForBillingReason("AUTH_SESSION_EXPIRED", "credits")).toBe(
      "IDENTITY_SESSION_EXPIRED",
    );
  });
});

describe("acceptance 6 — no secret, no live mode, no Kids", () => {
  it("keeps the deployment handle registry empty in-repo, per ADR 0021", async () => {
    // Nothing in this repository constructs a Neon, Better Auth, or Stripe client, so
    // a plane built with no explicit wiring is unwired for identity and checkout.
    const plane = createUmbrellaIdentityPlane({ SCENEAXI_ADMIN_EMAIL: ADMIN_EMAIL });
    expect(plane.wired.identity).toBe(false);
    expect(plane.wired.billing).toBe(false);
    // The admin *name* is env-derived and needs no provider, so it does resolve.
    expect(plane.admin?.email).toBe(ADMIN_EMAIL);
  });

  it("never mints or accepts a Kids session on any site plane", async () => {
    const umbrella = createUmbrellaIdentityPlane(ENV, {
      identityPort: adminWorld(),
      sessionToken: `sess-admin.${ADMIN_TOKEN}`,
      clock,
    });
    const catalog = createCatalogIdentityPlane();
    for (const port of [umbrella.identity, catalog.identity]) {
      expect(await port.resolvePrincipal({ surface: "kids" })).toMatchObject({
        ok: false,
        reason: "KIDS_SURFACE_DENIED",
      });
    }
  });
});
