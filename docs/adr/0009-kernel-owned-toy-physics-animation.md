# ADR 0009: Kernel owns toy physics and animation sockets

- **Status:** Accepted for the post-MVP hybrid vertical.
- **Date recorded:** 2026-07-24
- **Source:** [sceneaxi#71](https://github.com/Vhailors/sceneaxi/issues/71).
- **Lineage:** Child decision of hybrid parent #67; specializes ADR 0001 without changing its authority model.

## Context

The vertical must visibly animate and collide while preserving the command/
snapshot kernel contract. Letting presentation simulate would create two truths
and invalidate save/replay evidence.

## Decision

Project the Sculpt Artifact runtime hierarchy into kernel-owned scene state.
Animation socket values, gravity, and toy ground collision change only during
kernel `advance`. Fixed seed, clocks, and inputs produce one canonical snapshot
digest. `observe` remains deeply frozen, and save/replay must reproduce the
terminal digest.

Toy physics is deliberately limited evidence for this vertical. It is not a
production physics suite or a new public engine-internal port.

## Consequences

- Any presentation of simulation state consumes current observations; it cannot
  create simulation state.
- Golden tests bind animation, collision, save, and replay digests.
- A future production physics implementation can replace internals while preserving kernel authority.

## Rejected alternatives

- **Presentation-side animation or collision** — violates ADR 0001's single authority.
- **Wall-clock animation** — makes replay non-deterministic.
- **Production physics scope in this vertical** — exceeds the frozen done bar.

## Settled here vs held elsewhere

**Settled:** kernel ownership and the deterministic toy behavior.

**Held elsewhere:** production physics selection, performance claims, and engine-readiness claims.
