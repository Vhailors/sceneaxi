# Serial integration — three bounded rounds, production PARTIAL

Graph `sceneaxi-production-swarm`; role `code`; real root `/home/devuser/Documents/Projects/sceneaxi`. HEAD rechecked `4e532e2fbf43e9948741578ab6208a3277870405`. Existing shared-checkout changes preserved. No clean-tree claim, commits, push, deployment, publication, new spend, account creation or production data changes.

**Local completion acceptance: NOT MET.** Green local checks do not establish zero full-production gaps. Round 1 failed the judge's traceability/Windows/command assertions. Round 2 reproduced and repaired browser origin acceptance, then exposed a native browser-readiness flake after earlier successful packaged runs. Round 3 repaired readiness and independently repeated applicable gates. Stop automatic repair looping at three rounds; outstanding local work is not relabeled external.

## New source fixes in this retry

- `sites/umbrella/playwright.config.ts:40` — pin the nonsecret verifier deployment origin. Before: 6 browser tests passed, one expected `IDENTITY_PLANE_NOT_WIRED` but received `SITE_REQUEST_CROSS_ORIGIN`. After: seven unchanged tests pass, including hostile/missing-origin refusals. Runtime origin protections remain unchanged.
- `desktop/linux/src/electron/main.ts:992` `browserUiOpen` — wait for the actual admitted asset option, idle state and enabled controls before native selection. Before: selected/opened false, frame null. After: current runtime and three fresh packaged runs pass all existing frame/digest/byte/security predicates. No timeout widening, assertion weakening or blind retry.
- `desktop/linux/README.md:99`, `docs/desktop-linux.md:21`, `docs/desktop-local-bridge.md:58` — read-only Local Ask, staged Build with explicit approval, provider-specific readiness, core containment, local raw-dump consent and remaining privacy/native acceptance.
- `MEGALIST.md` / `MEGALIST.json` — retain historical mappings/counts while recording final bounded evidence; no automatic backlog closure.

Prior schemas/gameplay, migration 0008, GUI fixtures, pricing/receipt, API-generator staging, manifest and other builder repairs were already present. They were preserved and exercised, not attributed to this retry.

## Independently executed commands and bounded assertions

All command cwd was the real application root. `project(test, absolute path)` reported no command detected; exact existing pnpm scripts were then executed through shell, not skipped or reconfigured. Each serial command had a 180–600-second bound.

| Command | Exit / receipt | Meaning |
| --- | --- | --- |
| `pnpm gate` | 0; `integration-pass-3-gate.log` | All existing syntax/boundary/contract/traceability/site/desktop/publish-ready/build/test/lint stages; 282 Vitest files, 4,297 tests. |
| `pnpm test:golden` | 0; `integration-pass-3-golden.log` | 57 files, 539 tests, existing positive/refusal assertions. |
| `pnpm build:sdk` | 0; `integration-pass-3-sdk.log` | Pinned SDK generation; not publication or external declaration-consumer proof. |
| Four `pnpm --dir sites/<site> build` | all 0; `integration-pass-3-build-*.log` | Umbrella, catalog-game, catalog-web, Kids actual production builds and existing postbuild packaging checks where defined. |
| `pnpm docs:api` | 0; `integration-pass-3-api.log` | Existing transactional staged generator, checked TypeDoc; no skip-error flag weakened. |
| Umbrella `test:provider` / `test:integration` | 0 / 0; pass-3 logs | 24 provider tests and seven PGlite persistence tests; not real network/provider/PostgreSQL-race acceptance. |
| Umbrella lifecycle/project-persistence Vitest files | 0; `integration-pass-3-identity-persistence.log` | 13 tests; missing identity-builder report remains missing. |
| Umbrella `test:visual` | 0; `integration-pass-3-browser.log` | Seven real Chromium responsive/focus/contrast/origin tests against Next dev; not entitled-provider success. |
| Production browser observations | successful; `integration-pass-2-production-browser.json` | 16 route/viewport observations over four rebuilt production servers, landmarks/focus/no horizontal overflow/no page errors, screenshots retained. Provider identity explicitly absent. |
| CLI/socket/lifecycle focused suites | 0; `integration-pass-2-cli-socket.log` | Six tests: real CLI/socket shared propose/apply persistence, permissions/refusals, migration inspection and contained Git preparation. |
| Engine browser production proof | 0; `integration-pass-2-engine-browser.log` | 100 resource cycles, actual checker/animation/effect pixel deltas, context loss/restoration, terminal texture count zero; trusted gesture and AudioContext cleanup. SwiftShader, not physical GPU/audibility proof. |
| Linux typecheck / browser and tier tests | 0 / 0; pass-3 logs | 39 tests after native readiness edit. |
| Linux runtime smoke / `dist` / three packaged smokes | all 0; pass-3 Linux logs | Real New/Open, transforms, exact Save/reopen bytes, browser refusals, staged assistant output, contained Web export and Three frames; local unsigned/unpublished artifacts. |
| PNG validation | successful; `integration-verification-receipts.json` | 18 retained images including runtime/packaged 1280×900 PNGs; signature/IHDR/hash, not screenshot-content proof alone. |
| Umbrella typecheck / `git diff --check` | 0 / 0 | Types/whitespace only. Matrix unchanged, TS 5.9.3 pin retained; tracked diff secret-shape scan zero matches, limited heuristic. |

## Failures retained rather than hidden

`integration-pass-2-browser.log`: exit 1, 6 pass / 1 fail, same-origin identity verifier mismatch. `integration-pass-2-linux-runtime-final.log`: exit 1, project browser selected/opened false and frame null. Expected negative CSP messages are not the diagnosed readiness failure. Temporary runtime PNGs were removed by subsequent dist/test rebuilds; an initial copy/hash command failed, then runtime was rerun and final images copied durably before packaging. No nonexistent-image acceptance is claimed.

## Final accounting and remaining work

`FINAL.json` contains 24 audit/builder node outcomes, all 307 synthesis/mapping task rows, all 90 backlog mappings, 109 requirement mappings and 148 remaining gap rows. These include 113 local final-acceptance rows, 22 external-input rows and 13 intentional-full-production gaps. The 159 other rows are historical bounded/mapped records, **not independently certified production closures**. All eleven builder reports are inherited claims; the identity builder report is absent. Every criterion/fix/dependency is retained. No historical backlog status was silently changed.

The remaining local grouped gates include gameplay/audio/posed-physics host wiring, contained textures/imported animation, actual PostgreSQL migration/reservation/quota/race/restore verification, authenticated member history and HTTP commerce paths, exhaustive native IPC/privacy/new-command proof, emitted consumer types, aggregate capacity/soak and full changed-path/accessibility review. Provider/legal/signing/operations/hardware inputs are separate genuine external gates. Exact requests and full per-root lists are in `FINAL.json` and `FINAL.md`.

Prior judge artifacts remain untouched; no post-round-3 independent judge verdict is invented. Full semantic review of every prior diff/report/source is not attested, and the user's zero-local-outstanding acceptance has not been achieved. **PARTIAL; not full production-ready.**
