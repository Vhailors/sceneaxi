# Three presentation core

Three.js is the product presentation core of SceneAxi
([ADR 0017](adr/0017-three-product-presentation-core.md)). It lives entirely
behind the deep Presentation Runtime seam of
[ADR 0002](adr/0002-presentation-runtime-deep-seam.md) — `mount / present /
capture / dispose` — plus the Sculpt Mount boundary. This document is the
consumer-facing map of that core; the package contract is
[`@sceneaxi/engine-presentation`](../packages/engine-presentation/README.md).

Choosing Three as the product core says nothing about the Stage 1 proof: run
authorization and adjudication stay held elsewhere, and the seam is kept deep so
a later change is a behind-seam change.

## One core, two draw surfaces

There is exactly one Three core and one renderer path. It draws through a
surface, and the surface decides whether pixels exist:

| Surface | Built when | Draws pixels | `capture()` | Used by |
|---|---|---|---|---|
| `webgl-canvas` | a `canvas` is passed | yes — real `WebGLRenderer` | PNG bytes of the last frame | browser/product surfaces |
| `headless` | nothing is passed | no | `null` | node gates, determinism evidence |

Both are real adapters of the same internal draw port, which is what makes that
port legitimate under [ADR 0004](adr/0004-no-plugin-ports-before-two-adapters.md).
A host that owns renderer construction itself can inject its own surface.

Every frame states which surface produced it, so evidence can never quietly
imply pixels that were never drawn:

```ts
{ backend: "three", label: "Three presentation core", frame: 1,
  instanceIds: ["crate-one"], drawCalls: 2,
  surface: "webgl-canvas", pixelsDrawn: true }
```

The null presentation path (`createNullPresentationRuntime`,
`createNullSculptPresentationBackend`) is unchanged and remains the no-backend
gate path.

## Labels

Product surfaces use **Three presentation core**. A headless run identifies
itself as **Three presentation core — headless surface, no pixels drawn**. The
retired string "Experimental Three preview — non-decision; Stage 1 has not run."
must not be reintroduced for product surfaces (ADR 0008 amendment).

## Backend hiding still holds

No Three type crosses the package exports:

- Camera control is the numeric `OrbitCameraControls` surface (angles, distance,
  target, position tuples) — never a `PerspectiveCamera`.
- A draw surface receives renderables as opaque handles it must pass straight to
  a renderer.
- Canvas and input targets are declared structurally, so the package needs no DOM
  lib and its types stay consumable by node-only packages.
- The package keeps no `node:` import.
- Its `@sceneaxi/schemas` dependency is browser-safe at the package root; the
  filesystem-backed Profile Conformance runner lives only at
  `@sceneaxi/schemas/node/profile-conformance-suite`.

The Three `OrbitControls` addon is deliberately unused: it needs DOM lib types
this package does not take, and it hands out the camera object itself, which
would leak a backend type across the seam.

There is no separate browser-only entry point, because none is needed: importing
the package in node is inert, and only *constructing* a canvas surface requires
WebGL. Node gates therefore stay clean on the package root, and nothing pushes
WebGL into sites — a site opts in by passing its own canvas.

## Consumer paths

Sculpt Artifacts to a canvas (the live open path shape):

```ts
const backend = createThreeSculptPresentationBackend({
  canvas,
  viewport: { width: canvas.width, height: canvas.height, pixelRatio: 1 },
});
const mounts = createSculptMountApi(backend);
mounts.mount({ instanceId: "crate-one", artifact });
backend.frameMountedContent();      // point the camera at what is mounted
backend.camera.attach(canvas);      // drag to orbit, wheel to zoom
const loop = createThreeRenderLoop({ onFrame: () => mounts.render() });
loop.start();
```

Pass `background: null` to request a transparent scene clear and an alpha-enabled
WebGL drawing buffer; captured PNG pixels retain that transparency.

Kernel snapshots to a canvas through the ADR 0002 seam:

```ts
const runtime = createThreePresentationRuntime({ canvas });
runtime.mount();
runtime.present(session.observe(), [], alpha);   // interpolates, then draws
const png = runtime.capture();                   // { contentType, bytes } | null
runtime.dispose();
```

`present` consumes read-only snapshots and never reaches a kernel session, so
presentation cannot advance authoritative state. Entity markers are the
deliberately minimal kernel visualisation — the snapshot carries `id`/`x`/`y`
only, and presentation invents no state the kernel does not own.

## What is verified where

- **Node gates** (`pnpm gate`) cover mount/present/capture/dispose lifecycle and
  refusals, the frame path through an injected surface, orbit/zoom math and
  clamping, pointer/wheel input wiring, snapshot interpolation and non-mutation,
  the render loop, and that the canvas path really constructs a `WebGLRenderer`
  (which must fail in node, where no WebGL context exists).
- **Real browser**, manually, since node has no WebGL. Verified 2026-07-25 in
  Chrome against a committed fixture artifact served through Vite:
  - sculpt frame `{"backend":"three","label":"Three presentation core","frame":1,"instanceIds":["crate-one"],"drawCalls":2,"surface":"webgl-canvas","pixelsDrawn":true}`
  - `capture()` returned 248168 PNG bytes starting `137,80,78,71`
  - `createThreeRenderLoop` drove 6 `requestAnimationFrame` frames with live
    orbit input
  - the Presentation Runtime path drew and captured a 2581-byte PNG
  - screenshot showed the lit artifact (box plus cylinder cap), not a blank canvas

