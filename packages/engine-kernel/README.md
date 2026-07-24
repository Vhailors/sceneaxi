# @sceneaxi/engine-kernel

Game Kernel seam: deterministic command/snapshot session
(`open` / `dispatch` / `advance` / `observe` / `save` / `replay`) per
[ADR 0001](../../docs/adr/0001-game-kernel-command-snapshot-session.md).

- Only `advance` mutates authoritative state
- `observe` returns deeply frozen snapshots with a canonical digest
- Game-session save/replay artifacts stamp schema + kernel/BOM versions; schema
  major mismatch refuses
- Allowed dependency: `@sceneaxi/schemas` only (no presentation/backend types)

The original tracer-bullet domain covers entity transforms under move/spawn.
The hybrid sculpt vertical additionally exposes `openSculptKernelSession()` and
`replaySculptKernelSession()` for kernel-owned hierarchy projection,
deterministic animation sockets, and bounded toy ground collision under
[ADR 0009](../../docs/adr/0009-kernel-owned-toy-physics-animation.md). Only
`advance` changes that state; observe is frozen and save/replay binds the
terminal digest.

Neither domain claims engine readiness or composes a renderer.
