# @sceneaxi/engine-presentation

Backend-hidden Presentation Runtime seam (`mount / present / capture / dispose`)
for read-only kernel snapshots, with **Three.js as the product presentation
core** ([ADR 0017](../../docs/adr/0017-three-product-presentation-core.md)).
Ownership map and consumer snippets:
[`docs/three-presentation-core.md`](../../docs/three-presentation-core.md).

No Three type crosses these exports: camera control is plain numbers, draw
surfaces take renderables as opaque handles, and canvas/input targets are
structural, so the package needs no DOM lib and keeps no `node:` import.
Because exports are source-backed, a browser consumer type-checks this source
*with* the DOM lib, where the structural canvas and the renderer's own
`HTMLCanvasElement | OffscreenCanvas` are no longer interchangeable — the one
narrowing that reconciles them lives at the `WebGLRenderer` construction in
`src/three-surface.ts`, and removing it breaks every browser consumer while node
gates stay green.
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
`capture`, `frameMountedContent()`, and `mountTriangleAsset()`. The last method
replaces an already-mounted Sculpt proxy with validated neutral triangle arrays
inside the same scene root; it is not a loader, filesystem seam, or second
renderer. The fixed input profile and provenance remain owned by
[`docs/asset-ingestion.md`](../../docs/asset-ingestion.md).

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

## Contained texture, animation and solver controls

The numeric `ThreeTriangleAnimationClip` extends the existing STEP/LINEAR
projection with glTF CUBICSPLINE: each key is [in tangent, value, out tangent],
Hermite tangents are scaled by segment duration, and quaternion samples/results
are normalized (derivative tangents need not be unit length). Validation and
sampling finish before any visible pose changes. `resetTriangleAnimation()`
restores admitted node defaults. Triangle `skin` carries bounded node joint ids,
16-value inverse-bind matrices and four joint-index/weight components per vertex;
weights must sum to one. There is no Three Skeleton/Bone in the public contract.
Graphs are bounded to 4096 nodes/256 depth, skins to 256 joints and aggregate
triangle data to 8000000 values. The engine accepts numeric projections only;
these capabilities do not silently widen the separately owned glTF importer.

`decodeContainedImage({ assetId, bytes })` supports PNG, JPEG and WebP through
the local browser decoder. It checks contained magic/header dimensions before
allocation (encoded 8MiB, decoded RGBA 4MiB, dimension 4096), snapshots input
across awaits and always closes its bitmap. It accepts no URL or host image.
An absent browser decoder refuses rather than pretending headless pixels.
`setMaterialOverrides(overrides, textures)` resolves non-null catalog color,
normal and roughness asset ids against a bounded contained RGBA lookup. Missing
UVs/ids, duplicate ids and mixed color/data roles refuse before replacing the
last catalog. Removing overrides restores original maps; the backend owns
catalog textures and disposes them once at replacement/final teardown.

`setInstancePoses()` forwards validated full quaternion solver poses to mounted
instances without modifying a kernel or authoring document. Entire batches are
prevalidated; unknown targets or invalid poses preserve every previous root.

## Canvas lifecycle and local evidence

A surface lease's `dispose()` is remount-safe and retains the one cached renderer
for its canvas; `releaseThreeCanvas(canvas)` is terminal and only legal after all
leases have ended. Final canvas owners must call it. Context loss suppresses
pixel/capture claims; remount during loss does not pretend to draw, and restored
contexts redraw admitted content. Never patch vendor renderer defaults.

After `pnpm -s build`, owning `test/` suites and the emitted-declaration consumer
prove numeric/opaque facade boundaries. Explicit `node test/browser-production-proof.mjs`
and `node test/browser-engine-frontdoors.mjs` from this package prove actual
Chromium/SwiftShader pixels for PNG/JPEG/WebP, TRS/skin/cubic, catalog bindings,
material/bloom/vignette/particles, 100 renderer cycles, context restoration and
terminal release, trusted WebAudio gesture/play/stop/close, and real Rapier WASM
pose/JSON resume/future pixels. Gamepad samples in this evidence are injected;
physical GPU, connected controller and audible output remain hardware proofs.
These library fixtures do not attest every authored site or packaged route.
