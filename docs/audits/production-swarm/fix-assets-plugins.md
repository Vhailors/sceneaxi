# Assets/plugins implementation outcome

Graph `sceneaxi-production-swarm`; node `fix-assets-plugins`; role `code`.
Real root/cwd `/home/devuser/Documents/Projects/sceneaxi`; HEAD rechecked as `4e532e2fbf43e9948741578ab6208a3277870405`.
**PARTIAL — local regression acceptance passes; full production is not attested.**
Machine-readable per-item outcomes, commands, failed attempts and exact shared requests: `fix-assets-plugins.json`.

## Implementation and ownership

The retry began with this lane's source/test implementation edits already present in the shared checkout, contrary to the retry's zero-edit description. They were preserved. This retry added explicit malformed node-count refusal, stronger named refusal/alias assertions, full 16×8 MiB/count17 and triangle250000/250001 capacity oracles, and32 unchanged plugin reloads per fixture. Other lanes' existing work was not changed.

- `packages/importers/src/contained-gltf.ts:1098` — `parseGltf`: iterative deterministic traversal,4096 nodes, depth256 (root0),8192 work bound; malformed resource refusal. Indexed shared vertices remain admitted triangles; only unindexed primitives require triplet vertices. Destination inspection refuses lexical regular/dangling symlink aliases before canonicalization and rechecks before copy rename. Strict base64 uses length/alphabet/roundtrip rather than stack-exhausting repeated-group regex.
- `packages/importers/src/index.ts:104` — `withinDocumentBudget`, `deepFreeze`, `proposeSceneDocumentImport`/`applySceneDocumentImport`: external input8 MiB/depth64/250000 values before recursive shared services; iterative immutable output.
- `packages/plugin-host/src/isolation.ts:923` — `inspectModuleGraph`: fingerprints exact inspected bytes and package metadata.
- `packages/plugin-host/src/pipeline.ts:433` — `processCandidate`: immutable per-process module identity reservation before awaiting import; changed graph refuses with restart guidance; post-evaluation changes expose no implementations. This is trusted-code lifecycle integrity, **not a sandbox**.
- Owned regression files: `packages/importers/test/contained-gltf.test.ts`, `packages/importers/test/document-import.test.ts`, `packages/plugin-host/test/seam.test.ts`.

## Per-item disposition

| Task | Result and evidence |
| --- | --- |
| AP-01 | LOCAL ACCEPTANCE PASS: deep2500/cycle/multiple parents/count4097 public tests and actual spawned CLI; each CLI exit2 VALIDATION/ASSET_IMPORT_MALFORMED, no proposal or document writes. Audit E6/E8 previously observed RangeError/INTERNAL exit1. |
| AP-02 | LOCAL ACCEPTANCE PASS: indexed4-vertex square import/apply/materialize/reload retains exact bytes/digest; unindexed4/nontriplet/out-of-range controls refuse. Audit E7 failed before. |
| AP-03 | LOCAL ACCEPTANCE PASS:32 unchanged reloads per fixture deterministic; entry/helper/package mutation refused across hosts; old state cleared; post-evaluation mutation exposes nothing. Fresh Node process adopts edited helper value2. Audit E8 exposed stale cached code before. |
| AP-04 | IMPORTER ACCEPTANCE PASS; SHARED REQUEST OPEN: public propose/apply resource refusal without mutation and exact supported limits pass. Direct shared schema callers still require integration-owned bounded validator. |
| AP-05 | LOCAL ACCEPTANCE PASS: initial/reload/recovery aliases refused; unrelated/outside/document bytes/link retained. Controlled copy-time symlink race cleans only owned temporary copy; metadata denial fails closed. Audit E5 previously overwrote unrelated file. |
| AP-08 | ADDITIONAL LOCAL DEFECT FIXED: baseline regex independently throws RangeError on8 MiB canonical base64;16×8 MiB public manifest reparse now passes with strict canonical roundtrip. |
| AP-PERF | PARTIAL: byte/accessor/node/triangle/count limits and limit+1, repeated plugin loads, controlled copy race/metadata failure proven. Exhaustive races/cancellation/event-loop responsiveness and cross-OS faults remain coverage holes. |
| AP-06 / CAT-DURABLE-INTAKE | Routed to assigned sites-ui/integration exact owners; their files not overwritten. Not claimed complete by this node. |
| AP-07 / SCOPE-UNTRUSTED-PLUGINS | Trusted explicit local boundary retained; permission/version/unknown capability/entry escape controls pass. Untrusted execution remains an intentional full-product gap. |
| COVERAGE / CORE-008 | Local regression proof extended; serial shared gate and native acceptance still required. |
| CAT-001..004 | Existing bounded audit proof retained, current contracts rechecked; durable intake/legal/provenance/activation evidence remains with owning lanes and genuine external inputs. |
| GATE-MARKETPLACE | Genuine external blocker: licensed inventory/provenance/AI disclosures; legal curator/moderation/takedown owner/policy; approved durable delivery; real entitlement/payment evidence; held-key resolution and separate activation authority. |

