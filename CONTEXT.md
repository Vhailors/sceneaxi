# SceneAxi context and glossary

## Hybrid sculpt vertical

The post-MVP openable path is:

`Sculpt Intake → Sculpt Artifact → Mount API → Minimum E2 → kernel play/step`

The deterministic CI input is `structured-spec`; the demo happy path is
`image+brief`. The experimental Three preview is a non-decision: Stage 1 has
not run and no renderer winner is claimed. The golden evidence and stable input
paths are recorded in
`.sceneaxi/evidence/issue-73-hybrid-sculpt-golden.json`.

## Glossary

- **Hybrid core** — the Godot-like engine/library core plus AI sculpt
  authoring direction. It does not mean a full Godot editor.
- **Sculpt Intake** — versioned multi-modal request envelope with `image`,
  `image+brief`, `multi-view`, or `structured-spec` mode.
- **ObjectSculptSpec** — renderer-neutral components, materials, sockets, and
  rooted hierarchy that describe one sculpt.
- **Sculpt Artifact** — SceneAxi-owned package binding an ObjectSculptSpec,
  procedural module reference, runtime hierarchy, and evidence digests.
- **Reconstruction pipeline** — SceneAxi-owned deterministic transformation
  from supported intake to a Sculpt Artifact. v1 supports the fixture and
  image+brief paths without production provider spend.
- **Mount API** — backend-neutral instance boundary from Sculpt Artifact to
  presentation. No Three types cross it.
- **Experimental Three preview** — implementation-private visual adapter for
  this vertical; explicitly not a Stage 1 result or winner claim.
- **Minimum E2** — only viewport, scene tree, selection, numeric transform,
  inspector, play/pause/step, add/remove sculpt, and propose/apply save/load.
- **Toy physics** — deterministic ground collision behavior for this vertical,
  not a production physics suite.
- **Animation socket** — named artifact socket whose value is advanced by the
  kernel and observed by presentation; presentation never simulates it.

This vertical is proof-oriented. It does not claim engine readiness,
commercial validation, Kids safety, marketplace readiness, or Stage 1
adjudication.
