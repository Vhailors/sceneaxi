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
traceability audit. It establishes which source wins when records disagree and
preserves the repository state captured by Phase 01. It does not inventory
requirements or claim implementation coverage; those are later Phase 02 tasks.

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

The Phase 02 initiation snapshot was audited at:

| Field | Value |
|---|---|
| Branch | `main` |
| Full HEAD SHA | `89c7aa5e9fbaa7e31b9c7e879841684651426d07` |
| Phase 01 starting SHA | `9873ea3bd5f012c4b84ceccca60739ec5111d9d1` |
| Package manager | `pnpm@9.15.0` |
| Node requirement | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |

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
| `scripts/check-sites.mjs` and `scripts/check-desktop.mjs` | Deployable-site and desktop-tier structural checker owners. |
| `scripts/check-publish-ready.mjs` | Publish-readiness declaration checker; readiness is structural and not publication authority. |
| `tests/docs/module-coverage.ts` and `tests/docs/capability-matrix-audit.ts` | Existing reusable scanners for module and capability evidence; their tests are process-level audit regressions. |
| `tests/contracts/`, `tests/boundary/`, `tests/publish/` | Existing injected-drift and boundary regression conventions to reuse in later checker work. |
| `package.json` | Root quality sequence: syntax → boundaries → contracts → sites → desktop → publish-ready → build → tests → lint, via `pnpm gate`. No step is weakened or reordered by this baseline. |

## Scope boundary for this run

This initiation task establishes the hierarchy, records the Phase 01 receipt,
and inventories the authoritative source families. It intentionally does not
assign stable requirement IDs, classify implementation coverage, enumerate live
exports/routes/controls, create the machine-readable requirement declaration,
write the gap register, or add a checker. Those are separate unchecked tasks in
`Phase-02-Executable-Spec-Traceability-Audit.md` and remain unchecked.
