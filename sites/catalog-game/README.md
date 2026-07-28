# @sceneaxi/site-catalog-game

The deployable game-asset catalog site: browse and detail over listed catalog
fixtures, dual pricing (credits and/or money), the creator 50% share note, and deep
links into the umbrella's Minimum E2 editor.

## Shape

A thin view + wiring layer over `@sceneaxi/site-kit`, which owns the catalog view
models, price display, share math, and deep-link contract and is tested in
`pnpm gate`.

- `src/index.ts` and `src/lib/**` are pure TypeScript, gate-typechecked and tested.
- `src/app/**` is the only place a framework appears.

## Distinct surface

The locked site/domain topology requires the two storefronts stay distinct in
positioning and content even though they consume the same catalog pipeline. This
surface does not publish the website catalog's or the umbrella's canonical pages.

## Identity is read, never issued

This storefront takes **no auth stack of its own**: `src/lib/identity-plane.ts` re-exports
the shared `@sceneaxi/site-kit` storefront plane, and the item page shows what that plane
says about the request — display only, with a server-derived role or a named refusal. The
matrix denies this site `@sceneaxi/auth` and `@sceneaxi/billing`, and no adapter is
supplied here, so an unwired deployment refuses rather than inventing a viewer. The plane
and its activation are owned by [`docs/websites-deploy.md`](../../docs/websites-deploy.md).

## Commerce is inert

`COMMERCE_ACTIVATION_GATE` always refuses while tier-6b marketplace activation keys
remain open. Prices and the creator share are displayed; purchase and publish refuse
`CATALOG_COMMERCE_INERT`. There is no checkout, cart, or payment field.

## Visual target

