# Linux desktop application

The packaged **SceneAxi Engine Desktop** for Linux: `desktop/linux`
(`@sceneaxi/desktop-linux`), decided by [ADR 0024](adr/0024-linux-desktop-electron-tier.md)
and dispatched by [sceneaxi#183](https://github.com/Vhailors/sceneaxi/issues/183).
This document owns the runtime choice, the bridge map, the recorded build results,
and what stays deliberately absent. The tier's structural rules are enforced by
`pnpm check:desktop`; the engine paths are proven in
`tests/e2e/desktop-linux-bridge-golden.test.ts` (in `pnpm test:golden`).

## Runtime and bridge

**Electron** (pinned in `desktop/linux/package.json`), preferred by the dispatch and
blocked by no ADR: it reuses the repository's own TypeScript surfaces in both
processes and needs no second UI implementation. The window is locked down —
context isolation on, sandbox on, no node integration, navigation refused.

One bridge, one channel, mirrored on web-shell's transport-free inspector app:

| Piece | Where it runs | What it is |
|---|---|---|
| `src/lib/bridge-contract.ts` | everywhere | channel name, request/response envelope, named refusals |
| `src/lib/bridge.ts` — `createDesktopBridge()` | main process | synchronous `handle()` over the real engine; `ipcMain.handle` adapts it in one line |
| `src/electron/preload.ts` | preload | exposes exactly one frozen global with one `request()` method |
| `src/renderer/viewport.ts` | the window | the desktop tier's **one renderer-owning module** (see below) |

Bridge actions and what each reaches — only through public seams:

| Action | Reaches |
|---|---|
| `handshake` | identity only |
| `scene` | `composeScene()` via `desktopOpenScene()` → the shared `MountableScene` payload from `@sceneaxi/site-kit` |
| `open-path` | `bootstrapOpenPath()` from `@sceneaxi/engine-orchestrator`: a real kernel scene session opened, advanced, observed, closed |
| `authoring` | `createDesktopSession()` from `@sceneaxi/desktop-shell` — the same propose/accept protocol as the CLI and web-shell |
| `frame-report` | nothing: it *accepts* the renderer's real presentation frame so main and the smoke can see what was claimed |

The UI is the Engine Desktop chrome from `@sceneaxi/desktop-shell`, **unforked**:
`desktopLinuxIndexHtml()` renders `renderDesktopChrome(desktopVisualView(...))` and
injects exactly two things — a `sceneaxi-desktop-runtime` marker meta and the
renderer script tag. No control, mode, refusal, or token is re-declared, so the
editor state machine stays owned by the shell ([sceneaxi#184](https://github.com/Vhailors/sceneaxi/issues/184)
deepens that surface, not this tier). The chrome's `sceneaxi-pixels-drawn` meta
stays `false` at build time; the renderer updates it only from a real frame's
`pixelsDrawn` — evidence, never assertion.

## The renderer-owning module

`docs/three-presentation-core.md` inventories every pixel-drawing surface. The
desktop tier adds one: `desktop/linux/src/renderer/viewport.ts`, which constructs
the ADR 0002 presentation backend over its own window canvas — exactly the calls
the umbrella's `sculpt-viewport.tsx` makes, naming no Three type. The golden test
asserts the tier has exactly one module constructing a backend, mirroring the
sites-tier owner-list assertion; the umbrella's own list is unchanged.

## Build, verify, run

```bash
pnpm install                                   # repository root, once
cd desktop/linux
pnpm install                                   # tier-local: electron, esbuild, electron-builder
pnpm build                                     # dist/ runtime bundles + chrome document
pnpm start                                     # launch the window
pnpm dist                                      # AppImage + .deb + release/SHA256SUMS
(cd release && sha256sum -c SHA256SUMS)        # verify
pnpm smoke                                     # proof from the built runtime
pnpm smoke --packaged                          # the same proof from the packaged binary
```

Headless hosts wrap the smoke in `xvfb-run -a`; the launcher forces SwiftShader so
WebGL stays a real software rasterizer. CI (`.github/workflows/desktop-linux.yml`)
builds both artifacts on `ubuntu-latest`, runs the packaged smoke under xvfb, and
uploads them with `SHA256SUMS` as the workflow artifact `sceneaxi-desktop-linux`.
No GitHub Release is created; no release authority is claimed (the same posture as
the engine SDK, ADR 0019).

## Recorded build results

Recorded 2026-07-31, from `pnpm dist` at the tier root. Electron packaging is
**not bit-reproducible**, so these digests identify this recorded build; a rebuild
produces its own `SHA256SUMS` beside its own artifacts. The umbrella `/engine`
page advertises exactly this record through `desktopLinuxAppOffer()` in
`@sceneaxi/site-kit`, and `tests/sites/desktop-offer-lockstep.test.ts` holds the
offer and the table below in lockstep — a digest edited in one place fails the
gate until the other moves with it.

<!-- desktop-linux:artifacts -->
| Artifact | File | Bytes | SHA-256 |
|---|---|---|---|
| AppImage | `SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage` | 115161541 | `8c90d8aa375a63b3f7dcb133706984655c3996f9ea49b4632f3f2d38a74a87d9` |
| deb | `SceneAxi-Engine-Desktop-0.0.0-linux-amd64.deb` | 90490924 | `82a78341368838ebc8cb35063c09ff26b9aed7b447fde41f5e389752266faaee` |

Toolchain of the recorded build: Electron 43.2.0 · electron-builder 26.15.3 ·
esbuild 0.28.1 · Node 24.14.0 · pnpm 9.15.0 · Ubuntu 24.04 (kernel 6.17,
Mesa 25.2.8) under Xvfb with SwiftShader.

Smoke observations of the recorded build — all three launch modes printed the same
proof (`pnpm smoke`, `pnpm smoke --packaged`, and the AppImage itself with
`--appimage-extract-and-run --smoke`):

- bridge handshake: `@sceneaxi/desktop-linux` on runtime `electron`, bridge v1
- kernel open path: bootstrap `kind scene · subjectId desktop-linux-open-scene`,
  4 ticks advanced, digest `sha256:a0cfe040739…` → `sha256:d683df159e8…`,
  3 instances, session closed
- authoring: propose → accept → undo round trip completed on the scratch document
- renderer frame report: `backend three · surface webgl-canvas · pixelsDrawn true
  · drawCalls 15` — real pixels from the packaged window, drawn by SwiftShader
  under Xvfb, matching the draw-call count the headless gate derives from the
  same composition
- window DOM agreement (asserted by the smoke): exactly one live canvas, the
  chrome's "no renderer is mounted" note removed only after the real mount, and
  the on-surface report line printing the same frame the bridge received
- captured window (`SCENEAXI_SMOKE_SHOT=<path> pnpm smoke`): the Engine Desktop
  chrome — mode rail, dock with the Change Review queue, profile switch with
  `Kids refuse-only`, status bar `game profile · core 0.0.0` — with the three
  composed crates lit in the viewport above the kernel open-path line and the
  frame report line. Binary evidence stays out of the repository; the capture is
  reproducible with that one environment variable on any Linux host

## Deliberately absent

Windows and macOS packaging (stated on `/engine`, never implied), code signing,
auto-update, an app store listing, a GitHub Release, identity/billing (the desktop
app has no account surface; the matrix denies it `auth`/`billing`), any Kids path
(the chrome's refuse-only Kids projection stays owned by `@sceneaxi/desktop-shell`,
and the matrix denies every profile package), and any new CLI verb — held-key
policy is untouched.
