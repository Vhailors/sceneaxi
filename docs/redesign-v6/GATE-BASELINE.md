# Gate baseline: failures that are red at main HEAD (2cef2033)

Recorded 2026-10-06 by lane A5b (foundation tokens). `pnpm run gate` was run step by step
(the same commands, in the same order, as `package.json` `gate`) in two places:

- a clean detached worktree of `main` @ 2cef2033 (`pnpm install --frozen-lockfile --offline`)
- `redesign-v6` with the A5b foundation diff applied

Logs: `~/Documents/Reports/sceneaxi-redesign-v6/a5b/_work/gate-main/` and `.../gate-v6/`.

## Conductor ruling

> Do not touch the ADR-0024 checks/tests, the workspace yaml or the root lockfile. That is an architecture-policy conflict between the owner's Vercel commits and ADR-0024, and the owner decides it in a separate change, not inside a redesign branch.

**Redesign acceptance rule:** `pnpm run gate` may show NO failures beyond the ones listed
here, and every check touching site-kit, desktop-shell tokens, boundaries, syntax and
typecheck/build must be green.

## Failures red at main HEAD

| # | Gate step | Failure (verbatim) | Cause | Refs |
|---|---|---|---|---|
| 1 | `check:sites` | `pnpm-workspace.yaml globs sites/ — sites are separate install roots so the hermetic root lockfile never moves` | ADR-0024 invariant ("sites/desktop are separate install roots; the root lockfile never moves") contradicts the owner's commits that added `sites/umbrella`, `sites/catalog-game` and `sites/catalog-web` to the root workspace for Vercel builds: b21d8437 "sites join workspace", f4cfb6b0 "self-contained Vercel site builds via hoisted site linker", a6e9c593 | `scripts/check-sites.mjs:385-387`, `pnpm-workspace.yaml:4-6` |
| 2 | `check:desktop` | `pnpm-workspace.yaml globs desktop/ — desktop apps are separate install roots so the hermetic root lockfile never moves` | The same ADR-0024 conflict: f4cfb6b0 added `desktop/linux`, `desktop/windows` and `desktop/macos` to the root workspace | `scripts/check-desktop.mjs:117-122`, `pnpm-workspace.yaml:7-9` |
| 3 | `check:publish-ready` | `[manifest-hygiene] pnpm-workspace.yaml declares no workspace packages — refusing to derive an empty tier list` and `[manifest-hygiene] found zero workspace manifests — refusing to pass on an empty surface` | pnpm 12 rewrote `pnpm-workspace.yaml` when it added `allowBuilds` (a6e9c593), normalising the `packages:` list to column-zero `- entry` items. The dependency-free regex parser treats a column-zero line as the next top-level key, so it reads zero entries. This is a consequence of the same workspace-membership change | `scripts/check-publish-ready.mjs:392-393`, `pnpm-workspace.yaml:1-9` |
| 4 | `check:traceability` | `[proof-resolution] tests/ resolution differs` plus 4× `[proof-path] tests/ resolves to stale path tests/helpers/desktop-chrome-golden.{d.ts,d.ts.map,js,js.map}` | The committed proof resolution for `tests/` lists compiled helper outputs that no longer exist on disk (only `tests/helpers/desktop-chrome-golden.ts` is tracked). The manifest was last regenerated in 759adfe9 | `scripts/check-traceability.mjs:439-448`, `assembly/final-completion/approved-candidate-manifest.json:10` |
| 5 | `check:boundaries` | `sites/umbrella/src/app/api/health/route.ts imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade` | 8bafc7a4 added a direct `identity-plane` import to the health route | **FIXED on redesign-v6** (see below) |
| 6 | `test` (vitest) | 20 files / 210 tests at main; see below | — | — |
| 7 | `lint` | 33 errors in 7 files at main; see below | — | — |

