# SceneAxi redesign — Direction v6 (v5 ported onto origin/main)

| Field | Value |
|---|---|
| Date | 2026-10-05 |
| Author | director node, port run `sceneaxi-impeccable-redesign-main` (impeccable 4.3.1) |
| Status | **The design is frozen at v5**, which the user approved. v6 re-targets it onto R = `origin/main` `dffefbab` (the commit production runs, per live `/api/health`). Ruling R-9 (`docs/redesign/RULINGS.md`) governs: port-only adaptations are Deviations marked **port** (§8.1). |
| Inputs | `docs/redesign-v5-reference/` (DIRECTION v5, RULINGS R-1..R-8, lane and review reports), `PRODUCT.md`, `DESIGN.md`, `docs/design-foundations.md` (main adds decisions D-4..D-7), `docs/engine-desktop-surface.md`, main's tests, BEFORE shots of main and of live production in `E/before/` |
| Reference implementation | OLD = `/home/devuser/Documents/Projects/sceneaxi` working copy (read only) plus the v5 lane reports. Port data: `E/port/threeway.txt` (per file: v5 lane delta PRE→OLD and main drift PRE→main, where PRE is the v5 pre-redesign tree rebuilt from `4e532e2f` plus the v5 backup patches) |
| Evidence dirs | E = `/home/devuser/Documents/Reports/sceneaxi-redesign-main`. BEFORE `E/before/<surface>/` and `E/before/live/`; lanes write `E/after/<lane>/`; final review writes `E/final/<surface>/` |

**How to read v6.**

- §1 to §6 and the v5 table in §8 are **v5 verbatim**: every decision and every DV row carries over unchanged. Their file and line references point into the v5 tree; resolve them by symbol in R (the Port notes name the new homes).
- Where one of main's tests forces a different *mechanism* for a v5 decision, the §8.1 port row wins. The **Port overlay** block before §1 lists every such place.
- §0, §7, §9, §10, §11 and the Port notes are new for main.
- Wherever v5 text cites `docs/redesign/RULINGS.md`, read R's copy at the same path. It holds R-1..R-8 verbatim plus R-9.

**Process notes.** I ran `context.mjs --target` with cwd R for `sites/umbrella`, `sites/catalog-web`, `sites/kids`, `apps/web-shell` and `apps/desktop-shell`; the outputs are in `E/context/`. As in v5, the site targets resolve no PRODUCT/DESIGN because they are separate install roots. Site lanes therefore read `R/PRODUCT.md`, `R/DESIGN.md` and this file directly. References read: `shape.md` and `operate.md` (the register file; the skill ships no `product.md` or `brand.md`). No interview was held, because the user approved v5 and the design is frozen. No concept-seed roll was run, because no surface gets a new identity.

---

## 0. Contract pins every lane must respect (re-derived from main's tests)

These pins are executable. A lane that breaks one has changed behaviour, not visuals. Line numbers are main's (`dffefbab`). Where a pin differs from v5 §0, the row says so.

### 0.1 Umbrella (`tests/sites/umbrella-visual.test.ts`, `tests/sites/umbrella-*.test.ts`, `sites/umbrella/test/first-release.visual.spec.ts`)

