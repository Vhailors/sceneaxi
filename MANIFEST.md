# Initial bootstrap manifest

Produced: 2026-07-21 (remediated same day after the non-Claude review FAIL)  
Original location: FirstMate data before application to `Vhailors/sceneaxi` as
commit `f0a5b90`.

This is a historical inventory of the reviewed bootstrap input, not the current
repository manifest. See [`README.md`](README.md) for current status and
[`docs/bootstrap.md`](docs/bootstrap.md) for the authority record.

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

## Explicitly excluded from the original draft

- Lockfiles, node_modules, external (registry) dependencies
- CI workflows that publish packages
- License text (until license decision)
- Any git commit
- Any GitHub issue creation or transfer (owned by the issue-transfer plan under its
  own authority)
