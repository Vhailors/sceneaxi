# @sceneaxi/site-kit

Deployment-neutral logic for the first-party `sites/` surfaces (umbrella,
game-asset catalog, website-asset catalog). The three Next.js sites are thin
view + wiring layers over this package, so every non-presentational site
behaviour is testable in `pnpm gate` with no browser, no network, and no
framework in the hermetic package tier. The one behaviour that needs a browser
is the umbrella's viewports (ADR 0022), and even there the decision of what is
opened — and what may be drawn — lives here.

## What lives here

| Module | Owns |
|---|---|
| `refusals.ts` | the named refusal registry; every fail-closed path refuses with a key from it |
| `ports.ts` | fail-closed identity / credits / billing / login ports — the single seam with the identity plane |
| `access-states.ts` | the total projection from a refusal reason to a **named access state** — what a guarded surface tells a visitor and the one action that can change it — plus the same-site confinement rule both ends of a sign-in round trip use |
| `catalog-identity.ts` | the storefront identity plane both catalogs read through, pinned to the `site` surface; a reader of identity, never an issuer |
| `entitlement.ts` | free-vs-paid capability matrix, Minimum E2 editor entitlement |
| `catalog.ts` | catalog view models, dual price, creator share, fail-closed purchase intent |
| `deep-link.ts` | catalog → umbrella editor deep-link contract, and the one definition of the configured umbrella origin — including the checkout redirect origin, which is never taken from a request `Host` |
| `web-editor.ts` | bounded Minimum E2 web editor session over `@sceneaxi/authoring-core` |
| `web-experience-editor.ts` | deterministic #197 page/HTML/site-canvas model over the shared Web Experience operation and sandbox contract; arbitrary assets and desktop-only actions refuse |
| `editor-session.ts` | driving that session from URL state, and projecting its composed scene for a browser |
| `editor-shell.ts` | `buildEditorShellView()` — the umbrella `/editor` Engine Desktop shell projected from the shared vocabulary in `@sceneaxi/schemas` over one real session render, plus the closed `EDITOR_SHELL_WEB_REFUSALS` registry; owner doc `docs/web-editor-shell.md` |
| `mountable-scene.ts` | the one payload shape a browser mounts, shared by both umbrella viewports |
| `live-open.ts` | the public live open path: which committed fixture is opened, how it is placed by `composeScene()`, and the honest vocabulary a page may use for the presentation core |
| `profile-contracts.ts` | the browser-safe re-export of `profileConformanceRegistry` and `OPEN_PATH_POLICY`, so the umbrella `/profiles` page reads the canonical contracts by reference instead of through the Node-bearing root barrel |
| `design-tokens.ts` | the Foundations v2 visual tokens, the measured contrast contract, and the CSS emitters |
| `site-element.ts` | a framework-neutral element tree plus an escaping HTML serializer |
| `change-review.ts` | Change Review — the design system's signature primitive, over a real `Proposal` |
| `state-panel.ts` | the shared named-state model, Foundations status mapping, and neutral tree; sites retain only React adapters |
| `commerce-notice.ts` | the two storefronts' inert-commerce copy, refusal model, and neutral tree |
| `site-session.ts` | the shared session header/cookie vocabulary, header-first token normalization, and the session cookie a login grant is handed to a browser in — built, cleared, and its `Secure` attribute decided from the deployment's configured origin rather than the request |
| `desktop-app-offer.ts` | the validated Linux workflow-artifact offer for umbrella `/engine` — exact run, source commit, files, sizes, checksums, and the retention window after which the artifact is gone, held in lockstep with [`docs/desktop-linux.md`](../../docs/desktop-linux.md), with named refusals for missing or broken metadata |

## The shared visual layer

Three sites currently carry near-identical copies of one stylesheet, and ADR 0018
makes each of them a separate install root — so the only place a shared token layer
can live without a new matrix edge is the package all three already depend on.
`foundationsCss()` emits the palette, scale and shared parts under the design
source's own token names; `foundationsCss({ surface })` shifts the accent pair only,
which is exactly what Foundations §06 prescribes. Sites load the fonts themselves.

Change Review is the signature component the `sites/` tier never had. It renders a
real propose/apply `Proposal`: one row per `ProposalEdit`, a projected before → after
document digest, and a stale proposal refused rather than merged. Per-row decisions
function, and a *mixed* decision refuses by name — apply is all-or-nothing, and
narrowing a proposal is authoring, which belongs to `@sceneaxi/authoring-core`.

