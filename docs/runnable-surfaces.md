# Runnable surfaces

What a user or agent can actually **start and drive**, and where each claim is
proven. This document exists so "runnable" stays a testable property rather than
a marketing word.

## Levels

| Level | Meaning | Evidence |
|---|---|---|
| **R2 — startable** | A real entrypoint a human can run and get product behaviour from | `bin` entry + a smoke test that **spawns** it |
| **R1 — driveable** | Reachable through the public seam and golden-tested end to end | golden e2e in `tests/e2e/` |
| **R0 — refuse-only** | A named shared path is deliberately unavailable | executable refusal matrix + an explicit empty-operation assertion |

## Surfaces

| Surface | Level | How to run | Proof |
|---|---|---|---|
| `@sceneaxi/cli` | **R2** | `pnpm build && node packages/cli/bin/sceneaxi.mjs --help` | `packages/cli/test/bin-smoke.test.ts` + the rest of `packages/cli/test/` |
| `@sceneaxi/desktop-shell` | **R2** | `pnpm build && node apps/desktop-shell/bin/sceneaxi-desktop.mjs --help`; for standalone chrome, `… chrome > shell.html`; the packaged host activates the File/Edit/Run commands — New, Open, Save, Undo, Play — their palette rows and accelerators, and the typed scene-property edit | `apps/desktop-shell/test/bin-smoke.test.ts`, `apps/desktop-shell/test/{product-loop,visual-model,visual-tokens,chrome}.test.ts`, `tests/e2e/desktop-product-loop-golden.test.ts`, `tests/e2e/desktop-command-interactions-golden.test.ts`, `tests/parity/shell-cli-parity.test.ts` + the browser record in [`engine-desktop-surface.md`](engine-desktop-surface.md) |
| `@sceneaxi/web-shell` (local authoring inspector + assistant transport) | **R2** | `pnpm build && node apps/web-shell/bin/sceneaxi-web-shell.mjs --cwd <project>`, then open the printed loopback URL or `POST /api/assistant` | `apps/web-shell/test/bin-smoke.test.ts` (spawns the binary and drives propose → accept plus a fixture assistant turn over a socket), `apps/web-shell/test/refuse-matrix.test.ts`, `tests/parity/shell-cli-parity.test.ts` |
| `@sceneaxi/desktop-linux` (packaged Linux desktop app, ADR 0024) | **R2** | `cd desktop/linux && pnpm install && pnpm build && pnpm start`; first launch offers contained New/Open/Recent project lifecycle; a bound project exposes selected-instance translation/rotation/scale and validated-local-artifact add/remove, each staged as one E1 proposal and written only on Save; Assistant Build's Local route compiles and mounts a typed sculpt without a provider; the running host also publishes the permission-bound protocol-v1 local CLI bridge; distributable via `pnpm dist` (AppImage + `.deb` + `SHA256SUMS`), proven by `pnpm smoke --packaged` | `tests/e2e/desktop-project-lifecycle-golden.test.ts` (preload-shaped create/open/cancel/recent/restart interaction), `tests/desktop/desktop-project-lifecycle.test.ts` (root, symlink, migration, invalid-byte, atomic-state contract), `tests/e2e/desktop-linux-bridge-golden.test.ts` (assistant → typed artifact → headless mount/manipulator contract, no pixel claim), `tests/e2e/desktop-cli-local-bridge-golden.test.ts` (spawned CLI → Unix socket → shared authoring session), `tests/desktop/desktop-scene-property.test.ts` and `tests/e2e/desktop-scene-property-golden.test.ts` (selected-instance transforms, add/remove, refusals, settlement, persistence, Play, and byte-identical canonical output against the protocol client and CLI), `tests/desktop/desktop-linux-seams.test.ts`, the spawned `--smoke` proof in CI (`.github/workflows/desktop-linux.yml`), and the recorded builds/pixel observations plus the offered workflow artifact in [`desktop-linux.md`](desktop-linux.md) |
| Game profile (single object) | **R1** | `pnpm test:golden` | `tests/e2e/cli-golden-path.test.ts` |
| Game profile (multi-object scene) | **R1** | `pnpm test:golden` | `tests/e2e/profile-game-scene-golden.test.ts` |
| Web Experience profile | **R1** | `pnpm test:golden` | `tests/e2e/profile-web-golden-path.test.ts` |
| Kids profile shared engine open path | **R0** | `pnpm test:golden` | `tests/e2e/profile-kids-refuse-golden.test.ts` |
| Kids isolated build-and-play activity (`sites/kids`) | **R1** | `cd sites/kids && pnpm install --frozen-lockfile && pnpm dev` (development phase only, this widens the served policy to `connect-src 'self'` + `'unsafe-eval'` so hot reload works; for the shipped policy use `pnpm build && pnpm start`); root proof via `pnpm test:golden` | `tests/e2e/profile-kids-refuse-golden.test.ts`, `packages/profile-kids/test/activity.test.ts`, `tests/sites/kids-surface.test.ts` |
| Importers + plugin host | **R1** | `pnpm test:golden` | `tests/e2e/importers-plugin-golden.test.ts`, `tests/e2e/plugin-capability-golden.test.ts` (the one registered capability, `sceneaxi.sculpt.intake-source.v1`, from the shipped seed through load to an addressed call) |
| Umbrella live open path (`/open`) | **R1** | `pnpm test:golden`; in a browser, `cd sites/umbrella && pnpm build && pnpm start` | `tests/e2e/umbrella-live-open-golden.test.ts` (headless surface, no pixel claim) + the browser record in `docs/three-presentation-core.md` |
| Umbrella entitled editors (`/editor`: Engine Desktop + simplified Web Experience projection) | **R1** | `pnpm test:golden`; in a browser, `cd sites/umbrella && pnpm build && SCENEAXI_SITE_EDITOR_PREVIEW=1 pnpm start`, then use `?profile=web` for the Web projection | `tests/e2e/umbrella-editor-viewport-golden.test.ts` (headless surface, no pixel claim), `packages/site-kit/test/{editor-shell,web-experience-editor}.test.ts`, `tests/sites/web-experience-editor.test.ts`, `tests/parity/editor-shell-parity.test.ts`, + the browser records in `docs/three-presentation-core.md` and [`web-editor-shell.md`](web-editor-shell.md). Without preview, the product path is the existing `/login` session and entitlement seam; a refused request constructs neither editor and draws nothing. The Web subset and sandbox are owned by [`web-experience-editor.md`](web-experience-editor.md) |

