# Three viewport

## Sub-features

- `viewport.pixels` draws the public composed scene under studio lighting in WebGL.
- `viewport.idle` stops drawing once the picture settles and resumes on input or a scene change.

## How to get to it (user POV)

Open `/open` on the umbrella site. Drag to orbit, scroll to zoom, use **Reset view**, or use **Mount the root instance only**.

## Driving it with verify

Run the root build and doctor from [the skill](../SKILL.md). Run the focused renderer and site tests:

```bash
.bb/skills/verify-sceneaxi/verify test packages/engine-presentation/test/three-surface.test.ts tests/sites/umbrella-visual.test.ts
pnpm --dir sites/umbrella typecheck
```

Install the site's frozen lockfile and start its dev server on an unused loopback port. For port 4189, capture the real WebGL image and a 120-frame idle measurement:

```bash
node sites/umbrella/scripts/verify-three-viewport.mjs http://127.0.0.1:4189 .cache/engine-refresh check
```

The script saves a canvas PNG, a page PNG, and metrics JSON. It fails if the browser cannot draw WebGL2, if idle advances a viewport frame, if orbit does not change the pixels, if Reset view does not restore them, or if mounting the root does not redraw. For comparisons, run the script before edits and again after edits with distinct labels. Finally run `.bb/skills/verify-sceneaxi/verify gate`.

## Gotchas

The verifier uses local Chrome with SwiftShader for reproducible software rendering. Animation-frame intervals are not GPU draw times. A headless Node frame never proves pixels. The desktop has a separate continuous-loop policy; this browser recipe does not prove the packaged Electron surface.
