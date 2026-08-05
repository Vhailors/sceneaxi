# @sceneaxi/desktop-linux

The packaged **Linux desktop application**: the Engine Desktop editor chrome from
`@sceneaxi/desktop-shell` in an Electron window, connected to the real engine
stack — `composeScene()` composition, the orchestrated kernel open path, the one
Three presentation core drawing real pixels in the renderer process, and the
shared authoring propose/accept session. Not a static HTML export: every claim
below is exercised by a spawned binary or a gate test.

Ownership map, the first-download record (the offered workflow artifact, its
checksums, and the date it expires), and what stays deliberately absent:
[`docs/desktop-linux.md`](../../docs/desktop-linux.md). Tier decision: ADR 0024.

## Build and run

This directory is its own pnpm install root (like each site, ADR 0018/0024), so
Electron never touches the hermetic repository-root lockfile. The workspace
packages arrive through `link:` specifiers and are bundled from their TypeScript
sources by esbuild.

```bash
# once, at the repository root (the linked packages need their node_modules)
pnpm install

cd desktop/linux
pnpm install          # electron + esbuild + electron-builder, tier-local
pnpm build            # dist/main.cjs, dist/preload.cjs, dist/renderer.js, dist/index.html
pnpm start            # launch the window against the real GPU
```

## Package and verify

```bash
pnpm dist             # AppImage + .deb + release/SHA256SUMS
(cd release && sha256sum -c SHA256SUMS)

pnpm smoke            # built runtime proof (spawns electron with --smoke)
pnpm smoke --packaged # the same proof from the electron-builder output
```

Headless hosts run the smoke under `xvfb-run -a`; it forces SwiftShader so WebGL
stays a real software rasterizer rather than a stub. `--smoke` prints one JSON
line proving: bridge handshake, a real kernel scene session bootstrapped through
`@sceneaxi/engine-orchestrator` with digests that move across ticks, an
authoring propose → accept → undo round trip, and the renderer's real
presentation frame report (`backend three`, `surface webgl-canvas` where a
drawing buffer exists).

The packaged chrome also binds its Assistant **Build** mode to the bridge. Local
is a deterministic, free compiler; BYOK is free of SceneAxi credits but runs
only when the embedding deployment injects its provider runner; Hosted is
metered and refuses here because this desktop tier has no identity/credit plane.
A successful action mounts the validated Sculpt Artifact into the live center
viewport, adds translate/rotate/scale manipulators, and shows the artifact's
read-only materials, supported collider physics, and procedural settings.
Progress, provider/refusal details, and Retry remain on the surface. Ask and
Agent modes refuse clearly rather than pretending they produce build output.

## Shape

| Piece | Path | Runs in |
|---|---|---|
| Bridge contract (channel, envelope, refusals) | `src/lib/bridge-contract.ts` | everywhere (pure) |
| Bridge (`handle()` over the real engine and assistant job) | `src/lib/bridge.ts` | main process; gate-tested from `tests/e2e/` |
| Scene composition (one pipeline, two consumers) | `src/lib/desktop-scene.ts` | main process; gate-tested |
| Chrome document emitter (desktop-shell, unforked) | `src/lib/chrome-document.ts` | build time |
| Electron entries (window, IPC adapter, smoke) | `src/electron/{main,preload}.ts` | Electron only |
| Live viewport (the desktop tier's one renderer-owning module) | `src/renderer/viewport.ts` | the window |

Rules the gate enforces (`pnpm check:desktop`, `pnpm check:boundaries`,
`tests/desktop/`, `tests/e2e/desktop-linux-bridge-golden.test.ts`):

- Only `src/electron/**` may import Electron; `src/lib/**` stays pure TypeScript
  the hermetic gate tests without an Electron install.
- The visual model is consumed, never duplicated: no control, mode, refusal, or
  token is re-declared here, and the emitted document is byte-derived from
  `renderDesktopChrome()` plus exactly two injections (a runtime marker meta and
  the renderer script tag).
- The chrome's `sceneaxi-pixels-drawn` meta stays `false` at build time; the
  renderer updates it only from a real presentation frame's `pixelsDrawn`.
- Kids has no assistant path here: the chrome's refuse-only projection stays
  owned by `@sceneaxi/desktop-shell`, and the bridge carries the selected profile
  only to trigger authoring-core's deny before generation/provider dispatch. No
  Kids or identity package is imported; the dependency matrix keeps both denied.
- No secret exists in this tier; the window runs with context isolation and the
  sandbox on, and navigation away from the packaged document is refused.

## What this is not

Linux code signing/auto-update, an app store listing, identity/billing, and any
publication or release authority — all deliberately absent, recorded in
`docs/desktop-linux.md`. Windows and macOS each now have a separate ops-gated
packaging root (`desktop/windows`, `desktop/macos`); neither changes a Linux source
or claim, and there is no public Windows artifact and no public macOS artifact yet
(`docs/desktop-windows.md`, `docs/desktop-macos.md`).