Hosted sign-in is the editor row's access path, not a second runnable-level claim:
`/login` and `POST /api/login|logout` exist to establish or clear the session that
unlocks `/editor`; the umbrella also hosts the two provider routes they call. Their
deterministic site-level proof is
`tests/sites/identity-plane-wiring.test.ts` plus
`tests/sites/umbrella-login-flow.test.ts`, while
`sites/umbrella/test/better-auth-provider.test.ts` drives real Better Auth sign-in and
cookie/bearer session lookup over an in-memory provider database. The editor's R1 claim remains owned by
the golden e2e named in the table.

`@sceneaxi/desktop-macos` is deliberately absent from the table. Its packaging,
signing/notarization preflight, disabled-without-release update policy, and missing-input
smoke are implemented and gate-tested, but no signed artifact or packaged launch proof
exists yet. [`desktop-macos.md`](desktop-macos.md) owns the operator path; the surface
earns R2 only after `pnpm smoke --packaged` succeeds for recorded release bytes.
How far each profile's open path may be *demonstrated*, and by what evidence, is
owned by [`open-path-policy.md`](open-path-policy.md) — one shared contract the
profiles, the CLI, and both shells all read. The levels there use this table's
vocabulary deliberately: `demo-driveable` is R1, `refuse-only` is R0, and neither
is a shipping claim.

`pnpm gate` runs everything above except the umbrella provider suite: `better-auth` and
`pg` resolve only from that site's own install root, so it runs there instead
(`sites/umbrella/README.md` owns the command) and CI runs it after the gate.
`pnpm test:golden` runs just the golden e2e set.
The Game multi-object and Web Experience tests assert their replay digests against
checked-in `golden-digests.json` evidence rather than values produced only within
the same run.

`asset list` deliberately reads Asset Package refs from Catalog Items'
`assetPackage` fields. SceneAxi does not define a parallel document-backed asset
schema: Asset Package and ingestion policy remain owned by
factories-helpers#47/#48 and are cited here rather than rewritten.

## Why the binaries run built output

Workspace packages keep **source-backed exports** (`"exports": "./src/index.ts"`),
which Node cannot follow at runtime: type-stripping does not rewrite `./foo.js`
specifiers back to `./foo.ts`, and parts of the core train use TypeScript syntax
strip-only mode rejects.

So each binary registers `scripts/workspace-dist-resolver.mjs`, which maps
`@sceneaxi/*` onto `<pkg>/dist/src/index.js` using the directories already
declared in `docs/dependency-matrix.json`. Consequences worth knowing:

- **`pnpm build` is a prerequisite for running any binary.** If the output is
  missing, the launcher says so and exits `1`.
- The resolver grants no access the matrix denies — it only rewrites specifiers a
  package was already allowed to name.
- Adding a workspace package makes it resolvable automatically, because the
  mapping is derived from the matrix rather than hand-maintained.

The live open path is **public**: no sign-in, no credits, no editing operation.
Its node proof stops where node stops — the headless surface never claims pixels,
so the pixel claim is a recorded browser observation, never a gate inference.

## Why the CLI and shells have no kernel or plugin verbs

`docs/dependency-matrix.json` allows `@sceneaxi/cli` and
`@sceneaxi/desktop-shell` to depend on `@sceneaxi/schemas` and
`@sceneaxi/authoring-core` **only**; `@sceneaxi/web-shell` additionally names
`@sceneaxi/auth` and `@sceneaxi/billing` for its account/credits view model
(`docs/auth-credits.md`). Kernel-session, presentation, and plugin-host verbs on
any of those surfaces would still require widening the matrix.

The boundary is not widened. Those paths are proven in `tests/e2e/`, which may
import any package. `scene compose` *is* on the CLI because `composeScene()`
lives in `authoring-core`.

