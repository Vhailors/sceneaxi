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
Authoring-interface behavioral contracts (E1/E2) are SceneAxi-owned:
[`docs/authoring-contracts.md`](docs/authoring-contracts.md), with the shared
authoring-jobs fixture list in
[`packages/schemas/contracts/`](packages/schemas/contracts/) enforced by
`pnpm check:contracts`.
External web products follow the published-package support and pinning contract
in [`docs/web-consumer.md`](docs/web-consumer.md).
Portable product exports cross delivery boundaries through the public,
delivery-neutral [`Delivery Handoff` contract](docs/delivery-handoff.md); provider
credentials, uploads, approvals, and adapter implementation stay outside core.
The first-class v1 Plugin Host contract is documented in
[`docs/plugins.md`](docs/plugins.md): plugins are isolated packages that claim
only versioned public capability IDs, never arbitrary hooks or engine-internal
ports.

## Development

Install the pinned workspace toolchain with `pnpm install`, then run `pnpm gate`
for the repository's required syntax, boundary, contract, build, test, and lint
checks. The root `package.json` owns the exact command sequence; the referenced
TypeScript, Vitest, ESLint, boundary, and contract-checker configuration files own
their respective contracts.

## Status

**Early implementation aggregate.** The monorepo has a real fail-closed toolchain,
typed public seams for every package and app, and initial contract/tracer
implementations for authoring, the CLI, the Game Kernel, Game profile conformance,
the Web Experience and Kids policy stubs, the public Delivery Handoff, shell
protocol clients, and dormant catalogs. This remains proof-oriented work, not a
claim that the engine, profiles, or applications are production-ready. Proof
execution, spend, account creation, publication, and other external actions remain
subject to the separated authorities in `docs/bootstrap.md`.

Main landed the bootstrap tree at commit `f0a5b90` (independent non-Claude **v4
review PASS**, 2026-07-21) under the separated bootstrap authorities in
`docs/bootstrap.md`. Bootstrap authorities 1–5 have been exercised for that tree;
every future change re-earns its own grants (PASS ≠ commit ≠ push ≠ merge).

The canonical product spec is [#1](https://github.com/Vhailors/sceneaxi/issues/1),
mirrored in-tree at [`docs/program/SPEC.md`](docs/program/SPEC.md). The
engine-core proof program stays on
factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41)
(pointer: [`docs/program/spec-41.md`](docs/program/spec-41.md)); proof-prep docs
land under [`docs/proof/`](docs/proof/README.md), double-gated and never a run
authorization. E1 is the normative authoring contract; E2 remains specified but
not built, and both bind to the same machine-readable
[`authoring-jobs.fixtures.json`](packages/schemas/contracts/authoring-jobs.fixtures.json)
list. Settled engine/CLI decisions are
indexed in [`docs/adr/`](docs/adr/README.md).

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
