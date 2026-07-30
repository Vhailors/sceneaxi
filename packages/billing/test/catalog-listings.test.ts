import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  digestSessionToken,
  resolveAdminIdentity,
} from "@sceneaxi/auth";
import {
  LISTING_PRICE_MODES,
  validateCatalogListing,
  type CatalogListing,
  type CatalogListingSet,
  type CreditAccount,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  appendCreditEntry,
  assertCurrencyListed,
  createLedgerState,
  createListingCheckoutIntent,
  loadCatalogListings,
  lookupCatalogListing,
  purchaseListingWithCredits,
  type LedgerState,
} from "@sceneaxi/billing";
import { issuePrincipalForTest } from "../../auth/test/principal-fixture.js";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const adminResolution = resolveAdminIdentity({
  [ADMIN_EMAIL_ENV_VAR]: "captain@example.com",
});
if (!adminResolution.ok) throw new Error(adminResolution.message);
// Resolved, never hand-built: guards check the identity's runtime provenance,
// so a structurally identical `{ email, source }` literal is refused.
const admin = adminResolution.value;

const account = (userId: string, accountId: string) =>
  Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.credit-account",
    accountId,
    userId,
    createdAt: "2026-07-25T09:00:00Z",
  }) as CreditAccount;

const BUYER_ACCOUNT = account("usr_buyer", "acc_buyer");

const principal = (
  overrides: {
    userId?: string;
    role?: "admin" | "user";
    surface?: string;
  } = {},
): unknown => {
  const userId = overrides.userId ?? "usr_buyer";
  const role = overrides.role ?? "user";
  return issuePrincipalForTest({
    user: {
      schemaVersion: 1,
      kind: "sceneaxi.user",
      userId,
      email: role === "admin" ? "captain@example.com" : "buyer@example.com",
      emailVerified: true,
      disabled: false,
      createdAt: "2026-07-25T09:00:00Z",
    },
    role: {
      schemaVersion: 1,
      kind: "sceneaxi.role-assignment",
      userId,
      role,
      source: role === "admin" ? "admin-env" : "default-user",
      assignedAt: "2026-07-25T09:30:00Z",
    },
    session: {
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: "ses_01",
      userId,
      surface: overrides.surface ?? "web-shell",
      issuedAt: "2026-07-25T09:00:00Z",
      expiresAt: "2026-07-26T10:00:00Z",
      tokenDigest: digestSessionToken("tok"),
    },
  });
};

const funded = (credits: number, forAccount = BUYER_ACCOUNT): LedgerState => {
  if (credits === 0) return createLedgerState(forAccount);
  const appended = appendCreditEntry(createLedgerState(forAccount), {
    entryId: "ent_fund",
    movement: "grant",
    delta: credits,
    reason: "test funding",
    idempotencyKey: "fixture:fund",
    now: NOW,
  });
  if (!appended.ok) throw new Error("fixture funding failed");
  return appended.value.state;
};

const listings = (): CatalogListingSet => {
  const loaded = loadCatalogListings();
  if (!loaded.ok) throw new Error(`listing load failed: ${loaded.message}`);
  return loaded.value;
};

const listing = (listingId: string): CatalogListing => {
  const found = lookupCatalogListing(listings(), listingId);
  if (!found.ok) throw new Error(`fixture listing missing: ${listingId}`);
  return found.value;
};

describe("catalog listing set", () => {
  it("loads the canonical committed test-mode listings", () => {
    const loaded = loadCatalogListings();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.mode).toBe("test");
    expect(loaded.value.listings.length).toBeGreaterThanOrEqual(3);
  });

  it("covers every price mode, so a regression cannot pass by dropping one", () => {
    const modes = new Set(listings().listings.map((held) => held.priceMode));
    for (const mode of LISTING_PRICE_MODES) {
      expect(modes.has(mode)).toBe(true);
    }
  });

  it("refuses an unknown listing id and an invalid listing set", () => {
    const unknown = lookupCatalogListing(listings(), "not-a-listing");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.reason).toBe(BILLING_REFUSE_REASONS.listingUnknown);
    }
    const invalid = lookupCatalogListing({ listings: [] }, "lantern-prop");
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.reason).toBe(
        BILLING_REFUSE_REASONS.listingCatalogInvalid,
      );
    }
  });
});

