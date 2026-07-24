# ADR 0010: ObjectSculptSpec uses deterministic multi-pass quality gates

- **Status:** Accepted for sculpt-quality v1.
- **Date recorded:** 2026-07-24
- **Source:** [sceneaxi#77](https://github.com/Vhailors/sceneaxi/issues/77).
- **Lineage:** Child decision of sculpt-quality parent #76; extends ADR 0007 and PR #75.

## Context

The hybrid vertical proved that a sculpt could open, but a single shallow
component list did not express a reviewable quality ladder. Declaring an object
non-trivial without inventory evidence also allowed “one box plus one color” to
masquerade as detail.

## Decision

ObjectSculptSpec requires a deterministic pass ledger containing, in order,
`blockout`, `structure`, `materials`, and `sockets`. Additional passes are
allowed when they are named, deterministic, non-empty, and preserve that order.

Every spec declares `simple` or `non-trivial`. Non-trivial specs require a
detail inventory covering silhouette, structural, surface, material, and
socket detail. Inventory references bind to spec material/socket IDs, and both
the declared inventory and actual component/material/hierarchy/socket depth
must meet the v1 minima. Missing, empty, out-of-order, and shallow cases refuse
with stable diagnostic codes.

## Consequences

- Quality stages and inventory depth are inspectable before reconstruction.
- The existing hybrid intake and reconstruction entry points remain unchanged.
- Future minima require an explicit contract revision; callers cannot silently
  reinterpret this v1 gate.

## Rejected alternatives

- **Prompt prose as the quality contract** — not machine-verifiable.
- **One aggregate quality score** — hides which required stage or detail class
  is missing.
- **Vision score as a hard gate** — not deterministic enough for this ship.

## Settled here vs held elsewhere

**Settled:** the v1 pass order, detail inventory, minima, and named refusals.

**Held elsewhere:** artistic quality scoring, production reconstruction policy,
and any Stage 1 adjudication.
