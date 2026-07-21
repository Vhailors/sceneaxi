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

## Program docs

- `docs/program/SPEC.md` — consumer copy of the canonical product spec ([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1); on disagreement #1 wins).
- `docs/program/spec-41.md` — pointer to factories-helpers#41, source of truth for the Stage 0–8 engine-core proof program, plus the transfer classification.
- `docs/proof/` — proof-prep docs only; Stage 1 is double-gated and nothing in that directory is a run authorization.

## Layout

See root README package/app map and `docs/DEPENDENCY-MATRIX.md`. Prefer small public package interfaces (deep modules). The authoring core lives in `packages/authoring-core`; the CLI is a thin protocol adapter over it and may not import engine packages directly.

## Maintaining this file

Rewrite when durable project-wide knowledge changes; prefer pointers over copied process.
