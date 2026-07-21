# ADR 0002: Presentation seam is a deep Presentation Runtime (backend hidden)

- **Status:** Accepted — settled by the Wayfinder design-it-twice process; this ADR records the decision, it does not re-decide it.
- **Date recorded:** 2026-07-21
- **Source:** Wayfinder design-it-twice pass (origin `threejs-bgf-ecosystem-wayfinder-v1`), condensed in factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41) §Deep modules.
- **Lineage:** `transferred-from: factories-helpers#46` — engine/CLI half of the split, recorded per [sceneaxi#4](https://github.com/Vhailors/sceneaxi/issues/4); factory-side ADRs stay on factories-helpers [#46](https://github.com/Vhailors/factories-helpers/issues/46).

## Context

Presentation (`packages/engine-presentation`, layer L1) is responsible for
rendering kernel snapshots. The design question was whether SceneAxi should
build a universal
renderer-agnostic abstraction spanning candidate backends, or a single deep
Presentation Runtime that hides whichever backend sits inside it. The
design-it-twice pass settled on the deep runtime. The renderer composition
itself is a separate, open, falsifiable hypothesis decided only by Stage 1 of
the proof program.

## Decision

The presentation seam is a **deep Presentation Runtime**:

```
mount / present(snapshot, events, alpha) / capture / dispose
```

Normative properties:

- **No universal renderer-agnostic abstraction** layer is built.
- **No backend types cross the external seam.**
- **Presentation never mutates authoritative simulation.** Snapshots consumed
  by `present` are read-only (ADR
  [0001](0001-game-kernel-command-snapshot-session.md)).
- The runtime hides: scene graph, renderer backend, animation, camera, VFX,
  audio, DOM HUD, and resource management.

**The seam *shape* is settled; the backend *hypothesis* is not.** Stage 1 of
the proof program — double-gated (tier-3 captain decisions **and** explicit run
authorization) under factories-helpers #41 — decides renderer composition.
This ADR does not presume Three.js (or any backend) wins Stage 1. Within the
proof, comparison arms satisfy the **same behavioral/evidence contract** rather
than a shared facade.

## Consequences

- A renderer swap cannot corrupt game truth: zero simulation mutation from
  presentation is a behavioral test at this seam (proof-program Seam B).
- `capture` provides evidence-grade output for the evidence pipeline, testable
  without asserting scene-graph internals.
- Device-performance recovery is **presentation-only scaling** — quality knobs
  never alter simulation truth.
- Whichever backend Stage 1 selects lands **behind this same seam**; the seam
  does not change with the verdict, so no consumer is exposed to the outcome.
- Stage 1 preparation docs re-home to `docs/proof/`
  ([sceneaxi#13](https://github.com/Vhailors/sceneaxi/issues/13)–[#15](https://github.com/Vhailors/sceneaxi/issues/15));
  execution stays separately authorized.

## Rejected alternatives

- **Universal renderer-agnostic abstraction (shared facade across backends)** —
  speculative generality ahead of a second real adapter (ADR
  [0004](0004-no-plugin-ports-before-two-adapters.md)); converges on a
  lowest-common-denominator surface; and would quietly pre-shape the Stage 1
  comparison by forcing both arms through one facade instead of one shared
  behavioral/evidence contract.
- **Backend types exposed across the seam** — turns the renderer choice into a
  contagion instead of a falsifiable hypothesis; a swap becomes a breaking
  change for every consumer.
- **Presentation with write access to simulation** — a seam violation;
  authoritative state changes only through kernel `advance`.

## Settled here vs held elsewhere

**Settled:** the seam shape (`mount / present / capture / dispose`),
backend-hiding, and the non-mutation invariant.

**Held, untouched by this ADR:** renderer composition — Stage 1 of the proof
program, double-gated under factories-helpers #41; `kernel-name` ("Three
Kernel" is the working name of an open captain hold). This ADR must never be
cited to justify any renderer choice, for or against any backend.
