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

## Layout

See root README package/app map and `docs/DEPENDENCY-MATRIX.md`. Prefer small public package interfaces (deep modules). The authoring core lives in `packages/authoring-core`; the CLI is a thin protocol adapter over it and may not import engine packages directly. Authoring behavior (CLI `project` verbs, propose/apply) is governed by `docs/authoring-contracts.md` (E1 normative, E2 specified-not-built); the shared authoring-jobs fixture list is canonical in `packages/schemas/contracts/authoring-jobs.fixtures.json` and `pnpm check:contracts` keeps doc and JSON in sync.

## Maintaining this file

Rewrite when durable project-wide knowledge changes; prefer pointers over copied process.
