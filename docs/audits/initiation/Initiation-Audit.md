---
type: analysis
title: SceneAxi Phase 02 Initiation Audit
created: 2026-08-26
tags:
  - sceneaxi
  - spec-audit
  - initiation
related:
  - '[[Requirements-Traceability]]'
  - '[[Gap-Register]]'
  - '[[Module-Coverage]]'
  - '[[Full-Editor-v1-Capability-Matrix]]'
---

# SceneAxi Phase 02 Initiation Audit

This document records the immutable source baseline for the Phase 02
traceability audit and the cross-dimensional findings verified against that
baseline. The machine-readable requirement inventory owns row-level coverage;
this document records the audit evidence, rejected candidates, and handoff.

## Source precedence

Use the following order when classifying a requirement or resolving drift:

1. **Explicit current authority.** A current captain decision or separately
   granted authority controls its exact scope. A passing gate, merged change,
   option list, or this audit never grants proof, spend, account, publication,
   deployment, push, Kids launch, or live-mode authority.
2. **Canonical external records.** `sceneaxi#1` is the canonical product-scope
   specification; later captain decisions supersede older prose. The
   factories-helpers `#41` issue remains canonical for the engine-core proof
   program and its Stage 0–8 / Stage 1 rules. Repository copies are pointers or
   consumer copies unless they explicitly own a narrower contract.
3. **Authoritative runtime policy.** The structured held-key registry and its
   generated snapshot protocol are authoritative for captain holds. Markdown
   decision registries document keys for humans but are not runtime truth.
4. **Settled repository decisions.** `docs/adr/README.md` and every accepted ADR
   under `docs/adr/` define settled design boundaries. ADR 0008 remains a
   historical record but is superseded in part for product surfaces by ADR
   0017; neither ADR changes the Stage 1 proof authority.
5. **Canonical owner documents.** A domain owner document is authoritative for
   its named path, status vocabulary, evidence map, or deployment topology.
   Summary documents and pointers must link to that owner rather than copy and
   mutate its policy.
6. **Executable declarations and evidence.** Schemas, fixtures, package
   manifests, checkers, tests, and recorded evidence establish what the current
   tree actually exposes and proves. They cannot silently widen the authority
   granted by the sources above.

The Phase 02 outputs that will consume this hierarchy are
[[Requirements-Traceability]], [[Gap-Register]], [[Module-Coverage]], and
[[Full-Editor-v1-Capability-Matrix]]. The first three are audit artifacts; the
last is the existing canonical full-editor owner and is linked here using its
stable document identity.

## Phase 01 receipt and immutable baseline

Phase 01's receipt is
`.maestro/playbooks/Initiation/Working/Phase-01/Baseline.md`. It records the
starting tree at `9873ea3bd5f012c4b84ceccca60739ec5111d9d1`, Node `v24.14.0`,
pnpm `9.15.0`, the package-manager pin, and the pre-existing dirty paths. The
receipt's six structural checks passed. Its build/gate attempt remained open
because the pre-existing untracked `tests/gauntlet/aaa-surfaces.test.ts` is
outside the hermetic root test compiler's JSX/React contract, and the existing
modified desktop chrome retains a reopen regression. Phase 02 preserves both
conditions rather than rewriting or resetting them.

The historical Phase 02 initiation snapshot, captured before the branch work,
was audited at:

| Field | Value |
|---|---|
| Branch | `main` |
| Full HEAD SHA | `89c7aa5e9fbaa7e31b9c7e879841684651426d07` |
| Phase 01 starting SHA | `9873ea3bd5f012c4b84ceccca60739ec5111d9d1` |
| Package manager | `pnpm@9.15.0` |
| Node requirement | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |

The checkout snapshot used for this reconciliation is:

| Field | Value |
|---|---|
| Branch | `maestro/phase-02-requirement-inventory` |
| Reconciliation-start HEAD SHA | `7c151dc033204903dc6f40052bb99f19e9ddc92f` |
| Audited source snapshot SHA | `eecd6acade08a48b7599832bb1598b3e11bddf72` |

