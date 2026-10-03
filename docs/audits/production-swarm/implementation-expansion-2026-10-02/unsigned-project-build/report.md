# Unsigned local user-project adapter — source handed back, NOT integrated/native-accepted

## Actual implementation

- `packages/schemas/src/desktop-project-build.ts:99`: separate `evaluateLocalProjectBuild` purpose. Original 97 lines SHA256 `ec7b86e27314891af86e662279d6ea835b12ccfec63155c7e022578ebfee0588` remain byte-identical; signed release gate unchanged.
- `packages/authoring-core/src/local-project-build.ts`: `buildLocalProject`, `verifyLocalProjectBuild`, `launchLocalProjectBuild` implement Linux descriptor-contained staging of the existing verified Web export/current saved user document, generated standalone Electron runtime, deterministic per-byte manifest/hash receipt, bounded actual launch. This is not an Editor rebuild or signing/publication claim.
- Permanent tests: both authorized `local-project-build.test.ts` files. Positive materialization/receipt/runtime syntax, Kids/host/purpose, traversal/source/export/destination/root/executable symlinks, tamper/old-source/receipt duplicate/extra files, budget, disk-write rollback/retry, fake-zero-exit/hanging/flooding child negatives. No assertions weakened.

## Executed and retained failures

Schema before 8 failed/1 passed; after 9 passed. New adapter was absent before (suite load failure). Implementation bridge initially 7 failed/17 passed due a real descriptor-dot path bug, corrected in source. Final focused implementation **27 passed**. Existing unchanged project-build golden plus owned tests **28 passed**. Lint and boundaries exit0. Focused semantic typecheck ownedErrors0, graphErrors10 from concurrent transform lane missing v2 shared exports (retained); no suppression/cast. Public normal-config tests currently fail because serial shared exports are absent: this is **NOT public-seam acceptance**. Auxiliary bridges reexport actual source only; exact aliases preserve subpaths. See JSON/logs for every exact receipt.

## Exact serial requests

1. Schemas index: add `evaluateLocalProjectBuild` to desktop-project-build export block.
2. Authoring index: export `LOCAL_PROJECT_BUILD_LIMITS`, `LOCAL_PROJECT_BUILD_REFUSALS`, `buildLocalProject`, `verifyLocalProjectBuild`, `launchLocalProjectBuild`; types `LocalProjectBuildRefusal`, `LocalProjectBuildReceipt`, `LocalProjectBuildSuccess`, `LocalProjectBuildResult`, `LocalProjectBuildInput`, `LocalProjectLaunchInput`, `LocalProjectLaunchSuccess` from `./local-project-build.js`.
3. Existing desktop/CLI action: derive trusted session profile/held-key authority; produce real existing `exportDesktopWebProject`; supply project-relative output path to explicit local-unsigned build; launch approved symlink-free host Electron binary; surface unsigned/nonrelease receipt and actual PNG proof. Do not change old signed-release behavior. Root index/manifests/desktop/CLI were NOT edited here.
4. Run normal-config tests, source-parsed boundaries, fullbuild/fullgate and actual native smoke serialized after all source handbacks. Driver `deferred-native-smoke.sh` / `native-smoke.ts` materializes an actual user-document fixture and existing Web export, then requires correct document digest, rendered meta, captured >=16 bitmap colors, SHA256-verified PNG and exact exit0. Set the three approved existing executable/renderer environment paths. Retain actual PNG/manifest/source/receipt in this folder.

## Limits, cleanup and handback

No fullbuild/gate/site/browser/native run; **native pixels/exit success NOT CLAIMED**. Artifact intentionally depends on an approved host Electron runtime; not portable distribution, signing/notarization/publication. Shell negatives use real bounded processes; all unit temp fixture/evidence dirs removed and process groups killed/closed; no servers/containers/provider accounts/install/productionDB touched. No unsigned release authority granted; Kids and held-key integration remain mandatory.

**Source edits complete; all four exact authorized paths handed back to parent/serial bg-109. No further source writes by this builder after this report.** Report JSON includes file bytes/hashes, symbols, dependencies, tested-vs-deferred receipts. DR-006/GA-005/IR-07 local implementation is present; whole-product acceptance remains NOT READY pending public wiring and actual native proof.