The state panel and commerce notice follow the same boundary: site-kit exports models
and `SiteElement` trees, while each separate site install root keeps the few lines that
map those facts onto React. Browser clients import the narrow
`@sceneaxi/site-kit/state-panel` entry rather than the root barrel, whose server-side
catalog and editor exports intentionally reach Node builtins. The catalog identity,
request-token, and profile-contract seams likewise have narrow public entries, so a site
does not need a duplicated re-export, duplicated credential precedence, or a bundled copy
of a contract it must not restate.

Ownership, the measured accessibility contract, the recorded archive ↔ contract
differences, and the browser evidence are in `docs/design-foundations.md`.

## What a browser may draw

`MountableScene` is the single shape handed across to a canvas: validated Sculpt
Artifacts, the composition pipeline's own world transforms and hierarchy, and its
evidence digest. Both umbrella viewports receive it — the public path from
`liveOpenScene()`, the entitled Minimum E2 editor from its session's own
`composeSceneProjection()` — so what may be drawn is decided here and the two
surfaces cannot drift apart.

This package draws nothing: rendering belongs to the umbrella site, the one surface
allowed to consume `@sceneaxi/engine-presentation` (ADR 0022). Keeping the decision
here is what lets `pnpm gate` test both paths without a browser, and
`LIVE_OPEN_PRESENTATION` is asserted so shipped copy cannot drift back to the
retired "experimental preview" framing (ADR 0017).

Placement stays a projection throughout: no artifact is rewritten to place it,
because its evidence binds its exact spec bytes.

## The identity-plane seam

`SiteIdentityPort`, `SiteCreditsPort`, `SiteBillingPort`, and `SiteLoginPort` are
deliberate structural projections of the identity/credits/billing contracts owned by
`@sceneaxi/auth` and `@sceneaxi/billing`, so those packages satisfy these ports
as **injected adapters**.

`SiteLoginPort` is the one that *issues* rather than reads: its adapter returns a
principal plus the opaque credential a browser may carry, and this package decides only
whether that grant is well-formed enough to become a cookie — empty credentials refuse
before dispatch (`LOGIN_CREDENTIALS_REQUIRED`), an adapter's rejected password comes back
as the visitor's own named outcome (`LOGIN_CREDENTIALS_REJECTED`) instead of collapsing
into "signed out", and a grant no cookie can faithfully carry refuses
`LOGIN_SESSION_NOT_ISSUED` instead of being sent anyway. The contract those refusals
answer to is
[`docs/auth-credits.md`](../../docs/auth-credits.md).

`verifySiteFormOrigin` (in `site-session.ts`) is the precondition to all of that: a
submission that cannot prove it came from the deployment's own pages refuses
`SITE_REQUEST_CROSS_ORIGIN` before any port is reached. It lives beside the cookie
because it answers the hazard the cookie's `SameSite=Lax` does **not** cover — a sign-in
POST carries no cookie yet, so nothing is withheld from it and the browser stores the
`Set-Cookie` that comes back — and it reads the deployment's configured origin first for
the same reason `Secure` does.

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

Three states are kept distinct on purpose, because collapsing them would make a
site lie about what it knows:

| State | Reason | Means |
|---|---|---|
| no adapter | `*_PLANE_NOT_WIRED` | this deployment cannot answer at all |
| adapter reports no principal (`ok(null)`) | `IDENTITY_SESSION_ABSENT` | a signed-out visitor, which is not a failure |
| adapter throws | `*_PLANE_UNAVAILABLE` | the answer is *unknown* — never "absent" and never zero |

That last row is why an adapter exception becomes a named refusal rather than
escaping the port: "you have no credits" and "we could not read your credits" must
not look identical to a buyer.

Wiring instructions live in `docs/websites-deploy.md`; the umbrella's live wiring
is `sites/umbrella/src/lib/identity-plane.ts`.

## Entitlement

Admin is unrestricted and short-circuits before any credit reading is consulted.
Otherwise a positive balance, then an unused 100-credit starter allotment, then a
named refusal. This package decides *eligibility* only — the idempotent starter
grant append belongs to `@sceneaxi/billing`.

ADR 0020 records the decision. It does not authorize general E2 (ADR 0003 stands)
and does not open tier-6b marketplace activation.
