# @sceneaxi/engine-orchestrator

**MVP disposition: not in the golden path** (sceneaxi#60 option B).

The current Game/CLI and Web golden paths open, advance, save, and replay the
single deterministic session through `@sceneaxi/engine-kernel`. They create no
cross-session job, scheduling, retry, or queue semantics for an orchestrator to
own. Adding glue here would duplicate the kernel session or invent product
scope, so the public package seam remains for spec #41's six-module boundary.

Executable evidence in `test/golden-path-not-needed.test.ts` proves the golden
paths have no orchestrator import and their consumers carry no unused runtime
dependency. No multi-tenant job queue, factory scheduler, or background worker
product is implied.

Boundaries enforced by `scripts/check-boundaries.mjs` against
`docs/dependency-matrix.json`.
