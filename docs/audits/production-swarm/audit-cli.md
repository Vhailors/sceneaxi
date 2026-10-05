# Independent CLI production audit

Graph `sceneaxi-production-swarm`; node `audit-cli`; role `code`; real root `/home/devuser/Documents/Projects/sceneaxi`; baseline HEAD `4e532e2fbf43e9948741578ab6208a3277870405`.

**Audit PASS (required inspection/front-door evidence complete), integration FAIL (four reproduced local defects plus stale guidance), full-production PARTIAL.** Audit PASS does not mean production-ready. Source was read-only. Only this report and `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-cli.json` are written. No commit/push/deploy/publish/spend/provider account/production data mutation or fabricated legal/signing/authority proof.

Read `/home/devuser/Documents/Projects/sceneaxi/AGENTS.md`, relevant `/home/devuser/Documents/Projects/sceneaxi/docs/agents/layout.md` CLI/boundary sections, runnable surfaces, production activation, held-key protocol, dated September gap list, current backlog, baseline and decision log. No local CLI AGENTS.md/EMPRYO.md found; baseline also records no ancestor EMPRYO.md. Baseline cleanliness is baseline owner's observation, not inferred from this lane's later report-bearing tree.

## Evidence and scope

All commands used Empryo shell with cwd `/home/devuser/Documents/Projects/sceneaxi`, Node `v24.21.0`, pnpm `9.15.0`, Linux x86_64. Each actual binary child used absolute `/home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs`, JSON output, and bounded timeout. Isolated temporary projects were removed; no existing user project was changed.

| Executed command/boundary | Exit and actual assertions | Coverage limit |
|---|---|---|
| `pnpm exec vitest run packages/cli/test --reporter=dot` | 0; 17 files / 214 tests, 3.33s | Existing tests do not cover the discovered parser/freshness/help edges |
| `pnpm exec vitest run packages/cli/test tests/e2e/cli-golden-path.test.ts tests/e2e/asset-pipeline-golden.test.ts tests/e2e/asset-ingestion-golden.test.ts tests/e2e/desktop-cli-local-bridge-golden.test.ts --reporter=verbose` | 0; 21 files / 233 tests, 13.89s | Local golden transports; not a production/native/provider claim |
| Actual built binary top-level help/version; every one of 21 shipped verb help paths | Each 0 and schema1 JSON | Help alone does not establish operation success |
| Every one of 21 verbs with `--audit-unknown` | 20 give exit2 `UNKNOWN_FLAG`; synthetic `demo gated` gives exit3 `HELD_KEY/currency-unavailable` first | Intentional gate-before-argument refusal, not a defect |
| Actual project new/dev/test/propose/apply/capture/report/evidence list | Named successes; capture list packetCount1; overwrite and repeat stale proposal exit1 `CONFLICT` | Generic documents are not automatically openable composed scenes |
| Actual scene compose from existing sculpt fixture seeds8001/8002 | 0; 2 artifacts / 3 instances; digest `sha256:f9252322ad9f81adf0a7340cd218ae85af60801e0d3602f5a59a5f922f26e500`; outputs written | Offline bounded composition, no general-E2 proof |
| Actual asset import → apply → stable-id reload → apply | All 0; `asset-import-proposed` / `asset-hot-reload-proposed`; materialized glTF bytes equal source before and after | Uses composed-scene document, not blank generic document |
| Actual asset/catalog list with required `--dir .`, profile list/open-path, bridge tools, protocol inspect | 0; empty catalogs truthful; bridge tool inventory67 | No commerce readiness or live session inferred |
| Actual Kids profile `open` policy request | 2 `VALIDATION`, details `OPEN_PATH_KIDS_REFUSED` | Shared Kids path remains refuse-only; no dedicated Kids-origin audit here |
| Actual missing/insecure discovery descriptor and wrong bridge permission | Missing/insecure exit1 `BRIDGE_UNAVAILABLE` with exact named discovery reasons; mismatched `--allow` exit2 `VALIDATION` | No genuine packaged host connection claimed |
| Actual malformed paths/JSON/valued boolean switches | Normal cases exit2 schema1 named envelopes, empty stderr | CLI-001/002 expose exceptions below |
| Public exported gate with existing synthetic fixture | Ordinary stale/offline/NvsN+1 refuse; four malformed freshness inputs allow (CLI-003) | Not an accessible shipped-binary production hold bypass |
| Ten real binary `protocol version --json` startup samples | Each exit0/schema1; min156.14ms, mean179.19ms, max204.11ms | Informational sample only, no throughput/SLO/large-input claim |

The root gate was executed by baseline, not repeated or claimed as this lane's own result. No checks were disabled/skipped; no lint suppressions/matrix changes. No new stack/API was introduced. Existing API helpers were reused for fixture construction. Builder after-fix verification must rebuild dist before running binary oracles.

