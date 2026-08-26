---
type: report
title: SceneAxi Initiation Gap Register
created: 2026-08-26
tags:
  - sceneaxi
  - gaps
  - implementation
related:
  - '[[Initiation-Audit]]'
  - '[[Requirements-Traceability]]'
  - '[[Module-Coverage]]'
  - '[[Full-Editor-v1-Capability-Matrix]]'
---

# SceneAxi Initiation Gap Register

This register turns the verified findings in [[Initiation-Audit]] into a
prioritized implementation and reconciliation queue. Each row has an
authoritative owner, exact evidence anchors, a concrete impact, an estimated
size, fix risk, confidence, dependencies, and a current status. The register
is an audit handoff: it grants no captain authority for proof, publication,
spend, Kids launch, marketplace activation, or live-mode work.

The stable requirement IDs refer to [`requirements.json`](requirements.json).
Audit finding IDs are stable register IDs and are not new product authority.
`open` means a verified defect or undelivered behavior needs code, checker, or
workflow work. `partial` means bounded code exists but the stated integrity or
coverage claim is incomplete. `direction-only` means the mismatch is verified,
but the owning contract or product authority must define the implementation
before it becomes an actionable defect ticket. `documentation-drift` means the
live behavior is accounted for but the owner prose is stale; it does not
require a runtime change. `resolved` means the documentation disposition is
already corrected and is retained only to prevent rediscovery.

## Prioritized verified gaps

The order follows the dependency rule from [[Initiation-Audit]]: verification
foundations first, then shared authoring/schema integrity, then public request
boundaries, followed by operational and product-direction work. `P0` is a
security or verification blind spot, `P1` is a correctness or release-boundary
gap, and `P2` is a documentation or operational reconciliation item.

