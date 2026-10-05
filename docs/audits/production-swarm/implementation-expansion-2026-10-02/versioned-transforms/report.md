# LOCAL-070 — versioned transforms source handback

**Owned implementation complete and handed back; shared integration NOT READY.** No source edits after this report unless the controller authorizes a specific repair. No production/full-lane PASS; historical pass-3 failures remain unchanged.

## Actual implementation

- `packages/schemas/src/scene-composition.ts:1119`: additive **explicit schemaVersion 2**, typed intake/scene, descriptor-only bounded validation, XYZ local TRS, correct column-major parent×child matrices retaining shear, ordered hierarchy, actual affine-scale numeric guards, deterministic conservative rest bounds, digest/tamper validation, explicit intake migration and document reader.
- `packages/authoring-core/src/scene-composition.ts:681`: `composeSceneV2` binds actual validated artifacts to resolved matrices/bounds, serializes evidence and creates the existing text-canonical SceneDocument. `migrateComposedSceneV1ToV2` explicitly migrates persisted v1 while retaining artifact bytes. Existing stable capture/options/JSON/document helpers reused.
- `packages/engine-presentation/src/scene-transforms.ts:11`: `resolveScenePresentationV2` validates before renderer allocation and returns numeric world-node matrices/bounds, never Three types.
- Permanent tests: `packages/schemas/test/scene-transform-v2.test.ts` (26) and `packages/authoring-core/test/scene-transform-v2.test.ts` (14). Rotated hierarchy, arbitrary XYZ Three-quaternion oracle, shear, nested finite scale/exact minimum/overflow/anisotropic underflow, bounded anisotropic rotated nesting, geometry bounds, cycles/depth/count32→33, accessors/no getter invocation, migration, tampered poses/bounds/digests, artifact reference integrity and unchanged v1 golden bytes.

Caps unchanged: 2..32 instances, depth8, local/effective scale1e-6..9,007,199,254, coefficient/bounds magnitude9,007,199,254. Scale checks use actual affine stretches (not false axis products after rotation); floating comparison tolerance is documented in JSON. Bounds are conservative **rest-pose** bounds matching existing sphere/tapered-cylinder geometry, not animated/collision proof. No intermediate matrix rounding or TRS decomposition.

## Before / after, honest limits

Preserved exact original schema prefix SHA256 `43c85cf3544bd261caa3e3504b5be4a9e9c8f7680fbcd588616a73c91c8a3c0f`, and original authoring implementation SHA256 `bb38670abdbf3cdc7a4205a012f1b9ba0be4506cad40cdedf516f96cdd6e0084` after removing only the added import. Both match capacity-work receipts. Schema v1 bytes/APIs/validators/golden digests were not changed.

`exact-baseline-gap.log`: 1 expected failure, resolver `undefined != function` on this exact pre-change snapshot (only import paths relocated). This snapshot replay ran after additions, not dishonestly labeled a chronological before run. Current v1 rotated-parent refusal and silent-version-upgrade refusal also execute permanently. Initial `fail-before.log` was an unavailable bare-Three **test dependency**, not feature proof; retained. Public authoring first run failed on **missing shared exports**, not a passing application seam.

Final focused checks:

- Default schema test: **26 pass**, no export probe.
- Both owned tests with exact requested export-only aliases: **40 pass**.
- Focused owned + unchanged v1 schemas/authoring/golden: **5 files / 69 pass**. V1 scene digest/byte golden and existing v1 mount/kernel save-replay pass unchanged.
- Schemas `tsc --noEmit`, all five owned files ESLint, `pnpm check:boundaries`, owned `git diff --check`: pass.
- Authoring package typecheck **not accepted**: missing shared exports/new local-build dependency and earlier direct cross-package test source import (latter repaired to public import). Serial indexes/build required. No casts, skipped assertions, lint bypass or cap raise used to silence it.

The probe aliases under this report directory add **only the exact pending exports** to real modules. They prove real implementation behavior but **do not claim product index wiring**. Final hashes/commands/output paths and retained fixture/lint failures are in `report.json`.

## Exact serial handoff (bg-109)

