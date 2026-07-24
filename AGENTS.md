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
  sequence. Syntax and test explicitly refuse empty surfaces, and every stage exits
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

## Program docs

- `docs/program/SPEC.md` — consumer copy of the canonical product spec ([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1); on disagreement #1 wins).
- `docs/program/spec-41.md` — pointer to factories-helpers#41, source of truth for the Stage 0–8 engine-core proof program, plus the transfer classification.
- `docs/proof/` — proof-prep docs only; Stage 1 is double-gated and nothing in that directory is a run authorization.

## Layout

See root README package/app map and `docs/DEPENDENCY-MATRIX.md`. Prefer small public package interfaces (deep modules). The authoring core lives in `packages/authoring-core`; the CLI is a thin protocol adapter over it and may not import engine packages directly. CLI protocol (dispatcher, exit-code map, versioned envelope, `--json`): `packages/cli` + `packages/cli/README.md`; envelope schema in `packages/schemas/contracts/cli-protocol-envelope.schema.json`. Game Kernel seam is `packages/engine-kernel` (`open`/`dispatch`/`advance`/`observe`/`save`/`replay` per ADR 0001); only `advance` mutates; Kernel Session contract lives in `packages/schemas` (`contracts/kernel-session.schema.json`). Settled engine/CLI decisions live in `docs/adr/` — respect them without re-litigating; ADRs never touch open captain holds. Authoring behavior (CLI `project` verbs, propose/apply) is governed by `docs/authoring-contracts.md`: E1 is normative, general E2 remains specified-not-built, and ADR 0003 owns the bounded hybrid Minimum E2 exception. The shared authoring-jobs fixture list is canonical in `packages/schemas/contracts/authoring-jobs.fixtures.json`, and `pnpm check:contracts` keeps doc and JSON in sync. Text-canonical document + propose/apply (sceneaxi#9) live in `packages/authoring-core` with contracts in `packages/schemas` (`document.schema.json`, `proposal.schema.json`); CLI surface is `project propose` / `project apply`. Catalog Item contract + fail-closed pipeline stubs live in `packages/schemas` (`contracts/catalog-item.schema.json`, `src/catalog.ts`); `catalog-game` / `catalog-web` are dormant apps that import only `schemas`. Asset Package / ingestion policy SoT remains factories-helpers#47/#48 — cite, do not rewrite. Profile Conformance (sceneaxi#10): contract + shared suite in `@sceneaxi/schemas` (`contracts/profile-conformance.schema.json`, `runProfileConformanceSuite`); first development consumer is `@sceneaxi/profile-game` (`conformance` export). Web/Kids stay not-yet-claimed in `profileConformanceRegistry`; `shippingClaim` remains false. The resolved rollout decision is recorded in the canonical product spec (#1; in-tree consumer copy `docs/program/SPEC.md`). Public Web Experience consumption and pinning are documented in `docs/web-consumer.md`; consumers use published package-root APIs and product-local glue only.

The Model Provider Port (sceneaxi#45) is `packages/authoring-core/src/model-provider-port.ts`, with provider-neutral v1 envelopes and evidence shape in `packages/schemas/contracts/model-provider-port.schema.json`. Adapters and per-profile filters are injected; the port refuses missing policy/adapter/capability and enforces a non-overridable Kids deny before dispatch. There is no live provider adapter in core.

Delivery Handoff is the public, delivery-neutral export contract in `@sceneaxi/schemas` (`contracts/delivery-handoff.schema.json`, `src/delivery-handoff.ts`); its adapter boundary and digest semantics are authoritative in `docs/delivery-handoff.md`. Provider-specific delivery adapters, credentials, uploads, approvals, and releases stay outside SceneAxi core.

First-class plugins follow `docs/plugins.md` and ADR 0005: manifests may claim
only IDs from the versioned public capability registry; unknown IDs and
isolation breaches refuse. Runtime API details live in
`packages/plugin-host/README.md`; manifest + registry contracts stay in
`@sceneaxi/schemas`. The host depends only on schemas — never engine packages or
a service locator. This charted v1 host exception does not create renderer,
physics, storage, or other engine-internal ports, which still require two real
adapters under amended ADR 0004.

## Maintaining this file

Rewrite when durable project-wide knowledge changes; prefer pointers over copied process.
