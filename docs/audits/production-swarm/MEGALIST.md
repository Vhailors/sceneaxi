# SceneAxi exhaustive production megalist

Graph `sceneaxi-production-swarm`; real root `/home/devuser/Documents/Projects/sceneaxi`; baseline `4e532e2fbf43e9948741578ab6208a3277870405` rechecked. **PARTIAL**, serial integration pass 3 completed, not deployment/publication/financial authority.

Current-source focused judge regressions: **139 passed / 0 failed** (`integration-pass-2-focused.log`). Final unchanged full gate: **282 files / 4,297 tests**, golden: **57 files / 539 tests** (`integration-pass-3-{gate,golden}.log`). SDK/API generation, four production site builds, seven browser tests, provider/persistence and final runtime plus three fresh packaged Linux runs pass their bounded predicates. A runtime readiness flake was reproduced after earlier passes and repaired; all failures remain in durable logs. Historical findings below remain preserved; these green checks do not close every task or external gate. `FINAL.md` / `FINAL.json` retain complete mappings and remaining local work. **Local completion acceptance is NOT MET; no fourth automatic integration loop or full-production PASS.**

## Historical synthesis totals (not final closure counts)

| Measure | Count |
|---|---:|
| canonicalRootRecords | 277 |
| sourceAndMappingRecords | 307 |
| deduplicatedProductionGapRoots | 148 |
| locallySolvableGapRoots | 113 |
| externalBlockerRoots | 22 |
| intentionalNonlaunchGapRoots | 13 |
| doneWithBoundedEvidenceRoots | 129 |
| diagnosesMappedWithoutDoubleCount | 30 |
| existingBacklogRecords | 90 |
| requirements | 109 |
| auditPairsPresent | 12 |
| unownedRoots | 0 |
| unmappedBacklogIds | 0 |
| unmappedRequirementIds | 0 |
| unmappedAuditFindings | 0 |

Gap counts are disjoint canonical root causes, not old id counts. Done is bounded criterion only; intentional exclusions count as full-production gaps; local failures are not external.

All 90 historical records and 109 authority requirements are retained. Original authoring/sites branches failed to persist reports; recovered report pairs are attributed in JSON, not fictional original successes. Authoring recovery records inherited reproductions and does not itself claim fresh probes. Sites coverage is only as complete as its current auditCompleted/evidence fields; interim holes remain assigned. The ten original pairs and two actual recovery pairs are hashed before synthesis.

## Scope and delegated decisions

Offline bounded Game/Web authoring+engine/Three, sole-admin closed-signup web, isolated in-memory Kids activity; no public activation implied.
All original/new requirements and actual provider/legal/held/Kids/LIVE/platform/release evidence; never silently redefined by exclusions.

DEC-01..27 in `decision-log.md` choose safe local defaults. Every locally solvable design/coverage task below has an owner. No legal rights, provider credentials, signing proof, held epoch, LIVE money authority or program proof is invented. Intentional nonlaunch exclusions stay in gap totals.

## Serial ownership and integration

Builders claim only exact paths in `assignments/<lane>.md`. All schemas/site-kit, root/shared manifests/locks/config/scripts/workflows, existing owning docs, shared tests and migration numbering/SQL are RESERVED integration after builders. Submit exact shared requests; never edit another lane path. No matrix widening/check skip/lint disable/weak assertion. No stash/reset/clean/commit/push/deploy/publish/spend/production changes.

Integration runs unchanged `pnpm gate` plus actual rebuilt CLI/shell, all site install-root/provider/browser and available native packaged Linux front doors; exit0 alone is insufficient. FAIL returns to integration for up to three passes. FINAL.md/JSON must reconcile every canonical root with per-node/task commands, exits, semantic assertions, platform and holes. PASS only with zero full-production gaps.

## Deduplicated canonical production work

### implementation-needed

#### AUTHORING-001 — P1 / high / authoring
**Root cause:** Project propose/apply permits out-of-root document writes
**Mappings:** backlog []; requirements [].
**Chosen solution:** Enforce canonical root containment before proposal and application, including symlink targets.
**Acceptance:** ["Reject parent traversal and symlink escapes before mutation", "Outside victim bytes remain unchanged", "Valid in-root propose/apply succeeds"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 95, "symbol": "resolvePath"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 244, "symbol": "propose"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 563, "symbol": "apply"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 95, "symbol": "resolvePath", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 244, "symbol": "propose", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 563, "symbol": "apply", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
**Dependencies:** ["CLI project document selection", "Authoring path resolution", "writeDocumentFile already enforces containment, unlike these paths"]
**Before/reproduction/impact/refutation:** {"reproduction": "In an isolated fixture, CLI project propose/apply with --cwd <root> and --document ../outside/victim.json returned proposed exit 0 then applied exit 0; the victim outside the root changed.", "impact": "Bypasses the project-root document write boundary.", "status": "reproduced"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "evidenceIds": []}]

#### AUTHORING-002 — P1 / high / authoring
**Root cause:** Recovery and journal storage escape the project root
**Mappings:** backlog []; requirements [].
**Chosen solution:** Validate recovered document paths against the canonical project root and reject escaping journal-directory symlinks before writing any journal artifact.
**Acceptance:** ["Crafted active records fail without outside mutation", "Journal symlink tests leave the outside sink free of artifacts", "Normal recovery remains functional"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 674, "symbol": "recoverIncompleteApplies"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 711, "symbol": "recoverIncompleteApplies"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 674, "symbol": "recoverIncompleteApplies", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 711, "symbol": "recoverIncompleteApplies", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
**Dependencies:** ["Recovery record validation", "Journal-directory confinement"]
**Before/reproduction/impact/refutation:** {"reproduction": "Recovery consumed a valid schemaVersion 4 .active record with documentPath ../outside/victim.json and wrote outside the root. Separately, a .sceneaxi/journal symlink to an outside sink redirected .active, .completion-sequence, and archive writes outside the root.", "impact": "Persisted recovery metadata and journal-directory redirection bypass filesystem write boundaries.", "status": "reproduced"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "evidenceIds": []}]

#### AUTHORING-003 — P2 / medium / authoring
**Root cause:** Native seed accepts invalid document bytes
**Mappings:** backlog []; requirements [].
**Chosen solution:** Validate document bytes with the applicable parser/schema before writing seed files or reporting success.
**Acceptance:** ["Invalid JSON and invalid document shapes fail before writes", "Valid seeds reopen successfully", "Failed initialization leaves no partial seed artifacts"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 627, "symbol": "writeNativeProjectSeed"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 627, "symbol": "writeNativeProjectSeed", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
**Dependencies:** ["Native seed writer", "Reopen document validation"]
**Before/reproduction/impact/refutation:** {"reproduction": "documentBytes equal to not-json returned ok; reopening failed with PROJECT_MANIFEST_MALFORMED.", "impact": "Successful initialization can persist a project that cannot reopen.", "status": "reproduced"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "evidenceIds": []}]

#### AUTHORING-004 — P2 / medium / authoring
**Root cause:** Targeted tests lack negative containment and validity oracles
**Mappings:** backlog []; requirements [].
**Chosen solution:** Add negative tests for parent traversal, symlink redirection, hostile recovery records, and malformed seed bytes, with no-mutation assertions.
**Acceptance:** ["New tests fail on vulnerable behavior and pass after fixes", "Preserve the existing 159-test baseline", "Use isolated temporary fixture roots, never real repository projects"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 95, "symbol": "resolvePath"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 674, "symbol": "recoverIncompleteApplies"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 627, "symbol": "writeNativeProjectSeed"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 95, "symbol": "resolvePath", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 674, "symbol": "recoverIncompleteApplies", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 627, "symbol": "writeNativeProjectSeed", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
**Dependencies:** ["AUTHORING-001", "AUTHORING-002", "AUTHORING-003"]
**Before/reproduction/impact/refutation:** {"reproduction": "Existing 159 targeted tests passed despite the reproduced failures. Repro artifacts were inherited at /tmp/sceneaxi-authoring-audit-jYPXkY and /tmp/sceneaxi-authoring-refute-ywAwly; availability was not rechecked.", "impact": "A green targeted suite does not establish containment or seed validity.", "status": "coverage-hole"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "evidenceIds": []}]

#### AUTHORING-005 — P3 / low / authoring
**Root cause:** Migration journal reader assumes Linux procfs
**Mappings:** backlog []; requirements [].
**Chosen solution:** Remove the unconditional procfs dependency or use a platform-aware safe descriptor-reading strategy.
**Acceptance:** ["Native Linux, macOS, and Windows tests read valid migration journals without requiring procfs", "Preserve descriptor/path safety"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 377, "symbol": "readMigrationJournal"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 380, "symbol": "readMigrationJournal"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 377, "symbol": "readMigrationJournal", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 380, "symbol": "readMigrationJournal", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
**Dependencies:** ["OS descriptor-path support", "Migration journal reading"]
**Before/reproduction/impact/refutation:** {"reproduction": "Inherited source observation: readMigrationJournal unconditionally uses /proc/self/fd. Native macOS/Windows failure was not demonstrated.", "impact": "Potential portability failure where Linux procfs is unavailable; not a native-platform-proven defect.", "status": "observed"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "evidenceIds": []}]

#### ENG-002 — P0 / high / engine
**Root cause:** Safe integer/range inputs, finite result and rounding guards, accumulated time bounds, transactional advance across every scene instance; refuse without consuming queued commands or partial state.
**Mappings:** backlog []; requirements ['CORE-001'].
**Chosen solution:** Safe integer/range inputs, finite result and rounding guards, accumulated time bounds, transactional advance across every scene instance; refuse without consuming queued commands or partial state.
**Acceptance:** ["Unsafe/overflow inputs refuse; before/after/retried snapshot and pending commands stable; scene rollback oracle; supported golden digests unchanged and snapshots finite/JSON-roundtrippable."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 204, "symbol": "validateManifest"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 450, "symbol": "isIntegerPair"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 543, "symbol": "validateClock"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/sculpt-session.ts", "line": 154, "symbol": "validateSculptClock"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/sculpt-session.ts", "line": 206, "symbol": "SculptNodeSimulation.applyClock"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts", "line": 143, "symbol": "SceneSessionImpl.advance"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/sculpt-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/session.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/sculpt-session.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/scene-session.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["schemas owner: kernel-session.ts/contract bounds; no root dependency change"]
**Commands:** ["pnpm exec vitest run packages/engine-kernel/test/session.test.ts packages/engine-kernel/test/sculpt-session.test.ts packages/engine-kernel/test/scene-session.test.ts"]
**Before/reproduction/impact/refutation:** {"reproduction": "const s=K.open({productId:'overflow',seed:1,entities:[{id:'player',x:1e308,y:0}]},host);s.dispatch({type:'move',actor:'player',axis:[1e308,0]});s.advance({tick:1,deltaMs:16});assert.equal(s.observe().entities[0].x,Infinity);assert.equal(JSON.parse(JSON.stringify(s.observe())).entities[0].x,null);", "refutation": "Small supported product/scene/sculpt inputs and JSON save/replay goldens pass. Number.isInteger nevertheless accepts1e308; sculpt huge frame also fails finite-state invariant.", "actualImpact": "Nonfinite authoritative state, null JSON projection and invalid downstream renderer coordinates; mutation authority is preserved but value validity is not.", "type": "confirmed-defect", "status": "PENDING_BUILDER"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "evidenceIds": ["E2", "E3", "E9"]}]

#### ENG-005 — P1 / high / engine
**Root cause:** Prevalidate full mesh/node/transform batch; cleanup partial roots on every failure; guard all direct mutators; retain previous visible root on failed replacement; reject disconnected/cyclic/duplicate nodes.
**Mappings:** backlog []; requirements [].
**Chosen solution:** Prevalidate full mesh/node/transform batch; cleanup partial roots on every failure; guard all direct mutators; retain previous visible root on failed replacement; reject disconnected/cyclic/duplicate nodes.
**Acceptance:** ["Five malformed replacements leave zero new live resources and old render works; direct disposed backend methods refuse and repeated dispose safe."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": 139, "symbol": "buildTriangleAsset"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": 383, "symbol": "mountTriangleAsset"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": 415, "symbol": "dispose"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["assets importer validation is upstream defense only, not a replacement for public engine guard"]
**Commands:** ["pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts"]
**Before/reproduction/impact/refutation:** {"reproduction": "Valid first triangle mesh followed by second positions:[NaN,0,0]; five refused public mountTriangleAsset calls allocate5 first-mesh geometries that remain undisposed after backend.dispose. Separate disposed backend accepts a new valid triangle mount.", "refutation": "createSculptMountApi guards its own disposed state; ordinary valid mounts release geometry. Direct imported-asset backend path bypasses that protection.", "actualImpact": "Unreachable CPU resource accumulation on malformed batches and post-dispose mutation; nontransactional replacement ownership.", "type": "confirmed-defect", "status": "PENDING_BUILDER"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "evidenceIds": ["E4"]}]

#### ENG-003 — P1 / medium / engine
**Root cause:** Validate complete neutral snapshot/environment before mutation; unique bounded ids, finite renderer-range coordinates and safe ticks; deterministic max framebuffer pixel/dimension budgets.
**Mappings:** backlog []; requirements ['CORE-018'].
**Chosen solution:** Validate complete neutral snapshot/environment before mutation; unique bounded ids, finite renderer-range coordinates and safe ticks; deterministic max framebuffer pixel/dimension budgets.
**Acceptance:** ["Malformed inputs throw named errors without altering last good frame/camera/resources; bounded limit/limit+1 viewport oracle, valid goldens unchanged."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts", "line": 76, "symbol": "requireSnapshot"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": 126, "symbol": "resolveViewport"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": 197, "symbol": "applyEnvironment"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-surface.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["schemas owner for documented renderer/catalog numeric budgets"]
**Commands:** ["pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts packages/engine-presentation/test/three-surface.test.ts"]
**Before/reproduction/impact/refutation:** {"reproduction": "const r=P.createThreePresentationRuntime();r.mount();r.present({tick:1,seed:1,digest:'ignored',entities:[{id:'same',x:NaN,y:Infinity},{id:'same',x:2,y:3}]},[],1);assert.equal(r.lastFrame().entityCount,2);r.dispose();const c=P.createThreePresentationCore();c.setEnvironment({ambientIntensity:NaN,keyDirection:[Infinity,0,0],fog:{enabled:true,color:'#fff',near:10,far:-1}});c.resize(1e9,1e9,1e9);c.dispose();", "refutation": "Actual site clamps device ratio2 and valid alpha/negative dimensions already refuse. No destructive huge GPU allocation attempted. Exposure is public SDK boundary, not proven remote HTTP attack.", "actualImpact": "Misleading entity/frame metadata, invalid lighting/coordinates, potential unreasonable framebuffer allocation requests.", "type": "confirmed-defect", "status": "PENDING_BUILDER"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "evidenceIds": ["E3"]}]

#### ENG-006 — P1 / medium / engine
**Root cause:** Explicit terminal owned-context release or reusable renderer/surface owner, with clear remount semantics; no vendor patch, no false lost-context pixel claim.
**Mappings:** backlog []; requirements ['CORE-007'].
**Chosen solution:** Explicit terminal owned-context release or reusable renderer/surface owner, with clear remount semantics; no vendor patch, no false lost-context pixel claim.
**Acceptance:** ["Actual Chromium same-canvas100 create/draw/dispose rounds have bounded live handles; supported remount/restoration draws real pixels, lost context reportsfalse and capture unavailable."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-surface.ts", "line": 343, "symbol": "dispose"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": 384, "symbol": "dispose"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-surface.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-surface.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["site and desktop canvas context ownership/remount agreement; externally injected surfaces must not be terminally destroyed by internal owner"]
**Commands:** ["pnpm exec vitest run packages/engine-presentation/test/three-surface.test.ts packages/engine-presentation/test/three-presentation.test.ts"]
**Before/reproduction/impact/refutation:** {"reproduction": "In installed Chromium, retain canvas/gl and created texture handles; three public createThreePresentationCore({canvas,viewport:{width:100,height:100}}).draw/dispose rounds; gl.isTexture confirms4,8,12 still-live textures.", "refutation": "Buffers/programs released and same-renderer mount cycles plateau. Counter-only framebuffer assertion not reliable; actual gl.isFramebuffer returns0. Four default pinned-Three state textures remain, not an invented all-resource leak.", "actualImpact": "Recreating terminal renderer on retained canvas accumulates defaults until eventual context/GC teardown; full lifecycle resource bound unproven.", "type": "confirmed-resource-lifecycle-gap", "status": "PENDING_BUILDER"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "evidenceIds": ["E6", "E7", "E8"]}]

#### ENG-004 — P2 / medium / engine
**Root cause:** Private internal core factory plus opaque/numeric public facade; keep one shared renderer and useful public controls.
**Mappings:** backlog []; requirements [].
**Chosen solution:** Private internal core factory plus opaque/numeric public facade; keep one shared renderer and useful public controls.
**Acceptance:** ["External consumer type oracle exposes no Three Group/types; real WebGL and goldens preserved."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/index.ts", "line": 42, "symbol": "createThreePresentationCore export"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": 114, "symbol": "ThreePresentationCore.content"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/seam.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["docs owner: three-presentation-core.md, package README/generated API; root export map need not widen"]
**Commands:** ["pnpm build && pnpm exec vitest run packages/engine-presentation/test/seam.test.ts packages/engine-presentation/test/three-presentation.test.ts"]
**Before/reproduction/impact/refutation:** {"reproduction": "const c=P.createThreePresentationCore();assert.equal(c.content.type,'Group');c.dispose(); emitted public factory return declaration exposes content:Group at dist/src/three-core.d.ts:76.", "refutation": "Not merely a private deep import; publicly exported factory exposes the type. Kernel remains separate and cannot be advanced through this object.", "actualImpact": "Three backend types and mutable scene graph cross advertised opaque ADR0002 public seam.", "type": "confirmed-contract-leak", "status": "PENDING_BUILDER"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "evidenceIds": ["E3"]}]

#### ENG-007 — P2 / medium / engine
**Root cause:** Total bounded accessor-safe error description with stable fallback; no secret/host-object stringification.
**Mappings:** backlog []; requirements ['CORE-002'].
**Chosen solution:** Total bounded accessor-safe error description with stable fallback; no secret/host-object stringification.
**Acceptance:** ["Hostile toString/Error.message/proxy thrown values never escape bootstrap/resume; named reasons stable."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/open-path.ts", "line": 194, "symbol": "kernelMessage"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/open-path.ts", "line": 213, "symbol": "resolveHost"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/open-path.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/test/refuse-matrix.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/test/open-path.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Commands:** ["pnpm exec vitest run packages/engine-orchestrator/test/refuse-matrix.test.ts packages/engine-orchestrator/test/open-path.test.ts"]
**Before/reproduction/impact/refutation:** {"reproduction": "assert.throws(()=>O.bootstrapOpenPath({kind:'product',productManifest:{productId:'audit',seed:1}},{nowMs(){throw {toString(){throw new Error('hostile-error-coercion')}}}}),/hostile-error-coercion/);", "refutation": "Ordinary Error correctly returns OPEN_PATH_HOST_INVALID; injected host is trusted, so no remote exploit claimed.", "actualImpact": "Named-refusal guarantee bypassed by unsafe diagnostic coercion/accessors; host failure can crash caller.", "type": "confirmed-error-handling-defect", "status": "PENDING_BUILDER"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "evidenceIds": ["E9"]}]

#### ENG-001 — P2 / medium / engine
**Root cause:** Recommended explicit same-major engine/BOM compatibility and named refusal for unsupported major until migration exists; preserve0.0.0 goldens and document narrower old policy.
**Mappings:** backlog []; requirements ['CORE-001'].
**Chosen solution:** Recommended explicit same-major engine/BOM compatibility and named refusal for unsupported major until migration exists; preserve0.0.0 goldens and document narrower old policy.
**Acceptance:** ["Compatibility table executably covered; supported JSON saves replay exact digest, unsupported version policy explicit before event work."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 98, "symbol": "replay"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/session.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["schemas kernel-session contract owner; docs compatibility policy owner"]
**Commands:** ["pnpm exec vitest run packages/engine-kernel/test/session.test.ts && pnpm check:contracts"]
**Before/reproduction/impact/refutation:** {"reproduction": "const s=K.open({productId:'audit',seed:1},host);s.advance({tick:1,deltaMs:0});const save=s.save();for(const field of ['kernelVersion','bomVersion'])assert.equal(K.replay({...save,[field]:'99.0.0'},host).observe().digest,s.observe().digest);", "refutation": "README9-10 promises schema major refusal only, which is implemented. Initial high-defect interpretation withdrawn; accepting syntax-valid engine/BOM major is not a confirmed breach of current normative policy.", "actualImpact": "Future engine/BOM compatibility/migration policy unspecified; current digest equality still enforced.", "type": "recommended-compatibility-hardening", "status": "PENDING_BUILDER_DECISION"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "evidenceIds": ["E2", "E3"]}]

#### ENG-008 — P2 / medium / engine
**Root cause:** Deterministic budgets/refusals and preallocation checks; index shapes/materials, bounded queue/history or versioned digest-preserving checkpoints; measured sustained use.
**Mappings:** backlog []; requirements ['CORE-001', 'CORE-017'].
**Chosen solution:** Deterministic budgets/refusals and preallocation checks; index shapes/materials, bounded queue/history or versioned digest-preserving checkpoints; measured sustained use.
**Acceptance:** ["Limit/limit+1 public oracles, maximum-supported session replay,100 lifecycle resource plateau and measured repeated CPU/memory records; headless counters never GPU proof."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 652, "symbol": "recordValidatedDispatch.pending.push"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 678, "symbol": "advance.events.push"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts", "line": 148, "symbol": "advance.advances.push"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/src/world.ts", "line": 109, "symbol": "createWorld per-body shape filtering"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts", "line": 127, "symbol": "markerFor"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/sculpt-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/src/world.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["schemas resource/checkpoint/catalog contracts owner; root script/benchmark registration integration owner"]
**Commands:** ["pnpm exec vitest run packages/engine-kernel/test packages/engine-orchestrator/test packages/engine-presentation/test packages/physics-rapier/test"]
**Before/reproduction/impact/refutation:** {"reproduction": "Source inspection: no declared maxima for pending/history/replay/entities/physics body+shape lists; pending validation scans pending list and Rapier filters all shapes per body. Normal golden workloads pass; no destructive OOM or invented SLA benchmark attempted.", "refutation": "PNG pixel projection and Rapier numeric/fixed-step validation already have some explicit bounds; this finding is missing holistic capacity, not absence of every guard.", "actualImpact": "Growing session histories/replay work and quadratic construction/lookup paths; production latency/memory bound not evidenced.", "type": "capacity-and-performance-gap", "status": "PENDING_BUILDER"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "evidenceIds": ["E2", "E6", "E8"]}]

