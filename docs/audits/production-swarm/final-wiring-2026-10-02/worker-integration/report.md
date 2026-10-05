# Worker integration — PARTIAL / NOT READY

**Explicit source handback:** bg-131 releases the five exclusive paths below; no further edits. This is not integrated/native acceptance. Exact before/after SHA256s are in `source-before.sha256`, `source-after.sha256` and `report.json.sourceAfterHashes`.

## Changes and focused proof

- `packages/importers/src/index.ts:64`: real public worker values/types, no aliases.
- `packages/importers/src/asset-preparation-worker.ts:52,130,152`: descriptor-only accessor/proxy/malformed/lexical-path admission before allocation; fixed ESM/CJS sibling selection; async publication and cancellation fence; result/cancel wait for both verifier cleanup and worker exit before releasing the single slot.
- `packages/importers/src/contained-gltf.ts:2482`: original document/source hashes rechecked through bounded64KiB read-only/O_NOFOLLOW descriptors with UTF-8 contentHash semantics, path/inode/stat identity before/after reads and cancellation cleanup. No full canonical-document/base64 allocation on main during this verification. Existing source-byte digest, manifest bytes, identity,8MiB/count16 and copy/rollback implementation unchanged.
- `packages/importers/test/asset-preparation-bounds.test.ts`: public imports; preserves ten original assertions; adds zero-getter/zero-worker malformed/proxy admission and cancellation during publication.
- `desktop/linux/src/electron/main.ts:334,583,615,1013`: actual picker and asset-import/hot-reload route call worker; project/bridge/generation fences and terminal status/cancel; reject/profile/project switch/shutdown retire pending work. Descriptor admission precedes picker/worker. Existing native smoke now has optional actual8MiB pipeline/resource instrumentation.

**Final default-config worker command:** `pnpm exec vitest run packages/importers/test/asset-preparation-bounds.test.ts --reporter=dot` — **12 passed, exit0, no unhandled errors**, `worker-final.log`. Includes unchanged original-byte/digest/proposal equality,100ms heartbeat,500ms terminal cancellation,4s deadline, stale/source-symlink/next-byte/Kids/busy/startup/cleanup oracles. No timeout or size budget changed.

`pnpm --dir desktop/linux exec tsc --noEmit` — exit0 (`desktop-typecheck.log`). Five-file ESLint and scoped `git diff --check` — exit0 (`lint-final.log`). Importer project-reference noEmit **failed**: TS2724/TS2305 referenced schemas-v2 symbols plus cascading engine diagnostics (`typecheck-after.log`); serial build must refresh reference declarations. Source-only desktop typecheck does not certify built workers.

## Red evidence retained

Historical Astra unchanged suite5fail/5pass was an export blocker, not freshly reproduced five failures here. Initial focused launcher timed out20s; integration rerun10pass/1fail hit unchanged4s next-byte worker deadline under contention (`worker-current.json`); isolated next-byte and full rerun passed. Added publication-cancel oracle exposed **uncaught AbortError despite12passing assertions / exit1** with an already-aborted ReadStream. Replacing streams with awaited bounded descriptor reads fixes the race without suppression; final command really exits0. JSON reporter's earlier `success:true` did not certify its process exit.

## Actual local blockers — not closed

`main.ts:349` still calls the **legacy synchronous bridge stage after worker success**. Confirmed `desktop/linux/src/lib/bridge.ts:1351` regenerates E1 via session.proposeEdit, and `apps/desktop-shell/src/session.ts:390` exposes no prepared-E1 hook. Exact returned proposal installation and compact display/IPC cannot be safely implemented under the granted main/importers-only scope. Narrow permission was requested twice and not granted. No fake cache, type cast, altered canonical dialect or alias green substitutes for the missing hook. This remaining stage can duplicate work and still block the main loop; do not certify8MiB frontdoor performance.

`desktop/linux/scripts/build.mjs:46` bundles CJS main but emits no worker sibling. Serial owner must emit fixed `asset-preparation-worker.cjs` from actual importer source beside main. Exact requested bridge/session/build edits are in JSON. Preserve authoritative lease/review/atomic-apply/copy recovery and all raw public-v1 bytes when adding prepared/compact projection.

## Prepared serial native proof — NOT RUN

After source-bound build and the above repairs: `SCENEAXI_SMOKE_ASSET_CAPACITY=1 node desktop/linux/scripts/smoke.mjs` (existing harness, serial owner only). Actual8MiB fixture goes through native picker/GUI review/accept/reload; changed original byte digest hot reload uses actual trusted bridge IPC, followed by three warmed canonical reloads and generation-bound terminal cancellation. Logs `ASSET_CAPACITY_METRICS`: phase walltimes, worker versus legacy-admission time, canonical/diff byte lengths, main/renderer10ms heartbeat and actual Electron process RSS working-set sum (shared pages conservatively counted). Enforces existing4000ms phases,100ms heartbeat,500ms cancel,256MiB growth and32MiB warmed plateau. No source bodies/credentials logged.

**Historical120s propagation root cause remains unproven.** New harness isolates worker/admission/publication/GUI/apply/reload rather than substituting fast direct staging. No compact-format losslessness, native latency/RSS, GUI cancel/hot-reload controls,16×8MiB/count17, browser pixels or build/full-gate proof is claimed. Defer those to the serial owner; source wiring gaps are local, not signing/provider blockers.

Cleanup: completed suites assert Worker.threadId=-1 and remove fixtures; four explicit own timeout fixture directories removed (`cleanup.json`); no own Vitest/Worker processes remain. No services/browser/native/container/install/provider/commit/push/deploy actions. No global ledger writes.