describe("price-mode cross-field rule", () => {
  const base = listing("lantern-prop");

  it("refuses an unrecognised payment method", () => {
    const result = assertCurrencyListed(base, "barter" as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.listingCurrencyNotListed,
    );
  });

  it("refuses a credits listing with no credit price", () => {
    const result = validateCatalogListing(
      Object.fromEntries(
        Object.entries(base).filter(([name]) => name !== "creditPrice"),
      ),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("LISTING_PRICE_MODE_MISMATCH");
  });

  it("refuses a credits-only listing that carries a money price", () => {
    const result = validateCatalogListing({
      ...base,
      moneyPrice: {
        unitAmount: 100,
        currency: "usd",
        stripePriceId: "price_test_sneaky",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("LISTING_PRICE_MODE_MISMATCH");
  });

  it("refuses a money-only listing that carries a credit price", () => {
    const result = validateCatalogListing({
      ...listing("harbour-diorama"),
      creditPrice: 10,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("LISTING_PRICE_MODE_MISMATCH");
  });

  it("refuses a money listing with no money price", () => {
    const result = validateCatalogListing(
      Object.fromEntries(
        Object.entries(listing("harbour-diorama")).filter(
          ([name]) => name !== "moneyPrice",
        ),
      ),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("LISTING_PRICE_MODE_MISMATCH");
  });
});

describe("purchaseListingWithCredits", () => {
  const buy = (overrides: Record<string, unknown> = {}) =>
    purchaseListingWithCredits({
      principal: principal(),
      admin,
      listing: listing("lantern-prop"),
      buyerState: funded(100),
      now: NOW,
      saleId: "sale_01",
      ...overrides,
    } as never);

  it("refuses a malformed request envelope", () => {
    const result = purchaseListingWithCredits(null as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    }
  });

  it("debits exactly the listing's credit price", () => {
    const result = buy();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.charged).toBe(true);
    expect(result.value.buyer.entry?.delta).toBe(-40);
    expect(result.value.buyer.state.balance).toBe(60);
  });

  it("refuses paying credits for a money-only listing", () => {
    const result = buy({ listing: listing("harbour-diorama") });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.listingCurrencyNotListed,
    );
  });

  it("accepts a dual-price listing paid in credits", () => {
    const result = buy({
      listing: listing("market-stall-kit"),
      buyerState: funded(100),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.buyer.entry?.delta).toBe(-75);
  });

  it("refuses an insufficient balance and appends nothing", () => {
    const state = funded(10);
    const result = buy({ buyerState: state });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
    expect(state.entries.length).toBe(1);
    expect(state.balance).toBe(10);
  });

  it("refuses a seller buying their own listing", () => {
    const target = listing("lantern-prop");
    const result = buy({
      principal: principal({ userId: target.sellerUserId }),
      buyerState: funded(100, account(target.sellerUserId, "acc_seller")),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.listingSelfPurchaseDenied,
    );
  });

  it("refuses a buyer's account owned by someone else", () => {
    const result = buy({ principal: principal({ userId: "usr_other" }) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountNotOwned);
  });

  it("refuses the Kids surface", () => {
    const result = buy({ surface: "kids" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
  });

  it("does not debit an admin, and appends no ledger row for one", () => {
    const state = funded(0);
    const result = buy({
      principal: principal({ role: "admin", userId: "usr_buyer" }),
      buyerState: state,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.charged).toBe(false);
    expect(result.value.buyer.state.balance).toBe(0);
    expect(state.entries.length).toBe(0);
  });

  it("is replay-safe on the same sale id", () => {
    const first = buy();
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const replay = purchaseListingWithCredits({
      principal: principal(),
          admin,
      listing: listing("lantern-prop"),
      buyerState: first.value.buyer.state,
      now: NOW + 1_000,
      saleId: "sale_01",
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.buyer.replayed).toBe(true);
    expect(replay.value.buyer.state.balance).toBe(60);
  });

  it("refuses a bad clock and a missing sale id", () => {
    expect(buy({ now: Number.NaN }).ok).toBe(false);
    expect(buy({ saleId: "" }).ok).toBe(false);
  });
});

describe("createListingCheckoutIntent", () => {
  const checkout = (overrides: Record<string, unknown> = {}) =>
    createListingCheckoutIntent({
      principal: principal(),
      admin,
      listing: listing("harbour-diorama"),
      successUrl: "https://sceneaxi.example/ok",
      cancelUrl: "https://sceneaxi.example/no",
      now: NOW,
      saleId: "sale_02",
      ...overrides,
    } as never);

  it("refuses a malformed request envelope", () => {
    const result = createListingCheckoutIntent(null as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    }
  });

  it("builds a test-mode intent at the listing's money price", () => {
    const result = checkout();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mode).toBe("test");
    expect(result.value.purpose).toBe("catalog-listing");
    expect(result.value.itemId).toBe("harbour-diorama");
    expect(result.value.unitAmount).toBe(1200);
    expect(result.value.currency).toBe("usd");
  });

  it("grants no credits — a listing sale transfers an asset", () => {
    const result = checkout();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toHaveProperty("credits");
  });

  it("refuses paying money for a credits-only listing", () => {
    const result = checkout({ listing: listing("lantern-prop") });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.listingCurrencyNotListed,
    );
  });

  it("accepts a dual-price listing paid in money", () => {
    const result = checkout({ listing: listing("market-stall-kit") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.unitAmount).toBe(2500);
  });

  it("cannot reach live without explicit authorization", () => {
    const result = checkout({ liveModeAuthorized: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mode).toBe("test");
  });

  it("refuses an undeclared mode instead of downgrading it to test", () => {
    const result = checkout({ mode: "live" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      BILLING_REFUSE_REASONS.listingCheckoutUnexpectedProperty,
    );
  });

  it("refuses a plaintext redirect, the Kids surface, a self purchase, and a missing sale id", () => {
    expect(checkout({ successUrl: "http://sceneaxi.example/ok" }).ok).toBe(false);
    const kids = checkout({ surface: "kids" });
    expect(kids.ok).toBe(false);
    if (!kids.ok) {
      expect(kids.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
    }
    const target = listing("harbour-diorama");
    const own = checkout({ principal: principal({ userId: target.sellerUserId }) });
    expect(own.ok).toBe(false);
    if (!own.ok) {
      expect(own.reason).toBe(BILLING_REFUSE_REASONS.listingSelfPurchaseDenied);
    }
    expect(checkout({ saleId: "" }).ok).toBe(false);
  });
});
