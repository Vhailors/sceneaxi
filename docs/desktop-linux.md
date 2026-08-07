# Linux desktop application

Cross-surface release authorization, refusal, rollback, and evidence capture are owned
by [`production-activation.md`](production-activation.md). This document remains the
authoritative Linux artifact record and does not gain a signing or publication claim
from that runbook.

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

One bridge, mirrored on web-shell's transport-free inspector app; the renderer's
IPC channel and the local socket adapter are two transports over that one
`handle()`, never a second authoring implementation:

| Piece | Where it runs | What it is |
|---|---|---|
| `src/lib/bridge-contract.ts` | everywhere | channel name, request/response envelope, named refusals |
| `src/lib/bridge.ts` — `createDesktopBridge()` | main process | synchronous `handle()` over the real engine; `ipcMain.handle` adapts it in one line |
| `src/lib/local-rpc.ts` | main process | protocol-v1 same-user Unix-socket adapter over the closed project/assistant agent-tool registry; private discovery and explicit permissions |
| `src/lib/provider-key-store.ts` + `byo-configuration.ts` | main process | typed OS-secure credential store, redacted configuration controller, and per-session key lease for injected BYOK runners |
| `src/electron/provider-key-store.ts` | privileged Electron process | `safeStorage` adapter; refuses locked, unsupported, basic-text, and failed backends and persists ciphertext only |
| `src/electron/preload.ts` | preload | exposes one frozen global: the existing engine request plus a separate BYOK configuration method on its own IPC channel |
| `src/renderer/viewport.ts` | the window | the desktop tier's **one renderer-owning module** (see below) |

Bridge actions and what each reaches — only through public seams:

| Action | Reaches |
|---|---|
| `handshake` | identity only |
| `scene` | re-read the requested project-contained Scene Document, validate and reproduce its stored composition through `composeScene()`, then return the shared `MountableScene` payload from `@sceneaxi/site-kit` |
| `open-path` | the same requested document's composition — `documentPath` required exactly as for `scene` — through `bootstrapOpenPath()` from `@sceneaxi/engine-orchestrator`: a real kernel scene session opened, advanced, observed, closed, with its mountable payload returned for viewport synchronization |
| `assistant` | `runAssistantSculptAction()` in `@sceneaxi/authoring-core`: deterministic local compilation by default, or an explicitly injected BYOK runner; job status carries real progress and a typed artifact or recoverable named refusal. Hosted refuses here because this tier has no identity/credit authority |
| `authoring` | `createDesktopSession()` from `@sceneaxi/desktop-shell` — the same propose/accept protocol as the CLI and web-shell. A `documentPath` arrives from the renderer over IPC — here, and on `scene` and `open-path` alike — and the authoring core resolves it against `cwd` without a containment check of its own, so the bridge owns that constraint for every action that takes one: an absolute path, one escaping the project directory, or one whose **canonical** path leaves it through a symlink refuses `DESKTOP_BRIDGE_REQUEST_MALFORMED`. Containment is judged after symlink resolution because that is where the bytes land; a missing leaf still resolves, so this is containment and not an existence check |
| `frame-report` | nothing: it *accepts* the renderer's real presentation frame so main and the smoke can see what was claimed |