Same reasoning puts `profile open-path` (and the desktop shell's `open-path`) on
the *policy* rather than the path: both surfaces report and evaluate the shared
open-path demo contract, which is `schemas`, and neither opens a kernel session,
which would not be. See [`open-path-policy.md`](open-path-policy.md), *"Where
parity stops, and why"*.

The first-release chrome's Play button does not widen that package graph or add
a shell command: it adapts onto the optional packaged-host port. The Linux host
already owns `bootstrapOpenPath()` and the presentation runtime under ADR 0024;
its renderer acknowledges the shared playback event only after drawing the
orchestrated result into the mounted viewport. Standalone chrome has no port or
viewport acknowledgement and refuses by name.

## Deliberate refusals

These are intentional fail-closed behaviors in runnable-surfaces v1. Their
authoritative contract determines whether each is a permanent boundary or a
still-unimplemented target:

- `project dev --watch` refuses because the normative E1 hot-reload loop is not
  implemented; `project dev` is currently one-shot. The target remains owned by
  `docs/authoring-contracts.md`.
- `project new` refuses to overwrite an existing document without `--force`.
- `catalog list` reports commerce activation and `metadataComplete`, which means
  mandatory metadata exists but does not imply screening, curation, human
  approval, or listing readiness; marketplace activation holds stay closed.
- `scene compose` fails closed on the named refuse matrix
  (`docs/scene-composition.md`) rather than composing a partial scene.
- The Kids profile's **shared engine open path** has no product surface: no
  kernel session, commerce, identity, or third-party LLM route, and
  `kidsBoundary.allowedDependents` stays empty. The separate `sites/kids` origin
  owns only the curated in-memory activity documented in
  [`kids-first-release.md`](kids-first-release.md); it imports no profile or shared
  site package. The desktop shell's editor chrome still honours the shared-path
  refusal over its design source: on the refuse-only profile the whole editor body is replaced by
  `OPEN_PATH_KIDS_REFUSED` rather than rendered disabled, the mode rail refuses
  by the same name, and the assistant shows its own named denial — all of it in
  the emitted bytes and selected by state, so a browser-side profile switch
  reaches the same refusals
  ([`engine-desktop-surface.md`](engine-desktop-surface.md)).
- Standalone `sceneaxi-desktop chrome` mounts **no** presentation runtime and
  opens **no** kernel session, so its viewport draws no pixels and its live
  Open/Save/Play controls refuse `DESKTOP_RUNTIME_UNAVAILABLE`. The exact same
  bytes become the product loop when a packaged host injects the existing
  authoring/open-path port; renderer and kernel authority stay in that host.
  This package still ships no installer. The packaged application is the
  `@sceneaxi/desktop-linux` row above ([`desktop-linux.md`](desktop-linux.md)).

## Commercial model

The CLI is **free and BYO-AI**: no verb reads a provider credential or spends
anything, and no shipped verb is held-key gated (`SHIPPED_COMMAND_MAP`). The
`desktop bridge` group opens only the same-user Unix socket documented in
[`desktop-local-bridge.md`](desktop-local-bridge.md); every tool has
`creditRoute: none`, and the CLI never receives that socket's capability in output.

Hosted AI is metered but remains **explicit and default-off**. The free-vs-paid
matrix it obeys — including BYO-key never touching the ledger and the
non-overridable Kids deny — is owned by
[`docs/auth-credits.md`](auth-credits.md). The credit ledger, metering, and the one
default-off gate a hosted call must pass to reach a debit (`runMeteredModelCall`)
exist in `packages/billing`, and `createAssistantPanel()` composes that gate with
the Model Provider Port in `apps/web-shell` (sceneaxi#121). The startable
loopback shell exposes that existing panel at `POST /api/assistant`: fixture is
the deterministic default, while an injected panel supplies any explicit BYO or
hosted wiring. The transport creates no provider, identity, or credits policy,
and the built default panel has no ledger or hosted opt-in, so it cannot spend.
The packaged Linux desktop exposes the same distinction but does not own a
hosted billing route: Local is deterministic and free, BYOK needs both an
OS-encrypted key from that tier's own secure store and an explicitly injected
privileged provider session — and touches no credits either way — and Hosted
refuses by name.

## Why the web shell serves loopback only

`sceneaxi-web-shell` is a **local authoring** surface, not a deployment. Its run
instructions, security rationale, and authoritative refusal table live in
[`../apps/web-shell/README.md`](../apps/web-shell/README.md); the shell adds only
transports over the inspector phases and the assistant panel it already had. The
deployable web tier remains the separate `sites/` tier (ADR 0018).

## Not runnable yet

- **`@sceneaxi/desktop-windows` public installer** — the packaging, mandatory
  Authenticode signing, NSIS update, and existing-draft release path are implemented
  and smoke-tested, but no signing credential or public artifact is present. It gains
  an R2 claim only after an operator produces, verifies, and records a real release as
  specified in [`desktop-windows.md`](desktop-windows.md); Windows remains coming soon
  in the download IA until then.

- **`apps/catalog-game`, `apps/catalog-web`** — dormant, owned by the
  websites/deploy track.
