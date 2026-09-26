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

## Unresolved rendering detail

The presentation seam can apply emissive color, emissive intensity, and opacity
per instance without changing artifact bytes. Texture asset IDs alone do not
supply decoded pixels, UV selection, color-space interpretation, or sampler
settings. The current mount payload has no resolver for those bindings.

Until that transport contract exists, the renderer refuses a non-null
`baseColorMapAssetId`, `normalMapAssetId`, or `roughnessMapAssetId` before changing
any overrides. The desktop viewport withholds that instance's whole override and
reports it as a named refusal line, so one texture slot never blanks the scene
(`desktop/linux/src/renderer/viewport-playback.ts`). It does not treat an asset ID
as a URL or borrow a contained glTF texture. The separate contained glTF base-color texture path is unchanged.
This note records an implementation gap, not a new material or asset policy. The open decision is the asset-to-texture binding contract: it must define decoded-pixel transport, UV selection, color-space interpretation, and sampler settings before any non-null texture slot can draw.

## Rejected alternatives

- Widening `SculptMaterial` in the artifact spec now.
- Shipping a node shader graph in v1.
