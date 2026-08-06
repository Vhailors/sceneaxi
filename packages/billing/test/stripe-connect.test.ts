import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  digestSessionToken,
  resolveAdminIdentity,
} from "@sceneaxi/auth";
import { issuePrincipalForTest } from "@sceneaxi/auth/testing/principal-issuance";
import type { MoneySplitRecord } from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  createInMemoryConnectStore,
  refreshConnectStatus,
  requestCreatorPayout,
  startConnectOnboarding,
  type ConnectProviderReadiness,
  type StripeConnectProvider,
} from "@sceneaxi/billing";

const NOW = Date.parse("2026-08-06T10:00:00Z");
const CREATOR_ID = "usr_creator";
const adminResolution = resolveAdminIdentity({
  [ADMIN_EMAIL_ENV_VAR]: "captain@example.com",
});
if (!adminResolution.ok) throw new Error(adminResolution.message);
const admin = adminResolution.value;

const principal = (userId = CREATOR_ID) =>
  issuePrincipalForTest({
    user: {
      schemaVersion: 1,
      kind: "sceneaxi.user",
      userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      disabled: false,
      createdAt: "2026-08-06T08:00:00Z",
    },
    role: {
      schemaVersion: 1,
      kind: "sceneaxi.role-assignment",
      userId,
      role: "user",
      source: "default-user",
      assignedAt: "2026-08-06T08:00:00Z",
    },
    session: {
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: `ses_${userId}`,
      userId,
      surface: "site",
      issuedAt: "2026-08-06T08:00:00Z",
      expiresAt: "2026-08-07T10:00:00Z",
      tokenDigest: digestSessionToken(`token_${userId}`),
    },
  });

const split = (overrides: Partial<MoneySplitRecord> = {}): MoneySplitRecord =>
  Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.money-split-record",
    saleId: "sale_connect_01",
    listingId: "harbour-diorama",
    buyerUserId: "usr_buyer",
    creatorUserId: CREATOR_ID,
    grossMinor: 2501,
    creatorMinor: 1250,
    platformMinor: 1251,
    currency: "usd",
    basisPoints: 5000,
    mode: "test",
    occurredAt: "2026-08-06T09:59:00Z",
    ...overrides,
  });

const ready: ConnectProviderReadiness = Object.freeze({
  mode: "test",
  testOperationsEnabled: true,
  dashboardConfigured: true,
  secretConfigured: true,
});

const providerFixture = (
  overrides: Partial<StripeConnectProvider> = {},
) => {
  const calls = { onboarding: 0, status: 0, payout: 0 };
  const provider: StripeConnectProvider = Object.freeze({
    readiness: ready,
    createOnboarding: () => {
      calls.onboarding += 1;
      return {
        ok: true as const,
        value: {
          stripeAccountId: "acct_test_creator",
          onboardingUrl: "https://connect.stripe.example/test/onboard",
          expiresAt: "2026-08-06T11:00:00Z",
          accountRequestId: "req_account_01",
          accountCreatedAt: "2026-08-06T09:59:00Z",
          onboardingRequestId: "req_onboarding_01",
          onboardingCreatedAt: "2026-08-06T10:00:00Z",
        },
      };
    },
    retrieveStatus: () => {
      calls.status += 1;
      return {
        ok: true as const,
        value: {
          stripeAccountId: "acct_test_creator",
          onboardingComplete: true,
          payoutsEnabled: true,
          requirementsDue: [],
          requestId: "req_status_01",
          observedAt: "2026-08-06T10:05:00Z",
        },
      };
    },
    createPayout: () => {
      calls.payout += 1;
      return {
        ok: true as const,
        value: {
          payoutId: "po_test_01",
          evidenceId: "evt_payout_paid_01",
          message: "paid in Stripe TEST mode",
          paidAt: "2026-08-06T10:10:00Z",
        },
      };
    },
    ...overrides,
  });
  return { calls, provider };
};

const onboardingRequest = (
  store: ReturnType<typeof createInMemoryConnectStore>,
  provider: StripeConnectProvider | undefined,
  overrides: Record<string, unknown> = {},
) => ({
  principal: principal(),
  admin,
  creatorUserId: CREATOR_ID,
  idempotencyKey: "connect-onboarding:usr_creator",
  now: NOW,
  store,
  provider,
  surface: "site" as const,
  ...overrides,
});

