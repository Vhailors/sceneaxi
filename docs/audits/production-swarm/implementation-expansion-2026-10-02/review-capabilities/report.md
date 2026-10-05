# Independent capabilities review — FAIL / integration NOT READY

Review root: `/home/devuser/Documents/Projects/sceneaxi`; HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. All three actual reports declare source handback. No unfinished worker is certified. Only this review directory was written; product source remained read-only.

## Confirmed blocker: execution precedes containment refusal

**CAP-01 — FAIL, high:** `packages/authoring-core/src/local-project-build.ts:264,275,279,304` verifies the artifact, then executes its mutable `runtime.cjs` pathname. Pinning only the executable does not pin the runtime script or artifact directory.

Independent `launch-race.test.mjs` injects a symlink replacement at the real `mkdtempSync` boundary after verification, before spawn. An actual stock Node child then executes the replacement script and writes a marker. The adapter eventually returns `LOCAL_PROJECT_BUILD_LAUNCH_UNVERIFIED`, but the unverified code has already executed. Assertion output: `unverified runtime must not execute ... expected true to be false`. This is a controlled filesystem-race reproduction, not an Electron/native test or a forged pixel success. Fixture and evidence temp directories are removed.

**Fix for serial integrator:** execute the trusted generated bootstrap from an immutable/pinned location outside mutable project artifacts; retain descriptor-contained artifact/resource identity through use. Do not fix by adding only a post-execution hash check. Add permanent runtime/directory/symlink substitution oracles before calling launch contained. This blocker is local code, unrelated to signing.

## Independently executed evidence

| Evidence | Result | Meaning |
|---|---|---|
| `regular-tests.log`: seven normal-config transform/v1/local-build suites | **31 failed, 65 passed**, exit 1 | New public symbols are not wired; `buildLocalProject is not a function`, `validateSceneCompositionIntakeV2 is not a function`. |
| `export-probe-transforms.log`: two new transform suites plus unchanged schema/authoring/v1 golden suites | **69 passed**, exit 0 | Real implementation under the builder's disclosed exports-only aliases; NOT product export/runtime acceptance. |
| `worker-tests.log`: unchanged ten new real-worker tests | **5 failed, 5 passed**, exit 1 | Missing schema export prevents worker import; stale-source/document, symlink and next-byte expected refusals instead receive `ASSET_PREPARATION_UNAVAILABLE`. Cancellation/exit, busy cleanup, deadline, Kids and startup cleanup pass. |
| `launch-race.log`: independent containment oracle | **1 failed**, exit 1 | Actual replacement runtime executed before refusal. |

Dedicated project test tool reported `No test command detected`; commands therefore ran explicitly in the real root. No assertions, source tests, budgets, masks or suppression were changed. Counts overlap and must not be summed as disjoint coverage.

## Compatibility and exact fingerprints

`fingerprint-before.json` / `fingerprint-after.json` record SHA256s for all twelve handed-back source/test files, four shared public indexes, and root test config. **No recorded file changed across review.** All transform and local-build source/test hashes match their handback receipts. This is a scoped fingerprint, not an assertion that the whole active repository is frozen.

Independently verified exact original prefixes:

- Schemas v1 scene composition: 35,788 bytes / 1,111 lines, SHA256 `43c85cf3544bd261caa3e3504b5be4a9e9c8f7680fbcd588616a73c91c8a3c0f`.
- Authoring v1 composition: 18,977 bytes / 641 lines after removing only the additive import, SHA256 `bb38670abdbf3cdc7a4205a012f1b9ba0be4506cad40cdedf516f96cdd6e0084`.
- Signed build gate: 3,524 bytes / 96 newline-terminated lines, SHA256 `ec7b86e27314891af86e662279d6ea835b12ccfec63155c7e022578ebfee0588` (builder's prose calls this 97 lines).

No silent v1 version/layout/digest change was found in this scope. Existing v1 golden bytes/save-replay pass under the disclosed export probe. V2 uses explicit schema2 and parent×child affine matrices, retaining shear rather than additive Euler/decomposition (`scene-composition.ts:1235-1274,1346-1352`). Bounds are conservative primitive rest-pose bounds (`:1419-1435`), not collision/animated proof. Singular/stretch/domain checks and 32-instance/depth caps remain explicit. No schema1 runtime may silently consume schema2.

## Exact serial integration requirements

1. **Shared exports, local blocker:** `packages/schemas/src/index.ts:953,1113`, `packages/authoring-core/src/index.ts:188`, `packages/importers/src/index.ts:62`, and presentation index need the exact additive values/types in the three builder reports. `report.json` preserves those requests. Preserve existing exports/v1 contracts. Add the proposed schema2 contract and normal inventories, not checker exclusions. Then rerun regular no-alias tests and declaration/build checks.
2. **V2 actual use:** explicit intake/document dispatch; schema2-only kernel open/advance/save/replay with recomputed matrices and terminal digest; retain artifact-local animation before world multiplication. Presentation must validate before allocation, apply an independent instance-parent matrix once with auto-update disabled, preserve local hierarchy, and preserve transactional disposal/live guards. Rotated/sheared save/replay and real pixels/cleanup are still required. Export helpers alone do not complete LOCAL-070.
3. **Local unsigned project:** separate purpose/signed gate is preserved (`desktop-project-build.ts:99`). Staging actually binds saved user `scene.json` plus existing Web export files and a standalone runtime, not an Editor rebuild (`local-project-build.ts:148-192`). After CAP-01 repair, wire existing export/action under trusted profile/held-key authority; never accept caller role/approval or report release readiness. Run actual user-document load/digest, captured pixels/PNG and exact exit0 smoke using the builder's deferred native driver. Source wiring/native proof is local work; signing/notarization/publication remains separately held.
4. **Importer real use:** export worker API; one generation/project/lease-bound job in desktop; install returned exact E1 proposal/diff without synchronous re-preparation; cancel on explicit cancel/project switch/close and await terminal exit; never interrupt atomic apply. Ship built sibling worker with existing resolver inheritance. Current terminal fence sets `terminal` before termination and resolves after worker exit (`asset-preparation-worker.ts:85-98,125-129`), independently exercised for cancellation.
5. **Importer responsiveness/resource acceptance NOT READY:** publication still performs synchronous full document/source reads and hashes on main (`asset-preparation-worker.ts:113`; `contained-gltf.ts:2490-2492`). No document byte cap is imposed in that publication helper. Measure complete completion/publication/IPC/canonical reload, including a pre-populated capacity document; offloading proposal creation alone does not certify responsiveness. No compaction was implemented, so no new compact-format losslessness claim is justified. Keep exact original byte digest/base64/identity and existing negative oracles. Worker old-generation 512MiB is not the GUI RSS256MiB/plateau32MiB acceptance threshold. Builder's reported 849472KiB capacity run is not a pass and was not repeated here.

## Deferred, not certified

Full build/gate, all source-parsed contracts, native/browser pixels, desktop/CLI action wiring, v2 kernel/runtime behavior, 16×8MiB native document propagation and full GUI memory/heartbeat bounds were NOT RUN here. Historical 120-second native stall root cause remains unproved; do not extend its budget or relabel it external. Existing 16×8MiB/count17/rollback suite results in builder receipts are attributed, not independently re-certified here. No detached waiting/polling, installs, servers, native/browser/container processes, commits or pushes.

**Verdict: FAIL for CAP-01 and current public/worker tests; NOT READY for integrated capabilities.** Ready findings were sent to parent/serial integrator; no product edits by reviewer.
