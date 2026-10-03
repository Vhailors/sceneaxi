# Final release integration — BLOCKED / NOT MERGE READY

## Final retry handback (2026-10-02T21:16:00Z)

### Applied source fixes (tests and assertions unchanged)

- `apps/desktop-shell/src/chrome.ts:4529`: unwrap the successful animation `authoringSnapshot` into Change Review. Identity-button selection at `:4672` now queues the real bridge selection command through the existing generation fence, matching the select-control path. Previously two real-control goldens failed; now all 31 pass.
- `desktop/linux/src/renderer/viewport.ts:1202`: terminal `pagehide` stops the render loop, disconnects resize observation, unbinds inputs, disposes mounts, releases the retained Three canvas context, and removes the canvas. Late play/stop/scene events are fenced. Build and root tests pass for this source; successful full native teardown proof remains blocked earlier in native acceptance.
- `desktop/macos/scripts/build.mjs:32`: strict copied-runtime inventory now requires `asset-preparation-worker.cjs` and verifies its byte digest. The previous four-file inventory correctly failed when the fifth required worker was emitted; build and config smoke now pass. This is a required artifact, not an optional allow-list expansion.
- `desktop/linux/src/electron/main.ts:323–345` already had the requested bridge-owned prepared job and direct response handoff on entry. Its busy/root/bridge/generation/cancel/window fences were retained; no redundant cosmetic edit was made.

### Fresh verification

| Acceptance | Result |
| --- | --- |
| Root build / serial declaration rebuild | PASS |
| Final unchanged root gate | RED: 312 files / 4863 tests pass; one file / 16 tests fail; lint not reached |
| Real-control dispatch goldens | PASS: 31, no assertion changes |
| Root golden command | PASS: 57 files / 545 tests |
| SDK / docs API | PASS: SDK 167 entries, 470961 bytes, SHA256 `6b680df1c677635dc241653c160894f17b46c9c3fb8d58e52a36fd7d84960494` |
| All four fresh site typechecks/builds | PASS: umbrella, catalog-game, catalog-web, kids, serially |
| Root ESLint run separately | RED: 255 errors, zero warnings, 17 files |
| Optional configured anti-slop | RED: broad baseline/policy collisions; no rules suppressed |
| Default runtime builds | PASS: Linux/macOS/Windows staging emits/copies worker sibling |
| macOS/Windows default smoke | PASS: staging/config/refusal checks only, **not native OS proof** |
| Linux native smoke | RED: headless SIGSEGV; Xvfb before fix reached retained-context failure; latest Xvfb after fix failed `SMOKE_WAIT_FAILED GUI Web export` with revision 8 / canonical scene.json / acknowledged playback |
| Focused seven-file integration run | 85 pass / 16 fail, same static-form file |

Final unchanged gate log: `/home/devuser/.local/share/empryo/tee/2026-10-02T21-15-29-856Z_shell-full.txt`. Earlier red, focused green, artifact hashes, command receipts, and source SHA256s are retained in `report.json`; historical receipts below do not supersede this retry.

### Exact remaining blockers / release disposition

1. `tests/e2e/desktop-editor-command-forms-golden.test.ts` has 16 failures: e.g. `missing control [data-editor-command-submit="package-install"]` at `:200`, and static form selectors at `:79`. Production now uses dynamically mounted registry dialogs. Reconciliation must retain prerequisite gating, inspection-derived choices/versions/digests, explicit approval invalidation, and no-write assertions; this retry did not weaken or skip them.
2. Resolve ESLint failures and optional baseline anti-slop collisions honestly, without suppressions, disabled rules or broken public APIs.
3. Linux native GUI Web export is not accepted; terminal context teardown patch has no complete native green receipt yet. Actual source-bound 8MiB heartbeat/cancel/GUI and browser focus/CSP acceptance remains incomplete. Native macOS/Windows proof is not implied by Linux staging/config smoke.
4. No checked candidate was constructed: baseline `4e532e2fbf43e9948741578ab6208a3277870405` has 1096 tracked paths; remote head has 456. Native git comparison finds 824 omissions relative to this exact baseline (user reports 825 relative to intended baseline). No intentional deletion is approved. A complete reviewed path/blob/mode inventory must restore omissions and preserve unmodified base paths/modes. Original user index/worktree was not staged, stashed, reset, cleaned, committed or force-pushed by release commands; all-untracked status currently has 1511 rows.
5. Independent Astra source/candidate review was requested; no review receipt exists. Remote PR312 remains OPEN/BLOCKED at `346933c105305224d575bf9319256301c1eeabfa`, with nine failed checks and two skipped checks. No push, merge, signing, money/provider/account/deploy or production DB action occurred.

PR: https://github.com/Vhailors/sceneaxi/pull/312. Required failing gate: https://github.com/Vhailors/sceneaxi/actions/runs/36931652198/job/110602099368. Required failing SDK: https://github.com/Vhailors/sceneaxi/actions/runs/36931652102/job/110602098929. Full current-head check URLs remain in `report.json`. Candidate SHA/tree and merge SHA are null, not invented.

## Earlier retry receipts (superseded only where explicitly noted)

## Fresh retry receipt (2026-10-02, operator bg-135)

- `pnpm build`: PASS on current local sources.
- Unchanged `pnpm gate`: RED at root tests, 311 test files passed / 2 failed; 4861 tests passed / 18 failed. Lint was not reached.
- Sixteen failures: `tests/e2e/desktop-editor-command-forms-golden.test.ts` still targets obsolete static command form selectors, while production now mounts registry-backed command dialogs.
- Two failures: `tests/e2e/desktop-control-dispatch-real-bridge-golden.test.ts` animation review visibility and scene selection dispatch.
- Fresh log: `/home/devuser/.local/share/empryo/tee/2026-10-02T20-50-13-780Z_shell-full.txt`.
- `desktop/linux/src/electron/main.ts:323–345` already contains the requested bridge-owned preparation job, direct response return, and identity/generation/cancellation/window fences. No raw-worker or legacy re-proposal remains in this handler.
- No candidate constructed, pushed, or merged by this retry. Inventory restoration, remaining acceptance, independent review and current-head required CI are still mandatory; historical handback totals are not substituted for fresh acceptance.

PR https://github.com/Vhailors/sceneaxi/pull/312 remains blocked at `346933c105305224d575bf9319256301c1eeabfa`; no push or merge.

Native main now consumes the prepared bridge job directly while preserving cancellation/generation/root/window fences. Raw worker/legacy re-proposal/large metrics removed. Fresh ordered build red TS2741 repaired in the strict unexpected-call mock; rebuild exit0. No historical test totals borrowed.

All dirty/untracked work retained. Candidate not yet constructed; all acceptance/inventory/review/CI pending. Full production external provider/legal/signing/deployment gaps remain separate.
