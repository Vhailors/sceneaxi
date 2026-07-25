# SceneAxi context and glossary

## Hybrid sculpt vertical

The post-MVP openable path is:

`Sculpt Intake → Sculpt Artifact → Mount API → Minimum E2 → kernel play/step`

The deterministic CI input is `structured-spec`; the demo happy path is
`image+brief`. Presentation runs on the
[Three presentation core](docs/three-presentation-core.md): node gates use its
deterministic headless surface, and browser consumers can supply a canvas to
draw real pixels through `WebGLRenderer`; this vertical does not wire a site.
Stage 1 has still not run and no renderer winner is claimed. The golden evidence
and stable input paths are recorded in
`.sceneaxi/evidence/issue-73-hybrid-sculpt-golden.json`.

## Sculpt-quality v1

The additive quality path is:

`multi-pass ObjectSculptSpec → deterministic procedural emit → animation-ready Sculpt Artifact → existing Mount / kernel / Minimum E2`

The quality contracts, accepted ledger, two committed demos, and stable evidence
are indexed by
[`docs/sculpt-quality.md`](docs/sculpt-quality.md).

## Scene composition v1

The multi-object path is:

`N validated Sculpt Artifacts + one Scene Composition Intake → one ComposedScene → one text-canonical SceneDocument → existing Mount API + one multi-object kernel session`

The scene contracts, axis-aligned placement rule, named refuse matrix, committed
three-instance demo, and stable evidence are indexed by
[`docs/scene-composition.md`](docs/scene-composition.md).

## Glossary

- **Hybrid core** — the Godot-like engine/library core plus AI sculpt
  authoring direction. It does not mean a full Godot editor.
- **Sculpt Intake** — versioned multi-modal request envelope; its authoritative
  fields and modes live in
  [`sculpt-intake.schema.json`](packages/schemas/contracts/sculpt-intake.schema.json).
- **ObjectSculptSpec** — renderer-neutral description of one sculpt. Its
  sculpt-quality branch adds the deterministic multi-pass ledger and complexity
  class; the legacy PR #75 branch remains valid without those fields. Its
  authoritative shape lives in
  [`object-sculpt-spec.schema.json`](packages/schemas/contracts/object-sculpt-spec.schema.json).
- **Detail inventory** — non-trivial spec evidence naming silhouette,
  structural, surface, material, and socket detail; shallow declarations refuse
  under [ADR 0010](docs/adr/0010-multi-pass-sculpt-quality-gates.md).
- **Sculpt Artifact** — SceneAxi-owned openable package whose authoritative
  shape lives in
  [`sculpt-artifact.schema.json`](packages/schemas/contracts/sculpt-artifact.schema.json).
- **Reconstruction pipeline** — SceneAxi-owned deterministic transformation
  from supported intake to a Sculpt Artifact; the supported v1 paths and named
  refusals are documented by
  [`@sceneaxi/authoring-core`](packages/authoring-core/README.md#hybrid-sculpt-reconstruction-and-minimum-e2).
- **Animation-ready hierarchy** — versioned artifact projection of nodes,
  pivots, sockets, descriptive colliders, material bindings, and attachment
  points under
  [ADR 0011](docs/adr/0011-animation-ready-hierarchy-and-procedural-emit.md).
- **Procedural emit** — real SceneAxi-owned fixed-seed geometry/material/
  hierarchy factory whose digest is bound into Sculpt Artifact evidence.
- **Offline sculpt agent** — optional injected refiner guarded by a default-off
  flag and a two-run determinism check under
  [ADR 0012](docs/adr/0012-offline-agent-assistance-default-off.md).
- **Mount API** — backend-neutral instance boundary from Sculpt Artifact to
  presentation; its package contract is documented by
  [`@sceneaxi/engine-presentation`](packages/engine-presentation/README.md#mount-api).
- **Three presentation core** — the product presentation/runtime core under
  [ADR 0017](docs/adr/0017-three-product-presentation-core.md), hidden behind the
  ADR 0002 deep seam. One core, two draw surfaces: a real `WebGLRenderer` canvas
  surface that draws pixels, and a deterministic headless surface for non-visual
  gates that never claims pixels. Choosing it is a captain product decision, not
  a Stage 1 result or winner claim; see
  [`docs/three-presentation-core.md`](docs/three-presentation-core.md).
- **Minimum E2** — the vertical-only editor exception whose exact checklist is
  owned by
  [ADR 0003](docs/adr/0003-editor-sequencing-e1-first-e2-specified.md#2026-07-24-vertical-only-amendment).
- **Toy physics** — deterministic ground collision behavior for this vertical,
  bounded by
  [ADR 0009](docs/adr/0009-kernel-owned-toy-physics-animation.md).
- **Animation socket** — named artifact socket whose value is advanced by the
  kernel and exposed through frozen observations under
  [ADR 0009](docs/adr/0009-kernel-owned-toy-physics-animation.md).
- **Minimal support decision** — both quality demos already traverse existing
  Mount, kernel, and Minimum E2 seams, so no checklist or engine adapter was
  added; see [ADR 0013](docs/adr/0013-sculpt-quality-minimal-support-bound.md).
- **Scene Composition Intake** — versioned request that places at least two
  Sculpt Artifacts relative to one another; its authoritative fields live in
  [`scene-composition.schema.json`](packages/schemas/contracts/scene-composition.schema.json).
- **ComposedScene** — the resolved, digest-bound multi-object result, ordered by
  ascending depth then instance id and projected into the existing text-canonical
  `SceneDocument` under the reserved `composedScene` data key. The composition
  pipeline is
  [`@sceneaxi/authoring-core`](packages/authoring-core/README.md#scene-composition-sceneaxi86).
- **Scene placement** — the axis-aligned v1 rule composing a parent world
  transform with an instance's local transform. Child offsets are scaled but
  never rotated, so a rotating parent refuses instead of mis-nesting its
  children; placement projects an instance into scene space and never rewrites
  its artifact. Existing artifact root-local transforms remain intact and are
  composed after the instance world transform. See
  [ADR 0014](docs/adr/0014-scene-composition-contract.md).
- **Scene kernel session** — the multi-object open path
  (`openSceneKernelSession` / `replaySceneKernelSession`) that runs the existing
  single-object simulation once per placed instance, bounded by
  [ADR 0015](docs/adr/0015-scene-minimal-multi-object-open-path.md).

This vertical is proof-oriented. It does not claim engine readiness,
commercial validation, Kids safety, marketplace readiness, or Stage 1
adjudication.