async function readyStore(provider: StripeConnectProvider) {
  const store = createInMemoryConnectStore();
  const onboarded = await startConnectOnboarding(
    onboardingRequest(store, provider),
  );
  if (!onboarded.ok) throw new Error(onboarded.message);
  const status = await refreshConnectStatus({
    principal: principal(),
    admin,
    creatorUserId: CREATOR_ID,
    now: NOW,
    store,
    provider,
    surface: "site",
  });
  if (!status.ok) throw new Error(status.message);
  return store;
}

describe("Stripe Connect TEST onboarding", () => {
  it("authenticates ownership and refuses copied or other-user principals", async () => {
    const { provider } = providerFixture();
    const store = createInMemoryConnectStore();
    const copied = { ...(principal() as object) };
    const unproven = await startConnectOnboarding(
      onboardingRequest(store, provider, { principal: copied }),
    );
    expect(unproven).toMatchObject({ ok: false, reason: "AUTH_PRINCIPAL_UNPROVEN" });

    const other = await startConnectOnboarding(
      onboardingRequest(store, provider, { principal: principal("usr_other") }),
    );
    expect(other).toMatchObject({
      ok: false,
      reason: BILLING_REFUSE_REASONS.accountNotOwned,
    });
    expect(store.accountCount()).toBe(0);
  });

  it("creates an auditable intent and replays through the provider idempotency key", async () => {
    const { calls, provider } = providerFixture();
    const store = createInMemoryConnectStore();
    const first = await startConnectOnboarding(onboardingRequest(store, provider));
    const retry = await startConnectOnboarding(onboardingRequest(store, provider));
    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);
    if (!first.ok || !retry.ok) return;
    expect(first.value.onboardingUrl).toMatch(/^https:\/\//);
    expect(retry.value.onboardingUrl).toBe(first.value.onboardingUrl);
    expect(retry.value.replayed).toBe(true);
    expect(retry.value.intent).toEqual(first.value.intent);
    expect(calls.onboarding).toBe(2);
    expect(store.accountCount()).toBe(1);
    expect(store.onboardingIntentCount()).toBe(1);
  });

  it.each([
    [undefined, BILLING_REFUSE_REASONS.connectProviderMissing],
    [{ ...ready, mode: "live" }, BILLING_REFUSE_REASONS.connectLiveUnavailable],
    [{ ...ready, testOperationsEnabled: false }, BILLING_REFUSE_REASONS.connectTestOperationsDisabled],
    [{ ...ready, dashboardConfigured: false }, BILLING_REFUSE_REASONS.connectDashboardMissing],
    [{ ...ready, secretConfigured: false }, BILLING_REFUSE_REASONS.connectSecretMissing],
  ] as const)("fails closed for readiness %#", async (readiness, reason) => {
    const fixture = providerFixture(
      readiness === undefined ? {} : { readiness },
    );
    const result = await startConnectOnboarding(
      onboardingRequest(
        createInMemoryConnectStore(),
        readiness === undefined ? undefined : fixture.provider,
      ),
    );
    expect(result).toMatchObject({ ok: false, reason });
    expect(fixture.calls.onboarding).toBe(0);
  });

  it("surfaces provider refusal and records no account", async () => {
    const fixture = providerFixture({
      createOnboarding: () => ({
        ok: false,
        code: "account_rejected",
        message: "provider declined account creation",
      }),
    });
    const store = createInMemoryConnectStore();
    const result = await startConnectOnboarding(onboardingRequest(store, fixture.provider));
    expect(result).toMatchObject({
      ok: false,
      reason: BILLING_REFUSE_REASONS.connectProviderRefused,
    });
    expect(store.accountCount()).toBe(0);
  });
});

