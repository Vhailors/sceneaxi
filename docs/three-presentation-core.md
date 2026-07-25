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

Reproduce by serving a page that runs the consumer snippets above against a
validated Sculpt Artifact; the umbrella live open path (T1) is the product home
for that page.

## Not claimed

Stage 1 execution or adjudication, a renderer winner, general E2, Kids safety,
production game-shipping readiness, or any live publication.