| Pin | Where | What it forces |
|---|---|---|
| `globals.css` has no hex at all; it redeclares no Foundations colour token; every bare `var(--x)` it reads resolves to a name that `umbrellaFoundationsCss()` emits, or to `localMetrics` (`--shell`, `--gutter`, `--band-pad`, `--masthead-h`, `--ed-narrow-dock`, `--ed-narrow-note`, `--ed-narrow-canvas`) | `umbrella-visual.test.ts:604-650` | as v5. The emitted set is the **composed** sheet (`sites/umbrella/src/lib/foundations.ts:122-134`), so a name composed there counts as emitted (DV-P1 relies on this). A per-element index is read only as `var(--i, 0)` (with a fallback), or by `:nth-child()` delays |
| **D-4 motion (new on main).** The sheet declares none of `--motion-fast`, `--motion-base`, `--ease-standard`. Every `transition`, `transition-duration` and `transition-timing-function` outside the reduced-motion blocks reads `var(--motion-fast)` or `var(--motion-base)` **and** `var(--ease-standard)`, with no literal `ms`/`s`. Every `transform:` inside a rule whose selector has `:hover`, `:focus`, `:focus-visible`, `:focus-within` or `:active` is exactly `translateX(3px)`, `scale(1.015)` or `none` | `umbrella-visual.test.ts:388-453` | DV-P2 (transitions ride D-4 tokens) and DV-P3 (no press scale, 3px nudges, media scale 1.015). Keyframe `animation`s are outside this pin and keep the v5 tokens |
| Skip link (`.skip-link:focus`), `.nav a[aria-current="page"]`, `:focus-visible {` with `outline: 2px solid var(--accent-hi)` and never `outline: none`/`0`, `@media (prefers-reduced-motion: reduce)` present, a role on every focusable `scroll-x` region, `main p a,` with `text-decoration: underline`, `scroll-margin-top: calc(var(--masthead-h) + 24px)` | `:504-565` | as v5 |
| No colour function (`rgba`/`hsla`/`color-mix`) and no undeclared quoted hex in any umbrella **TS/TSX** source | `:672-700` | colour lives in CSS only; state layers are CSS |
| The client-component list is pinned: `site-nav`, `sculpt-viewport`, `hero-viewport`, `download-cta`, `editor-shell`, `editor-viewport`, `live-viewport`, `error.tsx` | `:1049-1066` | no new `"use client"` file on the umbrella. Motion helpers go inside an existing client file (v5's `useIndicatorGlide` lives in `editor-shell.tsx`); a login submit busy marker stays n/a |
| `h1`/`h2` font sizes use `clamp(`; every multi-column grid has a single-column phone rule; wide evidence sits in its own scroller; the nav is reachable at every width without JS state | `:999-1040` | as v5 |
| Editor shell: archive metrics stay owned by the stylesheet; the Kids refusal is the whole editor body; the palette is withdrawn under Kids and below the minimum window; focus is contained in the palette; the narrow-tier row budget is `--ed-narrow-*` | `:1221-1520` | as v5 (`/editor` geometry stays) |
| No em dash in the launch surface; Download is the hero primary; comparisons are not scored; short-height and breakpoint rules exist for the hero | `tests/sites/umbrella-launch-marketing.test.ts:30-161` | as v5 |
| **Overview geometry (new on main, Playwright):** at 1280×640 the H1 and `.download-primary` sit above the fold and `.release-hero .viewport` is ≤301px tall. The hero splits from 1025px (stage right of `.hero-copy`) and stacks at 1024. Wordmark and nav share a row at 861 and wrap at 860. `.launch-proof` pairs on one row at 621 and stacks at 620. At 1440×900 the stage is ≥671×503, `.download-primary` and `.release-actions > .button-quiet` share a row and are both exactly 46px tall, and the `.launch-proof-rail` top is ≤720. At 390 the stage top is ≤700 and the quiet action is narrower than Download and sits below it. Masthead ≤61.5px at 1440 and ≤104px at 390. Wordmark, `.hero-copy` and `.footer-brand` share one left edge (<1px) | `first-release.visual.spec.ts:82-137,266-310` | DV-P9 |
| **Overview type ramp (new):** smallest text ≥11px; **at most 9 distinct rendered font sizes** on `/` at 1440 and at 390; H1/H2 ≥1.4 at 1440; H2 ≥28px at 390 | `first-release.visual.spec.ts:348-396` | DV-P9: `/` collapses the §3 roles to ≤9 rendered sizes |
| **Proof gallery (new):** `.proof-gallery .proof-figure` × 3, equal heights, lazy `img` with alt, a `.proof-limits li` in each, no `img` inside a link, `.proof-link` only to `/engine` or `/docs`; stacked at 390 | `first-release.visual.spec.ts:312-346`; `umbrella-visual.test.ts:332-386` | the new ProofFigure brief (§7.2) |
| **Composited contrast list (new):** these selectors must exist and composite to ≥4.5:1 on the overview: `.download-primary`, `.download-context`, `.platform-availability li` (+ both `data-availability` spans), `.launch-proof dd/dt`, `.comparison-sceneaxi td:nth-child(2)`, `.profile-release-matrix tbody td`, `.path-links a`, `.masthead .nav a`, `.masthead-actions .button`, **`.badge`**, `.hero-stage-note`, `.proof-title`, `.proof-claim`, `.proof-level`, `.proof-limits .chip`, `.proof-link`, comparison row headers, `.profile-release-matrix thead .chip`, `.matrix-note p`, `footer .footer-col a`, `footer .footer-version` | `first-release.visual.spec.ts:169-264` | these class names stay. The release chip keeps class `badge` (DV-P8) |
| **Pending hero panel (new, JS off):** `.release-hero .hero-stage[data-frame="pending"]`, note "Opening a committed Sculpt Artifact", and `.viewport::after` at opacity `1` with a `linear-gradient` background image | `first-release.visual.spec.ts:398-420` (the grid is named only in the comment at :411; the assertions at :418-419 check opacity and the `linear-gradient` substring) | DV-P10: the panel keeps a plain `linear-gradient` fill at opacity 1 with **no grid lines**, for example `linear-gradient(var(--bg-panel), var(--bg-raised))` from the emitted set, within D-5. Main's two-axis 28px grid (`globals.css:1161-1164`) goes, as the §2.5/§5 ban requires. The row 15 aperture never leaves `::after` below opacity 1 at rest |
| Keyboard order: Tab 1 = `.skip-link`, Tab 2 = `.masthead .wordmark` with an outline ≥2px; `.comparison-scroll` is focusable | `first-release.visual.spec.ts:139-167` | as v5 |

### 0.2 Shared foundation (`packages/site-kit/test/design-tokens.test.ts`, `tests/sites/maintenance-compat.test.ts`)

| Pin | Where | What it forces |
|---|---|---|
| **D-4 (new on main):** `FOUNDATION_MOTION` is exactly `--motion-fast` 120ms, `--motion-base` 200ms, `--ease-standard` `cubic-bezier(0.2, 0, 0, 1)`. The lines of `foundationsVariablesCss()` and of `foundationsCss({surface})` that match `/^\s*--(?:motion\|ease)-/` are exactly those three, for every surface | `design-tokens.test.ts:294-318`; `maintenance-compat.test.ts:203-219` | **v5 §6.1 cannot be emitted from those two functions.** DV-P1: the v5 set ships as a separate group and emitter, composed by each site |
| Spacing `[4, 8, 12, 16, 24, 32, 44, 72]`; 16px radius Kids-only; float is the only outer shadow; 10 type steps over two families; `accentHi` non-null for `umbrella` and `engine-desktop` only; the store CSS has `--accent-hi: #E8544E;` and exactly 2 more lines than the base | `design-tokens.test.ts` (type steps :102; surface accents :188-215; store sheet two-line delta :255) | as v5 (DV-F4 stays withdrawn) |

### 0.3 Storefronts (`tests/sites/catalog-storefronts.test.ts`, `sites/catalog-*/test/*`, `sites/catalog-game/test/rendered-route-states.test.mjs`)

| Pin | Where | What it forces |
|---|---|---|
| Everything below `STORE IDENTITY` is byte-identical across both sheets; each store has its own identity block; the same component files exist on both stores | `catalog-storefronts.test.ts:312-352` | lane-catalogs edits both stores in lockstep |
| No Foundations v2 token of the store's own; no Foundations colour literal in any notation; the store serves site-kit's emitted sheet from its layout; a colour literal only where no token exists | `:386-479` | as v5. DV-F12 inline copies stay in `global-error.tsx`, which is outside the scanned set |
| Mobile-first breakpoints only; never masks horizontal overflow; no unconditional fixed-column grid; bounded sticky columns stay keyboard-reachable; `html { scroll-padding-top: var(--sticky-top) }` | `:480-565` | layout rules hold while restyling |
| The reduced-motion block contains `animation-duration: 0.001ms !important` and `animation-iteration-count: 1 !important`; every `@keyframes name` is used as `animation: name` | `:567-579` | keep the blanket rule first; each store keyframe is referenced with the shorthand |
| `--fg-4` never paints text; skip link and visible focus ring; `--micro` is `0.6875rem`, and every `font-size` resolves at or above 0.6875rem through the store's **own** tokens | `:641-698` | never `var(--type-*-size)` on a store (as v5) |
| Store component public exports and legacy props survive (`digest-figure` large/ok props, explicit variant precedence) | `maintenance-compat.test.ts:221+` | restyle through classes; props keep their names and meaning |
| Loading: `role="status"`, `aria-live="polite"`, `aria-busy="true"`, `<h1>Loading catalogue</h1>` (attribute-free), "No purchase is being made", no `input/form/button/https`, no balance/credits/price/purchased. Error: renders "This page could not be rendered", `public-reference`, `href="/"`, never the message | `rendered-route-states.test.mjs:28-47` | the error boundary's reference element keeps the `public-reference` class |
| Root fallbacks (`catalog-game`, `catalog-web`, `kids`) render `<html lang="en">`, an attribute-free `<body>` and `<h1>`, and `role="alert"`, with no error text, `https`, `button`, `form` or `input`; Kids' has no `<a>` and none of catalog/purchase/provider/account/credit/billing. The harness transpiles and evaluates each file with only `exports` and `React`, so **any import throws** | `rendered-route-states.test.mjs:15-26,66-75` | as v5 (§7.3 / §7.4 inline `<style>`, DV-F12) |
| `catalog-ux-regression.test.ts`, `item-session-wiring.test.ts` (node `--test`) in each store | `sites/catalog-*/test/` | behaviour and copy hold |

### 0.4 Kids (`tests/sites/kids-surface.test.ts`, `sites/kids/test/production-activity.spec.ts`, parity)

| Pin | Where | What it forces |
|---|---|---|
| The colour-token set is exactly the pinned one; the neutrals equal `FOUNDATION_COLORS`; 4.5:1 on every shipped text pairing, including the world gradients; the stage is a named `role="group"`; copy holds "Make a tiny world", "Play my world", "For grown-ups", with no `<a>`, `<form>`, fetch or account words | `kids-surface.test.ts:267-312` | Kids adds no colour token |
| The reducer is byte-identical to the profile copy, with no import edge | `kids-surface.test.ts:112-147` | **never touch `sites/kids/src/lib/kids-activity.ts`** |
| Under reduced motion a placed piece's computed animation is ≤0.000001s with 1 iteration | `production-activity.spec.ts:19-80` | the blanket reduce rule stays |
| `loading.tsx` source contains no `import`, process, fetch, XMLHttpRequest, WebSocket, EventSource, account, billing, catalog, provider, session or environment; it renders `role="status"`, `aria-busy`, `<h1>…</h1>` and no input/form/button/https/canvas | `rendered-route-states.test.mjs:54-63` | as v5 |

### 0.5 Web shell (`apps/web-shell/test/visual-postpr.test.ts`, `inspector-accessibility.test.ts:270-283`, `dev-server.test.ts`)

Unchanged from v5. Every string in the v5 block below is still asserted on main (checked string by string). The `inspector-accessibility` lines moved from `:234-247` to `:270-283`. The busy-diff rail is still cited by location, because the literal itself is a detector finding (DV-X1).

```text
# apps/web-shell/test/visual-postpr.test.ts
+ white-space: pre-wrap; overflow-wrap: anywhere
+ font-variant-numeric: tabular-nums
+ the full long path text (never truncated)
+ min-width: 0
+ :is(button,input,select,textarea,a[href],summary,[tabindex]):focus-visible
+ @media (forced-colors: active) { :focus-visible { outline-color: Highlight; } }
+ outline: 2px solid currentColor
+ button:not(:disabled):active
+ button[disabled] { cursor: not-allowed; border-style: dashed; }
- opacity: .45
+ #note:not(:empty)
+ @media (prefers-color-scheme: dark) { .refused { color: #FF4D5E; } }
+ background: Canvas; color: CanvasText
+ id="note" role="status" aria-live="polite"
+ pre:empty { min-height: 3rem; border-style: dashed; }
+ the pre[aria-busy="true"] rule: 3px inline-start border width, exact string in the test
+ tab-size: 2; line-height: 1.65
+ code { overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
+ :user-invalid { border-color: #FF4D5E; }
# apps/web-shell/test/inspector-accessibility.test.ts:270-283
+ .refused { color: #b3261e; }
+ .refused { color: #FF4D5E; }
+ overflow-wrap: anywhere
+ white-space: pre-wrap
+ color-scheme: light dark
+ outline-color: Highlight
+ [aria-invalid="true"]
+ border-color: Mark
- <script ... src=    - onclick=    - https://
```

`#recover`/`#reconcile` still toggle `hidden` from script (`inspector-app.ts:852-853,886,907`), so they have no exit motion (§6.2 rule 4).

### 0.6 Engine Desktop (`apps/desktop-shell/test/*.test.ts`)

| Pin | Where | What it forces |
|---|---|---|
| `[hidden]{display:none !important}`; menus (`role="menu" hidden`, `chrome/frame/markup.ts:50`), the refusal legend, the details mode button (`:104`), dock panels and overlays show and hide by `hidden` | `chrome.test.ts:129`; `visual-tokens.test.ts` opacity gate | no exit motion for these; entrances are keyframes on `:not([hidden])` (§6.2 rule 4) |
| The reduced-motion block matches `/prefers-reduced-motion:reduce\)\{[^}]*animation-duration:\.001ms/` | `chrome.test.ts:343-347` | the blanket rule stays first in that block |
| `:focus-visible{outline:2px solid var(--accent)`; tier queries `(max-width:1439px)` and `(max-width:1179px)`; `.shell[data-assistant="open"] .assistant-toggle{`; `.shell[data-profile="kids"] .profile-refusal{display:grid}`; `.title-actions .drawer-toggle{display:inline-flex}` | `chrome.test.ts:350-550` | selectors keep their exact text |
| The rendered chrome never contains `transform:scale(` or `width:1680px` | `chrome.test.ts:464-465` | **the desktop never scales** (as v5) |
| No `opacity:` declaration outside `@keyframes` in the rendered chrome (default, kids, sculpt running, palette); the inert state is painted (`--inert:`, `--inert-on-accent:`) | `visual-tokens.test.ts:282-336` | desktop motion uses transform/clip-path/filter in transitions and opacity only inside keyframes |
| **Pinned token groups (new on main):** `TYPE_SCALE` (caption 11, small 12, body 13, body-strong 13, title 14, heading 16, display 20, hero 24, mono 12, every size ≥11), `SPACE` `{1:4,2:8,3:12,4:16,5:20,6:24,8:32}`, `RADIUS` `{xs:2,sm:4,md:6,lg:10,pill:999}`, `DENSITY` (comfortable/compact), **`MOTION` `{fast:100, base:160, slow:220, in:"cubic-bezier(.2,0,0,1)", out:"cubic-bezier(.4,0,1,1)"}`**; every group frozen | `visual-tokens.test.ts:176-220` | DV-P5: v5's `MOTION` and `RADIUS` cannot take those names. v5's `TYPE_SIZE` does not collide with `TYPE_SCALE` and lands as in v5. No desktop test ties chrome heading sizes to `TYPE_SCALE` (main sizes `.overlay-head h2` at 15px and `.window-refusal h1` at 17px, `chrome/core/styles.ts:170,187`), so §3 "headings 15/17px" stands |
| `ui-kit` CSS: every spacing value is `var(--space-1..6,8)` (or `calc(var(--space-1) * 0)`); it emits `--space-N` from `SPACE` and `--r-name` from `RADIUS`; `--ui-control`, `--ui-icon`, `--ui-body` from `DENSITY`; `:focus-visible` with `outline-offset:2px` and `-2px`; no `opacity:`, `rgba(`, URL, `@import` or `@font-face` | `ui-kit.test.ts:160-183` | the component kit keeps token-only spacing and painted states |
| Pinned 2px left rails on `.scene-entity-identity`, `.assistant-result`, `.overlay-refused .overlay-body`, `.desktop-byo-config-message`; `.desktop-byo-config button{transition:none}`; `.assistant-live i` holds `animation:assistant-bars`; busy `.assistant-progress` has no animation; `--space-3:12px`; `--rail:56px;--left:274px`; `.panel-head` 11px / 32px; the pinned 10px text `.scene-entity-identity code` and `.asset-browser-card span`; press = `box-shadow:inset` on `button:not(.is-inert):not(:disabled):not([aria-disabled="true"]):active` and on the BYOK `button:not(:disabled):active` | `visual-refinement.test.ts:32-118` | unchanged from v5 (DV-X1, DV-D2 exceptions) |
| `.refusal-legend-panel{position:absolute` and `overflow:auto;padding:10px 12px` | `chrome-frame.test.ts:35-36` | the legend keeps its pinned padding |
| `.scene-catalog-editor` grid geometry; `.inspector > section` `flex-shrink:0`; `.left-dock,.inspector` `overflow-y:auto` | `keyboard-geometry.test.ts:28-33,70` | layout holds |
| Selector lists are parsed on `,` by the control accounting | `control-accounting.test.ts:300-330` | write scrims and similar as plain selectors (as v5 polish r2 did) |
| Icon markup has no URL, `data:`, `<style>`, `<script>`, `<image>`, `foreignObject` or `on*=` | `icons.test.ts:66` | icons stay inline, self-contained SVG |

### 0.7 End-to-end goldens (`tests/e2e/*golden*`)

| Pin | Where | What it forces |
|---|---|---|
| The desktop goldens render the real chrome markup and run the chrome script, then assert `hidden` toggles, `data-*` hooks, control ids and command wiring | `tests/e2e/desktop-chrome-*-golden.test.ts` (assistant, dock, frame, inspector, palette, settings, tree and viewport inventories and interactions), `desktop-editor-command-forms-golden.test.ts`, `desktop-control-inventory-golden.test.ts` | the v5 motion script appended to `chrome/core/script.ts` runs inside these tests. It must stay motion only: no `hidden`, `data-*`, id, role or label change, no delayed toggle, and a guard for a missing `MutationObserver` or `host.animate` |
| The umbrella goldens render the editor viewport and the live `/open` path | `tests/e2e/umbrella-editor-viewport-golden.test.ts`, `umbrella-live-open-golden.test.ts` | markup hooks in `editor-viewport.tsx`, `live-viewport.tsx` and `sculpt-viewport.tsx` keep their names; v5's value-keyed counter cells (row 16) must not change the asserted text |

**Detector rule and its only exceptions.** Every touched file must reach 0 detector findings, except the contract-held test-pinned rails (DV-X1: the web-shell busy rail and the four desktop selectors). The pending hero panel is no longer an exception (DV-P10 now has no grid).

A lane reports these as "pinned, accepted" and adds no new one. Main's BEFORE detector counts are in `E/before/NOTES.md`.

---

## Port overlay (read with §1–§6)

The text of §1–§6 is v5 verbatim. These are the only places where a port row changes how it lands on main:

- **§3 `/` route.** At most 9 rendered sizes and H1/H2 ≥1.4 (DV-P9).
- **§4.** Desktop `SPACE` keeps `5: 20` (pinned). No restyled rule reads `--space-5` (DV-P5).
- **§5 Button "active: press scale (sites, web shell)".** On the umbrella and the storefronts, press is the 12% state layer and does not scale. The web shell and Kids keep the scale (DV-P3).
- **§5 Viewport frame "no drop shadow".** It wins over main's doc-only D-6 float frame. The same frame applies to the new proof captures (DV-P12).
- **§6.1.** The site tokens are emitted by a separate site-kit group and emitter, not by `foundationsVariablesCss()` (DV-P1). On the desktop the `MOTION` column lands as a group named `MOTION_SYSTEM` (DV-P5).
- **§6.2 / §6.3 transitions on sites.** Every `transition` reads D-4 `--motion-fast`/`--motion-base` with `--ease-standard` (DV-P2). Every keyframe `animation` keeps the v5 tokens and curves.
- **§6.3 rows 1 and 2 on sites.**
  - Arrow nudge: `translateX(3px)`.
  - Tile lift: media `scale(1.015)` inside its clip.
  - Press: no transform (DV-P3).
- **§6.3 rows 11 and 19.** They stand, and supersede the entrance and scroll clauses of main's D-4 record (DV-P4).
- **§6.2 rule 5 and R-2.** Unchanged. On the desktop, R-1/R-2 still cover only `assistant-bars` and `sweep`. Main's refinement pass removes its five other assistant loops from the rendered chrome, and they stay absent: nothing is retimed or added (DV-P7).

---

## 1. Scene sentences and theme per surface

Theme is chosen from the physical scene, never the category.

| Surface | Scene sentence | Theme | Visitor mode |
|---|---|---|---|
| Umbrella `/`, `/engine`, `/pricing`, `/profiles` | A developer at a desk in the evening, comparing SceneAxi with Unity, Godot and Three.js in one tab among many, deciding whether to download. | Dark Foundations bench, signal orange | Persuade |
| Umbrella `/open` | The same person watching a real artifact draw, wanting to know it is real and what the core reports. | Dark; the canvas is the colour | Experience |
| Umbrella `/docs*` | A creator mid-task, scanning for one command or one policy answer, often on a laptop beside the desktop app. | Dark, quieter density | Read |
| Umbrella `/login`, `/account`, `/editor`, `/admin/ledger`, 404, error | Someone trying to get something done who has just been told no (or yes) and needs the reason and the way forward. | Dark, state-led | Operate |
| Storefronts (Vitrine, Forge) | A creator browsing for a rights-clean asset during a build session, judging fit and provenance in seconds. | Dark, accent shifts per store (teal / red) | Persuade (home, publish), Operate (item, 404) |
| Kids | A child at a tablet or laptop with a grown-up nearby, picking, placing, pressing Play. | Dark violet world with the three curated world gradients | Experience |
| Web shell inspector | A developer on loopback reviewing one JSON edit before it touches disk, in whatever OS theme they work in. | **System light/dark** (contract-pinned `Canvas`/`CanvasText`) | Operate |
| Engine Desktop + packaged Linux window | A creator in a long focused session in a dim room, eyes on the viewport, assistant and change list at the edges. | Dark graphite (Cinematic Pro), cyan life signal | Operate |

---

## 2. Color strategy

**Restrained everywhere** (neutrals plus one accent per surface). Persuade surfaces do not get a
louder palette; their colour comes from the real artifact (hero and `/open` canvases, listing
media), which is the one place saturation is earned.

1. **Laws stay load-bearing.** Accent = pending/primary; mint = verified (never a button); red =
   refused/destructive only; stale bronze = old diff value. These win over every brief below.
2. **Accent dosage.** At most one primary accent fill per viewport; accent text/underline only for
   the current nav item and pending counts. Decorative accent dots, rails and section numbers go.
3. **State layers, not new colours.** Hover/press on sites is a state layer of the control's own
   ink (`color-mix(in srgb, currentColor 8%, transparent)`, 12% pressed) over the resting fill, so
   no colour literal is introduced. Desktop hover keeps the existing `--hover` paint, instant.
4. **Storefront hover.** `--accent-hi` on the storefronts stays equal to the accent (pinned, §0).
   Storefront hover and press on accent fills, quiet buttons, tiles and links are the rule-3
   `currentColor` state layer, which is visible on every control without a new colour. (DV-F4 is
   withdrawn; no lighter storefront accent is introduced.)
5. **Surfaces.** Sites keep the six-step neutral ladder; bands alternate `--bg-base`/`--bg-panel`.
   The storefront `--hero-wash`/`--media-wash` gradients stay (store identity); the two-axis grid
   background goes.
6. **Contrast.** Body ≥4.5:1, large ≥3:1, controls and focus indicators ≥3:1, measured in the
   existing gates; `--fg-4` never carries text.

---

## 3. Type scale

Families do not change: **Archivo** (self-hosted, `wdth` axis) + **JetBrains Mono** on sites;
system neo-grotesque + `ui-monospace` on desktop; web shell prose moves to the system UI stack with
`ui-monospace` kept for machine output (DV-W1); Kids moves from an unloaded `Inter` to **Archivo**
via `next/font` if `tests/sites/kids-surface.test.ts` stays green, otherwise to the existing
`ui-rounded, system-ui` stack without `Inter` (DV-K1).

### Sites (Foundations v2 roles; fluid only where marked)

| Role | Foundations token (sheet value) | Site size (this direction) | Weight / lh / tracking | Use |
|---|---|---|---|---|
| Display XL | `--type-display-xl-size` (66px, fixed) | `clamp(2.5rem, 1.6rem + 3.6vw, 4.125rem)` (40→66), CSS literal **DV-F10** | 700 / 1.02 / -0.03em, `wdth` 104 **DV-F11** | umbrella home H1, storefront home H1. Nowhere else. |
| Display L | `--type-display-l-size` (42px, fixed) | `clamp(1.875rem, 1.4rem + 1.9vw, 2.625rem)` (30→42), CSS literal **DV-F10** | 700 / 1.08 / -0.025em **DV-F11** | interior route H1; section H2 on `/` and storefront home only |
| Heading | `--type-heading-size` (24px) | 1.5rem (24) | 700 / 1.2 / -0.015em **DV-F11** | section H2 on interior, docs and state routes; dialog titles |
| Subhead | `--type-subhead-size` (17px) | 1.0625rem (17) | 600 / 1.35 **DV-F11** | H3, card and state-panel titles, FAQ questions |
| Lead | `--type-lead-size` (16px) | 1.125rem (18) **DV-F2** | 400 / 1.55 **DV-F11** | the one paragraph under a route H1, max 60ch |
| Body | `--type-body-size` (14px) | 1rem (16) **DV-F2** | 400 / 1.6 **DV-F11** | prose, 65–72ch |
| UI | `--type-ui-size` (12px) | 0.8125rem (13) **DV-F9** | 500 / 1.4 **DV-F11** | nav, buttons ≤38px, tabs; field labels, TOC titles, facet labels, footer headings and `dl` terms (Archivo, sentence case, 600 for headings) |
| UI small | `--type-ui-sm-size` (11px) | 0.75rem (12) **DV-F9** | 500 / 1.4 **DV-F11** | chips, meta rows |
| Label (micro) | `--type-micro-size` (8.5px, 0.15em) | 0.6875rem (11) **DV-F1** | mono 500 / 1.4 / 0.08em **DV-F11**, uppercase allowed | **machine values and table column heads only**: evidence-table column heads, status-chip values (the registry's status word), reason/exit codes. Never TOC titles, facets, footer headings, field labels or `dl` terms (those take UI) |
| Mono | `--type-mono-size` (10–12px) | 0.8125rem (13; 12 in dense tables) **DV-F9** | mono 400, `tabular-nums` | digests, pointers, ids, credits, codes |

**How the sizes land.** The foundation changes fixed px only. In `FOUNDATION_TYPE_SCALE` it sets
`sizePx` lead 18, body 16 (DV-F2), ui 13, ui-sm 12, mono 12 with `maxSizePx` 13 (DV-F9), micro 11
with `letterSpacingEm` 0.08 (DV-F1, DV-F11), so `--type-*-size` emits the site value for those
roles. `display-xl` and `display-l` keep `sizePx` 66 and 42 (the sheet value, which is also the
clamp ceiling; `sizePx` is a number and cannot hold a `clamp()`). Lanes therefore **never read
`var(--type-display-xl-size)` or `var(--type-display-l-size)` for a font size** (a fixed 66px
heading overflows at 390). They write the two `clamp()` values above as literals on their own
selectors, as the umbrella already does at `globals.css:310,320,976`; a literal on a selector is
not a redeclared Foundations token (§0). Line heights stay CSS-only. Nothing reads any
`--type-*-size` today, and no test pins the sizes (`design-tokens.test.ts:97-107` pins the count,
families and weights). The umbrella editor chrome keeps 14px body as a literal (DV-F2).

**Storefronts never read `var(--type-*-size)`.** The storefront 11px floor test resolves a `var()`
only against tokens declared in that store's own `globals.css` and counts an unresolved one as below
the floor (`catalog-storefronts.test.ts:126-131,188-199`). Site-kit emits `--type-*-size`, the
store sheet does not declare it, so a storefront writes each role's site size from the table above
as a rem literal (0.6875rem or more), or reads a token its own sheet declares (§0).

Rules: one H1 per route; more space above a heading than below (`--space-8` above, `--space-3`
below for H2); `text-wrap: balance` on H1/H2, `pretty` on leads; changeable numbers are tabular; no
text under 11px (aria-hidden marks excepted and named).

### Desktop (Cinematic Pro, fixed px; product UI is not fluid)

Body 13px; UI 12px; panel heads 11px (pinned); headings 15/17px; mono 12px. **DV-D2:** text now
below 11px (measured minimum 8px) rises to 11px; `aria-hidden` glyph marks may stay smaller.
**Pinned exceptions:** `.scene-entity-identity code` and `.asset-browser-card span` stay 10px
(`visual-refinement.test.ts:41,92`) until Request R1 lands; no lane overrides them.

### Web shell

Prose, labels, buttons: `system-ui` 15px/1.5; H1 1.375rem/700; machine output (`#diff`, `code`,
input values, the phase value) stays `ui-monospace` 14px with tabular figures.

---

## 4. Spacing scale (one scale everywhere)

`4 · 8 · 12 · 16 · 24 · 32 · 44 · 72` px, named `--space-1 -2 -3 -4 -6 -8 -11 -18` on sites
(site-kit already emits them) and the same names on desktop (`SPACING` extends to the same eight
values, DV-D3), Kids and the web shell (local copies of the same values).

- Editor chrome: 4–16. Cards and panels: 16 (phone) / 24. Section rhythm: 44 (≤860px) / 72.
- Off-scale values found in the baseline (5, 9, 11, 18, 20, 34px; band paddings 84/64/48; 12.5px
  text) snap to the nearest step.
- Structural desktop metrics (`METRICS`: title bar 36, rail 56, docks 274/326/344, status 27) are
  archive geometry, not spacing, and do not move.

---

## 5. Component vocabulary

One vocabulary across surfaces; each lane restyles its own copy.

| Component | Anatomy | States (all required) |
|---|---|---|
| **Button** primary / quiet / danger (reject) / icon | label (+ optional leading glyph); 46 (marketing) · 38 · 30 (chrome) px; radius 5 (sites) / 10 (desktop) | rest; hover (state layer on sites; instant paint on desktop); focus-visible: 2px `--accent-hi` outline, 2px offset (sites) · `--accent` outline + 4px well (desktop, pinned) · `currentColor` 2px ring (web shell, pinned); active: press scale (sites, web shell) · pinned `box-shadow:inset`, no glyph motion (desktop); disabled (painted: dashed line + `--fg-2` label, `cursor: not-allowed`, never opacity); loading (`aria-busy="true"`: label kept, 2px indeterminate bar on the bottom edge after `--motion-delay-loading`, pointer-events none) |
| **Link** (prose / nav / card-link) | underlined in prose; nav item with 2px current indicator; card-link with trailing arrow | hover (underline 1→2px; card-link arrow nudge 4px; nav state layer); focus-visible (the surface's ring, as Button); active (state layer deepens to 12%; card-links also take the press scale on sites, prose links do not move); current (`aria-current`, indicator per row 17); disabled: n/a (no link is ever disabled; an unavailable destination is rendered as a named refusal, not a dead link); loading: n/a (navigation has no per-link pending state; the route's `loading.tsx` covers the wait, row 18) |
| **Status chip** | the six published statuses, dot + mono label | not a control: hover, focus-visible, active, disabled and loading are n/a (static text, never focusable); tone change per §6 row 10 |
| **Named state panel** (`.state`, site-kit state-panel model) | tone chip + subhead title + mono reason code + evidence `dl` + link action; 1px tone hairline frame, **no side rail** (DV-F6) | the panel is not a control (hover, focus-visible, active, disabled, loading n/a); its link action takes every Link state; enter (row 13); tone change (row 10) |
| **Field** | label above in the UI role (13px Archivo, sentence case; web shell: `system-ui`); 44px tall on phones, 38px otherwise; inset `--bg-field`; hint and error text below | rest; hover (line → `--line-strong`); focus-visible (the surface's ring, line → accent); active: n/a (text entry has no press state; focus covers it); invalid (`:user-invalid`/`aria-invalid` red line + text); disabled (painted: dashed line, `--fg-2` value, `cursor: not-allowed`, never opacity); read-only (plain line, no hover change); loading: n/a (a field never waits; the submitting form's Button carries `aria-busy`) |
| **Evidence table** | label-style header row, hairline rows, mono tabular numerics right-aligned, own scroll region with role + label | hover: row state layer (fine pointers); focus-visible: ring on the scroll region; active: n/a (rows are not actionable); disabled: n/a (nothing to disable); loading: n/a for the table itself (it renders with its data; a route wait is the route's Skeleton, row 18) |
| **Definition list** (evidence `dl`) | hairline rows; term in the UI role (sentence case), value in body, or mono when it is a machine value. **Only where the content is term→value evidence:** `/open` core readout, storefront item `dl`, account balance facts, `/admin/ledger`, state-panel evidence. Nowhere else (§5 composition rule) | not a control: hover, focus-visible, active, disabled and loading are n/a (static, never focusable) |
| **Change Review** (site-kit) | dim path + bright leaf, badge, before (stale, struck) → after (mint), digests, per-row ✕/✓, resolution banner. The ✕/✓ and similar Unicode marks stay **text glyphs** (ruling R-4, `docs/redesign/RULINGS.md`): each carries an `aria-label` or visually hidden text, the foundation may restyle them but never changes their text (tests and refusal copy pin it), and no drawn SVG replaces them in this run | the per-row ✕/✓ are Buttons and take all five Button states: hover, focus-visible, active, disabled and loading (`aria-busy`) exactly where the existing code already sets `disabled`/`aria-busy`, with no new behaviour; per-row accept/reject motion (row 14); resolution states |
| **Commerce notice** | refusal where the cart button would be, mono reason | not a control: hover, focus-visible, active, disabled and loading are n/a (it replaces the control); static + enter |
| **Viewport frame** | 1px `--line-strong`, radius 9, no drop shadow, overlay chips inside | the frame is not a control (the five states are n/a); its play/stop and overlay actions are Buttons with every Button state; frame states: mounting; live; refused overlay; reduced-motion poster |
| **Listing tile** (storefronts) | digest-figure media + title + creator + price in credits + compat chips | hover (media lift + state layer, frame → `--accent-line`); focus-visible (2px `--accent-hi` ring, 2px offset, on the tile link); active (state layer 12% + press scale); disabled: n/a (every listed item links to its page; no tile is ever disabled); loading: n/a (tiles render with the page; the store `loading.tsx` covers the wait, row 18) |
| **Dialog / palette / drawer** (desktop) | float surface, 1px strong edge, tight shadow (DV-F3/DV-D4) | container: open; close; focus contained (hover, active, disabled, loading n/a for the container: it is not a control). Its rows and buttons are controls: hover (instant paint); focus-visible (`--accent` outline + 4px well); active (pinned `box-shadow:inset`); disabled (painted `.is-inert`/`aria-disabled`, never opacity); loading (palette results and compact drawers show the Skeleton, row 18) |
| **Skeleton** | blocks at final size on `--bg-row` | not a control: hover, focus-visible, active, disabled and loading are n/a (it *is* the loading state); sheen loop only while loading, paused when hidden |
| **Live status line** (web-shell `#note`, desktop status bar, umbrella `role=status`) | one line: tone word + message | not a control: hover, focus-visible, active, disabled and loading are n/a (a live region, never focusable); message change (row 10) |

Rule 6 reading: every control above lists hover, focus-visible, active, disabled and loading.
"n/a (why)" means the state cannot occur for that component. It never lets a lane skip a state that
does occur in its markup; such a state takes the Button row's treatment for its surface.

**Composition comes from the content.** The hairline definition row is reserved for term→value
evidence (list above). Notes, explanations and checklists take the shape of what they say: prose
with inline mono figures, a worked example, an ordered list, a linked line. §7 names the shape per
section; a lane does not default to a ruled grid.

**Where a replacement chip goes.** A chip that replaces an eyebrow sits after the H1 in DOM order:
inline beside it (the H1 and chip share a wrapping flex head, baseline-aligned, so on phones the
chip wraps under the heading) or at the head of the action row. Never on its own line above a
heading; never inside the `h1` (its accessible name stays the heading text).

Banned in every lane: eyebrow/kicker above headings (state words become chips or join the
heading), side rails >1px (DV-X1 pins excepted), gradient text, decorative glass, identical card
grids as page structure, hero-metric template, 1px border + ≥16px blur shadow, card radius >16px,
stripe or grid-line backgrounds, sketch SVG, emoji as UI icons (Kids activity content excepted),
text overflow (containers `min-width: 0`; machine values `overflow-wrap: anywhere`).

---

## 6. MOTION SYSTEM

**Thesis: an instrument settling.** State changes arrive like a reading settling on a dial: fast
start, long exponential deceleration, no overshoot. The one authored moment per surface is a
*resolution*: a diff that resolves when accepted (Change Review, web shell, desktop changes dock),
a canvas that opens its aperture (`/`, `/open`), a piece that lands (Kids). That moment is the only
noticeable motion on its surface. Everything else is quiet feedback on a control the user just
touched. There is no generic page entrance: only Persuade heroes get one restrained rise (row 11).
Read routes are static (row 12), and Operate/state routes draw only their state panel's tone
underline (row 13).

### 6.1 Tokens (foundation lands these first)

Site-kit adds `FOUNDATION_MOTION` and emits the custom properties from `foundationsVariablesCss()`;
`visual-tokens.ts` adds `MOTION` with the same values, and the chrome emits the same names in its
`:root`, **except the two `scale.*` tokens**, which the desktop neither declares nor reads
(`chrome.test.ts:925`). Kids and the web shell carry local copies of the same names and values (no
import is allowed there); the copies are recorded here, not tested (no new tests).

| CSS custom property | Value | `MOTION` key (desktop) | Use |
|---|---|---|---|
| `--motion-duration-press` | 120ms | `duration.press` | press-in, focus halo |
| `--motion-duration-micro` | 160ms | `duration.micro` | hover state layers, press release, arrows, underline |
| `--motion-duration-state` | 200ms | `duration.state` | chip/tone change, status line, number change, toast |
| `--motion-duration-panel` | 280ms | `duration.panel` | panel, drawer, dialog, disclosure open; list item enter |
| `--motion-duration-panel-exit` | 200ms | `duration.panelExit` | every close/exit (exits are faster) |
| `--motion-duration-route` | 320ms | `duration.route` | route entrance, hero aperture, focal resolution |
| `--motion-duration-loop` | 1200ms | `duration.loop` | one cycle of an indeterminate progress/pending indicator only: loading bar, skeleton sheen, and the existing desktop `assistant-bars` and sculpt `sweep` (ruling R-2); `transform`/`opacity` only, always with `--motion-ease-out-quart`. Outside the 120–320ms transition band: **DV-F8 / DV-D6, accepted by run contract owner 2026-10-04 (rulings R-1 and R-2, `docs/redesign/RULINGS.md`)** |
| `--motion-delay-loading` | 300ms | `delay.loading` | wait before any loading indicator paints, so fast responses never flash. A delay, not a duration: **DV-F8 / DV-D6, accepted by run contract owner 2026-10-04 (ruling R-1, `docs/redesign/RULINGS.md`)** |
| `--motion-ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | `ease.outQuart` | micro feedback, exits |
| `--motion-ease-out-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` | `ease.outQuint` | state and number changes |
| `--motion-ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | `ease.outExpo` | panels, routes, focal moments |
| `--motion-stagger-step` | 40ms | `stagger.step` | per-item delay in a list |
| `--motion-stagger-max` | 200ms | `stagger.max` | delay cap (item 6+ shares it) |
| `--motion-distance-sm` | 4px | `distance.sm` | micro nudges, list items, status lines |
| `--motion-distance-md` | 8px | `distance.md` | route content, dialogs |
| `--motion-distance-lg` | 16px | `distance.lg` | drawer content, hero copy |
| `--motion-scale-press` | 0.97 | — (sites only; desktop never scales) | pressed controls on sites and the web shell |
| `--motion-scale-enter` | 0.98 | — (sites only; desktop never scales) | Kids pieces only |

Reduced motion (`@media (prefers-reduced-motion: reduce)`), emitted by the foundation next to the
tokens and copied by Kids/web shell: `--motion-distance-sm/md/lg: 0px; --motion-scale-press: 1;
--motion-scale-enter: 1; --motion-stagger-step: 0ms`. Every rule is written against these tokens,
so reduced motion removes movement automatically while opacity, colour and state still change.
Surfaces whose tests pin the blanket `0.001ms` kill (storefronts, desktop) keep it as the first
declaration of that block; the token overrides follow it. The umbrella replaces its blanket kill
with the token overrides plus `animation: none` on decorative loops (its test only requires the
media block to exist).

### 6.2 Rules

1. Animate **transform, opacity, clip-path, filter only**. Colour, background and border changes
   are instant (or ride a state-layer opacity on sites). Never width/height/top/left/margin/grid
   tracks: a panel that changes layout switches instantly and only its *content* animates.
2. **Desktop: `opacity` only inside `@keyframes`** (gate), and **no `scale()` anywhere**
   (`chrome.test.ts:925`). Use keyframe one-shots keyed on the existing `data-*` state attributes,
   plus translate/clip-path/filter transitions.
3. **Never gate visibility.** Default styles are the visible end state; entrances are CSS
   animations that run once on first paint (`animation-fill-mode: backwards`) inside
   `@media (prefers-reduced-motion: no-preference)`. No scroll-triggered reveals and no JS class
   that hides content until a script runs.
4. Exits are faster than entrances, interruptible (transitions, not chained timeouts), and never
   delay focus or input: focus moves immediately. **Anything shown and hidden by the `hidden`
   attribute, `<details>` or unmounting has no exit motion: it disappears at once.** That covers
   every desktop menu, dock panel, drawer, dialog, the palette and the refusal legend
   (`chrome.ts:445,493,547`, the `.overlay` regions; `[hidden]{display:none !important}` is pinned)
   and the web-shell `#recover`/`#reconcile` controls. A fade-out there needs either a resting
   `opacity:` outside keyframes (forbidden on desktop by `visual-tokens.test.ts:159-176`) or a
   script that delays `hidden` (a behaviour change), so neither is done. Their **entrance** is a
   one-shot animation on the shown state, for example `.menu-panel:not([hidden])` with
   `animation: <name> var(--motion-duration-panel) var(--motion-ease-out-expo) backwards`, and
   `opacity`, `transform` and `clip-path` set only inside that `@keyframes`. Removing `hidden`
   switches `display` away from `none`, which restarts the animation on every open without any
   script change. Exit transitions exist only on elements that stay rendered (site state layers,
   current-item indicators, a site layer that is not `hidden`).
5. Loops run only while their state is true and stop when the element is hidden. Every
   indeterminate progress/pending loop cycles at `--motion-duration-loop` with
   `--motion-ease-out-quart`: the two new ones (rows 5, 18), which also start after
   `--motion-delay-loading`, and the two existing desktop ones, `assistant-bars` and the sculpt
   `sweep`, which move onto these tokens (ruling R-2; §7.6 gives the exact declarations). None keeps
   its old timing or curve. This is the one recorded exception to the 120–320ms band (DV-F8 /
   DV-D6, accepted by run contract owner 2026-10-04 as ruling R-1, recorded in
   `docs/redesign/RULINGS.md`: indeterminate progress/pending indicators only, these tokens only,
   `transform`/`opacity` only, static indicator under reduced motion).
6. No bounce, elastic or overshoot; no `ease`, `ease-in-out` or `linear` curve on any interface
   motion, loops included. The only `ease-in-out` left is the DV-K2 content loop (rule 7).
7. Content motion. WebGL canvas output (umbrella hero, `/open`, desktop viewport and Run mode) is
   runtime output and outside this table; it poses statically under reduced motion where the
   runtime supports it. Exactly one CSS loop counts as content: Kids `play-float`, granted by
   ruling R-3 and recorded as **DV-K2** (only under `.is-playing`, transform only, sine-like
   ease-in-out with no bounce or overshoot, static under reduced motion, never flashes). No other
   CSS loop in a lane-owned file is content: every other animation is a §6.3 row inside the
   120–320ms band or an R-1 loop.

### 6.3 Interaction table

| # | Interaction | Motion | Reduced-motion fallback |
|---|---|---|---|
| 1 | **Control hover** (buttons, quiet buttons, action chips, table rows, tiles, nav links) | Sites: `::before` state layer opacity 0→1 over `--motion-duration-micro` `--motion-ease-out-quart`; card-links nudge their arrow `translateX(var(--motion-distance-sm))`; listing tiles lift media `translateY(calc(-1 * var(--motion-distance-sm)))`. Desktop: paint swap instant, no transform on hover (no `scale()`, §0). | Opacity/paint only; distances are 0, nothing moves. |
| 2 | **Control press** (`:active`) | Sites and web shell: `transform: scale(var(--motion-scale-press))` over `--motion-duration-press` quart; release over micro; state layer deepens to 12%. Desktop: the pinned `box-shadow:inset` paint, instant; glyphs never move (no scale, no translate). | Scale token = 1; state layer / inset still shows. |
| 3 | **Focus-visible** | Outline appears instantly (never animated in); sites add a halo `::after` ring fading in over press duration. Desktop keeps its outline + 4px well ring, instant. | Instant ring. |
| 4 | **Disabled / inert** | No hover or press motion; enabled→disabled is an instant paint change. | Same. |
| 5 | **Loading control** (`aria-busy="true"`) | Label stays visible throughout; 2px bar on the bottom edge `translateX(-100%→100%)`, one cycle per `--motion-duration-loop`, `--motion-ease-out-quart`, infinite, `animation-delay: var(--motion-delay-loading)` with `backwards` fill (the bar sits off-edge, clipped, during the delay). Loop band exception DV-F8 / DV-D6, accepted by run contract owner 2026-10-04 (ruling R-1, `docs/redesign/RULINGS.md`). | Static 2px bar at 40% width plus the label. |
| 6 | **Panel open/close** (docs rail on phones, desktop dock tabs, assistant column toggle, inspector sections, editor panels) | Open: content `translateY(var(--motion-distance-sm))`→0 with fade over `--motion-duration-panel` expo; for a `hidden`/`<details>` toggle (every desktop panel and tab) this is a keyframe on the shown state (§6.2 rule 4). Close: instant for `hidden`/`<details>` toggles; only a site panel that stays rendered reverses over `panel-exit` quart. Container size switches instantly. | Content fades only (desktop: instant via blanket rule). |
| 7 | **Drawer** (desktop compact tiers: assistant, left dock, inspector) | Open from its own edge: keyframe `translateX(±var(--motion-distance-lg))`→0 plus fade, panel duration expo; scrim keyframe fade-in. Close: instant, drawer and scrim (§6.2 rule 4). | Appears in place; scrim instant. |
| 8 | **Dialog / command palette / outcome overlay** (every surface; no scale anywhere) | Open: scrim fade over panel duration; card `translateY(var(--motion-distance-md))`→0 + fade + `clip-path: inset(0 0 var(--motion-distance-md) 0 round <radius>)`→`inset(0 round <radius>)`, panel duration expo, all as keyframes on `:not([hidden])` on desktop; palette rows stagger (row 9), cap 6. Focus lands on open. Close: instant on desktop and wherever the layer is `hidden` or unmounted (§6.2 rule 4); only a site layer that stays rendered fades + `translateY(var(--motion-distance-sm))` over `panel-exit` quart. | Fade only; no stagger, no clip. |
| 9 | **List stagger** (storefront tiles, pricing tiers, palette rows, scene tree on expand) | Each item fade + `translateY(var(--motion-distance-sm))`→0 over panel duration expo, delay `min(var(--i, 0) * var(--motion-stagger-step), var(--motion-stagger-max))` with `--i` set from TSX, or `:nth-child(1…6)` delay rules where no index is set. Umbrella: always the `var(--i, 0)` fallback form or `:nth-child`, never a bare `var(--i)` (§0). First render only, never on scroll, at most one list per viewport, never below the fold. | No delay, fade only. |
| 10 | **State change / toast / live status line** (state-panel tone, status chips, web-shell phase + `#note`, desktop status bar, umbrella `role=status`) | New message enters `translateY(var(--motion-distance-sm))`→0 + fade over `--motion-duration-state` quint; old text is replaced, not stacked. Tone colour switches instantly; a one-shot 2px tone underline draws `clip-path: inset(0 100% 0 0)`→`inset(0)` over state duration. | Text swaps; tone colour changes; underline appears without the draw. |
| 11 | **Route entrance, Persuade** (`/`, storefront home, `/engine`, `/pricing`, `/profiles`, publish) | Hero H1, lede and action row rise `var(--motion-distance-lg)`→0 with fade, route duration expo, 40ms stagger (max 3 items). Below the fold: nothing. The only route entrance in the system. | Static. |
| 12 | **Route entrance, Read** (`/docs*`) | None. Docs render static; only control feedback (rows 1–4) and the rail indicator (row 17) move. | Static. |
| 13 | **Route entrance, Operate/state** (`/login`, `/account`, `/editor`, `/admin/ledger`, 404, error, loading and global-error fallbacks, storefront item and 404) | No rise and no route fade. When the route shows a named state panel or state chip, its 2px tone underline draws once per row 10 (`clip-path`, state duration quint); everything else is static. | Underline present without the draw. |
| 14 | **Change Review resolution** (signature) | Accept row: the stale old value's strike draws left→right (`::after` line `clip-path: inset(0 100% 0 0)`→`inset(0)`, state duration expo; the same clip-path draw on every surface, so desktop emits no scale function) and the after-digest settles with a clip-path wipe; reject row: the proposed value takes the same strike in `--fg-2`. Resolution banner enters per row 10. Web shell: on Accept the applied diff text wipes in with the same clip-path. | Strike and values appear instantly; banner fades. |
| 15 | **Viewport overlays** (umbrella hero + `/open` frames, desktop viewport notes, runtime report, refusal over canvas) | Frame aperture on first paint: `clip-path: inset(48% 0 48% 0 round 9px)`→`inset(0 round 9px)` over route duration expo (the canvas draws underneath regardless). Overlay chips fade + 4px rise over state duration. Refusal over a canvas: canvas `filter: brightness(.55)` over panel duration, card enters per row 8. Play/stop: one-shot ring on the control, a `::after` ring that grows `clip-path: circle(50% at 50% 50%)`→`circle(75% at 50% 50%)` while a keyframe fades it out, panel duration expo (no `scale()`, §0). | No aperture; overlays fade; filter change instant; no ring. |
| 16 | **Number / credit / digest change** (credit balance, pricing totals, desktop credits, sculpt pass fraction, before/after digests, runtime report counters) | Old value slides out `translateY(calc(-1 * var(--motion-distance-sm)))` + fade as the new value arrives from `+distance-sm`, state duration quint; tabular figures so width never jumps; never count through fake intermediate values. Digests use the row 14 wipe. | Instant swap. |
| 17 | **Current-item indicator** (masthead nav, docs rail, desktop mode rail, dock tabs, view tabs, assistant mode segmented control) | In-page changes move the indicator with `translate()` and resize it with `clip-path` (never a scale function, so the desktop rule in §0 holds everywhere) over panel duration expo. Full page navigations render it in place. | Indicator jumps. |
| 18 | **Skeleton / loading region** (incl. the `loading.tsx` fallbacks) | Blocks or text at final size, visible at once; `::after` sheen or 2px bar `translateX(-100%→100%)`, one cycle per `--motion-duration-loop`, quart, infinite, `animation-delay: var(--motion-delay-loading)`, paused when hidden. Loop band exception DV-F8 / DV-D6, accepted by run contract owner 2026-10-04 (ruling R-1, `docs/redesign/RULINGS.md`). | Static blocks plus visible "Loading…" text (the fallbacks' own heading). |
| 19 | **Masthead on scroll** (sites) | Progressive enhancement: the masthead has no bottom border; a 1px `--line-soft` line drawn by `.masthead::after` animates **its `opacity`** 0→1 via `animation-timeline: scroll()` over the first 24px (`animation-range: 0 24px`). No `border-color` or colour transition. Unsupported browsers: the `::after` line at opacity 1. | `::after` line at opacity 1, no timeline. |
| 20 | **Kids moments** | Piece placed: `scale(var(--motion-scale-enter)) translateY(var(--motion-distance-md))`→none + fade, panel duration expo (no bounce). This **replaces** today's `.placed-piece{animation:piece-arrive 160ms ease-out}` (`sites/kids/src/app/globals.css:423`, keyframe `translateY(8px)` at `:426`); no `piece-arrive` timing survives. Undo: fade + scale back over `panel-exit`. World change: background layer crossfade over panel duration. Play pressed: stage `filter: brightness(1.12)` one-shot over route duration. The `play-float` loop (`globals.css:203-214`, 1.8s / 1.55s alternate) is product content motion under ruling R-3 (DV-K2): it runs only under `.is-playing`, animates transform only, keeps its sine-like ease-in-out with no bounce or overshoot and never flashes. | Fades only; `play-float` is static (the blanket reduce block, `globals.css:431-439`, already stops it); world swaps instantly. |

---

## 7. Per-surface briefs (re-targeted to main's files and routes)

Each brief has three parts:

- **Changes** carries the v5 intent. Wording is unchanged where the target is unchanged.
- **Accept** is checked at 390×844, 768×1024 and 1440×900; desktop at 1280×800 and 1920×1080.
- **Motion** gives row numbers from §6.3, read through the Port overlay.

Every route also inherits its surface's shell brief, so row 2 (press, paint only under DV-P3) applies to every umbrella and storefront control even where a Motion column below does not list it; the columns name it where v5 did. BEFORE shots are `E/before/<surface>/<state>-<width>.png` (main) and `E/before/live/<site>-<route>-<width>.png` (production). **Main-only** marks an element or state that v5 never saw; its brief is written in the same language as v5. The v5 reference result for each file is OLD's working copy at the same path, or, for the desktop, OLD `apps/desktop-shell/src/chrome.ts` (see Port notes).

### 7.1 Umbrella shell (every route; `sites/umbrella/src/app/layout.tsx`, `_components/site-nav.tsx`, `globals.css`)

- **Changes:** as v5 §7.1, applied to main's markup:
  - The masthead becomes an opaque `--bg-base` bench with a `--line-soft` `::after` hairline (DV-F5, row 19). Main still ships the glass: `backdrop-filter` measured on every BEFORE shot.
  - Nav current item: 2px accent underline indicator plus `--fg`; other items `--fg-2`.
  - Footer column headings take the UI role.
  - Footer links get ≥44px tap rows on phones.
  - Buttons lose the inset highlight and the drop shadow.
  - Every `.eyebrow` goes. Main renders them in `page.tsx`, `engine`, `profiles`, `pricing`, `open`, `docs`, `login`, `account`, `editor/page.tsx`, `web-experience-editor.tsx`, `error.tsx` and `not-found.tsx`; BEFORE counts 48 eyebrow elements over 54 shots. State words become status chips per the §5 chip rule.
  - `.state` loses its side rail for a 1px tone hairline plus a tone chip (DV-F6).
  - Main-only: `.masthead-actions .button` takes the quiet button states. Transitions follow DV-P2, state transforms DV-P3.
- **Accept:**
  - detector 0 on `sites/umbrella/src/app` (no exception: the pending panel has no grid, DV-P10);
  - no `.eyebrow` rendered and no `backdrop-filter`;
  - no text under 11px; nav current item announced and visible;
  - §0.1 pins green: `pnpm exec vitest run tests/sites` (cwd R), the site `typecheck`, and the umbrella Playwright specs (`first-release`, `identity`).
- **Motion:** 1, 2 (paint only, DV-P3), 3, 4, 5, 17, 19. No route-level entrance outside row 11.

### 7.2 Umbrella routes

| Route (main file) | Changes | Accept | Motion |
|---|---|---|---|
| `/` (`page.tsx`, `_components/hero-viewport.tsx`, `_components/download-cta.tsx`, `_components/proof-figure.tsx`) | As v5: H1 display-xl. The release marker stays the element with class **`badge`** (DV-P8, contrast-pinned), restyled as the Needs-review chip **inline after the H1** (shared wrapping head; it wraps under the H1 at 390), never above it. Main renders it before the H1 with a dot: move it after. Lede 18px. Download (`.download-primary`, detected platform) and then "Open the proof" (`.release-actions > .button-quiet`), order unchanged, both 46px. Main-only `.download-context` and `.platform-availability` (recorded build / coming soon) read as status chips beside the platform name, copy unchanged. Hero viewport frame: 1px strong line, radius 9, no shadow (DV-P12). Main-only `.hero-stage-facts` / `.hero-stage-note` follow the overlay chip style (row 15). The JS-off pending panel keeps a plain `linear-gradient` fill at opacity 1 with no grid lines (DV-P10). The launch proof rail becomes **four linked lines** (as v5), laid out two per row from 621px because that pairing is pinned (DV-P9): each line is led by its real artifact, then the title link, then one line of prose. Markup stays the `dl` (`.launch-proof dt/dd`), with no ruled grid. **Main-only proof gallery** (`.proof-gallery`, 3 `ProofFigure`s): see the ProofFigure row. Comparison table: the SceneAxi row is marked by weight and strong top/bottom hairlines (no accent fill). "Start without an account" path links (`RELEASE_PATHS`, `.path-links`, `.path-label`/`.path-route`) become a two-column link list with trailing arrows; drop the eyebrow over it. | First viewport at 1440 shows H1 + chip, lede, both actions and the top of the canvas. §0.1 overview geometry and type ramp hold (≤9 sizes, stage ≥671×503, rail top ≤720). At 390 the viewport sits under the actions, with no overflow. One display-xl per page; no em dash; no chip on its own line above the H1. | 11, 15, 1 |
| ProofFigure (main-only; `_components/proof-figure.tsx` on `/` ×3 and `/engine` ×1 wide) | A capture is evidence, so it takes the **Viewport frame** component: 1px `--line-strong`, radius 9, no shadow, `.proof-frame` clipping the image. Caption order: `.proof-title` (subhead role), `.proof-claim` (body), `.proof-level` as a status chip, `.proof-limits` as chips (sentence case; limits stay visible, never collapsed), then `.proof-link` as a card-link with a trailing arrow. `.proof-history` is mono meta. The three figures are one row of equal-height items at ≥1024, not identical cards: no card fill, the frame is the only box. | Pins of `first-release.visual.spec.ts:312-346` hold (3 figures, equal height, lazy, alt, limits, no linked image, links to `/engine` or `/docs` only); no overflow at 390. | 1 (link only); media hover `scale(1.015)` inside `.proof-frame` (DV-P3) |
| `/engine` (`engine/page.tsx`) | As v5: remove all eyebrows (main still has 3 plus a `note-card-info`). A state word becomes a chip inline after its heading; a pure section label is dropped. SDK block: archive name as subhead; SHA-256 in a mono field well that wraps; verify commands in code wells. Pipeline keeps its numbers as mono step indices on a 1px connector (main's `role="region"` scroller stays). Main-only `.platform-availability` list: platform name plus a status chip (Recorded build, Coming soon), copy unchanged. Main-only wide ProofFigure: as the ProofFigure row. The `note-card-info` becomes an Info chip plus prose in a hairline box (as v5 `/docs` `.rule-card`). | 0 eyebrows; full digest visible at 390; no identical card grid; launch-marketing tests green. | 11, 1, 2 (paint only, DV-P3) |
| `/profiles` (`profiles/page.tsx`) | As v5: H1 display-l (balanced, ≤2 lines at 1440). Game and Web side by side at ≥1024; Kids is an Isolated state panel with **no href**; profile tone as a 2px *top* edge. Main-only `.scroll-frame` wrappers keep the matrix scroller labelled. | Kids renders no anchor and names no Kids host; the matrix scrolls in its region at 390; profile-matrix test green. | 11, 1 |
| `/pricing` (`pricing/page.tsx`) | As v5: H1 display-l. Tiers (main-only `.tier-head`, `.tier-body`, `.tier-foot`, `.tier-price/.tier-amount/.tier-unit`, `.tier-rule`): radius 9, no shadow, price in mono tabular, unit in UI small; `.tier-flag` is a sentence-case chip and stays data-driven; a long `.tier-status .chip` wraps inside its card (v5 polish r3). The `note-card` group becomes **one prose block** with inline mono figures, each note's title leading its paragraph in 600 weight. The FAQ `dl` reads as questions and answers with `--space-6` rhythm and no hairline rows. | No identical 4-card grid and no ruled note grid; tiers equal height at ≥1024; credit figures still from site-kit; "no seat, plan or subscription" intact; no overflow at 320/390 with the long TEST status strings. Production states: §7.2.1. | 11, 9, 1, 2 (paint only, DV-P3) |
| `/open` (`open/page.tsx`, `open/_components/live-viewport.tsx`, `_components/sculpt-viewport.tsx`) | As v5: the live viewport leads at full shell width (main-only `.open-stage`); "What the running core reports" becomes an instrument readout `dl` (mono tabular) beside the canvas at ≥1180 and under it below. Runtime counters re-enter on change (row 16; v5 keyed the cells by value in `sculpt-viewport.tsx`). The four explanatory panels become a two-column prose list with subheads. The instance table keeps `min-width: 40rem` inside `.scroll-frame`. | Canvas visible at first paint in every mode; refusal path still visible; no overflow at 390. | 15, 16, 13 |
| `/docs` (`docs/page.tsx`) | Main already has a docs rail (`.docs-rail`, `.docs-rail-group`, `.docs-rail-title`): the rail titles take the UI role (Archivo 600, sentence case), and the current item takes the 2px indicator (row 17). The duplicate four-panel grid becomes one guide list (title, one-line summary, route) with card-link arrows; summaries are never clamped. `.rule-card` loses its side rail for a 1px hairline box with an Info chip. Drop the eyebrow. | Detector side-tab gone; rail current item visible; guides reachable by keyboard in order. | 12 (none), 17, 1 |
| `/docs/getting-started`, `/docs/cli`, `/docs/credits-and-pricing`, `/docs/faq` (`docs/_components/help-doc-page.tsx`; main-only `docs-shell-doc`, `.docs-section`, `.doc-links`) | As v5: article measure 68ch, body 16/1.65, H1 display-l, H2 heading role with 32 above / 12 below; code in field wells. Getting-started: steps keep their order. CLI: commands sit in the evidence-table component with a mono first column; "Free and BYO-AI" as prose + chips, no card. Credits: the undecided policy stays marked undecided with a chip; refund text stays restricted to documented TEST behaviour. FAQ questions are H2s styled in the subhead role with 32px rhythm; answers 16px. Main-only `.doc-links` (related) become a guide list. The current crumb has `aria-current`. | No line >75ch at 1440; no overflow at 390; the CLI commands table scrolls in its region at 390; docs-page test and "marks undecided credit policy" green; every FAQ question reachable from the TOC; no accordion. | 12 (none), 1 |
| `/docs` loading (`docs/loading.tsx`) | As v5: docs measure, attribute-free H1 in the heading role, the existing line as lede, a 2px loading bar under the heading. | §0.3/§0.4 loading pins hold. | 18 |
| `/login` (`login/page.tsx`) | Main already centres an `.auth-layout` with an `.auth-card` form. v5 restyles it: H1 display-l in a 28rem column. The refusal (local, no identity env) is a Refused state panel with its mono reason. **Production shows the live sign-in form** (`E/before/live/umbrella-login-*`): fields per §5 Field, block submit, three eyebrows dropped. Submit loading is n/a, because a client marker would breach the pinned client list (§0.1); write the `aria-busy` style anyway, as v5 did. Signed-in, `?reason=` and account-control states: §7.2.1. | Refusal key visible; no retry affordance; login-flow and identity tests green; the live sign-in form renders in the candidate deploy. | 13, 10 (5 n/a, §8.2) |
| `/account` (`account/page.tsx`) | As v5: state panel first; balance facts as an evidence `dl` with the balance as a mono tabular figure; the `note-card` group becomes one prose block with inline mono figures. Production shows the signed-out account state (`E/before/live/umbrella-account-*`): it takes the same state-panel treatment. Signed-in, administrator, history, editor-access and `?checkout=success` states: §7.2.1. | Balance read-only; refusal shows instead of a zero; no ruled note grid; identity tests green. | 13, 16 |
| `/editor` (`editor/page.tsx`, `editor/_components/editor-shell.tsx`, `web-experience-editor.tsx`, `editor-viewport.tsx`, `editor/layout.tsx`) | As v5. Refused states: Refused panel with reason and links out; the five refused-state eyebrows become chips after the H1. **The entitled shell is live in production** (`SCENEAXI_SITE_EDITOR_PREVIEW` present in production health), so it is a production surface, not a preview. Keep every archive metric. Panels, overlay notes and Change Review take rows 6, 8, 14 and 17; the rail needle and tab underlines glide (`useIndicatorGlide` inside `editor-shell.tsx`, the only allowed client file). The v5 polish fixes carry over: `.ed-overlay-notes` as a fixed top band, compact and narrow drawer reservations with the row 7 scrim, the project pill not truncating its name, and spacing snapped. Rail labels at 11px Archivo 75% width. | Editor metrics unchanged; Kids refusal still the whole body; palette withdrawn under Kids; focus contained; `#changes-*` controls hit-test at 900×600 → 1920×1080 (v5 polish r2 table). | 13, 6, 7, 8, 14 (n/a: rows are inert here), 17 |
| `/editor` loading (`editor/loading.tsx`) | As v5: masthead hidden (editor layout); centred 28rem column; attribute-free H1; access line as lede; 2px loading bar. | "only after its access decision succeeds" verbatim. | 18 |
| `/admin/ledger` (`admin/ledger/page.tsx`) | As v5: Refused state panel; the ledger as an evidence table (amounts right-aligned, mono tabular, append-only stated); forms as cards; `.ledger-rows` details with instant close. | Table scrolls in its region at 390; no write control added. | 13, 16 |
| 404 (`not-found.tsx`) | As v5: "Not found" becomes a Dormant chip inline after the H1 (display-l); one primary action back. | Chip present; detector 0. | 13 |
| Error boundary (`error.tsx`) | As v5: "Something went wrong" becomes a Refused chip inline after the H1; digest reference in a mono field; one primary action; no retry. | No message text leaks; reference shown when a digest exists. | 13 |

### 7.2.1 Production identity, credits and billing states (`/login`, `/pricing`, `/account`)

Production `/api/health` reports identity, credits and billing **wired**, so every state below is live and served to real people. The lane restyles them through the §5 components only. **No logic changes:** branch order, form `action`s (`/api/login`, `/api/logout`, `/api/auth/account/export`, `/api/auth/account/disable`, `/api/checkout`), field names, `required`/`maxLength`/`autoComplete`, hidden inputs (`next`, `packId`, `attempt`), query keys (`reason`, `checkout`, `beforeAt`, `beforeId`), copy, `title` attributes and `dynamic = "force-dynamic"` all stay. No markup is added except class names and the eyebrow removals that §7.1 already orders.

| State (main source) | Component mapping | Motion | BEFORE |
|---|---|---|---|
| `/login` signed in (`login/page.tsx:53-104`): "You are already signed in" | H1 display-l; the "Sign in" eyebrow is a section label and goes. Ok state panel (Verified chip, 1px tone hairline, no rail) with its evidence `dl` (Email, Role; the role is a machine value in mono). Account is the primary Button and Open the editor the quiet Button, in one action row; the Sign out form's button is a quiet Button. "Account controls" H2 in the heading role. The export and disable forms use §5 Field: label above in the UI role, password inputs 44px on phones and 38px otherwise, `:user-invalid` line. The confirm checkbox sits in a ≥44px label row with the surface focus ring. Both submits are quiet Buttons with every Button state (loading n/a, as the login submit). The policy paragraphs are body prose at ≤68ch. | 13, 1–4 | not capturable (needs a live session, see below) |
| `/login?reason=<key>` (`:153-157`) | Refused state panel (deny chip, title, mono reason code, registry body) above the auth card, inside the same 28rem column. | 13, 10 | live `umbrella-login-reason-{390,768,1440}` (`LOGIN_CREDENTIALS_REJECTED`). Locally sign-in is not wired, so the page ignores `reason` and shows the not-activated state (`umbrella/login-reason-*`) |
| `/pricing` live checkout (`pricing/page.tsx:132-144`) | Each pack's `form` button is a §5 Button with every state; loading is n/a (no client marker, §0.1), the `aria-busy` style is written. At most one accent fill per viewport (§2.2): the `.tier-featured` pack's button takes the primary fill, the others take the quiet Button paint through CSS (`.tier:not(.tier-featured)`), with no markup change. | 9, 1–4 | live `umbrella-pricing-{390,768,1440}` (3 checkout forms) |
| `/pricing` purchase unavailable (`:145-157`) | The `span.button[aria-disabled="true"]` takes the Button disabled paint: dashed line, `--fg-2` label, `cursor: not-allowed`, never opacity, no hover or press layer; its `title` stays. The `.tier-foot` status is a chip. | 4 | local `umbrella/pricing-*` (3 disabled) |
| `/pricing?checkout=cancelled` (`:187-191`) | Needs-review (warn) state panel under the packs, copy unchanged. | 13, 10 | local and live `pricing-checkout-cancelled-*` |
| `/pricing?reason=<key>` (`:182-186`) | Refused state panel under the packs. | 13, 10 | local and live `pricing-reason-*` (`IDENTITY_SESSION_ABSENT`) |
| `/pricing` "No credit packs to offer yet" (`:167-176`) | Refused state panel with mono reason in place of the tier row; `BILLING_PLANE_PENDING_NOTE` stays its body. | 13 | not reached by a GET: locally the billing plane lists packs with purchase disabled, and production lists 3 live packs |
| `/pricing` `CapabilityTable` (`_components/capability-table.tsx`) | Evidence table: own labelled scroll region, label header row, mono values, row state layer on fine pointers. | 1 | in every pricing shot |
| `/account` signed in (`account/page.tsx:89-151`) | Ok state panel with evidence `dl`; "Manage this session" is a Link. Credits: the balance `dl` (`.dl-row`) is the evidence `dl`, `.ledger-balance` mono tabular (row 16), the starter-grant chip is a status chip; the unreadable-balance case is a Refused panel. The `balanceIsDerived` note is body prose. | 13, 16 | not capturable |
| `/account` administrator (`:110-116`) | Ok state panel "Administrator — no balance was read", no `dl`. | 13 | not capturable |
| `/account` purchase and intent history (`:153-161`) | `section[aria-label="Purchase history"]`: each `li` is a hairline row with the intent id in mono, `time` and credits mono tabular, the rest in body; it scrolls in its own region at 390 if it overflows. The empty and truncation `role="status"` lines take the live status line. "Older purchase intents" (card-link arrow) and "Newest purchase intents" are Links; paging stays a full navigation by the `before` cursor. Unavailable: Refused panel with mono reason. | 13, 1, 10 | not capturable |
| `/account` editor access (`:163-187`) | Entitled: ok panel with the Basis evidence and the editor link as a card-link. Not entitled: Refused panel with reason; "Buy credits" stays a prose link. | 13, 1 | not capturable |
| `/account?checkout=success` (`:216-220`) | Needs-review (warn) panel "Returned from checkout — confirmation pending", copy verbatim, never the ok tone (it is not proof of payment). | 13, 10 | local and live `account-checkout-success-*` (live renders it under the signed-out panel) |

**Why some states have no BEFORE.** The signed-in states need a session on a wired identity plane. Locally the planes need `DATABASE_URL`, Better Auth and Stripe configuration (`src/lib/request-authority.ts:86-88`), which this run must not create or point at production. Signing in to production is outside a read-only capture. The lane proves these states by markup and CSS review against this table and by any existing harness it finds that renders them; it states which one it used. The deploy node's parity check covers the GET states live.

### 7.3 Storefronts (lane-catalogs; both stores in lockstep)

**Shell** (`layout.tsx`, main-only `_components/store-nav.tsx`, `globals.css`):

- The 7.1 masthead, footer, button and eyebrow rules apply to the storefront skeleton.
- The store identity block keeps its accent derivations.
- Delete the grid-line background and both side rails, replacing the rails with a full 1px `--accent-line` frame or a top edge (main still has them; the detector finds 2 side-tab and 1 grid background per store).
- Main-only `StoreNav` (client, `aria-current`) takes the nav indicator of row 17. Main-only footer `.footer-card-title` takes the UI role.
- Transitions and state transforms follow DV-P2 / DV-P3 / DV-P11, so a store control moves exactly as the umbrella's.

| Route (main file) | Changes | Accept | Motion |
|---|---|---|---|
| `/` (`page.tsx`; main-only `LeadPlate`, `.hero-plates`, `.facts`/`.fact`, `.pricing`/`.share-figure`, `PublishSlot`, `.results-count/-surface/-word`, `.rail-bar`) | As v5. H1 display-xl; the `heroKicker` chip is **not** rendered (v5 polish fix 9; the string stays in `site-config.ts`). The "TEST catalog · purchases refuse here" notice moves directly under the hero actions as a compact Needs-review panel (copy unchanged). Main-only hero facts (`.facts-list`) become an evidence `dl` styled inline, so it is not a ruled grid. Main-only share figure (`.share-figure`) becomes the v5 publish "worked example" line in mono tabular. Inventory: the first listing renders as the lead tile spanning two columns at ≥1024 (main's `LeadPlate` is that lead); the rest sit in an even grid. Main-only `PublishSlot` is the last item in the grid with the same frame and an Accent chip, not a louder card. Facets: the H2s stay and group under "All inventory" promoted to the subhead role; facet labels take the UI role. Apply filters gets the loading state (v5 `FormBusy`, added to both stores). | Notice inside the first viewport at 1440 and before the inventory at 390; no chip above the H1; byte-identical rule green. | 11, 9, 1, 2 (paint only, DV-P3), 5 |
| `/item/<id>` (`item/[itemId]/page.tsx`; main-only `.buy-block`, `.buy-title`, `.buy-by`, `.creator-chip`, `.detail-figure`, `.cards-compact`) | As v5. The digest figure leads as media in `<figure>` with its "not a render" caption. Title display-l; price in mono tabular with a TEST chip. The editor-link-unavailable and TEST-purchase refusals are named state panels inside main's `.buy-block` where the buttons would be (the `button-xl button-block` stays the editor action only where main renders it). Included rows become an evidence `dl`; related listings a compact list (`.cards-compact`). | Purchase never completes; refusal beside the price; no overflow at 390. | 13, 1, 16 |
| `/publish` (`publish/page.tsx`, `_components/test-pipeline-proof.tsx`; main-only `.earn-list`/`.earn-row`/`.earn-lead`, `.req-list`/`.req-row`) | As v5. H1 display-l; the eyebrow becomes a chip after the H1. "What you would earn" (`.earn-list`) becomes **one worked example**: total credits → creator share + platform share, in mono tabular figures from the same data, with the share rule as one sentence of prose. Requirements (`.req-list`) become an **ordered list in body type** (16px, `--space-3` between items), with no hairlines or check glyphs. The production-closed refusal is a Refused panel. Main-only `TestPipelineProof` takes the evidence `dl` and the status chips. | Shares derived from the same data, no settlement implied; detector 0. | 11, 13 |
| 404 (`not-found.tsx`) | As v5: umbrella 404 with the store accent. | Chip present; one action. | 13 |
| Error boundary (`error.tsx`) | As v5: Refused chip inline after the H1; lede kept; the `public-reference` element holds the digest in a mono field; the link to `/` is the primary action; no retry. | §0.3 error pins. | 13 |
| Loading (`loading.tsx`, byte-identical) | As v5: a Dormant chip sibling after the attribute-free `<h1>Loading catalogue</h1>`; lede kept; a 2px loading bar plus final-size skeleton blocks (`aria-hidden`). | §0.3 loading pins; both files byte-identical. | 18 |
| Root failure (`global-error.tsx`) | As v5 §7.3 "Root failure": one inline `<style>` as the first child of the attribute-free `<body>`, no import, DV-F12 literal copies, `main h1` descendant styling, static. | §0.3 root-fallback pins. | 13 (static) |

### 7.4 Kids (lane-kids; `sites/kids/src/app/**`)

Unchanged from v5 §7.4 (states, Changes, Fallbacks, Accept, Motion), including DV-K1 to DV-K4. **Clean port:** every Kids app file on main equals the v5 pre-redesign tree, so the v5 lane result (OLD `sites/kids/src/app/**`) applies as is, with any later fix kept. Never touch `src/lib/**`. Kids keeps its local token copies, and it keeps v5 press scale and v5 transition tokens, because none of DV-P2/P3 applies to Kids.

### 7.5 Web shell inspector (lane-webshell; `apps/web-shell/src/inspector-app.ts`)

Unchanged from v5 §7.5, plus the v5 lane deviations DV-W2 (H1 1.625rem) and DV-W3 (busy bar fills by `scaleX`), which v6 records in §8.1 because the lane applied them. **Clean port:** `inspector-app.ts` on main equals the v5 pre-redesign tree, so the v5 lane result applies as is. `dev-server.ts` changed on main (+86/-14), but it still recomputes its CSP hashes from `inspectorPageHtml`, so the lane re-runs `dev-server.test.ts` and touches neither file. States: idle, focus, reviewing, rejected, refused, applied, busy, uncertain (recovery pending is still not producible); light and dark.

### 7.6 Engine Desktop chrome (lane-desktop; `apps/desktop-shell/src/chrome.ts`, `chrome/**`, `ui-kit.ts`, `icons.ts`)

States to cover on main:

- title bar and menus;
- mode rail: build, sculpt, animate, run and ship are reachable modes. Compose and plugins are **inert rail controls** on main (`model/frame.ts:84`, refusal `noDocumentBound`; `model/core.ts:522` normalises both to build). They take the §5 disabled paint and have no mode state to style;
- left dock / scene tree; view tabs; viewport (inert note, live, refused);
- bottom dock: which tabs exist **depends on the mode**, not on a running session (`dockTabsFor`, `packages/schemas/src/editor-shell.ts:136-178`). Build and sculpt have changes, assets, console and evidence; animate has timeline, changes and console; run has console and evidence; ship has evidence and console. Timeline exists only in animate;
- inspector; assistant: open, closed, denied/Kids lock, thinking; ask/build/agent; BYO/hosted routes;
- **main-only** editor command forms (`chrome/settings/*`: `.editor-command-form`, `.viewport-source-control`);
- status bar; command palette; outcome dialog (`showOutcome` in `chrome/core/script.ts`); profile switch (game/web/kids);
- sculpt running sweep; compact-tier drawers; window-below-minimum refusal.

- **Changes:** v5 §7.6 applied to main's split chrome. The tokens come from DV-P5 names.
  - `--r-panel` 18→16 (`chrome/core/styles.ts`, DV-D1).
  - Overlay card, menu, palette and drawer shadows take the tight float (DV-D4).
  - Text under 11px rises to 11px (DV-D2). This includes main's new 8–10px command-form text in `chrome/settings/styles.ts`. The two pinned 10px selectors stay untouched.
  - Colour transitions are removed: instant paint, press keeps the pinned inset shadow, no scale.
  - `:root` emits the §6.1 custom properties from `MOTION_SYSTEM`.
  - The mode rail indicator glides by `translateY`; dock and view tabs get the underline glide (row 17).
  - Palette and outcome entrances use translate + clip-path + keyframe fade (row 8).
  - Menus, the legend, the palette, the outcome dialog, dock panels and drawers animate their entrance only, on `:not([hidden])`.
  - Existing loops: `assistant-bars` and `sweep` move to R-1 tokens (R-2). They are the only desktop loops. Main's region sheets also hold `assistant-breathe/spin/glow/dot/card`, but main's refinement pass (`reconcilePrivateChromeStyles`, see Port notes) removes them from the rendered chrome. They stay removed: no lane re-adds, retimes or reshapes them, and no ring pulse is added (DV-P7).
  - Main's refinement pass is the last word on about 30 selectors. v5 hunks for those selectors map to the `refined` string or to a rule placed after the pass, never to the region file alone (Port notes, desktop).
  - Every `animation:rise` moves to tokens (DV-D5). Main's source has six declarations, not v5's three. The **rendered** chrome has four `rise` uses (`rise .16s` ×3, `rise .3s` ×1): the refinement pass replaces the `.assistant-result` rule carrying `rise .28s` (`chrome/assistant/styles.ts:34`, matched by the `previous` string at `chrome/core/styles.ts:414`) with the refined `.16s` rule (`:417`). The mapping covers all six, so that no source edit can bring a `.28s` back:
    - `.overlay-card` `rise .16s ease-out` (`chrome/core/styles.ts:167`) takes the row 8 entrance (panel duration, expo, `--motion-distance-md`, clip-path);
    - `.assistant-result` `rise .16s ease-out` (`chrome/core/styles.ts:321`, `:417`) and `rise .28s ease-out` (`chrome/core/styles.ts:414`, `chrome/assistant/styles.ts:34`) all take the v5 `.assistant-result` mapping (micro duration, quart, `--motion-distance-sm`), so the same element moves the same in every state;
    - `.sculpt-progress` `rise .3s ease-out` (`chrome/viewport/styles.ts:70`) takes panel duration, expo, `--motion-distance-md`.
    - The `rise` keyframe's off-token 7px distance becomes the distance token per use.
  - The v5 motion script block (initial `finish()`, live-line wipes, tab and assistant-mode glides) goes at the end of `chrome/core/script.ts`. It is motion only, and it is guarded for missing `MutationObserver` or `host.animate`.
  - v5 polish carries over: the drawer scrims as plain selectors, the project pill ellipsis, the inert primary dashed outline, the 10px control radius, and spacing snapped to `--space-*`.
  - Main-only `ui-kit.ts` components (icon button, segmented control, chip, badge, card header, property and vec3 rows) take the §5 Button, Chip and Field states, with token-only spacing (§0.6).
  - Main-only `icons.ts` SVG icons stay as they are: product glyphs, self-contained, `aria-hidden`. R-4 still forbids an SVG for the Change Review ✕/✓.
- **Accept:**
  - every `apps/desktop-shell/test/*` suite green;
  - no `opacity:` outside keyframes; no `transform:scale(`;
  - both 10px pins untouched; detector shows only the DV-X1 rails;
  - after the lane's edits, the rendered chrome (`renderDesktopChrome(desktopVisualView(createDesktopVisualState()))`, plus the assistant-thinking and sculpt-running states) holds 0 of `animation:assistant-breathe|spin|glow|dot|card`, 0 `@keyframes assistant-card` and 0 `rise .28s`. It holds the pinned `animation:assistant-bars` and `sweep` on the R-1 tokens. The lane reports the counts;
  - shots of every state above at 1280×800 and 1920×1080, plus drawers at 1100×800 and below-minimum at 700×500.
- **Motion:** 1–8, 10, 15, 16, 17 (14 and 18 n/a as in v5: no decided-in-place row, no async wait).

### 7.7 Packaged Linux renderer (lane-desktop; `desktop/linux/src/renderer/**`, `src/lib/chrome-document.ts`, `src/lib/byo-configuration-view.ts`)

- **Changes:** as v5 §7.7. Main split the viewport into `renderer/features/**`.
  - The overlay and runtime-report lines now come from `features/overlay-report.ts`. They take the status-line component (row 10) and the overlay chip style, through installed styles and class names only.
  - The BYOK surface (`renderer/byo-configuration.ts`, changed on main, +68/-10) adopts Field, Button and the named-state components. It keeps its pinned rails, `button{transition:none}`, and `aria-busy` on Save/Remove while in flight (v5).
  - Every other `features/*.ts` file is read-only.
- **Accept:** `desktop/linux` `node scripts/build-linux.mjs`, its tests and `check:renderer` green; CSP unchanged; Electron shots at 1280×800 and 1920×1080. BEFORE has first-run and palette only; first-run now reads "Live viewport refused: the desktop bridge is not exposed."
- **Motion:** 6, 10, 15, 16.

---

## 8. Deviations (captain visual facts changed: old → new → why)

| Id | Authority | Old | New | Why |
|---|---|---|---|---|
| DV-F1 | Foundations v2 §02 | `micro` 8.5px mono (and 9–10px labels on sites) | 11px floor for all text; `FOUNDATION_TYPE_SCALE` micro `sizePx` 11 | 8.5px measured ~2.1:1 in `--fg-4` and is unreadable at any contrast; storefronts already ship an 11px floor (Q-03) |
| DV-F2 | Foundations v2 §02 | `lead` 16px, `body` 14px | sites: lead 18px, body 16px (editor chrome keeps 14) | Persuade/Read surfaces at desk distance; the umbrella already renders 16px body, so this records reality |
| DV-F3 | Foundations v2 §03 float surface | `0 24px 60px -16px rgba(0,0,0,.9)` with a 1px `#2C323B` edge | `0 10px 14px -6px` at the same ink, edge kept | 1px border + ≥16px blur is the banned ghost elevation; the edge already separates on near-black |
| DV-F4 | Foundations v2 §06 / D-3 | storefront `--accent-hi` repeats the accent | **Withdrawn in v3; no change.** `--accent-hi` keeps repeating the accent | `design-tokens.test.ts:194-205,231-241` pin it (§0). Storefront hover is the §2.3 `currentColor` state layer, which already gives every control a visible hover, so no Request is raised |
| DV-F5 | Umbrella screen (masthead) | sticky masthead, 82% wash + `backdrop-filter: blur(18px)` | opaque `--bg-base` + `--line-soft` hairline drawn by `::after` (its opacity scroll-linked where supported; no border-colour animation) | decorative glass is banned; the opaque bench reads cleaner and costs no repaint |
| DV-F6 | Foundations colour-law rail presentation | 2px left rail in tone on state panels and rule cards | 1px tone hairline frame + tone status chip at the head | side stripes are banned; the chip carries the same law in text, so colour is not the only cue |
| DV-F7 | Foundations v2 (new fact) | no motion tokens | `FOUNDATION_MOTION` + `--motion-*` (§6.1) | the sheet states no motion; "a visual fact the archive does not state is a decision", recorded here |
| DV-F8 | Foundations v2 (new fact) / redesign motion contract | transitions only, 120–320ms band | `--motion-duration-loop: 1200ms` for indeterminate loops (loading bar, skeleton sheen) and `--motion-delay-loading: 300ms` before any loading indicator paints | a loop is a progress signal, not a transition: a 120–320ms cycle reads as a 3–8 Hz flicker, which is alarm, not "working". The 300ms is a show threshold, not a duration; responses faster than it never flash an indicator. Both run only while `aria-busy`, stop when hidden, and become a static bar under reduced motion. The only exception to the band. **Accepted by run contract owner 2026-10-04 as ruling R-1, recorded in `docs/redesign/RULINGS.md` (source: orchestrator message `lm_6`)**: allowed only for indeterminate progress/pending indicators, only through these two tokens, animating `transform`/`opacity` only, with a static indicator under `prefers-reduced-motion: reduce`. In-band fallback if the ruling is ever withdrawn: a static 2px bar plus one 320ms `clip-path` draw after `--motion-delay-loading`, no loop |
| DV-F9 | Foundations v2 §02 | `ui` 12px, `ui-sm` 11px, `mono` 10–12px | sites: ui 13px, ui-sm 12px, mono 12–13px; `FOUNDATION_TYPE_SCALE` `sizePx` ui 13, ui-sm 12, mono 12 with `maxSizePx` 13 (fixed px) | 11–12px labels and 10px digests sit at the legibility floor at desk distance; with micro rising to 11 (DV-F1) ui-sm must stay a step above it. Desktop chrome keeps Cinematic Pro's 12px UI and 12px mono. No test pins these values |
| DV-F10 | Foundations v2 §02 | `display-xl` 66px and `display-l` 42px, fixed | sites: `clamp(2.5rem, 1.6rem + 3.6vw, 4.125rem)` (40→66) and `clamp(1.875rem, 1.4rem + 1.9vw, 2.625rem)` (30→42), written as CSS literals on site selectors; the tokens keep 66/42 and are never read for a font size | a fixed 66px H1 overflows at 390. The ceiling equals the sheet value, so wide viewports render the sheet size; the umbrella already ships fluid literals (`globals.css:310,320,976`) |
| DV-F11 | Foundations v2 §02 | `micro` tracking 0.15em; no line heights or tracking stated for the other roles | micro 0.08em (`letterSpacingEm` 0.08); line heights and tracking per the §3 table, CSS-only | 0.15em at 11px spreads a label past its column. The sheet states no line heights, and "a visual fact the archive does not state is a decision", so the §3 values are recorded here |
| DV-F12 | Foundations v2 colour laws; store sheets and Kids tokens ("palette in exactly one place", `catalog-storefronts.test.ts:361-368`) | each palette value is declared once, in the store's `globals.css` / shared modules or the Kids sheet; `global-error.tsx` renders unstyled | the three `global-error.tsx` files (`sites/catalog-web`, `sites/catalog-game`, `sites/kids`) each hold an inline `<style>` with **literal copies** of their sheet's existing hex values (no new colour, no custom property) | a root fallback replaces the root layout and may not `import` anything (§0), so it cannot read the sheet; the copies are the only way to style it. No test scans `src/app/*.tsx` for palette literals (`catalog-storefronts.test.ts:369-372` scans `globals.css` and the shared modules only). A lane that changes a sheet value updates the copy in the same change and names it in its report |
| DV-K1 | Kids #200 composition | family stack led by an unloaded `Inter` (then `ui-rounded`, …) | Archivo via `next/font` (or the stack without `Inter` if the Kids suite refuses it). **Fallback branch taken (ruling R-6):** `ui-rounded, "SF Pro Rounded", system-ui, sans-serif`, no `Inter` | an unloaded first family renders per OS; the family face keeps the product voice without a new family. `next/font/google` downloads at build time, which the Kids no-network contract forbids, and the repo has no local Archivo file |
| DV-K2 | run motion contract (hard rule 6); Kids #200 play mode | `play-float` (1.8s / 1.55s `ease-in-out` infinite alternate, `sites/kids/src/app/globals.css:203-214`), exempt only by assertion | kept unchanged as **product content motion**, granted by run contract owner 2026-10-04 as **ruling R-3** (`docs/redesign/RULINGS.md`). Conditions: runs only under `.is-playing`; transform only; sine-like ease-in-out with no bounce or overshoot; static under `prefers-reduced-motion: reduce`; never flashes | the float is the play experience itself, not interface feedback; a 120–320ms float would read as jitter. R-3 covers this loop only; no other CSS loop in a lane-owned file is content (§6.2 rule 7) |
| DV-K3 | §6 (route entrances on Persuade routes only); Kids #200 | no first-paint entrance on Kids | gentle first-paint entrance: intro and studio children fade in with `translateY(--motion-distance-md)`, route 320ms expo, 40ms stagger, 3 steps max; static under reduced motion. **Accepted by ruling R-6** (`docs/redesign/RULINGS.md`) | Kids is a play surface, not a Persuade route, and the lane contract asks for a gentle entrance; it enhances content that is already visible |
| DV-K4 | Kids #200 (new fact) | undone/reset pieces and the old world vanish instantly | undo/reset "ghosts" (`.leaving-piece`, 200ms quart exit) and a 280ms expo world crossfade; the departed item is kept for one render in component state only (`kids-studio.tsx`), reduced motion swaps instantly. **Accepted by ruling R-6** | a child sees what left; the reducer and `src/lib/kids-activity.ts` are untouched, so behaviour and parity are unchanged |
| DV-W1 | web shell (no captain sheet; recorded for completeness) | whole page in `ui-monospace` | `system-ui` prose, mono kept for machine output | mono is the machine's voice; prose in mono hides the diff's importance |
| DV-D1 | Cinematic Pro | `--r-panel: 18px` | 16px | card radius ceiling is 16px |
| DV-D2 | Cinematic Pro | micro labels 8–10px | 11px floor for text (aria-hidden glyphs excepted), **except** `.scene-entity-identity code` and `.asset-browser-card span`, which stay 10px because `visual-refinement.test.ts:41,92` pins them | legibility; `.panel-head` already pins 11px. The two pinned selectors are not overridden by a later rule; Request R1 asks the test owner to lift them |
| DV-D3 | Cinematic Pro `SPACING` | `{4, 8, 12, 16, 24}` | adds 32, 44, 72 under the site names | one spacing scale everywhere; structural `METRICS` unchanged |
| DV-D4 | Cinematic Pro overlays/drawers | `0 0 60px -10px` / `0 24px 60px` shadows with 1px edges | tight float shadow `0 10px 14px -6px` with the edge | ghost-elevation ban |
| DV-D5 | Cinematic Pro | colour transitions `.14s ease`; entrances `rise .3s ease-out` and `rise .16s ease-out` with a `translateY(7px)` keyframe (`chrome.ts:1444,1501,1562,1596`) | instant paint + translate/clip-path/keyframe motion from `MOTION`; the three `rise` entrances on panel/micro durations, expo/quart easing and `--motion-distance-sm`/`-md` (§7.6); **no scale**: press stays the pinned `box-shadow:inset` paint | motion contract (transform/opacity/clip-path/filter only, quart/quint/expo curves, on-token distances) within `chrome.test.ts:925` (no `transform:scale(`) and the pinned "without moving glyphs" press |
| DV-D6 | Cinematic Pro (new fact) | no loading-loop timing; `assistant-bars 0.9s ease-in-out infinite` and `sweep 1.1s linear infinite` (`chrome.ts:1493,1448`) | `MOTION.duration.loop` 1200ms and `MOTION.delay.loading` 300ms, emitted as `--motion-duration-loop` / `--motion-delay-loading`; `assistant-bars` and `sweep` retimed to `var(--motion-duration-loop) var(--motion-ease-out-quart) infinite` (§7.6) | same reason as DV-F8; desktop loading indicators (palette results, compact drawers' skeletons) share the site timing, and the two existing loops are indeterminate indicators too, so they join it. **Accepted by run contract owner 2026-10-04 as ruling R-1 (`docs/redesign/RULINGS.md`, message `lm_6`, confirmed in the orchestrator's own words there); the existing loops moved by ruling R-2**, on the same terms as DV-F8 |
| DV-D7 | Cinematic Pro (lane-desktop) | Play ring (§6 row 15) grows from `circle(50%)` | grows from `circle(25%)` | at 50% the circle already covers a 24px-tall button, so nothing visibly grows. **Accepted by ruling R-6** (`docs/redesign/RULINGS.md`) |
| DV-D8 | Cinematic Pro (lane-desktop) | capability sentences truncated with an ellipsis | drawn only with the details layer (`data-details-open`); visually hidden with the 1px clip pattern while details are closed, still in the accessibility tree | a truncated sentence reads as broken copy; text and hooks unchanged. **Accepted by ruling R-6** |
| DV-D9 | Cinematic Pro (lane-desktop) | web-preview `.site-eyebrow` as an uppercase, tracked accent label | neutral sentence-case chip (1px `--line`, `--text-2`, no tracking) | removes the eyebrow pattern; text unchanged, any test pin on it wins. **Accepted by ruling R-6** |
| DV-X1 | contract over ban | — | test-pinned 2px rails kept: `pre[aria-busy="true"]` (web shell); `.scene-entity-identity`, `.assistant-result`, `.overlay-refused .overlay-body`, `.desktop-byo-config-message` (desktop) | hard rule 5 (contracts win) over rule 7; the only accepted detector findings. Request to the test owners: allow a non-rail busy/selection mark so this exception can close |

The foundation records DV-F* in `docs/design-foundations.md` and DV-D* in
`docs/engine-desktop-surface.md` when it lands them; `DEVIATIONS` in `visual-tokens.ts` gains
DV-D1/D2/D4/D5/D6 rows.

On main, DV-D5's "three `rise` entrances" are six `animation:rise` declarations in the source; §7.6 names each one and its mapping. The rendered chrome has four uses, because main's refinement pass replaces the `rise .28s` rule with the refined `.16s` one (§7.6).

### 8.1 Port deviations (R-9: design frozen at v5; mechanism adapted to main's pins)

Each row is marked **port**. It changes how a v5 decision lands on main, never what the decision is, unless a main test forces a visible difference; the row says so when that happens.

| Id | Kind | v5 | On main | Why (pin) |
|---|---|---|---|---|
| DV-P1 | port | site-kit adds the 18-row `FOUNDATION_MOTION` and `foundationsVariablesCss()` emits every `--motion-*` (§6.1); DV-F7 "no motion tokens → `FOUNDATION_MOTION`" | Main already has `FOUNDATION_MOTION` = D-4 (three rows). It stays value for value and is still the only motion group `foundationsVariablesCss()`/`foundationsCss()` emit. The §6.1 set ships as a **separate frozen group** (port name `FOUNDATION_MOTION_SYSTEM`; same names, values and reduced-motion overrides as §6.1) with its **own emitter** (port name `foundationsMotionCss()`), which also carries the shared keyframes (`sx-fade`, `sx-rise-sm/md/lg`, `sx-draw`, `sx-progress`). Both are exported from `packages/site-kit/src/index.ts`. Composition: the umbrella appends it inside `umbrellaFoundationsCss()` (`sites/umbrella/src/lib/foundations.ts`, R-9 grant) so its names count as emitted; each storefront layout serves it beside the sheet it already serves; Kids and the web shell keep local copies, as in v5. The foundation records the extension under D-4 in `docs/design-foundations.md`. | `design-tokens.test.ts:294-318` and `maintenance-compat.test.ts:203-219` pin exactly three motion lines in those two emitters. No test edited; Request R3 |
| DV-P2 | port | site transitions on `--motion-duration-press/micro/state/panel/panel-exit` with quart/quint/expo | On the umbrella **and** the storefronts every `transition` reads D-4. Paint, opacity, clip-path and state-layer fades use `var(--motion-fast) var(--ease-standard)` (v5 press 120 / micro 160). Transforms and indicator moves use `var(--motion-base) var(--ease-standard)` (v5 micro transforms, state 200, panel transitions and panel-exit on layers that stay rendered). Every keyframe `animation` (rows 5, 9, 10, 11, 13, 14, 15, 16, 18, 19) keeps the v5 tokens and curves. Kids and the web shell keep v5 transition tokens. **Curve (corrected in v6.1):** `--ease-standard` (`cubic-bezier(0.2, 0, 0, 1)`) has no overshoot, but it starts at zero velocity: about 15% progress at 10% of the time, against about 34% for v5's quart. It is not the §6 "fast start" and not one of §6.2 rule 6's quart/quint/expo curves; it is a contract-held exception for site transitions only, forced by the umbrella pin. Visible differences: site transitions start more gently than v5, and hover paints settle in 120ms instead of 160ms. Transitions on site panels and layers that stay rendered, and the row 17 indicator glide, drop from 280ms expo to 200ms `--ease-standard`. Press-in (v5 120ms) and release (v5 160ms) merge into one 120ms `--motion-fast` change (v6.2, review fix 6). | `umbrella-visual.test.ts:424-436` forces it on the umbrella. No store test forces it; the storefront extension is forced by hard rule 6 (one component looks and moves the same on every surface) together with that umbrella pin |
| DV-P3 | port | press `scale(var(--motion-scale-press))` on sites; arrow nudge `translateX(var(--motion-distance-sm))` (4px); tile and card lift `translateY(-4px)`; umbrella lane nudges on the wordmark mark, ledger chevron, rail glyph, profile cards and tiers | On the umbrella and the storefronts a `transform` inside a `:hover`/`:focus*`/`:active` rule is `translateX(3px)`, `scale(1.015)` or `none`. Press is the 12% `currentColor` state layer with no scale. Arrows nudge `translateX(3px)`. A tile lifts by media `scale(1.015)` inside its clip, plus the `--accent-line` frame. The lane-level nudges become paint only. Under reduce the nudges drop to `none`. The web shell and Kids keep the v5 press scale. Visible difference: no press-in on site buttons; 3px instead of 4px arrows; media zoom instead of tile lift. | `umbrella-visual.test.ts:438-452`; stores follow for one component vocabulary |
| DV-P4 | port | rows 11 (Persuade entrance), 13, 15 (aperture), 18 and 19 (scroll-linked hairline); DV-K3 | They stand. They supersede two clauses of main's D-4 record: "nothing is scroll-linked" and "nothing animates on entrance beyond `sa-dot`, `sa-pulse`, `sa-rise`". Those clauses are doc-only; no test asserts them. The foundation amends the D-4 text to cite §6.3 and this row. D-4's "no transition runs longer than 200ms" still holds under DV-P2. A third D-4 clause is superseded on the umbrella: "every computed transition and animation duration is at most `0.001ms`" under reduced motion (`docs/design-foundations.md:206-208`). v5 §6.1 replaces the umbrella's blanket kill with the token overrides plus `animation: none` on decorative loops, so state fades still run there; no umbrella test asserts the clause. The storefronts and the desktop keep the blanket `0.001ms` rule first, as their tests pin it. | user-approved v5 over a doc-only decision |
| DV-P5 | port | `visual-tokens.ts` gains `MOTION` (§6.1 key column), `RADIUS` (panel 16, card 13, control 10), `TYPE_SIZE`, `SPACING` +32/44/72 with `SPACING_SCALE`, `ELEVATION.float`, `MOTION_CUSTOM_PROPERTIES`, `MOTION_REDUCED_CUSTOM_PROPERTIES` | Main's pinned `MOTION`, `RADIUS`, `SPACE`, `TYPE_SCALE` and `DENSITY` stay value for value. The v5 groups whose names collide land under port names: `MOTION_SYSTEM` (the v5 `MOTION` keys and values, no scale keys) and `CHROME_RADIUS` (panel 16, card 13, control 10). `TYPE_SIZE` lands as in v5 (name and values from OLD `apps/desktop-shell/src/visual-tokens.ts`), beside the pinned `TYPE_SCALE`: the names do not collide and no test ties chrome sizes to `TYPE_SCALE` (v6.1, review fix 2). `SPACING_SCALE` (+`--space-11`, `--space-18`), `ELEVATION.float` and both custom-property lists land as in v5, built from `MOTION_SYSTEM`. `--space-5` (20px) stays emitted by `ui-kit`, but no restyled rule reads it (§4 snap). `DEVIATIONS` gains the DV-D rows as in v5. | `visual-tokens.test.ts:176-220`; Request R4 |
| DV-P6 | port | desktop headings 15/17px (§3) | **Withdrawn in v6.1; no change.** §3 "headings 15/17px" stands. `TYPE_SCALE` keeps its pinned values and is not used to resize chrome headings. | No test forces the change: `visual-tokens.test.ts:176-192` pins only the values of the `TYPE_SCALE` object, and main already sizes `.overlay-head h2` at 15px and `.window-refusal h1` at 17px (`chrome/core/styles.ts:170,187`) with the suite green |
| DV-P7 | port (no change) | R-2 retimes `assistant-bars` and `sweep` only | **Rewritten in v6.2: main's refinement wins and nothing is added.** Main's region sheets still contain five assistant pending loops: `assistant-breathe`, `assistant-spin`, `assistant-glow`, `assistant-dot` and `assistant-card`, the last a `box-shadow` pulse. `reconcilePrivateChromeStyles` (`chrome/core/styles.ts:342-447`) replaces their busy rules with still versions (`:400-403`, `:409-417`; the comment reads "One live-bars signal confirms work; the canvas and labels stay visually still") and deletes their keyframes (`:434-438`). The rendered chrome therefore contains none of them. They **stay absent**: no lane re-adds, retimes or reshapes them, and no ring pulse is added. R-1/R-2 still cover only `assistant-bars` and `sweep`, so no ruling is needed. The lane proves 0 of the five in the rendered chrome after its edits (§7.6 Accept). | Main's code: `chrome/core/styles.ts:400-417,434-438`. `visual-refinement.test.ts:67` pins busy `.assistant-progress` with no animation. The v5 design had none of these loops, so it is unchanged |
| DV-P8 | port | the release marker moves from a `.badge` above the H1 to a chip after it | The element keeps class `badge` (it may add the chip classes) and moves after the H1. The other overview classes in §0.1's contrast list stay. | `first-release.visual.spec.ts:169-264` |
| DV-P9 | port | `/` composition and type (§7.2 `/`; v5 lane re-run 2 put the H1 + chip on a row across both columns at ≥1025px) | The overview geometry and ramp pins win (§0.1). The proof rail's four linked lines pair two per row from 621px. The H1 + chip row across both columns is allowed only while the stage stays ≥671×503 and the rail top ≤720 at 1440×900; otherwise the chip wraps under the H1's last line at that width. `/` renders at most 9 distinct font sizes (for example mono shares 13px with UI, and no separate 12px step appears on `/`). The lane records the measured ramp. | `first-release.visual.spec.ts:82-137,266-396` |
| DV-P10 | port | no stripe or grid-line backgrounds (§5 bans) | **Rewritten in v6.1; the ban holds.** The JS-off pending panel on `.release-hero .viewport::after` keeps a plain `linear-gradient` fill at opacity 1 with **no grid lines**, for example `linear-gradient(var(--bg-panel), var(--bg-raised))`, within D-5's neutral-atmosphere limits. Main's two-axis 28px grid (`globals.css:1161-1164`) is removed. No detector exception. | `first-release.visual.spec.ts:418-419` asserts only opacity `"1"` and a `backgroundImage` containing `linear-gradient`; the grid appears only in the comment at :411, and no other test names it |
| DV-P11 | port | lane-catalogs v5: media zoom 1.04, press scale and lift on tiles | Superseded by DV-P2/DV-P3 on both stores (lane-level choices, not §6 facts). | one component vocabulary with the pinned umbrella |
| DV-P12 | port | Viewport frame: 1px `--line-strong`, radius 9, no shadow (§5) | Main's D-6 records media frames (hero stage, proof captures, `/open` viewport) as float surfaces with `--radius-lg` and `--surface-float-shadow`. v5 wins: one Viewport frame with no drop shadow for canvases **and** the main-only proof captures. The foundation amends D-6's record. | user-approved v5 over a doc-only decision; no test pins D-6 |

### 8.2 Lane-level facts carried from the v5 reports

These were applied by v5 lanes and accepted through review. They are part of the frozen result, so the port keeps them:

- DV-W2: web-shell H1 1.625rem.
- DV-W3: the web-shell busy bar fills by `scaleX`.
- DV-K5: Kids choice tiles 102–123px with `min-height: 98px`.
- DV-L1: desktop loading controls draw a 2px bar once after `--motion-delay-loading`.
- Umbrella:
  - `/login` submit loading (row 5) is n/a, as the v5 lane recorded: a client busy marker would breach the pinned client list (§0.1). The `aria-busy` style is written anyway. The same n/a applies to the `/login` account-control submits and the `/pricing` checkout buttons (§7.2.1);
  - editor rail labels at 11px Archivo, 75% width;
  - `.wordmark` `min-height: 44px`;
  - nav at ≤620px is a 4-column grid of 44px targets;
  - no 2px bar on the selected `.ed-tree` row;
  - docs summaries unclamped;
  - `--band-pad` 72/44 and `--gutter` 16px at ≤620 (v5 polish r2, `src/lib/foundations.ts` `bandPad` 104→72);
  - chips sentence case with 0.08em tracking.
- Stores:
  - pressed state layer on accent fills at 10%, for contrast on Forge red;
  - results-column H2 in the Heading role;
  - hero and detail split at 64rem;
  - `--gutter` 1rem;
  - `.chip` 24px tall;
  - R-8 `.state` density.

---

## 9. Ownership (every file in R has exactly one owner)

Rules are applied **in order; the first match wins**, so no file has two owners. `E/port/ownership.mjs` applies them to all 2,778 tracked files, the 19 untracked redesign inputs and 4 planned docs (2,801 in all). The result is `E/port/ownership.tsv` (file → owner → mode). Every file got exactly one owner. Modes:

- **edit**: visual edits allowed;
- **read-only**: owned so nobody else edits it, but the owner makes no change (behaviour, data or contract inside a lane folder);
- **frozen**: test-owners; changes only through Requests.

| # | Owner | Mode | Files |
|---|---|---|---|
| 1 | director | edit | `docs/redesign/DIRECTION.md`, `docs/redesign/BASELINE.md`, `docs/redesign/RULINGS.md` (copy; rulings come from the orchestrator), `E/before/**`, `E/port/**`, `E/final/**` |
| 2 | director | read-only | `docs/redesign-v5-reference/**` |
| 3 | deploy | edit | `docs/redesign/DEPLOY.md` (deploy nodes; Vercel projects only) |
| 3a | reviewers | edit | `docs/redesign/reviews/*.md` (each review node writes only its own file, e.g. `direction.md`, `foundation.md`, `lanes.md`, `gate.md`, `final.md`, `deploy.md`) |
| 3b | each lane | edit | its own report `docs/redesign/lanes/<lane>.md` (`foundation`, `lane-umbrella`, `lane-catalogs`, `lane-kids`, `lane-webshell`, `lane-desktop`) and its own evidence `E/after/<lane>/**` (outside R; listed for completeness) |
| 4 | foundation | edit | `packages/site-kit/src/{design-tokens,change-review,state-panel,commerce-notice,access-states,site-element}.ts`; `packages/site-kit/src/index.ts` (**exports only**, DV-P1); `apps/desktop-shell/src/visual-tokens.ts`; `docs/design-foundations.md`; `docs/engine-desktop-surface.md`; `PRODUCT.md`; `DESIGN.md`; `.impeccable/**` |
| 5 | lane-umbrella | read-only | `sites/umbrella/src/app/api/**`, `_session.ts`, `robots.ts`, `sitemap.ts`, `editor/_components/project-persistence.ts`, `opengraph-image.tsx`, `icon.svg` (identity, credits, billing and webhooks are live: never touched) |
| 6 | lane-umbrella | edit | `sites/umbrella/src/app/**` (everything else: `globals.css`, `layout.tsx`, every `page.tsx`, `error.tsx`, `not-found.tsx`, `docs/loading.tsx`, `editor/loading.tsx`, `editor/layout.tsx`, `_components/*` incl. main-only `proof-figure.tsx`, `docs/_components/*`, `editor/_components/{editor-shell,editor-viewport,web-experience-editor}.tsx`, `open/_components/live-viewport.tsx`); `sites/umbrella/src/lib/foundations.ts` (**R-9 grant: compose the DV-P1 motion sheet and the v5 `bandPad`/band-pad and gutter metrics only**); `sites/umbrella/VISUAL-EVIDENCE.md` (v6.1: the snapshot-directory grant is dropped; no snapshot exists and no spec calls `toHaveScreenshot`, so `*/test/**` stays wholly frozen) |
| 7 | lane-catalogs | read-only | `sites/catalog-{web,game}/src/app/_session.ts`, `opengraph-image.tsx`, `icon.svg` |
| 8 | lane-catalogs | edit | `sites/catalog-{web,game}/src/app/**` (both stores in one change; includes main-only `_components/store-nav.tsx`, `publish-slot.tsx`, and the v5 `form-busy.tsx` if it is added to both) |
| 9 | lane-kids | edit | `sites/kids/src/app/**` (never `sites/kids/src/lib/**`) |
| 10 | test-owners | frozen | `apps/web-shell/src/dev-server.ts`, `apps/web-shell/src/protocol-client.ts` |
| 11 | lane-webshell | read-only | `apps/web-shell/src/{account-panel,assistant-panel,assistant-default,open-path-view,inspector,panel-support,index}.ts` (they render no markup) |
| 12 | lane-webshell | edit | `apps/web-shell/src/inspector-app.ts` |
| 13 | lane-desktop | edit | `apps/desktop-shell/src/chrome.ts`, `chrome/**` (28 tracked files: the 27 `{assistant,core,dock,frame,inspector,palette,settings,tree,viewport}/{markup,script,styles}.ts` plus `core/panels.ts`; script files take motion-only additions), `ui-kit.ts`, `icons.ts` |
| 14 | lane-desktop | read-only | every other `apps/desktop-shell/src/**` file (`model/**`, `visual-model.ts`, `app.ts`, `session.ts`, `protocol-client.ts`, `commands.ts`, `interaction-commands.ts`, `product-loop.ts`, `index.ts`) |
| 15 | lane-desktop | edit | `desktop/linux/src/renderer/{byo-configuration,viewport,playback-report,viewport-playback}.ts`; `desktop/linux/src/renderer/features/overlay-report.ts` (installed styles and class names only); `desktop/linux/src/lib/{chrome-document,byo-configuration-view}.ts` |
| 16 | lane-desktop | read-only | every other `desktop/linux/src/renderer/**` file (`features/*` behaviour, `assistant-*`) |
| 17 | test-owners | frozen | **everything else**, in particular: `tests/**`; every `*/test/**`; `sites/*/src/lib/**` except rule 6's grant (`kids-activity.ts` included); `sites/*/src/middleware.ts`, `sites/*/src/provider/**`; site `package.json`s, `next.config.ts`s and **all lockfiles** (byte-identical to main); `sites/umbrella/public/**` and `MEDIA-PROVENANCE.md`; `packages/site-kit/src/**` beyond rule 4; `desktop/linux/src/**` beyond rules 15–16; `scripts/**`; all other `docs/**`; all other packages and apps |

Counts from `ownership.tsv` by owner and mode (re-run for v6.1 with rules 3a/3b and without the snapshot grant: 2,810 files = 2,778 tracked, 24 untracked, 10 planned docs incl. the six lane reports):

- director: 3 edit, 16 read-only;
- deploy: 1;
- reviewers: 1 (`reviews/direction.md`; the other review files are created by their nodes);
- foundation: 14 (13 edit incl. its lane report, 1 exports-only);
- lane-umbrella: 36 edit (incl. the R-9 grant and its lane report), 17 read-only;
- lane-catalogs: 37 edit, 6 read-only;
- lane-kids: 7;
- lane-webshell: 2 edit, 7 read-only;
- lane-desktop: 39 edit, 31 read-only;
- test-owners: 2,593 (2 of them are the session harness's untracked `.empryo/jobs/*.json`, not product files).

A lane that needs a change in a file it does not own writes it under **Requests** in its report.

---

## 10. Sequencing, verification, reporting (main toolchain)

1. **foundation** lands DV-P1/DV-P5 tokens and the DV-F*/DV-D*/DV-P* records first. Then, with cwd R, it runs `pnpm build`, `pnpm exec vitest run packages/site-kit apps/desktop-shell tests/sites`, `pnpm check:contracts`, and touched-file `eslint --max-warnings 0`.
2. The lanes run in parallel on top of it. Each lane:
   - loads impeccable and runs `node /home/devuser/.agents/skills/impeccable/scripts/context.mjs --target <path>` with cwd R;
   - reads `craft-floor.md` plus the references for the commands it uses;
   - ports the v5 result for its files (OLD tree + §7 + Port notes) onto main's markup, never copying an OLD file over a main file;
   - does one batched screenshot round into `E/after/<lane>/` (the BEFORE state lists in `E/before/NOTES.md` are the minimum), one fix batch and one confirm round.
3. **Proof per lane:**
   - detector 0 on touched paths (DV-X1 excepted, nothing else);
   - the touched packages' suites exit 0;
   - `pnpm build` (cwd R);
   - sites: the site `typecheck` and `pnpm exec next build` in the site directory. On main the catalog `pnpm build` postbuild Vercel package check fails locally because of the pnpm symlink layout; `E/port/build-catalog-*.log` shows the same failure before any redesign change. The deploy node builds with `node scripts/vercel-build-site.mjs <site>`;
   - the umbrella Playwright specs (`sites/umbrella`, `pnpm test:visual`), and a fresh `pnpm build` afterwards, because the spec server leaves a dev `.next`. **Port risk:** `sites/umbrella/playwright.config.ts:28,37-39` hard-codes port 4173 with `reuseExistingServer:false`, outside the contract's port list. Other worktrees of this repo may run the same spec, so a lane checks that 4173 is free (`ss -ltn`) right before the run, runs the spec once at a time (never two umbrella spec runs in parallel, including the final pass), and stops nothing it did not start; a run that fails because 4173 is taken is re-run, not counted as a redesign failure;
   - the desktop and umbrella end-to-end goldens (§0.7), with cwd R and a short TMPDIR: `pnpm exec vitest run tests/e2e/desktop-chrome-* tests/e2e/desktop-editor-command-forms-golden.test.ts tests/e2e/desktop-control-inventory-golden.test.ts tests/e2e/umbrella-*` (lane-desktop and lane-umbrella; failures equal to the main baseline do not block);
   - storefront `node --test` suites and `rendered-route-states.test.mjs`;
   - Kids `production-activity.spec.ts` against a built server on 3204;
   - desktop `pnpm check:desktop`, plus `desktop/linux` `node scripts/build-linux.mjs` and `check:renderer`.
4. **Ports and environment:**
   - umbrella 3201, catalog-web 3202, catalog-game 3203, kids 3204, desktop static 3206, web shell 5281;
   - a short `TMPDIR=/home/devuser/.cache/sx<pid>`, removed afterwards; never `pnpm install` inside `sites/*`;
   - after each command, `git diff --quiet` on every lockfile.
   - `pnpm gate` is never weakened. Failures equal to the main baseline do not block (R-5/R-7 logic). The baseline is `E/backup/gate-baseline.log` (564.5K): a real stage-by-stage run on unchanged main. Its stage lines show `check:syntax`, `check:contracts` and `build` exit 0; `check:boundaries`, `check:traceability`, `check:sites`, `check:desktop`, `check:publish-ready`, `test` and `lint` exit 1; the run ends `gate-script exit=1` after `lint` (33 errors, in pre-existing scratch files under `docs/audits/**` and in `scripts/fix-trace-entries.mjs`). A gate reviewer compares stage by stage and failure by failure against this log.
5. **Lane report** (plain, short): what changed per route and state, shots, commands with exit codes, detector result, the DV and DV-P rows applied, and Requests. Never claim a check that was not run.
6. **Director final pass:** `E/final/<surface>/` captures and a critique against this file. Then come the deploy nodes for the three Vercel sites (never Kids, never desktop).

**Not a lane decision:** storefront activation and real prices; the Kids launch; any change to refusal copy; new interactive behaviour (copy buttons, accordions, search, scroll-spy); anything in identity, credits, checkout, webhook or ledger logic.

---

## 11. Requests (director → test-owners / orchestrator)

| Id | To | Request | Why |
|---|---|---|---|
| R1 | owner of `apps/desktop-shell/test/visual-refinement.test.ts` | change the `font-size:10px` expectations for `.scene-entity-identity code` (:41) and `.asset-browser-card span` (:92) to 11px | closes the DV-D2 exception (carried from v5) |
| R2 | owners of `visual-refinement.test.ts` and `apps/web-shell/test/visual-postpr.test.ts` | allow a non-rail busy/selection mark in place of the pinned 2px/3px left rails | closes DV-X1 (carried) |
| R3 | owners of `packages/site-kit/test/design-tokens.test.ts:294-318`, `tests/sites/maintenance-compat.test.ts:203-219`, `tests/sites/umbrella-visual.test.ts:388-453` | admit the v5 motion vocabulary: the §6.1 lines in the foundations sheet, transitions on the §6.1 durations and curves, press `scale(0.97)` and 4px nudges | would close DV-P1, DV-P2 and DV-P3 |
| R4 | owner of `apps/desktop-shell/test/visual-tokens.test.ts:176-220` | let `MOTION` and `RADIUS` carry the v5 values (or name `MOTION_SYSTEM`/`CHROME_RADIUS` in the pinned list) | would close DV-P5 (DV-P6 is withdrawn: the 15/17px headings need no test change) |
| R5 | orchestrator | **Closed (v6.2).** The orchestrator re-ran the baseline: `E/backup/gate-baseline.log` (564.5K) is now a real stage-by-stage `pnpm gate` run on unchanged main, ending `gate-script exit=1` at stage `lint`. Stage results are in §10.4 | R-5/R-7 logic needs a baseline to compare against; it now has one |
| R6 | deploy owner | the local catalog `pnpm build` fails at the postbuild Vercel package check (pnpm symlinks to `three`/`@types/three`); `next build` succeeds. Confirm `node scripts/vercel-build-site.mjs catalog-web\|catalog-game` is the only valid packaging check | avoids a false lane failure |

---

## Port notes (per surface: what main changed, and how each v5 change maps onto it)

Data:

- `E/port/threeway.txt`: per file, the v5 lane delta (PRE→OLD) and the main drift (PRE→main).
- `E/port/drift/*.diff`: main's drift for the heavily changed site files.
- `E/port/compare.txt`: OLD→main.

PRE is `4e532e2f` plus `E-v5/backup/{staged,unstaged}.patch` plus the untracked src files from `untracked.tgz`, rebuilt in `/home/devuser/Documents/Reports/sceneaxi-redesign-main/port/pre` (outside both trees). In the notes below, **clean port** means main equals PRE for that file, so the v5 result applies as written. **Re-target** means both sides changed, so the v5 intent is re-applied to main's markup.

**Foundation (`packages/site-kit`, `visual-tokens.ts`).**

- `change-review.ts`: clean port (v5 +80/-26). Restyle, busy bar, row 14 hooks `data-sx-decision`/`data-sx-outcome`, 44px icons under 720px; R-4 glyphs.
- `design-tokens.ts`: re-target. Main added D-4 `FOUNDATION_MOTION` (+43). v5 changes the type scale (DV-F1/F2/F9/F11), `FOUNDATION_TEXT_FLOOR_PX`, the float shadow (DV-F3), the `.sx-status` label, and the §6.1 tokens, which become DV-P1's separate group and emitter.
- `index.ts`: main exports `FOUNDATION_MOTION` already; add the DV-P1 exports. v5 Request 1 is closed by rule 4's grant.
- `visual-tokens.ts`: re-target (v5 +186; main +77 with the new `TYPE_SCALE`/`SPACE`/`RADIUS`/`DENSITY`/`MOTION`). Port per DV-P5.
- Docs: `design-foundations.md` gets the v5 "Redesign 2026-10" section plus DV-P1/P2/P3/P4/P12 notes under D-4/D-6. `engine-desktop-surface.md` gets DV-D1..D9 and DV-P5..P7.

**Umbrella.**

- Clean ports (main = PRE): `account/page.tsx`, `admin/ledger/page.tsx`, `_components/sculpt-viewport.tsx`, `docs/loading.tsx`, `editor/loading.tsx`, `editor/page.tsx`, `editor/_components/web-experience-editor.tsx`, `error.tsx`, `not-found.tsx`, `open/_components/live-viewport.tsx`.
- `editor-shell.tsx`: main drift is +1 line, so effectively a clean port: `useIndicatorGlide` and the refs.
- Re-target:
  - `globals.css`: v5 rewrote the site layer (+2580/-1621); main also rewrote large parts (+1757/-503). Main added the D-4..D-7 header and rules, `.proof-*`, `.auth-*`, `.docs-rail*`, `.tier-*`, `.platform-availability` and `.hero-stage*`. Port strategy: start from main's sheet. Re-apply v5 section by section (tokens, shell, buttons/state layers, chips/state panels, routes, editor section with the polish fixes, motion layer, reduce block). Transitions follow DV-P2 and state transforms DV-P3. Every main-only selector gets the matching §5 component treatment.
  - `page.tsx`: main added the `ProofFigure` gallery, `RELEASE_PATHS`, the `.badge` dot, `hero-stage` refused and pending frames, and an eyebrow over the paths. The v5 delta was small (+11/-3: chip after the H1, `.hero-line` spans, path-link arrows); re-apply it per §7.2 and DV-P8/P9.
  - `engine/page.tsx`: main added platform availability, a wide ProofFigure and chips in place of tags. Re-apply the v5 eyebrow removal, package mono list and prose note list.
  - `profiles`, `pricing`, `open`, `login`, `docs/page.tsx`, `help-doc-page.tsx`: main added wrappers (`scroll-frame`, `tier-*`, `open-stage`, `auth-layout`/`auth-card`, docs rail groups). Re-apply each v5 change onto those wrappers. Where main already did the v5 layout (login column, docs rail), keep main's element and apply v5 styling.
- New on main and never seen by v5: `_components/proof-figure.tsx` (brief in §7.2), live production identity (the real `/login` form and the signed-out `/account`), and the editor shell being a production surface.
- `layout.tsx`: main-only drift (+2/-2); v5 did not change it.
- `src/lib/foundations.ts`: v5 polish changed `bandPad`; the port also composes DV-P1 there (rule 6 grant).

**Storefronts (both stores identical in structure).**

- Clean ports: `error.tsx`, `loading.tsx`, `global-error.tsx`.
- Re-target:
  - `globals.css`: v5 +1430/-779, main +1732/-663. Main adopted D-4 and added hero plates, facts, share figure, publish slot, buy block, earn/req lists and `store-nav`; it still has the eyebrow, kicker, glass masthead, side rails and grid background.
  - `page.tsx`, `item/[itemId]/page.tsx`, `publish/page.tsx`, `not-found.tsx`.
  - `layout.tsx`, the v5 changes one by one:
    - Archivo `axes: ["wdth"]` for DV-F11: already present on main in both store layouts (`layout.tsx:30`, checked in v6.1; the review expected it missing). Nothing to port.
    - Footer column headings: main renders `<p className="micro">` (`layout.tsx:148,159,170`); v5 renamed them `footer-heading` in the UI role. Port: the UI role applies, either by v5's class name or by restyling `.micro` inside the footer. Text unchanged; `.footer-card-title` takes the UI role too.
    - v5's async `x-sceneaxi-route` header read for `aria-current` in the layout: **do not port.** Main's client `StoreNav` (`_components/store-nav.tsx`) owns `aria-current`; the lane only styles it (row 17).
  - `_components/{state-panel,listing-card,digest-figure,commerce-notice}.tsx`: small v5 deltas (chip head, `card-compact`, `sigil-scan`, `.state-meta`) onto main's larger drift.
- `listing-tile.tsx`, `family-bar.tsx`, `test-pipeline-proof.tsx`: main-only drift; style them through the sheet.
- `form-busy.tsx`: absent on main. Adding it to both stores is the v5 loading state for Apply filters. It is visual-only client code with no network, and the same file in both stores satisfies `catalog-storefronts.test.ts:347`.
- `store-nav.tsx`, `publish-slot.tsx`: main-only.
- `middleware.ts` and `src/lib/identity-plane.ts` are new on main and frozen.

**Kids.** Every `sites/kids/src/app` file is a clean port (`kids-studio.tsx` +98/-13, `globals.css` +639/-118, `page.tsx`, `loading.tsx`, `global-error.tsx`). `src/lib/kids-activity.ts` changed on main (+108 vs the base); it is frozen and never touched.

**Web shell.** `inspector-app.ts` is a clean port (+103/-16). Main changed `account-panel.ts`, `assistant-panel.ts`, `inspector.ts`, `dev-server.ts` and `protocol-client.ts` (behaviour); none renders markup the lane styles.

**Desktop chrome.** v5 edited the monolithic `chrome.ts` (+394/-170) and `visual-tokens.ts`. Main split `chrome.ts` (now 17 lines of composition) into `chrome/<region>/{markup,script,styles}.ts`, `chrome/core/panels.ts`, `model/<region>.ts`, `ui-kit.ts` and `icons.ts`.

- Map v5 style hunks by selector. `chrome/core/styles.ts` holds `:root`, the base rules, `[hidden]`, the reduced-motion block, the shared keyframes, overlays, the refusal legend and the window refusal, and it composes the region sheets in order.
  - `frame/styles.ts`: title bar, menus, mode rail, status bar, project pill.
  - `tree/styles.ts`: project, tree, panel-head, scene entity.
  - `dock/styles.ts`: dock tabs, assets.
  - `inspector/styles.ts`.
  - `viewport/styles.ts`: viewport, sculpt progress and sweep, web preview `.site-eyebrow`, capability list, view tabs.
  - `assistant/styles.ts`: assistant column, modes, the loops.
  - `palette/styles.ts`.
  - `settings/styles.ts`: main-only command forms.
- **Main's refinement pass decides the rendered rule.** `chrome/core/styles.ts` ends its composed sheet with `reconcilePrivateChromeStyles` (`:342-447`). It is a table of about 30 `[previous, refined]` pairs over the composed region sheets, applied with `css.replace(previous, () => refined)`, exact string, first match only. For those selectors it is the last word. Among them: `:focus-visible` (plus the press, hover and transition lines in that refined block), `.panel-head`/`.panel-empty`, `.project-launcher`, `.project-recent-label`, `.project-browser-detail`, `.asset-browser-card span`, `.scene-entities`, `.scene-entity-identity*`, `.scene-property-input`/`-review`, `.pass-row`, `.viewport-backdrop`, `.change-empty`, `.assistant-head`, the busy `.assistant-mark`/`.viewport::after`, `.icon-button`, `.assistant-body`/`-empty`, `.assistant-thinking .dot`, `.assistant-progress`, `.assistant-result`, `.assistant-composer`/`-prompt`, `.assistant-route*`, `.overlay-body`, `.palette-item`, `.window-refusal`, and the five assistant keyframes it deletes.
  - A v5 hunk for one of these selectors maps to the **`refined`** string inside the table, or to a rule placed after the pass (a block appended to the returned sheet). It never maps to the region file alone.
  - Editing a region sheet changes the text that a `previous` string must match. If it no longer matches, the replacement silently stops: the old rule renders again, and with it the five assistant loops and `rise .28s`. A lane that edits a region-sheet rule named in a `previous` string edits the `previous` string in the same change, so the pair still matches, or leaves that rule alone.
  - The lane checks the rendered chrome after its edits: 0 of the five loops, 0 `rise .28s` (§7.6 Accept).
- v5's motion script block goes at the end of `chrome/core/script.ts`.
- `DESKTOP_OVERLAY_IDS` is `["palette"]` on main; the outcome dialog is driven by `showOutcome` in `chrome/core/script.ts`.

**Linux renderer.**

- `byo-configuration.ts`: re-target (v5 +20/-7, main +68/-10). Port the installed styles and the `aria-busy` marking.
- `viewport.ts`: main moved most of it into `features/**` (−1317 lines), so the v5 lane (which left `viewport.ts` unchanged) maps its overlay-line styling onto `features/overlay-report.ts`.
- `chrome-document.ts`: main-only drift (+14/-1, CSP). No change is needed; it re-hashes the inline script.

---

## Revision log

**v6 (2026-10-05), port of v5 onto `origin/main` `dffefbab` (run `sceneaxi-impeccable-redesign-main`).** The user approved v5 and asked for the redesign on top of the version production runs. Changes from v5:

1. **§0 re-derived** from main's tests. New pins:
   - the D-4 motion block of `umbrella-visual.test.ts` and `design-tokens.test.ts`;
   - the overview geometry, type-ramp, proof-gallery, contrast-list and pending-panel pins of `first-release.visual.spec.ts`;
   - the pinned client list;
   - the desktop `TYPE_SCALE`/`SPACE`/`RADIUS`/`DENSITY`/`MOTION` and `ui-kit` pins;
   - moved line numbers for every v5 pin.
2. **§7 re-targeted** to main's files and routes, with briefs for main-only elements: ProofFigure gallery, platform availability, auth layout, docs rail, store hero facts, share figure, publish slot, buy block, earn and req lists, store nav, desktop command forms, `ui-kit` components and icons, and Linux `features/overlay-report.ts`. Production states (live sign-in, signed-out account, production editor shell) are named.
3. **§8.1 port deviations** DV-P1..DV-P12 and **§8.2** carried lane facts. Every v5 DV row is unchanged.
4. **§9 Ownership** re-mapped to main's real files with an ordered first-match rule set, verified over all 2,801 files.
5. **§10/§11** re-targeted to main's toolchain and ports; Requests R3..R6 added.
6. **Port notes** added.
7. `docs/redesign/RULINGS.md` is the v5 copy plus R-9.

`PRODUCT.md` was refreshed only where main changed a fact: production status and the live identity, credits and billing planes. `DESIGN.md` gained one port note on D-4..D-7 and DV-P1..P12. BEFORE: 252 PNGs of main plus 46 of live production; see `E/before/NOTES.md`.

**v6.1 (2026-10-05), from the v6 review in `docs/redesign/reviews/direction.md` (verdict FAIL, 3 blocking and 9 advisory fixes).** No user gate notes came with this run; every fix is applied. Port deviations that no main test forces are withdrawn.

1. **DV-P10 rewritten (blocking).** The pending panel keeps a plain `linear-gradient` fill at opacity 1 with no grid lines; main's 28px grid goes. The test asserts only opacity and the `linear-gradient` substring. The DV-P10 detector exception is deleted from §0, §7.1 Accept and §10.3. The "token-line grid" wording is gone from the §0.1 row and the §7.2 `/` row.
2. **DV-P6 withdrawn (blocking).** §3 "headings 15/17px" stands. The Port overlay's §3 Desktop bullet is removed. DV-P5 now lands `TYPE_SIZE` as in v5. The §0.6 pinned-groups row and R4 are updated to match.
3. **Production states (blocking).** New §7.2.1 maps every live identity, credits and billing state to its §5 component and states that no logic changes. It covers: `/login` signed in with account controls, `/login?reason=`, the `/pricing` live checkout and `aria-disabled` span, `?checkout=cancelled`, `?reason=`, "No credit packs" and `CapabilityTable`, and the `/account` member, administrator, history, editor-access and `?checkout=success` states. BEFORE: 27 new PNGs (below). Signed-in states and "No credit packs" are recorded as not capturable, with the reason.
4. **Goldens (advisory).** New §0.7 for `tests/e2e/*golden*`. §10.3 requires the desktop/umbrella golden subset.
5. **DV-P2 curve (advisory).** `--ease-standard` is no longer called decelerating. Its zero-velocity start is recorded as a visible difference and a contract-held exception. The storefront extension is attributed to hard rule 6 plus the umbrella pin.
6. **DV-P4 (advisory).** It now names the D-4 "at most `0.001ms`" reduced-motion clause that v5 §6.1 supersedes on the umbrella.
7. **Dropped v5 details restored (advisory).**
   - Motion columns: row 2 is back on `/engine`, `/pricing` and the store home, and the §7 intro says the shell brief carries it everywhere. Row 16 is back on `/admin/ledger` and the store `/item`. `/login` row 5 is recorded as n/a in §8.2.
   - Brief text restored verbatim: getting-started "steps keep their order"; CLI "Free and BYO-AI" as prose + chips, and the commands table scrolling at 390; credits refund text; `/open` "in every mode"; the store shell's 1px `--accent-line` frame or top edge.
8. **Store `layout.tsx` (advisory).** The Port notes map the v5 changes one by one. Archivo `wdth` turned out to be already on main, so there is nothing to port. Footer `.micro` takes the UI role. The `x-sceneaxi-route` `aria-current` is "do not port" (main's `StoreNav`).
9. **Six `rise` declarations (advisory).** §7.6 names all six with their mappings; a note under the §8 table extends DV-D5.
10. **Ownership (advisory).** §9 rule 3a gives `docs/redesign/reviews/*.md` to reviewers. Rule 3b gives each lane its `docs/redesign/lanes/<lane>.md` and `E/after/<lane>/**`. Rule 1 adds `E/port/**` to the director. The vacuous snapshot grant is dropped from rules 6 and 17. `E/port/ownership.mjs` was re-run; the counts are updated.
11. **Playwright port 4173 (advisory).** §10.3 notes the collision risk with other worktrees and serialises the runs.
12. **Live 768 (advisory).** Live `/`, `/pricing` and `/login` now have 768×1024 shots.

**BEFORE re-capture (v6.1).** Script: `E/before/_scripts/capture-states-v6.mjs`, using headless Chromium through R's `playwright-core`.

- **Local:** R's existing production build of `sites/umbrella` (`.next`, source unchanged), served by `next start` on 127.0.0.1:3201 with no identity env. 12 PNGs in `E/before/umbrella/`: `login-reason`, `pricing-checkout-cancelled`, `pricing-reason` and `account-checkout-success`, each at 390/768/1440. Facts are in `states-v6.json`.
- **Live:** read-only GETs, no sign-in and no form submit. 15 PNGs in `E/before/live/`: the same four states at three widths, plus `umbrella-{home,pricing,login}-768`. Facts are in `states-v6.json`.
- **Results:** every response was 200, with 0 page errors and no horizontal overflow. The server was stopped and port 3201 is free. The short TMPDIR was removed. Both lockfiles are unchanged (`git diff --quiet`).

`PRODUCT.md` adds the production states to its signed-in-customer line. `DESIGN.md`'s port note now says that the pending panel has no grid, that desktop headings stay 15/17px, and that the D-4 curve starts gently.

**v6.2 (2026-10-05), from the v6.1 review in `docs/redesign/reviews/direction.md` (verdict FAIL: 3 blocking, 6 advisory) and the orchestrator's note on it (link `lm_58`: close all nine this pass; DV-P7 resolved as "main's refinement wins").** No user gate notes came with this run. The design is still v5; no v5 decision or DV row changed.

1. **DV-P7 rewritten (blocking).** It now says that main's `reconcilePrivateChromeStyles` already removes `assistant-breathe/spin/glow/dot/card` from the rendered chrome, that they stay absent, that no ring pulse is added, and that R-1/R-2 still cover only `assistant-bars` and `sweep`. The row's kind is "port (no change)". The Port overlay bullet "§6.2 rule 5 and R-2" and the §7.6 Changes loop bullet now say the same.
2. **Refinement pass in the Port notes (blocking).** The desktop Port notes name `reconcilePrivateChromeStyles` (`chrome/core/styles.ts:342-447`) as the last word on its selectors and list them. They map v5 hunks to the `refined` string or to a rule after the pass, and they warn that a region-sheet edit which breaks a `previous` match brings the old rules back, the loops and `rise .28s` included. §7.6 Changes points there. §7.6 Accept now requires the lane to report 0 of the five loops and 0 `rise .28s` in the rendered chrome after its edits.
3. **Desktop BEFORE duplicates (blocking).** The duplicates were re-captured with `E/before/_scripts/capture-desktop-v6_2.mjs`, after `pnpm build` (cwd R, exit 0).
   - `dock-timeline-*` is now rendered in animate mode; the active tab reads Timeline.
   - `assistant-{ask,agent,thinking,hosted}-1280x800` open the compact-tier drawer, so the assistant is drawn.
   - `assistant-hosted-*` render with the details layer open, so the route group (`display:none` otherwise) is drawn.
   - New: `assistant-open-drawer-1280x800`.
   - Three remaining identical pairs each have a recorded reason in `E/before/NOTES.md` ("v6.2 desktop re-capture"): `compose-*` = `default-*` (normalised to build); `assistant-closed-1280x800` = `default-1280x800` (the drawer is closed in both); `session-running-*` = `dock-changes-*` (the same model state).
   - DOM facts and the md5 scan are in `E/before/desktop/audit-v6_2.json`.
4. **§7.6 state list (advisory).** Compose and plugins are inert rail controls on main that take the §5 disabled paint; they are not reachable modes. Dock tabs depend on the mode, and timeline exists only in animate.
5. **Rendered `rise` count (advisory).** §7.6 and the DV-D5 note keep the six-declaration mapping. They now state that the rendered chrome has four `rise` uses, because the `rise .28s` rule is replaced at render.
6. **DV-P2 differences (advisory).** On the sites, panel and layer transitions and the row 17 glide drop from 280ms expo to 200ms `--ease-standard`, and press-in and release merge into one 120ms change.
7. **R5 closed (advisory).** §10.4 cites `E/backup/gate-baseline.log` with its stage results. In the log, 7 of the 10 stages exit 1 and 3 exit 0 (`check:syntax`, `check:contracts`, `build`). `lm_58` says 8 of 10; the 7 stated here is the count in the log's own stage lines.
8. **§9 rule 13 (advisory).** It now reads "28 tracked files" (27 region files plus `core/panels.ts`), checked with `git ls-files`. No owner changes.
9. **`/account` Accept (advisory).** "No ruled note grid" is restored.

`DESIGN.md`: the port note says that the desktop assistant shows work through one live-bars signal, and that the mark, canvas and progress card stay still. `PRODUCT.md`: no fix touches it, so it is unchanged. Port 3206 was free before and after the capture. The short TMPDIR was removed. Both lockfiles are unchanged (`git diff --quiet`).

### v5 revision log (carried verbatim)

**v2 (2026-10-04), from `docs/redesign/reviews/direction.md` (verdict FAIL, 11 fixes).** No user
gate notes were supplied with this run, so only the review's fixes were applied.

1. **Loop timing (g).** Added `--motion-duration-loop` 1200ms and `--motion-delay-loading` 300ms
   to §6.1 and `MOTION` (`duration.loop`, `delay.loading`); rows 5 and 18 and §6.2 rule 5 cite
   them; recorded as DV-F8 (sites) and DV-D6 (desktop), the only exception to the band.
2. **Desktop scale.** Rows 1, 2, 8 and 15 no longer emit `scale()` on desktop: hover is instant
   paint, press keeps the pinned `box-shadow:inset`, dialogs/palette enter by translate +
   clip-path + keyframe fade on every surface, the play ring grows by `clip-path: circle()`.
   Rows 14 (strike) and 17 (indicator) now draw with `clip-path` instead of `scaleX()`.
   `chrome.test.ts:925` added to §0; desktop emits no `scale.*` token; DV-D5 and §7.6 rewritten.
   The pinned "press without moving glyphs" test is now a §0 row.
3. **DV-D2 pins.** `.scene-entity-identity code` and `.asset-browser-card span` named as pinned
   10px exceptions in §0, §3, §7.6 and DV-D2, with a no-workaround rule and Request R1 (§11).
4. **Web-shell pins.** §0 now copies every asserted string from `visual-postpr.test.ts` and
   `inspector-accessibility.test.ts:234-247`; the §5 Button focus state is split by surface
   (sites `--accent-hi`, desktop `--accent` + 4px well, web shell `currentColor`); §7.5 says so.
5. **Umbrella stagger.** Row 9 uses `var(--i, 0)` or `:nth-child()` delays; §0 states the
   umbrella adds no bare `var(--x)` outside the emitted set and the frozen `localMetrics` list.
6. **Ownership (d).** "frozen" is now the explicit owner `test-owners` (Requests only);
   `dev-server.ts` and `protocol-client.ts` belong to it, and lane-webshell's note explains that
   the CSP hashes recompute from `inspectorPageHtml`. Lane globs now name the fallback files;
   the non-existent umbrella root `loading.tsx` entry was replaced by the two real ones.
7. **Composition (f, altitude 2).** The hairline definition row is reserved for term→value
   evidence (`/open` readout, item `dl`, account balance facts, ledger, state-panel evidence).
   Pricing notes and account "How credits work here" are one prose block with inline mono
   figures; publish earnings is one worked example and its requirements an ordered list in body
   type; the home proof rail is four linked lines led by their real artifact; FAQ reads as
   question/answer without hairline rows. Mono uppercase labels are limited to machine values and
   table column heads; TOC titles, facets, footer headings, field labels and `dl` terms use the UI
   role in Archivo, sentence case (§3, §5, §7).
8. **Motion (f).** Row 12 (docs) is now no entrance; row 13 (state routes) is no rise, only the
   state panel's tone underline draw; row 11 is the only route entrance. Docs guide list and the
   below-fold home proof rail left the row 9 stagger list. The thesis states that each surface's
   authored moment is its only noticeable motion.
9. **Completeness (c).** Briefs added for storefront `error.tsx`, `loading.tsx` and
   `global-error.tsx`, Kids `loading.tsx`/`global-error.tsx`, and umbrella `docs/loading.tsx`
   and `editor/loading.tsx`, each with its state component and motion row (13 or 18). Their test
   pins (attribute-free `h1`/`body`, byte-identical catalog loading, no `import` in Kids loading)
   were added to §0. 30 BEFORE shots captured for these states (see `E/before/NOTES.md`).
10. **Chip placement.** §5 now says where a replacement chip goes (after the H1 in a shared
    wrapping head, or at the head of the action row; never above a heading or inside the `h1`);
    `/`, `/engine`, storefront home, 404 and the error boundaries cite it.
11. **Row 19.** The masthead line is a `::after` whose `opacity` is scroll-linked; no
    `border-color` animation (row 19, §7.1, DV-F5).

**Other v2 edits.** `R/DESIGN.md`: UI and Label roles narrowed (fix 7); Floor Rule names the two
pinned 10px desktop selectors (fix 3); Button states split by surface for focus, press and loading
timing (fixes 1, 2, 4); masthead hairline as an `::after` opacity line (fix 11); two Do's and one
Don't for evidence rows and chip placement (fixes 7, 10); `danger-on-light` #B3261E documented as
the web shell's pinned light-theme refusal red; the float-shadow ink written in words so the file
carries no stray colour literal. `R/PRODUCT.md`: no fix touches it; unchanged. To keep this file at
0 detector findings, the web-shell pins moved into a text block under the §0 table, the busy-diff
rail is cited by test line instead of quoted, and DV-K1 names the old stack without a CSS
declaration. Detector on `DIRECTION.md`, `DESIGN.md`, `PRODUCT.md`: 0 findings.

**v3 (2026-10-04), from the v2 review in `docs/redesign/reviews/direction.md` (verdict FAIL, 2
blocking defects, 6 fixes) and the run contract owner's ruling on fix 4.** No user gate notes were
supplied with this run.

1. **DV-F4 withdrawn (fix 1).** The storefront `color-mix` `--accent-hi` is gone from §2.4 and
   DV-F4. Storefront `--accent-hi` stays equal to the accent, and storefront hover is the §2.3
   `currentColor` state layer. A new §0 row pins `design-tokens.test.ts:194-205,231-241`. No R3:
   the state layer already gives a visible hover.
2. **Type facts recorded (fix 2).** §3's column is now "Foundations token (sheet value)" beside
   "Site size", and every row that differs from `FOUNDATION_TYPE_SCALE` cites a deviation. New
   rows: DV-F9 (ui 12→13, ui-sm 11→12, mono 10–12→12–13), DV-F10 (display-xl/l fixed → fluid
   `clamp()` literals) and DV-F11 (micro tracking 0.15→0.08em, plus the line heights and tracking
   the sheet does not state). A "How the sizes land" paragraph says that the foundation changes
   fixed `sizePx` only (lead, body, ui, ui-sm, micro, mono), that the display tokens keep 66/42,
   and that lanes write the display `clamp()` as literals and never read the display tokens for a
   font size.
3. **Show/hide motion with `hidden` (fix 3).** In §6.2 rule 4, anything toggled by `hidden`,
   `<details>` or unmounting has no exit motion. Its entrance is a keyframe on `:not([hidden])`,
   with opacity only inside `@keyframes`, so the opacity gate (`visual-tokens.test.ts:159-176`)
   and the pinned `[hidden]{display:none !important}` hold and no script changes. Rows 6, 7 and 8,
   §7.5 (web-shell `#recover`/`#reconcile`) and §7.6 now say the same, and a new §0 row cites
   `chrome.ts:445,493,547` and `chrome.test.ts:383-393`.
4. **Loop exception ruled (fix 4).** The run contract owner accepted the loop exception on
   2026-10-04. DV-F8 and DV-D6 record it as "accepted by run contract owner 2026-10-04", on these
   terms: indeterminate progress/pending indicators only, the two tokens only, `transform`/`opacity`
   only, and a static indicator under reduced motion. §6.1, §6.2 rule 5 and rows 5 and 18 cite the
   ruling. DV-F8 keeps the in-band fallback (static 2px bar plus one 320ms `clip-path` draw), which
   applies only if the ruling is withdrawn.
5. **Read-only umbrella files (fix 5).** §9 lane-umbrella marks `api/**`, `_session.ts`,
   `robots.ts`, `sitemap.ts` and `editor/_components/project-persistence.ts` as "owned, read-only
   (no visual surface)".
6. **Web-shell light BEFORE (fix 6).** 8 PNGs were re-captured into `E/before/web-shell/`: light
   reviewing, rejected, refused and focus at 390 and 768. Every inspector state now has light and
   dark shots at all three widths (30 PNGs). `pnpm build` exited 0 before the server ran, and the
   server was stopped afterwards. Details are in `E/before/NOTES.md`. §7.5 Accept now names all 30.

**Other v3 edits.** `R/DESIGN.md`: the Display, UI and Mono hierarchy lines now cite DV-F10 and
DV-F9. The button-primary hover note states that storefronts use the state layer (`--accent-hi`
equals the accent there). The loading-loop sentence cites the contract owner's acceptance. A
Desktop motion note says that `hidden`-toggled layers enter by keyframe and leave instantly.
`R/PRODUCT.md`: no fix touches it, so it is unchanged.

**v4 (2026-10-04), from the v3 review in `docs/redesign/reviews/direction.md` (verdict PASS, 5
fixes: 1 blocking for the fallback files, 1 provenance, 3 advisory) and the orchestrator's notes
on it (message `lm_9`: last allowed revision, every item closes, advisories included).** No user
gate notes were supplied with this run.

1. **No import in `global-error.tsx` (fix 1).** A new §0 row bans any `import` in the three
   `global-error.tsx` files, citing `rendered-route-states.test.mjs:15-20,60-66` (no `require`
   in the harness). §7.3 "Root failure" and the §7.4 Kids fallback now style the page with one
   inline `<style>` as the first child of the attribute-free `<body>`: literal values from the
   existing sheet, system stack, no custom property, no `url(`/`http`/`<`/`>`/`&`/quotes, and for
   Kids none of the test's forbidden words. CSP already allows inline styles (storefront
   `middleware.ts:11`; Kids has no middleware, but `security-headers.json` sets the same
   `style-src`). The fallback stays unstyled if a suite refuses it. No stylesheet import is
   wanted, so no R3.
2. **Loop ruling provenance (fix 2).** The ruling is R-1 in `docs/redesign/RULINGS.md` (source:
   orchestrator message `lm_6`). DV-F8, DV-D6, §6.1 (`--motion-duration-loop`,
   `--motion-delay-loading`), §6.2 rule 5 and rows 5 and 18 cite it. The loop stays the default;
   the in-band fallback in DV-F8 applies only if R-1 is withdrawn.
3. **Storefront font sizes (fix 3).** The §0 floor row and a new §3 paragraph say that storefront
   font sizes are rem/px literals at or above 11px or `var()` of a token the store's own sheet
   declares, never `var(--type-*-size)` (`catalog-storefronts.test.ts:126-131,188-199`).
4. **Snapshot ownership (fix 4).** §9 names `sites/umbrella/test/*.visual.spec.ts-snapshots/**`
   (Playwright's default path for `sites/umbrella/playwright.config.ts`, `testDir: "./test"`) as
   lane-umbrella's and excludes it from test-owners' `*/test/**`. None exist today: no spec calls
   `toHaveScreenshot`.
5. **Five states per control (fix 5).** Every §5 row now lists hover, focus-visible, active,
   disabled and loading, or "n/a (why)". Link, Field, Evidence table and Listing tile name their
   missing states. Change Review, Viewport frame and Dialog/palette/drawer point their inner
   controls at the Button states. Chip, panel, `dl`, notice, Skeleton and status line are marked
   not a control. A sentence under the table says "n/a" never lets a lane skip a state that occurs.

**Other v4 edits.** `R/DESIGN.md`: the loading-loop sentence now cites ruling R-1 in
`docs/redesign/RULINGS.md`. `R/PRODUCT.md`: no fix touches it, so it is unchanged. `E/before`: no
shot was missing, so nothing was re-captured (169 PNGs, as the review counted). `E/before/NOTES.md`
now says that the `global-error-*` BEFORE shots stay valid under fix 1, because AFTER is captured
the same way (stylesheets removed) and only the inline block styles it.

**v5 (2026-10-04), from the v4 review in `docs/redesign/reviews/direction.md` (verdict FAIL on
criterion g, 7 fixes) and the orchestrator's rulings on it (link `lm_12`; rulings R-1 to R-4 in
`docs/redesign/RULINGS.md`: close all 7 items in this pass).** No user gate notes were supplied
with this run; `lm_12` was applied as the gate notes.

1. **Desktop loops onto R-1 tokens (fix 1, ruling R-2).** §6.2 rule 5 and DV-D6 no longer keep
 the old timing. §7.6 gives the exact declarations: `assistant-bars` and `sweep` run at
 `var(--motion-duration-loop) var(--motion-ease-out-quart) infinite`, keeping the pinned
 substring `animation:assistant-bars` and the per-bar delay stagger. One §7.6 sentence says that
 the blanket reduced-motion rule and the existing `display:none` already make both static. The
 §6.1 loop token row names both loops. §6.2 rule 6 now bans `linear`, `ease` and `ease-in-out`
 on every interface motion, loops included.
2. **Kids `play-float` (fix 2, option a, ruling R-3).** It is recorded as DV-K2, product content
 motion with the R-3 conditions. §6.2 rule 7 grants exactly this one CSS loop and says that no
 other CSS loop in a lane-owned file is content (WebGL output stays runtime output). Row 20,
 §7.4 Changes and §7.4 Accept cite R-3.
3. **Existing entrances onto tokens (fix 3).** §7.6 migrates `rise .3s ease-out` (`chrome.ts:1444`)
 and `rise .16s ease-out` (`:1501`, `:1562`) to panel/micro, expo/quart and
 `--motion-distance-sm`/`-md`, and replaces the 7px keyframe (`:1596`); DV-D5 records the old
 values. Row 20 and §7.4 say that the placement motion replaces Kids
 `piece-arrive 160ms ease-out` (`globals.css:423`).
4. **Attribute-free `<h1>` in `global-error.tsx` (fix 4).** The §0 fallback row now pins it
 (`rendered-route-states.test.mjs:63`). §7.3 "Root failure" and §7.4 style the heading by `main h1`,
 with classes only on `main`, `p` and `a` (Kids: `main` and `p`; it has no link).
5. **Fallback palette copies (fix 5).** New DV-F12 records the literal hex values in the three
 inline `<style>` blocks, why no import is possible, and that a sheet change updates the copy.
 §7.3 and §7.4 cite it.
6. **R-1 provenance (fix 6).** The orchestrator confirmed R-1 in its own words in `RULINGS.md` (the
 answer to `lm_10`); DV-D6 says so. My own ask in this pass also timed out after 90 s, so the
 confirmation rests on the `RULINGS.md` text and link `lm_12`.
7. **Change Review glyphs (fix 7, ruling R-4).** The §5 Change Review row says the ✕/✓ and
 similar marks stay as text glyphs, each with an `aria-label` or visually hidden text; they may
 be restyled but their text never changes; no SVG swap in this run.

**Other v5 edits.** `R/DESIGN.md`: the motion paragraph names the one content loop (DV-K2), the
loading sentence says the desktop assistant bars and sculpt sweep share the loop timing (R-2),
and the Change Review section says the accept/reject marks stay as labelled text glyphs (R-4).
`R/PRODUCT.md`: no fix touches it, so it is unchanged. `E/before`: no state is missing, so nothing
was re-captured; `E/before/NOTES.md` has a v5 note.
