# Contract dependencies — parallelism sidecar

Run: `orun-3-09og` / `sceneaxi-repair-review-findings`. Status: **PROPOSAL, not approved, delivered, acknowledged, dispatched or verified**. This scout inspected source and existing assignments only; it started no implementation child and executed no build, test, browser, install or publication command. Only this report pair is owned. Coordinator owns sidecar FINAL aggregation; original `integrate` owns shared source and serial acceptance.

## Evidence and ownership

Actual source root: `/home/devuser/Documents/Projects/sceneaxi`; graph: `/home/devuser/Documents/SceneAxi/.empryo/orchestrations/sceneaxi-repair-review-findings.json`. Graph has eight Sol6.1 repair branches, then `integrate`, Astra `independent-review` / `local-judge`, serial `publish`, Astra artifact CI verification/judge. Assignment documents say READY FOR DISPATCH; that does not prove execution. `link list` exposed no reachable background endpoints; active-owner acknowledgement is missing, not proof owners are absent. Do not dispatch replacement writers.

Authoritative current ownership is `repair-review-2026-10-02/assignments.json` and its lane documents, not older swarm findings. In particular **DB migrations now belong to repair-billing**, unlike the earlier integration reservation. All manifests/locks/workflows belong to repair-security-delivery even inside another lane. Shared schemas/index/root tests/config/exports/owning docs belong to integrate. Site-kit shared changes must be submitted to integrate, never assumed granted by a consumer's task ID. An out-of-lane target is a dependency, not a second write grant.

Observed source anchors:
- `docs/dependency-matrix.json:6-25,75-84,130-155,157-172`: schemas has no internal dependencies; physics/kernel depend on schemas; importers on schemas+authoring; site-kit on schemas+authoring, NOT auth/billing; umbrella auth/billing imports are restricted to identity-plane and provider-adapters; catalogs only site-kit; Kids origin has no SceneAxi edge.
- `packages/schemas/src/index.ts:62-71,294-302,1156-1168,1331`: public JSON guards/types, physics catalog types and Gameplay types. One barrel owner; disjoint export sections do not confer independent file ownership.
- Supplied `packages/schemas/src/json.ts` was not found by exact file read. Actual JSON contract is `document.ts:13-19,51-66`, public via index. Do not create a new dialect/path to evade existing ownership. Genome definition/references worked for PhysicsWorldHost/ScenePhysicsCatalog; exact source reads corroborated references.
- `desktop-scene-physics.ts:10,42-47,72-80,114-134`: schema v1 currently names colliders/colliderId; parser checks only object world then dereferences world.engine, permitting world:null to throw by inspection. `physics-world-host.ts:6,24-36` consumes that catalog; toy accesses colliders. `packages/physics-rapier/src/world.ts:11,23-26,64-70` imports public catalog and rejects absent colliders. This is a shared representation barrier, not three independent fixes.
- `provider-adapters.ts:65-67,98-119`: SqlValue includes Date/bigint/undefined/readonly arrays; SqlRow is a recursive value map; NeonDatabase returns readonly row arrays and optional atomic transaction. These are deployment SQL shapes, not JsonValue.
- `site-kit/src/ports.ts:36-43,140-161` exposes web-shell/desktop-shell/site/kids surfaces and billing ports. `purchase-history.ts:5-22,32-50` adds a separate read port but runtime accepts site/cli/desktop. That disagrees with its SiteSurface type: web-shell/desktop-shell are rejected; cli/desktop cannot normally be passed as typed SiteSurface. Compatibility decision/oracle required before shell history acceptance.
- `identity-plane.ts:857,1419-1440` currently wires **plane.purchaseHistory.read**, verifies carried session, invokes billing readPurchaseHistory. `account/page.tsx:64-74` currently uses that facade. Earlier reports of absent facade/account history are stale for this source observation; no execution correctness claimed.
- `importers/src/index.ts:5-18,63-69,167-168,258-267`: public text input plus targetDocumentPath/cwd; propose/apply reuse authoring service. `:111-115,183-205` already bounds 8MiB/depth64/250000values. Type compatibility alone does not prove hostile runtime input safety.

