# Websites deploy

How the three first-party SceneAxi sites are built, configured, and deployed.

[`production-activation.md`](production-activation.md) is the **sole ordered
activation and rollback owner**: the authorization gate, the order operator actions are
taken in, and the evidence checklist all live there. This document remains the
authoritative web topology, configuration, provider-wiring, and verification owner, and
holds the mechanics each of those steps needs — but it carries no ordered procedure of
its own and does not authorize a deployment or alias move.

**No secret value appears in this document or anywhere in the repository.** Names only;
values are set in the Vercel project by whoever holds them. `pnpm check:sites` fails the
gate if a secret-shaped value or an assigned secret name is ever committed under
`sites/`.

Design decisions behind this: [ADR 0018](adr/0018-sites-tier-three-vercel-one-neon.md)
(the `sites/` tier, three projects, one database),
[ADR 0019](adr/0019-public-engine-sdk-zip-not-npm.md) (the SDK archive),
[ADR 0020](adr/0020-minimum-e2-web-editor-entitlement.md) (editor entitlement), and
[ADR 0021](adr/0021-identity-credits-injected-adapters.md) (the identity plane's
provider clients stay injected adapters outside hermetic core; production SDKs are
confined to the umbrella install root).

## Vercel project map

| Site | Directory | Package | Vercel project | Owns |
|---|---|---|---|---|
| Umbrella | `sites/umbrella` | `@sceneaxi/site-umbrella` | `sceneaxi-umbrella` | product/docs, the public live open path (`/open`), the profile capability matrix (`/profiles`), engine SDK download, account, credit packs, Minimum E2 editor |
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

Both catalog builds fetch Archivo and JetBrains Mono over the network through
`next/font/google`, which self-hosts them into the build output, so the deployed
storefront issues no runtime third-party font request but the **builder** needs egress to
Google Fonts. Why the sites load their own faces rather than take them from a package is
owned by each storefront's README.

The install command provisions **both** roots, and it has to. Each site is the sole
member of its own pnpm workspace (`packages: ["."]`), not a member of the repository-root
workspace. A site installs `@sceneaxi/site-kit` through a `link:` specifier — and the
umbrella also links `@sceneaxi/engine-presentation`, its one engine edge (ADR 0022), plus
`@sceneaxi/auth` and `@sceneaxi/billing`, the identity plane it alone is wired to
(ADR 0021) — but those packages' own dependencies (`@sceneaxi/schemas`,
`@sceneaxi/authoring-core`, `three`) are resolved from the repository root's
`node_modules`. Installing only the site directory builds successfully on a developer
machine that already has a root install and then fails on a clean Vercel builder with
`Can't resolve '@sceneaxi/schemas'`. Root Directory must be set on the project so the
whole repository uploads; a CLI deploy from inside the site directory uploads that
directory alone and cannot work.

The three deployed site workspaces use pnpm's hoisted linker. Next traces from the
monorepo root so their `link:` SceneAxi sources are copied as repository files, while the
flat site `node_modules` keeps pnpm's isolated dependency-symlink graph out of Vercel
Functions.

Each deployed site declares the linker **twice**, and `pnpm check:sites` requires both:
`node-linker=hoisted` in `.npmrc` and `nodeLinker: hoisted` in `pnpm-workspace.yaml`.
Neither file is authoritative alone. pnpm below 10.6 reads the linker only from `.npmrc`;
pnpm 10.6 and later reads it only from `pnpm-workspace.yaml` and ignores the `.npmrc`
key. No site pins a `packageManager`, so neither line is ruled out: CI resolves the
repository-root pin (`pnpm@9.15.0`) while Vercel infers pnpm from
`lockfileVersion: '9.0'`. Dropping either declaration therefore restores the symlink
graph on one of the two lines — with no warning.

Measured on this checkout with a one-dependency install root, reading
`node_modules/.modules.yaml` for the linker pnpm actually resolved:

| pnpm | `.npmrc` only | `pnpm-workspace.yaml` only | both |
|---|---|---|---|
| 9.15.0 | hoisted (flat) | **isolated (symlink)** | hoisted |
| 11.5.0 | **isolated (symlink)** | hoisted (flat) | hoisted |

`node-linker` is not recorded in the lockfile's `settings` block, so adding it keeps
`--frozen-lockfile` installs valid. Where both are read the workspace file wins, so the
two must agree; `pnpm check:sites` compares them after reducing each declaration to the
value its own parser yields — an inline comment dropped, quotes treated as delimiters —
because a raw text comparison both misses `nodeLinker: isolated # …` and invents a
mismatch for `nodeLinker: "hoisted"`.

Every deployed site's `pnpm build` runs
`scripts/check-vercel-package.mjs` as `postbuild`; it reads Next's emitted `.nft.json`
contracts and refuses a trace outside the monorepo, a missing file, a linked package
whose real source is absent, a server-external package the traces do not carry, or a
pnpm package symlink **inside the site install root**. That last scope is deliberate:
the repository root keeps pnpm's isolated store links by design, so refusing those
would name a remediation — the hoisted site linker — that cannot be applied to them.
This is a local package-shape gate, not evidence that a production deployment
succeeded. Kids is not deployed and does not inherit this deployment linker or check.

### Observed trace contents

The tracing-root move raises one question the config cannot answer on its own: whether
`outputFileTracingIncludes`' relative globs still resolve, now that the tracing root and
the project directory differ for the first time. They do — Next 15.5.21's
`collectBuildTraces` takes `dir` and `outputFileTracingRoot` as separate arguments and
globs the includes with `cwd: dir`, the project directory.