- `packages/schemas/src/index.ts` from `./scene-composition.js`: values `SCENE_COMPOSITION_SCHEMA_VERSION_V2`, `SCENE_MATRIX_CONVENTION_V2`, `multiplySceneMatricesV2`, `sceneMatrixFromSculptTransformV2`, `validateSceneCompositionIntakeV2`, `resolveScenePlacementsV2`, `migrateSceneCompositionIntakeV1ToV2`, `digestScenePlacementsV2`, `digestComposedSceneV2`, `projectSceneInstanceHierarchyV2`, `validateComposedSceneV2`, `composedSceneV2FromDocumentData`; types `SceneMatrixV2`, `SceneCompositionIntakeV2`, `ResolvedScenePlacementV2`, `SceneBoundsV2`, `ComposedSceneInstanceV2`, `ComposedSceneV2`, `PlacedSceneInstanceHierarchyV2`.
- `packages/authoring-core/src/index.ts` from `./scene-composition.js`: values `composeSceneV2`, `serializeComposedSceneV2`, `sceneDocumentFromComposedSceneV2`, `migrateComposedSceneV1ToV2`; types `SceneCompositionResultV2`.
- `packages/engine-presentation/src/index.ts` from `./scene-transforms.js`: values `resolveScenePresentationV2`; types `ScenePresentationSourceV2`.

Add `packages/schemas/contracts/scene-composition-v2.schema.json` from the exact `scene-composition-v2.schema.proposal.json` under this folder; leave v1 contract intact. Serial owner updates contract inventories/docs/fixtures (no suppression).

Actual runtime wiring still required, not an external decision:

1. Explicit schema2 authoring dispatch calls `composeSceneV2`; document reader selects `composedSceneV2FromDocumentData`. V1 functions continue refusing v2.
2. Kernel adds schema2-only open/save/replay (suggested `openSceneKernelSessionV2` / `replaySceneKernelSessionV2`), retaining v1 interface/save bytes. Carry validated scene/matrix/evidence; recompute terminal digest on replay and refuse majors/tampering. Simulate artifact-local driver transforms and recompute world matrices before flattening; **never decompose shear or send world matrices to v1 additive-Euler simulation**. Current projection helper is a rest-pose numeric seam, not fake animation/runtime readiness.
3. Presentation uses `resolveScenePresentationV2` before allocation. Reuse existing instance builder with identity placement, then set its independent parent group's matrix from the validated worldMatrix and `matrixAutoUpdate=false`; keep original artifact-local hierarchy. Do not apply absolute node matrices twice. Preserve live guards and transactional disposal.
4. Run **regular no-alias owned tests**, declarations/contracts and fullbuild/fullgate only after handbacks; add real v2 kernel rotated/sheared advance/save/replay and browser draw/pixels/cleanup oracles. Fullbuild/fullgate/site/browser/native, actual v2 save/replay/render/collision/animated bounds are **NOT RUN** here.

## Source fingerprints and cleanup

- `packages/schemas/src/scene-composition.ts` SHA256 `3ffd88fa60166409acc381fc921e7bd1bd81adab2060b7b9b384d2822ae573aa`
- `packages/authoring-core/src/scene-composition.ts` SHA256 `509f85a54af188f993aa7cbe615b04ee6c2ed0f6b8104ee57e81bfd4133b2383`
- `packages/engine-presentation/src/scene-transforms.ts` SHA256 `c77e395f2a50b4a7f46c46e5e640d6ef664b65f213d04a19489f64dceec22a04`
- `packages/schemas/test/scene-transform-v2.test.ts` SHA256 `373e313d4421d951089c6d46def343ce846f88608230942c723f44ba30e3fae7`
- `packages/authoring-core/test/scene-transform-v2.test.ts` SHA256 `521683c6ba8ba28715bfa531746d36255d72a253f8b0bac366513f15829e5702`

No server/browser/container left running; test processes exited, existing v1 golden fixture cleans its temp directory in finally. Probe/config/baseline/schema-proposal files are retained audit evidence, not product fallbacks. No staging/commit/push/merge/deploy/install/spending/provider/productionDB action. **All five exclusive source paths handed back, frozen now.**
