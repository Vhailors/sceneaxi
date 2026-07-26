/**
 * The committed catalog listing set, as a bundled module.
 *
 * The canonical list stays the contract fixture
 * (`CATALOG_LISTINGS_FIXTURES_PATH`), which `docs/auth-credits.md` and
 * `pnpm check:contracts` keep in lockstep; this module is that fixture's
 * bundled twin, and the same contract check fails closed if the two ever drift.
 *
 * It exists for the same reason `credit-packs.data.ts` does: the listing set is
 * reachable from a deployed site through `@sceneaxi/billing`, and a bundler
 * cannot resolve a package-relative file read — webpack turns the dynamic
 * specifier into a stub that fails to parse, so the *module* breaks before any
 * try/catch around the read can refuse. A module is always bundled, so the
 * listing set loads wherever it is deployed rather than taking the site down.
 *
 * Typed `unknown` on purpose: it is validated by `validateCatalogListingSet`
 * like any other inbound contract value, so a hand edit here cannot smuggle an
 * unvalidated listing set into the purchase path.
 */

export const CATALOG_LISTINGS_DATA: unknown = Object.freeze(
{
  "schemaVersion": 1,
  "mode": "test",
  "listings": [
    {
      "schemaVersion": 1,
      "kind": "sceneaxi.catalog-listing",
      "listingId": "lantern-prop",
      "catalog": "game",
      "sellerUserId": "usr_creator_ada",
      "title": "Hand-carved lantern prop",
      "priceMode": "credits",
      "creditPrice": 40,
      "publishedAt": "2026-07-20T12:00:00Z"
    },
    {
      "schemaVersion": 1,
      "kind": "sceneaxi.catalog-listing",
      "listingId": "harbour-diorama",
      "catalog": "web",
      "sellerUserId": "usr_creator_ben",
      "title": "Harbour diorama scene",
      "priceMode": "money",
      "moneyPrice": {
        "unitAmount": 1200,
        "currency": "usd",
        "stripePriceId": "price_test_harbour_diorama"
      },
      "publishedAt": "2026-07-21T12:00:00Z"
    },
    {
      "schemaVersion": 1,
      "kind": "sceneaxi.catalog-listing",
      "listingId": "market-stall-kit",
      "catalog": "game",
      "sellerUserId": "usr_creator_ada",
      "title": "Modular market stall kit",
      "priceMode": "credits-and-money",
      "creditPrice": 75,
      "moneyPrice": {
        "unitAmount": 2500,
        "currency": "usd",
        "stripePriceId": "price_test_market_stall_kit"
      },
      "publishedAt": "2026-07-22T12:00:00Z"
    },
    {
      "schemaVersion": 1,
      "kind": "sceneaxi.catalog-listing",
      "listingId": "odd-price-charm",
      "catalog": "game",
      "sellerUserId": "usr_creator_ben",
      "title": "Odd-price charm (covers remainder rounding)",
      "priceMode": "credits-and-money",
      "creditPrice": 7,
      "moneyPrice": {
        "unitAmount": 333,
        "currency": "usd",
        "stripePriceId": "price_test_odd_price_charm"
      },
      "publishedAt": "2026-07-23T12:00:00Z"
    }
  ]
}
);