### Every current runnable verb

`project new`, `project dev`, `project test`, `project capture`, `project report`, `project propose`, `project apply`; `scene compose`; `asset list`, `asset import`, `asset reload`; `profile list`, `profile open-path`; `catalog list`; `evidence list`; `desktop bridge call`, `desktop bridge status`, `desktop bridge tools`; `demo gated`; `protocol version`, `protocol inspect`.

`ROOT_COMMANDS` and `SHIPPED_COMMAND_MAP` coverage tests pass. Every actual verb help/unknown-flag boundary was driven; successful admitted operations or intentional unavailable-transport/gated refusals were driven. `parseArgv` rejects valued boolean switches but has the version shortcut defect. `dispatch` is protocol-consistent for ordinary errors but has inherited-property traversal. `evaluateHeldKeyGate` preserves authoritative currency ordering, but does not establish valid freshness for all injectable runtime values.

## Confirmed findings: route back to CLI builder

### CLI-001 — HIGH — inherited command names escape protocol

- **Source/symbol:** `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts:273` `walk`; plain object command children created in `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/commands.ts:106` `group`.
- **Reproduce:** `node /home/devuser/Documents/Projects/sceneaxi/packages/cli/bin/sceneaxi.mjs constructor x --json`; also `project __proto__ x --json`.
- **Observed:** exit1, empty stdout, raw stderr `TypeError: Cannot read properties of undefined (reading 'x')` and source stack paths.
- **Impact:** unknown input bypasses the expected schema1 `UNKNOWN_COMMAND`/exit2 diagnostic. No mutation or held-key bypass observed.
- **Refutation:** ordinary unknown command refuses correctly; both root and nested inherited-name repros fail on the real built binary. It is not a fixture-only or stale-doc allegation.
- **Owner/dependencies/fix:** CLI builder owns dispatcher + refusal/bin-smoke tests; no shared change needed. Use own-property lookup at every depth, not inherited `children[segment]` access.
- **Acceptance:** rebuild, test `constructor`, `__proto__`, `toString` at root and every group depth; all must exit2 with named JSON refusal, empty stderr, no throw. Run `pnpm build && pnpm exec vitest run packages/cli/test/refusal.test.ts packages/cli/test/bin-smoke.test.ts`.

### CLI-002 — MEDIUM — bare-version shortcut ignores unknown flags

- **Source/symbol:** `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/dispatcher.ts:138` `dispatch`.
- **Reproduce:** actual binary `--version --nonsense --json` and `--version --document x --json`.
- **Observed/impact:** exit0 `ok:true`/version0.0.0 silently accepts invalid argv. No product operation occurs, but agent input validation is violated.
- **Refutation:** ordinary unknown flags and valued global switches refuse. Defect is the early version branch, not intentionally permissive verb help.
- **Owner/dependencies/fix:** CLI builder; reject remaining non-global tokens before bare version success. Preserve `-v`, `-V`, `--version` and text/JSON parity.
- **Acceptance:** both reproductions exit2; legal bare version stays0. Run `pnpm build && pnpm exec vitest run packages/cli/test/refusal.test.ts packages/cli/test/bin-smoke.test.ts packages/cli/test/json-equivalence.test.ts`.

### CLI-003 — HIGH — invalid/future freshness values allow at exported gate

- **Source/symbol:** `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/held-keys/gate.ts:177` `evaluateHeldKeyGate`: only `age > budget` is checked.
- **Reproduce through public package:** register existing `/home/devuser/Documents/Projects/sceneaxi/scripts/workspace-dist-resolver.mjs`; import `@sceneaxi/cli`; generate existing epoch3 all-resolved synthetic fixture. Map3/fixture authority3/clock2026-07-20T13:00:00Z. Separately set snapshot `generatedAt=2099-01-01T00:00:00Z`, clock `NaN`, budget `NaN`, or budget `Infinity` plus clock2099. Each returns `allow:true`.
- **Impact/qualification:** exported gate can claim freshness without a valid comparable clock/budget, or with a future snapshot. This is **not** a reachable shipped-binary hold bypass: shipped demo still refuses absent currency. No real held key was resolved or self-issued.
- **Refutation:** same fixture with valid fresh time allows, normal stale time refuses, offline refuses, authority4 refuses. Both mandatory currency regressions and every existing env-bypass regression pass. Source validator checks RFC3339 syntax, not time relative to runtime clock.
- **Owner/dependencies/fix:** CLI builder gate/refusal-table/regression files. Require finite, nonnegative runtime values and finite timestamp, refuse negative age before allow. Preserve currency-first ordering. Reuse existing named refusal semantics where accurate; coordinate schemas/docs if adding vocabulary, never silently alter enum contracts.
- **Acceptance:** future/NaN/Infinity/negative-time/budget oracles refuse; normal fresh/budget edge and mandatory NvsN+1/offline/env oracles preserved. Run `pnpm build && pnpm exec vitest run packages/cli/test/held-keys.refusal-table.test.ts packages/cli/test/held-keys.regressions.test.ts packages/cli/test/held-keys.command-map.test.ts`.

