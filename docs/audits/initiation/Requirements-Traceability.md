---
type: reference
title: SceneAxi Requirements Traceability
tags:
  - sceneaxi
  - requirements
  - traceability
related:
  - '[[Initiation-Audit]]'
  - '[[Gap-Register]]'
  - '[[Module-Coverage]]'
  - '[[Full-Editor-v1-Capability-Matrix]]'
---

# SceneAxi Requirements Traceability

This is the Phase 02 requirement inventory rendered from the machine-readable
[`requirements.json`](requirements.json) declaration. The declaration is the
complete record: every row has a stable ID, exact owner path and anchor, domain,
authority status, expected implementation surface, expected evidence layer, and
one current classification. This report keeps review tables compact while the
JSON preserves the complete fields for later executable checking.

## Inventory scope and status

The inventory contains **109 requirements**: 69 product/protocol/core/authority
requirements, 26 package-boundary requirements, and 14 runnable-surface
requirements. Package boundaries are one row per package in
[`dependency-matrix.json`](../../dependency-matrix.json); runnable surfaces are
one row per independently claimed or deliberately absent surface in
[`runnable-surfaces.md`](../../runnable-surfaces.md).

| Classification | Count | Meaning in this inventory |
|---|---:|---|
| `real` | 87 | Current behavior is represented by an implementation surface and an evidence owner. |
| `partial` | 8 | A bounded path exists, but the documented scope, host, provider, or release proof is incomplete. |
| `refuse-only` | 2 | The named path is deliberately unavailable and has an executable refusal contract. |
| `dormant` | 3 | The declaration or app exists, but its product path is intentionally inactive. |
| `delayed` | 2 | A reserved package or surface is not yet on disk or has not earned its runnable level. |
| `held` | 5 | Separate captain authority or proof/release authorization is still required. |
| `host-blocked` | 1 | The current host prevents exercise; the record does not establish a product defect. |
| `gap` | 1 | The stated behavior is absent from the current implementation and needs a later decision/fix. |

## Source precedence

Classification follows [[Initiation-Audit]] and never treats an implementation,
gate result, or this inventory as new authority:

1. Current explicit captain authority for its exact scope.
2. Canonical product scope in `sceneaxi#1`, mirrored by
   [`docs/program/SPEC.md`](../../program/SPEC.md), with the external issue winning
   on disagreement.
3. The factories-helpers `#41` proof program for Stages 0–8 and Stage 1.
4. The normative held-key protocol in
   [`held-key-enforcement.md`](../../held-key-enforcement.md).
5. Accepted ADRs and their amendments.
6. Narrow canonical owner documents.
7. Executable declarations, implementations, tests, and recorded evidence.

The companion outputs are [[Gap-Register]], [[Module-Coverage]], and the existing
[[Full-Editor-v1-Capability-Matrix]]. This document does not authorize Stage 1/6
proof, Kids launch, marketplace activation, license selection, live publication,
Stripe LIVE, package publication, or any other externally gated action.

## Topology and boundaries

| ID | Requirement | Owner | Authority | Class |
|---|---|---|---|---|
| TOPO-001 | One engine/library ecosystem, one authoring core, and separately versioned Game/Web/Kids profiles. | `docs/program/SPEC.md#solution` | canonical-spec | real |
| TOPO-002 | Downward package boundaries use exhaustive allow/deny lists. | `docs/dependency-matrix.json#/rule` | executable-declaration | real |
| TOPO-003 | Individual games remain separate repositories consuming versioned releases. | `docs/program/SPEC.md#identity-and-topology-locked-captain-decisions--constitution-not-open-questions` | settled-decision | real |
| TOPO-004 | All shared contracts live in zero-dependency schemas. | `docs/program/SPEC.md#monorepo-package-map` | canonical-spec | real |
| TOPO-005 | Profiles carry independent versions and core-version pins. | `docs/program/SPEC.md#versioning-and-release-groups-checker-verified-manifest-stamps` | canonical-spec | real |
| TOPO-006 | Release groups and core pins are checker-verified without implicit migration. | `docs/program/SPEC.md#versioning-and-release-groups-checker-verified-manifest-stamps` | canonical-spec | real |
| TOPO-007 | Delayed engine/provider slots stay declared without counterfeit shipped implementations. | `docs/dependency-matrix.json#/delayed` | executable-declaration | delayed |
| BOUNDARY-001–026 | Every package has an individual matrix accounting row; the JSON records the exact package subject and evidence owner. | `docs/dependency-matrix.json#packages` | executable-declaration | see JSON |

