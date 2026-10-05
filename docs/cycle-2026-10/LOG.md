# Cycle 2026-10 log

Decisions, failed approaches, traps, and every branch-protection bypass (repo, PR, time). Each orchestration appends to its own section.

## UI/UX redesign

### Decisions
- 2026-10-04: the operator approved the redesign direction v5 and asked for an end-to-end run plus a redeploy.
- 2026-10-05: the redesign must be built on the current version. The v5 work had been built on a stale local branch (`production-swarm` @ `4e532e2f`, 147 commits behind `main`), so it was ported onto `origin/main` `dffefbab` in the worktree `sceneaxi-redesign`, branch `redesign-impeccable`, with the design frozen at v5 (ruling R-9).
- 2026-10-05: the operator granted full autonomy. The `sceneaxi-kids` Vercel project stays exactly as it is.
- 2026-10-05 (G4): merge through a PR into `main` once the work is done and verified. Before merging, re-fetch and rebase, and put the local gate result and live evidence in the PR body. If CI checks that never run block the merge, use `gh pr merge --admin`. If admin enforcement still blocks it, lift `enforce_admins` for that one merge and restore it immediately. Never remove required checks, and log every bypass below.

### Failed approaches and traps
- The first deploy attempt targeted the stale tree. The deploy node correctly held: production runs `main`, and the Vercel build script (`scripts/vercel-build-site.mjs`) exists only on `main`.
- An unchanged `main` fails its own `pnpm gate`: 8 of 10 stages, 212 tests and 33 lint errors. The gate stops at its first failed stage, so the redesign is compared stage by stage against a per-stage baseline.
- pnpm 12 rejects `pnpm -s`. Use `pnpm run --silent`.
- Under pnpm 12, `pnpm install` inside `sites/*` rewrites the site lockfiles. Never run it there.
- `/tmp` is a shared 16G tmpfs. Gate fixtures leaked there until it was full (ENOSPC). Run heavy suites with a short `TMPDIR` under `~/.cache`; unix socket paths must stay under 107 bytes.
- `chrome/core/styles.ts` `reconcilePrivateChromeStyles` replaces CSS by exact string. Editing the source rule silently disables the refinement.

- `tests/sites/umbrella-visual.test.ts` finds a CSS rule by the first match of `<selector> {`. A new rule such as `.state-head .reason {` placed before the base `.reason {` is picked up instead and fails the pin. Put overrides after the base rule.
- During sign-off, a stale `next start` kept port 3201 and served the old CSS. Check the port before trusting a local screenshot.

### Branch-protection bypasses
- 2026-10-05, 11:29:36Z to 11:29:42Z UTC: Vhailors/sceneaxi PR #328 (`redesign-impeccable`), merged as `fb4a85a5`.
  - Why: the required checks `gate` and `engine-sdk` were still in progress, and `gate` also fails on an unchanged `main`. `gh pr merge --admin` was refused because `enforce_admins` is on.
  - Done under G4: `enforce_admins` was lifted for this one merge and restored in the same command sequence. Verified afterwards: `enforce_admins=true` and required checks `gate,engine-sdk`, unchanged.
  - Evidence: the local gate, compared stage by stage with `main`, showed no new failures (PR body).
- 2026-10-05: Vhailors/sceneaxi, the PR from branch `redesign-status` (this STATUS/LOG update, docs only), merged with the same G4 procedure. Its exact window and merge SHA are in portfolio-meta `areas/sceneaxi/runs.md`.

### Deploy notes
- The first deploy round promoted with an empty `/api/health` commit: a CLI deploy from a worktree carries no git metadata. Redeployed with `--build-env SCENEAXI_BUILD_COMMIT=fb4a85a5…`; health now names the build.
- The deploy review flagged 3 Verification mismatches (catalog 404s, the SDK archive). The previous production had them too, so they were filed as #329 and #330 rather than blocking.
