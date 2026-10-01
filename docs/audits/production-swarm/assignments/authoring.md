# Builder assignment — authoring

Graph `sceneaxi-production-swarm`; role `code`; real root/cwd `/home/devuser/Documents/Projects/sceneaxi`. Read-only audit input `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json` and its MD; full source findings are preserved in MEGALIST.json.

## Exclusive exact source/test path ownership

Only the following existing/new exact paths are claimed by this lane. Existing owning docs/README, manifests/locks/config, schemas/site-kit, tests/*, scripts/*, workflows and SQL migrations are **RESERVED integration after all builders**. No adjacent-file ownership is implied; request any additional exact path before editing.
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/assistant-sculpt.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/atomic-write.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/content-hash.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/json-invariants.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/json-pointer.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/minimum-e2.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/model-provider-port.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-git.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/rarity-authoring.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/rarity-evidence.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/scene-composition.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/sculpt-procedural-emit.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/sculpt-reconstruction.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/unified-diff.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/test/assistant-sculpt.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/test/journal-recovery.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/test/model-provider-port.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/test/project-git.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/test/project-model.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/test/scene-composition.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/test/sculpt-reconstruction.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/test/seam.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/test/transaction-history.test.ts`

## Full assigned scope / measurable acceptance

Historical backlog IDs: [70, 73]. Authority requirement IDs: ['AUTH-001', 'AUTH-002', 'AUTH-003', 'AUTH-004', 'AUTH-005', 'AUTH-006', 'AUTH-007', 'CORE-004', 'CORE-006', 'CORE-009', 'CORE-010', 'CORE-013', 'CORE-016'].

### AUTHORING-001: implementation-needed / P1
Project propose/apply permits out-of-root document writes
- Chosen solution: Enforce canonical root containment before proposal and application, including symlink targets.
- Acceptance: ["Reject parent traversal and symlink escapes before mutation", "Outside victim bytes remain unchanged", "Valid in-root propose/apply succeeds"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 95, "symbol": "resolvePath"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 244, "symbol": "propose"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 563, "symbol": "apply"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 95, "symbol": "resolvePath", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 244, "symbol": "propose", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 563, "symbol": "apply", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
- Dependencies: ["CLI project document selection", "Authoring path resolution", "writeDocumentFile already enforces containment, unlike these paths"]
- Evidence/reproduction: {"reproduction": "In an isolated fixture, CLI project propose/apply with --cwd <root> and --document ../outside/victim.json returned proposed exit 0 then applied exit 0; the victim outside the root changed.", "impact": "Bypasses the project-root document write boundary.", "status": "reproduced"}

### AUTHORING-002: implementation-needed / P1
Recovery and journal storage escape the project root
- Chosen solution: Validate recovered document paths against the canonical project root and reject escaping journal-directory symlinks before writing any journal artifact.
- Acceptance: ["Crafted active records fail without outside mutation", "Journal symlink tests leave the outside sink free of artifacts", "Normal recovery remains functional"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 674, "symbol": "recoverIncompleteApplies"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 711, "symbol": "recoverIncompleteApplies"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 674, "symbol": "recoverIncompleteApplies", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 711, "symbol": "recoverIncompleteApplies", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
- Dependencies: ["Recovery record validation", "Journal-directory confinement"]
- Evidence/reproduction: {"reproduction": "Recovery consumed a valid schemaVersion 4 .active record with documentPath ../outside/victim.json and wrote outside the root. Separately, a .sceneaxi/journal symlink to an outside sink redirected .active, .completion-sequence, and archive writes outside the root.", "impact": "Persisted recovery metadata and journal-directory redirection bypass filesystem write boundaries.", "status": "reproduced"}

### COVERAGE-AUTHORING: implementation-needed / P1
Remaining current-source/front-door coverage: authoring
- Chosen solution: Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
- Acceptance: ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json"]

### GATE-PROOF: genuine-external-blocker / P1
Stage/general-E2 proof authority absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Genuine structured held-key/program decision and action-specific Stage1/6 double-gated authorization. Local bounded E2 fixtures cannot be labelled executed program proof.

### AUTHORING-003: implementation-needed / P2
Native seed accepts invalid document bytes
- Chosen solution: Validate document bytes with the applicable parser/schema before writing seed files or reporting success.
- Acceptance: ["Invalid JSON and invalid document shapes fail before writes", "Valid seeds reopen successfully", "Failed initialization leaves no partial seed artifacts"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 627, "symbol": "writeNativeProjectSeed"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 627, "symbol": "writeNativeProjectSeed", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
- Dependencies: ["Native seed writer", "Reopen document validation"]
- Evidence/reproduction: {"reproduction": "documentBytes equal to not-json returned ok; reopening failed with PROJECT_MANIFEST_MALFORMED.", "impact": "Successful initialization can persist a project that cannot reopen.", "status": "reproduced"}

### AUTHORING-004: implementation-needed / P2
Targeted tests lack negative containment and validity oracles
- Chosen solution: Add negative tests for parent traversal, symlink redirection, hostile recovery records, and malformed seed bytes, with no-mutation assertions.
- Acceptance: ["New tests fail on vulnerable behavior and pass after fixes", "Preserve the existing 159-test baseline", "Use isolated temporary fixture roots, never real repository projects"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 95, "symbol": "resolvePath"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 674, "symbol": "recoverIncompleteApplies"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 627, "symbol": "writeNativeProjectSeed"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/propose-apply.ts", "line": 95, "symbol": "resolvePath", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/apply-journal.ts", "line": 674, "symbol": "recoverIncompleteApplies", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 627, "symbol": "writeNativeProjectSeed", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
- Dependencies: ["AUTHORING-001", "AUTHORING-002", "AUTHORING-003"]
- Evidence/reproduction: {"reproduction": "Existing 159 targeted tests passed despite the reproduced failures. Repro artifacts were inherited at /tmp/sceneaxi-authoring-audit-jYPXkY and /tmp/sceneaxi-authoring-refute-ywAwly; availability was not rechecked.", "impact": "A green targeted suite does not establish containment or seed validity.", "status": "coverage-hole"}

### LOCAL-070: implementation-needed / P2
Axis-aligned placement only
- Chosen solution: Implement bounded deterministic rotated/scaled placement projection through current composition authority; retain source artifact bytes and replay/evidence digests; new pose contracts are integration requests.
- Acceptance: ["Public compose with nonzero supported placement rotates/scales correctly, save/replay projection equal, malformed/unsupported transforms refuse with no artifact rewrite."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/scene-composition.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/scene-composition.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/scene-composition-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "backlogDisposition": {"id": 70, "currentOutcome": "Recovered/current evidence discussed in audit MD; do not infer missing JSON closure."}}]

### REQ-PROOF-AUTH-001: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: The CLI exposes deterministic exit codes, versioned machine-readable envelopes, strict JSON mode, and next-action hints at every command level.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"reference": "packages/cli/src"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/cli-protocol-envelope.schema.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-001", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/cli/test/", "tests/e2e/cli-golden-path.test.ts"]}]

### REQ-PROOF-AUTH-002: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Authoring validation refuses schema major mismatches, unknown flags, ambiguous input, and partial-write risk, using atomic temporary-file replacement where mutation is allowed.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"reference": "packages/authoring-core"}, {"reference": "packages/cli"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-002", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/authoring-core/test/project-model.test.ts", "packages/cli/test/project-lifecycle.test.ts", "tests/e2e/cli-golden-path.test.ts"]}]

### REQ-PROOF-AUTH-003: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: The E1 project command group provides new, one-shot dev, test, capture, and report verbs over canonical text documents.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"reference": "packages/cli"}, {"reference": "packages/authoring-core"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-003", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/cli/test/bin-smoke.test.ts", "tests/e2e/cli-golden-path.test.ts"]}]

### REQ-PROOF-AUTH-004: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Inspector edits use propose, review, and apply; no editor writes the canonical document directly.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"reference": "packages/authoring-core"}, {"reference": "apps/web-shell"}, {"reference": "apps/desktop-shell"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-004", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/authoring-core/test/", "tests/parity/shell-cli-parity.test.ts", "tests/e2e/"]}]

### REQ-PROOF-AUTH-005: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Evidence-native test, capture, and report operations emit reproducible evidence packets with stable paths and model descriptors where applicable.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"reference": "packages/cli"}, {"reference": "packages/authoring-core"}, {"reference": "packages/schemas/contracts"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-005", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/cli/test/", "tests/e2e/cli-golden-path.test.ts"]}]

### REQ-PROOF-AUTH-006: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Web and desktop shells render the same protocol operations and produce identical canonical documents and evidence for equivalent edits.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"reference": "apps/web-shell"}, {"reference": "apps/desktop-shell"}, {"reference": "packages/authoring-core"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-006", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["tests/parity/shell-cli-parity.test.ts", "tests/e2e/"]}]

### REQ-PROOF-AUTH-007: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Project dev watch remains a named refusal because the normative E1 hot-reload loop is not implemented.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"reference": "packages/cli"}, {"reference": "packages/authoring-core"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "AUTH-007", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/cli/test/project-lifecycle.test.ts", "tests/e2e/cli-golden-path.test.ts"]}]

### REQ-PROOF-CORE-004: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Scene composition binds at least two placed instances to validated artifacts, preserves artifact bytes and evidence, and fails closed on its named refusal matrix.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"reference": "packages/authoring-core/src"}, {"reference": "packages/engine-kernel/src"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-004", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["tests/e2e/scene-composition-golden.test.ts", "tests/e2e/examples-golden.test.ts", "tests/e2e/profile-game-scene-golden.test.ts"]}]

### REQ-PROOF-CORE-006: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: One Three presentation core serves a WebGL pixel surface and a deterministic headless surface, while no Three type crosses package exports.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"reference": "packages/engine-presentation/src"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/sites/umbrella/src/app/_components/sculpt-viewport.tsx", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "sites-ui", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-006", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/engine-presentation/test/", "tests/e2e/umbrella-live-open-golden.test.ts", "docs/three-presentation-core.md"]}]

### REQ-PROOF-CORE-009: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Native project creation writes the canonical document and v1 manifest atomically; legacy projects stay byte-identical until an approved migration commits.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/project-manifest.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-lifecycle.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-009", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/authoring-core/test/project-model.test.ts", "tests/desktop/desktop-project-lifecycle.test.ts", "tests/e2e/desktop-project-build-golden.test.ts"]}]

### REQ-PROOF-CORE-010: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Authoring transactions are base-versioned, atomic, recoverable, restart-durable, and support multi-level undo/redo with superseded redo invalidation.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"reference": "packages/authoring-core/src"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-010", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/authoring-core/test/transaction-history.test.ts", "tests/e2e/full-editor-transactions-golden.test.ts"]}]

### REQ-PROOF-CORE-013: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Prefab-like reusable content has versioned definitions, deterministic instances, explicit overrides, refresh behavior, and source-conflict refusals.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-prefab.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "packages/authoring-core/src"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-013", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["packages/schemas/test/desktop-scene-prefab.test.ts", "tests/e2e/desktop-prefab-golden.test.ts"]}]

### REQ-PROOF-CORE-016: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: Animation commands author bounded clips, tracks, and keyframes; scrub is non-mutating and deterministic replay uses the same catalog and hash.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-animation.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "packages/authoring-core/src"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-authoring.json", "currentSemanticEntry": {"id": "CORE-016", "currentOutcome": "Semantic coverage must be independently closed; lane JSON does not contain a matching structured requirement row.", "artifactCoverageHole": true}, "expectedEvidenceLayer": ["tests/e2e/desktop-animation-golden.test.ts", "packages/schemas/test/desktop-scene-animation.test.ts"]}]

### SCOPE-GENERAL-E2: intentional-nonlaunch-capability / P2
General E2 remains specified-not-built
- Chosen solution: Extend admissible bounded Minimum E2 and truthful guidance; broader E2 remains distinct missing capability plus held proof authority, not manufactured planner proof.
- Acceptance: ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []

### AUTHORING-005: implementation-needed / P3
Migration journal reader assumes Linux procfs
- Chosen solution: Remove the unconditional procfs dependency or use a platform-aware safe descriptor-reading strategy.
- Acceptance: ["Native Linux, macOS, and Windows tests read valid migration journals without requiring procfs", "Preserve descriptor/path safety"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 377, "symbol": "readMigrationJournal"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 380, "symbol": "readMigrationJournal"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 377, "symbol": "readMigrationJournal", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/project-model.ts", "line": 380, "symbol": "readMigrationJournal", "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
- Dependencies: ["OS descriptor-path support", "Migration journal reading"]
- Evidence/reproduction: {"reproduction": "Inherited source observation: readMigrationJournal unconditionally uses /proc/self/fd. Native macOS/Windows failure was not demonstrated.", "impact": "Potential portability failure where Linux procfs is unavailable; not a native-platform-proven defect.", "status": "observed"}

## Shared requests and acceptance obligations

[]

Submit requested shared changes as exact path/symbol/current→recommended text/API/test deltas to integration; never concurrently edit reserved surfaces. Existing current helpers/public seams and boundary matrix dominate; no second authoring core/no direct CLI-engine imports/no invented provider/legal proof. Verify upstream external documentation before new stack/API or security-version use.

Reproduce confirmed defects through actual public front doors before patch; keep failing-before/passing-after oracles, rebuild dist before running Node binaries. Execute focused existing tests then report real exit/result/assertions/platform/coverage holes. Missing installations are local work, not external blockers. New verbs require ROOT_COMMANDS + SHIPPED_COMMAND_MAP + takesArgs + bin/golden/unknown-flag parity together. Kids shared path/empty dependents, only-advance, held currency-first and LIVE default-off stay intact.

Persist per-task outcome and node commands/evidence under this lane build report; do not claim production PASS. Integration owns FINAL.md/JSON, unchanged full gate, independent actual front doors and serial repair routing capped at three passes. Every remaining intentional capability and external request remains visible in full-production counts.
