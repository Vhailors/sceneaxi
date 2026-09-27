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

## Implementation note for go-live item 63

The separate package is `@sceneaxi/physics-rapier`. Its async
`createRapierPhysicsWorldHost()` awaits WASM and compares two fresh four-step
probe worlds before returning the synchronous port. The import name
`@dimforge/rapier3d-compat` is an exact npm alias to
`@dimforge/rapier3d-deterministic-compat@0.21.0`. Upstream's ordinary compat
build does not guarantee cross-platform determinism. The lockfile, publish
check, and replay golden pin the deterministic build together.

The catalog has no initial pose, velocity, collider offset, joint anchor, or
joint axis fields. The smallest adapter uses these explicit v1 conventions:

- Bodies retain catalog insertion order and the toy host's initial height,
  `index + 1 + (seed % 3) * 0.01`. X and Z are zero, orientation is identity,
  and initial linear and angular velocity are zero. Static bodies are fixed;
  kinematic bodies remain at their initial pose because the port has no target
  update operation. No implicit ground or large-box static heuristic exists.
- A box's `size` is its full side length. A sphere's `size` is its radius.
  A capsule uses radius `size` and cylindrical half-height `size / 2` along Y.
  Shapes are centered on their body. Multiple shapes share the authored body
  mass equally; a body without a shape carries additional mass but no collider.
  Materials apply to every collider on the named body, with friction `0.5`
  and restitution `0` when absent, using Rapier's average combine rule.
- Fixed and hinge joints preserve the initial relative placement. The joint
  pivot is body B's initial center, expressed in each body's local frame.
  A hinge rotates about local +X. Connected-body contacts are disabled.
- Each `step` must equal the catalog's fixed `stepMs / 1000`; a different or
  nonfinite value refuses `PHYSICS_STEP_UNSTABLE`. Snapshots expose the existing
  `y` and `vy` projection on the 1e-6 grid. `serialize()` returns insertion-ordered
  full 3-D positions, quaternions, linear velocities, and angular velocities on
  that grid. It is a state-digest input, not a restorable Rapier checkpoint.
- Desktop initializes once at its tier boundary and injects the host into the
  existing catalog-evaluation command. Missing or mismatched hosts refuse by
  name. The schemas evaluator imports no Rapier code, and toy evaluation and
  existing toy digests remain unchanged. Gameplay mutation is not moved into
  presentation; the kernel's existing gameplay path is unchanged.

The unresolved point is a versioned pose/animation and joint-frame contract
for general scene gameplay, including full 3-D read-back. This implementation
does not add those fields or claim authored scene placement drives Rapier.
Nonzero `animationOffsetY` refuses `PHYSICS_INPUT_UNSUPPORTED` on the Rapier
path until the port can carry those initial poses. The toy path keeps its
existing animation-offset behavior. This note does not change the decision.

Proof owners are `packages/physics-rapier/test/seam.test.ts`,
`tests/e2e/physics-rapier-golden.test.ts` with its checked-in digest fixture,
and the Rapier case in `tests/e2e/desktop-physics-golden.test.ts`.