Dated compile evidence: `deep-review-2026-10-02/02-build-tests.md:21-31` records root exit1 at desktop-scene.ts:297 unknown→JsonValue, asset-pipeline golden162, Kids fixture214 unknown→KidsActivityInput, provider fixture SqlValue/SqlRow/ProviderFetch failures, plus catalog readonly query mismatch. Its :25 explicitly says gate NOT RUN. No fresh compiler run was performed by this scout. `08-FINAL.md:75` independently records v1 shapes→colliders compatibility and world:null failures. These receipts are historical diagnostics, not certification of current worktree or published PR312 head.

## Dependency DAG and critical paths

Edges below mean acceptance prerequisites; reverse matrix allow-list entries into dependency→consumer edges, never authorize a new import.

```text
CP-0 owner acknowledgement + frozen source/contract fingerprint
  ├─ CP-J JSON contract decision/oracle [integrate]
  │    └─ CP-I importer input oracle [authoring-assets]
  │         └─ CP-D desktop/CLI input acceptance [desktop-cli]
  ├─ CP-P physics v1 normalize/version decision [integrate]
  │    └─ CP-P-O compatibility oracle [integrate/root tests]
  │         └─ CP-R toy/Rapier evaluate-save-reload [engine-physics]
  │              └─ CP-D physics desktop acceptance [desktop-cli]
  ├─ CP-S SQL/response row contract [billing]
  │    └─ CP-S-O provider codec+transaction oracle [billing + integrate fixtures]
  │         └─ CP-H site-kit history/surface projection [integrate]
  │              └─ CP-H-O history compatibility oracle [integrate]
  │                   └─ CP-A identity facade [identity-provider]
  │                        └─ CP-U account/catalog consumer acceptance [billing/sites]
  └─ CP-G gameplay/asset public exports only if change requested [integrate]
       └─ CP-G-O backward public declaration/serialization oracle
            └─ engine/presentation/importer downstream acceptance
all original lead handbacks → integrate serial root/site builds+gate
 → independent-review → local-judge → publish (only original authority)
 → exact-current-PR CI verification → ci-judge
```

Longest dependency chains by barrier count are SQL→history→identity→UI and physics→Rapier→desktop; **no measured wall-clock critical path** is available. CP-J/CP-P/CP-H/CP-G serialize under the same integrate file-owner even where DAG branches look parallel. CP-S is one provider-adapters file and cannot be split into identity/ledger/hosted writers. No downstream DONE until its predecessor compatibility receipt and exact source hash are attached.

## Contract handoff packets (all proposed)

Every command below runs at the actual app root and is **not executed here**. Focused suites need lead acknowledgement and scheduler resource clearance; full builds/site checks/gate remain integrate-only, one heavyweight process at a time. Task IDs are original assignment IDs; CP-* identifiers are sidecar scheduling labels, not new ledger replacements.

### CP-J / CP-I — JSON and importer input
- Tasks: `06-01`, `06-03`; use original ledger attribution before routing detailed subrows. Owners: integrate for `packages/schemas/src/document.ts`, `packages/schemas/src/index.ts`; authoring-assets for `packages/importers/src/index.ts`, `packages/importers/src/contained-gltf.ts` and its existing tests. Symbols: JsonValue/isJsonValue/isJsonObject, SceneDocumentImportInput/proposeSceneDocumentImport/applySceneDocumentImport.
- Predecessors: CP-0; any shared semantic change CP-J→shared guard oracle→CP-I. If public shape/guard remains unchanged, existing importer/desktop boundary narrowing can proceed without waiting for a speculative schema rewrite. Keep undefined omission deliberate; unknown must be validated rather than cast to JsonValue.
- Commands: `pnpm exec vitest run packages/importers/test/document-import.test.ts packages/importers/test/contained-gltf.test.ts`; integrate then `pnpm -s build` after source handback. Acceptance: old valid JSON/document inputs still propose/apply; readonly arrays accepted; duplicate members/depth/byte/count overflow/cycles/accessors/nonfinite values refuse without stack overflow or evaluating getters; target authority stays local. Existing suites are necessary, not proof each new oracle exists.
- Exclusion: no importer child edits authoring-core, schemas, root fixture or desktop. Handback: changed exact files/hashes/public declarations, fail-before/pass-after assertion names and cleanup to authoring-assets lead; shared requests to integrate.

