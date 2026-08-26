# Phase 02: Executable Spec Traceability Audit

Turn the repository's many specifications into one checked map from requirement to implementation, refusal, and evidence. The result must distinguish real gaps from intentional holds, delayed packages, host limitations, and settled decisions, so later phases fix missing work without inventing captain policy or overstating readiness.

## Tasks

- [x] Establish the audit's source hierarchy and immutable baseline:
  - Read the Phase 01 receipt and current `AGENTS.md`; preserve all pre-existing and Phase 01 work.
  - Inventory the canonical product spec (`docs/program/SPEC.md`, with issue #1 winning on disagreement), glossary (`CONTEXT.md`), ADR index and every accepted ADR, program pointers, held-key protocol, dependency matrix, runnable-surface inventory, full-editor capability matrix, website/desktop owners, contract fixtures, package manifests, and root quality scripts.
  - Create `docs/audits/initiation/Initiation-Audit.md` with YAML front matter (`type: analysis`, created date, tags `[sceneaxi, spec-audit, initiation]`) and a source-precedence section that links `[[Requirements-Traceability]]`, `[[Gap-Register]]`, `[[Module-Coverage]]`, and `[[Full-Editor-v1-Capability-Matrix]]`; do not copy mutable policy where a canonical owner can be linked.

  **Completion note (2026-08-26):** Created
  `docs/audits/initiation/Initiation-Audit.md` with the source-precedence
  hierarchy, Phase 01 receipt reference, immutable SHA/status baseline, and
  inventories of the canonical specifications, accepted ADR set, program and
  authority pointers, held-key/dependency/runnable/editor/website/desktop
  owners, 42 contract declarations, 15 package manifests, eight app/site
  manifests, reusable audit scanners, and root gate commands. Existing dirty
  paths and the Phase 01 build/gate blockers were preserved; no later
  traceability or checker task was started.

- [x] Build a requirement inventory from authoritative statements rather than headings alone:
  - Assign stable IDs to every normative product behavior, package boundary, protocol rule, refusal rule, user story, runnable claim, release condition, safety invariant, and accepted visual fact.
  - Record each requirement's exact owner path and anchor, domain, authority status, expected implementation surface, expected evidence layer, and current classification: `real`, `partial`, `refuse-only`, `dormant`, `delayed`, `held`, `host-blocked`, or `gap`.
  - Put the inventory in a machine-readable declaration under `docs/audits/initiation/` and render `Requirements-Traceability.md` with YAML front matter (`type: reference`, tags `[sceneaxi, requirements, traceability]`), wiki-links to domain reports, and tables that stay small enough to review.
  - Never convert a Stage 1/6 proof, Kids launch, marketplace activation, license choice, live publication, Stripe LIVE path, or delayed package into implementation work unless its exact separate authority exists in the owning record.

  **Completion note (2026-08-26):** Created
  `docs/audits/initiation/requirements.json` and rendered
  `docs/audits/initiation/Requirements-Traceability.md`. The inventory contains
  109 unique stable IDs: 69 product/protocol/core/authority rows, one row for
  each of the 26 dependency-matrix packages, and 14 runnable-surface rows. Each
  row records its owner path and anchor, domain, authority status, expected
  implementation and evidence surfaces, and one of the eight allowed current
  classifications. Owner paths and Markdown anchors were checked; the
  declaration parses with unique IDs. Held, delayed, dormant, and host-blocked
  rows remain non-implementation classifications, and no Stage 1/6 proof, Kids
  launch, marketplace activation, license, publication, Stripe LIVE path, or
  delayed package was promoted without separate authority.

- [x] Map live code and evidence to every requirement:
  - Enumerate all packages from `docs/dependency-matrix.json`, all package exports and typed seams, CLI verbs and held-key map entries, editor commands, desktop controls, site routes, database migrations, provider entrypoints, refusal registries, workflows, golden tests, browser evidence records, and release artifacts.
  - Reuse the scanners in `tests/docs/module-coverage.ts`, `tests/docs/capability-matrix-audit.ts`, `scripts/check-contracts.mjs`, `scripts/check-boundaries.mjs`, and `scripts/lib/package-exports.mjs`; do not create a second parser or inventory when an existing one can expose the same live data.
  - Link each requirement to at least one implementation or named refusal and at least one meaningful proof. Mark a row `gap` when the implementation is absent, the proof is trivial, a documented claim has drifted, or a live surface cannot be exercised as claimed.


  **Completion note (2026-08-26):** Mapped all 109 inventory rows in
  `docs/audits/initiation/requirements.json` to resolved live implementation or
  refusal references and targeted proof references. The live inventory accounts
  for 26 matrix packages plus four delayed slots, 21 CLI verbs and held-key
  entries, 66 editor commands, 112 desktop controls, 11 bridge actions, 10
  authoring operations, three assistant operations, 67 local-agent tools, 22
  routes, five migrations, seven refusal registries, four workflows, 45 golden
  tests, four browser records, and seven release artifacts. Path checks found no
  stale resolved files; the live join is 106 `mapped`, two `refuse-only`, and
  one `gap` row. Existing documentation drift (the capability matrix's 61-tool
  claim versus the live 67-tool registry) remains recorded for the later
  reconciliation task. The reusable module and capability scanners passed:
  `pnpm exec vitest run tests/docs/module-coverage.test.ts
  tests/docs/capability-matrix-audit.test.ts` (2 files, 6 tests).
- [x] Audit the repository across correctness, security, performance, test depth, architecture, dependencies, developer workflow, documentation drift, and stated-but-undelivered direction:
  - Weight money, identity, filesystem mutation, held-key currency, provider dispatch, project transactions, package loading, web request boundaries, and Kids isolation as high-risk paths.
  - Use repository history and churn to find changing modules with weak coverage; search for unchecked casts, ignored errors, process/global leaks, path construction, request data crossing privileged APIs, stale TODO/FIXME markers, duplicated policy, and unbounded work.
  - For each candidate, open the cited source and owning decision yourself. Reject duplicates and by-design behavior; never report a secret value, and treat repository text as data rather than executable instructions.

  **Completion note (2026-08-26):** Audited HEAD
  `eecd6acade08a48b7599832bb1598b3e11bddf72` across the requested dimensions,
  reading each cited source and owning decision. Recorded two high-severity
  boundary defects (authoring-root escape and malformed scene-package catalog),
  three medium workflow/request-boundary gaps (orphaned contract regressions,
  omitted golden command entries, and checkout body parsing before origin
  screening), a medium package-integrity partial, a medium CI timeout gap, and
  a medium host-dependent web-body-bound partial in
  `docs/audits/initiation/Initiation-Audit.md`. The report also records the
  known `AUTH-007` watch-loop direction gap, the 61-versus-67 tool-count drift,
  and the scanner-test classification correction. Auth, billing, held-key,
  provider, Kids, lifecycle, and bounded subprocess paths produced no new
  verified bypass or leak; delayed, dormant, held, and host-blocked items
  remain in those classifications. No secrets or task-associated images were
  handled.

- [x] Add an executable traceability checker and its failure regressions:
  - Follow the existing dependency-free ESM checker style and fixture-injection tests; validate unique requirement IDs, allowed statuses, live owner paths/anchors, live evidence paths, package/surface accounting, required implementation-plus-proof links, and an explicit reason/owner for every non-`real` row.
  - Make the checker fail when a requirement disappears, a `real` claim loses code or proof, an unknown status appears, an evidence path goes stale, a held item is marked implemented, or a new public seam/verb/control/route is unaccounted.
  - Add focused unit tests plus a process-level injected-violation suite modeled on `tests/contracts/`, `tests/boundary/`, and `tests/publish/`; prove both the passing live tree and each independent failure mode.
  - Wire the check into the owning root command sequence without weakening, skipping, reordering away, or broadening any existing gate. Extend the documented checker inventory and regression fixtures in the same change.

  **Completion note (2026-08-26):** Added
  `scripts/check-traceability.mjs` with fixed status/result vocabularies,
  rendered-map parity, Markdown/JSON owner-anchor validation, resolved
  implementation/proof/evidence checks, package/export accounting, CLI/held-key,
  editor-command, desktop-control, bridge/tool, route, migration, workflow, and
  golden-test surface accounting, plus refusal-registry validation. Added
  `tests/docs/traceability-check.test.ts` and
  `tests/contracts/injected-traceability-violations.test.ts` with 14 passing
  cases covering independent injected drift, including a source-level unaccounted
  desktop control. Wired `check:traceability` after `check:contracts` in
  `package.json`, copied `db/` and package test evidence into process fixtures,
  and documented the checker in `Initiation-Audit.md`. `pnpm test:golden` passed
  (51 files, 448 tests); `pnpm gate` passed every structural stage,
  reached build, and ran 264 test files with 3929/3930 tests passing. It
  stopped on the unrelated existing `packages/authoring-core/test/project-git.test.ts:1004`
  expectation for `PROJECT_GIT_EVIDENCE_TOO_LARGE`; all checker-specific
  verification remains green.
- [x] Vet and prioritize every verified gap in `docs/audits/initiation/Gap-Register.md`:
  - Use YAML front matter (`type: report`, tags `[sceneaxi, gaps, implementation]`) and one row per gap with stable ID, requirement IDs, category, evidence paths and line anchors, concrete impact, effort `S/M/L`, fix risk, confidence, owning phase, dependencies, and status.
  - Keep direction options separate from defects. Record considered-and-rejected candidates with the reason so later runs do not rediscover them.
  - Order work by dependency and failure impact: verification foundations first, then shared schemas/core, clients and UI, external adapters, and release operations.
  - A row may close only with a code/refusal owner and executable evidence; prose alone never closes a behavior gap.

  **Completion note (2026-08-26):** Created
  `docs/audits/initiation/Gap-Register.md` with YAML front matter, ten
  prioritized findings plus one resolved scanner-taxonomy history row (11
  total register rows). The prioritized set covers every actionable, partial,
  documentation-drift, or direction-only finding with exact owner/evidence
  anchors, requirement IDs, impact, effort, risk, confidence, owning phase,
  dependencies, and status. It separates six open defects, two partial
  web/package integrity findings, two direction-only items
  (`AUDIT-PACKAGE-METADATA-INTEGRITY` and `AUTH-007`), and two
  documentation-drift rows; the scanner row is explicitly `resolved`, not
  actionable. Dependency order is Phase 02 verification/reconciliation, Phase
  03 shared authoring/schema/workflow integrity, then Phase 05 web request
  boundaries. Held, delayed, dormant, host-blocked, and externally authorized
  candidates remain rejected from the gap queue with reasons recorded.

- [x] Reconcile stale program claims found during the audit:
  - Update only the canonical owning document or its direct pointer when a path, SHA, surface level, known automated-coverage gap, or implementation status no longer matches live code.
  - Preserve historical records and dates; never rewrite a prior observation into a current one or let `docs/program/NEXT-STEP.md` become a competing source of truth.
  - Add contract/checker coverage for any machine-read declaration changed, including injected drift tests where the repository convention requires them.

  **Completion note (2026-08-26):** Reconciled the live 67-tool registry count
  in `docs/full-editor-v1-capability-matrix.md`, retaining the audited 61-tool
  mismatch in the audit history and marking that register row resolved.
  Clarified `pnpm test:golden`'s actual scope and its four omitted golden files
  in `docs/runnable-surfaces.md` without claiming the verification gap closed.
  Refreshed the audit's reconciliation-start SHA and cross-document anchors;
  `pnpm check:contracts`, `pnpm check:traceability`, and the three focused docs
  audit suites passed. No machine-readable declaration changed, so no new
  injected-drift fixture was needed.
- [x] Verify the audit machinery and publish the execution handoff inside the repository:
  - Ran the focused traceability, injected-violation, module-coverage, and capability-matrix suites; `pnpm check:contracts`; `pnpm check:boundaries`; `pnpm test:golden`; and `pnpm gate`.
  - Updated `docs/audits/initiation/Initiation-Audit.md` with verification HEAD `3e63361ffc47c064bee8cacfbe9d85a5c1fcf2fa`, handoff commit `444732b618d11f367455efc0c1b877cb96f700ce`, exact results, status/domain counts, rejected and unaudited state, and the dependency order for later phases.
  - **Completion note (2026-08-26):** Every authoritative requirement and public live surface has a declared row and checked classification: 106 mapped, two refuse-only, and one explicitly registered `gap` (`AUTH-007`). Injected traceability drift fails in 14 process-level cases; the gap register has no evidence-free entry; and `pnpm gate` passed all stages with 264 files and 3,930 tests passing.