#### ENG-009 — P1 / medium / engine
**Root cause:** MISSING_GENERAL_GAMEPLAY; narrow spawn/move/rarity-roll intentional union
**Mappings:** backlog [62]; requirements ['CORE-001'].
**Chosen solution:** DEC04 bounded declarative action/state/timer behavior, no eval; only advance resolves; input/time/save replay deterministic; do not park local design solely for approval
**Acceptance:** ["Actual input action→dispatch→advance→save/replay outcome and invalid/Kids/unknown-action refusal through packaged play front door", "pnpm exec vitest run packages/engine-kernel/test/session.test.ts tests/e2e/input-actions-golden.test.ts tests/e2e/desktop-play-session-golden.test.ts"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": "459", "symbol": "validateCommand"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/session.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["packages/schemas/src/kernel-session.ts", "packages/schemas/contracts/kernel-session.schema.json", "desktop/linux/src/renderer/viewport.ts", "desktop/linux/src/lib/bridge.ts"]
**Evidence:** []

#### ENG-010 — P1 / medium / engine
**Root cause:** OLD_CATEGORICAL_CLAIM_REFUTED; real WASM bounded adapter passes; full scene pose/resume incomplete
**Mappings:** backlog [63]; requirements ['CORE-017'].
**Chosen solution:** Explicit scene pose/joint-frame/animation-order contract, physics-aware persistence/resume; keep nonzero animation-offset refusal until implemented; narrow serialize currently diagnostic rather than generic restore
**Acceptance:** ["Public posed multi-object save/load/replay joint/collision digest and real renderer pose evidence", "pnpm exec vitest run packages/physics-rapier/test/seam.test.ts tests/e2e/physics-rapier-golden.test.ts tests/e2e/desktop-physics-golden.test.ts tests/e2e/desktop-animation-golden.test.ts"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/src/index.ts", "line": "47", "symbol": "createRapierPhysicsWorldHost; world.ts:108 index-derived vertical pose"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/src/world.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/test/seam.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["packages/schemas/src/physics-world-host.ts", "packages/schemas/src/desktop-scene-physics.ts", "desktop/linux/src/lib/desktop-scene.ts", "desktop/linux/src/renderer/viewport.ts"]
**Evidence:** ["E1", "E2"]

#### ENG-011 — P1 / medium / engine
**Root cause:** CONFIRMED_MISSING_LOCAL_AUDIO_RUNTIME
**Mappings:** backlog [64]; requirements [].
**Chosen solution:** User-gesture unlock; contained admitted assets; explicit start/stop/volume/dispose/visibility; no autoplay/network/provider
**Acceptance:** ["Real browser gesture unlock/play/stop and zero active sources after dispose; actual audible/device observation separately recorded, not AudioContext counters", "pnpm exec vitest run packages/engine-presentation/test && pnpm --dir desktop/linux smoke --packaged"]
**File/symbol targets and exact owner:** [{"reference": "packages/engine-presentation/src/ (new bounded audio adapter)"}, {"reference": "packages/engine-presentation/test/ (public audio seam tests)"}]
**Dependencies:** ["packages/schemas/ (audio admission/playback contract)", "packages/importers/ (contained admitted audio)", "desktop/linux/src/renderer/viewport.ts"]
**Evidence:** []

#### ENG-012 — P2 / medium / engine
**Root cause:** OLD_CATEGORICAL_CLAIM_REFUTED; UV+contained PNG RGBA DataTexture implemented; compressed format/pixel holes remain
**Mappings:** backlog [66]; requirements [].
**Chosen solution:** Real admitted checker-texture pixel/resource proof; bounded contained JPEG/WebP decoding if supported
**Acceptance:** ["Actual admitted textured GLB/glTF browser/packaged checker pixels,resize/dispose,malformed bounds; numeric PNG-array test alone insufficient", "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts tests/e2e/asset-ingestion-golden.test.ts"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": "166", "symbol": "buildTriangleAsset"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["packages/importers/ (glTF decoder)", "packages/schemas/ (asset render contracts)", "desktop/linux/src/renderer/viewport.ts"]
**Evidence:** []

#### ENG-013 — P2 / medium / engine
**Root cause:** NODE_TRS_PLAYBACK_IMPLEMENTED; skeleton/CUBICSPLINE and feature pixel proof absent
**Mappings:** backlog [67]; requirements [].
**Chosen solution:** Real STEP/LINEAR node animation pixels/replay/time bounds; implement validated skinning/CUBICSPLINE separately or preserve unsupported refusal and missing-capability list
**Acceptance:** ["Real imported animation before/after pixel changes,deterministic time replay and stable resources; explicit unsupported formats remain visible", "pnpm exec vitest run tests/e2e/desktop-animation-golden.test.ts packages/engine-presentation/test/three-presentation.test.ts"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": "397", "symbol": "playTriangleAnimation"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["packages/schemas/ (glTF animation/skin contracts)", "packages/importers/ (glTF projection)", "desktop/linux/src/renderer/viewport.ts"]
**Evidence:** []

#### ENG-014 — P2 / medium / engine
**Root cause:** OLD_CATEGORICAL_CLAIM_REFUTED; renderer implementations exist, feature pixel/performance proof incomplete
**Mappings:** backlog [68]; requirements ['CORE-018'].
**Chosen solution:** Actual bloom/vignette/particle/emissive/opacity pixel comparisons, switching/disposal/restoration resource plateau
**Acceptance:** ["Real authored-catalog WebGL comparisons and long-lived performance; no headless pixel inference", "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts packages/engine-presentation/test/three-surface.test.ts"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-surface.ts", "line": "224", "symbol": "configureEffects; three-core.ts:294 sampleEffects; three-sculpt.ts:320 setMaterialOverrides"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-surface.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["sites/umbrella/src/app/_components/sculpt-viewport.tsx", "desktop/linux/src/renderer/viewport.ts"]
**Evidence:** []

#### ENG-015 — P1 / medium / engine
**Root cause:** OLD_NO_GAMEPAD_CLAIM_REFUTED; standard input sampling/deadzones supported; primary gameplay and physical-device proof missing
**Mappings:** backlog [69]; requirements ['CORE-014'].
**Chosen solution:** Connect bounded play.primary to ENG009, preserve contexts/source-hash clone and restart-durable rebinding; physical controller evidence distinct
**Acceptance:** ["Actual packaged input/play flow and genuine connected standard-controller test, not navigator mock", "pnpm exec vitest run tests/e2e/input-actions-golden.test.ts packages/schemas/test/input-action-registry.test.ts"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["packages/schemas/src/input-action-registry.ts", "desktop/linux/src/renderer/viewport.ts", "desktop/linux/src/lib/bridge.ts"]
**Evidence:** ["E2"]

#### ENG-017 — P2 / medium / engine
**Root cause:** CATALOG_FORWARDING_IMPLEMENTED; non-null texture slots intentionally refused; feature pixels incomplete
**Mappings:** backlog [90]; requirements ['CORE-018'].
**Chosen solution:** Contained asset-to-texture binding contract including UV set,color space,sampler,pixel transport; deterministic lookup and actual texture pixels; no external URL loads,independent Kids refusal
**Acceptance:** ["Real contained authored texture positive/negative pixels; non-null slots refuse until genuinely supported; never null placeholders claiming texture binding", "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts tests/e2e/umbrella-editor-viewport-golden.test.ts && pnpm check:contracts"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": "325", "symbol": "setMaterialOverrides texture binding refusal"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Dependencies:** ["packages/schemas/src/desktop-scene-materials.ts", "packages/site-kit/src/mountable-scene.ts", "desktop/linux/src/renderer/viewport.ts", "sites/umbrella/src/app/_components/sculpt-viewport.tsx"]
**Evidence:** []

#### AP-01 — P0 / high / assets-plugins
**Root cause:** glTF flat deep node graph exhausts recursive traversal stack
**Mappings:** backlog []; requirements ['CORE-008'].
**Chosen solution:** Iterative deterministic traversal preserving cycle/multi-parent refusal, plus explicit node/depth/operation bounds and named existing refusal. No new format.
**Acceptance:** ["Deep chain/cycle/multi-parent public stage/propose/spawned CLI refuse without throw or writes; valid controls retain output/digests."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": 1227, "symbol": "parseGltf.visit"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": 1366, "symbol": "visit child recursion"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/contained-gltf.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
**Dependencies:** ["shared documentation owner for graph/resource limits", "CLI/desktop acceptance owners"]
**Commands:** ["pnpm exec vitest run packages/importers/test/contained-gltf.test.ts tests/e2e/asset-ingestion-golden.test.ts && pnpm gate"]
**Before/reproduction/impact/refutation:** {"reproduction": "Use admitted embedded-buffer3-vertex triangle. nodes=Array.from({length:2500},(_,i)=>i===2499?{mesh:0}:{children:[i+1]}); scenes=[{nodes:[0]}]. Call stageContainedGltfAssetImport with valid request then actual sceneaxi asset import --json.", "refutationAttempt": "100-node chain parses. JSON itself is shallow and input far below8MiB, so JSON-depth64/byte limits do not address graph recursion.", "actualImpact": "Public stage throws RangeError; real CLI returns INTERNAL exit1 rather than named validation refusal; synchronous desktop host can be interrupted by a small selected file.", "classification": "confirmed-local-defect", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "evidenceIds": ["E2", "E3", "E6", "E8"]}]

#### AP-02 — P1 / medium / assets-plugins
**Root cause:** Indexed triangle primitive rejects4-vertex shared-vertex square
**Mappings:** backlog []; requirements ['CORE-008'].
**Chosen solution:** Validate POSITION as complete VEC3; require vertexCount divisible by3 only for unindexed primitives. Indexed triplet and range checks remain unchanged.
**Acceptance:** ["Indexed4-vertex6-index square imports/reloads/canonical-byte roundtrips; unindexed4, non-triplet and out-of-range indices still refuse."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": 1254, "symbol": "parseGltf positions.length %9 guard"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/contained-gltf.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
**Commands:** ["pnpm exec vitest run packages/importers/test/contained-gltf.test.ts tests/e2e/asset-ingestion-golden.test.ts tests/e2e/asset-pipeline-golden.test.ts && pnpm gate"]
**Before/reproduction/impact/refutation:** {"reproduction": "POSITION Float32 count4 with coordinates[0,0,0,1,0,0,1,1,0,0,1,0]; uint16 indices[0,1,2,0,2,3]; embedded buffer, mode4. Public stage and actual CLI refuse ASSET_IMPORT_MALFORMED.", "refutationAttempt": "3-vertex control parses. Existing index validation demonstrates indexed triangles are admitted; this is not adding quad topology or broadening formats.", "actualImpact": "Routine valid indexed triangles with vertexCount not divisible by3 are rejected.", "classification": "confirmed-local-defect", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "evidenceIds": ["E7"]}]

#### AP-03 — P1 / medium / assets-plugins
**Root cause:** Current inspected plugin bytes are not bound to cached evaluated implementation
**Mappings:** backlog [75]; requirements [].
**Chosen solution:** Prefer immutable inspected graph fingerprints per process; refuse changed entrypoint/transitive bytes with existing named refusal and restart guidance. Do not uncontrolled-cache-bust or claim process sandboxing.
**Acceptance:** ["Repeated unchanged load deterministic; changed entry/transitive helper cannot expose stale code as current; refusals clear addressable old state; new-process load works."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/pipeline.ts", "line": 430, "symbol": "processCandidate import href"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/host.ts", "line": 80, "symbol": "load"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/pipeline.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/isolation.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/host.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/test/load-refuse.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/test/refuse-matrix.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
**Dependencies:** ["trusted-plugin lifecycle documentation"]
**Commands:** ["pnpm exec vitest run packages/plugin-host/test/load-refuse.test.ts packages/plugin-host/test/refuse-matrix.test.ts tests/e2e/plugin-capability-golden.test.ts && pnpm gate"]
**Before/reproduction/impact/refutation:** {"reproduction": "Trusted explicit package capabilities={}, host.load([root]); overwrite same entrypoint with capabilities={unexpected:42}; host.load([root]) still loaded1/refused0.", "refutationAttempt": "Version, descriptor and unknown capability refusal are enforced. Node caches entrypoint URL; a new host instance in same process does not invalidate it. No explicit promise of arbitrary hot reload is assumed; however repeated load inspects new bytes while exposing old code, so integrity must be bound or change refused.", "actualImpact": "Stale implementation can be exposed under metadata/inspection of current package; not claimed as hostile-code sandbox escape.", "classification": "confirmed-local-lifecycle-integrity-defect", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "evidenceIds": ["E8"]}]

#### AP-04 — P1 / medium / assets-plugins
**Root cause:** Deep Scene Document throws through importer public boundary
**Mappings:** backlog []; requirements ['CORE-008'].
**Chosen solution:** Bound/iterate shared JSON validation while retaining cycle/accessor/prototype semantics, plus bounded importer preflight/iterative freeze. Explicit safe local limits; no blanket success catch.
**Acceptance:** ["Public propose/apply deep input refuses without throw/write; supported depth and cyclic/accessor/prototype/duplicate refusal controls retain contract."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/index.ts", "line": 150, "symbol": "proposeSceneDocumentImport"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/index.ts", "line": 196, "symbol": "applySceneDocumentImport"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/document.ts", "line": 62, "symbol": "isJsonValueInner"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/index.ts", "line": 104, "symbol": "deepFreeze"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/document-import.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
**Dependencies:** ["packages/schemas/src/document.ts shared ownership", "normative document depth/resource decision"]
**Commands:** ["pnpm exec vitest run packages/importers/test/document-import.test.ts packages/schemas/test/document-proposal.test.ts packages/schemas/test/unambiguous-json.test.ts && pnpm check:contracts && pnpm gate"]
**Before/reproduction/impact/refutation:** {"reproduction": "In source.sceneaxi.json replace data.source with'{\"x\":'.repeat(7000)+'0'+'}'.repeat(7000). Both importer functions throw RangeError in schemas validator before target lookup.", "refutationAttempt": "Depth1000 source validation succeeds. Duplicate-member scanning is iterative; stack identifies shared document validator, not JSON syntax or duplicate parser. Recursive importer freeze is a second sensitivity.", "actualImpact": "Small~42KiB resource-hostile document is not converted to promised named validation envelope; shared callers may also be affected.", "classification": "confirmed-local-resource-validation-defect", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "evidenceIds": ["E8"]}]

#### AP-05 — P0 / high / assets-plugins
**Root cause:** In-root destination symlink hot reload overwrites unrelated project file
**Mappings:** backlog []; requirements ['CORE-008'].
**Chosen solution:** Inspect lexical destination symlink before canonical resolution; refuse regular/dangling in-root/out-root aliases, preserve canonical containment and copy race defenses.
**Acceptance:** ["Initial import/reload/recovery refuse alias and preserve unrelated/link/document/journal bytes; existing valid copy/recovery remains byte-identical."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": 1920, "symbol": "destinationFor canonicalTarget before lstat"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": 2124, "symbol": "copyEntry renameSync"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/contained-gltf.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
**Dependencies:** ["authoring/CLI/desktop owners only if acceptance/recovery ordering changes"]
**Commands:** ["pnpm exec vitest run packages/importers/test/contained-gltf.test.ts tests/e2e/asset-pipeline-golden.test.ts && pnpm gate"]
**Before/reproduction/impact/refutation:** {"reproduction": "Fresh valid composed project: assets/triangle.gltf -> root/unrelated.gltf holding identical source bytes. Public propose succeeds, apply, modify source, explicit hotReload:true with stable id, apply, materialize. Returns copiedPaths[assets/triangle.gltf], unrelated.gltf overwritten, symlink preserved.", "refutationAttempt": "Outside-root destination directory symlink refusal passes existing tests. Native source selection outside project is intentional. Confirmed only per-file in-root destination aliasing, not external escape.", "actualImpact": "Approved asset reload replaces unrelated same-root file and violates destination non-symlink ownership guarantee.", "classification": "confirmed-local-data-integrity-defect", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "evidenceIds": ["E5"]}]

#### AP-06 — P1 / medium / assets-plugins
**Root cause:** Search/filter/sort unnecessarily parked on inventory decision
**Mappings:** backlog [50]; requirements [].
**Chosen solution:** Pure deterministic bounded GET query/search over title/id/creator, admitted price-mode filter and stable sort; accessible mirrored forms/empty state. Preserve true counts, fixture TEST/inert labels, no new packages/matrix edge.
**Acceptance:** ["Deterministic filter/sort matching, no-result clear state, invalid/long query bounded, mirrored browser interactions and commerce refusal remain true."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/app/page.tsx", "line": 24, "symbol": "CataloguePage"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/app/page.tsx", "line": 71, "symbol": "descriptive facet rows"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/catalog.ts", "line": 109, "symbol": "LISTINGS"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/app/page.tsx", "line": 24, "symbol": "CataloguePage", "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/app/page.tsx", "line": 71, "symbol": "descriptive facet rows", "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/catalog.ts", "line": 109, "symbol": "LISTINGS", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["exact shared source ownership and mirrored storefront parity"]
**Commands:** ["pnpm exec vitest run packages/site-kit/test/catalog.test.ts tests/sites/catalog-storefronts.test.ts && pnpm gate; then existing pnpm build in each catalog install root and real loopback query/keyboard browser assertions"]
**Before/reproduction/impact/refutation:** {"reproduction": "Browse source ignores query parameters; facets are spans, all3Game/1Web fixtures always listed. Public listSiteCatalog returns unchanged inventory.", "refutationAttempt": "Honest design intentionally removed fake controls. No need to invent inventory/taxonomy to implement real query behavior over existing validated metadata.", "actualImpact": "No local browsing narrowing/order control despite available committed inventory.", "classification": "locally-implementable-missing-capability", "outcome": "OPEN_LOCAL_BUILDER_REQUIRED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "evidenceIds": ["E9", "source read page.tsx"]}]

#### AP-07 — P1 / high / assets-plugins
**Root cause:** One public capability and trusted-only host do not implement untrusted marketplace execution
**Mappings:** backlog [75]; requirements [].
**Chosen solution:** Maintain truthful trusted explicit local usage/default and no arbitrary untrusted loader. Fix AP-03 locally. Do not add speculative capability IDs or claim AST checking is permission sandbox.
**Acceptance:** ["Unknown capability/version/entry escape refuse before evaluation, current trusted capability works, no public sandbox claim or untrusted automatic load."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/plugins.md", "line": 273, "symbol": "Isolation and non-goals"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/index.ts", "line": 10, "symbol": "seam"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/plugins.md", "line": 273, "symbol": "Isolation and non-goals", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/src/index.ts", "line": 10, "symbol": "seam", "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
**Dependencies:** ["real separate trust/execution decision and implementation proof for untrusted use", "public capability contract owners for any justified registry addition"]
**Commands:** ["pnpm exec vitest run packages/plugin-host/test tests/e2e/plugin-capability-golden.test.ts && pnpm check:contracts"]
**Before/reproduction/impact/refutation:** {"reproduction": "Public pluginCapabilityRegistrySeed exactly one sculpt intake source capability; all missing IDs refused. Loading is explicit and same-process, package isolation not sandbox.", "refutationAttempt": "Host documentation expressly disclaims hostile-code sandbox; not a security defect merely because trusted plugin code can use ordinary Node host power.", "actualImpact": "Production untrusted plugin loading cannot safely be claimed from manifest/isolation checks.", "classification": "intentional-trust-boundary-and-production-input", "outcome": "BOUNDARY_PRESERVED_PRODUCTION_TRUST_INPUT_REQUIRED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "evidenceIds": ["E2", "E3", "E6", "E9"]}]

#### PK-001 — P1 / medium / profiles-kids
**Root cause:** No-op reset and same-world selection wrongly advance activity revision
**Mappings:** backlog [8]; requirements ['PROF-004', 'SURFACE-009'].
**Chosen solution:** Named safe no-change refusal in both byte-identical copies, no new state/revision on refusal; cover genuine change acceptance and play precedence
**Acceptance:** ["PK-E7 exit0", "Tests same-world with pieces, repeated reset, changed-world/reset acceptance, play-mode precedence, no refusal state", "cmp reducer copies exit0", "Targeted suites and unchanged full gate", "Production browser real buttons retain state on no-op"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-kids/src/kids-activity.ts", "line": "246", "symbol": "applyKidsActivityAction"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-kids/src/kids-activity.ts", "line": "265", "symbol": "applyKidsActivityAction"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/kids/src/lib/kids-activity.ts", "line": "246", "symbol": "applyKidsActivityAction"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/kids/src/lib/kids-activity.ts", "line": "265", "symbol": "applyKidsActivityAction"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/kids/src/app/_components/kids-studio.tsx", "line": "91", "symbol": "KidsStudio"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/kids/src/app/_components/kids-studio.tsx", "line": "136", "symbol": "KidsStudio"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/kids-first-release.md", "line": "50", "symbol": "no-op contract"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-kids/src/kids-activity.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "profiles-kids", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/kids/src/lib/kids-activity.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "profiles-kids", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-kids/test/activity.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "profiles-kids", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/sites/kids-surface.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Before/reproduction/impact/refutation:** {"reproduction": "PK-E7: initial state reset/current meadow both ok:true revision1 with unchanged content", "refutation": "Existing tests green; reviewed possibility of action-counter semantics, refuted by explicit owning doc revision counts real changes/no-op refusal", "impact": "State/evidence correctness drift; no privacy bypass claimed", "kind": "confirmed-local-defect", "status": "OPEN_ROUTED_TO_BUILDER"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "evidenceIds": ["PK-E7"]}]

#### PK-002 — P1 / high / profiles-kids
**Root cause:** Kids production-built front door/browser isolation unverified
**Mappings:** backlog [8]; requirements ['PROF-003', 'PROF-004', 'SURFACE-009'].
**Chosen solution:** Install/build/typecheck existing isolated root; production loopback browser drive all controls and capture request origins/types, CSP, cookie/storage/error and reduced-motion evidence; do not use dev exception
**Acceptance:** ["Real production route and controls hydrate/work", "Only own-origin application requests; no LLM/third-party requests", "No cookies or durable state", "Exact shipped connect-src none and denial headers", "Keyboard/reduced-motion and every curated control/limit asserted"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/kids/package.json", "line": "8-11", "symbol": "scripts"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/kids/src/lib/security-policy.ts", "line": "39", "symbol": "kidsSecurityHeadersForPhase"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/kids/security-headers.json", "line": "5", "symbol": "CSP"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/kids/src/app/_components/kids-studio.tsx", "line": "22", "symbol": "KidsStudio"}]
**File/symbol targets and exact owner:** [{"reference": "sites/kids/test/"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/kids/package.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/sites/kids-surface.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["Existing frozen lock install locally available", "Existing browser tooling/helpers"]
**Commands:** ["pnpm --dir sites/kids install --frozen-lockfile", "pnpm --dir sites/kids typecheck", "pnpm --dir sites/kids build", "pnpm --dir sites/kids start --hostname 127.0.0.1 --port <owned-port>"]
**Before/reproduction/impact/refutation:** {"reproduction": "sites/kids/node_modules absent at live observation; root tests cover pure reducers and policy strings only", "refutation": "Next phase/config and forbidden-source injections pass, but cannot refute hydration/served-policy/outbound traffic/cookie failures", "impact": "Production readiness/security evidence missing; not proof of a privacy defect", "kind": "local-coverage-gap", "status": "OPEN_LOCAL_NOT_EXTERNAL"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "evidenceIds": ["PK-E1", "PK-E2"]}]

#### PK-004 — P2 / medium / profiles-kids
**Root cause:** Broad Web use cases not independently demonstrated
**Mappings:** backlog [76]; requirements ['PROF-002'].
**Chosen solution:** Deterministic bounded hero/configurator/storytelling/microsite fixture workflows with actual authoring/state/replay assertions; keep unavailable real-time data capability explicit, no CMS/SaaS/script eval/unreviewed fetch
**Acceptance:** ["Actual fixture state/HTML/canvas outcomes", "Malformed input refusals and pinned replay digest", "Real browser controls if site behavior touched", "Unsupported data-driven real-time behavior remains visibly open"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-web/src/index.ts", "line": "36", "symbol": "WEB_EXPERIENCE_SCOPES"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-web/src/index.ts", "line": "172", "symbol": "mvpGoldenPath"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/profile-web-golden-path.test.ts", "line": "24", "symbol": "generic golden"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-web/test/experience-scenarios.test.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "profiles-kids", "baselineSourceReadOnly": true}, {"reference": "tests/e2e/fixtures/profile-web/"}]
**Dependencies:** ["Use existing bounded public helpers only", "Coordinate real emitted-control tests with sites-ui"]
**Commands:** ["pnpm exec vitest run packages/profile-web/test tests/e2e/profile-web-golden-path.test.ts tests/sites/web-experience-editor.test.ts", "pnpm gate"]
**Before/reproduction/impact/refutation:** {"reproduction": "One generic core fixture plus scope-label tests; no complete per-use-case evidence for all PROF-002 experience classes", "refutation": "Existing Web subset/sandbox tests prove HTML/site canvas behavior but not every broad product or live data source", "impact": "Requirement completeness cannot be inferred from scope allowlist", "kind": "local-use-case-evidence-capability-gap", "status": "OPEN_LOCAL_COVERAGE_CAPABILITY"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "evidenceIds": ["PK-E1", "PK-E3"]}]

#### CLI-001 — P1 / high / cli
**Root cause:** Use Object.hasOwn for command child lookup at every depth; never traverse inherited properties.
**Mappings:** backlog []; requirements ['SURFACE-001'].
**Chosen solution:** Use Object.hasOwn for command child lookup at every depth; never traverse inherited properties.
**Acceptance:** ["pnpm build && pnpm exec vitest run packages/cli/test/refusal.test.ts packages/cli/test/bin-smoke.test.ts; both reproductions plus constructor/__proto__/toString at all group depths produce exit2 UNKNOWN_COMMAND schema1 JSON, empty stderr, no throw."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts", "line": "273", "symbol": "walk"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/refusal.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/bin-smoke.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Before/reproduction/impact/refutation:** {"reproduction": ["node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs constructor x --json", "node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs project __proto__ x --json"], "observed": "exit1, empty stdout, raw stderr TypeError: Cannot read properties of undefined (reading 'x')", "refutationAttempt": "Ordinary unknown commands correctly refuse; reproduced at root and nested group using actual built binary, not a mocked dispatcher.", "impact": "Unknown inherited object names escape the versioned protocol, expose stack paths and defeat deterministic UNKNOWN_COMMAND exit2 behavior; no mutation or held-key bypass observed.", "kind": "defect"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "evidenceIds": []}]

#### CLI-002 — P2 / medium / cli
**Root cause:** Allow bare version success only after rejecting remaining non-global tokens; preserve legal aliases and JSON/text parity.
**Mappings:** backlog []; requirements [].
**Chosen solution:** Allow bare version success only after rejecting remaining non-global tokens; preserve legal aliases and JSON/text parity.
**Acceptance:** ["pnpm build && pnpm exec vitest run packages/cli/test/refusal.test.ts packages/cli/test/bin-smoke.test.ts packages/cli/test/json-equivalence.test.ts; reproductions exit2 UNKNOWN_FLAG or AMBIGUOUS_INPUT; bare -v/-V/--version stays exit0."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts", "line": "138", "symbol": "dispatch"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/refusal.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/bin-smoke.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Before/reproduction/impact/refutation:** {"reproduction": ["node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs --version --nonsense --json", "node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs --version --document x --json"], "observed": "exit0 schema1 ok=true cliVersion0.0.0 despite leftover unknown flags/tokens", "refutationAttempt": "Valued global switches correctly refuse AMBIGUOUS_INPUT and ordinary unknown flags exit2; defect isolated to early bare-version branch.", "impact": "Version shortcut silently accepts invalid invocations, contrary to fail-closed argument contract; no operation executed.", "kind": "defect"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "evidenceIds": []}]

#### CLI-003 — P1 / high / cli
**Root cause:** Validate finite nonnegative clock/budget and finite parsed timestamp; refuse negative age and invalid freshness configuration before any allow. Preserve currency-before-snapshot ordering and the default24h budget.
**Mappings:** backlog [78]; requirements ['HOLD-001'].
**Chosen solution:** Validate finite nonnegative clock/budget and finite parsed timestamp; refuse negative age and invalid freshness configuration before any allow. Preserve currency-before-snapshot ordering and the default24h budget.
**Acceptance:** ["pnpm build && pnpm exec vitest run packages/cli/test/held-keys.refusal-table.test.ts packages/cli/test/held-keys.regressions.test.ts packages/cli/test/held-keys.command-map.test.ts; future/NaN/Infinity/negative runtime tests refuse with HELD_KEY, fresh exact budget remains documented, NvsN+1 and offline/env regressions unchanged."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/gate.ts", "line": "177", "symbol": "evaluateHeldKeyGate"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/gate.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/held-keys.refusal-table.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/held-keys.regressions.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Dependencies:** ["Shared schema/doc owner only if adding new refusal names; reuse existing named refusals where semantically accurate."]
**Before/reproduction/impact/refutation:** {"reproduction": "Register existing workspace-dist-resolver.mjs and import public @sceneaxi/cli. Generate synthetic epoch3 all-resolved fixture snapshot; use map epoch3, static fixture authority3 and clock2026-07-20T13:00:00Z. Evaluate demo gated with generatedAt2099, now()=>NaN, freshnessBudgetMsNaN, or freshnessBudgetMsInfinity plus clock2099.", "observed": "All four malformed freshness cases allow=true; ordinary stale snapshot refuses, unavailable authority refuses, authoritative4 refuses.", "refutationAttempt": "Used only existing synthetic fixture authority/keys; confirmed fresh sanity, normal stale and both mandatory currency refusals alongside each bad input. No real snapshot or authority issued.", "impact": "Exported injectable gate reports established freshness for future or nonfinite runtime values; currently no reachable shipped-binary bypass because default sentinel remains unavailable. Any future trusted adapter inherits this weakness.", "kind": "defect"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "evidenceIds": []}]

#### CLI-004 — P2 / medium / cli
**Root cause:** Do not enter process watch mode for help/version or malformed global switches; route introspection through normal dispatch without registering watchers.
**Mappings:** backlog [74]; requirements [].
**Chosen solution:** Do not enter process watch mode for help/version or malformed global switches; route introspection through normal dispatch without registering watchers.
**Acceptance:** ["pnpm build && pnpm exec vitest run packages/cli/test/bin-smoke.test.ts; reproduction naturally exits0 once with ordinary help JSON and no mode/cycle/watch, while actual edit+SIGINT watch regressions continue passing."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/run.ts", "line": "40", "symbol": "watchArguments; :85 main"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/run.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/bin-smoke.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Before/reproduction/impact/refutation:** {"reproduction": "In owned temporary project, create scene.json with real project new; spawn node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs project dev --document scene.json --watch --help --json.", "observed": "Process still running600ms after printing help decorated with mode=watch cycle1; SIGINT required and emits stopped cycle1.", "refutationAttempt": "Real spawned binary and valid project; explicit SIGINT proves it is watch ownership rather than ordinary startup slowness. Existing ordinary watch-edit-stop tests pass.", "impact": "Help invocation allocates persistent watchers and hangs automation. Help without document returns immediately, so normal help probes miss this defect.", "kind": "defect"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "evidenceIds": []}]

#### CLI-005 — P3 / low / cli
**Root cause:** Document watch streaming, SIGINT lifecycle and limitation of synchronous runCli; replace reserved/skeleton wording with implemented refusal semantics.
**Mappings:** backlog [74, 78, 84]; requirements [].
**Chosen solution:** Document watch streaming, SIGINT lifecycle and limitation of synchronous runCli; replace reserved/skeleton wording with implemented refusal semantics.
**Acceptance:** ["pnpm exec vitest run packages/cli/test/bin-smoke.test.ts packages/cli/test/exit-codes.golden.test.ts; docs match emitted streaming behavior without implying shipping or sentinel readiness."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/README.md", "line": "148", "symbol": "Current refusals; /home/devuser/Documents/Projects/sceneaxi/packages/cli/src/exit-codes.ts:24 ExitCode"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/README.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/exit-codes.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Dependencies:** ["docs owner for dated gap list/current runnable map"]
**Before/reproduction/impact/refutation:** {"reproduction": "Compare README NOT_IMPLEMENTED watch refusal and reserved/skeleton exit3 comment against spawned watch tests and actual demo gated exit3.", "observed": "Both categorical statements are stale; watch works and exit3 is active.", "refutationAttempt": "Re-executed21 files233 tests, including live watch and required currency regressions; actual demo gated refuses currency-unavailable, not NOT_IMPLEMENTED.", "impact": "Users avoid implemented watch feature or misunderstand held-key refusal as missing enforcement.", "kind": "documentation-drift"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "evidenceIds": []}]

#### CLI-CAP-01 — P2 / medium / cli
**Root cause:** play/run and build/export discoverability
**Mappings:** backlog [65, 77]; requirements [].
**Chosen solution:** Use existing permission-bound desktop bridge tools, not engine imports or matrix widening. Optional thin aliases must share bridge validation and refusal.
**Acceptance:** ["pnpm build && pnpm exec vitest run packages/cli/test/desktop-bridge.test.ts packages/cli/test/bin-smoke.test.ts tests/e2e/desktop-cli-local-bridge-golden.test.ts; document exact existing tool names/permissions, no-host refusal and Web/local build versus native signing boundaries."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/README.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/desktop-verbs.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Evidence:** []

#### CLI-CAP-02 — P2 / medium / cli
**Root cause:** asset remove
**Mappings:** backlog [77]; requirements [].
**Chosen solution:** Implement only by existing E1/permission-bound desktop remove tool where currently admitted; never delete source files silently or create a second importer authority.
**Acceptance:** ["pnpm build && pnpm exec vitest run packages/cli/test tests/e2e/asset-pipeline-golden.test.ts; absent/unknown stable id refuses; no mutation before review/apply; imports/reload parity and containment retained."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/asset-verbs.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Evidence:** []

#### CLI-CAP-03 — P2 / medium / cli
**Root cause:** plugin list/load/validate
**Mappings:** backlog [77]; requirements [].
**Chosen solution:** Expose read-only registry/capability validation where allowed via schemas or desktop tool; executable load remains bounded trusted-plugin authority, never a claimed sandbox or direct plugin-host import.
**Acceptance:** ["pnpm check:boundaries && pnpm build && pnpm exec vitest run packages/cli/test tests/e2e/importers-plugin-golden.test.ts tests/e2e/plugin-capability-golden.test.ts; list/validate no provider or code execution, unsupported capability/load refusal truthful."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/registry-verbs.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Evidence:** []

#### CLI-CAP-04 — P2 / medium / cli
**Root cause:** evidence show/verify
**Mappings:** backlog [77]; requirements [].
**Chosen solution:** Reuse existing project report/readEvidencePacket and project test/contentHash; compare claimed document hash against contained current document, not merely packet-internal pass labels.
**Acceptance:** ["pnpm build && pnpm exec vitest run packages/cli/test; capture/show/verify succeeds for unchanged bytes; edited document, forged digest, malformed packet and escaping path refuse nonzero. Never attest browser/native/provider/legal evidence from a packet."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/project-lifecycle.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/registry-verbs.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Evidence:** []

#### CLI-CAP-05 — P2 / medium / cli
**Root cause:** catalog submit
**Mappings:** backlog [77]; requirements [].
**Chosen solution:** Offer offline validation/proposal or existing bounded intake tool only; maintain commerce/curation/provenance/storage activation refusals.
**Acceptance:** ["pnpm build && pnpm exec vitest run packages/cli/test; validate locally without publication/network/spend; missing storage or activation refuses, metadataComplete never becomes approval."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/registry-verbs.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Evidence:** []

#### CLI-CAP-06 — P2 / medium / cli
**Root cause:** project migrate
**Mappings:** backlog [77]; requirements [].
**Chosen solution:** Version1 already-current validation can be exposed locally; no invented conversion rules or destructive migration. Unknown versions refuse until schema-owned reversible conversion exists.
**Acceptance:** ["pnpm build && pnpm exec vitest run packages/cli/test; already-current document byte-identical, unsupported version named refusal, no overwrite/partial migration."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/project-lifecycle.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Evidence:** []

#### CLI-CAP-07 — P2 / medium / cli
**Root cause:** template init
**Mappings:** backlog [77]; requirements [].
**Chosen solution:** Use contained checked-in admitted local template through existing document/proposal helpers, retaining no-overwrite and review behavior. Document plain project new --data versus openable composed-scene initialization.
**Acceptance:** ["pnpm build && pnpm exec vitest run packages/cli/test/bin-smoke.test.ts; init in fresh contained temp root, test/openable-scene import succeeds, repeat init refuses overwrite, unknown/escaping template refuses."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/project-lifecycle.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/README.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** []

#### CLI-PACK-01 — P1 / medium / cli
**Root cause:** outsider-runnable distributable CLI
**Mappings:** backlog [7, 79]; requirements [].
**Chosen solution:** Prepare local self-contained compiled archive/consumer fixture without publishing or changing established source-backed workspace exports. Do not pretend existing manifest tarball is runnable.
**Acceptance:** ["An owned temporary extracted artifact outside repository with no root scripts or workspace node_modules must run real binary help/version/lifecycle via stock supported Node. pnpm check:publish-ready, pnpm check:boundaries and unchanged pnpm gate remain green. No publish/private/version/license flip."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/package.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** []

#### SH-T01 — P1 / medium / shells
**Root cause:** Sentinel absent from500; state200 after error; expected named diagnostics preserved.
**Mappings:** backlog []; requirements [].
**Chosen solution:** Sentinel absent from500; state200 after error; expected named diagnostics preserved.
**Acceptance:** ["Sentinel absent from500; state200 after error; expected named diagnostics preserved."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/inspector-app.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/dev-server.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Commands:** ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/inspector-app.test.ts /home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/dev-server.test.ts"]
**Evidence:** []

#### SH-T02 — P1 / medium / shells
**Root cause:** Repeat real Chromium E3 with root replacement, cleared rejected diff and aborted/nonJSON/uncertain Accept, explicit accessible feedback and no pageerror; no writes until accept and CLI byte parity.
**Mappings:** backlog []; requirements [].
**Chosen solution:** Repeat real Chromium E3 with root replacement, cleared rejected diff and aborted/nonJSON/uncertain Accept, explicit accessible feedback and no pageerror; no writes until accept and CLI byte parity.
**Acceptance:** ["Repeat real Chromium E3 with root replacement, cleared rejected diff and aborted/nonJSON/uncertain Accept, explicit accessible feedback and no pageerror; no writes until accept and CLI byte parity."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/inspector-app.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Commands:** ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/inspector-app.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/parity/shell-cli-parity.test.ts"]
**Evidence:** []

#### SH-T03 — P1 / medium / shells
**Root cause:** GUI effective binding and persisted map actually change, approval/stale/Kids refused; keyboard changes observed; no assertion weakening.
**Mappings:** backlog [53]; requirements [].
**Chosen solution:** GUI effective binding and persisted map actually change, approval/stale/Kids refused; keyboard changes observed; no assertion weakening.
**Acceptance:** ["GUI effective binding and persisted map actually change, approval/stale/Kids refused; keyboard changes observed; no assertion weakening."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["desktop-linux real host/input acceptance"]
**Commands:** ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-linux-bridge-golden.test.ts"]
**Evidence:** []

#### SH-T04 — P1 / medium / shells
**Root cause:** Real GUI→host typed operations stage then Save canonical changes; reject unchanged; bad references/stale hash refused.
**Mappings:** backlog [53]; requirements [].
**Chosen solution:** Real GUI→host typed operations stage then Save canonical changes; reject unchanged; bad references/stale hash refused.
**Acceptance:** ["Real GUI→host typed operations stage then Save canonical changes; reject unchanged; bad references/stale hash refused."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-prefab-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Commands:** ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-prefab-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts"]
**Evidence:** []

#### SH-T05 — P1 / medium / shells
**Root cause:** GUI source changes real single viewport owner; physics replay deterministic and read-only; invalid/Kids refused.
**Mappings:** backlog [53]; requirements [].
**Chosen solution:** GUI source changes real single viewport owner; physics replay deterministic and read-only; invalid/Kids refused.
**Acceptance:** ["GUI source changes real single viewport owner; physics replay deterministic and read-only; invalid/Kids refused."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["desktop/linux/src/renderer/viewport.ts", "desktop/linux/src/renderer/viewport-playback.ts"]
**Commands:** ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-play-session-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-physics-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts"]
**Evidence:** []

#### SH-T06 — P1 / medium / shells
**Root cause:** GUI uses inspected contained locator/digests/approval and real lock changes; escape/stale/Kids refuse, no network marketplace activation.
**Mappings:** backlog [53, 57]; requirements [].
**Chosen solution:** GUI uses inspected contained locator/digests/approval and real lock changes; escape/stale/Kids refuse, no network marketplace activation.
**Acceptance:** ["GUI uses inspected contained locator/digests/approval and real lock changes; escape/stale/Kids refuse, no network marketplace activation."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-package-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["assets-plugins contained lock/locator semantics", "desktop-linux"]
**Commands:** ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-package-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts"]
**Evidence:** []

#### SH-T07 — P1 / medium / shells
**Root cause:** Actual GUI migration review/commit changes owned fixture; extension id/capability approval reaches host or genuine typed refusal; no arbitrary sandbox claim.
**Mappings:** backlog [53, 57]; requirements [].
**Chosen solution:** Actual GUI migration review/commit changes owned fixture; extension id/capability approval reaches host or genuine typed refusal; no arbitrary sandbox claim.
**Acceptance:** ["Actual GUI migration review/commit changes owned fixture; extension id/capability approval reaches host or genuine typed refusal; no arbitrary sandbox claim."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["authoring migration/journal authority", "desktop-linux approved extension host"]
**Commands:** ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-extension-seams-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-project-lifecycle-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts"]
**Evidence:** []

#### SH-T08 — P2 / medium / shells
**Root cause:** 120-turn/UTF8/response bounds and concurrent admission; mode capture/ledger/debit/Kids unchanged; honest truncation, no late debit race.
**Mappings:** backlog []; requirements [].
**Chosen solution:** 120-turn/UTF8/response bounds and concurrent admission; mode capture/ledger/debit/Kids unchanged; honest truncation, no late debit race.
**Acceptance:** ["120-turn/UTF8/response bounds and concurrent admission; mode capture/ledger/debit/Kids unchanged; honest truncation, no late debit race."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/panel-support.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/assistant-panel.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/account-panel.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Dependencies:** ["account-panel shared queue tests", "schemas/doc vocabulary owner if contract additions needed"]
**Commands:** ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/assistant-panel.test.ts /home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/account-panel.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/assistant-panel-golden.test.ts"]
**Evidence:** []

#### DL-SEC-01 — P1 / high / desktop-linux
**Root cause:** Validate HTTPS/no-userinfo/approved origin and port before key reads, redirect:error, bounded body parse; reuse existing refusal.
**Mappings:** backlog [59]; requirements ['DESK-006'].
**Chosen solution:** Validate HTTPS/no-userinfo/approved origin and port before key reads, redirect:error, bounded body parse; reuse existing refusal.
**Acceptance:** ["Forbidden HTTP/userinfo/port/PRC/untrusted origin reads zero keys/fetches; approved HTTPS positive; redirects/body limits/timeouts redact; initial HTTP spy is failing-before oracle."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/live-transport.ts", "line": 70, "symbol": "createDesktopOpenCodeLiveTransport"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/live-transport.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/desktop/desktop-opencode-live-transport.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Commands:** ["pnpm exec vitest run tests/desktop/desktop-opencode-live-transport.test.ts tests/e2e/desktop-assistant-scene-loop-golden.test.ts", "pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux build", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged", "pnpm gate"]
**Before/reproduction/impact/refutation:** {"reproduction": "Public factory apiBase http://opencode.ai/zen/v1, injected fetch spy/fixture accessor; session.run valid Game profile. Observed http: bearerPresent true and default-follow redirects.", "refutation": "HTTPS positive fetches; PRC/untrusted hosts zero fetch; default GUI uses fixed HTTPS. No actual key leaked.", "impact": "Privileged configurable API base violates HTTPS-only credential transport before eventual output validation.", "status": "CONFIRMED_LOCAL"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "evidenceIds": ["provider-origin-probe"]}]

#### DL-BYOK-02 — P1 / high / desktop-linux
**Root cause:** Provider-specific injected runtime availability; unsupported OpenRouter unavailable/fixture-only, preserve Remove. Do not invent model pin/live provider.
**Mappings:** backlog [59]; requirements ['DESK-006', 'DESK-010'].
**Chosen solution:** Provider-specific injected runtime availability; unsupported OpenRouter unavailable/fixture-only, preserve Remove. Do not invent model pin/live provider.
**Acceptance:** ["OpenRouter unavailable in actual opencode composition; opencode ready only with runner; encrypted replace/remove/locked/Kids remain; selected unavailable provider does not imply another provider usable."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/byo-configuration.ts", "line": 82, "symbol": "createDesktopByoConfiguration"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/byo-configuration.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/provider-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/byo-configuration.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/desktop/desktop-byo-secure-storage.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Commands:** ["pnpm exec vitest run tests/desktop", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged"]
**Before/reproduction/impact/refutation:** {"reproduction": "Configured OpenRouter fixture key with opencode-only runtime: status runtime ready; actual runner reads opencode and refuses missing key.", "refutation": "Key storage/removal supports both; actual runner intentionally opencode-only; no secret or credits cross boundary.", "impact": "Misleading readiness/provider configuration and Send target mismatch.", "status": "CONFIRMED_LOCAL"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "evidenceIds": ["provider-readiness-probe"]}]

#### DL-COV-03 — P1 / high / desktop-linux
**Root cause:** Extend existing smoke with isolated typed dialog port and actual controls: New/Open/Recent/Save/Undo/Redo, hierarchy/transform, import/reload, Local Ask/Build/approve/apply/cancel/timeout, Play/Export and current registered actions. Keep fixture/live distinction.
**Mappings:** backlog [53, 61]; requirements ['DESK-004', 'DESK-005', 'DESK-010', 'SURFACE-004'].
**Chosen solution:** Extend existing smoke with isolated typed dialog port and actual controls: New/Open/Recent/Save/Undo/Redo, hierarchy/transform, import/reload, Local Ask/Build/approve/apply/cancel/timeout, Play/Export and current registered actions. Keep fixture/live distinction.
**Acceptance:** ["Each required action has typed-input/result/bytes/hash/reopen/frame oracle, no skipped/weakened assertions; 3 consecutive full packaged runs and real captures."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke.mjs", "line": 78, "symbol": "smoke assertion inventory"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
**Dependencies:** ["shells-builder:#53 exact typed GUI inputs", "engine-builder:#64 audio"]
**Commands:** ["pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux build", "pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux dist", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged", "pnpm gate"]
**Before/reproduction/impact/refutation:** {"reproduction": "Fresh packaged smoke passes old transforms/browser/undo/export only; main.ts native New/Open cancels in SMOKE; no packaged current assistant/hierarchy/Redo/import-reload/new control oracle.", "refutation": "Lower-layer goldens pass and existing smoke is genuine WebGL; neither covers missing GUI front doors.", "impact": "Lower-layer green does not detect full-editor renderer/host/control regressions.", "status": "CONFIRMED_COVERAGE_GAP"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "evidenceIds": ["packaged", "desktop-tests"]}]

#### DL-COV-04 — P2 / medium / desktop-linux
**Root cause:** Synchronize exact browser-ready/selection result revision, bounded diagnostics, not global data-busy or arbitrary sleep inflation.
**Mappings:** backlog [60, 61]; requirements [].
**Chosen solution:** Synchronize exact browser-ready/selection result revision, bounded diagnostics, not global data-busy or arbitrary sleep inflation.
**Acceptance:** ["Repeat both documented paths with unchanged selection/frame predicates; retain initial failure and route reproducible failure within three passes."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": 837, "symbol": "browserUiOpen waitFor"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
**Dependencies:** ["shells browser readiness"]
**Commands:** ["xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged"]
**Before/reproduction/impact/refutation:** {"reproduction": "First Xvfb runtime asset selector/open false and restart scene.json; D-Bus retry and fresh package runs pass unchanged.", "refutation": "Not reproducible permanent asset defect; no historical GPU SIGSEGV observed.", "impact": "Transient real front-door smoke failure requires explicit evidence, not silent green aggregate.", "status": "UNRESOLVED_ENVIRONMENT_OR_TIMING"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "evidenceIds": ["smoke-before", "smoke-refutation", "packaged"]}]

#### DL-HARD-05 — P2 / medium / desktop-linux
**Root cause:** Deterministic inline script hashes, strict local-only CSP, explicit permission denial and main-frame/document IPC sender verification; network stays privileged.
**Mappings:** backlog []; requirements [].
**Chosen solution:** Deterministic inline script hashes, strict local-only CSP, explicit permission denial and main-frame/document IPC sender verification; network stays privileged.
**Acceptance:** ["Actual enforced CSP permits real existing chrome/viewport and refuses injected remote script/frame/permission/non-main IPC; no unsafe-eval/matrix widening."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/chrome-document.ts", "line": 82, "symbol": "desktopLinuxIndexHtml"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/chrome-document.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
**Dependencies:** ["shells inline-script hash/control owner"]
**Commands:** ["pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux check:renderer", "pnpm exec vitest run tests/desktop tests/boundary/injected-desktop-violations.test.ts", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged", "pnpm gate"]
**Before/reproduction/impact/refutation:** {"reproduction": "Built Electron warning lacks CSP; emitter adds only runtime meta and renderer script.", "refutation": "Sandbox/context isolation/no Node/navigation and window-open denial exist; no XSS exploit demonstrated.", "impact": "Missing defense-in-depth around privileged bridge renderer.", "status": "CONFIRMED_HARDENING_GAP_NO_EXPLOIT"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "evidenceIds": ["smoke-before", "renderer"]}]

#### DL-PRIV-06 — P2 / medium / desktop-linux
**Root cause:** Recommended local default: raw dump opt-out unless explicit local consent; retain redacted diagnostics/recovery and no automatic sharing.
**Mappings:** backlog [54]; requirements ['DESK-006'].
**Chosen solution:** Recommended local default: raw dump opt-out unless explicit local consent; retain redacted diagnostics/recovery and no automatic sharing.
**Acceptance:** ["Default/BYOK sessions no raw dumps; structured local event/reload still pass; synthetic consent/retention/removal tests without real secrets."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": 129, "symbol": "crashReporter.start"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/diagnostics.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
**Dependencies:** ["docs owner local consent/retention/sharing copy"]
**Commands:** ["pnpm exec vitest run tests/desktop", "dbus-run-session -- xvfb-run -a node /home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke-diagnostics.mjs"]
**Before/reproduction/impact/refutation:** {"reproduction": "Crash reporter enabled no-upload; diagnostics.ts:110-129 keeps raw dumps and explicitly warns decrypted BYOK memory possible.", "refutation": "No upload or arbitrary stacks/messages in structured logs; no secret-leak test performed; real renderer recovery passes.", "impact": "Raw local minidumps cannot be described as redacted diagnostics.", "status": "CONFIRMED_SENSITIVE_DUMP_POLICY_GAP_NO_LEAK_OBSERVED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "evidenceIds": ["diagnostics"]}]

#### DL-DOC-07 — P2 / medium / desktop-linux
**Root cause:** Reconcile actual Local Ask/Build/approve/apply, fixture/live provider state and fresh limited package proof.
**Mappings:** backlog [84]; requirements [].
**Chosen solution:** Reconcile actual Local Ask/Build/approve/apply, fixture/live provider state and fresh limited package proof.
**Acceptance:** ["Docs parity based on actual controls/evidence; no unpublished local offer promoted."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/README.md", "line": 99, "symbol": "assistant Ask description"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/README.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["DL-COV-03"]
**Commands:** ["pnpm check:traceability", "pnpm check:contracts"]
**Before/reproduction/impact/refutation:** {"reproduction": "README says Ask refuses; assistant-start.ts:69 admits ask, viewport.ts:720-727 routes assistant-ask.", "refutation": "Agent rarity fixture and Hosted refusal are distinct intentional routes, not live provider proof.", "impact": "Outdated user guidance and lower-layer/packaged claims conflated.", "status": "CONFIRMED_LOCAL_DOC_DRIFT"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "evidenceIds": ["desktop-tests", "packaged"]}]

#### DL-PERF-08 — P2 / medium / desktop-linux
**Root cause:** Existing-smoke/golden bounded maximum asset, repeated import/reload/play/export, teardown/resource plateau and latency assertions; no widened limits.
**Mappings:** backlog []; requirements [].
**Chosen solution:** Existing-smoke/golden bounded maximum asset, repeated import/reload/play/export, teardown/resource plateau and latency assertions; no widened limits.
**Acceptance:** ["Measured bounds with platform identified, resource teardown/plateau and physical-GPU coverage separately recorded."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/viewport-playback.ts", "line": 121, "symbol": "mountDesktopScene"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/asset-ingestion-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["engine-presentation owner resource counters if needed"]
**Commands:** ["pnpm exec vitest run tests/e2e/asset-ingestion-golden.test.ts tests/desktop", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged"]
**Before/reproduction/impact/refutation:** {"reproduction": "Small synthetic models/software renderer only; no maximum admitted assets or sustained hot reload/mount/performance proof.", "refutation": "Three backend unmount disposes subtree and imported caches; do not claim missing disposal/memory leak.", "impact": "Production responsiveness/resource limits unvalidated.", "status": "COVERAGE_GAP_NO_LEAK_ASSERTED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "evidenceIds": ["packaged", "renderer"]}]

#### DR-001 — P1 / high / desktop-release
**Root cause:** Parse flags; add real Windows packaged integrity/signature/runtime/pixels branch; named non-Windows refusal
**Mappings:** backlog [55, 56]; requirements ['REL-001'].
**Chosen solution:** Parse flags; add real Windows packaged integrity/signature/runtime/pixels branch; named non-Windows refusal
**Acceptance:** ["E12 exits 0 after real command refuses Linux", "default Windows smoke unchanged", "genuine native smoke --packaged requires recorded signed bytes and real pixels"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/smoke.mjs", "line": 1, "symbol": "top-level smoke entry"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/package.json", "line": 21, "symbol": "scripts.smoke"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/smoke.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}]
**Dependencies:** ["shared-root-test-owner", "docs-owner", "EXT-RELEASE for native pass"]
**Before/reproduction/impact/refutation:** {"reproduction": "E04/E12 real pnpm smoke --packaged on Linux", "refutation": "Default static smoke is intentional; silently accepting explicit --packaged rather than refusing or validating is not native acceptance.", "impact": "False-positive packaged verification channel; no Windows native smoke contract", "category": "verification", "status": "confirmed-reproduced"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "evidenceIds": ["E03", "E04", "E12"]}]

#### DR-002 — P1 / high / desktop-release
**Root cause:** Always build --publish never; independent validation/native acceptance before separate explicit draft uploader
**Mappings:** backlog [55, 56]; requirements [].
**Chosen solution:** Always build --publish never; independent validation/native acceptance before separate explicit draft uploader
**Acceptance:** ["verification failure invokes zero uploader calls", "token/tag/real draft checks preserved", "pnpm exec vitest run tests/desktop/desktop-windows-packaging.test.ts"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release.mjs", "line": 62, "symbol": "packageWindowsRelease publish:onTagOrDraft"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs", "line": 19, "symbol": "packageWindowsRelease"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs", "line": 53, "symbol": "SignTool verify after publisher"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}]
**Dependencies:** ["DR-001", "DR-003", "later separate upload authority"]
**Before/reproduction/impact/refutation:** {"reproduction": "Read-only control-flow assertion: publisher command precedes output validation, signtool and SHA256SUMS", "refutation": "Force signing, existing draft check and draft-only provider protect visibility but do not enforce independent verify-before-upload.", "impact": "Failed candidate can mutate external draft assets before final acceptance; not a demonstrated public-release bypass", "category": "release-phase-ordering", "status": "source-confirmed-external-path-unexecuted"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "evidenceIds": ["E07", "source inspection"]}]

#### DR-003 — P1 / high / desktop-release
**Root cause:** Refuse nonempty output; verify clean HEAD; write exact non-linkable local candidate manifest and independently verified artifact/update facts
**Mappings:** backlog [55, 56]; requirements [].
**Chosen solution:** Refuse nonempty output; verify clean HEAD; write exact non-linkable local candidate manifest and independently verified artifact/update facts
**Acceptance:** ["prior output unchanged on refusal", "commit mismatch/dirty checkout/duplicates/traversal rejected", "pnpm exec vitest run tests/desktop/desktop-windows-packaging.test.ts"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release-preflight.mjs", "line": 16, "symbol": "windowsReleasePreflight"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/dist.mjs", "line": 13, "symbol": "rmSync release"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release.mjs", "line": 61, "symbol": "rmSync release"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs", "line": 57, "symbol": "installer checksum output"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release-preflight.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/dist.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/release.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/package-release.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}]
**Dependencies:** ["shared tests/docs", "EXT-RELEASE actual signing"]
**Before/reproduction/impact/refutation:** {"reproduction": "Source shows unconditional erase after preflight and no clean HEAD/candidate provenance checks; refused public paths E06/E07", "refutation": "Signing proves publisher, not clean source; macOS has clean SHA/nonempty-output guards that Windows lacks.", "impact": "Loss of prior candidates; unbound source/run/size/update metadata", "category": "provenance-lifecycle", "status": "source-confirmed-destructive-path-unexecuted"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "evidenceIds": ["E06", "E07", "source inspection"]}]

#### DR-004 — P1 / high / desktop-release
**Root cause:** Explicit disabled-by-default verified release/feed policy; redacted failure status; retain signature guards
**Mappings:** backlog [56]; requirements [].
**Chosen solution:** Explicit disabled-by-default verified release/feed policy; redacted failure status; retain signature guards
**Acceptance:** ["packaged+config-only calls zero ports", "smoke calls zero", "explicit validated configured release calls one", "pnpm exec vitest run tests/desktop/desktop-windows-packaging.test.ts"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/lib/update-policy.ts", "line": 27, "symbol": "runWindowsUpdateCheck"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/electron/main.ts", "line": 30, "symbol": "bootstrap update check"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/electron-builder.yml", "line": 25, "symbol": "win.publish"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/lib/update-policy.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/src/electron/main.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/build.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/electron-builder.yml", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["DEC-10", "DR-003"]
**Before/reproduction/impact/refutation:** {"reproduction": "E10 configuration-only packaged input calls updater port once", "refutation": "Smoke/absence/error guards and signature verification exist; generated config is not verified release evidence. No actual network or unsigned install alleged.", "impact": "Packaged launches can reach update/download network before verified release policy", "category": "update-policy", "status": "confirmed-exported-port-reproduction"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "evidenceIds": ["E10"]}]

#### DR-005 — P2 / medium / desktop-release
**Root cause:** Reusable platform-neutral contained exact-set/version/size/hash/update validation, separate from genuine signature/native stage
**Mappings:** backlog [55, 56]; requirements [].
**Chosen solution:** Reusable platform-neutral contained exact-set/version/size/hash/update validation, separate from genuine signature/native stage
**Acceptance:** ["omitted/duplicate/traversal/size/hash/update mismatch fixtures fail without signing simulation", "pnpm exec vitest run tests/desktop/desktop-macos-packaging.test.ts", "native pnpm smoke --packaged later"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/smoke.mjs", "line": 131, "symbol": "manifest validation"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/smoke.mjs", "line": 167, "symbol": "SHA256SUMS loop"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/smoke.mjs", "line": 127, "symbol": "update metadata existence"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/smoke.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/artifact-validation.mjs", "line": null, "symbol": "(proposed helper)", "existsAtSynthesis": false, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}]
**Dependencies:** ["shared packaging tests/docs", "native Mac for final package proof"]
**Before/reproduction/impact/refutation:** {"reproduction": "Source: checksum set not compared to exact manifest/expected set; manifest size/digest and update SHA512/size not checked", "refutation": "Empty checksum text DOES fail; dist emits exact signed/stapled/hash-bound artifacts. Missing later cross-binding remains; no empty-checksum bypass claimed.", "impact": "Omitted artifact or stale manifest/feed metadata escapes independent integrity stage", "category": "artifact-integrity", "status": "source-confirmed-native-front-door-unreachable-here"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "evidenceIds": ["E02", "source inspection"]}]

#### DR-006 — P1 / high / desktop-release
**Root cause:** Prepare real contained local package job/evidence adapter without authorizing publication; assess offline Web-export portability separately
**Mappings:** backlog [58, 65]; requirements [].
**Chosen solution:** Prepare real contained local package job/evidence adapter without authorizing publication; assess offline Web-export portability separately
**Acceptance:** ["public package job contained output, no overwrite, deterministic evidence, rollback/refusal", "existing project-build/Web-export goldens remain strict", "no fabricated readiness/authority success"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-project-build.ts", "line": 53, "symbol": "evaluateProjectBuild"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-project-build.ts", "line": 92, "symbol": "unconditional final Failure"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts", "line": 1834, "symbol": "ship non-Linux export refusal"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-project-build.ts", "line": 53, "symbol": "evaluateProjectBuild", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-project-build.ts", "line": 92, "symbol": "unconditional final Failure", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts", "line": 1834, "symbol": "ship non-Linux export refusal", "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
**Dependencies:** ["held/Kids/release authority unchanged", "actual packaging job contract", "EXT-RELEASE native proof"]
**Before/reproduction/impact/refutation:** {"reproduction": "E08 host command golden executes refusal parity; source return type is Failure only even all readiness flags true", "refutation": "Refusal is deliberate and must stay until real gated packager exists; signing inputs alone cannot implement success.", "impact": "Native project output absent and offline Web export Linux-only", "category": "missing-capability", "status": "intentional-refusal-plus-local-implementation-gap"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "evidenceIds": ["E08", "source inspection"]}]

#### DR-007 — P2 / medium / desktop-release
**Root cause:** Bounded non-signing install/typecheck/staging/default-smoke CI; explicit default-off native candidate branch, no triggered signing/publish
**Mappings:** backlog [55, 56]; requirements [].
**Chosen solution:** Bounded non-signing install/typecheck/staging/default-smoke CI; explicit default-off native candidate branch, no triggered signing/publish
**Acceptance:** ["pnpm --dir desktop/macos install --frozen-lockfile", "pnpm --dir desktop/windows install --frozen-lockfile", "pnpm --dir desktop/macos typecheck && pnpm --dir desktop/macos build && pnpm --dir desktop/macos smoke", "pnpm --dir desktop/windows typecheck && pnpm --dir desktop/windows build && pnpm --dir desktop/windows smoke", "pnpm check:desktop && pnpm check:boundaries"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/desktop-windows.yml", "line": 1, "symbol": "absent workflow"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/desktop-macos.yml", "line": 19, "symbol": "unbounded job"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/desktop-windows.md", "line": 121, "symbol": "Gate coverage"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/macos/scripts/build.mjs", "line": null, "symbol": "only if real staging failure", "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/windows/scripts/build.mjs", "line": null, "symbol": "only if real staging failure", "existsAtSynthesis": true, "writeOwner": "desktop-release", "baselineSourceReadOnly": true}]
**Dependencies:** ["frozen separate install roots", "no dispatch/new spend", "DR-001 native smoke"]
**Before/reproduction/impact/refutation:** {"reproduction": "Windows workflow missing; neither install root has node_modules here; focused gate covers structure/static tests, not installed staging", "refutation": "Mac default false release_candidate/Ubuntu staging and root tests exist; native signing external but local installs/typecheck/build/config smoke achievable.", "impact": "Staging/platform regressions not independently caught in actual packaging builds", "category": "local-build-CI-coverage", "status": "confirmed-missing-local-evidence"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "evidenceIds": ["E08", "E09", "workflow/source inspection"]}]

#### UI-001 — P2 / medium / sites-ui
**Root cause:** Route-aware canonical metadata from configured origins, never request Host
**Mappings:** backlog [42]; requirements [].
**Chosen solution:** Route-aware canonical metadata from configured origins, never request Host
**Acceptance:** ["Built root/item routes have unique correct canonical; invalid origin never Host-derived"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/app/layout.tsx", "line": 37, "symbol": "metadata"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-web/src/app/layout.tsx", "line": 37, "symbol": "metadata"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/app/layout.tsx", "line": 37, "symbol": "metadata", "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-web/src/app/layout.tsx", "line": 37, "symbol": "metadata", "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}]
**Dependencies:** ["validated configured origins"]
**Before/reproduction/impact/refutation:** {"reproduction": "Metadata contains title/description, no canonical/metadataBase", "type": "source-observation", "status": "CONFIRMED_LOCAL_PRODUCTION"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json", "evidenceIds": []}]

#### UI-002 — P2 / medium / sites-ui
**Root cause:** Compatible restrictive script/default/connect policy or explicit launch risk disposition
**Mappings:** backlog [39]; requirements [].
**Chosen solution:** Compatible restrictive script/default/connect policy or explicit launch risk disposition
**Acceptance:** ["Real Next/editor/browser flows pass policy without unsafe blanket script permission"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/security-headers.json", "line": 5, "symbol": "Content-Security-Policy"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/security-headers.json", "line": 5, "symbol": "Content-Security-Policy", "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}]
**Dependencies:** ["Next nonce/hash integration"]
**Before/reproduction/impact/refutation:** {"reproduction": "CSP contains only base-uri/frame-ancestors/object-src", "type": "intentional-security-residual"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json", "evidenceIds": []}]

#### IDENTITY-02 — P1 / high / identity
**Root cause:** Keep signup closed; implement authenticated export/disable and recovery contracts with explicit unconfigured refusal; add token replay/expiry and reauth tests before enabling endpoints
**Mappings:** backlog [3, 11, 12, 13, 15, 16]; requirements [].
**Chosen solution:** Keep signup closed; implement authenticated export/disable and recovery contracts with explicit unconfigured refusal; add token replay/expiry and reauth tests before enabling endpoints
**Acceptance:** ["New public-boundary tests must prove lifecycle/recovery semantics; existing commands alone do not prove new features"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/better-auth-provider.ts", "line": "583", "symbol": "requiredEndpoint"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/better-auth-provider.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/identity-port.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/store.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"reference": "packages/schemas lifecycle contracts (shared owner)"}, {"reference": "new lifecycle route/page tests (builder assigns exact paths)"}]
**Dependencies:** ["existing origin/provenance helpers", "ledger-preserving lifecycle contract", "email transport credentials for actual delivery"]
**Commands:** ["pnpm --dir sites/umbrella run test:provider", "pnpm --dir sites/umbrella run test:integration", "pnpm exec vitest run packages/auth/test --reporter=verbose"]
**Before/reproduction/impact/refutation:** {"reproduction": "Endpoint allowlist permits only sign-in, get-session and sign-out; existing endpoint-refusal test at provider test:764 passes", "refutation": "Closed signup is intentional; Better Auth feature availability is not SceneAxi endpoint availability; OAuth not automatically launch-required", "impact": "No public recovery/change-credential/account export-disable-delete/MFA flow demonstrated", "kind": "capability-gap", "status": "OPEN_LOCAL_AND_EXTERNAL"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "evidenceIds": []}]

#### IDENTITY-03 — P1 / high / identity
**Root cause:** Document operator attestation accurately; specify category-level retention/export/disable and ledger-preserving pseudonymization; no arbitrary legal periods or production deletion
**Mappings:** backlog [13, 15]; requirements [].
**Chosen solution:** Document operator attestation accurately; specify category-level retention/export/disable and ledger-preserving pseudonymization; no arbitrary legal periods or production deletion
**Acceptance:** ["Reviewed explicit policy plus local immutable-ledger lifecycle tests; external evidence remains named"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/better-auth-provider.ts", "line": "338", "symbol": "ensureBetterAuthAdminBootstrap"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-backlog.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-gaps-2026-09-26.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "privacy/retention policy and schema migration plan (shared owners)"}]
**Dependencies:** ["legal retention basis and backup policy", "real mail verification evidence for public-account claims"]
**Before/reproduction/impact/refutation:** {"reproduction": "Bootstrap stores verified flag via environment-owned provisioning; rate-limit retention SQL affects counters only", "refutation": "Bootstrap idempotence/conflict/rollback tests pass; no privilege escalation established; throttle retention exists", "impact": "Delivered-email verification and user/ledger retention claims cannot be made", "kind": "policy-gap", "status": "OPEN_POLICY_AND_LOCAL_DOCS"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "evidenceIds": []}]

#### IDENTITY-04 — P2 / medium / identity
**Root cause:** Reconcile id 14 and gap wording to current source/test evidence, without claiming deployed proof
**Mappings:** backlog [14, 84]; requirements [].
**Chosen solution:** Reconcile id 14 and gap wording to current source/test evidence, without claiming deployed proof
**Acceptance:** ["Independent current public-front-door assertion and unchanged integration gate; preserve protected refusals."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/better-auth-provider.test.ts", "line": "292", "symbol": "hosted-logout-flow"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-backlog.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-gaps-2026-09-26.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["retain live deployment evidence gate"]
**Commands:** ["pnpm --dir sites/umbrella run test:provider", "pnpm --dir sites/umbrella run test:integration"]
**Before/reproduction/impact/refutation:** {"reproduction": "Run test:provider; provider bearer/cookie invalid after logout, including injected first-delete failure", "refutation": "Specific stale defect successfully refuted through provider Request/Response and hosted flow boundaries", "impact": "Dated claim incorrectly directs builders to already remediated local revocation", "kind": "stale-backlog", "status": "REFUTED_SOURCE_CLAIM_DOC_UPDATE_NEEDED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "evidenceIds": []}]

#### IDENTITY-05 — P2 / medium / identity
**Root cause:** Add real browser/HTTP tests for same-origin sign-in, hostile/missing/alias Origin, HTTPS cookie attributes, logout replay and cache controls
**Mappings:** backlog [14]; requirements ['IDENT-001', 'IDENT-003'].
**Chosen solution:** Add real browser/HTTP tests for same-origin sign-in, hostile/missing/alias Origin, HTTPS cookie attributes, logout replay and cache controls
**Acceptance:** ["Auth-specific assertions required; screenshots or script exit alone insufficient"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/login/route.ts", "line": "28", "symbol": "POST"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/login/route.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/logout/route.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/auth/[...all]/route.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"reference": "browser auth integration tests (site owner assigns exact paths)"}]
**Dependencies:** ["existing authorized local build/server/browser environment"]
**Commands:** ["pnpm --dir sites/umbrella run test:visual"]
**Before/reproduction/impact/refutation:** {"reproduction": "Current successful oracles call helpers/handler and inspect route source, not browser HTTP routes", "refutation": "Configured-origin and cookie-security helper/source-order tests pass; live-browser coverage still absent", "impact": "Cookie transport, proxy headers, deployed origin and Next routing could differ from tested helpers", "kind": "coverage-gap", "status": "OPEN_LOCAL_INTEGRATION"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "evidenceIds": []}]

#### BD-001 — P1 / high / billing-data
**Root cause:** New forward migration per-account serialized next-sequence/previousbalance+delta/safeinteger/nonnegative validation; preserve idempotent replay.
**Mappings:** backlog [33]; requirements ['IDENT-004'].
**Chosen solution:** New forward migration per-account serialized next-sequence/previousbalance+delta/safeinteger/nonnegative validation; preserve idempotent replay.
**Acceptance:** ["Invalid row rejected/no append; same-key race two successes one row; gaps/overflow/forged balance/overdraft refuse; update/delete still refuse."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 816, "symbol": "appendOrReplayEntry"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/store.ts", "line": 348, "symbol": "assertAppendable"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/db/migrations/0002_credits_billing.sql", "line": 23, "symbol": "credit_ledger_entries"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 816, "symbol": "appendOrReplayEntry", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/store.ts", "line": 348, "symbol": "assertAppendable", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/db/migrations/0002_credits_billing.sql", "line": 23, "symbol": "credit_ledger_entries", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["integration exact migration numbering", "existing malformed production-data preflight, no silent repair"]
**Commands:** ["pnpm --dir /home/devuser/Documents/Projects/sceneaxi/sites/umbrella test:integration", "pnpm exec vitest run tests/db/schema-lockstep.test.ts packages/billing/test/store-boundary.test.ts", "actual db runner + public adapter real PG oracle E5"]
**Before/reproduction/impact/refutation:** {"reproduction": "Provision own isolated account, public store append first debit delta=-500/balanceAfter10/sequence1; accepted and raw sum -500; loader refuses chain.", "refutation": "Business appendCreditEntry computes safe balance; not proven HTTP theft. Persistence row schema/DDL independently lack chain checks.", "impact": "Permanent append-only account poisoning and false independent DB nonnegative invariant.", "kind": "confirmed-defect", "status": "open-local"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "evidenceIds": ["E5"]}]

#### BD-002 — P2 / medium / billing-data
**Root cause:** Catch bounded form decoding, named400/403 JSON; preserve same-site relative browser303 and fail-closed guards.
**Mappings:** backlog [24, 25, 45]; requirements [].
**Chosen solution:** Catch bounded form decoding, named400/403 JSON; preserve same-site relative browser303 and fail-closed guards.
**Acceptance:** ["Malformed JSON/truncated multipart safely refused, cross-origin403 for JSON, zero provider entries."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 55, "symbol": "POST"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 24, "symbol": "refusalResponse"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 55, "symbol": "POST", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 24, "symbol": "refusalResponse", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
**Dependencies:** ["registered site refusal vocabulary, shared schemas/site-kit owner if needed"]
**Commands:** ["pnpm exec vitest run tests/sites/credit-pack-purchase-ux.test.ts tests/sites/site-response-hardening.test.ts", "umbrella existing build/start and E8 real POSTs"]
**Before/reproduction/impact/refutation:** {"reproduction": "Same-origin JSON POST produces500 empty; cross-origin JSON-accept produces402 instead of403.", "refutation": "Origin proof precedes malformed parse; no forged provider session.", "impact": "Unhandled user input/server fault and misleading status classification.", "kind": "confirmed-defect", "status": "open-local"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "evidenceIds": ["E8"]}]

#### BD-003 — P2 / medium / billing-data
**Root cause:** Neutral returned-from-checkout notice; only authenticated persisted evidence can claim payment receipt.
**Mappings:** backlog [24]; requirements [].
**Chosen solution:** Neutral returned-from-checkout notice; only authenticated persisted evidence can claim payment receipt.
**Acceptance:** ["Forged query no paid/receipt claim/no mutation; pending/cancel/confirmed distinguished."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/account/page.tsx", "line": 190, "symbol": "AccountPage"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/account/page.tsx", "line": 190, "symbol": "AccountPage", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
**Commands:** ["pnpm exec vitest run tests/sites/credit-pack-purchase-ux.test.ts", "existing umbrella build/start E8 GET"]
**Before/reproduction/impact/refutation:** {"reproduction": "Unconfigured signed-out GET ?checkout=success contains Payment received.", "refutation": "No credit grant claimed; confirmation remains pending, but receipt itself is unproven.", "impact": "Customer/support misinformation from arbitrary link.", "kind": "confirmed-defect", "status": "open-local"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "evidenceIds": ["E8"]}]

#### BD-004 — P2 / medium / billing-data
**Root cause:** Clock-injected durable per-user NEW-attempt budget; replay-free old keys;429/retry-after; no per-process-only production claim.
**Mappings:** backlog [25]; requirements [].
**Chosen solution:** Clock-injected durable per-user NEW-attempt budget; replay-free old keys;429/retry-after; no per-process-only production claim.
**Acceptance:** ["Burst and cross-process excess refuse before provider, user isolation, same-key retries permitted."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 61, "symbol": "POST"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/identity-plane.ts", "line": 1022, "symbol": "createCheckout"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 1435, "symbol": "createStripeCheckoutSessionAdapter"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/api/checkout/route.ts", "line": 61, "symbol": "POST", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/identity-plane.ts", "line": 1022, "symbol": "createCheckout", "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 1435, "symbol": "createStripeCheckoutSessionAdapter", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
**Dependencies:** ["identity lane guard injection", "new durable migration/shared site refusal"]
**Commands:** ["pnpm exec vitest run tests/sites/provider-adapters.test.ts tests/sites/identity-plane-wiring.test.ts", "real PG concurrent budget regression and existing umbrella TEST boundary"]
**Before/reproduction/impact/refutation:** {"reproduction": "New valid attempts select fresh idempotency keys and call adapter with no throttle in audited paths; no actual flood attempted.", "refutation": "Stable mandatory token fixes old random fallback; existing per-key replay is correct.", "impact": "Unbounded per-member new intents/provider sessions.", "kind": "confirmed-capability-gap", "status": "open-local"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "evidenceIds": ["E1", "E6"]}]

#### BD-005 — P2 / medium / billing-data
**Root cause:** Refresh validated history inside lock or whole-run session lock; distinguish applied/dryrun statuses.
**Mappings:** backlog [31]; requirements [].
**Chosen solution:** Refresh validated history inside lock or whole-run session lock; distinguish applied/dryrun statuses.
**Acceptance:** ["One tracking row/id under concurrent runs; both succeed or documented safe lock refusal; actual applied output truthful; checksum mismatch remains exit1; dryrun no schema write."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 72, "symbol": "migrate"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 115, "symbol": "psqlExecutor.transaction"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 132, "symbol": "main"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 72, "symbol": "migrate", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 115, "symbol": "psqlExecutor.transaction", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/db-migrate.mjs", "line": 132, "symbol": "main", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["tests/db/migrate-process.test.ts owner", "no checksum/historical migration edits"]
**Commands:** ["pnpm exec vitest run tests/db/migrate-process.test.ts", "actual concurrent runner E9 and checksum tamper E4 against isolated PG"]
**Before/reproduction/impact/refutation:** {"reproduction": "Concurrent real runner processes [1 duplicate0000 tracking key,0 applied]; real apply logs would apply.", "refutation": "Atomic transaction rollback prevents data corruption; subsequent status proves applied.", "impact": "Operator automation false failures and inaccurate execution evidence.", "kind": "confirmed-defect", "status": "open-local"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "evidenceIds": ["E3", "E4", "E9"]}]

#### BD-006 — P2 / medium / billing-data
**Root cause:** Authenticated scoped/paginated persisted intent+ledger-anchor history/status, no direct identity/billing page imports or widened matrix.
**Mappings:** backlog [24]; requirements [].
**Chosen solution:** Authenticated scoped/paginated persisted intent+ledger-anchor history/status, no direct identity/billing page imports or widened matrix.
**Acceptance:** ["Own pending/granted/refunded/reconciliation visible, cross-user refused, restart durability, query alone no settlement."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/account/page.tsx", "line": 35, "symbol": "AccountPage"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 1193, "symbol": "listByUserId"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/account/page.tsx", "line": 35, "symbol": "AccountPage", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 1193, "symbol": "listByUserId", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
**Dependencies:** ["packages/site-kit port owner", "packages/schemas status vocabulary owner if needed", "identity lane identity-plane/request facade"]
**Commands:** ["pnpm exec vitest run tests/sites/credit-pack-purchase-ux.test.ts tests/sites/identity-plane-wiring.test.ts", "pnpm check:boundaries", "existing umbrella configured fixture HTTP lifecycle"]
**Before/reproduction/impact/refutation:** {"reproduction": "Whole account source renders balance/starter and query notice only; member never receives purchase-history projection; admin alone lists intents.", "refutation": "Existing browser303/cancel/pending and admin support history refute categorical old no-UX claim.", "impact": "Customer cannot reconcile own payment lifecycle/purchases.", "kind": "confirmed-capability-gap", "status": "open-local"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "evidenceIds": ["E1", "E8"]}]

#### BD-007 — P1 / high / billing-data
**Root cause:** Local reservation/replay/result coordination and honest default-off UI; no live spend or invented economic values.
**Mappings:** backlog [28, 29, 30]; requirements ['IDENT-005'].
**Chosen solution:** Local reservation/replay/result coordination and honest default-off UI; no live spend or invented economic values.
**Acceptance:** ["Overlapping same-key one provider/one debit, different keys no funds over-reservation, failed provider releases, uncertain results recoverable, Kids calls0 and admin/BYOK free."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": 501, "symbol": "runMeteredModelCall"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": 698, "symbol": "runMeteredModelCall"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/hosted-ai.test.ts", "line": 395, "symbol": "concurrent same-key debit test"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": 501, "symbol": "runMeteredModelCall", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": 698, "symbol": "runMeteredModelCall", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/hosted-ai.test.ts", "line": 395, "symbol": "concurrent same-key debit test", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
**Dependencies:** ["durable operation reservation/result vocabulary/storage", "server-owned credit pricing policy", "real provider inputs/action authority remain external"]
**Commands:** ["pnpm exec vitest run packages/billing/test/hosted-ai.test.ts packages/billing/test/metering.test.ts tests/e2e/hosted-ai-metering-golden.test.ts"]
**Before/reproduction/impact/refutation:** {"reproduction": "Source/test deliberately admit overlapping same-key provider calls before single debit; no enabled hosted HTTP front door or pricing transport exists.", "refutation": "Default off/Kids deny/sequential replay/nonnegative/admin/BYOK protections pass; not active production exploit.", "impact": "Cannot claim paid hosted exactly-once provider cost/result recovery or full advertised functionality.", "kind": "capability-gap-before-paid-activation", "status": "local-capability-and-external-activation"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "evidenceIds": ["E1"]}]

#### BD-008 — P2 / medium / billing-data
**Root cause:** Scoped bounded indexed query and pagination through existing interfaces.
**Mappings:** backlog [23, 33]; requirements ['IDENT-004'].
**Chosen solution:** Scoped bounded indexed query and pagination through existing interfaces.
**Acceptance:** ["Parameterized user filter, bounded page/continuation/order, no cross-user records/no requested global load; guards/replays unchanged."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/support-ledger.ts", "line": 79, "symbol": "readSupportLedger"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 765, "symbol": "listReconciliations"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/support-ledger.ts", "line": 79, "symbol": "readSupportLedger", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": 765, "symbol": "listReconciliations", "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
**Dependencies:** ["existing CreditStore adapter type extension", "next forward user/time index migration", "optional shared page/port continuation types"]
**Commands:** ["pnpm --dir /home/devuser/Documents/Projects/sceneaxi/sites/umbrella test:integration", "real PG many-user query-plan/scoped-page oracle"]
**Before/reproduction/impact/refutation:** {"reproduction": "SQL loads/ORDER BY global reconciliation table, support filters one user afterward; account ledger/intents also unbounded.", "refutation": "Admin guard precedes reads, not unauthorized information leak or measured latency claim.", "impact": "O(global events) time/memory per one-user support lookup.", "kind": "confirmed-scale-gap", "status": "open-local"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "evidenceIds": ["E1", "E2"]}]

#### DOPS-001 — P0 / critical / delivery-ops
**Root cause:** Triage every current advisory,patch compatible supported releases in all independent locks;verify advisory docs before new version/API use;do not weaken checks or pin matrix
**Mappings:** backlog [41]; requirements [].
**Chosen solution:** Triage every current advisory,patch compatible supported releases in all independent locks;verify advisory docs before new version/API use;do not weaken checks or pin matrix
**Acceptance:** ["All8 pnpm audit --json results triaged with no unresolved release-blocking vulnerabilities;pnpm gate;each site frozen install/typecheck/build+public HTTP/browser;desktop Linux typecheck/dist/packaged smoke;native preflight proofs,platform holes explicit"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/package.json", "line": "30", "symbol": "next; pnpm-lock.yaml:762 brace-expansion@5.0.7; pnpm-lock.yaml:870 fast-uri@3.1.4; desktop/linux/package.json:36 electron"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/package.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/pnpm-lock.yaml", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/{umbrella,catalog-game,catalog-web,kids}/package.json", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/{umbrella,catalog-game,catalog-web,kids}/pnpm-lock.yaml", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/{linux,macos,windows}/package.json", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/{linux,macos,windows}/pnpm-lock.yaml", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["sites-ui", "profiles-kids", "desktop-release", "desktop-linux", "root-manifest owner"]
**Before/reproduction/impact/refutation:** {"reproduction": "pnpm audit --json in each of8 roots", "refutation": "Frozen-lock installs and full gate pass,but audit consistently exits1 without network/API error;Windows-specific advisory not conflated with Linux exploit", "impact": "Production runtime and build/test dependencies carry current critical/high advisories;actual exploit reachability not established", "kind": "locally-actionable dependency safety"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "evidenceIds": []}]

#### DOPS-002 — P1 / high / delivery-ops
**Root cause:** Verify upstream action commit identities then pin uses to reviewed SHA with version comment;set minimal explicit permissions;record local SBOM/provenance metadata without fake signed attestation
**Mappings:** backlog []; requirements [].
**Chosen solution:** Verify upstream action commit identities then pin uses to reviewed SHA with version comment;set minimal explicit permissions;record local SBOM/provenance metadata without fake signed attestation
**Acceptance:** ["Every uses immutable verified commit;permissions explicit;workflow parse+traceability/injected checks and full gate;real CI signature/provenance remains unclaimed until actual run"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/gate.yml", "line": null, "symbol": "13; .github/workflows/engine-sdk.yml:13; .github/workflows/desktop-linux.yml:13; .github/workflows/desktop-macos.yml:26"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/gate.yml", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/engine-sdk.yml", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/desktop-linux.yml", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/desktop-macos.yml", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/desktop-artifact-expiry.yml", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["release-owner"]
**Before/reproduction/impact/refutation:** {"reproduction": "All five workflows inspected;actions use mutable @v4 tags;only expiry workflow declares contents:read", "refutation": "Frozen pnpm locks and SHA256 archive checks protect dependency/archive bytes,not mutable CI action code;repo default token permissions not observed,so no claim token currently has write", "impact": "Runner action identity not immutable;token least privilege depends on unseen repo default;unsigned manifest hashes do not authenticate origin", "kind": "supply-chain provenance hardening"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "evidenceIds": []}]

#### DOPS-003 — P2 / medium / delivery-ops
**Root cause:** Snapshot admitted fixture JSON and protect nested payload from caller/returned-result mutation,without network or credential ownership
**Mappings:** backlog [29]; requirements ['TOPO-001', 'TOPO-002', 'TOPO-003', 'TOPO-004', 'TOPO-005', 'TOPO-006', 'TOPO-007', 'BOUNDARY-001', 'BOUNDARY-002', 'BOUNDARY-003', 'BOUNDARY-004', 'BOUNDARY-005', 'BOUNDARY-006', 'BOUNDARY-007', 'BOUNDARY-008', 'BOUNDARY-009', 'BOUNDARY-010', 'BOUNDARY-011', 'BOUNDARY-012', 'BOUNDARY-013', 'BOUNDARY-014', 'BOUNDARY-015', 'BOUNDARY-016', 'BOUNDARY-017', 'BOUNDARY-018', 'BOUNDARY-019', 'BOUNDARY-020', 'BOUNDARY-021', 'BOUNDARY-022', 'BOUNDARY-023', 'BOUNDARY-024', 'BOUNDARY-025', 'BOUNDARY-026', 'SURFACE-005', 'SURFACE-006', 'SURFACE-007', 'SURFACE-010', 'SURFACE-013', 'SURFACE-014'].
**Chosen solution:** Snapshot admitted fixture JSON and protect nested payload from caller/returned-result mutation,without network or credential ownership
**Acceptance:** ["Failing-before/passing-after public mutation oracle;missing operation/model mismatch/tool JSON/schema tests unchanged;pnpm gate"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/provider-openrouter/src/index.ts", "line": "382", "symbol": "createFixtureTransport; :386 responses"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/provider-openrouter/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "delivery-ops", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/provider-openrouter/test/adapter.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "delivery-ops", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/provider-openrouter/README.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Before/reproduction/impact/refutation:** {"reproduction": "Public adapter returns before;mutate original nested response;identical request returns after", "refutation": "Top-level response map/model are frozen and exact model/missing-operation negative controls pass;neither protects nested response payload", "impact": "Fixture evidence/replay can change after construction,contradicting deterministic fixture contract;not a live provider exploit", "kind": "confirmed defect"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "evidenceIds": []}]

#### DOPS-004 — P2 / medium / delivery-ops
**Root cause:** Add isolated Kids frozen install/typecheck/production build job using its actual scripts,without deployment/env/shared imports;maintain existing three-site job
**Mappings:** backlog [41]; requirements [].
**Chosen solution:** Add isolated Kids frozen install/typecheck/production build job using its actual scripts,without deployment/env/shared imports;maintain existing three-site job
**Acceptance:** ["Kids pnpm install --frozen-lockfile,pnpm typecheck,pnpm build;root Kids boundary negative tests;no provider/env/network runtime additions"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/gate.yml", "line": "45", "symbol": "sites-build.strategy.matrix.site"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/.github/workflows/gate.yml", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["profiles-kids"]
**Before/reproduction/impact/refutation:** {"reproduction": "Matrix is umbrella,catalog-game,catalog-web;Kids production build absent", "refutation": "Kids intentionally undeployed and isolated,but root structural/byte-parity checks do not compile its Next TSX;local build proof is not deployment", "impact": "Independent Kids install/build regression can evade required CI", "kind": "local build coverage hole"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "evidenceIds": []}]

#### DOPS-005 — P2 / medium / delivery-ops
**Root cause:** Choose/validate existing supported pnpm9.15.0 policy for deployment and isolated roots;preserve hoisted declarations/Kids build-approval policy;document Node patch recording
**Mappings:** backlog [41]; requirements [].
**Chosen solution:** Choose/validate existing supported pnpm9.15.0 policy for deployment and isolated roots;preserve hoisted declarations/Kids build-approval policy;document Node patch recording
**Acceptance:** ["Actual selected pnpm version reported for every clean install/build;frozen locks unchanged except deliberate dependency fixes;no dependency-matrix widening"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/websites-deploy.md", "line": null, "symbol": "82; scripts/check-sites.mjs:422; package.json:7"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/{umbrella,catalog-game,catalog-web,kids}/package.json", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/websites-deploy.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-sites.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/boundary/injected-site-violations.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["sites-ui", "profiles-kids"]
**Before/reproduction/impact/refutation:** {"reproduction": "Site manifests lack packageManager;deployment doc explicitly says Vercel infers pnpm from lock format while CI root uses9.15.0", "refutation": "Both hoisted linker declarations intentionally cover two pnpm lines;that fixes linker only,not version drift;Node24 major is pinned but patch not exact", "impact": "Local,CI,Vercel may use materially different package-manager behavior;artifact provenance lacks exact deployment tool version", "kind": "toolchain reproducibility gap"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "evidenceIds": []}]

#### DOPS-006 — P2 / medium / delivery-ops
**Root cause:** Extend reference to supported public engine/Game/provider exports through existing generator;keep Kids and internal authority artifacts outside public SDK/reference where policy requires;validate generated links transactionally and only replace output on success
**Mappings:** backlog [81]; requirements [].
**Chosen solution:** Extend reference to supported public engine/Game/provider exports through existing generator;keep Kids and internal authority artifacts outside public SDK/reference where policy requires;validate generated links transactionally and only replace output on success
**Acceptance:** ["pnpm docs:api succeeds with exact package coverage+link/contract assertions;real new named suite exists and fails on missing pages;pnpm gate;do not add skipErrorChecking or disable validation"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/docs-api.mjs", "line": "13", "symbol": "packages; docs/api/index.html:1"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/docs-api.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/docs/api-reference.test.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "docs/api/"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/getting-started.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["schemas", "engine", "authoring", "profiles-kids"]
**Before/reproduction/impact/refutation:** {"reproduction": "Generated public index contains schemas,profile-web,authoring-core only;kernel/presentation/orchestrator/Game/provider API omitted;no tests/docs/api-reference.test.ts", "refutation": "Old #81 claim no generated reference is stale:working generator/output exist;current generator intentionally has bounded coverage,not a fabricated all-package reference", "impact": "Whole-app API onboarding remains incomplete;successful Vitest path selection does not prove API output", "kind": "missing capability / coverage"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "evidenceIds": []}]

#### CAT-DURABLE-INTAKE — P1 / medium / assets-plugins
**Root cause:** Durable local intake/quarantine wiring and truthful submission UI
**Mappings:** backlog [49]; requirements [].
**Chosen solution:** Implement injectable durable intake/store wiring over existing pipeline and admitted storage helpers in local fixtures; explicit rights metadata and reviewed transitions, no public activation or process-local fake persistence.
**Acceptance:** ["Restart/replay preserves own submission; no premature listing; unauthorized/invalid/Kids refused; empty configuration still CATALOG_INTAKE_STORAGE_UNAVAILABLE."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/catalog-submission.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/catalog-intake.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/editor-catalog-intake-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** []

#### BILLING-PRICE-POLICY — P1 / medium / billing-data
**Root cause:** Server-owned hosted credit pricing policy boundary
**Mappings:** backlog [30]; requirements ['IDENT-005'].
**Chosen solution:** Resolve price by vetted model/operation policy, reject caller-invented/unknown values, keep enabled false without actual commercial input. No fabricated production numeric table.
**Acceptance:** ["Unknown/mismatched model/operation/credit quotes reject; caller cannot choose charge; admin/BYOK/Kids protections unchanged."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/test/hosted-ai.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
**Evidence:** []

#### BILLING-RESTORE-LOCAL — P1 / medium / billing-data
**Root cause:** Repeatable local backup/restore oracle
**Mappings:** backlog [32]; requirements [].
**Chosen solution:** Use existing disposable PostgreSQL and native pg_dump/restore to exercise own fixture migrations/ledger/idempotency and checksum triggers; do not create production branch or attest Neon.
**Acceptance:** ["Restored own DB counts/digests exact; append-only guards/idempotency/reconciliation preserved; production untouched."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/tests/db/restore.test.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** []

#### BILLING-REALPG-REGRESSION — P1 / medium / billing-data
**Root cause:** Repeatable real PostgreSQL concurrency/fault tests
**Mappings:** backlog [33]; requirements [].
**Chosen solution:** Convert independent owned PG adapter/runner/webhook before evidence into repeatable existing-tool regression requests, no new test harness or dependency.
**Acceptance:** ["Exact durable chain, same-key races, distinct sequence rollback, intent-before-provider, signed fixture replay/refund/dispute and migration checksums proven against disposable real PG."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/tests/db/postgres-concurrency.test.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/provider-adapters.integration.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
**Evidence:** []

#### IDENTITY-ADMIN-HARDENING — P1 / medium / identity
**Root cause:** Admin reauthentication and lifecycle capability hardening
**Mappings:** backlog [16]; requirements [].
**Chosen solution:** Use current verified-password provider and provenance guards for sensitive export/disable/credential operations; prepare MFA policy/negative boundary only where existing stack admits it, never advertise unimplemented MFA.
**Acceptance:** ["Recent genuine session/reauth required; disable revokes both session layers; immutable ledger survives; no client-supplied role; missing MFA/transport named refusal."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/better-auth-provider.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/auth/src/identity-port.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/better-auth-provider.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}]
**Evidence:** []

#### SITE-PERSISTENCE — P1 / medium / sites-ui
**Root cause:** Owned editor project persistence absent
**Mappings:** backlog [46]; requirements [].
**Chosen solution:** Implement explicit bounded owned local save/load/export/import over current document/proposal contracts, namespaced records and revision/content hashes. Browser-owned persistence is distinct from account-backed cloud storage; no session/secret storage.
**Acceptance:** ["Real edit/save/reload/reopen preserves canonical content and correct owner/revision; reject malformed/oversized/forged records; undo/review no partial writes; Kids stays without durable state."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/editor/_components/editor-shell.tsx", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/editor-shell.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/sites/web-editor-persistence.test.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** []

#### OPS-TUTORIAL-ORACLE — P2 / medium / delivery-ops
**Root cause:** Fresh contained user-guide/example commands not exhaustively executed
**Mappings:** backlog [80, 83, 85]; requirements [].
**Chosen solution:** Run existing getting-started/examples/CLI guide commands in owned temp projects, verify exact output bytes/digests and prerequisite limitations; integration updates existing docs only from evidence.
**Acceptance:** ["Beginner path new/propose/review/apply/open/export works where admitted; broken instructions fixed; no provider/publication/hold bypass or hidden prerequisite."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/getting-started.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/examples-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** []

#### OPS-DOC-REVALIDATION — P1 / medium / delivery-ops
**Root cause:** Owning-doc/backlog descriptions need serial current-source reconciliation
**Mappings:** backlog [84]; requirements [].
**Chosen solution:** Append current dated dispositions with source/evidence links and retained provenance; reconcile release/control/provider/open-policy claims after actual builder success, never restamp external observations.
**Acceptance:** ["Every old/new ID maps to actual evidence/remaining gate; docs/contracts/traceability tests green; no claimed released bytes or fresh external observations without proof."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-backlog.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-gaps-2026-09-26.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/runnable-surfaces.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/full-editor-v1-capability-matrix.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** []

#### AP-PERF — P2 / medium / assets-plugins
**Root cause:** Importer/plugin controlled capacity and fault coverage
**Mappings:** backlog []; requirements [].
**Chosen solution:** Measure admitted limits, repeated reload/load lifecycle and permission/race refusals using owned fixtures; no hostile untrusted code/network.
**Acceptance:** ["Recorded command/platform/time/RSS at limit and limit+1; no uncontrolled stack growth/writes, stable bytes/digests and deterministic refusals."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/test/contained-gltf.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/plugin-host/test/load-refuse.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}]
**Evidence:** []

#### SITE-CATALOG-IDENTITY — P2 / medium / sites-ui
**Root cause:** Cross-origin catalog identity remains unconfigured
**Mappings:** backlog [40]; requirements [].
**Chosen solution:** Implement the single existing catalog-identity injected port/transport with strict origin/session provenance and truthful sign-in/account links. Never rely on cookies crossing unrelated origins, add a second auth stack, pass session tokens in URLs or weaken commerce holds. Shared exchange/port contract is integration-owned.
**Acceptance:** ["Actual configured local multi-origin read uses one authoritative identity port, hostile/absent/stale/cross-user inputs refuse; missing handles remain named unavailable."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/catalog-identity.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game/src/lib/site-config.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/catalog-web/src/lib/site-config.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}]
**Evidence:** []

#### AI-TRANSPORT-LOCAL — P2 / medium / delivery-ops
**Root cause:** Live hosted provider transport implementation absent
**Mappings:** backlog [29]; requirements [].
**Chosen solution:** Implement vetted injectable server-owned transport over existing provider-neutral adapter/ports, explicit allowlisted HTTPS endpoint/model/residency, timeout/body/redirect/redaction controls and no fallback. Verify current official API docs first; leave disabled with missing credentials and make no actual spend/network calls.
**Acceptance:** ["Fixture-recording fetch proves precise request/response and failures, malformed/oversized/redirect/timeouts refuse, Kids calls0, no secret output; real provider gate remains separate."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/provider-openrouter/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "delivery-ops", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/provider-openrouter/test/adapter.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "delivery-ops", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/provider/openrouter-transport.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "delivery-ops", "baselineSourceReadOnly": true}]
**Evidence:** []

#### OPS-DELAYED-CONTRACTS — P2 / medium / delivery-ops
**Root cause:** Delayed F1/asset/evidence/ship contracts need local engineering
**Mappings:** backlog [71]; requirements ['TOPO-007'].
**Chosen solution:** Revalidate predeclared module/contracts and implement locally admitted deterministic contract/evidence adapters through existing schema/authoring/kernel boundaries; coordinate reserved integration-owned exports/manifests without matrix widening. Do not conflate Stage proof authorization with permission to prepare honest local code. Empty seams/stubs cannot close this.
**Acceptance:** ["Actual public compile/platform/evidence path has versioned payloads, validated digests/replay/refusals and artifact/ship evidence; every unsupported general target remains counted."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/delivery-handoff.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/module-coverage-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** []

#### DELIVERY-PWA-LOCAL — P2 / medium / delivery-ops
**Root cause:** Contained offline PWA export can be implemented locally
**Mappings:** backlog [65]; requirements [].
**Chosen solution:** Extend admitted contained static Web export with version-bound offline manifest/service-worker behavior through its existing host; no app-store/account/publication/new platform provider. Exact desktop writer remains desktop-linux/integration coordinated.
**Acceptance:** ["Actual exported owned fixture opens offline after admitted local install, assets/digests exact, invalid/escaping/stale/no-replace output refuses, clean source bytes unchanged."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/web-export.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-web-export-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** []

#### LOCAL-070 — P2 / medium / authoring
**Root cause:** Axis-aligned placement only
**Mappings:** backlog [70]; requirements [].
**Chosen solution:** Implement bounded deterministic rotated/scaled placement projection through current composition authority; retain source artifact bytes and replay/evidence digests; new pose contracts are integration requests.
**Acceptance:** ["Public compose with nonzero supported placement rotates/scales correctly, save/replay projection equal, malformed/unsupported transforms refuse with no artifact rewrite."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/scene-composition.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/scene-composition.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/scene-composition-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "backlogDisposition": {"id": 70, "currentOutcome": "Recovered/current evidence discussed in audit MD; do not infer missing JSON closure."}}]

#### COVERAGE-AUTHORING — P1 / medium / authoring
**Root cause:** Remaining current-source/front-door coverage: authoring
**Mappings:** backlog []; requirements ['AUTH-001', 'AUTH-002', 'AUTH-003', 'AUTH-004', 'AUTH-005', 'AUTH-006', 'AUTH-007', 'CORE-004', 'CORE-006', 'CORE-009', 'CORE-010', 'CORE-013', 'CORE-016'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external."]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json"]

#### COVERAGE-ENGINE — P1 / medium / engine
**Root cause:** Remaining current-source/front-door coverage: engine
**Mappings:** backlog []; requirements ['CORE-001', 'CORE-002', 'CORE-003', 'CORE-005', 'CORE-007', 'CORE-011', 'CORE-012', 'CORE-014', 'CORE-015', 'CORE-017', 'CORE-018'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "Actual authored checker texture, imported animation, bloom/vignette/particles/material override pixel fixtures not exercised; positive /open scene pixels do not prove every feature", "Actual WebGL lost/restored public front door not exercised by this node; mocked lifecycle tests are not restored-pixel evidence", "No genuine physical gamepad/audio-device/physical GPU acceptance in this node", "No macOS/Windows/mobile/Firefox/Safari hardware rendering evidence", "No production deployment pixels or entitled production editor session; local public /open existing production build only", "No sustained multi-hour session, explicit capacity SLA or maximum-supported replay memory benchmark", "Packaged Linux GUI/input/play feature acceptance belongs desktop/shell integration owners, not this SDK audit", "General gameplay, audio, full posed physics persistence,skin/CUBICSPLINE,compressed texture decoding,texture binding and optional renderer/network scope remain full-product gaps until genuinely implemented"]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json"]

#### COVERAGE-ASSETS-PLUGINS — P1 / medium / assets-plugins
**Root cause:** Remaining current-source/front-door coverage: assets-plugins
**Mappings:** backlog []; requirements ['CORE-008', 'CAT-001', 'CAT-002', 'CAT-003', 'CAT-004'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "No passing-after AP-01..05 source edits from read-only auditor", "No browser pixel/native picker/packaged host proof by this node; route engine/desktop lanes", "No real provider/network/storage marketplace or legal/curation authority exercised", "Hostile-code sandbox deliberately nonexistent; trusted execution is not permissions enforcement", "Peak RSS/time and16x8MiB manifest limits not benchmarked", "Filesystem races/concurrency/cancellation/cross-OS permission/fault matrix not exhaustively tested", "Accessor exact maximum250000 backing-buffer boundary not independently exercised; triangle250000/250001 and byte8MiB+1 boundaries were exercised"]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json"]

#### COVERAGE-PROFILES-KIDS — P1 / medium / profiles-kids
**Root cause:** Remaining current-source/front-door coverage: profiles-kids
**Mappings:** backlog []; requirements ['PROF-001', 'PROF-002', 'PROF-003', 'PROF-004', 'PROF-005', 'PROF-006', 'SURFACE-008', 'SURFACE-009'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "Kids install-root build/typecheck/production loopback HTTP/browser not run by read-only auditor", "Actual third-party request/cookie/storage/assistive-technology observation missing", "Game/Web exported rendered-pixel proof not performed by this node", "Web full conformance claim deliberately unavailable", "Broad Web experience/data-driven real-time capability evidence incomplete", "Declared Game hooks are not full Evidence Packet emission", "No actual external provider/legal/deploy/signing/publication proof"]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json"]

#### COVERAGE-CLI — P1 / medium / cli
**Root cause:** Remaining current-source/front-door coverage: cli
**Mappings:** backlog []; requirements ['HOLD-001', 'HOLD-002', 'HOLD-003', 'SURFACE-001'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "No production sentinel/export trust or authorization exists; default gated refusal expected.", "No genuine running packaged desktop host connection asserted by this lane; real CLI missing/insecure transport refusal tested, existing local-bridge golden passes.", "Only Linux Node24 exercised; macOS/Windows transport/signing/distribution proof belongs native lanes.", "Workspace binary tested against existing baseline build; builders must rebuild before after-fix oracle. No new stack/API introduced, so no new external API documentation requirement invoked.", "Startup sampled; no large-directory/large-document sustained-memory/load benchmark or product performance SLO claimed.", "No extracted outsider tarball runtime proof; manifest limitations explicitly retained under backlog79.", "No passing-after evidence for new defects because this auditor may not edit source; builder/integration owns regression closure."]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json"]

#### COVERAGE-SHELLS — P1 / medium / shells
**Root cause:** Remaining current-source/front-door coverage: shells
**Mappings:** backlog []; requirements ['SURFACE-002', 'SURFACE-003'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "Native packaged Electron launch and GPU pixels not performed by this node", "All66 native GUI commands not exercised", "Gamepad hardware/OS keychain/live BYOK not exercised", "No long-duration exhaustion/concurrent queue load measurement", "No real provider/production billing/signing/macOS/Windows proof", "No automated accessibility audit; control accounting is not full accessibility certification"]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json"]

#### COVERAGE-DESKTOP-LINUX — P1 / medium / desktop-linux
**Root cause:** Remaining current-source/front-door coverage: desktop-linux
**Mappings:** backlog []; requirements ['DESK-001', 'DESK-002', 'DESK-003', 'DESK-004', 'DESK-005', 'DESK-006', 'DESK-007', 'DESK-008', 'DESK-009', 'DESK-010', 'SURFACE-004'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "Native New/Open/Recent dialogs and full current registered GUI controls", "Native Redo/hierarchy/import-reload/Ask-Build-approve-apply/cancel-timeout through actual controls", "Actual supported OS-keyring credential save/replace/remove and configured live provider", "Native bridge project rebind/crash/close discovery lifecycle through packaged controls", "AppImage mount and deb installation", "Physical GPU/driver matrix and maximum-admitted-assets sustained performance", "Screenshot pixels captured but layout/accessibility not visually reviewed", "macOS/Windows signing/platform launch/public release/update proof", "Real authenticated umbrella editor browser gate"]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json"]

#### COVERAGE-DESKTOP-RELEASE — P1 / medium / desktop-release
**Root cause:** Remaining current-source/front-door coverage: desktop-release
**Mappings:** backlog []; requirements ['REL-001', 'REL-002', 'REL-003', 'REL-004', 'REL-005', 'REL-006', 'REL-007'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", {"id": "LOCAL-INSTALL-STAGING", "kind": "local-achievable", "description": "macOS/Windows frozen install/typecheck/staging builds not executed by source-read-only auditor; missing node_modules is not external blocker", "task": "DR-007"}, {"id": "EXT-MAC-NATIVE", "kind": "external-evidence", "description": "Actual signed/stapled universal dmg/zip, Intel+Apple Silicon launch/pixels/Gatekeeper/install/uninstall/update validation unavailable"}, {"id": "EXT-WIN-NATIVE", "kind": "external-evidence", "description": "Actual Windows signed NSIS install/launch/uninstall/publisher/update/native pixel acceptance unavailable"}, {"id": "EXT-RELEASE-DOWNLOAD", "kind": "external-evidence", "description": "Historical workflow artifact not authenticated/downloaded; no new public release or feed authorized"}, {"id": "PERF-NATIVE", "kind": "unmeasured", "description": "Whole-file hash buffers and synchronous signing/build RSS/latency not measured on actual-sized native artifacts; no performance PASS"}]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json"]

#### COVERAGE-SITES-UI — P1 / medium / sites-ui
**Root cause:** Remaining current-source/front-door coverage: sites-ui
**Mappings:** backlog []; requirements ['SURFACE-011', 'SURFACE-012'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "Three fresh production builds pending", "Responsive/keyboard/contrast/link/browser checks pending", "Legal/docs/download/editor persistence probes pending", "No configured credentials or authenticated entitlement", "No deployed/custom-host, cross-browser or native download proof"]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json"]

#### COVERAGE-IDENTITY — P1 / medium / identity
**Root cause:** Remaining current-source/front-door coverage: identity
**Mappings:** backlog []; requirements ['IDENT-001', 'IDENT-002', 'IDENT-003', 'IDENT-004', 'IDENT-005', 'IDENT-006', 'IDENT-007'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "live Next/browser auth front doors", "deployed Neon provider flows", "real mail delivery", "live multi-instance load tests", "account lifecycle/export/deletion proof"]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json"]

#### COVERAGE-BILLING-DATA — P1 / medium / billing-data
**Root cause:** Remaining current-source/front-door coverage: billing-data
**Mappings:** backlog []; requirements [].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "Configured authenticated HTTP checkout/support success and full browser customer lifecycle", "Actual Stripe/Neon SDK network failures/timeouts/subscriptions/provider delivery", "Production/distributed load and migration/schema/privileges", "Actual Neon PITR/restore drill", "Full real-PG Better Auth support/Connect lifecycle (existing PGlite support/Connect tests remain bounded proof)"]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json"]

#### COVERAGE-DELIVERY-OPS — P1 / medium / delivery-ops
**Root cause:** Remaining current-source/front-door coverage: delivery-ops
**Mappings:** backlog []; requirements ['TOPO-001', 'TOPO-002', 'TOPO-003', 'TOPO-004', 'TOPO-005', 'TOPO-006', 'TOPO-007', 'BOUNDARY-001', 'BOUNDARY-002', 'BOUNDARY-003', 'BOUNDARY-004', 'BOUNDARY-005', 'BOUNDARY-006', 'BOUNDARY-007', 'BOUNDARY-008', 'BOUNDARY-009', 'BOUNDARY-010', 'BOUNDARY-011', 'BOUNDARY-012', 'BOUNDARY-013', 'BOUNDARY-014', 'BOUNDARY-015', 'BOUNDARY-016', 'BOUNDARY-017', 'BOUNDARY-018', 'BOUNDARY-019', 'BOUNDARY-020', 'BOUNDARY-021', 'BOUNDARY-022', 'BOUNDARY-023', 'BOUNDARY-024', 'BOUNDARY-025', 'BOUNDARY-026', 'SURFACE-005', 'SURFACE-006', 'SURFACE-007', 'SURFACE-010', 'SURFACE-013', 'SURFACE-014'].
**Chosen solution:** Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
**Acceptance:** ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "No current external provider/admin/Stripe/Neon/Vercel/GitHub authenticated evidence;dated observations not refreshed", "No native macOS/Windows signing or packaged launches;Linux packaged/pixel checks owned other lanes", "No complete SBOM/signed release provenance verification;checksum is integrity,not authenticity", "No fresh docs:api regeneration:it recursively rewrites docs/api outside auditor ownership;missing API suite explicitly surfaced", "No deployment/restore/rollback/alert delivery drill;no production state changed", "No individual advisory exploit/reachability assertion or API rate/latency/load benchmark;registry audit is dependency evidence,not attack proof", "Concurrent builders may change source after these snapshot observations;integration must reverify and attach after-evidence"]
**Evidence:** ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json"]

### genuine-external-blocker

#### GATE-LICENCE — P0 / medium / delivery-ops
**Root cause:** Licence grant absent
**Mappings:** backlog [1]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Reviewed licence choice and actual grant/text from the rights owner. Preserve UNLICENSED until supplied.
**Evidence:** []

#### GATE-TRADEMARK — P0 / medium / delivery-ops
**Root cause:** SceneAxi naming clearance absent
**Mappings:** backlog [2]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Genuine rights/legal trademark clearance for intended names/jurisdictions; no local test can establish rights.
**Evidence:** []

#### GATE-ACTIVATION — P0 / medium / delivery-ops
**Root cause:** Production activation and configured front-door proof absent
**Mappings:** backlog [5, 17, 31, 33, 35, 41, 40]; requirements ['IDENT-001', 'IDENT-002', 'IDENT-003'].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Action-specific authorization naming commit/artifact, exact project/alias/DB, mode, operator, window, evidence and rollback owner. Securely provision BETTER_AUTH_ORIGIN/SECRET, DATABASE_URL, SCENEAXI_ADMIN_EMAIL/BOOTSTRAP_SECRET and provider handles; name-only target/scope verification plus genuine HTTPS authenticated route and current alias/source proof. No deployment or production migration in this swarm.
**Evidence:** []

#### GATE-LIVE — P0 / medium / billing-data
**Root cause:** Stripe LIVE stays separately held
**Mappings:** backlog [4, 18, 37]; requirements ['IDENT-007'].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Exact LIVE go-live decision and every PRE-AUTH/POST-AUTH condition; real reviewed pricing/tax/provider objects and credentials via secure store; action-specific financial authority. No invented witness, keys, price revisions or environment bypass.
**Evidence:** []

#### GATE-CONNECT — P1 / medium / billing-data
**Root cause:** Connect LIVE and operational provider evidence absent
**Mappings:** backlog [36, 51]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Separate Connect LIVE/marketplace action authority, real approved provider/dashboard/store/secret readiness and signed onboarding/payout evidence. TEST mode and synthetic witnesses do not close this.
**Evidence:** []

#### GATE-STRIPE-TEST — P1 / medium / billing-data
**Root cause:** Genuine subscribed TEST settlement and reconciliation proof absent
**Mappings:** backlog [20, 21, 22, 23, 24, 25, 33]; requirements ['IDENT-006'].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Authorized TEST owner verifies current endpoint/subscriptions to checkout.session.completed, charge.refunded, charge.dispute.created, charge.dispute.closed; genuine signed delivery/replay/out-of-order, exact persisted intent/session binding, one grant/refund/reconciliation and authenticated support proof. No dashboard/account/payment action here.
**Evidence:** []

#### GATE-COMMERCIAL — P1 / medium / billing-data
**Root cause:** Commercial tax/receipt/refund/dispute policy inputs absent
**Mappings:** backlog [19, 20, 21, 26, 30]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Real legal entity/countries/tax registration obligations, invoice/receipt/customer/refund/dispute/access-resolution and economically approved credit-price values. Default TEST/USD/card-only/no automatic clawback; do not fabricate commercial values.
**Evidence:** []

#### GATE-RETENTION — P1 / medium / identity
**Root cause:** Account/ledger privacy retention inputs absent
**Mappings:** backlog [13, 38]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Reviewed record-category retention/legal basis, legal entity/contact, jurisdictional privacy/export/deletion/backup/pseudonymization policy that preserves append-only finance records; no arbitrary legal time periods or production deletion.
**Evidence:** []

#### GATE-LEGAL-PAGES — P0 / medium / sites-ui
**Root cause:** Public legal and contact text absent
**Mappings:** backlog [38]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Reviewed terms/privacy/refund/cookie/imprint text, real entity/contact/support channel, licence/trademark rights. Placeholder pages remain visibly unapproved and no public legal assertion is invented.
**Evidence:** []

#### GATE-MAIL — P1 / medium / identity
**Root cause:** Verified email/recovery delivery absent
**Mappings:** backlog [11, 12, 15, 3]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Approved real email transport/sender/domain configuration via secure provisioning, authority for test delivery and genuine confirmation/recovery/expiry/replay/revocation evidence. Missing transport must refuse by name.
**Evidence:** []

#### GATE-MARKETPLACE — P1 / medium / assets-plugins
**Root cause:** Marketplace rights/curation/delivery activation absent
**Mappings:** backlog [6, 48, 49]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Actual licensed payload inventory, provenance/AI disclosures, curator/moderation/takedown legal owner/policy, approved durable delivery configuration, genuine entitlement/payment evidence, structured per-storefront held-key resolution and separate activation/publication authority.
**Evidence:** []

#### GATE-PROOF — P1 / medium / authoring
**Root cause:** Stage/general-E2 proof authority absent
**Mappings:** backlog [9, 73]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Genuine structured held-key/program decision and action-specific Stage1/6 double-gated authorization. Local bounded E2 fixtures cannot be labelled executed program proof.
**Evidence:** []

#### GATE-PUBLICATION — P1 / medium / desktop-release
**Root cause:** Artifact/publication/update activation authority absent
**Mappings:** backlog [7, 52, 56, 79, 86]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Later separate authority naming exact independently verified source/candidate/hash/release record/target/feed/operator/window/evidence/rollback; genuine durable downloaded release hashes and update evidence. A local archive/workflow artifact is not public release.
**Evidence:** []

#### GATE-MACOS — P1 / medium / desktop-release
**Root cause:** Real signed/notarized macOS acceptance absent
**Mappings:** backlog [55, 58]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Real Apple Silicon and Intel hosts, Xcode codesign/xcrun/stapler, genuine Developer ID certificate via CSC_LINK/CSC_KEY_PASSWORD, APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID, approved HTTPS SCENEAXI_MACOS_RELEASE_BASE_URL, clean source SHA, platform/candidate signing authority and real signature/Gatekeeper/install/uninstall/update/pixel evidence. Names only.
**Evidence:** []

#### GATE-WINDOWS — P1 / medium / desktop-release
**Root cause:** Real signed Windows acceptance absent
**Mappings:** backlog [55, 58]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Real Windows x64 host/SDK SignTool, genuine WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD, clean source SHA and exact platform/candidate signing authority; real NSIS per-user installer/hash/publisher/install/uninstall/native-launch/update evidence. Token/tag/gh only for later separately authorized upload.
**Evidence:** []

#### GATE-AI-PROVIDER — P1 / medium / delivery-ops
**Root cause:** Real eligible AI provider/keyring evidence absent
**Mappings:** backlog [10, 28, 29, 30, 59]; requirements ['IDENT-005'].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Configured approved provider/BYOK credential via secure supported unlocked OS keyring, actual pinned model/API/residency verification and action-specific network/provider-use/spending authority for genuine completion evidence. Fixture transport and stored-key readiness are not live proof; no use/spend here.
**Evidence:** []

#### GATE-RESTORE — P1 / medium / billing-data
**Root cause:** Production backup/PITR/restore evidence absent
**Mappings:** backlog [32, 33]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Name-only real Neon target/schema/checksum/privilege/PITR retention evidence, explicit isolated timestamp-restore action authority, actual restored counts/digests/triggers/comparison and unchanged-production observation. Local pg_dump restore is separate local evidence.
**Evidence:** []

#### GATE-OBSERVABILITY — P1 / medium / delivery-ops
**Root cause:** External CI/alert/operator evidence absent
**Mappings:** backlog [34, 86, 87]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Read-only authenticated current required-check/budget/default-token/alias observations, configured existing monitoring/expiry alert recipient and response owner/window, real alert/restore/rollback drill evidence under exact action authority; no new paid service/account or workflow dispatch.
**Evidence:** []

#### GATE-DEVICES — P1 / medium / engine
**Root cause:** Physical controller/audio/GPU/platform evidence absent
**Mappings:** backlog [60, 64, 66, 67, 68, 69]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Genuine supported connected controller/audio device and physical GPU/browser/platform hosts; actual input/audio/render/recovery behavior, names and measured capacity. navigator fixtures, SwiftShader and AudioContext counts are not physical-device acceptance.
**Evidence:** []

#### GATE-CONFORMANCE — P1 / medium / profiles-kids
**Root cause:** Held Kids launch/profile rollout/conformance absent
**Mappings:** backlog [8, 76]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Genuine structured Kids safety/launch decision naming isolated origin/surface while preserving empty shared dependents, reviewed legal/privacy requirements and real profile rollout/conformance disposition; then separate deployment/publication authority and actual shared-suite/production evidence.
**Evidence:** []

#### GATE-EPOCH — P1 / medium / cli
**Root cause:** Real held-key epoch/trust activation absent
**Mappings:** backlog [78]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Genuine FirstMate structured export, trusted authenticated current epoch endpoint/trust/timeout policy and separately authorized actual held operation. staticEpochAuthority is a fixture, never production currency.
**Evidence:** []

#### GATE-CANONICAL-INPUT — P1 / medium / delivery-ops
**Root cause:** Out-of-tree canonical source/design rights not independently supplied
**Mappings:** backlog [83]; requirements [].
**Chosen solution:** Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
**Acceptance:** ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
**Exact missing input:** Actual authoritative issue/spec/archive access and rights/provenance where required; retain owner pointers and dated facts, never invent unavailable design/legal evidence.
**Evidence:** []

### intentional-nonlaunch-capability

#### ENG-016 — P3 / medium / engine
**Root cause:** INTENTIONAL_WEBGL_OFFLINE_DEFAULT; additional renderer/network product scope missing
**Mappings:** backlog [72]; requirements [].
**Chosen solution:** Truthful offline/WebGL defaults; explicitly charter and design second renderer/bounded replication before implementation; do not invent server/account/provider or widen dependency matrix
**Acceptance:** ["Any admitted new adapter/protocol needs real two-adapter/peer correctness,disconnect/replay/auth/input-bound proofs; current absence is not a defect in intentional refusal or missing credential", "pnpm check:boundaries && pnpm exec vitest run packages/engine-kernel/test packages/engine-presentation/test"]
**File/symbol targets and exact owner:** [{"reference": "packages/engine-presentation/ (future adapter only under charter)"}, {"reference": "packages/engine-kernel/ (future deterministic protocol only under charter)"}]
**Dependencies:** ["docs/dependency-matrix.json", "docs/adr/", "packages/schemas/ (future protocol contracts)"]
**Evidence:** []

#### PK-003 — P2 / medium / profiles-kids
**Root cause:** Web generic golden does not close unclaimed shared conformance
**Mappings:** backlog [76]; requirements [].
**Chosen solution:** Local negative tests/docs make MVP versus full conformance distinction explicit; never upgrade held registry or fabricate evidence. Authorized future shared conformance surface requires matching real suite/registry/contracts
**Acceptance:** ["Negative unclaimed/shipping assertions remain", "Game shared suite passes", "Kids remains unclaimed R0", "Any future claim only after structured authority and actual shared suite evidence"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-web/src/index.ts", "line": "172", "symbol": "mvpGoldenPath"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-web/README.md", "line": "41", "symbol": "not-yet-claimed"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/profile-conformance.ts", "line": "82-85", "symbol": "profileConformanceRegistry"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/profile-conformance-suite.ts", "line": "74-78", "symbol": "runProfileConformanceSuite"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/profile-conformance-suite.ts", "line": "134", "symbol": "registry-row-matches"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-web/test/open-path.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "profiles-kids", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-web/README.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["Genuine structured profile rollout/conformance disposition before registry promotion"]
**Commands:** ["pnpm exec vitest run packages/profile-web/test packages/profile-game/test/conformance.test.ts packages/schemas/test/profile-conformance.test.ts", "pnpm check:contracts"]
**Before/reproduction/impact/refutation:** {"reproduction": "Current Web exports MVP pin, no claim/conformance; registry explicitly not-yet-claimed; suite rejects unclaimed and mismatched rows", "refutation": "Intentional governance restriction confirmed, not runtime failure; generic Web golden passes bounded core behavior", "impact": "Backlog76 cannot be marked production complete; shippingClaim false must remain", "kind": "intentional-conformance-gate", "status": "LOCAL_NEGATIVE_PROOF_ACTIONABLE_FULL_CLAIM_HELD"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "evidenceIds": ["PK-E1", "PK-E3"]}]

#### SCOPE-CLOSED-SIGNUP — P2 / medium / identity
**Root cause:** Public onboarding intentionally not launched
**Mappings:** backlog [3]; requirements [].
**Chosen solution:** Keep sole-admin verified-password closed signup; locally build safe recovery/export/disable. Public signup requires genuine policy/transport/governance authority, not toggling disableSignUp.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

#### SCOPE-OAUTH — P2 / medium / identity
**Root cause:** Social OAuth not part of safe local candidate
**Mappings:** backlog [16]; requirements [].
**Chosen solution:** Prioritize verified-password recovery and admin hardening; OAuth remains unsupported/visible, do not invent provider accounts.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

#### SCOPE-MULTICURRENCY — P2 / medium / billing-data
**Root cause:** Multicurrency intentionally excluded
**Mappings:** backlog [26]; requirements [].
**Chosen solution:** Keep honest USD TEST/minor units; unsupported currencies refuse. Broader capability remains a full-product gap.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

#### SCOPE-CUSTOMER-LINKING — P2 / medium / billing-data
**Root cause:** Unused customer-link schema retained
**Mappings:** backlog [27]; requirements [].
**Chosen solution:** Do not destructively drop stripe_customer_links. Implement linking only with genuine receipt/customer lifecycle requirements; unused table is not claimed customer support.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

#### SCOPE-HOSTED-OFF — P2 / medium / billing-data
**Root cause:** Paid hosted AI intentionally default-off
**Mappings:** backlog [10, 28, 57]; requirements [].
**Chosen solution:** Implement safe durable reservation/pricing-policy boundary/server transport locally, but never enable paid calls or fabricate provider/economic evidence.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

#### SCOPE-UNTRUSTED-PLUGINS — P2 / medium / assets-plugins
**Root cause:** Untrusted plugin sandbox absent
**Mappings:** backlog [75]; requirements [].
**Chosen solution:** Trusted explicit local packages only; immutable inspected-byte identity. No new capability or AST-scan-as-sandbox claim; untrusted execution remains excluded/full-product gap.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

#### SCOPE-GENERAL-E2 — P2 / medium / authoring
**Root cause:** General E2 remains specified-not-built
**Mappings:** backlog [73]; requirements [].
**Chosen solution:** Extend admissible bounded Minimum E2 and truthful guidance; broader E2 remains distinct missing capability plus held proof authority, not manufactured planner proof.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

#### SCOPE-KIDS-SHARED — P2 / medium / profiles-kids
**Root cause:** Kids shared engine path intentionally refuse-only
**Mappings:** backlog [8]; requirements [].
**Chosen solution:** Curated isolated in-memory activity only; empty dependents/no shared identity, commerce, LLM, telemetry or external-data edge. Public Kids launch separately held.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

#### SCOPE-EXTRA-TARGETS — P2 / medium / delivery-ops
**Root cause:** Full native/mobile/PWA export matrix absent
**Mappings:** backlog [65]; requirements [].
**Chosen solution:** Prefer existing contained static Web/Delivery Handoff, prepare local portable target adapters where admitted; no matrix widening or false native build success.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

#### SCOPE-DELAYED-MODULES — P2 / medium / delivery-ops
**Root cause:** Predeclared compiler/platform/evidence product modules unshipped
**Mappings:** backlog [71]; requirements ['TOPO-007'].
**Chosen solution:** Keep delayed declarations visible; schema/program owners must define real F1/AssetPackage/EvidencePacket/ShipEvent contracts and public success evidence before promoting. Do not create empty seams as fake closure.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

#### SCOPE-COMPOSE-UI — P2 / medium / shells
**Root cause:** General composition-editor and project-file rename/delete capability excluded
**Mappings:** backlog [57]; requirements [].
**Chosen solution:** Expose supported typed controls; preserve canonical/journal/asset ownership. Inert/refused general composition/rename/delete must stay truthful and counted; standalone chrome has no runtime.
**Acceptance:** ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
**Evidence:** []

### done-with-evidence

#### LOCAL-PROOF-014 — P2 / medium / identity
**Root cause:** Bounded implemented portion: Sign-out deletes only the SceneAxi `sessions` row; the Better Auth session/bearer stays valid until expiry
**Mappings:** backlog [14]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "backlogDisposition": {"id": 14, "currentOutcome": "Recovered/current evidence discussed in audit MD; do not infer missing JSON closure."}}]

#### LOCAL-PROOF-020 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: Disputes/chargebacks unhandled
**Mappings:** backlog [20]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 20, "oldStatus": "done", "current": "local-reconciliation-implemented", "remaining": "Actual event subscription/delivery and money/access-resolution policy; local fixture never production proof."}}]

#### LOCAL-PROOF-021 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: Refunds reconcile only when full and unspent; `STRIPE_REFUND_NOT_FULL` and spent-credit refunds are acknowledg
**Mappings:** backlog [21]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 21, "oldStatus": "done", "current": "bounded-full-refund-and-durable-exceptions-implemented", "remaining": "Actual provider proof and refund/dispute monetary policy; partial/spent no silent ACK."}}]

#### LOCAL-PROOF-023 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: No admin/support tooling
**Mappings:** backlog [23]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 23, "oldStatus": "done", "current": "local-support-implemented-scale-gap", "remaining": "BD-008 and authorized production success proof/adjustment authority."}}]

#### LOCAL-PROOF-024 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: Checkout UX: refusal is raw JSON `402` to an HTML form; no success/pending/cancel pages; no purchase history o
**Mappings:** backlog [24]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 24, "oldStatus": "done", "current": "partial-UX-no-member-history", "remaining": "BD-002,BD-003,BD-006; preserve existing303/cancel/pending states."}}]

#### LOCAL-PROOF-025 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: `/api/checkout` falls back to a random attempt UUID → a new intent and Stripe session per POST; no rate limit
**Mappings:** backlog [25]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 25, "oldStatus": "done", "current": "stable-key-fixed-rate-budget-absent", "remaining": "BD-004 and malformed input BD-002."}}]

#### LOCAL-PROOF-031 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: No migration runner and no applied-migrations tracking; `db/README.md` says to apply by hand.
**Mappings:** backlog [31]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 31, "oldStatus": "done", "current": "runner-tracking-checksum-implemented-defects", "remaining": "BD-005 concurrent locking/output; real PG migrations executed locally."}}]

#### LOCAL-PROOF-032 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: No backup/PITR/restore policy or drill, while rollback is "forward-fix only" (`production-activation.md
**Mappings:** backlog [32]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 32, "oldStatus": "done", "current": "restore-runbook-present-drill-unproven", "remaining": "Actual Neon retention/authorized isolated restore drill; docs alone not readiness."}}]

#### LOCAL-PROOF-033 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: Neon adapters have only been tested against a mock
**Mappings:** backlog [33]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 33, "oldStatus": "done", "current": "PGlite-and-independent-real-PG-local-proof", "remaining": "BD-001; repeatable PG regression; actual Neon/network/load/restore evidence absent."}}]

#### LOCAL-PROOF-034 — P2 / medium / delivery-ops
**Root cause:** Bounded implemented portion: No observability
**Mappings:** backlog [34]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "backlogDisposition": {"id": 34, "outcome": "PARTIAL_LOCAL_DONE_EXTERNAL_OPS", "current": "server-logger and real /api/health exist;36 adapter/logging tests pass;absence planes HTTP200 not production-ready;monitor destination/alert drill absent"}}]

#### LOCAL-PROOF-035 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: No startup env validation; misconfiguration silently becomes "not wired".
**Mappings:** backlog [35]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 35, "oldStatus": "done", "current": "name-only-configuration-diagnostics-implemented", "remaining": "Production configured readiness proof; missing/malformed remain named refusals."}}]

#### LOCAL-PROOF-036 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: `ConnectStore` is in-memory only
**Mappings:** backlog [36]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 36, "oldStatus": "done", "current": "durable-Neon-Connect-store-local", "remaining": "Actual provider/readiness proof and separate Connect LIVE authority; no in-memory-only claim."}}]

#### LOCAL-PROOF-037 — P2 / medium / billing-data
**Root cause:** Bounded implemented portion: No live-mode audit-sink implementation
**Mappings:** backlog [37]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-billing-data.json", "backlogDisposition": {"id": 37, "oldStatus": "done", "current": "durable-awaited-live-audit-sink-local", "remaining": "Actual authorization evidence; fixture core witness not operational authority; site remains closed."}}]

#### LOCAL-PROOF-039 — P2 / medium / sites-ui
**Root cause:** Bounded implemented portion: No security headers on the umbrella or catalogs
**Mappings:** backlog [39]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json", "backlogDisposition": {"id": 39, "currentOutcome": "Recovered/current evidence discussed in audit MD; do not infer missing JSON closure."}}]

#### LOCAL-PROOF-041 — P2 / medium / delivery-ops
**Root cause:** Bounded implemented portion: No automated `next build` of any site
**Mappings:** backlog [41]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "backlogDisposition": {"id": 41, "outcome": "OLD_CLAIM_REFUTED_WITH_HOLE", "current": "Three-site CI Next build matrix exists;baseline local umbrella/game build evidence;Kids CI missing DOPS-004;fresh all-site verification belongs builders/integration"}}]

