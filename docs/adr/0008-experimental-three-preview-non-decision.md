# ADR 0008: Experimental Three preview is a non-decision

- **Status:** Accepted for the post-MVP hybrid vertical.
- **Date recorded:** 2026-07-24
- **Source:** [sceneaxi#70](https://github.com/Vhailors/sceneaxi/issues/70).
- **Lineage:** Child decision of hybrid parent #67; constrained by ADR 0002 and the Stage 1 proof program.

## Context

Minimum E2 needs an immediately openable viewport, while renderer composition
remains a falsifiable Stage 1 question with separate run authority.

## Decision

Ship an experimental Three implementation behind the presentation seam for
this preview path. The Mount API remains renderer-neutral and exposes no Three
types. The null presentation path remains the non-visual gate backend.

Every UI-facing identification uses: **Experimental Three preview —
non-decision; Stage 1 has not run.** This implementation is not evidence that
Three won and does not remove or prejudice another Stage 1 arm.

## Consequences

- Minimum E2 can build and inspect an actual Three scene graph while contracts
  remain backend-hidden.
- Stage 1 can later select a different composition without changing Sculpt Artifact or Mount API.
- Kernel observations remain authoritative; presentation never advances
  simulation.

## Rejected alternatives

- **Declare Three the winner from this demo** — bypasses the double-gated proof.
- **Expose Three objects through Mount API** — makes the experiment contagious.
- **Remove the null backend** — breaks deterministic non-visual gates.

## Settled here vs held elsewhere

**Settled:** permission for this labeled experimental adapter.

**Held elsewhere:** Stage 1 run authorization, adjudication, and renderer winner selection.
