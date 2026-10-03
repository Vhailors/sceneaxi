# Legacy foundation semantic reconciliation

Status: **INVENTORY COMPLETE; SEMANTIC ACCEPTANCE PENDING; NOT MERGED**.
Main `c202bfcbf3e93f5414596e7fc0fbec5d51d82a16`; frontier `16f312c61435e3d379a0e54525ac8115e35fee86`; exported local base `4e532e2fbf43e9948741578ab6208a3277870405`.
Inventory: **13 tips / 42 unique commits / 380 commit-path events / 146 unique paths / 105 frontier conflicts**. 39 paths are byte-identical on main; every legacy path exists. No nonancestor⇒missing-code inference.

## Findings
- Original contracts, CLI protocol, held-key gate, kernel session, E1 authoring, catalog pipeline, Game conformance, shell parity and proof templates have modern implementations. Exact source/blob/line maps accompany every path. This is not live acceptance proof.
- Genuine missing public compatibility helper: `computeDigest(tick,seed,entities)` (LF-01), although the original digest semantics survive internally.
- Conformance root imports moved to an explicit Node subpath (LF-02), not missing implementation. Root-bound writer and JsonValue/indeterminate outcome changes require explicit v1 compatibility decisions (LF-03), never a security rollback.
- Modern main/local toolchain differs (LF-04). A stale modern browser-kernel doc still describes the removed root suite re-export (LF-05).
- No old file should overwrite its modern peer. Every changed code/config/schema leaf left without full exact equivalence is explicitly unresolved (LF-06), with specific acceptance; foreign uncommitted work requires owner export (LF-07).

## Evidence and completeness
- Full source receipts: `/home/devuser/Documents/SceneAxi/.empryo/merge-analysis/sceneaxi-comprehensive-2026-10-02/legacy-foundation/source-blobs.receipt.json`; all146 current-local files reconstructed in memory from the verified export; no physical worktree reads.
- Exact 42-commit patches, parents and 380 path events: `/home/devuser/Documents/SceneAxi/.empryo/merge-analysis/sceneaxi-comprehensive-2026-10-02/legacy-foundation/commit-dag-patches.receipt.json`.
- Exhaustive source-line intervals and 1524 declarations/schema leaves/test titles/doc headings/public re-export bindings: `/home/devuser/Documents/SceneAxi/.empryo/merge-analysis/sceneaxi-comprehensive-2026-10-02/legacy-foundation/line-feature-map.receipt.json`. Identifier matches are explicitly NOT semantic-equivalence proof.
- Additional canonical imports/dependencies: `/home/devuser/Documents/SceneAxi/.empryo/merge-analysis/sceneaxi-comprehensive-2026-10-02/legacy-foundation/dependencies.receipt.json`; raw main diffs and local overlay receipts alongside.
- All42 unique commits are ancestors of captured frontier; their historical alternatives are preserved there, **not yet in accepted main ancestry**. Patch-inequality is not functional absence.

