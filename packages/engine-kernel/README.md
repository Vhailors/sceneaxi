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

## Scene kernel sessions

`openSceneKernelSession()` and `replaySceneKernelSession()` open a validated
`ComposedScene` — several placed Sculpt Artifacts — as one multi-object session
with the same authority model: only `advance` mutates, `observe` is frozen and
digest-bound, and replay refuses on terminal digest drift.

Each instance runs the existing single-object simulation over
`projectSceneInstanceHierarchy()`, which composes the scene world transform
before the artifact's root-local transform while leaving the artifact untouched
— a Sculpt Artifact's evidence binds its exact spec bytes, so rewriting one to
place it would break its own validator. Two instances of the same artifact are
different objects and get independent seeds derived from the scene seed and
their instance ids.

This is a minimal multi-object open path, not an engine expansion: it adds no
physics behavior beyond the toy path, no engine port, no plugin capability, and
no Minimum E2 checklist item.
