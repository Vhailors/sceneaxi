# lane-catalogs report (Vitrine `sites/catalog-web`, Forge `sites/catalog-game`)

Date 2026-10-04. Register: product. Sources: `DIRECTION.md` v5 §0, §2–§7.3, `RULINGS.md` R-1..R-5,
`reviews/direction.md` advisories (fallback `<h1>` attribute-free, DV-F12 recorded). Impeccable
references read: craft-floor, animate, layout, polish; `context.mjs --target sites/catalog-web/src/app`
run (it resolves no PRODUCT/DESIGN for the site root, as §0 notes, so DIRECTION was the brief).
Both stores were edited in lockstep: the shared CSS skeleton and every `_components/*` file are
byte-identical; the stores differ only in the STORE IDENTITY block and existing store copy.

## Files

Same set in both `sites/catalog-web/src/app/` and `sites/catalog-game/src/app/`:

| File | Change |
|---|---|
| `globals.css` | Skeleton below STORE IDENTITY rewritten (identity block untouched). Removed grid-line background, both side rails, glass masthead, button inset highlight/glow, eyebrow/kicker/micro labels. Added state layers, press scale, focus halo, painted disabled, `aria-busy` bar, tone frames + chips, evidence `dl`, worked example, ordered steps, skeleton, lead listing, motion keyframes, reduced-motion block. |
| `layout.tsx` | Archivo loads the `wdth` axis (DV-F11); nav `aria-current` from the middleware's `x-sceneaxi-route` header; footer headings `.micro` → `.footer-heading` (UI role). Async layout (reads headers). |
| `page.tsx` | Kicker → chip after the H1 in a shared head; TEST notice moved under the hero actions (level-2 Needs-review panel, copy unchanged); hero shelf with lead tile; "All inventory" promoted to the rail heading (Forge: the existing "All inventory · N…" sentence split into heading + sentence, no new words); Apply filters is a quiet button with `FormBusy`; empty state gets its own class (the old `.results > [role=status]` rule also hit Forge's results head). Query logic untouched. |
| `item/[itemId]/page.tsx` | Unboxed side column: title (display-l), mono price + TEST chip, price and availability as evidence `dl`s, editor action, then the editor-link and commerce refusals as named panels where a buy button would be; figure wrapped in `<figure>`/`<figcaption>` ("not a render" caption); record rows as evidence `dl`; related listings as a compact list; ✓/— glyph spans removed. |
| `publish/page.tsx` | Eyebrow → `.tag` after the H1; earnings = one worked line (`100 credits → 70 creator share + 30 platform share`, from the same `example.value.share`); requirements `ol.steps`; production refusal tone warn → deny (Refused panel), level 2. |
| `not-found.tsx`, `error.tsx`, `loading.tsx` | Eyebrow → status chip after the H1 (Accent / Refused / Dormant) + 2px tone mark; `error.tsx` reference in a mono field; loading adds a delayed 2px bar and three final-size skeleton blocks (`aria-hidden`). `<h1>Loading catalogue</h1>` attribute-free; both stores byte-identical. |
| `global-error.tsx` | One inline `<style>` (first child of the attribute-free `<body>`), no import, no custom property/quotes/url; `main h1` styled by descendant; classes only on `p` and `a`. Literal copies of sheet values (DV-F12): `#07080A #EDEFF2 #8A929C #FF4D5E` + store accent (`#3FB8C9` / `#E8544E`). Static, no animation. |
| `_components/state-panel.tsx` | Status chip (`model.status.label`) after the heading in `.state-head`; `data-status`; optional `level` prop passed to `createStatePanelModel`. |
| `_components/digest-figure.tsx` | `sigil-grid` span → `sigil-scan` (aria-hidden read line); `data-sigil` hook. |
| `_components/listing-card.tsx` | `card-compact` class for the related list; refusal line class. |
| `_components/commerce-notice.tsx` | Mode/account/registry lines grouped in `.state-meta`. Copy and model untouched. |
| `_components/form-busy.tsx` (new, both stores) | Client marker: on native submit of its GET form it sets `aria-busy` on the submit button; `pageshow` clears it. Reads/sends nothing. |
| `opengraph-image.tsx`, `family-bar.tsx`, `listing-tile.tsx` | Unchanged (family-bar indicator is CSS only). |

## Animation table (all on site-kit `--motion-*` tokens)

| Interaction | Motion | Reduced-motion fallback |
|---|---|---|
| Listing tile / card hover | media `translateY(-distance-sm)`, mark `scale(var(--media-zoom))` 1.04 over panel/expo, 8% state layer on media, frame → `--accent-line`, title underline | distances 0, `--media-zoom: 1`; layer + frame colour remain |
| Tile / card press | link `scale(--motion-scale-press)` over press/quart, layer 12% | scale token 1; layer remains |
| Buttons (hover/press/focus/disabled/loading) | `::before` currentColor layer 8% (press 10% on accent fill, 12% quiet); press scale; outline instant + `::after` halo fade (press duration); disabled painted dashed, no motion; `aria-busy`: 2px bar `cat-progress` loop/quart after `--motion-delay-loading` | scale 1; bar static at 40% (`animation:none; transform:none`) |
| Nav current item | 2px accent indicator rendered in place (`aria-current`); hover/press state layer | same, no movement |
| Family-bar selection indicator | current: accent 2px line drawn once `cat-draw` state/quint; linked sibling hover: neutral line draws in via `clip-path` transition micro/quart, retracts on leave | indicator present, no draw; hover line jumps (`transition:none`) |
| Masthead hairline | `::after` opacity 0→1, `animation-timeline: scroll()` over 24px (inside `@supports` + no-preference) | line at opacity 1 |
| Home hero entrance (row 11) | head, lede, actions `cat-rise-lg` route/expo, 40ms stagger, 3 items | static |
| Hero shelf stagger (row 9) | `cat-rise-sm` panel/expo, `:nth-child` delays capped at `--motion-stagger-max` | static |
| Item media / digest reveal | mark `cat-reveal` (clip-path top→bottom) under a 1px accent read line `cat-scan` (translate + fade), route/expo, once; frame, chips, stats are visible throughout | no reveal, line stays invisible |
| State panel / commerce notice tone (rows 10, 13) | 2px tone mark under the title draws once `cat-draw` state/quint | mark present, no draw |
| 404 / error / loading heads (row 13) | 2px tone mark draws once | present, no draw |
| Publish entrance (row 11) | head, lede, first section rise, 40ms stagger | static |
| Fields | hover line → `--fg`, focus ring + accent line, invalid red line (instant paint) | same |
| Loading route (row 18) | 2px bar + skeleton sheen, loop/quart after 300ms | static bar 40% + static blocks + visible heading |
| Global error | static (no motion) | n/a |

Five-state n/a notes: chips, panels, evidence rows, skeleton are not controls. Fields have no
active/disabled/loading here (no field is ever disabled; the form's button carries `aria-busy`).
**Publish has no form** (display-only by contract), so "publish form focus/validation/submit-loading/
step feedback" is n/a there; the same treatments were applied to the only real form, home's filter
form. There is no gallery (one figure per listing), so the item media transition is the digest reveal.
Prices never change client-side, so row 16 is n/a.

## Deviations applied

DV-F1, F2, F5, F6, F9, F10, F11 (wdth 104 via `font-stretch`), F12 (fallback literals, above).
Lane-level notes (no captain fact changed beyond these):
- Pressed state layer on accent-filled buttons is 10%, not 12%: label contrast on Forge red is 4.64:1 at 10%, 4.48:1 at 12% (hover 8% 4.81:1; Vitrine 6.97:1 pressed).
- Home results-column H2s use Heading (24px), not Display L: they sit in the narrow results column beside the rail.
- Hero and detail split to two columns from 64rem (was 48rem): at 768 a 53px display H1 in a 348px column ran 7 lines.

## Evidence (`/home/devuser/Documents/Reports/sceneaxi-redesign/after/catalogs/`)

Headless Playwright Chromium 1223 (no browser-tab tool in this session), production `next start`
on 3102/3103, full-page, DPR 1. Script `capture.mjs`, probe `probe.mjs` in the same folder.
- `{web,game}-{home,item-<id>,publish,404,home-noresults,home-refused,error-boundary,loading,global-error}-{390,768,1440}.png` (54) + `-1440-reduced.png` per route (18); `error-boundary`/`loading` = real component SSR markup injected into `main`; `global-error` = SSR markup with every stylesheet removed (same method as BEFORE).
- `{web,game}-state-{tile-hover,apply-focus,apply-busy,field-hover}-1440.png` (8).
- `metrics.json`: 72 shots, overflow 0, console errors 0, text < 11px 0. Sub-44px targets at 390: only the inline sentence link "Read publishing requirements" (WCAG inline exception).
- `attr-counts-{before,after}.txt`: data-*/id=/aria-/role= counts; no file lower in any category.
- Probe facts: TEST notice at y 621–771 (web) / 554–703 (game) at 1440 (inside 900px), and before inventory at 390; no chip above an H1; hero H1 66px at 1440, 40px at 390, `font-stretch: 104%`; lead listing spans two tracks at 1440.

## Checks (cwd R unless noted; TMPDIR set under $HOME because /tmp is full)

| Command | Exit |
|---|---|
| `sites/catalog-web`: `pnpm exec tsc --noEmit -p .` / `pnpm build` | 0 / 0 |
| `sites/catalog-game`: `pnpm exec tsc --noEmit -p .` / `pnpm build` | 0 / 0 |
| `pnpm check:sites` | 0 |
| `pnpm exec vitest run tests/sites/catalog-storefronts.test.ts tests/sites/site-seams.test.ts tests/sites/site-kit-component-collapse.test.ts` | 0 (409 passed) |
| `node --test` on `sites/catalog-web/test/{catalog-ux-regression,item-session-wiring}.test.ts`, `sites/catalog-game/test/{catalog-ux-regression,item-session-wiring}.test.ts`, `sites/catalog-game/test/rendered-route-states.test.mjs` | 0 each (17, 15, 13, 15, 4 pass) |
| `pnpm exec eslint --max-warnings 0 <26 touched tsx files>` | 0 |
| `detect-antipatterns.mjs --json sites/catalog-web/src/app sites/catalog-game/src/app` | 0, `[]` |

Not run by this lane: full `pnpm gate`, full `pnpm lint`, root `pnpm build`, e2e goldens (no catalog
golden imports these files). Servers on 3102/3103 were stopped.

## Requests

1. Ops/orchestrator: `/tmp` (16G tmpfs) is 100% full of other runs' dirs (`sceneaxi-comprehensive-owned-*`, `tft-combat-successor-*`, `.pnpm-store`, `sceneaxi-vitest-*`, `sceneaxi-gate-fixture-*`); editor tools fail with ENOSPC. Not cleaned by this lane.
2. Owner of `sites/catalog-*/src/lib/site-config.ts` (test-owners): `heroKicker` is stored in capitals, so it renders as a capitalised chip; a sentence-case value would let it take the UI role.
3. Observation for the item-route owner (not compared with baseline): `curl` of `/item/<unknown>` on `next start` returned HTTP 200 with the not-found render.

## Final polish (2026-10-05, `reviews/final.md`)

Applied by the polish node, the same in both sheets and both pages. Visual and interaction only.

| Fix | Change |
|---|---|
| 5 (blocking) | `globals.css`: prose, state, rail-note, footer and `.catalog-controls` links get `:active` = 12% `currentColor` layer + 2px `currentColor` underline; they never move. |
| 6 (blocking) | `globals.css`: `.storemark:hover .storemark-glyph::after` takes the umbrella's 1px nudge from `--motion-distance-sm`; `.storemark:active .storemark-glyph` takes `--motion-scale-press`; transform transitions on the micro/press tokens. The `--fg` hover colour rule stays. Under reduce both resolve to identity. |
| 9 (blocking, slop) | `page.tsx`: the `heroKicker` chip is no longer rendered (the H1 says the same words). The string stays in `site-config.ts`; the orphaned `.hero-chip` rule is removed. |
| 13 (advisory) | `.chip` gets `min-height: 24px` and `--space-2` gap (24px tall, as the umbrella); `.button-lg` label 15px, as the umbrella. Store chips keep 0.08em tracking because they are uppercase. The other two off-scale 6px values (`.sigil-br`, `.detail-stats`) take `--space-2`; token audit 0 off-scale. |
| 14 (advisory) | `p.reason, figcaption.reason` use `--store-ui`; `code.reason` stays mono. |

Evidence (`next start` 3102/3103; PNGs not viewed by eye): re-captured `E/after/catalogs/{web,game}-{home,item-<id>,publish}-{390,768,1440}.png` + `-1440-reduced.png`; data `E/after/polish/data/verify-stores.json`: 0 `.hero-chip`, overflow 0, storemark hover changes the glyph transform and press scales it to 0.97, footer/prose `:active` adds the 12% layer on every route.

Checks (cwd R, TMPDIR `/home/devuser/.cache/sxg2448052`, removed afterwards; logs in `E/after/polish/logs/`):
- `pnpm gate`: exit 1 at `pnpm test` with only the allowed baseline failures: the 16 `desktop-editor-command-forms-golden` tests and 2 `asset-preparation-bounds` deadline tests (timing; that file passes 12/12 alone). Steps before `test` passed. The two steps after it were run separately: `node --test scripts/check-contracts.test.mjs` exit 0; `pnpm lint` exit 1 with 255 errors in exactly the 17 R-5 files.
- `vitest run tests/sites packages/site-kit/test tests/e2e/editor-catalog-intake-golden.test.ts`: 1324 passed. `vitest run apps/desktop-shell`: 244 passed. `tsc -b apps/desktop-shell`: 0. `next build` umbrella, catalog-web, catalog-game: 0.
- `eslint --max-warnings 0` on the touched tsx/ts files: 0. Detector on every touched file: 0 findings.

## Final polish, round 2 (2026-10-05, `reviews/final.md` round 2)

Applied by the polish node, the same in both sheets and both pages (everything below STORE IDENTITY is still byte-identical). Visual and interaction only.

| Fix | Change |
|---|---|
| 2 (blocking) | `globals.css` `--gutter` 1.25rem → 1rem (16px below 60rem, as the umbrella phone gutter); the DV-F12 literal copy in `global-error.tsx:14` follows: `padding:4.5rem 1rem`. Measured text left edge 16px at 390 and 768 on home, item and publish. |
| 4 (blocking) | `.chip` `text-transform: uppercase` → `none` (sentence case on all three sites); tracking stays 0.08em, as §3 Label. Authored capitals stay (`TEST`). |
| 10 (advisory) | `page.tsx`: the `.hero-head` wrapper is gone; the H1 (id and text unchanged) sits directly in `.hero-copy`. The `.hero-head` rule is removed and the hero entrance moves to `.hero h1`. |
| sweep | States: `.crumbs a` joins the prose `:active` rule (12% layer, 2px underline); the revealed `.skip-link` gets an 8% hover layer and a 12% press layer with the press scale. Token audit: 0 off-scale. |

Evidence (`next start` 3102/3103, production builds 04:02/04:03; PNGs not viewed by eye): `E/after/catalogs/*` re-captured by `E/after/catalogs/capture.mjs` (72 shots, overflow 0, console errors 0), plus `{web,game}-{home,item-<id>,publish}-{390,768,1440}.png` and `-1440-reduced.png` from `E/after/polish/r2/scripts/sites.mjs`. Data: `E/after/polish/r2/{sites,states}.json`.

Checks, round 2 (cwd R, TMPDIR `/home/devuser/.cache/sxg3145437`, removed afterwards; logs in `E/after/polish/r2/logs/`):
- `pnpm gate`: exit 1 at `pnpm test` with only the 16 allowed `desktop-editor-command-forms-golden` failures (312 of 313 files passed). Steps before `test` passed. The two steps after it, run separately: `node --test scripts/check-contracts.test.mjs` exit 0; `pnpm lint` exit 1 with 255 errors in exactly the 17 R-5 files (same list as `E/lint-review.log`).
- Touched suites: `vitest run tests/sites apps/web-shell/test apps/desktop-shell/test packages/site-kit/test` 1743 passed; `vitest run apps/desktop-shell/test desktop/linux/test` 282 passed; `node --test` storefront `catalog-ux-regression` + `item-session-wiring` 32 + 28 passed; `rendered-route-states.test.mjs` 4 passed; `check:sites`, `check:desktop` OK; `tsc --noEmit` umbrella, catalog-web, catalog-game 0.
- `eslint --max-warnings 0` on every touched ts/tsx file: 0. Detector on every touched file and on `sites/*/src/app`, `apps/web-shell/src`, `apps/desktop-shell/src`: 0 findings apart from the two contract-held ones (fix 14).
- `pnpm build` in umbrella, catalog-web, catalog-game ran last (04:01, 04:02, 04:03); no source is newer, so each `.next` holds the production build of this tree. All servers stopped; ports 3101-3104, 3106, 5181 free.
