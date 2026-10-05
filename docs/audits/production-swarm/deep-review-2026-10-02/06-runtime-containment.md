# 06 Runtime containment — FAIL

PR head `346933c105305224d575bf9319256301c1eeabfa`; base `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`. Current dirty worktree HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. Greens stay artifact-specific.

Selective deep review of named runtime files, selected tests, git baseline/PR/staged/worktree, adjacent physics compatibility contract. Not exhaustive file review. EMPRYO.md absent. AGENTS/layout/FINAL/PR-EVIDENCE read. No product/config/source/git edits, install, commit,push,deploy,accounts or spend. Only these numbered report files written.

## Top findings

### 06-01 P0 FAIL — 346933c105305224d575bf9319256301c1eeabfa:packages/{authoring-core,importers,engine-kernel,engine-presentation}/{package.json,tsconfig.json}
Expectation: Mergeable complete package graph and all existing negative oracles retained.
Observed: Exact base..head diff removes all four manifests/tsconfigs, authoring-core src/index.ts, kernel portable-digest/errors, presentation orbit-camera and owning seam/recovery tests. Scoped diff94 files,+5282/-18424. Current worktree still contains these; local test greens cannot certify PR.
Reproduction: REPRODUCED by git diff/tree, no PR execution
Fix/acceptance: Rebuild complete PR tree preserving untouched files/modes; verify fresh exact-head checkout gate and restored seam/recovery/portable negative suites.

### 06-02 P1 FAIL — packages/schemas/src/desktop-scene-physics.ts:10,42-47,72-80,114-134; packages/physics-rapier/src/world.ts:67-70
Expectation: Existing v1 physics saved JSON and public shape APIs stay compatible or explicitly migrate/version.
Observed: Same schemaVersion1 replaces shapes/shapeId/ScenePhysicsShape with colliders/colliderId/ScenePhysicsCollider. Current and PR parser accepts old shapes object unchanged, missing colliders; new Rapier requires colliders. Old public exports removed without alias.
Reproduction: REPRODUCED parser from independently transpiled current,PR,base source. Both current/PR source SHA256 ae53c3500cb3ed6166ef64415ed4038de949eda65da0c5d7a9335a0b450669a0. Source-backed downstream rejection, not executed Rapier.
Fix/acceptance: Keep old symbols and normalize v1 shapes to colliders with stable IDs or introduce schema2 plus v1 migration; public legacy fixture must evaluate/save/reload on toy and Rapier.

### 06-03 P1 FAIL — packages/schemas/src/desktop-scene-physics.ts:121,126-127
Expectation: Hostile physics input returns named invalid/null rather than property-access exception.
Observed: world:null passes typeof object and throws TypeError reading engine. This defect also exists at PR base; unresolved retained defect, not newly introduced regression.
Reproduction: REPRODUCED current,exactPR,base using source parser in-memory transpile, not package build
Fix/acceptance: Validate non-null plain world/all catalog arrays and fields before cast; preserve rejection without mutation; add null/proxy/accessor/legacy fixture public-boundary negatives.

### 06-04 P1 FAIL — packages/importers/src/contained-gltf.ts:489-511,2084,2098; packages/importers/test/contained-gltf.test.ts:926-946,949-974; packages/importers/README.md:17
Expectation: Production admitted padded8MiB import AND reload have measured bounded responsiveness; no closure by different binary oracle.
Observed: Fresh padded admission passed135ms; direct current-source initial staging121ms/reload200ms, RSS351→387MiB. The reported multi-second padded reload stall is REFUTED for this one-asset staging probe, not certified absent across production file/apply/browser paths. AP08 uses16×8MiB WOFF2, not JSON reload. README expressly disclaims a responsiveness SLA; production latency/event-loop/soak acceptance remains uncovered.
Reproduction: Admission and one-asset hot reload REPRODUCED successfully; no current stall reproduced. This P1 FAIL is a full-production coverage criterion, not a confirmed latency defect. Two prior loader setup failures are retained below.
Fix/acceptance: Profile actual current production import/reload/front door, set explicit time/RSS/event-loop budget, bound/stream/cancel canonical parsing and replay; preserve16x8MiB,count17,next-byte,alias/rollback oracles.

