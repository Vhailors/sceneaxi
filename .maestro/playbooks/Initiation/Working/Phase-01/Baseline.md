---
type: report
title: SceneAxi Phase 01 Starting Baseline
created: 2026-08-26
tags:
  - sceneaxi
  - baseline
  - initiation
related:
  - '[[Runnable-Surfaces]]'
  - '[[Initiation-Audit]]'
---

# SceneAxi Phase 01 Starting Baseline

Captured before any Phase 01 implementation or dependency work.

## Repository identity

| Field | Value |
|---|---|
| Branch | `main` |
| Full HEAD SHA | `9873ea3bd5f012c4b84ceccca60739ec5111d9d1` |
| Captured at (UTC) | `2026-08-26T10:06:16Z` |
| Node | `v24.14.0` |
| pnpm | `9.15.0` |
| Package-manager pin | `pnpm@9.15.0` from `package.json` |
| Node requirement | `^20.19.0 \|\| ^22.13.0 \|\| >=24` from `package.json` |

## Starting `git status --short`

The following changes predate Phase 01 and must be preserved:

```text
 M apps/desktop-shell/src/chrome.ts
 M apps/desktop-shell/test/chrome.test.ts
 M sites/catalog-game/src/app/globals.css
 M sites/catalog-web/src/app/globals.css
 M sites/umbrella/src/app/globals.css
 M vitest.config.ts
?? .maestro/
?? tests/gauntlet/
```

No cleanup, reset, stash, restore, commit, push, deploy, gate weakening, or unrelated overwrite was performed for this baseline task.

## Sources read

- `AGENTS.md`
- `CONTEXT.md`
- `README.md`
- `package.json`
- `docs/program/SPEC.md`
- `docs/runnable-surfaces.md`
- `docs/held-key-enforcement.md`
- `docs/bootstrap.md`

The canonical specification and settled repository contracts are treated as constraints. The runnable-surface record is linked as [[Runnable-Surfaces]], and the later audit deliverable is linked as [[Initiation-Audit]].

## Baseline status

This receipt captures the starting state and Phase 01 toolchain provisioning.

## Phase 01 toolchain provisioning

| Command | Exit code | Result |
|---|---:|---|
| `node --version` | 0 | `v24.14.0`; satisfies the root `package.json` engine range |
| `pnpm --version` | 0 | `9.15.0`; matches the pinned `pnpm@9.15.0` package-manager declaration |
| `pnpm install --frozen-lockfile` | 0 | Root workspace dependencies already up to date |
| `pnpm --dir desktop/linux install --frozen-lockfile` | 0 | Desktop dependencies already up to date |
| `pnpm --dir sites/umbrella install --frozen-lockfile` | 0 | Umbrella dependencies installed successfully |

The frozen install inputs remained unchanged: `git diff -- package.json pnpm-lock.yaml desktop/linux/package.json desktop/linux/pnpm-lock.yaml sites/umbrella/package.json sites/umbrella/pnpm-lock.yaml` produced no output. The only install-time diagnostic was Node's existing `url.parse()` deprecation warning; no dependency-install blocker was reported. Pre-existing modified and untracked paths remain unchanged.

