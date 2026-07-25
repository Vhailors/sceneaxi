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
| `@sceneaxi/desktop-shell` | **R2** | `pnpm build && node apps/desktop-shell/bin/sceneaxi-desktop.mjs --help` | `apps/desktop-shell/test/bin-smoke.test.ts`, `tests/parity/shell-cli-parity.test.ts` |
| Game profile (single object) | **R1** | `pnpm test:golden` | `tests/e2e/cli-golden-path.test.ts` |
| Game profile (multi-object scene) | **R1** | `pnpm test:golden` | `tests/e2e/profile-game-scene-golden.test.ts` |
| Web Experience profile | **R1** | `pnpm test:golden` | `tests/e2e/profile-web-golden-path.test.ts` |
| Kids profile | **R0** | `pnpm test:golden` | `tests/e2e/profile-kids-refuse-golden.test.ts` |
| Importers + plugin host | **R1** | `pnpm test:golden` | `tests/e2e/importers-plugin-golden.test.ts` |
| `@sceneaxi/web-shell` | *library only* | — | not yet startable; see sceneaxi#120 |

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

## Why the CLI and shells have no kernel or plugin verbs

`docs/dependency-matrix.json` allows `@sceneaxi/cli`, `@sceneaxi/web-shell`, and
`@sceneaxi/desktop-shell` to depend on `@sceneaxi/schemas` and
`@sceneaxi/authoring-core` **only**. Kernel-session, presentation, and
plugin-host verbs on those surfaces would require widening it.

The boundary is not widened. Those paths are proven in `tests/e2e/`, which may
import any package. `scene compose` *is* on the CLI because `composeScene()`
lives in `authoring-core`.

## Deliberate refusals

Behaviour, not gaps. Changing any of these is a product decision:

- `project dev --watch` refuses — there is no hot-reload loop, and faking one
  would be a false runnable claim. `project dev` is one-shot.
- `project new` refuses to overwrite an existing document without `--force`.
- `catalog list` reports commerce activation and can never change it; marketplace
  activation holds stay closed.
- `scene compose` fails closed on the named refuse matrix
  (`docs/scene-composition.md`) rather than composing a partial scene.
- The Kids profile has **no** product surface: no UI, commerce, identity, or
  third-party LLM route, and `kidsBoundary.allowedDependents` stays empty.

## Commercial model

The CLI is **free and BYO-AI**: no verb reads a credential, opens a socket, or
spends anything, and no shipped verb is held-key gated (`SHIPPED_COMMAND_MAP`).

Hosted AI is the metered surface and is **not implemented here**. Its contract —
BYO-key never touches the ledger, hosted debits credits and refuses closed when
the ledger is absent, stale, or short, and the Kids deny is evaluated before any
metering or dispatch — is fixed in sceneaxi#121, which serializes behind the
credits ledger.

## Not runnable yet

- **`apps/web-shell`** (sceneaxi#120) — a protocol client library with no dev
  server. Blocked on whether the websites/deploy work touches `apps/web-shell`.
- **In-app AI assistant** (sceneaxi#121) — serialized behind the credits ledger.
- **`apps/catalog-game`, `apps/catalog-web`** — dormant, owned by the
  websites/deploy track.
