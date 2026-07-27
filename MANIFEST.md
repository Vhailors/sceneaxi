# Repository manifest

The authoritative package and app inventory, implementation status, and common
development command are maintained in `README.md`.

- `package.json` owns the executable toolchain commands and declared development
  dependencies; `pnpm-lock.yaml` owns their resolved versions.
- `docs/dependency-matrix.json` owns package boundaries, release groups, and profile
  core pins; `docs/DEPENDENCY-MATRIX.md` explains that schema-backed contract.
- `docs/held-key-enforcement.md` and `packages/schemas/contracts/*.schema.json` own
  the held-key runtime protocol and its versioned schemas.
- `docs/bootstrap.md` owns the separated authority requirements that remain in force.
- `docs/adr/` indexes settled engine/CLI design decisions transferred into this repo.
- `docs/program/` and `docs/proof/` hold program docs (spec mirrors, the locked site
  topology, the next-step brief) and proof-prep docs only; AGENTS.md § "Program docs"
  names each owner.

## Historical bootstrap inventory

Produced: 2026-07-21 (remediated same day after the non-Claude review FAIL)  
Original location: FirstMate data before application to `Vhailors/sceneaxi` as
commit `f0a5b90`.

This section is a historical inventory of the reviewed bootstrap input, not the
current live toolchain description. At bootstrap, `pnpm check:boundaries` and
`pnpm check:syntax` were wired while build/test/lint remained intentionally
fail-closed; the live gate is owned by root `package.json` today.

### Contents of the original draft

- Root README, AGENTS.md, .gitignore, pnpm-workspace, package.json, .env.example
- Package stubs: engine-kernel, engine-presentation, engine-orchestrator,
  authoring-core, profile-game, profile-web, profile-kids, cli, schemas, importers
- App stubs: web-shell, desktop-shell, catalog-game, catalog-web
- Internal workspace dependency edges declared in every manifest (machine-checkable
  seed of the boundary rules; no external packages)
- `docs/dependency-matrix.json` + `docs/DEPENDENCY-MATRIX.md` — complete allow/deny
  matrix, Kids boundary, delayed-package slots, release groups, profile core pins
- `scripts/check-boundaries.mjs`, `scripts/check-syntax.mjs` — executable checks
- `docs/held-key-enforcement.md` + `packages/schemas/contracts/*.schema.json` —
  held-key runtime protocol and versioned registry/command-map contracts
- `docs/bootstrap.md` — application procedure with separated authorities

### Explicitly excluded from the original draft

- Lockfiles, node_modules, external (registry) dependencies
- CI workflows that publish packages
- License text (until license decision)
- Any git commit
- Any GitHub issue creation or transfer (owned by the issue-transfer plan under its
  own authority)