The UI is the Engine Desktop chrome from `@sceneaxi/desktop-shell`, **unforked**:
`desktopLinuxIndexHtml()` renders `renderDesktopChrome(desktopVisualView(...))` and
injects exactly two things — a `sceneaxi-desktop-runtime` marker meta and the
renderer script tag. No control, mode, refusal, or token is re-declared, so the
editor state machine stays owned by the shell ([sceneaxi#184](https://github.com/Vhailors/sceneaxi/issues/184)
deepens that surface, not this tier). The chrome's `sceneaxi-pixels-drawn` meta
stays `false` at build time; the renderer updates it only from a real frame's
`pixelsDrawn` — evidence, never assertion.

The renderer script progressively binds one desktop-only BYOK settings section
beside the shell-owned route selector. It uses the chrome's existing controls and
tokens and does not add an editor mode or action to the shell state machine.
Selecting BYOK shows OpenRouter key presence and Save, Replace, Remove, locked,
unsupported, corrupt, failure, or runtime-unavailable state; Remove stays offered
whenever a stored envelope is still safely unlinkable. Switching to Kids
hides the section and clears its password field before any submission or secure
store request can occur.

The local CLI/BYOK agent attachment is separately owned by
[`desktop-local-bridge.md`](desktop-local-bridge.md). It exposes no renderer-only
action, no TCP listener, no provider credential field, and no hosted route; the
real CLI-to-socket-to-authoring round trip is in
`tests/e2e/desktop-cli-local-bridge-golden.test.ts`.

### Assistant-to-viewport product loop

The packaged document requests a build only from Assistant **Build** mode. The
free Local route uses the deterministic compiler and no provider or credit; BYOK
uses only an injected runner and otherwise refuses
`DESKTOP_ASSISTANT_BYO_UNAVAILABLE`; Hosted names itself metered and refuses
`DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE` because the dependency matrix
correctly keeps auth/billing out of this tier. Hosted completion and debiting are
proved separately through web-shell's existing `createAssistantPanel()` seam.
The desktop golden test injects a real fixture-backed Model Provider Port through
that BYOK runner and proves the typed result crosses the job seam; the packaged
default deliberately injects no live provider transport or fallback behaviour.
Its configuration surface may persist only OS-encrypted credential bytes and
reports the provider runtime unavailable until that privileged adapter exists.

On success the existing validated `SculptArtifact` becomes the shared
`MountableScene` payload before it is mounted through `createSculptMountApi()` into
the one live center viewport. That projection is direct rather than a
`composeScene()` call: the composition contract's `SCENE_MINIMUM_INSTANCES` calls a
one-instance scene a sculpt and refuses it, and the mount carries an identity world
transform because placement here is the manipulators' job. The renderer exposes
real translate/rotate/scale controls using the Mount API and prints read-only
materials, collider physics where the quality artifact supports it, and
procedural settings. Unsupported edits and legacy physics inspection refuse by
name. Typed provider refusals, malformed output, timeouts, and other refusals remain
visible with Retry, while thrown provider detail is redacted because it may echo
credential material; a timeout first abandons the old job so its late result
cannot overwrite the retry, and a runner that dispatches nothing takes its
`running` claim back rather than leaving the seam permanently
`DESKTOP_ASSISTANT_BUSY`. Streaming progress contains only deltas actually
observed from a BYOK stream; the bridge retains the **newest** entry plus a count,
never the accumulated log, and stops accepting progress after abandonment. If the live viewport itself refuses — no bridge, no
composable scene, no WebGL surface, or a mount that fails — the composer is
transitioned by the visual model to `DESKTOP_NO_PRESENTATION_RUNTIME` instead of
staying live and unbound, because a control here is either live and acts or inert
and names a refusal. Selecting Kids removes the composer, the bridge refuses
`ASSISTANT_SCULPT_KIDS_DENIED` before it routes local, BYOK, or hosted, and
authoring-core denies the carried Kids profile again — independently — before
local compilation or provider dispatch.
The packaged document starts in that unavailable state and transitions to local
only after the bridge, initial Mount API scene, and every assistant handler bind.

### Configure a BYOK key

1. Open Assistant and select **BYOK · free** on Game or Website.
2. Confirm the provider row says **OpenRouter** and inspect the key/runtime status.
3. Paste the key and choose **Save key**. Once configured, the same action reads
   **Replace key**; **Remove** deletes the encrypted envelope.
4. The field clears immediately after submission. The stored value is never shown,
   copied into the project, or included in a status/refusal response.

Saving, replacing, reading, and provider dispatch all require OS secure storage to
be available and unlocked. Linux launches using Electron's `basic_text` password
backend refuse as unsupported; SceneAxi does not downgrade to plaintext. Deleting
is deliberately not one of those operations: unlinking the envelope needs no
cipher, so **Remove** stays offered when the backend is unavailable, locked, or
unsupported, and that path never reads, decrypts, or returns the envelope.
Because removal can succeed while the backend is still unreachable, the answer
carries a resolved `storageStatus` and the key field and Save stay disabled
afterwards rather than appearing live for a capability that would refuse on
submit. Which state label and message each refusal may show — including the rule
that only an unavailable-backend refusal may say the platform failed — is the
shared contract owned by
[`desktop-local-bridge.md`](desktop-local-bridge.md#byok-secure-storage-contract).

The checked-in host intentionally has no live provider session factory,
so it reports provider execution unavailable even when a key is securely stored.
This implements configuration and the privileged injection contract without
claiming production provider readiness.

The first-release manipulator is deliberately bounded: `Move +X` and `Move +Y`
advance by 0.25 world units, `Rotate Y` advances by 15 degrees, and `Scale +`
adds 0.1 uniformly. A replacement artifact resets that state to identity before
the controls act again. These controls are modelled by `desktop-shell` and use
its existing control tokens; the renderer declares only the Mount API effects,
not a parallel control or palette.

## The renderer-owning module

`docs/three-presentation-core.md` inventories every pixel-drawing surface. The
desktop tier adds one: `desktop/linux/src/renderer/viewport.ts`, which constructs
the ADR 0002 presentation backend over its own window canvas — exactly the calls
the umbrella's `sculpt-viewport.tsx` makes, naming no Three type. The golden test
asserts the tier has exactly one module constructing a backend, mirroring the
sites-tier owner-list assertion; the umbrella's own list is unchanged. Its
playback synchronizer is separately executable on the headless surface: the
golden replaces the mounted composition and proves a refused replacement rolls
back to the prior mount set.

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
gate until the other moves with it. Nothing on that page is rendered around the
record: `resolveDesktopAppOffer()` validates every field first, and an
incomplete, malformed, or wrongly-linked record refuses by name instead of
offering a download — the page's metadata, checksum, coming-soon, and refusal
behaviour is held by `tests/sites/desktop-download.test.ts`. The lockstep suite
also owns the offer's other restatement: the umbrella's marketing download table
(`sites/umbrella/src/lib/download-platform.ts`) reaches a `"use client"`
component and so cannot import the offer, and is instead bound to
`unavailablePlatforms` there — recording Windows or macOS availability fails the gate
until the landing page's "Coming soon" rows move with it.

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

**This download expires.** A workflow artifact is not a release. Run 30739014112
predates this branch — its source commit is the branch base — so GitHub fixed that
artifact's retention at upload time from the repository default, at most the 90 days
GitHub's own default gives. The upload step now declares `retention-days: 90`
explicitly, which governs every later run rather than this one. Either way these files
are gone on or before **2026-11-03**, 90 days after the verification date above. That
date is an upper bound twice over: a shorter inherited default expires sooner, and
retention runs from the run itself, which is on or before the verification date.
Nothing in this
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
Electron's user-data directory and seeds `scene.json`. A valid document from an
older desktop build that lacks the composed-scene field is migrated once by
adding the starter composition while retaining its id, title, entities, material,
and other data. Documents that already carry that field are never rewritten;
invalid existing bytes refuse rather than being replaced.

The profile switch presents **Game**, **Website (Web)**, and **Kids**:

- Game is the initial profile and exposes the current authoring projection.
- Website selects the Web Experience projection.
- Kids is present so its product boundary is visible, but it is **refuse-only** in
  this release. The application shows the named safety refusal and keeps the profile
  switch available so the operator can return to Game or Website; it does not claim
  a Kids authoring path that is not shipped.

A profile change is serialized with project actions. A staged proposal blocks
the tab change until Save applies it or Open explicitly discards it, and an
in-progress durable save blocks switching until Save refreshes recovery to a
terminal state. Open remains an explicit fresh-session re-read escape for any
non-terminal recovery; a missing journal takes that path automatically with
`journal-not-found` retained in the visible result, so the prior indeterminate
session cannot permanently block Open or switching.
Play advances the composed
scene through the orchestrator and succeeds only when the mounted renderer
redraws the same composed scene and acknowledges the post-play viewport frame.

The Assistant column distinguishes `Local · free`, `BYOK · free`, and
`Hosted · metered`. Build is the first-release artifact-producing mode; Ask and
Agent refuse instead of borrowing Build semantics. A mounted assistant result
keeps orbit/zoom plus explicit translation, rotation, and scale manipulators in
the center viewport.

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

**A local source build — recorded 2026-08-05, `pnpm dist` at the tier root on source
commit `342e5ff11676b7de38d22d94814fae75c7929868`.** A different build with its own
digests, kept because it is where the behaviour below was observed in detail. It is
also a *later source* than the offered artifact, which was packaged from this branch's
base `b338a911` and therefore predates the unified product loop
([sceneaxi#196](https://github.com/Vhailors/sceneaxi/issues/196)) these observations
describe — one more reason the record above must be re-taken from a fresh successful
main-branch run. These lines never describe the offered bytes. All three launch modes
printed the same proof (`pnpm smoke`, `pnpm smoke --packaged`, and the AppImage itself
with `--appimage-extract-and-run --smoke`):

- bridge handshake: `@sceneaxi/desktop-linux` on runtime `electron`, bridge v1
- kernel open path, requested for the seeded project-contained `scene.json`:
  bootstrap `kind scene · subjectId desktop-linux-open-scene`,
  4 ticks advanced, digest `sha256:a0cfe040739…` → `sha256:d683df159e8…`,
  3 instances, session closed — the same digests the 2026-07-31 record carried, so
  routing the open path through a named document moved nothing about what the kernel
  observed
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
  chrome — mode rail, the unified **Project / Files** panel listing `scene.json`
  as `Active · not opened`, title-bar **Open**/**Save** beside the project pill
  `scene.json · ready to open`, the **Play composed scene** control, dock with the
  Change Review queue, profile switch with `Kids refuse-only`, status bar
  `game profile · core 0.0.0` — with the three composed crates lit in the viewport
  above the kernel open-path line and the frame report line. Binary evidence stays
  out of the repository; the capture is reproducible with that one environment
  variable on any Linux host

The smoke owns a scratch project, so it proves nothing about the seed the *launched*
application starts from. That was observed separately on 2026-08-05, from the same
build, by launching the packaged binary against a throwaway `--user-data-dir` instead
of the host's own user data: an empty directory came back seeded with `scene.json`; a
valid document lacking the composed-scene field gained it while keeping its id, title,
entities, and material; relaunching over the resulting document left it byte-identical,
down to its mtime; and unparseable bytes were left exactly as found, with the seed
reporting its refusal rather than replacing them. Those are the behaviours the section
above describes.

## Deliberately absent

No public Windows artifact is recorded. No public macOS artifact is recorded either
(both are still shown as coming soon on `/engine` and in the umbrella's default-route
download legend, never implied).
Also absent: Linux code signing, Linux auto-update, an app store listing, a GitHub Release,
identity/billing (the desktop app has no account surface; the matrix denies it
`auth`/`billing`), any Kids authoring path (the chrome's refuse-only Kids projection
stays owned by `@sceneaxi/desktop-shell`, and the matrix denies every profile
package). The `desktop bridge` CLI group is now present and explicitly ungated
because it is local/free; held-key policy is untouched and every verb remains in
the shipped command map.

Windows packaging now lives in the separate `desktop/windows` path, which stages this
existing application for a mandatory-signed NSIS build and fail-closed updates, and the
separate `desktop/macos` root now owns macOS packaging, its signing/notarization
preflight, and its fail-closed update configuration. Neither changes this Linux record,
and each advertises nothing until `docs/desktop-windows.md` or `docs/desktop-macos.md`
contains a verified public release.
