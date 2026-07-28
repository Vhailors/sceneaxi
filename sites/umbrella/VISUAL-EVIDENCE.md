# Umbrella visual implementation — recorded observations

Evidence for sceneaxi#157: the captain-accepted `Umbrella Site` design screen under
**Foundations v2**, implemented responsively over the existing live viewport, the shared
`@sceneaxi/site-kit` token layer, and the identity/credits seams.

This file records **browser observations**, the way `docs/three-presentation-core.md`
records the pixel claim. It is not a gate result and it authorizes nothing. The gate's
own half of this work is `tests/sites/umbrella-visual.test.ts` and
`tests/sites/umbrella-profile-matrix.test.ts`, which run in `pnpm gate` and assert the
structure and the claims; nothing here is asserted twice.

## Source authority

- Accepted screen: `Umbrella Site.dc.html`, from the captain-supplied
  `SceneAxi Design System.zip`, SHA-256
  `ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159`.
- Captain decisions applied: `sceneaxi-step12-visual-decisions-20260728.md` — D1
  (Foundations v2 across all surfaces), D2 (shared token layer lives in
  `packages/site-kit`), D3 (reduced, truthful `/profiles`), D4 (the hero draws a real
  Sculpt Artifact), D5 (technical-document treatment for account, credits, and refusal).