#### LOCAL-PROOF-042 — P2 / medium / sites-ui
**Root cause:** Bounded implemented portion: `robots.txt` and `sitemap.xml` return `404`
**Mappings:** backlog [42]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json", "backlogDisposition": {"id": 42, "currentOutcome": "Recovered/current evidence discussed in audit MD; do not infer missing JSON closure."}}]

#### LOCAL-043 — P2 / medium / sites-ui
**Root cause:** Umbrella has no `not-found.tsx`; no site has `error.tsx`, `global-error.tsx`, or `loading.tsx`.
**Mappings:** backlog [43]; requirements [].
**Chosen solution:** Retain current bounded implementation/refusal evidenced by the live audit; no rebuilding a refuted categorical gap.
**Acceptance:** ["Current bounded criterion in lane audit remains satisfied; external/full-capability proof is separately tracked rather than inferred from old done."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json", "backlogDisposition": {"id": 43, "currentOutcome": "Recovered/current evidence discussed in audit MD; do not infer missing JSON closure."}}]

#### LOCAL-044 — P2 / medium / sites-ui
**Root cause:** Operator internals shown to users
**Mappings:** backlog [44]; requirements [].
**Chosen solution:** Retain current bounded implementation/refusal evidenced by the live audit; no rebuilding a refuted categorical gap.
**Acceptance:** ["Current bounded criterion in lane audit remains satisfied; external/full-capability proof is separately tracked rather than inferred from old done."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json", "backlogDisposition": {"id": 44, "currentOutcome": "Recovered/current evidence discussed in audit MD; do not infer missing JSON closure."}}]

#### LOCAL-PROOF-045 — P2 / medium / sites-ui
**Root cause:** Bounded implemented portion: `/api/checkout` has no origin check, unlike login, logout, and intake.
**Mappings:** backlog [45]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json", "backlogDisposition": {"id": 45, "currentOutcome": "Recovered/current evidence discussed in audit MD; do not infer missing JSON closure."}}]

#### LOCAL-047 — P2 / low / sites-ui
**Root cause:** `/docs` is a single page; no help, FAQ, or status page.
**Mappings:** backlog [47]; requirements [].
**Chosen solution:** Retain current bounded implementation/refusal evidenced by the live audit; no rebuilding a refuted categorical gap.
**Acceptance:** ["Current bounded criterion in lane audit remains satisfied; external/full-capability proof is separately tracked rather than inferred from old done."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json", "backlogDisposition": {"id": 47, "currentOutcome": "Recovered/current evidence discussed in audit MD; do not infer missing JSON closure."}}]

#### LOCAL-PROOF-054 — P2 / medium / desktop-linux
**Root cause:** Bounded implemented portion: No crash reporting or telemetry; no `render-process-gone` / `child-process-gone` handling.
**Mappings:** backlog [54]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "backlogDisposition": {"id": 54, "priorStatus": "done", "currentOutcome": "CURRENT_CRASH_HANDLING_REFUTES_OLD_ABSENCE; RAW_DUMP_POLICY_OPEN", "evidenceIds": ["diagnostics"], "remainingFindingIds": ["DL-PRIV-06"]}}]

#### LOCAL-PROOF-057 — P2 / medium / shells
**Root cause:** Bounded implemented portion: Fake controls
**Mappings:** backlog [57]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "backlogDisposition": {"id": 57, "datedStatus": "done", "revalidatedStatus": "truthful-refusals-retained-capabilities-incomplete", "source": ["apps/desktop-shell/src/visual-model.ts:1371-1372", "apps/desktop-shell/src/chrome.ts:159,191,575,733,927,2307"], "staleClaimRefuted": "Console is now a real host evidence log, not merely inert.", "intentionalRefusals": ["hosted assistant metering unavailable and visibly named", "project-browser Rename/Delete inert to preserve canonical boundaries", "Compose explicitly has no bound composition editor"], "remaining": "Full capabilities still absent; Plugins mutating generic commands affected by SHELL-002. Do not widen matrix or activate hosted billing from a refusal-control fix."}}]

