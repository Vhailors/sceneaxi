# Websites deploy

How the three first-party SceneAxi sites are built, configured, and deployed.

**No secret value appears in this document or anywhere in the repository.** Names only;
values are set in the Vercel project by whoever holds them. `pnpm check:sites` fails the
gate if a secret-shaped value or an assigned secret name is ever committed under
`sites/`.

Design decisions behind this: [ADR 0018](adr/0018-sites-tier-three-vercel-one-neon.md)
(the `sites/` tier, three projects, one database),
[ADR 0019](adr/0019-public-engine-sdk-zip-not-npm.md) (the SDK archive), and
[ADR 0020](adr/0020-minimum-e2-web-editor-entitlement.md) (editor entitlement).

## Vercel project map

| Site | Directory | Package | Vercel project | Owns |
|---|---|---|---|---|
| Umbrella | `sites/umbrella` | `@sceneaxi/site-umbrella` | `sceneaxi-umbrella` | product/docs, public engine SDK download, account, credit packs, Minimum E2 editor |
| Game-asset catalog | `sites/catalog-game` | `@sceneaxi/site-catalog-game` | `sceneaxi-catalog-game` | game-asset browse/detail, dual pricing, creator share, editor deep links |
| Website-asset catalog | `sites/catalog-web` | `@sceneaxi/site-catalog-web` | `sceneaxi-catalog-web` | website-asset browse/detail, same bar |

One Vercel team (prefer `vhailpers-projects`). **`*.vercel.app` hostnames only** — no
custom domain in this wave. **Kids is not deployed**, and no site links to it.

Deployed production URLs:

| Site | URL |
|---|---|
| Umbrella | <https://sceneaxi-umbrella.vercel.app> |
| Game-asset catalog | <https://sceneaxi-catalog-game.vercel.app> |
| Website-asset catalog | <https://sceneaxi-catalog-web.vercel.app> |

Per project, in Vercel:

