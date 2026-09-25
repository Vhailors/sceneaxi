# Three viewport

The shared renderer lights validated PBR materials on desktop and browser canvases. Desktop and umbrella cap device density at 1.5.

## Sub-features

- `viewport.studio` uses an in-memory studio reflection, sky/ground fill, and sRGB filmic output.
- `viewport.desktop` draws the packaged desktop scene through a real WebGL canvas.
- `viewport.density` bounds the live browser's drawing buffer on dense displays.

## How to get to it (user POV)

Open a desktop project to see its scene, or visit the umbrella site's public `/open` page. Drag to orbit and scroll to zoom.

## Driving it with verify

Install root, desktop, and umbrella dependencies. Build root and desktop. Start the umbrella locally on an isolated loopback port. The desktop smoke captures a real window after Play, and the browser helper captures the real canvas and measures its drawing buffer. Use new screenshot paths each time.

```bash
.bb/skills/verify-sceneaxi/verify build
.bb/skills/verify-sceneaxi/verify doctor
.bb/skills/verify-sceneaxi/verify test packages/engine-presentation/test/three-surface.test.ts packages/engine-presentation/test/three-presentation.test.ts
pnpm --dir desktop/linux build
SCENEAXI_SMOKE_SHOT="$PWD/.cache/desktop.png" xvfb-run -a pnpm --dir desktop/linux smoke
pnpm --dir sites/umbrella dev --hostname 127.0.0.1 --port 4173
node .bb/skills/verify-sceneaxi/viewport.mjs http://127.0.0.1:4173/open .cache/open.png
```

The last two commands need separate terminals. The browser helper requires the umbrella install root and Chrome at `/usr/bin/google-chrome`, overridable with `SCENEAXI_CHROME_PATH`. It keeps Chrome's sandbox unless `SCENEAXI_CHROME_NO_SANDBOX=1` is explicitly set. Use the same browser and machine for a before/after comparison. On the 2026-09-25 software-rendered fixture at device scale 2, the old 2x cap used 3,049,568 backing pixels. The 1.5x cap used 1,715,382 for the same 762,392 CSS pixels. Check the screenshot before interpreting frame intervals.

## Gotchas

The inspector's screenshot command captures its authoring UI, not the engine viewport. The headless test surface also draws no pixels. Browser `requestAnimationFrame` intervals include CPU contention and are not GPU timings. Software-rendered numbers cannot predict hardware performance. Stop only the local server you started.