### CP-P / CP-R — physics compatibility
- Tasks: `06-02`, `DEEP-08-ADDITIONAL-1`, `LOCAL-PROOF-063`. Owners: integrate for `packages/schemas/src/desktop-scene-physics.ts`, `physics-world-host.ts`, `index.ts`; engine-physics for `packages/physics-rapier/src/world.ts`, `index.ts`, existing package tests; desktop-cli for `desktop/linux/src/lib/desktop-scene.ts`.
- Symbols: ScenePhysicsCatalog/ScenePhysicsCollider/ScenePhysicsMutation, parseScenePhysicsCatalog/applyScenePhysicsMutation, PhysicsWorldHost/createToyPhysicsWorldHost, RapierWorldSave. Predecessors: CP-0→CP-P decision→CP-P-O old/new fixture oracle→CP-R→desktop physics acceptance. Prefer normalize legacy shapes/shapeId into canonical colliders/colliderId with ambiguity refusal, or explicit version+migration; no silent same-version rename.
- Commands: `pnpm exec vitest run packages/physics-rapier/test/seam.test.ts packages/physics-rapier/test/production-hardening.test.ts tests/e2e/desktop-physics-golden.test.ts` (root golden scheduled by integrate). Acceptance: old v1 toy and Rapier fixtures evaluate/save/reload, supported engines/default unchanged; null world, malformed arrays, ambiguous aliases and unsupported versions yield named refusal, never throw or mutate authoring bytes. Oracle before downstream acceptance; no claimed execution.
- Exclusion: do not duplicate kernel/Rapier/desktop/schema writers or add physics matrix edges. Handback: schema representation policy, migration/digest effect and old/new fixture receipts first from integrate; package adapter receipt then engine lead→desktop lead→integrate.

### CP-S — SQL row and hosted response contracts
- Tasks: `05-002`, `05-003`, `05-004`, `05-005`, `DEEP-08-ADDITIONAL-3`. Owner repair-billing alone: `sites/umbrella/src/lib/provider-adapters.ts`, `sites/umbrella/test/provider-adapters.integration.test.ts`, `db/migrations/0008_credit_chain_hosted_budget.sql`; root `tests/sites/provider-adapters.test.ts` remains integrate. Symbols SqlValue/SqlRow/SqlStatement/NeonDatabase; hosted response persistence and diagnostic paths.
- Predecessors: CP-0→billing codec/row decision→CP-S-O; any schema/refusal public change additionally waits for integrate's schema/index receipt. SQL scalars are intentionally broader than JSON; decode/normalize at the boundary, do not widen JsonValue to Date/Map/bigint or weaken readonly rows. Keep optional transaction refusal when absent.
- Commands: `pnpm --dir sites/umbrella test:provider`; `pnpm --dir sites/umbrella test:integration` only under the serial DB/verification slot; integrate `pnpm exec vitest run tests/sites/provider-adapters.test.ts` after typed fixture handback. Acceptance: readonly row fixtures compile; timestamp/numeric/array/JSON behavior explicit; Map/cycle/getter/nonfinite malformed response does not silently persist {}; hostile capability formatting cannot throw; two ledger legs+share commit/replay/rollback invariant preserved. Date versus JSON policy recorded, not assumed.
- Exclusion: identity cannot edit provider-adapters despite using its auth adapters; DB ownership follows current billing assignment, not historical reservation. Handback: SQL types/query shape/source hash/positive+negative codecs and transaction receipts billing→identity/integrate.

