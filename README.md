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
`docs/authoring-contracts.md`, with the shared authoring-jobs fixture list in
`packages/schemas/contracts/` enforced by `pnpm check:contracts`.

## Status

**Frozen bootstrap draft**, prepared offline under the FirstMate home. The GitHub
repository `Vhailors/sceneaxi` exists and is intentionally empty. This tree is
applyable only after the post-FAIL remediations pass and a fresh independent
non-Claude review PASS, and then only under the separated authorities in
`docs/bootstrap.md` (apply, install, initial commit, push, transfer, proof, spend,
and publication are each their own grant).

## Authority

- Program chart: FirstMate factories secondmate, Wayfinder origin `threejs-bgf-ecosystem-wayfinder-v1` (chart report, map, tickets, and the issue-transfer plan live there, outside this repo by design until transfer authority exists).
- Prior proof program: factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41)
- Issue transfer: governed by the issue-transfer plan in the FirstMate program archive; **no issue creation is part of bootstrap**.

## Boundaries

- Kids profile is separately safety-gated; nothing may depend on it (enforced).
- Factory methodology remains owned by factories-helpers; SceneAxi consumes contracts, it does not absorb the factory.
- No Stage 1 proof execution without dual gates (captain tier-3 decisions + explicit run authorization).
- Three.js remains a falsifiable renderer hypothesis inside the engine, not the product name.
