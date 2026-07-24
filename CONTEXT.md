# SceneAxi context and glossary

## Hybrid sculpt vertical

The post-MVP openable path is:

`Sculpt Intake → Sculpt Artifact → Mount API → Minimum E2 → kernel play/step`

The deterministic CI input is `structured-spec`; the demo happy path is
`image+brief`. The experimental Three preview is a non-decision: Stage 1 has
not run and no renderer winner is claimed. The golden evidence and stable input
paths are recorded in
`.sceneaxi/evidence/issue-73-hybrid-sculpt-golden.json`.

## Sculpt-quality v1

The additive quality path is:

`multi-pass ObjectSculptSpec → deterministic procedural emit → animation-ready Sculpt Artifact → existing Mount / kernel / Minimum E2`

The accepted ledgers are `blockout → structure → materials → sockets`
and that same sequence with one `surface-detail` pass immediately before
`sockets`. Non-trivial specs must carry a reference-checked detail inventory.
The two committed demos and their stable evidence are indexed by
[`docs/sculpt-quality.md`](docs/sculpt-quality.md).

## Glossary

- **Hybrid core** — the Godot-like engine/library core plus AI sculpt
  authoring direction. It does not mean a full Godot editor.
- **Sculpt Intake** — versioned multi-modal request envelope; its authoritative
  fields and modes live in
  [`sculpt-intake.schema.json`](packages/schemas/contracts/sculpt-intake.schema.json).
- **ObjectSculptSpec** — renderer-neutral, deterministic multi-pass description
  of one sculpt; its authoritative shape lives in
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
  [`@sceneaxi/engine-presentation`](packages/engine-presentation/README.md#hybrid-sculpt-preview).
- **Experimental Three preview** — implementation-private visual adapter for
  this vertical; explicitly not a Stage 1 result or winner claim.
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

This vertical is proof-oriented. It does not claim engine readiness,
commercial validation, Kids safety, marketplace readiness, or Stage 1
adjudication.
