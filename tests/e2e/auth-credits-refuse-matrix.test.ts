import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  createIdentityPort,
  createInMemoryIdentityStore,
  digestSessionToken,
  planAdminBootstrap,
  requireRole,
  resolveAdminIdentity,
  type AuthRefuseReason,
  type IdentityAdapter,
  type IdentityStore,
} from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  CHECKOUT_METADATA_KEYS,
  HOSTED_AI_DEFAULT_CONFIG,
  appendCreditEntry,
  applyCheckoutCompletedGrant,
  applyCreditsSale,
  assertCurrencyListed,
  assertModeAuthorized,
  createCheckoutSessionIntent,
  createInMemoryCreditStore,
  createLedgerState,
  createListingCheckoutIntent,
  deriveBalance,
  evaluateEntitlement,
  grantStarterCredits,
  loadCatalogListings,
  loadCreditPackCatalog,
  lookupCatalogListing,
  lookupCreditPack,
  meterCredits,
  parseCheckoutCompletedEvent,
  persistCreditsSale,
  purchaseListingWithCredits,
  recordMoneySale,
  runMeteredModelCall,
  signStripeWebhookPayload,
  splitCredits,
  verifyStripeWebhookSignature,
  type BillingRefuseReason,
  type CreditStore,
  type LedgerState,
} from "@sceneaxi/billing";
import type {
  CatalogListing,
  CheckoutSessionIntent,
  CreditAccount,
} from "@sceneaxi/schemas";

/**
 * The refuse matrix.
 *
 * Every entry in both frozen reason maps must be reachable by a concrete case.
 * That makes the maps honest in both directions: a reason cannot be added without
 * a covering case, and a reason cannot be deleted while a case still produces it.
 *
 * There is deliberately no allow-list for "defensive" reasons. When a reason
 * turned out to be genuinely unreachable it was **removed** from the map rather
 * than exempted here, because an unreachable refusal is dead code that reads like
 * a guarantee.
 */

const NOW = Date.parse("2026-07-25T10:00:00Z");
const NOW_SECONDS = Math.floor(NOW / 1000);
const clock = () => NOW;
const CAPTAIN_EMAIL = "captain@example.com";
const admin = { email: CAPTAIN_EMAIL, source: ADMIN_EMAIL_ENV_VAR } as const;

const verifyBody = (body: string) => {
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

const settlementFor = (intent: CheckoutSessionIntent) => ({
  paymentStatus: "paid" as const,
  amountTotal: intent.unitAmount,
  currency: intent.currency,
  quantity: 1,
  stripePriceId: intent.stripePriceId,
});
const SECRET = "whsec_refuse_matrix_fixture";

const observed = new Set<AuthRefuseReason | BillingRefuseReason>();

/** Record whatever reason a refusing call produced. */
const record = (result: {
  readonly ok: boolean;
  readonly reason?: AuthRefuseReason | BillingRefuseReason;
}): void => {
  if (!result.ok && result.reason !== undefined) observed.add(result.reason);
};

const user = (
  userId: string,
  email: string,
  disabled = false,
): never =>
  ({
    schemaVersion: 1,
    kind: "sceneaxi.user",
    userId,
    email,
    emailVerified: true,
    disabled,
    createdAt: "2026-07-25T09:00:00Z",
  }) as never;

const CREW = user("usr_crew", "crew@example.com");
const GONE = user("usr_gone", "gone@example.com", true);

const account = (userId: string): CreditAccount =>
  Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.credit-account",
    accountId: `acc_${userId}`,
    userId,
    createdAt: "2026-07-25T09:00:00Z",
  }) as CreditAccount;

