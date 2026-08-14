# ADR 0027: Injected physics host with two real adapters

- **Status:** Accepted.
- **Date recorded:** 2026-08-14
- **Lineage:** Fulfills ADR 0009's anticipated production replacement. Satisfies
  ADR 0004's two-adapter rule. Kernel stays dependency-free (ADR 0016).

## Context

Desktop physics authoring already ships. Play needs 3-D collision without
breaking save/replay digest stability or putting Rapier inside `engine-kernel`.

## Decision

A narrow `PhysicsWorldHost` port is injected and probe-verified the way
`resolveKernelDigest` already verifies digest hosts. Two adapters exist from
day one: the existing toy integrator and a Rapier deterministic-compat host
owned by a separate package. Catalog `world.engine` is `"toy" | "rapier"` and
defaults to `"toy"` so existing projects do not re-digest.

Gameplay physics stays kernel-owned. Decorative motion stays presentation-only.

## Consequences

- Rapier `init()` is awaited at the tier boundary, not inside `advance`.
- Gates use the toy adapter; a dedicated WASM suite proves Rapier replay.
- Read-back transforms stay on the existing 1e-6 grid.

## Rejected alternatives

- Presentation-side gameplay physics (rejected by ADR 0009).
- Recorded-outcome for continuous simulation.
- Making Rapier a kernel dependency.