### CLI-004 — MEDIUM — help with watch creates a persistent watcher

- **Source/symbol:** `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/run.ts:40` `watchArguments`, `:85` `main`.
- **Reproduce:** real `project new` in isolated root, then binary `project dev --document scene.json --watch --help --json`.
- **Observed/impact:** after600ms process still alive; prints help decorated `mode:watch, cycle:1`. Requires SIGINT to stop and emits another envelope. Introspection hangs automation and owns watchers unnecessarily.
- **Refutation:** help without document exits; genuine ordinary watch lifecycle passes. Explicit SIGINT produces stopped-cycle1, establishing persistent watch ownership rather than merely startup latency.
- **Owner/dependencies/fix:** CLI builder run.ts/bin-smoke tests; no shared change. Help/version/invalid-global introspection must dispatch without watch setup.
- **Acceptance:** with valid document and both flag orders, help exits naturally once with normal help payload, no mode/cycle or stopped record. Ordinary edit, asset hot-reload and SIGINT/refused-cycle watch behavior stays passing. `pnpm build && pnpm exec vitest run packages/cli/test/bin-smoke.test.ts`.

### CLI-005 — LOW — README and exit-code comment misdescribe live features

- **Source:** `/home/devuser/Documents/Projects/sceneaxi/packages/cli/README.md:148` says watch refuses `NOT_IMPLEMENTED`; `/home/devuser/Documents/Projects/sceneaxi/packages/cli/src/exit-codes.ts:24` describes active held refusal as reserved/skeleton.
- **Reproduce/refutation:** actual watch streams changes/stops in bin-smoke; actual demo is schema1 exit3 `currency-unavailable`, not unimplemented. Existing backlog74 already says done.
- **Impact/fix/owner:** CLI builder should document implemented process streaming and stop semantics, synchronous API limitation, and implemented exit3. Docs owner coordinates dated-gap/current-surface references without erasing history.
- **Acceptance:** current documentation agrees with tested executable behavior and retains no-production/no-sentinel authority claims. Run CLI bin-smoke/exit-code golden tests.

## Dated backlog revalidation and complete remaining capability list

| Backlog | Current disposition | Safe local task / genuine remaining gate |
|---|---|---|
| 74 | Watch implemented; old categorical refusal stale | CLI-004 lifecycle regression and CLI-005 docs; no human approval needed |
| 77 | 21 verbs and67 bridge tools exist; no direct standalone equivalents for all historical names | Split local adapter/discoverability tasks from intentional boundary/refusal. Do not park whole item behind matrix widening |
| 78 | Only synthetic `demo gated` refuses currency;20 explicit ungated verbs do run; exit3 active | CLI-003 hardening local. Genuine FirstMate sentinel/export/trust and operation-specific authority remain unavailable if a real held operation is later activated |
| 79 | Source-backed exports/private0.0.0 remain deliberate; CLI tarball excludes dist and relies on repository-relative resolver | Prepare local outsider-runnable artifact/consumer test, not publication. Any dist-export release strategy must be coordinated; legal/version/publication authority remains separate |

Prioritized implementable tasks (full owned paths, dependencies and acceptance commands are machine-readable in JSON):

