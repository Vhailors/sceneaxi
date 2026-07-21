# @sceneaxi/authoring-core

Bootstrap stub for the **agent-native runtime/authoring core** — the single core
every profile consumes (locked topology decision). This package, not the CLI,
owns:

- the text-canonical **document model** and the **propose/apply application
  service** (one validator for edits and proposals, E1 discipline);
- **session orchestration** over the engine seams (open/dispatch/advance/
  observe/save/replay);
- **evidence hooks** (Evidence Packet emission points);
- the **Model Provider Port** (complete/tool-call/stream + typed capability
  descriptors + per-profile policy filter). Provider adapters are delayed
  packages behind this port; the Kids profile's policy filter denies
  third-party model routes by default.

The CLI (`@sceneaxi/cli`) is a thin protocol adapter over this package — it may
not import engine packages directly (enforced by the dependency matrix), so the
authoring core cannot silently migrate into the orbiting CLI.

Boundaries enforced by `scripts/check-boundaries.mjs` against
`docs/dependency-matrix.json`.
