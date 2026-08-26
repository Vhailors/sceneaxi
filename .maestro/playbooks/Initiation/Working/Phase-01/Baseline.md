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
The toolchain record is governed by [[Bootstrap]] and [[Runnable-Surfaces]].

## Phase 01 toolchain provisioning

| Command | Exit code | Result |
|---|---:|---|
| `node --version` | 0 | `v24.14.0`; satisfies the root `package.json` engine range |
| `pnpm --version` | 0 | `9.15.0`; matches the pinned `pnpm@9.15.0` package-manager declaration |
| `pnpm install --frozen-lockfile` | 0 | Root workspace dependencies already up to date |
| `pnpm --dir desktop/linux install --frozen-lockfile` | 0 | Desktop dependencies already up to date |
| `pnpm --dir sites/umbrella install --frozen-lockfile` | 0 | Umbrella dependencies installed successfully |

The frozen install inputs remained unchanged: `git diff -- package.json pnpm-lock.yaml desktop/linux/package.json desktop/linux/pnpm-lock.yaml sites/umbrella/package.json sites/umbrella/pnpm-lock.yaml` produced no output. The only install-time diagnostic was Node's existing `url.parse()` deprecation warning; no dependency-install blocker was reported. Pre-existing modified and untracked paths remain unchanged.

## Fast structural baseline
The structural checks are owned by [[Dependency-Matrix]], [[Publish-Readiness]], and [[Runnable-Surfaces]].

The fast checks were run against the current checkout below. The initial syntax and desktop attempts exposed only missing local dependencies, not repository defects; the pinned frozen installs restored those dependencies without changing manifests or lockfiles.

| Current checkout field | Value |
|---|---|
| Branch | `maestro/phase-02-requirement-inventory` |
| Full HEAD SHA | `eecd6acade08a48b7599832bb1598b3e11bddf72` |
| `git status --short` | Empty |

| Command | Exit code | Result |
|---|---:|---|
| `pnpm install --frozen-lockfile` | 0 | Restored root pinned dependencies; no manifest or lockfile changes |
| `pnpm check:syntax` (initial attempt) | 1 | Refused because root `typescript` was absent from `node_modules` |
| `pnpm check:syntax` (rerun) | 0 | 335 source files parse as TypeScript modules |
| `pnpm vitest run tests/syntax/check-syntax.test.ts` | 0 | Syntax checker regression: 1 file, 4 tests passed |
| `pnpm check:boundaries` | 0 | 26 packages verified against `docs/dependency-matrix.json` |
| `pnpm check:contracts` | 0 | Shared contracts, fixtures, registry, and documentation are consistent |
| `pnpm check:sites` | 0 | 4 deployable sites verified |
| `pnpm --dir desktop/linux install --frozen-lockfile` | 0 | Restored desktop pinned dependencies; no manifest or lockfile changes |
| `pnpm check:desktop` (initial attempt) | 1 | Refused because desktop `esbuild` was absent from `node_modules` |
| `pnpm check:desktop` (rerun) | 0 | 3 desktop apps verified; privileged imports and install-root boundaries hold |
| `pnpm vitest run tests/boundary/injected-desktop-violations.test.ts` | 0 | Desktop boundary regression: 1 file, 27 tests passed |
| `pnpm check:publish-ready` | 0 | 16 documented publish-readiness checks passed |

No source defect was identified, so no code or regression fixture was edited. No credentials or environment values were recorded.
## Foundation build and gate
The build and gate evidence follows [[Runnable-Surfaces]] and [[Three-Presentation-Core]].

The required foundation commands ran against the exact checkout recorded above. No source, contract, manifest, or lockfile changes were needed.

| Command | Exit code | Duration | Result |
|---|---:|---:|---|
| `pnpm build` | 0 | 19.84s | TypeScript project and test builds completed |
| `pnpm test:golden` | 0 | 23.94s | 51 test files passed; 448 tests passed |
| `pnpm gate` | 0 | 127.67s | Syntax, boundaries, contracts, sites, desktop, publish readiness, build, full test, and lint all passed; 262 test files and 3,916 tests passed |

The gate emitted expected headless Three.js WebGL-context refusal diagnostics from tests that verify node cannot claim canvas pixels; these were passing assertions, not gate failures. It also exercised temporary test branches and restored the working checkout to `maestro/phase-02-requirement-inventory` at `eecd6acade08a48b7599832bb1598b3e11bddf72`. No exact failure was fixed and no credentials or environment values were recorded.
## Generated project and inspector proof

The disposable project stayed under the phase Working folder:
`.maestro/playbooks/Initiation/Working/Phase-01/prototype-project/`.
The shipped CLI created `scene.json` without `--force`; its accepted document
now contains the fixture value `{"x":21}`. This follows the project and
authoring contracts in [[Authoring-Contracts]] and [[Bootstrap]].

| Surface | Result |
|---|---|
| `pnpm sceneaxi project new --document scene.json --title "Phase 01 Prototype" --data '{"entities":[]}' --cwd <prototype>` | Exit 0; canonical project and document created |
| `pnpm sceneaxi project test --document scene.json --cwd <prototype>` | Exit 0; schema and text-canonical checks passed |
| `pnpm sceneaxi --help` | Exit 0; shipped command map printed |
| `pnpm sceneaxi-web-shell --port 0 --cwd <prototype>` | Managed loopback server started and stopped cleanly |
| `/` | HTTP 200; inspector HTML returned |
| `/api/state` | HTTP 200; idle state and no review token before proposing |
| `/api/document?path=scene.json` | HTTP 200; document id `scene`, initial hash `sha256:3ff7a1bc3a0cc4ac8473ac7cd452d9e6c1bc3c622ad0af404a1103b0b1beafeb` |