### CP-H / CP-A / CP-U — purchase history projection and facade
- Tasks: `LOCAL-PROOF-031`, `05-003` in billing; `IDENTITY-01` and `REQ-PROOF-IDENT-004` are coordination-only dependencies, not new write grants. Owners: integrate for `packages/site-kit/src/ports.ts`, `purchase-history.ts`, `index.ts`, `refusals.ts`; identity-provider for `identity-plane.ts`, `request-authority.ts`; billing for `account/page.tsx`, billing read APIs and provider adapters. Symbols SiteSurface/SiteBillingPort/SitePurchaseHistoryRequest/SitePurchaseHistoryPort/createSitePurchaseHistoryPort; readPurchaseHistory; plane.purchaseHistory.read.
- Predecessors: CP-0 + CP-S-O + billing read API receipt→CP-H projection/surface decision→CP-H-O→CP-A facade acceptance→CP-U account acceptance. Existing named facade is **purchaseHistory.read**, not speculative billing.history. Already-implemented consumers can be reviewed on existing contracts now; changing the port is still serial.
- Commands: integrate `pnpm exec vitest run tests/sites/identity-plane-wiring.test.ts tests/sites/provider-adapters.test.ts`; billing `pnpm --dir sites/umbrella test:provider`; integrate `pnpm --dir sites/umbrella exec tsc --noEmit --incremental false`. Acceptance: intended supported surfaces consistent in runtime and TS; Kids refused before adapter; signed-out/expired/disabled/principal isolation; no request userId; bounded 1..50 cursor pages, deterministic ordering/no duplicates and strict output projection; unavailable/malformed adapters named-refuse; raw DB/provider fields or credentials never reach UI. Compatibility fixture covers current old port clients as well as new history reader.
- Exclusion: site-kit must not import auth/billing; pages must not import them or provider-adapters directly. Catalog uses site-kit only. Shared index export is integrate-only. Handback: site-kit surface/projection/refusal/declaration oracle→identity facade receipt→billing account current render receipt→integrate; receiving owners must acknowledge hashes before acceptance.

### CP-G — gameplay/render public vocabulary, only if changes are requested
- Tasks: `ENG-004`, `ENG-009`, `LOCAL-PROOF-066`, `LOCAL-PROOF-067`, `LOCAL-PROOF-068`. Owner integrate for `packages/schemas/src/index.ts`, `kernel-session.ts`, `asset-render-mesh.ts`, `gltf-animation.ts`; engine-physics owns kernel/presentation source barrels, authoring-assets owns importer barrel. Symbols GameplayActionCommand/GameplayDefinition/KernelCommand, AssetRenderMesh/GltfAnimationEvaluation and public Three presentation return types.
- Predecessors: CP-0 + precise owner-requested schema delta→CP-G-O backward declaration/serialization oracle→consumer acceptance. Existing `index.ts:1331` exports shared gameplay types, so do not recreate a kernel-only command union. Renderer hardening inside the existing numeric/opaque seam can proceed now without a schema rewrite.
- Commands: `pnpm exec vitest run packages/engine-kernel/test/gameplay.test.ts packages/engine-presentation/test/declaration-consumer.test.ts packages/engine-presentation/test/completion.test.ts`; integrate `pnpm check:boundaries && pnpm check:contracts` after import/export changes. Acceptance: public consumers compile unchanged for supported old inputs; major mismatch policy explicit; no Three/DOM/Node type leak; old save/replay digests preserved or explicitly versioned; only advance mutates. Handback: declaration diff and compatibility receipt integrate→engine/authoring→integrate. Do not split this schema index among feature children.

## Safe work now / proposed one-level read-only packets

No new writer grant is issued. Leads may continue already-owned implementations using frozen contracts, while new read-only packet work starts only after acknowledgement, exclusivity and Astra allocation approval. Packet output is parent-handback, not source files; parent cannot overwrite child-owned reports before explicit release. No grandchildren. Sol6.1 planners; Astra independently approves/judges. Five-minute/ten-command bounds; no heavy tests in these scouts.