`BOUNDARY-001` through `BOUNDARY-026` cover, in matrix order: auth,
authoring-core, billing, catalog-game, catalog-web, cli, desktop-linux,
desktop-macos, desktop-shell, desktop-windows, engine-kernel,
engine-orchestrator, engine-presentation, importers, plugin-host, profile-game,
profile-kids, profile-web, provider-openrouter, schemas, site-catalog-game,
site-catalog-web, site-kids, site-kit, site-umbrella, and web-shell. They are not
a second allow-list: the executable matrix remains authoritative.

## Authoring protocol and held keys

| ID | Requirement | Owner | Authority | Class |
|---|---|---|---|---|
| AUTH-001 | CLI envelopes, exit codes, strict JSON, versions, and next-action hints are deterministic. | `docs/program/SPEC.md#agent-native-cli-protocol-normative-properties` | canonical-spec | real |
| AUTH-002 | Validation refuses major mismatch, unknown flags, ambiguity, and partial-write risk; allowed writes are atomic. | `docs/authoring-contracts.md#e1--v1-authoring-surface-source-first-normative` | owner-contract | real |
| AUTH-003 | E1 provides `project new/dev/test/capture/report` over canonical text. | `docs/authoring-contracts.md#cli-surface-the-project-verb-group` | normative-protocol | real |
| AUTH-004 | Inspector edits use propose/review/apply and never write directly. | `docs/authoring-contracts.md#proposeapply-flow-inspector-gizmo-edits` | normative-protocol | real |
| AUTH-005 | Evidence verbs emit reproducible packets with stable paths and model descriptors. | `docs/program/SPEC.md#testing-decisions` | canonical-spec | real |
| AUTH-006 | Shells and CLI produce identical documents and evidence for equivalent edits. | `docs/program/SPEC.md#user-stories` | canonical-spec | real |
| AUTH-007 | The unimplemented E1 watch loop remains a named gap; one-shot `project dev` is not mislabeled as watch. | `docs/runnable-surfaces.md#deliberate-refusals` | owner-contract | gap |
| HOLD-001 | Gated verbs establish the authoritative registry epoch with no offline exception. | `docs/held-key-enforcement.md#currency-check-required-for-every-held-key-gated-invocation` | normative-protocol | real |
| HOLD-002 | Currency, epoch, snapshot, map, declaration, open-key, and unknown-key failures refuse by name. | `docs/held-key-enforcement.md#refusal-table` | normative-protocol | real |
| HOLD-003 | Fresh-epoch drift and unavailable-authority regressions are mandatory and fail closed. | `docs/held-key-enforcement.md#fresh-nn-vs-authoritative-n1-regression-must-fail-closed` | normative-protocol | real |

## Core, profiles, and visual presentation