- Behavioural precedence, as the lane defines it: repository contracts, ADRs, schemas,
  refusal registries, and executable gates override contradictory mockup behaviour or
  copy. Every place that bit and the accepted screen disagree is listed under
  [Where the implementation departs from the mockup](#where-the-implementation-departs-from-the-mockup).

## Carry-forward provenance

This implementation began as the preserved lane commit `8f86f50`, which was based on the
older main `220b827`. It was cherry-picked onto `a3f6886` with **no conflict**, and all
fourteen files were verified byte-identical to the preserved commit before any decision
was applied — each path's blob hash compared equal between `refs/preserved/umbrella-lane`
and the carried tree. Everything below that point is D1–D5 work on top of it.

## How these observations were produced

    pnpm build                 # repository root — the workspace dist the site resolves
    cd sites/umbrella
    pnpm install
    pnpm build                 # also generates public/engine-sdk/
    PORT=3457 pnpm start

with `NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN` and
`NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN` set to https origins, so the masthead and
footer render their configured-catalog state. Identity, credits, and billing were left
**unwired**, which is the honest default: `/account` shows the signed-out state with its
named key, `/pricing` shows the packs with a disabled "Not for sale yet" control and the
plane's own reason, and that is what was captured.

Driven through headless Chrome (`chrome-devtools-axi`) at three viewports. Note for
anyone repeating this: the harness resets a page's viewport when it opens a new tab, so
the sweep resizes **once** and then navigates in place via `location.href`; a
resize-then-open loop silently measures the default 412px width on every route.

| Rendering | Viewport | What it exercises |
|---|---|---|
| Desktop | 1440 × 1000 | full composition: the two-column hero, 5-up/4-up/3-up rows, both split sections, the three-column docs shell, the 3-profile matrix |
| Tablet | 834 × 1112 | `1024px` and `860px` rules: the hero stacks claim-first, splits collapse copy-first, paired grids halve, docs rail becomes a strip, stat bar goes 2 × 2 |
| Phone | 390 × 844 | `620px` rules: single column throughout, full-width actions, stacked definition lists, wrapped nav |

## Observations

### Layout

**No horizontal page scroll on any of the eight routes at any of the three viewports.**
Measured rather than judged by eye — `document.documentElement.scrollWidth` against
`window.innerWidth`, 24 combinations, all equal:

| Route | 1440 | 834 | 390 |
|---|---|---|---|
| `/` | 1440/1440 | 834/834 | 390/390 |
| `/profiles` | 1440/1440 | 834/834 | 390/390 |
| `/engine` | 1440/1440 | 834/834 | 390/390 |
| `/docs` | 1440/1440 | 834/834 | 390/390 |
| `/pricing` | 1440/1440 | 834/834 | 390/390 |
| `/open` | 1440/1440 | 834/834 | 390/390 |
| `/account` | 1440/1440 | 834/834 | 390/390 |
| `/editor` | 1440/1440 | 834/834 | 390/390 |

The same sweep also walked every element in the body and found **none** escaping its
container except inside a deliberate scroller (`.scroll-x`, `.command`, `.nav`) or the
off-screen skip link. One real defect was found and fixed this way: at 390 the SDK verify
command painted past the viewport instead of scrolling, because a flex item defaults to
`min-width: auto` and refuses to shrink below its content — the scroller is now the
`code` itself.

Other layout behaviour, unchanged from the carried implementation:

- The masthead collapses at `860px`: catalog store links and the divider are dropped
  (they are duplicated in the footer, which is not), and the primary nav moves to its own
  full-width row. It **wraps** rather than scrolling, so at 390 the last item stays
  visible; a scroll strip would have hidden it behind an edge with nothing to say so.
- Both split sections lead with their prose when collapsed (`.split-copy-first`).
- The docs shell degrades in two steps: the on-this-page column is dropped at `1180px`,
  and at `860px` the left rail becomes a horizontal group strip above the article.

New at this revision: the hero is a two-column grid (claim, artifact) that collapses
claim-first at `1024px`, where the canvas widens from 4:3 to 16:9 so a stacked hero does
not push the stat bar an entire screen down.

### Accessibility

Lighthouse (navigation mode, desktop emulation) against the production build:

| Route | Accessibility | Audits failed (all categories) |
|---|---|---|
| `/` | 100 | 0 |
| `/profiles` | 100 | 0 |
| `/engine` | 100 | 0 |
| `/docs` | 100 | 0 |
| `/pricing` | 100 | 0 |
| `/open` | 100 | 0 |
| `/account` | 100 | 0 |
| `/editor` | 100 | 0 |

`/`, `/profiles`, `/account`, and `/pricing` were additionally run in **mobile**
emulation and scored 100 there too.

This extends the carried implementation's five 100s to all eight surfaces. Two real
regressions were introduced by this revision and found by that audit rather than by eye:

1. **`--fg-4` carrying a word.** The new refusal-state header labelled its key with a
   9px "REASON" in `--fg-4`, which Foundations classifies `non-text`; it measured 1.94:1
   on the refused-state fill. It now uses `--fg-2`, the measured `body` token. This is
   exactly the failure the contrast-role classification exists to catch, and the gate
   test now asserts the classification as well as the ratio.
2. **A heading-order jump.** The named-state panel headed itself `h3` unconditionally, so
   a refused route — where the panel *is* the page's first section under its `h1` — jumped
   a level. `StatePanel` now takes a `level` (2 or 3) and the refusal branches on
   `/editor`, `/engine`, and `/open` pass `2`.

Beyond the audit, and asserted in the test files so they cannot regress silently:

- A skip link to the `#main` landmark, visible on focus.
- `aria-current="page"` on the active nav item — the same state the visual marker uses.
- Every nav landmark is labelled (`Primary`, `Documents`, `On this page`).
- A visible `:focus-visible` ring; no rule anywhere removes an outline.
- `prefers-reduced-motion: reduce` collapses the one animation.
- Decorative marks, rails, gradients, and arrows are `aria-hidden`.
- Prose links are underlined, so colour is not the only cue.
- In-page anchors carry `scroll-margin-top` past the sticky masthead.
- The `/profiles` matrix uses `th[scope="row"]`, so each of the three near-identical
  status chips in a row is announced against the operation it belongs to.

### Contrast

Measured in the running page from the *computed* token values, so this table reflects
what site-kit actually served rather than what any file says. WCAG 2.x ratio of every
foreground token this site paints text in, against every surface it sits on:

| Token | `--bg-base` | `--bg-panel` | `--bg-raised` | `--bg-control` | `--bg-field` | `--bg-row` | `--bg-band` |
|---|---|---|---|---|---|---|---|
| `--fg` `#EDEFF2` | 17.39 | 16.66 | 15.88 | 14.69 | 17.29 | 16.16 | 17.10 |
| `--fg-2` `#8A929C` | 6.37 | 6.10 | 5.81 | 5.38 | 6.33 | 5.91 | 6.26 |
| `--accent` `#FF6B2C` | 7.05 | 6.76 | 6.44 | 5.95 | 7.01 | 6.55 | 6.93 |
| `--ok` `#5EEAD4` | 13.54 | 12.97 | 12.37 | 11.44 | 13.47 | 12.58 | 13.32 |
| `--danger` `#FF4D5E` | 6.18 | 5.92 | 5.64 | 5.22 | 6.14 | 5.74 | 6.08 |
| `--info` `#5B9CFF` | 7.29 | 6.99 | 6.66 | 6.16 | 7.25 | 6.77 | 7.17 |
| `--kids` `#A78BFA` | 7.36 | 7.05 | 6.72 | 6.22 | 7.32 | 6.84 | 7.24 |
| `--store-web` `#3FB8C9` | 8.50 | 8.14 | 7.76 | 7.18 | 8.45 | 7.90 | 8.36 |
| `--store-game` `#E8544E` | 5.54 | 5.31 | 5.06 | 4.68 | 5.51 | 5.15 | 5.45 |

The lowest figure in the set is **4.68:1**, so every text colour clears WCAG AA for
normal text on every surface — including `--bg-band`, the one fill this site invented.
`--fg-4` is absent from the table on purpose: Foundations classifies it `non-text`, and
this site uses it only for rules and decorative marks.

### The token layer is site-kit's

Read from the running document rather than from source:

    head order     /_next/static/css/<hash>.css, then <style id="sceneaxi-foundations">
    --bg-base      #07080A     (site-kit FOUNDATION_COLORS)
    --accent       #FF6B2C     (site-kit, surface accent "umbrella")
    --fg-2         #8A929C     (site-kit)
    --radius-lg    9px         (site-kit FOUNDATION_RADII)
    --status-refused-line  #3A2126   (projected from site-kit FOUNDATION_STATUSES)
    --bg-band      #090B0E     (umbrella recorded gap)
    --shell        1280px      (umbrella layout metric)
    body font      Archivo, "Archivo Fallback", Archivo, system-ui, sans-serif
    body bg/fg     rgb(7, 8, 10) / rgb(237, 239, 242)

The framework hoists the site stylesheet *above* the inlined shared sheet, so the two
orders are not ours to choose. That is why the few element rules that must survive either
order are written `html body` rather than `body`, and why `next/font` writes
`--font-archivo` / `--font-jetbrains` instead of the published `--font-ui` / `--font-mono`
— the observed `body font` above is that chain resolving correctly.

### The hero draws a real Sculpt Artifact

The home page's hero is no longer a CSS gradient field. It renders the same composed
`MountableScene` the public open path serves, through the tier's one renderer boundary.
Observed on `/`, reported by the running core rather than by the page:

    draw surface   webgl-canvas
    frame          165
    draw calls     15
    instances      3

`/open` reports the same surface and the same 15 draw calls over the same three
instances (`service-crate-left`, `service-crate-root`, `service-crate-stacked`), which is
the point: there is one artifact, one composition, and one renderer behind both.
`sculpt-viewport.tsx` remains the only module on the tier that constructs a renderer.

The frame *number* above is from the revision whose hero ran a continuous loop. The hero
is now a `snapshot` surface: it attaches no camera input, and its loop stops once the
frame settles instead of redrawing an unchanging image for the rest of the visit, so the
number it reports is the settled frame's rather than a running count. Every figure in
this document is re-recorded from a real browser before push; the values here are the
observation, not a prediction.

## Where the implementation departs from the mockup

Each row is a place the accepted screen and a repository contract disagree, and the
contract wins.

| Accepted screen | What ships | Why |
|---|---|---|
| A full 3 × 10 Game/Web/Kids capability grid, mostly ticked | six ADR 0001 Kernel-seam rows, each cell computed from the conformance registry and the open-path policy: Game "Proven in a demo", Web "Not yet claimed", Kids "Refused" | `profileConformanceRegistry` marks Web and Kids not-yet-claimed and `shippingClaim` is structurally false. The mockup's grid would claim what no test proves. |
| A live scene floated behind the headline under a gradient veil | the real artifact in its own hero column, unveiled | Dimming evidence to make type legible is not a trade this surface makes. The composition changed instead. |
| "Download for macOS", `.dmg` / `.exe` / AppImage cards with sizes and elided digests | one download card for the engine SDK archive, with the size, entry count, and SHA-256 read off the served file | This repository builds exactly one downloadable artifact. |
| `$ npm i -g @sceneaxi/cli` in the hero | `sceneaxi project propose …`, with a note that the CLI ships inside the archive | Private `0.0.0` bootstrap packages; no registry publish authority. |
| Free / Studio $24 per seat / Enterprise tiers, and a seat-subscription account surface | credit packs from the billing plane, and an account surface that explains an **append-only ledger** | SceneAxi sells credits, not seats. A balance is the sum of the ledger's entries, so nothing on `/account` offers to write one — it has no form, no input, and no mutating method. |
| "MOST TEAMS" flag on the middle tier | a "best rate per credit" flag, and only when one pack is strictly better than every other | A recommendation is a product decision. Arithmetic over the returned packs is not. |
| Refusal and empty states largely undesigned | a first-class named state: a Foundations status chip, the name, and the machine key in mono, always visible | Refusal is a defining product behaviour. It also gains no re-attempt affordance, because no contract here defines one. |
| "The renderer is not settled" / three.js as a hypothesis | the settled ADR 0017 decision, read from `LIVE_OPEN_PRESENTATION` | The retired framing is banned tier-wide by `tests/sites/site-seams.test.ts`. |
| Kids card and footer badge linking `sceneaxikids.com` | Kids described, no `href` on either card, a footer line saying this site links to it from nowhere | Kids is a separate origin and `resolveFamilyLinks` has no Kids entry. |
| Family cards naming `sceneaxi.dev`, `store.sceneaxi.dev`, … | cards naming a *surface*, linked only when this deployment resolved that origin | Origins are per-deploy environment values. |
| Five equal sculpt passes | five cards, with surface detail marked optional | `REQUIRED_SCULPT_PASSES` has four entries. |
| Footer columns for Changelog, Roadmap, About, Privacy, Terms | only entries that resolve to routes this site serves | A link to a 404 is a broken promise. |
| Hero stats: 5 passes / 3 profiles / 0 silent writes / 100% text-canonical | starter credits, creator share, 0 silent writes, and the count of free capabilities — all read from site-kit at render time | A hand-written figure is where the site and the gate first disagree. |
| Every control is a `div` with a cursor | real links and buttons with a focus ring | Keyboard reachability. |

## Where this site and site-kit disagreed, and site-kit won

D2 says the shared package wins any disagreement, and it did. These are the values the
carried implementation had chosen for itself that were dropped in favour of the published
Foundations token:

| Was (umbrella-local) | Now (site-kit) | Note |
|---|---|---|
| a five-step text ramp `--fg-2 #C6CCD4`, `--fg-3 #A7AEB8`, `--fg-4 #8A929C`, `--fg-5 #7C8593` | `--fg`, `--fg-2` for text; `--fg-4` for non-text | Foundations prints three text levels and records `--fg-3` as a deliberate gap. Inventing mid-tones to keep a four-step hierarchy would have been inventing visual facts the archive does not state. |
| `--card #0B0D10`, `--card-raised #0D0F12`, `--card-chip #12151A` | `--bg-panel`, `--bg-raised`, `--bg-control` | Mapped by role onto the published base → panel → raised → control ladder; every surface moves one step lighter. |
| `--rule-3 #20262E`, `--rule-4 #262C34`, `--rule-hover #333A44`, `--rule-hover-2 #3D4550` | `--line-strong #2C323B` | Foundations publishes three line weights, not seven. |
| `--radius 10px`, `--radius-sm 6px` | `--radius-lg 9px`, `--radius-md 5px` | The published radius scale. |
| `--accent-soft #E5B98A` | `--accent-hi #FF8A54` | The sheet prints one hover/active accent; the softened tint was not one of its values. |
| `--deny`, `--iso`, `--web`, `--game` | `--danger`, `--kids`, `--store-web`, `--store-game` | Same hexes, published names. |
| status line/fill pairs written out per tone | projected from `FOUNDATION_STATUSES` | Same six rows, now derived, so a status colour changed in site-kit changes here. |
| `rgba(7, 8, 10, …)` / `rgba(255, 107, 44, …)` overlays | `color-mix(in srgb, var(--bg-base) …)` / `var(--accent)` | A translucent overlay restating a token is still a second source for it. Pure black and white veils stay literal, because they are opacity rather than palette. |

Three values remain umbrella-local, listed in `UMBRELLA_RECORDED_GAPS`: `--bg-band
#090B0E` (Foundations prints no marketing-band fill) and `--store-web-line` /
`--store-web-bg` (it prints a line/fill pair for the six statuses only — a gap
`docs/design-foundations.md` already records for the storefront accents).

The gate scans **every** umbrella source for a colour literal, not just the module that
holds those three, and allows one further list: `src/lib/viewport-letterbox.ts`, which
*restates* published Foundations values the browser bundle cannot import. It has one
entry, `--bg-base #07080A`, and it exists because the WebGL clear colour is a value
handed to the presentation core rather than a custom property the sheet resolves, and the
module that hands it over is a `"use client"` module. The gate pins each entry back to
`FOUNDATION_COLORS`, so a restatement cannot drift from what the archive publishes.

That widening is what caught the last hardcoded colour on this site: the viewport cleared
its canvas to an invented `#0b0e13` while `.viewport` painted `--bg-base` behind it, and
the old scan read only `src/lib/foundations.ts`, so it never looked. The letterbox is one
colour now on every surface that mounts the viewport.

## One structural divergence, recorded

`/profiles` needs `profileConformanceRegistry` and `OPEN_PATH_POLICY`, both owned by
`@sceneaxi/schemas`. `docs/dependency-matrix.json` allows this site four edges —
`@sceneaxi/site-kit`, `@sceneaxi/engine-presentation`, `@sceneaxi/auth`,
`@sceneaxi/billing` — and none of them re-exports either table.

The durable home for that projection is a re-export from `@sceneaxi/site-kit`, which is
how every other contract shape reaches the `sites/` tier. `packages/site-kit` is a shared
seam this lane may not edit, so the projection ships instead as a **bundled mirror**
(`src/lib/profile-matrix.ts`) held in lockstep with both contracts by
`tests/sites/umbrella-profile-matrix.test.ts`, which runs from the repository root where
naming `@sceneaxi/schemas` is allowed. The mirror carries only what the contracts state
and **no cell**: every cell is computed by `profileCapabilityStatus()`, whose branches
make `proven` unreachable for a refuse-only profile, for a profile that has not claimed
conformance, for an operation outside the row's own list, and for a row with no committed
evidence. Adversarial inputs for all four are in that test.

Moving the projection into site-kit later is a small, mechanical change; nothing on the
page would move.
