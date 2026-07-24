# Package dependency allow/deny matrix

**Machine-readable truth:** `docs/dependency-matrix.json` (schemaVersion 1), enforced by
`scripts/check-boundaries.mjs` (`pnpm check:boundaries`). This document explains the
matrix; when the two disagree, the JSON + checker win and the disagreement is a defect.

**Rule:** packages depend downward only. Allow lists are exhaustive — any internal
(`@sceneaxi/*`) dependency declaration or source import not on a package's allow list
**fails the boundary check**. Everything not explicitly allowed is denied.

## Layering

```text
L0  schemas            (zero dependencies by rule)
L1  engine packages    kernel ← presentation, orchestrator   (+ delayed: asset-compiler,
                                                              platform-host, evidence)
L2  authoring-core     the one agent-native runtime/authoring core (document model,
                       propose/apply service, session orchestration, evidence hooks,
                       Model Provider Port)
L3  profiles · cli · importers · provider adapters · plugin-host
L4  apps               (leaves; nothing depends on an app)
```

## Allow matrix (✓ = allowed; blank = denied)

| From \ To | schemas | engine-kernel | engine-presentation | engine-orchestrator | authoring-core | profile-* | cli | external adapters | plugin-host | apps/* |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| schemas | — | | | | | | | | | |
| engine-kernel | ✓ | — | | | | | | | | |
| engine-presentation | ✓ | ✓ | — | | | | | | | |
| engine-orchestrator | ✓ | ✓ | | — | | | | | | |
| authoring-core | ✓ | ✓ | ✓ | ✓ | — | | | | | |
| profile-game / profile-web / profile-kids | ✓ | ✓ | ✓ | ✓ | ✓ | — (never each other) | | | | |
| cli | ✓ | | | | ✓ | | — | | | |
| importers / provider-openrouter | ✓ | | | | ✓ | | | — | | |
| plugin-host | ✓ | | | | | | | | — | |
| web-shell / desktop-shell | ✓ | | | | ✓ | | | | | — |
| catalog-game / catalog-web | ✓ | | | | | | | | | — |

Deliberate denials that carry design intent:

- **cli → engine packages: denied.** The CLI is a thin protocol adapter (verbs +
  envelope) over `authoring-core`. Denying direct engine access makes it structurally
  impossible for the orbiting CLI to become the missing core (Sol review F2).
- **shells → cli: denied.** Shells are protocol *clients* of `authoring-core`'s
  application service — one behavior, many faces — not spawners of the CLI binary.
- **catalogs → authoring-core/engine/profiles: denied.** Catalogs touch the Core only
  through the catalog pipeline contracts in `schemas`.
- **profile → profile: denied.** Profiles never import each other.
- **anything → profile-kids: denied** (Kids boundary below).
- **anything → apps, anything → cli: denied.** Apps and the CLI are leaves.
- **plugin-host → engine packages / authoring-core / profiles: denied.** The Plugin
  Host (ADR 0005) consumes only public contracts from `schemas`; it must not grow
  an engine service locator or absorb engine internals.

## Kids policy boundary (hard)

`dependency-matrix.json → kidsBoundary`: no package or app may depend on or import
`@sceneaxi/profile-kids`. `allowedDependents` remains **empty** under the locked Kids
isolation boundary. The checker enforces this independently of the allow lists, so
allow-list drift cannot silently open the Kids boundary. The separate Kids surface and
origin boundary is owned by
[`docs/program/site-domain-topology.md`](program/site-domain-topology.md).

## Delayed packages (accounted, not seeded)

Spec #41's six deep modules map to six engine packages. Seeded now: **engine-kernel**
(Game Kernel), **engine-presentation** (Presentation Runtime), **engine-orchestrator**
(Factory Orchestrator). Delayed, arriving with the proof program's landings:
**engine-asset-compiler**, **engine-platform-host**, **engine-evidence**. Their intended
allow lists are recorded in the matrix `delayed` section so they land into a declared
slot, not an invented one. The fixture-tested **provider-openrouter** adapter is seeded
behind the Model Provider Port in `authoring-core`; the generic
`@sceneaxi/provider-<name>` delayed entry reserves the same boundary for additional
adapters. The locked provider policy and its adapter conditions are owned by the
canonical product spec
([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1)).

## Release groups and pins

Recorded in `dependency-matrix.json → releaseGroups` and stamped on every manifest as
`sceneaxi.releaseGroup` (checker-verified against the matrix):

- **contracts** (`schemas`): own versions; consumers refuse major mismatches.
- **core-train** (`engine-*`, `authoring-core`): one shared semver train — a "core release".
- **profile** (`profile-*`): independently versioned; each manifest MUST carry
  `sceneaxi.corePin` — the semver range of the core train it supports (bootstrap value
  `^0.0.0`; becomes a real range at the first core release).
- **cli-protocol** (`cli`): versions with its protocol envelope; output-schema changes
  are semver events.
- **importers** (external importers and provider adapters), **plugin-host**,
  **apps**: independent / private.
  `plugin-host` is independently versioned and may depend only on `schemas`.
