# ADR 0008: Experimental Three preview is a non-decision

- **Status:** **Superseded in part by [ADR 0017](0017-three-product-presentation-core.md)
  (2026-07-25)** — see the amendment below. The historical decision is kept as
  recorded; it no longer governs product surfaces.
- **Date recorded:** 2026-07-24
- **Source:** [sceneaxi#70](https://github.com/Vhailors/sceneaxi/issues/70).
- **Lineage:** Child decision of hybrid parent #67; constrained by ADR 0002 and the Stage 1 proof program.

## 2026-07-25 product-core amendment

A standing captain product decision made Three.js **the product presentation
core**; [ADR 0017](0017-three-product-presentation-core.md) records it. For
product surfaces:

- The mandatory UI-facing string **"Experimental Three preview — non-decision;
  Stage 1 has not run."** is **retired** and must not be reintroduced. Product
  surfaces identify the core as **Three presentation core**; a headless gate run
  says **Three presentation core — headless surface, no pixels drawn**.
- The adapter is no longer an experiment: it is the product core, with a real
  `WebGLRenderer`, camera, canvas mount, capture, and frame loop behind the
  unchanged ADR 0002 seam.

Unchanged by that amendment, and still normative here: the Mount API stays
renderer-neutral and exposes no Three types, the null presentation path remains
the non-visual gate backend, and **nothing below is a Stage 1 result**. Stage 1
run authorization and adjudication remain held elsewhere.

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

**Settled:** permission for this labeled experimental adapter. Superseded for
product surfaces by [ADR 0017](0017-three-product-presentation-core.md), which
chose Three as the product core and retired the experimental label.

**Held elsewhere:** Stage 1 run authorization, adjudication, and renderer winner
selection — unchanged by ADR 0017, which is a product decision only.