#### LOCAL-PROOF-060 — P2 / medium / desktop-linux
**Root cause:** Bounded implemented portion: Electron 43.2.0 GPU process SIGSEGV in the current-host smoke
**Mappings:** backlog [60]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "backlogDisposition": {"id": 60, "priorStatus": "done", "currentOutcome": "HISTORICAL_GPU_SIGSEGV_NOT_REPRODUCED; PHYSICAL_GPU_UNPROVEN", "evidenceIds": ["smoke-before", "smoke-refutation", "packaged"], "remainingFindingIds": ["DL-COV-04"]}}]

#### LOCAL-PROOF-063 — P2 / medium / engine
**Root cause:** Bounded implemented portion: Physics is contract-only
**Mappings:** backlog [63]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 63, "oldStatus": "done", "oldClaim": "Physics is contract-only/no Rapier adapter", "currentOutcome": "OLD_CATEGORICAL_CLAIM_REFUTED; real WASM bounded adapter passes; full scene pose/resume incomplete", "source": "packages/physics-rapier/src/index.ts:47 createRapierPhysicsWorldHost; world.ts:108 index-derived vertical pose", "remainingTask": "ENG-010", "priority": "P1", "owner": "engine-builder + schemas + desktop-scene", "fix": "Explicit scene pose/joint-frame/animation-order contract, physics-aware persistence/resume; keep nonzero animation-offset refusal until implemented; narrow serialize currently diagnostic rather than generic restore", "ownedFiles": ["packages/physics-rapier/src/world.ts", "packages/engine-kernel/src/scene-session.ts", "packages/physics-rapier/test/seam.test.ts"], "sharedFiles": ["packages/schemas/src/physics-world-host.ts", "packages/schemas/src/desktop-scene-physics.ts", "desktop/linux/src/lib/desktop-scene.ts", "desktop/linux/src/renderer/viewport.ts"], "acceptanceCommand": "pnpm exec vitest run packages/physics-rapier/test/seam.test.ts tests/e2e/physics-rapier-golden.test.ts tests/e2e/desktop-physics-golden.test.ts tests/e2e/desktop-animation-golden.test.ts", "additionalAcceptance": "Public posed multi-object save/load/replay joint/collision digest and real renderer pose evidence", "evidence": ["E1", "E2"]}}]

