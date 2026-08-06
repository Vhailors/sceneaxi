# @sceneaxi/site-catalog-web

The deployable website-asset catalog site: browse and detail over listed catalog
fixtures, dual pricing (credits and/or money), the creator 50% share note, and deep
links into the umbrella's Minimum E2 editor.

The inventory is exactly the validated bundled twin of
`packages/schemas/contracts/catalog-listings.fixtures.json`. The fixture is TEST-only
and carries listing metadata, not an asset payload or a payment completion.

## Shape

A thin view + wiring layer over `@sceneaxi/site-kit`, which owns the catalog view
models, price display, share math, and deep-link contract and is tested in
`pnpm gate`.

- `src/index.ts` and `src/lib/**` are pure TypeScript, gate-typechecked and tested.
- `src/app/**` is the only place a framework appears.

## Distinct surface

The locked site/domain topology requires the two storefronts stay distinct in
positioning and content even though they consume the same catalog pipeline. This
surface does not publish the game catalog's or the umbrella's canonical pages.

## Identity is read, never issued

This storefront takes **no auth stack of its own**: its seam and item page consume the
public `@sceneaxi/site-kit/catalog-identity` entry directly, and the item page shows what
that plane says about the request — display only, with a server-derived role or a named refusal. The
matrix denies this site `@sceneaxi/auth` and `@sceneaxi/billing`, and no adapter is
supplied here, so an unwired deployment refuses rather than inventing a viewer. The plane
and its activation are owned by [`docs/websites-deploy.md`](../../docs/websites-deploy.md).

## TEST purchase is explicit and fail-closed

`COMMERCE_ACTIVATION_GATE` always refuses while tier-6b marketplace activation keys
remain open. Prices and the creator share are displayed; purchase and publish refuse
`CATALOG_COMMERCE_INERT`. A selected currency the seller did not offer refuses
`CATALOG_PURCHASE_METHOD_UNAVAILABLE` first. The refusal is stamped `mode: test` and
`completion: none`; there is no live checkout, cart, payment field, or fake success.

## Visual target

