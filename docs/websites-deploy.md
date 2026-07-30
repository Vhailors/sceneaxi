# Websites deploy

How the three first-party SceneAxi sites are built, configured, and deployed.

**No secret value appears in this document or anywhere in the repository.** Names only;
values are set in the Vercel project by whoever holds them. `pnpm check:sites` fails the
gate if a secret-shaped value or an assigned secret name is ever committed under
`sites/`.

Design decisions behind this: [ADR 0018](adr/0018-sites-tier-three-vercel-one-neon.md)
(the `sites/` tier, three projects, one database),
[ADR 0019](adr/0019-public-engine-sdk-zip-not-npm.md) (the SDK archive),
[ADR 0020](adr/0020-minimum-e2-web-editor-entitlement.md) (editor entitlement), and
[ADR 0021](adr/0021-identity-credits-injected-adapters.md) (the identity plane's
provider clients stay injected adapters outside this repository).

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

## Environment variables

Set in **Production** scope. `NEXT_PUBLIC_*` values are inlined at **build** time, so
set them *before* deploying and redeploy after changing one.

| Variable | Projects | Owner | Required for | Purpose |
|---|---|---|---|---|
| `DATABASE_URL` | all three | captain (Neon) | the identity plane | one shared Neon Postgres database: auth/billing plus catalog read models |
| `SCENEAXI_ADMIN_EMAIL` | umbrella | captain | admin sign-in | sole admin identity (`hajczuk.dominik@gmail.com`), resolved by `@sceneaxi/auth` |
| `SCENEAXI_ADMIN_BOOTSTRAP_SECRET` | umbrella | captain | first admin sign-in | first-run admin credential material; env-secret bootstrap only |
| `STRIPE_SECRET_KEY` | umbrella | captain | credit-pack checkout | **TEST** key (`sk_test_…`) only in this wave |
| `STRIPE_WEBHOOK_SECRET` | umbrella | captain | credit grants | signing secret for `POST /api/stripe/webhook`; verification is owned by `@sceneaxi/billing`. Absent means the endpoint refuses `STRIPE_WEBHOOK_SECRET_MISSING` rather than accepting an unsigned event, and answers `503` because the omission is this deployment's, not Stripe's |
| `SCENEAXI_BILLING_MODE` | umbrella | this ship | optional | `test` when unset; `live` still refuses without explicit live authorization |
| `SCENEAXI_STRIPE_LIVE_AUTHORIZED` | umbrella | captain | **nothing today** | the single, explicitly named source of live-mode authorization (captain decision D5). Format `live-mode-authorized:<email>:<YYYY-MM-DD>` — it names who authorized live mode and when, so switching to live is an auditable act; anything else, including `true`, authorizes nothing. A second spelling (`STRIPE_LIVE_MODE_AUTHORIZED`, `SCENEAXI_STRIPE_LIVE_AUTHORIZATIONS`, …) refuses **by its presence alone**. **Do not set it:** no shipped call site reads it, live activation is a separate captain decision (ADR 0021), and setting it would grant nothing while suggesting otherwise. Contract: `docs/auth-credits.md` |
| `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` | all three | this ship | editor deep links, checkout redirects | https `*.vercel.app` umbrella origin; a missing or non-https value makes the catalog refuse to render the link. On the umbrella it is also the **only** source of the checkout success/cancel URLs — they are never derived from the request's `Host`, and a checkout POST arriving on any other origin refuses `BILLING_CHECKOUT_ORIGIN_UNTRUSTED`. A missing or non-https value refuses `BILLING_CHECKOUT_ORIGIN_UNCONFIGURED` on that path — the umbrella must name one origin, so an alias domain or a per-build preview URL is not a checkout origin |
| `NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN` | all three | this ship | optional | family cross-link. On the catalogs it also drives the family bar: whichever origin is set becomes a link, the store's own entry is marked current instead of linked, and an unset sibling renders as plain text. The entry matching a storefront's own surface is the only source of the domain line it prints, so an unset value prints no domain rather than a guessed one |
| `NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN` | all three | this ship | optional | family cross-link, same rules as the game-catalog origin above |
| `SCENEAXI_SITE_EDITOR_PREVIEW` | umbrella | captain | optional | `1` grants a banner-marked editor preview while the identity plane has no provider handles, so no real entitlement can be resolved; absent means the editor refuses. Server-side only; a client value is ignored |

Each site's `.env.example` lists only names assigned to that Vercel project, including
the identity-plane names that only take effect once its provider handles arrive, and
commits no values.

### Neon

One project, one database, shared by all three sites. Capture the connection string as a
Vercel secret; it appears in no committed file. Migration order and DDL belong to
`sceneaxi-auth-credits-v1` (`db/migrations/`), not to this wave.

