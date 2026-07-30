/**
 * The committed credit-pack catalog, as a bundled module.
 *
 * The canonical list stays the contract fixture
 * (`CREDIT_PACKS_FIXTURES_PATH`), which `docs/auth-credits.md` and
 * `pnpm check:contracts` keep in lockstep; this module is that fixture's
 * bundled twin, and the same contract check fails closed if the two ever drift.
 *
 * It exists because the catalog is read on a deployed site. The `sites/` tier is
 * bundled for a serverless target, where a `readFileSync` against a
 * package-relative path is not guaranteed to be traced into the deployment — the
 * same reason `@sceneaxi/site-kit` holds its starter Sculpt Intake as a module.
 * A module is always bundled, so `/pricing` lists packs wherever it is deployed
 * rather than refusing on a packaging fault.
 *
 * Typed `unknown` on purpose: it is validated by
 * `validateCreditPackCatalogArchive` like any other inbound contract value, so
 * a hand edit here cannot smuggle an unvalidated revision into checkout or
 * historical resolution.
 */

export const CREDIT_PACK_CATALOG_DATA: unknown = Object.freeze(
{
  "schemaVersion": 1,
  "mode": "test",
  "currentRevisionIds": [
    "starter-v1",
    "maker-v1",
    "studio-v1"
  ],
  "packRevisions": [
    {
      "revisionId": "starter-v1",
      "packId": "starter",
      "credits": 100,
      "unitAmount": 500,
      "currency": "usd",
      "stripePriceId": "price_test_starter_100"
    },
    {
      "revisionId": "maker-v1",
      "packId": "maker",
      "credits": 500,
      "unitAmount": 2000,
      "currency": "usd",
      "stripePriceId": "price_test_maker_500"
    },
    {
      "revisionId": "studio-v1",
      "packId": "studio",
      "credits": 2000,
      "unitAmount": 7000,
      "currency": "usd",
      "stripePriceId": "price_test_studio_2000"
    }
  ]
}
);