const principal = (
  overrides: {
    userId?: string;
    role?: "admin" | "user";
    source?: string;
    surface?: string;
    disabled?: boolean;
    expiresAt?: string;
  } = {},
): unknown => {
  const userId = overrides.userId ?? "usr_crew";
  const role = overrides.role ?? "user";
  return {
    user: {
      schemaVersion: 1,
      kind: "sceneaxi.user",
      userId,
      email: role === "admin" ? CAPTAIN_EMAIL : "crew@example.com",
      emailVerified: true,
      disabled: overrides.disabled ?? false,
      createdAt: "2026-07-25T09:00:00Z",
    },
    role: {
      schemaVersion: 1,
      kind: "sceneaxi.role-assignment",
      userId,
      role,
      source:
        overrides.source ?? (role === "admin" ? "admin-env" : "default-user"),
      assignedAt: "2026-07-25T09:30:00Z",
    },
    session: {
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: "ses_01",
      userId,
      surface: overrides.surface ?? "web-shell",
      issuedAt: "2026-07-25T09:00:00Z",
      expiresAt: overrides.expiresAt ?? "2026-07-26T10:00:00Z",
      tokenDigest: digestSessionToken("tok"),
    },
  };
};

const funded = (credits: number, forAccount = account("usr_crew")): LedgerState => {
  if (credits === 0) return createLedgerState(forAccount);
  const appended = appendCreditEntry(createLedgerState(forAccount), {
    entryId: "ent_fund",
    movement: "grant",
    delta: credits,
    reason: "fixture funding",
    idempotencyKey: "fixture:fund",
    now: NOW,
  });
  if (!appended.ok) throw new Error("fixture funding failed");
  return appended.value.state;
};

const packCatalog = () => {
  const loaded = loadCreditPackCatalog();
  if (!loaded.ok) throw new Error("catalog load failed");
  return loaded.value;
};

const listing = (listingId: string): CatalogListing => {
  const loaded = loadCatalogListings();
  if (!loaded.ok) throw new Error("listing load failed");
  const found = lookupCatalogListing(loaded.value, listingId);
  if (!found.ok) throw new Error(`missing fixture listing ${listingId}`);
  return found.value;
};

const ADAPTER: IdentityAdapter = Object.freeze({
  authenticate({ email, password }) {
    if (password !== "pw") return undefined;
    const userId = email === "gone@example.com" ? "usr_gone" : "usr_crew";
    return {
      user: { id: userId, email, emailVerified: true },
      session: {
        id: `ses_${userId}`,
        token: "tok",
        userId,
        expiresAt: "2026-07-26T10:00:00Z",
      },
    };
  },
});

const port = (
  overrides: Partial<Parameters<typeof createIdentityPort>[0]> = {},
  store: IdentityStore = createInMemoryIdentityStore({ users: [CREW, GONE] }),
) =>
  createIdentityPort({ adapter: ADAPTER, store, admin, clock, ...overrides });

const CREDENTIALS = {
  surface: "web-shell",
  email: "crew@example.com",
  password: "pw",
} as const;

const throwingStore: IdentityStore = Object.freeze({
  findUserByEmail() {
    throw new Error("db down");
  },
  findUserById: () => undefined,
  putSession: () => undefined,
  findSession: () => undefined,
  deleteSession: () => true,
});

