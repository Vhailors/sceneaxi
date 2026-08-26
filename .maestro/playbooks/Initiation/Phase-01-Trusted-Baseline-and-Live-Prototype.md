# Phase 01: Trusted Baseline and Live Prototype

Establish a repeatable foundation without disturbing current work, then prove the existing product through a generated project, the loopback authoring inspector, the CLI, and the public Three.js open path. This phase requires no credentials, network provider, captain decision, or user response; it ends with working local surfaces and a dated baseline receipt for later phases.

## Tasks

- [x] Capture and protect the starting state before changing anything:
  - Read `AGENTS.md`, `CONTEXT.md`, `README.md`, `package.json`, `docs/program/SPEC.md`, `docs/runnable-surfaces.md`, `docs/held-key-enforcement.md`, and `docs/bootstrap.md`; treat the canonical specs and settled ADRs as constraints, not suggestions.
  - Record the branch, full HEAD SHA, `git status --short`, installed Node and pnpm versions, and current UTC time in `.maestro/playbooks/Initiation/Working/Phase-01/Baseline.md` with YAML front matter (`type: report`, title, created date, tags `[sceneaxi, baseline, initiation]`) and links to `[[Runnable-Surfaces]]` and `[[Initiation-Audit]]`.
  - Preserve every pre-existing modified or untracked file. Do not clean, reset, stash, restore, commit, push, deploy, weaken a gate, or overwrite unrelated work; if later work touches an already-dirty file, integrate with its current contents and retain the user's changes.

> **Completed 2026-08-26:** Starting state recorded in `.maestro/playbooks/Initiation/Working/Phase-01/Baseline.md`. The existing modified and untracked paths listed there were preserved; no cleanup, reset, stash, restore, commit, push, deploy, gate weakening, or unrelated overwrite was performed.

- [x] Provision the pinned local toolchain without changing manifests or lockfiles:
  - Confirm the runtime satisfies `package.json`; use the repository's pinned pnpm version through Corepack when needed.
  - Run `pnpm install --frozen-lockfile` at the repository root, `pnpm --dir desktop/linux install --frozen-lockfile`, and `pnpm --dir sites/umbrella install --frozen-lockfile`.
  - Verify `git diff -- package.json pnpm-lock.yaml desktop/linux/package.json desktop/linux/pnpm-lock.yaml sites/umbrella/package.json sites/umbrella/pnpm-lock.yaml` is empty relative to the captured starting state; stop dependency installation and record a named blocker in the baseline receipt if the frozen inputs cannot install, but continue with already-installed dependencies when they are usable.
> **Completed 2026-08-26:** Node `v24.14.0` and pnpm `9.15.0` satisfy the pinned toolchain. All three frozen installs exited 0; root and desktop dependencies were already current, and the umbrella dependencies installed. The six manifest/lockfile paths remained unchanged, with no dependency-install blocker.

- [x] Run the fast structural baseline before expensive work:
  - Execute `pnpm check:syntax`, `pnpm check:boundaries`, `pnpm check:contracts`, `pnpm check:sites`, `pnpm check:desktop`, and `pnpm check:publish-ready` in the root.
  - If a check fails, trace it to the exact owning contract and regression fixture before editing. Fix only a verified repository defect, reuse the closest checker/test pattern, preserve all fail-closed behavior, and never widen an allow list or disable an assertion to obtain green output.
  - Re-run each failed check and its injected-violation regression, then append the command, exit code, and concise result to the baseline receipt.
> **Completed 2026-08-26:** The fast checks passed after restoring missing root and desktop dependencies with frozen installs. `pnpm check:syntax`, `pnpm check:boundaries`, `pnpm check:contracts`, `pnpm check:sites`, `pnpm check:desktop`, and `pnpm check:publish-ready` all exited 0; the receipt records the two initial environment-only failures and reruns in `Working/Phase-01/Baseline.md`. No source defect or contract change was found.

- [x] Build and gate the repository as the foundation for every runnable binary:
  - Run `pnpm build`, `pnpm test:golden`, and `pnpm gate`; remember that source-backed exports make `pnpm build` mandatory before any CLI or shell launch.
  - Diagnose any failure against the smallest owning test and specification. Add or adjust a regression test separately from the implementation, make the narrowest safe fix, and re-run the focused test before repeating `pnpm gate`.
  - Do not claim success until the complete gate exits zero. Record duration and pass/fail evidence in the baseline receipt without copying credentials or environment values.
> **Completed 2026-08-26:** `pnpm build` (19.84s), `pnpm test:golden` (23.94s; 51 files / 448 tests), and `pnpm gate` (127.67s; 262 files / 3,916 tests) all exited 0. The full gate covered syntax, boundaries, contracts, sites, desktop, publish readiness, build, test, and lint. No source or contract defect required a fix; the exact checkout and pre-existing work remain preserved, with evidence in `Working/Phase-01/Baseline.md`.

