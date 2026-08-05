# ADR 0024: A `desktop/` tier — the Linux desktop application is Electron over the shell's chrome and the real engine

- **Status:** Accepted — **Amended 2026-08-05** by
  [sceneaxi#204](https://github.com/Vhailors/sceneaxi/issues/204): the tier gained the
  `desktop/windows` packaging root around this same application, with no public
  artifact. See *Amendment* below.
- **Date recorded:** 2026-07-31
- **Source:** captain hard mandate (2026-07-31), [sceneaxi#183](https://github.com/Vhailors/sceneaxi/issues/183) — ship a real downloadable Linux desktop application over the real engine stack, superseding the HTML-chrome-only story for packaging (the chrome itself, sceneaxi#158, is unchanged).
- **Lineage:** Extends the separate-install-root pattern of [ADR 0018](0018-sites-tier-three-vercel-one-neon.md) to a new tier; consumes [ADR 0002](0002-presentation-runtime-deep-seam.md)/[0017](0017-three-product-presentation-core.md) presentation unchanged; opens sessions only through [ADR 0023](0023-open-path-bootstrap-and-session-lifecycle.md); widens neither [ADR 0003](0003-editor-sequencing-e1-first-e2-specified.md) nor [ADR 0020](0020-minimum-e2-web-editor-entitlement.md); claims no distribution authority beyond what [ADR 0019](0019-public-engine-sdk-zip-not-npm.md) already models.

## Context

`@sceneaxi/desktop-shell` deliberately shipped no native packaging: its chrome is a
self-contained HTML view model that mounts no renderer and opens no session, and its
matrix row allows only `schemas` + `authoring-core`. The captain mandate now orders a
real, installable Linux application whose window is that Engine Desktop UI over the
real `engine-kernel` / `engine-presentation` / `authoring-core` / orchestrator stack.

Electron and its packaging toolchain are exactly the kind of dependency ADR 0018
keeps out of the hermetic root: installing them as workspace members would move the
root lockfile and the gate runtime for every lane.

## Decision

A new top-level **`desktop/` tier** holds packaged desktop applications; the first is
**`desktop/linux`** (`@sceneaxi/desktop-linux`), an **Electron** app. Normative
properties:

- **Separate install root.** Like each site: its own single-package pnpm workspace
  and lockfile, outside the repository-root workspace; workspace packages arrive via
  `link:` and are bundled from source by esbuild. Electron, esbuild, and
  electron-builder exist only in this tier — `pnpm check:desktop` fails if one
  reaches the hermetic root manifest or the root workspace globs `desktop/`.
- **Gated like a tier, not a guest.** `check:syntax` and `check:boundaries` walk
  `desktop/`; the app is matrix-listed in a new `desktop` release group; a new
  `check:desktop` stage joins `pnpm gate`; injected-violation regressions in
  `tests/boundary/injected-desktop-violations.test.ts` prove each rule fails closed.
- **The chrome is consumed, never forked.** The window document is
  `renderDesktopChrome(desktopVisualView(...))` from `@sceneaxi/desktop-shell` plus
  exactly two injections (a runtime marker meta, the renderer script tag). The
  editor state machine, controls, refusals, and tokens stay owned by the shell.
- **One narrow bridge seam.** A transport-free synchronous `handle()`
  (`createDesktopBridge()`), mirrored on web-shell's inspector app, is the only
  thing Electron adapts. Its actions reach `composeScene()`, `bootstrapOpenPath()`,
  and `createDesktopSession()` through public seams; `pnpm gate` proves all of it
  with no Electron install, and the packaged binary re-proves it via `--smoke`.
- **A fourth pixel surface, same honesty rules.** The renderer process holds the
  tier's one renderer-owning module (`src/renderer/viewport.ts`), drawing the shared
  `MountableScene` payload through the unchanged ADR 0002 seam. Node gates use the
  headless surface and never claim pixels; the pixel claim is the recorded
  observation in [`docs/desktop-linux.md`](../desktop-linux.md). The chrome's
  `sceneaxi-pixels-drawn` meta is updated only from a real frame report.
- **Matrix edges, exhaustively:** `schemas`, `desktop-shell`, `site-kit` (the shared
  mount payload), `authoring-core`, `engine-kernel`, `engine-orchestrator`,
  `engine-presentation`. No profile, no Kids, no `auth`/`billing`, no plugin host.
  ADR 0022 is a *sites*-tier bound and is not widened: no site gains an edge here.
- **Distribution is honest.** electron-builder produces AppImage + `.deb` with a
  `SHA256SUMS`; packaging is not bit-reproducible, so published digests identify a
  **recorded build**, held in lockstep between the site-kit offer and
  `docs/desktop-linux.md` by a gate test. CI uploads a workflow artifact; no GitHub
  Release, no store listing, no update channel. The umbrella `/engine` page
  advertises the record beside the SDK zip and states Windows/macOS are not
  packaged.

## Consequences

- A desktop app can finally be *started from an artifact* (`pnpm dist`, install the
  `.deb` or run the AppImage), and `docs/runnable-surfaces.md` records the new R2
  surface with its proof chain.
- The `desktop` release group joins the matrix and `ReleaseGroup` vocabulary.
- `check-publish-ready` treats `desktop/` like `sites/`: deployable, not consumable
  (`link:` into `packages/` **or `apps/`** — the one widening this ADR makes to that
  checker, since the chrome lives in `apps/desktop-shell`).
- Kids isolation, held-key policy, general-E2 bounds, and Stripe live-mode posture
  are untouched; the app adds no CLI verb and no identity surface.

## Rejected alternatives

- **Tauri / a native shell** — would need a second UI implementation or a webview
  bridge to the same conclusion, without reusing the repo's node-side TypeScript in
  the main process; nothing in the ADRs favors it enough to give up seam reuse.
- **Packaging inside `apps/desktop-shell`** — puts Electron in the hermetic root
  lockfile and widens the shell's deliberately narrow matrix row.
- **A static HTML export as "the app"** — explicitly refused by the mandate; the
  chrome alone draws no pixels and opens no session.
- **Serving the AppImage from the umbrella** — a >100 MB non-reproducible binary
  built by a site build; instead the site advertises the recorded build and CI
  carries the bytes.
- **Claiming Windows/macOS alongside** — no build, no proof, no claim.

## Settled here vs held elsewhere

**Settled:** the `desktop/` tier and its gate coverage; Electron as the Linux
runtime; the bridge seam; the tier's matrix edges; recorded-build distribution via
CI artifact + lockstep checksums; `/engine` advertising.

**Held elsewhere:** Windows/macOS packaging, signing, auto-update, store listings,
and release/tagging authority; the live editor deepening (sceneaxi#184); identity
in the desktop app; Kids anything; Stage 1 and every captain hold.

## Amendment — Windows packaging landed as a second install root (2026-08-05)

[sceneaxi#204](https://github.com/Vhailors/sceneaxi/issues/204) adds `desktop/windows`,
which extends this tier's separate-install-root pattern rather than changing any
decision above. It stages the already-built `desktop/linux` runtime for a signed NSIS
build and adds only a Windows updater bootstrap — no second chrome, bridge, renderer,
or matrix edge (its allow list is empty). The one factual claim this amendment
corrects is scope: Windows *packaging* is no longer held elsewhere, while Windows
signing credentials, release/tagging authority, and any public artifact still are.
Nothing here becomes a claim: `dist`
refuses without operator-supplied signing inputs and never publishes, `/engine` keeps
Windows as a coming-soon row, and the download IA may only change after a real
release is verified and recorded. That contract's owner is
[`docs/desktop-windows.md`](../desktop-windows.md).

## Amendment — macOS packaging landed as a second install root (2026-08-05)

macOS packaging, its signing/notarization preflight, and its fail-closed update
configuration landed as another install root in this tier, `desktop/macos`
([sceneaxi#194](https://github.com/Vhailors/sceneaxi/issues/194)), owned by
[`../desktop-macos.md`](../desktop-macos.md). It stages this Linux application's own
build rather than forking it, and records no released artifact — so `/engine`
advertising, store listings, and release/tagging authority are all unchanged by it,
and macOS *packaging* alone moves out of "held elsewhere".
