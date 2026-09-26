# Contributing to SceneAxi

## Set up the repository

Use the pinned pnpm version from `package.json`.

```sh
pnpm install
pnpm build
```

`pnpm build` prepares the generated workspace output used by repository binaries.

## Verify changes

Run `pnpm gate` before proposing a change. It checks syntax, package boundaries, contracts, traceability, sites, desktop packages, publish readiness, build, tests, and lint.

Do not widen package dependencies to make an import work. `pnpm check:boundaries` enforces `docs/dependency-matrix.json`; update the matrix only when an approved ownership change requires it.

## Commit changes

Use conventional commit subjects, such as `feat:`, `fix:`, `docs:`, or `chore:`.

## Find owner guidance

Read [`AGENTS.md`](AGENTS.md) for repository rules. Package and subsystem owners are listed in [`docs/agents/layout.md`](docs/agents/layout.md); follow the linked owner documents and tests for the area you change.
