# @sceneaxi/engine-presentation

Backend-hidden Presentation Runtime seam (`mount / present / capture / dispose`)
for read-only kernel snapshots, with **Three.js as the product presentation
core** ([ADR 0017](../../docs/adr/0017-three-product-presentation-core.md)).
Ownership map and consumer snippets:
[`docs/three-presentation-core.md`](../../docs/three-presentation-core.md).

No Three type crosses these exports: camera control is plain numbers, draw
surfaces take renderables as opaque handles, and canvas/input targets are
structural, so the package needs no DOM lib and keeps no `node:` import.
The `@sceneaxi/schemas` root it consumes is browser-safe; the filesystem-backed
Profile Conformance suite is available only from the explicit
`@sceneaxi/schemas/node/profile-conformance-suite` subpath.

## Three presentation core

`createThreePresentationRuntime(options)` is the ADR 0002 seam on real Three.
`mount` builds renderer, camera, scene, and lights; `present(snapshot, events,
alpha)` interpolates the read-only kernel snapshot and draws a frame; `capture`
returns PNG bytes of that frame; `dispose` releases the surface. It never
receives a kernel session, so presentation cannot advance simulation.

`createThreeSculptPresentationBackend(options)` is the same core behind the
Sculpt Mount boundary, and additionally exposes `camera` (orbit/zoom), `resize`,
`capture`, and `frameMountedContent()`.

Both take one core options object:

- `canvas` — a structural canvas. Given one, the core builds a real
  `WebGLRenderer`: the `webgl-canvas` surface draws pixels and captures PNG.
- nothing — the deterministic `headless` surface. It flushes world matrices and
  reports the meshes a renderer would have drawn, never claims pixels, and
  captures nothing. This is the node-gate path.
- `surface` — inject your own draw surface, for hosts that construct their own
  renderer; it is also how gates exercise the frame path without WebGL.
- `viewport`, `camera`, `background`, `antialias`, `preserveDrawingBuffer`.
  `background: null` also enables an alpha drawing buffer so captures preserve
  the documented transparent clear.

Every frame reports `surface` and `pixelsDrawn`, so a frame count can never be
mistaken for pixels. UI-facing labels are `THREE_PRESENTATION_CORE_LABEL` and
`THREE_HEADLESS_SURFACE_LABEL`; the retired experimental non-decision label must
not come back for product surfaces.

`createThreeRenderLoop({ onFrame, scheduler })` drives frames off
`requestAnimationFrame` by default and refuses when the host has none.

Named refusals are `ThreePresentationError` with a `code` (`invalid-canvas`,
`invalid-camera`, `invalid-renderable`, `invalid-viewport`,
`capture-unsupported`, `capture-unavailable`, `no-frame-scheduler`,
`not-mounted`, `already-mounted`).

## Null paths

`createNullPresentationRuntime()` provides a lifecycle-real null backend for
kernel and end-to-end paths. It mounts and disposes normally, accepts no-op
frames, and returns no capture. It refuses `present`, `capture`, and `dispose`
while detached, and refuses a second `mount` while mounted.
`createNullSculptPresentationBackend()` is its Sculpt Mount counterpart and
remains the non-visual gate backend.

## Mount API

`createSculptMountApi()` is the backend-neutral Sculpt Artifact mount boundary.
It accepts only SceneAxi contract types and instance transforms, and fails closed
with `SculptMountError` on invalid artifacts, instance ids, transforms, duplicate
mounts, and use after dispose.

## Stage 1

Three as the product core is a captain product decision, not a Stage 1 result.
Stage 1 run authorization and adjudication stay held elsewhere, and the seam
stays deep so a later renderer change remains behind it.