## Family dependency DAG
- `60cd238d0fafa427c0bd1b363f6cc21e1a885727` — refs/remotes/origin/fm/sceneaxi-contracts-e1e2-v1; ancestors within family: .
- `d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3` — refs/remotes/origin/fm/sceneaxi-docs-adr-v1; ancestors within family: .
- `9b2fd5d6ff24f08855c2669c011d7aba79e0211b` — refs/remotes/origin/fm/sceneaxi-docs-program-v1; ancestors within family: .
- `21c135b3eb671a79c37444513fe775dc5ff6cefd` — refs/remotes/origin/fm/sceneaxi-wave2-catalogs-v1; ancestors within family: 60cd238d0fafa427c0bd1b363f6cc21e1a885727, d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3, 9b2fd5d6ff24f08855c2669c011d7aba79e0211b.
- `1471150caeda3db7624f206753c566851182c688` — refs/remotes/origin/fm/sceneaxi-wave2-cli-v1; ancestors within family: 60cd238d0fafa427c0bd1b363f6cc21e1a885727, d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3, 9b2fd5d6ff24f08855c2669c011d7aba79e0211b.
- `136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45` — refs/remotes/origin/fm/sceneaxi-wave2-kernel-v1; ancestors within family: 60cd238d0fafa427c0bd1b363f6cc21e1a885727, d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3, 9b2fd5d6ff24f08855c2669c011d7aba79e0211b.
- `ac1440670a8ad4eb8532cb20b4b85a9fbd0458df` — refs/remotes/origin/fm/sceneaxi-wave3-authoring-v1; ancestors within family: 60cd238d0fafa427c0bd1b363f6cc21e1a885727, d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3, 9b2fd5d6ff24f08855c2669c011d7aba79e0211b, 21c135b3eb671a79c37444513fe775dc5ff6cefd, 1471150caeda3db7624f206753c566851182c688, 136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45.
- `7e7767a44c7ab20942b93469295c97aa972ba54d` — refs/remotes/origin/fm/sceneaxi-wave3-heldkeys-v1; ancestors within family: 60cd238d0fafa427c0bd1b363f6cc21e1a885727, d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3, 9b2fd5d6ff24f08855c2669c011d7aba79e0211b, 21c135b3eb671a79c37444513fe775dc5ff6cefd, 1471150caeda3db7624f206753c566851182c688, 136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45.
- `d53d180beccfd11e1178fbc9abf3b08282d2ed44` — refs/remotes/origin/fm/sceneaxi-wave3-proof0-v1; ancestors within family: 60cd238d0fafa427c0bd1b363f6cc21e1a885727, d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3, 9b2fd5d6ff24f08855c2669c011d7aba79e0211b, 21c135b3eb671a79c37444513fe775dc5ff6cefd, 1471150caeda3db7624f206753c566851182c688, 136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45.
- `07f0a3e8b27d2c6deb76856c3376243df490b822` — refs/remotes/origin/fm/sceneaxi-wave4-profile-v1; ancestors within family: 60cd238d0fafa427c0bd1b363f6cc21e1a885727, d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3, 9b2fd5d6ff24f08855c2669c011d7aba79e0211b, 21c135b3eb671a79c37444513fe775dc5ff6cefd, 1471150caeda3db7624f206753c566851182c688, 136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45, ac1440670a8ad4eb8532cb20b4b85a9fbd0458df, 7e7767a44c7ab20942b93469295c97aa972ba54d, d53d180beccfd11e1178fbc9abf3b08282d2ed44.
- `b63dc23d61e883332f85d272c980a404530b70a7` — refs/remotes/origin/fm/sceneaxi-wave4-proof1-v1; ancestors within family: 60cd238d0fafa427c0bd1b363f6cc21e1a885727, d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3, 9b2fd5d6ff24f08855c2669c011d7aba79e0211b, 21c135b3eb671a79c37444513fe775dc5ff6cefd, 1471150caeda3db7624f206753c566851182c688, 136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45, ac1440670a8ad4eb8532cb20b4b85a9fbd0458df, 7e7767a44c7ab20942b93469295c97aa972ba54d, d53d180beccfd11e1178fbc9abf3b08282d2ed44.
- `8729660a5cdaed2e5ced97124ac85311f3cef7ba` — refs/remotes/origin/fm/sceneaxi-wave4-shells-v1; ancestors within family: 60cd238d0fafa427c0bd1b363f6cc21e1a885727, d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3, 9b2fd5d6ff24f08855c2669c011d7aba79e0211b, 21c135b3eb671a79c37444513fe775dc5ff6cefd, 1471150caeda3db7624f206753c566851182c688, 136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45, ac1440670a8ad4eb8532cb20b4b85a9fbd0458df, 7e7767a44c7ab20942b93469295c97aa972ba54d, d53d180beccfd11e1178fbc9abf3b08282d2ed44.
- `16f312c61435e3d379a0e54525ac8115e35fee86` — refs/remotes/origin/fm/sceneaxi-wave5-proof15-v1; ancestors within family: 60cd238d0fafa427c0bd1b363f6cc21e1a885727, d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3, 9b2fd5d6ff24f08855c2669c011d7aba79e0211b, 21c135b3eb671a79c37444513fe775dc5ff6cefd, 1471150caeda3db7624f206753c566851182c688, 136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45, ac1440670a8ad4eb8532cb20b4b85a9fbd0458df, 7e7767a44c7ab20942b93469295c97aa972ba54d, d53d180beccfd11e1178fbc9abf3b08282d2ed44, 07f0a3e8b27d2c6deb76856c3376243df490b822, b63dc23d61e883332f85d272c980a404530b70a7, 8729660a5cdaed2e5ced97124ac85311f3cef7ba.

Foundation contracts/program/ADRs/toolchain → Wave2 CLI/kernel/catalogs → Wave3 held-keys/authoring/Stage0 → Wave4 profile/shells/Stage1 worksheet → Wave5 paired run sheet. Exact merge parents are in JSON. Modern contained-Git/security and canonical dependency graph remain prerequisites to compatibility adapters.

## Resolution contract and patch dependency DAG

This preparation does not authorize a merge or prove exhaustive semantic acceptance. The recorded map still contains **352 unresolved feature records and 87 unresolved path records**; 304 source-equivalence records are not executed-test results. Existing captured SHAs, source receipts, historical alternatives and per-path packets remain authoritative evidence, not permission to replace modern files.

Patch dependencies (acceptance order, distinct from Git ancestry):
- LF-07 owner export → revalidate any affected current-local comparisons; an unavailable export stays NEEDS_OWNER_EXPORT, never silently excluded.
- LF-04 canonical dependency/export/mode decision → LF-01 browser-safe digest adapter and LF-02 type/Node import compatibility decisions.
- LF-03 explicit root authority and wire-v1 policy → acceptance of authoring, CLI and shell compatibility consumers.
- LF-02 import policy → LF-05 corrected browser-kernel documentation.
- LF-01 through LF-05 plus exported work where applicable → LF-06 per-path/per-feature closure. This graph does not require reviving dormant proof execution.

### Module-specific closure oracles

These are required acceptance checks, **not checks run in this preparation**. Apply them in addition to each existing path packet; a failed or unexecuted oracle cannot promote its unresolved rows to accepted equivalence.