|Original lead|Proposed read-only task / exact paths / symbols / original IDs|Prerequisite and acceptance / parent handback|
|---|---|---|
|repair-authoring-assets|RO-I: `packages/importers/src/index.ts`, `contained-gltf.ts`, `packages/authoring-core/src/propose-apply.ts`; input/propose/apply; 06-01,06-03|Confirm current lead child allocation; source-only old-call/hostile-input oracle inventory, no edits or tests; return path/line/API/hash list to lead.|
|repair-engine-physics|RO-P: `packages/physics-rapier/src/world.ts`, `packages/schemas/src/desktop-scene-physics.ts`, `physics-world-host.ts`; catalog/create/save; 06-02,DEEP-08-ADDITIONAL-1|Read legacy/current representation policy; list toy/Rapier predecessor fixtures and exact named-refusal assertions; return integrate request via lead, not a schema patch.|
|repair-billing|RO-S: `sites/umbrella/src/lib/provider-adapters.ts`, `sites/umbrella/test/provider-adapters.integration.test.ts`; SqlRow/NeonDatabase;05-002..005|No second adapter writer; enumerate Date/bigint/readonly/codec/transaction expectations and shared fixture deltas; handback billing lead.|
|repair-identity-provider|RO-A: `identity-plane.ts`, `request-authority.ts`, site-kit `purchase-history.ts`, `ports.ts`; purchaseHistory.read/SiteSurface;IDENTITY-01|CP-S shape receipt needed for acceptance, not source reading; return facade↔port mismatch/negative tests to lead; never edit billing adapter.|
|repair-sites-accessibility|RO-U: `sites/catalog-game/src/app/page.tsx`, `sites/catalog-web/src/app/page.tsx`; readonly search query helpers;03-visual finding mapping must use ledger|Existing contracts allow readonly-helper/UI review now; return exact helper inputs and undefined/scalar/array oracle to lead, task-ID mapping unconfirmed so no dispatch yet.|
|repair-desktop-cli|RO-D: `desktop/linux/src/lib/desktop-scene.ts`, `packages/cli/src/index.ts`, importer public index; JSON/import/physics calls;06-01,06-02 dependencies|Consumer boundary narrowing on existing schema may proceed only inside current ownership; read-only scout returns callsite/type map; physics downstream acceptance waits CP-P-O/CP-R.|
|repair-security-delivery|RO-E: `docs/dependency-matrix.json`, `packages/schemas/src/index.ts`, `scripts/check-boundaries.mjs`; export/import closure;original publication/deletion task mapping via ledger|No manifest/matrix edits by scout; return export closure and complete intended-artifact checklist, no old local green transfer.|
|repair-missing-capabilities|RO-X: `docs/audits/production-swarm/repair-review-2026-10-02/assignments.json`, `ledger.json` plus source anchors above;LOCAL-PROOF-063/066/067/068/069|Coordinate prerequisite gaps only; no foreign implementation; return owner-directed contract requests with IDs and acceptance, avoid duplicate feature writer.|

Proposed RO-U/RO-E lack confirmed ledger row IDs and must remain blocked pending exact parent mapping; labels are not fabricated replacement IDs. Read-only packets overlapping files can be researched independently only if genuinely new questions; duplicate oracle/extraction requests should be collapsed by coordinator. Source implementation splitting requires parent acknowledgement/exclusive child file set and explicit handback, not this proposal.

## Serial barriers and scheduling truth

Observed: this scout performed read-only contract analysis; no actual original-lead concurrency measurement and zero children dispatched by this scout. Planned: eight original leads remain authoritative, their nonoverlapping current-contract work need not wait for sidecar completion. Shared contract patches serialize at integrate; provider-adapters at billing; desktop-scene at desktop-cli. Code research can fan out, but supplied 12 logical CPUs / 5233MiB available / 49523MiB swap-used is not permission for simultaneous heavyweight checks. No resource remeasurement here. Root/site build, DB suites, browser/GPU, native/package checks are one-at-a-time under original serial owner. Source hashes must be re-captured on acknowledged handoff because the dirty tree is live.

Gates missing: actual endpoint/owner acknowledgement, exclusivity of proposed research versus existing children, Astra allocation approval, precise RO-U/RO-E ledger mapping, legacy physics representation policy+compatibility receipt, SQL codec/type receipt+root fixture acceptance, history surface/projection compatibility receipt, shared export handback and serial candidate verification. Historical PR failure/local green cannot certify a later published head. No approval/delivery/queued implementation/dispatch or test result has been fabricated.
