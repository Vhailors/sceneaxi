# ADR 0026: Parametric material model v1; user shader code deferred

- **Status:** Accepted.
- **Date recorded:** 2026-08-14
- **Lineage:** Preserves sculpt evidence binding (exact spec bytes).

## Context

Creators need emissive, opacity, and texture slots. Widening `SculptMaterial`
inside artifact spec bytes would force a schema v2 and new digests for every
artifact.

## Decision

v1 is a scene-level override catalog mapping `instanceId` to a closed parameter
set. Overrides are projected at mount. Artifact bytes stay untouched. Node
shader graphs and arbitrary GLSL stay out of v1.

## Consequences

- Two places to look for "the material": artifact defaults and scene overrides.
- Texture slots bind first-class image assets only.

## Rejected alternatives

- Widening `SculptMaterial` in the artifact spec now.
- Shipping a node shader graph in v1.