| ID | Requirement | Owner | Authority | Class |
|---|---|---|---|---|
| CORE-001 | Kernel exposes open/dispatch/advance/observe/save/replay; only advance mutates. | `docs/adr/0001-game-kernel-command-snapshot-session.md#decision` | settled-decision | real |
| CORE-002 | Orchestrator owns one-host bootstrap, named refusals, deterministic record, and close-once handles without a job system. | `docs/adr/0023-open-path-bootstrap-and-session-lifecycle.md#decision` | settled-decision | real |
| CORE-003 | Kernel digests are portable and the kernel stays browser-safe. | `docs/kernel-browser-open.md#what-changed` | owner-contract | real |
| CORE-004 | Composition requires two or more artifact placements, preserves bytes/evidence, and fails closed on its matrix. | `docs/scene-composition.md#shipped-contract-depth` | owner-contract | real |
| CORE-005 | One shared open-path policy is projected by every surface; Kids is refuse-only and shipping is false. | `docs/open-path-policy.md#the-policy` | owner-contract | real |
| CORE-006 | One Three presentation core serves WebGL and headless surfaces without leaking Three types. | `docs/three-presentation-core.md#one-core-two-draw-surfaces` | settled-decision | real |
| CORE-007 | Headless frames explicitly claim no pixels or GPU timing. | `docs/three-presentation-core.md#labels` | owner-contract | real |
| CORE-008 | Bounded manifest v2 assets have stable byte-derived identity/preview and review-only reload. | `docs/asset-ingestion.md#manifest-v2-and-admitted-profiles` | owner-contract | real |
| CORE-009 | Native project creation is atomic; legacy bytes stay unchanged until approved migration. | `docs/full-editor-v1-capability-matrix.md#full-editor-capability-gaps` | current-evidence | real |
| CORE-010 | Transactions are base-versioned, atomic, recoverable, restart-durable, and support undo/redo. | `docs/full-editor-v1-capability-matrix.md#full-editor-capability-gaps` | current-evidence | real |
| CORE-011 | Hierarchy, ordered selection, parenting, protected-root rules, and stable identity are projected from composition. | `docs/full-editor-v1-capability-matrix.md#full-editor-capability-gaps` | current-evidence | real |
| CORE-012 | Transform edits share one review command with explicit space/pivot/axis/snap and no pre-accept write. | `docs/full-editor-v1-capability-matrix.md#full-editor-capability-gaps` | current-evidence | real |
| CORE-013 | Reusable content has deterministic definitions, instances, overrides, refresh, and source-conflict refusals. | `docs/full-editor-v1-capability-matrix.md#full-editor-capability-gaps` | current-evidence | real |
| CORE-014 | Input actions cover devices, contexts, defaults, conflicts, rebind/reset, and durable settings outside document undo. | `docs/full-editor-v1-capability-matrix.md#full-editor-capability-gaps` | current-evidence | real |
| CORE-015 | Play uses an isolated source-hash clone and never writes authoring bytes on stop/reset. | `docs/full-editor-v1-capability-matrix.md#full-editor-capability-gaps` | current-evidence | real |
| CORE-016 | Animation authoring/scrub/replay is bounded, non-mutating when previewing, and deterministic. | `docs/full-editor-v1-capability-matrix.md#full-editor-capability-gaps` | current-evidence | real |
| CORE-017 | Physics uses bounded fixed-step deterministic replay and ordered animation-before-physics evaluation. | `docs/adr/0027-physics-world-host.md#decision` | settled-decision | real |
| CORE-018 | Environment, material, and seeded-effect edits are bounded presentation data with independent Kids refusals. | `docs/adr/0025-presentation-authored-scene-environment.md#decision` | settled-decision | real |

## Profiles and provider policy

| ID | Requirement | Owner | Authority | Class |
|---|---|---|---|---|
| PROF-001 | Game/Web open paths are R1; shared Kids engine open is R0 refuse-only. | `docs/runnable-surfaces.md#surfaces` | owner-contract | real |
| PROF-002 | Web scope includes interactive sites and real-time experiences, not CMS/SaaS behavior. | `docs/program/SPEC.md#web-experience-creators-web-experience-profile` | settled-decision | real |
| PROF-003 | Kids safety is compiled and excludes dependent identity, telemetry, cookies, commerce, and third-party LLM paths. | `docs/program/SPEC.md#kids-surface-kids-profile` | settled-decision | real |
| PROF-004 | The isolated Kids activity is the only shipped Kids surface and does not consume shared site/profile packages. | `docs/kids-first-release.md#boundary` | owner-contract | real |
| PROF-005 | Model Provider Port is provider-neutral, typed, profile-filtered, and refuses missing policy/adapter/capability. | `docs/program/SPEC.md#model-provider-port` | canonical-spec | real |
| PROF-006 | OpenRouter-first and conditional DeepSeek policy retain pins, residency, no-fallback, and Kids denial. | `docs/program/SPEC.md#model-provider-port` | settled-decision | partial |

