# Lane report: foundation

Date: 2026-10-04. Round 4, after `reviews/foundation.md` round 3 (FAIL on fix 1 only). Sources: `DIRECTION.md` v5,
`RULINGS.md` R-1 to R-5 (R-5 confirmed by the orchestrator, see below), advisory notes in `reviews/direction.md`.

## R-5 confirmation (agent_send from orchestrator to bg-208)

Received by this lane (bg-208) as a parent instruction on 2026-10-04, quoted verbatim:

> CONFIRMED by the orchestrator (run contract owner, run orun-4-8f306309), in my own words: R-5 stands. The 255 lint errors are all in the 17 production-swarm evidence files under docs/audits/production-swarm/** and apps/desktop-shell/test/visual-postpr-evidence/**. They existed before the redesign, match the backup, and are owned by no redesign node, so they do not count against any lane. The lint criterion for every node is: eslint --max-warnings 0 on the files it touched exits 0, and full pnpm lint lists no file outside those 17. Do not edit those files or widen ignores.

## Round 4: review items

| # | Item | Resolution |
|---|---|---|
| 1 | R-5 not verified (blocking) | Closed. The orchestrator confirmed R-5 (quote above). Under R-5: touched-file eslint exits 0, and full `pnpm lint` lists 17 files, 0 outside the R-5 set (re-run in round 4, see Checks). No lane code changed. |
| 2 | Report must agree with `RULINGS.md:42` (advisory) | Closed. Round 3 item 1 and Request 4 are now marked closed by the confirmation. The earlier line saying "an earlier run of this lane wrote it" was wrong: `RULINGS.md:42` records that the orchestrator wrote R-5 (`lm_16`), and the orchestrator has now confirmed it. The `.sx-cr-button` 44px fix is also still in place: `change-review.ts:502` sets `min-height: 44px` inside `@media (max-width: 720px)` (`:493`). |
| 3 | PNGs not checked by eye (advisory) | Still open. This harness cannot display images, so I did not look at them. The director's final pass (`E/final/**`) should check them by eye. |

## Round 3: review items (history)

| # | Item | Resolution |
|---|---|---|
| 1 | R-5 not confirmed by the contract owner | **Closed in round 4** by the orchestrator's confirmation (quote above). The round 3 text follows: R-5 in `RULINGS.md:40-47` has no owner source message: an earlier run of this lane wrote it. I did not edit `RULINGS.md` and did not write a ruling. I asked `orch:orun-4-8f306309` by link `ask` to confirm R-5 in its own words (no reply in 90 s; inbox still empty) and sent a `question` to my parent. Until the owner confirms, `pnpm lint` exit 1 stands as a failed check. The facts behind R-5 still hold (see Checks). |
| 2 | `.sx-cr-button` 30px under 720px | Fixed: `change-review.ts:502` adds `.sx-cr-button { min-height: 44px; }` in the `max-width: 720px` block. Measured in headless Chromium: bulk buttons 44px at 390, 30px at 768 and 1440, overflow 0. Shots: `E/after/foundation/round3-bulk-{390,768,1440}.png`. `docs/design-foundations.md:289` updated. |
| 3 | R-5 source not cited | There is no owner source to cite (item 1). This report no longer calls lint "accepted". |
| 4 | site-consumer suites not re-run | Re-run in this round: 173 pass (Checks). |

## Round 2: review items (history)

| # | Item | Resolution |
|---|---|---|
| 1 | `pnpm lint` exits 1 | Closed by ruling **R-5**: the 255 errors in the 17 pre-existing production-swarm evidence scripts do not count. Not edited, no ignore widened. New criterion met: `eslint --max-warnings 0` on every touched file exits 0, and full `pnpm lint` lists 17 files, 0 outside the R-5 set (see Checks). |
| 2 | `design-tokens.ts:558` docblock | Now reads "five one-shot keyframes and the R-1 progress loop (`sx-progress`, indeterminate indicators only)". |
| 3 | decided + disabled specificity | `change-review.ts:477-478`: both decided-row icon rules are scoped with `:not(:disabled):not([aria-disabled="true"])`, so the painted disabled state wins. |
| 4 | sticky hover on touch | `change-review.ts:470-476`: all five hover rules (state layer, quiet, accent, reject, accept) moved into one `@media (hover: hover)` block. It sits before the disabled rules, so disabled still wins on order. Press feedback on touch stays via `:active`. `docs/design-foundations.md` Change Review bullet updated to say so. |
| 5 | skill not loaded | No skill-load tool exists in this harness. I read `SKILL.md` directly, ran `context.mjs --target packages/site-kit/src/change-review.ts` (exit 0, printed PRODUCT.md, which is the project's product register; the skill ships no `product.md`/`brand.md`, `operate.md` is its register file), and read `polish.md`, `harden.md`, `typeset.md` (plus `animate.md`, `craft-floor.md` in run 1). |
| 6 | desktop-size shots | n/a: no desktop render changed. `chrome.ts` reads none of the new tokens yet (Request 2). |

## Files changed (all foundation-owned, DIRECTION.md §9)

| File | Change |
|---|---|
| `packages/site-kit/src/design-tokens.ts` | type scale per DV-F1/F2/F9/F11; `FOUNDATION_TEXT_FLOOR_PX` 11; float shadow per DV-F3; new `FOUNDATION_MOTION` (18 rows) and `FOUNDATION_MOTION_REDUCED`; `foundationsVariablesCss()` emits `--motion-*` and `--type-micro-tracking`; `foundationsBaseCss()` adds six shared keyframes (`sx-fade`, `sx-rise-sm/md/lg`, `sx-draw`, `sx-progress`) and the reduced-motion `:root` block; `.sx-status` becomes the mono 11px / 0.08em label on the 4px scale. `FOUNDATIONS_SOURCE` untouched. |
| `packages/site-kit/src/change-review.ts` | `changeReviewCss()` redesigned: 4px-scale spacing, no text under 11px, five states on every button, R-1 busy bar, row 14 resolution motion through CSS-only hooks `data-sx-decision` (row) and `data-sx-outcome` (panel), reduced-motion block, 44px icon targets under 720px. Markup, text, ✕/✓ glyphs, aria labels and `data-sx-*` hooks unchanged (R-4). |
| `apps/desktop-shell/src/visual-tokens.ts` | new `TYPE_SIZE`, `SPACING` +32/44/72 and `SPACING_SCALE`, `RADIUS` (panel 16), `ELEVATION.float`, frozen `MOTION`, `MOTION_CUSTOM_PROPERTIES` (no scale tokens), `MOTION_REDUCED_CUSTOM_PROPERTIES`; six `DEVIATIONS` rows `dv-d1-…` to `dv-d6-…`. |
| `docs/design-foundations.md` | new section "Redesign 2026-10": DV-F table, motion table, keyframes, component changes. |
| `docs/engine-desktop-surface.md` | new subsection "Redesign 2026-10 (DV-D1 to DV-D6)" under Deviations. |

Not changed, with reasons:
- `state-panel.ts`, `commerce-notice.ts`, `access-states.ts`, `site-element.ts`: they emit models and neutral trees with no CSS. Each site sheet styles `.state`, so the state-panel redesign lands in the site lanes using the new tokens and keyframes. No markup hook was needed.
- `SURFACE`, `LINE`, `ACCENT`, `TEXT`, `TYPE` (families), `METRICS`, `FOUNDATION_COLORS`, `FOUNDATION_SPACING`, `FOUNDATION_RADII`: no Deviation row changes them.
- No test edited: no test pins a value that a Deviation changes.

## Token list

Site type (`sizePx`): display-xl 66, display-l 42, heading 24, subhead 17, lead **18** (DV-F2), body **16** (DV-F2), ui **13** (DV-F9), ui-sm **12** (DV-F9), micro **11 / 0.08em** (DV-F1, DV-F11), mono **12–13** (DV-F9). Float shadow `0 10px 14px -6px rgba(0,0,0,.9)` (DV-F3).
Desktop: `TYPE_SIZE` floor 11, panelHead 11, ui 12, mono 12, body 13, heading 15/17, pinnedException 10 (DV-D2); `SPACING` 4/8/12/16/24/**32/44/72** (DV-D3); `RADIUS` panel **16**, card 13, control 10 (DV-D1); `ELEVATION.float` `0 10px 14px -6px` + `SCRIM.shadow` (DV-D4).

## Motion table (sites `--motion-*` = desktop `MOTION`)

| Property | Value | `MOTION` key |
|---|---|---|
| duration-press / micro / state | 120 / 160 / 200ms | duration.press / micro / state |
| duration-panel / panel-exit / route | 280 / 200 / 320ms | duration.panel / panelExit / route |
| duration-loop, delay-loading (R-1) | 1200ms, 300ms | duration.loop, delay.loading |
| ease-out-quart / quint / expo | `cubic-bezier(0.25, 1, 0.5, 1)` / `(0.22, 1, 0.36, 1)` / `(0.16, 1, 0.3, 1)` | ease.outQuart / outQuint / outExpo |
| stagger-step / max | 40 / 200ms | stagger.step / max |
| distance-sm / md / lg | 4 / 8 / 16px | distance.sm / md / lg |
| scale-press / enter | 0.97 / 0.98 | none: sites only, the desktop never scales |

Reduced motion: distances 0px, scales 1, stagger-step 0ms (desktop: distances and stagger only).

## Checks (cwd R)

| Command | Exit | Tail |
|---|---|---|
| `pnpm build` | 0 | `tsc --build && tsc -p tsconfig.tests.json` (no errors) |
| `pnpm exec vitest run packages/site-kit apps/desktop-shell` | 0 | `Test Files 38 passed (38)`, `Tests 738 passed (738)` |
| `pnpm exec vitest run tests/sites/umbrella-visual.test.ts tests/sites/catalog-storefronts.test.ts tests/sites/kids-surface.test.ts` (consumers of the shared sheet) | 0 | `Test Files 3 passed (3)`, `Tests 173 passed (173)` (re-run in round 3) |
| `pnpm check:contracts` | 0 | `contract check OK — 5 shared authoring jobs valid, …` |
| `pnpm lint` | 1, which passes under R-5 (confirmed) | `✖ 255 problems (255 errors, 0 warnings)`. 17 files with errors, all under `docs/audits/production-swarm/**` or `apps/desktop-shell/test/visual-postpr-evidence/**`; **0 files outside the R-5 set**. None is a file this lane touched. |
| `pnpm exec eslint --max-warnings 0` on the three touched `.ts` files | 0 | no output |
| detector `--json` on the touched files (3 `.ts`, `design-foundations.md`, `engine-desktop-surface.md`, this report) | 0 | `[]` |
| `context.mjs --target packages/site-kit/src/change-review.ts` | 0 | printed PRODUCT.md |

Round 4 re-run (no code change): `pnpm build` 0; vitest 0 (38 files, 738 tests); `check:contracts` 0; `pnpm lint` 1 (255 errors, 17 files, 0 outside the R-5 set); touched-file eslint 0; detector `--json` `[]` on all 3 `.ts`, both docs, `DESIGN.md`, `PRODUCT.md`, `.impeccable`, this report. Site consumer suites were not re-run in round 4 because no code changed since round 3.

Round 3 numbers: every row above was re-run after the round 3 edit to `change-review.ts` (build, vitest 38 files / 738 tests, site consumers 173, `check:contracts`, lint 255 errors in 17 files with 0 files outside the production-swarm set, touched-file eslint, detector).

Browser proof (fallback: headless Chromium through playwright-core; no browser tab tool was available here). It renders `foundationsCss({surface:"umbrella"})` + `changeReviewCss()` + `changeReviewElement()` over a real `proposeMany()` proposal. The pending state is shot at 390/768/1440. The decided state (row 0 accepted, row 1 rejected, Accept all busy, Reject all disabled) is shot at the same widths, with and without reduced motion. Screenshots are in `E/after/foundation/` (9 PNGs). Measured in the page:
- horizontal overflow is 0 and the smallest text is 11px at every width; the leaf is never clipped;
- the accepted strike draws from `inset(0 100% 0 0)` to `inset(0)`, and under reduced motion it is `inset(0)` at once;
- the rejected value turns `--fg-2` and is struck;
- the busy bar runs `sx-cr-progress`, and under reduced motion it is a static 40% bar;
- the disabled button is dashed, `--fg-2`, `not-allowed`;
- `--motion-distance-sm` is 4px, and 0px under reduced motion.

I opened none of the PNGs by eye (this tool cannot display images). Archivo was not loaded in this harness, so the system fallback face rendered.

Re-run proof (headless Chromium 1223 via `sites/umbrella/node_modules/playwright-core`, CSS from src through Vite SSR: `foundationsVariablesCss` + `foundationsBaseCss` + `changeReviewCss`). Two shots in `E/after/foundation/rerun-decided-disabled-{mouse,touch}.png`. Measured:
- decided-rejected + `disabled` reject icon: `rgb(138,146,156)` label, `dashed` border (was `--danger`);
- decided-accepted + `aria-disabled` accept icon: same painted disabled state;
- decided-rejected enabled reject icon: still `--danger` solid;
- mouse context (`hover: hover` true): hover layer opacity 1;
- touch context 390px (`hover: hover` false): layer opacity 0 after a tap.

Desktop shots (1280x800, 1920x1080): n/a: no desktop render changed.

Skill: see review item 5 above.

## Requests

1. **test-owners, `packages/site-kit/src/index.ts`**: export `FOUNDATION_MOTION`, `FOUNDATION_MOTION_REDUCED`, `FOUNDATION_TEXT_FLOOR_PX` and `type FoundationMotionToken` from `./design-tokens.js`. The CSS already emits everything, so no lane is blocked, but the data is not reachable from the package root.
2. **lane-desktop**: read the new tokens in `chrome.ts`:
   - `RADIUS.panel` for `--r-panel`;
   - `SPACING_SCALE` for `--space-*`;
   - `ELEVATION.float` for the overlay, palette and drawer shadows;
   - `MOTION_CUSTOM_PROPERTIES` in `:root`;
   - `MOTION_REDUCED_CUSTOM_PROPERTIES` after the pinned blanket reduced-motion rule.
3. **site lanes**: shared keyframes `sx-fade`, `sx-rise-sm/md/lg`, `sx-draw` and `sx-progress` are in `foundationsCss()`. Storefronts must still declare and use their own keyframes for the storefront `@keyframes`/`animation:` test. For Change Review resolution, set `data-sx-decision` on the row and `data-sx-outcome` on the panel.
4. ~~**Run contract owner**: confirm or reject R-5.~~ Closed in round 4: the orchestrator confirmed R-5 (quote above).
