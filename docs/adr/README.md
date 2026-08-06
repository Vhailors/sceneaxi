# Architecture Decision Records (ADRs)

This directory records **settled design decisions** for the SceneAxi engine/CLI —
decisions already made by the Wayfinder design-it-twice process (origin
`threejs-bgf-ecosystem-wayfinder-v1`, condensed in factories-helpers
[#41](https://github.com/Vhailors/factories-helpers/issues/41)) — so future work
respects them without re-litigating.

## Hard guardrails

- ADRs record settled **design** decisions only. No ADR may answer, imply, or
  narrow an open **captain decision key** (runtime protocol:
  [`docs/held-key-enforcement.md`](../held-key-enforcement.md); human-facing
  registry: factories-helpers
  [#42](https://github.com/Vhailors/factories-helpers/issues/42)).
- No ADR may presume the Three Kernel hypothesis wins Stage 1 of the proof
  program, or cite the **product** choice of Three as Stage 1 evidence. Stage 1
  stays double-gated (tier-3 captain decisions **and** explicit run
  authorization) under factories-helpers
  [#41](https://github.com/Vhailors/factories-helpers/issues/41). Three.js being
  the product presentation core
  ([ADR 0017](0017-three-product-presentation-core.md), captain product decision)
  says nothing about that proof, removes no arm, and must never be quoted as its
  outcome. The deep presentation seam
  ([ADR 0002](0002-presentation-runtime-deep-seam.md)) is kept regardless.

## Split lineage (transferred-from: factories-helpers#46)

These ADRs are the **engine/CLI half** of factories-helpers
[#46](https://github.com/Vhailors/factories-helpers/issues/46) ("record the
Wayfinder design-it-twice decisions"), **split** per the issue-transfer plan and
recorded here by [sceneaxi#4](https://github.com/Vhailors/sceneaxi/issues/4)
(label `transferred-from: factories-helpers#46`). The **factory-side** decisions
— notably the F1-first factory lifecycle (stages as file contracts, F2 service
deferred) — **stay recorded on factories-helpers#46**, which remains open for
that half. Cross-links run both ways; neither repo's ADRs supersede the other's.

## Convention

`NNNN-short-title.md`, numbered in order of adoption, one decision per file.
Every ADR carries: Status / Context / Decision / Consequences / Rejected
alternatives, plus a **Settled here vs held elsewhere** section separating the
recorded design decision from adjacent open captain holds, and lineage headers
naming its source.

## Index

| ADR | Decision |
|---|---|
| [0001](0001-game-kernel-command-snapshot-session.md) | Game Kernel external interface is a command/snapshot session (Design A) |
| [0002](0002-presentation-runtime-deep-seam.md) | Presentation seam is a deep Presentation Runtime (backend hidden; this ADR chooses no backend) |
| [0003](0003-editor-sequencing-e1-first-e2-specified.md) | Editor sequencing: E1 first; general E2 specified-not-built; bounded hybrid exception |
| [0004](0004-no-plugin-ports-before-two-adapters.md) | Seam discipline: no internal-library ports before two real adapters (Model Provider Port and v1 Plugin Host / capability registry excepted) |
| [0005](0005-plugin-host-capability-manifest.md) | Plugin Host uses versioned capability manifests and a fail-closed public capability registry |
| [0006](0006-hybrid-core-and-ai-sculpt.md) | Hybrid Godot-like core plus AI sculpt authoring is the post-MVP vertical direction |
| [0007](0007-sceneaxi-owned-sculpt-artifacts.md) | SceneAxi owns Sculpt Intake, ObjectSculptSpec, reconstruction, and Sculpt Artifact contracts |
| [0008](0008-experimental-three-preview-non-decision.md) | Three preview was experimental and not a Stage 1 decision — superseded for product surfaces by 0017 |
| [0009](0009-kernel-owned-toy-physics-animation.md) | Toy physics and animation sockets advance only under kernel authority |
| [0010](0010-multi-pass-sculpt-quality-gates.md) | Sculpt-quality ObjectSculptSpec branches require deterministic pass order and non-trivial detail inventory; preserved PR #75 branches do not |
| [0011](0011-animation-ready-hierarchy-and-procedural-emit.md) | Sculpt-quality Artifact branches bind animation-ready hierarchy metadata and seeded procedural emit; preserved PR #75 branches do not |
| [0012](0012-offline-agent-assistance-default-off.md) | Optional sculpt agent assistance is injected, offline, deterministic, and default-off |
| [0013](0013-sculpt-quality-minimal-support-bound.md) | Sculpt-quality demos use existing Mount/kernel/Minimum E2 support without expansion |
| [0014](0014-scene-composition-contract.md) | Scene composition is a SceneAxi-owned deterministic contract with axis-aligned placement and a fail-closed refuse matrix |
| [0015](0015-scene-minimal-multi-object-open-path.md) | Scene composition adds one multi-object kernel session and no presentation adapter |
| [0016](0016-portable-kernel-digest.md) | Kernel session digests come from a portable synchronous sha256, so sessions open in a browser |
| [0017](0017-three-product-presentation-core.md) | Three.js is the product presentation core behind the unchanged ADR 0002 seam; Stage 1 unaffected |
| [0018](0018-sites-tier-three-vercel-one-neon.md) | A `sites/` tier of first-party deployable surfaces: three Vercel projects, one Neon database, framework deps out of the hermetic tier (2026-08-06 amendment: the dependency-empty `sites/kids` origin joined the tier; Kids deploy still held) |
| [0019](0019-public-engine-sdk-zip-not-npm.md) | The public engine download is a deterministic SDK zip with a checksum, not an npm publish |
| [0020](0020-minimum-e2-web-editor-entitlement.md) | The Minimum E2 web editor is entitled by credits or the unused 100-credit starter allotment; admin unrestricted |
| [0021](0021-identity-credits-injected-adapters.md) | The identity/credits plane ships as contracts and ports with injected Better Auth, Neon, and Stripe adapters; webhook verification stays in core; plain SQL over Drizzle (2026-07-31 amendment: the umbrella sign-in surface landed; 2026-08-06 amendment: a TEST-only Connect seam landed with one narrow durable money-split exception, LIVE still held) |
| [0022](0022-umbrella-owns-the-public-viewport.md) | The umbrella site owns every viewport — public `/open` and entitled `/editor` (2026-07-26 amendment) — and is the only site allowed to consume `@sceneaxi/engine-presentation` |
| [0023](0023-open-path-bootstrap-and-session-lifecycle.md) | `engine-orchestrator` owns open-path bootstrap and per-handle session lifecycle above the kernel — and no job system; supersedes the sceneaxi#60 stub disposition |
| [0024](0024-linux-desktop-electron-tier.md) | A `desktop/` tier: the Linux desktop application is Electron over the shell's unforked chrome, a narrow bridge seam, and the real engine stack; recorded-build distribution, no Windows/macOS claim (2026-08-05 amendment: a `desktop/windows` packaging root landed, still with no public artifact) |

## Number allocation

Numbers are claimed at merge, not at draft time. Several verticals ran in parallel here
and more than one drafted an ADR at the same number, so the websites-deploy wave was
renumbered from `0017`-`0019` to `0018`-`0020` when it rebased onto the kernel-digest and
presentation-core ADRs that merged first. If your branch's number is taken by the time
you rebase, renumber yours and update every reference — a collision is worse than a
late renumber.
