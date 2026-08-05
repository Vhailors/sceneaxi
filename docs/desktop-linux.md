# Linux desktop application

The packaged **SceneAxi Engine Desktop** for Linux: `desktop/linux`
(`@sceneaxi/desktop-linux`), decided by [ADR 0024](adr/0024-linux-desktop-electron-tier.md)
and dispatched by [sceneaxi#183](https://github.com/Vhailors/sceneaxi/issues/183).
This document owns the runtime choice, the bridge map, the first-download record,
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
| `authoring` | `createDesktopSession()` from `@sceneaxi/desktop-shell` — the same propose/accept protocol as the CLI and web-shell. A `documentPath` arrives from the renderer over IPC and the authoring core resolves it against `cwd` without a containment check of its own, so the bridge owns that constraint: an absolute path, one escaping the project directory, or one whose **canonical** path leaves it through a symlink refuses `DESKTOP_BRIDGE_REQUEST_MALFORMED`. Containment is judged after symlink resolution because that is where the bytes land; a missing leaf still resolves, so this is containment and not an existence check |
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
The first download points to the concrete successful main-branch run recorded below.
No GitHub Release is created and no release URL is invented; the repository artifact
is the distribution path for this first ship.

## First download record

Verified 2026-08-05 by downloading `sceneaxi-desktop-linux` from the successful
main-branch workflow run below and running its own `sha256sum -c SHA256SUMS`.
Electron packaging is **not bit-reproducible**, so these digests identify that
workflow artifact only; a source rebuild produces its own `SHA256SUMS` beside its
own artifacts. The umbrella `/engine` page advertises exactly this record through
`desktopLinuxAppOffer()` in
`@sceneaxi/site-kit`, and `tests/sites/desktop-offer-lockstep.test.ts` holds the
offer and the table below in lockstep — a digest edited in one place fails the
gate until the other moves with it.

<!-- desktop-linux:release -->
| Field | Value |
|---|---|
| Version | `0.0.0` |
| Platform | Linux x86_64 |
| Repository artifact | [workflow run 30739014112](https://github.com/Vhailors/sceneaxi/actions/runs/30739014112) |
| Source commit | `b338a911b1e2646d815538c75daf82db5d8d6cd9` |
| Actions artifact | `sceneaxi-desktop-linux` |
| Checksum file | `SHA256SUMS` |
| Verified | 2026-08-05 |
| Artifact retention | 90 days |
| Download expires by | 2026-11-03 |

**This download expires.** A workflow artifact is not a release: the upload step
declares `retention-days: 90`, so GitHub deletes these files on or before
**2026-11-03** — 90 days after the verification date above, and earlier if the run
itself predates it, which is why the date is an upper bound. Nothing in this
repository can observe that deletion: the run page keeps resolving afterwards, and
`resolveDesktopAppOffer()` reads no clock, because a page that renders a different
record per visitor would be worse than one that states its own expiry. `/engine`
therefore prints the date beside the CTA, and the record above must be re-recorded
from a fresh successful main-branch run before it, or the offer stops being true.
Until then the honest fallback is the source build in this document.

The record is deliberately kept **out of the build it describes**: the tier bundles
site-kit for its scene payload, so `desktop-app-offer.ts` marks every `Object.freeze`
`@__PURE__` and esbuild drops it from `dist/main.cjs`. Without that, a build's digest
would ship inside the build, and re-recording one would invalidate it on the next
rebuild. The outcome is asserted where the bundle exists: `scripts/build.mjs` reads
the bytes esbuild emitted and fails the build if any of them carries a recorded
digest or file name. `tests/sites/desktop-offer-lockstep.test.ts` guards the
annotation that makes the drop possible, so the record and the artifact stay
independent.

<!-- desktop-linux:artifacts -->
| Artifact | File | Bytes | SHA-256 |
|---|---|---|---|
| AppImage | `SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage` | 115165695 | `ea962d2a44a5d141bfca8aee5d650575b3e4d1123f01c68d3bd0c3791e194527` |
| deb | `SceneAxi-Engine-Desktop-0.0.0-linux-amd64.deb` | 89870252 | `0b5b4ba2f2df41200087300f60543675d26357bbd22fd8cf19a5473ee17b99ac` |

The workflow pins Node 24 and pnpm 9.15.0; the tier lockfile supplies Electron
43.2.0, electron-builder 26.15.3, and esbuild 0.28.1 on `ubuntu-latest`. Its
packaged smoke runs under Xvfb with SwiftShader before upload.

## Download, verify, and install

Open [workflow run 30739014112](https://github.com/Vhailors/sceneaxi/actions/runs/30739014112)
and select `sceneaxi-desktop-linux` under **Artifacts**. GitHub may require sign-in
with repository access. Extract the downloaded bundle, then verify both packaged
files before running either one:

```bash
unzip sceneaxi-desktop-linux.zip -d sceneaxi-desktop-linux
cd sceneaxi-desktop-linux
sha256sum -c SHA256SUMS
```

Use either the portable AppImage or the Debian package:

```bash
chmod +x SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage
./SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage

# Or install the Debian package:
sudo apt install ./SceneAxi-Engine-Desktop-0.0.0-linux-amd64.deb
```

This `0.0.0` artifact makes no code-signing claim and has no auto-update support.
Future builds must be downloaded and checksum-verified manually.

## First launch and product tabs

On first launch, the application creates its persistent project directory under
Electron's user-data directory and seeds `scene.json` only when that file is absent.
Later launches reuse the project and do not replace existing project bytes.

The profile switch presents **Game**, **Website (Web)**, and **Kids**:

- Game is the initial profile and exposes the current authoring projection.
- Website selects the Web Experience projection.
- Kids is present so its product boundary is visible, but it is **refuse-only** in
  this release. The application shows the named safety refusal and keeps the profile
  switch available so the operator can return to Game or Website; it does not claim
  a Kids authoring path that is not shipped.

## Where each proof came from

Three sources, and they are not interchangeable. Electron packaging is not
bit-reproducible, so a proof of *this source* is not a proof of *those bytes*, and
mixing them would let the record claim more than it verified.

**Workflow run 30739014112 — the bytes offered above.** The run succeeded, and
`.github/workflows/desktop-linux.yml` puts every check before the upload: the tier is
type-checked, `pnpm dist` packages both files, `sha256sum -c SHA256SUMS` runs in
`desktop/linux/release`, and `xvfb-run -a pnpm smoke --packaged` launches the packaged
app under Xvfb with SwiftShader. Only then does `actions/upload-artifact` publish those
same files, with `if-no-files-found: error`. The run log is that evidence; no transcript
of it is copied here.

**The download — 2026-08-05.** `sceneaxi-desktop-linux` was downloaded from that run
and its own `sha256sum -c SHA256SUMS` checked locally; both files matched, which is
where the byte sizes and digests in the table above come from. That is the whole claim
made about the downloaded files: they were verified, not separately launched here.

**A local source build — recorded 2026-07-31, `pnpm dist` at the tier root.** A
different build with its own digests, kept because it is where the behaviour below was
observed in detail. These lines describe the same source as the offered artifact, never
the same bytes. All three launch modes printed the same proof (`pnpm smoke`,
`pnpm smoke --packaged`, and the AppImage itself with
`--appimage-extract-and-run --smoke`):

- bridge handshake: `@sceneaxi/desktop-linux` on runtime `electron`, bridge v1
- kernel open path: bootstrap `kind scene · subjectId desktop-linux-open-scene`,
  4 ticks advanced, digest `sha256:a0cfe040739…` → `sha256:d683df159e8…`,
  3 instances, session closed
- authoring: propose → accept → undo on a **scratch project the run creates and
  deletes** (never the persistent user project, whose contents no proof controls),
  asserted on the session's own phases and the bytes on disk rather than on the
  bridge envelope: `reviewing` with the file untouched → `applied` with the file
  changed → `undo` reporting success with the seeded bytes restored. The isolation
  is observed too, not declared: the app compares the directory it bound against
  its own persistent project path and refuses the round trip there, and the
  launcher separately checks the directory the proof reports is a temporary one
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

Windows and macOS packaging (shown as coming soon on `/engine`, never implied), code
signing, auto-update, an app store listing, a GitHub Release, identity/billing (the desktop
app has no account surface; the matrix denies it `auth`/`billing`), any Kids authoring path
(the chrome's refuse-only Kids projection stays owned by `@sceneaxi/desktop-shell`,
and the matrix denies every profile package), and any new CLI verb — held-key
policy is untouched.
