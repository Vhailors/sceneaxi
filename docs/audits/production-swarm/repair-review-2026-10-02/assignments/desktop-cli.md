# Assignment — desktop-cli

**Status:** READY FOR DISPATCH, not implemented or verified by baseline.

## Role and safety

Lead: GPT-6.1 Sol, standard tier requested; independent reviewer/judge: GPT-6 Astra, standard tier requested. Orchestrator must confirm actual dispatch. Repair bound: three passes. Parent is coordinator; no recursive grandchildren. Do not duplicate live builders. No writes to child-owned files until explicit completion handoff.

Read whole target files and canonical helpers before writing. Preserve all inherited dirty/untracked work. Reproduce exact failures and retain fail-before/pass-after oracles. No blanket casts, weakened checks, skipped assertions or invented external resources. No staging, commits, pushes, public posts, merge, deployment, spending, accounts, LIVE activation, production DB or held proof.

ALL manifests, locks, dependency manifests and workflows belong to security-delivery, even inside your package/site/desktop directories. Shared schemas/index, root configurations/exports, root tests and owning docs are serial-integration-only. Source files not listed below are read-only; submit exact requests to their owner.

Root/site builds and full gate belong to serial integration. No more than one heavy build/browser/native/packaging process runs graph-wide. Lightweight static/code work may fan out under available-memory monitoring.

## Task acceptance

Primary tasks (73): CLI-001, CLI-002, CLI-003, CLI-004, CLI-005, DL-SEC-01, DL-BYOK-02, DL-COV-03, DL-COV-04, DL-HARD-05, DL-PRIV-06, DL-DOC-07, DL-PERF-08, DR-001, DR-002, DR-003, DR-004, DR-005, DR-006, DR-007, COVERAGE-CLI, COVERAGE-SHELLS, COVERAGE-DESKTOP-LINUX, COVERAGE-DESKTOP-RELEASE, CLI-EXT-01, SHELL-001, SHELL-002, SHELL-003, SHELL-004, SHELL-005, SHELL-006, SHELL-007, SH-T09, GATE-PUBLICATION, GATE-MACOS, GATE-WINDOWS, GATE-EPOCH, SCOPE-COMPOSE-UI, LOCAL-PROOF-054, LOCAL-PROOF-057, LOCAL-PROOF-060, LOCAL-PROOF-074, LOCAL-089, REQ-PROOF-HOLD-001, REQ-PROOF-HOLD-002, REQ-PROOF-HOLD-003, REQ-PROOF-DESK-001, REQ-PROOF-DESK-002, REQ-PROOF-DESK-003, REQ-PROOF-DESK-004, REQ-PROOF-DESK-005, REQ-PROOF-DESK-006, REQ-PROOF-DESK-007, REQ-PROOF-DESK-008, REQ-PROOF-DESK-009, REQ-PROOF-DESK-010, REQ-PROOF-REL-001, REQ-PROOF-REL-002, REQ-PROOF-REL-003, REQ-PROOF-REL-004, REQ-PROOF-REL-005, REQ-PROOF-REL-006, REQ-PROOF-REL-007, REQ-PROOF-SURFACE-001, REQ-PROOF-SURFACE-002, REQ-PROOF-SURFACE-003, REQ-PROOF-SURFACE-004, VD-01, VD-02, VD-03, VD-04, VD-05, DEEP-08-ADDITIONAL-2.

Read exact targets, symbols, SHA-256, dependency owners, commands and nonblank assertions from `../ledger.json`. A named suite exit is insufficient if the task assertion has no executed matching oracle. Baseline verification state is NOT_EXECUTED; no DONE or percentage transferred from finish reports.

Astra PASS requires every assigned assertion tied to current exact source/artifact, preserved positive/negative safety, and recorded command/exit/cleanup. Local and published and full-production are separately classified. Reports must use DONE_VERIFIED, NEEDS_LOCAL_FIX, EXTERNAL_BLOCKER with exact missing input, or INTENTIONAL_FULL_PRODUCTION_GAP; the latter never closes the full goal.

