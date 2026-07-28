# Runnable surfaces

What a user or agent can actually **start and drive**, and where each claim is
proven. This document exists so "runnable" stays a testable property rather than
a marketing word.

## Levels

| Level | Meaning | Evidence |
|---|---|---|
| **R2 — startable** | A real entrypoint a human can run and get product behaviour from | `bin` entry + a smoke test that **spawns** it |
| **R1 — driveable** | Reachable through the public seam and golden-tested end to end | golden e2e in `tests/e2e/` |
| **R0 — refuse-only** | The *product* is a refusal/isolation boundary, not a UI | executable refuse matrix + an explicit "no product surface" assertion |

## Surfaces

| Surface | Level | How to run | Proof |
|---|---|---|---|
| `@sceneaxi/cli` | **R2** | `pnpm build && node packages/cli/bin/sceneaxi.mjs --help` | `packages/cli/test/bin-smoke.test.ts` + the rest of `packages/cli/test/` |
| `@sceneaxi/desktop-shell` | **R2** | `pnpm build && node apps/desktop-shell/bin/sceneaxi-desktop.mjs --help`; for the editor chrome, `… chrome > shell.html` and open that file | `apps/desktop-shell/test/bin-smoke.test.ts` (including a spawned `chrome` render), `tests/parity/shell-cli-parity.test.ts`, `apps/desktop-shell/test/{visual-model,visual-tokens,chrome}.test.ts` + the browser record in [`engine-desktop-surface.md`](engine-desktop-surface.md) |
| `@sceneaxi/web-shell` (local authoring inspector) | **R2** | `pnpm build && node apps/web-shell/bin/sceneaxi-web-shell.mjs --cwd <project>`, then open the printed loopback URL | `apps/web-shell/test/bin-smoke.test.ts` (spawns the binary and drives propose → accept over a socket), `apps/web-shell/test/refuse-matrix.test.ts`, `tests/parity/shell-cli-parity.test.ts` |
| Game profile (single object) | **R1** | `pnpm test:golden` | `tests/e2e/cli-golden-path.test.ts` |
| Game profile (multi-object scene) | **R1** | `pnpm test:golden` | `tests/e2e/profile-game-scene-golden.test.ts` |
| Web Experience profile | **R1** | `pnpm test:golden` | `tests/e2e/profile-web-golden-path.test.ts` |
| Kids profile | **R0** | `pnpm test:golden` | `tests/e2e/profile-kids-refuse-golden.test.ts` |
| Importers + plugin host | **R1** | `pnpm test:golden` | `tests/e2e/importers-plugin-golden.test.ts`, `tests/e2e/plugin-capability-golden.test.ts` (the one registered capability, `sceneaxi.sculpt.intake-source.v1`, from the shipped seed through load to an addressed call) |
| Umbrella live open path (`/open`) | **R1** | `pnpm test:golden`; in a browser, `cd sites/umbrella && pnpm build && pnpm start` | `tests/e2e/umbrella-live-open-golden.test.ts` (headless surface, no pixel claim) + the browser record in `docs/three-presentation-core.md` |
| Umbrella entitled Minimum E2 editor (`/editor`) | **R1** | `pnpm test:golden`; in a browser, `cd sites/umbrella && pnpm build && SCENEAXI_SITE_EDITOR_PREVIEW=1 pnpm start` | `tests/e2e/umbrella-editor-viewport-golden.test.ts` (headless surface, no pixel claim) + the browser record in `docs/three-presentation-core.md`. Without the preview flag, and until the identity plane is wired, the route is a named refusal and draws nothing |

How far each profile's open path may be *demonstrated*, and by what evidence, is
owned by [`open-path-policy.md`](open-path-policy.md) — one shared contract the
profiles, the CLI, and both shells all read. The levels there use this table's
vocabulary deliberately: `demo-driveable` is R1, `refuse-only` is R0, and neither
is a shipping claim.

`pnpm gate` runs everything above. `pnpm test:golden` runs just the golden e2e set.
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
- The Kids profile has **no** product surface: no UI, commerce, identity, or
  third-party LLM route, and `kidsBoundary.allowedDependents` stays empty. The
  desktop shell's editor chrome honours that over its design source: on the
  refuse-only profile the whole editor body is replaced by
  `OPEN_PATH_KIDS_REFUSED` rather than rendered disabled, the mode rail refuses
  by the same name, and the assistant shows its own named denial — all of it in
  the emitted bytes and selected by state, so a browser-side profile switch
  reaches the same refusals
  ([`engine-desktop-surface.md`](engine-desktop-surface.md)).
- `sceneaxi-desktop chrome` renders the editor chrome but mounts **no**
  presentation runtime and opens **no** kernel session, so its viewport draws no
  pixels, its `run` mode reports no tick, and every control that would author
  something is inert with a named refusal. It is a view model with a renderer for
  it, not a packaged desktop application: there is no installer here.

## Commercial model

The CLI is **free and BYO-AI**: no verb reads a credential, opens a socket, or
spends anything, and no shipped verb is held-key gated (`SHIPPED_COMMAND_MAP`).

Hosted AI is metered but is **not a runnable surface here**. The free-vs-paid
matrix it must obey — including BYO-key never touching the ledger and the
non-overridable Kids deny — is owned by
[`docs/auth-credits.md`](auth-credits.md). The credit ledger, metering, and the one
default-off gate a hosted call must pass to reach a debit (`runMeteredModelCall`)
exist in `packages/billing`, and the assistant that composes that gate with the
Model Provider Port has landed as `createAssistantPanel()` in `apps/web-shell`
(sceneaxi#121). It is a view model, not a startable surface: its host's inspector
server exposes it no route (below), its default mode is the recorded fixture
transport, and its hosted mode
is off unless a caller explicitly enables it — so nothing runnable spends
anything.

## Why the web shell serves loopback only

`sceneaxi-web-shell` is a **local authoring** surface, not a deployment. Its run
instructions, security rationale, and authoritative refusal table live in
[`../apps/web-shell/README.md`](../apps/web-shell/README.md); the shell adds only
a transport over the inspector phases it already had. The deployable web tier
remains the separate `sites/` tier (ADR 0018).

## Not runnable yet

- **In-app AI assistant** (sceneaxi#121) — built, as `createAssistantPanel()` in
  `apps/web-shell`, and still not runnable: it ships a view model and no
  renderer, and the startable shell above serves it no route
  (`INSPECTOR_ACTIONS` is the whole served vocabulary). Every transport is
  injected, so nothing here can start one.
- **`apps/catalog-game`, `apps/catalog-web`** — dormant, owned by the
  websites/deploy track.
