# Review: foundation lane (round 4)

Reviewer: independent (did not build this). Date: 2026-10-04. I ran every check below myself with cwd R.
Sources: `DIRECTION.md` v5, `RULINGS.md` R-1 to R-5, `lanes/foundation.md` (round 4), `reviews/direction.md`. This file replaces the round 3 review.

R-5: the orchestrator (run contract owner) confirmed R-5 to this reviewer directly by link `lm_22` ("R-5 … is mine and is CONFIRMED … Treat R-5 as part of your contract, like R-1..R-4"). So the lint criterion is: touched-file eslint exits 0, and full `pnpm lint` lists no file outside the 17 pre-existing production-swarm files. That closes round 3 fix 1.

## Checks run

| Check | Result |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm exec vitest run packages/site-kit apps/desktop-shell` | exit 0, 38 files, 738 tests |
| `pnpm check:contracts` | exit 0 (`contract check OK — 5 shared authoring jobs valid, …`) |
| `pnpm lint` | exit 1, `✖ 255 problems (255 errors, 0 warnings)` in 17 files, all under `docs/audits/production-swarm/**` or `apps/desktop-shell/test/visual-postpr-evidence/**`; 0 files outside that set. Passes under R-5 |
| `pnpm exec eslint --max-warnings 0` on `design-tokens.ts`, `change-review.ts`, `visual-tokens.ts` | exit 0 |
| `foundationsVariablesCss().value` (built `dist`) | 18 `--motion-*` properties: press 120ms, micro 160, state 200, panel 280, panel-exit 200, route 320, loop 1200, delay-loading 300, quart/quint/expo, stagger 40/200, distance 4/8/16px, scale 0.97/0.98 |
| `foundationsBaseCss()` | has `@media (prefers-reduced-motion: reduce) { :root { distances 0px; scales 1; stagger-step 0ms } }`. Keyframes `sx-fade`, `sx-rise-*`, `sx-draw`, `sx-progress` animate opacity/transform/clip-path only |
| `MOTION` (`apps/desktop-shell/dist/src/visual-tokens.js`) | exported, `Object.isFrozen` true, values match the site tokens (no scale keys, as the lane documents) |
| Token values vs Deviations | design-tokens: lead 18 / body 16 (DV-F2), ui 13 / ui-sm 12 / mono 12–13 (DV-F9), micro 11 at 0.08em + floor 11 (DV-F1, DV-F11), float shadow `0 10px 14px -6px` (DV-F3), motion (DV-F7, DV-F8). visual-tokens: `RADIUS.panel` 16 (DV-D1), `TYPE_SIZE` (DV-D2), `SPACING` +32/44/72 (DV-D3), `ELEVATION.float` (DV-D4), `MOTION` (DV-D5/D6), `DEVIATIONS` rows `dv-d1…dv-d6` (`visual-tokens.ts:348-389`). Each matches `DIRECTION.md:551-571`; `docs/design-foundations.md` names DV-F1…F12 (section at `:214`), `docs/engine-desktop-surface.md:693` names DV-D1…D6. `.sx-status` restyle (`design-tokens.ts:599`) follows `DIRECTION.md:217` and is recorded at `docs/design-foundations.md:285` |
| Ownership: `git status --porcelain` vs `E/backup/status.txt` | 8 new lines: `DESIGN.md`, `PRODUCT.md`, `.impeccable/`, `docs/redesign/`, `docs/design-foundations.md`, `docs/engine-desktop-surface.md`, `change-review.ts`, `design-tokens.ts`. All foundation-owned (§9) or under `docs/redesign` |
| Per-file `git diff --binary` vs `E/backup/unstaged.patch`; `git diff --cached --binary` vs `staged.patch` | Only the 5 foundation files differ from the backup (`visual-tokens.ts` was already dirty: the new hunks are DEVIATIONS rows and the new token tables; the old hunks are intact). Staged index byte-identical. Files newer than the backup outside those: only gitignored `.sceneaxi/evidence/issue-51-cli-golden-path.json` (written by the e2e suite) and excluded `apps/desktop-shell/.impeccable/hook.cache.json` |
| Test assertions | No test file differs from the backup, so nothing was removed or loosened |
| Detector on the 3 `.ts`, both docs, `DESIGN.md`, `PRODUCT.md`, `.impeccable`, `docs/redesign` | `[]` each; exit 0 on the 3 `.ts` |
| `changeReviewCss()` motion | transitions on `transform`/`opacity` only (`change-review.ts:441-443`); keyframes clip-path/transform only (`:491-492`); loop uses the R-1 tokens (`:483`); hover in `@media (hover: hover)` (`:470`); 44px targets under 720px (`:493`); reduced-motion block (`:504-509`) |
| Evidence | `E/after/foundation/` has 15 PNGs (pending/decided/reduced at 390/768/1440, rerun, round3 bulk). I did not view them: this harness cannot display images |

## Fixes

1. **(advisory)** `docs/redesign/lanes/foundation.md:18`: no one has checked the PNGs in `E/after/foundation/` by eye (lane and reviewer both lack an image viewer). The measured numbers back them up. The director's final pass (`E/final/**`) should look at them.
2. **(advisory)** `packages/site-kit/src/index.ts:373`: `FOUNDATION_MOTION`, `FOUNDATION_MOTION_REDUCED`, `FOUNDATION_TEXT_FLOOR_PX` and `FoundationMotionToken` are not re-exported from the package root (lane Request 1, test-owners). The CSS output carries everything, so no lane is blocked.
3. **(advisory)** `apps/desktop-shell/src/visual-tokens.ts:458-583`: the new desktop tokens are not read by `chrome.ts` yet (lane Request 2). lane-desktop must wire them in, or the DV-D rows describe values the desktop does not render.

## PASS criteria

- All four commands exit 0: yes. build, vitest and check:contracts exit 0; lint passes under the confirmed R-5 (17 pre-existing files, 0 outside, touched-file eslint 0).
- `--motion-*` in `foundationsVariablesCss()` and `MOTION` exported: yes.
- Reduced-motion block in `foundationsBaseCss()`: yes.
- Every changed token matches a Deviations row and a docs/`DEVIATIONS` entry: yes.
- No test assertion removed or loosened: yes.
- Detector 0 on touched files: yes.
- Lane report complete: yes.

VERDICT: PASS