Provisioned: Neon project `sceneaxi-prod` (`misty-king-68383952`, `aws-us-east-2`,
database `neondb`). `DATABASE_URL` is set as an **encrypted** environment variable in all
three Vercel projects and appears in no committed file. No code reads it yet: the
identity plane ships contracts, ports, and migrations only, and its Neon client is an
injected adapter that lives outside this repository (ADR 0021).

### Stripe

**Test mode only.** Going live is a separate captain decision: the billing port refuses
`live` unless explicitly authorized, so a stray `SCENEAXI_BILLING_MODE=live` cannot start
real charges on its own. `SCENEAXI_BILLING_MODE` selects a *mode*; authorization is a
different variable entirely (`SCENEAXI_STRIPE_LIVE_AUTHORIZED`, above), read only by
`resolveLiveModeAuthorization` and passed to no shipped call site — so setting either, or
both, still refuses `STRIPE_LIVE_MODE_NOT_AUTHORIZED` at intent creation and at the grant.
Nothing infers authorization from the mode, the key prefix, `NODE_ENV`, or anything else
that merely correlates with production; `docs/auth-credits.md` owns that contract.

## Deploy checklist

1. Provision the shared Neon project and database; capture `DATABASE_URL`.
2. Create the three Vercel projects on one team with the settings above.
3. Set the environment variables per project (Production scope).
4. Deploy each project; record its `*.vercel.app` production URL.
5. Set `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` on **all three** projects to the umbrella
   URL — the umbrella needs its own canonical origin for checkout redirects — and
   optionally the two catalog origins on the umbrella, then **redeploy** those projects —
   these are build-time values.
6. Run the verification below and record the output.

## Verification

