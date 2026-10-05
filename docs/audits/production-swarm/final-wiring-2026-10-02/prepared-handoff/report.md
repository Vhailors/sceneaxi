# Prepared asset handoff — SOURCE HANDBACK / serial frontdoor pending

## Retry verification and cancellation hardening

The three requested source changes and both focused tests were already present when this retry began; retained without redundant rewrites. Retry additionally captures the original session AbortSignal before awaiting descriptor reads and bounds streaming to the initial descriptor size plus one-byte growth detection. Regression replaces the caller's signal after cancellation: red-before failed with `expected proposal to be null` (11 passed/1 failed); green-after passes all 22 focused tests. Fresh normal-public run: **102 passed across six files**. Scoped ESLint and diff check exit0. Receipts: `retry-red-before.log`, `retry-green-after.log`, `retry-normal-public-tests.log`.

Current hashes are in `report.json.sourceAfterHashes` and `retry-source-after.sha256`; these supersede the original source hash manifest. Default-dist, native-main adapter and serial gate proof requests below remain pending; no build, native/browser execution, installation, staging or commit was performed. Tests clean their own workers and fixtures. Exact five-path source handback remains released to parent.

**bg-133 releases all three granted source files plus both new focused tests. No further source edits.** Actual final SHA256s: `source-after.sha256` and `report.json.sourceAfterHashes`. HEAD remains `4e532e2fbf43e9948741578ab6208a3277870405`. Before-edit read hash footers retained; full before SHA256 was not captured and is not fabricated.

## Implementation

- `desktop/linux/src/lib/bridge.ts:1325`: host-only `prepareAssetImport(input)` factory owns the real public worker request/result together. Root/profile/lease/single-review authority remains real; renderer cannot inject a prepared result. Result is already a `DesktopBridgeResponse`; job exposes generation/result/cancel. Worker descriptor admission is reused, no parallel importer/authoring implementation.
- `apps/desktop-shell/src/session.ts:101,437`: `stagePreparedProposal` validates shared E1 schema/single edit/exact diff, seals unchanged proposal identity, streams64KiB UTF8 contentHash-compatible/O_NOFOLLOW descriptor verification and checks canonical containment/inode/stat identity plus revision/AbortSignal fences. Existing accept/recovery/undo authority unchanged.
- `desktop/linux/src/lib/bridge.ts:476`: compact prepared display/IPC only. Exact raw proposal, full canonical document bytes, original source evidence and copy/reload/replay identity remain stored. Prepared review/accept/status omit base64/full E1; legacy public importer and synchronous asset-import contract unchanged.
- `desktop/linux/scripts/build.mjs`: emits actual importer source as fixed sibling `asset-preparation-worker.cjs` with existing common/node22/node/CJS configuration; output and recorded-offer leak inventories include it. No fake entry.

## Fresh red → green / normal public tests

`red-before.log`: missing session API,1failed/exit1. `focused-first.log`:15pass/1fail, accepted JSON89936 bytes violated unchanged<6000 compact oracle. Corrected leaked assetImport projection, not its assertion.

Final default-config public command in `normal-public-tests-final.log`: **6files/101tests PASS, including all21 new focused assertions**, exit0. Exact retained proposal/diff and freeze; canonical accepted document byte-identical to actual public synchronous proposal/apply in twin project; original source copy/digest; stableID changed-byte reload/replay; stale-base-before/after-review refusals; single review/undo/recovery; cancel/reject/close/new-review no late stage/write; Kids/path/symlink/accessor/forged request refusal. Actual8MiB *preparation+staging* response<6000 and main heartbeat<=100ms pass. No8MiB native/apply timing claim. Node uses real Worker/importer with test-only source resolver, public imports and unchanged default Vitest config.

Owned ESLint, desktop source `tsc --noEmit`, boundaries and scoped diff check exit0 (receipts in JSON). Expected node WebGL refusal stderr and experimental Node type-transform warnings are not native proof. No whole build/full gate run here.

## Exact parent wiring and default-dist proof requests

At `desktop/linux/src/electron/main.ts:334`, replace raw `startProjectAssetPreparation(...)` with `selectedBridge.prepareAssetImport(input)`. Await job.result directly (already bridge response), remove legacy synchronous `selectedBridge.handle(...)` regeneration, retain current window/root/bridge/generation fences and cancellation. Pending job type: `ReturnType<DesktopBridge["prepareAssetImport"]>`. Raw `outcome.prepared` metrics no longer exist; compact entry carries `canonicalBase64ByteLength`. Factory/adapter integration is parent's serial source responsibility; this agent does not write main.

After adaptation/source handback: `node desktop/linux/scripts/build.mjs`; assert real nonempty default sibling and launch it through actual CJS main factory. Then `SCENEAXI_SMOKE_ASSET_CAPACITY=1 node desktop/linux/scripts/smoke.mjs` with existing4s/100ms/500ms/256MiB/32MiB bounds, actual picker/review/accept/reload/cancel and Electron RSS. Then unchanged `pnpm gate`. These executions are **NOT RUN here**, as directed. Structural emission inventory test alone is not emitted-artifact proof. Historical120s propagation root cause and native/full capacity remain serial measurements, not fake external blockers or certified performance.

Cleanup: focused tests assert every Worker.threadId=-1 and remove every own loader/project/twin fixture. No own server/native/browser/container/install/stage/commit/push/merge/deploy/spend. All inherited changes preserved. Exact five-path SOURCE HANDBACK is listed in JSON.