#### LOCAL-PROOF-066 — P2 / medium / engine
**Root cause:** Bounded implemented portion: Imported models are untextured
**Mappings:** backlog [66]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 66, "oldStatus": "done", "oldClaim": "Imported models untextured", "currentOutcome": "OLD_CATEGORICAL_CLAIM_REFUTED; UV+contained PNG RGBA DataTexture implemented; compressed format/pixel holes remain", "source": "packages/engine-presentation/src/three-sculpt.ts:166 buildTriangleAsset", "remainingTask": "ENG-012", "priority": "P2", "owner": "engine-builder + assets/importers/schema", "fix": "Real admitted checker-texture pixel/resource proof; bounded contained JPEG/WebP decoding if supported", "ownedFiles": ["packages/engine-presentation/src/three-sculpt.ts", "packages/engine-presentation/test/three-presentation.test.ts"], "sharedFiles": ["packages/importers/ (glTF decoder)", "packages/schemas/ (asset render contracts)", "desktop/linux/src/renderer/viewport.ts"], "acceptanceCommand": "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts tests/e2e/asset-ingestion-golden.test.ts", "additionalAcceptance": "Actual admitted textured GLB/glTF browser/packaged checker pixels,resize/dispose,malformed bounds; numeric PNG-array test alone insufficient"}}]

#### LOCAL-PROOF-067 — P2 / medium / engine
**Root cause:** Bounded implemented portion: No imported-animation playback or skeletal animation
**Mappings:** backlog [67]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 67, "oldStatus": "done", "oldClaim": "No imported-animation playback or skeletal animation", "currentOutcome": "NODE_TRS_PLAYBACK_IMPLEMENTED; skeleton/CUBICSPLINE and feature pixel proof absent", "source": "packages/engine-presentation/src/three-sculpt.ts:397 playTriangleAnimation", "remainingTask": "ENG-013", "priority": "P2", "owner": "engine-builder + assets/glTF schema + desktop-playback", "fix": "Real STEP/LINEAR node animation pixels/replay/time bounds; implement validated skinning/CUBICSPLINE separately or preserve unsupported refusal and missing-capability list", "ownedFiles": ["packages/engine-presentation/src/three-sculpt.ts", "packages/engine-presentation/test/three-presentation.test.ts"], "sharedFiles": ["packages/schemas/ (glTF animation/skin contracts)", "packages/importers/ (glTF projection)", "desktop/linux/src/renderer/viewport.ts"], "acceptanceCommand": "pnpm exec vitest run tests/e2e/desktop-animation-golden.test.ts packages/engine-presentation/test/three-presentation.test.ts", "additionalAcceptance": "Real imported animation before/after pixel changes,deterministic time replay and stable resources; explicit unsupported formats remain visible"}}]

#### LOCAL-PROOF-068 — P2 / medium / engine
**Root cause:** Bounded implemented portion: Post-processing, particles, and material overrides are in schemas only and never drawn
**Mappings:** backlog [68]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 68, "oldStatus": "done", "oldClaim": "Postprocess/particles/material overrides schemas-only", "currentOutcome": "OLD_CATEGORICAL_CLAIM_REFUTED; renderer implementations exist, feature pixel/performance proof incomplete", "source": "packages/engine-presentation/src/three-surface.ts:224 configureEffects; three-core.ts:294 sampleEffects; three-sculpt.ts:320 setMaterialOverrides", "remainingTask": "ENG-014", "priority": "P2", "owner": "engine-builder + sites/desktop fixture wiring", "fix": "Actual bloom/vignette/particle/emissive/opacity pixel comparisons, switching/disposal/restoration resource plateau", "ownedFiles": ["packages/engine-presentation/src/three-surface.ts", "packages/engine-presentation/src/three-core.ts", "packages/engine-presentation/src/three-sculpt.ts"], "sharedFiles": ["sites/umbrella/src/app/_components/sculpt-viewport.tsx", "desktop/linux/src/renderer/viewport.ts"], "acceptanceCommand": "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts packages/engine-presentation/test/three-surface.test.ts", "additionalAcceptance": "Real authored-catalog WebGL comparisons and long-lived performance; no headless pixel inference"}}]

#### LOCAL-PROOF-069 — P2 / medium / engine
**Root cause:** Bounded implemented portion: No gamepad support; the kernel consumes no input.
**Mappings:** backlog [69]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 69, "oldStatus": "done", "oldClaim": "No gamepad support/kernel input", "currentOutcome": "OLD_NO_GAMEPAD_CLAIM_REFUTED; standard input sampling/deadzones supported; primary gameplay and physical-device proof missing", "remainingTask": "ENG-015", "priority": "P1", "owner": "desktop-input/play + engine-builder/schema", "fix": "Connect bounded play.primary to ENG009, preserve contexts/source-hash clone and restart-durable rebinding; physical controller evidence distinct", "ownedFiles": ["packages/engine-kernel/src/session.ts"], "sharedFiles": ["packages/schemas/src/input-action-registry.ts", "desktop/linux/src/renderer/viewport.ts", "desktop/linux/src/lib/bridge.ts"], "acceptanceCommand": "pnpm exec vitest run tests/e2e/input-actions-golden.test.ts packages/schemas/test/input-action-registry.test.ts", "additionalAcceptance": "Actual packaged input/play flow and genuine connected standard-controller test, not navigator mock", "evidence": ["E2"]}}]

#### LOCAL-PROOF-074 — P2 / medium / cli
**Root cause:** Bounded implemented portion: `project dev --watch` refuses `NOT_IMPLEMENTED`
**Mappings:** backlog [74]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "backlogDisposition": {"id": 74, "historicalStatus": "done", "currentDisposition": "implemented", "evidence": "run.ts main/runWatch and spawned bin-smoke tests stream edits and stop on SIGINT, including nonzero termination on refused cycle. README refusal sentence is stale; CLI-004 help/watch lifecycle bug remains."}}]

#### LOCAL-PROOF-080 — P2 / medium / delivery-ops
**Root cause:** Bounded implemented portion: No getting-started guide, tutorial, or `examples/`.
**Mappings:** backlog [80]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "backlogDisposition": {"id": 80, "outcome": "OLD_ABSENCE_REFUTED", "current": "docs/getting-started.md and examples exist;existing examples golden is baseline-gate-covered;fresh whole-guide execution not performed by read-only auditor"}}]

#### LOCAL-PROOF-081 — P2 / medium / delivery-ops
**Root cause:** Bounded implemented portion: No generated API reference.
**Mappings:** backlog [81]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "backlogDisposition": {"id": 81, "outcome": "PARTIAL_DONE", "current": "Generator and output exist;DOPS-006 incomplete all-public API coverage;regeneration writes disallowed paths so delegated to builder"}}]

