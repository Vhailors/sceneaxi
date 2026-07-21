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

## Development

Install the pinned workspace toolchain with `pnpm install`, then run `pnpm gate`
for the repository's required build, test, lint, syntax, and boundary checks. The
root `package.json` owns the exact command sequence; the referenced TypeScript,
Vitest, ESLint, and boundary-checker configuration files own their respective
contracts.

## Status

**Early implementation seed.** The monorepo has a real fail-closed toolchain and
minimal typed public seams for every seeded package and app. Domain implementations
are intentionally deferred to later tickets; a green gate does not mean the engine,
profiles, or applications are production-ready. Proof execution, spend, account
creation, publication, and other external actions remain subject to the separated
authorities in `docs/bootstrap.md`.

## Authority

- Program chart: FirstMate factories secondmate, Wayfinder origin `threejs-bgf-ecosystem-wayfinder-v1` (chart report, map, tickets, and the issue-transfer plan live there, outside this repo by design until transfer authority exists).
- Prior proof program: factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41)
- Issue transfer: governed by the issue-transfer plan in the FirstMate program archive; **no issue creation is part of bootstrap**.

## Boundaries

- Kids profile is separately safety-gated; nothing may depend on it (enforced).
- Factory methodology remains owned by factories-helpers; SceneAxi consumes contracts, it does not absorb the factory.
- No Stage 1 proof execution without dual gates (captain tier-3 decisions + explicit run authorization).
- Three.js remains a falsifiable renderer hypothesis inside the engine, not the product name.