| Priority | Stable gap ID | Requirement IDs | Category | Owner and evidence anchors | Concrete impact | Effort | Fix risk | Confidence | Owning phase | Dependencies | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0 | `AUDIT-CONTRACT-REGRESSION-DISCOVERY` | `REL-001` | Verification foundation | Owner: `scripts/check-contracts.test.mjs:105-490`; omission: `vitest.config.ts:75-82`, `package.json:20-23` | Authoring-job, hostile-key, plugin-registry, and inert-example process regressions are not in `pnpm test` or `pnpm gate`. | S | Low | High | Phase 02 | None | `open` |
| P0 | `AUDIT-AUTHORING-ROOT-ESCAPE` | `AUTH-002`, `CORE-010` | Authoring security/integrity | Owner: `packages/authoring-core/src/propose-apply.ts:95-97`; consumers: `:250-252`, `:363-365`, `:650-653`, `:787-790`; existing containment contrast: `:1097-1127`; proof gap: `packages/authoring-core/test/transaction-history.test.ts:40-77` | Absolute, traversal, or outside-resolving symlink document paths can reach proposal journals and atomic rewrites outside the authoritative project root. | M | High | High | Phase 03 | Close the verification-foundation items before changing the shared authoring path. | `open` |
| P0 | `AUDIT-PACKAGE-CATALOG-SHAPE` | `TOPO-004`, `DESK-003` | Privileged input validation | Owner: `packages/schemas/src/desktop-scene-package.ts:73-80`; consumers: `desktop/linux/src/lib/desktop-scene.ts:1899-1941`, `desktop/linux/src/lib/bridge.ts:3170-3212`; proof gap: `packages/schemas/test/desktop-scene-package.test.ts:1-92` | A malformed project-controlled catalog can throw through the privileged bridge instead of returning `PACKAGE_CATALOG_INVALID`. | M | Medium | High | Phase 03 | None; keep the refusal name and validate the nested lock before consumers iterate it. | `open` |
| P1 | `AUDIT-GOLDEN-COMMAND-OMISSIONS` | `REL-001`, `REL-005` | Verification foundation | Owner: `package.json:17`; live declaration: `docs/audits/initiation/requirements.json:7670-7710`; claim owner: `docs/runnable-surfaces.md:56-61` | The dedicated `test:golden` command omits `contained-git-golden`, `desktop-assistant-scene-loop-golden`, `full-editor-transactions-golden`, and `hosted-ai-metering-golden`, while the runnable claim implies dedicated coverage. | S | Low | High | Phase 02 | None. | `open` |
| P1 | `AUDIT-CI-TIMEOUT-BOUND` | `REL-001` | Verification operations | Owners: `.github/workflows/gate.yml:9-31`, `.github/workflows/desktop-linux.yml:10-68`, `.github/workflows/desktop-macos.yml:18-94`, `.github/workflows/engine-sdk.yml:9-59` | Install, gate, packaging, smoke, provider, and archive jobs have no repository-owned wall-clock bound and can consume runner resources indefinitely. | S | Low | High | Phase 03 | None; preserve existing job steps and failure semantics. | `open` |
| P1 | `AUDIT-PACKAGE-METADATA-INTEGRITY` | `TOPO-004`, `DESK-003` | Direction-only package integrity clarification | Owner: `packages/schemas/src/desktop-scene-package.ts:83-131`; IPC crossing: `desktop/linux/src/lib/bridge.ts:3176-3184`; capability owner: `docs/full-editor-v1-capability-matrix.md:177` | Renderer/request metadata is accepted without binding its digest to inspected bytes; malformed capability values are discarded and non-empty `pluginVersion` is accepted without stronger package identity. This is not a proven execution bypass: discovery remains metadata-only with `executed: false`. | L | High | Medium | Phase 03 | Validate catalog shape first; then define the byte-inspection/trust owner and version/capability policy without changing the `executed: false`, `networking: false`, and `marketplace: false` guarantees. | `direction-only` |
| P1 | `AUDIT-CHECKOUT-BODY-ORDER` | `IDENT-001`, `IDENT-006` | Web request boundary | Owner: `sites/umbrella/src/app/api/checkout/route.ts:26-35`; origin check occurs at `:50-53`; comparable caught parser: `sites/umbrella/src/app/api/editor/catalog-intake/route.ts:44-60` | An untrusted-origin request is parsed and enumerated before fail-closed origin/configuration checks; malformed multipart input can escape without a named 400 response. | S | Medium | High | Phase 05 | Define the public request-boundary policy before adding application-owned limits; preserve documented billing-plane refusal precedence. | `open` |
| P1 | `AUDIT-WEB-BODY-BOUND` | `IDENT-006`, `CAT-002`, `IDENT-001` | Web resource boundary | Owner: `sites/umbrella/src/app/api/stripe/webhook/route.ts:31-35`; `sites/umbrella/src/app/api/editor/catalog-intake/route.ts:44-66`; partiality recorded in `Initiation-Audit.md:192` | `request.text()` and `formData()` materialize attacker-controlled bodies without an application-owned byte/count ceiling; host limits may currently bound deployment behavior but are not a portable invariant. | M | Medium | High | Phase 05 | Close origin screening/order first, then share explicit byte and field limits across public request paths. | `partial` |
| P2 | `AUDIT-TOOLS-COUNT-DRIFT` | `DESK-001` | Documentation drift | Owner: `docs/full-editor-v1-capability-matrix.md:45-53`; historical mismatch: `Initiation-Audit.md:193`; live registry: `packages/schemas/src/desktop-local-bridge.ts` | The capability matrix's audited 61-tool claim no longer matched the live 67-tool registry, making the owner document misleading for review and handoff. The owner now records 67 and retains the earlier observation. | S | Low | High | Phase 02 | None; reconciliation completed 2026-08-26. | `resolved` |
| P2 | `AUDIT-SCANNER-TEST-CLASSIFICATION` | `REL-001` | Documentation drift | Owner: `docs/audits/initiation/Initiation-Audit.md:170-171,194`; evidence: `tests/docs/module-coverage.test.ts:1-82`, `tests/docs/capability-matrix-audit.test.ts:1-108` | The audit taxonomy needed to distinguish direct-call unit regressions from process-level checker regressions; leaving the old label would overstate the evidence boundary. | S | Low | High | Phase 02 | None; wording is already corrected, so this row is a reconciliation record rather than new runtime work. | `resolved` |
| P2 | `AUTH-007` | `AUTH-007`, `AUTH-003` | Direction-only authoring product gap | Owner: `docs/runnable-surfaces.md:121-123`; refusal implementation: `packages/cli/src/project-lifecycle.ts:191-240`; proof: `packages/cli/test/project-lifecycle.test.ts:166-209`, `tests/e2e/cli-golden-path.test.ts:86-347` | The E1 one-shot `project dev` path exists, but the specified hot-reload/watch loop remains absent and therefore cannot be claimed runnable. | L | High | High | Phase 03 | Authoritative-root containment and explicit watcher lifecycle, cancellation, recovery, coalescing, backpressure, and evidence semantics; no silent watcher implementation from this register. | `direction-only` |

