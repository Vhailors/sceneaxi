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
  program. Stage 1 stays double-gated (tier-3 captain decisions **and** explicit
  run authorization) under factories-helpers
  [#41](https://github.com/Vhailors/factories-helpers/issues/41).

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
| [0002](0002-presentation-runtime-deep-seam.md) | Presentation seam is a deep Presentation Runtime (backend hidden; Stage 1 decides composition) |
| [0003](0003-editor-sequencing-e1-first-e2-specified.md) | Editor sequencing: E1 first, E2 specified-not-built |
| [0004](0004-no-plugin-ports-before-two-adapters.md) | Seam discipline: no internal-library ports before two real adapters (Model Provider Port and v1 Plugin Host / capability registry excepted) |
| [0005](0005-plugin-host-capability-manifest.md) | Plugin Host uses versioned capability manifests and a fail-closed public capability registry |
| [0006](0006-hybrid-core-and-ai-sculpt.md) | Hybrid Godot-like core plus AI sculpt authoring is the post-MVP vertical direction |
| [0007](0007-sceneaxi-owned-sculpt-artifacts.md) | SceneAxi owns Sculpt Intake, ObjectSculptSpec, reconstruction, and Sculpt Artifact contracts |
| [0008](0008-experimental-three-preview-non-decision.md) | Three preview is experimental and explicitly not a Stage 1 decision |
| [0009](0009-kernel-owned-toy-physics-animation.md) | Toy physics and animation sockets advance only under kernel authority |
