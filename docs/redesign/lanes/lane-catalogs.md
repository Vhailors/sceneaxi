# lane-catalogs report (Vitrine `sites/catalog-web`, Forge `sites/catalog-game`), port run on main

Date 2026-10-05. Base: R = branch `redesign-impeccable` on `origin/main` `dffefbab`. Register: product.
Sources: DIRECTION v6 §0.3, §2–§6, §7.3, §8 (DV-F*, DV-P1/P2/P3/P11/P12), §8.2 store facts, RULINGS R-1, R-8, R-9.
Impeccable: `context.mjs --target sites/catalog-web/src/app` run with cwd R (it finds no PRODUCT/DESIGN at the site
root, so DIRECTION was the brief); references read: SKILL, craft-floor, animate, layout, polish.
v5 visual result ported onto main's markup by hand; no OLD file was copied over a main file.
Both stores were edited in lockstep: everything below STORE IDENTITY and every `_components/*` file is byte-identical;
the stores still differ only in the identity block, the store copy main already had, and the DV-F12 accent literal.

## Re-run 2026-10-05: lanes.md lane-catalogs fixes

- Item 1 (blocking), closed: the seven colour transitions were deleted from both sheets at the reviewed lines
  (`html body a` text-decoration-color, `a.family-item` color, `.storemark` background-color, `.nav a` color,
  `.catalog-controls select` border-color, `.slot-plate` border-color, `.slot-title` text-decoration-color). Those paints
  are now instant; the `::before`/`::after` state layers (opacity) and clip-path indicators still carry the motion.
  Probe `probe-transitions.mjs` -> `probe-transitions.json` (summary `work/probe-transitions.txt`): every element and
  its `::before`/`::after`, at rest and with tile, card, nav, storemark, select, slot, button and link hovered plus the
  search field focused, on all 6 store routes x 2 stores x 390/1440 (24 route runs). Animated computed
  `transition-property` values found: `transform`, `opacity`, `clip-path` (and Chromium's `-webkit-clip-path` alias).
  Disallowed: none.
- Item 2 (advisory), closed: `catalog-game-state-field-invalid-1440.png` re-captured. Forge's main markup does not set
  `aria-invalid` on refusal (Vitrine's does), so the capture sets `aria-invalid="true"` on `#catalog-sort` for the shot
  (paint proof only; markup unchanged) and scrolls the control into view. It no longer matches any other shot.
- Found during the per-shot audit and fixed (both stores, lockstep): on Forge the two smaller lead plates under the first
  (171-185px wide at 390/768/1440) clipped the 179px `Record mark · d167…aa5a` legend at the plate edge. `digest-figure.tsx`
  wraps the label text in `<span className="plate-legend-label">` (text unchanged); the sheet makes `.plate-lead` an
  inline-size container and, at `max-width: 15rem`, hides that label visually (sr-only pattern, still in the accessible
  text, full digest in `title`), so the narrow plate shows the digest alone like the card digest chip. A first try with
  `font-size: 0` was reverted because `tests/sites/catalog-storefronts.test.ts` (11px micro floor) caught it.
- The sheets got the same edits at the same lines; they still differ only in the header comment and the STORE IDENTITY
  block (30 diff lines, as before). `digest-figure.tsx` is byte-identical across stores.
- All 72 route shots and 18 state shots were re-captured from rebuilt `next start` servers on 3202/3203 after the fixes.

## Files (same set in both stores)

| File | Change |
|---|---|
| `globals.css` | Skeleton below STORE IDENTITY rewritten from main's sheet with the v5 vocabulary (identity block unchanged). Removed: glass masthead, grid-line plate and slot backgrounds, both side rails (`.state::before`, empty-state `border-left`), share-figure rail, kicker/eyebrow/`.micro` labels, button inset highlight and glow ring, float shadows on bordered media, hero metric numbers. Added: state layers, focus halo, painted disabled, `aria-busy` bar, tone frames + chips, evidence `dl`, inline facts line, worked line, ordered steps, skeleton, lead listing, closing slot row, motion block, reduced-motion block. Main pins kept (`--sticky-top`, `216px` rail, sticky bounds, `.catalog-controls` areas, forced-colors focus, `--micro`). |
| `layout.tsx` | Serves `foundationsMotionCss()` in a second `<style data-sceneaxi-motion="v6">` (DV-P1). Footer column headings `.micro` → `.footer-heading` (UI role). |
| `page.tsx` | `heroKicker` chip not rendered (string stays in site-config); H1 gets `id="hero-heading"` + section `aria-labelledby`; TEST notice moved under the hero actions (level-2 Needs-review panel, copy unchanged); facts `ul` → inline evidence `dl`; rail heading + intro in `.rail-lead` (Forge: "All inventory · N…" split into heading + sentence, no new words); Apply filters → quiet button + `FormBusy`; empty state class `results-empty`; share figure → worked line `50% creator share + 50% platform share` from `CREATOR_SHARE_RULE`; pricing paragraph `lede` → `prose`. Query logic untouched. |
| `item/[itemId]/page.tsx` | Buy column unboxed; price headline mono tabular + TEST chip; price options `ul` → evidence `dl` under a UI-role block title; record summary and fixture record → evidence `dl` (✓ glyphs removed); sections get `aria-labelledby`; state panels in the main column take level 2. Refusals stay where the buttons would be. |
| `publish/page.tsx` | Eyebrow → `.tag` after the H1 in `.page-head`; earnings `dl` → one worked line (`100 credits → 50 you receive + 50 platform receives`, same `example.value.share`); share rule as prose; requirements `ol.steps` (body type, no rules, no number circles); production refusal warn → deny, level 2. |
| `not-found.tsx`, `error.tsx`, `loading.tsx` | Eyebrow → status chip after the H1 (Accent / Refused / Dormant) + 2px tone mark; error reference in a mono field, home link primary; loading adds a delayed 2px bar and three final-size skeleton blocks (`aria-hidden`), `<h1>Loading catalogue</h1>` attribute-free. |
| `global-error.tsx` | One inline `<style>` first in the attribute-free `<body>`, no import (DV-F12 literals: `#07080A #EDEFF2 #8A929C #FF4D5E` + `#3FB8C9` / `#E8544E`). Static. |
| `_components/state-panel.tsx` | Status chip after the heading, reason code on its own line in the head, `data-status`, optional `level` prop. |
| `_components/digest-figure.tsx` | `plate-grid` span removed (grid ban); `data-sigil`; detail variant gets the `plate-scan` read line; legend label in `span.plate-legend-label` (re-run, text unchanged). Root classes unchanged (`plate plate-*`, pinned). |
| `_components/listing-card.tsx` | `card-compact` li class; card prints the model label in `.card-price` (fixes 2 main baseline failures); refusal line `card-refusal`. `ListingPrice` export kept. |
| `_components/publish-slot.tsx` | li `card card-slot`; `.micro` label → Accent chip after the title. |
| `_components/test-pipeline-proof.tsx` | Rows: state, then chip (chip after heading); "Step 0N" counter span removed (the `ol` carries order). |
| `_components/form-busy.tsx` (new, both) | v5 loading marker re-done as a callback ref (no hook import, so `maintenance-compat`'s loader runs it): native submit sets `aria-busy` on the submit button; `pageshow` clears it. Reads and sends nothing. |
| Not changed | `store-nav.tsx`, `family-bar.tsx`, `listing-tile.tsx` (styled through the sheet), `_session.ts`, `opengraph-image.tsx`, `icon.svg`, `src/lib/**`, `middleware.ts`. |

## Animation table (keyframes on site-kit `--motion-*`; transitions on D-4 `--motion-fast`/`--motion-base` + `--ease-standard`, DV-P2)

| Interaction | Motion | Reduced-motion fallback |
|---|---|---|
| Listing tile hover (lead plates, cards, slot) | media `scale(1.015)` inside the clip (base), 8% state layer on the plate (opacity, fast); frame → `--accent-line` and title underline paint instantly (no colour transition, re-run) | `transform: none`; layer, frame, underline stay |
| Tile press | layer 12%, no scale (DV-P3) | same |
| Buttons | 8% layer hover, 10% press on accent fill / 12% quiet, focus outline instant + halo fade, arrow `translateX(3px)`; disabled painted dashed; `aria-busy` 2px `cat-progress` bar, loop 1200ms quart after 300ms (R-1) | arrow `none`; bar static at 40% |
| Fields | hover line → `--fg`, focus ring + accent line, invalid red line (`aria-invalid`, `:user-invalid`), all instant paint (border-color transition removed in the re-run) | same (paint only) |
| Filter form submit (loading) | `FormBusy` sets `aria-busy` → button bar above | static bar |
| Nav current / hover (row 17) | 2px accent indicator in place; hover/press layer 8/12% | indicator jumps (`transition: none`) |
| Family-bar selection indicator | current: accent line draws once `sx-draw` 200ms quint; linked sibling: neutral line clip-path in on hover, out on leave | present, no draw; jumps |
| Masthead hairline (row 19) | `sx-fade` on `animation-timeline: scroll()`, 0–24px | line at opacity 1 |
| Home hero (row 11) | H1, lede, actions `sx-rise-lg` 320ms expo, 40ms stagger | static |
| Hero shelf (row 9) | `sx-rise-sm` 280ms expo, nth-child delays capped at stagger-max | static |
| Item media reveal | mark `cat-reveal` clip-path 320ms expo under the `cat-scan` read line, once; frame, chips, stats visible throughout | no reveal; line invisible |
| State panels, commerce notice (rows 10, 13) | 2px tone mark draws once (`sx-draw`); commerce facts `sx-rise-sm` 200ms quint, 40ms after | mark present, facts static |
| 404 / error / loading heads (row 13) | 2px tone mark draws once | present |
| Publish (row 11) | head, lede, earnings rise once, 40ms stagger | static |
| Skeleton / loading route (row 18) | 2px bar + `sx-progress` sheen, loop after 300ms | static bar 40%, sheen withdrawn, heading visible |
| Global error | static | n/a |

n/a notes: chips, panels, evidence rows, skeletons are not controls. Publish has no form (display-only by contract), so
"publish form focus/validation/submit-loading/step feedback" lands on the only real form, home's filter form (rows above).
There is no gallery (one figure per listing), so the item media transition is the digest reveal. Prices never change
client-side (row 16 n/a). Link disabled/loading n/a per §5. Family-bar sibling hover not captured: locally no sibling
origin is configured, so siblings render as text (`familyHover` in `probe.json`).

## Evidence (`/home/devuser/Documents/Reports/sceneaxi-redesign-main/after/catalogs/`)

Headless Chromium 1223 via R's `@playwright/test`, `next start` production builds on 3202 / 3203 (contract rule 9 ports;
OLD keeps 31xx), full page, DPR 1. Scripts `capture.mjs`, `probe.mjs`, `probe-transitions.mjs`, `audit-shots.mjs`.
PNGs were not viewed by eye: the read tool in this session refuses image files. Each shot was instead checked by
`audit-shots.mjs` (decodes every AFTER and its BEFORE: size, ink share, longest empty band, right-edge ink, byte
identity) plus a live DOM probe per route and width (clipped text, overlapping text boxes, boxes past the viewport).
- `catalog-{web,game}-{home,item,publish,404,home-noresults,home-refused,error-boundary,loading,global-error}-{390,768,1440}.png` (54) + `-1440-reduced.png` per route (18).
- `catalog-{web,game}-state-{tile-hover,tile-press,nav-hover,apply-focus,field-hover,apply-busy,card-hover,field-invalid,detail-focus}-1440.png` (18).
- `metrics.json` (72 shots): overflow 0, text < 11px 0, worst text contrast 5.09:1 (Forge accent chip), one console error `ERR_NETWORK_CHANGED` on web publish 390 (network flake, as in BEFORE); `metrics-publish.json` re-capture of the publish shots: 0 errors. Sub-44px targets at 390: only the inline sentence link "Read publishing requirements".
- `probe.json`: TEST notice ends at y 739 (web) / 672 (game) at 1440 and sits above the inventory at 390; 0 kicker/eyebrow elements; hero H1 66px at 1440, 40px at 390, `wdth` 104; Forge lead listing spans two tracks at 1440 and the slot closes the shelf as a full row; masthead opaque, no `backdrop-filter`; tile hover `matrix(1.015…)`, press layer 0.12 and link transform `none`; primary press layer 0.1, no transform; busy bar `cat-progress 1.2s` delay `0.3s`; under reduce no running animation and hover media `none`.
- `attr-counts.txt`: data-*/id=/aria-/role= per touched tsx, main → after; none lower.
- `work/`: main source backups, baseline and final test logs, build logs, detector JSON.

### Per-shot audit (one line per shot; `audit-shots.json`)

Reduced-motion shots that match their full-motion shot byte for byte are the same state under the other preference:
entrances have finished in the full-motion shot and are absent under reduce, so the frames agree (global-error is
static). No two different states share bytes. Overlaps listed at 1440 are rail / buy-column text inside the sticky
`overflow: auto` columns (max-height 812px, main's sticky bounds), scrolled out of the column, not painted over the footer.

- `catalog-game-404-1440-reduced.png` 1440x900, ink 4%, longest empty band 210px; BEFORE 404-1440.png 1440x909; same bytes as catalog-game-404-1440.png (same state, reduced preference).
- `catalog-game-404-1440.png` 1440x900, ink 4%, longest empty band 210px; BEFORE 404-1440.png 1440x909; DOM: clipped text 0, overlaps 0, past edge 0; same bytes as catalog-game-404-1440-reduced.png (same state, reduced preference).
- `catalog-game-404-390.png` 390x1254, ink 9.1%, longest empty band 52px; BEFORE 404-390.png 390x1370; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-404-768.png` 768x1024, ink 6.2%, longest empty band 133px; BEFORE 404-768.png 768x1024; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-error-boundary-1440-reduced.png` 1440x900, ink 4.2%, longest empty band 146px; BEFORE error-boundary-1440.png 1440x975; same bytes as catalog-game-error-boundary-1440.png (same state, reduced preference).
- `catalog-game-error-boundary-1440.png` 1440x900, ink 4.2%, longest empty band 146px; BEFORE error-boundary-1440.png 1440x975; same bytes as catalog-game-error-boundary-1440-reduced.png (same state, reduced preference).
- `catalog-game-error-boundary-390.png` 390x1306, ink 9%, longest empty band 52px; BEFORE error-boundary-390.png 390x1420; unique bytes.
- `catalog-game-error-boundary-768.png` 768x1024, ink 6.5%, longest empty band 74px; BEFORE error-boundary-768.png 768x1057; unique bytes.
- `catalog-game-global-error-1440-reduced.png` 1440x900, ink 1.4%, longest empty band 670px; BEFORE global-error-1440.png 1440x900; same bytes as catalog-game-global-error-1440.png (same state, reduced preference).
- `catalog-game-global-error-1440.png` 1440x900, ink 1.4%, longest empty band 670px; BEFORE global-error-1440.png 1440x900; same bytes as catalog-game-global-error-1440-reduced.png (same state, reduced preference).
- `catalog-game-global-error-390.png` 390x844, ink 5.6%, longest empty band 553px; BEFORE global-error-390.png 390x844; unique bytes.
- `catalog-game-global-error-768.png` 768x1024, ink 2.4%, longest empty band 794px; BEFORE global-error-768.png 768x1024; unique bytes.
- `catalog-game-home-1440-reduced.png` 1440x2398, ink 11.2%, longest empty band 76px; BEFORE home-1440.png 1440x2679; unique bytes.
- `catalog-game-home-1440.png` 1440x2398, ink 11.2%, longest empty band 76px; BEFORE home-1440.png 1440x2679; DOM: clipped text 2 (the visually hidden narrow-plate label, intended), overlaps 1 (sticky-scroller content inside overflow:auto, not painted), past edge 0; unique bytes.
- `catalog-game-home-390.png` 390x5145, ink 19.2%, longest empty band 51px; BEFORE home-390.png 390x5919; DOM: clipped text 2 (the visually hidden narrow-plate label, intended), overlaps 0, past edge 0; unique bytes.
- `catalog-game-home-768.png` 768x3510, ink 14.1%, longest empty band 67px; BEFORE home-768.png 768x3381; DOM: clipped text 2 (the visually hidden narrow-plate label, intended), overlaps 0, past edge 0; unique bytes.
- `catalog-game-home-noresults-1440-reduced.png` 1440x2262, ink 6.9%, longest empty band 77px; BEFORE home-noresults-1440.png 1440x3042; unique bytes.
- `catalog-game-home-noresults-1440.png` 1440x2262, ink 6.8%, longest empty band 77px; BEFORE home-noresults-1440.png 1440x3042; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-home-noresults-390.png` 390x3599, ink 13.8%, longest empty band 51px; BEFORE home-noresults-390.png 390x3943; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-home-noresults-768.png` 768x2827, ink 10.1%, longest empty band 67px; BEFORE home-noresults-768.png 768x3372; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-home-refused-1440-reduced.png` 1440x900, ink 20.8%, longest empty band 89px; BEFORE home-refused-1440.png 1440x976; same bytes as catalog-game-home-refused-1440.png (same state, reduced preference).
- `catalog-game-home-refused-1440.png` 1440x900, ink 20.8%, longest empty band 89px; BEFORE home-refused-1440.png 1440x976; DOM: clipped text 0, overlaps 0, past edge 0; same bytes as catalog-game-home-refused-1440-reduced.png (same state, reduced preference).
- `catalog-game-home-refused-390.png` 390x1641, ink 18.7%, longest empty band 72px; BEFORE home-refused-390.png 390x1800; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-home-refused-768.png` 768x1115, ink 21.5%, longest empty band 72px; BEFORE home-refused-768.png 768x1139; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-item-1440-reduced.png` 1440x1996, ink 16.4%, longest empty band 72px; BEFORE item-lantern-prop-1440.png 1440x2184; unique bytes.
- `catalog-game-item-1440.png` 1440x1996, ink 16.3%, longest empty band 72px; BEFORE item-lantern-prop-1440.png 1440x2184; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-item-390.png` 390x4322, ink 27%, longest empty band 55px; BEFORE item-lantern-prop-390.png 390x4129; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-item-768.png` 768x3521, ink 26.5%, longest empty band 53px; BEFORE item-lantern-prop-768.png 768x2324; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-loading-1440-reduced.png` 1440x902, ink 3%, longest empty band 285px; BEFORE loading-1440.png 1440x900; unique bytes.
- `catalog-game-loading-1440.png` 1440x902, ink 2.9%, longest empty band 285px; BEFORE loading-1440.png 1440x900; unique bytes.
- `catalog-game-loading-390.png` 390x1926, ink 4.3%, longest empty band 52px; BEFORE loading-390.png 390x1273; unique bytes.
- `catalog-game-loading-768.png` 768x1356, ink 3.4%, longest empty band 537px; BEFORE loading-768.png 768x1024; unique bytes.
- `catalog-game-publish-1440-reduced.png` 1440x2524, ink 13.7%, longest empty band 82px; BEFORE publish-1440.png 1440x2549; unique bytes.
- `catalog-game-publish-1440.png` 1440x2524, ink 13.6%, longest empty band 82px; BEFORE publish-1440.png 1440x2549; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-publish-390.png` 390x3931, ink 17.7%, longest empty band 54px; BEFORE publish-390.png 390x4354; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-publish-768.png` 768x3033, ink 15.3%, longest empty band 65px; BEFORE publish-768.png 768x3189; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-game-state-apply-busy-1440.png` 1440x900, ink 14.3%, longest empty band 49px; state shot (no BEFORE); unique bytes.
- `catalog-game-state-apply-focus-1440.png` 1440x900, ink 14.4%, longest empty band 49px; state shot (no BEFORE); unique bytes.
- `catalog-game-state-card-hover-1440.png` 1440x900, ink 11.9%, longest empty band 49px; state shot (no BEFORE); unique bytes.
- `catalog-game-state-detail-focus-1440.png` 1440x900, ink 28.3%, longest empty band 24px; state shot (no BEFORE); unique bytes.
- `catalog-game-state-field-hover-1440.png` 1440x900, ink 14.4%, longest empty band 49px; state shot (no BEFORE); unique bytes.
- `catalog-game-state-field-invalid-1440.png` 1440x900, ink 20.8%, longest empty band 89px; state shot (no BEFORE); unique bytes.
- `catalog-game-state-nav-hover-1440.png` 1440x140, ink 4.8%, longest empty band 52px; state shot (no BEFORE); unique bytes.
- `catalog-game-state-tile-hover-1440.png` 1440x900, ink 28.4%, longest empty band 61px; state shot (no BEFORE); unique bytes.
- `catalog-game-state-tile-press-1440.png` 1440x900, ink 28.4%, longest empty band 61px; state shot (no BEFORE); unique bytes.
- `catalog-web-404-1440-reduced.png` 1440x900, ink 4.1%, longest empty band 190px; BEFORE 404-1440.png 1440x909; same bytes as catalog-web-404-1440.png (same state, reduced preference).
- `catalog-web-404-1440.png` 1440x900, ink 4.1%, longest empty band 190px; BEFORE 404-1440.png 1440x909; DOM: clipped text 0, overlaps 0, past edge 0; same bytes as catalog-web-404-1440-reduced.png (same state, reduced preference).
- `catalog-web-404-390.png` 390x1254, ink 9.3%, longest empty band 52px; BEFORE 404-390.png 390x1370; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-404-768.png` 768x1024, ink 6.3%, longest empty band 133px; BEFORE 404-768.png 768x1024; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-error-boundary-1440-reduced.png` 1440x900, ink 4.3%, longest empty band 126px; BEFORE error-boundary-1440.png 1440x975; same bytes as catalog-web-error-boundary-1440.png (same state, reduced preference).
- `catalog-web-error-boundary-1440.png` 1440x900, ink 4.3%, longest empty band 126px; BEFORE error-boundary-1440.png 1440x975; same bytes as catalog-web-error-boundary-1440-reduced.png (same state, reduced preference).
- `catalog-web-error-boundary-390.png` 390x1306, ink 9.2%, longest empty band 52px; BEFORE error-boundary-390.png 390x1420; unique bytes.
- `catalog-web-error-boundary-768.png` 768x1024, ink 6.6%, longest empty band 74px; BEFORE error-boundary-768.png 768x1057; unique bytes.
- `catalog-web-global-error-1440-reduced.png` 1440x900, ink 1.4%, longest empty band 670px; BEFORE global-error-1440.png 1440x900; same bytes as catalog-web-global-error-1440.png (same state, reduced preference).
- `catalog-web-global-error-1440.png` 1440x900, ink 1.4%, longest empty band 670px; BEFORE global-error-1440.png 1440x900; same bytes as catalog-web-global-error-1440-reduced.png (same state, reduced preference).
- `catalog-web-global-error-390.png` 390x844, ink 5.6%, longest empty band 553px; BEFORE global-error-390.png 390x844; unique bytes.
- `catalog-web-global-error-768.png` 768x1024, ink 2.4%, longest empty band 794px; BEFORE global-error-768.png 768x1024; unique bytes.
- `catalog-web-home-1440-reduced.png` 1440x2618, ink 11.7%, longest empty band 76px; BEFORE home-1440.png 1440x2828; unique bytes.
- `catalog-web-home-1440.png` 1440x2618, ink 11.7%, longest empty band 76px; BEFORE home-1440.png 1440x2828; DOM: clipped text 0, overlaps 1 (sticky-scroller content inside overflow:auto, not painted), past edge 0; unique bytes.
- `catalog-web-home-390.png` 390x4428, ink 17.2%, longest empty band 50px; BEFORE home-390.png 390x4684; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-home-768.png` 768x3371, ink 15.5%, longest empty band 50px; BEFORE home-768.png 768x3220; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-home-noresults-1440-reduced.png` 1440x2748, ink 6.5%, longest empty band 77px; BEFORE home-noresults-1440.png 1440x3294; unique bytes.
- `catalog-web-home-noresults-1440.png` 1440x2748, ink 6.5%, longest empty band 77px; BEFORE home-noresults-1440.png 1440x3294; DOM: clipped text 0, overlaps 2 (sticky-scroller content inside overflow:auto, not painted), past edge 0; unique bytes.
- `catalog-web-home-noresults-390.png` 390x3952, ink 14.1%, longest empty band 48px; BEFORE home-noresults-390.png 390x4201; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-home-noresults-768.png` 768x3108, ink 10.3%, longest empty band 48px; BEFORE home-noresults-768.png 768x3590; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-home-refused-1440-reduced.png` 1440x930, ink 21.1%, longest empty band 72px; BEFORE home-refused-1440.png 1440x1017; unique bytes.
- `catalog-web-home-refused-1440.png` 1440x930, ink 21%, longest empty band 72px; BEFORE home-refused-1440.png 1440x1017; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-home-refused-390.png` 390x1668, ink 19.2%, longest empty band 72px; BEFORE home-refused-390.png 390x1841; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-home-refused-768.png` 768x1142, ink 21.9%, longest empty band 72px; BEFORE home-refused-768.png 768x1180; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-item-1440-reduced.png` 1440x1792, ink 19.5%, longest empty band 72px; BEFORE item-harbour-diorama-1440.png 1440x1805; unique bytes.
- `catalog-web-item-1440.png` 1440x1792, ink 19.5%, longest empty band 72px; BEFORE item-harbour-diorama-1440.png 1440x1805; DOM: clipped text 0, overlaps 4 (sticky-scroller content inside overflow:auto, not painted), past edge 0; unique bytes.
- `catalog-web-item-390.png` 390x4116, ink 28.6%, longest empty band 56px; BEFORE item-harbour-diorama-390.png 390x3732; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-item-768.png` 768x3316, ink 29.8%, longest empty band 54px; BEFORE item-harbour-diorama-768.png 768x2344; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-loading-1440-reduced.png` 1440x922, ink 3%, longest empty band 285px; BEFORE loading-1440.png 1440x900; unique bytes.
- `catalog-web-loading-1440.png` 1440x922, ink 2.9%, longest empty band 285px; BEFORE loading-1440.png 1440x900; unique bytes.
- `catalog-web-loading-390.png` 390x1926, ink 4.4%, longest empty band 52px; BEFORE loading-390.png 390x1273; unique bytes.
- `catalog-web-loading-768.png` 768x1356, ink 3.4%, longest empty band 537px; BEFORE loading-768.png 768x1024; unique bytes.
- `catalog-web-publish-1440-reduced.png` 1440x2544, ink 13.7%, longest empty band 82px; BEFORE publish-1440.png 1440x2549; unique bytes.
- `catalog-web-publish-1440.png` 1440x2544, ink 13.6%, longest empty band 82px; BEFORE publish-1440.png 1440x2549; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-publish-390.png` 390x3931, ink 17.9%, longest empty band 54px; BEFORE publish-390.png 390x4385; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-publish-768.png` 768x3033, ink 15.5%, longest empty band 65px; BEFORE publish-768.png 768x3189; DOM: clipped text 0, overlaps 0, past edge 0; unique bytes.
- `catalog-web-state-apply-busy-1440.png` 1440x900, ink 17.4%, longest empty band 44px; state shot (no BEFORE); unique bytes.
- `catalog-web-state-apply-focus-1440.png` 1440x900, ink 17.5%, longest empty band 44px; state shot (no BEFORE); unique bytes.
- `catalog-web-state-card-hover-1440.png` 1440x900, ink 15.1%, longest empty band 44px; state shot (no BEFORE); unique bytes.
- `catalog-web-state-detail-focus-1440.png` 1440x900, ink 29.5%, longest empty band 24px; state shot (no BEFORE); unique bytes.
- `catalog-web-state-field-hover-1440.png` 1440x900, ink 17.5%, longest empty band 44px; state shot (no BEFORE); unique bytes.
- `catalog-web-state-field-invalid-1440.png` 1440x900, ink 21.7%, longest empty band 72px; state shot (no BEFORE); unique bytes.
- `catalog-web-state-nav-hover-1440.png` 1440x140, ink 5.5%, longest empty band 13px; state shot (no BEFORE); unique bytes.
- `catalog-web-state-tile-hover-1440.png` 1440x900, ink 27.9%, longest empty band 44px; state shot (no BEFORE); unique bytes.
- `catalog-web-state-tile-press-1440.png` 1440x900, ink 27.9%, longest empty band 44px; state shot (no BEFORE); unique bytes.

## Checks (cwd R unless noted; TMPDIR `/home/devuser/.cache/sx<pid>`, removed after each run)

| Command | Exit |
|---|---|
| `sites/catalog-web`: `pnpm exec tsc --noEmit -p .` | 0 |
| `sites/catalog-game`: `pnpm exec tsc --noEmit -p .` | 0 |
| `sites/catalog-web`: `pnpm build` | 1 — `next build` compiled and generated 4/4 pages; only the postbuild Vercel package check fails with 12 pnpm-symlink problems (`three`/`@types/three` via site-kit), same count and kind as main's baseline `E/port/build-catalog-web.log` (listed route files differ in order only). Log `work/build-catalog-web-rerun.log` |
| `sites/catalog-game`: `pnpm build` | 1 — same, `work/build-catalog-game-rerun.log` |
| `pnpm run --silent check:sites` | 1 — the single baseline problem (`pnpm-workspace.yaml globs sites/`), identical to `E/backup/gate-baseline.log:22-25` |
| `node --test` web `catalog-ux-regression` / `item-session-wiring` | 0 / 0 (17, 15 pass) |
| `node --test` game `catalog-ux-regression` / `item-session-wiring` / `rendered-route-states.test.mjs` | 0 / 0 / 0 (13, 15, 4 pass) |
| `pnpm exec vitest run tests/sites` | 1 — 826 pass, 3 fail, all three in the main baseline (`site-seams` workspace glob, umbrella `identity-plane-wiring` health, `provider-adapters` loader) |
| `pnpm exec eslint --max-warnings 0` on both `digest-figure.tsx` (the only tsx touched in the re-run) | 0 |
| `detect-antipatterns.mjs --json sites/catalog-web/src/app sites/catalog-game/src/app` | 0, `[]` |
| `node capture.mjs` (72 route shots + 18 state shots) | 0; overflow 0, console errors 0, text < 11px 0, contrast < 4.5:1 0 (`metrics.json`) |
| `node probe-transitions.mjs` | 0; disallowed transition properties: none |
| `node audit-shots.mjs` | 0; 90 lines above |
| `git diff --quiet` on root, catalog-web, catalog-game and kids lockfiles | 0 (see Request 1) |
| `attr-counts.txt` data-*/id=/aria-/role= per touched tsx | none lower (the re-run adds one span with a class only) |

Not run by this lane: `pnpm gate`, root `pnpm build`, e2e goldens (no catalog golden imports these files),
`node scripts/vercel-build-site.mjs` (it hoists and rewrites `node_modules` in R; deploy-owned).
Servers on 3202/3203 were stopped; ports free.

## Deviations applied

DV-F1, F2, F5, F6, F9, F10, F11 (`font-variation-settings: "wdth" 104`), F12 (fallback literals above); DV-P1 (motion
sheet served from the layout), DV-P2, DV-P3, DV-P11, DV-P12; §8.2 store facts (pressed layer 10% on accent fills,
results-column H2 in Heading, hero/detail split at 64rem, `--gutter` 16px, 24px chips, R-8 `.state` density).
Lane-level choices, no captain fact changed: the Forge slot closes the shelf as one full row once the shelf holds three
listings (so no lone cell trails the lead row); main's horizontally scrolling phone rail is kept (its UX is main's newer
behaviour) with the v5 heading/intro as its first cell; the reason code stays in the panel head as main placed it, on its
own line after the chip.

## Requests

1. Owner of lockfiles / orchestrator: in this pnpm 12.6 setup, any `pnpm exec`/`pnpm build` run inside `sites/catalog-*`
   (both are contract checks) rewrites that site's `pnpm-lock.yaml` (adds `packageManagerDependencies`) and pruned 32
   packages from its `node_modules` on first run. After every such run this lane wrote the file back to HEAD bytes with
   `git show HEAD:<path> > <path>`; both catalog lockfiles are byte-identical to main now. `sites/umbrella/pnpm-lock.yaml`
   is modified in R (mtime 09:30, before this lane touched any site); this lane did not touch it.
2. Test owners (`catalog-ux-regression.test.ts`, both stores): the 4 main baseline failures in these files now pass;
   nothing to change, recorded so the gate reviewer sees why the count dropped.
3. Owner of `sites/catalog-*/src/lib/site-config.ts` (carried from v5): `heroKicker` is no longer rendered; it could be
   retired or reworded if a later surface needs it.

## Final-review fixes (reviews/final.md, 2026-10-05)

Scope set by the orchestrator: fixes 2, 5 and 6. CSS only. Both `sites/catalog-*/src/app/globals.css` were edited in lockstep, and everything below STORE IDENTITY is still byte-identical (`diff` clean).

- **Fix 2 (blocking):** deleted `.buy .state { padding: var(--space-4); gap: var(--space-3) }`, so the item refusals use the base `.state`, as R-8 intended. Measured live with `next start` on 3202/3203, the same on both stores:
  - editor-link and commerce refusals: 16/16 at 390 (358px wide); 24/16 at 768 (736px) and at 1440 (485px). This matches `/publish`.
  - the home notice stays compact at 16/12 (R-8).
- **Fix 5:** no test pins 64px, so the one-row masthead `min-height` went from `4rem` to `3.75rem`. `.nav a` left the 48rem `min-height: 2.375rem` override, so nav targets keep their 44px. Live masthead height and nav targets:

  | Width | Umbrella masthead | Store masthead | Nav targets (all three) |
  |---|---|---|---|
  | 1440 | 60px | 60px | 44px |
  | 768 | 112px (main's two-row tier) | 60px | 44px |
  | 390 | 96px (two rows) | 92px (two rows) | 44px |

  `.button` stays at 38px from 48rem.
- **Fix 6:** no test pins the state layer. Nav hover now works the umbrella way:
  - hover draws a 2px `--line-strong` indicator open from the centre: clip-path `inset(0 50%)` → `inset(0)`, `--motion-base` on `--ease-standard`;
  - the 8% hover layer is gone; the press layer stays at 12%;
  - `aria-current` keeps the accent indicator in place;
  - reduced motion still sets `transition: none` on `.nav a::after`.

  Verified live on both stores.
- Re-captured into `E/after/catalogs/`: `<store>-{item,publish,home}-{390,768,1440}` and `<store>-fix6-nav-hover-1440`.
- Checks:
  - The detector reports 0 on both sheets.
  - `vitest run tests/sites sites/*/test packages/site-kit`: 1324 pass, 3 fail. These are the same 3 baseline failures as in `gate.md`.
  - `node --test sites/catalog-game/test/*.test.mjs`: 4/4.
  - `next build` compiled on both stores. The postbuild `check-vercel-package` step fails locally on the non-hoisted `node_modules` symlink graph, which is an environment limit; the Vercel build uses the hoisted linker.
  - `pnpm run build` in the sites rewrote all three site lockfiles, so I wrote them back to HEAD bytes with `git show HEAD:<path> > <path>`. All lockfiles are now clean.

