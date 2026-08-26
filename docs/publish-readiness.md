# Publish readiness

**What this document is:** the outsider-consumable publish-ready checklist for the
SceneAxi library surface, and the version plan those packages are on.

**What it is not:** a publish authorization. No SceneAxi package has ever been
published to a registry, no registry credential exists in this repository, and
nothing here grants the authority to create one (`docs/bootstrap.md`). Publish
*readiness* is a structural property proven on disk; publishing is a separate
captain decision.

**Machine-readable truth:** every table below marked with a
`<!-- publish-ready:... -->` comment is parsed by `scripts/check-publish-ready.mjs`
(`pnpm check:publish-ready`, part of `pnpm gate`). When this document and the
repository disagree, the gate fails — in both directions. A drifted package fails,
and so does a claim here that the checker does not actually implement.

## How an outsider consumes SceneAxi today

There is no registry install, so there is exactly one supported path:

1. **Read the source** through the public engine SDK archive — `pnpm build:sdk`
   produces `sceneaxi-engine-sdk-<version>.zip`, its SHA-256, and a manifest
   (ADR 0019). The umbrella site serves the same archive, and CI rebuilds it to
   prove the checksum is reproducible (`.github/workflows/engine-sdk.yml`).
2. **Write against the contracts** in `@sceneaxi/schemas`, which the archive ships
   in full alongside the consumer docs.
3. **Wait for a published version** before taking a dependency. Substituting a Git,
   path, `file:`, or `workspace:` dependency is explicitly out of contract — see
   [`web-consumer.md`](web-consumer.md).

The archive is **source-available for evaluation, not open-source**: the packages are
`UNLICENSED` and no licence to use, modify, copy, or redistribute is granted.

## Version plan

Every package is a private `0.0.0` bootstrap package on a shared plan value, so no
package can drift into looking releasable on its own. Release groups and their pinning
rules are owned by [`DEPENDENCY-MATRIX.md`](DEPENDENCY-MATRIX.md); this table is the
per-package instance of that plan, checked against every manifest on disk.

The first real release is a captain decision that changes three things together: the
plan value pinned in `scripts/check-publish-ready.mjs`, every manifest version, and each
profile's `sceneaxi.corePin` (today the bootstrap `^0.0.0`, which must also match the
`corePin` literal in that profile's seam source). Until then, `0.0.0` everywhere is the
honest statement that nothing is released.

<!-- publish-ready:versions -->
| Package | Version | Release group | Core pin |
|---|---|---|---|
| `@sceneaxi/auth` | `0.0.0` | `identity` | — |
| `@sceneaxi/authoring-core` | `0.0.0` | `core-train` | — |
| `@sceneaxi/billing` | `0.0.0` | `identity` | — |
| `@sceneaxi/cli` | `0.0.0` | `cli-protocol` | — |
| `@sceneaxi/engine-kernel` | `0.0.0` | `core-train` | — |
| `@sceneaxi/engine-orchestrator` | `0.0.0` | `core-train` | — |
| `@sceneaxi/engine-presentation` | `0.0.0` | `core-train` | — |
| `@sceneaxi/importers` | `0.0.0` | `importers` | — |
| `@sceneaxi/plugin-host` | `0.0.0` | `plugin-host` | — |
| `@sceneaxi/profile-game` | `0.0.0` | `profile` | `^0.0.0` |
| `@sceneaxi/profile-kids` | `0.0.0` | `profile` | `^0.0.0` |
| `@sceneaxi/profile-web` | `0.0.0` | `profile` | `^0.0.0` |
| `@sceneaxi/provider-openrouter` | `0.0.0` | `importers` | — |
| `@sceneaxi/schemas` | `0.0.0` | `contracts` | — |
| `@sceneaxi/site-kit` | `0.0.0` | `sites` | — |
| `@sceneaxi/catalog-game` | `0.0.0` | `apps` | — |
| `@sceneaxi/catalog-web` | `0.0.0` | `apps` | — |
| `@sceneaxi/desktop-shell` | `0.0.0` | `apps` | — |
| `@sceneaxi/web-shell` | `0.0.0` | `apps` | — |
| `@sceneaxi/site-catalog-game` | `0.0.0` | `sites` | — |
| `@sceneaxi/site-catalog-web` | `0.0.0` | `sites` | — |
| `@sceneaxi/site-kids` | `0.0.0` | `sites` | — |
| `@sceneaxi/site-umbrella` | `0.0.0` | `sites` | — |
| `@sceneaxi/desktop-linux` | `0.0.0` | `desktop` | — |
| `@sceneaxi/desktop-windows` | `0.0.0` | `desktop` | — |
| `@sceneaxi/desktop-macos` | `0.0.0` | `desktop` | — |

## Export surface of the consumer packages

Package exports are source-backed (`./src/*.ts`), which is why `pnpm build` is a
prerequisite for running any binary — see [`../AGENTS.md`](../AGENTS.md). Every export
target below is checked to be a real, non-symlink file, and every one of them is
checked to be inside the pinned engine-SDK archive, so an outsider who unzips the SDK
never finds a dangling entry point.

Subpaths are declared as **namespaces**, not as a copied inventory: a real export
subpath that matches no documented namespace fails the gate, and so does a documented
namespace that matches no real export. `*` stands for exactly one path segment.