## One-level parallel child packets

### desktop-chrome

Task IDs: SHELL-001, SHELL-002, LOCAL-PROOF-057, REQ-PROOF-DESK-001, REQ-PROOF-DESK-002, REQ-PROOF-SURFACE-002, VD-03, VD-04.

Exclusive exact files:

- `apps/desktop-shell/README.md`
- `apps/desktop-shell/bin/sceneaxi-desktop.mjs`
- `apps/desktop-shell/src/app.ts`
- `apps/desktop-shell/src/chrome.ts`
- `apps/desktop-shell/src/commands.ts`
- `apps/desktop-shell/src/index.ts`
- `apps/desktop-shell/src/interaction-commands.ts`
- `apps/desktop-shell/src/product-loop.ts`
- `apps/desktop-shell/src/protocol-client.ts`
- `apps/desktop-shell/src/session.ts`
- `apps/desktop-shell/src/visual-model.ts`
- `apps/desktop-shell/src/visual-tokens.ts`
- `apps/desktop-shell/test/app.test.ts`
- `apps/desktop-shell/test/bin-smoke.test.ts`
- `apps/desktop-shell/test/chrome.test.ts`
- `apps/desktop-shell/test/control-accounting.test.ts`
- `apps/desktop-shell/test/open-path.test.ts`
- `apps/desktop-shell/test/product-loop.test.ts`
- `apps/desktop-shell/test/protocol-client.test.ts`
- `apps/desktop-shell/test/seam.test.ts`
- `apps/desktop-shell/test/session-recovery.test.ts`
- `apps/desktop-shell/test/visual-model.test.ts`
- `apps/desktop-shell/test/visual-postpr-evidence/after-busy.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-byok-narrow.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-byok.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-empty.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-idle-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-idle-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-idle-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-idle-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-long-diff-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-long-diff-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-long-diff-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-long-diff-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-refusal-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-refusal-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-refusal-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector-refusal-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-inspector.json`
- `apps/desktop-shell/test/visual-postpr-evidence/after-kids.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-long-evidence.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-menu-pressed.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-mobile-refusal.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-narrow.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-palette.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-refused.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-selected.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after-web.png`
- `apps/desktop-shell/test/visual-postpr-evidence/after.json`
- `apps/desktop-shell/test/visual-postpr-evidence/before-busy.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-byok-narrow.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-byok.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-empty.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-idle-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-idle-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-idle-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-idle-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-long-diff-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-long-diff-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-long-diff-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-long-diff-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-refusal-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-refusal-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-refusal-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector-refusal-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-inspector.json`
- `apps/desktop-shell/test/visual-postpr-evidence/before-kids.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-long-evidence.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-menu-pressed.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-mobile-refusal.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-narrow.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-palette.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-refused.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-selected.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before-web.png`
- `apps/desktop-shell/test/visual-postpr-evidence/before.json`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-busy.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-byok-narrow.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-byok.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-empty.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-forced-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-idle-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-idle-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-idle-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-idle-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-long-diff-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-long-diff-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-long-diff-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-long-diff-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-refusal-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-refusal-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-refusal-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector-refusal-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-inspector.json`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-kids.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-long-evidence.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-menu-pressed.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-mobile-refusal.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-narrow.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-palette.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-refused.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-selected.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after-web.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/after.json`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-busy.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-byok-narrow.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-byok.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-empty.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-forced-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-idle-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-idle-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-idle-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-idle-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-long-diff-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-long-diff-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-long-diff-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-long-diff-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-refusal-dark-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-refusal-dark.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-refusal-light-focus.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector-refusal-light.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-inspector.json`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-kids.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-long-evidence.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-menu-pressed.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-mobile-refusal.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-narrow.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-palette.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-refused.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-selected.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before-web.png`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/before.json`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/capture-web.mjs`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/capture.mjs`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/source-vs-pr.patch`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/summary.json`
- `apps/desktop-shell/test/visual-postpr-evidence/retry/tests.json`
- `apps/desktop-shell/test/visual-postpr-evidence/tests-initial-failures.json`
- `apps/desktop-shell/test/visual-postpr-evidence/tests-retry.json`
- `apps/desktop-shell/test/visual-postpr-evidence/tests.json`
- `apps/desktop-shell/test/visual-refinement.test.ts`
- `apps/desktop-shell/test/visual-tokens.test.ts`
- `apps/desktop-shell/tsconfig.json`

### web-inspector

Task IDs: SHELL-003, SHELL-004, SHELL-005, SHELL-006, SHELL-007, REQ-PROOF-SURFACE-003.

Exclusive exact files:

- `apps/web-shell/README.md`
- `apps/web-shell/bin/sceneaxi-web-shell.mjs`
- `apps/web-shell/src/account-panel.ts`
- `apps/web-shell/src/assistant-default.ts`
- `apps/web-shell/src/assistant-panel.ts`
- `apps/web-shell/src/dev-server.ts`
- `apps/web-shell/src/index.ts`
- `apps/web-shell/src/inspector-app.ts`
- `apps/web-shell/src/inspector.ts`
- `apps/web-shell/src/open-path-view.ts`
- `apps/web-shell/src/panel-support.ts`
- `apps/web-shell/src/protocol-client.ts`
- `apps/web-shell/test/account-panel.test.ts`
- `apps/web-shell/test/assistant-panel.test.ts`
- `apps/web-shell/test/bin-smoke.test.ts`
- `apps/web-shell/test/dev-server.test.ts`
- `apps/web-shell/test/inspector-app.test.ts`
- `apps/web-shell/test/inspector.test.ts`
- `apps/web-shell/test/minimum-e2.test.ts`
- `apps/web-shell/test/open-path-view.test.ts`
- `apps/web-shell/test/refuse-matrix.test.ts`
- `apps/web-shell/test/seam.test.ts`
- `apps/web-shell/test/visual-postpr.test.ts`
- `apps/web-shell/tsconfig.json`

### linux-runtime

Task IDs: DL-SEC-01, DL-BYOK-02, DL-COV-04, DL-PRIV-06, DL-DOC-07, DL-PERF-08, DR-006, SH-T09, REQ-PROOF-DESK-004, REQ-PROOF-DESK-005, REQ-PROOF-DESK-006, REQ-PROOF-DESK-007, REQ-PROOF-DESK-010.

Exclusive exact files:

- `desktop/linux/PRODUCT.md`
- `desktop/linux/README.md`
- `desktop/linux/electron-builder.yml`
- `desktop/linux/scripts/build-linux.mjs`
- `desktop/linux/scripts/build.mjs`
- `desktop/linux/scripts/check-renderer.mjs`
- `desktop/linux/scripts/dist.mjs`
- `desktop/linux/scripts/renderer-bundle.mjs`
- `desktop/linux/scripts/smoke-diagnostics.mjs`
- `desktop/linux/scripts/smoke.mjs`
- `desktop/linux/src/electron/live-transport.ts`
- `desktop/linux/src/electron/main.ts`
- `desktop/linux/src/electron/preload.ts`
- `desktop/linux/src/electron/provider-key-store.ts`
- `desktop/linux/src/electron/provider-runtime.ts`
- `desktop/linux/src/index.ts`
- `desktop/linux/src/lib/asset-picker-host.ts`
- `desktop/linux/src/lib/assistant-viewport.ts`
- `desktop/linux/src/lib/bridge-contract.ts`
- `desktop/linux/src/lib/bridge.ts`
- `desktop/linux/src/lib/byo-configuration-contract.ts`
- `desktop/linux/src/lib/byo-configuration-view.ts`
- `desktop/linux/src/lib/byo-configuration.ts`
- `desktop/linux/src/lib/chrome-document.ts`
- `desktop/linux/src/lib/contained-file.ts`
- `desktop/linux/src/lib/desktop-scene.ts`
- `desktop/linux/src/lib/diagnostics.ts`
- `desktop/linux/src/lib/input-action-contract.ts`
- `desktop/linux/src/lib/input-action-host.ts`
- `desktop/linux/src/lib/local-rpc.ts`
- `desktop/linux/src/lib/project-browser-contract.ts`
- `desktop/linux/src/lib/project-browser.ts`
- `desktop/linux/src/lib/project-host.ts`
- `desktop/linux/src/lib/project-lifecycle-contract.ts`
- `desktop/linux/src/lib/project-lifecycle.ts`
- `desktop/linux/src/lib/project-seed.ts`
- `desktop/linux/src/lib/provider-key-store.ts`
- `desktop/linux/src/lib/web-export.ts`
- `desktop/linux/src/lib/workspace-layout-host.ts`
- `desktop/linux/src/native/publish-no-replace.c`
- `desktop/linux/src/renderer/assistant-inspection.ts`
- `desktop/linux/src/renderer/assistant-poll.ts`
- `desktop/linux/src/renderer/assistant-runtime.ts`
- `desktop/linux/src/renderer/assistant-start.ts`
- `desktop/linux/src/renderer/byo-configuration.ts`
- `desktop/linux/src/renderer/playback-report.ts`
- `desktop/linux/src/renderer/viewport-playback.ts`
- `desktop/linux/src/renderer/viewport.ts`
- `desktop/linux/test/local-rpc.test.ts`
- `desktop/linux/test/production-hardening.test.ts`
- `desktop/linux/test/viewport-input-actions.test.ts`
- `desktop/linux/tsconfig.json`

### macos-windows-release

Task IDs: DR-001, DR-002, DR-003, DR-004, DR-005, DR-007, REQ-PROOF-DESK-008.

Exclusive exact files:

- `desktop/macos/README.md`
- `desktop/macos/electron-builder.yml`
- `desktop/macos/entitlements.mac.plist`
- `desktop/macos/scripts/artifact-validation.mjs`
- `desktop/macos/scripts/build.mjs`
- `desktop/macos/scripts/dist.mjs`
- `desktop/macos/scripts/release-provenance.mjs`
- `desktop/macos/scripts/smoke.mjs`
- `desktop/macos/src/electron/main.ts`
- `desktop/macos/src/index.ts`
- `desktop/macos/test/seam.test.ts`
- `desktop/macos/tsconfig.json`
- `desktop/windows/README.md`
- `desktop/windows/electron-builder.yml`
- `desktop/windows/scripts/build.mjs`
- `desktop/windows/scripts/dist.mjs`
- `desktop/windows/scripts/native-runtime-smoke.mjs`
- `desktop/windows/scripts/package-release.d.mts`
- `desktop/windows/scripts/package-release.mjs`
- `desktop/windows/scripts/release-preflight.d.mts`
- `desktop/windows/scripts/release-preflight.mjs`
- `desktop/windows/scripts/release.mjs`
- `desktop/windows/scripts/smoke.mjs`
- `desktop/windows/src/electron/main.ts`
- `desktop/windows/src/index.ts`
- `desktop/windows/src/lib/update-policy.ts`
- `desktop/windows/test/final-release-acceptance.test.ts`
- `desktop/windows/tsconfig.json`

### cli

Task IDs: CLI-001, CLI-002, CLI-003, CLI-004, CLI-005, CLI-EXT-01, GATE-PUBLICATION, GATE-MACOS, GATE-WINDOWS, GATE-EPOCH, SCOPE-COMPOSE-UI, REQ-PROOF-HOLD-001, REQ-PROOF-HOLD-002, REQ-PROOF-HOLD-003, REQ-PROOF-REL-005, REQ-PROOF-SURFACE-001, DEEP-08-ADDITIONAL-2.

Exclusive exact files:

- `packages/cli/README.md`
- `packages/cli/bin/build-archive.mjs`
- `packages/cli/bin/sceneaxi.mjs`
- `packages/cli/src/asset-verbs.ts`
- `packages/cli/src/commands.ts`
- `packages/cli/src/desktop-client.ts`
- `packages/cli/src/desktop-socket-worker.ts`
- `packages/cli/src/desktop-verbs.ts`
- `packages/cli/src/dispatcher.ts`
- `packages/cli/src/envelope.ts`
- `packages/cli/src/exit-codes.ts`
- `packages/cli/src/format.ts`
- `packages/cli/src/held-keys/gate.ts`
- `packages/cli/src/held-keys/generate.ts`
- `packages/cli/src/held-keys/registry.ts`
- `packages/cli/src/held-keys/shipped.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/project-lifecycle.ts`
- `packages/cli/src/project-verbs.ts`
- `packages/cli/src/registry-verbs.ts`
- `packages/cli/src/run.ts`
- `packages/cli/src/scene-verbs.ts`
- `packages/cli/src/templates.ts`
- `packages/cli/src/verb-args.ts`
- `packages/cli/src/verb-support.ts`
- `packages/cli/src/version.ts`
- `packages/cli/test/__snapshots__/envelope.snapshot.test.ts.snap`
- `packages/cli/test/bin-smoke.test.ts`
- `packages/cli/test/capabilities.test.ts`
- `packages/cli/test/desktop-bridge.test.ts`
- `packages/cli/test/desktop-socket-worker-lockstep.test.ts`
- `packages/cli/test/distribution.test.ts`
- `packages/cli/test/envelope.snapshot.test.ts`
- `packages/cli/test/exit-codes.golden.test.ts`
- `packages/cli/test/final-acceptance.test.ts`
- `packages/cli/test/fixtures/held-keys/firstmate-export.epoch2.json`
- `packages/cli/test/fixtures/held-keys/firstmate-export.epoch3.all-resolved.json`
- `packages/cli/test/fixtures/held-keys/firstmate-export.markdown-source.json`
- `packages/cli/test/fixtures/held-keys/snapshot.schema-invalid.json`
- `packages/cli/test/held-keys.command-map.test.ts`
- `packages/cli/test/held-keys.generator.test.ts`
- `packages/cli/test/held-keys.refusal-table.test.ts`
- `packages/cli/test/held-keys.regressions.test.ts`
- `packages/cli/test/json-equivalence.test.ts`
- `packages/cli/test/profile-open-path.test.ts`
- `packages/cli/test/project-lifecycle.test.ts`
- `packages/cli/test/project-propose-apply.test.ts`
- `packages/cli/test/refusal.test.ts`
- `packages/cli/test/registry-verbs.test.ts`
- `packages/cli/test/scene-compose.test.ts`
- `packages/cli/test/seam.test.ts`
- `packages/cli/tsconfig.json`

## Lead-only cross-file task coordination

DL-COV-03, DL-HARD-05, COVERAGE-CLI, COVERAGE-SHELLS, COVERAGE-DESKTOP-LINUX, COVERAGE-DESKTOP-RELEASE, LOCAL-PROOF-054, LOCAL-PROOF-060, LOCAL-PROOF-074, LOCAL-089, REQ-PROOF-DESK-003, REQ-PROOF-DESK-009, REQ-PROOF-REL-001, REQ-PROOF-REL-002, REQ-PROOF-REL-003, REQ-PROOF-REL-004, REQ-PROOF-REL-006, REQ-PROOF-REL-007, REQ-PROOF-SURFACE-004, VD-01, VD-02, VD-05

All task source owners outside this lane are dependencies, not overlapping write grants. Exact requests are machine-readable in `../assignments.json`. A missing-capabilities task owner may not rewrite source belonging to another lane; it must obtain a bounded owner implementation/handoff and retain responsibility for complete acceptance.

## Report ownership and handoff

Own only `../fix-desktop-cli.md` and `../fix-desktop-cli.json` for lane findings. Write them early; retain source hashes, commands, exits, assertion names, failures, resource cleanup and external inputs. Other audit/repair/finish directories are READ ONLY. After completion explicitly release these reports and child file claims to serial integration; no permanent report lock.
