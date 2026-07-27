# Umbrella visual implementation — recorded observations

Evidence for sceneaxi#157: the captain-accepted `Umbrella Site` design screen,
implemented responsively over the existing live viewport and site-kit seams.

This file records **browser observations**, the way `docs/three-presentation-core.md`
records the pixel claim. It is not a gate result and it authorizes nothing. The gate's
own half of this work is `tests/sites/umbrella-visual.test.ts`, which runs in
`pnpm gate` and asserts the structure and the claims; nothing here is asserted twice.

## Source authority

- Accepted screen: `Umbrella Site.dc.html`, from the captain-supplied
  `SceneAxi Design System.zip`, SHA-256
  `ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159`.
- Behavioural precedence, as the lane defines it: repository contracts, ADRs, schemas,
  refusal registries, and executable gates override contradictory mockup behaviour or
  copy. Every place that bit and the accepted screen disagree is listed under
  [Where the implementation departs from the mockup](#where-the-implementation-departs-from-the-mockup).

## How these observations were produced

    cd sites/umbrella
    pnpm install
    pnpm build      # also generates public/engine-sdk/
    pnpm start

with `NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN` and
`NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN` set to https origins, so the masthead and
footer render their configured-catalog state. Identity, credits, and billing were left
**unwired**, which is the honest default: `/pricing` shows the packs with a disabled
"Not for sale yet" control and the plane's own named reason, and that is what was
captured.

Driven through headless Chrome (`chrome-devtools-axi`) at three viewports:

| Rendering | Viewport | What it exercises |
|---|---|---|
| Desktop | 1440 × 1000 | full composition: 5-up, 4-up, 3-up rows, both split sections, the three-column docs shell |
| Tablet | 834 × 1112 | `1024px` and `860px` rules: splits collapse copy-first, paired grids halve, docs rail becomes a strip, stat bar goes 2 × 2 |
| Phone | 390 × 844 | `620px` rules: single column throughout, full-width actions, stacked definition lists, wrapped nav |

## Observations

### Layout

- **No horizontal page scroll at any viewport.** Measured directly rather than judged
  by eye: `document.documentElement.scrollWidth` equalled `window.innerWidth` at both
  390 (390 vs 390) and 834 (834 vs 834). Wide evidence — the capability matrix, the
  scene table, the pipeline strip, the terminal — scrolls inside its own
  `overflow-x: auto` container.
- The masthead collapses at `860px`: catalog store links and the divider are dropped
  (they are duplicated in the footer, which is not), and the primary nav moves to its
  own full-width row. It **wraps** rather than scrolling, so at 390 "Pricing" sits on a
  second row and stays visible; a scroll strip would have hidden it behind an edge with
  nothing to say so.
- Both split sections lead with their prose when collapsed (`.split-copy-first`), so the
  reader meets "Nothing writes to your scene without you" before the diff panel, and
  "Every button is also a command" before the terminal — matching the mockup's reading
  order rather than its source order.
- The docs shell degrades in two steps: the on-this-page column is dropped at `1180px`,
  and at `860px` the left rail becomes a horizontal group strip above the article.

### Accessibility

Lighthouse (navigation mode, desktop emulation) against the production build:

| Route | Accessibility | Audits failed |
|---|---|---|
| `/` | 100 | 0 |
| `/engine` | 100 | 0 |
| `/docs` | 100 | 0 |
| `/pricing` | 100 | 0 |
| `/open` | 100 | 0 |

`/open` initially scored 98 on `heading-order`: the shared viewport's frame report is an
`h3`, and the public page had no `h2` above it — on `/editor` that heading is "Viewport".
Fixed by giving the section its own `h2` rather than by demoting the shared component,
whose level is correct on the entitled route.

Beyond the audit, and asserted in the test file so they cannot regress silently:

- A skip link to the `#main` landmark, visible on focus.
- `aria-current="page"` on the active nav item — the same state the visual marker uses,
  so the two cannot drift. This is the only reason `site-nav.tsx` is a client component.
- Every nav landmark is labelled (`Primary`, `Documents`, `On this page`).
- A visible `:focus-visible` ring; no rule anywhere removes an outline.
- `prefers-reduced-motion: reduce` collapses the one animation (the early-access pulse).
- Decorative marks, rails, gradients, and arrows are `aria-hidden` — each is an empty
  span that would otherwise be announced as noise.
- Prose links are underlined, so colour is not the only cue.
- In-page anchors carry `scroll-margin-top` past the sticky masthead.

### Contrast

Every declared text token against every surface it sits on, WCAG 2.x ratio:

| Token | `--bg` `#07080a` | `--card` `#0b0d10` | `--card-raised` `#0d0f12` | `--card-chip` `#12151a` |
|---|---|---|---|---|
| `--fg` `#edeff2` | 17.39 | 16.89 | 16.66 | 15.88 |
| `--fg-2` `#c6ccd4` | 12.39 | 12.03 | 11.87 | 11.32 |
| `--fg-3` `#a7aeb8` | 8.96 | 8.70 | 8.58 | 8.18 |
| `--fg-4` `#8a929c` | 6.37 | 6.18 | 6.10 | 5.81 |
| `--fg-5` `#7c8593` | 5.37 | 5.22 | 5.15 | 4.91 |

Signal colours on `--bg`: accent `#ff6b2c` 7.05, ok `#5eead4` 13.54, deny `#ff4d5e`
6.18, isolated `#a78bfa` 7.36, web `#3fb8c9` 8.50. The accent button's ink
(`#07080a` on `#ff6b2c`) is 7.05.

The lowest figure in the whole set is 4.91:1, so every text colour clears WCAG AA for
normal text on every surface. The test recomputes this table from the CSS rather than
trusting this file, and fails on any token that drops below 4.5.

### The live viewport still draws

The visual layer changed no renderer code. `/open` was observed drawing into a real
WebGL canvas, and the page's own frame report — which comes from the running
presentation core, not from the page — read:

    backend        three
    label          Three presentation core
    draw surface   webgl-canvas
    pixels drawn   true
    draw calls     15
    mounted        service-crate-left, service-crate-root, service-crate-stacked

`sculpt-viewport.tsx` remains the only module on the tier that constructs a renderer;
the home page's hero art is a CSS gradient field, deliberately, so the accepted screen's
live hero scene does not become a second renderer.

## Where the implementation departs from the mockup

Each row is a place the accepted screen and a repository contract disagree, and the
contract wins.

| Accepted screen | What ships | Why |
|---|---|---|
| "Download for macOS", `.dmg` / `.exe` / AppImage cards with sizes and elided digests | one download card for the engine SDK archive, with the size, entry count, and SHA-256 read off the served file | This repository builds exactly one downloadable artifact. A size or digest typed into a page would be invented. |
| `$ npm i -g @sceneaxi/cli` in the hero | `sceneaxi project propose …`, with a note that the CLI ships inside the archive and there is no registry install yet | Private `0.0.0` bootstrap packages; this repository holds no registry publish authority. |
| Free / Studio $24 per seat / Enterprise tiers | credit packs from the billing plane, in the same card layout | SceneAxi sells credits, not seats. Pack contents and prices are owned by `@sceneaxi/billing`; an unwired plane shows the packs and refuses the purchase by name. |
| "MOST TEAMS" flag on the middle tier | a "best rate per credit" flag, and only when one pack is strictly better than every other | A recommendation is a product decision. Arithmetic over the returned packs is not. |
| "The renderer is not settled" / three.js as a hypothesis | the settled ADR 0017 decision, read from `LIVE_OPEN_PRESENTATION` | The retired framing is banned tier-wide by `tests/sites/site-seams.test.ts`. |
| Kids card and footer badge linking `sceneaxikids.com` | Kids described, with no `href` on either card, and a footer line saying this site links to it from nowhere | Kids is a separate origin and `resolveFamilyLinks` has no Kids entry to resolve. |
| Family cards naming `sceneaxi.dev`, `store.sceneaxi.dev`, … | cards naming a *surface*, linked only when this deployment resolved that origin | Origins are per-deploy environment values this repository does not own. |
| Five equal sculpt passes | five cards, with surface detail marked optional | `REQUIRED_SCULPT_PASSES` has four entries; the optional pass is permitted, not required. |
| Footer columns for Changelog, Roadmap, About, Privacy, Terms | only entries that resolve to routes this site serves | A link to a 404 is a broken promise. |
| Hero stats: 5 passes / 3 profiles / 0 silent writes / 100% text-canonical | starter credits, creator share, 0 silent writes, and the count of free capabilities — all read from site-kit at render time | A hand-written figure on a marketing page is the easiest place for the site and the gate to disagree. |
| `#6E7681`, `#565E68`, `#3F464F` carrying text | those values kept as `--rule-*` and `--deco` only; text uses the ramp above | They measure 4.36, 3.05, and 2.10 against the page. |
| Every control is a `div` with a cursor | real links and buttons with a focus ring | Keyboard reachability. |