The fixture assistant returned `fixture completion` with `metered: false`.
`/api/propose` entered `reviewing` and produced a rendered diff while the
document bytes stayed unchanged; `/api/accept` entered `applied`, after which
the CLI revalidation passed with
`sha256:9f711b35514046ac5c408159cdc20411f8911e23d0cfae353653d45661e0515c`.
The route and round-trip records remain in
[`inspector-routes.json`](inspector-routes.json) and
[`inspector-roundtrip.json`](inspector-roundtrip.json).

## Browser proof

The production-built umbrella ran at `http://127.0.0.1:4173` with
`NEXT_TELEMETRY_DISABLED=1`, no provider credentials, and
`SCENEAXI_SITE_EDITOR_PREVIEW` unset. `pnpm --dir sites/umbrella typecheck`,
`pnpm --dir sites/umbrella test:provider` (17 tests), and
`pnpm --dir sites/umbrella build` all exited 0. The server was stopped after
the browser pass.

Chromium checked `/` and `/open` at 1440×1000 and 390×844. Each route and
viewport had visible content, no blank or refusal state, no console or page
errors, no failed requests, no same-origin response at or above 400, and no
horizontal overflow. On `/open`, the canvas reported backend `three`, draw
surface `webgl-canvas`, `pixelsDrawn=true`, 15 draw calls, and mounted
instances `service-crate-left`, `service-crate-root`, and
`service-crate-stacked`. Orbit changed the canvas capture; Reset view produced
two matching stable captures at both widths. These browser-only claims follow
[[Three-Presentation-Core]], [[Scene-Composition]], and [[Runnable-Surfaces]].

Screenshots:

- [`umbrella-open-desktop.png`](umbrella-open-desktop.png), 1440×3572 capture
- [`umbrella-open-mobile.png`](umbrella-open-mobile.png), 390×4540 capture

Both screenshots were reviewed: the desktop and mobile pages show the live
viewport, frame report, composition evidence, action controls, and the
responsive stacked layout without a visible blank or error surface.

## Failures and disposition
The failure dispositions preserve the fail-closed rules in [[Bootstrap]].

| First failure | Disposition |
|---|---|
| `pnpm check:syntax` refused because root `typescript` was absent | Restored the pinned root dependencies with `pnpm install --frozen-lockfile`; rerun passed |
| `pnpm check:desktop` refused because desktop `esbuild` was absent | Restored the pinned desktop dependencies with `pnpm --dir desktop/linux install --frozen-lockfile`; rerun passed |
| Umbrella `typecheck` could not resolve its missing install root | Restored `sites/umbrella` with `pnpm --dir sites/umbrella install --frozen-lockfile`; rerun passed |
| The initial project command shorthand omitted the required `--document` flag | Used the shipped command with `--document`; no source defect was found |

No residual blocker remains. The frozen install inputs stayed unchanged, and
the only install diagnostic was Node's existing `url.parse()` deprecation
warning.

## Worktree safety and final verification
The comparison and safety record feeds [[Initiation-Audit]] and preserves the
starting constraints in [[Bootstrap]].

The captured starting status was the six modified product paths plus the
untracked `.maestro/` and `tests/gauntlet/` roots recorded above. The current
checkout is branch
`maestro/phase-02-requirement-inventory` at
`eecd6acade08a48b7599832bb1598b3e11bddf72`; its seven status entries are all
Phase 01 receipt, evidence, screenshot, or disposable-project files under
`.maestro/playbooks/Initiation/`. No current status entry touches the
captured product paths or `tests/gauntlet/`. The branch and all current paths
were rechecked after the gate; no cleanup, reset, stash, restore, commit,
push, deploy, or unrelated overwrite occurred.

The Git status paths currently present are:

- `.maestro/playbooks/Initiation/Phase-01-Trusted-Baseline-and-Live-Prototype.md`
- `.maestro/playbooks/Initiation/Working/Phase-01/Baseline.md`
- `.maestro/playbooks/Initiation/Working/Phase-01/inspector-roundtrip.json`
- `.maestro/playbooks/Initiation/Working/Phase-01/inspector-routes.json`
- `.maestro/playbooks/Initiation/Working/Phase-01/prototype-project/scene.json`
- `.maestro/playbooks/Initiation/Working/Phase-01/umbrella-open-desktop.png`
- `.maestro/playbooks/Initiation/Working/Phase-01/umbrella-open-mobile.png`

The generated prototype also contains three ignored runtime journal files
under `.maestro/playbooks/Initiation/Working/Phase-01/prototype-project/.sceneaxi/journal/`:
`.active`, `1787755219322-e707d4a0c5e647e1.json`, and
`.completion-sequence`. They stay inside the Working folder and are not
`git status` entries.
The generated-project evidence remains governed by [[Authoring-Contracts]] and
[[Bootstrap]].

No commit or push was performed. The repository workflow forbids automatic
VCS side effects, so the validated artifacts remain in the worktree for the
next audit phase.

The phase Working folder was scanned for bearer credentials, cookies,
passwords, secrets, database URLs, provider keys, and authorization headers;
no matches were found. The receipt and evidence records contain no secret
value, credential, cookie, bearer token, or database URL.

Phase 01 made no source-code change, so no focused code regression test was
needed. The final `pnpm gate` exited 0: 262 test files and 3,916 tests passed,
with syntax, boundaries, contracts, sites, desktop, publish readiness, build,
tests, and lint all green. The complete proof is therefore the generated
project round-trip, the post-accept byte change, the browser `/open` draw
report, and the passing full gate.
