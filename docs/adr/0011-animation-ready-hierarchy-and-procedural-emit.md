# ADR 0011: Sculpt quality binds animation-ready hierarchy and procedural emit

- **Status:** Accepted for sculpt-quality v1.
- **Date recorded:** 2026-07-24
- **Source:** [sceneaxi#78](https://github.com/Vhailors/sceneaxi/issues/78) and [#79](https://github.com/Vhailors/sceneaxi/issues/79).
- **Lineage:** Child decisions of sculpt-quality parent #76; extend ADRs 0007 and 0009.

## Context

Openable primitive components alone did not describe the stable pivots,
attachments, material assignments, or geometry/material construction evidence
needed for animation-oriented consumers.

## Decision

Sculpt Artifact carries a versioned animation-ready runtime hierarchy that
exactly projects validated nodes and sockets plus one deterministic set of
pivots, descriptive colliders, material bindings, and attachment points.
Incomplete or drifting projections refuse by the missing structure class.

`emitSculptProcedural()` is the real SceneAxi-owned public module referenced by
generated artifacts. Given a multi-pass spec and non-negative integer seed, it
emits canonical geometry detail, material detail, and hierarchy binding plans.
The artifact records the source digest, seed, and emit digest; quality evidence
must bind that emit digest.

Collider entries are metadata for the existing toy path. This ADR does not add
a production physics implementation or engine-internal plugin port.

## Consequences

- Fixed inputs and seeds produce stable emitted-plan and artifact digests.
- Mount/kernel consumers receive richer metadata without a new public entry
  point.
- Emit-evidence binding drift or an incomplete runtime hierarchy fails closed.

## Rejected alternatives

- **Keep the old descriptive, non-resolvable module reference** — cannot prove
  what emitted the artifact.
- **Renderer-specific hierarchy objects** — violate the backend-neutral public
  contract.
- **Production physics in this ship** — exceeds the frozen quality scope.

## Settled here vs held elsewhere

**Settled:** hierarchy v1 fields, deterministic projection, procedural module
identity, and digest binding.

**Held elsewhere:** production geometry algorithms, physics selection,
renderer selection, and engine-readiness claims.
