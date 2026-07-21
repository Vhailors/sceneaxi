# SceneAxi agent notes

## Product identity

SceneAxi = interactive engine/library + versioned profiles (Game, Web Experience, Kids). CLI, shells, importers, and catalogs orbit the core; they are not the core identity.

## Hard rules

- Do not invent captain decisions; the runtime source of truth is the held-key registry snapshot protocol (`docs/held-key-enforcement.md`), generated from FirstMate structured backlog state — the #42 Markdown registry documents keys for humans only.
- Fail closed on held keys in the CLI: missing, stale, invalid, epoch-mismatched, or unknown registry data refuses, exactly like an open key.
- Package boundaries are enforced, not aspirational: `pnpm check:boundaries` against `docs/dependency-matrix.json`; run it after any manifest or import change.
- Kids traffic never uses third-party LLM defaults without an explicit Kids safety decision; nothing may depend on `@sceneaxi/profile-kids` (enforced).
- Do not push, spend, create accounts, create issues, or run the Stage 1 proof without the matching separated authority (`docs/bootstrap.md`).
- Individual games stay out of this monorepo.

## Toolchain

- `pnpm gate` = check:syntax → check:boundaries → build → test → lint; every stage
  is fail-closed (empty surfaces refuse to pass) and exits non-zero on failure.
  Build is strict tsc project references (`tsconfig.base.json` + per-package
  tsconfigs + root `tsconfig.tests.json`); test is Vitest workspace-wide; lint is
  ESLint flat config (`eslint.config.mjs`, `--max-warnings 0`). Never weaken the
  gate: no skips, no `|| true`, no lint disables, no matrix allow-list widening.
- Every package/app exports a frozen typed `seam` from `src/index.ts` (vocabulary
  in `@sceneaxi/schemas`) and owns a seam-level test in its `test/` dir that
  imports it by public package name — test external contracts, never internals.
- The boundary checker's failure behaviour is itself regression-tested:
  `tests/boundary/injected-violations.test.ts` injects forbidden edges into a
  temp fixture and asserts `check-boundaries.mjs` fails; `tests/syntax/` does the
  same for the syntax gate. Extend those fixtures when you extend the checkers.

## Layout

See root README package/app map and `docs/DEPENDENCY-MATRIX.md`. Prefer small public package interfaces (deep modules). The authoring core lives in `packages/authoring-core`; the CLI is a thin protocol adapter over it and may not import engine packages directly.

## Maintaining this file

Rewrite when durable project-wide knowledge changes; prefer pointers over copied process.
