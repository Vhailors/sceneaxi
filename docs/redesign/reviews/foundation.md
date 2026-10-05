# Review: foundation (port run, DIRECTION v6), re-review

Date: 2026-10-05. Independent reviewer, second pass. The first pass gave FAIL on one blocking fix: `foundationsBaseCss()` had no reduced-motion block. I ran every result below myself in R (`redesign-impeccable` on `dffefbab`). The heavy commands used TMPDIR `/home/devuser/.cache/sx2113363`, which I removed afterwards.

## Checks run

| Check | Result |
|---|---|
| `pnpm build` | exit 0 (`tsc --build && tsc -p tsconfig.tests.json`) |
| `pnpm exec vitest run packages/site-kit apps/desktop-shell` | exit 0: 66 files, 785 tests passed |
| `pnpm run --silent check:contracts` | exit 0: `contract check OK — 5 shared authoring jobs valid, …` |
| `pnpm run --silent lint` | exit 1: `✖ 33 problems (33 errors, 0 warnings)`. I sorted the 33 error lines and diffed them against the `lint` stage of `E/backup/gate-baseline.log`: identical. The 7 files are 6 under `docs/audits/production-swarm/**` plus `scripts/fix-trace-entries.mjs`. None is new, so this counts as passing under rule 7 / R-5. |
| Runtime output, from the built `packages/site-kit/dist/src/design-tokens.js` | `foundationsVariablesCss()` emits `--motion-fast: 120ms`, `--motion-base: 200ms` and `--ease-standard`, plus `--type-micro-size: 11px` / `--type-micro-tracking: 0.08em` and the DV-F3 float shadow. `foundationsBaseCss()` emits a one-line `@media (prefers-reduced-motion: reduce) { :root { …6 overrides… } }`. `foundationsMotionCss()` emits a `:root` with 18 `--motion-*` declarations. |
| Runtime output, from the built `apps/desktop-shell/dist/src/visual-tokens.js` | `MOTION` = `{fast:100, base:160, slow:220, …}`: main's values, and the diff has no `MOTION` line. `MOTION_SYSTEM`, 16 `MOTION_CUSTOM_PROPERTIES` and `DEVIATIONS` rows `dv-d1` to `dv-d9` are present. |
| Detector `--json` on the 6 touched files plus `lanes/foundation.md` | exit 0, `[]` |
| `git status --porcelain` against `E/backup/status.txt` | The newly modified paths are `packages/site-kit/src/{design-tokens,change-review,index}.ts`, `apps/desktop-shell/src/visual-tokens.ts`, `docs/design-foundations.md` and `docs/engine-desktop-surface.md`, all foundation-owned (DIRECTION §9 row 4). The only new untracked path is `docs/redesign/`. `.empryo/` no longer shows. |
| `index.ts` diff | adds exports only (+9 lines, 0 removed) |
| Test or spec files changed | none (`git diff --name-only` has no test or spec path) |
| Doc lines removed | 0 in either doc (additions only) |
| `change-review.ts` diff | CSS string only. Every `data-sx-*` hook, aria attribute, text and glyph is unchanged. |
| Lockfiles | `git diff --quiet -- pnpm-lock.yaml sites/kids/pnpm-lock.yaml`: unchanged |

## PASS criteria

- **All four commands exit 0. Met.** Build, vitest and contracts exit 0. Lint exits 1 only with the exact baseline set (rule 7).
- **Motion custom properties appear in `foundationsVariablesCss` output. Met.** The three D-4 lines are emitted (`packages/site-kit/src/design-tokens.ts:585`). DV-P1 (DIRECTION.md:638) puts the §6.1 set in `foundationsMotionCss()` (`:647-663`), because `design-tokens.test.ts:294-318` pins the emitter.
- **`MOTION` is exported from `apps/desktop-shell/src/visual-tokens.ts`. Met.** `MOTION` is at `:554` and unchanged. `MOTION_SYSTEM` is at `:638`, `MOTION_CUSTOM_PROPERTIES` at `:659` and `MOTION_REDUCED_CUSTOM_PROPERTIES` at `:682`.
- **A prefers-reduced-motion block exists in `foundationsBaseCss`. Met** (first-pass fix 1 is resolved). The block is at `design-tokens.ts:608,620` and is built from `FOUNDATION_MOTION_SYSTEM_REDUCED`. It is written on one line, so the D-4 line pin still passes; vitest is green.
- **Every changed token value matches a Deviations row and a docs entry. Met.**
  - lead/body: DV-F2. ui/ui-sm/mono: DV-F9. micro size and tracking: DV-F1 + DV-F11. Float shadow: DV-F3.
  - `.sx-status` mono 11px at 0.08em: DV-F1/F11, `docs/design-foundations.md:453`.
  - Desktop: DV-D1 (`CHROME_RADIUS.panel` 16), DV-D2 (`TYPE_SIZE`), DV-D3 (`SPACING` +32/44/72; the existing keys keep their values) and DV-D4 (`ELEVATION.float`), under DV-P5.
  - Each id is cited in `docs/design-foundations.md` § "Redesign 2026-10" (`:372`) or `docs/engine-desktop-surface.md:693`.
- **No test assertion removed or loosened. Met.** No test file changed.
- **Detector 0 on touched files. Met.**
- **`docs/redesign/lanes/foundation.md` complete. Met.** It covers files, token values, the motion table, checks with exit codes, the re-run section, browser proof and Requests.

## Fixes

1. (advisory) `packages/site-kit/src/change-review.ts:443`: `:active` uses `scale(var(--motion-scale-press))`. That is correct for the web shell. If a later lane serves `changeReviewCss()` on the umbrella or a storefront, it would conflict with DV-P3 and `umbrella-visual.test.ts:438-452`. Today nothing on main serves it (`design-foundations.md:466` records this). The serving lane must override it.
2. (advisory) `packages/site-kit/src/change-review.ts:459-…`: the `data-sx-decision` / `data-sx-outcome` resolution styles are CSS-only. No code on main sets these attributes, so the row 14 motion stays invisible until a consumer does (lane Request 4). This is carried over from the first pass.
3. (advisory) `docs/redesign/lanes/foundation.md:89,105`: the browser proof used headless Chromium, not its own tab, and nobody looked at the PNGs in `E/after/foundation/`. I could not view them either. A later visual pass (gate or final) should look at them.
4. (advisory) `apps/desktop-shell/src/visual-tokens.ts:424-430`: the `dv-d6-loading-loop` row now correctly says the retiming is pending. lane-desktop must still land it (`assistant-bars`, `sweep`), or the row stays a promise.

No blocking fix.

VERDICT: PASS
