import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATALOG_SURFACES,
  CREATOR_SHARE_RULE,
  type CatalogSurface,
  attemptCatalogPurchase,
  buildEditorDeepLink,
  createPublishIntent,
  creatorShare,
  describeListingPrice,
  listSiteCatalog,
  parseEditorDeepLink,
  parseEditorDeepLinkParams,
  showSiteListing,
  submitPublishIntent,
} from "@sceneaxi/site-kit";
import { COMMERCE_ACTIVATION_GATE } from "@sceneaxi/schemas";

const UMBRELLA = "https://sceneaxi-umbrella.vercel.app";

describe("listed catalog fixtures", () => {
  it.each([...CATALOG_SURFACES])("%s publishes at least one listed fixture", (surface) => {
    const listings = listSiteCatalog(surface);
    expect(listings.length).toBeGreaterThan(0);
    for (const listing of listings) {
      expect(listing.surface).toBe(surface);
      expect(listing.item.moderation.pipelineState).toBe("listed");
      expect(listing.item.assetPackage.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(listing.item.aiGenerationDisclosure.disclosureText.length).toBeGreaterThan(0);
    }
  });

  it("records a human curation verdict on the way to listed", () => {
    const listing = listSiteCatalog("catalog-game")[0];
    expect(listing).toBeDefined();
    const approvals = listing?.item.moderation.history.filter(
      (record) => record.to === "listed",
    );
    expect(approvals?.length).toBe(1);
  });

  it("keeps every fixture deep-frozen", () => {
    const listing = listSiteCatalog("catalog-web")[0];
    expect(Object.isFrozen(listing)).toBe(true);
    expect(Object.isFrozen(listing?.item)).toBe(true);
    expect(Object.isFrozen(listing?.item.rights)).toBe(true);
  });

  it("validates every fixture against the published Catalog Item schema", () => {
    const schema = JSON.parse(
      readFileSync(
        new URL("../../schemas/contracts/catalog-item.schema.json", import.meta.url),
        "utf8",
      ),
    ) as { readonly required?: readonly string[] };
    const required = schema.required ?? [];
    expect(required.length).toBeGreaterThan(0);
    for (const surface of CATALOG_SURFACES) {
      for (const listing of listSiteCatalog(surface)) {
        for (const field of required) {
          expect(listing.item).toHaveProperty(field);
        }
      }
    }
  });

  it("refuses an unknown item id so a detail route can answer 404", () => {
    expect(showSiteListing("catalog-game", "nope")).toMatchObject({
      ok: false,
      reason: "CATALOG_ITEM_NOT_FOUND",
    });
    expect(showSiteListing("catalog-game", "web-hero-diorama")).toMatchObject({
      ok: false,
      reason: "CATALOG_ITEM_NOT_FOUND",
    });
  });

  it("keeps the two storefronts distinct — neither publishes the other's items", () => {
    const gameIds = listSiteCatalog("catalog-game").map((listing) => listing.itemId);
    const webIds = listSiteCatalog("catalog-web").map((listing) => listing.itemId);
    expect(gameIds.length).toBeGreaterThan(0);
    expect(webIds.length).toBeGreaterThan(0);
    expect(gameIds.filter((id) => webIds.includes(id))).toEqual([]);
  });
});

describe("dual price display", () => {
  it("renders credits only, money only, and both", () => {
    expect(describeListingPrice({ credits: 40, money: null })).toMatchObject({
      ok: true,
      value: { credits: "40 credits", money: null, label: "40 credits" },
    });
    expect(
      describeListingPrice({ credits: null, money: { amount: "6.00", currency: "usd" } }),
    ).toMatchObject({ ok: true, value: { credits: null, money: "6.00 USD" } });
    const both = describeListingPrice({
      credits: 35,
      money: { amount: "3.50", currency: "usd" },
    });
    expect(both.ok && both.value.label).toBe("35 credits or 3.50 USD");
  });

  it("singularizes one credit", () => {
    const display = describeListingPrice({ credits: 1, money: null });
    expect(display.ok && display.value.credits).toBe("1 credit");
  });

  it("refuses a listing that offers neither price", () => {
    expect(describeListingPrice({ credits: null, money: null })).toMatchObject({
      ok: false,
      reason: "CATALOG_PRICE_UNAVAILABLE",
    });
  });

  it("gives every shipped fixture a showable price", () => {
    for (const surface of CATALOG_SURFACES) {
      for (const listing of listSiteCatalog(surface)) {
        expect(describeListingPrice(listing.price).ok).toBe(true);
      }
    }
  });
});

describe("creator 50% share", () => {
  it("splits an even total in half", () => {
    expect(creatorShare(100)).toMatchObject({
      ok: true,
      value: { total: 100, creator: 50, platform: 50 },
    });
  });

  it("gives the odd remainder to the platform, losing no unit", () => {
    expect(creatorShare(101)).toMatchObject({
      ok: true,
      value: { total: 101, creator: 50, platform: 51 },
    });
  });

  it("holds creator + platform === total across a deterministic range", () => {
    for (let total = 0; total <= 500; total += 1) {
      const share = creatorShare(total);
      expect(share.ok).toBe(true);
      if (!share.ok) return;
      expect(share.value.creator + share.value.platform).toBe(total);
      expect(share.value.creator).toBeLessThanOrEqual(share.value.platform);
    }
  });

  it("refuses a negative or fractional total", () => {
    expect(creatorShare(-1).ok).toBe(false);
    expect(creatorShare(1.5).ok).toBe(false);
  });

  it("publishes the 50/50 rule for display", () => {
    expect(CREATOR_SHARE_RULE.creatorPercent).toBe(50);
    expect(CREATOR_SHARE_RULE.platformPercent).toBe(50);
    expect(Object.isFrozen(CREATOR_SHARE_RULE)).toBe(true);
  });
});

describe("commerce stays inert while tier-6b keys are open", () => {
  it("refuses a purchase of a listed fixture and carries the gate policy and registry cite", () => {
    const result = attemptCatalogPurchase({
      surface: "catalog-game",
      itemId: "game-lantern-prop",
      payWith: "credits",
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      reason: "CATALOG_COMMERCE_INERT",
      registryCite: "factories-helpers#42",
    });
    expect("gate" in result && result.gate.policy).toBe(COMMERCE_ACTIVATION_GATE.policy);
  });

  it("refuses a purchase of an unknown item as not-found, not as a purchase", () => {
    expect(
      attemptCatalogPurchase({ surface: "catalog-web", itemId: "nope", payWith: "money" }),
    ).toMatchObject({ reason: "CATALOG_ITEM_NOT_FOUND" });
  });

  it("builds a display-only publish intent with the share preview and refuses submission", () => {
    const intent = createPublishIntent({
      creatorId: "Vhailors",
      surface: "catalog-game",
      title: "New prop",
      price: { credits: 80, money: { amount: "8.00", currency: "usd" } },
    });
    expect(intent.ok).toBe(true);
    if (!intent.ok) return;
    expect(intent.value.submittable).toBe(false);
    expect(intent.value.share).toEqual({ total: 80, creator: 40, platform: 40 });
    expect(submitPublishIntent(intent.value)).toMatchObject({
      ok: false,
      reason: "CATALOG_COMMERCE_INERT",
    });
  });

  it("refuses a publish intent with no showable price", () => {
    expect(
      createPublishIntent({
        creatorId: "Vhailors",
        surface: "catalog-web",
        title: "Priceless",
        price: { credits: null, money: null },
      }),
    ).toMatchObject({ ok: false, reason: "CATALOG_PRICE_UNAVAILABLE" });
  });

  it("keeps every shipped fixture structurally inert", () => {
    for (const surface of CATALOG_SURFACES) {
      for (const listing of listSiteCatalog(surface)) {
        expect(listing.item.commerce.activation).toBe("inert");
      }
    }
  });
});

describe("editor deep link", () => {
  it("round-trips a link with and without an artifact ref", () => {
    const link = buildEditorDeepLink({
      umbrellaOrigin: UMBRELLA,
      source: "catalog-game",
      itemId: "game-lantern-prop",
      artifactRef: "artifact-1",
    });
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(link.value.startsWith(`${UMBRELLA}/editor?`)).toBe(true);
    expect(parseEditorDeepLink(link.value)).toMatchObject({
      ok: true,
      value: { source: "catalog-game", itemId: "game-lantern-prop", artifactRef: "artifact-1" },
    });

    const bare = buildEditorDeepLink({
      umbrellaOrigin: UMBRELLA,
      source: "catalog-web",
      itemId: "web-hero-diorama",
    });
    expect(bare.ok && parseEditorDeepLink(bare.value)).toMatchObject({
      ok: true,
      value: { artifactRef: null },
    });
  });

  it("allows http://localhost so development needs no second code path", () => {
    expect(
      buildEditorDeepLink({
        umbrellaOrigin: "http://localhost:3000",
        source: "catalog-game",
        itemId: "game-crate-set",
      }).ok,
    ).toBe(true);
  });

  it.each([
    ["http://evil.example", "DEEP_LINK_ORIGIN_INSECURE"],
    ["not-a-url", "DEEP_LINK_ORIGIN_INSECURE"],
    ["", "DEEP_LINK_ORIGIN_INSECURE"],
  ])("refuses building against origin %s", (origin, reason) => {
    expect(
      buildEditorDeepLink({ umbrellaOrigin: origin, source: "catalog-game", itemId: "x" }),
    ).toMatchObject({ ok: false, reason });
  });

  it("refuses an unknown source and a missing item", () => {
    expect(
      buildEditorDeepLink({
        umbrellaOrigin: UMBRELLA,
        source: "kids" as unknown as CatalogSurface,
        itemId: "x",
      }),
    ).toMatchObject({ reason: "DEEP_LINK_SOURCE_UNKNOWN" });
    expect(
      buildEditorDeepLink({ umbrellaOrigin: UMBRELLA, source: "catalog-game", itemId: " " }),
    ).toMatchObject({ reason: "DEEP_LINK_ITEM_MISSING" });
  });

  it.each([
    [`${UMBRELLA}/editor?source=kids&item=x`, "DEEP_LINK_SOURCE_UNKNOWN"],
    [`${UMBRELLA}/editor?source=catalog-game`, "DEEP_LINK_ITEM_MISSING"],
    [`${UMBRELLA}/editor?source=catalog-game&item=x&session=abc`, "DEEP_LINK_UNKNOWN_PARAMETER"],
    [`http://evil.example/editor?source=catalog-game&item=x`, "DEEP_LINK_ORIGIN_INSECURE"],
  ])("refuses parsing %s", (href, reason) => {
    expect(parseEditorDeepLink(href)).toMatchObject({ ok: false, reason });
  });

  it("refuses a link that tries to carry a session across the surface boundary", () => {
    expect(
      parseEditorDeepLinkParams({ source: "catalog-game", item: "x", token: "abc" }),
    ).toMatchObject({ ok: false, reason: "DEEP_LINK_UNKNOWN_PARAMETER" });
  });

  it("parses route params a Next handler already holds", () => {
    expect(
      parseEditorDeepLinkParams({ source: "catalog-web", item: "web-ui-panel-kit" }),
    ).toMatchObject({ ok: true, value: { source: "catalog-web", artifactRef: null } });
    expect(parseEditorDeepLinkParams({ source: "catalog-web" })).toMatchObject({
      ok: false,
      reason: "DEEP_LINK_ITEM_MISSING",
    });
  });
});
