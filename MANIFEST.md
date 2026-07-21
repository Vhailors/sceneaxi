# Bootstrap draft manifest

Produced: 2026-07-21 (remediated same day after the non-Claude review FAIL)  
Location: FirstMate data only — **not** applied to `Vhailors/sceneaxi` or `projects/sceneaxi`.

**FROZEN — not applyable** until the post-FAIL remediations pass is complete **and** a
fresh independent non-Claude review passes over the amended chart and this exact tree.
Application then still requires its own separated authorities (`docs/bootstrap.md`).

## Contents

- Root README, AGENTS.md, .gitignore, pnpm-workspace, package.json, .env.example
- Package stubs: engine-kernel, engine-presentation, engine-orchestrator,
  authoring-core, profile-game, profile-web, profile-kids, cli, schemas, importers
- App stubs: web-shell, desktop-shell, catalog-game, catalog-web
- Internal workspace dependency edges declared in every manifest (machine-checkable
  seed of the boundary rules; no external packages)
- `docs/dependency-matrix.json` + `docs/DEPENDENCY-MATRIX.md` — complete allow/deny
  matrix, Kids boundary, delayed-package slots, release groups, profile core pins
- `scripts/check-boundaries.mjs`, `scripts/check-syntax.mjs` — executable checks
  (`pnpm check:boundaries`, `pnpm check:syntax`); `pnpm gate` fails while
  build/test/lint are unwired
- `docs/held-key-enforcement.md` + `packages/schemas/contracts/*.schema.json` —
  held-key runtime protocol and versioned registry/command-map contracts
- `docs/bootstrap.md` — application procedure with separated authorities

## Explicitly excluded from this draft

- Lockfiles, node_modules, external (registry) dependencies
- CI workflows that publish packages
- License text (until license decision)
- Any git commit
- Any GitHub issue creation or transfer (owned by the issue-transfer plan under its
  own authority)