## Catalog and commerce

| ID | Requirement | Owner | Authority | Class |
|---|---|---|---|---|
| CAT-001 | One modular platform serves two independently branded storefronts. | `docs/program/SPEC.md#catalog-pipeline-one-platform-two-storefronts--topology-locked-2026-07-22` | settled-decision | real |
| CAT-002 | Intake to screen to curate to list/delist is recorded and fail closed. | `docs/catalog-intake.md#submitting-is-an-action-never-a-render` | owner-contract | partial |
| CAT-003 | Listings carry rights, provenance, AI disclosure, compatibility, formats, and moderation evidence. | `docs/program/SPEC.md#catalog-pipeline-one-platform-two-storefronts--topology-locked-2026-07-22` | canonical-spec | partial |
| CAT-004 | Commerce remains inert until storefront holds open; Kids consumes an allowlist, never a fork. | `docs/program/SPEC.md#catalog-pipeline-one-platform-two-storefronts--topology-locked-2026-07-22` | held-authority | held |

## Identity and billing

| ID | Requirement | Owner | Authority | Class |
|---|---|---|---|---|
| IDENT-001 | Identity/credits/billing use injected adapters; clients stay out of hermetic core. | `docs/auth-credits.md#ownership-map` | owner-contract | real |
| IDENT-002 | Admin comes only from normalized `SCENEAXI_ADMIN_EMAIL`; roles cannot be claimed from User input. | `docs/auth-credits.md#single-admin-bootstrap` | owner-contract | real |
| IDENT-003 | Login/logout require same-origin proof, HttpOnly cookie storage, and same-site redirects. | `docs/runnable-surfaces.md#surfaces` | current-evidence | real |
| IDENT-004 | Credit balance is append-only ledger state and settlement commits all required legs atomically. | `docs/auth-credits.md#the-credit-persistence-boundary-sceneaxi128` | owner-contract | real |
| IDENT-005 | Hosted AI is default-off and follows the fixed refusal/debit order; BYO is free. | `docs/auth-credits.md#hosted-ai-sceneaxi139` | owner-contract | real |
| IDENT-006 | Checkout grants acknowledge only after commit and bind evidence to the exact Checkout Session and intent. | `docs/auth-credits.md#stripe-test-mode` | owner-contract | real |
| IDENT-007 | Stripe LIVE has one audited environment authorization source and remains unavailable without it. | `docs/auth-credits.md#live-mode-authorization-captain-decision-d5` | held-authority | held |

## Desktop and hosted projections

| ID | Requirement | Owner | Authority | Class |
|---|---|---|---|---|
| DESK-001 | Shared editor vocabulary owns modes, controls, tabs, refusals, assistant states, tiers, and control accounting. | `docs/full-editor-v1-capability-matrix.md#inventory-accounting` | current-evidence | real |
| DESK-002 | Standalone chrome opens no runtime and refuses runtime-dependent controls by name. | `docs/runnable-surfaces.md#deliberate-refusals` | owner-contract | refuse-only |
| DESK-003 | Linux owns packaged app, bridge, renderer, lifecycle, local, and BYOK paths without a second product implementation. | `docs/desktop-linux.md#runtime-and-bridge` | owner-contract | real |
| DESK-004 | First launch binds no root; roots enter only through validated dialog or recent registry. | `docs/desktop-linux.md#first-launch-and-product-tabs` | owner-contract | real |
| DESK-005 | Local bridge is same-user, versioned, permission-checked, and exact-input validated. | `docs/desktop-local-bridge.md#permission-boundary` | owner-contract | real |
| DESK-006 | Provider credentials never cross the bridge, RPC, logs, evidence, project, or CLI; local/BYOK carry no credits. | `docs/desktop-local-bridge.md#byok-secure-storage-contract` | owner-contract | real |
| DESK-007 | Export Web writes a contained content-addressed viewer and Delivery Handoff without deploying. | `docs/desktop-linux.md#ship--export-web` | owner-contract | real |
| DESK-008 | macOS/Windows stage Linux behavior but do not claim public signed artifacts without release inputs. | `docs/desktop-macos.md#current-release-status` | owner-contract | partial |
| DESK-009 | Umbrella `/editor` constructs no canvas before access succeeds; browser controls re-render URL state only. | `docs/web-editor-shell.md#what-is-live-and-what-refuses` | owner-contract | real |
| DESK-010 | Desktop assistant Local/BYOK paths are bounded; Hosted refuses without desktop identity/credits. | `docs/full-editor-v1-capability-matrix.md#desktop-controls-and-states` | current-evidence | partial |

