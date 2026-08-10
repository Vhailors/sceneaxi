# Package dependency allow/deny matrix

**Machine-readable truth:** `docs/dependency-matrix.json` (schemaVersion 1), enforced by
`scripts/check-boundaries.mjs` (`pnpm check:boundaries`). This document explains the
matrix; when the two disagree, the JSON + checker win and the disagreement is a defect.

**Rule:** packages depend downward only. Allow lists are exhaustive — any internal
(`@sceneaxi/*`) dependency declaration or source import not on a package's allow list
**fails the boundary check**. Everything not explicitly allowed is denied.

## Layering

```text
L0  schemas            (zero dependencies by rule)
L1  engine packages    kernel ← presentation, orchestrator   (+ delayed: asset-compiler,
                                                              platform-host, evidence)
L2  authoring-core     the one agent-native runtime/authoring core (document model,
                       propose/apply service, session orchestration, evidence hooks,
                       Model Provider Port)
L3  profiles · cli · importers · provider adapters · plugin-host · auth ← billing
                       (identity plane; schema in db/migrations)
L4  apps               (leaves; nothing depends on an app), plus one charted edge
                       web-shell holds alone: auth + billing for its account /
                       credit-balance view model
L4  sites              site-kit ← the three non-Kids sites (leaves; ADR 0018), plus
                       the dependency-empty dedicated Kids site, plus
                       two charted edges the umbrella alone holds: engine-presentation
                       for every viewport it owns (ADR 0022; surfaces inventoried in
                       docs/three-presentation-core.md), and auth + billing for the
                       identity plane (ADR 0021)
L4  desktop            the packaged desktop applications (leaf; ADR 0024). desktop/linux
                       consumes schemas, desktop-shell, site-kit, authoring-core, the
                       three engine packages it draws and opens through, importers for
                       contained asset ingestion, and provider-openrouter from
                       src/electron/** alone (sceneaxi#235);
                       no profile, no Kids, no auth/billing, no plugin host.
                       desktop/windows packages that same built application for Windows
                       and names no SceneAxi
                       package at all (sceneaxi#204); desktop/macos stages that same
                       bundled runtime for signing/notarization and consumes schemas
                       only (sceneaxi#194)
```

## Allow matrix (✓ = allowed; blank = denied)

