# Desktop viewport

The desktop viewport uses the shared Three presentation core. Verify its pixels in the Electron window, not in the web inspector. The smoke creates and removes its own scratch project.

```bash
.bb/skills/verify-sceneaxi/verify doctor
mkdir -p .cache/verify-sceneaxi
.bb/skills/verify-sceneaxi/verify desktop-viewport "$PWD/.cache/verify-sceneaxi/desktop.png"
.bb/skills/verify-sceneaxi/verify test packages/engine-presentation/test/three-presentation.test.ts
.bb/skills/verify-sceneaxi/verify gate
```

`desktop-viewport` builds the desktop bundle, runs `pnpm --dir desktop/linux smoke`, and saves the real window capture. Require `desktop-linux smoke OK`, `surface webgl-canvas`, `pixelsDrawn true`, and a positive `drawCalls` count in the adjacent log. Read the PNG to assess lighting and geometry. The log reports elapsed seconds and peak resident memory for the full smoke, which includes startup, bridge calls, edits, and rendering. These numbers do not measure frame time or GPU throughput. Compare captures at the same window size and software-renderer settings. The command refuses to replace the screenshot or logs.

The root gate proves both headless and injected presentation paths; it does not prove pixels. The desktop smoke proves the Electron canvas and its frame report, but does not prove an umbrella site build. If the shared renderer changes, verify the umbrella site separately before claiming that site's pixels changed as intended.
