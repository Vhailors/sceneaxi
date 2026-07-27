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
  sequence (syntax, boundaries, contracts, **sites**, **publish-ready**, build, test, lint). Syntax and test explicitly refuse empty surfaces, and every stage exits
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
read — never restated — by `profile-game`, `profile-web`, `sceneaxi profile
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
- `docs/program/NEXT-STEP.md` — evidence-based program position (main SHA, landed PRs, open decisions, deferred #126–#128) and the options under consideration. It authorizes nothing and owns no fact: where it disagrees with an ADR, doc, issue, or PR, that owner wins.
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
`@sceneaxi/auth` + `@sceneaxi/billing`, and only from that file, which builds the site-kit
adapters over them and maps their named refusals onto the site refusal registry — it
implements no identity, no ledger, and no signature check. Provider clients (Better Auth,
Neon, Stripe API) stay outside the repo per ADR 0021 and arrive through the one
`umbrellaPlaneHandles()` function; while they are absent every dependent surface refuses
by name and `IDENTITY_SESSION_ABSENT` means signed-out, not broken. Catalogs read identity
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
invented. The wiring invariants and the six acceptance properties are proven in
`tests/sites/identity-plane-wiring.test.ts` — extend it, and the matrix cases in
`tests/boundary/injected-site-violations.test.ts`, when touching any of this.

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
`tests/publish/injected-publish-violations.test.ts`. Sites are exempt from the
consumable rules by tier (no root export, `link:` deps) because they are separate
install roots (ADR 0018); `pnpm check:sites` owns them instead.

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
of it.

Runtime-unforgeable provenance for the identity + credits plane is owned by
`docs/auth-credits.md` (sceneaxi#126). Preserve its object-identity witness: a
structural or symbol-keyed brand does not satisfy the copy-refusal contract.
When adding a provenance-bearing value or consumer, extend
`tests/e2e/runtime-provenance-refusal.test.ts` and the refuse matrix.

The umbrella owns **every viewport** and is the only site that may depend on
`@sceneaxi/engine-presentation` (ADR 0022 + its 2026-07-26 amendment) — every other
engine package stays denied to every site, and both catalogs keep `site-kit` only. Two
surfaces draw pixels, the public `/open` and the entitled `/editor`, and exactly one
module constructs a renderer for both:
`sites/umbrella/src/app/_components/sculpt-viewport.tsx`, through the ADR 0002 seam,
naming no Three type. A gate test asserts that owner list has exactly one entry. Both
receive the same browser payload, `MountableScene`
(`packages/site-kit/src/mountable-scene.ts`) — validated artifacts plus `composeScene()`
world transforms — so what may be drawn is decided in `site-kit` and gate-tested without
a browser: `live-open.ts` picks the public fixture, `editor-session.ts` projects the
editor session's own composition. Drawing is not authoring: the viewport consumes a
composed snapshot, advances no kernel session, and adds no operation to
`WEB_EDITOR_SESSION_OPERATIONS`, so it widens neither ADR 0020 entitlement nor ADR
0003's general-E2 bound; entitlement is still decided before a session exists, so a
refused `/editor` request reaches no canvas at all. `pnpm gate` proves both paths on the
headless surface (`tests/e2e/umbrella-live-open-golden.test.ts` and
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
sits above the ledger's idempotency check. Money bookkeeping is reachable only from a
runtime-witnessed `parseCheckoutCompletedEvent` completion plus the persisted intent it
was bound to, whose `sale:<saleId>` key names the sale, so a `MoneySplitRecord` cannot
describe money no verified settlement took. No function there accepts or forwards
`liveModeAuthorized`, which
is what makes test mode structural rather than defaulted; this widens no marketplace,
publishing, or catalog-app surface. The whole path is `tests/e2e/catalog-fixture-commerce-golden.test.ts`
in `test:golden`.

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