## Runnable surfaces

| ID | Surface | Claim | Owner | Class |
|---|---|---|---|---|
| SURFACE-001 | CLI | R2 startable with spawned binary smoke. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-002 | Desktop shell | R2 startable with standalone chrome command. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-003 | Web shell | R2 loopback authoring/assistant transport. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-004 | Linux desktop | R2 packaged lifecycle and editor paths. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-005 | Game single object | R1 public open path. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-006 | Game multi-object scene | R1 public open path with replay evidence. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-007 | Web Experience | R1 public open path. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-008 | Kids shared engine | R0 named refusal. | `docs/runnable-surfaces.md#deliberate-refusals` | refuse-only |
| SURFACE-009 | Kids isolated activity | R1 own-site activity. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-010 | Importers/plugin host | R1 bounded public paths. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-011 | Umbrella `/open` | R1 public path; headless proof claims no pixels. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-012 | Umbrella `/editor` | R1 only after access decision succeeds. | `docs/runnable-surfaces.md#surfaces` | real |
| SURFACE-013 | macOS desktop | Not yet R2 without signed artifact and launch proof. | `docs/runnable-surfaces.md#not-runnable-yet` | delayed |
| SURFACE-014 | Catalog applications | Dormant until deploy/activation track opens. | `docs/runnable-surfaces.md#not-runnable-yet` | dormant |

## Release, proof, and authority boundaries

| ID | Requirement | Owner | Authority | Class |
|---|---|---|---|---|
| REL-001 | The quality gate fails on broken or unwired required stages; a counterfeit pass is itself a regression. | `docs/program/SPEC.md#testing-decisions` | canonical-spec | real |
| REL-002 | Stage 1 proof needs tier-3 captain decisions plus explicit run authorization and is not product evidence. | `docs/program/spec-41.md#double-gate-normative-reminder` | held-authority | held |
| REL-003 | Review/apply/install/commit/push/merge/proof/spend/publication are separate authorities. | `docs/program/SPEC.md#authority-table-non-transitive-pass--commit--push--merge` | canonical-spec | real |
| REL-004 | Production activation is a runbook only; each external action needs exact current authorization and evidence. | `docs/production-activation.md#authorization-gate` | held-authority | held |
| REL-005 | R2/R1/R0 claims each have the matching entrypoint or named refusal and highest available proof. | `docs/runnable-surfaces.md#levels` | owner-contract | real |
| REL-006 | Publication, Kids launch, marketplace, license, Stripe LIVE, and unsigned platform releases stay held/deferred. | `docs/program/SPEC.md#out-of-scope` | held-authority | held |
| REL-007 | The local Electron GPU crash is a host limitation; CI owns packaged-runtime evidence. | `docs/module-coverage.md#host-limitations` | current-evidence | host-blocked |

## How to consume this inventory

- Use [`requirements.json`](requirements.json) as the machine-readable input for
  the later traceability checker. It is not a second policy source.
- Use [[Module-Coverage]] for package implementation/evidence status and
  [[Full-Editor-v1-Capability-Matrix]] for control and capability accounting.
- Use [[Gap-Register]] for verified implementation gaps only. A `held`,
  `delayed`, `dormant`, or `host-blocked` row is not a defect without evidence
  that its owner contract has been violated.
- Never promote a held or delayed row into implementation work without the
  exact separate authority named by its owner.