## Verification

All commands used the real root above. Existing project tool returned `No test command detected`; routing recovered using existing pnpm commands, without config/check changes.

1. `pnpm exec vitest run packages/importers/test packages/plugin-host/test tests/e2e/asset-ingestion-golden.test.ts tests/e2e/asset-pipeline-golden.test.ts tests/e2e/importers-plugin-golden.test.ts tests/e2e/plugin-capability-golden.test.ts --reporter=verbose` — exit0, **10 files /120 tests passed,0 failed**. Public assertions cover canonical copies, review/reload, malformed/escape/budget/plugin refusals and deterministic output; not just process exit.
2. `pnpm exec tsc -p packages/importers/tsconfig.json --noEmit` and equivalent plugin-host — final exit0 each. An intermediate importer check encountered concurrent foreign `three-sculpt.ts:451` TS7006 parameters `t,i`; reported upstream, left untouched, final check passes.
3. `pnpm check:boundaries` — exit0,27 packages. `pnpm check:contracts` — exit0, existing locked contracts/one reviewed plugin capability/fixture commerce and Kids policy checks. `git diff --check -- packages/importers packages/plugin-host` — exit0.
4. Owner-scoped `pnpm exec tsc -p packages/importers/tsconfig.json` and plugin-host — exit0 before actual binaries. No competing full-tree build.
5. Inline Node public fixture plus **actual** `packages/cli/bin/sceneaxi.mjs asset import --json` spawn — exit0 oracle; four child exit2 refusals with unchanged document/output absence.
6. Inline public `openPluginHost` plus fresh-process spawn using existing `scripts/workspace-dist-resolver.mjs` — exit0, changed helper refused/old state cleared; new process implementation2 admitted.
7. Baseline8 MiB repeated-group regex oracle — exit0 reproducer asserting `RangeError: Maximum call stack size exceeded`; patched public capacity regression passes.

Capacity observations from final complete focused suite on Linux x64 /Node v24.21.0:16×8 MiB plus count17 **5939 ms**; triangle250000/250001 with repeated deterministic calls **533 ms**; worker peak RSS **855960 KiB**. RSS is a suite worker high-water mark, not an isolated importer footprint/SLA. No responsiveness or cross-platform claim. `/usr/bin/time` was absent (exit127); Node performance/resourceUsage recovered measurement. Initial JSON extraction failed on ANSI output (exit1); corrected extraction then independently completed the120-test suite.

## Exact integration requests and remaining proof

- **SR-01:** `packages/schemas/src/document.ts` `isJsonValueInner`: replace recursive descent with bounded iterative validation preserving finite numbers, ancestor-cycle/accessor/plain-prototype semantics; choose shared normative depth/value limit; add direct depth7000 refusal and supported/cycle/accessor/prototype/duplicate tests in `packages/schemas/test/document-proposal.test.ts` and `unambiguous-json.test.ts`. Importer local limits must not accidentally cap accumulated16×8 MiB asset manifests.
- **SR-02:** `docs/asset-ingestion.md`, `docs/plugins.md`, owning package READMEs: document graph/document budgets, named refusal and process-restart plugin lifecycle; retain explicit trusted/non-sandbox language; refresh dated claims against current evidence.
- **SR-03:** AP-06 shared catalog query/search/filter/sort and mirrored storefront accessibility remain sites-ui/integration's exact assigned paths.
- **SR-04:** durable quarantine/intake/store/restart proof remains sites-ui/integration; absent configuration must retain `CATALOG_INTAKE_STORAGE_UNAVAILABLE`.
- **SR-05:** integrate persistent spawned-bin graph/indexed-square controls into shared CLI/asset goldens; independently run unchanged full gate and native picker/packaged desktop acceptance after serial integration. Integration alone updates dated backlog and `FINAL.md`/`FINAL.json`.

No dependencies, format profiles, matrix edges, capability IDs, held keys, Kids/LIVE behavior or external authority widened. No secrets, provider calls, spend, production mutations, commits/push/deploy/publish. Owned fixture roots removed via afterEach/finally, simulated hooks reset, only owned copy temporary files removed; generated owner dist retained. No stash/reset/clean or unrelated deletion.