Implemented from `Asset Storefronts.dc.html` in the captain-accepted SceneAxi Design
System archive (SHA-256 `ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159`),
issue [#156](https://github.com/Vhailors/sceneaxi/issues/156).

The archive holds **both** catalogs in one file and flips between them with a runtime
`state.store` switch. ADR 0018 makes each storefront its own install root and its own
deployed origin, so that switch cannot ship as drawn. What ships instead is what the
design itself asks for — *"same skeleton, different accent and merchandising"*:

- `src/app/globals.css` is byte-identical to `sites/catalog-web/src/app/globals.css`
  below the block marked `STORE IDENTITY`, which is the only place the two differ
  (the storefront's own accent derivations and a `1px` store mark).
- The family bar is three ordinary cross-origin links built by `src/lib/family-bar.ts`.
  The current store is marked, not linked; a sibling whose origin this deployment has
  not configured renders as text rather than a broken link; and `FAMILY_KEYS` has no
  Kids entry, so no configuration can produce a link into Kids.

### The token layer comes from `packages/site-kit`

Captain decision **D2** (2026-07-28) gives the shared token and component layer one home,
and this storefront consumes it rather than carrying a copy:

- `src/lib/foundations.ts` composes `foundationsCss({ surface })` from
  `@sceneaxi/site-kit` and serves it from `src/app/layout.tsx`. `src/app/globals.css`
  declares **no** Foundations v2 token — no neutral, no radius, no font stack, no
  semantic colour — and writes no Foundations hex as a literal. Both are gate-asserted.
- The accent is an *argument*, not a redeclaration. This site sets
  `CATALOG_SITE_FOUNDATION_SURFACE = "game-assets"`; site-kit resolves `--store-game`
  (`#E8544E`) for it, so that hex has exactly one declaration in the repository. This is
  Foundations §06's "accent shifts only", implemented rather than restated.
- The status vocabulary is re-projected as `--status-<id>-{fg,bg,line}` from
  `FOUNDATION_STATUSES`, so the storefront's notice panels and rails read the same
  triples as site-kit's `.sx-status-*` chips without writing one of their values.
- What stays local is what site-kit does not publish: the archive's per-store washes
  (`--accent-bg`, `--accent-line`, `--hero-wash`, `--media-wash`), the store mark shape,
  and four layout measures.
- Foundations names Archivo and JetBrains Mono but a package must not inject a network
  font, so the site loads both itself through `next/font`, which self-hosts them at build
  time. `--store-ui` / `--store-mono` prepend the loaded faces onto site-kit's
  `--font-ui` / `--font-mono`; site-kit still owns *which* families those are.

### Where site-kit and the carried implementation disagreed

Site-kit wins, per the lane's terms. Three values the earlier implementation wrote are
gone, and all three were things the design archive does not state:

| Token | Was | Now | Why |
|---|---|---|---|
| `--accent-hi` | `#F0736E` | resolves to `#E8544E` | The Foundations sheet prints a hover shade for signal orange only. `resolveSurfaceAccent()` repeats the accent rather than inventing a tint (D-3 in [`docs/design-foundations.md`](../../docs/design-foundations.md)). Hover is answered by an underline on inline links and by a `--accent-line` ring on the primary button — neither is a new colour fact. |
| `--danger` | `#FF6B7A` | `#FF4D5E` | site-kit's published refusal red, which is also the value the Asset Storefronts screen itself uses. Measures 5.71:1 on `--status-refused-bg`. |
| `--warn` | `#FF9A5C` | `--status-needs-review-fg`, `#FF6B2C` | There is no `--warn` in Foundations; "needs review" is a published status. Measures 6.54:1 on its own background. |

### What the archive proposes and the contracts refuse

| In the archive | Shipped here |
|---|---|
| Cart badge, "Add to cart", two invented licence tiers | `attemptCatalogPurchase` refuses `CATALOG_COMMERCE_INERT`; that refusal, its policy text and its registry cite occupy the slot the cart button had |
| "Apply as a seller", a payouts column | `/publish`, display-only, refusing with the pipeline's own reason |
| Five filter groups of hand-written counts wired to checkboxes that filter nothing | counts of the listings actually on the page, and no control whose behaviour no contract defines |
| Sort control, nine-page pager, search field | omitted for the same reason |
| Rendered-looking asset thumbnails | a figure derived from each listing's real `sha256:` content hash (`src/lib/digest-sigil.ts`), stated on the page to be a mark of the digest rather than a render |
| Five invented "build passes" | the item's recorded curation transitions, with their real reasons and timestamps |
| Invented digests, download counts, triangle counts, a refund window | nothing: every value on the page comes from the Catalog Item contract |
| Kids in the family bar | no Kids key exists to configure |

### Deliberate departures from the archive

Each is a defect recorded against the design, not against the code:

- **Responsive.** The archive is a fixed desktop layout; a real-browser probe measured
  `scrollWidth 984` against `innerWidth 390`. Every grid here is single-column first and
  widens at `48rem` and `64rem`, and `body` carries no `overflow-x: hidden` — an overflow
  has to show up in a probe rather than be hidden from one.
- **Reduced motion.** None of the archive's seven screens answers
  `prefers-reduced-motion`; this one does.
- **Contrast.** The archive's micro labels are 8.5px `--fg-4` on a panel, about 2.1:1.
  `--fg-4` paints no text here and micro type is `--fg-2` at 11px.
- **Dark only.** The archive has no light variant anywhere, so this storefront no longer
  ships one. Inventing a light palette would be designing rather than implementing.
- **Hero copy.** The archive's headline claims rig contents ("pivots, sockets, descriptive
  colliders") that no listing record backs. The reviewed brand tagline and audience line
  are set in the archive's hero typography instead.

### Recorded browser observation

`pnpm build && pnpm start`, Chrome through `chrome-devtools-axi`, measuring
`document.documentElement.scrollWidth` against `window.innerWidth`:

| Route | 1440x1000 | 834x1112 | 390x844 |
|---|---|---|---|
| `/` | 1440 = 1440 | 834 = 834 | 390 = 390 |
| `/item/game-lantern-prop` | 1440 = 1440 | 834 = 834 | 390 = 390 |
| `/publish` | 1440 = 1440 | 834 = 834 | 390 = 390 |
| 404 | 1440 = 1440 | 834 = 834 | 390 = 390 |

No route overflows at any of the three widths, against the archive's 984-against-390. The
same probe found no element whose right edge exceeded the document width on any of the
twelve renders. In the same session the detail page's editor deep link resolved to
`…/editor?source=catalog-game&item=game-lantern-prop`.

Computed values from the served page, which is what proves the token layer arrives from
site-kit rather than from this stylesheet — the storefront declares none of them:

| Read from the live document | Value |
|---|---|
| `style[data-sceneaxi-foundations]` tags in `<head>` | 1 |
| `--accent` | `#E8544E` |
| `--accent-hi` | `#E8544E` (no invented hover tint) |
| `--bg-base`, computed `body` background | `#07080A`, `rgb(7, 8, 10)` |
| `--danger` | `#FF4D5E` |
| `--status-refused-bg` | `#1A1113` |
| computed `body` font-family | `Archivo, "Archivo Fallback", Archivo, system-ui, sans-serif` |

Lighthouse (navigation, desktop) scored **accessibility 100 with 0 failed audits** on `/`,
`/item/game-lantern-prop` and `/publish`, and the same on both of the web storefront's
equivalents.

What a browser has to prove is recorded here. What the gate can prove — shared skeleton,
mobile-first breakpoints only, no masked overflow, the reduced-motion answer, a computed
4.5:1 on every shipped text pairing measured against the sheet the site actually serves,
no redeclared Foundations token or pasted Foundations hex, digest-mark determinism, real
facet counts, and the absence of every invented value above — is asserted in
[`tests/sites/catalog-storefronts.test.ts`](../../tests/sites/catalog-storefronts.test.ts).

## Separate install root

The sole member of its own pnpm workspace, not a member of the repository-root
workspace; keeps its own lockfile.

    pnpm install      # from this directory
    pnpm dev
    pnpm build