| From \ To | schemas | engine-kernel | engine-presentation | engine-orchestrator | authoring-core | profile-* | cli | external adapters | plugin-host | apps/* |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| schemas | — | | | | | | | | | |
| engine-kernel | ✓ | — | | | | | | | | |
| engine-presentation | ✓ | ✓ | — | | | | | | | |
| engine-orchestrator | ✓ | ✓ | | — | | | | | | |
| authoring-core | ✓ | ✓ | ✓ | ✓ | — | | | | | |
| profile-game / profile-web / profile-kids | ✓ | ✓ | ✓ | ✓ | ✓ | — (never each other) | | | | |
| cli | ✓ | | | | ✓ | | — | ✓ (importers only) | | |
| importers / provider-openrouter | ✓ | | | | ✓ | | | — | | |
| plugin-host | ✓ | | | | | | | | — | |
| auth | ✓ | | | | | | | | | |
| billing | ✓ (+ auth) | | | | | | | | | |
| web-shell | ✓ | | | | ✓ | | | | | — (+ auth, billing) |
| desktop-shell | ✓ | | | | ✓ | | | | | — |
| catalog-game / catalog-web | ✓ | | | | | | | | | — |
| site-kit | ✓ | | | | ✓ | | | | | |
| site-umbrella (→ site-kit ✓, auth ✓, billing ✓) | | | ✓ | | | | | | | |
| site-catalog-game / site-catalog-web (→ site-kit ✓) | | | | | | | | | | |
| desktop-linux (→ site-kit ✓) | ✓ | ✓ | ✓ | ✓ | ✓ | | | ✓ (importers; provider-openrouter in `src/electron/` alone) | | ✓ (desktop-shell alone) |
| desktop-windows | | | | | | | | | | |
| desktop-macos (stages desktop-linux dist) | ✓ | | | | | | | | | |

Deliberate denials that carry design intent:

- **cli → engine packages: denied.** The CLI is a thin protocol adapter (verbs +
  envelope) over `authoring-core` and the contained-copy authority in `importers`.
  Denying direct engine access makes it structurally impossible for the orbiting
  CLI to become the missing core (Sol review F2).
- **shells → cli: denied.** Shells are protocol *clients* of `authoring-core`'s
  application service — one behavior, many faces — not spawners of the CLI binary.
- **web-shell → `auth` + `billing`: allowed; desktop-shell → either: denied.** The
  web shell's `createAccountPanel()` is a login / credit-balance **view model** over
  those two seams, so it names them the way any other consumer does; it implements no
  identity and no ledger. The desktop shell has no account surface and therefore no
  such edge. Contracts and ownership: [`auth-credits.md`](auth-credits.md).
- **catalogs → authoring-core/engine/profiles: denied.** Catalogs touch the Core only
  through the catalog pipeline contracts in `schemas`.
- **profile → profile: denied.** Profiles never import each other.
- **anything → profile-kids: denied** (Kids boundary below).
- **anything → apps, anything → cli: denied**, with one charted exception: the
  packaged desktop tier holds `desktop-linux → desktop-shell` (ADR 0024), because the
  window renders that app's Engine Desktop chrome unforked rather than a second copy
  of it. Nothing else names an app, and the CLI stays a leaf outright.
- **plugin-host → engine packages / authoring-core / profiles: denied.** The Plugin
  Host (ADR 0005) consumes only public contracts from `schemas`; it must not grow
  an engine service locator or absorb engine internals.
- **sites → anything but `site-kit`: denied, with two charted exceptions, both the
  umbrella's alone.** Each deployable site (`sites/umbrella`, `sites/catalog-game`,
  `sites/catalog-web`) reaches contract vocabulary only through `@sceneaxi/site-kit`,
  which may consume `schemas` and `authoring-core`. A site is a thin view layer; all
  testable behaviour lives in `site-kit` so `pnpm gate` covers it (ADR 0018). The
  exceptions are **umbrella → `engine-presentation`** (ADR 0022, amended 2026-07-26): the
  umbrella owns **every** viewport — public, entitled, and marketing alike, inventoried
  in [`three-presentation-core.md`](three-presentation-core.md) — so it alone consumes
  the ADR 0002 presentation seam to draw a real artifact into a browser canvas; and **umbrella → `auth` + `billing`** (ADR 0021,
  sceneaxi#131): it is the one site wired to the identity plane, and only through the
  plug point `sites/umbrella/src/lib/identity-plane.ts` together with the deployment
  adapters it assembles in `sites/umbrella/src/lib/provider-adapters.ts` (sceneaxi#180) —
  two files and no more, so no route, page, component, **or any other `src/lib/` module**
  may name either package. A second rule bounds the reverse direction: each deployment
  owner (`identity-plane`, `provider-adapters`, `credit-webhook`) is importable only by
  the sibling owners the checker pins for it — the request-authority facade
  `sites/umbrella/src/lib/request-authority.ts` among them for the two it drives — and
  the site's own root barrel, which re-exports all three, is importable by **nothing**,
  so request code reaches deployment authority through that one no-argument entry point
  and never around it. Both rules are
  resolved through the specifier a bundler would resolve — relative, `tsconfig` `paths`
  alias (every declared pattern and target, inherited bases included) or `baseUrl`-rooted
  absolute import, resource query or fragment suffix, directory barrel, and statically
  constant dynamic `import()` alike. Nothing widens past that
  — kernel, orchestrator, authoring-core, profiles, and Kids stay denied to every site,
  and the two catalogs keep `site-kit` only, reading identity through the same site-kit
  ports rather than a second auth stack. `tests/boundary/injected-site-violations.test.ts`
  asserts both allowed edges and each denial.
- **desktop → profiles / Kids / auth / billing / plugin-host: denied.** The packaged
  application (ADR 0024) draws and opens through the same public seams a site does; it
  has no account surface and no profile package, and it depends on no CLI package —
  the `desktop bridge` verbs live in `@sceneaxi/cli` and reach the running app only
  over the local socket documented in
  [`desktop-local-bridge.md`](desktop-local-bridge.md), sharing the
  `@sceneaxi/schemas` tool registry both already name.
  `tests/boundary/injected-desktop-violations.test.ts` injects a profile import, a Kids
  import, and an identity-plane dependency and asserts the real checker fails on each.
- **framework, provider, and packaging toolchains → the hermetic tier: denied.**
  `next`, `react`, and provider clients live in `sites/` only — and among the sites,
  `better-auth`, `pg`, `@neondatabase/serverless`, and `stripe` belong to the umbrella
  deployment seam alone; Electron, esbuild, and
  electron-builder in `desktop/` only. `pnpm check:sites` and `pnpm check:desktop` each
  fail if one appears in the root manifest, and if `pnpm-workspace.yaml` starts globbing
  its tier — both tiers are separate install roots so the hermetic root lockfile never
  moves for a site or desktop dependency.
- **auth → anything but schemas: denied.** The identity plane (ADR 0021) is
  contracts and policy only. Better Auth and Neon are injected adapters, so there
  is nothing for it to depend on.
- **billing → engine packages / authoring-core / profiles / cli: denied.** Billing
  depends on `schemas` and the `auth` seam, because a credit charge needs a role
  guard. It reaches the Stripe API and Neon only through injected adapters.
- **auth → billing: denied.** Identity does not know about money. The dependency
  runs one way, so a role guard can never be made to depend on a balance.

## Kids policy boundary (hard)

`dependency-matrix.json → kidsBoundary`: no package or app may depend on or import
`@sceneaxi/profile-kids`. `allowedDependents` remains **empty** under the locked Kids
isolation boundary. The checker enforces this independently of the allow lists, so
allow-list drift cannot silently open the Kids boundary. The separate Kids surface and
origin boundary is owned by
[`docs/program/site-domain-topology.md`](program/site-domain-topology.md).

`@sceneaxi/site-kids` does not weaken that rule: it is a separate install root with
an empty matrix allow list and no import of `@sceneaxi/profile-kids`, `site-kit`, or
any other SceneAxi package. `pnpm check:sites` additionally restricts its runtime
dependencies to Next/React, permits no environment input, and refuses outbound
browser APIs in its source. Profile/site activity parity is a root test over two
independent copies, not a runtime dependency.

## Test-only `testing/` subpaths

A package may declare a visibly test-only `./testing/*` export subpath so that a test in
another package reaches a real fixture seam by public package name instead of a relative
path into a foreign directory. That surface exists for tests alone, so the checker refuses
both ways into it from any package, app, or site `src` file: the public
`@sceneaxi/<pkg>/testing/...` specifier, and a relative import that lands in the package's
own `src/testing` tree — only a file already inside `src/testing` may name a sibling
there. This is enforced independently of the allow lists, so an allowed edge does not
grant the testing seam behind it.
`tests/boundary/injected-violations.test.ts` and
`tests/boundary/injected-site-violations.test.ts` inject exactly those imports and assert
the real checker fails. The declared seams are listed in
[`publish-readiness.md`](publish-readiness.md); why the principal-issuance seam exists is
owned by [`auth-credits.md`](auth-credits.md).

## Delayed packages (accounted, not seeded)

Spec #41's six deep modules map to six engine packages. Seeded now: **engine-kernel**
(Game Kernel), **engine-presentation** (Presentation Runtime), **engine-orchestrator**
(Factory Orchestrator). Delayed, arriving with the proof program's landings:
**engine-asset-compiler**, **engine-platform-host**, **engine-evidence**. Their intended
allow lists are recorded in the matrix `delayed` section so they land into a declared
slot, not an invented one. The fixture-tested **provider-openrouter** adapter is seeded
behind the Model Provider Port in `authoring-core`; the generic
`@sceneaxi/provider-<name>` delayed entry reserves the same boundary for additional
adapters. The locked provider policy and its adapter conditions are owned by the
canonical product spec
([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1)).

## Release groups and pins

Recorded in `dependency-matrix.json → releaseGroups` and stamped on every manifest as
`sceneaxi.releaseGroup` (checker-verified against the matrix):

- **contracts** (`schemas`): own versions; consumers refuse major mismatches.
  The package root stays browser-safe; Node-only executable suites use explicit
  `node/*` export subpaths and are not re-exported from the root.
- **core-train** (`engine-*`, `authoring-core`): one shared semver train — a "core release".
- **profile** (`profile-*`): independently versioned; each manifest MUST carry
  `sceneaxi.corePin` — the semver range of the core train it supports (bootstrap value
  `^0.0.0`; becomes a real range at the first core release).
- **cli-protocol** (`cli`): versions with its protocol envelope; output-schema changes
  are semver events.
- **importers** (external importers and provider adapters), **plugin-host**,
  **apps**: independent / private.
  `plugin-host` is independently versioned and may depend only on `schemas`.
- **sites** (`site-kit`, three non-Kids sites, and the dependency-empty Kids site): first-party deployable web
  surfaces and their shared deployment-neutral logic. Consume only public contracts and
  public `authoring-core` APIs; never profiles, a service locator, or Kids. The single
  engine edge is umbrella → `engine-presentation` for every viewport the umbrella owns
  (ADR 0022); every other engine package stays denied to every site. The umbrella
  additionally consumes the `identity` group (`auth`, `billing`) from the plug point
  `src/lib/identity-plane.ts` together with the deployment adapters it assembles in
  `src/lib/provider-adapters.ts` — two files and no more; the catalogs
  do not. Request code reaches none of it directly: `src/lib/request-authority.ts` is the
  only importer of those owners outside themselves, and the checker refuses any other.
  Framework and provider SDKs stay in the `sites/` tier. Deploy and env details:
  [`websites-deploy.md`](websites-deploy.md).
- **desktop** (`desktop-linux`, `desktop-windows`, `desktop-macos`): packaged desktop
  applications (ADR 0024), each its own
  install root outside the repository-root workspace so Electron never moves the
  hermetic lockfile. Deployable, not consumable — its root export is a gate-tested
  package seam rather than a registry consumer surface, and it uses `link:` dependencies
  (into `packages/` **or** `apps/`, the one
  widening the desktop tier holds). `desktop-linux` names `importers` from its
  project/bridge layer for the fixed contained-copy profile. It alone may also name
  `provider-openrouter`, and only from `src/electron/**`: `pnpm check:desktop` refuses
  that provider adapter — and any re-export of the privileged host that would
  launder it — from `src/lib/**`, `src/renderer/**`, and the package root. Build, distribution, and the
  recorded checksums: [`desktop-linux.md`](desktop-linux.md). `desktop-windows` holds an empty allow list:
  it packages the already-built `desktop/linux` runtime and imports no SceneAxi
  package, so it is a second install root rather than a second application —
  signing, update, and release contract in
  [`desktop-windows.md`](desktop-windows.md). The macOS packager names only `schemas`
  in source and stages that same already-bundled Linux install-root runtime
  byte-for-byte, so it adds no second product implementation or renderer owner —
  signing, notarization, and release contract in
  [`desktop-macos.md`](desktop-macos.md).
- **identity** (`auth`, `billing`): independently versioned; consumes only public
  contracts from `schemas` (and, for `billing`, the `auth` seam); never engine
  packages, profiles, the CLI, or a service locator. Better Auth, Neon, and the
  Stripe API stay injected adapters outside core; their production dependencies
  may live only in a separate deployable install root (ADR 0021; `docs/auth-credits.md`).