The source findings were made against the audited snapshot SHA above. The
reconciliation started from the later HEAD shown above; its audit report,
executable traceability checker, gate outcome, and playbook notes are
verification artifacts rather than changes to the audited source findings. The
Phase 01 receipt and the historical initiation snapshot remain unchanged
records.

The following paths were already modified or untracked before this artifact
was created and remain outside its scope:

```text
 M .maestro/playbooks/Initiation/Phase-01-Trusted-Baseline-and-Live-Prototype.md
 M .maestro/playbooks/Initiation/Working/Phase-01/Baseline.md
 M apps/desktop-shell/src/chrome.ts
 M apps/desktop-shell/test/chrome.test.ts
 M sites/catalog-game/src/app/globals.css
 M sites/catalog-web/src/app/globals.css
 M sites/umbrella/src/app/globals.css
 M vitest.config.ts
?? .maestro/playbooks/Initiation/Phase-02-Executable-Spec-Traceability-Audit.md
?? .maestro/playbooks/Initiation/Phase-03-Core-Engine-and-Authoring-Completion.md
?? .maestro/playbooks/Initiation/Phase-04-Engine-Desktop-Product-Loop-and-Polish.md
?? .maestro/playbooks/Initiation/Phase-05-Websites-Storefronts-and-Visual-Quality.md
?? .maestro/playbooks/Initiation/Phase-06-Identity-Billing-and-Security-Hardening.md
?? .maestro/playbooks/Initiation/Phase-07-Reliability-Performance-and-Release-Verification.md
?? .maestro/playbooks/Initiation/Phase-08-Production-Activation-and-Rollback-Proof.md
?? .maestro/playbooks/Initiation/Phase-09-Adversarial-Completion-Audit.md
?? tests/gauntlet/
```

No baseline path was reset, stashed, restored, deleted, or overwritten. The
Phase 02 playbook is the only playbook file this run is allowed to advance.

## Authoritative source inventory

### Product scope, proof, and glossary

| Source | Authority and audit use |
|---|---|
| `docs/program/SPEC.md` → `sceneaxi#1` | Consumer copy of the canonical product specification. Issue #1 wins on disagreement; the copy grants no implementation or external-action authority. |
| `CONTEXT.md` | Repository glossary and pointers for the full desktop editor, hybrid sculpt, scene composition, status vocabulary, and package terminology. It points to narrower owners rather than replacing them. |
| `docs/program/spec-41.md` → factories-helpers `#41` | Non-normative in-tree pointer to the engine-core proof program. The external #41 body owns Stages 0–8 and the separate Stage 1 double gate. |
| `docs/program/NEXT-STEP.md` | Evidence-based program position and options. It authorizes nothing and cannot become a competing source of truth. |
| `docs/bootstrap.md` | Separate-authority record for review, install, push, issue, proof, spend, account, and publication actions. |

### Settled architecture and product decisions

| Source | Authority and audit use |
|---|---|
| `docs/adr/README.md` | ADR index, convention, and hard guardrails, including the prohibition on using ADRs to close open captain holds or claim Stage 1. |
| `docs/adr/0001` through `docs/adr/0028` | All 28 numbered ADR files present at the snapshot. The files are accepted or accepted-with-amendment except ADR 0008, whose historical decision is superseded in part by ADR 0017; its history remains in scope for drift and contradiction checks. |
| `docs/held-key-enforcement.md` | Normative held-key snapshot, currency, refusal, and fixture-testing protocol. The generated/runtime registry outranks prose summaries. |
| `docs/dependency-matrix.json` | Machine-readable package and surface dependency boundary. The matrix, not an inferred import graph, is the boundary baseline. |
| `docs/runnable-surfaces.md` | Canonical claim inventory for R2 startable, R1 driveable, and R0 refuse-only surfaces and their proof paths. |
| `docs/full-editor-v1-capability-matrix.md` | Canonical full-editor v1 inventory, status vocabulary, control accounting, and evidence/dependency map. It reports current behavior; a visual `live` control is not automatically a real capability. |
| `docs/three-presentation-core.md` | Presentation-core ownership, two draw surfaces, pixel-claim language, and deep-seam constraints. |
| `docs/websites-deploy.md` | Web topology, site ownership, provider wiring, and verification configuration. Ordered activation and rollback remain owned by `docs/production-activation.md`. |
| `docs/desktop-linux.md` | Linux desktop runtime, bridge, renderer ownership, artifact record, and deliberate absences. Cross-surface release authorization remains owned by `docs/production-activation.md`. |
| `docs/desktop-macos.md` and `docs/desktop-windows.md` | Separate packaging-root contracts and their current no-public-artifact constraints. |