Implemented from `Asset Storefronts.dc.html` in the captain-accepted SceneAxi Design
System archive (SHA-256 `ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159`),
issue [#156](https://github.com/Vhailors/sceneaxi/issues/156).

The archive holds **both** catalogs in one file and flips between them with a runtime
`state.store` switch. ADR 0018 makes each storefront its own install root and its own
deployed origin, so that switch cannot ship as drawn. What ships instead is what the
design itself asks for — *"same skeleton, different accent and merchandising"*:

- `src/app/globals.css` is byte-identical to `sites/catalog-game/src/app/globals.css`
  below the block marked `STORE IDENTITY`, which is the only place the two differ
  (the storefront's own accent derivations and a `50%` store mark).
- The family bar is three ordinary cross-origin links built by `src/lib/family-bar.ts`.
  The current store is marked, not linked; a sibling whose origin this deployment has
  not configured renders as text rather than a broken link; and `FAMILY_KEYS` has no
  Kids entry, so no configuration can produce a link into Kids.

### The token and component layer comes from `packages/site-kit`

Captain decision **D2** (2026-07-28) gives the shared token and component layer one home,
and this storefront consumes it rather than carrying a copy:

- `src/lib/foundations.ts` composes `foundationsCss({ surface })` from
  `@sceneaxi/site-kit` and serves it from `src/app/layout.tsx`. `src/app/globals.css`
  declares **no** Foundations v2 token — no neutral, no radius, no font stack, no
  semantic colour — and neither it nor any module under `src/lib/` writes a Foundations
  palette value as a literal in any notation, hex or `rgb()`/`rgba()`. Both are
  gate-asserted; a translucent overlay of a Foundations colour is mixed from its token
  with `color-mix()` rather than re-encoded, and the family bar's surface dots are read
  from `resolveSurfaceAccent()` rather than transcribed.
- The accent is an *argument*, not a redeclaration. This site sets
  `CATALOG_SITE_FOUNDATION_SURFACE = "web-assets"`; site-kit resolves `--store-web`
  (`#3FB8C9`) for it, so that hex has exactly one declaration in the repository. This is
  Foundations §06's "accent shifts only", implemented rather than restated.
- The status vocabulary is re-projected as `--status-<id>-{fg,bg,line}` from
  `FOUNDATION_STATUSES`, so the storefront's notice panels and rails read the same
  triples as site-kit's `.sx-status-*` chips without writing one of their values.
- `state-panel.tsx` and `commerce-notice.tsx` are React-only adapters over the shared
  state and commerce models; they own no status mapping, commerce copy, or purchase
  refusal logic. `_session.ts` similarly owns only Next request access and delegates
  header/cookie names and precedence to `@sceneaxi/site-kit/site-session`.
- What stays local is what site-kit does not publish: the archive's per-store washes
  (`--accent-bg`, `--accent-line`, `--hero-wash`, `--media-wash`), the store mark shape,
  and the layout measures its own `:root` block declares.
- Foundations names Archivo and JetBrains Mono but a package must not inject a network
  font, so the site loads both itself through `next/font`, which self-hosts them at build
  time. `--store-ui` / `--store-mono` prepend the loaded faces onto site-kit's
  `--font-ui` / `--font-mono`; site-kit still owns *which* families those are.

### Where site-kit and the carried implementation disagreed

Site-kit wins, per the lane's terms. Three values the earlier implementation wrote are
gone, and all three were things the design archive does not state:

| Token | Was | Now | Why |
|---|---|---|---|
| `--accent-hi` | `#5FCEDD` | resolves to `#3FB8C9` | The Foundations sheet prints a hover shade for signal orange only. `resolveSurfaceAccent()` repeats the accent rather than inventing a tint (D-3 in [`docs/design-foundations.md`](../../docs/design-foundations.md)). Hover is answered by an underline on inline links and by a `--accent-line` ring on the primary button — neither is a new colour fact. |
| `--danger` | `#FF6B7A` | `#FF4D5E` | site-kit's published refusal red, which is also the value the Asset Storefronts screen itself uses. Measures 5.71:1 on `--status-refused-bg`. |
| `--warn` | `#FF9A5C` | `--status-needs-review-fg`, `#FF6B2C` | There is no `--warn` in Foundations; "needs review" is a published status. Measures 6.54:1 on its own background. |

### What the archive proposes and the contracts refuse

| In the archive | Shipped here |
|---|---|
| Cart badge, "Add to cart", two invented licence tiers | `attemptCatalogPurchase` refuses `CATALOG_COMMERCE_INERT`; that refusal, its policy text and its registry cite occupy the slot the cart button had |
| "Apply as a seller", a payouts column | `/publish`, display-only, refusing with the pipeline's own reason |
| Five filter groups of hand-written counts wired to checkboxes that filter nothing | counts of the scenes actually on the page, and no control whose behaviour no contract defines |
| Sort control, nine-page pager, search field | omitted for the same reason |
| Rendered-looking asset thumbnails | a figure derived from each validated listing record's `sha256:` digest (`src/lib/digest-sigil.ts`), stated as a record mark rather than an asset render |
| Five invented "build passes" | the exact non-price fields present in the committed Catalog Listing contract |
| Invented digests, download counts, triangle counts, a refund window | nothing: every value on the page comes from the Catalog Listing fixture or an explicitly unavailable state |
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
  `--fg-4` paints no text here, and no rule in this sheet sets text below 11px — the
  gate reads the shipped `font-size` declarations, not just the `--micro` token. The
  only declarations under that floor are `aria-hidden` marks rather than labels, named
  and reasoned one by one in the gate test so the exemption cannot be a silent skip.
- **Dark only.** The archive has no light variant anywhere, so this storefront no longer
  ships one. Inventing a light palette would be designing rather than implementing.
- **Hero copy.** The archive's headline claims rig contents ("pivots, sockets, descriptive
  colliders") that no listing record backs. The reviewed brand tagline and audience line
  are set in the archive's hero typography instead.

### Historical browser observation of the shared visual shell

The measurements below were recorded for the #156 visual shell. They remain useful
layout history, but #195's fixture-contract content projection is proven by the gate and
is not represented as re-measured browser evidence here.

`pnpm build && pnpm start`, Chrome through `chrome-devtools-axi`, measuring
`document.documentElement.scrollWidth` against `window.innerWidth`:

| Route | 1440x1000 | 1366x768 | 1366x600 | 834x1112 | 390x844 |
|---|---|---|---|---|---|
| `/` | 1440 = 1440 | 1366 = 1366 | 1366 = 1366 | 834 = 834 | 390 = 390 |
| `/item/harbour-diorama` | 1440 = 1440 | 1366 = 1366 | 1366 = 1366 | 834 = 834 | 390 = 390 |
| `/publish` | 1440 = 1440 | 1366 = 1366 | 1366 = 1366 | 834 = 834 | 390 = 390 |
| 404 | 1440 = 1440 | 1366 = 1366 | 1366 = 1366 | 834 = 834 | 390 = 390 |

No route overflows at any of the five viewports, against the archive's 984-against-390. The
same probe found no element whose right edge exceeded the document width on any of the
twenty renders. In the same session the detail page's editor deep link resolved to
`…/editor?source=catalog-web&item=harbour-diorama`.

#### The anchor offset against a masthead that wraps

The masthead is sticky, so a fragment target scrolled to `y=0` would land behind it, and
`html` carries `scroll-padding-top: var(--sticky-top)` to answer that. One number cannot:
`.masthead-inner` wraps the nav onto its own row once the storemark and the three links
stop fitting on one, and the masthead then measures 104.9 against 60.2 for a single row.
So the offset is `8rem` by default and `5.5rem` from `36rem` up, and the breakpoint was
placed from measurement rather than arithmetic. Read at the width where this store's
masthead begins to wrap and at one width either side of it, with the clearance between the
anchor destination and the masthead's bottom edge — negative would mean the target sits
behind it:

| Width | Masthead | `scroll-padding-top` | `#main` after the skip link | `#pricing` heading |
|---|---|---|---|---|
| 536 | 2 rows, 104.9 | 128px | flush, 0 under | 23.2 clear |
| 537 | 2 rows, 104.9 | 128px | flush, 0 under | 23.0 clear |
| 538 | 1 row, 60.2 | 128px | flush, 0 under | 67.8 clear |
| 539 | 1 row, 60.2 | 128px | flush, 0 under | 67.7 clear |
| 576 | 1 row, 60.2 | 88px | flush, 0 under | 27.9 clear |
| 1366 | 1 row, 60.2 | 88px | flush, 0 under | 28.2 clear |

This store's masthead is one row at 538 and wider, later than the game storefront's 521
because its store name is longer. `36rem` is the shared breakpoint above both, so neither
store reaches the one-row offset while its own masthead is still two rows. The nav is left
free to wrap where it genuinely does not fit — suppressing it would only trade this for
clipped or overflowing navigation — and the probe above read no overflow at 520 or 537
either.

#### What the overflow probe cannot see

`scrollWidth` against `innerWidth` is a zero-overflow check, not a legibility check, and
the two are not the same claim. Text carrying `overflow-wrap: anywhere` never widens the
document: squeezed into a track far narrower than its content it wraps instead, so the
probe reads `390 = 390` while the text renders as a column of two- and three-character
lines. The #156 curation record was exactly that — four children auto-placed into a
two-track row, which put the recorded reason in the 2rem ordinal track — and every
viewport in the table above passed while that section was unreadable. #195 removed that
record from the detail projection along with the rules that carried it, so nothing in the
shipped sheet answers this defect any more; the caveat stands as the reason a prose row
this storefront adds later is read as rendered width and line count, not as a probe.

#### Sticky columns at short desktop heights

Width alone cannot prove this page, and the two 1000px-tall desktop rows above are the
heights at which it is least likely to show: above `64rem` the rail and the detail column
pin below the masthead, and a sticky box taller than the space under its offset stops
moving with the page, so whatever falls past the viewport edge is unreachable at any scroll
position. Both columns are bounded to `calc(100dvh - var(--sticky-top))` and scroll inside
themselves instead. Read from the same session — the computed bound, the column's own
`scrollHeight`, where its inner scroll ends, and whether its last block is fully inside the
column once it is scrolled there:

| Viewport | Column | Bound | Content | Inner scroll | Last block reachable |
|---|---|---|---|---|---|
| 1440x1000 | `.detail-side` | 912 | 1122 | 210 | "Works with", fully |
| 1366x768 | `.detail-side` | 680 | 1122 | 442 | "Works with", fully |
| 1366x600 | `.detail-side` | 512 | 1122 | 610 | "Works with", fully |
| 1440x1000 | `.detail-side`, editor link refused | 912 | 1241 | 329 | "Works with", fully |
| 1366x768 | `.detail-side`, editor link refused | 680 | 1241 | 561 | "Works with", fully |
| 1366x600 | `.detail-side`, editor link refused | 512 | 1241 | 729 | "Works with", fully |
| 1440x1000 | `.rail` | 912 | 594 | fits, none needed | rail note, fully |
| 1366x768 | `.rail` | 680 | 594 | fits, none needed | rail note, fully |
| 1366x600 | `.rail` | 512 | 594 | 82 | rail note, fully |

The refused rows were recorded with `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` unset, which
renders the extra deny panel into the same column — the tallest state this page has. The
commerce notice's own bottom edge was inside the column in every row. Focusing
`.detail-side` and pressing `End` scrolled it to 442 of 442 at 1366x768 with "Works with"
fully inside, so the inner scroll is not pointer-only. Below `64rem` neither column is
sticky or bounded — the same probe read `position: static` and `max-height: none` at
834x1112 and 390x844, where the page itself is the only scroller.

Computed values from the served page, which is what proves the token layer arrives from
site-kit rather than from this stylesheet — the storefront declares none of them:

| Read from the live document | Value |
|---|---|
| `style[data-sceneaxi-foundations]` tags in `<head>` | 1 |
| `--accent` | `#3FB8C9` |
| `--accent-hi` | `#3FB8C9` (no invented hover tint) |
| `--bg-base`, computed `body` background | `#07080A`, `rgb(7, 8, 10)` |
| `--danger` | `#FF4D5E` |
| `--status-refused-bg` | `#1A1113` |
| computed `body` font-family | `Archivo, "Archivo Fallback", Archivo, system-ui, sans-serif` |

Lighthouse (navigation, desktop) scored **accessibility 100 with 0 failed audits** on `/`,
`/item/harbour-diorama` and `/publish`, and the same on all three of the game
storefront's equivalents — six routes in all.

What a browser has to prove is recorded here. What the gate can prove — shared skeleton,
mobile-first breakpoints only, no masked overflow, the reduced-motion answer, a computed
4.5:1 on every shipped text pairing measured against the sheet the site actually serves,
each sticky column being bounded and internally scrollable rather than clipped, and
keyboard-reachable while it is, the anchor offset clearing a wrapped masthead,
no redeclared Foundations token or pasted Foundations hex, digest-mark determinism, real
facet counts, and the absence of every invented value above — is asserted in
[`tests/sites/catalog-storefronts.test.ts`](../../tests/sites/catalog-storefronts.test.ts).

## Separate install root

The sole member of its own pnpm workspace, not a member of the repository-root
workspace; keeps its own lockfile.

    pnpm install      # from this directory
    pnpm dev
    pnpm build