The gate's `&&` chain stops at the first red step, so at main HEAD `pnpm run gate` exits
at `check:boundaries`. The steps were therefore run individually to expose every failure.

## Pre-existing fix applied on redesign-v6

- `sites/umbrella/src/app/api/health/route.ts`: `umbrellaConstructionDiagnostics` is now
  imported from `../../../lib/request-authority.js` (the facade) instead of `identity-plane.js`.
- `sites/umbrella/src/lib/request-authority.ts`: re-exports `umbrellaConstructionDiagnostics`
  from `./identity-plane.js`. The function is the same, so behaviour does not change.
- Result: `boundary check OK — 27 packages verified against dependency-matrix.json`.

Also outside the A5b owned set: `sites/umbrella/src/app/icon.svg` changes `#FF6B2C` to v6 enamel
`#F1EEE4`, and the glyph changes from `#07080A` to `--on-enamel` `#1A2623` (13.45:1).

## vitest (`vitest run`, TMPDIR=/home/devuser/.vt)

`node --test scripts/check-contracts.test.mjs` is green on both trees.

| Test file | main | v6 | Cause |
|---|---|---|---|
| tests/publish/injected-publish-violations.test.ts | 50 | 50 | #3 publish-ready parser vs the pnpm-normalised workspace yaml (ADR-0024 conflict) |
| tests/boundary/injected-site-violations.test.ts | 10 | 5 | ADR-0024 conflict (fixture runs check-sites on the real workspace yaml). The 5 boundary-control cases that were red at main are green on v6 because of the #5 fix |
| tests/boundary/injected-desktop-violations.test.ts | 5 | 4 | ADR-0024 conflict. One boundary-control case is fixed by #5 |
| tests/boundary/injected-violations.test.ts | 2 | 0 | #5 (`control: the unmodified tree passes`), fixed on v6 |
| tests/boundary/kids-evidence-scan.test.ts | 1 | 1 | runs check:sites and inherits #1 |
| tests/sites/site-seams.test.ts | 1 | 1 | #1, the root workspace globs sites/ (`tests/sites/site-seams.test.ts:573`) |
| tests/desktop/desktop-linux-seams.test.ts | 1 | 1 | #2, the root workspace globs desktop/ (`tests/desktop/desktop-linux-seams.test.ts:205`) |
| tests/docs/traceability-check.test.ts | 1 | 1 | #4, stale `tests/` proof resolution |
| tests/contracts/injected-traceability-violations.test.ts | 1 | 1 | #4 |
| tests/e2e/desktop-command-interactions-golden.test.ts | 100 | 100 | The golden expects 4 command planes but 3 are registered (`expected [ {plane:'project'…}, …(2) ] to deeply equal [ … …(3) ]`). Desktop command registry, not tokens |
| tests/e2e/desktop-chrome-{frame,inspector,palette}-command-interactions-golden.test.ts | 7+3+3 | 7+3+3 | the same plane-count drift |
| desktop/linux/test/viewport-terminal-lifecycle.test.ts | 14 | 14 | `missing actual BYOK controls` / zeroed render counters (desktop/linux renderer harness) |
| desktop/linux/test/byo-terminal-lifecycle.test.ts | 6 | 6 | same harness |
| tests/sites/identity-plane-wiring.test.ts | 1 | 1 | the `/api/health` body contains `DATABASE_URL` (per-variable configuration states, 5519e625). The test asserts no variable names leak |
| tests/sites/provider-adapters.test.ts | 1 | 1 | the provider-adapter loader no longer matches the `typeof __filename === "string" ? …` source shape |
| desktop/windows/test/final-release-acceptance.test.ts | 1 | 0 | load-sensitive (dirty-checkout/HEAD timing), flaky |
| packages/cli/test/capabilities.test.ts | 1 | 0 | 60 s timeout under load, flaky. Same-load A/B (2026-10-07, umbrella retry 3, tree diff sha 00243aeb…): in the full gate `Test timed out in 60000ms` at load ~22-26. Run alone it passed 3/3 on v6 (9/9, 35-45 s, load 12.68-14.43) and 3/3 on main (built worktree, 9/9, 34-37 s, load 11.49-14.07). Evidence: `a6/_work/gate-g4fix3/ab.tsv` |
| packages/importers/test/asset-preparation-bounds.test.ts | 1 | 0 | main-heartbeat timing under load, flaky. Same-load A/B (2026-10-07, umbrella retry 3): in the full gate the heartbeat hit 103.46 ms > 100 at load ~22-26. Run alone it passed 3/3 on v6 (12/12, load 14.09-18.12) and 3/3 on main (12/12, load 14.33-21.52). Evidence: `a6/_work/gate-g4fix3/ab.tsv` |
| desktop/linux/test/prepared-asset-handoff.test.ts › "admits maximum original bytes … unchanged 100ms heartbeat bound" | 0–1 | 0–1 | load-sensitive, flaky (added 2026-10-06 under the conductor timing-test ruling). Wall-clock bounds: the 100 ms event-loop heartbeat (`:191`) and the 4000 ms `ASSET_PREPARATION_DEADLINE_MS` (`packages/importers/src/asset-preparation-worker.ts:15`). Load never fell below 4 in a 15-minute poll (range 38–81). Same file, run alone, interleaved, at commit 2cef2033. **main** (temp worktree): 2 of 11 runs failed, heartbeat 154.13 ms at load 35.93 and 108.03 ms at load 35.25. **v6**: 2 of 11 runs failed, heartbeat 101.30 ms at load 33.36 and `ok:false` (4322 ms > 4000 ms deadline) at load 45.99. In the full gate: 107.39 ms at load ~40 (first A-rich gate) and 116.38 ms at load ~40 (retry gate, `gate-latest.log`). Evidence: `~/Documents/Reports/sceneaxi-redesign-v6/arich-retry/_work/{ab.tsv,ab-*.log,v6-runs.log,main-runs.log,poll.log}`. Umbrella retry 3 (2026-10-07, tree diff sha 00243aeb…): 123.98 ms in the full gate at load ~22-26. Run alone it passed 3/3 on v6 (load 22.44-25.87) and 3/3 on main (load 21.39-25.19), evidence `a6/_work/gate-g4fix3/ab.tsv` |
| **Total** | **20 files / 210 tests** | **16 files / 199 tests** | |

