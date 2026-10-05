# Scene runtime — owned source handback complete; public export dependency BLOCKED

**No production or public-v2 PASS.** Exact source fingerprints and full assertions/commands are in `report.json`. Report pair was created before source implementation.

## Source handback

- `packages/engine-kernel/src/scene-session.ts` — SHA256 `420983f70a9a16aba5dcd5ce7fcc8f03fc68bd8e3b6302018738bd93d513b294`
- `packages/engine-presentation/src/three-sculpt.ts` — SHA256 `7b2a73bb61b22d1fcf171acdce521279257e66447e3eb77ba30f85035c995f03`
- `packages/engine-presentation/src/scene-transforms.ts` — SHA256 `897136ce433d2750a7817481dab87319e2d0b077ff25cfe3b6097bad31079634`
- `packages/engine-presentation/test/scene-runtime-v2.test.ts` — SHA256 `d32d0e7ee0f34cc616404ece8a3970d94d934f905335191446d8ead50159899b`
- `packages/engine-presentation/test/browser-scene-v2-proof.mjs` — SHA256 `1275aba8c6d17ea9ed12b28598a7d42ac7f1a448a979949b010d6d707f300c91`
- `packages/schemas/contracts/scene-composition-v2.schema.json` — SHA256 `9dd10953042b14dab454137f814f6b07c1722632aed683e1af6d9b69e8a346e3`
- `packages/schemas/contracts/scene-kernel-save-v2.schema.json` — SHA256 `3b079987414ea375d9508c97cbf7410da5841779c7f4d7cad97c3a42468d483c`

Kernel adds explicit `openSceneKernelSessionV2` / `replaySceneKernelSessionV2`, full matrix snapshots/bounds and evidence-preserving schema2 save/replay. All instance local drivers and projected world bounds preflight before any commit. Three backend adds transactional `mountSceneV2` / `presentSceneV2`: exact helper matrices, retained shear, local hierarchy under independent placement roots, no decomposition/double world application. Descriptor-only complete-batch refusal leaves prior objects unchanged. Allocation failure disposes every candidate. V1 scene-session original bytes reconstructed exactly; session.ts, three-runtime.ts and v1 JSON contracts were not changed.

## Actual red/green evidence
- Red before: regular public test 0pass/1fail: new kernel values absent (`red-before.log`). Initial unrestricted test timed out20s; maxWorkers=1 reproduced the assertion.
- Independent source implementation: temporary direct-kernel-source probe11/11 pass; strict actual-source TS5.9 checks and owning lint pass. This is **not** alias/public green; the temporary probe was removed.
- Existing regular public regressions:6files/83tests pass, including v1 golden bytes, scenes, public authoring/schema v2 and existing Three mount paths.
- Default permanent new public consumer: **1pass/10fail**, `openSceneKernelSessionV2 is not a function` (`public-consumer-after.log`). Parent must wire kernel index exports; no authority/index edit was invented after an unanswered ASK.

## Exact parent-owned integration edit
In `packages/engine-kernel/src/index.ts`, from `./scene-session.js`, export values `openSceneKernelSessionV2`, `replaySceneKernelSessionV2`; types `SceneInstanceSnapshotV2`, `SceneKernelSnapshotV2`, `SceneKernelSaveArtifactV2`, `SceneKernelSessionV2`. Then rerun permanent public test. SDK owner should include the two additive JSON contracts; runtime scene-transforms dependency is already pinned.

## Semantic remaining risk / deferred acceptance
- Toy drivers are artifact-local independent bodies; placement parent is static layout. No world-space collision, moving-instance attachment or Rapier/triangle/skin v2 support claimed. Sockets remain scalar snapshot metadata, not deformed rendered geometry.
- Live procedural bounds are checked; runtime local depth256/local driver magnitude1e9 may refuse larger schema-valid artifacts transactionally. Worst cap projection32×4096=131072meshes is not measured RSS/frame timing. Preflight mirrors existing toy translation math and needs updating with future driver changes.
- Full unchanged build/gate/contracts/declarations, site/native and actual browser are deliberately unrun. Source-only noEmit caught/fixed actual typing defects; package-project attempt exposed stale dependency declarations, not falsely declared green.
- Browser driver is syntax/lint checked, **not executed**. Serial stable-build command: `node --loader ./scripts/workspace-dist-resolver.mjs packages/engine-presentation/test/browser-scene-v2-proof.mjs docs/audits/production-swarm/final-wiring-2026-10-02/scene-runtime/browser-scene-v2.png`. It asserts real WebGL rotation/shear/advance diffs, replay/refusal image identity,10-remount plateau and terminal GL handles0, and emits PNG SHA256. Headless tests explicitly report no pixels.

## Cleanup / final explicit source handback
All focused processes exited; no browser/server/container retained. Controlled late mount failure proves4candidate geometries disposed and prior scene unchanged. Temporary source-probe test removed. Existing failures/logs retained. No install/live provider/spend/commit/push/merge/deploy/global ledger writes. **SOURCE HANDBACK COMPLETE, owned files frozen; default public kernel export integration remains explicitly NOTREADY.**
