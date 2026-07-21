# @sceneaxi/engine-kernel

Game Kernel seam: deterministic command/snapshot session
(`open` / `dispatch` / `advance` / `observe` / `save` / `replay`) per
[ADR 0001](../../docs/adr/0001-game-kernel-command-snapshot-session.md).

- Only `advance` mutates authoritative state
- `observe` returns deeply frozen snapshots with a canonical digest
- Save/replay artifacts stamp schema + kernel/BOM versions; schema major mismatch refuses
- Allowed dependency: `@sceneaxi/schemas` only (no presentation/backend types)

This package is a tracer-bullet simulation domain (entity transforms under
move/spawn). It does not claim engine-readiness and does not compose a renderer.
