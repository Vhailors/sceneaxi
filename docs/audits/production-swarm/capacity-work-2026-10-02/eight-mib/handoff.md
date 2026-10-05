# Serial integration handoff — eight-mib / AP-PERF / 06-04

Product source remains frozen. No new native performance defect reproduced; worker offload is conditional, not a landed fix. Existing patch-proposal.md describes generation-bound planning without widening byte/count limits or interrupting atomic writes.

## Ready-to-run bounded admission
`PYTHONDONTWRITEBYTECODE=1 python3 docs/audits/production-swarm/capacity-work-2026-10-02/eight-mib/acceptance.py --run`
Runs actual public importer TS source through memory transpilation, seedDesktopProject -> writeNativeProjectSeed, source stat admission and symlink refusal. Not a clone of product algorithm. Falsified admission receipt must fail validation. Fingerprints of every loaded source are checked; drift refuses certification. Exact source/canonical/input hashes in acceptance-receipt.json.

## Deferred native command; NOTRUN here
`timeout 90s python3 docs/audits/production-swarm/capacity-work-2026-10-02/eight-mib/check.py --native --authorized-heavy --executable /absolute/approved/native-executable --sha256 INDEPENDENT_EXECUTABLE_SHA256`
Preconditions: explicit native/heavy authorization after Astra serial handoff, existing Playwright/native artifact/display, immutable artifact inventory (executable + app.asar + renderer + preload hashes), independently bound to source; disposable user-data, no concurrent heavy job. No install/build needed by this harness. Driver owns its launch/dialog fixtures and finally closes only its own application. Exit 2 means incomplete, not PASS; watchdog failure must be FAIL.

## Profile these distinct stages
Seed/serialize: desktop/linux/src/lib/project-seed.ts:34-48 outside measured import. Native picker/command-map: desktop/linux/src/electron/main.ts:943-953. Preload: desktop/linux/src/electron/preload.ts:17-25. Public asset proposal: desktop/linux/src/lib/bridge.ts:1281-1378 (proposal + authoring review). Public imports: packages/importers/src/contained-gltf.ts:2369-2477 (stat/read/parse/hash/diff), :2066-2250 staging, :1717-1931 manifest decode/reparse, :2561-2704 copy/materialize/fsync. Active-scene/reload recovery: desktop/linux/src/lib/bridge.ts:1259-1278. Separate start/end spans; no claim that 200ms direct staging covers apply/reload.

## Integrator fixes to auxiliary driver before full certification
1. Picker cancel currently measures click + fixed 50ms delay: UNVERIFIED. Await real preload importAsset terminal response or public native command completion, then snapshot canonical document and assets tree; reject late mutation after 1s. Review Reject is not in-flight cancellation.
2. Current driver tests document-reload, not changed-source hot reload. Generate fixture(1) (same exact 8MiB, triangle translated +1 x), write exclusively to the selected source regular file, invoke real preload request asset-import with payload {profile:'web', sourcePath, documentPath:'scene.json', assetId:originalEntry.assetId, hotReload:true}; accept through real review control. Assert new source/copy digest equality, unchanged asset/instance identity, one retained asset, changed geometry, unchanged byte limits, three repeats. Match envelope to bridge-contract against exact artifact before running; selector mismatch FAIL.
3. Add real generation-bound asset cancel command/control in canonical schema/command map only after desktop owner approval. Dispatch at observed planning-start checkpoint, await terminal cancelled acknowledgement <=500ms, continue watching 1s for stale result publication or writes. Snapshot document/asset hashes and retain atomic commit barrier. No usable seam established: NOTRUN, never substitute direct staging or review rejection.
4. Restart main/renderer 10ms heartbeat samples after activation baseline; drain a scheduled heartbeat after every timed command so terminal synchronous stalls are not missed. Measure OS RSS separately: Electron getAppMetrics workingSetSize is working-set proxy, not established RSS. Unsupported OS sampler => RSS NOTRUN. Sample all owned main/renderer process PIDs at <=10ms intervals, report baseline/peak/final sum in bytes; no fabricated measurements.

## Fixed proposed predicates (not a pre-existing product SLA)
Review <=4000ms; accept/materialize <=4000ms; changed-source reload and document reload each <=4000ms; main + renderer max heartbeat gap <=100ms; summed RSS growth <=256MiB; after accepted warmup, final growth across three reloads <=32MiB; picker/review/in-flight cancel ack <=500ms. Outer watchdog <=90s. Keep 8,388,608 source-byte and 16-asset admission limits; no upward revision to obtain green. Capacity 16x8MiB/count17 and rollback/fault tests remain separate deferred work.

## Scope and cleanup
Only exclusive eight-mib auxiliary files changed. Source/config/product tests untouched; no Git staging/commit/deploy, services, credentials, providers or DB. Fixture directory + deliberate same-root symlink cleaned. Initial Python indentation failure was corrected; bounded validation rerun passes. Existing historical maximum-source acceptance receipt is retained, not relabelled as a newly executed native result.