describe("auth refuse matrix", () => {
  it("reaches every admin-resolution refusal", () => {
    record(resolveAdminIdentity({}));
    record(resolveAdminIdentity({ [ADMIN_EMAIL_ENV_VAR]: "  " }));
    record(resolveAdminIdentity({ [ADMIN_EMAIL_ENV_VAR]: "nope" }));
    record(
      resolveAdminIdentity({ [ADMIN_EMAIL_ENV_VAR]: "a@b.co,c@d.co" }),
    );
    record(
      resolveAdminIdentity({
        [ADMIN_EMAIL_ENV_VAR]: CAPTAIN_EMAIL,
        SCENEAXI_ADMIN_EMAILS: CAPTAIN_EMAIL,
      }),
    );
    expect(observed.size).toBeGreaterThan(0);
  });

  it("reaches every wiring and request refusal", async () => {
    record(await port({ adapter: undefined }).signIn(CREDENTIALS));
    record(await port({ store: undefined }).signIn(CREDENTIALS));
    record(await port({ admin: undefined }).signIn(CREDENTIALS));
    record(await port({ clock: undefined }).signIn(CREDENTIALS));
    record(await port().signIn({ ...CREDENTIALS, extra: 1 }));
    record(await port().signIn({ ...CREDENTIALS, role: "admin" }));
    record(await port().signIn({ ...CREDENTIALS, surface: "mobile" }));
    record(await port().signIn({ ...CREDENTIALS, surface: "kids" }));
    expect(observed.size).toBeGreaterThan(5);
  });

  it("reaches every adapter and store refusal", async () => {
    record(await port().signIn({ ...CREDENTIALS, password: "wrong" }));
    record(
      await port({
        adapter: Object.freeze({
          authenticate() {
            throw new Error("provider down");
          },
        }),
      }).signIn(CREDENTIALS),
    );
    record(
      await port({
        adapter: Object.freeze({ authenticate: () => ({}) as never }),
      }).signIn(CREDENTIALS),
    );
    record(
      await port({
        adapter: Object.freeze({
          authenticate: () => ({
            user: {
              id: "usr_imposter",
              email: "crew@example.com",
              emailVerified: true,
            },
            session: {
              id: "ses_x",
              token: "t",
              userId: "usr_imposter",
              expiresAt: "2026-07-26T10:00:00Z",
            },
          }),
        }),
      }).signIn(CREDENTIALS),
    );
    record(
      await port(
        {},
        Object.freeze({
          findUserByEmail: () => user("usr_crew", CAPTAIN_EMAIL),
          findUserById: () => undefined,
          putSession: () => undefined,
          findSession: () => undefined,
          deleteSession: () => true,
        }),
      ).signIn(CREDENTIALS),
    );
    record(await port({}, throwingStore).signIn(CREDENTIALS));
    record(
      await port({}, createInMemoryIdentityStore({ users: [] })).signIn(
        CREDENTIALS,
      ),
    );
    record(
      await port().signIn({ ...CREDENTIALS, email: "gone@example.com" }),
    );
    record(
      await port(
        {
          adapter: Object.freeze({
            authenticate: () => ({
              user: {
                id: "usr_captain",
                email: CAPTAIN_EMAIL,
                emailVerified: false,
              },
              session: {
                id: "ses_unverified_admin",
                token: "tok",
                userId: "usr_captain",
                expiresAt: "2026-07-26T10:00:00Z",
              },
            }),
          }),
        },
        createInMemoryIdentityStore({
          users: [user("usr_captain", CAPTAIN_EMAIL)],
        }),
      ).signIn({
        surface: "web-shell",
        email: CAPTAIN_EMAIL,
        password: "pw",
      }),
    );
  });

  it("reaches every session-verification refusal", async () => {
    const store = createInMemoryIdentityStore({ users: [CREW] });
    const live = port({}, store);
    const signedIn = await live.signIn(CREDENTIALS);
    expect(signedIn.ok).toBe(true);
    if (!signedIn.ok) return;
    const sessionId = signedIn.value.session.sessionId;

    record(
      await live.verifySession({
        surface: "web-shell",
        sessionId: "ses_missing",
        token: "tok",
      }),
    );
    record(
      await live.verifySession({
        surface: "web-shell",
        sessionId,
        token: "wrong",
      }),
    );
    record(
      await live.verifySession({ surface: "site", sessionId, token: "tok" }),
    );
    record(
      await port(
        { clock: () => Date.parse("2026-07-28T10:00:00Z") },
        store,
      ).verifySession({ surface: "web-shell", sessionId, token: "tok" }),
    );

    const corrupt: IdentityStore = Object.freeze({
      findUserByEmail: () => undefined,
      findUserById: () => CREW,
      putSession: () => undefined,
      findSession: () => ({ sessionId: "ses_bad" }) as never,
      deleteSession: () => true,
    });
    record(
      await port({}, corrupt).verifySession({
        surface: "web-shell",
        sessionId: "ses_bad",
        token: "tok",
      }),
    );

    const kidsStore = createInMemoryIdentityStore({
      users: [CREW],
      sessions: [
        {
          schemaVersion: 1,
          kind: "sceneaxi.session",
          sessionId: "ses_kids",
          userId: "usr_crew",
          surface: "kids",
          issuedAt: "2026-07-25T09:00:00Z",
          expiresAt: "2026-07-26T10:00:00Z",
          tokenDigest: digestSessionToken("tok"),
        } as never,
      ],
    });
    record(
      await port({}, kidsStore).verifySession({
        surface: "web-shell",
        sessionId: "ses_kids",
        token: "tok",
      }),
    );

    const badUserStore: IdentityStore = Object.freeze({
      findUserByEmail: () => undefined,
      findUserById: () => ({ userId: "usr_crew" }) as never,
      putSession: () => undefined,
      findSession: () =>
        ({
          schemaVersion: 1,
          kind: "sceneaxi.session",
          sessionId: "ses_01",
          userId: "usr_crew",
          surface: "web-shell",
          issuedAt: "2026-07-25T09:00:00Z",
          expiresAt: "2026-07-26T10:00:00Z",
          tokenDigest: digestSessionToken("tok"),
        }) as never,
      deleteSession: () => true,
    });
    record(
      await port({}, badUserStore).verifySession({
        surface: "web-shell",
        sessionId: "ses_01",
        token: "tok",
      }),
    );
  });

  it("reaches every guard refusal", () => {
    record(requireRole(undefined, "admin", { now: NOW, admin }));
    record(requireRole(principal(), "superadmin" as never, { now: NOW, admin }));
    record(requireRole(principal(), "admin", { now: NOW, admin }));
    record(requireRole(principal({ disabled: true }), "user", { now: NOW, admin }));
    record(
      requireRole(principal({ expiresAt: "2026-07-25T09:30:00Z" }), "user", {
        now: NOW,
        admin,
      }),
    );
    record(
      requireRole(principal({ surface: "site" }), "user", {
        now: NOW,
        surface: "web-shell",
        admin,
      }),
    );
    record(requireRole(principal({ surface: "kids" }), "user", { now: NOW, admin }));
    record(requireRole(principal(), "user", { now: Number.NaN, admin }));
  });

  it("reaches the bootstrap refusals", () => {
    record(
      planAdminBootstrap({
        env: { [ADMIN_EMAIL_ENV_VAR]: CAPTAIN_EMAIL },
        users: [],
        now: NOW,
      }),
    );
    record(
      planAdminBootstrap({
        env: { [ADMIN_EMAIL_ENV_VAR]: CAPTAIN_EMAIL },
        users: [
          user("usr_a", CAPTAIN_EMAIL),
          user("usr_b", CAPTAIN_EMAIL),
        ],
        now: NOW,
      }),
    );
    record(
      planAdminBootstrap({
        env: { [ADMIN_EMAIL_ENV_VAR]: CAPTAIN_EMAIL },
        users: [user("usr_a", CAPTAIN_EMAIL, true)],
        now: NOW,
      }),
    );
  });
});