<!-- publish-ready:exports -->
| Package | Root export | Subpath namespaces |
|---|---|---|
| `@sceneaxi/schemas` | `./src/index.ts` | `./node/*` (Node-only executable suites, never re-exported from the browser-safe root), `./testing/*` (fixture helpers for consumer tests), `./contracts/*.json` (versioned JSON contracts, importable directly) |
| `@sceneaxi/profile-web` | `./src/index.ts` | — |
| `@sceneaxi/authoring-core` | `./src/index.ts` | `./rarity-evidence` (the shared safe-rarity-provenance formatter on an import-free module, so a browser bundle can reach it without the Node-bearing root barrel) |
| `@sceneaxi/auth` | `./src/index.ts` | `./testing/*` (test-only issuance seam for genuine principal fixtures, never re-exported from the root barrel; unreachable from production source — see [the testing-subpath rule](DEPENDENCY-MATRIX.md#test-only-testing-subpaths)) |

## The checklist

Each row is an executable check in `scripts/check-publish-ready.mjs`. The set of IDs
here and the set of checks that script runs must be equal, so this checklist cannot
claim a guarantee the gate does not enforce.

<!-- publish-ready:checklist -->
| ID | What it proves |
|---|---|
| `manifest-private` | Every workspace manifest **and the repository root manifest** is `private: true`, so nothing can be published even by accident. |
| `manifest-version-plan` | Every manifest version, root included, equals the pinned plan version, so no package drifts off the shared plan. |
| `manifest-hygiene` | Every workspace manifest declares a name, description, `type: module`, licence, and `sceneaxi.releaseGroup`. |
| `exports-resolve` | Every `exports` target is an explicit, real, non-symlink file inside its own package — no dangling public entry point, and no subpath pattern, which could be proven neither to resolve nor to ship. Every workspace manifest outside the deployable `sites/` and `desktop/` tiers must declare one; a deployable site or desktop app need not. |
| `files-resolve` | Every `files` entry exists — a glob is checked against the directory it can match inside — so a packed tarball would carry what the manifest claims. |
| `internal-deps-workspace` | Every internal `@sceneaxi/*` dependency of every manifest, root included, uses the `workspace:` protocol — except the two deployable tiers, each of which is its own install root: a `sites/` package uses a `link:` path into `packages/` (ADR 0018), and a `desktop/` package a `link:` path into `packages/` or `apps/` (ADR 0024, because the packaged app links the Engine Desktop chrome in `apps/desktop-shell`). The `apps/` half is the desktop tier's alone. Never `file:`, a Git ref, or a version range. |
| `no-publish-hooks` | No manifest, root included, declares `publishConfig` or a publish/pack lifecycle script. |
| `no-registry-publish` | No package script and no CI workflow *directly invokes* a registry-mutating verb (`publish`, `unpublish`, `dist-tag`, `deprecate`) through `npm`/`pnpm`/`yarn`/`bun`/`npx`/`changeset`, in any flag order and across shell line continuations — `pnpm -r publish` is caught exactly like `npm publish`. A verb reached indirectly through an interpreter (`bash release.sh`) is deliberately out of scan; every manifest staying `private: true` is what covers that. |
| `profile-core-pin` | Each profile's `sceneaxi.corePin` equals the plan pin and matches the `corePin` literal in its seam source. |
| `sdk-covers-exports` | Every export target of every engine-SDK package is in the pinned SDK file list, so the archive is self-consistent. |
| `sdk-consumer-packages` | Every documented consumer package ships in the SDK archive, and no Kids file is pinned into it. |
| `sdk-output-ignored` | Every output directory `scripts/build-engine-sdk.mjs` is actually pointed at — derived from the `--out` of each invocation in a manifest script or CI workflow, resolved against the directory that declares it — is ignored by the **repository-root `.gitignore`**, so a stale archive cannot be committed through that path. Moving a `--out` path does not escape the check. A nested `.gitignore` deeper in the tree is deliberately out of scan, so a re-inclusion there (`!engine-sdk/`) is not proven against; the repository root file is the only one in the tree. |
| `docs-consumer-surface` | Every package the consumer contract documents exists and declares a root export. |
| `docs-export-namespaces` | The documented root exports and subpath namespaces exactly cover the real export maps. |
| `docs-version-plan` | The version table above names every workspace package and matches its version, release group, and core pin. |
| `docs-checklist-ids` | This checklist lists exactly the checks the script implements — no overstated guarantee. |

## What publish-readiness deliberately does not cover

<!-- traceability:release-owners:start -->
| Release artifact owner |
|---|
| `scripts/build-engine-sdk.mjs` |
| `scripts/engine-sdk-files.json` |
| `docs/publish-readiness.md` |
| `desktop/linux/electron-builder.yml` |
| `desktop/linux/package.json` |
| `desktop/linux/scripts/build-linux.mjs` |
| `desktop/linux/scripts/dist.mjs` |
| `desktop/macos/electron-builder.yml` |
| `desktop/macos/package.json` |
| `desktop/macos/scripts/build.mjs` |
| `desktop/macos/scripts/dist.mjs` |
| `desktop/macos/scripts/release-provenance.mjs` |
| `desktop/windows/electron-builder.yml` |
| `desktop/windows/package.json` |
| `desktop/windows/scripts/build.mjs` |
| `desktop/windows/scripts/package-release.mjs` |
| `desktop/windows/scripts/dist.mjs` |
| `desktop/windows/scripts/release-preflight.mjs` |
| `desktop/windows/scripts/release.mjs` |
<!-- traceability:release-owners:end -->

- **Building a registry tarball.** `pnpm build:sdk` is the packaging path; there is no
  second one. Adding another is out of contract.
- **`dist/` as a published artifact.** `dist` is a gate artifact only; exports stay
  source-backed.
- **Kids.** `@sceneaxi/profile-kids` is never a consumer package and never reaches a
  shared artifact; the archive builder and this checklist both refuse it by name.
  The private `@sceneaxi/site-kids` install root is likewise not an SDK consumer and
  imports no SceneAxi package, so it creates no route into the archive.
- **Licence grant.** `UNLICENSED` is the current state, and changing it is a separate
  captain decision.
