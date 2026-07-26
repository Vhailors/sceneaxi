# SceneAxi

**SceneAxi** is an agent-native interactive **engine/library** ecosystem: versioned engine packages plus separately versioned **Game**, **Web Experience**, and **Kids** profiles over one runtime/authoring core.

This monorepo is the packaging home for:

| Area | Location |
|---|---|
| Engine packages | `packages/engine-*` (kernel, presentation, orchestrator seeded; asset-compiler, platform-host, evidence delayed) |
| Runtime/authoring core | `packages/authoring-core` (document model, propose/apply service, sessions, evidence hooks, Model Provider Port) |
| Profiles | `packages/profile-*` |
| Agent-first CLI | `packages/cli` (thin protocol adapter over authoring-core) |
| Shared schemas / external importers | `packages/schemas`, `packages/importers` |
| Model-provider adapters | `packages/provider-openrouter` (fixture-tested, injected transport behind the Model Provider Port) |
| Plugin host | `packages/plugin-host` (explicit capability-manifest loading and refusal) |
| Identity plane | `packages/auth` (single-admin env resolution, fail-closed role guards, Kids-isolated identity port over an injected Better Auth adapter) |
| Credits + billing | `packages/billing` (append-only credit ledger, metering, free-vs-paid enforcement, Stripe test-mode checkout and signed-webhook grants, creator revenue share) |
| Neon schema | `db/migrations` (forward-only SQL; append-only ledger trigger, at-most-one-admin index) |
| Web / desktop shells | `apps/web-shell`, `apps/desktop-shell` |
| Asset catalogs (may split later) | `apps/catalog-game`, `apps/catalog-web` |
| Deployable web surfaces | `sites/umbrella`, `sites/catalog-game`, `sites/catalog-web` over `packages/site-kit` (ADR 0018; deploy details in [`docs/websites-deploy.md`](docs/websites-deploy.md)) |
| Public live open path | `sites/umbrella/src/app/open/` — a committed Sculpt Artifact composed and drawn in a real WebGL canvas (ADR 0022) |

**Not in this monorepo:** individual game products (separate repos).

The `sites/` tier is deliberately outside the hermetic root workspace: each site is its
own single-package pnpm workspace and install root with its own lockfile, so a
web-framework dependency never moves the root lockfile or the gate runtime. The tier is
still gated — `pnpm check:syntax`,
`pnpm check:boundaries`, and `pnpm check:sites` all cover it, and all site logic lives in
`packages/site-kit` where `pnpm gate` tests it. The tier's one engine edge is
umbrella → `@sceneaxi/engine-presentation` for every viewport the umbrella owns — the
public `/open` surface and the entitled `/editor` surface alike (ADR 0022); every
other engine package stays denied to every site. The umbrella is also the one site wired
to the identity plane (`@sceneaxi/auth` + `@sceneaxi/billing`, ADR 0021) and only through
`sites/umbrella/src/lib/identity-plane.ts`; the catalogs read identity through the same
`site-kit` ports and take no second auth stack.

Package boundaries are executable: `docs/dependency-matrix.json` is the allow/deny
truth and `pnpm check:boundaries` enforces it (see `docs/DEPENDENCY-MATRIX.md`).
Held captain decisions are a runtime contract: `docs/held-key-enforcement.md`.
Authoring-interface behavioral contracts (E1/E2) are SceneAxi-owned:
[`docs/authoring-contracts.md`](docs/authoring-contracts.md), with the shared
authoring-jobs fixture list in
[`packages/schemas/contracts/`](packages/schemas/contracts/) enforced by
`pnpm check:contracts`.
External web products follow the published-package support and pinning contract
in [`docs/web-consumer.md`](docs/web-consumer.md); the in-repo `sites/` surfaces are
first-party and are not governed by it.
The public engine SDK archive is built by `pnpm build:sdk` — a deterministic zip plus
SHA-256 checksum, not an npm publish (ADR 0019). Publish readiness is proven
structurally rather than by publishing: the version plan, the export surface, and the
executable checklist behind them are
[`docs/publish-readiness.md`](docs/publish-readiness.md), enforced by
`pnpm check:publish-ready`.
Portable product exports cross delivery boundaries through the public,
delivery-neutral [`Delivery Handoff` contract](docs/delivery-handoff.md); provider
credentials, uploads, approvals, and adapter implementation stay outside core.
The first-class v1 Plugin Host contract is documented in
[`docs/plugins.md`](docs/plugins.md): plugins are isolated packages that claim
only versioned public capability IDs, never arbitrary hooks or engine-internal
ports.
The locked hybrid [`site and domain topology`](docs/program/site-domain-topology.md)
assigns canonical ownership across the umbrella product/docs site, two distinct
asset storefronts, and the fully isolated Kids domain/origin; exact domain names
and purchases remain outside its scope.