### Executable declarations and quality owners

| Source | Inventory captured at baseline |
|---|---|
| `packages/schemas/contracts/*.json` | 42 checked-in contract/fixture declarations, including CLI envelopes and command maps, held keys, kernel/session, authoring, scene/sculpt, editor/desktop, catalog/commerce, identity/billing, plugin, delivery, and profile contracts. |
| `packages/*/package.json` | 15 library/package manifests: `authoring-core`, `auth`, `billing`, `cli`, `engine-kernel`, `engine-orchestrator`, `engine-presentation`, `importers`, `plugin-host`, `profile-game`, `profile-kids`, `profile-web`, `provider-openrouter`, `schemas`, and `site-kit`. |
| `apps/*/package.json` and `sites/*/package.json` | Four app manifests (`catalog-game`, `catalog-web`, `desktop-shell`, `web-shell`) and four deployable-site manifests (`catalog-game`, `catalog-web`, `kids`, `umbrella`). Each site is an independent install root as required by ADR 0018. |
| `scripts/check-syntax.mjs` | Source syntax checker owner. |
| `scripts/check-boundaries.mjs` | Dependency-matrix boundary checker owner. |
| `scripts/check-contracts.mjs` and `scripts/check-contracts.test.mjs` | Contract/fixture lockstep checker and its checker-level tests. |
| `scripts/check-traceability.mjs` | Requirement declaration, rendered-map, owner-anchor, resolved-link, package/export, and live-surface accounting checker. It fails closed on drift and does not authorize held, delayed, dormant, or host-blocked work. |
| `tests/docs/traceability-check.test.ts` | Focused direct-call unit regressions for the traceability checker. |
| `tests/contracts/injected-traceability-violations.test.ts` | Process-level copied-tree regressions for missing requirements, missing implementation/proof, unknown status, stale evidence, held promotion, and unaccounted public surfaces. |
| `scripts/check-sites.mjs` and `scripts/check-desktop.mjs` | Deployable-site and desktop-tier structural checker owners. |
| `scripts/check-publish-ready.mjs` | Publish-readiness declaration checker; readiness is structural and not publication authority. |
| `tests/docs/module-coverage.ts` and `tests/docs/capability-matrix-audit.ts` | Existing reusable scanners for module and capability evidence; their tests are direct-call unit regressions, not process-level tests. |
| `tests/contracts/`, `tests/boundary/`, `tests/publish/` | Existing injected-drift and boundary regression conventions reused by the traceability process suite. |
| `package.json` | Root quality sequence: syntax → boundaries → contracts → traceability → sites → desktop → publish-ready → build → tests → lint, via `pnpm gate`. No existing stage is weakened, skipped, or reordered. |

## Cross-dimensional audit

Audited HEAD: `eecd6acade08a48b7599832bb1598b3e11bddf72` (`MAESTRO: target
traceability proof refs`). The review covered correctness, security,
performance, test depth, architecture, dependencies, developer workflow,
documentation drift, and stated-but-undelivered direction. It read each cited
source and owning decision, compared live declarations with their consumers,
checked recent history/churn, and searched shipped source, tests, workflows,
and scripts for unchecked casts, ignored errors, process/global leaks,
unbounded work, path construction, and stale markers. Findings below are
the evidence set reviewed and dispositioned in [[Gap-Register]]; this section
does not grant authority to implement held or delayed work.

### Findings reviewed for the gap register

