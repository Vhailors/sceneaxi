# Lane report: foundation (port run, DIRECTION v6)

Date: 2026-10-05. First run on R (`redesign-impeccable`, on top of `dffefbab`). There is no `reviews/foundation.md` yet, so there were no review items to fix. Sources: `docs/redesign/DIRECTION.md` v6 (§0.2, §0.6, §3, §4, §6, §8, §8.1 DV-P1/P5/P12, §9 rule 4, Port notes), `RULINGS.md` R-1..R-9, the v5 foundation report (`docs/redesign-v5-reference/lanes/foundation.md`) and the v5 result in OLD (read only).

Skill: I read `SKILL.md`, `animate.md`, `craft-floor.md` and `operate.md` (the skill ships no `product.md`/`brand.md`). `context.mjs --target packages/site-kit/src/design-tokens.ts` (cwd R) exited 0 and printed `PRODUCT.md`.

## Files changed (all foundation-owned, §9 rule 4)

| File | Change |
|---|---|
| `packages/site-kit/src/design-tokens.ts` | Re-target. Type scale per DV-F1/F2/F9/F11 (lead 18, body 16, ui 13, ui-sm 12, micro 11 at 0.08em, mono 12–13); new `FOUNDATION_TEXT_FLOOR_PX` = 11; float shadow per DV-F3; `foundationsVariablesCss()` also emits `--type-micro-tracking`. **DV-P1:** D-4 `FOUNDATION_MOTION` is untouched and is still the only motion group the two pinned emitters emit. The §6.1 set lands as `FOUNDATION_MOTION_SYSTEM` (18 rows) + `FOUNDATION_MOTION_SYSTEM_REDUCED`, emitted by the new `foundationsMotionCss()`: its own `:root` (one declaration per line, so a site's "emitted" scan finds it), keyframes `sx-fade`, `sx-rise-sm/md/lg`, `sx-draw`, `sx-progress`, and the reduced-motion override block. `.sx-status` becomes the mono 11px / 0.08em label on the 4px scale. `FOUNDATIONS_SOURCE`, colours, spacing and radii are unchanged. |
| `packages/site-kit/src/index.ts` | Exports only (R-9 grant): `FOUNDATION_MOTION_SYSTEM`, `FOUNDATION_MOTION_SYSTEM_REDUCED`, `FOUNDATION_TEXT_FLOOR_PX`, `foundationsMotionCss`, `type FoundationMotionToken`. |
| `packages/site-kit/src/change-review.ts` | Clean port (main = PRE). I applied the v5 delta as a patch, and the result is byte-identical to the v5 result: 4px-scale spacing, no text under 11px, every button has all five states, the R-1 busy bar, row 14 resolution hooks `data-sx-decision` / `data-sx-outcome`, 44px targets under 720px, a reduced-motion block. Markup, text, ✕/✓ glyphs (R-4), aria labels and `data-sx-*` hooks are unchanged. |
| `apps/desktop-shell/src/visual-tokens.ts` | DV-P5. The pinned `MOTION`, `RADIUS`, `SPACE`, `TYPE_SCALE` and `DENSITY` keep their values. New: `TYPE_SIZE`, `SPACING` +`block` 32 / `gutter` 44 / `band` 72, `SPACING_SCALE`, `CHROME_RADIUS` (panel 16, card 13, control 10), `ELEVATION.float`, frozen `MOTION_SYSTEM` (the v5 `MOTION` keys and values, no scale keys), `MOTION_CUSTOM_PROPERTIES`, `MOTION_REDUCED_CUSTOM_PROPERTIES`. `DEVIATIONS` gains nine rows, `dv-d1-…` to `dv-d9-…`. |
| `docs/design-foundations.md` | D-4 amended (DV-P1/P2/P3/P4), D-6 amended (DV-P12, DV-F3), new section "Redesign 2026-10" (DV-F table, both motion layers, keyframes, component changes). |
| `docs/engine-desktop-surface.md` | New subsection "Redesign 2026-10" (DV-D1..D9, DV-P5..P7, motion on this surface). |

Not changed:
- `state-panel.ts`, `commerce-notice.ts`, `access-states.ts`, `site-element.ts`: they emit models and neutral element trees with no CSS. The site sheets style `.state`, so the state-panel redesign lands in the site lanes. No markup hook was needed.
- `SURFACE`, `LINE`, `ACCENT`, `TEXT`, `TYPE`, `METRICS`, `FOUNDATION_COLORS`, `FOUNDATION_SPACING`, `FOUNDATION_RADII`: no Deviation row changes them.
- No test was edited: no test pins a value that a Deviation row changes.

Deviations from the node prompt (v6 wins):
- The prompt said "add motion custom properties to `foundationsVariablesCss`". DV-P1 forbids this (`design-tokens.test.ts:294-318`, `maintenance-compat.test.ts:203-219`), so they live in `foundationsMotionCss()`.
- The prompt said "add a reduced-motion block to `foundationsBaseCss`". Re-run (review fix 1): `foundationsBaseCss()` now ends with the v5 one-line block `@media (prefers-reduced-motion: reduce) { :root { … } }`, built from `FOUNDATION_MOTION_SYSTEM_REDUCED` (`packages/site-kit/src/design-tokens.ts:608,620`). Being one line, it adds no line the D-4 pin (`design-tokens.test.ts:307-308`) matches. `foundationsMotionCss()` keeps its own copy.
- The prompt asked for a desktop `MOTION` table. It lands as `MOTION_SYSTEM`, and the v5 `RADIUS` lands as `CHROME_RADIUS` (DV-P5).
- Decision for review: Change Review keeps the v5 press scale and v5 transition tokens, as a clean port. No umbrella or storefront sheet serves `changeReviewCss()`, so DV-P2/P3 do not reach it, and it moves like the web shell's Change Review. This is noted in `design-foundations.md`.

## Token list

- Site type (`sizePx`): display-xl 66, display-l 42, heading 24, subhead 17, lead **18** (DV-F2), body **16** (DV-F2), ui **13**, ui-sm **12** (DV-F9), micro **11 / 0.08em** (DV-F1, DV-F11), mono **12–13** (DV-F9).
- Text floor: 11px.
- Float shadow: `0 10px 14px -6px rgba(0,0,0,.9)` (DV-F3).
- D-4, unchanged: `--motion-fast` 120ms, `--motion-base` 200ms, `--ease-standard` `cubic-bezier(0.2, 0, 0, 1)`.
- Desktop:
  - `TYPE_SIZE`: floor 11, panelHead 11, ui 12, mono 12, body 13, heading 15/17, pinnedException 10 (DV-D2);
  - `SPACING`: 4/8/12/16/24/**32/44/72** (DV-D3);
  - `CHROME_RADIUS`: panel **16**, card 13, control 10 (DV-D1);
  - `ELEVATION.float`: `0 10px 14px -6px ${SCRIM.shadow}` (DV-D4).

## Motion table (`FOUNDATION_MOTION_SYSTEM` = desktop `MOTION_SYSTEM`)

| Property | Value | `MOTION_SYSTEM` key |
|---|---|---|
| duration-press / micro / state | 120 / 160 / 200ms | duration.press / micro / state |
| duration-panel / panel-exit / route | 280 / 200 / 320ms | duration.panel / panelExit / route |
| duration-loop, delay-loading (R-1) | 1200ms, 300ms | duration.loop, delay.loading |
| ease-out-quart / quint / expo | `cubic-bezier(0.25, 1, 0.5, 1)` / `(0.22, 1, 0.36, 1)` / `(0.16, 1, 0.3, 1)` | ease.outQuart / outQuint / outExpo |
| stagger-step / max | 40 / 200ms | stagger.step / max |
| distance-sm / md / lg | 4 / 8 / 16px | distance.sm / md / lg |
| scale-press / enter | 0.97 / 0.98 | none: the desktop never scales; DV-P3 keeps press scale off the umbrella and storefronts |

Under reduced motion the distances are 0px, the scales 1 and stagger-step 0ms. The desktop list covers distances and stagger only.

## Checks (cwd R; short TMPDIR, removed afterwards)

| Command | Exit | Tail |
|---|---|---|
| `pnpm build` | 0 | `tsc --build && tsc -p tsconfig.tests.json` (no errors) |
| `pnpm exec vitest run packages/site-kit apps/desktop-shell` | 0 | `Test Files 66 passed (66)`, `Tests 785 passed (785)` |
| `pnpm exec vitest run packages/site-kit apps/desktop-shell tests/sites` (§10.1) | 1 | `Test Files 3 failed / 82 passed (85)`, `Tests 3 failed / 1606 passed (1609)`. All three failures are in the baseline (`E/backup/gate-baseline.log`): `identity-plane-wiring … serves non-cacheable health without configuration values`, `provider-adapters … builds its provider loader in a form a production bundler cannot replace`, `site-seams … keeps sites/ out of the pnpm workspace`. None is new. |
| `pnpm check:contracts` | 0 | `contract check OK — 5 shared authoring jobs valid, …` |
| `pnpm exec eslint --max-warnings 0` on the 4 touched `.ts` files | 0 | no output |
| `pnpm lint` | 1, equal to baseline | `✖ 33 problems (33 errors, 0 warnings)`. 7 files, all in the baseline set: 6 under `docs/audits/production-swarm/**` plus `scripts/fix-trace-entries.mjs`. No touched file. |
| detector `--json` on the 4 `.ts` files, `design-foundations.md`, `engine-desktop-surface.md` | 0 | `[]` |
| `git diff --quiet` on `pnpm-lock.yaml`, `sites/kids/pnpm-lock.yaml` | 0 | unchanged |

## Re-run (reviews/foundation.md, VERDICT FAIL)

- Fix 1 (blocking), done: `foundationsBaseCss()` ends with `@media (prefers-reduced-motion: reduce) { :root { --motion-distance-sm: 0px; … --motion-stagger-step: 0ms; } }` (`design-tokens.ts:608,620`). The DV-P1 note in `docs/design-foundations.md` (D-4 amendment and the motion-system section) now says so.
- Advisory 3, done: the `dv-d6-loading-loop` `shipped` text (`apps/desktop-shell/src/visual-tokens.ts:427`) now says lane-desktop *will* retime `assistant-bars` and `sweep` onto the loop token and that the chrome still ships 0.9s ease-in-out and 1.1s linear. It no longer claims the retiming is done.
- Advisory 2: handled by the orchestrator (`.empryo/jobs/` excluded locally). Advisories 4 and 5: left as they are.

Re-run checks (cwd R, short TMPDIR, removed afterwards):

| Command | Exit | Tail |
|---|---|---|
| `pnpm build` | 0 | `tsc --build && tsc -p tsconfig.tests.json` |
| `pnpm exec vitest run packages/site-kit apps/desktop-shell` | 0 | `Test Files 66 passed (66)`, `Tests 785 passed (785)`. The D-4 line pin still passes. |
| `pnpm exec vitest run tests/sites` | 1, baseline only | `Test Files 3 failed / 16 passed (19)`, `Tests 3 failed / 821 passed (824)`: `identity-plane-wiring` health, `provider-adapters` loader, `site-seams` workspace. All three are in the baseline. |
| `pnpm run --silent check:contracts` | 0 | `contract check OK …` |
| `pnpm run --silent lint` | 1, equal to baseline | `✖ 33 problems (33 errors, 0 warnings)` in the same 7 baseline files |
| `pnpm exec eslint --max-warnings 0` on `design-tokens.ts`, `visual-tokens.ts` | 0 | no output |
| detector `--json` on `design-tokens.ts`, `visual-tokens.ts`, `design-foundations.md`, this report | 0 | `[]` |
| `git diff --quiet` on `pnpm-lock.yaml`, `sites/kids/pnpm-lock.yaml` | 0 | unchanged |

## Browser proof

No browser-tab tool was available in this harness, so I used headless Chromium 1223 through `sites/umbrella/node_modules/playwright-core`. The harness is `E/after/foundation/harness.ts`, bundled by esbuild into the short TMPDIR. It renders `foundationsCss({surface:"umbrella"})` + `foundationsMotionCss()` + `changeReviewCss()`, the six status chips, and `changeReviewElement()` over a real `proposeMany()` proposal (3 rows).

- **Decided state:** row 0 accepted, row 1 rejected, outcome `apply`, Accept all `aria-busy`, Reject all `disabled`.
- **Shots** (`E/after/foundation/`): `change-review-pending-{390,768,1440}.png`, `change-review-decided-{390,768,1440}.png` and `change-review-decided-reduced-{390,768,1440}.png`.
- **Measured** (`E/after/foundation/measurements.json`):
  - overflow is 0 at every width;
  - the smallest text is 11px;
  - the leaf is never clipped;
  - `--motion-distance-sm` is 4px, and 0px under reduce;
  - `--motion-scale-press` is 0.97, and 1 under reduce;
  - `--motion-fast` is 120ms;
  - `--type-micro-size` is 11px and `--type-micro-tracking` is 0.08em;
  - the float shadow is the DV-F3 value;
  - the accepted strike clip goes from `inset(0 100% 0 0)` to `inset(0)`;
  - the busy bar runs `sx-cr-progress`, and under reduce it is static at 40%;
  - the disabled button is dashed, `rgb(138,146,156)`.
- **Not checked:** I did not open the PNGs by eye (this tool cannot display images). Archivo is not loaded in this harness.
- **Desktop shots at 1280×800 and 1920×1080:** n/a. No rendered chrome changed: the chrome reads only `SPACING.unit…section`, and the desktop suites are green.

## Requests

1. **lane-umbrella:** compose `foundationsMotionCss()` inside `umbrellaFoundationsCss()` (R-9 grant), so every `--motion-*` name you read counts as emitted. Its `:root` is one declaration per line.
2. **lane-catalogs:** serve `foundationsMotionCss()` beside the sheet each store layout already serves. Store keyframes must still be declared and used in each store's own `globals.css` (the storefront `@keyframes`/`animation:` test).
3. **lane-desktop:**
   - read `CHROME_RADIUS.panel` for `--r-panel`;
   - read `SPACING_SCALE` for `--space-8/11/18`;
   - read `ELEVATION.float` for the overlay, palette and drawer shadows;
   - emit `MOTION_CUSTOM_PROPERTIES` in `:root`;
   - emit `MOTION_REDUCED_CUSTOM_PROPERTIES` after the pinned blanket reduced-motion rule.
4. **Change Review consumers:** set `data-sx-decision` on the row and `data-sx-outcome` on the panel.