The post-MVP [hybrid sculpt vertical](CONTEXT.md) opens a versioned Sculpt
Intake as a SceneAxi-owned Sculpt Artifact, mounts it through a backend-neutral
API, runs it under kernel authority, and exposes the fixed Minimum E2 checklist.
Presentation is the [Three presentation core](docs/three-presentation-core.md):
its browser surface draws real pixels through `WebGLRenderer` when a consumer
supplies a canvas, while node gates use its deterministic headless surface. The
umbrella's public live open path (`/open`) is the shipped consumer of that canvas
surface (ADR 0022). Deterministic fixture and live-demo evidence lives at
[`issue-73-hybrid-sculpt-golden.json`](.sceneaxi/evidence/issue-73-hybrid-sculpt-golden.json).

The additive [sculpt-quality v1 layer](docs/sculpt-quality.md) deepens that same
path with deterministic multi-pass specs, detail-inventory refusals, a versioned
animation-ready hierarchy, and a real seeded procedural emit. Its two committed
demos and fixed digest ledger live under
[`tests/e2e/fixtures/sculpt-quality/`](tests/e2e/fixtures/sculpt-quality/).
This is contract and demo evidence only: it adds no Minimum E2 checklist item,
Stage 1 result, renderer decision, production physics, provider spend, or
engine-readiness claim.

[Scene composition v1](docs/scene-composition.md) composes several validated
Sculpt Artifacts into one openable multi-object scene: a deterministic
axis-aligned placement contract that fails closed on a named refuse matrix, a
projection into the existing text-canonical document, and one multi-object kernel
session. Its committed three-instance demo and digest ledger live under
[`tests/e2e/fixtures/scene-composition/`](tests/e2e/fixtures/scene-composition/),
and it adds no presentation adapter, checklist item, renderer decision, or spend.

## Development

Install the pinned workspace toolchain with `pnpm install`, then run `pnpm gate`
for the repository's required syntax, boundary, contract, site-structure,
publish-readiness, build, test, and lint checks. The root `package.json` owns the exact
command sequence; the referenced TypeScript, Vitest, ESLint, boundary, contract, and
site-checker configuration files own their respective contracts, and
[`docs/publish-readiness.md`](docs/publish-readiness.md) owns the publish-ready one.

After building, start the two terminal surfaces from the repository root:

```bash
pnpm build
pnpm sceneaxi --help
pnpm sceneaxi-desktop --help
```

Run `pnpm test:golden` for the focused product/profile and sculpt paths.
[`docs/runnable-surfaces.md`](docs/runnable-surfaces.md) owns the complete
surface inventory, levels, invocation requirements, and proof locations.
`pnpm gate` runs the same e2e tests through the complete suite.

## Status

**Early implementation aggregate.** The monorepo has a real fail-closed toolchain,
typed public seams for every package and app, and initial contract/tracer
implementations for authoring, the CLI, the Game Kernel, Game profile conformance,
the Web Experience and Kids policy stubs, the public Delivery Handoff, a
startable desktop protocol shell, the library-only web shell, the Plugin Host,
dormant app-tier catalogs, and the gate-tested `site-kit` logic behind the three
deployable sites. The engine, profiles, and dormant apps remain proof-oriented; the
three first-party sites have the bounded, fail-closed deployment status recorded in
[`docs/websites-deploy.md`](docs/websites-deploy.md). This is not a claim that the
engine, profiles, or applications are production-ready. Proof execution, spend,
account creation, publication, and other external actions remain subject to the
separated authorities in `docs/bootstrap.md`.

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
authorization. E1 is the normative authoring contract; general E2 remains
specified but not built. ADR 0003 permits only the hybrid vertical's fixed
Minimum E2 checklist, whose save/load still uses E1 propose/apply. Both bind to the same machine-readable
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
- Three.js is the product presentation core behind the unchanged deep presentation seam ([ADR 0017](docs/adr/0017-three-product-presentation-core.md)) — not the product name. The Stage 1 Three-Kernel composition question stays a separate falsifiable hypothesis under its own held authority; no renderer winner is claimed.
