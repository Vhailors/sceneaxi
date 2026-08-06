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
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createIdentityPort,
  createInMemoryIdentityStore,
  digestSessionToken,
  resolveAdminIdentity,
  type IdentityAdapter,
} from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  CHECKOUT_METADATA_KEYS,
  createInMemoryCreditStore,
  signStripeWebhookPayload,
  type CheckoutSettlement,
} from "@sceneaxi/billing";
import {
  SITE_STARTER_CREDIT_ALLOTMENT,
  describeSiteAccessState,
} from "@sceneaxi/site-kit";
import {
  CREDIT_WEBHOOK_REASONS,
  applyCreditPackWebhook,
  createUmbrellaIdentityPlane as createIdentityPlaneForTest,
  creditWebhookHttpStatus,
  parseSessionToken,
  performLogin,
  performLogout,
  resolveSessionCookieSecurity,
  resolveUmbrellaEditorAccess,
  siteReasonForAuthReason,
  siteReasonForBillingReason,
  siteReasonForLoginAuthReason,
  umbrellaRequestAuthority,
  verifyLoginRequestOrigin,
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

/** A provider that authenticates nobody, for the session-only worlds below. */
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
const TEST_ADMIN = (() => {
  const result = resolveAdminIdentity(ENV);
  if (!result.ok) throw new Error(`fixture admin unresolved: ${result.reason}`);
  return result.value;
})();

/**
 * Tests supply already-issued evidence to the hermetic plane builder. The production
 * routes do not have this seam: they use the no-argument deployment capability registry.
 */
function createUmbrellaIdentityPlane(
  env: Readonly<Record<string, string | undefined>> = {},
  wiring: Parameters<typeof createIdentityPlaneForTest>[1] = {},
) {
  const admin = env["SCENEAXI_ADMIN_EMAIL"] === ADMIN_EMAIL ? TEST_ADMIN : null;
  return createIdentityPlaneForTest(env, {
    ...wiring,
    admin: wiring.admin === undefined ? admin : wiring.admin,
  });
}

describe("acceptance 1 — admin env login on the umbrella", () => {
  it("resolves the admin role for the session whose user the env names", async () => {
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: adminWorld(),
      sessionToken: `sess-admin.${ADMIN_TOKEN}`,
      clock,
    });
    expect(plane.wired.identity).toBe(true);

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
        appendOrReplayEntry(entry) {
          return { entry, replayed: false };
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
    // The grant path is anchored to the committed archive, so the wiring fixture
    // uses its current starter revision rather than inventing a deployment-local SKU.
    packId: "starter",
    credits: 100,
    unitAmount: 500,
    currency: "usd",
    stripePriceId: "price_test_starter_100",
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

  /** A `charge.refunded` body carrying the PaymentIntent metadata Stripe copies onto it. */
  const refundBody = (
    eventId: string,
    overrides: Readonly<{
      refunded?: boolean;
      amountRefunded?: number;
      intentId?: string;
    }> = {},
  ): string =>
    JSON.stringify({
      id: eventId,
      type: "charge.refunded",
      created: Math.floor(NOW / 1000),
      livemode: false,
      data: {
        object: {
          id: "ch_test_refunded_charge",
          refunded: overrides.refunded ?? true,
          amount_refunded: overrides.amountRefunded ?? PACK.unitAmount,
          currency: PACK.currency,
          metadata: {
            sceneaxiUserId: "member-1",
            sceneaxiPurpose: "credit-pack",
            sceneaxiItemId: PACK.packId,
            sceneaxiIntentId: overrides.intentId ?? INTENT.intentId,
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

  /** The persisted intent a refund is bound to; a refund never reads a settlement. */
  const refundEvidence: WebhookEvidence = Object.freeze({
    findIntent(intentId: string) {
      return intentId === INTENT.intentId ? INTENT : undefined;
    },
    retrieveSettlement(): never {
      throw new Error("a refund must not invent or re-read checkout settlement");
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

  it("refuses an inflated persisted intent before the webhook commit boundary", async () => {
    const store = webhookStore();
    const inflatedIntent = Object.freeze({ ...INTENT, credits: 1_000_000 });
    const inflatedEvidence: WebhookEvidence = Object.freeze({
      findIntent(intentId: string) {
        return intentId === inflatedIntent.intentId ? inflatedIntent : undefined;
      },
      retrieveSettlement(sessionId: string) {
        return sessionId === SESSION_ID ? SETTLEMENT : undefined;
      },
    });
    const outcome = await signedCall({
      payload: eventBody("evt_test_inflated_credits"),
      store,
      evidence: inflatedEvidence,
    });
    expect(outcome).toMatchObject({
      ok: false,
      reason: BILLING_REFUSE_REASONS.catalogRevisionCreditsMismatch,
    });
    if (!outcome.ok) expect(creditWebhookHttpStatus(outcome.reason)).toBe(503);
    expect(store.entryCount("acct-1")).toBe(0);
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
      // An endpoint with no webhook capability wired at all is the extreme case of the
      // same omission, so it is answered here rather than special-cased at the transport.
      CREDIT_WEBHOOK_REASONS.planeNotWired,
      // The commit boundary's own refusals: a failure it names is this deployment's
      // store or this module's request, never anything the inbound bytes decided.
      "CREDIT_REQUEST_INVALID",
      "STRIPE_CHECKOUT_INTENT_INVALID",
      "STRIPE_WEBHOOK_SECRET_MISSING",
      "CREDIT_CLOCK_INVALID",
      "CREDIT_LEDGER_STATE_INVALID",
      "CREDIT_LEDGER_ORDER_INVALID",
      "CREDIT_ENTRY_INVALID",
      "CREDIT_BALANCE_INSUFFICIENT",
      // The bundled credit-pack archive is this deployment's own artifact, and the
      // grant path loads it, so an invalid one is never a bad request from Stripe.
      BILLING_REFUSE_REASONS.catalogInvalid,
      BILLING_REFUSE_REASONS.catalogRevisionUnresolvable,
      BILLING_REFUSE_REASONS.catalogRevisionCreditsMismatch,
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

  it("keeps every acknowledgement closed to the five current decisions", () => {
    // Scan the module's code, never its prose: a doc comment that mentions `ignored(...)`
    // or `ignored: true` must not decide whether this gate passes, in either direction.
    const webhookSource = readFileSync(
      new URL("../../sites/umbrella/src/lib/credit-webhook.ts", import.meta.url),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[^\S\n]*\/\/[^\n]*$/gm, "");

    /** Read one private frozen set literal's member expressions, in source order. */
    const closedSet = (name: string): readonly string[] => {
      const declarations = webhookSource.match(new RegExp(`const\\s+${name}\\b`, "g")) ?? [];
      expect(declarations, `${name} must have exactly one declaration`).toHaveLength(1);
      const frozenSet = webhookSource.match(
        new RegExp(
          `const\\s+${name}\\b[^=]*=\\s*Object\\.freeze\\(\\s*new\\s+Set(?:<[^>]*>)?\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`,
        ),
      );
      expect(frozenSet, `${name} must stay one frozen set literal`).not.toBeNull();
      return (frozenSet?.[1] ?? "")
        .split(",")
        .map((member) => member.trim())
        .filter((member) => member.length > 0)
        .sort();
    };

    // Three decisions are acknowledged for any event: an unhandled type, a purpose that
    // settles on the revenue-share path, and an event with no SceneAxi metadata. The first
    // two share the billing package's unsupported-event reason, so the closed set has
    // exactly these two symbols. Pin the private declaration itself: adding any new member
    // must fail the gate even when no existing behavior fixture happens to exercise it.
    const members = closedSet("UNHANDLED_EVENT_REASONS");
    expect(members, "no acknowledged reason may be added to the closed set").toEqual([
      "BILLING_REFUSE_REASONS.webhookEventTypeUnsupported",
      "CREDIT_WEBHOOK_REASONS.eventUnrelated",
    ]);

    // Two more are acknowledged on the refund path alone, and only because the money is
    // settled: a refund that returns part of the price, and a balance already spent. Both
    // are pinned the same way, and neither may migrate into the set above — that would
    // acknowledge a spent balance for an event that never involved a refund.
    const terminalRefund = closedSet("TERMINAL_REFUND_REASONS");
    expect(
      terminalRefund,
      "no acknowledged refund reason may be added to the closed set",
    ).toEqual([
      "BILLING_REFUSE_REASONS.balanceInsufficient",
      "BILLING_REFUSE_REASONS.refundNotFull",
    ]);
    expect(
      terminalRefund.filter((member) => members.includes(member)),
      "a refund-only acknowledgement must never widen to every event",
    ).toEqual([]);
    // The scoping is what keeps it refund-only, so pin the guard rather than trusting the
    // set's name: the second closed set may be consulted only behind the path check.
    expect(
      webhookSource,
      "TERMINAL_REFUND_REASONS may be consulted only on the refund path",
    ).toContain('path === "refund" && TERMINAL_REFUND_REASONS.has(reason)');
    expect(
      webhookSource.match(/TERMINAL_REFUND_REASONS\.has\b/g) ?? [],
      "the refund-only set must have exactly one consultation",
    ).toHaveLength(1);

    // The closed sets govern only the refusals `settle()` downgrades, so pin the direct
    // acknowledgement call sites too: an `ignored(...)` written beside them would otherwise
    // acknowledge a fault with `200` and stop Stripe from redelivering it. Every reason
    // handed to `ignored` must therefore be either the `settle` parameter routed through
    // the closed sets, or a member expression of the unconditional one.
    const acknowledgements = [...webhookSource.matchAll(/(?<![\w$.])ignored\(([^,]*),/g)].map(
      (match) => (match[1] ?? "").replace(/\s+/g, " ").trim(),
    );
    const routedThroughClosedSet = acknowledgements.filter((reason) => reason === "reason");
    expect(
      routedThroughClosedSet,
      "the closed sets must be consulted by exactly one acknowledgement path",
    ).toHaveLength(1);

    const direct = acknowledgements.filter((reason) => reason !== "reason");
    expect(
      direct.filter((reason) => !members.includes(reason)),
      "a direct acknowledgement may name only a reason the unconditional closed set holds",
    ).toEqual([]);
    expect(
      direct,
      "no acknowledgement path may be added beside the four current ones",
    ).toHaveLength(4);

    // The call sites above are only exhaustive while the helper is the only way to build an
    // acknowledgement. `CreditWebhookOutcome` is a union, so a plain contextually-typed
    // literal would need no helper, no `as const`, and no `Object.freeze` — and would answer
    // Stripe `200` for a fault it never redelivers. `ignored: true` may therefore appear in
    // exactly two places: the union member that declares the shape, and the helper.
    expect(
      webhookSource.match(/ignored:\s*true\b/g) ?? [],
      "an acknowledged outcome may be built only by the one private helper the call sites above pin",
    ).toHaveLength(2);
  });

  it("owns a settlement bound to the wrong session, and still disowns a bad signature", () => {
    // Both sides of the session comparison come from one signature-verified body: this
    // module reads the id out of the verified payload and asks its own retrieveSettlement
    // for that same id. Only the adapter's answer can disagree — including the adapter
    // that has not started echoing sessionId yet — so a 400 would report the deployment's
    // own omission as a bad request from Stripe.
    expect(creditWebhookHttpStatus(BILLING_REFUSE_REASONS.settlementSessionMismatch)).toBe(503);
    // The sender-owned side stays sender-owned: a forged or replayed body never reaches the
    // comparison, and an id the verified body itself omits is a fault of that body.
    expect(creditWebhookHttpStatus(BILLING_REFUSE_REASONS.signatureMismatch)).toBe(400);
    expect(creditWebhookHttpStatus(BILLING_REFUSE_REASONS.checkoutSessionIdMissing)).toBe(400);
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

  it("reconciles a verified full TEST refund as one idempotent append-only adjustment", async () => {
    const store = webhookStore();
    const granted = await signedCall({ payload: eventBody("evt_test_refund_grant"), store });
    expect(granted).toMatchObject({ ok: true, ignored: false, balance: PACK.credits });

    const payload = refundBody("evt_test_refund");
    const outcome = await signedCall({
      payload,
      store,
      evidence: refundEvidence,
    });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: false,
      replayed: false,
      // A reversal states its direction and reports the ledger's own signed delta, so no
      // reader can mistake a refund for a second purchase.
      movement: "refund",
      credits: -PACK.credits,
      balance: 0,
    });
    expect(store.entryCount("acct-1")).toBe(2);

    const replay = await signedCall({ payload, store, evidence: refundEvidence });
    expect(replay).toMatchObject({
      ok: true,
      ignored: false,
      replayed: true,
      movement: "refund",
      credits: -PACK.credits,
      balance: 0,
    });
    expect(store.entryCount("acct-1")).toBe(2);
  });

  it("refuses a refund whose intent id is only a prefix of another grant's intent", async () => {
    const store = webhookStore();
    const granted = await signedCall({ payload: eventBody("evt_test_prefix_grant"), store });
    expect(granted).toMatchObject({ ok: true, ignored: false, movement: "grant" });

    // The readable half of an intent id is derived from a caller-influenced idempotency
    // key, so one id can be a strict prefix of another. A refund for the shorter intent
    // must not claim the longer intent's grant: the ledger holds no grant of its own.
    const prefixIntentId = INTENT.intentId.slice(0, INTENT.intentId.length - 6);
    const prefixIntent = Object.freeze({ ...INTENT, intentId: prefixIntentId });
    expect(INTENT.intentId.startsWith(prefixIntentId)).toBe(true);

    const payload = refundBody("evt_test_prefix_refund", { intentId: prefixIntentId });
    const prefixEvidence: WebhookEvidence = Object.freeze({
      findIntent(intentId: string) {
        return intentId === prefixIntentId ? prefixIntent : undefined;
      },
      retrieveSettlement(): never {
        throw new Error("a refund must not invent or re-read checkout settlement");
      },
    });
    const outcome = await signedCall({ payload, store, evidence: prefixEvidence });
    expect(outcome).toMatchObject({ ok: false, reason: "CREDIT_LEDGER_STATE_INVALID" });
    expect(store.entryCount("acct-1")).toBe(1);
    // A grant that is simply not committed *yet* is the same shape, and its own event may
    // still be in Stripe's retry sequence, so this one stays retryable rather than being
    // acknowledged as settled.
    if (!outcome.ok) expect(creditWebhookHttpStatus(outcome.reason)).toBe(503);
  });

  it("acknowledges a partial refund by name instead of retrying it forever", async () => {
    // A partial refund can never become full on redelivery: the completing refund arrives
    // as its own event with its own body. Refusing it would ask Stripe to redeliver a
    // settled fact until it disabled the endpoint every real grant depends on.
    const store = webhookStore();
    const granted = await signedCall({ payload: eventBody("evt_test_partial_grant"), store });
    expect(granted).toMatchObject({ ok: true, ignored: false, movement: "grant" });

    const outcome = await signedCall({
      payload: refundBody("evt_test_partial_refund", {
        refunded: false,
        amountRefunded: PACK.unitAmount - 1,
      }),
      store,
      evidence: refundEvidence,
    });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: true,
      reason: "STRIPE_REFUND_NOT_FULL",
    });
    // Fail-closed is the point of the acknowledgement, not a casualty of it: the buyer's
    // credits are untouched and no adjustment was appended.
    expect(store.entryCount("acct-1")).toBe(1);

    // The completing full refund is a different event, and it still reconciles.
    const completed = await signedCall({
      payload: refundBody("evt_test_partial_then_full"),
      store,
      evidence: refundEvidence,
    });
    expect(completed).toMatchObject({
      ok: true,
      ignored: false,
      movement: "refund",
      balance: 0,
    });
    expect(store.entryCount("acct-1")).toBe(2);
  });

  it("acknowledges a refund the spent balance cannot absorb, without inventing a negative", async () => {
    const store = webhookStore();
    const granted = await signedCall({ payload: eventBody("evt_test_spent_grant"), store });
    expect(granted).toMatchObject({ ok: true, ignored: false, balance: PACK.credits });

    // The buyer spends what they bought. The ledger is append-only, so no redelivery can
    // make the reversal absorbable — the refund is a money decision the credits cannot
    // follow, and an operator settles it out of band.
    const account = await store.findAccountByUserId("member-1");
    expect(account).toBeDefined();
    if (account === undefined) return;
    const held = await store.listEntries(account.accountId);
    const grant = held.at(-1);
    expect(grant).toBeDefined();
    if (grant === undefined) return;
    await store.appendEntry({
      ...grant,
      entryId: "entry_spent_all",
      sequence: grant.sequence + 1,
      movement: "debit",
      delta: -PACK.credits,
      balanceAfter: 0,
      reason: "hosted ai run",
      idempotencyKey: "hosted-ai:spent-all",
    });

    const outcome = await signedCall({
      payload: refundBody("evt_test_spent_refund"),
      store,
      evidence: refundEvidence,
    });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: true,
      reason: "CREDIT_BALANCE_INSUFFICIENT",
    });
    expect(store.entryCount("acct-1")).toBe(2);
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
   * The D4 invariant: one commit boundary for credits, everywhere.
   *
   * This endpoint used to hand the decided entry to `appendEntry` itself and reconcile a
   * throw by re-reading the ledger, which is a second commit path for the same paid event
   * — exactly what captain decision D4 forbids. `persistCheckoutCompletedGrant` is the
   * only path now, so a store whose `appendEntry` is a trap still grants normally.
   */
  const boundaryOnlyStore = () => {
    const inner = webhookStore();
    return Object.freeze({
      ...inner,
      appendEntry(): never {
        throw new Error(
          "a webhook grant must commit through persistCheckoutCompletedGrant, never appendEntry",
        );
      },
    }) as ReturnType<typeof webhookStore>;
  };

  it("commits a webhook grant only through the credit commit boundary", async () => {
    const store = boundaryOnlyStore();
    const outcome = await signedCall({
      payload: eventBody("evt_test_boundary_only"),
      store,
    });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: false,
      replayed: false,
      credits: PACK.credits,
      balance: PACK.credits,
    });
    expect(store.entryCount("acct-1")).toBe(1);
  });

  /**
   * A store whose commit throws. `persists` decides whether the row landed anyway — the
   * transport failure that loses its answer after the write committed.
   */
  const throwingCommitStore = (persists: boolean) => {
    const inner = webhookStore();
    return Object.freeze({
      ...inner,
      appendOrReplayEntry(entry: Parameters<typeof inner.appendOrReplayEntry>[0]) {
        if (persists) inner.appendEntry(entry);
        throw new Error("credit store: the commit could not be confirmed");
      },
    });
  };

  it("refuses retryably when the boundary could not commit, granting nothing", async () => {
    const store = throwingCommitStore(false);
    const outcome = await signedCall({
      payload: eventBody("evt_test_commit_lost"),
      store: store as ReturnType<typeof webhookStore>,
    });
    expect(outcome).toMatchObject({ ok: false, reason: "CREDIT_STORE_FAILED" });
    expect(creditWebhookHttpStatus("CREDIT_STORE_FAILED")).toBe(503);
    expect(store.entryCount("acct-1")).toBe(0);
  });

  it("never acknowledges an unconfirmed commit, and loses nothing when it did land", async () => {
    // A commit whose answer never arrived is not a 2xx: `ignored: false` means credits
    // are in the ledger, and this call cannot prove that. Answering 503 keeps the event
    // retryable, and the redelivery reads the ledger and answers the replay — which is
    // how the old hand-rolled re-read's guarantee survives with one owner instead of two.
    const store = throwingCommitStore(true);
    const payload = eventBody("evt_test_commit_unconfirmed");
    const unconfirmed = await signedCall({
      payload,
      store: store as ReturnType<typeof webhookStore>,
    });
    expect(unconfirmed).toMatchObject({ ok: false, reason: "CREDIT_STORE_FAILED" });
    expect(store.entryCount("acct-1")).toBe(1);

    const redelivery = await signedCall({
      payload,
      store: store as ReturnType<typeof webhookStore>,
    });
    expect(redelivery).toMatchObject({
      ok: true,
      ignored: false,
      replayed: true,
      credits: PACK.credits,
      balance: PACK.credits,
    });
    expect(store.entryCount("acct-1")).toBe(1);
  });

  it("takes the store's own replay answer when a redelivery committed first", async () => {
    // The race the re-read used to diagnose: another writer committed this same event
    // after this caller read the ledger. `appendOrReplayEntry` answers it directly, so
    // there is nothing left for this module to reconcile.
    const inner = webhookStore();
    const store = Object.freeze({
      ...inner,
      appendOrReplayEntry(entry: Parameters<typeof inner.appendOrReplayEntry>[0]) {
        inner.appendEntry(entry);
        return inner.appendOrReplayEntry(entry);
      },
    }) as ReturnType<typeof webhookStore>;

    const outcome = await signedCall({ payload: eventBody("evt_test_raced"), store });
    expect(outcome).toMatchObject({
      ok: true,
      ignored: false,
      replayed: true,
      credits: PACK.credits,
      balance: PACK.credits,
    });
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
    expect(plane.wired).toEqual({
      identity: false,
      credits: false,
      billing: false,
      login: false,
    });
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
  it("does not turn a caller-supplied environment into deployment authority", async () => {
    // The pure builder may still receive non-authority configuration such as billing
    // mode, but a caller-shaped admin env no longer mints or exposes admin evidence.
    const plane = createIdentityPlaneForTest({ SCENEAXI_ADMIN_EMAIL: ADMIN_EMAIL });
    expect(plane.wired.identity).toBe(false);
    expect(plane.wired.billing).toBe(false);
    expect("admin" in plane).toBe(false);
  });

  it("lets an explicit null admin override deployment-issued evidence", async () => {
    let providerCalls = 0;
    const plane = createUmbrellaIdentityPlane(
      {},
      {
        admin: null,
        deployment: Object.freeze({
          admin: TEST_ADMIN,
          billingMode: "test" as const,
          clock,
          identityPort: adminWorld(),
          checkoutSessions: {
            createCheckoutSession() {
              providerCalls += 1;
              return { redirectUrl: "https://checkout.stripe.test/unreachable" };
            },
          },
        }),
        sessionToken: `sess-admin.${ADMIN_TOKEN}`,
      },
    );

    expect(
      await plane.billing.createCheckout({
        userId: "captain",
        packId: "starter",
        successUrl: "https://sceneaxi-umbrella.vercel.app/account",
        cancelUrl: "https://sceneaxi-umbrella.vercel.app/pricing",
        idempotencyKey: "pack:explicit-null-admin:1",
      }),
    ).toMatchObject({ ok: false, reason: "IDENTITY_PLANE_NOT_WIRED" });
    expect(providerCalls).toBe(0);
  });

  it("keeps production routes on the no-argument deployment capability boundary", () => {
    const identitySource = readFileSync(
      new URL("../../sites/umbrella/src/lib/identity-plane.ts", import.meta.url),
      "utf8",
    );
    const requestAuthoritySource = readFileSync(
      new URL("../../sites/umbrella/src/lib/request-authority.ts", import.meta.url),
      "utf8",
    );
    expect(identitySource).toMatch(/export function umbrellaPlaneHandles\(\)/);
    expect(requestAuthoritySource).toMatch(
      /export function umbrellaRequestAuthority\(\)[\s\S]*const deployment = umbrellaPlaneHandles\(\)/,
    );
    expect(
      [...requestAuthoritySource.matchAll(/^export function (\w+)/gm)].map((match) => match[1]),
    ).toEqual(["umbrellaRequestAuthority"]);
    expect(requestAuthoritySource).not.toMatch(
      /process\.env|resolveAdminIdentity|STRIPE_WEBHOOK_SECRET_ENV|\bsecret\s*:|\bstore\s*:|\bevidence\s*:/,
    );

    for (const path of [
      "../../sites/umbrella/src/app/api/login/route.ts",
      "../../sites/umbrella/src/app/api/logout/route.ts",
      "../../sites/umbrella/src/app/api/checkout/route.ts",
      "../../sites/umbrella/src/app/account/page.tsx",
      "../../sites/umbrella/src/app/editor/page.tsx",
      "../../sites/umbrella/src/app/login/page.tsx",
      "../../sites/umbrella/src/app/pricing/page.tsx",
    ]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("umbrellaRequestAuthority");
      expect(source).not.toContain("/identity-plane.js");
      expect(source).not.toContain("createUmbrellaIdentityPlane");
      expect(source).not.toContain("resolveAdminIdentity");
    }

    const webhookRoute = readFileSync(
      new URL("../../sites/umbrella/src/app/api/stripe/webhook/route.ts", import.meta.url),
      "utf8",
    );
    expect(webhookRoute).toContain("umbrellaRequestAuthority().applyCreditWebhook(");
    expect(webhookRoute).not.toContain("/identity-plane.js");
    expect(webhookRoute).not.toContain("/credit-webhook.js");
    expect(webhookRoute).not.toMatch(
      /process\.env|STRIPE_WEBHOOK_SECRET_ENV|applyCreditPackWebhook|\bsecret\s*:|\bstore\s*:|\bevidence\s*:/,
    );
  });

  it("refuses a webhook on an unwired deployment as that deployment's own omission", async () => {
    // The facade is the only thing between the transport and a capability a deployment
    // may never have provisioned, and it is now the only owner of that answer: the route
    // no longer special-cases the status. An operator who wired no provider must be told
    // the endpoint could not act, never that Stripe sent a bad request.
    const providerEnv = ["DATABASE_URL", "STRIPE_SECRET_KEY"];
    const saved = providerEnv.map((name) => [name, process.env[name]] as const);
    for (const name of providerEnv) Reflect.deleteProperty(process.env, name);
    try {
      const outcome = await umbrellaRequestAuthority().applyCreditWebhook({
        payload: '{"type":"checkout.session.completed"}',
        signatureHeader: null,
      });
      expect(outcome).toMatchObject({
        ok: false,
        reason: CREDIT_WEBHOOK_REASONS.planeNotWired,
      });
      expect(outcome).not.toHaveProperty("response");
      if (!outcome.ok) expect(creditWebhookHttpStatus(outcome.reason)).toBe(503);
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) Reflect.deleteProperty(process.env, name);
        else process.env[name] = value;
      }
    }
  });

  it("keeps environment and provider I/O out of the hermetic auth and billing roots", () => {
    const sources = ["auth", "billing"].flatMap((name) => {
      const directory = new URL(`../../packages/${name}/src/`, import.meta.url);
      return readdirSync(directory)
        .filter((entry) => entry.endsWith(".ts"))
        .map((entry) => readFileSync(new URL(entry, directory), "utf8"));
    });
    const source = sources.join("\n");
    expect(source).not.toMatch(/\bprocess\.env(?:\.|\[)/);
    expect(source).not.toMatch(/from\s+["'](?:stripe|@neondatabase\/serverless)["']/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
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

describe("hosted login — the umbrella sign-in path (sceneaxi#185)", () => {
  const MEMBER_PASSWORD = "fixture-correct-password";
  const FRESH_TOKEN = "fresh-login-token";
  const LOGIN_SESSION = "sess-fresh";

  /**
   * The origin proof a submission from this deployment's own form carries.
   *
   * Every `performLogin` / `performLogout` call takes one, because the argument
   * is required: a route that never verified where a submission came from
   * cannot call either entry point at all.
   */
  const originProof = (
    env: Readonly<Record<string, string | undefined>>,
    origin: string,
  ) => verifyLoginRequestOrigin(env, { origin, requestUrl: `${origin}/api/login` });
  const SAME_ORIGIN = originProof(ENV, "http://localhost:3000");
  const httpsOrigin = originProof(
    { ...ENV, NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "https://sceneaxi.example" },
    "https://sceneaxi.example",
  );
  /** What a cross-site page's auto-submitted form actually arrives as. */
  const CROSS_ORIGIN = verifyLoginRequestOrigin(ENV, {
    origin: "https://attacker.example",
    fetchSite: "cross-site",
    requestUrl: "http://localhost:3000/api/login",
  });

  it("keeps request signals in the framework adapter and rejects before request data", () => {
    const sessionSource = readFileSync(
      new URL("../../sites/umbrella/src/app/_session.ts", import.meta.url),
      "utf8",
    );
    const loginSource = readFileSync(
      new URL("../../sites/umbrella/src/app/api/login/route.ts", import.meta.url),
      "utf8",
    );
    const logoutSource = readFileSync(
      new URL("../../sites/umbrella/src/app/api/logout/route.ts", import.meta.url),
      "utf8",
    );

    expect(sessionSource).toContain("readSiteMutationRequestSignals");
    expect(sessionSource).toContain('request.headers.get("origin")');
    expect(sessionSource).toContain('request.headers.get("x-forwarded-proto")');
    for (const routeSource of [loginSource, logoutSource]) {
      expect(routeSource).not.toContain("request.headers.get(");
      expect(routeSource.indexOf("if (!requestOrigin.ok)")).toBeGreaterThan(-1);
    }
    expect(loginSource.indexOf("if (!requestOrigin.ok)")).toBeLessThan(
      loginSource.indexOf("request.formData()"),
    );
    expect(logoutSource.indexOf("if (!requestOrigin.ok)")).toBeLessThan(
      logoutSource.indexOf("readSessionToken()"),
    );
  });

  /**
   * A Better Auth-shaped provider over the same fixture users: the documented
   * `{ user, session }` envelope, a fresh session per successful authentication,
   * and `undefined` — not a throw — for a wrong password.
   */
  const provider = (email: string, userId: string): IdentityAdapter =>
    Object.freeze({
      authenticate(credentials: { email: string; password: string }) {
        if (credentials.email !== email || credentials.password !== MEMBER_PASSWORD) {
          return undefined;
        }
        return {
          user: { id: userId, email, emailVerified: true },
          session: {
            id: LOGIN_SESSION,
            token: FRESH_TOKEN,
            userId,
            expiresAt: iso(3_600_000),
          },
        };
      },
    });

  const loginWorld = (overrides: Record<string, unknown> = {}) => {
    const admin = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: ADMIN_EMAIL });
    if (!admin.ok) throw new Error(`admin unresolved: ${admin.message}`);
    const store = createInMemoryIdentityStore({
      users: [user("member-1", MEMBER_EMAIL, overrides)] as never,
      sessions: [] as never,
    });
    const port = createIdentityPort({
      adapter: provider(MEMBER_EMAIL, "member-1"),
      store,
      admin: admin.value,
      clock,
    });
    return { store, port };
  };

  it("signs in through the real port and reaches the entitled editor", async () => {
    const { store, port } = loginWorld();
    const creditStore = createInMemoryCreditStore({
      accounts: [account("acct-1", "member-1")] as never,
    });
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: port,
      creditStore,
      clock,
    });
    expect(plane.wired.login).toBe(true);

    // 1. The form submission authenticates through the injected provider.
    const outcome = await performLogin({
      requestOrigin: SAME_ORIGIN,
      plane,
      fields: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD },
      secure: true,
    });
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.location).toBe("/account");
    expect(outcome.principal.role).toBe("user");
    expect(outcome.setCookie).toContain(`sceneaxi.session=${LOGIN_SESSION}.${FRESH_TOKEN}`);
    expect(outcome.setCookie).toContain("HttpOnly");
    expect(outcome.setCookie).toContain("SameSite=Lax");
    expect(outcome.setCookie).toContain("Secure");
    // The store holds the digest, never the redeemable token.
    expect(store.sessionCount()).toBe(1);
    const stored = await store.findSession(LOGIN_SESSION);
    expect(stored?.tokenDigest).toBe(digestSessionToken(FRESH_TOKEN));
    expect(JSON.stringify(stored)).not.toContain(FRESH_TOKEN);

    // 2. The cookie's credential is the one the verify path reads back.
    const credential = `${LOGIN_SESSION}.${FRESH_TOKEN}`;
    expect(parseSessionToken(credential)).toEqual({
      sessionId: LOGIN_SESSION,
      token: FRESH_TOKEN,
    });

    // 3. A later request carrying that credential reaches the editor
    //    entitlement guard as a server-verified principal and is entitled by
    //    the starter allotment — the guard, not the login, decides.
    const laterPlane = createUmbrellaIdentityPlane(ENV, {
      identityPort: port,
      creditStore,
      sessionToken: credential,
      clock,
    });
    const access = await resolveUmbrellaEditorAccess({
      plane: laterPlane,
      env: ENV,
      sessionToken: credential,
    });
    expect(access.decision).toMatchObject({ granted: true, mode: "entitled" });
    expect(access.access.principal?.user.userId).toBe("member-1");
  });

  it("refuses a session id the cookie credential cannot carry back, rather than minting a dead cookie", async () => {
    // The provider's identifier rules allow a dot inside a session id, and the
    // cookie credential is read back by splitting on its first dot — so this
    // session id is unrepresentable and must fail closed by name at issuance.
    const admin = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: ADMIN_EMAIL });
    if (!admin.ok) throw new Error(`admin unresolved: ${admin.message}`);
    const dotted: IdentityAdapter = Object.freeze({
      authenticate(credentials: { email: string; password: string }) {
        if (credentials.email !== MEMBER_EMAIL || credentials.password !== MEMBER_PASSWORD) {
          return undefined;
        }
        return {
          user: { id: "member-1", email: MEMBER_EMAIL, emailVerified: true },
          session: {
            id: "sess.a1",
            token: FRESH_TOKEN,
            userId: "member-1",
            expiresAt: iso(3_600_000),
          },
        };
      },
    });
    const port = createIdentityPort({
      adapter: dotted,
      store: createInMemoryIdentityStore({
        users: [user("member-1", MEMBER_EMAIL)] as never,
        sessions: [] as never,
      }),
      admin: admin.value,
      clock,
    });
    const plane = createUmbrellaIdentityPlane(ENV, { identityPort: port, clock });

    expect(parseSessionToken(`sess.a1.${FRESH_TOKEN}`)).toEqual({
      sessionId: "sess",
      token: `a1.${FRESH_TOKEN}`,
    });
    const outcome = await performLogin({
      requestOrigin: SAME_ORIGIN,
      plane,
      fields: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD },
      secure: true,
    });
    expect(outcome).toMatchObject({
      kind: "refused",
      reason: "LOGIN_SESSION_NOT_ISSUED",
    });
    // The visitor presented no credential here, so the state the form renders
    // must be the deployment's own fault, with no sign-in action to loop on.
    const rendered = describeSiteAccessState("LOGIN_SESSION_NOT_ISSUED");
    expect(rendered.key).toBe("sign-in-not-issued");
    expect(rendered.action).toBeNull();
  });

  it("names a provider fault at issuance as one, never as a credential this browser presented", async () => {
    const admin = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: ADMIN_EMAIL });
    if (!admin.ok) throw new Error(`admin unresolved: ${admin.message}`);

    // 1. Clock skew: the provider authenticates and hands back a session that has
    //    already run out, so the port refuses the envelope. Read through the verify
    //    mapping this was `IDENTITY_ADAPTER_OUTPUT_INVALID`, whose state tells the
    //    visitor the credential their browser presented was discarded — but no
    //    browser presented one, and signing in again reaches the same fault.
    const skewed: IdentityAdapter = Object.freeze({
      authenticate(credentials: { email: string; password: string }) {
        if (credentials.email !== MEMBER_EMAIL || credentials.password !== MEMBER_PASSWORD) {
          return undefined;
        }
        return {
          user: { id: "member-1", email: MEMBER_EMAIL, emailVerified: true },
          session: {
            id: LOGIN_SESSION,
            token: FRESH_TOKEN,
            userId: "member-1",
            expiresAt: iso(-1_000),
          },
        };
      },
    });
    const skewedPlane = createUmbrellaIdentityPlane(ENV, {
      identityPort: createIdentityPort({
        adapter: skewed,
        store: createInMemoryIdentityStore({
          users: [user("member-1", MEMBER_EMAIL)] as never,
          sessions: [] as never,
        }),
        admin: admin.value,
        clock,
      }),
      clock,
    });
    expect(
      await performLogin({
        requestOrigin: SAME_ORIGIN,
        plane: skewedPlane,
        fields: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD },
        secure: true,
      }),
    ).toMatchObject({ kind: "refused", reason: "LOGIN_SESSION_NOT_ISSUED" });

    // 2. The provider authenticates an address this deployment's store has no user
    //    record for. Read through the verify mapping this was
    //    `IDENTITY_SESSION_ABSENT`, so a failed sign-in rendered "you are signed
    //    out → Sign in" and looped the visitor back onto the form they just used.
    const unprovisioned = createUmbrellaIdentityPlane(ENV, {
      identityPort: createIdentityPort({
        adapter: provider(MEMBER_EMAIL, "member-1"),
        store: createInMemoryIdentityStore({ users: [] as never, sessions: [] as never }),
        admin: admin.value,
        clock,
      }),
      clock,
    });
    const outcome = await performLogin({
      requestOrigin: SAME_ORIGIN,
      plane: unprovisioned,
      fields: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD },
      secure: true,
    });
    expect(outcome).toMatchObject({ kind: "refused", reason: "LOGIN_SESSION_NOT_ISSUED" });
    expect(describeSiteAccessState("LOGIN_SESSION_NOT_ISSUED").action).toBeNull();

    // The mapping renames only what cannot be true at issuance. Everything equally
    // true on both paths keeps its own name, so the issuance path gains no second
    // vocabulary to drift from the registry.
    expect(siteReasonForLoginAuthReason("AUTH_CREDENTIALS_REJECTED")).toBe(
      "LOGIN_CREDENTIALS_REJECTED",
    );
    for (const reason of [
      "AUTH_USER_NOT_FOUND",
      "AUTH_SESSION_NOT_FOUND",
      "AUTH_ADAPTER_ENVELOPE_INVALID",
      "AUTH_SESSION_EXPIRED",
    ] as const) {
      expect(siteReasonForLoginAuthReason(reason)).toBe("LOGIN_SESSION_NOT_ISSUED");
    }
    for (const reason of [
      "KIDS_IDENTITY_SURFACE_DENIED",
      "ROLE_CLAIM_FROM_CLIENT_DENIED",
      "AUTH_USER_DISABLED",
      "AUTH_ADAPTER_MISSING",
      "AUTH_STORE_FAILED",
    ] as const) {
      expect(siteReasonForLoginAuthReason(reason)).toBe(siteReasonForAuthReason(reason));
    }
  });

  it("refuses wrong credentials as their own named outcome, back at the form", async () => {
    const { port } = loginWorld();
    const plane = createUmbrellaIdentityPlane(ENV, { identityPort: port, clock });
    const outcome = await performLogin({
      requestOrigin: SAME_ORIGIN,
      plane,
      fields: { email: MEMBER_EMAIL, password: "wrong" },
      secure: true,
    });
    expect(outcome).toMatchObject({
      kind: "refused",
      reason: "LOGIN_CREDENTIALS_REJECTED",
      location: "/login?reason=LOGIN_CREDENTIALS_REJECTED",
    });
  });

  it("refuses an empty submission before the provider is consulted", async () => {
    let consulted = false;
    const spy: IdentityAdapter = Object.freeze({
      authenticate() {
        consulted = true;
        return undefined;
      },
    });
    const admin = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: ADMIN_EMAIL });
    if (!admin.ok) throw new Error("admin unresolved");
    const port = createIdentityPort({
      adapter: spy,
      store: createInMemoryIdentityStore({ users: [] as never }),
      admin: admin.value,
      clock,
    });
    const plane = createUmbrellaIdentityPlane(ENV, { identityPort: port, clock });
    const outcome = await performLogin({
      requestOrigin: SAME_ORIGIN,
      plane,
      fields: { email: "", password: "" },
      secure: true,
    });
    expect(outcome).toMatchObject({
      kind: "refused",
      reason: "LOGIN_CREDENTIALS_REQUIRED",
    });
    expect(consulted).toBe(false);
  });

  it("refuses a disabled user with the named outcome even on a correct password", async () => {
    const { port } = loginWorld({ disabled: true });
    const plane = createUmbrellaIdentityPlane(ENV, { identityPort: port, clock });
    const login = await plane.login.signIn({
      surface: "site",
      email: MEMBER_EMAIL,
      password: MEMBER_PASSWORD,
    });
    expect(login).toMatchObject({ ok: false, reason: "IDENTITY_USER_DISABLED" });
  });

  it("refuses the Kids surface and a client role claim before any dispatch", async () => {
    const { port } = loginWorld();
    const plane = createUmbrellaIdentityPlane(ENV, { identityPort: port, clock });
    expect(
      await plane.login.signIn({
        surface: "kids",
        email: MEMBER_EMAIL,
        password: MEMBER_PASSWORD,
      }),
    ).toMatchObject({ ok: false, reason: "KIDS_SURFACE_DENIED" });
    expect(
      await plane.login.signIn({
        surface: "site",
        email: MEMBER_EMAIL,
        password: MEMBER_PASSWORD,
        role: "admin",
      } as never),
    ).toMatchObject({ ok: false, reason: "ROLE_CLAIM_FROM_CLIENT_DENIED" });
  });

  it("names an unwired deployment and a failed provider distinctly", async () => {
    const unwired = createUmbrellaIdentityPlane(ENV, { clock });
    expect(unwired.wired.login).toBe(false);
    expect(
      await unwired.login.signIn({
        surface: "site",
        email: MEMBER_EMAIL,
        password: MEMBER_PASSWORD,
      }),
    ).toMatchObject({ ok: false, reason: "IDENTITY_PLANE_NOT_WIRED" });

    const admin = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: ADMIN_EMAIL });
    if (!admin.ok) throw new Error("admin unresolved");
    const broken = createIdentityPort({
      adapter: Object.freeze({
        authenticate(): never {
          throw new Error("provider down");
        },
      }),
      store: createInMemoryIdentityStore({ users: [user("member-1", MEMBER_EMAIL)] as never }),
      admin: admin.value,
      clock,
    });
    const plane = createUmbrellaIdentityPlane(ENV, { identityPort: broken, clock });
    expect(
      await plane.login.signIn({
        surface: "site",
        email: MEMBER_EMAIL,
        password: MEMBER_PASSWORD,
      }),
    ).toMatchObject({ ok: false, reason: "IDENTITY_PLANE_UNAVAILABLE" });
  });

  it("confines the post-login destination to a same-site relative path", async () => {
    const { port } = loginWorld();
    const plane = createUmbrellaIdentityPlane(ENV, { identityPort: port, clock });
    for (const hostile of [
      "https://evil.example",
      "//evil.example",
      "/path\\evil",
      "javascript:alert(1)",
      "  /spaced path",
    ]) {
      const outcome = await performLogin({
        requestOrigin: SAME_ORIGIN,
        plane,
        fields: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD, next: hostile },
        secure: true,
      });
      expect(outcome.kind).toBe("success");
      if (outcome.kind === "success") expect(outcome.location).toBe("/account");
    }
    const kept = await performLogin({
      requestOrigin: SAME_ORIGIN,
      plane,
      fields: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD, next: "/editor" },
      secure: true,
    });
    expect(kept.kind === "success" && kept.location).toBe("/editor");
  });

  it("signs out: the stored session is deleted and the cookie cleared", async () => {
    const { store, port } = loginWorld();
    const plane = createUmbrellaIdentityPlane(ENV, { identityPort: port, clock });
    const login = await plane.login.signIn({
      surface: "site",
      email: MEMBER_EMAIL,
      password: MEMBER_PASSWORD,
    });
    expect(login.ok).toBe(true);
    if (!login.ok) return;
    expect(store.sessionCount()).toBe(1);

    const boundPlane = createUmbrellaIdentityPlane(ENV, {
      identityPort: port,
      sessionToken: login.value.sessionCredential,
      clock,
    });
    const outcome = await performLogout({
      plane: boundPlane,
      requestOrigin: SAME_ORIGIN,
      secure: true,
    });
    expect(outcome.kind).toBe("signed-out");
    if (outcome.kind !== "signed-out") return;
    expect(outcome.revocation).toMatchObject({ ok: true, value: null });
    expect(outcome.clearCookie).toContain("sceneaxi.session=;");
    expect(outcome.clearCookie).toContain("Max-Age=0");
    expect(store.sessionCount()).toBe(0);

    // The deleted credential is now simply signed out, not an error.
    expect(
      await boundPlane.identity.resolvePrincipal({
        surface: "site",
        sessionToken: login.value.sessionCredential,
      }),
    ).toMatchObject({ ok: false, reason: "IDENTITY_SESSION_ABSENT" });
  });

  it("signs out a credential that no longer names a session as already signed out", async () => {
    const { port } = loginWorld();
    const plane = createUmbrellaIdentityPlane(ENV, {
      identityPort: port,
      sessionToken: "sess-gone.some-token",
      clock,
    });
    const outcome = await performLogout({
      plane,
      requestOrigin: SAME_ORIGIN,
      secure: false,
    });
    expect(outcome.kind).toBe("signed-out");
    if (outcome.kind !== "signed-out") return;
    expect(outcome.revocation).toMatchObject({ ok: true, value: null });
    expect(outcome.clearCookie).not.toContain("Secure");
  });

  it("stamps Secure from the configured origin, so a TLS-terminating proxy cannot strip it", async () => {
    const httpsEnv = {
      ...ENV,
      NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "https://sceneaxi.example",
    };
    // What the app itself sees behind the proxy: plain http, private address.
    const proxied = {
      forwardedProto: "http",
      requestUrl: "http://10.0.0.4:3000/api/login",
    };
    expect(resolveSessionCookieSecurity(httpsEnv, proxied)).toBe(true);
    // An unconfigured local deployment is still allowed to run over http.
    expect(
      resolveSessionCookieSecurity(ENV, { requestUrl: "http://localhost:3000/api/login" }),
    ).toBe(false);

    const { port } = loginWorld();
    const plane = createUmbrellaIdentityPlane(httpsEnv, { identityPort: port, clock });
    const outcome = await performLogin({
      requestOrigin: httpsOrigin,
      plane,
      fields: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD },
      secure: resolveSessionCookieSecurity(httpsEnv, proxied),
    });
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.setCookie).toContain("Secure");

    const signedOut = await performLogout({
      requestOrigin: httpsOrigin,
      plane,
      secure: resolveSessionCookieSecurity(httpsEnv, proxied),
    });
    expect(signedOut.kind === "signed-out" && signedOut.clearCookie).toContain("Secure");
  });

  it("refuses a submission from another site before either plane is reached", async () => {
    const { store, port } = loginWorld();
    const plane = createUmbrellaIdentityPlane(ENV, { identityPort: port, clock });

    // 1. A cross-site page auto-submits its own credentials. Nothing is
    //    authenticated, so no session exists and no `Set-Cookie` is handed back
    //    for the browser to store — which is the whole attack: `SameSite=Lax`
    //    withholds nothing from a POST that carries no cookie yet.
    const forgedLogin = await performLogin({
      plane,
      requestOrigin: CROSS_ORIGIN,
      fields: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD, next: "/editor" },
      secure: true,
    });
    expect(forgedLogin).toEqual({
      kind: "refused",
      reason: "SITE_REQUEST_CROSS_ORIGIN",
      location: "/login?reason=SITE_REQUEST_CROSS_ORIGIN",
    });
    expect(store.sessionCount()).toBe(0);

    // 2. The same refusal is decided before a single submitted field is read,
    //    so the attacker's `next` cannot even choose where the redirect lands.
    expect(forgedLogin.kind === "refused" && forgedLogin.location).not.toContain("editor");

    // 3. The visitor's own sign-in still works, and the forced sign-out that
    //    mirrors the attack revokes nothing and clears nothing.
    const signedIn = await performLogin({
      plane,
      requestOrigin: SAME_ORIGIN,
      fields: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD },
      secure: true,
    });
    expect(signedIn.kind).toBe("success");
    expect(store.sessionCount()).toBe(1);

    const boundPlane = createUmbrellaIdentityPlane(ENV, {
      identityPort: port,
      sessionToken: `${LOGIN_SESSION}.${FRESH_TOKEN}`,
      clock,
    });
    const forcedLogout = await performLogout({
      plane: boundPlane,
      requestOrigin: CROSS_ORIGIN,
      secure: true,
    });
    expect(forcedLogout).toEqual({
      kind: "refused",
      reason: "SITE_REQUEST_CROSS_ORIGIN",
      location: "/login?reason=SITE_REQUEST_CROSS_ORIGIN",
    });
    expect(store.sessionCount()).toBe(1);

    // 4. What the visitor is told names the attempt for what it was, and offers
    //    nothing to retry.
    const rendered = describeSiteAccessState("SITE_REQUEST_CROSS_ORIGIN");
    expect(rendered.key).toBe("cross-origin");
    expect(rendered.action).toBeNull();
  });
});
