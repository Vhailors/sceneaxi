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

- [ ] Run the fast structural baseline before expensive work:
  - Execute `pnpm check:syntax`, `pnpm check:boundaries`, `pnpm check:contracts`, `pnpm check:sites`, `pnpm check:desktop`, and `pnpm check:publish-ready` in the root.
  - If a check fails, trace it to the exact owning contract and regression fixture before editing. Fix only a verified repository defect, reuse the closest checker/test pattern, preserve all fail-closed behavior, and never widen an allow list or disable an assertion to obtain green output.
  - Re-run each failed check and its injected-violation regression, then append the command, exit code, and concise result to the baseline receipt.

- [ ] Build and gate the repository as the foundation for every runnable binary:
  - Run `pnpm build`, `pnpm test:golden`, and `pnpm gate`; remember that source-backed exports make `pnpm build` mandatory before any CLI or shell launch.
  - Diagnose any failure against the smallest owning test and specification. Add or adjust a regression test separately from the implementation, make the narrowest safe fix, and re-run the focused test before repeating `pnpm gate`.
  - Do not claim success until the complete gate exits zero. Record duration and pass/fail evidence in the baseline receipt without copying credentials or environment values.

- [ ] Create and drive a disposable SceneAxi project entirely through shipped entrypoints:
  - Create `.maestro/playbooks/Initiation/Working/Phase-01/prototype-project/`; run `pnpm sceneaxi project new --cwd <absolute-prototype-project-path>` and confirm it creates the canonical project files without `--force`.
  - Run `pnpm sceneaxi project test --cwd <absolute-prototype-project-path>` and the CLI help smoke, then start `pnpm sceneaxi-web-shell --port 0 --cwd <absolute-prototype-project-path>` as a managed background process.
  - Parse the printed loopback URL, request `/`, `/api/state`, and `/api/document?path=scene.json`, and confirm successful named responses. Drive one deterministic fixture assistant request and one propose-to-accept edit through the HTTP API using the returned review token; verify the accepted bytes through the CLI and stop the server cleanly.
  - Keep all generated project files and logs under the phase Working folder so this demonstration cannot alter a real user project.

- [ ] Launch the production-built public visual slice and inspect it in a real browser:
  - Run `pnpm --dir sites/umbrella typecheck`, `pnpm --dir sites/umbrella test:provider`, and `pnpm --dir sites/umbrella build`; use no provider credentials and leave the editor preview flag unset.
  - Start the built site on an available loopback port, open `/` and `/open` with the available browser tooling, and confirm there are no console errors, failed same-origin assets, horizontal overflow, or blank/error states at desktop and mobile widths.
  - On `/open`, verify the canvas exists, the frame report identifies `webgl-canvas`, `pixelsDrawn` is true, orbit/reset controls respond, and Reset view returns a stable capture. Take one desktop and one mobile screenshot into the phase Working folder, then stop the server cleanly.
  - Treat browser pixels as browser evidence only; never infer them from the headless gate.

- [ ] Finish the Phase 01 receipt and leave the workspace safe for the audit phases:
  - Update `Baseline.md` with a compact command table, generated-project proof, browser routes and viewport sizes, screenshot links, exact failures fixed, files changed, and any residual blocker; use wiki-links to the specifications that own each claim.
  - Compare `git status --short` with the captured start, separating pre-existing work from Phase 01 changes. Confirm no secret value, credential, cookie, bearer token, or database URL appears in logs or the receipt.
  - Re-run the focused tests for any Phase 01 code change and `pnpm gate`; Phase 01 is complete only when the generated project works, the inspector round-trip writes only after acceptance, `/open` draws in the browser, and the full gate passes.
