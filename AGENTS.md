# SceneAxi agent notes

## Product identity

SceneAxi = interactive engine/library + versioned profiles (Game, Web Experience, Kids). CLI, shells, importers, and catalogs orbit the core; they are not the core identity.

## Hard rules

- Do not invent captain decisions; the runtime source of truth is the held-key registry snapshot protocol (`docs/held-key-enforcement.md`), generated from FirstMate structured backlog state — the #42 Markdown registry documents keys for humans only.
- Fail closed on held keys in the CLI: missing, stale, invalid, epoch-mismatched, or unknown registry data refuses, exactly like an open key. The runtime implementation (snapshot generator, currency gate, shipped command map) lives in `packages/cli/src/held-keys/` and is wired into the dispatcher for every verb; the refusal table and both mandatory regressions are fixture-tested in `packages/cli/test/held-keys.*.test.ts` — extend those when touching the protocol.
- Package boundaries are enforced, not aspirational: `pnpm check:boundaries` against `docs/dependency-matrix.json`; run it after any manifest or import change.
- Kids traffic never uses third-party LLM defaults without an explicit Kids safety decision; nothing may depend on `@sceneaxi/profile-kids` (enforced).
- Do not push, spend, create accounts, create issues, or run the Stage 1 proof without the matching separated authority (`docs/bootstrap.md`).
- Individual games stay out of this monorepo.

## Toolchain

- `pnpm gate` is the required repository check; root `package.json` owns its exact
  sequence (syntax, boundaries, contracts, **sites**, **desktop**, **publish-ready**, build, test, lint). Syntax and test explicitly refuse empty surfaces, and every stage exits
  non-zero on its configured failures. Never weaken the gate: no skips, no `|| true`,
  no lint disables, no matrix allow-list widening.
- Build uses strict tsc project references; package exports remain source-backed and
  `dist` is only a gate artifact. Keep TypeScript on the pinned 5.9 line until
  typescript-eslint supports the TypeScript 7 native preview.
- Every package/app exports a frozen typed `seam` from `src/index.ts` (vocabulary
  in `@sceneaxi/schemas`) and owns a seam-level test in its `test/` dir that
  imports it by public package name — test external contracts, never internals.
- The boundary checker's failure behaviour is itself regression-tested:
  `tests/boundary/injected-violations.test.ts` injects forbidden edges into a
  temp fixture and asserts `check-boundaries.mjs` fails; `tests/syntax/` does the
  same for the syntax gate. Extend those fixtures when you extend the checkers.
  Those suites, and the `bin-smoke` ones, are process-level: they copy the tree
  and spawn a real checker or binary, and their per-test fixture copy runs in a
  hook. `vitest.config.ts` owns the one matched `testTimeout`/`hookTimeout` pair
  that keeps them from going red on host speed instead of on a violation — a
  wall-clock allowance covering both the body and its setup, never a skipped
  assertion, and not a place to hide a slow test.
- Package exports are source-backed, which Node cannot follow at runtime, so the
  workspace binaries run `tsc --build` output through the shared resolver
  `scripts/workspace-dist-resolver.mjs` (mapping derived from the dependency
  matrix). **`pnpm build` is a prerequisite for running any binary.** Note the
  gate's own blind spots: `check-syntax` and the boundary checker scan only
  `<pkg>/src`, so nothing under `bin/` is covered by either.

## Runnable surfaces

`docs/runnable-surfaces.md` is the authoritative map of what can actually be
started, each surface's level, and the proof behind the claim. Update that owner
when a surface changes level instead of copying its current inventory here.

How far each profile's open path may be **demonstrated** is a separate, shared
contract: `docs/open-path-policy.md`, implemented in
`packages/schemas/src/open-path-policy.ts` (+ `contracts/open-path-policy.*`) and
read — through the narrow site-kit re-export for the umbrella `/profiles` page — by
`profile-game`, `profile-web`, `sceneaxi profile
open-path`, `sceneaxi-desktop open-path`, and web-shell's `createOpenPathView()`.
It lives in `schemas` because that is the only package all five may name, so
parity cost no matrix edge. `shippingClaim` is structurally `false` and Kids is
refuse-only; parity is asserted as a data identity in
`tests/parity/open-path-policy-parity.test.ts`, and doc/fixture/table drift is
caught by `pnpm check:contracts` (regressed by
`tests/contracts/injected-open-path-drift.test.ts`).

Adding a CLI verb means three things together, or dispatch refuses: a node in
`ROOT_COMMANDS`, a declaration in `SHIPPED_COMMAND_MAP`, and — for any verb that
parses flags — `takesArgs: true`, which is what makes the verb (not the
dispatcher) responsible for refusing unknown flags. `pnpm test:golden` must cover
every surface claimed runnable.

