# SceneAxi

**SceneAxi** is an agent-native interactive **engine/library** ecosystem: versioned engine packages plus separately versioned **Game**, **Web Experience**, and **Kids** profiles over one runtime/authoring core.

This monorepo is the packaging home for:

| Area | Location |
|---|---|
| Engine packages | `packages/engine-*` (kernel, presentation, orchestrator seeded; asset-compiler, platform-host, evidence delayed) |
| Runtime/authoring core | `packages/authoring-core` (document model, propose/apply service, sessions, evidence hooks, Model Provider Port) |
| Profiles | `packages/profile-*` |
| Agent-first CLI | `packages/cli` (thin protocol adapter over authoring-core) |
| Shared schemas / importers | `packages/schemas`, `packages/importers` |
| Web / desktop shells | `apps/web-shell`, `apps/desktop-shell` |
| Asset catalogs (may split later) | `apps/catalog-game`, `apps/catalog-web` |

**Not in this monorepo:** individual game products (separate repos).

Package boundaries are executable: `docs/dependency-matrix.json` is the allow/deny
truth and `pnpm check:boundaries` enforces it (see `docs/DEPENDENCY-MATRIX.md`).
Held captain decisions are a runtime contract: `docs/held-key-enforcement.md`.

## Status

**Early bootstrap scaffold.** The repository contains package and app stubs,
shared contracts, executable syntax and dependency-boundary checks, and the
settled engine/CLI decisions indexed in [`docs/adr/`](docs/adr/README.md). It
does not yet contain a shipped runtime: build, test, and lint remain intentionally
fail-closed until they are wired. The separated-authority rules that still apply
are recorded in [`docs/bootstrap.md`](docs/bootstrap.md).

## Authority

- Program chart: FirstMate factories secondmate, Wayfinder origin
  `threejs-bgf-ecosystem-wayfinder-v1`. Settled engine/CLI decisions transferred
  from that program are recorded in [`docs/adr/`](docs/adr/README.md); each ADR
  carries its source and split lineage.
- Prior proof program: factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41)
- Issue creation and transfer remain separate authorities; a completed transfer
  grants no authority for another issue operation.

## Boundaries

- Kids profile is separately safety-gated; nothing may depend on it (enforced).
- Factory methodology remains owned by factories-helpers; SceneAxi consumes contracts, it does not absorb the factory.
- No Stage 1 proof execution without dual gates (captain tier-3 decisions + explicit run authorization).
- Three.js remains a falsifiable renderer hypothesis inside the engine, not the product name.
