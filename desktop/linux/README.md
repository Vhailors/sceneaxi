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
pnpm check:renderer   # browser graph and sole presentation owner
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
authoring selection → proposal review → atomic save → fresh-session reopen → Play
round trip for the starter entity's Translation X, the saved composition's
viewport redraw, and the renderer's real presentation frame report (`backend
three`, `surface webgl-canvas` where a drawing buffer exists).

The packaged chrome also binds its Assistant **Build** mode to the bridge. Local
is a deterministic, free compiler; BYOK is free of SceneAxi credits but runs
only when the privileged host retrieves an OpenRouter key from the typed
`ProviderKeyStore` and injects its provider session; Hosted is
metered and refuses here because this desktop tier has no identity/credit plane.
A successful action projects the validated Sculpt Artifact through the shared
`MountableScene` payload — directly, since composition refuses a one-instance
scene as a sculpt — before the
live center viewport mounts it, adds translate/rotate/scale manipulators, and shows the artifact's
read-only materials, supported collider physics, and procedural settings.
Progress, named refusals, and Retry remain on the surface, while a BYOK
provider's own failure detail is redacted — whether the runner threw it or
returned it — because it may echo credential material. A timed-out
job is abandoned by its exact start identifier before Retry is offered, so a
late provider result cannot replace the newer job. Assistant **Agent** uses the
privileged no-network rarity fixture through the same Model Provider Port, then
stages the canonical result in the existing Change Review; it does not mount a
second artifact or accept provider entropy. Ask refuses clearly rather than
pretending it produces build output. The shell visual model owns the manipulator controls
and tokens; the renderer only binds their Mount API effects.

## Shape

| Piece | Path | Runs in |
|---|---|---|
| Bridge contract (channel, envelope, refusals) | `src/lib/bridge-contract.ts` | everywhere (pure) |
| Bridge (`handle()` over the real engine and assistant job) | `src/lib/bridge.ts` | main process; gate-tested from `tests/e2e/` |
| Local RPC adapter | `src/lib/local-rpc.ts` | main process; private same-user Unix socket for the CLI's closed agent tools |
| Provider key store + configuration | `src/lib/{provider-key-store,byo-configuration}.ts` | privileged host; encrypted-at-rest store, redacted status/mutations, per-session key lease |
| BYOK surface projection (which controls may be offered, and the copy) | `src/lib/byo-configuration-view.ts` | pure; gate-tested from `tests/desktop/` |
| Electron secure-store adapter | `src/electron/provider-key-store.ts` | main process; OS-backed `safeStorage`, never basic-text fallback |
| Privileged provider composition | `src/electron/provider-runtime.ts` | main process; exact OpenRouter pin and policy over an injected transport, with no live transport in the checked-in build |
| BYOK configuration UI | `src/renderer/byo-configuration.ts` | the window; provider/key status and save/replace/remove/unavailable states |
| Scene composition (one pipeline, two consumers) | `src/lib/desktop-scene.ts` | main process; gate-tested |
| Contained project lifecycle + versioned atomic recents | `src/lib/{project-lifecycle-contract,project-lifecycle,project-host}.ts` | pure typed host seam; gate-tested from `tests/desktop/` and packaged-like e2e |
| Explicit New Project starter and one-time document migration | `src/lib/project-seed.ts` | main process; invoked only after New Project selects a root or by the isolated smoke |
| Chrome document emitter (desktop-shell, unforked) | `src/lib/chrome-document.ts` | build time |
| Electron entries (window, IPC adapter, smoke) | `src/electron/{main,preload}.ts` | Electron only |
| Live viewport (the desktop tier's one renderer-owning module) | `src/renderer/viewport.ts` | the window |
| Playback mount synchronizer (constructs no backend) | `src/renderer/viewport-playback.ts` | the window; gate-tested |

Rules the gate enforces (`pnpm check:desktop`, `pnpm check:boundaries`,
`tests/desktop/`, `tests/e2e/desktop-linux-bridge-golden.test.ts`):

- Only `src/electron/**` may import Electron or the concrete OpenRouter adapter,
  and nothing outside it may import *from* it — a re-export would launder the same
  adapter into an unprivileged bundle while naming neither. `src/lib/**` stays pure
  TypeScript the hermetic gate tests without an Electron install.
- The visual model is consumed, never duplicated: no control, mode, refusal, or
  token is re-declared here, and the emitted document is byte-derived from
  `renderDesktopChrome()` plus exactly two injections (a runtime marker meta and
  the renderer script tag). The document starts with the assistant runtime
  unavailable; only complete viewport and handler binding promotes it to local.
  Runtime loss is signalled back to the chrome, which applies the visual model's
  precomputed unavailable transition to every control.
- The chrome's `sceneaxi-pixels-drawn` meta stays `false` at build time; the
  renderer updates it only from a real presentation frame's `pixelsDrawn`.
- Kids has no assistant path here: the chrome's refuse-only projection stays
  owned by `@sceneaxi/desktop-shell`, the bridge refuses
  `ASSISTANT_SCULPT_KIDS_DENIED` before it routes local, BYOK, or hosted, and
  the profile it carries makes authoring-core deny again — independently — before
  generation or provider dispatch. No Kids or identity package is imported; the
  dependency matrix keeps both denied.
- The lifecycle host accepts roots only from native directory dialogs or its own
  validated recent registry. It canonicalizes them, validates `scene.json`
  before persistence, refuses traversal and symlink escapes, and stores only
  canonical root strings in a versioned atomically-renamed file. Kids refuses
  before the host opens a dialog or reads that registry.
- Provider secrets exist only transiently in the password control during
  submission and in the privileged main process during secure save/retrieval and
  a provider session. The field and privileged lease are explicitly cleared; no
  raw value reaches the engine bridge, Unix socket, CLI, project, URL, output, or
  log. Electron `safeStorage` protects the persisted ciphertext, and Linux
  `basic_text`/unknown backends refuse. The local RPC adapter does generate a
  project-scoped 256-bit capability in a mode-`0600` discovery descriptor; it is
  local bridge authentication, never BYOK configuration, and is neither logged
  nor returned by the CLI. Provider credentials may arrive only inside an
  injected runner backed by the OS credential store, as specified in
  [`docs/desktop-local-bridge.md`](../../docs/desktop-local-bridge.md). The window
  still runs with context isolation and the sandbox on, and navigation away from
  the packaged document is refused.

## What this is not

Linux code signing/auto-update, an app store listing, identity/billing, and any
publication or release authority — all deliberately absent, recorded in
`docs/desktop-linux.md`. Windows and macOS each now have a separate ops-gated
packaging root (`desktop/windows`, `desktop/macos`); neither changes a Linux source
or claim, and there is no public Windows artifact and no public macOS artifact yet
(`docs/desktop-windows.md`, `docs/desktop-macos.md`).

This configuration surface does not authorize production deployment,
hosted-provider activation, Stripe LIVE, Connect LIVE, legal/tax behavior,
production credentials, or public Windows/macOS release behavior.