describe("Stripe Connect status and payout evidence", () => {
  it("appends idempotent provider status observations", async () => {
    const { provider } = providerFixture();
    const store = await readyStore(provider);
    const retry = await refreshConnectStatus({
      principal: principal(),
      admin,
      creatorUserId: CREATOR_ID,
      now: NOW,
      store,
      provider,
      surface: "site",
    });
    expect(retry).toMatchObject({ ok: true, value: { replayed: true } });
    expect(store.statusCount()).toBe(1);
  });

  it("persists the exact split before one provider-evidenced success and replays", async () => {
    const fixture = providerFixture();
    const store = await readyStore(fixture.provider);
    const request = {
      principal: principal(),
      admin,
      creatorUserId: CREATOR_ID,
      moneySplit: split(),
      idempotencyKey: "connect-payout:sale_connect_01",
      now: NOW,
      store,
      provider: fixture.provider,
      surface: "site" as const,
    };
    const first = await requestCreatorPayout(request);
    const retry = await requestCreatorPayout(request);
    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);
    if (!first.ok || !retry.ok) return;
    expect(first.value.intent).toMatchObject({
      grossMinor: 2501,
      creatorMinor: 1250,
      platformMinor: 1251,
      basisPoints: 5000,
      mode: "test",
    });
    expect(first.value.outcome).toMatchObject({
      status: "succeeded",
      providerPayoutId: "po_test_01",
      providerEvidenceId: "evt_payout_paid_01",
    });
    expect(retry.value.replayed).toBe(true);
    expect(fixture.calls.payout).toBe(1);
    expect(store.moneySplitCount()).toBe(1);
    expect(store.payoutIntentCount()).toBe(1);
    expect(store.payoutOutcomeCount()).toBe(1);
  });

  it("rejects split drift before persistence or provider dispatch", async () => {
    const fixture = providerFixture();
    const store = await readyStore(fixture.provider);
    const result = await requestCreatorPayout({
      principal: principal(),
      admin,
      creatorUserId: CREATOR_ID,
      moneySplit: split({ creatorMinor: 1251, platformMinor: 1250 }),
      idempotencyKey: "connect-payout:sale_connect_01",
      now: NOW,
      store,
      provider: fixture.provider,
      surface: "site",
    });
    expect(result).toMatchObject({
      ok: false,
      reason: BILLING_REFUSE_REASONS.revenueShareInvalid,
    });
    expect(fixture.calls.payout).toBe(0);
    expect(store.payoutIntentCount()).toBe(0);
  });

  it("records provider-evidenced failure but never a successful payout", async () => {
    const fixture = providerFixture({
      createPayout: () => ({
        ok: false,
        code: "payouts_not_available",
        message: "provider has not enabled payouts",
        evidenceId: "req_payout_refused_01",
      }),
    });
    const store = await readyStore(fixture.provider);
    const result = await requestCreatorPayout({
      principal: principal(),
      admin,
      creatorUserId: CREATOR_ID,
      moneySplit: split(),
      idempotencyKey: "connect-payout:sale_connect_01",
      now: NOW,
      store,
      provider: fixture.provider,
      surface: "site",
    });
    expect(result).toMatchObject({
      ok: false,
      reason: BILLING_REFUSE_REASONS.connectProviderRefused,
    });
    expect(store.payoutIntentCount()).toBe(1);
    expect(store.payoutOutcomeCount()).toBe(1);
    const intent = await store.findPayoutIntent(
      "connect-payout:sale_connect_01",
    );
    const outcome = await store.findPayoutOutcome(intent?.payoutIntentId ?? "");
    expect(outcome?.status).toBe("failed");
    expect(outcome?.providerPayoutId).toBeNull();
  });

  it("refuses payouts until an observed provider status enables them", async () => {
    const fixture = providerFixture({
      retrieveStatus: () => ({
        ok: true,
        value: {
          stripeAccountId: "acct_test_creator",
          onboardingComplete: true,
          payoutsEnabled: false,
          requirementsDue: ["external_account"],
          requestId: "req_status_disabled",
          observedAt: "2026-08-06T10:05:00Z",
        },
      }),
    });
    const store = await readyStore(fixture.provider);
    const result = await requestCreatorPayout({
      principal: principal(),
      admin,
      creatorUserId: CREATOR_ID,
      moneySplit: split(),
      idempotencyKey: "connect-payout:sale_connect_01",
      now: NOW,
      store,
      provider: fixture.provider,
      surface: "site",
    });
    expect(result).toMatchObject({
      ok: false,
      reason: BILLING_REFUSE_REASONS.connectPayoutsDisabled,
    });
    expect(fixture.calls.payout).toBe(0);
  });
});
