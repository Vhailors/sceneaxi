# @sceneaxi/site-kit

Deployment-neutral logic for the first-party `sites/` surfaces (umbrella,
game-asset catalog, website-asset catalog). The three Next.js sites are thin
view + wiring layers over this package, so every site behaviour is testable in
`pnpm gate` with no browser, no network, and no framework in the hermetic
package tier.

## What lives here

| Module | Owns |
|---|---|
| `refusals.ts` | the named refusal registry; every fail-closed path refuses with a key from it |
| `ports.ts` | fail-closed identity / credits / billing ports — the single seam with the identity plane |
| `entitlement.ts` | free-vs-paid capability matrix, Minimum E2 editor entitlement |
| `catalog.ts` | catalog view models, dual price, creator share, fail-closed purchase intent |
| `deep-link.ts` | catalog → umbrella editor deep-link contract |
| `web-editor.ts` | bounded Minimum E2 web editor session over `@sceneaxi/authoring-core` |
| `live-open.ts` | the public live open path: which committed fixture is opened, how it is placed by `composeScene()`, and the honest vocabulary a page may use for the presentation core |

## The live open path

`liveOpenScene()` returns a browser-ready descriptor — validated Sculpt Artifacts
plus the composition pipeline's own world transforms and evidence digest. It draws
nothing: rendering belongs to the umbrella site, the one surface allowed to consume
`@sceneaxi/engine-presentation` (ADR 0022). Keeping the decision here is what lets
`pnpm gate` test the whole path without a browser, and `LIVE_OPEN_PRESENTATION` is
asserted so shipped copy cannot drift back to the retired "experimental preview"
framing (ADR 0017).

## The identity-plane seam

`SiteIdentityPort`, `SiteCreditsPort`, and `SiteBillingPort` are deliberate
structural projections of the identity/credits/billing contracts owned by
`@sceneaxi/auth` and `@sceneaxi/billing`, so those packages satisfy these ports
as **injected adapters**.

This package implements **no identity and no ledger**. It does not resolve an
admin email, does not derive a balance from ledger entries, and does not verify a
Stripe signature. What it owns is the fail-closed boundary:

- an unwired plane refuses (`IDENTITY_PLANE_NOT_WIRED`, `CREDITS_PLANE_NOT_WIRED`,
  `BILLING_PLANE_NOT_WIRED`) and is never an open plane;
- a client-supplied role claim refuses `ROLE_CLAIM_FROM_CLIENT_DENIED` at any
  nesting depth, before any adapter dispatch, so a site can never become a
  client-claimable admin path;
- the Kids surface refuses `KIDS_SURFACE_DENIED` before dispatch, not overridable
  by option, env, or adapter;
- adapter output is validated before a site is allowed to trust it.

Wiring instructions live in `docs/websites-deploy.md`.

## Entitlement

Admin is unrestricted and short-circuits before any credit reading is consulted.
Otherwise a positive balance, then an unused 100-credit starter allotment, then a
named refusal. This package decides *eligibility* only — the idempotent starter
grant append belongs to `@sceneaxi/billing`.

ADR 0020 records the decision. It does not authorize general E2 (ADR 0003 stands)
and does not open tier-6b marketplace activation.