### 06-05 P2 FAIL — sites/kids/pnpm-lock.yaml:312-314,519,544; docs/audits/production-swarm/FINAL.md:61; PR-EVIDENCE.md:19,48
Expectation: Security advisories have source-backed applicability/fix acceptance; exact-artifact verification not historical greens.
Observed: Current Kids lock pins sharp0.34.5. No fresh advisory exploitability/safe-version determination performed in this runtime scope. Known sharp advisory disposition remains unverified locally; neither Kids no-network observations nor presentation containment proves image-processing CVE safety. Historical4513 tests are not transferred.
Reproduction: Lock version REPRODUCED; advisory identity/exploitability NOT VERIFIED, no claim of confirmed vulnerability. Coverage hole fails full-production security criterion.
Fix/acceptance: Owning security reviewer records advisory ID/affected/fixed range, lock+installed+PR versions, reachable image paths; update authorized local dependencies if affected and rerun retained image/bounds/site checks. Do not mark genuine local patch as external/intentional.

## Fresh bounded execution

pnpm exec vitest run packages/authoring-core/test/final-acceptance.test.ts packages/engine-kernel/test/production-hardening.test.ts packages/engine-presentation/test/production-hardening.test.ts packages/engine-presentation/test/audio-playback.test.ts --reporter=dot → exit0,82pass/0fail. Current only.
Padded8MiB admission → exit0,1pass/17unselected,135ms case;137ms suite;2.674s wall. No complete importer suite claim.
Padded initial/reload current source probe: {"exit": 0, "stdout": "{\"case\":\"initial\",\"ok\":true,\"durationMs\":121,\"rssMiB\":351}\n{\"case\":\"reload\",\"ok\":true,\"durationMs\":200,\"rssMiB\":387}\n", "stderr": "", "wallSeconds": 2.351, "method": "current source TS transpileModule in-memory module hooks; no dist, filesystem writes, browser, build or typecheck"}
Two failed prior probe setups: ERR_MODULE_NOT_FOUND, then composed-scene requires2placements; neither tests boundary.
Parser probe current/PR/base accepts legacy v1 shapes without colliders; all three throw TypeError for world:null. PR/current identical source hash in JSON. This parser-only source evaluation is not full public package execution.

## Refuted/narrowed claims

- Authoring unknown-to-typed rewrite necessarily prevents hostile runtime inputs: REFUTED locally: ProposeInput.newValue remains unknown at propose-apply.ts:55-58; generic helper218-235 performs isJsonValue guard. Targeted current65 authoring tests participate in82green; not a root build certification.

- Old partial-allocation/dispose bug remains categorical: REFUTED for fresh targeted oracles only: production-hardening.test.ts:38-53,119-150 preserve last good root and cleanup; three-sculpt.ts:404-406,630-634 guard disposed state. Passed current suite, not proof of all allocation schedules.

- Capacity/numeric corruption still unbounded in current kernel: Narrowed/refuted: session.ts:72-79,154,762,780 enforce bounds; fresh production-hardening passes. No100000events/physical/browser soak executed.

- Cubic capability requires removing old negative oracle: REFUTED source: triangle-animation.ts:11-43 implements cubic and production-hardening.test.ts:84 still rejects malformed cubic value layout; no assertion removed.

## Coverage and goal verdict

FAIL in reviewed runtime artifact completeness/compatibility criteria; visual improvement inclusion delegated, not independently certified here
FAIL; NOT100%; no valid complete denominator supplied
Whole-repo build/gate owned by build reviewer; not rerun.
PR package execution impossible in incomplete artifact; source-only independent parser comparison not a PR suite green.
Browser/physical GPU/audio, all hostile proxies/TOCTOU schedules, complete importer suite and sharp live audit not executed.

Evidence/source fingerprint and exact PR/staged blob hashes: companion06-runtime-containment.json. Report artifacts only; no source modified.