- **The shipped product surface**, the umbrella live open path (`/open`, ADR
  0022), which is that page. Verified 2026-07-25 in Chrome against the production
  build (`next build && next start`), SwiftShader ANGLE:
  - frame report rendered on the page:
    `backend three · label Three presentation core · surface webgl-canvas · pixelsDrawn true · drawCalls 15 · mounted service-crate-left, service-crate-root, service-crate-stacked`
  - `toDataURL` of the live canvas: 82 062 bytes, 1 717 distinct colours, 101 278
    of 763 730 pixels non-background — the three lit crates, not a cleared buffer
  - pointer drag and wheel zoom changed the drawn pixels; **Reset view** returned
    a byte-identical PNG to the opening framing
  - the root-only toggle moved the live report to `drawCalls 5 · mounted
    service-crate-root` and back, through the Mount API, without rebuilding the
    renderer

- **The entitled Minimum E2 editor** (`/editor`, ADR 0022), the umbrella's second
  pixel-drawing surface. Since sceneaxi#184 that canvas is one region of the
  Engine Desktop shell the route draws, through the same viewport boundary and
  the same session composition; the shell's own regions, refusals, and browser
  record are owned by [`web-editor-shell.md`](web-editor-shell.md), which is also
  where its later pixel observation is recorded. Since sceneaxi#197 the route's
  `?profile=web` request draws the smaller Web Experience projection around that
  same canvas instead — same viewport boundary, same composed scene, draw-only —
  and that projection's own record is owned by
  [`web-experience-editor.md`](web-experience-editor.md). This list is unchanged
  by it: it is one surface reached two ways, not a fifth. Verified 2026-07-26 in Chrome
  against the production build (`next build && next start`), SwiftShader ANGLE,
  with the server-side editor preview flag set:
  - the canvas holds a real `webgl2` context (`WebGL 2.0 (OpenGL ES 3.0
    Chromium)`); `toDataURL` returned 63 162 bytes, 2 234 distinct colours,
    102 911 of 763 730 pixels non-background — lit crates, not a cleared buffer
  - frame report rendered on the page:
    `backend three · label Three presentation core · surface webgl-canvas ·
    pixelsDrawn true · drawCalls 10 · mounted object-1, object-2`
  - the isolate-selection control moved the live report to `drawCalls 5 · mounted
    object-1` and back, through the Mount API, without rebuilding the renderer
  - pointer drag changed the drawn pixels; **Reset view** returned a byte-identical
    PNG to the opening framing
  - with the preview flag unset the same build served **no canvas at all**: zero
    `<canvas>` elements, no viewport section, and the named
    `IDENTITY_PLANE_NOT_WIRED` refusal state
  - the same session re-verified `/open` unchanged after both surfaces moved onto
    the shared viewport boundary: `drawCalls 15`, 1 717 distinct colours, 101 278
    non-background pixels — the figures recorded above, unmoved

- **The marketing hero** on the umbrella's `/` (sceneaxi#157), the third
  pixel-drawing surface and the only *snapshot* one: it attaches no camera input
  and its loop stops once the frame settles, so it mounts a still of the same
  composed scene `/open` serves rather than a driveable viewport. Verified
  2026-07-28 in Chrome; the frame reports, the settle behaviour, and the
  context-loss recovery are recorded in
  [`../sites/umbrella/VISUAL-EVIDENCE.md`](../sites/umbrella/VISUAL-EVIDENCE.md),
  which owns that surface's observations.

- **The packaged Linux desktop application** (`desktop/linux`, ADR 0024), the
  fourth pixel-drawing surface and the first outside a browser page: the Electron
  renderer process mounts the shared `MountableScene` payload over its window
  canvas through the same seam calls the umbrella makes. Verified 2026-08-05 from
  the packaged binary's `--smoke` proof (SwiftShader under Xvfb):
  `backend three · surface webgl-canvas · pixelsDrawn true · drawCalls 15`,
  matching the draw-call count the headless gate derives from the same
  composition. That build is the local source build recorded there, not the
  workflow artifact `/engine` offers — packaging is not bit-reproducible, so the
  two are never the same bytes. Both records and these observations are owned by
  [`desktop-linux.md`](desktop-linux.md).

Reproduce the standalone snippets by serving a page that runs the consumer
snippets above against a validated Sculpt Artifact;
`sites/umbrella/src/app/page.tsx`, `sites/umbrella/src/app/open/` and
`sites/umbrella/src/app/editor/` are the shipped versions, all three built on the
site's one renderer-owning module, `src/app/_components/sculpt-viewport.tsx`.
Each tier that draws owns exactly one such module: the sites-tier owner list is
asserted in `tests/sites/site-seams.test.ts`, and the desktop tier's single owner
(`desktop/linux/src/renderer/viewport.ts`, ADR 0024) is asserted the same way in
`tests/e2e/desktop-linux-bridge-golden.test.ts`. The tier's second install root,
`desktop/windows`, adds no renderer: it stages that same built module and owns only a
Windows updater bootstrap, so this list is unchanged by it
([`desktop-windows.md`](desktop-windows.md)).

## Not claimed

Stage 1 execution or adjudication, a renderer winner, general E2, Kids safety,
production game-shipping readiness, or any live publication.
