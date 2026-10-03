# Importer capacity — implemented, shared export blocker

Owner bg-117; AP-PERF / DL-PERF-08 / 06-04. Initial report persisted before source edits. Read AGENTS/layout, current repair review/ledger and eight-mib report/harness/proposal. Earlier failed visual/native passes are not relabelled PASS.

## Confirmed current gap and actual implementation

Source-only 8MiB acceptance fixture reproduces synchronous proposal **304.702ms**, apply640.410ms, materialization418.631ms, parse66.016ms, replay633.268ms. The >100ms main-loop preparation gap is confirmed. **Historical native120s propagation cause is not proven.** Raw before-profile.json records every loaded-source hash. No compaction was justified; canonical base64/source digest/schema/identity and synchronous API bytes stay unchanged.

- `packages/importers/src/contained-gltf.ts:2479`: publication verification and base-hash snapshot helpers reuse existing contained-path validation; recheck source size/digest, document hash and proposal binding without copying/writing.
- `packages/importers/src/asset-preparation-worker.ts:48`: one real Node worker, fixed4000ms deadline, generation fencing, named refusals and Kids deny. `cancel()` fences synchronously and resolves only after worker termination; late results cannot publish. No apply/copy authority or caller-selected executable. Worker heap512MiB is a safety bound, NOT relaxation of native RSS256MiB/plateau32MiB acceptance.
- `packages/importers/test/asset-preparation-bounds.test.ts`: actual Node workers run actual source via stock Node transform and a test-only workspace resolve hook (production uses built sibling JS). Permanent maxbytes/evidence/heartbeat, cancel/late terminal, deadline fakeclock, busy/cleanup, stale document/source, source swap to symlink, Kids and startup-failure oracles. No root/export shim or assertion suppression.

## Executed versus blocked

Owned tsc and ESLint PASS. Current worker receipt worker-current.json: **5 pass / 5 fail / 0 pending**. Cancel<=500ms with exited-worker check, busy-slot cleanup, fixeddeadline, Kids preworker deny and startup-failure cleanup pass. Real-worker import cases correctly FAIL because `authoring-core/src/scene-composition.ts:33` requests `SCENE_COMPOSITION_SCHEMA_VERSION_V2` not yet exported from schemas index (bg115 has sent exact ready v2 exports to serialowner). This is a local shared integration blocker, not external.

Existing importer suite **18 pass**, unchanged assertions incl16x8MiB/count17, nextbyte/symlink/rollback. Its capacity case unexpectedly used849472KiB maxRSS and8327ms; it is not repeated or presented as a native256MiB-budget PASS. Initial tests also retained transient bg115 parse-error and test-loader/fixture setup failures; no false before/after-green claim.

## Exact serial integration handoff requests

Export VALUES `startProjectAssetPreparation`, `ASSET_PREPARATION_REFUSALS`, `ASSET_PREPARATION_DEADLINE_MS` and TYPES `ProjectAssetPreparationInput`, `ProjectAssetPreparationOutcome`, `ProjectAssetPreparationJob` from importer `./asset-preparation-worker.js`. No new package subpath needed; contained-gltf helpers remain internal sibling exports.

Desktop must preserve existing picker/profile/Kids/root/document/lease admission and begin one worker job. Await result under generation/project/lease fence, then install **the returned exact E1 proposal/diff** into existing review; do not re-run sync importer/propose. Cancel explicitly/on switch/close and await terminal acknowledgement; do not interrupt atomic apply. Serialowner adds narrow typed generation-bound cancellation schema/map/bridge/preload/control. Ship sibling `dist/src/asset-preparation-worker.js` and preserve existing workspace-resolver inheritance. Profile accept/materialization/IPC/canonical reload separately; preparation offload is not full GUI repair.

Native/browser/fullbuild/fullgate/package acceptance NOTRUN. Keep <=4000ms phases, <=100ms main/renderer heartbeat, <=500ms terminal cancellation, RSSgrowth<=256MiB/plateau<=32MiB and all16x8MiB/count17/nextbyte/symlink/rollback predicates. No source bodies, paths or credentials in timings. Full native120s cause remains a required serial measurement, not external reclassification.

## Cleanup / handback

All temporary source fixtures/loader roots and Node workers exited and removed; no servers, ports, browsers, native processes, providers, database, installs, staging/commits/push/deploy. Exact source hashes and dependencies are in report.json. **SOURCE HANDBACK ISSUED: all three owned source/test files released to serial bg-109 as-is; no further source changes by bg-117.** Current status is NOT READY: five real-worker tests still fail on shared v2 export integration. Parent/serialowner must apply exact schema/importer export requests, rerun the unchanged ten owned worker oracles, then source-bound native acceptance. Handback permits integration; it does not certify those predicates. A timed-out test-only bundler attempt left one owned temporary directory; it was explicitly removed and recorded in cleanup.json.