```sh
UMB=https://<umbrella>.vercel.app
GAME=https://<game-catalog>.vercel.app
WEB=https://<web-catalog>.vercel.app

# Umbrella pages
for p in / /open /docs /engine /pricing /profiles /account /editor; do
  printf '%s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$UMB$p")"
done

# The live open path serves a composed scene and names the product core honestly
curl -s "$UMB/open" | grep -c 'Three presentation core'          # >= 1
curl -s "$UMB/open" | grep -oE 'sha256:[0-9a-f]{64}' | head -1   # the scene digest
curl -s "$UMB/open" | grep -c 'Experimental Three preview'       # 0

# Without the preview flag the editor refuses and opens no canvas
curl -s "$UMB/editor" | grep -c 'Not entitled'                   # >= 1
curl -s "$UMB/editor" | grep -c 'viewport-canvas'                # 0

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

Every umbrella viewport — the `/` hero, `/open`, and the entitled `/editor` — draws
pixels only in a browser; WebGL cannot run in node or in `curl`. The curl checks above
verify the served scene and its copy; the pixel
claim is verified by opening each page and reading the frame report it renders (`surface
webgl-canvas`, `pixelsDrawn true`), and the standing record is in
[`three-presentation-core.md`](three-presentation-core.md). `/editor` without the
preview flag serves no canvas at all, which is what the refusal check below asserts.

Expected: pages 200; the served zip's SHA-256 equal to the digest `/engine` publishes;
an unknown item id 404; neither storefront resolving the other's ids; `/pricing` listing
the three credit packs with no live Buy control; `/account` rendering an honest refusal
while the identity plane has no provider handles; and `/editor` refusing without the
preview flag.

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

Steps 1–3 of the activation below are done ([#131](https://github.com/Vhailors/sceneaxi/issues/131)):
`@sceneaxi/auth` and `@sceneaxi/billing` are on the umbrella's matrix allow list, are
`link:` dependencies in its manifest and `transpilePackages`, and
`sites/umbrella/src/lib/identity-plane.ts` builds the site-kit adapters over them. What
remains is operational, and it is deliberately *not* code in this repository.

### What works now, and what still refuses

ADR 0021 keeps the provider clients — Better Auth, the Neon client, the Stripe API —
**outside** this repository. So the plane splits in two:

| Capability | State | Why |
|---|---|---|
| Credit-pack list on `/pricing` | **live** | read from the committed contract fixture's bundled module (`packages/schemas/src/credit-packs.data.ts`, held in lockstep by `pnpm check:contracts`); needs no provider and no traced file |
| The **Buy** control on `/pricing` | replaced by a disabled "Not for sale yet" marker until billing is wired | prices stay informational rather than posting to a checkout that structurally refuses |
| Admin identity (`SCENEAXI_ADMIN_EMAIL`) | **live** | resolved by `@sceneaxi/auth` from the environment |
| Checkout intent, starter grant, webhook verification | **live as behaviour** | implemented in-repo and gate-tested |
| Session verification on `/account`, `/editor` | refuses `IDENTITY_PLANE_NOT_WIRED` | needs an `IdentityPort` over a real store |
| Credit balance | refuses `CREDITS_PLANE_NOT_WIRED` | needs a `CreditStore` over Neon |
| Hosted checkout redirect | refuses `BILLING_PLANE_NOT_WIRED` | needs the Stripe API round-trip |
| A signed-out visitor | refuses `IDENTITY_SESSION_ABSENT` | not a failure, and shown as "you are not signed in" |

`umbrellaPlaneHandles()` in `identity-plane.ts` is the **single** place those handles
arrive. It returns nothing today, which is exactly why each plane refuses by name rather
than inventing a session, balance, or checkout.

### Remaining activation

1. ~~Widen the `@sceneaxi/site-umbrella` allow list in `docs/dependency-matrix.json`.~~ Done.
2. ~~Add both packages as `link:` dependencies and to `transpilePackages`.~~ Done.
3. ~~Build the site-kit adapters over them in `identity-plane.ts`.~~ Done.
4. Return the provider handles from `umbrellaPlaneHandles()`: an `IdentityPort`
   (`createIdentityPort` with a Neon-backed `IdentityStore` and a Better Auth adapter), a
   Neon-backed credit store — a `CreditStoreAdapter` handed to `createCreditStore`, never a
   `CreditStore` implemented directly, so it inherits the commit invariants
   ([`auth-credits.md`](auth-credits.md#the-credit-persistence-boundary-sceneaxi128)) — a
   `CheckoutSessionAdapter` that turns an intent into a hosted Stripe **test** checkout
   URL, and a `CheckoutEvidencePort` that reads the
   persisted intent and the Stripe settlement. No other site file changes.

   The `CheckoutSessionAdapter` and the `CheckoutEvidencePort` beside it owe three things
   beyond the URL, because the grant is bound to the intent rather than to the event, and
   an implementation that only creates a session captures money and then refuses every
   grant — retried by Stripe until it gives up:

   - **Persist the intent** under `intent.intentId`, exactly as given, before redirecting,
     and never update that row afterwards. `CheckoutEvidencePort.findIntent(intentId)`
     must return that same record; it is the immutable price snapshot and the deployment's
     issuance authority for the credits granted by a paid checkout, and an absent one
     refuses `STRIPE_CHECKOUT_EVIDENCE_MISSING`. The money figure is corroborated across two
     reads, because `parseCheckoutCompletedEvent` compares the retrieved settlement against
     this row; the credit figure is read from this row alone
     ([`auth-credits.md`](auth-credits.md#stripe-test-mode)). Captain decisions D2 and D3
     bear on that asymmetry, are decided but unimplemented, and are owned only by their
     out-of-tree records `data/sceneaxi-authority-decision-d2-intent-credit-anchor.md` and
     `data/sceneaxi-authority-decision-d3-intent-ddl-immutability.md` — which
     [`docs/program/NEXT-STEP.md`](program/NEXT-STEP.md#captain-authority-decisions-d1d5)
     only restates. This contract implements neither.
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
     webhook payload.

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
5. Run that vertical's Neon migrations against the shared database. The migrations create
   the `credit_accounts` table and insert **no rows**, and `CreditStore` exposes no
   account-creation method, so **provisioning a credit account per user is that store
   implementation's job** — it belongs in step 4's Neon-backed `CreditStore`, alongside
   sign-up. Nothing in this repository can create one: a site refuses
   `CREDITS_PLANE_UNAVAILABLE` rather than inventing the account it failed to find, so
   until the store provisions accounts, `/account` cannot show a balance, the 100-credit
   starter grant never runs, and a paid webhook grant refuses `CREDIT_LEDGER_UNAVAILABLE`
   and is retried by Stripe.
6. Register the webhook endpoint `POST /api/stripe/webhook` in the Stripe **test**
   dashboard for `checkout.session.completed`, and set `STRIPE_WEBHOOK_SECRET` to the
   signing secret it issues. Subscribing the endpoint to more than that one event type is
   harmless: anything it is not built to act on — another event type, or a
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
   idempotency semantics this step deliberately does not add, so the boundary is a scope
   decision rather than an omission — enabling such a method in the Stripe dashboard would
   take payments this endpoint cannot settle.
7. Remove `SCENEAXI_SITE_EDITOR_PREVIEW` from the umbrella project, since entitlement can
   now be resolved for real.

### How the seam holds

The site ports are structural projections of that vertical's contracts (`Principal`,
`User`, `Session`, `CreditLedgerEntry`, `CreditPack`, `CheckoutSessionIntent`), so its
exports satisfy them as injected adapters with no redefinition of identity or ledger
semantics. The ports speak that vertical's identity-surface vocabulary
(`IDENTITY_SURFACES`): all three deployable sites map onto the `"site"` identity surface,
while the umbrella / catalog-game / catalog-web identifiers stay for routing, branding,
catalog lookup, and deep links and are not identity surfaces.

Load-bearing properties, each gate-tested in `tests/sites/identity-plane-wiring.test.ts`:

- **Roles are never client-claimable.** A `role` / `roles` / `admin` / `isAdmin` key on an
  inbound payload refuses at any depth, before any adapter or store is touched. `admin`
  comes only from `SCENEAXI_ADMIN_EMAIL`, re-derived by the identity port on every call.
- **Session provenance stays in `@sceneaxi/auth`.** The sites never mint or validate a
  session; the umbrella only splits the opaque cookie into the `sessionId` and token the
  port expects, and the catalogs forward it untouched.
- **The starter 100 credits are granted exactly once**, keyed `starter:<userId>` by the
  ledger, so the grant is safe to attempt on every balance read and a concurrent second
  reader cannot double it.
- **Credits are granted only behind a verified webhook.** `applyCheckoutCompletedGrant`
  accepts only the output of `parseCheckoutCompletedEvent`, which accepts only the output
  of `verifyStripeWebhookSignature` — checked at **runtime** by object identity, not only
  by type (sceneaxi#126), so an unsigned or forged body has no path to a grant even from
  JavaScript or through an `as` cast, and a copy of a genuine completion refuses too. The
  credit amount comes from the persisted intent, never from the event.
- **The webhook's answer names the failing side.** A refusal this deployment owns — no
  signing secret, an unusable clock, an adapter that threw, a persisted intent its own
  checkout adapter never wrote, a settlement its own adapter returned for a different
  Checkout Session or without the required `sessionId`, its own ledger rows that do not
  load — answers `503`; a refusal the request owns — signature, payload, a session id the
  verified body itself omits, an intent that does not match — answers `400`. The
  settlement-session refusal sits on the deployment's side because both sides of that
  comparison come from one signature-verified body: the endpoint reads the session id out
  of the verified payload and asks its own `retrieveSettlement` for exactly that id, so
  only the adapter's answer can disagree, and a forged body is refused by signature
  verification long before it. An event the endpoint is not built to act on is neither: it
  answers `200` with `ignored: true`, so Stripe stops redelivering a condition redelivery
  cannot change. Only `ignored: false` means credits are in the ledger. Exactly three
  things are acknowledged, and all three are decided from the verified body before any
  adapter or store is consulted: an event type this path does not handle, a completion
  whose purpose settles on the revenue-share path, and a checkout session carrying no
  SceneAxi metadata key at all — another product's event. The purpose is read from the session
  metadata only to route *away* from the grant path — an absent, malformed, or unknown
  one keeps its normal path, and `parseCheckoutCompletedEvent` still cross-checks the
  purpose against the persisted intent for everything that stays on it. A
  `checkout.session.completed` this deployment *did* create is never acknowledged as
  another product's event: if it carries any SceneAxi key but cannot be routed, it is
  refused and retried. `tests/sites/identity-plane-wiring.test.ts` locks the private
  `UNHANDLED_EVENT_REASONS` set to the reason symbols representing exactly those three
  decisions, and locks every acknowledgement the module can emit to that same set — the one
  path that downgrades a package refusal by consulting it, plus each direct acknowledgement,
  the purpose decision being re-asked of the parsed completion included — so adding another
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

## Outstanding captain secrets

Everything free is live now. Three captain-held secrets are still absent, and were not
invented or faked:

| Variable | Blocks | Why it is not set |
|---|---|---|
| `STRIPE_SECRET_KEY` (test) | credit-pack checkout | captain-held; no Stripe test key is available to this worker |
| `STRIPE_WEBHOOK_SECRET` | credit grants from checkout | captain-held; created with the webhook endpoint |
| `SCENEAXI_ADMIN_BOOTSTRAP_SECRET` | first admin sign-in | captain-held credential material |

`SCENEAXI_ADMIN_EMAIL` is known (`hajczuk.dominik@gmail.com`) and is now resolved by
`@sceneaxi/auth` on this site, so setting it is meaningful: it is the only source of the
`admin` role. It still grants nothing on its own — a session must be verified against a
real store before any role is derived — so it is safe to set before step 4 above.

None of the three secrets block anything shipped: the surfaces that need them refuse with
named reasons today, and would refuse identically with the keys present while the provider
handles in `umbrellaPlaneHandles()` are still absent.

## What is not deployed or activated

Kids · custom domains · Stripe live mode · catalog asset checkout (tier-6b marketplace
activation stays an open captain decision, so purchase and publish refuse
`CATALOG_COMMERCE_INERT`) · npm publication of any package · editor project persistence.
