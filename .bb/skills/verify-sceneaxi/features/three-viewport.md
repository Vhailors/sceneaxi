# Three viewport

## Sub-features

The shared Three core lights the PBR artifact, applies ACES tone mapping on a browser canvas, and draws a world-origin grid. The umbrella `/open` session sleeps after a settled frame. Orbit, reset, mount changes, viewport changes, and restored WebGL context request a new frame. The marketing hero uses the same core but does not accept orbit input.

## How to get to it (user POV)

Open `/open` on the local umbrella site. The canvas shows three crates on a grid. Drag to orbit, select **Reset view**, then select **Mount the root instance only**. The public route needs no account.

## Driving it with verify

Run the root `verify build` and `verify doctor` from the [verification skill](../SKILL.md). Install the separate umbrella lockfile with `pnpm --dir sites/umbrella install --frozen-lockfile`. Start `pnpm --dir sites/umbrella dev --hostname 127.0.0.1 --port 4187` on a free local port. Drive the browser from the root with the URL and an untracked evidence directory:

```sh
node .bb/skills/verify-sceneaxi/viewport.mjs http://127.0.0.1:4187/open .cache/engine-refresh after --idle
```

The command writes a canvas screenshot, a full-page screenshot, and JSON measurements. It refuses a missing canvas, a headless surface, a frame with no pixels, continuous idle drawing when `--idle` is set, failed orbit or wheel zoom, a reset that does not recover the opening PNG, a mount toggle with unchanged draw calls, a resize without a new frame, and a failed WebGL context restoration when the browser exposes `WEBGL_lose_context`. For a pre-change baseline, omit `--idle`. Compare recorded frame counts over 120 animation frames and the browser's animation-frame p50/p95. Those timings include the host, browser, and software GPU. They are not a hardware-independent render benchmark. Run `verify test packages/engine-presentation/test/three-surface.test.ts`, then `verify gate` and `pnpm --dir sites/umbrella typecheck`.

## Gotchas

The script requires installed Chrome at `/usr/bin/google-chrome` unless `CHROME_BIN` names another executable. The first Next request compiles the route and may take more than a minute. Warm the route before measuring. The grid adds one WebGL draw call that the headless mesh counter does not claim. A screenshot of the web-shell inspector is not a screenshot of this canvas. Keep the development server separate from shared services and stop only the process started for this run.