| ID | Severity | Classification | Evidence and impact | Owner |
|---|---|---|---|---|
| `AUDIT-AUTHORING-ROOT-ESCAPE` | High | `gap` | `packages/authoring-core/src/propose-apply.ts:95-97` canonicalizes `resolve(cwd, documentPath)` without checking that the target remains inside the authoritative root. The helper feeds proposal targets and applied edits at `:250-252`, `:363-365`, `:650-653`, and `:787-790`; an absolute, traversal, or outside-resolving symlink target can therefore reach a journal and atomic rewrite. The direct-write path has the intended containment check at `:1097-1127`, but `transaction-history.test.ts:40-77` does not cover these escape forms. | Phase 03, authoring core |
| `AUDIT-PACKAGE-CATALOG-SHAPE` | High | `gap` | `packages/schemas/src/desktop-scene-package.ts:73-80` accepts the top-level tag and casts the value without validating `lock` or its entries. Project-controlled catalogs then reach `desktop/linux/src/lib/desktop-scene.ts:1899-1941` and `desktop/linux/src/lib/bridge.ts:3170-3212`, where package operations call `.some`, `.filter`, iteration, and digest serialization. A malformed catalog can throw across the privileged command boundary instead of returning `PACKAGE_CATALOG_INVALID`; `packages/schemas/test/desktop-scene-package.test.ts:1-92` lacks malformed nested-catalog cases. | Phase 03, shared schemas/core |
| `AUDIT-CONTRACT-REGRESSION-DISCOVERY` | High | `gap` | `scripts/check-contracts.test.mjs:105-478` declares process-level contract regressions and executes them at `:480-490`, but `vitest.config.ts:75-82` includes only TypeScript tests and `package.json:20-22` invokes only `check-contracts.mjs`. No root script or workflow runs the `.mjs` regression suite, leaving authoring-job, hostile-key, plugin-registry, and inert-example regressions outside `pnpm test` and `pnpm gate`. | Phase 02, checker and root workflow |
| `AUDIT-CHECKOUT-BODY-ORDER` | Medium | `gap` | `sites/umbrella/src/app/api/checkout/route.ts:26-35` calls `request.formData()` and enumerates attacker-controlled fields before `resolveCheckoutRedirectOrigin` at `:50-53` and identity resolution at `:55-61`. This permits untrusted-origin body parsing/allocation before the fail-closed boundary; malformed multipart input also escapes without the caught-parser response used by `sites/umbrella/src/app/api/editor/catalog-intake/route.ts:44-60`. | Phase 05, web request boundary |
| `AUDIT-PACKAGE-METADATA-INTEGRITY` | Medium | `partial` | `packages/schemas/src/desktop-scene-package.ts:83-131` accepts renderer/request-supplied `manifest`, locator, and syntactically shaped digest without binding the digest to inspected bytes; non-string capabilities are discarded and `pluginVersion` only needs to be non-empty. The fields cross the renderer/IPC edge in `desktop/linux/src/lib/bridge.ts:3176-3184`, while `docs/full-editor-v1-capability-matrix.md:177` describes a contained, capability-declared, digest-stamped lock. | Phase 03, package loading |
| `AUDIT-GOLDEN-COMMAND-OMISSIONS` | Medium | `gap` | The hand-maintained `test:golden` command in `package.json:17` omits `contained-git-golden`, `desktop-assistant-scene-loop-golden`, `full-editor-transactions-golden`, and `hosted-ai-metering-golden`, although `requirements.json:7670-7710` declares them among the live golden tests. `pnpm test` still discovers them, but `docs/runnable-surfaces.md:56-61` now states the dedicated command's actual scope and names the omission. | Phase 02, checker and root workflow |
| `AUDIT-CI-TIMEOUT-BOUND` | Medium | `gap` | `.github/workflows/gate.yml:9-31`, `.github/workflows/desktop-linux.yml:10-67`, `.github/workflows/desktop-macos.yml:23-89`, and `.github/workflows/engine-sdk.yml` declare no `timeout-minutes`. Installs, the full gate, packaging, smoke, signing, and provider checks therefore lack a repository-owned duration bound. This is an operational resource risk, not a product-runtime failure. | Phase 03, verification workflow |
| `AUDIT-WEB-BODY-BOUND` | Medium | `partial` | `sites/umbrella/src/app/api/stripe/webhook/route.ts:35-59` uses `await request.text()`, and `sites/umbrella/src/app/api/editor/catalog-intake/route.ts:45-66` materializes `formData()` before an application-owned byte/count ceiling. Host limits may bound the deployed paths, so the review does not call this proven unbounded; changing hosts would lose the invariant. | Phase 05, external request boundaries |
| `AUDIT-TOOLS-COUNT-DRIFT` | Low | `documentation-drift` (resolved) | The audited snapshot's `docs/full-editor-v1-capability-matrix.md:47-50` said 61 local-agent tools, while the live registry and traceability map recorded 67 (`docs/audits/initiation/requirements.json:7740-7755`; `Requirements-Traceability.md:53`). The owner now records 67 and retains the prior mismatch as a dated audit observation. | Phase 02, documentation reconciliation |
| `AUDIT-SCANNER-TEST-CLASSIFICATION` | Low | `documentation-drift` (resolved) | The audit wording is now corrected: `tests/docs/module-coverage.test.ts:1-76` and `tests/docs/capability-matrix-audit.test.ts:1-108` directly import scanner functions. They provide unit coverage; they do not spawn the owning process. | No later implementation |