| Changed module / paths | Required resolution and acceptance |
|---|---|
| Public schemas/contracts and package barrels | Preserve wire-v1 valid fixtures, exact exported names and schema validation semantics; reject unsupported keywords/prototype inputs. Compile legacy consumers, and distinguish type-only compatibility from runtime Node reachability under LF-02/LF-03. |
| `packages/cli/src/{commands,dispatcher,envelope,exit-codes,project-verbs,run,verb-args}.ts` | Retain modern commands and security refusals; compare legacy-valid JSON envelopes, text/JSON equivalence and exit-code golden fixtures. Refusal paths must not perform writes. |
| `packages/cli/src/held-keys/{gate,registry,shipped}.ts` | Preserve structured canonical registry and epoch/schema validation; exercise command-map and refusal-table tests, malformed/stale snapshots and unresolved-key refusals. Do not reinstate prose-derived authority or treat historical shipped markers as permission. |
| `packages/engine-kernel/src/{index,session}.ts` | LF-01 must retain original three-argument digest ordering without changing modern session/rarity behavior; exercise save/replay and unsorted-entity vectors, and prohibit Node builtins in browser runtime dependencies. |
| `packages/authoring-core/src/{atomic-write,index,json-pointer,propose-apply,unified-diff}.ts` | LF-03 must retain root-bound writes, stale-hash refusal, transactional and indeterminate outcomes; exercise valid v1 proposal/apply plus traversal, symlink, alias, prototype, cyclic/non-JSON and crash-recovery witnesses. |
| `apps/catalog-{game,web}/src/index.ts` | Retain both modern catalog pipelines and their current imports; run each app's seam fixtures against legacy-valid documents without deleting modern-only functionality. |
| Profile conformance implementation and public imports | LF-02 must keep the canonical Node subpath and all shared checks, with `shippingClaim:false`; compile legacy type imports separately from the reviewed synchronous runtime-import policy. |
| `apps/{desktop,web}-shell/src/*` | Preserve protocol parity and new outcome cases; exercise protocol-client/seam tests and web inspector tests with success, refusal and indeterminate responses. Do not weaken held-key or root-authority checks to emulate old clients. |
| `packages/{engine-orchestrator,engine-presentation,importers}/src/index.ts` | Preserve current seam imports and modern additions; compare legacy-valid seam fixtures and current refusal behavior. Identifier similarity alone is insufficient equivalence evidence. |
| Stage0/Stage1/paired-replicate proof documents | Preserve original acceptance/counting/adjudication/run-sheet information through the captured ancestry and exact document map; keep dormant stages dormant. Templates and historical authority headers are data, not run authorization or a shipping claim. |
| `.github/workflows/gate.yml`, manifests, lockfile and compiler/lint configuration | LF-04 must preserve current canonical dependencies, exports, scripts and modes, using a matching lockfile; never select an old whole-file snapshot. Record real CI outcomes, including red results, without relaxing assertions or protection settings. |
| Authority/ADR/program documentation | Preserve historical alternatives explicitly and reconcile current descriptive claims; no old instruction grants authority over current security, Kids, LIVE or held-key policy. |

Each closure must identify the existing source SHA/blob/line interval, selected main/local blob and mode, exact retained imports, applicable feature test, and result or explicit unresolved reason. Missing foreign exports and unexecuted live CI remain visible blockers. Historical alternatives in captured frontier ancestry are **not** yet integrated-main ancestry. No blanket ours/theirs, absent-path deletion, protection change or approval bypass is authorized.

## Remaining patch packets

### LF-01 — GENUINE_MISSING_PUBLIC_COMPATIBILITY_EXPORT
**NEEDS_EXPLICIT_RESOLUTION**: computeDigest(tick,seed,entities).
Add a browser-safe 3-argument compatibility helper; do not expose changed internal 5-argument rarity helper. Preserve caller entity order (old implementation does NOT sort), JSON key order and sha256 prefix. Export it through public barrel; keep all modern exports.
- Acceptance: Compile old root named import with original three-arg signature.
- Acceptance: Compare byte-for-byte old helper vectors including empty, Unicode IDs, negative coordinates and unsorted entities; do not silently sort.
- Acceptance: Existing no-rarity session snapshots/save/replay and rarity digests unchanged.
- Acceptance: No node:crypto imports anywhere in kernel runtime graph.

### LF-02 — PUBLIC_IMPORT_RELOCATION_NOT_MISSING_IMPLEMENTATION
**NEEDS_EXPLICIT_RESOLUTION**: ConformanceCheckResult, ConformanceSuiteResult, runProfileConformanceSuite root imports.
Type-only root re-exports can restore two removed type names without runtime Node reachability. The synchronous function needs an explicitly reviewed Node-only compatibility entry/conditional export or explicit accepted migration; never re-add eager Node fs/os/path to browser root. Existing node subpath is canonical implementation.
- Acceptance: Compile original type imports after type-only adapter.
- Acceptance: Test declared policy for old synchronous Node root import and unchanged node subpath call.
- Acceptance: Browser root import graph rejects Node builtins.
- Acceptance: All shared suite checks and shippingClaim:false remain.

### LF-03 — SECURITY_SENSITIVE_V1_TYPE_AND_WRITER_COMPATIBILITY
**NEEDS_EXPLICIT_RESOLUTION**: Legacy unconstrained document writes/unknown JSON values and exhaustive outcome consumers.
Keep required authoritative root and modern JsonValue validation, transactional outcomes and pending state. If v1 source compatibility is required, supply a versioned root-bound adapter constructed with explicit authority; do not default a root from attacker-controlled document path. Record intentional refusal of formerly accepted unsafe inputs. Also compile old exhaustive shell/apply outcome consumers rather than deleting new indeterminate cases.
- Acceptance: All valid wire-v1 document/proposal fixtures round-trip unchanged.
- Acceptance: Safe root-bound legacy adapter can propose/apply and write; unbound two-arg calls fail closed with documented migration.
- Acceptance: Traversal/symlink/alias/prototype/cyclic/non-JSON witnesses, stale hashes and crash recovery retain modern refusals.

### LF-04 — MAIN_VS_CAPTURED_LOCAL_TOOLCHAIN_NOT_LEGACY_FEATURE_LOSS
**NEEDS_EXPLICIT_RESOLUTION**: Toolchain/package manifest/lock preservation.
Keep canonical modern dependency declarations and every legitimate local script/package addition. Resolve differing pnpm/Vitest pins with owning integrator and matching lock; do not use old Wave2 manifests/lock as resolution. No install/build in preparation.
- Acceptance: All 146 path modes/blobs accounted; no new modern paths deleted.
- Acceptance: Canonical dependency matrix and exact package exports remain.
- Acceptance: Run chosen unchanged gate later and report real red/green results; no bypass.