Recorded from a local `pnpm build` of `sites/umbrella` on this checkout (Next 15.5.21,
pnpm 11.5.0, hoisted site linker confirmed in `node_modules/.modules.yaml`) — 21
`.nft.json` files, 3577 unique traced paths:

| Traced | Result |
|---|---|
| `@neondatabase/serverless` | 10 files, manifest included |
| `better-auth` | 475 files, manifest included |
| `pg` | 20 files, manifest included |
| `stripe` | 1430 files, manifest included |
| `packages/{auth,billing,engine-presentation,site-kit}/package.json` | all four present |
| `three` | not traced — bundled into the server chunk, never reached through a root-workspace store link |
| paths outside `sites/umbrella` | 8, all real files under `packages/` plus the root manifest |

Both catalogs build and pass the same check. This is local build output: it shows the
emitted package is well-formed, and it claims nothing about a production deployment.

## Environment variables

Set in **Production** scope. `NEXT_PUBLIC_*` values are inlined at **build** time, so
set them *before* deploying and redeploy after changing one.

| Variable | Projects | Owner | Required for | Purpose |
|---|---|---|---|---|
| `DATABASE_URL` | all three | captain (Neon) | the identity plane | one shared Neon Postgres database: auth/billing plus catalog read models |
| `BETTER_AUTH_ORIGIN` | umbrella | deployment owner | identity sign-in | https origin of the Better Auth provider endpoint used by the umbrella; credentials remain with that provider. The provider must serve `POST /api/auth/sign-in/email` and `GET /api/auth/get-session` under that origin — see the provider prerequisite below |
| `BETTER_AUTH_SECRET` | umbrella | captain/provider owner | Better Auth session signing | provider-only signing material read by the umbrella's Better Auth handler; it never enters `@sceneaxi/auth`, a route response, or evidence |
| `SCENEAXI_ADMIN_EMAIL` | umbrella | captain | admin sign-in | sole admin identity, resolved by `@sceneaxi/auth` only inside the deployment plug point; no route accepts an override |
| `SCENEAXI_ADMIN_BOOTSTRAP_SECRET` | umbrella | captain | first admin sign-in | provider-owned first-run credential material; env-secret bootstrap only, never a role source or core input |
| `STRIPE_SECRET_KEY` | umbrella | captain | credit-pack checkout | **TEST** key (`sk_test_…`) only in this wave |
| `STRIPE_WEBHOOK_SECRET` | umbrella | captain | credit grants | signing secret held by the deployment-owned `CreditWebhookCapability` behind `umbrellaRequestAuthority()`; the route never reads or accepts it. Verification remains owned by `@sceneaxi/billing`. Absent means `STRIPE_WEBHOOK_SECRET_MISSING` and `503`, never acceptance |
| `SCENEAXI_BILLING_MODE` | umbrella | this ship | optional | `test` when unset; `live` still refuses without explicit live authorization |
| `SCENEAXI_STRIPE_LIVE_AUTHORIZED` | umbrella | captain | **nothing today** | the single, explicitly named source of live-mode authorization (captain decision D5). Format `live-mode-authorized:<email>:<YYYY-MM-DD>` — it names who authorized live mode and when, so switching to live is an auditable act; anything else, including `true`, authorizes nothing. A second spelling (`STRIPE_LIVE_MODE_AUTHORIZED`, `SCENEAXI_STRIPE_LIVE_AUTHORIZATIONS`, …) refuses **by its presence alone**. **Do not set it:** no shipped call site reads it, live activation is a separate captain decision (ADR 0021), and setting it would grant nothing while suggesting otherwise. Contract: `docs/auth-credits.md` |
| `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` | all three | this ship | editor deep links, checkout redirects, hosted sign-in | https `*.vercel.app` umbrella origin; a missing or non-https value makes the catalog refuse to render the link. On the umbrella it is also the **only** source of the checkout success/cancel URLs — they are never derived from the request's `Host`, and a checkout POST arriving on any other origin refuses `BILLING_CHECKOUT_ORIGIN_UNTRUSTED`. A missing or non-https value refuses `BILLING_CHECKOUT_ORIGIN_UNCONFIGURED` on that path — the umbrella must name one origin, so an alias domain or a per-build preview URL is not a checkout origin. It is also what decides the `Secure` attribute on the `sceneaxi.session` cookie (`resolveSessionCookieSecurity`), for the same reason: behind a TLS-terminating proxy the request the app sees is plain http, so an https origin here keeps the session credential off plaintext even when the incoming request does not look secure. Unconfigured, the flag falls back to `x-forwarded-proto` and then to the request itself, which is what lets `http://localhost` development work unchanged. Finally, it is the origin a sign-in or sign-out submission must come from (`verifyLoginRequestOrigin`): a value that is **supplied but unusable** — non-https, malformed, or whitespace-only — refuses every `POST /api/login` and `POST /api/logout` with `SITE_REQUEST_CROSS_ORIGIN` instead of falling back, because falling back on a broken configuration would accept submissions aimed at an alias host. Only an unconfigured deployment falls back to the request's own origin there, so a typo in this value reads as a deployment nobody can sign in to, never as a looser check |
| `NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN` | all three | this ship | optional | family cross-link. On the catalogs it also drives the family bar: whichever origin is set becomes a link, the store's own entry is marked current instead of linked, and an unset sibling renders as plain text. The entry matching a storefront's own surface is the only source of the domain line it prints, so an unset value prints no domain rather than a guessed one |
| `NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN` | all three | this ship | optional | family cross-link, same rules as the game-catalog origin above |
| `SCENEAXI_SITE_EDITOR_PREVIEW` | umbrella | captain | optional | `1` grants a banner-marked editor preview for a deployment whose identity providers are not configured yet, so no real entitlement can be resolved; absent means the editor refuses. A **temporary fallback**, never the product path — once the [hosted sign-in provider configuration](#hosted-sign-in-provider-configuration) activates `/login`, hosted sign-in ([#185](https://github.com/Vhailors/sceneaxi/issues/185)) is, and the flag is removed. Server-side only; a client value is ignored |

Each site's `.env.example` lists only names assigned to that Vercel project, including
the identity-plane names consumed by the deployment adapters, and commits no values.

### Neon

One project, one database, shared by all three sites. Capture the connection string as a
Vercel secret; it appears in no committed file. Migration order and DDL belong to
`sceneaxi-auth-credits-v1` (`db/migrations/`), not to this wave.

Provisioned: Neon project `sceneaxi-prod` (`misty-king-68383952`, `aws-us-east-2`,
database `neondb`). `DATABASE_URL` is set as an **encrypted** environment variable in all
three Vercel projects and appears in no committed file. The umbrella deployment tier
reads it only to construct the `NeonDatabase` adapter; the root gate never reads it.
`BETTER_AUTH_ORIGIN` names the provider endpoint for sign-in. The provider is hosted in
the existing `sceneaxi-umbrella` project by
`sites/umbrella/src/app/api/auth/[...all]/route.ts`; production therefore sets the origin
to the umbrella's stable HTTPS origin. `BETTER_AUTH_SECRET` and the
`better_auth_*` tables from `db/migrations/0005_better_auth_provider.sql` remain
provider-owned. `resolveBetterAuthOrigin` accepts an
`https` origin, or plaintext `http` only for an exact loopback host (`localhost`,
`127.0.0.1`, `[::1]`) — a look-alike such as `http://localhost.example` resolves to no
provider at all, because the sign-in client posts a member's email and password there.
Anything else leaves `identityPort` absent and the surface refuses by name.

#### Better Auth provider prerequisite

The umbrella ships a deliberately narrow Better Auth 1.6 handler under that origin. It
enables email/password authentication and the `bearer()` plugin, disables public sign-up,
and exposes only these two endpoint/method pairs:
`POST /api/auth/sign-in/email`, whose answer (`{ redirect, token, user }`) carries no
session record, and `GET /api/auth/get-session`, which supplies the session id, owner, and
expiry the `sessions` row is written from. That lookup sends **both** credentials the
provider may accept — the `Set-Cookie` session cookie the sign-in answer issued, replayed
as a `Cookie` header, and the issued token as `Authorization: Bearer` — because stock
Better Auth resolves the session from the cookie while the `bearer()` plugin resolves it
from the header. Either configuration works; a provider that honours neither is a
deployment fault, and the client throws a named error rather than reporting the member's
correct password as a rejected sign-in. A provider that returns a session inline on
sign-in is used as-is and no lookup is made.

Startup is lazy and fail-closed. Missing or malformed `DATABASE_URL`,
`BETTER_AUTH_ORIGIN`, `BETTER_AUTH_SECRET`, `SCENEAXI_ADMIN_EMAIL`, or
`SCENEAXI_ADMIN_BOOTSTRAP_SECRET` returns a redacted provider `503`; an unavailable or
unmigrated Neon database does the same. The first-run credential is idempotently hashed
into Better Auth's provider account table from the two captain-owned bootstrap inputs.
It creates no SceneAxi role: `@sceneaxi/auth` still derives the sole admin only after the
provider authenticated a verified matching address and the SceneAxi store accepted it.

### Stripe

**Test mode only.** Going live is a separate captain decision: the billing port refuses
`live` unless explicitly authorized, so a stray `SCENEAXI_BILLING_MODE=live` cannot start
real charges on its own. `SCENEAXI_BILLING_MODE` selects a *mode*; authorization is a
different variable entirely (`SCENEAXI_STRIPE_LIVE_AUTHORIZED`, above), read only by
`resolveLiveModeAuthorization` and passed to no shipped call site — so setting either, or
both, still refuses `STRIPE_LIVE_MODE_NOT_AUTHORIZED` at intent creation and at the grant.
Nothing infers authorization from the mode, the key prefix, `NODE_ENV`, or anything else
that merely correlates with production; `docs/auth-credits.md` owns that contract.

## Deploy mechanics

What a deployment is made of, and what each piece means. This is **not** a sequence: the
order these are performed in, the authorization each one requires, and the evidence each
must capture belong to the
[activation checklist](production-activation.md#activation-checklist) in
`production-activation.md`. Nothing here authorizes a deployment, an alias move, or a
provider account, and none of it asserts that production is activated.

- **One shared Neon project and database**, reached through `DATABASE_URL` in Production
  scope on all three projects. Provisioning it is provider account creation and carries
  its own separate authority; this document only records what the value is for.
- **Three Vercel projects on one team**, with the roots and settings in the
  [project map](#vercel-project-map) above.
- **Per-project environment variables** in Production scope, exactly the names in
  [Environment variables](#environment-variables). Names only — a value never appears in
  this repository.
- **A production deployment per project**, whose immutable deployment id and
  `*.vercel.app` production URL are recorded before any alias is attached to it.
- **Build-time origins**: `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` on **all three** projects
  set to the umbrella URL — the umbrella needs its own canonical origin for checkout
  redirects — and optionally the two catalog origins. These are build-time values, so
  changing one takes effect only on **redeploy**.
- **The verification below**, run against the real hostnames with its output recorded.

## Verification

```sh
UMB=https://<umbrella>.vercel.app
GAME=https://<game-catalog>.vercel.app
WEB=https://<web-catalog>.vercel.app

# Umbrella pages
for p in / /open /docs /engine /pricing /profiles /account /login /editor; do
  printf '%s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$UMB$p")"
done

# The live open path serves a composed scene and names the product core honestly
curl -s "$UMB/open" | grep -c 'Three presentation core'          # >= 1
curl -s "$UMB/open" | grep -oE 'sha256:[0-9a-f]{64}' | head -1   # the scene digest
curl -s "$UMB/open" | grep -c 'Experimental Three preview'       # 0

# Without the preview flag the editor refuses and opens no canvas. The panel's title is
# now the named access state's, so match the page heading and the key rather than it
curl -s "$UMB/editor" | grep -c 'The editor is not open for this request'   # >= 1
curl -s "$UMB/editor" | grep -c 'IDENTITY_PLANE_NOT_WIRED'       # >= 1, before wiring
curl -s "$UMB/editor" | grep -c 'viewport-canvas'                # 0

# Before the identity plane is wired, sign-in says so and offers no form
curl -s "$UMB/login" | grep -c 'Sign-in is not activated on this deployment'  # >= 1
curl -s "$UMB/login" | grep -c '<form'          # 0, until sign-in providers are wired

# The served archive must hash to the published checksum. `/engine` publishes three
# digests: the SDK archive's first, then the two Linux desktop artifacts
# (docs/desktop-linux.md), which describe binaries this site never serves.
curl -s "$UMB/engine" | grep -oE '[0-9a-f]{64}' | head -1
curl -sL -o sdk.zip "$UMB/engine-sdk/sceneaxi-engine-sdk-<version>.zip"
sha256sum sdk.zip
unzip -t sdk.zip

# Catalogs, including a contract-driven 404 and cross-surface ownership
curl -s -o /dev/null -w '%{http_code}\n' "$GAME/"
curl -s -o /dev/null -w '%{http_code}\n' "$GAME/item/lantern-prop"
curl -s -o /dev/null -w '%{http_code}\n' "$GAME/item/nope"                # 404
curl -s -o /dev/null -w '%{http_code}\n' "$WEB/item/lantern-prop"         # 404
```

Every umbrella viewport — the `/` hero, `/open`, and the entitled `/editor` — draws
pixels only in a browser; WebGL cannot run in node or in `curl`. The curl checks above
verify the served scene and its copy; the pixel
claim is verified by opening each page and reading the frame report it renders (`surface
webgl-canvas`, `pixelsDrawn true`), and the standing record is in
[`three-presentation-core.md`](three-presentation-core.md). `/editor` without the
preview flag serves no canvas at all, which is what the refusal check below asserts.

Expected: pages 200; the served zip's SHA-256 equal to the first digest `/engine`
publishes (the desktop digests below it identify one recorded workflow artifact that
expires, never a file this site serves — [`desktop-linux.md`](desktop-linux.md) owns
that record and its expiry);
an unknown item id 404; neither storefront resolving the other's ids; `/pricing` listing
the three credit packs, its Buy control live only once the TEST Stripe handle is
configured and disabled otherwise; `/account` rendering an honest refusal until the
deployment's provider handles are configured; `/login` naming that same unwired plane
instead of serving a form it cannot honour; and `/editor` refusing without the preview
flag. The per-surface states are owned by [What works now, and what still
refuses](#what-works-now-and-what-still-refuses).

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
Stripe webhook verification. The sites fork **none** of it.

The in-repo wiring is done ([#131](https://github.com/Vhailors/sceneaxi/issues/131),
[#222](https://github.com/Vhailors/sceneaxi/issues/222)):
`@sceneaxi/auth` and `@sceneaxi/billing` are on the umbrella's matrix allow list, are
`link:` dependencies in its manifest and `transpilePackages`, and
`sites/umbrella/src/lib/identity-plane.ts` builds the site-kit adapters over them, while
the provider-only route and Neon schema live in the same deployable install root and
forward migration sequence. What remains is authorized configuration, migration, and
deployment evidence, not a missing provider implementation.

### What works now, and what still refuses

ADR 0021 keeps provider clients outside the hermetic packages. Better Auth, the Neon
client, and the Stripe API may exist only in the umbrella deployable tier, so the plane
splits in two:

| Capability | State | Why |
|---|---|---|
| Credit-pack list on `/pricing` | **live** | read from the committed contract fixture's bundled module (`packages/schemas/src/credit-packs.data.ts`, held in lockstep by `pnpm check:contracts`); needs no provider and no traced file |
| The **Buy** control on `/pricing` | posts to a real checkout once the TEST Stripe handle is configured, but only for a signed-in buyer | the adapter persists the intent before creating a card-only hosted checkout; with no session the POST refuses `IDENTITY_SESSION_ABSENT`, so a visitor signs in at `/login` first and the control refuses by name until then |
| Admin identity (`SCENEAXI_ADMIN_EMAIL`) | **live as deployment evidence** | resolved by `@sceneaxi/auth` only inside the deployment owner and held behind `umbrellaRequestAuthority()`; request routes cannot supply another environment or issuer |
| Checkout intent, starter grant, webhook verification | **live as behaviour** | implemented in-repo and gate-tested |
| Hosted sign-in on `/login` (`POST /api/login`, `POST /api/logout`) | **live as behaviour**; signs a member in once the shipped Better Auth handler + Neon are configured, and refuses `IDENTITY_PLANE_NOT_WIRED` until they are | the whole flow — provider routes, form, named refusal states, HttpOnly `sceneaxi.session` cookie, sign-out — is in-repo and contract-tested ([#185](https://github.com/Vhailors/sceneaxi/issues/185), [#222](https://github.com/Vhailors/sceneaxi/issues/222)); it drives the same `IdentityPort` handle |
| Session verification on `/account`, `/editor` | adapter live when Better Auth + Neon are configured | `verifySession` is wired, and authentication provisions the SceneAxi user and credit account idempotently; the `sessions` row is written by the sign-in above, and that same `IdentityPort` verifies the credential both surfaces read. Unwired they refuse `IDENTITY_PLANE_NOT_WIRED`, and a visitor with no cookie refuses `IDENTITY_SESSION_ABSENT` |
| Credit balance | adapter live; reachable for a signed-in member | the balance is derived from the append-only ledger through `createCreditStore`, and the once-per-user 100-credit starter grant runs on the first authenticated read |
| Hosted checkout redirect | live when the TEST Stripe handle is configured | the adapter uses the committed intent and TEST-only Stripe API call |
| A signed-out visitor | refuses `IDENTITY_SESSION_ABSENT` | not a failure, and shown as "you are not signed in", with `/login` as the action that changes it |

`identity-plane.ts` is the **single** place those handles arrive. It resolves deployment
configuration once and holds the admin witness plus the secret-backed webhook capability
beside the provider handles. Request code reaches it only through the no-argument
`umbrellaRequestAuthority()` facade: identity and billing routes can supply only the
carried session credential, and the webhook route can supply only raw bytes and the
signature header. The boundary checker denies direct owner-module, provider-adapter, and
root-barrel imports from routes or arbitrary library modules. An absent or malformed
provider handle remains absent, so each plane refuses by name rather than inventing a session,
account, balance, or checkout.

Read the table as two separate facts. The provider adapters are wired and gate-tested, so
configuring Better Auth, Neon, and the Stripe TEST key genuinely activates them; the
HTTP/UI layer that turns that into a signed-in browser is now in-repo too
([#185](https://github.com/Vhailors/sceneaxi/issues/185)). The umbrella session credential
is `<sessionId>.<token>` matched against a `sessions` row that only `putSession` writes,
and `putSession` is reached only from `identityPort.signIn` — which `POST /api/login`
drives through the plane's login port, over the deployment's own handle. So an operator
who has configured every mechanic below has a deployment where a member can sign in at
`/login` and reach the entitled `/editor`; with no handle configured, every one of those
surfaces refuses by name instead of inventing a session.

### Activation mechanics

The **order** these are performed in, the authorization each one needs, and the evidence
each one must capture belong to
[`production-activation.md`](production-activation.md) — work from that runbook and treat
the subsections here as the reference for what each step actually entails. They are
grouped by topic, not sequenced, and none of them is a step number other prose may cite.

The three repository-side prerequisites — the `@sceneaxi/site-umbrella` allow list in
`docs/dependency-matrix.json`, both packages as `link:` dependencies and in
`transpilePackages`, and the site-kit adapters built over them in `identity-plane.ts` —
have already landed and need no operator action.

#### Deployment-owner provider handles

The deployment owner returns the capabilities and provider handles held behind `umbrellaRequestAuthority()`:
the exact `AdminIdentity` issued from the one `SCENEAXI_ADMIN_EMAIL`, a secret-holding
`CreditWebhookCapability`, an `IdentityPort`
(`createIdentityPort` over the Neon-backed `IdentityStore` and Better Auth adapter), a
Neon-backed credit store — a `CreditStoreAdapter` handed to `createCreditStore`, never a
`CreditStore` implemented directly, so it inherits the commit invariants
([`auth-credits.md`](auth-credits.md#the-credit-persistence-boundary-sceneaxi128)) — a
`CheckoutSessionAdapter` that persists the intent and turns it into a hosted Stripe
**test** checkout URL, and a `CheckoutEvidencePort` that reads the persisted intent and
the exact Stripe settlement. The adapter provisions the user's one credit account at
authentication with an idempotent insert; the webhook never creates accounts.

The `CheckoutSessionAdapter` and the `CheckoutEvidencePort` beside it owe three things
beyond the URL, because the grant is bound to the intent rather than to the event, and
an implementation that only creates a session captures money and then refuses every
grant — retried by Stripe until it gives up:

- **Persist the intent** under `intent.intentId`, exactly as given, before redirecting,
  and keep the four price-bearing fields it was written with — `credits`, `unit_amount`,
  `currency`, `stripe_price_id` — unchanged for the row's whole life.
  `CheckoutEvidencePort.findIntent(intentId)` must return that same price snapshot; an
  absent one refuses `STRIPE_CHECKOUT_EVIDENCE_MISSING`. The money figure is corroborated
  across two reads, because `parseCheckoutCompletedEvent` compares the retrieved
  settlement against this row. At grant time, `applyCheckoutCompletedGrant` resolves the
  row's `(itemId, stripePriceId, unitAmount)` through the committed archive and requires
  its credits to match the retained revision; the ledger uses that revision's credits,
  not the row or event as an issuance authority ([`auth-credits.md`](auth-credits.md#stripe-test-mode)).
  Unknown tuples refuse `BILLING_CATALOG_REVISION_UNRESOLVABLE` and mismatches refuse
  `BILLING_CATALOG_REVISION_CREDITS_MISMATCH` before the commit boundary. The obligation is
  deliberately field-scoped rather than whole-row: the columns a deployment adds for its
  own operations stay writable, so stamping the hosted Stripe session id onto the row once
  the session exists is expected, and nobody should later re-tighten this into whole-row
  immutability. D2 is implemented over the archived/versioned catalog from
  [PR #173](https://github.com/Vhailors/sceneaxi/pull/173) and adds no migration: the
  grant anchors to that committed archive rather than to the row. D3
  remains a separate decision this change implements no part of,
  but its migration landed in [PR #172](https://github.com/Vhailors/sceneaxi/pull/172):
  once the Neon migrations below are applied, `0003_checkout_session_intent_price_immutability.sql`
  refuses an `UPDATE` to those same four columns in the database, leaving the operational
  ones writable. Do not read that as D3 discharged — auditing this deployment's own writes
  is still outstanding, and this repository cannot see them — and until the migration is
  applied here the field scope rests on the adapter alone, which writes the exact intent
  snapshot before redirecting.
- **Echo the session id on the settlement.** `CheckoutEvidencePort.retrieveSettlement`
  is called with the Checkout Session id read from the verified body, and the
  `CheckoutSettlement` it returns must carry that same id on `sessionId`.
  `parseCheckoutCompletedEvent` compares the two before it reads anything else about the
  settlement, so evidence retrieved for a *different* paid session refuses
  `STRIPE_SETTLEMENT_SESSION_MISMATCH` even when its amount, currency, and price match
  (sceneaxi#127). An adapter that omits the field refuses the same way.
- **Set the Stripe session metadata** to `CHECKOUT_METADATA_KEYS` from
  `@sceneaxi/billing` — `sceneaxiUserId`, `sceneaxiPurpose`, `sceneaxiItemId`,
  `sceneaxiIntentId` — copied from the intent's own `userId` / `purpose` / `itemId` /
  `intentId`. `parseCheckoutCompletedEvent` cross-checks all four plus the mode against
  the persisted intent, so a missing or mismatched key refuses the grant as an invalid
  webhook payload. Set the **same** four keys on `payment_intent_data.metadata` as well:
  Stripe copies those onto the PaymentIntent and its Charge, and a `charge.refunded`
  event carries only the Charge's own metadata. This is the only thing binding a refund
  to the purchase it reverses, and an adapter that stamps the session alone loses it
  quietly rather than loudly — the Charge then carries no SceneAxi key, so the refund is
  read as another product's event and acknowledged `200` with `ignored: true`. Nothing
  refuses, and the reconciliation simply never runs on that deployment.

  Two of the four are *also* routing keys, read from the verified body before the
  intent and the settlement are, because that decision must not depend on a read that
  can fail. `sceneaxiIntentId` names the record to bind to: a completed session
  carrying any SceneAxi key but no usable intent id is refused and retried rather than
  acknowledged as another product's event. `sceneaxiPurpose` decides whether this
  endpoint owes the completion any work at all, so it must be copied from
  `intent.purpose` and never from a literal — a credit-pack checkout stamped with a
  purpose that settles on the revenue-share path is acknowledged `200` with
  `ignored: true` before the intent is read, which ends Stripe's retries and drops the
  grant silently rather than refusing it. An absent, malformed, or unknown purpose does
  not route: it stays on the grant path and meets the parser's cross-check.
#### Neon migrations for the credit vertical

Run that vertical's Neon migrations against the shared database. The migrations create
the `credit_accounts` table and insert **no rows**. The deployment adapter provisions one
account per authenticated user with `INSERT ... ON CONFLICT DO NOTHING`; a missing
account still refuses `CREDITS_PLANE_UNAVAILABLE` rather than becoming a zero balance.
The 100-credit starter grant therefore runs only after a real account exists, and a paid
webhook still refuses `CREDIT_LEDGER_UNAVAILABLE` rather than creating one from payment.

#### Stripe TEST webhook endpoint

Register the webhook endpoint `POST /api/stripe/webhook` in the Stripe **test**
dashboard for **both** event types this endpoint acts on — `checkout.session.completed`
for credit grants and `charge.refunded` for full-refund reconciliation — and set
`STRIPE_WEBHOOK_SECRET` to the signing secret it issues. An endpoint subscribed to only
the completion never receives a refund event, so the refund adjustment silently never
runs: the ledger keeps credits the buyer was paid back for, and nothing refuses, because
an event that was never delivered cannot be refused. Subscribing the endpoint to more
than those two event types is harmless: anything it is not built to act on — another
event type, or a
catalog-listing completion that settles on the revenue-share path — is acknowledged
`200` with `ignored: true` and its named reason, because no grant is owed and no
redelivery could change that. Both acknowledgements are decided from the verified event
body alone, before the intent, the settlement, or the ledger is read, so an expired
session, a foreign-typed event, or a listing completion is never turned into a
permanent retry by a settlement that cannot exist or an account nobody provisioned.

**Keep this Checkout card-only.** A delayed-notification payment method completes the
session before the money confirms, and the confirmation arrives later as
`checkout.session.async_payment_succeeded`, which this endpoint does not handle: it is
acknowledged like any other unhandled type and grants nothing, while the immediate
unpaid completion is refused as an invalid payload. Supporting it needs grant and
idempotency semantics this document deliberately does not add, so the boundary is a scope
decision rather than an omission — enabling such a method in the Stripe dashboard would
take payments this endpoint cannot settle.

#### Hosted sign-in provider configuration

**What opens the deployment to a member** is done in-repo
([sceneaxi#185](https://github.com/Vhailors/sceneaxi/issues/185)): the umbrella exposes
`/login`, `POST /api/login`, and `POST /api/logout` beside `/api/checkout` and
`/api/stripe/webhook`, and `performLogin` calls `identityPort.signIn` through the
plane's login port and sets the HttpOnly `sceneaxi.session` cookie. The provider handler
now ships in the umbrella at `BETTER_AUTH_ORIGIN` (the `sign-in/email` and `get-session`
endpoints named above). What remains operational is to apply migration
`0005_better_auth_provider.sql`, set its named configuration, and configure the handles
the deployment owner holds behind `umbrellaRequestAuthority()`, as described under
[Deployment-owner provider handles](#deployment-owner-provider-handles). With those
configured, sign-in writes a
`sessions` row, provisions the user and the starter grant, and `/account` and `/editor`
verify that credential through the same `IdentityPort`; without them every one of those
surfaces refuses by name.

#### Retiring the editor preview flag

Remove `SCENEAXI_SITE_EDITOR_PREVIEW` from the umbrella project once the hosted sign-in
provider configuration above is in place. Entitlement is resolved for real as soon as a
member can hold a session; the preview flag is a labeled temporary fallback, not the
product path, and dropping it before sign-in works turns `/editor` into a refusal wall
for every visitor.

### How the seam holds

The site ports are structural projections of that vertical's contracts (`Principal`,
`User`, `Session`, `CreditLedgerEntry`, `CreditPack`, `CheckoutSessionIntent`), so its
exports satisfy them as injected adapters with no redefinition of identity or ledger
semantics. The ports speak that vertical's identity-surface vocabulary
(`IDENTITY_SURFACES`): all three non-Kids deployable sites map onto the `"site"` identity surface,
while the umbrella / catalog-game / catalog-web identifiers stay for routing, branding,
catalog lookup, and deep links and are not identity surfaces.

Load-bearing properties, each gate-tested in `tests/sites/identity-plane-wiring.test.ts`:

- **Roles are never client-claimable.** A `role` / `roles` / `admin` / `isAdmin` key on an
  inbound payload refuses at any depth, before any adapter or store is touched. `admin`
  comes only from `SCENEAXI_ADMIN_EMAIL`, resolved and held by the no-argument deployment
  plug point, then re-derived by the identity port on every call. The returned site plane
  does not expose that witness.
- **Session provenance stays in `@sceneaxi/auth`.** The sites never mint or validate a
  session; the umbrella only formats the opaque cookie in both directions — composing
  `<sessionId>.<token>` from the grant the port issues at sign-in, and splitting it back
  into the `sessionId` and token the port expects on every later request — and the
  catalogs forward it untouched.
- **The starter 100 credits are granted exactly once**, keyed `starter:<userId>` by the
  ledger, so the grant is safe to attempt on every balance read and a concurrent second
  reader cannot double it.
- **Credits are granted only behind a deployment-owned verified webhook.** The route calls
  `umbrellaRequestAuthority().applyCreditWebhook()` and supplies only raw bytes and
  the signature header; it never accepts a signing secret, evidence port, store, or clock.
  The capability drives `applyCreditPackWebhook`, and `applyCheckoutCompletedGrant`
  accepts only the output of `parseCheckoutCompletedEvent`, which accepts only the output
  of `verifyStripeWebhookSignature` — checked at **runtime** by object identity, not only
  by type (sceneaxi#126), so an unsigned or forged body has no path to a grant even from
  JavaScript or through an `as` cast, and a copy of a genuine completion refuses too. The
  grant-time archive anchor also refuses a signed/session-bound intent whose credits do not
  match its retained revision, before `persistCheckoutCompletedGrant` can commit.
- **The webhook's answer names the failing side.** A refusal this deployment owns — no
  signing secret, an unusable clock, an adapter that threw, a persisted intent its own
  checkout adapter never wrote, a settlement its own adapter returned for a different
  Checkout Session or without the required `sessionId`, its own ledger rows that do not
  load, its own bundled credit-pack archive that does not validate, a persisted intent
  whose pack tuple or currency no retained revision of that archive resolves, or one whose
  credits do not equal the resolved revision's — answers `503`; a refusal the request owns
  — signature, payload, a session id the verified body itself omits, an intent that does
  not match — answers `400`. The settlement-session refusal sits on the deployment's side
  because both sides of that comparison come from one signature-verified body: the endpoint
  reads the session id out of the verified payload and asks its own `retrieveSettlement`
  for exactly that id, so only the adapter's answer can disagree, and a forged body is
  refused by signature verification long before it. The archive and revision refusals sit
  there for the same shape of reason: both sides are the deployment's own — the intent its
  checkout adapter persisted, and the pack revision this repository commits — so a sender
  decides neither. An event the endpoint is not built to act on is neither: it
  answers `200` with `ignored: true`, so Stripe stops redelivering a condition redelivery
  cannot change. Only `ignored: false` means this event's movement is in the ledger, and
  that outcome states which movement it was: `movement: "grant"` with a positive `credits`
  delta for a purchase, `movement: "refund"` with a negative one for a reconciled full
  refund, so a reversal is never read as a second purchase. Three
  things are acknowledged for any event, and all three are decided from the verified body
  before any
  adapter or store is consulted: an event type this path does not handle, a completion
  whose purpose settles on the revenue-share path, and a checkout session carrying no
  SceneAxi metadata key at all — another product's event. Two more are acknowledged on the
  **refund** path alone, and only because the money is already settled: a partial refund
  (`STRIPE_REFUND_NOT_FULL`) and a balance the buyer has already spent
  (`CREDIT_BALANCE_INSUFFICIENT`). Both keep every fail-closed property — nothing is
  appended, the buyer's credits are untouched, and the response carries the refusal's own
  name — but the retry stops, because neither can change on redelivery and a permanently
  retried non-2xx wears down the endpoint every real grant depends on. A refund that finds
  no committed grant is deliberately not one of them: the grant's own event may still be in
  Stripe's retry sequence, so it refuses `CREDIT_LEDGER_STATE_INVALID` and is retried. The
  purpose is read from the session
  metadata only to route *away* from the grant path — an absent, malformed, or unknown
  one keeps its normal path, and `parseCheckoutCompletedEvent` still cross-checks the
  purpose against the persisted intent for everything that stays on it. A
  `checkout.session.completed` this deployment *did* create is never acknowledged as
  another product's event: if it carries any SceneAxi key but cannot be routed, it is
  refused and retried. `tests/sites/identity-plane-wiring.test.ts` locks both private sets —
  `UNHANDLED_EVENT_REASONS` to the reason symbols representing exactly those three
  decisions and `TERMINAL_REFUND_REASONS` to the two refund ones — and locks every
  acknowledgement the module can emit to them: the one
  path that downgrades a package refusal by consulting them, plus each direct acknowledgement,
  the purpose decision being re-asked of the parsed completion included. It also pins the
  scoping, so the refund-only set can never be consulted for a grant, and a spent balance
  cannot become an acknowledgement for an event that involved no refund. Adding another
  acknowledged reason, or another acknowledgement path, fails the gate.
- **A webhook grant commits through one boundary, everywhere.** The endpoint calls
  `persistCheckoutCompletedGrant` — the same boundary any other deployment uses — so
  there is no second commit path for a paid event (captain decision D4), and `200` with
  `ignored: false` still means the credits are committed. A commit the boundary could not
  confirm refuses `CREDIT_STORE_FAILED` and answers `503`, even when the row did land,
  because this call cannot prove it; Stripe redelivers and the ledger answers the replay.
  A failure is never turned into an acknowledgement, which is what would lose the money
  permanently.
- **The buyer is the verified principal**, not the `userId` the checkout form submitted;
  the submitted value is only cross-checked against it.
- **Unknown is never zero.** A failed ledger read refuses `CREDITS_PLANE_UNAVAILABLE`
  rather than reporting a zero balance, because "you have no credits" and "we could not
  read your credits" must not look identical to a buyer.
- **The catalogs take no second auth stack.** They read identity through the same
  `@sceneaxi/site-kit` port and the matrix denies them `@sceneaxi/auth` and
  `@sceneaxi/billing` outright.

## Verified TEST readiness

The issue [#181](https://github.com/Vhailors/sceneaxi/issues/181) readiness check was
repeated on 2026-08-01 without reading a secret value, creating a credential, sending a
webhook event, or performing a charge:

- Vercel lists `DATABASE_URL`, `SCENEAXI_BILLING_MODE`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, and `SCENEAXI_ADMIN_BOOTSTRAP_SECRET` as encrypted Production
  variable **names** on `sceneaxi-umbrella`. Presence proves only deployment ownership;
  it does not expose or attest a secret value.
- Neon lists the existing shared `sceneaxi-prod` project (`misty-king-68383952`) in
  `aws-us-east-2`, matching the project recorded above. No database connection or
  migration was attempted during this check.
- Stripe lists an enabled, test-mode (`livemode: false`) endpoint at
  `https://sceneaxi-umbrella.vercel.app/api/stripe/webhook` subscribed only to
  `checkout.session.completed`. The available CLI profile has TEST access and no LIVE
  access; SceneAxi's separate live-authorization refusal remains unchanged. That
  observation predates refund reconciliation: until the recorded endpoint is also
  subscribed to `charge.refunded` per [Stripe TEST webhook
  endpoint](#stripe-test-webhook-endpoint), no refund event reaches this deployment and
  the TEST refund proof cannot be run there.
- The umbrella `/` and `/pricing` pages and both catalog roots are reachable. The current
  production umbrella deployment predates the merged hosted-login route and still serves
  `404` at `/login`; `BETTER_AUTH_ORIGIN` is also absent from the umbrella Production
  variable-name listing. `BETTER_AUTH_SECRET` was not part of that observation either.
  Activating member sign-in therefore still requires the [hosted
  sign-in provider configuration](#hosted-sign-in-provider-configuration) and a
  fresh deployment of current `main`. Do not remove `SCENEAXI_SITE_EDITOR_PREVIEW` before
  that sign-in path is proven.

`SCENEAXI_ADMIN_EMAIL` remains the only source of the `admin` role. Its value is
captain-held deployment configuration and is not documented here. Neither its presence nor
the bootstrap-secret name grants anything on its own: a session must be authenticated by
the provider and verified against the real store before any role is derived. Missing or
unusable provider configuration continues to leave handles absent and surfaces refusing by
their existing named reasons.

## What is not deployed or activated

Kids · custom domains · Stripe live mode · catalog asset checkout (tier-6b marketplace
activation stays an open captain decision, so purchase and publish refuse
`CATALOG_COMMERCE_INERT`) · npm publication of any package · editor project persistence ·
catalog intake, whose TEST-only `POST /api/editor/catalog-intake` refuses
`CATALOG_INTAKE_STORAGE_UNAVAILABLE` because no deployment injects a provider
([`catalog-intake.md`](catalog-intake.md) owns that seam).

Stripe LIVE readiness has a complete, deliberately non-executable checklist in
[`docs/stripe-live-activation.md`](stripe-live-activation.md). It does not change this
deployment state: the adapter remains TEST-key-only and the shipped checkout and grant
paths still receive no live-mode authorization.