`AUTH-007` remains the only inventoried product-level gap: the E1
`project dev --watch` loop is absent and its refusal is deliberate. It belongs
to the authoring gap register, not to this audit's performance findings. The
package metadata item is a partial integrity claim, not evidence of code
execution: the package lock records `executed: false`, and networking and
marketplace remain false.

### Confirmed no-findings and intentional classifications

No verified identity or authorization bypass appeared in auth principal
issuance, provenance, role guards, or request-bound session resolution.
Billing checkout grants and refunds use verified webhook provenance, committed
catalog tuples, and append-or-replay persistence; no double-grant or replay
defect was found. Held-key dispatch gates every executed CLI verb before its
handler, and help does not execute a verb. Model-provider dispatch validates
profile, route, capability, adapter output, and the non-overridable Kids deny.
Kids' duplicated reducer is required by ADR 0018 and its dependency-empty
matrix row; it is not accidental policy duplication.

The review found no shipped `TODO`, `FIXME`, `HACK`, `@ts-ignore`,
`@ts-expect-error`, `eslint-disable`, or `as any` markers in the searched live
source, test, workflow, and script trees. Observed `as unknown as` boundaries
and error catches were fail-closed handling or adversarial tests, except for
the specifically documented package-catalog cast. Contained Git subprocesses,
rename evidence, local RPC, desktop session maps, and assistant polling have
explicit budgets or lifecycle release paths.

Delayed engine/provider packages, dormant catalogs, Kids deployment, signing
and publication, Stripe LIVE, hosted desktop metering, and Stage 1/6 proof
remain held, delayed, dormant, or host-blocked by their owning records. The
recent history shows concentrated churn in desktop presentation, bridge, and
assistant paths (`9873ea3`, `cfb354a`, `b3ef2c3`, `98cf63e`); each reviewed
hotspot has targeted tests or a named host limitation, so churn alone produced
no additional finding.

### Handoff order

1. Phase 02 should wire the orphaned contract regressions and account for the
   four omitted golden command entries. The 61-versus-67 tool count is now
   reconciled in the canonical capability matrix; the prior mismatch remains
   resolved audit history alongside the corrected scanner-test classification.
2. Phase 03 should close authoritative-root containment, validate persisted
   package catalogs, decide how package discovery binds metadata to bytes, and
   add bounded CI workflow durations.
3. Phase 05 should move checkout origin screening ahead of body parsing and
   define application-owned body and field limits for public request paths.
4. The existing `AUTH-007` authoring gap remains after those verification
   foundations; any watcher implementation needs explicit lifecycle and
   backpressure rules rather than a silent product-scope expansion.

No image was associated with this checkbox task; no image analysis was needed.

## Scope boundary for this run

This document establishes the source hierarchy, preserves the Phase 01 receipt,
and records the verified cross-dimensional findings from the current checkout.
Stable requirement IDs and live coverage remain in
`Requirements-Traceability.md`; the prioritized and direction-only findings
are now registered in `Gap-Register.md`. This audit does not authorize
implementation of held, delayed, dormant, or host-blocked work.