**The v6 failing set is a strict subset of main's.** `diff` of the per-test failure lists shows
only removals (main-only lines) and no additions. No failing test touches `packages/site-kit`,
`apps/desktop-shell`, design tokens, visual tokens, the state panel, or the catalog/umbrella
visual tests.

## lint (`eslint . --max-warnings 0`)

At main and on v6 the result is the same set of 7 files and 33 errors, mostly `no-undef` in committed Node scripts that sit outside the Node-globals block:
`docs/audits/production-swarm/capacity-work-2026-10-02/{keyboard-ux/source-proof,own-session/check,own-session/proposal,own-session/socket-check}.mjs`,
`docs/audits/production-swarm/final-wiring-2026-10-02/exports/source-extension-resolver.mjs`,
`docs/audits/production-swarm/implementation-expansion-2026-10-02/unsigned-project-build/typecheck-focused.mjs`,
`scripts/fix-trace-entries.mjs`.

The untracked v6 concept prototypes (`docs/redesign-v6/concepts/**`) were adding 6 more files.
They are now excluded with one `globalIgnores` entry in `eslint.config.mjs`. They are throwaway
evidence for the concept council and are never shipped.

## Green on redesign-v6

`check:syntax`, `check:boundaries` (fixed), `check:contracts`, `build`, `node --test`,
`tsc --noEmit` for `@sceneaxi/site-kit`, `@sceneaxi/desktop-shell` and `@sceneaxi/site-umbrella`, and eslint
on every A5b-touched file.