## Dependency order for later phases

1. **Phase 02 — verification and reconciliation:** wire the orphaned
   `scripts/check-contracts.test.mjs` regressions and add the four omitted
   golden entries. The 61-versus-67 tool count is reconciled in the canonical
   capability matrix; retain the corrected scanner-test taxonomy and this
   resolved count-drift row as documentation records. These changes make later
   gap closure observable without weakening the gate.
2. **Phase 03 — shared core and workflow integrity:** close authoring-root
   containment and malformed catalog validation, then decide the package
   metadata-to-bytes binding. Add bounded CI job durations without changing
   install, build, packaging, smoke, signing, or artifact semantics. Keep
   `AUTH-007` after these foundations and implement it only with explicit
   lifecycle and backpressure behavior owned by the authoring contract.
3. **Phase 05 — clients and external request boundaries:** screen checkout
   origin before reading attacker-controlled form data, return the named
   malformed-body refusal, then apply application-owned byte and field limits
   to checkout, webhook, and catalog-intake paths.

No row is closable by prose. A row may move to `closed` only after its code,
refusal, or canonical owner is updated and executable evidence proves the
observable behavior; the matching requirement and traceability declaration
must then be rechecked.

## Considered and rejected candidates

These items were reviewed but are not verified implementation gaps and are
kept separate so later runs do not rediscover them as work:

- **Stage 1/6 proof, Kids launch, marketplace activation, package publication,
  license selection, Stripe LIVE, and unsigned platform releases:** rejected as
  gap rows because their owner records require separate authority or evidence.
  They remain `held`, `delayed`, `dormant`, or `host-blocked` in
  [[Requirements-Traceability]].
- **Treating the package metadata finding as code execution:** rejected because
  the catalog and discovery contract explicitly records `executed: false`,
  `networking: false`, and `marketplace: false`; the remaining issue is
  integrity binding, not an execution bypass.
- **Using host-provided request limits as closure for `AUDIT-WEB-BODY-BOUND`:**
  rejected because a host change would remove the invariant. The item remains a
  `partial` application-owned boundary until explicit limits exist.
- **Counting the four Linux-injected BYOK controls as shell controls:**
  rejected because the canonical capability owner deliberately separates 112
  shell controls from four packaged-window injections; changing the count would
  create a new accounting contradiction.
- **Implementing `AUTH-007` with an arbitrary filesystem watcher or background
  scheduler:** rejected as a remediation direction. The gap remains open until
  the authoring owner defines lifecycle, restart, cancellation, and backpressure
  semantics; this register does not authorize a broader product loop.

## Resolved during this audit

`AUDIT-SCANNER-TEST-CLASSIFICATION` is not an actionable gap at this checkout.
The current audit wording at `Initiation-Audit.md:170-171,192` correctly calls
`tests/docs/module-coverage.test.ts` and
`tests/docs/capability-matrix-audit.test.ts` direct-call unit regressions rather
than process-level tests. It remains here as a resolved audit-history note so
the former classification is not rediscovered as implementation work.

All 10 actionable, partial, documentation-drift, or direction-only findings
have evidence paths and anchors, a named owner, a priority, and a
phase/dependency disposition.
Together with the one resolved scanner-taxonomy history row, the register has
11 total rows and no evidence-free gap is carried forward.