`apps/web-shell` is startable (sceneaxi#120) without adding a second authoring
implementation: keep routes in transport-free `src/inspector-app.ts` and socket
ownership in `src/dev-server.ts`. `apps/web-shell/README.md` owns its run and
fail-closed contract; this remains local authoring, not the deployable `sites/`
tier (ADR 0018).

## Program docs

- `docs/program/SPEC.md` — consumer copy of the canonical product spec ([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1); on disagreement #1 wins).
- `docs/program/spec-41.md` — pointer to factories-helpers#41, source of truth for the Stage 0–8 engine-core proof program, plus the transfer classification.
- `docs/program/NEXT-STEP.md` — evidence-based program position (main SHA, landed PRs, recorded captain-decision dispositions, known gaps) and the options under consideration. It authorizes nothing and owns no fact: where it disagrees with an ADR, doc, issue, or PR, that owner wins.
- `docs/proof/` — proof-prep docs only; Stage 1 is double-gated and nothing in that directory is a run authorization.

## Layout

See root README package/app map and `docs/DEPENDENCY-MATRIX.md`. Prefer small public package interfaces (deep modules). The authoring core lives in `packages/authoring-core`; the CLI is a thin protocol adapter over it and may not import engine packages directly. CLI protocol (dispatcher, exit-code map, versioned envelope, `--json`): `packages/cli` + `packages/cli/README.md`; envelope schema in `packages/schemas/contracts/cli-protocol-envelope.schema.json`. Game Kernel seam is `packages/engine-kernel` (`open`/`dispatch`/`advance`/`observe`/`save`/`replay` per ADR 0001); only `advance` mutates; Kernel Session contract lives in `packages/schemas` (`contracts/kernel-session.schema.json`). `packages/engine-kernel` is browser-runnable and must stay that way: no Node builtin and no Node-only global under its `src`, with portable sha256 digest semantics owned by `src/portable-digest.ts` (ADR 0016, `docs/kernel-browser-open.md`), enforced by `packages/engine-kernel/test/browser-open-play.test.ts`. Settled engine/CLI decisions live in `docs/adr/` — respect them without re-litigating; ADRs never touch open captain holds. Authoring behavior (CLI `project` verbs, propose/apply) is governed by `docs/authoring-contracts.md`: E1 is normative, general E2 remains specified-not-built, and ADR 0003 owns the bounded hybrid Minimum E2 exception. The shared authoring-jobs fixture list is canonical in `packages/schemas/contracts/authoring-jobs.fixtures.json`, and `pnpm check:contracts` keeps doc and JSON in sync. Text-canonical document + propose/apply (sceneaxi#9) live in `packages/authoring-core` with contracts in `packages/schemas` (`document.schema.json`, `proposal.schema.json`); CLI surface is `project propose` / `project apply`. Catalog Item contract + fail-closed pipeline stubs live in `packages/schemas` (`contracts/catalog-item.schema.json`, `src/catalog.ts`); `catalog-game` / `catalog-web` are dormant apps that import only `schemas`. Asset Package / ingestion policy SoT remains factories-helpers#47/#48 — cite, do not rewrite. Profile Conformance (sceneaxi#10): contract + registry stay on the browser-safe `@sceneaxi/schemas` root, while the Node-only shared runner is `@sceneaxi/schemas/node/profile-conformance-suite` (`runProfileConformanceSuite`); first development consumer is `@sceneaxi/profile-game` (`conformance` export). Web/Kids stay not-yet-claimed in `profileConformanceRegistry`; `shippingClaim` remains false. The resolved rollout decision is recorded in the canonical product spec (#1; in-tree consumer copy `docs/program/SPEC.md`). Public Web Experience consumption and pinning are documented in `docs/web-consumer.md`; consumers use published package-root APIs and product-local glue only.

The Model Provider Port (sceneaxi#45) is `packages/authoring-core/src/model-provider-port.ts`, with provider-neutral v1 envelopes and evidence shape in `packages/schemas/contracts/model-provider-port.schema.json`. Adapters and per-profile filters are injected; the port refuses missing policy/adapter/capability and enforces a non-overridable Kids deny before dispatch. There is no live provider adapter in core.

Delivery Handoff is the public, delivery-neutral export contract in `@sceneaxi/schemas` (`contracts/delivery-handoff.schema.json`, `src/delivery-handoff.ts`); its adapter boundary and digest semantics are authoritative in `docs/delivery-handoff.md`. Provider-specific delivery adapters, credentials, uploads, approvals, and releases stay outside SceneAxi core.

Three.js is the product presentation core (ADR 0017, captain product decision — not a Stage 1 result), hidden behind the unchanged ADR 0002 seam; the ownership map is `docs/three-presentation-core.md`. `packages/engine-presentation` holds one Three core on two draw surfaces: a real `WebGLRenderer` canvas surface that draws pixels and captures PNG, and a deterministic headless surface for node gates that never claims pixels. Keep the package free of `node:*` and DOM-lib types, and keep every Three type behind its exports (numeric camera controls, opaque renderable handles). Frames carry `surface`/`pixelsDrawn`; never let a frame counter imply pixels. The retired label "Experimental Three preview — non-decision" must not return for product surfaces. WebGL cannot run in node, so the canvas path is verified in a real browser and recorded in that doc; gate coverage goes through the injected-surface tests in `packages/engine-presentation/test/`.

Sculpt-quality ownership and compatibility are documented in `docs/sculpt-quality.md`: legacy PR #75 aggregate/result seams remain compatible, while strict multi-pass contracts and named refusals live on separate quality-specific paths.

Scene composition (multiple Sculpt Artifacts into one openable scene) is documented in `docs/scene-composition.md` and ADRs 0014–0015. Contracts and placement math are `packages/schemas/src/scene-composition.ts` (`contracts/scene-composition.schema.json`); the pipeline is `composeScene()` in `packages/authoring-core`; the multi-object open path is `openSceneKernelSession()` in `packages/engine-kernel`. Placement is axis-aligned in v1 and is a projection — never rewrite a Sculpt Artifact to place it, since its evidence binds its exact spec bytes. Composition fails closed on the named refuse matrix; extend `tests/e2e/scene-composition-golden.test.ts` and its checked-in digests when touching any of it.

`packages/engine-orchestrator` is the open path above the kernel (ADR 0023,
superseding the sceneaxi#60 stub disposition): `bootstrapOpenPath()` /
`resumeOpenPath()` select the kernel entry point for `product` | `sculpt` |
`scene`, resolve one `OpenPathHost`, turn every kernel throw into a named
refusal from `ORCHESTRATOR_REFUSALS`, stamp a deterministic bootstrap record,
and own a close-once session handle. It hands back the kernel's own session —
never a wrapper — so kernel authority and every digest stay unchanged, and it
stays browser-safe like the kernel under it. The bound is load-bearing and
asserted executably in `test/golden-path-orchestrated.test.ts`: one session per
handle, no deferral, concurrency primitive, or Node builtin — no job queue,
scheduler, durable job store, or plugin hook. The Game profile's
`sceneGoldenPath` opens through it and pins no kernel scene entry point beside
it; `tests/e2e/profile-game-scene-golden.test.ts` and its checked-in evidence
carry the bootstrap record.

Deployable web surfaces live in a `sites/` tier (ADR 0018): `sites/umbrella`,
`sites/catalog-game`, `sites/catalog-web`, all thin view layers over
`packages/site-kit`, which owns every non-presentational behaviour and is where the gate
tests it. Each site is its **own single-package pnpm workspace and install root with its
own lockfile, outside the repository-root workspace**, so a web-framework dependency
never moves the hermetic root lockfile or the gate runtime; `next`/`react`/provider SDKs
belong in `sites/` only.
`pnpm check:syntax`, `pnpm check:boundaries`, and `pnpm check:sites` all cover the tier —
extend `tests/boundary/injected-site-violations.test.ts` when you extend any of them. Only
`sites/*/src/app/**` may import React or Next; `src/index.ts` and `src/lib/**` stay pure
TypeScript so the hermetic build type-checks them, and site seam tests live in
`tests/sites/`. Deploy, the exact env var list, and the identity-plane activation steps are
in `docs/websites-deploy.md`. The public engine SDK download is a deterministic zip plus
SHA-256 (`pnpm build:sdk`, ADR 0019), never an npm publish, and it must never contain
Kids. Web editor entitlement (credits, or the unused 100-credit starter allotment; admin
unrestricted) is ADR 0020 and does not widen ADR 0003's general-E2 bound. Identity,
credits, and billing stay owned by `sceneaxi-auth-credits-v1`; `site-kit` only declares
fail-closed ports and `sites/umbrella/src/lib/identity-plane.ts` is the single plug point.
That plug point is now **wired** (sceneaxi#131): the umbrella alone may depend on
`@sceneaxi/auth` + `@sceneaxi/billing`, and only from that file plus the deployment
adapters it assembles in `src/lib/provider-adapters.ts` (sceneaxi#180) — two files and no
more, never a route, page, or component. Between them they build the site-kit
adapters over those packages and map their named refusals onto the site refusal registry —
they implement no identity, no ledger, and no signature check. Provider clients (Better Auth,
Neon, Stripe API) stay outside the repo per ADR 0021 and arrive through the one
`umbrellaPlaneHandles()` function, which reads the server environment once and holds the
issued admin identity and the secret-closing webhook capability beside the provider
handles; request code never reaches it directly but only through the no-argument
`umbrellaRequestAuthority()` facade in `src/lib/request-authority.ts`, supplying a carried
session credential — or, for the webhook route, raw bytes plus the signature header — and
never an environment, issuer, store, clock, or secret, which `pnpm check:boundaries`
enforces. While the provider clients are absent every dependent surface refuses
by name and `IDENTITY_SESSION_ABSENT` means signed-out, not broken. Those adapters make the
provider authoritative for a user's address and verification state on every
authentication, and treat a repeated idempotency key as an intent replay rather than a
conflict; the sign-in HTTP entry point that lets a browser reach any of it is the hosted
login path described below, and it too goes through that one plug point. Catalogs read identity
through the same site-kit port with no second auth stack — the storefront plane is
`packages/site-kit/src/catalog-identity.ts`, one implementation both catalogs re-export —
and the matrix denies them both identity packages. Two rules the sites tier cannot bend:
the credit-pack catalog and the catalog listing set are loaded from bundled modules
(`credit-packs.data.ts`, `catalog-listings.data.ts`, held in lockstep with their contract
fixtures by `pnpm check:contracts`), never a runtime file read a serverless bundle may not
trace — or a bundler cannot even resolve; and checkout redirect URLs come only from
`NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` via `resolveCheckoutRedirectOrigin`, never from a
request `Host`. Credit accounts are provisioned by the deployment's own `CreditStore`, not
by any migration or code in this repository — an absent account refuses, and is never
invented. Hosted login (sceneaxi#185) rides the same seam: `/login` plus
`POST /api/login|logout` are thin over `performLogin`/`performLogout` in
`sites/umbrella/src/lib/login-flow.ts`, which drive the plane's login port
(`createAuthLoginAdapter` over the deployment's `IdentityPort`); both entry points take a
same-origin proof as a **required argument** (`verifyLoginRequestOrigin` over site-kit's
`verifySiteFormOrigin`) and refuse `SITE_REQUEST_CROSS_ORIGIN` before a field is read or a
port is reached, because `SameSite=Lax` withholds nothing from a POST that carries no
cookie yet; the sign-in grant's raw
session token exists only in the HttpOnly `sceneaxi.session` cookie, `next` redirects
stay same-site relative, and guarded surfaces render refusals as named access states via
site-kit's `describeSiteAccessState` — the account surface itself stays form-free
(sign-out lives on `/login`). The wiring invariants and the six acceptance properties
are proven in `tests/sites/identity-plane-wiring.test.ts` (hosted-login block included)
— extend it, and the matrix cases in
`tests/boundary/injected-site-violations.test.ts`, when touching any of this.

The shared visual layer is `packages/site-kit` (`design-tokens.ts`, `site-element.ts`,
`change-review.ts`, `state-panel.ts`, `commerce-notice.ts`), owned by
`docs/design-foundations.md` (sceneaxi#155/#162). It lives there
because ADR 0018 makes each site its own install root and site-kit is the only package all
three already depend on, so the tokens cost no matrix edge; the surface accent stays a
per-site override. The package stays framework-free — it emits CSS text and a neutral
`SiteElement` tree, never a React component. Site-local `state-panel.tsx` and
`commerce-notice.tsx` files are thin React adapters; browser graphs consume the narrow
`@sceneaxi/site-kit/state-panel` entry rather than the Node-bearing root barrel. Shared
session credential vocabulary/precedence is `site-session.ts`, while Next header/cookie
access stays in each site's `_session.ts`. Two rules that cannot bend: contrast is **measured**
in `test/design-tokens.test.ts` against every neutral, so a token cannot be promoted to a
readable role by editing a table; and a visual fact the design archive does not state is a
decision recorded in that doc before it ships, never invented in code. Change Review
renders a real `Proposal` — badges carry only what E1 can propose, a mixed accept refuses
because apply is all-or-nothing, and Kids theming refuses by name.

The two storefronts are **one design in two install roots** (sceneaxi#156, implementing
`Asset Storefronts.dc.html` from the captain-accepted design archive). ADR 0018 forbids
the archive's runtime store switch, so the shared skeleton is enforced instead of
inherited: `src/app/globals.css` is byte-identical between `catalog-game` and
`catalog-web` below the block marked `STORE IDENTITY` — the only per-store block — and so
are `src/lib/{family-bar,digest-sigil,catalog-facts,foundations}.ts` and every file in
`src/app/_components/`. Edit one and you must edit the other, or
`tests/sites/catalog-storefronts.test.ts` fails. Neither storefront owns a token: both
serve `foundationsCss({ surface })` from `site-kit` through `src/lib/foundations.ts`, and
`globals.css` declares no Foundations token, and neither it nor any `src/lib/` module
writes a Foundations palette value in any notation — the suite asserts both directions
over the sheet and the modules, so a copied palette cannot come back through a `.ts`
file either. A storefront names its
surface (`CATALOG_SITE_FOUNDATION_SURFACE`) and site-kit resolves the accent, which is why
`--store-game` / `--store-web` each have exactly one declaration in the repository; where
the archive's sheet and site-kit disagreed, site-kit won and the divergence is recorded in
each README (notably: storefront accents have **no** hover shade, because the sheet prints
one only for signal orange). The same suite computes a 4.5:1 floor on every shipped text
pairing against the sheet the site actually serves, and refuses the archive's invented
digests, prices, cart, and download counts. Each storefront's README owns the
archive-versus-contract table and the recorded browser measurements. The family bar is
cross-origin links from `NEXT_PUBLIC_SCENEAXI_{GAME,WEB}_CATALOG_ORIGIN` (now read by all
three sites) and has no Kids key to configure, which is what keeps the Kids denial
structural rather than filtered.

Publish readiness is proven structurally, never by publishing: this repo holds no
registry publish authority, so `docs/publish-readiness.md` owns the outsider-facing
checklist, the shared `0.0.0` version plan, and the consumer export-namespace
declaration, and `scripts/check-publish-ready.mjs` (`pnpm check:publish-ready`, in the
gate) enforces both directions — a drifted manifest, export, or version fails, and so
does a checklist row the script does not implement. The doc's marked tables
(`<!-- publish-ready:versions|exports|checklist -->`, plus `consumer-surface` in
`docs/web-consumer.md`) are machine-read declarations, so edit them as contracts. It is
also what keeps `exports` maps honest — nothing else checks that an export target is a
real file — and it shares one walker (`scripts/lib/package-exports.mjs`) with the
engine-SDK archive test, so the gate and the archive cannot disagree about what an
export target is or about the archive shipping it. Adding a check means
adding its ID to `CHECK_IDS`, a row to the doc, and an injected-violation case to
`tests/publish/injected-publish-violations.test.ts`. The two deployable tiers are
exempt from the consumable rules by tier (no root export, `link:` deps) because they
are separate install roots — `sites/` (ADR 0018) and `desktop/` (ADR 0024, whose
`link:` may also reach `apps/`); `pnpm check:sites` and `pnpm check:desktop` own them
instead.

The identity + credits plane is `packages/auth` (single-admin resolution, role
guards, identity port) and `packages/billing` (append-only ledger, metering,
free-vs-paid entitlements, Stripe test checkout, creator revenue share), release
group `identity`; schema is forward-only SQL in `db/migrations`. Configuration and
the ownership map are `docs/auth-credits.md`; the shape is settled by ADR 0021.
Better Auth, Neon, and the Stripe API are **injected adapters** — never
dependencies — while webhook signature verification stays in core because it is
deterministic and fixture-testable. Load-bearing invariants: `User` has no role
field so `admin` is unclaimable and comes only from `SCENEAXI_ADMIN_EMAIL`;
`CreditAccount` has no balance because the ledger is the only source of truth; the
ledger is append-only in both the pure code and a DB trigger; Stripe `live` refuses
without an explicit `liveModeAuthorized` captain gate; money splits are
bookkeeping-only (no Connect payouts); Kids commerce and Kids identity are refused
by name — `AUTH_REFUSE_REASONS.kidsSurfaceDenied` and
`BILLING_REFUSE_REASONS.kidsCommerceDenied` — independently on every path that can
reach identity or a charge, so adding a path means adding its deny, not relying on
an upstream one. Secrets are env-only. This plane is product
user auth and does **not** replace held-key captain policy; it adds no CLI verb.
The credit-pack, entitlement-matrix, and catalog-listing fixtures are canonical
JSON kept in lockstep with `docs/auth-credits.md` by `pnpm check:contracts` —
extend `tests/contracts/` and `tests/db/schema-lockstep.test.ts` when touching any
of it. The credit-pack fixture is an **append-only archive**: a `packRevisions`
row is immutable and digest-pinned, repricing or retirement only appends a row
and moves `currentRevisionIds`, and `resolveCreditPackRevision()` keeps an
already-paid revision resolvable from the persisted intent's anchor tuple. That
archive is the grant's issuance authority (captain decision D2): before any
append or commit, `applyCheckoutCompletedGrant()` resolves the persisted
intent's `(itemId, stripePriceId, unitAmount)` through it and grants the
retained revision's credits, so the persisted intent is evidence to cross-check
and never an amount to honour. `docs/auth-credits.md` owns those rules.

Runtime-unforgeable provenance for the identity + credits plane is owned by
`docs/auth-credits.md` (sceneaxi#126). Preserve its object-identity witness: a
structural or symbol-keyed brand does not satisfy the copy-refusal contract.
When adding a provenance-bearing value or consumer, extend
`tests/e2e/runtime-provenance-refusal.test.ts` and the refuse matrix.

The umbrella owns **every viewport** and is the only site that may depend on
`@sceneaxi/engine-presentation` (ADR 0022 + its 2026-07-26 amendment) — every other
engine package stays denied to every site, and both catalogs keep `site-kit` only. Every
**site** surface that draws pixels — all of them inventoried, with the desktop tier's,
in `docs/three-presentation-core.md` — goes
through exactly one module that constructs a renderer:
`sites/umbrella/src/app/_components/sculpt-viewport.tsx`, through the ADR 0002 seam,
naming no Three type. A gate test asserts that owner list has exactly one entry, and the
desktop tier's own single owner is asserted separately, never added to it. They all
receive the same browser payload, `MountableScene`
(`packages/site-kit/src/mountable-scene.ts`) — validated artifacts plus `composeScene()`
world transforms — so what may be drawn is decided in `site-kit` and gate-tested without
a browser: `live-open.ts` picks the public fixture, `editor-session.ts` projects the
editor session's own composition. Drawing is not authoring: the viewport consumes a
composed snapshot, advances no kernel session, and adds no operation to
`WEB_EDITOR_SESSION_OPERATIONS`, so it widens neither ADR 0020 entitlement nor ADR
0003's general-E2 bound; entitlement is still decided before a session exists, so a
refused `/editor` request reaches no canvas at all. `pnpm gate` proves both payload paths
on the headless surface, the marketing hero included since it mounts the public one
(`tests/e2e/umbrella-live-open-golden.test.ts` and
`tests/e2e/umbrella-editor-viewport-golden.test.ts`, both in `test:golden`); the pixel
claim is a recorded browser observation in `docs/three-presentation-core.md`, never a
gate inference. Shipped presentation copy is asserted against `LIVE_OPEN_PRESENTATION`,
so the retired "experimental preview" framing cannot return by review slip.

Hosted AI reaches a credit debit through exactly one path: `runMeteredModelCall()`
in `packages/billing/src/hosted-ai.ts`, whose fixed order (Kids → route → hosted
opt-in → current ledger → replay → entitlement incl. balance → metering
readiness → provider → debit) is the contract, documented in
`docs/auth-credits.md`. The replay step
answers a retry from the account-scoped debit that already exists after the
caller refreshes its state; an absent or stale ledger refuses for every hosted
principal, including admin, before the balance gate and provider, with no
`response` to
hand back, an unreadable store refusing there rather than after the call, and the
principal authenticated before persistence is read at all — with the account
persistence returns re-checked against that principal before its history is
loaded or any metering key is compared. That same persisted
ledger is what the balance gate and `meterCredits` judge, after equality with the
caller's supplied state has been established; and
only a **throw** from the injected thunk is a provider failure, so a provider
layer that refuses by value must translate it caller-side. Hosted is default-off
(`HOSTED_AI_DEFAULT_CONFIG`) and a configured adapter or key never enables it; BYO
bills `byo-model-keys` and stays free. The provider is an **injected thunk**, never
a Model Provider Port type, so billing gains no engine edge — callers wire the port
themselves, as `tests/e2e/hosted-ai-metering-golden.test.ts` does over
`createFixtureTransport` from `@sceneaxi/provider-openrouter` (recorded data, no
network, no credential). Adding a `BILLING_REFUSE_REASONS` entry requires a
covering case in `tests/e2e/auth-credits-refuse-matrix.test.ts`, which asserts
every reason is reachable.

The packaged **Linux desktop application** is its own `desktop/` tier (ADR 0024):
`desktop/linux` (`@sceneaxi/desktop-linux`), an Electron install root outside the
root workspace exactly like each site, so Electron/esbuild/electron-builder never
touch the hermetic lockfile — `pnpm check:desktop` (in the gate) enforces that,
plus the tier split where only `src/electron/**` may import Electron. The window
document is the desktop-shell chrome **unforked** plus exactly two injections;
the one bridge seam is `createDesktopBridge()` in `desktop/linux/src/lib/bridge.ts`
(synchronous `handle()`, mirrored on web-shell's inspector app), reaching
`composeScene()`, `bootstrapOpenPath()`, and `createDesktopSession()` only. The
renderer process holds the tier's one renderer-owning module
(`src/renderer/viewport.ts`) drawing the shared `MountableScene` through the
ADR 0002 seam; gate proof is `tests/e2e/desktop-linux-bridge-golden.test.ts` (in
`test:golden`, headless surface, no pixel claim) plus
`tests/boundary/injected-desktop-violations.test.ts`, and the packaged binary
re-proves the paths via `pnpm smoke --packaged`. Distribution is one recorded,
non-bit-reproducible CI workflow artifact that **expires**:
`docs/desktop-linux.md` owns that record — run, source commit, checksums, and the
day the download is gone — and the umbrella `/engine` may print no field of it
except through the fail-closed `resolveDesktopAppOffer()` behind
`desktopLinuxAppOffer()` in `site-kit`, which refuses by name rather than
offering a fallback URL, and reads no clock so every visitor sees the same
record. `tests/sites/desktop-offer-lockstep.test.ts` keeps offer and doc in
lockstep; `tests/sites/desktop-download.test.ts` holds the page's metadata,
checksum, coming-soon, and refusal contract. Windows/macOS stay without recorded
public downloads and render as the record's own coming-soon rows. The separate macOS
packaging root is `desktop/macos` (`@sceneaxi/desktop-macos`, sceneaxi#194): it stages
the exact `desktop/linux` build rather than forking product behavior, keeps updates
disabled unless the release preflight has real Apple signing/notarization inputs, and
emits stable universal artifact names plus checksummed release/update metadata. It owns
no second renderer. No signed/public macOS artifact is recorded yet, so `/engine` must
continue to show macOS unavailable; `docs/desktop-macos.md` owns the exact operator
prerequisites and release handoff. No profile, Kids, auth/billing, or CLI
verb reaches this tier.

Windows packaging (sceneaxi#204) is the separate `desktop/windows` install root and
stages the already-built `desktop/linux` runtime rather than forking the editor,
bridge, or renderer. Its signed NSIS/update/release contract is owned by
`docs/desktop-windows.md`: `dist` refuses without Windows signing inputs and never
publishes; `draft:upload` additionally requires an operator-created draft and explicit
GitHub authority. Until a real release is verified and recorded, the download IA
must keep Windows coming soon and no Windows R2 claim exists.

The Engine Desktop chrome's **shared product model** is
`packages/schemas/src/editor-shell.ts` (sceneaxi#184): the seven modes, rail
labels, dock-tab derivation, viewport sources, assistant modes/states, control
kinds (`view`/`review`/`live`/`inert`), window-tier thresholds, structural
metrics, and the retired-copy list — vocabulary only, no state machine and no
colour. `apps/desktop-shell` derives its tables from it; the umbrella's entitled
`/editor` projects it through `buildEditorShellView()` in
`packages/site-kit/src/editor-shell.ts` over one real Minimum E2 render (real
tree, transforms, kernel digests, the actual propose/apply proposal reviewed by
`reviewProposal`, composition projection, seeded plugin registry), rendered by
the one client component `sites/umbrella/src/app/editor/_components/editor-shell.tsx`.
Parity across schemas/desktop/web/stylesheet-breakpoints is a data identity in
`tests/parity/editor-shell-parity.test.ts`; the web shell's honesty contract
(closed `EDITOR_SHELL_WEB_REFUSALS`, live controls ⊆
`WEB_EDITOR_SESSION_OPERATIONS`, `EDITOR_SHELL_FABRICATED_FIGURES` asserted
absent) is `packages/site-kit/test/editor-shell.test.ts`, and the surface's
owner doc — deviations and the recorded browser evidence — is
`docs/web-editor-shell.md`. Engine state never changes client-side: every live
control is a link or GET form re-rendering `/editor` URL state, so ADR 0020's
entitlement-before-session and ADR 0003's bounds are untouched.

The Engine Desktop **visual** surface is `apps/desktop-shell` alone
(sceneaxi#158): `src/visual-model.ts` decides (seven modes, mode-dependent dock
tabs, profile switch, assistant states, Change Review, command palette,
overlays, sculpt progress, window tiers, the closed `DESKTOP_VISUAL_REFUSALS`
registry) and `src/chrome.ts` renders it as one self-contained HTML document via
the `sceneaxi-desktop chrome` command — no remote asset, no framework, no DOM
types. Three invariants: every control declares `view` | `review` | `inert`, and
an inert one keeps its focus stop and names a refusal; the profile switch
**projects** `openPathPolicyView()` rather than describing a profile, so parity
with the CLI is a data identity; and the chrome mounts no presentation runtime
and opens no kernel session, so it draws no pixels, invents no digest, byte
size, frame rate, or timing, and reaches `authoring-core` on no path. The
canonical archive digest, the `Engine Desktop v1.dc.html` supersession (amber
accent, Space Grotesk/IBM Plex, fixed 2064×1400 launcher storyboard — none of it
may return), every deviation from that archive, and the recorded browser
evidence are owned by `docs/engine-desktop-surface.md`; that doc is the thing to
update when the surface changes. It draws Foundations v2 like every other
surface, but **duplicates** those tokens in `src/visual-tokens.ts` instead of
consuming `packages/site-kit`, because the dependency matrix allows this app only
`@sceneaxi/schemas` and `@sceneaxi/authoring-core` — do not resolve that by
adding the edge; `FOUNDATIONS_V2_ALIGNMENT` and its test are what keep the copy
honest, and the same doc records why.

The in-app AI assistant composition seam is `createAssistantPanel()` in
`apps/web-shell/src/assistant-panel.ts` (sceneaxi#121), the one matrix node that may
name both the Model Provider Port and the credit plane. Its contract and refusal
ordering are owned by `docs/auth-credits.md`; its runnable level is owned by
`docs/runnable-surfaces.md`. Extend `apps/web-shell/test/assistant-panel.test.ts`
and `tests/e2e/assistant-panel-golden.test.ts` when changing that seam.

Catalog commerce is **offered** only through `packages/billing/src/fixture-commerce.ts`
(sceneaxi#138): a closed enumeration of one dual-priced fixture SKU
(`FIXTURE_COMMERCE_LISTING_IDS`), resolved by id from the committed listing set, so no
exported function on that path accepts a caller-supplied `CatalogListing` and every other
listing — committed, unknown, or fabricated — refuses
`LISTING_FIXTURE_COMMERCE_NOT_ENABLED`. Being in `catalog-listings.fixtures.json` is not
being for sale. It is also where the matrix's `catalog-asset-purchase` row is actually
enforced, and where a credits retry is judged against the balance that preceded its own
debit — the same hazard the hosted-AI replay step exists for, since this balance gate also
sits above the ledger's idempotency check. What this path adds to money bookkeeping is only
the *offer* — the SKU must be enumerated and the settled amount must be that listing's
committed price; the evidence rules below belong to `recordMoneySale`, not to a second copy
here. No function there accepts or forwards `liveModeAuthorized`, which
is what makes test mode structural rather than defaulted; this widens no marketplace,
publishing, or catalog-app surface. The whole path is `tests/e2e/catalog-fixture-commerce-golden.test.ts`
in `test:golden`.

Money bookkeeping is built from verified evidence, never from arguments (sceneaxi#127):
`recordMoneySale()` in `packages/billing/src/revenue-share.ts` takes exactly a
runtime-witnessed `parseCheckoutCompletedEvent` completion plus the persisted intent it was
bound to, and has **no** parameter for a gross, currency, buyer, mode, listing, or sale id —
gross and currency come from the intent, buyer/mode/`occurredAt` from the completion, the
sale id is read out of the intent's `sale:<saleId>` key (re-derived into its `intentId`, so
it cannot be renamed onto another sale), and the listing and its seller are resolved from the
committed catalog. `MoneySplitRecord` itself is unchanged and still refuses every payout
field. Settlement is bound to the **exact** Checkout Session: `CheckoutSettlement.sessionId`
is required, the parser reads `data.object.id` from the verified body and compares them
before anything else about the settlement, and carries it onto the completion as
`checkoutSessionId` — so evidence from another identically-priced paid session refuses
`STRIPE_SETTLEMENT_SESSION_MISMATCH` and an event that names no session refuses
`STRIPE_CHECKOUT_SESSION_ID_MISSING`. `MoneySplitRecord` stays pure and unpersisted — #128
delivered the **credits** commit boundary below, and no store operation writes a money
split, so a deployment that wants those rows durable owns that write. Ownership map:
`docs/auth-credits.md`; regressions live in
`packages/billing/test/revenue-share.test.ts`, `packages/billing/test/stripe-checkout.test.ts`,
and `tests/e2e/auth-credits-refuse-matrix.test.ts`.

The credit **commit** boundary is `createCreditStore()` in
`packages/billing/src/store.ts` (sceneaxi#128), and every `CreditStore` — the
in-memory reference one included — is built through it, so build a Neon adapter
the same way rather than implementing the port directly. It exists because the
pure layer guarantees the arithmetic and the refusals but owns no commit, and
because a rule enforced in one adapter is not enforced. Three invariants it holds
for an adapter that has never heard of them: `sale:`-namespaced keys are refused
by `appendEntry` and reach persistence only through `settleCreditsSale`, which
commits both legs and the `CreatorShareRecord` together or not at all;
`appendOrReplayEntry` must answer for the entry it was asked about (a replay
matches the requested payload, a fresh append is exactly what was handed over);
and a settlement's legs must carry that sale's own `saleEntryKeys()`. That
append-or-replay is what a lost response needs — it appends or hands back the row
already committed under the key — and `meterCredits` builds on it by reconciling
a stale supplied state against persistence *before* refusing, so a debit whose
first answer never arrived replays instead of stranding the caller. The webhook's
decision is not a commit either: `persistCheckoutCompletedGrant()` is the
boundary that reports success only after the grant is in the ledger, and it, not
`applyCheckoutCompletedGrant()`, is where the documented flow ends. Contract and
refusal ordering: `docs/auth-credits.md`; regressions live in
`packages/billing/test/store-boundary.test.ts` (written against a hand-rolled
adapter on purpose), `packages/billing/test/metering.test.ts`, and
`packages/billing/test/stripe-checkout.test.ts`. That boundary is the **only**
way a webhook grant commits anywhere (captain decision D4): `sites/umbrella`
goes through it too, so no second commit path exists for a paid event, and the
three-way outcome split it sits inside — acknowledged no-op `200`, deployment
fault `503`, request fault `400`, with `ignored: false` meaning credits are in
the ledger — is unchanged. A commit the boundary cannot confirm refuses
`CREDIT_STORE_FAILED` and is retried; it is never acknowledged. Extend
`tests/sites/identity-plane-wiring.test.ts` when touching that path.

Live-mode authorization has exactly one configuration source (captain decision
D5): `SCENEAXI_STRIPE_LIVE_AUTHORIZED`, resolved only by
`resolveLiveModeAuthorization()` in `packages/billing/src/live-mode.ts`, whose
contract is owned by `docs/auth-credits.md`. Its affirmative names the
authorizer and the day, an alias name refuses by its presence alone, the
injected audit sink is a precondition rather than a side effect, and the
resolved value is runtime-witnessed so no look-alike authorizes anything.
Nothing else — mode, price, `NODE_ENV`, key prefix — may ever become an input.
**It enables nothing:** no shipped call site passes its result, so `live` still
refuses at both ends, and live activation remains the separate ADR 0021 captain
decision.

First-class plugins follow `docs/plugins.md` and ADR 0005: manifests may claim
only IDs from the versioned public capability registry; unknown IDs and
isolation breaches refuse. Runtime API details live in
`packages/plugin-host/README.md`; manifest + registry contracts stay in
`@sceneaxi/schemas`. The host depends only on schemas — never engine packages or
a service locator. This charted v1 host exception does not create renderer,
physics, storage, or other engine-internal ports, which still require two real
adapters under amended ADR 0004. The seed registry is no longer empty: capability
rows are pinned in three places at once (seed JSON, `pluginCapabilityRegistrySeed()`,
and `scripts/check-contracts.mjs`), so adding one is a deliberate contract change
`pnpm check:contracts` enforces. A registered ID owns a public contract module in
`@sceneaxi/schemas`; its shape check is **injected** into the host through
`capabilityContracts` (the host holds no domain knowledge and still never calls a
capability itself), and a declared-but-unimplemented contract refuses with
`capability-contract-violation`. The golden for the whole path is
`tests/e2e/plugin-capability-golden.test.ts`.

## Maintaining this file

Rewrite when durable project-wide knowledge changes; prefer pointers over copied process.
