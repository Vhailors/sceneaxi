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

This document is the human review of the machine-readable [`requirements.json`](requirements.json) declaration. The declaration joins each stable requirement to live implementation/refusal references, targeted proof references, and a coverage result. The join reuses the repository's existing module, capability, export, boundary, contract, route, migration, and evidence owners; it is not a second policy source.

## Inventory scope and status

The inventory contains **109 requirements**: 69 product/protocol/core/authority requirements, 26 package-boundary requirements, and 14 runnable-surface requirements. The live join reports **106 mapped**, **2 refuse-only, and **1 gap** rows. A mapped result only means the cited implementation/refusal and proof owners exist; it does not promote a held, delayed, dormant, or host-blocked classification.

| Classification | Count | Meaning in this inventory |
|---|---:|---|
| `real` | 87 | Current behavior is represented by a live implementation and proof reference. |
| `partial` | 8 | A bounded implementation and proof exist, but documented scope or release/platform coverage remains incomplete. |
| `refuse-only` | 2 | The named path is deliberately unavailable and has an executable refusal proof. |
| `dormant` | 3 | The declaration/app exists but its product path is intentionally inactive. |
| `delayed` | 2 | The reserved slot is documented without a shipped package. |
| `held` | 5 | Separate authority or proof/release authorization is still required. |
| `host-blocked` | 1 | The current host prevents exercise; the record does not establish a product defect. |
| `gap` | 1 | The stated behavior is absent or incomplete in the current live surface. |

## Live inventory accounting

The complete enumerations live under `liveInventory` in [`requirements.json`](requirements.json). They are materialized from the canonical sources below so later checker work can validate accounting without adding another parser.

| Surface | Live count | Canonical source(s) |
|---|---:|---|
| Package matrix | 26 live + 4 delayed slots | `docs/dependency-matrix.json; tests/docs/module-coverage.ts` |
| Typed package seams / exports | 26 seams / 58 export entries | `scripts/lib/package-exports.mjs; package manifests` |
| CLI verbs / held-key map | 21 / 21 | `packages/cli/src/commands.ts; packages/cli/src/held-keys/shipped.ts` |
| Editor command registry | 66 | `packages/schemas/src/editor-command-registry.ts` |
| Desktop controls | 112 + 4 Linux-injected | `tests/e2e/desktop-capability-matrix-audit.test.ts` |
| Bridge actions / authoring / assistant | 11 / 10 / 3 | `desktop/linux/src/lib/bridge-contract.ts` |
| Local-agent tools | 67 | `packages/schemas/src/desktop-local-bridge.ts` |
| Site routes / API routes | 22 | `sites/*/src/app/**` |
| Forward-only migrations | 5 | `db/migrations; tests/db/schema-lockstep.test.ts` |
| Provider entrypoints / refusal registries | 8 root + 1 installed / 68 | `provider entrypoints, provider-safe contracts, and public package seams` |
| Workflows / golden tests | 4 / 45 | `.github/workflows; tests/e2e/*golden.test.ts` |
| Browser / release evidence | 12 / 10 | `docs/runnable-surfaces.md; docs/publish-readiness.md` |

