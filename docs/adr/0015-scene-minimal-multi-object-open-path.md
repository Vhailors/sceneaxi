# ADR 0015: Scene composition adds one kernel session and no presentation adapter

- **Status:** Accepted for scene composition v1.
- **Date recorded:** 2026-07-25
- **Source:** [sceneaxi#87](https://github.com/Vhailors/sceneaxi/issues/87) and [#88](https://github.com/Vhailors/sceneaxi/issues/88).
- **Lineage:** Children of scene composition parent [#84](https://github.com/Vhailors/sceneaxi/issues/84); bounded by ADRs 0003, 0009, and 0013.

## Context

A composed scene is only a document until something opens it. `openSculptKernelSession()`
accepts exactly one artifact, so a multi-object scene had no open path. That gap
could easily have become an editor or engine expansion program instead of the
one missing seam.

ADR 0013 set the precedent: add support only where a demo proves it is needed,
and record "not needed" executably everywhere else.

## Decision

Exactly one new open path is added. `openSceneKernelSession()` and
`replaySceneKernelSession()` open a validated ComposedScene as one multi-object
session under the unchanged authority model: only `advance` mutates, `observe`
returns frozen digest-bound snapshots, and replay refuses on terminal digest
drift.

Each instance runs the **existing** single-object simulation over
`projectSceneInstanceHierarchy()`, so it starts at its scene world transform
without its artifact being rewritten. The single-object simulation is extracted
and shared rather than duplicated, so `openSculptKernelSession()` behavior and
every landed sculpt and sculpt-quality digest are unchanged. Two instances of the
same artifact are different objects and receive independent seeds derived from
the scene seed and their instance ids. Scene-composable artifacts carry identity
runtime roots under ADR 0014, so this projection stays renderer-neutral.

**No presentation adapter is added.** `createSculptMountApi()` already mounts N
instances with per-instance transforms, so the golden demo mounts all three scene
instances through the existing API. The executable not-needed record is
[`tests/e2e/fixtures/scene-composition/mount-support-evidence.json`](../../tests/e2e/fixtures/scene-composition/mount-support-evidence.json),
asserted by
[`tests/e2e/scene-composition-golden.test.ts`](../../tests/e2e/scene-composition-golden.test.ts).
If a later demo cannot open through the existing Mount API, this claim is void
and a minimal adapter becomes required on its own evidence.

No Minimum E2 checklist item, engine adapter, renderer decision, plugin
capability, physics behavior beyond ADR 0009's toy path, or Stage 1 surface is
added by this ship.

## Consequences

- Multi-object scenes open, animate, save, and replay deterministically.
- The single-object path stays byte-compatible; the shared simulation has one
  implementation instead of two that can drift.
- Presentation stays untouched, with its no-change decision proven rather than
  asserted.
- A later engine or editor request must justify itself independently; this ADR is
  not a blanket expansion authorization.

## Rejected alternatives

- **A second copy of the toy simulation for scenes** — two implementations of the
  same deterministic rules drift, and drift here means digest drift.
- **A scene-aware presentation adapter** — creates unsupported surface the demo
  does not need; the existing Mount API already carries it.
- **Expanding Minimum E2 for scene authoring** — explicitly outside the frozen
  ship (ADR 0003).
- **Per-scene physics behavior** — outside ADR 0009's bound and unsupported by
  any demo need.

## Settled here vs held elsewhere

**Settled:** one multi-object kernel session, shared simulation internals, and
the evidence-backed not-needed decision for presentation.

**Held elsewhere:** editor programs, renderer selection, production physics,
Stage 1, and engine-readiness decisions.