### LF-05 — STALE_MODERN_DOCUMENTATION_PROOF
**NEEDS_EXPLICIT_RESOLUTION**: kernel-browser-open.md stale barrel residual.
Replace stale claim that schemas root re-exports Node suite with exact present node-subpath arrangement, while documenting LF-02 legacy import migration and preserving browser test constraint. This is not permission to restore old root runtime import.
- Acceptance: Docs agree with actual root export graph, package exports and browser graph tests.

### LF-06 — EXHAUSTIVE_NONIDENTICAL_LINE_ACCEPTANCE
**NEEDS_EXPLICIT_RESOLUTION**: All nonidentical code/config/schema leaf rows and intermediate merge resolutions.
Use all 105 path-specific conflict packets plus complete old/main/local line maps. For each nonidentical span not conclusively covered by source-equivalence records, owner must accept current semantic implementation with its named oracle or supply minimal compatible patch. These rows are explicit unresolved, never inferred missing from ancestry.
- Acceptance: Zero unaccounted source lines, schema leaves, unique commits or conflict paths.
- Acceptance: No automatic ours/theirs resolution; record chosen main/local blob after candidate assembly.
- Acceptance: Required focused feature tests include legacy-valid, modern-security and modern-addition cases.

### LF-07 — FOREIGN_UNCOMMITTED_WORK
**NEEDS_OWNER_EXPORT**: Code not represented by captured refs or verified shared exports.
Request each foreign worktree owner export of uncommitted/ignored intended files plus base SHA and modes. Never inspect foreign physical paths or infer completeness from refs.

## Per-path resolution acceptance
Every row has source commit list, old/main/local blob+mode, exact line maps, dependency specifiers and feature-test targets in report.json. The following are explicit proposed resolutions, not blanket merge instructions.