The live registry currently contains **67 local-agent tools**. The older
61-tool prose in [`docs/full-editor-v1-capability-matrix.md`](../../full-editor-v1-capability-matrix.md#inventory-accounting)
was corrected during the 2026-08-26 reconciliation; the audit retains that
earlier mismatch as historical evidence. The stale
`packages/billing/src/stripe-checkout.ts` reference was corrected to the live
`packages/billing/src/checkout.ts` owner, and three stale evidence citations
were corrected to their current test owners.

## Source precedence

Classification follows [[Initiation-Audit]] and never treats an implementation, gate result, or this inventory as new authority:

1. Current explicit captain authority for its exact scope.
2. Canonical product scope in `sceneaxi#1`, mirrored by [`docs/program/SPEC.md`](../../program/SPEC.md), with the external issue winning on disagreement.
3. The factories-helpers `#41` proof program for Stages 0–8 and Stage 1.
4. The normative held-key protocol in [`held-key-enforcement.md`](../../held-key-enforcement.md).
5. Accepted ADRs and their amendments.
6. Narrow canonical owner documents.
7. Executable declarations, implementations, tests, and recorded evidence.

The map does not authorize Stage 1/6 proof, Kids launch, marketplace activation, license selection, live publication, Stripe LIVE, package publication, or any other externally gated action.

## Requirement live mapping

Each row has at least one live implementation/refusal reference and one targeted proof reference. The JSON retains every reference and resolved path; this table shows the first reference for compact review. `+N` means additional references remain in the machine declaration.

### Authoring Protocol

| ID | Class | Live implementation / refusal | Targeted proof | Result |
|---|---|---|---|---|
| AUTH-001 | `real` | `packages/cli/src` (+1) | `packages/cli/test/` (+1) | `mapped` |
| AUTH-002 | `real` | `packages/authoring-core` (+1) | `packages/authoring-core/test/project-model.test.ts` (+2) | `mapped` |
| AUTH-003 | `real` | `packages/cli` (+1) | `packages/cli/test/bin-smoke.test.ts` (+1) | `mapped` |
| AUTH-004 | `real` | `packages/authoring-core` (+2) | `packages/authoring-core/test/` (+2) | `mapped` |
| AUTH-005 | `real` | `packages/cli` (+2) | `packages/cli/test/` (+1) | `mapped` |
| AUTH-006 | `real` | `apps/web-shell` (+2) | `tests/parity/shell-cli-parity.test.ts` (+1) | `mapped` |
| AUTH-007 | `gap` | `packages/cli` (+1) | `packages/cli/test/project-lifecycle.test.ts` (+1) | `gap` |

### Catalog

| ID | Class | Live implementation / refusal | Targeted proof | Result |
|---|---|---|---|---|
| CAT-001 | `real` | `sites/catalog-game` (+2) | `tests/sites/catalog-storefronts.test.ts` (+1) | `mapped` |
| CAT-002 | `partial` | `packages/site-kit/src/catalog-pipeline.ts` (+1) | `tests/e2e/catalog-fixture-commerce-golden.test.ts` (+1) | `mapped` |
| CAT-003 | `partial` | `packages/schemas/contracts/catalog-item.schema.json` (+1) | `pnpm check:contracts` (+1) | `mapped` |
| CAT-004 | `held` | `packages/billing/src/fixture-commerce.ts` (+2) | `tests/e2e/catalog-fixture-commerce-golden.test.ts` (+1) | `mapped` |

### Core

| ID | Class | Live implementation / refusal | Targeted proof | Result |
|---|---|---|---|---|
| CORE-001 | `real` | `packages/engine-kernel/src/index.ts` | `packages/engine-kernel/test/scene-session.test.ts` (+1) | `mapped` |
| CORE-002 | `real` | `packages/engine-orchestrator/src/index.ts` | `packages/engine-orchestrator/test/golden-path-orchestrated.test.ts` (+1) | `mapped` |
| CORE-003 | `real` | `packages/engine-kernel/src/portable-digest.ts` (+1) | `packages/engine-kernel/test/browser-open-play.test.ts` (+1) | `mapped` |
| CORE-004 | `real` | `packages/authoring-core/src` (+1) | `tests/e2e/scene-composition-golden.test.ts` (+1) | `mapped` |
| CORE-005 | `real` | `packages/schemas/src/open-path-policy.ts` (+3) | `tests/parity/open-path-policy-parity.test.ts` (+1) | `mapped` |
| CORE-006 | `real` | `packages/engine-presentation/src` (+1) | `packages/engine-presentation/test/` (+2) | `mapped` |
| CORE-007 | `real` | `packages/engine-presentation/src` (+1) | `packages/engine-presentation/test/` (+1) | `mapped` |
| CORE-008 | `real` | `packages/importers/src/contained-gltf.ts` (+1) | `tests/e2e/asset-pipeline-golden.test.ts` (+1) | `mapped` |
| CORE-009 | `real` | `packages/authoring-core/src/project-model.ts` (+2) | `packages/authoring-core/test/project-model.test.ts` (+2) | `mapped` |
| CORE-010 | `real` | `packages/authoring-core/src` | `packages/authoring-core/test/transaction-history.test.ts` (+1) | `mapped` |
| CORE-011 | `real` | `packages/schemas/src/desktop-scene-edit.ts` (+1) | `tests/e2e/desktop-hierarchy-golden.test.ts` (+1) | `mapped` |
| CORE-012 | `real` | `packages/schemas/src/desktop-scene-transform.ts` (+1) | `tests/e2e/desktop-transform-golden.test.ts` (+1) | `mapped` |
| CORE-013 | `real` | `packages/schemas/src/desktop-scene-prefab.ts` (+1) | `packages/schemas/test/desktop-scene-prefab.test.ts` (+1) | `mapped` |
| CORE-014 | `real` | `packages/schemas/src/input-action-registry.ts` (+1) | `tests/e2e/input-actions-golden.test.ts` (+1) | `mapped` |
| CORE-015 | `real` | `packages/schemas/src/desktop-play-session.ts` (+1) | `tests/e2e/desktop-play-session-golden.test.ts` (+1) | `mapped` |
| CORE-016 | `real` | `packages/schemas/src/desktop-scene-animation.ts` (+1) | `tests/e2e/desktop-animation-golden.test.ts` (+1) | `mapped` |
| CORE-017 | `real` | `packages/schemas/src/desktop-scene-physics.ts` (+1) | `tests/e2e/desktop-physics-golden.test.ts` (+1) | `mapped` |
| CORE-018 | `real` | `packages/schemas/src/desktop-scene-environment.ts` (+2) | `packages/schemas/test/desktop-scene-environment.test.ts` (+2) | `mapped` |

### Desktop

| ID | Class | Live implementation / refusal | Targeted proof | Result |
|---|---|---|---|---|
| DESK-001 | `real` | `packages/schemas/src/editor-shell.ts` (+2) | `apps/desktop-shell/test/control-accounting.test.ts` (+1) | `mapped` |
| DESK-002 | `refuse-only` | `apps/desktop-shell/src/chrome.ts` (+1) | `apps/desktop-shell/test/chrome.test.ts` (+1) | `refuse-only` |
| DESK-003 | `real` | `desktop/linux/src/electron` (+2) | `tests/e2e/desktop-linux-bridge-golden.test.ts` (+1) | `mapped` |
| DESK-004 | `real` | `desktop/linux/src/lib/project-lifecycle.ts` (+1) | `tests/desktop/desktop-project-lifecycle.test.ts` (+1) | `mapped` |
| DESK-005 | `real` | `desktop/linux/src/lib/local-rpc.ts` (+1) | `packages/schemas/test/desktop-local-bridge.test.ts` (+1) | `mapped` |
| DESK-006 | `real` | `desktop/linux/src/electron/provider-key-store.ts` (+2) | `tests/desktop/desktop-byo-secure-storage.test.ts` (+1) | `mapped` |
| DESK-007 | `real` | `desktop/linux/src/lib/web-export.ts` (+1) | `tests/e2e/desktop-web-export-golden.test.ts` | `mapped` |
| DESK-008 | `partial` | `desktop/macos` (+1) | `desktop/macos/test/seam.test.ts` (+2) | `mapped` |
| DESK-009 | `real` | `packages/site-kit/src/editor-shell.ts` (+1) | `tests/e2e/umbrella-editor-viewport-golden.test.ts` (+2) | `mapped` |
| DESK-010 | `partial` | `desktop/linux/src/lib/bridge.ts` (+2) | `tests/e2e/desktop-provider-authoring-engine-golden.test.ts` (+1) | `mapped` |

### Held Keys

| ID | Class | Live implementation / refusal | Targeted proof | Result |
|---|---|---|---|---|
| HOLD-001 | `real` | `packages/cli/src/held-keys` (+1) | `packages/cli/test/held-keys.*.test.ts` (+1) | `mapped` |
| HOLD-002 | `real` | `packages/cli/src/held-keys` (+1) | `packages/cli/test/held-keys.refusal-table.test.ts` | `mapped` |
| HOLD-003 | `real` | `packages/cli/test/held-keys.*.test.ts` | `packages/cli/test/held-keys.regressions.test.ts` | `mapped` |

### Identity Billing

| ID | Class | Live implementation / refusal | Targeted proof | Result |
|---|---|---|---|---|
| IDENT-001 | `real` | `packages/auth` (+3) | `tests/sites/identity-plane-wiring.test.ts` (+1) | `mapped` |
| IDENT-002 | `real` | `packages/auth/src` | `packages/auth/test/identity-port.test.ts` (+1) | `mapped` |
| IDENT-003 | `real` | `sites/umbrella/src/lib/login-flow.ts` (+2) | `tests/sites/umbrella-login-flow.test.ts` (+1) | `mapped` |
| IDENT-004 | `real` | `packages/billing/src/store.ts` (+1) | `packages/billing/test/store-boundary.test.ts` (+2) | `mapped` |
| IDENT-005 | `real` | `packages/billing/src/hosted-ai.ts` (+1) | `tests/e2e/hosted-ai-metering-golden.test.ts` (+1) | `mapped` |
| IDENT-006 | `real` | `packages/billing/src/checkout.ts` (+1) | `packages/billing/test/stripe-checkout.test.ts` (+1) | `mapped` |
| IDENT-007 | `held` | `packages/billing/src/live-mode.ts` (+1) | `packages/billing/test/` (+1) | `mapped` |

### Profiles

| ID | Class | Live implementation / refusal | Targeted proof | Result |
|---|---|---|---|---|
| PROF-001 | `real` | `packages/profile-game` (+2) | `tests/e2e/cli-golden-path.test.ts` (+2) | `mapped` |
| PROF-002 | `real` | `packages/profile-web` (+1) | `tests/e2e/profile-web-golden-path.test.ts` (+1) | `mapped` |
| PROF-003 | `real` | `packages/profile-kids` (+2) | `tests/sites/kids-surface.test.ts` (+2) | `mapped` |
| PROF-004 | `real` | `sites/kids/src` (+1) | `tests/sites/kids-surface.test.ts` (+1) | `mapped` |
| PROF-005 | `real` | `packages/authoring-core/src/model-provider-port.ts` (+1) | `packages/authoring-core/test/model-provider-port.test.ts` (+1) | `mapped` |
| PROF-006 | `partial` | `packages/provider-openrouter` (+1) | `tests/e2e/desktop-provider-host-golden.test.ts` (+1) | `mapped` |

### Release And Authority

| ID | Class | Live implementation / refusal | Targeted proof | Result |
|---|---|---|---|---|
| REL-001 | `real` | `package.json` (+4) | `tests/syntax/check-syntax.test.ts` (+2) | `mapped` |
| REL-002 | `held` | `docs/program/spec-41.md` (+1) | `docs/proof/README.md` (+1) | `mapped` |
| REL-003 | `real` | `docs/bootstrap.md` (+1) | `tests/` (+1) | `mapped` |
| REL-004 | `held` | `docs/production-activation.md` (+1) | `docs/production-activation.md` | `mapped` |
| REL-005 | `real` | `docs/runnable-surfaces.md` (+2) | `packages/cli/test/bin-smoke.test.ts` (+2) | `mapped` |
| REL-006 | `held` | `docs/program/SPEC.md` (+2) | `docs/audits/initiation/Initiation-Audit.md` (+1) | `mapped` |
| REL-007 | `host-blocked` | `docs/module-coverage.md` (+1) | `docs/full-editor-v1-capability-matrix.md` (+1) | `mapped` |

### Runnable Surfaces

| ID | Class | Live implementation / refusal | Targeted proof | Result |
|---|---|---|---|---|
| SURFACE-001 | `real` | `packages/cli/bin/sceneaxi.mjs` | `packages/cli/test/bin-smoke.test.ts` | `mapped` |
| SURFACE-002 | `real` | `apps/desktop-shell/bin/sceneaxi-desktop.mjs` | `apps/desktop-shell/test/bin-smoke.test.ts` (+1) | `mapped` |
| SURFACE-003 | `real` | `apps/web-shell/bin/sceneaxi-web-shell.mjs` | `apps/web-shell/test/bin-smoke.test.ts` (+1) | `mapped` |
| SURFACE-004 | `real` | `desktop/linux` | `tests/e2e/desktop-linux-bridge-golden.test.ts` (+1) | `mapped` |
| SURFACE-005 | `real` | `packages/profile-game` | `tests/e2e/cli-golden-path.test.ts` | `mapped` |
| SURFACE-006 | `real` | `packages/profile-game` (+1) | `tests/e2e/profile-game-scene-golden.test.ts` | `mapped` |
| SURFACE-007 | `real` | `packages/profile-web` | `tests/e2e/profile-web-golden-path.test.ts` | `mapped` |
| SURFACE-008 | `refuse-only` | `packages/profile-kids` | `tests/e2e/profile-kids-refuse-golden.test.ts` | `refuse-only` |
| SURFACE-009 | `real` | `sites/kids` | `tests/sites/kids-surface.test.ts` (+1) | `mapped` |
| SURFACE-010 | `real` | `packages/importers` (+1) | `tests/e2e/asset-pipeline-golden.test.ts` (+2) | `mapped` |
| SURFACE-011 | `real` | `sites/umbrella/src/app/open` | `tests/e2e/umbrella-live-open-golden.test.ts` (+1) | `mapped` |
| SURFACE-012 | `real` | `sites/umbrella/src/app/editor` (+1) | `tests/e2e/umbrella-editor-viewport-golden.test.ts` (+1) | `mapped` |
| SURFACE-013 | `delayed` | `desktop/macos` | `desktop/macos/test/seam.test.ts` (+1) | `mapped` |
| SURFACE-014 | `dormant` | `apps/catalog-game` (+1) | `tests/docs/module-coverage.test.ts` | `mapped` |

### Topology

| ID | Class | Live implementation / refusal | Targeted proof | Result |
|---|---|---|---|---|
| TOPO-001 | `real` | `packages/authoring-core` (+3) | `tests/docs/module-coverage.test.ts` (+1) | `mapped` |
| TOPO-002 | `real` | `docs/dependency-matrix.json` (+1) | `tests/boundary/injected-violations.test.ts` (+1) | `mapped` |
| TOPO-003 | `real` | `docs/program/SPEC.md` (+1) | `tests/docs/module-coverage.test.ts` | `mapped` |
| TOPO-004 | `real` | `packages/schemas` (+1) | `packages/schemas/test/seam.test.ts` (+1) | `mapped` |
| TOPO-005 | `real` | `packages/profile-game/package.json` (+3) | `tests/boundary/` (+1) | `mapped` |
| TOPO-006 | `real` | `package.json` (+2) | `tests/boundary/injected-violations.test.ts` (+1) | `mapped` |
| TOPO-007 | `delayed` | `docs/dependency-matrix.json` (+1) | `tests/docs/module-coverage.test.ts` | `mapped` |
| BOUNDARY-001 | `real` | `@sceneaxi/auth` (+1) | `tests/boundary/` (+1) | `mapped` |
| BOUNDARY-002 | `real` | `@sceneaxi/authoring-core` (+1) | `tests/boundary/` (+1) | `mapped` |
| BOUNDARY-003 | `real` | `@sceneaxi/billing` (+1) | `tests/boundary/` (+1) | `mapped` |
| BOUNDARY-004 | `dormant` | `@sceneaxi/catalog-game` (+1) | `tests/boundary/` (+1) | `mapped` |
| BOUNDARY-005 | `dormant` | `@sceneaxi/catalog-web` (+1) | `tests/boundary/` (+1) | `mapped` |
| BOUNDARY-006 | `real` | `@sceneaxi/cli` (+1) | `tests/boundary/` (+1) | `mapped` |
| BOUNDARY-007 | `real` | `@sceneaxi/desktop-linux` (+1) | `tests/boundary/injected-desktop-violations.test.ts` (+1) | `mapped` |
| BOUNDARY-008 | `partial` | `@sceneaxi/desktop-macos` (+1) | `desktop/macos/test/seam.test.ts` (+1) | `mapped` |
| BOUNDARY-009 | `real` | `@sceneaxi/desktop-shell` (+1) | `apps/desktop-shell/test/seam.test.ts` (+1) | `mapped` |
| BOUNDARY-010 | `partial` | `@sceneaxi/desktop-windows` (+1) | `tests/e2e/desktop-project-build-golden.test.ts` (+1) | `mapped` |
| BOUNDARY-011 | `real` | `@sceneaxi/engine-kernel` (+1) | `packages/engine-kernel/test/browser-open-play.test.ts` (+1) | `mapped` |
| BOUNDARY-012 | `real` | `@sceneaxi/engine-orchestrator` (+1) | `packages/engine-orchestrator/test/golden-path-orchestrated.test.ts` (+1) | `mapped` |
| BOUNDARY-013 | `real` | `@sceneaxi/engine-presentation` (+1) | `packages/engine-presentation/test/seam.test.ts` (+1) | `mapped` |
| BOUNDARY-014 | `real` | `@sceneaxi/importers` (+1) | `tests/e2e/asset-ingestion-golden.test.ts` (+1) | `mapped` |
| BOUNDARY-015 | `real` | `@sceneaxi/plugin-host` (+1) | `tests/e2e/plugin-capability-golden.test.ts` (+1) | `mapped` |
| BOUNDARY-016 | `real` | `@sceneaxi/profile-game` (+1) | `packages/profile-game/test/seam.test.ts` (+1) | `mapped` |
| BOUNDARY-017 | `real` | `@sceneaxi/profile-kids` (+1) | `tests/boundary/injected-site-violations.test.ts` (+1) | `mapped` |
| BOUNDARY-018 | `real` | `@sceneaxi/profile-web` (+1) | `packages/profile-web/test/seam.test.ts` (+1) | `mapped` |
| BOUNDARY-019 | `partial` | `@sceneaxi/provider-openrouter` (+1) | `packages/provider-openrouter/test/adapter.test.ts` (+1) | `mapped` |
| BOUNDARY-020 | `real` | `@sceneaxi/schemas` (+1) | `packages/schemas/test/seam.test.ts` (+1) | `mapped` |
| BOUNDARY-021 | `real` | `@sceneaxi/site-catalog-game` (+1) | `tests/sites/catalog-storefronts.test.ts` (+1) | `mapped` |
| BOUNDARY-022 | `real` | `@sceneaxi/site-catalog-web` (+1) | `tests/sites/catalog-storefronts.test.ts` (+1) | `mapped` |
| BOUNDARY-023 | `real` | `@sceneaxi/site-kids` (+1) | `tests/sites/kids-surface.test.ts` (+1) | `mapped` |
| BOUNDARY-024 | `real` | `@sceneaxi/site-kit` (+1) | `packages/site-kit/test/seam.test.ts` (+1) | `mapped` |
| BOUNDARY-025 | `real` | `@sceneaxi/site-umbrella` (+1) | `tests/sites/identity-plane-wiring.test.ts` (+1) | `mapped` |
| BOUNDARY-026 | `real` | `@sceneaxi/web-shell` (+1) | `apps/web-shell/test/assistant-panel.test.ts` (+1) | `mapped` |

## How to consume this map

- Use [`requirements.json`](requirements.json) as the complete machine-readable requirement and live-reference declaration.
- Use [[Module-Coverage]] for package implementation/evidence status and [[Full-Editor-v1-Capability-Matrix]] for control and capability accounting.
- Use the future [[Gap-Register]] for verified implementation gaps; `AUTH-007` is the only current requirement-level gap in this map.
- Treat the `liveInventory.documentedClaims` list as reconciliation input, not new authority.
- Never promote a held, delayed, dormant, or host-blocked row into implementation work without the exact separate authority named by its owner.