#### LOCAL-082 — P2 / medium / delivery-ops
**Root cause:** No root `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, or `CODE_OF_CONDUCT`.
**Mappings:** backlog [82]; requirements [].
**Chosen solution:** Retain current bounded implementation/refusal evidenced by the live audit; no rebuilding a refuted categorical gap.
**Acceptance:** ["Current bounded criterion in lane audit remains satisfied; external/full-capability proof is separately tracked rather than inferred from old done."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "backlogDisposition": {"id": 82, "outcome": "OLD_ABSENCE_REFUTED", "current": "CHANGELOG,CONTRIBUTING,SECURITY,CODE_OF_CONDUCT exist;SECURITY private-advisory path has no response SLA;real operator contact/evidence required"}}]

#### LOCAL-PROOF-083 — P2 / medium / delivery-ops
**Root cause:** Bounded implemented portion: Docs are governance-heavy, not user guides; the canonical spec lives in issue #1 and cites an out-of-tree arch
**Mappings:** backlog [83]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "backlogDisposition": {"id": 83, "outcome": "PARTIAL_DONE", "current": "User getting-started/examples now exist;external canonical spec/archive and missing advanced targets remain explicit"}}]

#### LOCAL-PROOF-084 — P2 / medium / delivery-ops
**Root cause:** Bounded implemented portion: Stale docs
**Mappings:** backlog [84]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "backlogDisposition": {"id": 84, "outcome": "OLD_SNAPSHOT_NOT_AUTHORITY", "current": "NEXT-STEP references old SHA as prior history,not proof current HEAD;deployment external observations dated2026-08-01 require real re-observation rather than new timestamps"}}]

#### LOCAL-PROOF-085 — P2 / medium / delivery-ops
**Root cause:** Bounded implemented portion: Thin READMEs
**Mappings:** backlog [85]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "backlogDisposition": {"id": 85, "outcome": "OLD_ABSENCE_REFUTED", "current": "Provider README42 lines contains exports/refusals/transport/no-production-proof;fixture deterministic assertion contradicted DOPS-003"}}]

#### LOCAL-PROOF-086 — P2 / medium / delivery-ops
**Root cause:** Bounded implemented portion: No alert or scheduled job before the 2026-11-10 artifact expiry.
**Mappings:** backlog [86]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "backlogDisposition": {"id": 86, "outcome": "LOCAL_DONE_EXTERNAL_ALERT_PROOF", "current": "Weekly expiry workflow and21-day threshold exist;40 days left today;2 threshold tests pass;actual notification/operator delivery not evidenced"}}]

#### LOCAL-088 — P2 / low / delivery-ops
**Root cause:** Zero open GitHub issues, so none of the above is tracked.
**Mappings:** backlog [88]; requirements [].
**Chosen solution:** Retain current bounded implementation/refusal evidenced by the live audit; no rebuilding a refuted categorical gap.
**Acceptance:** ["Current bounded criterion in lane audit remains satisfied; external/full-capability proof is separately tracked rather than inferred from old done."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "backlogDisposition": {"id": 88, "outcome": "LOCAL_TRACKING_DONE_EXTERNAL_ISSUES_UNOBSERVED", "current": "90-item backlog and swarm reports provide local tracking;no issue creation authority or current issue-count claim"}}]

#### LOCAL-089 — P2 / high / desktop-linux
**Root cause:** `pnpm dist` builds the installers but exits with an electron-builder `channel` TypeError during cleanup
**Mappings:** backlog [89]; requirements [].
**Chosen solution:** Retain current bounded implementation/refusal evidenced by the live audit; no rebuilding a refuted categorical gap.
**Acceptance:** ["Current bounded criterion in lane audit remains satisfied; external/full-capability proof is separately tracked rather than inferred from old done."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "backlogDisposition": {"id": 89, "priorStatus": "done", "currentOutcome": "FRESH_DIST_AND_ARTIFACT_HASHES_PASS; OLD_CHANNEL_ERROR_REFUTED", "evidenceIds": ["dist", "packaged"], "remainingFindingIds": []}}]

#### LOCAL-PROOF-090 — P2 / medium / engine
**Root cause:** Bounded implemented portion: Product viewports do not forward authored environment/material/effect catalogs (effects payload lacks its seed; texture slots need an asset-to-texture binding contract)
**Mappings:** backlog [90]; requirements [].
**Chosen solution:** Preserve the explicitly tested bounded part; not full-production closure.
**Acceptance:** ["Exact passing current lane evidence only; residual gap IDs below remain open."]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 90, "oldStatus": "done", "oldClaim": "Product viewports do not forward environment/material/effect catalogs", "currentOutcome": "CATALOG_FORWARDING_IMPLEMENTED; non-null texture slots intentionally refused; feature pixels incomplete", "source": "packages/engine-presentation/src/three-sculpt.ts:325 setMaterialOverrides texture binding refusal", "remainingTask": "ENG-017", "priority": "P2", "owner": "schemas + assets + engine-builder + site-kit/desktop", "fix": "Contained asset-to-texture binding contract including UV set,color space,sampler,pixel transport; deterministic lookup and actual texture pixels; no external URL loads,independent Kids refusal", "ownedFiles": ["packages/engine-presentation/src/three-sculpt.ts", "packages/engine-presentation/test/three-presentation.test.ts"], "sharedFiles": ["packages/schemas/src/desktop-scene-materials.ts", "packages/site-kit/src/mountable-scene.ts", "desktop/linux/src/renderer/viewport.ts", "sites/umbrella/src/app/_components/sculpt-viewport.tsx"], "acceptanceCommand": "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts tests/e2e/umbrella-editor-viewport-golden.test.ts && pnpm check:contracts", "additionalAcceptance": "Real contained authored texture positive/negative pixels; non-null slots refuse until genuinely supported; never null placeholders claiming texture binding"}}]

#### REQ-PROOF-TOPO-001 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: SceneAxi is one interactive engine/library ecosystem with separately versioned Game, Web Experience, and Kids profiles over one runtime and authoring core.
**Mappings:** backlog []; requirements ['TOPO-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "packages/authoring-core"}, {"reference": "packages/profile-game"}, {"reference": "packages/profile-web"}, {"reference": "packages/profile-kids"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "TOPO-001", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/docs/module-coverage.test.ts", "tests/parity/shell-cli-parity.test.ts"]}]

#### REQ-PROOF-TOPO-002 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The monorepo uses strict downward package and surface boundaries, with exhaustive allow and deny lists.
**Mappings:** backlog []; requirements ['TOPO-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/dependency-matrix.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "TOPO-002", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/injected-violations.test.ts", "scripts/check-boundaries.mjs"]}]

#### REQ-PROOF-TOPO-003 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: Individual games remain outside this monorepo and consume versioned SceneAxi releases from separate repositories.
**Mappings:** backlog []; requirements ['TOPO-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/program/SPEC.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/dependency-matrix.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "TOPO-003", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/docs/module-coverage.test.ts"]}]

#### REQ-PROOF-TOPO-004 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: All shared contracts live in schemas, which has zero internal dependencies.
**Mappings:** backlog []; requirements ['TOPO-004'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "packages/schemas"}, {"reference": "packages/schemas/contracts"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "TOPO-004", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["packages/schemas/test/seam.test.ts", "pnpm check:boundaries"]}]

#### REQ-PROOF-TOPO-005 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: Profiles are independently versioned and each profile manifest carries a supported core-version range.
**Mappings:** backlog []; requirements ['TOPO-005'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-game/package.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-web/package.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-kids/package.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "TOPO-005", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/", "tests/docs/module-coverage.test.ts"]}]

#### REQ-PROOF-TOPO-006 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The core train, contracts, profiles, CLI protocol, identity, billing, and site packages use their declared release-group rules without implicit migration.
**Mappings:** backlog []; requirements ['TOPO-006'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/package.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/*/package.json", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "TOPO-006", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/injected-violations.test.ts", "pnpm check:boundaries"]}]

#### REQ-PROOF-HOLD-001 — P2 / medium / cli
**Root cause:** Bounded requirement declaration: Every held-key-gated CLI verb establishes the authoritative registry epoch before local checks and has no offline exception.
**Mappings:** backlog []; requirements ['HOLD-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "enforced-with-local-hardening-gap"]
**File/symbol targets and exact owner:** [{"reference": "packages/cli/src/held-keys"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "currentSemanticEntry": {"id": "HOLD-001", "result": "enforced-with-local-hardening-gap", "evidence": "Shipped demo exit3 currency-unavailable; CLI-003 invalid freshness inputs allow at exported gate."}, "expectedEvidenceLayer": ["packages/cli/test/held-keys.*.test.ts", "packages/cli/test/held-keys.regressions.test.ts"]}]

#### REQ-PROOF-HOLD-002 — P2 / medium / cli
**Root cause:** Bounded requirement declaration: Held-key enforcement refuses unavailable currency, epoch drift, missing or stale snapshots, schema or map mismatch, undeclared verbs, open keys, and unknown keys.
**Mappings:** backlog []; requirements ['HOLD-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "mandatory-regressions-pass"]
**File/symbol targets and exact owner:** [{"reference": "packages/cli/src/held-keys"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/held-key-registry.schema.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "currentSemanticEntry": {"id": "HOLD-002", "result": "mandatory-regressions-pass", "evidence": "Fresh N/N versus N+1 refuses authoritative-epoch-mismatch; unavailable authority refuses currency-unavailable; bypass env regressions pass."}, "expectedEvidenceLayer": ["packages/cli/test/held-keys.refusal-table.test.ts"]}]

#### REQ-PROOF-HOLD-003 — P2 / medium / cli
**Root cause:** Bounded requirement declaration: Held-key acceptance includes both the fresh client epoch versus authoritative epoch bump regression and the unavailable-authority regression.
**Mappings:** backlog []; requirements ['HOLD-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "map-coverage-pass"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/held-keys.*.test.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "currentSemanticEntry": {"id": "HOLD-003", "result": "map-coverage-pass", "evidence": "All 21 ROOT_COMMANDS verb leaves declared in shipped map; undeclared/map/snapshot refusal tests pass; no real holds issued."}, "expectedEvidenceLayer": ["packages/cli/test/held-keys.regressions.test.ts"]}]

#### REQ-PROOF-CORE-001 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: The Game Kernel public seam is open, dispatch, advance, observe, save, and replay, with only advance allowed to mutate.
**Mappings:** backlog []; requirements ['CORE-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "BOUNDED_HERMETIC_PASS_WITH_DEFECTS"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-001", "outcome": "BOUNDED_HERMETIC_PASS_WITH_DEFECTS", "evidence": ["E1", "E2", "E3", "E9"], "remaining": ["ENG-002", "ENG-001", "ENG-008", "ENG-009"]}, "expectedEvidenceLayer": ["packages/engine-kernel/test/scene-session.test.ts", "tests/e2e/cli-golden-path.test.ts"]}]

#### REQ-PROOF-CORE-002 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: The open path above the kernel resolves one host, stamps a deterministic bootstrap record, turns kernel throws into named refusals, and closes each handle once without a job system.
**Mappings:** backlog []; requirements ['CORE-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "BOUNDED_PASS_ORDINARY_ERRORS"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-002", "outcome": "BOUNDED_PASS_ORDINARY_ERRORS", "evidence": ["E1", "E2", "E3", "E9"], "remaining": ["ENG-007"], "intentionalBoundary": "close denies subsequent session() retrieval, not already-returned pure kernel references"}, "expectedEvidenceLayer": ["packages/engine-orchestrator/test/golden-path-orchestrated.test.ts", "tests/e2e/profile-game-scene-golden.test.ts"]}]

#### REQ-PROOF-CORE-003 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: Kernel digests remain portable and browser-safe, with no Node builtins or Node-only globals in the kernel source.
**Mappings:** backlog []; requirements ['CORE-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PORTABILITY_AND_ACTUAL_BROWSER_REPLAY_PASS"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/portable-digest.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"reference": "packages/engine-kernel/src"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-003", "outcome": "PORTABILITY_AND_ACTUAL_BROWSER_REPLAY_PASS", "evidence": ["E2", "E7"], "remaining": ["cross-browser/native-host performance"], "caution": "browser-open-play.test.ts executes Node portability checks; actual browser replay separately exercised in E7"}, "expectedEvidenceLayer": ["packages/engine-kernel/test/browser-open-play.test.ts", "pnpm check:boundaries"]}]

#### REQ-PROOF-CORE-005 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: The shared open-path policy is one data identity across CLI, profiles, desktop shell, and web shell; Kids is refuse-only and shippingClaim is false.
**Mappings:** backlog []; requirements ['CORE-005'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "POLICY_PARITY_REFUSAL_PASS"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/open-path-policy.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "packages/profile-game"}, {"reference": "packages/profile-web"}, {"reference": "packages/profile-kids"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-005", "outcome": "POLICY_PARITY_REFUSAL_PASS", "evidence": ["E2"], "remaining": ["production shipping claims remain false by protected shared contract"], "intentionalBoundary": "Kids shared open refuses; no dependency/identity/LIVE widening"}, "expectedEvidenceLayer": ["tests/parity/open-path-policy-parity.test.ts", "tests/e2e/profile-kids-refuse-golden.test.ts"]}]

#### REQ-PROOF-CORE-007 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: Headless frames identify that no pixels were drawn; frame counters, tests, and gate output never imply a pixel or GPU claim.
**Mappings:** backlog []; requirements ['CORE-007'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "HEADLESS_TRUTH_AND_REAL_PIXEL_SEPARATION_PASS"]
**File/symbol targets and exact owner:** [{"reference": "packages/engine-presentation/src"}, {"reference": "tests/e2e/"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-007", "outcome": "HEADLESS_TRUTH_AND_REAL_PIXEL_SEPARATION_PASS", "evidence": ["E2", "E5", "E6"], "remaining": ["ENG-006", "authored feature-specific pixels"]}, "expectedEvidenceLayer": ["packages/engine-presentation/test/", "docs/three-presentation-core.md"]}]

#### REQ-PROOF-CORE-008 — P2 / medium / assets-plugins
**Root cause:** Bounded requirement declaration: The contained asset manifest admits only declared bounded profiles, derives stable identity and preview metadata from bytes, and reloads through review without mutating accepted bytes.
**Mappings:** backlog []; requirements ['CORE-008'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "BOUNDED_IMPLEMENTED_WITH_OPEN_DEFECTS"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/importers/src/contained-gltf.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "assets-plugins", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/project-asset-manifest.schema.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "currentSemanticEntry": {"id": "CORE-008", "status": "BOUNDED_IMPLEMENTED_WITH_OPEN_DEFECTS", "evidence": ["E2", "E3", "E4", "E5"], "openTasks": ["AP-01", "AP-02", "AP-04", "AP-05"], "statement": "Declared asset profiles, stable-id review reload, canonical-byte integrity and preview/provenance derive from bytes; no new format admitted"}, "expectedEvidenceLayer": ["tests/e2e/asset-pipeline-golden.test.ts", "tests/e2e/asset-ingestion-golden.test.ts"]}]

#### REQ-PROOF-CORE-011 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: Hierarchy, ordered multi-select, explicit-policy parenting, protected-root rules, and stable object identities project from the validated composed scene.
**Mappings:** backlog []; requirements ['CORE-011'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PUBLIC_HIERARCHY_PREFAB_GOLDEN_PASS"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-edit.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/desktop-scene.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-011", "outcome": "PUBLIC_HIERARCHY_PREFAB_GOLDEN_PASS", "evidence": ["E2"], "remaining": ["actual packaged GUI controls owned desktop/shell lanes"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-hierarchy-golden.test.ts", "tests/e2e/desktop-prefab-golden.test.ts"]}]

#### REQ-PROOF-CORE-012 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: Transforms use one review command for numeric fields and gizmo nudges, with explicit local/world, pivot, axis, and snap inputs and no preview write before acceptance.
**Mappings:** backlog []; requirements ['CORE-012'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PUBLIC_TRANSFORM_REVIEW_GOLDEN_PASS"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-transform.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "desktop/linux/src/lib"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-012", "outcome": "PUBLIC_TRANSFORM_REVIEW_GOLDEN_PASS", "evidence": ["E2"], "remaining": ["real gizmo/numeric-control input owner front door"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-transform-golden.test.ts", "packages/schemas/test/desktop-scene-transform.test.ts"]}]

#### REQ-PROOF-CORE-014 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: Unified input actions cover keyboard, pointer, wheel, legacy controller, and standard gamepad buttons/axes with deadzones across editor and play contexts, with defaults, conflict checks, rebind/reset review, and restart-durable settings outside document undo.
**Mappings:** backlog []; requirements ['CORE-014'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "INPUT_REGISTRY_GOLDEN_PASS"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/input-action-registry.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "desktop/linux/src"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-014", "outcome": "INPUT_REGISTRY_GOLDEN_PASS", "evidence": ["E2"], "remaining": ["ENG-015", "physical-controller proof"]}, "expectedEvidenceLayer": ["tests/e2e/input-actions-golden.test.ts", "packages/schemas/test/input-action-registry.test.ts"]}]

#### REQ-PROOF-CORE-015 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: Play uses an isolated clone bound to an explicit source hash; viewport sources switch through one owner and stop/reset never write authoring bytes.
**Mappings:** backlog []; requirements ['CORE-015'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "ISOLATED_PLAY_SOURCE_HASH_GOLDEN_PASS"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-play-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-015", "outcome": "ISOLATED_PLAY_SOURCE_HASH_GOLDEN_PASS", "evidence": ["E2"], "remaining": ["actual packaged play/stop/reset front door owned desktop lane"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-play-session-golden.test.ts", "tests/e2e/desktop-linux-bridge-golden.test.ts"]}]

#### REQ-PROOF-CORE-017 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: Physics commands author deterministic bodies, shapes, materials, constraints, gravity, and a fixed 1–32ms step; animation precedes physics when both affect an object.
**Mappings:** backlog []; requirements ['CORE-017'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "REAL_WASM_FIXED_STEP_AND_GOLDEN_ORDER_PASS_BOUNDED"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-physics.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "packages/engine-presentation/src"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-017", "outcome": "REAL_WASM_FIXED_STEP_AND_GOLDEN_ORDER_PASS_BOUNDED", "evidence": ["E1", "E2"], "remaining": ["ENG-010", "ENG-008"], "intentionalBoundary": "nonzero Rapier animation offsets still explicitly refuse; pose contract incomplete"}, "expectedEvidenceLayer": ["tests/e2e/desktop-physics-golden.test.ts", "packages/schemas/test/desktop-scene-physics.test.ts"]}]

#### REQ-PROOF-CORE-018 — P2 / medium / engine
**Root cause:** Bounded requirement declaration: Environment, material, and seeded decorative-effect authoring stays presentation-authored, bounded, digest-stamped, and independently Kids-refusable.
**Mappings:** backlog []; requirements ['CORE-018'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CATALOG_AUTHORING_SCHEMA_AND_RENDERER_HERMETIC_PASS"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-environment.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-materials.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-effects.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-018", "outcome": "CATALOG_AUTHORING_SCHEMA_AND_RENDERER_HERMETIC_PASS", "evidence": ["E2"], "remaining": ["ENG-003", "ENG-014", "ENG-017"]}, "expectedEvidenceLayer": ["packages/schemas/test/desktop-scene-environment.test.ts", "packages/schemas/test/desktop-scene-materials.test.ts", "packages/schemas/test/desktop-scene-effects.test.ts"]}]

#### REQ-PROOF-PROF-001 — P2 / medium / profiles-kids
**Root cause:** Bounded requirement declaration: Game and Web Experience profiles expose their bounded R1 open paths through the shared core; the Kids shared engine path is R0 refuse-only.
**Mappings:** backlog []; requirements ['PROF-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "BOUNDED_PUBLIC_PATHS_VERIFIED"]
**File/symbol targets and exact owner:** [{"reference": "packages/profile-game"}, {"reference": "packages/profile-web"}, {"reference": "packages/profile-kids"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "currentSemanticEntry": {"id": "PROF-001", "outcome": "BOUNDED_PUBLIC_PATHS_VERIFIED", "evidence": ["PK-E1", "PK-E3", "PK-E6"], "holes": ["No shipping inference", "Export no browser pixels"]}, "expectedEvidenceLayer": ["tests/e2e/cli-golden-path.test.ts", "tests/e2e/profile-web-golden-path.test.ts", "tests/e2e/profile-kids-refuse-golden.test.ts"]}]

#### REQ-PROOF-PROF-002 — P2 / medium / profiles-kids
**Root cause:** Bounded requirement declaration: The Web Experience profile covers interactive site shells, hero scenes, configurators, storytelling, microsites, and data-driven real-time experiences, not CMS or SaaS behavior.
**Mappings:** backlog []; requirements ['PROF-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PARTIAL_BOUNDED_SCOPE_AND_SUBSET"]
**File/symbol targets and exact owner:** [{"reference": "packages/profile-web"}, {"reference": "packages/site-kit"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "currentSemanticEntry": {"id": "PROF-002", "outcome": "PARTIAL_BOUNDED_SCOPE_AND_SUBSET", "evidence": ["PK-E1", "PK-E3"], "holes": ["Per-use-case hero/configurator/storytelling/microsite/data-driven real-time evidence incomplete"], "findingIds": ["PK-004"]}, "expectedEvidenceLayer": ["tests/e2e/profile-web-golden-path.test.ts", "tests/sites/web-experience-editor.test.ts"]}]

#### REQ-PROOF-PROF-004 — P2 / medium / profiles-kids
**Root cause:** Bounded requirement declaration: The Kids isolated activity is the only shipped Kids surface; it uses its own allowlist and in-memory activity and is not a consumer of shared profile or site packages.
**Mappings:** backlog []; requirements ['PROF-004'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "ISOLATED_ACTIVITY_PARITY_VERIFIED_WITH_DEFECT"]
**File/symbol targets and exact owner:** [{"reference": "sites/kids/src"}, {"reference": "packages/profile-kids"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "currentSemanticEntry": {"id": "PROF-004", "outcome": "ISOLATED_ACTIVITY_PARITY_VERIFIED_WITH_DEFECT", "evidence": ["PK-E1", "PK-E4", "PK-E7"], "holes": ["Do not interpret shipped requirement wording as public deployment", "No-op revision defect", "Site install/build/browser missing"], "findingIds": ["PK-001", "PK-002", "PK-005"]}, "expectedEvidenceLayer": ["tests/sites/kids-surface.test.ts", "packages/profile-kids/test/activity.test.ts"]}]

#### REQ-PROOF-PROF-005 — P2 / medium / profiles-kids
**Root cause:** Bounded requirement declaration: The Model Provider Port is provider-neutral, capability-typed, per-profile filtered, and refuses absent policy, adapter, or capability before dispatch.
**Mappings:** backlog []; requirements ['PROF-005'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "INJECTED_PORT_AND_REFUSALS_VERIFIED"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/model-provider-port.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/model-provider-port.schema.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "currentSemanticEntry": {"id": "PROF-005", "outcome": "INJECTED_PORT_AND_REFUSALS_VERIFIED", "evidence": ["PK-E3"], "holes": ["Live eligible provider availability and actual production dispatch unobserved; other owners"]}, "expectedEvidenceLayer": ["packages/authoring-core/test/model-provider-port.test.ts", "tests/e2e/desktop-provider-host-golden.test.ts"]}]

#### REQ-PROOF-PROF-006 — P2 / medium / profiles-kids
**Root cause:** Bounded requirement declaration: OpenRouter-first is the locked default for eligible non-Kids lanes, while DeepSeek use remains conditional, pinned, residency-bound, no-fallback, and outside strict tool-calling lanes.
**Mappings:** backlog []; requirements ['PROF-006'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CONDITIONAL_PINNED_REFUSALS_VERIFIED"]
**File/symbol targets and exact owner:** [{"reference": "packages/provider-openrouter"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/provider-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "currentSemanticEntry": {"id": "PROF-006", "outcome": "CONDITIONAL_PINNED_REFUSALS_VERIFIED", "evidence": ["PK-E3"], "holes": ["No configured live provider evidence"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-provider-host-golden.test.ts", "tests/desktop/desktop-opencode-live-transport.test.ts"]}]

#### REQ-PROOF-CAT-001 — P2 / medium / assets-plugins
**Root cause:** Bounded requirement declaration: The catalog is one modular platform under two independently branded Game and Web storefronts with separate taxonomy, curation, branding, origins, and product surfaces.
**Mappings:** backlog []; requirements ['CAT-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "SOURCE_AND_HERMETIC_PARITY_PROVEN_PRODUCTION_NOT_ATTESTED"]
**File/symbol targets and exact owner:** [{"reference": "sites/catalog-game"}, {"reference": "sites/catalog-web"}, {"reference": "packages/site-kit"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "currentSemanticEntry": {"id": "CAT-001", "status": "SOURCE_AND_HERMETIC_PARITY_PROVEN_PRODUCTION_NOT_ATTESTED", "evidence": ["E2", "E9"], "statement": "Two brands/origins over shared modular platform; public fixtures Game3/Web1, no production taxonomy/curation inventory claim"}, "expectedEvidenceLayer": ["tests/sites/catalog-storefronts.test.ts", "tests/e2e/"]}]

#### REQ-PROOF-CAT-002 — P2 / medium / assets-plugins
**Root cause:** Bounded requirement declaration: Catalog intake proceeds quarantine to screening to human curation to listing and delisting/takedown, with every transition recorded and fail-closed.
**Mappings:** backlog []; requirements ['CAT-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PUBLIC_TEST_PIPELINE_DRIVEABLE_PRODUCTION_STORE_ABSENT"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/catalog-pipeline.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/catalog-submission.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "currentSemanticEntry": {"id": "CAT-002", "status": "PUBLIC_TEST_PIPELINE_DRIVEABLE_PRODUCTION_STORE_ABSENT", "evidence": ["E3"], "statement": "TEST transition pipeline exists; deployment intake null and production moderation/storage not evidenced"}, "expectedEvidenceLayer": ["tests/e2e/catalog-fixture-commerce-golden.test.ts", "tests/sites/identity-plane-wiring.test.ts"]}]

#### REQ-PROOF-CAT-003 — P2 / medium / assets-plugins
**Root cause:** Bounded requirement declaration: Catalog items carry rights, provenance, mandatory AI disclosure, compatibility metadata, format profiles, and recorded moderation evidence.
**Mappings:** backlog []; requirements ['CAT-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CONTRACT_AND_FIXTURE_VALIDATION_PROVEN_ACTUAL_PAYLOAD_PROVENANCE_INPUT_REQUIRED"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/catalog-item.schema.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/fixture-commerce.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "currentSemanticEntry": {"id": "CAT-003", "status": "CONTRACT_AND_FIXTURE_VALIDATION_PROVEN_ACTUAL_PAYLOAD_PROVENANCE_INPUT_REQUIRED", "evidence": ["E3", "E9"], "statement": "CatalogItem rights/provenance/mandatory AI/compatibility/moderation validation exists; listing view honestly lacks asset payload/licence/preview/compatibility"}, "expectedEvidenceLayer": ["pnpm check:contracts", "tests/e2e/catalog-fixture-commerce-golden.test.ts"]}]

#### REQ-PROOF-CAT-004 — P2 / medium / assets-plugins
**Root cause:** Bounded requirement declaration: Commerce fields remain inert until the existing per-storefront activation holds open; Kids consumption is an allowlist over already-curated items, never a pipeline fork.
**Mappings:** backlog []; requirements ['CAT-004'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "HELD_BOUNDARIES_PROVEN_NO_ACTIVATION"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/fixture-commerce.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"reference": "packages/profile-kids"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/held-key-enforcement.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-assets-plugins.json", "currentSemanticEntry": {"id": "CAT-004", "status": "HELD_BOUNDARIES_PROVEN_NO_ACTIVATION", "evidence": ["E3", "E9"], "statement": "Public commerce inert; Kids shared refusal/no pipeline fork preserved; one TEST fixture commerce path is not public activation"}, "expectedEvidenceLayer": ["tests/e2e/catalog-fixture-commerce-golden.test.ts", "tests/e2e/profile-kids-refuse-golden.test.ts"]}]

#### REQ-PROOF-IDENT-001 — P2 / medium / identity
**Root cause:** Bounded requirement declaration: Identity, credits, and billing use injected Better Auth, Neon, and Stripe adapters; provider clients stay out of hermetic core.
**Mappings:** backlog []; requirements ['IDENT-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_LOCAL_INJECTED_PROVIDER_BOUNDARY"]
**File/symbol targets and exact owner:** [{"reference": "packages/auth"}, {"reference": "packages/billing"}, {"reference": "sites/umbrella/src/provider"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/identity-plane.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-001", "crossLaneSemanticRevalidation": true, "outcome": "PASS_LOCAL_INJECTED_PROVIDER_BOUNDARY", "evidence": "audit-identity verification + audit-billing-data E1/E2/E5/E6/E7; no real provider/deployment proof", "remaining": ["GATE-ACTIVATION", "IDENTITY-05"]}, "expectedEvidenceLayer": ["tests/sites/identity-plane-wiring.test.ts", "tests/boundary/injected-site-violations.test.ts"]}]

#### REQ-PROOF-IDENT-002 — P2 / medium / identity
**Root cause:** Bounded requirement declaration: Admin identity is derived only from normalized SCENEAXI_ADMIN_EMAIL; User has no role field that can be claimed by input.
**Mappings:** backlog []; requirements ['IDENT-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_LOCAL_PRINCIPAL_PROVENANCE_ROLE_GUARDS"]
**File/symbol targets and exact owner:** [{"reference": "packages/auth/src"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-002", "crossLaneSemanticRevalidation": true, "outcome": "PASS_LOCAL_PRINCIPAL_PROVENANCE_ROLE_GUARDS", "evidence": "audit-identity principal/admin origin requirement; auth suite85 assertions", "remaining": ["GATE-ACTIVATION"]}, "expectedEvidenceLayer": ["packages/auth/test/identity-port.test.ts", "tests/e2e/auth-credits-refuse-matrix.test.ts"]}]

#### REQ-PROOF-IDENT-003 — P2 / medium / identity
**Root cause:** Bounded requirement declaration: Hosted login and logout require same-origin proof before fields or identity ports are reached, store the raw grant only in the HttpOnly session cookie, and keep redirects same-site.
**Mappings:** backlog []; requirements ['IDENT-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_HELPER_HANDLER_ORIGIN_COOKIE_REDIRECT"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/login-flow.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}, {"reference": "sites/umbrella/src/app/api/login"}, {"reference": "sites/umbrella/src/app/api/logout"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-003", "crossLaneSemanticRevalidation": true, "outcome": "PASS_HELPER_HANDLER_ORIGIN_COOKIE_REDIRECT", "evidence": "audit-identity CSRF/cookie/origin requirement +153 site assertions", "remaining": ["IDENTITY-05", "GATE-ACTIVATION"]}, "expectedEvidenceLayer": ["tests/sites/umbrella-login-flow.test.ts", "sites/umbrella/test/better-auth-provider.test.ts"]}]

#### REQ-PROOF-IDENT-005 — P2 / medium / identity
**Root cause:** Bounded requirement declaration: Hosted AI is default-off, follows the documented Kids → route → opt-in → ledger → replay → entitlement → metering → provider → debit order, and BYO remains free.
**Mappings:** backlog []; requirements ['IDENT-005'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_LOCAL_DEFAULT_OFF_KIDS_BYOK_METERING_ORDER"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/hosted-ai.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-005", "crossLaneSemanticRevalidation": true, "outcome": "PASS_LOCAL_DEFAULT_OFF_KIDS_BYOK_METERING_ORDER", "evidence": "audit-billing-data E1 hosted-ai cases + audit-identity lifecycle/performance bounded requirement", "remaining": ["BD-007", "BILLING-PRICE-POLICY", "GATE-AI-PROVIDER"]}, "expectedEvidenceLayer": ["tests/e2e/hosted-ai-metering-golden.test.ts", "packages/billing/test/metering.test.ts"]}]

#### REQ-PROOF-IDENT-006 — P2 / medium / identity
**Root cause:** Bounded requirement declaration: Checkout grant persistence acknowledges only after the ledger commit succeeds, and signed webhook evidence is bound to the exact Checkout Session and persisted intent.
**Mappings:** backlog []; requirements ['IDENT-006'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_LOCAL_SIGNED_FIXTURE_EXACT_INTENT_SESSION_DURABILITY"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/checkout.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"reference": "sites/umbrella/src/provider"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-006", "crossLaneSemanticRevalidation": true, "outcome": "PASS_LOCAL_SIGNED_FIXTURE_EXACT_INTENT_SESSION_DURABILITY", "evidence": "audit-billing-data E6/E7 actual disposable PostgreSQL, fixture provider signatures explicitly not real Stripe", "remaining": ["GATE-STRIPE-TEST"]}, "expectedEvidenceLayer": ["packages/billing/test/stripe-checkout.test.ts", "tests/sites/identity-plane-wiring.test.ts"]}]

#### REQ-PROOF-IDENT-007 — P2 / medium / identity
**Root cause:** Bounded requirement declaration: Live Stripe mode has one environment authorization source and remains unavailable without its explicit audited authority; mode, environment, and key prefixes cannot authorize it.
**Mappings:** backlog []; requirements ['IDENT-007'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PASS_LOCAL_LIVE_DEFAULT_REFUSAL_SOURCE"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/live-mode.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"reference": "packages/billing/src"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/lib/provider-adapters.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/db/migrations/0007_stripe_live_mode_audit.sql", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-007", "crossLaneSemanticRevalidation": true, "outcome": "PASS_LOCAL_LIVE_DEFAULT_REFUSAL_SOURCE", "evidence": "audit-billing-data E1/E6 and LIVE/Connect fail-closed acceptanceCoverage", "remaining": ["GATE-LIVE"]}, "expectedEvidenceLayer": ["packages/billing/test/", "tests/e2e/auth-credits-refuse-matrix.test.ts", "sites/umbrella/test/provider-adapters.integration.test.ts"]}]

#### REQ-PROOF-DESK-001 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: The desktop shell derives modes, controls, tabs, refusals, assistant states, and tiers from the shared editor-shell vocabulary and counts every control exactly once.
**Mappings:** backlog []; requirements ['DESK-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PARTIAL_CURRENT_VOCABULARY_TESTED_GUI_INPUT_COVERAGE_OPEN"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/editor-shell.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-001", "outcome": "PARTIAL_CURRENT_VOCABULARY_TESTED_GUI_INPUT_COVERAGE_OPEN", "evidenceIds": ["renderer", "desktop-tests"], "dependencies": ["shells:#53"]}, "expectedEvidenceLayer": ["apps/desktop-shell/test/control-accounting.test.ts", "tests/e2e/desktop-control-inventory-golden.test.ts"]}]

#### REQ-PROOF-DESK-002 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: Standalone desktop chrome opens no kernel or presentation runtime and refuses runtime-dependent Open, Save, and Play controls by name.
**Mappings:** backlog []; requirements ['DESK-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "EXPECTED_STANDALONE_RUNTIME_REFUSAL"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/product-loop.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-002", "outcome": "EXPECTED_STANDALONE_RUNTIME_REFUSAL", "evidenceIds": ["baseline actual chrome", "desktop-tests"]}, "expectedEvidenceLayer": ["apps/desktop-shell/test/chrome.test.ts", "tests/e2e/desktop-product-loop-golden.test.ts"]}]

#### REQ-PROOF-DESK-003 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: The packaged Linux desktop owns the application, bridge, renderer, project lifecycle, and local/BYOK assistant paths without adding a second product implementation.
**Mappings:** backlog []; requirements ['DESK-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CURRENT_LOCAL_PACKAGE_ONE_RENDERER_PROVEN_ASSISTANT_GUI_HOLE"]
**File/symbol targets and exact owner:** [{"reference": "desktop/linux/src/electron"}, {"reference": "desktop/linux/src/lib"}, {"reference": "desktop/linux/src/renderer"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-003", "outcome": "CURRENT_LOCAL_PACKAGE_ONE_RENDERER_PROVEN_ASSISTANT_GUI_HOLE", "evidenceIds": ["renderer", "packaged"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-linux-bridge-golden.test.ts", "pnpm check:desktop"]}]

#### REQ-PROOF-DESK-004 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: First launch binds no project root and writes no project; roots enter only through a validated native dialog or recent registry.
**Mappings:** backlog []; requirements ['DESK-004'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "SOURCE_AND_LIFECYCLE_GOLDEN_PASS_NATIVE_DIALOGS_UNDRIVEN"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-lifecycle.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-host.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-004", "outcome": "SOURCE_AND_LIFECYCLE_GOLDEN_PASS_NATIVE_DIALOGS_UNDRIVEN", "evidenceIds": ["desktop-tests"], "remainingFindingIds": ["DL-COV-03"]}, "expectedEvidenceLayer": ["tests/desktop/desktop-project-lifecycle.test.ts", "tests/e2e/desktop-linux-bridge-golden.test.ts"]}]

#### REQ-PROOF-DESK-005 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: The local agent bridge is a same-user Unix socket with a closed versioned tool and permission registry; every call validates capability, permission, and exact input before the desktop bridge.
**Mappings:** backlog []; requirements ['DESK-005'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "REAL_SOCKET_AND_SPAWNED_CLI_PROOF_NATIVE_REBIND_CRASH_CLEANUP_HOLE"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/local-rpc.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-local-bridge.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-005", "outcome": "REAL_SOCKET_AND_SPAWNED_CLI_PROOF_NATIVE_REBIND_CRASH_CLEANUP_HOLE", "evidenceIds": ["desktop-tests"], "remainingFindingIds": ["DL-COV-03"]}, "expectedEvidenceLayer": ["packages/schemas/test/desktop-local-bridge.test.ts", "tests/e2e/desktop-cli-local-bridge-golden.test.ts"]}]

#### REQ-PROOF-DESK-006 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: Provider credentials never cross CLI arguments, tool input, RPC, discovery, logs, evidence, project documents, or the engine bridge; local and BYOK routes carry no credit route.
**Mappings:** backlog []; requirements ['DESK-006'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "ENCRYPTED_LEASED_REDACTED_FIXTURE_PROOF_NOT_REAL_KEYRING_PROVIDER"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/provider-key-store.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"reference": "desktop/linux/src/renderer"}, {"reference": "desktop/linux/src/lib"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-006", "outcome": "ENCRYPTED_LEASED_REDACTED_FIXTURE_PROOF_NOT_REAL_KEYRING_PROVIDER", "evidenceIds": ["desktop-tests", "provider-origin-probe", "provider-readiness-probe"], "remainingFindingIds": ["DL-SEC-01", "DL-BYOK-02", "DL-PRIV-06"]}, "expectedEvidenceLayer": ["tests/desktop/desktop-byo-secure-storage.test.ts", "tests/e2e/desktop-provider-host-golden.test.ts"]}]

#### REQ-PROOF-DESK-007 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: Ship → Export Web writes a contained content-addressed static viewer and Delivery Handoff without deploying.
**Mappings:** backlog []; requirements ['DESK-007'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "REAL_PACKAGED_CONTAINED_EXPORT_HANDOFF_DIGESTS_PROVEN_NO_DEPLOY"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/web-export.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/delivery-handoff.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-007", "outcome": "REAL_PACKAGED_CONTAINED_EXPORT_HANDOFF_DIGESTS_PROVEN_NO_DEPLOY", "evidenceIds": ["packaged"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-web-export-golden.test.ts"]}]

#### REQ-PROOF-DESK-009 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: The umbrella editor constructs no canvas before identity and entitlement access succeeds; browser controls change URL state and never mutate engine state client-side.
**Mappings:** backlog []; requirements ['DESK-009'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "HEADLESS_ACCESS_URL_PARITY_TESTED_REAL_AUTHENTICATED_BROWSER_HOLE"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/editor-shell.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "sites/umbrella/src/app/editor"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-009", "outcome": "HEADLESS_ACCESS_URL_PARITY_TESTED_REAL_AUTHENTICATED_BROWSER_HOLE", "evidenceIds": ["umbrella-editor-tests"], "dependencies": ["sites-ui/identity actual editor front door"]}, "expectedEvidenceLayer": ["tests/e2e/umbrella-editor-viewport-golden.test.ts", "tests/sites/web-experience-editor.test.ts", "docs/web-editor-shell.md"]}]

#### REQ-PROOF-DESK-010 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: The desktop assistant supports deterministic Local and injected BYOK paths, while Hosted refuses because this tier owns no identity or credits.
**Mappings:** backlog []; requirements ['DESK-010'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "LOCAL_FIXTURE_LOOPS_PASS_HOSTED_KIDS_EXPECTED_DENY_BYOK_GUI_LIVE_PROOF_HOLE"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/provider-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/assistant-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-010", "outcome": "LOCAL_FIXTURE_LOOPS_PASS_HOSTED_KIDS_EXPECTED_DENY_BYOK_GUI_LIVE_PROOF_HOLE", "evidenceIds": ["desktop-tests"], "remainingFindingIds": ["DL-COV-03", "DL-BYOK-02"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-provider-authoring-engine-golden.test.ts", "tests/e2e/desktop-linux-bridge-golden.test.ts"]}]

#### REQ-PROOF-REL-001 — P2 / medium / desktop-release
**Root cause:** Bounded requirement declaration: The root quality gate fails when build, test, lint, sites, desktop, contracts, boundaries, or publish-readiness checks fail; passing while required stages are unwired is itself a regression.
**Mappings:** backlog []; requirements ['REL-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "bounded-tests-pass-with-coverage-defect"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/package.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-*.mjs", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "tests/syntax"}, {"reference": "tests/contracts"}, {"reference": "tests/boundary"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-001", "status": "bounded-tests-pass-with-coverage-defect", "evidence": ["baseline exact gate", "E08", "E09", "E12"], "remaining": "DR-001 and installed staging/native coverage"}, "expectedEvidenceLayer": ["tests/syntax/check-syntax.test.ts", "tests/contracts/injected-open-path-drift.test.ts", "tests/boundary/injected-violations.test.ts"]}]

#### REQ-PROOF-REL-002 — P2 / medium / desktop-release
**Root cause:** Bounded requirement declaration: Stage 1 proof remains separate from product presentation and requires both tier-3 captain decisions and explicit run authorization; no product implementation counts as proof evidence.
**Mappings:** backlog []; requirements ['REL-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "held-not-executed"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/program/spec-41.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "docs/proof/"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-002", "status": "held-not-executed", "evidence": "No proof stages run; release prep is not Stage1 evidence", "remaining": "separate program/held authority"}, "expectedEvidenceLayer": ["docs/proof/README.md", "docs/three-presentation-core.md"]}]

#### REQ-PROOF-REL-003 — P2 / medium / desktop-release
**Root cause:** Bounded requirement declaration: Review, apply, install, commit, push, merge, proof execution, spend/accounts, and publication are separate non-transitive authorities.
**Mappings:** backlog []; requirements ['REL-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "authority-preserved"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/bootstrap.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-003", "status": "authority-preserved", "evidence": "No commit/push/sign/upload/publish/spend; E05-E07 actual refusals", "remaining": "future action-specific operator authorization"}, "expectedEvidenceLayer": ["tests/", "docs/production-activation.md"]}]

#### REQ-PROOF-REL-004 — P2 / medium / desktop-release
**Root cause:** Bounded requirement declaration: Production activation is a runbook only; external changes require a current authorization naming the exact action, target, scope, inputs, and rollback, and unchecked actions remain held.
**Mappings:** backlog []; requirements ['REL-004'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "runbook-only"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/bootstrap.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-004", "status": "runbook-only", "evidence": "production-activation requires platform/source/candidate/window/operator/rollback; no action taken", "remaining": "real exact action authorization, credentials are not authority"}, "expectedEvidenceLayer": ["docs/production-activation.md"]}]

#### REQ-PROOF-REL-005 — P2 / medium / desktop-release
**Root cause:** Bounded requirement declaration: Runnable claims use R2 startable, R1 driveable, and R0 refuse-only levels, each backed by a real entrypoint or named refusal and its highest available proof.
**Mappings:** backlog []; requirements ['REL-005'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "truthful-IA-with-native-coverage-hole"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/runnable-surfaces.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "packages/*/bin"}, {"reference": "apps/*/bin"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-005", "status": "truthful-IA-with-native-coverage-hole", "evidence": "E08 download/offer assertions; Mac/Windows no R2; iaLinkable context is intentionally noncryptographic", "remaining": "actual clean-host/native acceptance"}, "expectedEvidenceLayer": ["packages/cli/test/bin-smoke.test.ts", "tests/e2e/", "tests/sites/"]}]

#### REQ-PROOF-REL-006 — P2 / medium / desktop-release
**Root cause:** Bounded requirement declaration: The CLI, catalog activation, Kids launch, package publication, license selection, Stripe LIVE, marketplace, and unsigned platform releases remain deferred or held until their separate authorities and evidence exist.
**Mappings:** backlog []; requirements ['REL-006'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "holds-preserved"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/program/SPEC.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/runnable-surfaces.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-006", "status": "holds-preserved", "evidence": "No Kids/LIVE/marketplace/legal/package-publication/held-key relaxation", "remaining": "separate full-production gates"}, "expectedEvidenceLayer": ["docs/audits/initiation/Initiation-Audit.md", "docs/runnable-surfaces.md"]}]

#### REQ-PROOF-REL-007 — P2 / medium / desktop-release
**Root cause:** Bounded requirement declaration: The current Electron GPU-process crash on the local host is recorded as a host limitation; CI Xvfb/SwiftShader evidence owns packaged-runtime claims.
**Mappings:** backlog []; requirements ['REL-007'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "dated-host-failure-claim-superseded-in-owner-doc"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/module-coverage.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/desktop-linux.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-release.json", "currentSemanticEntry": {"id": "REL-007", "status": "dated-host-failure-claim-superseded-in-owner-doc", "evidence": "docs/desktop-linux.md:435-440 records September26 successful Xvfb packaged pixels", "remaining": "desktop-linux/integration fresh independent native Linux evidence; cannot infer Mac/Windows"}, "expectedEvidenceLayer": ["docs/full-editor-v1-capability-matrix.md", "docs/desktop-linux.md"]}]

#### REQ-PROOF-BOUNDARY-001 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: @sceneaxi/auth may use only the internal dependencies declared for its identity-port package.
**Mappings:** backlog []; requirements ['BOUNDARY-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/auth"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-001", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/", "tests/docs/module-coverage.test.ts"]}]

#### REQ-PROOF-BOUNDARY-002 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: @sceneaxi/authoring-core may use only its declared downward schemas and engine dependencies and remains the single authoring core.
**Mappings:** backlog []; requirements ['BOUNDARY-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/authoring-core"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-002", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/", "tests/docs/module-coverage.test.ts"]}]

#### REQ-PROOF-BOUNDARY-003 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: @sceneaxi/billing may use only its declared internal dependencies and contains no provider client dependency.
**Mappings:** backlog []; requirements ['BOUNDARY-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/billing"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-003", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/", "tests/docs/module-coverage.test.ts"]}]

#### REQ-PROOF-BOUNDARY-004 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The dormant Game catalog app may depend only on schemas and its declared surface dependencies.
**Mappings:** backlog []; requirements ['BOUNDARY-004'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/catalog-game"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-004", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/", "tests/docs/module-coverage.test.ts"]}]

#### REQ-PROOF-BOUNDARY-005 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The dormant Web catalog app may depend only on schemas and its declared surface dependencies.
**Mappings:** backlog []; requirements ['BOUNDARY-005'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/catalog-web"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-005", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/", "tests/docs/module-coverage.test.ts"]}]

#### REQ-PROOF-BOUNDARY-006 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The CLI may depend on authoring-core, schemas, and the bounded importer seam, but not directly on engine packages.
**Mappings:** backlog []; requirements ['BOUNDARY-006'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/cli"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-006", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/", "tests/e2e/cli-golden-path.test.ts"]}]

#### REQ-PROOF-BOUNDARY-007 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Linux desktop install root owns privileged Electron and provider adapters while unprivileged modules cannot reach them.
**Mappings:** backlog []; requirements ['BOUNDARY-007'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/desktop-linux"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-desktop.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-007", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/injected-desktop-violations.test.ts", "tests/e2e/desktop-linux-bridge-golden.test.ts"]}]

#### REQ-PROOF-BOUNDARY-008 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The macOS packaging root stages the Linux runtime and cannot fork product behavior or publish without release prerequisites.
**Mappings:** backlog []; requirements ['BOUNDARY-008'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/desktop-macos"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-desktop.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-008", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["desktop/macos/test/seam.test.ts", "pnpm check:desktop"]}]

#### REQ-PROOF-BOUNDARY-009 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The desktop shell may use only schemas and authoring-core and must not import presentation, profile, site, or billing implementations.
**Mappings:** backlog []; requirements ['BOUNDARY-009'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/desktop-shell"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-009", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["apps/desktop-shell/test/seam.test.ts", "tests/boundary/injected-violations.test.ts"]}]

#### REQ-PROOF-BOUNDARY-010 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Windows packaging root stages the Linux runtime and requires explicit signing and draft-release authority before upload.
**Mappings:** backlog []; requirements ['BOUNDARY-010'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/desktop-windows"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-desktop.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-010", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/e2e/desktop-project-build-golden.test.ts", "pnpm check:desktop"]}]

#### REQ-PROOF-BOUNDARY-011 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The browser-runnable kernel may use only its declared downward dependencies and no Node-only runtime surface.
**Mappings:** backlog []; requirements ['BOUNDARY-011'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/engine-kernel"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-011", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["packages/engine-kernel/test/browser-open-play.test.ts", "tests/boundary/"]}]

#### REQ-PROOF-BOUNDARY-012 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The orchestrator may depend only on the kernel and schemas and owns no job queue or scheduler.
**Mappings:** backlog []; requirements ['BOUNDARY-012'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/engine-orchestrator"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-012", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["packages/engine-orchestrator/test/golden-path-orchestrated.test.ts", "tests/boundary/"]}]

#### REQ-PROOF-BOUNDARY-013 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The presentation package hides all Three types behind its public seam and may not name Node or DOM-only dependencies.
**Mappings:** backlog []; requirements ['BOUNDARY-013'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/engine-presentation"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-013", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["packages/engine-presentation/test/seam.test.ts", "tests/boundary/injected-violations.test.ts"]}]

#### REQ-PROOF-BOUNDARY-014 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: Importers may depend only on schemas and authoring-core and retain the bounded contained-content projection.
**Mappings:** backlog []; requirements ['BOUNDARY-014'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/importers"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-014", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/e2e/asset-ingestion-golden.test.ts", "tests/boundary/"]}]

#### REQ-PROOF-BOUNDARY-015 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The plugin host depends only on schemas and never reaches engine packages or a service locator.
**Mappings:** backlog []; requirements ['BOUNDARY-015'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/plugin-host"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-015", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/e2e/plugin-capability-golden.test.ts", "tests/boundary/"]}]

#### REQ-PROOF-BOUNDARY-016 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Game profile may use only its declared core/profile dependencies and pins its core range.
**Mappings:** backlog []; requirements ['BOUNDARY-016'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/profile-game"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-016", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["packages/profile-game/test/seam.test.ts", "tests/boundary/"]}]

#### REQ-PROOF-BOUNDARY-017 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Kids profile has no undeclared dependents and its safety boundary remains structurally closed.
**Mappings:** backlog []; requirements ['BOUNDARY-017'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/profile-kids"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-017", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/boundary/injected-site-violations.test.ts", "tests/sites/kids-surface.test.ts"]}]

#### REQ-PROOF-BOUNDARY-018 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Web Experience profile may use only its declared core/profile dependencies and pins its core range.
**Mappings:** backlog []; requirements ['BOUNDARY-018'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/profile-web"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-018", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["packages/profile-web/test/seam.test.ts", "tests/boundary/"]}]

#### REQ-PROOF-BOUNDARY-019 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The OpenRouter adapter stays fixture-tested with injected transport and does not own credentials or production readiness.
**Mappings:** backlog []; requirements ['BOUNDARY-019'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/provider-openrouter"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-019", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["packages/provider-openrouter/test/adapter.test.ts", "tests/e2e/desktop-provider-host-golden.test.ts"]}]

#### REQ-PROOF-BOUNDARY-020 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: Schemas has no internal dependency and is the only shared contract/seam vocabulary package.
**Mappings:** backlog []; requirements ['BOUNDARY-020'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/schemas"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-020", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["packages/schemas/test/seam.test.ts", "tests/boundary/"]}]

#### REQ-PROOF-BOUNDARY-021 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Game storefront install root may use site-kit and its own provider surface without importing identity/billing or engine packages.
**Mappings:** backlog []; requirements ['BOUNDARY-021'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/site-catalog-game"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-sites.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-021", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/sites/catalog-storefronts.test.ts", "tests/boundary/injected-site-violations.test.ts"]}]

#### REQ-PROOF-BOUNDARY-022 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Web storefront install root may use site-kit and its own provider surface without importing identity/billing or engine packages.
**Mappings:** backlog []; requirements ['BOUNDARY-022'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/site-catalog-web"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-sites.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-022", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/sites/catalog-storefronts.test.ts", "tests/boundary/injected-site-violations.test.ts"]}]

#### REQ-PROOF-BOUNDARY-023 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Kids site has an empty SceneAxi allow list and cannot import shared profiles, site-kit, identity, billing, or external data paths.
**Mappings:** backlog []; requirements ['BOUNDARY-023'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/site-kids"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-sites.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-023", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/sites/kids-surface.test.ts", "tests/boundary/injected-site-violations.test.ts"]}]

#### REQ-PROOF-BOUNDARY-024 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: Site-kit remains framework-free shared behavior and may not import React, Next, provider clients, or engine implementations.
**Mappings:** backlog []; requirements ['BOUNDARY-024'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/site-kit"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-024", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["packages/site-kit/test/seam.test.ts", "tests/boundary/injected-violations.test.ts"]}]

#### REQ-PROOF-BOUNDARY-025 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: Only the umbrella site may depend on auth, billing, and engine-presentation, and privileged provider access is limited to the identity-plane plug point and adapters.
**Mappings:** backlog []; requirements ['BOUNDARY-025'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/site-umbrella"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-sites.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-025", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/sites/identity-plane-wiring.test.ts", "tests/boundary/injected-site-violations.test.ts"]}]

#### REQ-PROOF-BOUNDARY-026 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The local web shell may use authoring-core and its explicitly declared auth/billing view-model edges but remains loopback-only and cannot reach engine sessions.
**Mappings:** backlog []; requirements ['BOUNDARY-026'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "@sceneaxi/web-shell"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/scripts/check-boundaries.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "BOUNDARY-026", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["apps/web-shell/test/assistant-panel.test.ts", "tests/boundary/"]}]

#### REQ-PROOF-SURFACE-001 — P2 / medium / cli
**Root cause:** Bounded requirement declaration: The CLI is R2 startable from its built binary and has a spawned smoke proof.
**Mappings:** backlog []; requirements ['SURFACE-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "startable-with-local-defects"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "currentSemanticEntry": {"id": "SURFACE-001", "result": "startable-with-local-defects", "evidence": "Actual built binary all21 help+negative probes, lifecycle, composition, import/reload and transport refusal exercised; CLI-001/002/004 break edge cases."}, "expectedEvidenceLayer": ["packages/cli/test/bin-smoke.test.ts"]}]

#### REQ-PROOF-SURFACE-002 — P2 / medium / shells
**Root cause:** Bounded requirement declaration: The desktop shell is R2 startable from its built binary and standalone chrome command.
**Mappings:** backlog []; requirements ['SURFACE-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "bounded-local-proof"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/bin/sceneaxi-desktop.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "currentSemanticEntry": {"id": "SURFACE-002", "symbols": ["DesktopSession", "createDesktopSession"], "source": "apps/desktop-shell/src/session.ts:91", "outcome": "bounded-local-proof", "evidence": ["E1", "E3", "E6"], "remaining": ["SHELL-001", "SHELL-002", "native packaged GUI coverage"]}, "expectedEvidenceLayer": ["apps/desktop-shell/test/bin-smoke.test.ts", "tests/e2e/desktop-product-loop-golden.test.ts"]}]

#### REQ-PROOF-SURFACE-003 — P2 / medium / shells
**Root cause:** Bounded requirement declaration: The web shell is R2 startable on loopback and exposes the existing inspector and assistant transport.
**Mappings:** backlog []; requirements ['SURFACE-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "bounded-local-proof-with-local-defects"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/bin/sceneaxi-web-shell.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "currentSemanticEntry": {"id": "SURFACE-003", "symbols": ["createInspectorApp", "createInspectorSession", "createAssistantPanel", "parseDevServerArgs", "LOOPBACK_HOSTS"], "source": "apps/web-shell/src/inspector-app.ts:398; inspector.ts:54; assistant-panel.ts:449; dev-server.ts:122,53", "outcome": "bounded-local-proof-with-local-defects", "evidence": ["E1", "E2", "E3", "E4"], "remaining": ["SHELL-003", "SHELL-004", "SHELL-005", "SHELL-006", "SHELL-007", "real provider use"]}, "expectedEvidenceLayer": ["apps/web-shell/test/bin-smoke.test.ts", "tests/parity/shell-cli-parity.test.ts"]}]

#### REQ-PROOF-SURFACE-004 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: The packaged Linux desktop is R2 startable with contained New/Open/Recent lifecycle and bounded editor paths.
**Mappings:** backlog []; requirements ['SURFACE-004'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "FRESH_LOCAL_R2_PACKAGE_LAUNCHES_DRAWS_FULL_LIFECYCLE_EDITOR_ACCEPTANCE_INCOMPLETE"]
**File/symbol targets and exact owner:** [{"reference": "desktop/linux"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "SURFACE-004", "outcome": "FRESH_LOCAL_R2_PACKAGE_LAUNCHES_DRAWS_FULL_LIFECYCLE_EDITOR_ACCEPTANCE_INCOMPLETE", "evidenceIds": ["packaged", "captureEvidence"], "remainingFindingIds": ["DL-COV-03"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-linux-bridge-golden.test.ts", "pnpm check:desktop"]}]

#### REQ-PROOF-SURFACE-005 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Game single-object profile open path is R1 driveable through the public seam.
**Mappings:** backlog []; requirements ['SURFACE-005'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "packages/profile-game"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "SURFACE-005", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/e2e/cli-golden-path.test.ts"]}]

#### REQ-PROOF-SURFACE-006 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Game multi-object scene profile open path is R1 driveable with checked-in replay evidence.
**Mappings:** backlog []; requirements ['SURFACE-006'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "packages/profile-game"}, {"reference": "packages/engine-kernel"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "SURFACE-006", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/e2e/profile-game-scene-golden.test.ts"]}]

#### REQ-PROOF-SURFACE-007 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The Web Experience profile open path is R1 driveable through the public seam.
**Mappings:** backlog []; requirements ['SURFACE-007'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "packages/profile-web"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "SURFACE-007", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/e2e/profile-web-golden-path.test.ts"]}]

#### REQ-PROOF-SURFACE-008 — P2 / medium / profiles-kids
**Root cause:** Bounded requirement declaration: The shared Kids profile open path is R0 refuse-only and exposes no kernel, commerce, identity, or provider session.
**Mappings:** backlog []; requirements ['SURFACE-008'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "INTENTIONAL_R0_REFUSAL_VERIFIED"]
**File/symbol targets and exact owner:** [{"reference": "packages/profile-kids"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "currentSemanticEntry": {"id": "SURFACE-008", "outcome": "INTENTIONAL_R0_REFUSAL_VERIFIED", "evidence": ["PK-E1", "PK-E5", "PK-E6"], "holes": []}, "expectedEvidenceLayer": ["tests/e2e/profile-kids-refuse-golden.test.ts"]}]

#### REQ-PROOF-SURFACE-009 — P2 / medium / profiles-kids
**Root cause:** Bounded requirement declaration: The isolated Kids activity is R1 driveable only from its own site and shipped policy.
**Mappings:** backlog []; requirements ['SURFACE-009'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "R1_REDUCER_VERIFIED_BROWSER_COVERAGE_PARTIAL"]
**File/symbol targets and exact owner:** [{"reference": "sites/kids"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "currentSemanticEntry": {"id": "SURFACE-009", "outcome": "R1_REDUCER_VERIFIED_BROWSER_COVERAGE_PARTIAL", "evidence": ["PK-E1", "PK-E4"], "holes": ["Real built route and button/browser proof missing"], "findingIds": ["PK-001", "PK-002"]}, "expectedEvidenceLayer": ["tests/sites/kids-surface.test.ts", "packages/profile-kids/test/activity.test.ts"]}]

#### REQ-PROOF-SURFACE-010 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: Bounded importers and the first-class plugin host are R1 driveable through their checked public paths.
**Mappings:** backlog []; requirements ['SURFACE-010'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "packages/importers"}, {"reference": "packages/plugin-host"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "SURFACE-010", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/e2e/asset-pipeline-golden.test.ts", "tests/e2e/importers-plugin-golden.test.ts", "tests/e2e/plugin-capability-golden.test.ts"]}]

#### REQ-PROOF-SURFACE-013 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The macOS packaging root is not yet an R2 surface because no signed artifact or packaged launch proof exists.
**Mappings:** backlog []; requirements ['SURFACE-013'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "desktop/macos"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "SURFACE-013", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["desktop/macos/test/seam.test.ts", "docs/desktop-macos.md"]}]

#### REQ-PROOF-SURFACE-014 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: The catalog applications remain dormant until the websites/deploy track and activation authorities open.
**Mappings:** backlog []; requirements ['SURFACE-014'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"reference": "apps/catalog-game"}, {"reference": "apps/catalog-web"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "SURFACE-014", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/docs/module-coverage.test.ts"]}]

### finding-mapped-to-root-tasks

#### PK-005 — P1 / high / profiles-kids
**Root cause:** No public Kids/profile launch authorization or production proof supplied
**Mappings:** backlog []; requirements ['PROF-004'].
**Chosen solution:** Keep shared R0, empty dependents, no LLM/identity/commerce/telemetry and shippingClaim false; record exact gate requests without secrets or fake proof
**Acceptance:** ["Genuine supplied structured authority and reviewed legal inputs", "Separately authorized actual production observation", "No R0 surface presented as launched"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/runnable-surfaces.md", "line": "46-47", "symbol": "shared R0 / isolated R1"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": "35-60", "symbol": "authorization gate"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-game/src/index.ts", "line": "53", "symbol": "evidenceHooks declaration"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/runnable-surfaces.md", "line": "46-47", "symbol": "shared R0 / isolated R1", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/production-activation.md", "line": "35-60", "symbol": "authorization gate", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/profile-game/src/index.ts", "line": "53", "symbol": "evidenceHooks declaration", "existsAtSynthesis": true, "writeOwner": "profiles-kids", "baselineSourceReadOnly": true}]
**Dependencies:** ["Structured Kids safety/product launch surface/origin decision", "Reviewed legal/privacy/jurisdiction/retention requirements", "Structured profile rollout/conformance disposition", "Separate action-specific named deployment/publication authority", "Actual production evidence after authorized action"]
**Exact missing input:** ['Structured Kids safety/product launch surface/origin decision', 'Reviewed legal/privacy/jurisdiction/retention requirements', 'Structured profile rollout/conformance disposition', 'Separate action-specific named deployment/publication authority', 'Actual production evidence after authorized action']; Keep shared R0, empty dependents, no LLM/identity/commerce/telemetry and shippingClaim false; record exact gate requests without secrets or fake proof
**Before/reproduction/impact/refutation:** {"reproduction": "Backlog8 Captain A8 and backlog76 remain parked; no fresh external launch observation or structured authorization was exercised", "refutation": "Local activity and green golden tests do not grant deployment, safety/legal or publication authority", "impact": "Full production PASS unavailable despite locally bounded functionality", "kind": "genuine-external-launch-gate", "status": "EXTERNAL_BLOCKED_NO_AUTHORITY_EXERCISED"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "evidenceIds": ["PK-E1", "PK-E6"]}]

#### CLI-EXT-01 — protected / medium / cli
**Root cause:** real epoch/snapshot activation
**Mappings:** backlog []; requirements [].
**Chosen solution:** Do not wire a fabricated sentinel or self-issue authority. Existing default refusal is correct and20 ungated verbs remain runnable.
**Acceptance:** ["Real authorized endpoint evidence plus matching refreshed map/snapshot; offline/stale/invalid/NvsN+1 refuse. Keep synthetic fixtures explicitly non-production."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/gate.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
**Exact missing input:** Do not wire a fabricated sentinel or self-issue authority. Existing default refusal is correct and20 ungated verbs remain runnable.
**Evidence:** []

#### SHELL-001 — P1 / high / shells
**Root cause:** Typed GUI controls for eight missing ids using existing host and review/Save rules.
**Mappings:** backlog []; requirements ['SURFACE-002'].
**Chosen solution:** Typed GUI controls for eight missing ids using existing host and review/Save rules.
**Acceptance:** ["Real GUI click reaches host; actual mutation or evidence change verified; invalid/Kids/stale hash refuse."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts", "line": 98, "symbol": "DESKTOP_INTERACTION_COMMANDS"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": 4316, "symbol": "commandHandlers"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts", "line": 98, "symbol": "DESKTOP_INTERACTION_COMMANDS", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": 4316, "symbol": "commandHandlers", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Dependencies:** ["desktop-linux host", "existing schemas registry"]
**Before/reproduction/impact/refutation:** {"reproduction": "Inventory66 accepted desktop-control registry commands; eight ids absent from all desktop-shell source and Linux renderer, no menu/palette/control dispatch path.", "refutationAttempt": "Examined computed dispatch, host bridge/local-tool surface and newer timeline/run/material controls. Existing backend/local-agent path does not create GUI reachability.", "impact": "Reusable-content, input inspection, viewport-source and physics-evaluation operations remain inaccessible in desktop GUI.", "status": "confirmed-open"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "evidenceIds": ["E1", "E5"]}]

#### SHELL-002 — P1 / high / shells
**Root cause:** Collect complete current-schema fields, inspected digests and explicit approvals; never weaken validation.
**Mappings:** backlog []; requirements ['SURFACE-002'].
**Chosen solution:** Collect complete current-schema fields, inspected digests and explicit approvals; never weaken validation.
**Acceptance:** ["Each real GUI valid-input case reaches host and changes fixture/effective binding; reject/stale/escape/unauthorized/Kids stay refused."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": 4219, "symbol": "runEditorCommand"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": 58, "symbol": "INPUT_REQUIRED_COMMANDS"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": 4219, "symbol": "runEditorCommand", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": 58, "symbol": "INPUT_REQUIRED_COMMANDS", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Dependencies:** ["assets-plugins", "authoring", "desktop-linux"]
**Before/reproduction/impact/refutation:** {"reproduction": "Click six listed input-required menu/palette rows: handler sends empty object and shared validator refuses before host.", "refutationAttempt": "Dispatch handlers do exist, disproving older no-handler statement. Tests intentionally pin validator refusal because no input is collected; exit0 is not feature success.", "impact": "Package changes, migration commit, approved extension launch and binding changes advertised by registry cannot be completed via these GUI rows.", "status": "confirmed-open"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "evidenceIds": ["E1"]}]

#### SHELL-003 — P2 / medium / shells
**Root cause:** Clear or explicitly mark history whenever snapshot has no current diff.
**Mappings:** backlog []; requirements ['SURFACE-003'].
**Chosen solution:** Clear or explicitly mark history whenever snapshot has no current diff.
**Acceptance:** ["Reject/idle/error/null snapshots never display old proposal as current; accepted historical view remains honestly labeled."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 780, "symbol": "inspectorPageHtml.render"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 780, "symbol": "inspectorPageHtml.render", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Before/reproduction/impact/refutation:** {"reproduction": "Chromium Propose then Reject; phase rejected/file unchanged but previous diff text remains.", "refutationAttempt": "Session really clears proposal/renderedDiff; renderer only replaces truthy diff, proving renderer defect not authoring mutation.", "impact": "Rejected/outdated change remains visually presented as current diff.", "status": "confirmed-open"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "evidenceIds": ["E3"]}]

#### SHELL-004 — P1 / medium / shells
**Root cause:** Catch fetch/parse exceptions, accessible failure/unknown state, reread authoritative state before further writes; no automatic accept retry.
**Mappings:** backlog []; requirements ['SURFACE-003'].
**Chosen solution:** Catch fetch/parse exceptions, accessible failure/unknown state, reread authoritative state before further writes; no automatic accept retry.
**Acceptance:** ["Abort/nonJSON/uncertain Accept: no pageerror, explicit feedback, disabled unsafe retry until reconciliation; no duplicate or blind write."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 787, "symbol": "inspectorPageHtml.call"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 787, "symbol": "inspectorPageHtml.call", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Before/reproduction/impact/refutation:** {"reproduction": "Chromium route.abort for actual /api/propose; Failed to fetch unhandled pageerror, note empty, phase remains old applied.", "refutationAttempt": "Backend remained healthy; transport failure simulation deliberately isolates browser recovery/error handling. JSON parse failure follows same uncaught path.", "impact": "User sees no failure/uncertain-outcome guidance and may retry acceptance after an ambiguous write result.", "status": "confirmed-open"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "evidenceIds": ["E3"]}]

#### SHELL-005 — P2 / low / shells
**Root cause:** Remove required only on pointer, retain other fields and server/core validation.
**Mappings:** backlog []; requirements ['SURFACE-003'].
**Chosen solution:** Remove required only on pointer, retain other fields and server/core validation.
**Acceptance:** ["Valid root replacement submits/reviews; invalid document still refuses and reject leaves bytes untouched."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 747, "symbol": "inspectorPageHtml"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 458, "symbol": "propose"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 747, "symbol": "inspectorPageHtml", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 458, "symbol": "propose", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Before/reproduction/impact/refutation:** {"reproduction": "Set #jsonPointer empty; native input.checkValidity returns false and form cannot submit.", "refutationAttempt": "Route explicitly allows empty/root pointer; canonical validation remains in core, so browser required mismatch is real.", "impact": "Valid public root replacement cannot be initiated with form.", "status": "confirmed-open"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "evidenceIds": ["E3"]}]

#### SHELL-006 — P1 / high / shells
**Root cause:** Generic handler-failed public response in both catches; preserve expected typed refusals, never log raw secret-bearing error.
**Mappings:** backlog []; requirements ['SURFACE-003'].
**Chosen solution:** Generic handler-failed public response in both catches; preserve expected typed refusals, never log raw secret-bearing error.
**Acceptance:** ["Sentinel absent in500 both sync/async public boundaries and real socket; reason/status unchanged; server survives; expected diagnostics retain contract."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 648, "symbol": "handleSync"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 680, "symbol": "handleAsync"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 648, "symbol": "handleSync", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 680, "symbol": "handleAsync", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Dependencies:** ["delivery-ops only if shared redacted diagnostic helper added"]
**Before/reproduction/impact/refutation:** {"reproduction": "Public injected AssistantPanel.ask throws safe AUDIT_REDACTION_SENTINEL; actual socket HTTP500 body echoes it; subsequent state200 succeeds.", "refutationAttempt": "Normal model/billing failures are sanitized/by-value; unexpected catch path still echoes arbitrary exception.message. No actual secret leak claimed.", "impact": "Configured embedders can expose provider/credential/internal error text in served response.", "status": "confirmed-open"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "evidenceIds": ["E2", "E4"]}]

#### SHELL-007 — P2 / medium / shells
**Root cause:** Count+UTF8 byte transcript bound and bounded admission; maintain mode capture/ledger ordering/idempotency and honest truncation.
**Mappings:** backlog []; requirements ['SURFACE-003'].
**Chosen solution:** Count+UTF8 byte transcript bound and bounded admission; maintain mode capture/ledger ordering/idempotency and honest truncation.
**Acceptance:** ["Boundary/UTF8/120-turn/concurrency probes remain bounded; existing credit/Kids/refusal tests unchanged; no race-and-forget provider timeout."]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": 555, "symbol": "turns"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": 784, "symbol": "ask"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/panel-support.ts", "line": 105, "symbol": "createOperationQueue"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": 555, "symbol": "turns", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": 784, "symbol": "ask", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/panel-support.ts", "line": 105, "symbol": "createOperationQueue", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
**Dependencies:** ["account-panel shares operation queue", "schemas/doc owner for added busy/truncation vocabulary"]
**Before/reproduction/impact/refutation:** {"reproduction": "120 sequential fixture asks with2048-byte prompts retain120 turns; complete snapshot response grows2883→315615 bytes.", "refutationAttempt": "Per-request64KiB limit does hold, but does not bound cumulative transcript/response. Full session history is intentional yet unbounded retention/serialization unnecessary.", "impact": "Long-lived local session accumulates memory and repeatedly serializes entire history; admission queue also source-confirmed unbounded, not measured outage.", "status": "confirmed-open"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "evidenceIds": ["E4"]}]

#### SH-T09 — P1 / medium / shells
**Root cause:** Actual packaged Linux controls/input and source ownership verified for new GUI actions; canonical persistence/replay and real viewport changes. Native environment failure must be recorded, not hidden.
**Mappings:** backlog [53, 61]; requirements [].
**Chosen solution:** Actual packaged Linux controls/input and source ownership verified for new GUI actions; canonical persistence/replay and real viewport changes. Native environment failure must be recorded, not hidden.
**Acceptance:** ["Actual packaged Linux controls/input and source ownership verified for new GUI actions; canonical persistence/replay and real viewport changes. Native environment failure must be recorded, not hidden."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/viewport.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/viewport-playback.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Commands:** ["pnpm gate"]
**Evidence:** []

#### IDENTITY-01 — P1 / high / identity
**Root cause:** Run stock sign-in, cookie/bearer lookup, hosted logout and failed replay through actual HTTP routes with redacted persistence evidence
**Mappings:** backlog [14]; requirements [].
**Chosen solution:** Run stock sign-in, cookie/bearer lookup, hosted logout and failed replay through actual HTTP routes with redacted persistence evidence
**Acceptance:** ["Both provider and SceneAxi credentials invalid after logout; unrelated session preserved; no forged session or secret logs"]
**Live-source anchors:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/better-auth-provider.test.ts", "line": "2", "symbol": "providerFixture"}]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/test/better-auth-provider.test.ts", "line": "2", "symbol": "providerFixture", "existsAtSynthesis": true, "writeOwner": "identity", "baselineSourceReadOnly": true}]
**Dependencies:** ["authorized non-production deployment and disposable test data", "securely provisioned provider/database credentials"]
**Exact missing input:** ['authorized non-production deployment and disposable test data', 'securely provisioned provider/database credentials']; Run stock sign-in, cookie/bearer lookup, hosted logout and failed replay through actual HTTP routes with redacted persistence evidence
**Before/reproduction/impact/refutation:** {"reproduction": "Run test:provider; runtime uses memoryAdapter and fixture records, not deployed database", "refutation": "Real Better Auth runtime is exercised locally; absence of production evidence is not a product failure", "impact": "No proof of live provider persistence, HTTPS deployment or actual Next front doors", "kind": "coverage-gap", "status": "OPEN_EXTERNAL_EVIDENCE"}
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "evidenceIds": []}]

#### REQ-PROOF-TOPO-007 — P2 / medium / delivery-ops
**Root cause:** Bounded requirement declaration: Delayed engine packages and additional provider slots remain pre-declared without being represented as shipped implementations.
**Mappings:** backlog []; requirements ['TOPO-007'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Bounded local declaration/checker proof; delayed/external declarations unchanged"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/docs/dependency-matrix.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/module-coverage.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-delivery-ops.json", "currentSemanticEntry": {"id": "TOPO-007", "currentOutcome": "Bounded local declaration/checker proof; delayed/external declarations unchanged", "auditCoverage": {"allAssignedIds": ["TOPO-001", "TOPO-002", "TOPO-003", "TOPO-004", "TOPO-005", "TOPO-006", "TOPO-007", "BOUNDARY-001", "BOUNDARY-002", "BOUNDARY-003", "BOUNDARY-004", "BOUNDARY-005", "BOUNDARY-006", "BOUNDARY-007", "BOUNDARY-008", "BOUNDARY-009", "BOUNDARY-010", "BOUNDARY-011", "BOUNDARY-012", "BOUNDARY-013", "BOUNDARY-014", "BOUNDARY-015", "BOUNDARY-016", "BOUNDARY-017", "BOUNDARY-018", "BOUNDARY-019", "BOUNDARY-020", "BOUNDARY-021", "BOUNDARY-022", "BOUNDARY-023", "BOUNDARY-024", "BOUNDARY-025", "BOUNDARY-026", "SURFACE-005", "SURFACE-006", "SURFACE-007", "SURFACE-010", "SURFACE-013", "SURFACE-014"], "boundedLocalValidated": "TOPO001-006,BOUNDARY001-026 and SURFACE005/006/007/010 exercised through E-REGRESSIONS/E-SURFACES/E-CHECKERS;partial/dormant declarations retain those classifications", "delayedOrExternal": "TOPO007 remains predeclared/delayed;SURFACE013/014 remain native release-unproven;BOUNDARY008/010 are staging/preflight only;BOUNDARY019 adapter is injected fixture plumbing with DOPS-003", "authoritySource": "Full39 statements/proof paths preserved in baseline.json.requirementsCoverage;not converted from mapped to shipping"}}, "expectedEvidenceLayer": ["tests/docs/module-coverage.test.ts"]}]

#### REQ-PROOF-AUTH-001 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: The CLI exposes deterministic exit codes, versioned machine-readable envelopes, strict JSON mode, and next-action hints at every command level.
**Mappings:** backlog []; requirements ['AUTH-001'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"reference": "packages/cli/src"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/cli-protocol-envelope.schema.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-001", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/cli/test/", "tests/e2e/cli-golden-path.test.ts"]}]

#### REQ-PROOF-AUTH-002 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: Authoring validation refuses schema major mismatches, unknown flags, ambiguous input, and partial-write risk, using atomic temporary-file replacement where mutation is allowed.
**Mappings:** backlog []; requirements ['AUTH-002'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"reference": "packages/authoring-core"}, {"reference": "packages/cli"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-002", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/authoring-core/test/project-model.test.ts", "packages/cli/test/project-lifecycle.test.ts", "tests/e2e/cli-golden-path.test.ts"]}]

#### REQ-PROOF-AUTH-003 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: The E1 project command group provides new, one-shot dev, test, capture, and report verbs over canonical text documents.
**Mappings:** backlog []; requirements ['AUTH-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"reference": "packages/cli"}, {"reference": "packages/authoring-core"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-003", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/cli/test/bin-smoke.test.ts", "tests/e2e/cli-golden-path.test.ts"]}]

#### REQ-PROOF-AUTH-004 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: Inspector edits use propose, review, and apply; no editor writes the canonical document directly.
**Mappings:** backlog []; requirements ['AUTH-004'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"reference": "packages/authoring-core"}, {"reference": "apps/web-shell"}, {"reference": "apps/desktop-shell"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-004", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/authoring-core/test/", "tests/parity/shell-cli-parity.test.ts", "tests/e2e/"]}]

#### REQ-PROOF-AUTH-005 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: Evidence-native test, capture, and report operations emit reproducible evidence packets with stable paths and model descriptors where applicable.
**Mappings:** backlog []; requirements ['AUTH-005'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"reference": "packages/cli"}, {"reference": "packages/authoring-core"}, {"reference": "packages/schemas/contracts"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-005", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/cli/test/", "tests/e2e/cli-golden-path.test.ts"]}]

#### REQ-PROOF-AUTH-006 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: Web and desktop shells render the same protocol operations and produce identical canonical documents and evidence for equivalent edits.
**Mappings:** backlog []; requirements ['AUTH-006'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"reference": "apps/web-shell"}, {"reference": "apps/desktop-shell"}, {"reference": "packages/authoring-core"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-006", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["tests/parity/shell-cli-parity.test.ts", "tests/e2e/"]}]

#### REQ-PROOF-AUTH-007 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: Project dev watch remains a named refusal because the normative E1 hot-reload loop is not implemented.
**Mappings:** backlog []; requirements ['AUTH-007'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"reference": "packages/cli"}, {"reference": "packages/authoring-core"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-007", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/cli/test/project-lifecycle.test.ts", "tests/e2e/cli-golden-path.test.ts"]}]

#### REQ-PROOF-CORE-004 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: Scene composition binds at least two placed instances to validated artifacts, preserves artifact bytes and evidence, and fails closed on its named refusal matrix.
**Mappings:** backlog []; requirements ['CORE-004'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"reference": "packages/authoring-core/src"}, {"reference": "packages/engine-kernel/src"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-004", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["tests/e2e/scene-composition-golden.test.ts", "tests/e2e/examples-golden.test.ts", "tests/e2e/profile-game-scene-golden.test.ts"]}]

#### REQ-PROOF-CORE-006 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: One Three presentation core serves a WebGL pixel surface and a deterministic headless surface, while no Three type crosses package exports.
**Mappings:** backlog []; requirements ['CORE-006'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"reference": "packages/engine-presentation/src"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/_components/sculpt-viewport.tsx", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-006", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/engine-presentation/test/", "tests/e2e/umbrella-live-open-golden.test.ts", "docs/three-presentation-core.md"]}]

#### REQ-PROOF-CORE-009 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: Native project creation writes the canonical document and v1 manifest atomically; legacy projects stay byte-identical until an approved migration commits.
**Mappings:** backlog []; requirements ['CORE-009'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/project-manifest.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-lifecycle.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-009", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/authoring-core/test/project-model.test.ts", "tests/desktop/desktop-project-lifecycle.test.ts", "tests/e2e/desktop-project-build-golden.test.ts"]}]

#### REQ-PROOF-CORE-010 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: Authoring transactions are base-versioned, atomic, recoverable, restart-durable, and support multi-level undo/redo with superseded redo invalidation.
**Mappings:** backlog []; requirements ['CORE-010'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"reference": "packages/authoring-core/src"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-010", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/authoring-core/test/transaction-history.test.ts", "tests/e2e/full-editor-transactions-golden.test.ts"]}]

#### REQ-PROOF-CORE-013 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: Prefab-like reusable content has versioned definitions, deterministic instances, explicit overrides, refresh behavior, and source-conflict refusals.
**Mappings:** backlog []; requirements ['CORE-013'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-prefab.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "packages/authoring-core/src"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-013", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/schemas/test/desktop-scene-prefab.test.ts", "tests/e2e/desktop-prefab-golden.test.ts"]}]

#### REQ-PROOF-CORE-016 — P2 / medium / authoring
**Root cause:** Bounded requirement declaration: Animation commands author bounded clips, tracks, and keyframes; scrub is non-mutating and deterministic replay uses the same catalog and hash.
**Mappings:** backlog []; requirements ['CORE-016'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-animation.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "packages/authoring-core/src"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-016", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["tests/e2e/desktop-animation-golden.test.ts", "packages/schemas/test/desktop-scene-animation.test.ts"]}]

#### REQ-PROOF-PROF-003 — P2 / medium / profiles-kids
**Root cause:** Bounded requirement declaration: Kids safety is compiled into an isolated profile and site: no dependent package, identity, telemetry, cookies, commerce, or third-party LLM route may be introduced by a runtime toggle.
**Mappings:** backlog []; requirements ['PROF-003'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "STRUCTURAL_FAIL_CLOSED_VERIFIED_BROWSER_PENDING"]
**File/symbol targets and exact owner:** [{"reference": "packages/profile-kids"}, {"reference": "sites/kids"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/docs/dependency-matrix.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-profiles-kids.json", "currentSemanticEntry": {"id": "PROF-003", "outcome": "STRUCTURAL_FAIL_CLOSED_VERIFIED_BROWSER_PENDING", "evidence": ["PK-E1", "PK-E2", "PK-E3"], "holes": ["Production-built browser traffic/cookie/storage observation"], "findingIds": ["PK-002"]}, "expectedEvidenceLayer": ["tests/sites/kids-surface.test.ts", "tests/boundary/injected-site-violations.test.ts", "packages/profile-kids/test/activity.test.ts"]}]

#### REQ-PROOF-IDENT-004 — P2 / medium / identity
**Root cause:** Bounded requirement declaration: Credit balance is derived from an append-only ledger; every store is created through the commit boundary and sale settlement commits both legs and the creator record atomically.
**Mappings:** backlog []; requirements ['IDENT-004'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CONFIRMED_PERSISTENCE_INVARIANT_DEFECT"]
**File/symbol targets and exact owner:** [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/billing/src/store.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "billing-data", "baselineSourceReadOnly": true}, {"reference": "db/migrations"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-identity.json", "currentSemanticEntry": {"id": "IDENT-004", "crossLaneSemanticRevalidation": true, "outcome": "CONFIRMED_PERSISTENCE_INVARIANT_DEFECT", "normativeSatisfied": false, "evidence": "audit-billing-data E5 real PostgreSQL poisoned first debit accepted; normal business paths remain bounded", "remaining": ["BD-001", "BD-008"]}, "expectedEvidenceLayer": ["packages/billing/test/store-boundary.test.ts", "packages/billing/test/metering.test.ts", "tests/db/schema-lockstep.test.ts"]}]

#### REQ-PROOF-DESK-008 — P2 / medium / desktop-linux
**Root cause:** Bounded requirement declaration: macOS and Windows wrappers stage the Linux runtime but do not claim a public signed artifact or enable updates without real release inputs.
**Mappings:** backlog []; requirements ['DESK-008'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CROSS_LANE_NATIVE_RELEASE_PROOF_MISSING"]
**File/symbol targets and exact owner:** [{"reference": "desktop/macos"}, {"reference": "desktop/windows"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-008", "outcome": "CROSS_LANE_NATIVE_RELEASE_PROOF_MISSING", "dependencies": ["desktop-release native macOS/Windows/signing"]}, "expectedEvidenceLayer": ["desktop/macos/test/seam.test.ts", "tests/e2e/desktop-project-build-golden.test.ts", "pnpm check:desktop"]}]

#### REQ-PROOF-SURFACE-011 — P2 / medium / sites-ui
**Root cause:** Bounded requirement declaration: The public umbrella /open path is R1 driveable and its headless proof does not claim pixels.
**Mappings:** backlog []; requirements ['SURFACE-011'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PENDING_BROWSER_BUILD"]
**File/symbol targets and exact owner:** [{"reference": "sites/umbrella/src/app/open"}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json", "currentSemanticEntry": {"id": "SURFACE-011", "outcome": "PENDING_BROWSER_BUILD"}, "expectedEvidenceLayer": ["tests/e2e/umbrella-live-open-golden.test.ts", "docs/three-presentation-core.md"]}]

#### REQ-PROOF-SURFACE-012 — P2 / medium / sites-ui
**Root cause:** Bounded requirement declaration: The umbrella /editor projections are R1 driveable only after their access decision succeeds.
**Mappings:** backlog []; requirements ['SURFACE-012'].
**Chosen solution:** Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
**Acceptance:** ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PENDING_BROWSER_BUILD"]
**File/symbol targets and exact owner:** [{"reference": "sites/umbrella/src/app/editor"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/editor-shell.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
**Evidence:** [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-sites-ui.json", "currentSemanticEntry": {"id": "SURFACE-012", "outcome": "PENDING_BROWSER_BUILD"}, "expectedEvidenceLayer": ["tests/e2e/umbrella-editor-viewport-golden.test.ts", "tests/sites/web-experience-editor.test.ts"]}]

## Every historical backlog ID → current roots

| ID | Historical status | Owner | Title | Canonical root IDs |
|---|---|---|---|---|
| 1 | parked | delivery-ops | Licence | GATE-LICENCE |
| 2 | parked | delivery-ops | Trademark clearance for "SceneAxi" | GATE-TRADEMARK |
| 3 | parked | identity | Open public sign-up | SCOPE-CLOSED-SIGNUP, IDENTITY-02, GATE-MAIL |
| 4 | parked | billing-data | Stripe LIVE go-live | GATE-LIVE |
| 5 | parked | delivery-ops | Execute `docs/production-activation.md` | GATE-ACTIVATION |
| 6 | parked | delivery-ops | Tier-6b marketplace activation | GATE-MARKETPLACE |
| 7 | parked | delivery-ops | npm publication | GATE-PUBLICATION, CLI-PACK-01 |
| 8 | parked | profiles-kids | Kids in or out of launch | PK-001, PK-002, SCOPE-KIDS-SHARED, GATE-CONFORMANCE |
| 9 | parked | delivery-ops | Proof stages | GATE-PROOF |
| 10 | parked | delivery-ops | Hosted AI in launch scope | SCOPE-HOSTED-OFF, GATE-AI-PROVIDER |
| 11 | parked | identity | No sign-up, email verification, forgot/reset or change password/email | IDENTITY-02, GATE-MAIL |
| 12 | parked | identity | No email transport configured anywhere. | GATE-MAIL, IDENTITY-02 |
| 13 | parked | identity | No account deletion / GDPR data export; ledger `ON DELETE RESTRICT` + append-only trigger | IDENTITY-02, IDENTITY-03, GATE-RETENTION |
| 14 | done | identity | Sign-out deletes only the SceneAxi `sessions` row; the Better Auth session/bearer stays valid until expiry | IDENTITY-04, IDENTITY-05, IDENTITY-01, LOCAL-PROOF-014 |
| 15 | parked | identity | Email verification enforced only for the admin | IDENTITY-02, GATE-MAIL, IDENTITY-03 |
| 16 | parked | identity | No OAuth/social login, no MFA. | IDENTITY-ADMIN-HARDENING, SCOPE-OAUTH, IDENTITY-02 |
| 17 | parked | sites-ui | Production `/editor` still renders "Preview | GATE-ACTIVATION |
| 18 | parked | billing-data | LIVE is blocked in code | GATE-LIVE |
| 19 | parked | billing-data | No tax/VAT, invoices, or receipts | GATE-COMMERCIAL |
| 20 | done | billing-data | Disputes/chargebacks unhandled | GATE-STRIPE-TEST, GATE-COMMERCIAL, LOCAL-PROOF-020 |
| 21 | done | billing-data | Refunds reconcile only when full and unspent; `STRIPE_REFUND_NOT_FULL` and spent-credit refunds are acknowledg | GATE-STRIPE-TEST, GATE-COMMERCIAL, LOCAL-PROOF-021 |
| 22 | parked | billing-data | Recorded Stripe endpoint subscribes only to `checkout.session.completed`; `charge.refunded` must be added | GATE-STRIPE-TEST |
| 23 | done | billing-data | No admin/support tooling | BD-008, GATE-STRIPE-TEST, LOCAL-PROOF-023 |
| 24 | done | billing-data | Checkout UX: refusal is raw JSON `402` to an HTML form; no success/pending/cancel pages; no purchase history o | BD-002, BD-003, BD-006, GATE-STRIPE-TEST, LOCAL-PROOF-024 |
| 25 | done | billing-data | `/api/checkout` falls back to a random attempt UUID → a new intent and Stripe session per POST; no rate limit | BD-004, BD-002, GATE-STRIPE-TEST, LOCAL-PROOF-025 |
| 26 | parked | billing-data | USD only. | SCOPE-MULTICURRENCY, GATE-COMMERCIAL |
| 27 | parked | billing-data | `stripe_customer_links` table is created but never used. | SCOPE-CUSTOMER-LINKING |
| 28 | parked | billing-data | Advertised on `/login`, `/account`, and marketing copy, but no site calls `runMeteredModelCall`; the editor as | BD-007, SCOPE-HOSTED-OFF, GATE-AI-PROVIDER |
| 29 | parked | billing-data | `@sceneaxi/provider-openrouter` ships only `createFixtureTransport`; there is no live hosted transport. | DOPS-003, GATE-AI-PROVIDER, AI-TRANSPORT-LOCAL, BD-007 |
| 30 | parked | billing-data | No credit price table; `creditAmount` is caller-supplied | BILLING-PRICE-POLICY, GATE-COMMERCIAL, GATE-AI-PROVIDER, BD-007 |
| 31 | done | billing-data | No migration runner and no applied-migrations tracking; `db/README.md` says to apply by hand. | BD-005, GATE-ACTIVATION, LOCAL-PROOF-031 |
| 32 | done | billing-data | No backup/PITR/restore policy or drill, while rollback is "forward-fix only" (`production-activation.md | BILLING-RESTORE-LOCAL, GATE-RESTORE, LOCAL-PROOF-032 |
| 33 | done | billing-data | Neon adapters have only been tested against a mock | BD-001, BILLING-REALPG-REGRESSION, GATE-RESTORE, GATE-STRIPE-TEST, BD-008, LOCAL-PROOF-033 |
| 34 | done | delivery-ops | No observability | GATE-OBSERVABILITY, LOCAL-PROOF-034 |
| 35 | done | billing-data | No startup env validation; misconfiguration silently becomes "not wired". | GATE-ACTIVATION, LOCAL-PROOF-035 |
| 36 | done | billing-data | `ConnectStore` is in-memory only | GATE-CONNECT, LOCAL-PROOF-036 |
| 37 | done | billing-data | No live-mode audit-sink implementation | GATE-LIVE, LOCAL-PROOF-037 |
| 38 | parked | sites-ui | No legal pages | GATE-LEGAL-PAGES, GATE-RETENTION |
| 39 | done | sites-ui | No security headers on the umbrella or catalogs | UI-002, LOCAL-PROOF-039 |
| 40 | parked | sites-ui | Cross-site identity can't work | SITE-CATALOG-IDENTITY, GATE-ACTIVATION |
| 41 | done | delivery-ops | No automated `next build` of any site | DOPS-004, DOPS-005, DOPS-001, GATE-ACTIVATION, LOCAL-PROOF-041 |
| 42 | done | sites-ui | `robots.txt` and `sitemap.xml` return `404` | UI-001, LOCAL-PROOF-042 |
| 43 | done | sites-ui | Umbrella has no `not-found.tsx`; no site has `error.tsx`, `global-error.tsx`, or `loading.tsx`. | LOCAL-043 |
| 44 | done | sites-ui | Operator internals shown to users | LOCAL-044 |
| 45 | done | sites-ui | `/api/checkout` has no origin check, unlike login, logout, and intake. | BD-002, LOCAL-PROOF-045 |
| 46 | parked | sites-ui | No editor project persistence; all state lives in the URL. | SITE-PERSISTENCE |
| 47 | done | sites-ui | `/docs` is a single page; no help, FAQ, or status page. | LOCAL-047 |
| 48 | parked | assets-plugins | Buy and publish are inert; no download or delivery path for any listing. | GATE-MARKETPLACE |
| 49 | parked | assets-plugins | `POST /api/editor/catalog-intake` always refuses `CATALOG_INTAKE_STORAGE_UNAVAILABLE` | CAT-DURABLE-INTAKE, GATE-MARKETPLACE |
| 50 | parked | assets-plugins | Four TEST fixture listings; no search, filter, or sort. | AP-06 |
| 51 | parked | billing-data | Connect payouts are TEST-only; LIVE is "not implemented" (`stripe-connect.ts | GATE-CONNECT |
| 52 | parked | desktop-release | The offered Linux build is stale and expiring | GATE-PUBLICATION |
| 53 | open | shells | Registered editor commands that declare the `desktop-control` client have no desktop GUI dispatch path | SH-T03, SH-T04, SH-T05, SH-T06, SH-T07, SH-T09, DL-COV-03 |
| 54 | done | desktop-linux | No crash reporting or telemetry; no `render-process-gone` / `child-process-gone` handling. | DL-PRIV-06, LOCAL-PROOF-054 |
| 55 | parked | desktop-release | macOS: no signed or notarized artifact | DR-001, DR-003, DR-007, GATE-MACOS, GATE-WINDOWS, DR-002, DR-005 |
| 56 | parked | desktop-release | No auto-update, no release/tag workflow, unsigned Linux packages. | DR-002, DR-003, DR-004, DR-005, GATE-PUBLICATION, DR-001, DR-007 |
| 57 | done | shells | Fake controls | SCOPE-COMPOSE-UI, SH-T06, SH-T07, SCOPE-HOSTED-OFF, LOCAL-PROOF-057 |
| 58 | parked | desktop-release | User project builds refuse on every OS (`PROJECT_BUILD_SIGNING_MISSING` on Linux; host/signing missing on macO | DR-006, GATE-MACOS, GATE-WINDOWS |
| 59 | parked | desktop-linux | BYOK is live only via OpenCode DeepSeek; OpenRouter is offered but fixture-only | DL-SEC-01, DL-BYOK-02, GATE-AI-PROVIDER |
| 60 | done | desktop-linux | Electron 43.2.0 GPU process SIGSEGV in the current-host smoke | DL-COV-04, GATE-DEVICES, LOCAL-PROOF-060 |
| 61 | open | desktop-linux | The packaged smoke does not exercise the #254–#270 features. | DL-COV-03, SH-T09, DL-COV-04 |
| 62 | parked | engine | No scripting or game logic | ENG-009 |
| 63 | done | engine | Physics is contract-only | ENG-010, LOCAL-PROOF-063 |
| 64 | open | engine | No audio playback; audio is metadata-only | ENG-011, GATE-DEVICES |
| 65 | parked | delivery-ops | Only export target is the desktop's static Web viewer; no native, mobile, or PWA target and no CLI export. | SCOPE-EXTRA-TARGETS, DR-006, CLI-CAP-01, DELIVERY-PWA-LOCAL |
| 66 | done | engine | Imported models are untextured | ENG-012, GATE-DEVICES, LOCAL-PROOF-066 |
| 67 | done | engine | No imported-animation playback or skeletal animation | ENG-013, GATE-DEVICES, LOCAL-PROOF-067 |
| 68 | done | engine | Post-processing, particles, and material overrides are in schemas only and never drawn | ENG-014, GATE-DEVICES, LOCAL-PROOF-068 |
| 69 | done | engine | No gamepad support; the kernel consumes no input. | ENG-015, GATE-DEVICES, LOCAL-PROOF-069 |
| 70 | parked | authoring | Axis-aligned placement only | LOCAL-070 |
| 71 | parked | delivery-ops | Spec'd packages `engine-asset-compiler`, `engine-platform-host`, and `engine-evidence` are absent, as are the  | SCOPE-DELAYED-MODULES, OPS-DELAYED-CONTRACTS |
| 72 | parked | engine | WebGL only; no networking. | ENG-016 |
| 73 | parked | authoring | General E2 is specified, not built | SCOPE-GENERAL-E2, GATE-PROOF |
| 74 | done | cli | `project dev --watch` refuses `NOT_IMPLEMENTED` | CLI-004, CLI-005, LOCAL-PROOF-074 |
| 75 | parked | assets-plugins | The plugin registry has one capability | AP-03, AP-07, SCOPE-UNTRUSTED-PLUGINS |
| 76 | parked | profiles-kids | Web profile not conformance-claimed; `shippingClaim` is `false` for every profile. | PK-003, PK-004, GATE-CONFORMANCE |
| 77 | parked | cli | Missing verbs | CLI-CAP-01, CLI-CAP-02, CLI-CAP-03, CLI-CAP-04, CLI-CAP-05, CLI-CAP-06, CLI-CAP-07 |
| 78 | parked | cli | The held-key runtime always refuses | CLI-003, GATE-EPOCH, CLI-005 |
| 79 | parked | cli | Exports point at `.ts` source; a published tarball would not run in Node without a build/export rework. | CLI-PACK-01, GATE-PUBLICATION |
| 80 | done | delivery-ops | No getting-started guide, tutorial, or `examples/`. | OPS-TUTORIAL-ORACLE, LOCAL-PROOF-080 |
| 81 | done | delivery-ops | No generated API reference. | DOPS-006, LOCAL-PROOF-081 |
| 82 | done | delivery-ops | No root `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, or `CODE_OF_CONDUCT`. | LOCAL-082 |
| 83 | done | delivery-ops | Docs are governance-heavy, not user guides; the canonical spec lives in issue #1 and cites an out-of-tree arch | OPS-TUTORIAL-ORACLE, GATE-CANONICAL-INPUT, LOCAL-PROOF-083 |
| 84 | done | delivery-ops | Stale docs | OPS-DOC-REVALIDATION, CLI-005, DL-DOC-07, IDENTITY-04, LOCAL-PROOF-084 |
| 85 | done | delivery-ops | Thin READMEs | OPS-TUTORIAL-ORACLE, LOCAL-PROOF-085 |
| 86 | done | delivery-ops | No alert or scheduled job before the 2026-11-10 artifact expiry. | GATE-OBSERVABILITY, GATE-PUBLICATION, LOCAL-PROOF-086 |
| 87 | parked | delivery-ops | The "Actions budget-blocked" operator note is outdated | GATE-OBSERVABILITY |
| 88 | parked | delivery-ops | Zero open GitHub issues, so none of the above is tracked. | LOCAL-088 |
| 89 | done | desktop-linux | `pnpm dist` builds the installers but exits with an electron-builder `channel` TypeError during cleanup | LOCAL-089 |
| 90 | done | engine | Product viewports do not forward authored environment/material/effect catalogs (effects payload lacks its seed; texture slots need an asset-to-texture binding contract) | ENG-017, LOCAL-PROOF-090 |

## Every authority requirement → bounded proof and residual roots

| Requirement | Owner | Statement | Root mapping |
|---|---|---|---|
| TOPO-001 | delivery-ops | SceneAxi is one interactive engine/library ecosystem with separately versioned Game, Web Experience, and Kids profiles over one runtime and authoring core. | REQ-PROOF-TOPO-001, DOPS-003, COVERAGE-DELIVERY-OPS |
| TOPO-002 | delivery-ops | The monorepo uses strict downward package and surface boundaries, with exhaustive allow and deny lists. | REQ-PROOF-TOPO-002, DOPS-003, COVERAGE-DELIVERY-OPS |
| TOPO-003 | delivery-ops | Individual games remain outside this monorepo and consume versioned SceneAxi releases from separate repositories. | REQ-PROOF-TOPO-003, DOPS-003, COVERAGE-DELIVERY-OPS |
| TOPO-004 | delivery-ops | All shared contracts live in schemas, which has zero internal dependencies. | REQ-PROOF-TOPO-004, DOPS-003, COVERAGE-DELIVERY-OPS |
| TOPO-005 | delivery-ops | Profiles are independently versioned and each profile manifest carries a supported core-version range. | REQ-PROOF-TOPO-005, DOPS-003, COVERAGE-DELIVERY-OPS |
| TOPO-006 | delivery-ops | The core train, contracts, profiles, CLI protocol, identity, billing, and site packages use their declared release-group rules without implicit migration. | REQ-PROOF-TOPO-006, DOPS-003, COVERAGE-DELIVERY-OPS |
| TOPO-007 | delivery-ops | Delayed engine packages and additional provider slots remain pre-declared without being represented as shipped implementations. | REQ-PROOF-TOPO-007, DOPS-003, COVERAGE-DELIVERY-OPS, SCOPE-DELAYED-MODULES, OPS-DELAYED-CONTRACTS |
| AUTH-001 | authoring | The CLI exposes deterministic exit codes, versioned machine-readable envelopes, strict JSON mode, and next-action hints at every command level. | REQ-PROOF-AUTH-001, COVERAGE-AUTHORING |
| AUTH-002 | authoring | Authoring validation refuses schema major mismatches, unknown flags, ambiguous input, and partial-write risk, using atomic temporary-file replacement where mutation is allowed. | REQ-PROOF-AUTH-002, COVERAGE-AUTHORING |
| AUTH-003 | authoring | The E1 project command group provides new, one-shot dev, test, capture, and report verbs over canonical text documents. | REQ-PROOF-AUTH-003, COVERAGE-AUTHORING |
| AUTH-004 | authoring | Inspector edits use propose, review, and apply; no editor writes the canonical document directly. | REQ-PROOF-AUTH-004, COVERAGE-AUTHORING |
| AUTH-005 | authoring | Evidence-native test, capture, and report operations emit reproducible evidence packets with stable paths and model descriptors where applicable. | REQ-PROOF-AUTH-005, COVERAGE-AUTHORING |
| AUTH-006 | authoring | Web and desktop shells render the same protocol operations and produce identical canonical documents and evidence for equivalent edits. | REQ-PROOF-AUTH-006, COVERAGE-AUTHORING |
| AUTH-007 | authoring | Project dev watch remains a named refusal because the normative E1 hot-reload loop is not implemented. | REQ-PROOF-AUTH-007, COVERAGE-AUTHORING |
| HOLD-001 | cli | Every held-key-gated CLI verb establishes the authoritative registry epoch before local checks and has no offline exception. | REQ-PROOF-HOLD-001, CLI-003, COVERAGE-CLI |
| HOLD-002 | cli | Held-key enforcement refuses unavailable currency, epoch drift, missing or stale snapshots, schema or map mismatch, undeclared verbs, open keys, and unknown keys. | REQ-PROOF-HOLD-002, COVERAGE-CLI |
| HOLD-003 | cli | Held-key acceptance includes both the fresh client epoch versus authoritative epoch bump regression and the unavailable-authority regression. | REQ-PROOF-HOLD-003, COVERAGE-CLI |
| CORE-001 | engine | The Game Kernel public seam is open, dispatch, advance, observe, save, and replay, with only advance allowed to mutate. | REQ-PROOF-CORE-001, ENG-002, ENG-001, ENG-008, ENG-009, COVERAGE-ENGINE |
| CORE-002 | engine | The open path above the kernel resolves one host, stamps a deterministic bootstrap record, turns kernel throws into named refusals, and closes each handle once without a job system. | REQ-PROOF-CORE-002, ENG-007, COVERAGE-ENGINE |
| CORE-003 | engine | Kernel digests remain portable and browser-safe, with no Node builtins or Node-only globals in the kernel source. | REQ-PROOF-CORE-003, COVERAGE-ENGINE |
| CORE-004 | authoring | Scene composition binds at least two placed instances to validated artifacts, preserves artifact bytes and evidence, and fails closed on its named refusal matrix. | REQ-PROOF-CORE-004, COVERAGE-AUTHORING |
| CORE-005 | engine | The shared open-path policy is one data identity across CLI, profiles, desktop shell, and web shell; Kids is refuse-only and shippingClaim is false. | REQ-PROOF-CORE-005, COVERAGE-ENGINE |
| CORE-006 | authoring | One Three presentation core serves a WebGL pixel surface and a deterministic headless surface, while no Three type crosses package exports. | REQ-PROOF-CORE-006, COVERAGE-AUTHORING |
| CORE-007 | engine | Headless frames identify that no pixels were drawn; frame counters, tests, and gate output never imply a pixel or GPU claim. | REQ-PROOF-CORE-007, ENG-006, COVERAGE-ENGINE |
| CORE-008 | assets-plugins | The contained asset manifest admits only declared bounded profiles, derives stable identity and preview metadata from bytes, and reloads through review without mutating accepted bytes. | REQ-PROOF-CORE-008, AP-01, AP-02, AP-04, AP-05, COVERAGE-ASSETS-PLUGINS |
| CORE-009 | authoring | Native project creation writes the canonical document and v1 manifest atomically; legacy projects stay byte-identical until an approved migration commits. | REQ-PROOF-CORE-009, COVERAGE-AUTHORING |
| CORE-010 | authoring | Authoring transactions are base-versioned, atomic, recoverable, restart-durable, and support multi-level undo/redo with superseded redo invalidation. | REQ-PROOF-CORE-010, COVERAGE-AUTHORING |
| CORE-011 | engine | Hierarchy, ordered multi-select, explicit-policy parenting, protected-root rules, and stable object identities project from the validated composed scene. | REQ-PROOF-CORE-011, COVERAGE-ENGINE |
| CORE-012 | engine | Transforms use one review command for numeric fields and gizmo nudges, with explicit local/world, pivot, axis, and snap inputs and no preview write before acceptance. | REQ-PROOF-CORE-012, COVERAGE-ENGINE |
| CORE-013 | authoring | Prefab-like reusable content has versioned definitions, deterministic instances, explicit overrides, refresh behavior, and source-conflict refusals. | REQ-PROOF-CORE-013, COVERAGE-AUTHORING |
| CORE-014 | engine | Unified input actions cover keyboard, pointer, wheel, legacy controller, and standard gamepad buttons/axes with deadzones across editor and play contexts, with defaults, conflict checks, rebind/reset review, and restart-durable settings outside document undo. | REQ-PROOF-CORE-014, ENG-015, COVERAGE-ENGINE |
| CORE-015 | engine | Play uses an isolated clone bound to an explicit source hash; viewport sources switch through one owner and stop/reset never write authoring bytes. | REQ-PROOF-CORE-015, COVERAGE-ENGINE |
| CORE-016 | authoring | Animation commands author bounded clips, tracks, and keyframes; scrub is non-mutating and deterministic replay uses the same catalog and hash. | REQ-PROOF-CORE-016, COVERAGE-AUTHORING |
| CORE-017 | engine | Physics commands author deterministic bodies, shapes, materials, constraints, gravity, and a fixed 1–32ms step; animation precedes physics when both affect an object. | REQ-PROOF-CORE-017, ENG-008, ENG-010, COVERAGE-ENGINE |
| CORE-018 | engine | Environment, material, and seeded decorative-effect authoring stays presentation-authored, bounded, digest-stamped, and independently Kids-refusable. | REQ-PROOF-CORE-018, ENG-003, ENG-014, ENG-017, COVERAGE-ENGINE |
| PROF-001 | profiles-kids | Game and Web Experience profiles expose their bounded R1 open paths through the shared core; the Kids shared engine path is R0 refuse-only. | REQ-PROOF-PROF-001, COVERAGE-PROFILES-KIDS |
| PROF-002 | profiles-kids | The Web Experience profile covers interactive site shells, hero scenes, configurators, storytelling, microsites, and data-driven real-time experiences, not CMS or SaaS behavior. | REQ-PROOF-PROF-002, PK-004, COVERAGE-PROFILES-KIDS |
| PROF-003 | profiles-kids | Kids safety is compiled into an isolated profile and site: no dependent package, identity, telemetry, cookies, commerce, or third-party LLM route may be introduced by a runtime toggle. | REQ-PROOF-PROF-003, PK-002, COVERAGE-PROFILES-KIDS |
| PROF-004 | profiles-kids | The Kids isolated activity is the only shipped Kids surface; it uses its own allowlist and in-memory activity and is not a consumer of shared profile or site packages. | REQ-PROOF-PROF-004, PK-001, PK-002, PK-005, COVERAGE-PROFILES-KIDS |
| PROF-005 | profiles-kids | The Model Provider Port is provider-neutral, capability-typed, per-profile filtered, and refuses absent policy, adapter, or capability before dispatch. | REQ-PROOF-PROF-005, COVERAGE-PROFILES-KIDS |
| PROF-006 | profiles-kids | OpenRouter-first is the locked default for eligible non-Kids lanes, while DeepSeek use remains conditional, pinned, residency-bound, no-fallback, and outside strict tool-calling lanes. | REQ-PROOF-PROF-006, COVERAGE-PROFILES-KIDS |
| CAT-001 | assets-plugins | The catalog is one modular platform under two independently branded Game and Web storefronts with separate taxonomy, curation, branding, origins, and product surfaces. | REQ-PROOF-CAT-001, COVERAGE-ASSETS-PLUGINS |
| CAT-002 | assets-plugins | Catalog intake proceeds quarantine to screening to human curation to listing and delisting/takedown, with every transition recorded and fail-closed. | REQ-PROOF-CAT-002, COVERAGE-ASSETS-PLUGINS |
| CAT-003 | assets-plugins | Catalog items carry rights, provenance, mandatory AI disclosure, compatibility metadata, format profiles, and recorded moderation evidence. | REQ-PROOF-CAT-003, COVERAGE-ASSETS-PLUGINS |
| CAT-004 | assets-plugins | Commerce fields remain inert until the existing per-storefront activation holds open; Kids consumption is an allowlist over already-curated items, never a pipeline fork. | REQ-PROOF-CAT-004, COVERAGE-ASSETS-PLUGINS |
| IDENT-001 | identity | Identity, credits, and billing use injected Better Auth, Neon, and Stripe adapters; provider clients stay out of hermetic core. | REQ-PROOF-IDENT-001, IDENTITY-05, GATE-ACTIVATION, COVERAGE-IDENTITY |
| IDENT-002 | identity | Admin identity is derived only from normalized SCENEAXI_ADMIN_EMAIL; User has no role field that can be claimed by input. | REQ-PROOF-IDENT-002, GATE-ACTIVATION, COVERAGE-IDENTITY |
| IDENT-003 | identity | Hosted login and logout require same-origin proof before fields or identity ports are reached, store the raw grant only in the HttpOnly session cookie, and keep redirects same-site. | REQ-PROOF-IDENT-003, IDENTITY-05, GATE-ACTIVATION, COVERAGE-IDENTITY |
| IDENT-004 | identity | Credit balance is derived from an append-only ledger; every store is created through the commit boundary and sale settlement commits both legs and the creator record atomically. | REQ-PROOF-IDENT-004, BD-001, BD-008, COVERAGE-IDENTITY |
| IDENT-005 | identity | Hosted AI is default-off, follows the documented Kids → route → opt-in → ledger → replay → entitlement → metering → provider → debit order, and BYO remains free. | REQ-PROOF-IDENT-005, BD-007, GATE-AI-PROVIDER, BILLING-PRICE-POLICY, COVERAGE-IDENTITY |
| IDENT-006 | identity | Checkout grant persistence acknowledges only after the ledger commit succeeds, and signed webhook evidence is bound to the exact Checkout Session and persisted intent. | REQ-PROOF-IDENT-006, GATE-STRIPE-TEST, COVERAGE-IDENTITY |
| IDENT-007 | identity | Live Stripe mode has one environment authorization source and remains unavailable without its explicit audited authority; mode, environment, and key prefixes cannot authorize it. | REQ-PROOF-IDENT-007, GATE-LIVE, COVERAGE-IDENTITY |
| DESK-001 | desktop-linux | The desktop shell derives modes, controls, tabs, refusals, assistant states, and tiers from the shared editor-shell vocabulary and counts every control exactly once. | REQ-PROOF-DESK-001, COVERAGE-DESKTOP-LINUX |
| DESK-002 | desktop-linux | Standalone desktop chrome opens no kernel or presentation runtime and refuses runtime-dependent Open, Save, and Play controls by name. | REQ-PROOF-DESK-002, COVERAGE-DESKTOP-LINUX |
| DESK-003 | desktop-linux | The packaged Linux desktop owns the application, bridge, renderer, project lifecycle, and local/BYOK assistant paths without adding a second product implementation. | REQ-PROOF-DESK-003, COVERAGE-DESKTOP-LINUX |
| DESK-004 | desktop-linux | First launch binds no project root and writes no project; roots enter only through a validated native dialog or recent registry. | REQ-PROOF-DESK-004, DL-COV-03, COVERAGE-DESKTOP-LINUX |
| DESK-005 | desktop-linux | The local agent bridge is a same-user Unix socket with a closed versioned tool and permission registry; every call validates capability, permission, and exact input before the desktop bridge. | REQ-PROOF-DESK-005, DL-COV-03, COVERAGE-DESKTOP-LINUX |
| DESK-006 | desktop-linux | Provider credentials never cross CLI arguments, tool input, RPC, discovery, logs, evidence, project documents, or the engine bridge; local and BYOK routes carry no credit route. | REQ-PROOF-DESK-006, DL-SEC-01, DL-BYOK-02, DL-PRIV-06, COVERAGE-DESKTOP-LINUX |
| DESK-007 | desktop-linux | Ship → Export Web writes a contained content-addressed static viewer and Delivery Handoff without deploying. | REQ-PROOF-DESK-007, COVERAGE-DESKTOP-LINUX |
| DESK-008 | desktop-linux | macOS and Windows wrappers stage the Linux runtime but do not claim a public signed artifact or enable updates without real release inputs. | REQ-PROOF-DESK-008, COVERAGE-DESKTOP-LINUX |
| DESK-009 | desktop-linux | The umbrella editor constructs no canvas before identity and entitlement access succeeds; browser controls change URL state and never mutate engine state client-side. | REQ-PROOF-DESK-009, COVERAGE-DESKTOP-LINUX |
| DESK-010 | desktop-linux | The desktop assistant supports deterministic Local and injected BYOK paths, while Hosted refuses because this tier owns no identity or credits. | REQ-PROOF-DESK-010, DL-BYOK-02, DL-COV-03, COVERAGE-DESKTOP-LINUX |
| REL-001 | desktop-release | The root quality gate fails when build, test, lint, sites, desktop, contracts, boundaries, or publish-readiness checks fail; passing while required stages are unwired is itself a regression. | REQ-PROOF-REL-001, DR-001, COVERAGE-DESKTOP-RELEASE |
| REL-002 | desktop-release | Stage 1 proof remains separate from product presentation and requires both tier-3 captain decisions and explicit run authorization; no product implementation counts as proof evidence. | REQ-PROOF-REL-002, COVERAGE-DESKTOP-RELEASE |
| REL-003 | desktop-release | Review, apply, install, commit, push, merge, proof execution, spend/accounts, and publication are separate non-transitive authorities. | REQ-PROOF-REL-003, COVERAGE-DESKTOP-RELEASE |
| REL-004 | desktop-release | Production activation is a runbook only; external changes require a current authorization naming the exact action, target, scope, inputs, and rollback, and unchecked actions remain held. | REQ-PROOF-REL-004, COVERAGE-DESKTOP-RELEASE |
| REL-005 | desktop-release | Runnable claims use R2 startable, R1 driveable, and R0 refuse-only levels, each backed by a real entrypoint or named refusal and its highest available proof. | REQ-PROOF-REL-005, COVERAGE-DESKTOP-RELEASE |
| REL-006 | desktop-release | The CLI, catalog activation, Kids launch, package publication, license selection, Stripe LIVE, marketplace, and unsigned platform releases remain deferred or held until their separate authorities and evidence exist. | REQ-PROOF-REL-006, COVERAGE-DESKTOP-RELEASE |
| REL-007 | desktop-release | The current Electron GPU-process crash on the local host is recorded as a host limitation; CI Xvfb/SwiftShader evidence owns packaged-runtime claims. | REQ-PROOF-REL-007, COVERAGE-DESKTOP-RELEASE |
| BOUNDARY-001 | delivery-ops | @sceneaxi/auth may use only the internal dependencies declared for its identity-port package. | REQ-PROOF-BOUNDARY-001, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-002 | delivery-ops | @sceneaxi/authoring-core may use only its declared downward schemas and engine dependencies and remains the single authoring core. | REQ-PROOF-BOUNDARY-002, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-003 | delivery-ops | @sceneaxi/billing may use only its declared internal dependencies and contains no provider client dependency. | REQ-PROOF-BOUNDARY-003, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-004 | delivery-ops | The dormant Game catalog app may depend only on schemas and its declared surface dependencies. | REQ-PROOF-BOUNDARY-004, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-005 | delivery-ops | The dormant Web catalog app may depend only on schemas and its declared surface dependencies. | REQ-PROOF-BOUNDARY-005, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-006 | delivery-ops | The CLI may depend on authoring-core, schemas, and the bounded importer seam, but not directly on engine packages. | REQ-PROOF-BOUNDARY-006, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-007 | delivery-ops | The Linux desktop install root owns privileged Electron and provider adapters while unprivileged modules cannot reach them. | REQ-PROOF-BOUNDARY-007, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-008 | delivery-ops | The macOS packaging root stages the Linux runtime and cannot fork product behavior or publish without release prerequisites. | REQ-PROOF-BOUNDARY-008, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-009 | delivery-ops | The desktop shell may use only schemas and authoring-core and must not import presentation, profile, site, or billing implementations. | REQ-PROOF-BOUNDARY-009, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-010 | delivery-ops | The Windows packaging root stages the Linux runtime and requires explicit signing and draft-release authority before upload. | REQ-PROOF-BOUNDARY-010, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-011 | delivery-ops | The browser-runnable kernel may use only its declared downward dependencies and no Node-only runtime surface. | REQ-PROOF-BOUNDARY-011, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-012 | delivery-ops | The orchestrator may depend only on the kernel and schemas and owns no job queue or scheduler. | REQ-PROOF-BOUNDARY-012, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-013 | delivery-ops | The presentation package hides all Three types behind its public seam and may not name Node or DOM-only dependencies. | REQ-PROOF-BOUNDARY-013, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-014 | delivery-ops | Importers may depend only on schemas and authoring-core and retain the bounded contained-content projection. | REQ-PROOF-BOUNDARY-014, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-015 | delivery-ops | The plugin host depends only on schemas and never reaches engine packages or a service locator. | REQ-PROOF-BOUNDARY-015, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-016 | delivery-ops | The Game profile may use only its declared core/profile dependencies and pins its core range. | REQ-PROOF-BOUNDARY-016, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-017 | delivery-ops | The Kids profile has no undeclared dependents and its safety boundary remains structurally closed. | REQ-PROOF-BOUNDARY-017, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-018 | delivery-ops | The Web Experience profile may use only its declared core/profile dependencies and pins its core range. | REQ-PROOF-BOUNDARY-018, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-019 | delivery-ops | The OpenRouter adapter stays fixture-tested with injected transport and does not own credentials or production readiness. | REQ-PROOF-BOUNDARY-019, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-020 | delivery-ops | Schemas has no internal dependency and is the only shared contract/seam vocabulary package. | REQ-PROOF-BOUNDARY-020, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-021 | delivery-ops | The Game storefront install root may use site-kit and its own provider surface without importing identity/billing or engine packages. | REQ-PROOF-BOUNDARY-021, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-022 | delivery-ops | The Web storefront install root may use site-kit and its own provider surface without importing identity/billing or engine packages. | REQ-PROOF-BOUNDARY-022, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-023 | delivery-ops | The Kids site has an empty SceneAxi allow list and cannot import shared profiles, site-kit, identity, billing, or external data paths. | REQ-PROOF-BOUNDARY-023, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-024 | delivery-ops | Site-kit remains framework-free shared behavior and may not import React, Next, provider clients, or engine implementations. | REQ-PROOF-BOUNDARY-024, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-025 | delivery-ops | Only the umbrella site may depend on auth, billing, and engine-presentation, and privileged provider access is limited to the identity-plane plug point and adapters. | REQ-PROOF-BOUNDARY-025, DOPS-003, COVERAGE-DELIVERY-OPS |
| BOUNDARY-026 | delivery-ops | The local web shell may use authoring-core and its explicitly declared auth/billing view-model edges but remains loopback-only and cannot reach engine sessions. | REQ-PROOF-BOUNDARY-026, DOPS-003, COVERAGE-DELIVERY-OPS |
| SURFACE-001 | cli | The CLI is R2 startable from its built binary and has a spawned smoke proof. | REQ-PROOF-SURFACE-001, CLI-001, COVERAGE-CLI |
| SURFACE-002 | shells | The desktop shell is R2 startable from its built binary and standalone chrome command. | REQ-PROOF-SURFACE-002, SHELL-001, SHELL-002, COVERAGE-SHELLS |
| SURFACE-003 | shells | The web shell is R2 startable on loopback and exposes the existing inspector and assistant transport. | REQ-PROOF-SURFACE-003, SHELL-003, SHELL-004, SHELL-005, SHELL-006, SHELL-007, COVERAGE-SHELLS |
| SURFACE-004 | desktop-linux | The packaged Linux desktop is R2 startable with contained New/Open/Recent lifecycle and bounded editor paths. | REQ-PROOF-SURFACE-004, DL-COV-03, COVERAGE-DESKTOP-LINUX |
| SURFACE-005 | delivery-ops | The Game single-object profile open path is R1 driveable through the public seam. | REQ-PROOF-SURFACE-005, DOPS-003, COVERAGE-DELIVERY-OPS |
| SURFACE-006 | delivery-ops | The Game multi-object scene profile open path is R1 driveable with checked-in replay evidence. | REQ-PROOF-SURFACE-006, DOPS-003, COVERAGE-DELIVERY-OPS |
| SURFACE-007 | delivery-ops | The Web Experience profile open path is R1 driveable through the public seam. | REQ-PROOF-SURFACE-007, DOPS-003, COVERAGE-DELIVERY-OPS |
| SURFACE-008 | profiles-kids | The shared Kids profile open path is R0 refuse-only and exposes no kernel, commerce, identity, or provider session. | REQ-PROOF-SURFACE-008, COVERAGE-PROFILES-KIDS |
| SURFACE-009 | profiles-kids | The isolated Kids activity is R1 driveable only from its own site and shipped policy. | REQ-PROOF-SURFACE-009, PK-001, PK-002, COVERAGE-PROFILES-KIDS |
| SURFACE-010 | delivery-ops | Bounded importers and the first-class plugin host are R1 driveable through their checked public paths. | REQ-PROOF-SURFACE-010, DOPS-003, COVERAGE-DELIVERY-OPS |
| SURFACE-011 | sites-ui | The public umbrella /open path is R1 driveable and its headless proof does not claim pixels. | REQ-PROOF-SURFACE-011, COVERAGE-SITES-UI |
| SURFACE-012 | sites-ui | The umbrella /editor projections are R1 driveable only after their access decision succeeds. | REQ-PROOF-SURFACE-012, COVERAGE-SITES-UI |
| SURFACE-013 | delivery-ops | The macOS packaging root is not yet an R2 surface because no signed artifact or packaged launch proof exists. | REQ-PROOF-SURFACE-013, DOPS-003, COVERAGE-DELIVERY-OPS |
| SURFACE-014 | delivery-ops | The catalog applications remain dormant until the websites/deploy track and activation authorities open. | REQ-PROOF-SURFACE-014, DOPS-003, COVERAGE-DELIVERY-OPS |

## Verification and limitations

Synthesis supplement: 49 actual files / 1293 tests passed, zero failed/pending; authoring/site source/helper assertions only. `pnpm check:traceability` exit0 with 109 mapped requirements. Lane audit JSONs carry the exact actual commands/outputs/public reproductions and corrected harness errors. Reports are before-builder evidence; no passing-after application repair asserted here. Generated-report invariants validate all IDs/owners/counts/paths, not production provider/legal/platform claims.
