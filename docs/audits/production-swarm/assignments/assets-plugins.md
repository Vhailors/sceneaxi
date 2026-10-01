# Builder assignment — assets-plugins

Graph `sceneaxi-production-swarm`; role `code`; real root/cwd `/home/devuser/Documents/Projects/sceneaxi`. Read-only audit input `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json` and its MD; full source findings are preserved in MEGALIST.json.

## Exclusive exact source/test path ownership

Only the following existing/new exact paths are claimed by this lane. Existing owning docs/README, manifests/locks/config, schemas/site-kit, tests/*, scripts/*, workflows and SQL migrations are **RESERVED integration after all builders**. No adjacent-file ownership is implied; request any additional exact path before editing.
- `/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/contained-gltf.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/document-import.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/fixtures/source.sceneaxi.json`
- `/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/fixtures/unsupported-schema.sceneaxi.json`
- `/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/seam.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/host-api-range.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/host.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/isolation.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/pipeline.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/types.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/test/load-refuse.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/test/refuse-matrix.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/test/seam.test.ts`

## Full assigned scope / measurable acceptance

Historical backlog IDs: [48, 49, 50, 75]. Authority requirement IDs: ['CORE-008', 'CAT-001', 'CAT-002', 'CAT-003', 'CAT-004'].

### AP-01: implementation-needed / P0
glTF flat deep node graph exhausts recursive traversal stack
- Chosen solution: Iterative deterministic traversal preserving cycle/multi-parent refusal, plus explicit node/depth/operation bounds and named existing refusal. No new format.
- Acceptance: ["Deep chain/cycle/multi-parent public stage/propose/spawned CLI refuse without throw or writes; valid controls retain output/digests."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": 1227, "symbol": "parseGltf.visit"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": 1366, "symbol": "visit child recursion"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/contained-gltf.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
- Dependencies: ["shared documentation owner for graph/resource limits", "CLI/desktop acceptance owners"]
- Evidence/reproduction: {"reproduction": "Use admitted embedded-buffer3-vertex triangle. nodes=Array.from({length:2500},(_,i)=>i===2499?{mesh:0}:{children:[i+1]}); scenes=[{nodes:[0]}]. Call stageContainedGltfAssetImport with valid request then actual sceneaxi asset import --json.", "refutationAttempt": "100-node chain parses. JSON itself is shallow and input far below8MiB, so JSON-depth64/byte limits do not address graph recursion.", "actualImpact": "Public stage throws RangeError; real CLI returns INTERNAL exit1 rather than named validation refusal; synchronous desktop host can be interrupted by a small selected file.", "classification": "confirmed-local-defect", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
- Commands: ["pnpm exec vitest run packages/importers/test/contained-gltf.test.ts tests/e2e/asset-ingestion-golden.test.ts && pnpm gate"]

### AP-05: implementation-needed / P0
In-root destination symlink hot reload overwrites unrelated project file
- Chosen solution: Inspect lexical destination symlink before canonical resolution; refuse regular/dangling in-root/out-root aliases, preserve canonical containment and copy race defenses.
- Acceptance: ["Initial import/reload/recovery refuse alias and preserve unrelated/link/document/journal bytes; existing valid copy/recovery remains byte-identical."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": 1920, "symbol": "destinationFor canonicalTarget before lstat"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": 2124, "symbol": "copyEntry renameSync"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/contained-gltf.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
- Dependencies: ["authoring/CLI/desktop owners only if acceptance/recovery ordering changes"]
- Evidence/reproduction: {"reproduction": "Fresh valid composed project: assets/triangle.gltf -> root/unrelated.gltf holding identical source bytes. Public propose succeeds, apply, modify source, explicit hotReload:true with stable id, apply, materialize. Returns copiedPaths[assets/triangle.gltf], unrelated.gltf overwritten, symlink preserved.", "refutationAttempt": "Outside-root destination directory symlink refusal passes existing tests. Native source selection outside project is intentional. Confirmed only per-file in-root destination aliasing, not external escape.", "actualImpact": "Approved asset reload replaces unrelated same-root file and violates destination non-symlink ownership guarantee.", "classification": "confirmed-local-data-integrity-defect", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
- Commands: ["pnpm exec vitest run packages/importers/test/contained-gltf.test.ts tests/e2e/asset-pipeline-golden.test.ts && pnpm gate"]

### AP-02: implementation-needed / P1
Indexed triangle primitive rejects4-vertex shared-vertex square
- Chosen solution: Validate POSITION as complete VEC3; require vertexCount divisible by3 only for unindexed primitives. Indexed triplet and range checks remain unchanged.
- Acceptance: ["Indexed4-vertex6-index square imports/reloads/canonical-byte roundtrips; unindexed4, non-triplet and out-of-range indices still refuse."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": 1254, "symbol": "parseGltf positions.length %9 guard"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/contained-gltf.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": "POSITION Float32 count4 with coordinates[0,0,0,1,0,0,1,1,0,0,1,0]; uint16 indices[0,1,2,0,2,3]; embedded buffer, mode4. Public stage and actual CLI refuse ASSET_IMPORT_MALFORMED.", "refutationAttempt": "3-vertex control parses. Existing index validation demonstrates indexed triangles are admitted; this is not adding quad topology or broadening formats.", "actualImpact": "Routine valid indexed triangles with vertexCount not divisible by3 are rejected.", "classification": "confirmed-local-defect", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
- Commands: ["pnpm exec vitest run packages/importers/test/contained-gltf.test.ts tests/e2e/asset-ingestion-golden.test.ts tests/e2e/asset-pipeline-golden.test.ts && pnpm gate"]

### AP-03: implementation-needed / P1
Current inspected plugin bytes are not bound to cached evaluated implementation
- Chosen solution: Prefer immutable inspected graph fingerprints per process; refuse changed entrypoint/transitive bytes with existing named refusal and restart guidance. Do not uncontrolled-cache-bust or claim process sandboxing.
- Acceptance: ["Repeated unchanged load deterministic; changed entry/transitive helper cannot expose stale code as current; refusals clear addressable old state; new-process load works."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/pipeline.ts", "line": 430, "symbol": "processCandidate import href"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/host.ts", "line": 80, "symbol": "load"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/pipeline.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/isolation.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/host.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/test/load-refuse.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/test/refuse-matrix.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
- Dependencies: ["trusted-plugin lifecycle documentation"]
- Evidence/reproduction: {"reproduction": "Trusted explicit package capabilities={}, host.load([root]); overwrite same entrypoint with capabilities={unexpected:42}; host.load([root]) still loaded1/refused0.", "refutationAttempt": "Version, descriptor and unknown capability refusal are enforced. Node caches entrypoint URL; a new host instance in same process does not invalidate it. No explicit promise of arbitrary hot reload is assumed; however repeated load inspects new bytes while exposing old code, so integrity must be bound or change refused.", "actualImpact": "Stale implementation can be exposed under metadata/inspection of current package; not claimed as hostile-code sandbox escape.", "classification": "confirmed-local-lifecycle-integrity-defect", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
- Commands: ["pnpm exec vitest run packages/plugin-host/test/load-refuse.test.ts packages/plugin-host/test/refuse-matrix.test.ts tests/e2e/plugin-capability-golden.test.ts && pnpm gate"]

### AP-04: implementation-needed / P1
Deep Scene Document throws through importer public boundary
- Chosen solution: Bound/iterate shared JSON validation while retaining cycle/accessor/prototype semantics, plus bounded importer preflight/iterative freeze. Explicit safe local limits; no blanket success catch.
- Acceptance: ["Public propose/apply deep input refuses without throw/write; supported depth and cyclic/accessor/prototype/duplicate refusal controls retain contract."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/index.ts", "line": 150, "symbol": "proposeSceneDocumentImport"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/index.ts", "line": 196, "symbol": "applySceneDocumentImport"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/document.ts", "line": 62, "symbol": "isJsonValueInner"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/index.ts", "line": 104, "symbol": "deepFreeze"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/document-import.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
- Dependencies: ["packages/schemas/src/document.ts shared ownership", "normative document depth/resource decision"]
- Evidence/reproduction: {"reproduction": "In source.sceneaxi.json replace data.source with'{\"x\":'.repeat(7000)+'0'+'}'.repeat(7000). Both importer functions throw RangeError in schemas validator before target lookup.", "refutationAttempt": "Depth1000 source validation succeeds. Duplicate-member scanning is iterative; stack identifies shared document validator, not JSON syntax or duplicate parser. Recursive importer freeze is a second sensitivity.", "actualImpact": "Small~42KiB resource-hostile document is not converted to promised named validation envelope; shared callers may also be affected.", "classification": "confirmed-local-resource-validation-defect", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
- Commands: ["pnpm exec vitest run packages/importers/test/document-import.test.ts packages/schemas/test/document-proposal.test.ts packages/schemas/test/unambiguous-json.test.ts && pnpm check:contracts && pnpm gate"]

### AP-06: implementation-needed / P1
Search/filter/sort unnecessarily parked on inventory decision
- Chosen solution: Pure deterministic bounded GET query/search over title/id/creator, admitted price-mode filter and stable sort; accessible mirrored forms/empty state. Preserve true counts, fixture TEST/inert labels, no new packages/matrix edge.
- Acceptance: ["Deterministic filter/sort matching, no-result clear state, invalid/long query bounded, mirrored browser interactions and commerce refusal remain true."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/app/page.tsx", "line": 24, "symbol": "CataloguePage"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/app/page.tsx", "line": 71, "symbol": "descriptive facet rows"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/catalog.ts", "line": 109, "symbol": "LISTINGS"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/app/page.tsx", "line": 24, "symbol": "CataloguePage", "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/app/page.tsx", "line": 71, "symbol": "descriptive facet rows", "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/catalog.ts", "line": 109, "symbol": "LISTINGS", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["exact shared source ownership and mirrored storefront parity"]
- Evidence/reproduction: {"reproduction": "Browse source ignores query parameters; facets are spans, all3Game/1Web fixtures always listed. Public listSiteCatalog returns unchanged inventory.", "refutationAttempt": "Honest design intentionally removed fake controls. No need to invent inventory/taxonomy to implement real query behavior over existing validated metadata.", "actualImpact": "No local browsing narrowing/order control despite available committed inventory.", "classification": "locally-implementable-missing-capability", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
- Commands: ["pnpm exec vitest run packages/site-kit/test/catalog.test.ts tests/sites/catalog-storefronts.test.ts && pnpm gate; then existing pnpm build in each catalog install root and real loopback query/keyboard browser assertions"]

### AP-07: implementation-needed / P1
One public capability and trusted-only host do not implement untrusted marketplace execution
- Chosen solution: Maintain truthful trusted explicit local usage/default and no arbitrary untrusted loader. Fix AP-03 locally. Do not add speculative capability IDs or claim AST checking is permission sandbox.
- Acceptance: ["Unknown capability/version/entry escape refuse before evaluation, current trusted capability works, no public sandbox claim or untrusted automatic load."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/plugins.md", "line": 273, "symbol": "Isolation and non-goals"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/index.ts", "line": 10, "symbol": "seam"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/plugins.md", "line": 273, "symbol": "Isolation and non-goals", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/index.ts", "line": 10, "symbol": "seam", "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
- Dependencies: ["real separate trust/execution decision and implementation proof for untrusted use", "public capability contract owners for any justified registry addition"]
- Evidence/reproduction: {"reproduction": "Public pluginCapabilityRegistrySeed exactly one sculpt intake source capability; all missing IDs refused. Loading is explicit and same-process, package isolation not sandbox.", "refutationAttempt": "Host documentation expressly disclaims hostile-code sandbox; not a security defect merely because trusted plugin code can use ordinary Node host power.", "actualImpact": "Production untrusted plugin loading cannot safely be claimed from manifest/isolation checks.", "classification": "intentional-trust-boundary-and-production-input", "outcome": "BOUNDARY_PRESERVED_PRODUCTION_TRUST_INPUT_REQUIRED"}
- Commands: ["pnpm exec vitest run packages/plugin-host/test tests/e2e/plugin-capability-golden.test.ts && pnpm check:contracts"]

### CAT-DURABLE-INTAKE: implementation-needed / P1
Durable local intake/quarantine wiring and truthful submission UI
- Chosen solution: Implement injectable durable intake/store wiring over existing pipeline and admitted storage helpers in local fixtures; explicit rights metadata and reviewed transitions, no public activation or process-local fake persistence.
- Acceptance: ["Restart/replay preserves own submission; no premature listing; unauthorized/invalid/Kids refused; empty configuration still CATALOG_INTAKE_STORAGE_UNAVAILABLE."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/catalog-submission.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/catalog-intake.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/editor-catalog-intake-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### COVERAGE-ASSETS-PLUGINS: implementation-needed / P1
Remaining current-source/front-door coverage: assets-plugins
- Chosen solution: Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
- Acceptance: ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "No passing-after AP-01..05 source edits from read-only auditor", "No browser pixel/native picker/packaged host proof by this node; route engine/desktop lanes", "No real provider/network/storage marketplace or legal/curation authority exercised", "Hostile-code sandbox deliberately nonexistent; trusted execution is not permissions enforcement", "Peak RSS/time and16x8MiB manifest limits not benchmarked", "Filesystem races/concurrency/cancellation/cross-OS permission/fault matrix not exhaustively tested", "Accessor exact maximum250000 backing-buffer boundary not independently exercised; triangle250000/250001 and byte8MiB+1 boundaries were exercised"]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json"]

### GATE-MARKETPLACE: genuine-external-blocker / P1
Marketplace rights/curation/delivery activation absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Actual licensed payload inventory, provenance/AI disclosures, curator/moderation/takedown legal owner/policy, approved durable delivery configuration, genuine entitlement/payment evidence, structured per-storefront held-key resolution and separate activation/publication authority.

### AP-PERF: implementation-needed / P2
Importer/plugin controlled capacity and fault coverage
- Chosen solution: Measure admitted limits, repeated reload/load lifecycle and permission/race refusals using owned fixtures; no hostile untrusted code/network.
- Acceptance: ["Recorded command/platform/time/RSS at limit and limit+1; no uncontrolled stack growth/writes, stable bytes/digests and deterministic refusals."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/contained-gltf.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/test/load-refuse.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### REQ-PROOF-CAT-001: done-with-evidence / P2
Bounded requirement declaration: The catalog is one modular platform under two independently branded Game and Web storefronts with separate taxonomy, curation, branding, origins, and product surfaces.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "SOURCE_AND_HERMETIC_PARITY_PROVEN_PRODUCTION_NOT_ATTESTED"]
- Source: []
- Targets/owners: [{"reference": "sites/catalog-game"}, {"reference": "sites/catalog-web"}, {"reference": "packages/site-kit"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "currentSemanticEntry": {"id": "CAT-001", "status": "SOURCE_AND_HERMETIC_PARITY_PROVEN_PRODUCTION_NOT_ATTESTED", "evidence": ["E2", "E9"], "statement": "Two brands/origins over shared modular platform; public fixtures Game3/Web1, no production taxonomy/curation inventory claim"}, "expectedEvidenceLayer": ["tests/sites/catalog-storefronts.test.ts", "tests/e2e/"]}]

### REQ-PROOF-CAT-002: done-with-evidence / P2
Bounded requirement declaration: Catalog intake proceeds quarantine to screening to human curation to listing and delisting/takedown, with every transition recorded and fail-closed.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PUBLIC_TEST_PIPELINE_DRIVEABLE_PRODUCTION_STORE_ABSENT"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/catalog-pipeline.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/catalog-submission.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "currentSemanticEntry": {"id": "CAT-002", "status": "PUBLIC_TEST_PIPELINE_DRIVEABLE_PRODUCTION_STORE_ABSENT", "evidence": ["E3"], "statement": "TEST transition pipeline exists; deployment intake null and production moderation/storage not evidenced"}, "expectedEvidenceLayer": ["tests/e2e/catalog-fixture-commerce-golden.test.ts", "tests/sites/identity-plane-wiring.test.ts"]}]

### REQ-PROOF-CAT-003: done-with-evidence / P2
Bounded requirement declaration: Catalog items carry rights, provenance, mandatory AI disclosure, compatibility metadata, format profiles, and recorded moderation evidence.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CONTRACT_AND_FIXTURE_VALIDATION_PROVEN_ACTUAL_PAYLOAD_PROVENANCE_INPUT_REQUIRED"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/catalog-item.schema.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/fixture-commerce.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "currentSemanticEntry": {"id": "CAT-003", "status": "CONTRACT_AND_FIXTURE_VALIDATION_PROVEN_ACTUAL_PAYLOAD_PROVENANCE_INPUT_REQUIRED", "evidence": ["E3", "E9"], "statement": "CatalogItem rights/provenance/mandatory AI/compatibility/moderation validation exists; listing view honestly lacks asset payload/licence/preview/compatibility"}, "expectedEvidenceLayer": ["pnpm check:contracts", "tests/e2e/catalog-fixture-commerce-golden.test.ts"]}]

### REQ-PROOF-CAT-004: done-with-evidence / P2
Bounded requirement declaration: Commerce fields remain inert until the existing per-storefront activation holds open; Kids consumption is an allowlist over already-curated items, never a pipeline fork.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "HELD_BOUNDARIES_PROVEN_NO_ACTIVATION"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/fixture-commerce.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"reference": "packages/profile-kids"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/held-key-enforcement.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "currentSemanticEntry": {"id": "CAT-004", "status": "HELD_BOUNDARIES_PROVEN_NO_ACTIVATION", "evidence": ["E3", "E9"], "statement": "Public commerce inert; Kids shared refusal/no pipeline fork preserved; one TEST fixture commerce path is not public activation"}, "expectedEvidenceLayer": ["tests/e2e/catalog-fixture-commerce-golden.test.ts", "tests/e2e/profile-kids-refuse-golden.test.ts"]}]

### REQ-PROOF-CORE-008: done-with-evidence / P2
Bounded requirement declaration: The contained asset manifest admits only declared bounded profiles, derives stable identity and preview metadata from bytes, and reloads through review without mutating accepted bytes.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "BOUNDED_IMPLEMENTED_WITH_OPEN_DEFECTS"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/project-asset-manifest.schema.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "currentSemanticEntry": {"id": "CORE-008", "status": "BOUNDED_IMPLEMENTED_WITH_OPEN_DEFECTS", "evidence": ["E2", "E3", "E4", "E5"], "openTasks": ["AP-01", "AP-02", "AP-04", "AP-05"], "statement": "Declared asset profiles, stable-id review reload, canonical-byte integrity and preview/provenance derive from bytes; no new format admitted"}, "expectedEvidenceLayer": ["tests/e2e/asset-pipeline-golden.test.ts", "tests/e2e/asset-ingestion-golden.test.ts"]}]

### SCOPE-UNTRUSTED-PLUGINS: intentional-nonlaunch-capability / P2
Untrusted plugin sandbox absent
- Chosen solution: Trusted explicit local packages only; immutable inspected-byte identity. No new capability or AST-scan-as-sandbox claim; untrusted execution remains excluded/full-product gap.
- Acceptance: ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []

## Shared requests and acceptance obligations

[{"lane": "assets-plugins", "sourceKey": "sharedChanges", "requests": {"schemas": ["packages/schemas/src/document.ts", "packages/schemas/test/document-proposal.test.ts", "packages/schemas/test/unambiguous-json.test.ts"], "rootManifests": "No changes needed or authorized; no new dependencies, no gate changes or matrix widening", "crossLane": ["packages/site-kit/src/catalog.ts", "packages/site-kit/test/catalog.test.ts", "sites/catalog-game/src/app/page.tsx", "sites/catalog-web/src/app/page.tsx", "tests/sites/catalog-storefronts.test.ts", "tests/e2e/asset-ingestion-golden.test.ts", "tests/e2e/asset-pipeline-golden.test.ts"], "docs": ["docs/asset-ingestion.md", "docs/plugins.md", "packages/importers/README.md", "packages/plugin-host/README.md", "docs/runnable-surfaces.md", "docs/audits/go-live-backlog.json evidence refresh only by owner", "docs/audits/production-swarm/FINAL.md and FINAL.json integration only"]}}]

Submit requested shared changes as exact path/symbol/current→recommended text/API/test deltas to integration; never concurrently edit reserved surfaces. Existing current helpers/public seams and boundary matrix dominate; no second authoring core/no direct CLI-engine imports/no invented provider/legal proof. Verify upstream external documentation before new stack/API or security-version use.

Reproduce confirmed defects through actual public front doors before patch; keep failing-before/passing-after oracles, rebuild dist before running Node binaries. Execute focused existing tests then report real exit/result/assertions/platform/coverage holes. Missing installations are local work, not external blockers. New verbs require ROOT_COMMANDS + SHIPPED_COMMAND_MAP + takesArgs + bin/golden/unknown-flag parity together. Kids shared path/empty dependents, only-advance, held currency-first and LIVE default-off stay intact.

Persist per-task outcome and node commands/evidence under this lane build report; do not claim production PASS. Integration owns FINAL.md/JSON, unchanged full gate, independent actual front doors and serial repair routing capped at three passes. Every remaining intentional capability and external request remains visible in full-production counts.