- [x] Create and drive a disposable SceneAxi project entirely through shipped entrypoints:
  - Create `.maestro/playbooks/Initiation/Working/Phase-01/prototype-project/`; run `pnpm sceneaxi project new --cwd <absolute-prototype-project-path>` and confirm it creates the canonical project files without `--force`.
  - Run `pnpm sceneaxi project test --cwd <absolute-prototype-project-path>` and the CLI help smoke, then start `pnpm sceneaxi-web-shell --port 0 --cwd <absolute-prototype-project-path>` as a managed background process.
  - Parse the printed loopback URL, request `/`, `/api/state`, and `/api/document?path=scene.json`, and confirm successful named responses. Drive one deterministic fixture assistant request and one propose-to-accept edit through the HTTP API using the returned review token; verify the accepted bytes through the CLI and stop the server cleanly.
  - Keep all generated project files and logs under the phase Working folder so this demonstration cannot alter a real user project.

> **Completed 2026-08-26:** Created `.maestro/playbooks/Initiation/Working/Phase-01/prototype-project/` with `scene.json` through `pnpm sceneaxi project new --document scene.json --title "Phase 01 Prototype" --data '{"entities":[]}' --cwd <absolute-path>`. The CLI requires the explicit `--document` flag for both `project new` and `project test`; the task shorthand without it was refused as `VALIDATION`, then the documented entrypoint completed successfully without `--force`.
>
> `pnpm sceneaxi project test --document scene.json --cwd <absolute-path>` passed schema and text-canonical checks, and `pnpm sceneaxi --help` returned the shipped command map. The managed loopback inspector served `/`, `/api/state`, and `/api/document?path=scene.json` with HTTP 200. The default fixture assistant returned `fixture completion` with `metered: false`; a valid `/api/propose` → `/api/accept` round-trip returned HTTP 200, kept bytes unchanged during review, and wrote `{"x":21}` only after acceptance. The accepted document was revalidated through the CLI with content hash `sha256:9f711b35514046ac5c408159cdc20411f8911e23d0cfae353653d45661e0515c`; route and round-trip evidence remains in the Working-folder JSON records. The inspector was stopped after the run, and a direct runtime shutdown check exited 0; generated files and evidence remain under the phase Working folder.
- [x] Launch the production-built public visual slice and inspect it in a real browser:
  - Run `pnpm --dir sites/umbrella typecheck`, `pnpm --dir sites/umbrella test:provider`, and `pnpm --dir sites/umbrella build`; use no provider credentials and leave the editor preview flag unset.
  - Start the built site on an available loopback port, open `/` and `/open` with the available browser tooling, and confirm there are no console errors, failed same-origin assets, horizontal overflow, or blank/error states at desktop and mobile widths.
  - On `/open`, verify the canvas exists, the frame report identifies `webgl-canvas`, `pixelsDrawn` is true, orbit/reset controls respond, and Reset view returns a stable capture. Take one desktop and one mobile screenshot into the phase Working folder, then stop the server cleanly.
  - Treat browser pixels as browser evidence only; never infer them from the headless gate.

> **Completed 2026-08-26:** The first typecheck attempt exposed a missing `sites/umbrella/node_modules` install root, not a source failure; `pnpm --dir sites/umbrella install --frozen-lockfile` restored the already-pinned dependencies without changing manifests or lockfiles. The required `typecheck` passed, `test:provider` passed (17 tests), and the production `build` passed; Next reported only the existing Autoprefixer mixed-support and missing ESLint-plugin warnings.
>
> The production server ran at `http://127.0.0.1:4173` with `NEXT_TELEMETRY_DISABLED=1`, no provider credentials, and `SCENEAXI_SITE_EDITOR_PREVIEW` unset. Chromium inspected `/` and `/open` at 1440×1000 and 390×844. All four route/viewport combinations had visible main content, no blank/refusal state, no console errors, no page errors, no failed requests, no same-origin response ≥400, and `scrollWidth === clientWidth`. `/open` reported backend `three`, draw surface `webgl-canvas`, `pixelsDrawn=true`, 15 draw calls, and mounted instances `service-crate-left`, `service-crate-root`, and `service-crate-stacked`; orbit changed the canvas pixels and Reset view produced two matching stable captures at both widths.
>
> Browser screenshots: [`umbrella-open-desktop.png`](Working/Phase-01/umbrella-open-desktop.png) and [`umbrella-open-mobile.png`](Working/Phase-01/umbrella-open-mobile.png). The managed production server was stopped after capture.
- [x] Finish the Phase 01 receipt and leave the workspace safe for the audit phases:
  - Update `Baseline.md` with a compact command table, generated-project proof, browser routes and viewport sizes, screenshot links, exact failures fixed, files changed, and any residual blocker; use wiki-links to the specifications that own each claim.
  - Compare `git status --short` with the captured start, separating pre-existing work from Phase 01 changes. Confirm no secret value, credential, cookie, bearer token, or database URL appears in logs or the receipt.
  - Re-run the focused tests for any Phase 01 code change and `pnpm gate`; Phase 01 is complete only when the generated project works, the inspector round-trip writes only after acceptance, `/open` draws in the browser, and the full gate passes.

> **Completed 2026-08-26:** Expanded `Working/Phase-01/Baseline.md` with the command and route table, generated-project and inspector round-trip evidence, browser route/viewport proof, screenshot links, image review, exact environment failures and dispositions, current-versus-captured worktree status, the secret scan result, and the final gate result. Phase 01 added no source code, so focused code tests were not applicable; the final `pnpm gate` passed with 262 test files and 3,916 tests. The working tree remains limited to the preserved Phase 01 artifacts under `.maestro/playbooks/Initiation/`.