1. **P1 CLI-001/CLI-003:** inherited-name protocol containment and invalid freshness refusals. No existing protection may be weakened.
2. **P2 CLI-002/CLI-004:** strict version argv and nonpersistent help/watch. **P3 CLI-005:** truthful docs/comments.
3. **P1 CLI-PACK-01 /79:** self-contained local compiled archive/extracted consumer fixture; binary help/version/lifecycle from outside checkout without root scripts/node_modules. Existing manifest `/home/devuser/Documents/Projects/sceneaxi/packages/cli/package.json:7-15` does not supply this; launcher `.../packages/cli/bin/sceneaxi.mjs:18` reaches root resolver. Keep current workspace exports/publication policy unless shared owners deliberately implement an approved release strategy. No npm publish/private flip/license fabrication.
4. **P2 CLI-CAP-01 /77, play/run/build/export:** document and optionally thin-alias existing permission-bound bridge tools. Standalone kernel/presentation imports are prohibited; absent host and missing native signing must remain truthful refusals. Existing bridge tool inventory refutes blanket missing-capability claims but not missing standalone commands.
5. **P2 CLI-CAP-02 /77, asset remove:** reuse admitted removal/E1 review helpers or bridge tool; coordinate assets/authoring owners. Never silently delete source assets or duplicate importer authority.
6. **P2 CLI-CAP-03 /77, plugin list/load/validate:** read-only registry/capability diagnostics through allowed schemas/bridge; plugin owner retains trusted bounded loading and no-sandbox claim. No direct plugin-host import or widened matrix.
7. **P2 CLI-CAP-04 /77, evidence show/verify:** reuse `readEvidencePacket`/project report/contentHash; verify against actual current contained document bytes, not merely packet-internal pass labels. Forged/mismatched evidence refuses. Does not constitute native/provider/legal proof.
8. **P2 CLI-CAP-05 /77, catalog submit:** offline validation/proposal or already-admitted intake tool; storage/moderation/provenance/curation and commerce activation remain explicit separate gates. Do not turn metadataComplete into approval or publish locally.
9. **P2 CLI-CAP-06 /77, project migrate:** version1 already-current diagnostic can be local; no invented conversions. Unknown schema version refuses until schemas/authoring own real reversible conversion semantics.
10. **P2 CLI-CAP-07 /77, template init:** use contained approved local template/document helper with no-overwrite behavior; explain generic `project new --data` versus openable composed scene. Actual blank document import refused `ASSET_IMPORT_SCENE_INVALID`; composed output import succeeded, so the initial failure was an expected prerequisite, not an importer bug.
11. **Protected CLI-EXT-01 /78:** supply genuine authoritative structured export, trusted authenticated epoch endpoint/trust+timeout policy and separately authorized actual held operation only when activation is intended. Never replace unavailable production authority with the fixture `staticEpochAuthority`.

Every added verb requires together: `ROOT_COMMANDS`, `SHIPPED_COMMAND_MAP`, `takesArgs:true` when it parses flags, unknown/invalid argv refusals, versioned envelope/text parity, real bin and golden coverage. Existing helpers and accepted package boundaries dominate implementation. Root gate must remain unchanged and green.

## Shared files and cross-lane requests — not edited here

- **Schemas/integration:** `/home/devuser/Documents/Projects/sceneaxi/packages/schemas/contracts/{held-key-registry,cli-command-map,cli-protocol-envelope}.schema.json` only if CLI hardening adds vocabulary; existing refusal enums and fixture tables must stay coherent. New plugin/migration vocabulary belongs that owner, not the CLI adapter.
- **Root/integration:** `/home/devuser/Documents/Projects/sceneaxi/package.json`, `/home/devuser/Documents/Projects/sceneaxi/scripts/workspace-dist-resolver.mjs`, any shared dependency manifests for consumer-artifact work. No allow-list widening, dependency upgrades, gate skips or publication action.
- **Docs owner:** `/home/devuser/Documents/Projects/sceneaxi/docs/{held-key-enforcement,runnable-surfaces,publish-readiness,web-consumer}.md`, dated gap list and current backlog. Preserve historical statuses/provenance while adding current dispositions.
- **Authoring/assets/desktop/shells:** new operations must delegate to current proposal/application/import/tool authority; true hosted/native capabilities and their failure/safety proofs belong those lanes. No code files touched here.

## Security, lifecycle, performance and coverage limits

Held-key currency precedes local rules; no env bypass/offline exception, no real synthetic-authority activation. Kids shared open path refuses and shipping claims remain false. CLI engine imports remain denied; local bridge permissions, descriptor ownership/mode/symlink/socket checks, bounded response bytes and worker timeouts remain present. Actual missing/insecure descriptors and permission refusals are confirmed; no credential/provider capability appeared in captured output. Source-backed release limitations are explicit, not disguised as supported published runtime.

Ordinary watch edit/SIGINT/last-refused-cycle behavior is tested; help/watch is a confirmed lifecycle leak. CLI synchronous work and registry validation are small for shipped21-command inventory; startup sample measured, not used to promise performance. Large catalog/directory/document memory and sustained watch/load limits have no benchmark/SLO proof here. Genuine packaged-desktop success, non-Linux transport/platform signing, production sentinel trust and extracted outsider archive remain coverage holes assigned to their owners. These do not become fake PASS evidence because unit tests exit0.

Five exploratory inline batches stopped on audit assertion assumptions: omitted required flags (two batches), reapplying an already-applied proposal, assuming Kids refusal exit1 rather than normative exit2, and importing into a blank noncomposed document. Correct commands/oracles were rerun successfully; these are **harness/fixture assumptions**, not additional product defects. Defect repros retain failing-before evidence; there is deliberately no invented passing-after result because source was read-only.

Integration must return local FAILs to builder, rebuild and independently execute the actual oracles, with the configured three-pass bound. Persist every capability and external requirement not actually closed in FINAL. Full production cannot be PASS merely from this audit coverage PASS or the baseline gate.
