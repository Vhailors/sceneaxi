# Builder assignment — cli

Graph `sceneaxi-production-swarm`; role `code`; real root/cwd `/home/devuser/Documents/Projects/sceneaxi`. Read-only audit input `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json` and its MD; full source findings are preserved in MEGALIST.json.

## Exclusive exact source/test path ownership

Only the following existing/new exact paths are claimed by this lane. Existing owning docs/README, manifests/locks/config, schemas/site-kit, tests/*, scripts/*, workflows and SQL migrations are **RESERVED integration after all builders**. No adjacent-file ownership is implied; request any additional exact path before editing.
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/asset-verbs.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/desktop-client.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/desktop-socket-worker.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/desktop-verbs.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/envelope.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/exit-codes.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/format.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/gate.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/generate.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/registry.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/project-lifecycle.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/project-verbs.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/registry-verbs.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/run.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/scene-verbs.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/verb-args.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/verb-support.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/version.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/__snapshots__/envelope.snapshot.test.ts.snap`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/bin-smoke.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/desktop-bridge.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/desktop-socket-worker-lockstep.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/envelope.snapshot.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/exit-codes.golden.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/fixtures/held-keys/firstmate-export.epoch2.json`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/fixtures/held-keys/firstmate-export.epoch3.all-resolved.json`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/fixtures/held-keys/firstmate-export.markdown-source.json`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/fixtures/held-keys/snapshot.schema-invalid.json`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/held-keys.command-map.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/held-keys.generator.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/held-keys.refusal-table.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/held-keys.regressions.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/json-equivalence.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/profile-open-path.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/project-lifecycle.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/project-propose-apply.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/refusal.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/registry-verbs.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/scene-compose.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/seam.test.ts`

## Full assigned scope / measurable acceptance

Historical backlog IDs: [74, 77, 78, 79]. Authority requirement IDs: ['HOLD-001', 'HOLD-002', 'HOLD-003', 'SURFACE-001'].

### CLI-001: implementation-needed / P1
Use Object.hasOwn for command child lookup at every depth; never traverse inherited properties.
- Chosen solution: Use Object.hasOwn for command child lookup at every depth; never traverse inherited properties.
- Acceptance: ["pnpm build && pnpm exec vitest run packages/cli/test/refusal.test.ts packages/cli/test/bin-smoke.test.ts; both reproductions plus constructor/__proto__/toString at all group depths produce exit2 UNKNOWN_COMMAND schema1 JSON, empty stderr, no throw."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts", "line": "273", "symbol": "walk"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/refusal.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/bin-smoke.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": ["node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs constructor x --json", "node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs project __proto__ x --json"], "observed": "exit1, empty stdout, raw stderr TypeError: Cannot read properties of undefined (reading 'x')", "refutationAttempt": "Ordinary unknown commands correctly refuse; reproduced at root and nested group using actual built binary, not a mocked dispatcher.", "impact": "Unknown inherited object names escape the versioned protocol, expose stack paths and defeat deterministic UNKNOWN_COMMAND exit2 behavior; no mutation or held-key bypass observed.", "kind": "defect"}

### CLI-003: implementation-needed / P1
Validate finite nonnegative clock/budget and finite parsed timestamp; refuse negative age and invalid freshness configuration before any allow. Preserve currency-before-snapshot ordering and the default24h budget.
- Chosen solution: Validate finite nonnegative clock/budget and finite parsed timestamp; refuse negative age and invalid freshness configuration before any allow. Preserve currency-before-snapshot ordering and the default24h budget.
- Acceptance: ["pnpm build && pnpm exec vitest run packages/cli/test/held-keys.refusal-table.test.ts packages/cli/test/held-keys.regressions.test.ts packages/cli/test/held-keys.command-map.test.ts; future/NaN/Infinity/negative runtime tests refuse with HELD_KEY, fresh exact budget remains documented, NvsN+1 and offline/env regressions unchanged."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/gate.ts", "line": "177", "symbol": "evaluateHeldKeyGate"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/gate.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/held-keys.refusal-table.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/held-keys.regressions.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: ["Shared schema/doc owner only if adding new refusal names; reuse existing named refusals where semantically accurate."]
- Evidence/reproduction: {"reproduction": "Register existing workspace-dist-resolver.mjs and import public @sceneaxi/cli. Generate synthetic epoch3 all-resolved fixture snapshot; use map epoch3, static fixture authority3 and clock2026-07-20T13:00:00Z. Evaluate demo gated with generatedAt2099, now()=>NaN, freshnessBudgetMsNaN, or freshnessBudgetMsInfinity plus clock2099.", "observed": "All four malformed freshness cases allow=true; ordinary stale snapshot refuses, unavailable authority refuses, authoritative4 refuses.", "refutationAttempt": "Used only existing synthetic fixture authority/keys; confirmed fresh sanity, normal stale and both mandatory currency refusals alongside each bad input. No real snapshot or authority issued.", "impact": "Exported injectable gate reports established freshness for future or nonfinite runtime values; currently no reachable shipped-binary bypass because default sentinel remains unavailable. Any future trusted adapter inherits this weakness.", "kind": "defect"}

### CLI-PACK-01: implementation-needed / P1
outsider-runnable distributable CLI
- Chosen solution: Prepare local self-contained compiled archive/consumer fixture without publishing or changing established source-backed workspace exports. Do not pretend existing manifest tarball is runnable.
- Acceptance: ["An owned temporary extracted artifact outside repository with no root scripts or workspace node_modules must run real binary help/version/lifecycle via stock supported Node. pnpm check:publish-ready, pnpm check:boundaries and unchanged pnpm gate remain green. No publish/private/version/license flip."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/package.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### COVERAGE-CLI: implementation-needed / P1
Remaining current-source/front-door coverage: cli
- Chosen solution: Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
- Acceptance: ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "No production sentinel/export trust or authorization exists; default gated refusal expected.", "No genuine running packaged desktop host connection asserted by this lane; real CLI missing/insecure transport refusal tested, existing local-bridge golden passes.", "Only Linux Node24 exercised; macOS/Windows transport/signing/distribution proof belongs native lanes.", "Workspace binary tested against existing baseline build; builders must rebuild before after-fix oracle. No new stack/API introduced, so no new external API documentation requirement invoked.", "Startup sampled; no large-directory/large-document sustained-memory/load benchmark or product performance SLO claimed.", "No extracted outsider tarball runtime proof; manifest limitations explicitly retained under backlog79.", "No passing-after evidence for new defects because this auditor may not edit source; builder/integration owns regression closure."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json"]

### GATE-EPOCH: genuine-external-blocker / P1
Real held-key epoch/trust activation absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Genuine FirstMate structured export, trusted authenticated current epoch endpoint/trust/timeout policy and separately authorized actual held operation. staticEpochAuthority is a fixture, never production currency.

### CLI-002: implementation-needed / P2
Allow bare version success only after rejecting remaining non-global tokens; preserve legal aliases and JSON/text parity.
- Chosen solution: Allow bare version success only after rejecting remaining non-global tokens; preserve legal aliases and JSON/text parity.
- Acceptance: ["pnpm build && pnpm exec vitest run packages/cli/test/refusal.test.ts packages/cli/test/bin-smoke.test.ts packages/cli/test/json-equivalence.test.ts; reproductions exit2 UNKNOWN_FLAG or AMBIGUOUS_INPUT; bare -v/-V/--version stays exit0."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts", "line": "138", "symbol": "dispatch"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/refusal.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/bin-smoke.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": ["node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs --version --nonsense --json", "node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs --version --document x --json"], "observed": "exit0 schema1 ok=true cliVersion0.0.0 despite leftover unknown flags/tokens", "refutationAttempt": "Valued global switches correctly refuse AMBIGUOUS_INPUT and ordinary unknown flags exit2; defect isolated to early bare-version branch.", "impact": "Version shortcut silently accepts invalid invocations, contrary to fail-closed argument contract; no operation executed.", "kind": "defect"}

### CLI-004: implementation-needed / P2
Do not enter process watch mode for help/version or malformed global switches; route introspection through normal dispatch without registering watchers.
- Chosen solution: Do not enter process watch mode for help/version or malformed global switches; route introspection through normal dispatch without registering watchers.
- Acceptance: ["pnpm build && pnpm exec vitest run packages/cli/test/bin-smoke.test.ts; reproduction naturally exits0 once with ordinary help JSON and no mode/cycle/watch, while actual edit+SIGINT watch regressions continue passing."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/run.ts", "line": "40", "symbol": "watchArguments; :85 main"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/run.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/bin-smoke.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": "In owned temporary project, create scene.json with real project new; spawn node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs project dev --document scene.json --watch --help --json.", "observed": "Process still running600ms after printing help decorated with mode=watch cycle1; SIGINT required and emits stopped cycle1.", "refutationAttempt": "Real spawned binary and valid project; explicit SIGINT proves it is watch ownership rather than ordinary startup slowness. Existing ordinary watch-edit-stop tests pass.", "impact": "Help invocation allocates persistent watchers and hangs automation. Help without document returns immediately, so normal help probes miss this defect.", "kind": "defect"}

### CLI-CAP-01: implementation-needed / P2
play/run and build/export discoverability
- Chosen solution: Use existing permission-bound desktop bridge tools, not engine imports or matrix widening. Optional thin aliases must share bridge validation and refusal.
- Acceptance: ["pnpm build && pnpm exec vitest run packages/cli/test/desktop-bridge.test.ts packages/cli/test/bin-smoke.test.ts tests/e2e/desktop-cli-local-bridge-golden.test.ts; document exact existing tool names/permissions, no-host refusal and Web/local build versus native signing boundaries."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/README.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/desktop-verbs.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### CLI-CAP-02: implementation-needed / P2
asset remove
- Chosen solution: Implement only by existing E1/permission-bound desktop remove tool where currently admitted; never delete source files silently or create a second importer authority.
- Acceptance: ["pnpm build && pnpm exec vitest run packages/cli/test tests/e2e/asset-pipeline-golden.test.ts; absent/unknown stable id refuses; no mutation before review/apply; imports/reload parity and containment retained."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/asset-verbs.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### CLI-CAP-03: implementation-needed / P2
plugin list/load/validate
- Chosen solution: Expose read-only registry/capability validation where allowed via schemas or desktop tool; executable load remains bounded trusted-plugin authority, never a claimed sandbox or direct plugin-host import.
- Acceptance: ["pnpm check:boundaries && pnpm build && pnpm exec vitest run packages/cli/test tests/e2e/importers-plugin-golden.test.ts tests/e2e/plugin-capability-golden.test.ts; list/validate no provider or code execution, unsupported capability/load refusal truthful."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/registry-verbs.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### CLI-CAP-04: implementation-needed / P2
evidence show/verify
- Chosen solution: Reuse existing project report/readEvidencePacket and project test/contentHash; compare claimed document hash against contained current document, not merely packet-internal pass labels.
- Acceptance: ["pnpm build && pnpm exec vitest run packages/cli/test; capture/show/verify succeeds for unchanged bytes; edited document, forged digest, malformed packet and escaping path refuse nonzero. Never attest browser/native/provider/legal evidence from a packet."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/project-lifecycle.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/registry-verbs.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### CLI-CAP-05: implementation-needed / P2
catalog submit
- Chosen solution: Offer offline validation/proposal or existing bounded intake tool only; maintain commerce/curation/provenance/storage activation refusals.
- Acceptance: ["pnpm build && pnpm exec vitest run packages/cli/test; validate locally without publication/network/spend; missing storage or activation refuses, metadataComplete never becomes approval."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/registry-verbs.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### CLI-CAP-06: implementation-needed / P2
project migrate
- Chosen solution: Version1 already-current validation can be exposed locally; no invented conversion rules or destructive migration. Unknown versions refuse until schema-owned reversible conversion exists.
- Acceptance: ["pnpm build && pnpm exec vitest run packages/cli/test; already-current document byte-identical, unsupported version named refusal, no overwrite/partial migration."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/project-lifecycle.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### CLI-CAP-07: implementation-needed / P2
template init
- Chosen solution: Use contained checked-in admitted local template through existing document/proposal helpers, retaining no-overwrite and review behavior. Document plain project new --data versus openable composed-scene initialization.
- Acceptance: ["pnpm build && pnpm exec vitest run packages/cli/test/bin-smoke.test.ts; init in fresh contained temp root, test/openable-scene import succeeds, repeat init refuses overwrite, unknown/escaping template refuses."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/project-lifecycle.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/README.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []

### LOCAL-PROOF-074: done-with-evidence / P2
Bounded implemented portion: `project dev --watch` refuses `NOT_IMPLEMENTED`
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "backlogDisposition": {"id": 74, "historicalStatus": "done", "currentDisposition": "implemented", "evidence": "run.ts main/runWatch and spawned bin-smoke tests stream edits and stop on SIGINT, including nonzero termination on refused cycle. README refusal sentence is stale; CLI-004 help/watch lifecycle bug remains."}}]

### REQ-PROOF-HOLD-001: done-with-evidence / P2
Bounded requirement declaration: Every held-key-gated CLI verb establishes the authoritative registry epoch before local checks and has no offline exception.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "enforced-with-local-hardening-gap"]
- Source: []
- Targets/owners: [{"reference": "packages/cli/src/held-keys"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "currentSemanticEntry": {"id": "HOLD-001", "result": "enforced-with-local-hardening-gap", "evidence": "Shipped demo exit3 currency-unavailable; CLI-003 invalid freshness inputs allow at exported gate."}, "expectedEvidenceLayer": ["packages/cli/test/held-keys.*.test.ts", "packages/cli/test/held-keys.regressions.test.ts"]}]

### REQ-PROOF-HOLD-002: done-with-evidence / P2
Bounded requirement declaration: Held-key enforcement refuses unavailable currency, epoch drift, missing or stale snapshots, schema or map mismatch, undeclared verbs, open keys, and unknown keys.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "mandatory-regressions-pass"]
- Source: []
- Targets/owners: [{"reference": "packages/cli/src/held-keys"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/held-key-registry.schema.json", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "currentSemanticEntry": {"id": "HOLD-002", "result": "mandatory-regressions-pass", "evidence": "Fresh N/N versus N+1 refuses authoritative-epoch-mismatch; unavailable authority refuses currency-unavailable; bypass env regressions pass."}, "expectedEvidenceLayer": ["packages/cli/test/held-keys.refusal-table.test.ts"]}]

### REQ-PROOF-HOLD-003: done-with-evidence / P2
Bounded requirement declaration: Held-key acceptance includes both the fresh client epoch versus authoritative epoch bump regression and the unavailable-authority regression.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "map-coverage-pass"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/test/held-keys.*.test.ts", "line": null, "symbol": null, "existsAtSynthesis": false, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "currentSemanticEntry": {"id": "HOLD-003", "result": "map-coverage-pass", "evidence": "All 21 ROOT_COMMANDS verb leaves declared in shipped map; undeclared/map/snapshot refusal tests pass; no real holds issued."}, "expectedEvidenceLayer": ["packages/cli/test/held-keys.regressions.test.ts"]}]

### REQ-PROOF-SURFACE-001: done-with-evidence / P2
Bounded requirement declaration: The CLI is R2 startable from its built binary and has a spawned smoke proof.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "startable-with-local-defects"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json", "currentSemanticEntry": {"id": "SURFACE-001", "result": "startable-with-local-defects", "evidence": "Actual built binary all21 help+negative probes, lifecycle, composition, import/reload and transport refusal exercised; CLI-001/002/004 break edge cases."}, "expectedEvidenceLayer": ["packages/cli/test/bin-smoke.test.ts"]}]

### CLI-005: implementation-needed / P3
Document watch streaming, SIGINT lifecycle and limitation of synchronous runCli; replace reserved/skeleton wording with implemented refusal semantics.
- Chosen solution: Document watch streaming, SIGINT lifecycle and limitation of synchronous runCli; replace reserved/skeleton wording with implemented refusal semantics.
- Acceptance: ["pnpm exec vitest run packages/cli/test/bin-smoke.test.ts packages/cli/test/exit-codes.golden.test.ts; docs match emitted streaming behavior without implying shipping or sentinel readiness."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/README.md", "line": "148", "symbol": "Current refusals; /home/devuser/Documents/Projects/sceneaxi/packages/cli/src/exit-codes.ts:24 ExitCode"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/README.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/exit-codes.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: ["docs owner for dated gap list/current runnable map"]
- Evidence/reproduction: {"reproduction": "Compare README NOT_IMPLEMENTED watch refusal and reserved/skeleton exit3 comment against spawned watch tests and actual demo gated exit3.", "observed": "Both categorical statements are stale; watch works and exit3 is active.", "refutationAttempt": "Re-executed21 files233 tests, including live watch and required currency regressions; actual demo gated refuses currency-unavailable, not NOT_IMPLEMENTED.", "impact": "Users avoid implemented watch feature or misunderstand held-key refusal as missing enforcement.", "kind": "documentation-drift"}

### CLI-EXT-01: finding-mapped-to-root-tasks / protected
real epoch/snapshot activation
- Chosen solution: Do not wire a fabricated sentinel or self-issue authority. Existing default refusal is correct and20 ungated verbs remain runnable.
- Acceptance: ["Real authorized endpoint evidence plus matching refreshed map/snapshot; offline/stale/invalid/NvsN+1 refuse. Keep synthetic fixtures explicitly non-production."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/gate.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/shipped.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "cli", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Do not wire a fabricated sentinel or self-issue authority. Existing default refusal is correct and20 ungated verbs remain runnable.

## Shared requests and acceptance obligations

[{"lane": "cli", "sourceKey": "sharedOwnershipRequests", "requests": [{"owner": "integration/shared-schema", "paths": ["/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/held-key-registry.schema.json", "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/cli-command-map.schema.json", "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/cli-protocol-envelope.schema.json"], "change": "Only if CLI-003 introduces vocabulary/schema changes; coordinate existing enum/refusal fixtures rather than edit schemas from CLI lane."}, {"owner": "integration/docs", "paths": ["/home/devuser/Documents/Projects/sceneaxi/docs/held-key-enforcement.md", "/home/devuser/Documents/Projects/sceneaxi/docs/runnable-surfaces.md", "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-gaps-2026-09-26.md", "/home/devuser/Documents/Projects/sceneaxi/docs/audits/go-live-backlog.json"], "change": "Document future/invalid freshness refusals and current watch/capability evidence; preserve historical backlog facts while adding current disposition."}, {"owner": "integration/shared-root", "paths": ["/home/devuser/Documents/Projects/sceneaxi/package.json", "/home/devuser/Documents/Projects/sceneaxi/scripts/workspace-dist-resolver.mjs", "/home/devuser/Documents/Projects/sceneaxi/docs/publish-readiness.md", "/home/devuser/Documents/Projects/sceneaxi/docs/web-consumer.md"], "change": "Coordinate local consumer artifact validation; never weaken boundaries, public source-backed-export policy or publish authorization."}]}]

Submit requested shared changes as exact path/symbol/current→recommended text/API/test deltas to integration; never concurrently edit reserved surfaces. Existing current helpers/public seams and boundary matrix dominate; no second authoring core/no direct CLI-engine imports/no invented provider/legal proof. Verify upstream external documentation before new stack/API or security-version use.

Reproduce confirmed defects through actual public front doors before patch; keep failing-before/passing-after oracles, rebuild dist before running Node binaries. Execute focused existing tests then report real exit/result/assertions/platform/coverage holes. Missing installations are local work, not external blockers. New verbs require ROOT_COMMANDS + SHIPPED_COMMAND_MAP + takesArgs + bin/golden/unknown-flag parity together. Kids shared path/empty dependents, only-advance, held currency-first and LIVE default-off stay intact.

Persist per-task outcome and node commands/evidence under this lane build report; do not claim production PASS. Integration owns FINAL.md/JSON, unchanged full gate, independent actual front doors and serial repair routing capped at three passes. Every remaining intentional capability and external request remains visible in full-production counts.
