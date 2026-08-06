import { describe, expect, it } from "vitest";
import {
  CATALOG_LISTING_AVAILABILITY,
  CATALOG_SURFACES,
  CREATOR_SHARE_RULE,
  SITE_CATALOG_FIXTURE_PATH,
  SITE_CATALOG_MODE,
  type CatalogSurface,
  attemptCatalogPurchase,
  buildEditorDeepLink,
  createPublishIntent,
  creatorShare,
  describeCreatorShare,
  describeListingPrice,
  listSiteCatalog,
  parseEditorDeepLink,
  parseEditorDeepLinkParams,
  showSiteListing,
  submitPublishIntent,
} from "@sceneaxi/site-kit";
import {
  CATALOG_LISTINGS_DATA,
  CATALOG_LISTINGS_FIXTURES_PATH,
  validateCatalogListingSet,
} from "@sceneaxi/schemas";

const UMBRELLA = "https://sceneaxi-umbrella.vercel.app";

describe("committed catalog fixture browse and detail", () => {
  const committed = validateCatalogListingSet(CATALOG_LISTINGS_DATA);
  if (!committed.ok) throw new Error(committed.message);

  it("projects exactly the validated fixture set into its two storefronts", () => {
    expect(SITE_CATALOG_MODE).toBe("test");
    expect(SITE_CATALOG_FIXTURE_PATH).toBe(CATALOG_LISTINGS_FIXTURES_PATH);

    const projected = CATALOG_SURFACES.flatMap((surface) => listSiteCatalog(surface));
    expect(
      projected
        .map((listing) => listing.listing)
        .sort((left, right) => left.listingId.localeCompare(right.listingId)),
    ).toEqual(
      [...committed.value.listings].sort((left, right) =>
        left.listingId.localeCompare(right.listingId),
      ),
    );
    expect(projected.map((listing) => listing.itemId).sort()).toEqual(
      committed.value.listings.map((listing) => listing.listingId).sort(),
    );
  });

  it.each([...CATALOG_SURFACES])("%s publishes at least one fixture", (surface) => {
    const listings = listSiteCatalog(surface);
    expect(listings.length).toBeGreaterThan(0);
    for (const listing of listings) {
      expect(listing.surface).toBe(surface);
      expect(listing.recordDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(listing.availability).toEqual(CATALOG_LISTING_AVAILABILITY);
      expect(listing.availability).toMatchObject({
        browse: "listed-fixture",
        asset: "metadata-only",
        purchase: "refused",
        mode: "test",
      });
    }
  });

  it("keeps every fixture and nested contract record frozen", () => {
    const listing = listSiteCatalog("catalog-web")[0];
    expect(Object.isFrozen(listing)).toBe(true);
    expect(Object.isFrozen(listing?.listing)).toBe(true);
    expect(Object.isFrozen(listing?.availability)).toBe(true);
  });

  it("refuses a missing fixture and a fixture from the other catalog", () => {
    expect(showSiteListing("catalog-game", "nope")).toMatchObject({
      ok: false,
      reason: "CATALOG_ITEM_NOT_FOUND",
    });
    expect(showSiteListing("catalog-game", "harbour-diorama")).toMatchObject({
      ok: false,
      reason: "CATALOG_ITEM_NOT_FOUND",
    });
  });

  it("keeps the two storefront inventories distinct", () => {
    const gameIds = listSiteCatalog("catalog-game").map((listing) => listing.itemId);
    const webIds = listSiteCatalog("catalog-web").map((listing) => listing.itemId);
    expect(gameIds).toEqual(["lantern-prop", "market-stall-kit", "odd-price-charm"]);
    expect(webIds).toEqual(["harbour-diorama"]);
    expect(gameIds.filter((id) => webIds.includes(id))).toEqual([]);
  });
});

describe("price and creator-share display", () => {
  it("renders the committed credits-only, money-only, and dual-price fixtures", () => {
    const credits = showSiteListing("catalog-game", "lantern-prop");
    const money = showSiteListing("catalog-web", "harbour-diorama");
    const both = showSiteListing("catalog-game", "market-stall-kit");
    expect(credits.ok && describeListingPrice(credits.value.price)).toMatchObject({
      ok: true,
      value: { credits: "40 credits", money: null, label: "40 credits" },
    });
    expect(money.ok && describeListingPrice(money.value.price)).toMatchObject({
      ok: true,
      value: { credits: null, money: "12.00 USD", label: "12.00 USD" },
    });
    expect(both.ok && describeListingPrice(both.value.price)).toMatchObject({
      ok: true,
      value: {
        credits: "75 credits",
        money: "25.00 USD",
        label: "75 credits or 25.00 USD",
      },
    });
  });

  it("refuses a listing that offers neither price", () => {
    expect(describeListingPrice({ credits: null, money: null })).toMatchObject({
      ok: false,
      reason: "CATALOG_PRICE_UNAVAILABLE",
    });
  });

  it("projects creator share for every offered currency", () => {
    const dual = showSiteListing("catalog-game", "market-stall-kit");
    expect(dual.ok && describeCreatorShare(dual.value.price)).toMatchObject({
      ok: true,
      value: {
        credits: "37 creator / 38 platform credits",
        money: "12.50 USD creator / 12.50 USD platform (bookkeeping only)",
      },
    });

    const moneyOnly = showSiteListing("catalog-web", "harbour-diorama");
    expect(moneyOnly.ok && describeCreatorShare(moneyOnly.value.price)).toMatchObject({
      ok: true,
      value: {
        credits: null,
        money: "6.00 USD creator / 6.00 USD platform (bookkeeping only)",
      },
    });
  });

  it("loses no unit when splitting odd credit and money totals", () => {
    expect(creatorShare(7)).toMatchObject({
      ok: true,
      value: { total: 7, creator: 3, platform: 4 },
    });
    const odd = showSiteListing("catalog-game", "odd-price-charm");
    expect(odd.ok && describeCreatorShare(odd.value.price)).toMatchObject({
      ok: true,
      value: {
        credits: "3 creator / 4 platform credits",
        money: "1.66 USD creator / 1.67 USD platform (bookkeeping only)",
      },
    });
  });

  it("publishes the established 50/50 display rule", () => {
    expect(CREATOR_SHARE_RULE).toMatchObject({
      creatorPercent: 50,
      platformPercent: 50,
    });
    expect(Object.isFrozen(CREATOR_SHARE_RULE)).toBe(true);
  });
});

describe("TEST purchase flow refuses without fake completion", () => {
  it.each(["credits", "money"] as const)(
    "refuses the dual-priced fixture through %s before completion",
    (payWith) => {
      const result = attemptCatalogPurchase({
        surface: "catalog-game",
        itemId: "market-stall-kit",
        payWith,
      });
      expect(result).toMatchObject({
        ok: false,
        reason: "CATALOG_COMMERCE_INERT",
        mode: "test",
        completion: "none",
        registryCite: "factories-helpers#42",
      });
    },
  );

  it("refuses a payment method the seller did not offer", () => {
    expect(
      attemptCatalogPurchase({
        surface: "catalog-game",
        itemId: "lantern-prop",
        payWith: "money",
      }),
    ).toMatchObject({
      ok: false,
      reason: "CATALOG_PURCHASE_METHOD_UNAVAILABLE",
    });
  });

  it("refuses a missing fixture before treating it as a purchase", () => {
    expect(
      attemptCatalogPurchase({
        surface: "catalog-web",
        itemId: "nope",
        payWith: "money",
      }),
    ).toMatchObject({ reason: "CATALOG_ITEM_NOT_FOUND" });
  });

  it("builds a display-only publish intent and refuses submission", () => {
    const intent = createPublishIntent({
      creatorId: "usr_creator_ada",
      surface: "catalog-game",
      title: "New prop",
      price: {
        credits: 80,
        money: { unitAmount: 800, currency: "usd" },
      },
    });
    expect(intent.ok).toBe(true);
    if (!intent.ok) return;
    expect(intent.value.submittable).toBe(false);
    expect(intent.value.share).toEqual({ total: 80, creator: 40, platform: 40 });
    expect(submitPublishIntent(intent.value)).toMatchObject({
      ok: false,
      reason: "CATALOG_COMMERCE_INERT",
      mode: "test",
      completion: "none",
    });
  });
});

describe("editor deep link", () => {
  it("round-trips links for committed Game and Web fixtures", () => {
    const game = buildEditorDeepLink({
      umbrellaOrigin: UMBRELLA,
      source: "catalog-game",
      itemId: "market-stall-kit",
      artifactRef: "artifact-1",
    });
    expect(game.ok).toBe(true);
    if (!game.ok) return;
    expect(parseEditorDeepLink(game.value)).toMatchObject({
      ok: true,
      value: {
        source: "catalog-game",
        itemId: "market-stall-kit",
        artifactRef: "artifact-1",
      },
    });

    const web = buildEditorDeepLink({
      umbrellaOrigin: UMBRELLA,
      source: "catalog-web",
      itemId: "harbour-diorama",
    });
    expect(web.ok && parseEditorDeepLink(web.value)).toMatchObject({
      ok: true,
      value: {
        source: "catalog-web",
        itemId: "harbour-diorama",
        artifactRef: null,
      },
    });
  });

  it("allows localhost development and refuses insecure or malformed origins", () => {
    expect(
      buildEditorDeepLink({
        umbrellaOrigin: "http://localhost:3000",
        source: "catalog-game",
        itemId: "lantern-prop",
      }).ok,
    ).toBe(true);

    for (const origin of ["http://evil.example", "not-a-url", ""]) {
      expect(
        buildEditorDeepLink({
          umbrellaOrigin: origin,
          source: "catalog-game",
          itemId: "lantern-prop",
        }),
      ).toMatchObject({ ok: false, reason: "DEEP_LINK_ORIGIN_INSECURE" });
    }
  });

  it("refuses unknown sources, missing items, and extra parameters", () => {
    expect(
      buildEditorDeepLink({
        umbrellaOrigin: UMBRELLA,
        source: "kids" as unknown as CatalogSurface,
        itemId: "x",
      }),
    ).toMatchObject({ reason: "DEEP_LINK_SOURCE_UNKNOWN" });
    expect(
      parseEditorDeepLinkParams({
        source: "catalog-game",
        item: "market-stall-kit",
        token: "abc",
      }),
    ).toMatchObject({ reason: "DEEP_LINK_UNKNOWN_PARAMETER" });
    expect(parseEditorDeepLinkParams({ source: "catalog-web" })).toMatchObject({
      reason: "DEEP_LINK_ITEM_MISSING",
    });
  });
});
