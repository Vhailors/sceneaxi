# Independent security verification — PASS (scoped source fixes only)

**331 disjoint tests passed; zero failures/skips.** Existing public-source suites: 210; umbrella endpoint/checkout: 91; actual export-map catalog consumers: 30. Commands, output and 32 identical before/after SHA256 fingerprints are in `report.json`. An earlier overlapping 125-test pass is not added. Source remained read-only; candidate is not frozen.

| Receipt | Independently accepted scope |
|---|---|
| CAP-01 | `packages/authoring-core/src/local-project-build.ts:335–369`: verified private copy plus separately generated, descriptor-pinned bootstrap. Existing benign real-child substitutions at `test/local-project-build.test.ts:128–194` leave execution markers absent, including owned runtime/bootstrap symlinks. Refusal alone was not the oracle. Not a same-UID/root sandbox or Electron-positive proof. |
| SESSION | `sites/umbrella/src/provider/own-session.ts:93–110` and `packages/site-kit/src/catalog-server-fetch.ts:223–254`: unsafe raw origin refuses before authority; credential accessors refuse with zero getter/network reads. Actual route/facade and both item-page consumers pass. |
| V2 | `packages/engine-kernel/src/index.ts:96`, `scene-session.ts:306–447`, `packages/engine-presentation/src/three-sculpt.ts:515–560`: public open/save/replay, shear-preserving matrices, local hierarchy, complete-batch refusal, overflow rollback and allocation cleanup pass. No pixels claimed. |
| CSP | `apps/web-shell/src/dev-server.ts:282–328,534–543`: exact trusted script/style hashes, no unsafe-inline, changed HTML refused. Socket-backed Happy DOM proves invalid/propose/reject focus and no-write behavior, **not browser CSP enforcement**. |

V1 scene implementation reconstruction matches pre-final-wiring hash; signed evaluator's original 3,524 bytes match HEAD exactly. Existing v1 golden/public regressions pass; dependency matrix is HEAD-identical. JSON records baseline distinctions and reconstruction delimiter correction.

**Not accepted:** active prepared-handoff `bridge.ts`, desktop-shell `session.ts`, Linux `build.mjs`; emitted declarations/build/fullgate; browser enforcement/geometry; native Electron launch; production/provider provenance.

Parent must obtain handback, rebuild dependencies, run unchanged fullgate and recorded browser/native acceptance. Local HEAD is `4e532e2`, branch `production-swarm`; published PR `346933c` remains expected broken/unpushed, not inspected or certified. No publication actions occurred.