| Setting | Value |
|---|---|
| Root Directory | the site's directory above |
| Framework preset | Next.js |
| Node version | 24 |
| Install command | `cd ../.. && pnpm install --frozen-lockfile --ignore-scripts && cd <site dir> && pnpm install --frozen-lockfile` |
| Build command | `pnpm run build` (the umbrella's `prebuild` also generates the SDK archive) |

The install command provisions **both** roots, and it has to. Each site is the sole
member of its own pnpm workspace (`packages: ["."]`), not a member of the repository-root
workspace. A site installs `@sceneaxi/site-kit` through a `link:` specifier, but
`site-kit`'s own dependencies (`@sceneaxi/schemas`, `@sceneaxi/authoring-core`) are
workspace packages resolved from the repository root's `node_modules`. Installing only
the site directory builds successfully on a developer machine that already has a root
install and then fails on a clean Vercel builder with `Can't resolve
'@sceneaxi/schemas'`. Root Directory must be set on the project so the whole repository
uploads; a CLI deploy from inside the site directory uploads that directory alone and
cannot work.

## Environment variables

Set in **Production** scope. `NEXT_PUBLIC_*` values are inlined at **build** time, so
set them *before* deploying and redeploy after changing one.

| Variable | Projects | Owner | Required for | Purpose |
|---|---|---|---|---|
| `DATABASE_URL` | all three | captain (Neon) | the identity plane | one shared Neon Postgres database: auth/billing plus catalog read models |
| `SCENEAXI_ADMIN_EMAIL` | umbrella | captain | admin sign-in | sole admin identity (`hajczuk.dominik@gmail.com`), resolved by `@sceneaxi/auth` |
| `SCENEAXI_ADMIN_BOOTSTRAP_SECRET` | umbrella | captain | first admin sign-in | first-run admin credential material; env-secret bootstrap only |
| `STRIPE_SECRET_KEY` | umbrella | captain | credit-pack checkout | **TEST** key (`sk_test_…`) only in this wave |
| `STRIPE_WEBHOOK_SECRET` | umbrella | captain | credit grants | webhook signature secret; verification is owned by `@sceneaxi/billing` |
| `SCENEAXI_BILLING_MODE` | umbrella | this ship | optional | `test` when unset; `live` still refuses without explicit live authorization |
| `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` | both catalogs | this ship | editor deep links | https `*.vercel.app` umbrella origin; a missing or non-https value makes the catalog refuse to render the link |
| `NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN` | umbrella | this ship | optional | family cross-link |
| `NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN` | umbrella | this ship | optional | family cross-link |
| `SCENEAXI_SITE_EDITOR_PREVIEW` | umbrella | captain | optional | `1` grants a banner-marked editor preview before the identity plane lands; absent means the editor refuses. Server-side only; a client value is ignored |

Each site's `.env.example` lists only names assigned to that Vercel project, including
the future identity-plane plug point names, and commits no values.

### Neon

One project, one database, shared by all three sites. Capture the connection string as a
Vercel secret; it appears in no committed file. Migration order and DDL belong to
`sceneaxi-auth-credits-v1` (`db/migrations/`), not to this wave.

Provisioned: Neon project `sceneaxi-prod` (`misty-king-68383952`, `aws-us-east-2`,
database `neondb`). `DATABASE_URL` is set as an **encrypted** environment variable in all
three Vercel projects and appears in no committed file. No code reads it yet — the
identity plane that will belongs to `sceneaxi-auth-credits-v1`.

### Stripe

**Test mode only.** Going live is a separate captain decision: the billing port refuses
`live` unless explicitly authorized, so a stray `SCENEAXI_BILLING_MODE=live` cannot start
real charges on its own.

## Deploy checklist

1. Provision the shared Neon project and database; capture `DATABASE_URL`.
2. Create the three Vercel projects on one team with the settings above.
3. Set the environment variables per project (Production scope).
4. Deploy each project; record its `*.vercel.app` production URL.
5. Set `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` on both catalogs to the umbrella URL, and
   optionally the two catalog origins on the umbrella, then **redeploy** those projects —
   these are build-time values.
6. Run the verification below and record the output.

## Verification

```sh
UMB=https://<umbrella>.vercel.app
GAME=https://<game-catalog>.vercel.app
WEB=https://<web-catalog>.vercel.app

# Umbrella pages
for p in / /docs /engine /pricing /account /editor; do
  printf '%s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$UMB$p")"
done

# The served archive must hash to the published checksum
curl -s "$UMB/engine" | grep -oE '[0-9a-f]{64}' | head -1
curl -sL -o sdk.zip "$UMB/engine-sdk/sceneaxi-engine-sdk-<version>.zip"
sha256sum sdk.zip
unzip -t sdk.zip

# Catalogs, including a contract-driven 404 and cross-surface ownership
curl -s -o /dev/null -w '%{http_code}\n' "$GAME/"
curl -s -o /dev/null -w '%{http_code}\n' "$GAME/item/game-lantern-prop"
curl -s -o /dev/null -w '%{http_code}\n' "$GAME/item/nope"                # 404
curl -s -o /dev/null -w '%{http_code}\n' "$WEB/item/game-lantern-prop"    # 404
```

Expected: pages 200; the served zip's SHA-256 equal to the digest `/engine` publishes;
an unknown item id 404; neither storefront resolving the other's ids; `/account`
rendering an honest refusal while the identity plane is unwired; and `/editor` refusing
without the preview flag.

## Building the SDK archive

```sh
pnpm build:sdk                                        # → dist-sdk/
node scripts/build-engine-sdk.mjs --out <dir>          # anywhere, relative to cwd
```

The umbrella's `prebuild` writes it into `public/engine-sdk/`, which is gitignored — the
archive is generated, never committed. The build is deterministic, so the site's copy and
the CI artifact (`.github/workflows/engine-sdk.yml`) carry the same SHA-256. Verify with:

```sh
sha256sum -c sceneaxi-engine-sdk-<version>.zip.sha256
```

## Activating the identity plane

Sign-in, credit balances, and credit-pack checkout are owned by
`sceneaxi-auth-credits-v1` ([#90](https://github.com/Vhailors/sceneaxi/issues/90)):
single-admin resolution, fail-closed role guards, the append-only credit ledger, and
Stripe webhook verification. This wave does **not** fork any of it. Until those packages
exist, every plane is unwired and the umbrella refuses with named reasons
(`IDENTITY_PLANE_NOT_WIRED`, `CREDITS_PLANE_NOT_WIRED`, `BILLING_PLANE_NOT_WIRED`) rather
than showing an invented session, balance, or price.

`sites/umbrella/src/lib/identity-plane.ts` is the **single** plug point. When that
vertical merges:

1. Add `@sceneaxi/auth` and `@sceneaxi/billing` to the `@sceneaxi/site-umbrella` allow
   list in `docs/dependency-matrix.json`. The boundary checker refuses the dependency
   until this is done deliberately, which is what stops a half-wired plane from shipping.
2. Add both packages to `sites/umbrella/package.json` as `link:` dependencies and to
   `transpilePackages` in `sites/umbrella/next.config.ts`.
3. Construct their adapters in `identity-plane.ts` and pass them to
   `createUmbrellaIdentityPlane`. No other site file changes.
4. Run that vertical's Neon migrations against the shared database.
5. Remove `SCENEAXI_SITE_EDITOR_PREVIEW` from the umbrella project, since entitlement can
   now be resolved for real.

The site ports are structural projections of that vertical's contracts (`Principal`,
`User`, `Session`, `CreditLedgerEntry`, `CreditPack`, `CheckoutSessionIntent`), so its
exports satisfy them as injected adapters with no redefinition of identity or ledger
semantics. The ports speak that vertical's identity-surface vocabulary
(`IDENTITY_SURFACES`): all three deployable sites map onto the `"site"` identity surface,
while the umbrella / catalog-game / catalog-web identifiers stay for routing, branding,
catalog lookup, and deep links and are not identity surfaces.

## Outstanding captain secrets

Everything free is live now. Three captain-held secrets are still absent, and were not
invented or faked:

| Variable | Blocks | Why it is not set |
|---|---|---|
| `STRIPE_SECRET_KEY` (test) | credit-pack checkout | captain-held; no Stripe test key is available to this worker |
| `STRIPE_WEBHOOK_SECRET` | credit grants from checkout | captain-held; created with the webhook endpoint |
| `SCENEAXI_ADMIN_BOOTSTRAP_SECRET` | first admin sign-in | captain-held credential material |

`SCENEAXI_ADMIN_EMAIL` is known (`hajczuk.dominik@gmail.com`) but is only meaningful once
`@sceneaxi/auth` exists to resolve it, so it is documented rather than set. None of these
block anything shipped in this wave: the surfaces that need them refuse with named
reasons today and would refuse identically with the keys present but the identity plane
absent.

## What is not deployed or activated

Kids · custom domains · Stripe live mode · catalog asset checkout (tier-6b marketplace
activation stays an open captain decision, so purchase and publish refuse
`CATALOG_COMMERCE_INERT`) · npm publication of any package · editor project persistence.
