# @sceneaxi/engine-kernel

Game Kernel seam: deterministic command/snapshot session
(`open` / `dispatch` / `advance` / `observe` / `save` / `replay`) per
[ADR 0001](../../docs/adr/0001-game-kernel-command-snapshot-session.md).

- Only `advance` mutates authoritative state
- `observe` returns deeply frozen snapshots with a canonical digest
- Game-session save/replay artifacts stamp schema + kernel/BOM versions; schema
  major mismatch refuses
- Allowed dependency: `@sceneaxi/schemas` only (no presentation/backend types)
- No Node builtin and no Node-only global: every session path is browser-runnable

## Browser open path

Digests use a portable synchronous sha256 (`src/portable-digest.ts`) by default
instead of `node:crypto`, so a browser can open and play a session directly.
Optional host implementations are verified against that portable default before
use and cannot change digest semantics. Snapshots and save artifacts are plain
JSON, so a server kernel can instead send them to a browser presentation
runtime. Digest bytes are unchanged.

See [ADR 0016](../../docs/adr/0016-portable-kernel-digest.md) and
[docs/kernel-browser-open.md](../../docs/kernel-browser-open.md).

The original tracer-bullet domain covers entity transforms under move/spawn.
The hybrid sculpt vertical additionally exposes `openSculptKernelSession()` and
`replaySculptKernelSession()` for kernel-owned hierarchy projection,
deterministic animation sockets, and bounded toy ground collision under
[ADR 0009](../../docs/adr/0009-kernel-owned-toy-physics-animation.md). Only
`advance` changes that state; observe is frozen and save/replay binds the
terminal digest.

Neither domain claims engine readiness or composes a renderer.

## Deterministic rarity

The product session accepts the typed `rarity-roll` command over the one
project-owned `ProductManifest.rarity` namespace. Dispatch is queue-only;
`advance` calls the pure `resolveRarityRoll()` and appends the accepted
request/outcome/provenance record. Save persists that namespace and replay
recomputes it before accepting the terminal digest. Identical event/request
bytes are idempotent; changed bytes under an existing event id refuse, and a
reroll needs a new event id.

The resolver uses the portable browser-safe SHA-256 semantics under
`sceneaxi.rarity.weighted-sha256-v1`; provider input has no seed, draw, outcome,
or provenance field. See
[`docs/rarity-engine.md`](../../docs/rarity-engine.md) and the checked-in vectors
in `packages/schemas/contracts/rarity.fixtures.json`.

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