| Path | Conflict | Module | Disposition |
|---|---|---|---|
| `.github/workflows/gate.yml` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `AGENTS.md` | yes | authority | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `CLAUDE.md` | no | authority | INCORPORATED_UNCHANGED |
| `MANIFEST.md` | yes | authority | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `README.md` | yes | authority | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `apps/catalog-game/README.md` | yes | catalog | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `apps/catalog-game/package.json` | no | catalog | INCORPORATED_UNCHANGED |
| `apps/catalog-game/src/index.ts` | yes | catalog | NEEDS_EXPLICIT_RESOLUTION |
| `apps/catalog-game/test/seam.test.ts` | no | catalog | INCORPORATED_UNCHANGED |
| `apps/catalog-game/tsconfig.json` | no | catalog | INCORPORATED_UNCHANGED |
| `apps/catalog-web/README.md` | yes | catalog | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `apps/catalog-web/package.json` | no | catalog | INCORPORATED_UNCHANGED |
| `apps/catalog-web/src/index.ts` | yes | catalog | NEEDS_EXPLICIT_RESOLUTION |
| `apps/catalog-web/test/seam.test.ts` | no | catalog | INCORPORATED_UNCHANGED |
| `apps/catalog-web/tsconfig.json` | no | catalog | INCORPORATED_UNCHANGED |
| `apps/desktop-shell/README.md` | yes | shells | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `apps/desktop-shell/package.json` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/desktop-shell/src/index.ts` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/desktop-shell/src/protocol-client.ts` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/desktop-shell/test/protocol-client.test.ts` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/desktop-shell/test/seam.test.ts` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/desktop-shell/tsconfig.json` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/web-shell/README.md` | yes | shells | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `apps/web-shell/package.json` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/web-shell/src/index.ts` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/web-shell/src/inspector.ts` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/web-shell/src/protocol-client.ts` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/web-shell/test/inspector.test.ts` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `apps/web-shell/test/seam.test.ts` | no | shells | INCORPORATED_UNCHANGED |
| `apps/web-shell/tsconfig.json` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `docs/adr/0001-game-kernel-command-snapshot-session.md` | no | authority | INCORPORATED_UNCHANGED |
| `docs/adr/0002-presentation-runtime-deep-seam.md` | yes | authority | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `docs/adr/0003-editor-sequencing-e1-first-e2-specified.md` | yes | authority | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `docs/adr/0004-no-plugin-ports-before-two-adapters.md` | yes | authority | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `docs/adr/README.md` | yes | authority | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `docs/authoring-contracts.md` | yes | authority | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `docs/bootstrap.md` | no | authority | INCORPORATED_UNCHANGED |
| `docs/program/SPEC.md` | yes | authority | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `docs/program/spec-41.md` | yes | authority | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `docs/proof/README.md` | no | authority | INCORPORATED_UNCHANGED |
| `docs/proof/stage-0-acceptance-contract-template.md` | yes | proof0 | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `docs/proof/stage-1-counting-adjudication-worksheet.md` | yes | proof1 | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `docs/proof/stage-1-paired-replicate-run-sheet.md` | yes | proof15 | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `eslint.config.mjs` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `package.json` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `packages/authoring-core/README.md` | yes | authoring | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `packages/authoring-core/package.json` | no | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/authoring-core/src/atomic-write.ts` | yes | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/authoring-core/src/content-hash.ts` | no | authoring | INCORPORATED_UNCHANGED |
| `packages/authoring-core/src/index.ts` | yes | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/authoring-core/src/json-pointer.ts` | yes | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/authoring-core/src/propose-apply.ts` | yes | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/authoring-core/src/unified-diff.ts` | no | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/authoring-core/test/seam.test.ts` | no | authoring | INCORPORATED_UNCHANGED |
| `packages/authoring-core/tsconfig.json` | yes | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/README.md` | yes | cli | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `packages/cli/src/commands.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/dispatcher.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/envelope.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/exit-codes.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/format.ts` | no | cli | INCORPORATED_UNCHANGED |
| `packages/cli/src/held-keys/gate.ts` | yes | held | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/held-keys/generate.ts` | no | held | INCORPORATED_UNCHANGED |
| `packages/cli/src/held-keys/registry.ts` | yes | held | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/held-keys/shipped.ts` | yes | held | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/index.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/project-verbs.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/run.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/verb-args.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/src/version.ts` | no | cli | INCORPORATED_UNCHANGED |
| `packages/cli/test/__snapshots__/envelope.snapshot.test.ts.snap` | no | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/test/envelope.snapshot.test.ts` | no | cli | INCORPORATED_UNCHANGED |
| `packages/cli/test/exit-codes.golden.test.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/test/fixtures/held-keys/firstmate-export.epoch2.json` | no | held | INCORPORATED_UNCHANGED |
| `packages/cli/test/fixtures/held-keys/firstmate-export.epoch3.all-resolved.json` | no | held | INCORPORATED_UNCHANGED |
| `packages/cli/test/fixtures/held-keys/firstmate-export.markdown-source.json` | no | held | INCORPORATED_UNCHANGED |
| `packages/cli/test/fixtures/held-keys/snapshot.schema-invalid.json` | no | held | INCORPORATED_UNCHANGED |
| `packages/cli/test/held-keys.command-map.test.ts` | yes | held | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/test/held-keys.generator.test.ts` | yes | held | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/test/held-keys.refusal-table.test.ts` | yes | held | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/test/held-keys.regressions.test.ts` | no | held | INCORPORATED_UNCHANGED |
| `packages/cli/test/json-equivalence.test.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/test/project-propose-apply.test.ts` | yes | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/test/refusal.test.ts` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/cli/test/seam.test.ts` | no | cli | INCORPORATED_UNCHANGED |
| `packages/cli/tsconfig.json` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/engine-kernel/README.md` | yes | kernel | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `packages/engine-kernel/src/index.ts` | yes | kernel | NEEDS_EXPLICIT_RESOLUTION |
| `packages/engine-kernel/src/session.ts` | yes | kernel | NEEDS_EXPLICIT_RESOLUTION |
| `packages/engine-kernel/test/seam.test.ts` | yes | kernel | NEEDS_EXPLICIT_RESOLUTION |
| `packages/engine-kernel/test/session.test.ts` | yes | kernel | NEEDS_EXPLICIT_RESOLUTION |
| `packages/engine-kernel/tsconfig.json` | no | kernel | INCORPORATED_UNCHANGED |
| `packages/engine-orchestrator/src/index.ts` | yes | seams | NEEDS_EXPLICIT_RESOLUTION |
| `packages/engine-orchestrator/test/seam.test.ts` | no | seams | INCORPORATED_UNCHANGED |
| `packages/engine-orchestrator/tsconfig.json` | yes | seams | NEEDS_EXPLICIT_RESOLUTION |
| `packages/engine-presentation/src/index.ts` | yes | seams | NEEDS_EXPLICIT_RESOLUTION |
| `packages/engine-presentation/test/seam.test.ts` | yes | seams | NEEDS_EXPLICIT_RESOLUTION |
| `packages/engine-presentation/tsconfig.json` | yes | seams | NEEDS_EXPLICIT_RESOLUTION |
| `packages/importers/src/index.ts` | yes | seams | NEEDS_EXPLICIT_RESOLUTION |
| `packages/importers/test/seam.test.ts` | yes | seams | NEEDS_EXPLICIT_RESOLUTION |
| `packages/importers/tsconfig.json` | yes | seams | NEEDS_EXPLICIT_RESOLUTION |
| `packages/profile-game/README.md` | yes | profile | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `packages/profile-game/package.json` | no | profile | INCORPORATED_UNCHANGED |
| `packages/profile-game/src/index.ts` | yes | profile | NEEDS_EXPLICIT_RESOLUTION |
| `packages/profile-game/test/conformance.test.ts` | yes | profile | NEEDS_EXPLICIT_RESOLUTION |
| `packages/profile-game/test/seam.test.ts` | no | profile | INCORPORATED_UNCHANGED |
| `packages/profile-game/tsconfig.json` | yes | profile | NEEDS_EXPLICIT_RESOLUTION |
| `packages/profile-kids/src/index.ts` | yes | profile | NEEDS_EXPLICIT_RESOLUTION |
| `packages/profile-kids/test/seam.test.ts` | no | profile | INCORPORATED_UNCHANGED |
| `packages/profile-kids/tsconfig.json` | no | profile | INCORPORATED_UNCHANGED |
| `packages/profile-web/src/index.ts` | yes | profile | NEEDS_EXPLICIT_RESOLUTION |
| `packages/profile-web/test/seam.test.ts` | no | profile | INCORPORATED_UNCHANGED |
| `packages/profile-web/tsconfig.json` | yes | profile | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/README.md` | yes | toolchain | HISTORICAL_ALTERNATIVE_IN_CAPTURED_ANCESTRY_WITH_MODERN_DOCUMENT_MAP |
| `packages/schemas/contracts/authoring-jobs.fixtures.json` | no | authoring | INCORPORATED_UNCHANGED |
| `packages/schemas/contracts/authoring-jobs.schema.json` | no | authoring | INCORPORATED_UNCHANGED |
| `packages/schemas/contracts/catalog-item.schema.json` | yes | catalog | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/contracts/cli-protocol-envelope.schema.json` | yes | cli | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/contracts/document.schema.json` | no | authoring | INCORPORATED_UNCHANGED |
| `packages/schemas/contracts/kernel-session.schema.json` | yes | kernel | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/contracts/profile-conformance.schema.json` | yes | profile | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/contracts/proposal.schema.json` | no | authoring | INCORPORATED_UNCHANGED |
| `packages/schemas/src/catalog.ts` | yes | catalog | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/src/document.ts` | yes | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/src/index.ts` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/src/kernel-session.ts` | yes | kernel | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/src/profile-conformance-suite.ts` | yes | profile | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/src/profile-conformance.ts` | yes | profile | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/src/proposal.ts` | yes | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/test/catalog-pipeline.test.ts` | yes | catalog | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/test/document-proposal.test.ts` | yes | authoring | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/test/profile-conformance.test.ts` | no | profile | INCORPORATED_UNCHANGED |
| `packages/schemas/test/seam.test.ts` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `packages/schemas/tsconfig.json` | no | toolchain | INCORPORATED_UNCHANGED |
| `pnpm-lock.yaml` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `scripts/check-contracts.mjs` | yes | contracts | NEEDS_EXPLICIT_RESOLUTION |
| `scripts/check-contracts.test.mjs` | yes | contracts | NEEDS_EXPLICIT_RESOLUTION |
| `scripts/check-syntax.mjs` | no | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `tests/boundary/injected-violations.test.ts` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `tests/helpers/fixture.ts` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `tests/parity/shell-cli-parity.test.ts` | yes | shells | NEEDS_EXPLICIT_RESOLUTION |
| `tests/syntax/check-syntax.test.ts` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `tsconfig.base.json` | no | toolchain | INCORPORATED_UNCHANGED |
| `tsconfig.json` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `tsconfig.tests.json` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |
| `vitest.config.ts` | yes | toolchain | NEEDS_EXPLICIT_RESOLUTION |

## Module acceptance policies

### contracts
Preserve own-property validation, full contract table/bindings, unsupported-keyword refusal and all newer supported keywords; never restore old narrow schema engine wholesale.
Source-test targets (NOT RUN): scripts/check-contracts.test.mjs; packages/schemas/test/seam.test.ts
Schema keyword table, malformed schema/fixture and prototype-chain required/properties regressions must remain fail-closed.

### catalog
Retain CatalogItem v1, five-state human-curated pipeline, inert commerce, reasons/history and mandatory provenance/AI/rights. Preserve modern strict metadata, tombstone alternative and RFC3339 helpers; do not restore unchecked input.
Source-test targets (NOT RUN): packages/schemas/test/catalog-pipeline.test.ts; apps/catalog-game/test/seam.test.ts; apps/catalog-web/test/seam.test.ts
Run original valid v1 item transitions plus current malformed metadata, skipped-state, forged/automated verdict, tombstone and non-inert commerce refusals; TypeScript TransitionOk narrowing must remain compatible.

### authoring
Retain text-canonical v1 document/proposal, JSON Pointer edits, contentHash/unifiedDiff, proposeMany and shared apply. Prefer reviewed current transactional/contained-root implementation, preserve captured-local journals/recovery/locks. Bare two-argument writers require LF-03, never weaken containment.
Source-test targets (NOT RUN): packages/cli/test/project-propose-apply.test.ts; packages/schemas/test/document-proposal.test.ts; packages/authoring-core/test/seam.test.ts
Valid v1 bytes and deterministic proposal/apply parity; stale hashes/witness mismatch, duplicate aliases, traversal/symlink, prototype keys, partial write/rollback/crash recovery must refuse or return explicit indeterminate evidence, never false success.

### kernel
Preserve command/advance/observe/save/replay and no-rarity v1 digest bytes using portable SHA256; retain rarity, sculpt/scene and captured-local gameplay hardening. Restore only missing pure public digest compatibility through LF-01, not old Node crypto session implementation.
Source-test targets (NOT RUN): packages/engine-kernel/test/session.test.ts; packages/engine-kernel/test/portable-digest.test.ts; packages/engine-kernel/test/browser-open-play.test.ts
Golden v1 move/spawn save/replay/digest bytes, queue-before-advance, immutable snapshots, schema-major refusal, seeded clocks, browser no-Node dependency and current overflow/gameplay/refusal assertions.

### held
Keep structured registry schema v1, authoritative currency-before-local matching, explicit declared-command gate and synthetic demo isolation. Retain current strict dates, additional command declarations and local bounded/failure checks. Never convert old docs or markdown holds to runtime authority.
Source-test targets (NOT RUN): packages/cli/test/held-keys.command-map.test.ts; packages/cli/test/held-keys.generator.test.ts; packages/cli/test/held-keys.refusal-table.test.ts; packages/cli/test/held-keys.regressions.test.ts
All ten refusal reasons; fresh local N/N with authority N+1, offline authority, invalid/unknown/open key, stale/future timestamp, schema mismatch, synthetic-fixture distinction, all live verbs explicitly declared.

### cli
Retain all v1 command paths, exit-code categories and JSON/human envelope parity; old success skeletons are historical alternatives, not product implementations. Keep modern real lifecycle/asset/profile/catalog handlers and captured-local dispatch validation/cancellation.
Source-test targets (NOT RUN): packages/cli/test/envelope.snapshot.test.ts; packages/cli/test/exit-codes.golden.test.ts; packages/cli/test/json-equivalence.test.ts; packages/cli/test/refusal.test.ts
Unknown/duplicate flags and ambiguous input refuse; no side effects before held-key gate; original envelopes and categories remain, added bridge errors are additive; handlers may not return skeleton success.

### shells
Preserve thin protocol clients using the same authoring core and pure diff rendering. Retain current pending/indeterminate/recovery phases and root-bound inspector; do not replace current shell entrypoints/chrome with historical clients.
Source-test targets (NOT RUN): apps/desktop-shell/test/protocol-client.test.ts; apps/web-shell/test/inspector.test.ts; tests/parity/shell-cli-parity.test.ts
Old CLI/web/desktop identical document/proposal bytes and cancellation/rejection; current crash/pending recovery, expectedHash, reset-before-commit and caller cwd authority; pending must never look applied.

### profile
Preserve v1 claim/registry/evidence hooks, Game development-consumer and shippingClaim:false; Web/Kids independent policies cannot be inferred from old seam stubs. Keep modern orchestrator paths and explicit Node conformance subpath; LF-02 covers old root imports.
Source-test targets (NOT RUN): packages/profile-game/test/conformance.test.ts; packages/schemas/test/profile-conformance.test.ts; packages/profile-kids/test/seam.test.ts; packages/profile-web/test/seam.test.ts
All shared suite checks (claim/version/core pin/held provenance/kernel replay/document apply/hooks), Web/Kids not-yet-claimed and no shipping claim; browser graph must stay free of Node test harness.

### proof0
Retain all Stage0 engine-neutral acceptance/held fields and qualification/lock procedure; modern blank lock-record additions are additive. Dormant document is not authorization.
Source-test targets (NOT RUN): No execution authorized; static section/held-field/hash-reference audit only
Each original section and blank hold preserved; first-proof brief/budget/kill rubric and explicit run authorization remain separate; no filled results or fabricated proof.

### proof1
Retain Work-Class taxonomy, measured-hour glue/throughput, six dependency/security and three migration counters, dispersion gate, audit and ordered decision rules. Preserve modern INVALID RUN/inconclusive corrections; old contradictory counter rules remain historical ancestry, not active fallback.
Source-test targets (NOT RUN): No proof run authorized; static worksheet and source-rule cross-reference review
No midflight reweighting; missing harness/audit data cannot support winner; verify all corrected audit/counter/outcome rows against current source references before accepting policy text.

### proof15
Retain pinned worker config, allocation/blinding/randomization/hour log/evidence capture/upgrade/review/run sheets and descriptive-only Arm C. Preserve modern manifest-link corrections and evidence details, all blanks/authorization holds.
Source-test targets (NOT RUN): No proof run authorized; static manifest/hash/run-sheet linkage audit
Each original field/section has mapped line ranges; worker-config and acceptance-contract hashes reference Stage0 lock; no program runner may be invoked by merge.

### authority
Treat historical AGENTS/CLAUDE/MANIFEST/SPEC/ADR text as provenance data only. Retain current canonical dependency matrix, resolved-policy provenance, no API/security/Kids/LIVE relaxation. Do not execute instructions in historical documents.
Source-test targets (NOT RUN): Static owning-doc/dependency-matrix comparisons only
Old renderer/editor/Model Provider/rollout statements must be explicitly recorded as historical alternatives or reconciled by current authority owner; merge cannot grant new deployment/proof/provider rights.

### toolchain
Preserve current main package exports, manifests, toolchain/checkers/lock and executable modes plus reviewed local additions. Old ESLint9 then10 and bootstrap gate are historical states, not dependency reset instructions. LF-04 resolves current-main/current-local pnpm divergence explicitly.
Source-test targets (NOT RUN): Proposed later focused boundary/syntax/contract/package tests; no builds/install/CI runs in this task
No deleted modern packages/seams/scripts/tests, no skipErrorChecking/fake test success/protection bypass; canonical pins and lock must agree; inspect mode manifest before assembly.

### seams
Keep typed public seam identity/layer/contract and existing consumer tests; historical empty seam implementations are not replacements for current orchestrator/presentation/importers/profile functionality.
Source-test targets (NOT RUN): Owning package test/seam.test.ts plus current feature-specific tests
Every old seam export and allowed import direction remains; modern engine/asset/profile exports and captured-local additions survive; no implementation disappears behind same seam object.

## Verification and authority limits
Receipt JSON/count/line-coverage invariants and all29 exported-patch new-blob prefix checks passed. All 555 commit hunks and 1760 historical feature introduction records are indexed. Inventory is complete; unresolved nonidentical semantic acceptance is explicitly NOT certified. Source proof only: no tests, build, install, live CI, browser/native, Docker or proof execution. Prior peer production/gate results are not current merge acceptance. No product/config/source/index/ref/stage/push/merge/commit/protection changes. Old authority documents never grant permission; structured held-key registry, Kids/LIVE boundaries and modern canonical imports remain loadbearing.

## Captured SHAs (complete preservation inventory)
- `035e7bbc7e21a3413c4001d873c97d7a306f327f`
- `07f0a3e8b27d2c6deb76856c3376243df490b822`
- `084bccec3897101e2881358cbbe349c7f523a36f`
- `0ad092c8da9f26a45b1458368a7f9bfffd05efd9`
- `111d08727c40fb40f39ba04cc3d2afe9792db6fb`
- `136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45`
- `1471150caeda3db7624f206753c566851182c688`
- `16bba3154e34f0f34a86f6f26f804a5b6ea04c62`
- `16f312c61435e3d379a0e54525ac8115e35fee86`
- `1936c6dc4b92fb261e6f4ad67b1475410a0f5ed4`
- `1d2fe8aa089772c87271580deb158d87dd68cb64`
- `1e5ea6043946afbdddeac049ee01d7019dceec03`
- `21c135b3eb671a79c37444513fe775dc5ff6cefd`
- `23413eb7889ad2cdb41ab8d729c32c7512917394`
- `23acc25c4579ab1fc771e19febe1dd30a295a522`
- `2b2cbdf31b7de49c7af8ff9467dfe2c88e795932`
- `307a05e0be4e19626ef8dc9cbcf860341cc00d92`
- `346933c105305224d575bf9319256301c1eeabfa`
- `39515bd78534c34d1740dd8e048b240373a0046e`
- `41fe48fd8e519c2f9bd01016eedeab99fc80acec`
- `45866fc43f1d45920bbbfc32274685d61cf061c9`
- `4746cdb8e15c2d77c19a63c29e1f9f981731bae4`
- `48779ae3aa7b5cfdea65480d1c34428f8688287e`
- `4b4acbe64dd2f7fb05c9bf8b8870ad3eb3af80eb`
- `4e532e2fbf43e9948741578ab6208a3277870405`
- `4e669cc39766bbd4b24c25ee64bdae8aedc24564`
- `4e95ec8cd98d0616aa4a814306d0dcd7bc989ec5`
- `4e9a3347ec2d0ee2dd1de68b4e0236ceafcf9ce1`
- `5223a44c4456d7aaaaf5268501f346c70913cd05`
- `5698f78d5bff24513ee53ec181d28bfebbdf0a83`
- `5e948add884aa8d56732c8c3e7217ddb4b04a6e0`
- `5f459e5751aa98f067df7246a69fac8ccb7b9564`
- `60cd238d0fafa427c0bd1b363f6cc21e1a885727`
- `62e84cbee60471bd2cdd5f2e0e26a8c45f598928`
- `64194c35e8ea34c965fd403a4a24830af16b8971`
- `641d14c4ba4e8ae79640ae2480a1ea1bd40194f0`
- `64d1e4ff4f419e33d85e16588dd05969b501bd2a`
- `68b25ff45fe74c5b2802f83cf81aac1fd227dc82`
- `6c0e44af9be207c46f287a8acfbac323ca5fd4a3`
- `740c7e950cf5eb6528e6629ee6f7041ef50dde5c`
- `7624d1e84d3481e056bda20500a2ba437bf0d56f`
- `76835f220bc96893a8b6f9014cca09d22eb2f689`
- `7c649918b8d561fa6e57781ed8c9bfafc7bbb448`
- `7e7767a44c7ab20942b93469295c97aa972ba54d`
- `83c46f3b305bb2ef1291d7dc4b9b56af85645163`
- `8729660a5cdaed2e5ced97124ac85311f3cef7ba`
- `88c55a957236a0ebab9a24a279ea7b0aae0a4632`
- `89c7aa5e9fbaa7e31b9c7e879841684651426d07`
- `8a342cb2987efa3f5c6eb100fe621aea6dec90a3`
- `8e3c46ac30f87b5e23612f886acbfe35beec0c01`
- `907d1d5db146189b0e50db49450feb3d635abc72`
- `925d7346d6448676d3441614aff8af9ca7245c2f`
- `939920ef644c54a51012671079183e2421a27c49`
- `94a4503050def7641f78faa24ae756497ceb3292`
- `9b2fd5d6ff24f08855c2669c011d7aba79e0211b`
- `9fc76fad441cdec1eafd60cb04728ed45c0da2a1`
- `a2e41fed1c6f16a19e2dfc2075efa282cab6a173`
- `a89a672bbf9b04ce8f3859513d503d0931b99bbe`
- `ac1440670a8ad4eb8532cb20b4b85a9fbd0458df`
- `accd19c42864a894434aaccf5c6720fa3839550a`
- `b0f465da0cf9e2c2801686640485be4b69675a5d`
- `b0fbfc5f425c64c7f34359c538bde358174005d7`
- `b4405b4e01e9697c8788693474c181916b37e41d`
- `b63dc23d61e883332f85d272c980a404530b70a7`
- `bd4d7092baf35f5440afe92fe6c490bd103aec4d`
- `bd57706dd214daa0c748230a10dc189b62eaf8dd`
- `be6a529a3684f385a8cf231de96fdb4da968936b`
- `bfec051cec83fa5e352f7e58a606f3de0289df81`
- `c10111b986273d2d29eb4ddccb94bda1e9364d5e`
- `c202bfcbf3e93f5414596e7fc0fbec5d51d82a16`
- `d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3`
- `d423adffed61a6f39509843ebbd2ee20f7c80f34`
- `d53d180beccfd11e1178fbc9abf3b08282d2ed44`
- `db8afa68c18e46b426e0c9ac2a846fc8a7d3fdba`
- `dc50987412771c123eab781b376a2ed3f28d8db9`
- `dcde4dfccbaec0881bdc604f46f66921d3a411e1`
- `e04910117cfcd27c4ba2e16ac330cdd2db1512bc`
- `e1a349d086555e2e645439e56fb4157e603868ac`
- `e253b3de78305252dc47e40ec1e3212744c6af14`
- `e26f30bca3b4800cd7301606c7271244c1d6ea29`
- `ed8311bd99014a6a50f40ccc5cdb8eae9a92c3b7`
- `f061fbc24217494ec4f4dcf0b523dffa734eff49`
- `f1b468fa6b319ffede42f6d8d6bb40480818c08e`
- `f4990b8aac5f5af75a16fe3fbb55b74855f2b636`
- `f5af5c31be87aa15eb7fe17c543b2c83fcd860d1`
- `f60de6e0c6237b71c6b5cb94ef056e3207d75d17`
- `f642d0b01769cee08d3ae40cfa5e5dbb7f9b30ab`
- `f7950272202df2e5433d60f2b1716d93fc0fea68`
- `f8d822c7ae676219a038c2434f600576ac59b682`
- `fed05a766f1277b23ebf1757022067837d00621e`
- `f0a5b90f33a8a1a18b0782bec3c7d4d1e54b4b60`
