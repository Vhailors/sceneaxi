# SceneAxi redesign — Direction v5

| Field | Value |
|---|---|
| Date | 2026-10-04 |
| Author | design director node (impeccable 4.3.1) |
| Status | approved direction for the redesign lanes (v5: revised against the v4 review in `docs/redesign/reviews/direction.md` and the orchestrator's rulings R-1 to R-4 in `docs/redesign/RULINGS.md`; see Revision log); supersedes nothing until a lane lands it |
| Inputs | `PRODUCT.md`, `DESIGN.md`, `docs/design-foundations.md` (Foundations v2), `docs/engine-desktop-surface.md` (Cinematic Pro), `docs/redesign/BASELINE.md` (critique + audit), BEFORE shots in `/home/devuser/Documents/Reports/sceneaxi-redesign/before/` |
| Evidence dirs | E = `/home/devuser/Documents/Reports/sceneaxi-redesign`; lanes write `E/after/<lane>/`, final review writes `E/final/<surface>/` |

**What kind of redesign this is.** The incumbent worlds are coherent, captain-accepted and
product-specific (colour laws, Change Review, named refusals). Per impeccable's *new-work* §1 this
is an **established world**: we keep it and replace its scaffolding (eyebrows, card grids, ghost
elevation, silent state changes, off-scale spacing) and add a motion system. No concept-seed roll
was run because no surface gets a new visual identity; every visual fact that does change is a
recorded Deviation (§8). Process notes: no interview was possible (PRODUCT.md is derived, inferred
facts marked); critique ran degraded in a single context; `impeccable context` does not resolve the
root PRODUCT.md/DESIGN.md for `sites/*` (they are separate install roots), so **site lanes read
`R/PRODUCT.md`, `R/DESIGN.md` and this file directly** after running the launcher.

---

## 0. Contract pins every lane must respect (read before editing)

These are executable. A lane that breaks one has changed behaviour, not visuals.

| Pin | Where | What it forces |
|---|---|---|
| No colour literal in the umbrella stylesheet; every bare `var(--x)` read in `globals.css` resolves to a name the shared sheet emits or to the frozen `localMetrics` list (`--shell`, `--gutter`, `--band-pad`, `--masthead-h`, `--ed-narrow-dock`, `--ed-narrow-note`, `--ed-narrow-canvas`); no Foundations token redeclared | `tests/sites/umbrella-visual.test.ts` (the `var()` rule at :500-518) | Umbrella reads `--motion-*`, colours and type from site-kit; no hex/rgb in `globals.css` beyond the two declared lists; **no new bare `var(--x)` outside the emitted set and `localMetrics`**. A per-element property (stagger index) is read only with a fallback, `var(--i, 0)`, which the test's regex does not collect, or replaced by `:nth-child()` delays |
| Viewport-fluid type scale, single-column phone rule for every grid, wide evidence in its own labelled scroller, skip link, `aria-current` nav, visible focus ring, underlined prose links, `@media (prefers-reduced-motion: reduce)` present | same | Layout and a11y rules lanes keep while restyling |
| Editor metrics in archive values; Kids refusal is the whole editor body; palette withdrawn under Kids | same | `/editor` chrome geometry stays |
| No em dash in the launch surface; Download is the hero primary; comparisons not scored | `tests/sites/umbrella-launch-marketing.test.ts` | Home copy and action order |
| Everything below `STORE IDENTITY` byte-identical across both storefront sheets; same component files on both | `tests/sites/catalog-storefronts.test.ts` | lane-catalogs edits both stores in lockstep |
| Storefront reduced-motion block contains `animation-duration: 0.001ms !important` and `animation-iteration-count: 1 !important`, and every `@keyframes name` is used as `animation: name` | same | keep the blanket rule; reference every keyframe with the `animation:` shorthand |
| No text below 11px except named aria-hidden marks; every storefront `font-size` resolves against the store's own sheet, and a `var()` naming a token that sheet does not declare counts as below the floor (`catalog-storefronts.test.ts:126-131,188-199`) | same | the 11px floor (already true on storefronts). Storefront font sizes are rem/px literals at or above 0.6875rem (11px), or `var()` of a token declared in that store's own `globals.css`; **never `var(--type-*-size)`** (site-kit emits those; the store sheet does not declare them) |
| Kids colour-token set is exactly the pinned one; neutrals equal `FOUNDATION_COLORS`; 4.5:1 on every text pairing incl. world gradients | `tests/sites/kids-surface.test.ts` | Kids adds no colour token; motion tokens are fine |
| Kids reducer byte-identical, no import edge | parity test | **never touch `sites/kids/src/lib/kids-activity.ts`** |
| Inspector page strings, verbatim (full list in the block under this table) | `apps/web-shell/test/visual-postpr.test.ts`, `inspector-accessibility.test.ts:234-247`, `dev-server.test.ts` (style/script hashes are recomputed from `inspectorPageHtml`, not pinned) | web shell stays on system colours, light and dark; its focus ring is the pinned `currentColor` ring, not the sites' `--accent-hi` ring; new rules are added beside these strings, never by rewriting them |
| No `opacity:` declaration anywhere in the desktop chrome outside `@keyframes`; inert = painted tokens | `apps/desktop-shell/test/visual-tokens.test.ts:159` | desktop motion uses transform/clip-path/filter in transitions and opacity only inside keyframes |
| The rendered chrome never contains `transform:scale(` | `apps/desktop-shell/test/chrome.test.ts:925` | **desktop never scales**: hover is an instant paint swap, press is the pinned inset shadow, dialogs/palette enter by `translateY` + `clip-path` + keyframe fade, the play ring grows by `clip-path: circle()` |
| Reduced-motion block matches `/prefers-reduced-motion:reduce\)\{[^}]*animation-duration:\.001ms/` | `apps/desktop-shell/test/chrome.test.ts:794` | keep the blanket rule first in that block |
| Pinned 2px left rails: `.scene-entity-identity`, `.assistant-result`, `.overlay-refused .overlay-body`, `.desktop-byo-config-message`; `.desktop-byo-config button{transition:none}`; `.assistant-live i` uses `animation:assistant-bars`; busy `.assistant-progress` has no animation; `--space-3:12px`; `--rail:56px;--left:274px`; `.panel-head` 11px / 32px | `apps/desktop-shell/test/visual-refinement.test.ts` | contract wins over the side-stripe ban for exactly these selectors (§8 DV-X1) |
| Pinned 10px text: `.scene-entity-identity code` (`font-size:10px`, :41) and `.asset-browser-card span` (`font-size:10px`, :92) | `apps/desktop-shell/test/visual-refinement.test.ts` | the only text exceptions to DV-D2's 11px floor. Lanes keep them at 10px and must **not** override them with a later or more specific rule to get around the test; the lift is Request R1 (§11) |
| Pressed controls confirm by paint, never by moving glyphs: `button:not(.is-inert):not(:disabled):not([aria-disabled="true"]):active` and the BYOK `button:not(:disabled):active` contain `box-shadow:inset` | `visual-refinement.test.ts:108-118` | desktop press = instant inset shadow; no scale, no translate on the glyph |
| Storefront and Kids fallbacks: `sites/catalog-*/src/app/loading.tsx` byte-identical across stores and render `<h1>Loading catalogue</h1>` (no attribute on the `h1`), `role="status"`, `aria-live`, `aria-busy`, "No purchase is being made"; umbrella `docs/` and `editor/loading.tsx` and Kids `loading.tsx` render an attribute-free `<h1>` and no `input/form/button/canvas/https`; Kids `loading.tsx` contains no `import`; every `global-error.tsx` renders `<html lang="en">`, an attribute-free `<body>` **and an attribute-free `<h1>`** (`rendered-route-states.test.mjs:63` asserts `/<h1>/`), `role="alert"`, no `https`/`button`/`form`/`input`, and Kids' has no `<a>`; storefront `error.tsx` never echoes the message and links to `/` | `sites/catalog-game/test/rendered-route-states.test.mjs`, `sites/catalog-*/test/catalog-ux-regression.test.ts` | style these through classes on wrappers and sibling elements, never by adding attributes to the pinned `h1`/`body`; in `global-error.tsx` the heading is styled by a descendant selector (`main h1`), and classes go only on `main`, `p` and `a` |
| Spacing table `[4, 8, 12, 16, 24, 32, 44, 72]`; 16px radius Kids-only; float is the only outer shadow; type scale has 10 steps over two families | `packages/site-kit/test/design-tokens.test.ts` | the foundation may not add a spacing step or a new family |
| Hover shade only where the sheet prints one: `accentHi` non-null for `umbrella` and `engine-desktop` only; `resolveSurfaceAccent` returns `accentHi` equal to the accent for `game-assets`/`web-assets`; the store CSS contains `--accent-hi: #E8544E;` and exactly two lines more than the base | `packages/site-kit/test/design-tokens.test.ts:194-205,231-241` | storefront `--accent-hi` stays equal to the accent; storefront hover is the §2.3 `currentColor` state layer (DV-F4 withdrawn) |
| No `import` of any kind in a `global-error.tsx` (`sites/catalog-*/src/app/`, `sites/kids/src/app/`) | `sites/catalog-game/test/rendered-route-states.test.mjs:15-20,60-66` (transpiles each file to CommonJS and evaluates it with only `exports` and `React`; any import throws `require is not defined`) | the root fallback is self-contained: one inline `<style>` element as the first child of the attribute-free `<body>`, or unstyled. Its CSS holds no `url(`, `http`, `<`, `>`, `&` or quotes and declares no custom property; Kids' also holds none of `catalog`, `purchase`, `provider`, `account`, `credit`, `billing`. CSP allows it: storefronts `style-src 'self' 'unsafe-inline'` (`sites/catalog-*/src/middleware.ts:11`), Kids the same in `sites/kids/security-headers.json` |
| `[hidden]{display:none !important}` in the chrome; menus (`chrome.ts:493`), the refusal legend (`:445`), the details mode button (`:547`), dock panels and `.overlay` regions show and hide by the `hidden` attribute; web-shell `#recover`/`#reconcile` toggle `hidden` from script (`inspector-app.ts:852-853,886,907`) | `apps/desktop-shell/test/chrome.test.ts:383-393` with the opacity gate `visual-tokens.test.ts:159-176`; web shell: behaviour | **no exit motion** for these: they vanish at once; entrances are keyframes on `:not([hidden])` (§6.2 rule 4); no script change |

Web-shell inspector strings asserted by the tests (`+` must appear in `inspectorPageHtml`, `-`
must not). The busy-diff rail is cited by location rather than quoted, because the literal is
itself a detector finding (DV-X1); lanes copy it from the test.

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
+ (line 32) the pre[aria-busy="true"] rule: 3px inline-start border width, exact string in the test
+ tab-size: 2; line-height: 1.65
+ code { overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
+ :user-invalid { border-color: #FF4D5E; }
# apps/web-shell/test/inspector-accessibility.test.ts:234-247
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

**Detector rule (hard rule 8) and its only exceptions.** Every touched file must reach 0 detector
findings, except the test-pinned rails above (`inspector-app.ts` `pre[aria-busy]` and the four
desktop selectors). Those are DV-X1; a lane reports them as "pinned, accepted" and adds no new one.

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

## 7. Per-surface briefs

Format: **Changes** · **Accept** (checked at 390×844, 768×1024, 1440×900; desktop at 1280×800 and
1920×1080) · **Motion** (row numbers from §6.3). Every route also inherits its surface's shell
brief. BEFORE shots: `E/before/<surface>/<route>-<width>.png`.

### 7.1 Umbrella shell (applies to every route)

- **Changes:** masthead becomes an opaque `--bg-base` bench with a `--line-soft` `::after` hairline
  (DV-F5, row 19). Nav current item: 2px accent underline indicator + `--fg`; others `--fg-2`.
  Footer column headings 9px mono → UI role (13px Archivo 600, sentence case); footer links 14px
  with ≥44px tap rows on phones (padding only). Buttons lose the inset highlight and drop shadow;
  quiet buttons keep the strong hairline. Every `.eyebrow` above a heading goes: release markers and
  state words become status chips placed per the §5 chip rule (after the H1 or in the action row,
  never on a line above the heading) or join the heading, and any copy a test pins is kept verbatim
  in its new home. `.state` loses its 2px side rail for a 1px tone hairline + tone chip (DV-F6).
  Mono uppercase labels survive only on machine values and table column heads (§3). Spacing and
  type snap to §3/§4.
- **Accept:** detector 0 on `sites/umbrella/src/app`; no `.eyebrow` rendered; no
  `backdrop-filter`; no text <11px; nav current item announced and visible; site `typecheck` and the
  `tests/sites/umbrella-*.test.ts` suites green.
- **Motion:** 1, 2, 3, 4, 5, 17, 19. No route-level entrance outside row 11.

### 7.2 Umbrella routes

| Route | Changes | Accept | Motion |
|---|---|---|---|
| `/` | H1 display-xl; release marker as a Needs-review chip **inline after the H1** (shared wrapping head; wraps under it at 390), never above it; lede 18px; Download (primary, detected platform) then "Open the proof" (quiet), order unchanged. Hero viewport frame: 1px strong line, radius 9, no shadow. Launch proof rail becomes **four linked lines**, one per `LAUNCH_PROOFS` entry: each led by its real artifact (the digest in mono, or a thumbnail where the launch data already carries one; no new asset, no fabricated digest), then the title as the link and the body as one line of prose. Markup stays the existing `dl`; no ruled definition grid. Comparison table: SceneAxi row marked by weight and strong top/bottom hairlines (no accent fill). "Start without an account" links become a two-column link list with trailing arrows. | First viewport at 1440 shows H1 + chip, lede, both actions and the top of the canvas; at 390 the viewport sits under the actions, no overflow; one display-xl per page; no em dash; no chip on its own line above the H1. | 11, 15, 1 |
| `/engine` | Remove all six eyebrows. A state word an eyebrow carried becomes a chip **inline after its heading** or at the head of that section's action row, never on its own line above it; a pure section label is dropped (the heading already names the section). SDK block: archive name as subhead; SHA-256 in a mono field well that wraps (never truncates); verify commands in code wells. Pipeline keeps its numbers (the order carries meaning) as mono step indices on a 1px connector. Desktop-for-Linux: platform states as status chips beside the platform name (copy unchanged). | 0 eyebrows; no chip on a line above a heading; full digest visible at 390; no identical card grid; launch-marketing tests green. | 11, 1, 2 |
| `/profiles` | H1 display-l (balanced, ≤2 lines at 1440). The three profile sections become one comparison at ≥1024 (Game and Web side by side; Kids as an Isolated state panel with **no href**). Profile tone as a 2px *top* edge. Graded-for matrix keeps its scroll region. | Kids renders no anchor and names no Kids host; matrix scrolls in its region at 390; profile-matrix test green. | 11, 1 |
| `/pricing` | H1 display-l. Credit-pack tiers: radius 9 (was 12), no shadow, price in mono tabular display, unit in UI small, tier flag stays data-driven. The four note-cards become **one prose block** (body 16px, ≤68ch) whose figures (credits, amounts) sit inline in mono tabular; each note's existing title leads its paragraph in 600 weight. FAQ markup stays a `dl` but reads as questions and answers: question in the subhead role, answer in body, separated by `--space-6` rhythm, no hairline rows (content stays visible). | No identical 4-card grid and no ruled note grid; tiers equal height at ≥1024; credit figures still from site-kit; "no seat, plan or subscription" copy intact. | 11, 9, 1, 2 |
| `/open` | The live viewport leads at full shell width; "What the running core reports" becomes an instrument readout (`dl`, mono tabular) beside the canvas at ≥1180, under it below. The four explanatory panels become a two-column prose list with subheads. | Canvas visible at first paint in every mode; refusal path still visible; no overflow at 390. | 15, 16, 13 |
| `/docs` | Docs shell keeps its rail; the duplicate four-panel grid becomes one guide list (title, one-line summary, route) with card-link arrows. `.rule-card` loses its accent side rail for a 1px hairline box with an Info chip. TOC titles in the UI role (Archivo 600, sentence case), not mono uppercase. | Detector side-tab gone; rail current item visible; guides reachable by keyboard in order. | 12 (none), 17, 1 |
| `/docs/getting-started` | Article measure 68ch, body 16/1.65, H1 display-l, H2 heading with 32 above / 12 below; steps keep their order; code in field wells. | No line >75ch at 1440; no overflow at 390; docs-page test green. | 12 (none) |
| `/docs/cli` | As getting-started; command table in the evidence-table component with a mono first column; "Free and BYO-AI" as prose + chips, no card. | Commands table scrolls in its region at 390. | 12 (none), 1 |
| `/docs/credits-and-pricing` | As getting-started; undecided policy stays marked undecided with a chip; refund text stays restricted to documented TEST behaviour. | "marks undecided credit policy" test green. | 12 (none) |
| `/docs/faq` | Questions as H2 elements styled in the subhead role with 32px rhythm; answers 16px. | Every question reachable from the TOC; no accordion. | 12 (none) |
| `/docs` loading (`docs/loading.tsx`) | Shell page in the docs measure; H1 in the heading role (no attribute on the `h1`); the existing line as lede; a 2px loading bar under the heading. | Pins in §0 hold; BEFORE `umbrella/docs-loading-*`. | 18 |
| `/login` | Centered 28rem column: H1 display-l; the refusal as a Refused named state panel with its mono reason; fields (when sign-in is active) per Field; submit with loading state. | Refusal key visible; no retry affordance added; login-flow test green. | 13, 5, 10 |
| `/account` | State panel first; balance facts (balance, unit, as-of) as an evidence `dl` with the balance as a mono tabular figure; the four "How credits work here" note-cards become **one prose block** with inline mono figures, each note's title leading its paragraph in 600 weight. | Balance read-only; refusal shows instead of a zero; no ruled note grid; identity tests green. | 13, 16 |
| `/editor` | Refused state: Refused panel with reason, links out. Entitled editor (`editor/_components/web-experience-editor.tsx`): keep every archive metric; panels, overlay notes and Change Review take rows 6, 8, 14, 17; remove its eyebrows. | Editor metrics unchanged; Kids refusal still the whole body; palette withdrawn under Kids; focus contained in the palette. | 13, 6, 8, 14, 17 |
| `/editor` loading (`editor/loading.tsx`) | Masthead stays hidden (editor layout); centered 28rem column like `/login`; H1 in the heading role (attribute-free `h1`); the access line as lede; 2px loading bar under the heading. | Pins in §0 hold ("only after its access decision succeeds" verbatim); BEFORE `umbrella/editor-loading-*`. | 18 |
| `/admin/ledger` | Refused state panel; ledger as an evidence table (amounts right-aligned, mono tabular; append-only stated). | Table scrolls in its region at 390; no write control. | 13, 16 |
| 404 (`not-found.tsx`) | "Not found" becomes a Dormant chip inline after the H1 (display-l), per the §5 chip rule; one primary action back. | Chip text present; detector 0. | 13 |
| Error boundary (`error.tsx`) | "Something went wrong" becomes a Refused chip inline after the H1; digest reference in a mono field; one primary action; no retry (contract). | No message text leaks; reference shown when a digest exists. BEFORE shot is the 404 render with `error.tsx` markup injected (no route throws). | 13 |

### 7.3 Storefronts (lane-catalogs; both stores in lockstep)

Shell: the 7.1 masthead/footer/button/eyebrow rules applied to the storefront skeleton; the store
identity block keeps its accent derivations; delete the grid-line background (`globals.css:911`)
and both side rails (`:1304`, `:1801`), replacing them with a full 1px `--accent-line` frame or a top
edge.

| Route | Changes | Accept | Motion |
|---|---|---|---|
| `/` (Vitrine, Forge) | H1 display-xl; any eyebrow-borne state word becomes a chip inline after the H1 or at the head of the action row, never on a line above it. The "TEST catalog · purchases refuse here" notice moves directly under the hero actions as a compact Needs-review panel (copy unchanged). Inventory: the first listing renders as a lead tile spanning two columns at ≥1024 (data order unchanged), the rest in an even grid. Facets: keep the H2 elements and their text; group them under the existing "All inventory" heading promoted to the subhead role (no new copy); facet labels in the UI role (Archivo, sentence case), not mono uppercase. Apply filters with loading state. | Notice inside the first viewport at 1440 and before the inventory at 390; no chip above the H1; byte-identical rule test green. | 11, 9, 1, 2, 5 |
| `/item/<id>` (`harbour-diorama`, `lantern-prop`) | Digest figure as the media lead with its "not a render" caption; title display-l; price in mono tabular with a TEST chip; editor-link-unavailable and TEST-purchase refusals as named state panels where the buttons would be. Included rows as an evidence `dl`; related listings as a compact list. | Purchase never completes; refusal beside the price; no overflow at 390. | 13, 1, 16 |
| `/publish` | H1 display-l; "What you would earn" becomes **one worked example**: the existing `example` total split into its shares on one line (`total credits → creator share + platform share`, mono tabular figures, creator share in 600 as today's `strong`), with the share rule as one sentence of prose under it; the existing unavailable-preview sentence unchanged. "What submission/listing will require" becomes an **ordered list in body type** (16px, `--space-3` between items), no hairlines or check glyphs; production-closed refusal as a Refused panel. | Shares derived from the same data, no settlement implied, no new figure; detector 0. | 11, 13 |
| 404 | As umbrella 404 with the store accent. | Chip present; one action. | 13 |
| Error boundary (`error.tsx`, both stores) | "Something went wrong" eyebrow becomes a Refused chip inline after the H1; lede kept; `Reference` + digest in a mono field; the one link back to `/` as the primary action; no retry. | Message never echoed; `href="/"` present; BEFORE `catalog-*/error-boundary-*` (404 render with the exact markup injected). | 13 |
| Loading (`loading.tsx`, both stores, byte-identical) | "Read-only catalogue" eyebrow becomes a Dormant chip after the H1 (sibling element; the `h1` stays attribute-free); lede kept; 2px loading bar under the heading block. | `<h1>Loading catalogue</h1>` and both files byte-identical; BEFORE `catalog-*/loading-*`. | 18 |
| Root failure (`global-error.tsx`, both stores) | Replaces the root layout, so no stylesheet reaches it; today it renders unstyled. **No `import` of any kind** (§0: the `rendered-route-states` harness evaluates the file without `require`), so it never imports `./globals.css`. Style it self-contained: one `<style>` element as the first child of the attribute-free `<body>`, holding a CSS string constant with the store sheet's literal colour values (text pairings ≥4.5:1, as in the sheet), the system UI stack (no webfont, since no `url(`), rem sizes at or above 0.6875rem, no custom property, and no `url(`, `http`, `<`, `>`, `&` or quotes. The `<h1>` stays attribute-free (`rendered-route-states.test.mjs:63` asserts `/<h1>/`); style it by a descendant selector (`main h1`); classes go only on `main`, `p` and `a`; `<html lang="en">` and `<body>` stay attribute-free. The literal hex values in the inline block are DV-F12. The two files differ only in the accent value. Renders as the error boundary does: H1 heading role, the no-purchase line as lede, the link back as the primary action with the §5 Link hover, focus-visible and active states written in the same block. Static: no animation, so it needs no reduced-motion block. If a suite refuses the inline block, the fallback stays unstyled and the lane records why. No stylesheet import is wanted, so no Request R3 is raised. | `rendered-route-states.test.mjs` green; §0 pins hold; the source scan in `catalog-storefronts.test.ts:916-1015` finds no new merchandising word; BEFORE `catalog-*/global-error-*` (stylesheets removed; AFTER is captured the same way, so only the inline block styles it). | 13 (static) |

### 7.4 Kids (lane-kids)

Single route `/` with states: choose world, add pieces, play, undo / start over, refusal, grown-ups
disclosure.

- **Changes:** face per DV-K1. At ≥1024 the activity becomes two columns (stage left, choices
  right) so 1440 has no dead field; choices keep 84–98px targets. Choice glyphs stay (activity
  data). Buttons keep 16px radius (Kids-only) and 54/60px heights, with violet state layers. The
  grown-ups disclosure stays outside the child's main flow. The placement motion of row 20 replaces
  `piece-arrive 160ms ease-out` (`globals.css:423`). `play-float` stays as it is: it is product
  content motion under ruling R-3 (DV-K2), so the lane keeps its timing and only checks the R-3
  conditions.
- **Fallbacks:** `loading.tsx` keeps its `intro` section and attribute-free `h1` (no `import` is
  allowed in the file) and takes the activity's intro styling plus a violet 2px loading bar (row 18).
  `global-error.tsx` replaces the root layout and may contain **no `import`** (§0: the catalog-game
  harness evaluates it without `require`), so it never imports `./globals.css`. It is
  self-contained: one `<style>` element as the first child of the attribute-free `<body>`, holding a
  CSS string constant with the literal values of existing Kids tokens (no custom property, so the
  pinned token set is untouched; text pairings ≥4.5:1), the `ui-rounded, system-ui` stack (no
  webfont), no `url(`, `http`, `<`, `>`, `&` or quotes, and none of `catalog`, `purchase`,
  `provider`, `account`, `credit`, `billing` (the test's Kids pattern, case-insensitive). Still no
  link. Its `<h1>` stays attribute-free (`rendered-route-states.test.mjs:63` asserts `/<h1>/`) and
  is styled by a descendant selector (`main h1`); classes go only on `main` and `p`. The literal
  hex values in the inline block are DV-F12. It renders the calm intro face: heading, one plain
  sentence, no action; static (no motion).
  The Kids CSP allows the block (`style-src 'self' 'unsafe-inline'`, `sites/kids/security-headers.json`).
  If the suite refuses it, it stays unstyled and the lane records why. BEFORE `kids/loading-*`,
  `kids/global-error-*`.
- **Accept:** kids-surface suite green (token set, 4.5:1, reducer untouched); no new colour token; no
  network request; `play-float` meets every R-3 condition (only under `.is-playing`, transform only,
  no bounce, static under reduced motion, never flashes); no `piece-arrive` timing remains; the
  catalog-game `rendered-route-states` fallback test green.
- **Motion:** 20, 1, 2, 3, 10, 18 (loading only).

### 7.5 Web shell inspector (lane-webshell; `inspector-app.ts` page)

States: idle, reviewing, busy, applied, rejected, refused, recovery pending, authority uncertain; OS
light and dark; forced colors.

- **Changes:** keep every pinned string (§0, full list). Focus stays the pinned
  `outline: 2px solid currentColor` ring (no `--accent-hi`). Prose in `system-ui` (DV-W1); H1 1.375rem; the
  project root line as a mono chip. Inputs mono (they hold JSON). Propose is the primary (inverted
  system colours: `CanvasText` fill, `Canvas` label, so it stays theme-correct); Accept/Reject
  outlined; recover/reconcile keep their `hidden` logic, enter with a row-10 keyframe on
  `:not([hidden])` and leave instantly (§6.2 rule 4). Phase becomes a status pill; `#note` stays
  the `role=status` live line. The diff `<pre>` is the hero: larger well, 16px padding, tabular
  figures, max 72rem. Footer 13px secondary prose.
- **Accept:** web-shell tests green; detector shows only the pinned `pre[aria-busy]` rail; light and
  dark shots of idle, reviewing, rejected, refused and focus at 390/768/1440 (BEFORE has all 30:
  `E/before/web-shell/inspector-<state>[-light]-<width>.png`); focus ring visible in both themes.
- **Motion:** 1, 2, 3, 5, 10, 14 (with local token copies and a reduced-motion block).
- **Out of scope:** `account-panel.ts`, `assistant-panel.ts`, `open-path-view.ts` render no markup.

### 7.6 Engine Desktop chrome (lane-desktop; `apps/desktop-shell/src/**` except `visual-tokens.ts`)

States to cover: title bar + menu bar; mode rail (build, sculpt, compose, animate, run, ship,
plugins); left dock / scene tree; view tabs; viewport (inert note, live, refused); bottom dock
(changes, evidence, console); inspector; assistant (open, closed, denied/Kids lock, thinking;
ask/build/agent; BYO/hosted routes); status bar; command palette; outcome dialog; profile switch
(game/web/kids); sculpt running sweep; compact-tier drawers; window-below-minimum refusal.

- **Changes:** `--r-panel` 18→16 (DV-D1). Overlay card and drawer shadows lose the 60px blur for
  the tight float shadow (DV-D4). Text under 11px rises to 11px (DV-D2) except the two pinned 10px
  selectors (§0), which stay 10px and are not overridden. Remove the colour transitions in
  `button{transition:…}` (instant paint; press keeps the pinned `box-shadow:inset` with no glyph
  motion; no `scale()` anywhere, DV-D5). Emit `--motion-*` from `MOTION` in `:root` (no `scale.*`).
  The mode rail gets one cyan indicator that glides between modes (`translateY`); dock and view tabs
  get the same underline indicator (`translateX` + `clip-path`, row 17). Palette
  and outcome dialog get translate + clip-path + keyframe-fade entrances (row 8). Menus, the
  refusal legend, palette, outcome dialog, dock panels and drawers animate their entrance only, as
  keyframes on `:not([hidden])`; every exit is instant and no script changes (§6.2 rule 4). Every pinned
  rail, metric and refusal stays.
  **Existing loops (ruling R-2).** Write
  `.assistant-live i{…animation:assistant-bars var(--motion-duration-loop) var(--motion-ease-out-quart) infinite}`
  (today `0.9s ease-in-out`, `chrome.ts:1493`); this keeps the pinned substring
  `animation:assistant-bars` (`visual-refinement.test.ts:68`) and the per-bar `animation-delay`
  stagger. Write `.sculpt-sweep{…animation:sweep var(--motion-duration-loop) var(--motion-ease-out-quart) infinite}`
  (today `1.1s linear`, `:1448`). `assistant-bars` animates only opacity inside its keyframes and
  `sweep` only transform. Under reduced motion both are already static: the blanket rule
  (`chrome.test.ts:794`) and `.sculpt-sweep,.assistant-live{display:none}` in the same block
  (`chrome.ts:1655`) stop them, so no new rule is needed.
  **Existing entrances.** The three `rise` entrances move onto tokens: `.sculpt-progress`
  `rise .3s ease-out` (`:1444`) becomes `var(--motion-duration-panel) var(--motion-ease-out-expo)`
  with `--motion-distance-md`; `.assistant-result` `rise .16s ease-out` (`:1501`) becomes
  `var(--motion-duration-micro) var(--motion-ease-out-quart)` with `--motion-distance-sm`;
  `.overlay-card` `rise .16s ease-out` (`:1562`) takes the row 8 entrance (panel duration, expo,
  `--motion-distance-md`, clip-path). The `rise` keyframe's off-token `translateY(7px)` (`:1596`)
  becomes `translateY(var(--motion-distance-sm))` or `-md` per use (one keyframe per distance, or
  a distance custom property read inside it). No plain `ease-out`, `ease-in-out` or `linear`
  remains in the chrome.
- **Accept:** desktop-shell tests green (chrome, visual-tokens, visual-refinement,
  control-accounting); no `opacity:` outside keyframes; no `transform:scale(` in the rendered
  chrome (`chrome.test.ts:925`); both 10px pins untouched; detector shows only the pinned
  `.scene-entity-identity` rail; shots of every state above at 1280×800 and 1920×1080.
- **Motion:** 1–8, 10, 14, 15, 16, 17, 18.

### 7.7 Packaged Linux renderer (lane-desktop; `desktop/linux/src/renderer/**`, `chrome-document.ts`, `byo-configuration-view.ts`)

- **Changes:** viewport mount/refusal lines (`openPathLine`, runtime report, rarity evidence) take the
  status-line component (row 10) and the overlay chip style; the BYOK configuration surface's
  installed styles adopt Field, Button and named-state components, keeping its pinned rails and
  `button{transition:none}`; assistant viewport and playback report read the §6 tokens from the
  chrome's `:root`.
- **Accept:** `desktop/linux` build, its tests and `check:renderer` green; CSP unchanged (no new
  inline script); Electron shots at 1280×800 / 1920×1080 of the first-run refusal and, if a project
  is opened, the mounted viewport and BYOK panel (BEFORE has only the first-run state; see
  BASELINE.md).
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

---

## 9. Ownership (every file has exactly one owner)

| Owner | Files (globs) | Notes |
|---|---|---|
| **director** | `docs/redesign/DIRECTION.md`, `docs/redesign/BASELINE.md`, `E/before/**`, `E/final/**` | no product code |
| **foundation** | `packages/site-kit/src/design-tokens.ts`, `state-panel.ts`, `commerce-notice.ts`, `change-review.ts`, `access-states.ts`, `site-element.ts`; `apps/desktop-shell/src/visual-tokens.ts`; `docs/design-foundations.md`; `docs/engine-desktop-surface.md` (director assignment: it is the Cinematic Pro record); `PRODUCT.md`; `DESIGN.md`; `.impeccable/**` | lands §6.1 tokens and the DV-F*/DV-D* records **first**; lanes build on it |
| **lane-umbrella** | `sites/umbrella/src/app/**` (incl. `_components/**`, `globals.css`, `error.tsx`, `not-found.tsx`, `docs/loading.tsx`, `editor/loading.tsx`, editor and docs `_components`), `sites/umbrella/VISUAL-EVIDENCE.md`, the Playwright snapshot directories `sites/umbrella/test/*.visual.spec.ts-snapshots/**` (Playwright's default snapshot path for `testDir: "./test"` in `sites/umbrella/playwright.config.ts`; none exist today because no spec calls `toHaveScreenshot`) | the spec sources themselves are frozen (owner: test-owners). **Owned, read-only (no visual surface):** `api/**` (every `route.ts` and `checkout-handler.ts`), `_session.ts`, `robots.ts`, `sitemap.ts`, `editor/_components/project-persistence.ts`. The lane never edits them; owning them grants no behaviour change |
| **lane-catalogs** | `sites/catalog-web/src/app/**`, `sites/catalog-game/src/app/**` (incl. `error.tsx`, `global-error.tsx`, `loading.tsx`) | both stores in one change |
| **lane-kids** | `sites/kids/src/app/**` (incl. `global-error.tsx`, `loading.tsx`) | never `sites/kids/src/lib/**` |
| **lane-webshell** | `apps/web-shell/src/**` except `dev-server.ts` and `protocol-client.ts` | visual work is `inspector-app.ts`. It reads those two files but never edits them: `dev-server.ts` recomputes its CSP style/script hashes from `inspectorPageHtml`, so restyling the page needs no change there |
| **lane-desktop** | `apps/desktop-shell/src/**` except `visual-tokens.ts`; `desktop/linux/src/renderer/**`; `desktop/linux/src/lib/chrome-document.ts`; `desktop/linux/src/lib/byo-configuration-view.ts` | |
| **test-owners** (frozen: no lane edits; changes only through Requests) | everything else, in particular `tests/**`; every `*/test/**` **except** `sites/umbrella/test/*.visual.spec.ts-snapshots/**` (lane-umbrella); every `*.test.ts`, `*.spec.ts` source; `sites/*/src/lib/**` (incl. `sites/kids/src/lib/kids-activity.ts`); site `package.json`s and lockfiles; `packages/site-kit/src/**` beyond the six foundation files; `apps/web-shell/src/dev-server.ts`; `apps/web-shell/src/protocol-client.ts`; `desktop/linux/src/**` beyond the lane-desktop paths; all other `docs/**`; all other packages | a lane that needs a change here writes it under **Requests** in its lane report |

---

## 10. Sequencing, verification, reporting

1. **foundation** lands tokens and records, then runs the site-kit and desktop-shell suites and
   `pnpm build` (cwd R).
2. Lanes run in parallel on top of it. Each lane loads impeccable, runs
   `node /home/devuser/.agents/skills/impeccable/scripts/context.mjs --target <path>` (cwd R), reads
   `craft-floor.md` plus the references for the commands it uses, implements its brief, then does
   one batched screenshot round at the required sizes into `E/after/<lane>/`, one fix batch and one
   confirm round.
3. Proof per lane: detector 0 on touched paths (DV-X1 excepted); the touched packages' existing
   suites exit 0; `pnpm build` (plus the site's own `typecheck`/`build` for sites); screenshots.
   `pnpm gate` is never weakened.
4. Lane report (plain, short): what changed per route/state, shots, commands run with exit codes,
   detector result, deviations applied, Requests. Never claim a check that was not run.
5. Director final pass: `E/final/<surface>/` captures and a critique against this file.

**Not a lane decision:** storefront activation and real prices; Kids launch; any change to refusal
copy; new interactive behaviour (copy buttons, accordions, search, scroll-spy). These are behaviour
and need their owners.

---

## 11. Requests (director → test-owners)

| Id | To | Request | Why |
|---|---|---|---|
| R1 | owner of `apps/desktop-shell/test/visual-refinement.test.ts` | Change the `font-size:10px` expectations for `.scene-entity-identity code` (:41) and `.asset-browser-card span` (:92) to `font-size:11px` | closes the DV-D2 exception; until then both stay 10px and no lane works around them |
| R2 | owners of `visual-refinement.test.ts` and `apps/web-shell/test/visual-postpr.test.ts` | Allow a non-rail busy/selection mark in place of the pinned 2px/3px left rails | closes DV-X1 |

---

## Revision log

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
