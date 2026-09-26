# SceneAxi agent notes

## Product identity

SceneAxi = interactive engine/library + versioned profiles (Game, Web Experience, Kids). CLI, shells, importers, and catalogs orbit the core; they are not the core identity.

## Hard rules

- Do not invent captain decisions; the runtime source of truth is the held-key registry snapshot protocol (`docs/held-key-enforcement.md`), generated from FirstMate structured backlog state — the #42 Markdown registry documents keys for humans only.
- Fail closed on held keys in the CLI: missing, stale, invalid, epoch-mismatched, or unknown registry data refuses, exactly like an open key. The runtime implementation (snapshot generator, currency gate, shipped command map) lives in `packages/cli/src/held-keys/` and is wired into the dispatcher for every verb; the refusal table and both mandatory regressions are fixture-tested in `packages/cli/test/held-keys.*.test.ts` — extend those when touching the protocol.
- Package boundaries are enforced, not aspirational: `pnpm check:boundaries` against `docs/dependency-matrix.json`; run it after any manifest or import change.
- Kids traffic never uses third-party LLM defaults without an explicit Kids safety decision; nothing may depend on `@sceneaxi/profile-kids` (enforced). The dedicated `sites/kids` origin has an empty SceneAxi allow list and no environment/external-data path; its activity reducer is byte-identical to the profile copy by root parity test, never by an import edge (`docs/kids-first-release.md`).
- Do not push, spend, create accounts, create issues, or run the Stage 1 proof without the matching separated authority (`docs/bootstrap.md`).
- Individual games stay out of this monorepo.

## Toolchain

- `pnpm gate` is the required repository check; root `package.json` owns its exact
  sequence (syntax, boundaries, contracts, **sites**, **desktop**, **publish-ready**, build, test, lint). Syntax and test explicitly refuse empty surfaces, and every stage exits
  non-zero on its configured failures. Never weaken the gate: no skips, no `|| true`,
  no lint disables, no matrix allow-list widening.
- Build uses strict tsc project references; package exports remain source-backed and
  `dist` is only a gate artifact. Keep TypeScript on the pinned 5.9 line until
  typescript-eslint supports the TypeScript 7 native preview.
- Every package/app exports a frozen typed `seam` from `src/index.ts` (vocabulary
  in `@sceneaxi/schemas`) and owns a seam-level test in its `test/` dir that
  imports it by public package name — test external contracts, never internals.
- The boundary checker's failure behaviour is itself regression-tested:
  `tests/boundary/injected-violations.test.ts` injects forbidden edges into a
  temp fixture and asserts `check-boundaries.mjs` fails; `tests/syntax/` does the
  same for the syntax gate. Extend those fixtures when you extend the checkers.
  Those suites, and the `bin-smoke` ones, are process-level: they copy the tree
  and spawn a real checker or binary, and their per-test fixture copy runs in a
  hook. `vitest.config.ts` owns the one matched `testTimeout`/`hookTimeout` pair
  that keeps them from going red on host speed instead of on a violation — a
  wall-clock allowance covering both the body and its setup, never a skipped
  assertion, and not a place to hide a slow test.
- Package exports are source-backed, which Node cannot follow at runtime, so the
  workspace binaries run `tsc --build` output through the shared resolver
  `scripts/workspace-dist-resolver.mjs` (mapping derived from the dependency
  matrix). **`pnpm build` is a prerequisite for running any binary.** Note the
  gate's own blind spots: `check-syntax` and the boundary checker scan only
  `<pkg>/src`, so nothing under `bin/` is covered by either.

## Runnable surfaces

`docs/runnable-surfaces.md` is the authoritative map of what can actually be
started, each surface's level, and the proof behind the claim. Update that owner
when a surface changes level instead of copying its current inventory here.

How far each profile's open path may be **demonstrated** is a separate, shared
contract: `docs/open-path-policy.md`, implemented in
`packages/schemas/src/open-path-policy.ts` (+ `contracts/open-path-policy.*`) and
read — through the narrow site-kit re-export for the umbrella `/profiles` page — by
`profile-game`, `profile-web`, `sceneaxi profile
open-path`, `sceneaxi-desktop open-path`, and web-shell's `createOpenPathView()`.
It lives in `schemas` because that is the only package all five may name, so
parity cost no matrix edge. `shippingClaim` is structurally `false` and Kids is
refuse-only; parity is asserted as a data identity in
`tests/parity/open-path-policy-parity.test.ts`, and doc/fixture/table drift is
caught by `pnpm check:contracts` (regressed by
`tests/contracts/injected-open-path-drift.test.ts`).

Adding a CLI verb means three things together, or dispatch refuses: a node in
`ROOT_COMMANDS`, a declaration in `SHIPPED_COMMAND_MAP`, and — for any verb that
parses flags — `takesArgs: true`, which is what makes the verb (not the
dispatcher) responsible for refusing unknown flags. `pnpm test:golden` must cover
every surface claimed runnable.

`apps/web-shell` is startable (sceneaxi#120) without adding a second authoring
implementation: keep routes in transport-free `src/inspector-app.ts` and socket
ownership in `src/dev-server.ts`. `apps/web-shell/README.md` owns its run and
fail-closed contract; this remains local authoring, not the deployable `sites/`
tier (ADR 0018).

## Program docs

- `docs/program/SPEC.md` — consumer copy of the canonical product spec ([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1); on disagreement #1 wins).
- `docs/program/spec-41.md` — pointer to factories-helpers#41, source of truth for the Stage 0–8 engine-core proof program, plus the transfer classification.
- `docs/program/NEXT-STEP.md` — evidence-based program position (main SHA, landed PRs, recorded captain-decision dispositions, known gaps) and the options under consideration. It authorizes nothing and owns no fact: where it disagrees with an ADR, doc, issue, or PR, that owner wins.
- `docs/proof/` — proof-prep docs only; Stage 1 is double-gated and nothing in that directory is a run authorization.

## Layout

See root README package/app map and `docs/DEPENDENCY-MATRIX.md`. Prefer small public package interfaces (deep modules). The authoring core lives in `packages/authoring-core`; the CLI is a thin protocol adapter over it and, for the fixed contained-copy verb, `packages/importers`, and may not import engine packages directly.

Full package ownership map, contracts and seams: `docs/agents/layout.md`. Read the section for the package you touch before changing it.

## Maintaining this file

Rewrite when durable project-wide knowledge changes; prefer pointers over copied process. Keep this file short: package and ownership detail goes in `docs/agents/layout.md`, not here.