describe("billing refuse matrix", () => {
  it("reaches every ledger refusal", () => {
    const state = funded(100);
    const base = {
      entryId: "ent_x",
      movement: "grant" as const,
      delta: 10,
      reason: "case",
      idempotencyKey: "case:1",
      now: NOW,
    };
    record(appendCreditEntry(null, base));
    record(appendCreditEntry(state, null));
    record(appendCreditEntry(state, { ...base, now: Number.NaN }));
    record(appendCreditEntry(state, { ...base, delta: -1 }));
    record(
      appendCreditEntry(state, {
        ...base,
        movement: "debit",
        delta: -1_000,
        idempotencyKey: "case:over",
      }),
    );
    record(
      appendCreditEntry(state, {
        ...base,
        idempotencyKey: "fixture:fund",
        delta: 999,
      }),
    );
    record(deriveBalance("not an array"));
    record(deriveBalance([{ nope: true }]));
    const first = state.entries[0];
    if (first !== undefined) {
      record(deriveBalance([{ ...first, sequence: 9 }]));
    }
  });

  it("reaches every metering refusal", async () => {
    const state = funded(10);
    const store = createInMemoryCreditStore({
      accounts: [state.account],
      entries: state.entries,
    });
    const meter = async (overrides: Record<string, unknown>) =>
      record(
        await meterCredits({
          principal: principal(),
          admin,
          store,
          state,
          amount: 1,
          reason: "case",
          idempotencyKey: "case:meter",
          now: NOW,
          ...overrides,
        } as never),
      );
    await meter({ now: Number.NaN, admin });
    await meter({ amount: 0 });
    await meter({ reason: "" });
    await meter({ state: { entries: [] } });
    await meter({ principal: principal({ userId: "usr_other" }) });
    await meter({ amount: 1_000 });
  });

  it("reaches every hosted-AI routing refusal", async () => {
    const state = funded(100);
    const hosted = async (overrides: Record<string, unknown>) =>
      record(
        await runMeteredModelCall({
          route: "hosted",
          capability: "hosted-ai-assistant",
          call: () => ({ text: "case" }),
          now: NOW,
          hostedAi: { enabled: true },
          admin,
          principal: principal(),
          state,
          store: createInMemoryCreditStore({
            accounts: [state.account],
            entries: state.entries,
          }),
          creditAmount: 1,
          reason: "case",
          idempotencyKey: "case:hosted",
          ...overrides,
        } as never),
      );
    await hosted({ route: "not-a-route" });
    await hosted({ hostedAi: HOSTED_AI_DEFAULT_CONFIG });
    await hosted({
      call: () => {
        throw new Error("provider down");
      },
    });
  });

  it("reaches every entitlement refusal", () => {
    record(evaluateEntitlement({ capability: "nope", now: NOW }));
    record(evaluateEntitlement({ capability: "cli-authoring", now: Number.NaN }));
    record(
      evaluateEntitlement({
        capability: "engine-sdk-download",
        now: NOW,
        surface: "kids",
      }),
    );
    record(evaluateEntitlement({ capability: "hosted-ai-assistant", now: NOW }));
    record(
      evaluateEntitlement({
        capability: "catalog-asset-purchase",
        now: NOW,
        principal: principal(),
        admin,
      }),
    );
    record(
      evaluateEntitlement({
        capability: "hosted-ai-assistant",
        now: NOW,
        principal: principal(),
        admin,
        state: funded(10),
      }),
    );
    record(
      evaluateEntitlement({
        capability: "hosted-ai-assistant",
        now: NOW,
        principal: principal(),
        admin,
        creditAmount: 5,
      }),
    );
    record(
      evaluateEntitlement({
        capability: "hosted-ai-assistant",
        now: NOW,
        principal: principal({ userId: "usr_other" }),
        admin,
        state: funded(100),
        creditAmount: 5,
      }),
    );
    record(
      grantStarterCredits({
        state: funded(0),
        userId: "usr_other",
        now: NOW,
      }),
    );
    record(
      grantStarterCredits({ state: funded(0), userId: "", now: NOW }),
    );
  });

  it("reaches every credit-pack and checkout refusal", () => {
    record(lookupCreditPack({ packs: [] }, "starter"));
    record(lookupCreditPack(packCatalog(), "platinum"));
    record(assertModeAuthorized("barter" as never, true));

    const request = {
      principal: principal(),
      admin,
      catalog: packCatalog(),
      packId: "starter",
      successUrl: "https://sceneaxi.example/ok",
      cancelUrl: "https://sceneaxi.example/no",
      idempotencyKey: "checkout:case",
      now: NOW,
    };
    record(createCheckoutSessionIntent({ ...request, now: Number.NaN }));
    record(createCheckoutSessionIntent({ ...request, principal: null }));
    record(
      createCheckoutSessionIntent({
        ...request,
        successUrl: "http://sceneaxi.example/ok",
      }),
    );
    record(createCheckoutSessionIntent({ ...request, mode: "live" }));
    record(createCheckoutSessionIntent(null as never));
  });

  it("reaches every webhook refusal", () => {
    const packIntent = createCheckoutSessionIntent({
      principal: principal(),
      admin,
      catalog: packCatalog(),
      packId: "starter",
      successUrl: "https://sceneaxi.example/ok",
      cancelUrl: "https://sceneaxi.example/no",
      idempotencyKey: "checkout:case",
      now: NOW,
    });
    expect(packIntent.ok).toBe(true);
    if (!packIntent.ok) return;
    const body = JSON.stringify({
      id: "evt_case",
      type: "checkout.session.completed",
      created: NOW_SECONDS,
      livemode: false,
      data: {
        object: {
          payment_status: "paid",
          amount_total: packIntent.value.unitAmount,
          currency: packIntent.value.currency,
          line_items: {
            data: [
              {
                quantity: 1,
                price: { id: packIntent.value.stripePriceId },
              },
            ],
          },
          metadata: {
            [CHECKOUT_METADATA_KEYS.userId]: "usr_crew",
            [CHECKOUT_METADATA_KEYS.purpose]: "credit-pack",
            [CHECKOUT_METADATA_KEYS.itemId]: "starter",
            [CHECKOUT_METADATA_KEYS.intentId]: packIntent.value.intentId,
          },
        },
      },
    });
    const header = signStripeWebhookPayload({
      payload: body,
      secret: SECRET,
      timestamp: NOW_SECONDS,
    });

    record(
      verifyStripeWebhookSignature({
        payload: body,
        header,
        secret: "",
        now: NOW,
      }),
    );
    record(
      verifyStripeWebhookSignature({
        payload: body,
        header,
        secret: SECRET,
        now: Number.NaN,
      }),
    );
    record(
      verifyStripeWebhookSignature({
        payload: body,
        header: "",
        secret: SECRET,
        now: NOW,
      }),
    );
    record(
      verifyStripeWebhookSignature({
        payload: body,
        header: "garbage",
        secret: SECRET,
        now: NOW,
      }),
    );
    record(
      verifyStripeWebhookSignature({
        payload: body,
        header: `t=${NOW_SECONDS},v0=abc`,
        secret: SECRET,
        now: NOW,
      }),
    );
    record(
      verifyStripeWebhookSignature({
        payload: body,
        header: signStripeWebhookPayload({
          payload: body,
          secret: SECRET,
          timestamp: NOW_SECONDS - 10_000,
        }),
        secret: SECRET,
        now: NOW,
      }),
    );
    record(
      verifyStripeWebhookSignature({
        payload: body,
        header: signStripeWebhookPayload({
          payload: body,
          secret: SECRET,
          timestamp: NOW_SECONDS + 10_000,
        }),
        secret: SECRET,
        now: NOW,
      }),
    );
    record(
      verifyStripeWebhookSignature({
        payload: `${body} `,
        header,
        secret: SECRET,
        now: NOW,
      }),
    );
    record(
      verifyStripeWebhookSignature({
        payload: { id: "evt" } as never,
        header,
        secret: SECRET,
        now: NOW,
      }),
    );

    record(
      parseCheckoutCompletedEvent({
        verified: verifyBody("not json"),
        intent: packIntent.value,
        settlement: settlementFor(packIntent.value),
      }),
    );
    record(
      parseCheckoutCompletedEvent({
        verified: verifyBody(
          JSON.stringify({ type: "payment_intent.succeeded" }),
        ),
        intent: packIntent.value,
        settlement: settlementFor(packIntent.value),
      }),
    );

    const harbour = listing("harbour-diorama");
    const moneyPrice = harbour.moneyPrice;
    if (moneyPrice === undefined) throw new Error("listing price missing");
    const listingIntent: CheckoutSessionIntent = {
      schemaVersion: 1,
      kind: "sceneaxi.checkout-session-intent",
      intentId: "int_listing",
      userId: "usr_crew",
      purpose: "catalog-listing",
      itemId: harbour.listingId,
      unitAmount: moneyPrice.unitAmount,
      currency: moneyPrice.currency,
      stripePriceId: moneyPrice.stripePriceId,
      mode: "test",
      successUrl: "https://sceneaxi.example/ok",
      cancelUrl: "https://sceneaxi.example/no",
      idempotencyKey: "checkout:listing",
      createdAt: new Date(NOW).toISOString(),
    };
    const listingEvent = parseCheckoutCompletedEvent({
      verified: verifyBody(
        JSON.stringify({
          id: "evt_listing",
          type: "checkout.session.completed",
          created: NOW_SECONDS,
          livemode: false,
          data: {
            object: {
              metadata: {
                [CHECKOUT_METADATA_KEYS.userId]: "usr_crew",
                [CHECKOUT_METADATA_KEYS.purpose]: "catalog-listing",
                [CHECKOUT_METADATA_KEYS.itemId]: "harbour-diorama",
                [CHECKOUT_METADATA_KEYS.intentId]: "int_listing",
              },
            },
          },
        }),
      ),
      intent: listingIntent,
      settlement: settlementFor(listingIntent),
    });
    expect(listingEvent.ok).toBe(true);
    if (listingEvent.ok) {
      // A listing completion grants no credits, so routing it into the grant
      // path must refuse rather than mint credits nobody bought.
      record(
        applyCheckoutCompletedGrant({
          state: funded(0),
          completion: listingEvent.value,
          now: NOW,
        }),
      );
    }

    const packEvent = parseCheckoutCompletedEvent({
      verified: verifyBody(body),
      intent: packIntent.value,
      settlement: settlementFor(packIntent.value),
    });
    expect(packEvent.ok).toBe(true);
    if (packEvent.ok) {
      record(
        applyCheckoutCompletedGrant({
          state: funded(0, account("usr_other")),
          completion: packEvent.value,
          now: NOW,
        }),
      );
      record(
        applyCheckoutCompletedGrant({
          state: { entries: [] } as never,
          completion: packEvent.value,
          now: NOW,
        }),
      );
      record(
        applyCheckoutCompletedGrant({
          state: funded(0),
          completion: { ...packEvent.value, mode: "live" } as never,
          now: NOW,
        }),
      );
    }
    record(
      applyCheckoutCompletedGrant({
        state: funded(0),
        completion: { eventId: "evt" } as never,
        now: NOW,
      }),
    );
  });

  it("reaches every listing refusal", () => {
    record(lookupCatalogListing({ listings: [] }, "lantern-prop"));
    record(assertCurrencyListed(listing("lantern-prop"), "barter" as never));
    const loaded = loadCatalogListings();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) record(lookupCatalogListing(loaded.value, "nope"));

    const buy = (overrides: Record<string, unknown>) =>
      record(
        purchaseListingWithCredits({
          principal: principal(),
          admin,
          listing: listing("lantern-prop"),
          buyerState: funded(100),
          now: NOW,
          saleId: "sale_case",
          ...overrides,
        } as never),
      );
    buy({ now: Number.NaN, admin });
    buy({ saleId: "" });
    buy({ surface: "kids" });
    buy({ listing: listing("harbour-diorama") });
    // A listing that claims a credits mode but carries no credit price.
    buy({
      listing: Object.fromEntries(
        Object.entries(listing("lantern-prop")).filter(
          ([name]) => name !== "creditPrice",
        ),
      ),
    });
    buy({
      principal: principal({ userId: listing("lantern-prop").sellerUserId }),
      admin,
      buyerState: funded(
        100,
        account(listing("lantern-prop").sellerUserId),
      ),
    });
    buy({ principal: principal({ userId: "usr_other" }) });

    record(
      createListingCheckoutIntent({
        principal: principal(),
        admin,
        listing: listing("lantern-prop"),
        successUrl: "https://sceneaxi.example/ok",
        cancelUrl: "https://sceneaxi.example/no",
        now: NOW,
        saleId: "sale_case_money",
      }),
    );
    record(
      createListingCheckoutIntent({
        principal: principal(),
        admin,
        listing: listing("harbour-diorama"),
        successUrl: "https://sceneaxi.example/ok",
        cancelUrl: "https://sceneaxi.example/no",
        now: NOW,
        saleId: "sale_case_money",
        surface: "kids",
      }),
    );
    record(
      createListingCheckoutIntent({
        principal: principal(),
        admin,
        listing: listing("harbour-diorama"),
        successUrl: "https://sceneaxi.example/ok",
        cancelUrl: "https://sceneaxi.example/no",
        now: NOW,
        saleId: "sale_case_money",
        mode: "live",
      } as never),
    );
  });

  it("reaches every revenue-share refusal", async () => {
    record(splitCredits(0));
    const target = listing("lantern-prop");
    record(
      applyCreditsSale({
        principal: principal(),
        admin,
        listing: target,
        buyerState: funded(100),
        creatorState: createLedgerState(account("usr_wrong")),
        now: NOW,
        saleId: "sale_case_share",
      }),
    );
    const failedStore: CreditStore = Object.freeze({
      findAccountByUserId: () => undefined,
      findAccountById: () => undefined,
      listEntries: () => [],
      appendEntry: () => undefined,
      settleCreditsSale() {
        throw new Error("transaction failed");
      },
    });
    record(
      await persistCreditsSale({
        store: failedStore,
        principal: principal(),
        admin,
        listing: target,
        buyerState: funded(100),
        creatorState: createLedgerState(account(target.sellerUserId)),
        now: NOW,
        saleId: "sale_case_store",
      }),
    );
    record(
      recordMoneySale({
        listing: target,
        buyerUserId: "usr_crew",
        saleId: "sale_case_money",
        mode: "test",
        now: NOW,
      }),
    );
    // A gross the record contract rejects, reaching the record-invalid path.
    record(
      recordMoneySale({
        listing: listing("harbour-diorama"),
        buyerUserId: listing("harbour-diorama").sellerUserId,
        saleId: "sale_case_self",
        mode: "test",
        now: NOW,
      }),
    );
    // An entitlement decision the contract rejects.
    record(
      evaluateEntitlement({
        capability: "hosted-ai-assistant",
        now: NOW,
        principal: principal(),
        admin,
        state: funded(100),
        creditAmount: Number.MAX_SAFE_INTEGER,
      }),
    );
  });
});

describe("the reason maps are honest in both directions", () => {
  it("has no duplicate reason string in either map", () => {
    for (const map of [AUTH_REFUSE_REASONS, BILLING_REFUSE_REASONS]) {
      const values = Object.values(map);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("reaches every auth reason with a concrete case", () => {
    const unreached = Object.values(AUTH_REFUSE_REASONS).filter(
      (reason) => !observed.has(reason),
    );
    expect(unreached).toEqual([]);
  });

  it("reaches every billing reason with a concrete case", () => {
    const unreached = Object.values(BILLING_REFUSE_REASONS).filter(
      (reason) => !observed.has(reason),
    );
    expect(unreached).toEqual([]);
  });
});
