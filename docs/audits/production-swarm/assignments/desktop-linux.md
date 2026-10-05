# Builder assignment — desktop-linux

Graph `sceneaxi-production-swarm`; role `code`; real root/cwd `/home/devuser/Documents/Projects/sceneaxi`. Read-only audit input `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json` and its MD; full source findings are preserved in MEGALIST.json.

## Exclusive exact source/test path ownership

Only the following existing/new exact paths are claimed by this lane. Existing owning docs/README, manifests/locks/config, schemas/site-kit, tests/*, scripts/*, workflows and SQL migrations are **RESERVED integration after all builders**. No adjacent-file ownership is implied; request any additional exact path before editing.
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/build-linux.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/build.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/check-renderer.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/dist.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/renderer-bundle.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke-diagnostics.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/live-transport.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/preload.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/provider-key-store.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/provider-runtime.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/asset-picker-host.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/assistant-viewport.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge-contract.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/byo-configuration-contract.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/byo-configuration-view.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/byo-configuration.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/chrome-document.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/contained-file.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/desktop-scene.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/diagnostics.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/input-action-contract.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/input-action-host.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/local-rpc.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-browser-contract.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-browser.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-host.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-lifecycle-contract.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-lifecycle.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-seed.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/provider-key-store.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/web-export.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/workspace-layout-host.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/native/publish-no-replace.c`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/assistant-inspection.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/assistant-poll.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/assistant-runtime.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/assistant-start.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/byo-configuration.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/playback-report.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/viewport-playback.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/viewport.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/test/local-rpc.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/desktop/linux/test/viewport-input-actions.test.ts`

## Full assigned scope / measurable acceptance

Historical backlog IDs: [54, 59, 60, 61, 89]. Authority requirement IDs: ['DESK-001', 'DESK-002', 'DESK-003', 'DESK-004', 'DESK-005', 'DESK-006', 'DESK-007', 'DESK-008', 'DESK-009', 'DESK-010', 'SURFACE-004'].

### COVERAGE-DESKTOP-LINUX: implementation-needed / P1
Remaining current-source/front-door coverage: desktop-linux
- Chosen solution: Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
- Acceptance: ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "Native New/Open/Recent dialogs and full current registered GUI controls", "Native Redo/hierarchy/import-reload/Ask-Build-approve-apply/cancel-timeout through actual controls", "Actual supported OS-keyring credential save/replace/remove and configured live provider", "Native bridge project rebind/crash/close discovery lifecycle through packaged controls", "AppImage mount and deb installation", "Physical GPU/driver matrix and maximum-admitted-assets sustained performance", "Screenshot pixels captured but layout/accessibility not visually reviewed", "macOS/Windows signing/platform launch/public release/update proof", "Real authenticated umbrella editor browser gate"]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json"]

### DL-BYOK-02: implementation-needed / P1
Provider-specific injected runtime availability; unsupported OpenRouter unavailable/fixture-only, preserve Remove. Do not invent model pin/live provider.
- Chosen solution: Provider-specific injected runtime availability; unsupported OpenRouter unavailable/fixture-only, preserve Remove. Do not invent model pin/live provider.
- Acceptance: ["OpenRouter unavailable in actual opencode composition; opencode ready only with runner; encrypted replace/remove/locked/Kids remain; selected unavailable provider does not imply another provider usable."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/byo-configuration.ts", "line": 82, "symbol": "createDesktopByoConfiguration"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/byo-configuration.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/provider-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/byo-configuration.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/desktop/desktop-byo-secure-storage.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": "Configured OpenRouter fixture key with opencode-only runtime: status runtime ready; actual runner reads opencode and refuses missing key.", "refutation": "Key storage/removal supports both; actual runner intentionally opencode-only; no secret or credits cross boundary.", "impact": "Misleading readiness/provider configuration and Send target mismatch.", "status": "CONFIRMED_LOCAL"}
- Commands: ["pnpm exec vitest run tests/desktop", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged"]

### DL-COV-03: implementation-needed / P1
Extend existing smoke with isolated typed dialog port and actual controls: New/Open/Recent/Save/Undo/Redo, hierarchy/transform, import/reload, Local Ask/Build/approve/apply/cancel/timeout, Play/Export and current registered actions. Keep fixture/live distinction.
- Chosen solution: Extend existing smoke with isolated typed dialog port and actual controls: New/Open/Recent/Save/Undo/Redo, hierarchy/transform, import/reload, Local Ask/Build/approve/apply/cancel/timeout, Play/Export and current registered actions. Keep fixture/live distinction.
- Acceptance: ["Each required action has typed-input/result/bytes/hash/reopen/frame oracle, no skipped/weakened assertions; 3 consecutive full packaged runs and real captures."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke.mjs", "line": 78, "symbol": "smoke assertion inventory"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
- Dependencies: ["shells-builder:#53 exact typed GUI inputs", "engine-builder:#64 audio"]
- Evidence/reproduction: {"reproduction": "Fresh packaged smoke passes old transforms/browser/undo/export only; main.ts native New/Open cancels in SMOKE; no packaged current assistant/hierarchy/Redo/import-reload/new control oracle.", "refutation": "Lower-layer goldens pass and existing smoke is genuine WebGL; neither covers missing GUI front doors.", "impact": "Lower-layer green does not detect full-editor renderer/host/control regressions.", "status": "CONFIRMED_COVERAGE_GAP"}
- Commands: ["pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux build", "pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux dist", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged", "pnpm gate"]

### DL-SEC-01: implementation-needed / P1
Validate HTTPS/no-userinfo/approved origin and port before key reads, redirect:error, bounded body parse; reuse existing refusal.
- Chosen solution: Validate HTTPS/no-userinfo/approved origin and port before key reads, redirect:error, bounded body parse; reuse existing refusal.
- Acceptance: ["Forbidden HTTP/userinfo/port/PRC/untrusted origin reads zero keys/fetches; approved HTTPS positive; redirects/body limits/timeouts redact; initial HTTP spy is failing-before oracle."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/live-transport.ts", "line": 70, "symbol": "createDesktopOpenCodeLiveTransport"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/live-transport.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/desktop/desktop-opencode-live-transport.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": "Public factory apiBase http://opencode.ai/zen/v1, injected fetch spy/fixture accessor; session.run valid Game profile. Observed http: bearerPresent true and default-follow redirects.", "refutation": "HTTPS positive fetches; PRC/untrusted hosts zero fetch; default GUI uses fixed HTTPS. No actual key leaked.", "impact": "Privileged configurable API base violates HTTPS-only credential transport before eventual output validation.", "status": "CONFIRMED_LOCAL"}
- Commands: ["pnpm exec vitest run tests/desktop/desktop-opencode-live-transport.test.ts tests/e2e/desktop-assistant-scene-loop-golden.test.ts", "pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux build", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged", "pnpm gate"]

### DL-COV-04: implementation-needed / P2
Synchronize exact browser-ready/selection result revision, bounded diagnostics, not global data-busy or arbitrary sleep inflation.
- Chosen solution: Synchronize exact browser-ready/selection result revision, bounded diagnostics, not global data-busy or arbitrary sleep inflation.
- Acceptance: ["Repeat both documented paths with unchanged selection/frame predicates; retain initial failure and route reproducible failure within three passes."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": 837, "symbol": "browserUiOpen waitFor"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
- Dependencies: ["shells browser readiness"]
- Evidence/reproduction: {"reproduction": "First Xvfb runtime asset selector/open false and restart scene.json; D-Bus retry and fresh package runs pass unchanged.", "refutation": "Not reproducible permanent asset defect; no historical GPU SIGSEGV observed.", "impact": "Transient real front-door smoke failure requires explicit evidence, not silent green aggregate.", "status": "UNRESOLVED_ENVIRONMENT_OR_TIMING"}
- Commands: ["xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged"]

### DL-DOC-07: implementation-needed / P2
Reconcile actual Local Ask/Build/approve/apply, fixture/live provider state and fresh limited package proof.
- Chosen solution: Reconcile actual Local Ask/Build/approve/apply, fixture/live provider state and fresh limited package proof.
- Acceptance: ["Docs parity based on actual controls/evidence; no unpublished local offer promoted."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/README.md", "line": 99, "symbol": "assistant Ask description"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/README.md", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["DL-COV-03"]
- Evidence/reproduction: {"reproduction": "README says Ask refuses; assistant-start.ts:69 admits ask, viewport.ts:720-727 routes assistant-ask.", "refutation": "Agent rarity fixture and Hosted refusal are distinct intentional routes, not live provider proof.", "impact": "Outdated user guidance and lower-layer/packaged claims conflated.", "status": "CONFIRMED_LOCAL_DOC_DRIFT"}
- Commands: ["pnpm check:traceability", "pnpm check:contracts"]

### DL-HARD-05: implementation-needed / P2
Deterministic inline script hashes, strict local-only CSP, explicit permission denial and main-frame/document IPC sender verification; network stays privileged.
- Chosen solution: Deterministic inline script hashes, strict local-only CSP, explicit permission denial and main-frame/document IPC sender verification; network stays privileged.
- Acceptance: ["Actual enforced CSP permits real existing chrome/viewport and refuses injected remote script/frame/permission/non-main IPC; no unsafe-eval/matrix widening."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/chrome-document.ts", "line": 82, "symbol": "desktopLinuxIndexHtml"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/chrome-document.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
- Dependencies: ["shells inline-script hash/control owner"]
- Evidence/reproduction: {"reproduction": "Built Electron warning lacks CSP; emitter adds only runtime meta and renderer script.", "refutation": "Sandbox/context isolation/no Node/navigation and window-open denial exist; no XSS exploit demonstrated.", "impact": "Missing defense-in-depth around privileged bridge renderer.", "status": "CONFIRMED_HARDENING_GAP_NO_EXPLOIT"}
- Commands: ["pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux check:renderer", "pnpm exec vitest run tests/desktop tests/boundary/injected-desktop-violations.test.ts", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged", "pnpm gate"]

### DL-PERF-08: implementation-needed / P2
Existing-smoke/golden bounded maximum asset, repeated import/reload/play/export, teardown/resource plateau and latency assertions; no widened limits.
- Chosen solution: Existing-smoke/golden bounded maximum asset, repeated import/reload/play/export, teardown/resource plateau and latency assertions; no widened limits.
- Acceptance: ["Measured bounds with platform identified, resource teardown/plateau and physical-GPU coverage separately recorded."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/viewport-playback.ts", "line": 121, "symbol": "mountDesktopScene"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/asset-ingestion-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["engine-presentation owner resource counters if needed"]
- Evidence/reproduction: {"reproduction": "Small synthetic models/software renderer only; no maximum admitted assets or sustained hot reload/mount/performance proof.", "refutation": "Three backend unmount disposes subtree and imported caches; do not claim missing disposal/memory leak.", "impact": "Production responsiveness/resource limits unvalidated.", "status": "COVERAGE_GAP_NO_LEAK_ASSERTED"}
- Commands: ["pnpm exec vitest run tests/e2e/asset-ingestion-golden.test.ts tests/desktop", "dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged"]

### DL-PRIV-06: implementation-needed / P2
Recommended local default: raw dump opt-out unless explicit local consent; retain redacted diagnostics/recovery and no automatic sharing.
- Chosen solution: Recommended local default: raw dump opt-out unless explicit local consent; retain redacted diagnostics/recovery and no automatic sharing.
- Acceptance: ["Default/BYOK sessions no raw dumps; structured local event/reload still pass; synthetic consent/retention/removal tests without real secrets."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": 129, "symbol": "crashReporter.start"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/main.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/diagnostics.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
- Dependencies: ["docs owner local consent/retention/sharing copy"]
- Evidence/reproduction: {"reproduction": "Crash reporter enabled no-upload; diagnostics.ts:110-129 keeps raw dumps and explicitly warns decrypted BYOK memory possible.", "refutation": "No upload or arbitrary stacks/messages in structured logs; no secret-leak test performed; real renderer recovery passes.", "impact": "Raw local minidumps cannot be described as redacted diagnostics.", "status": "CONFIRMED_SENSITIVE_DUMP_POLICY_GAP_NO_LEAK_OBSERVED"}
- Commands: ["pnpm exec vitest run tests/desktop", "dbus-run-session -- xvfb-run -a node /home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke-diagnostics.mjs"]

### LOCAL-089: done-with-evidence / P2
`pnpm dist` builds the installers but exits with an electron-builder `channel` TypeError during cleanup
- Chosen solution: Retain current bounded implementation/refusal evidenced by the live audit; no rebuilding a refuted categorical gap.
- Acceptance: ["Current bounded criterion in lane audit remains satisfied; external/full-capability proof is separately tracked rather than inferred from old done."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "backlogDisposition": {"id": 89, "priorStatus": "done", "currentOutcome": "FRESH_DIST_AND_ARTIFACT_HASHES_PASS; OLD_CHANNEL_ERROR_REFUTED", "evidenceIds": ["dist", "packaged"], "remainingFindingIds": []}}]

### LOCAL-PROOF-054: done-with-evidence / P2
Bounded implemented portion: No crash reporting or telemetry; no `render-process-gone` / `child-process-gone` handling.
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "backlogDisposition": {"id": 54, "priorStatus": "done", "currentOutcome": "CURRENT_CRASH_HANDLING_REFUTES_OLD_ABSENCE; RAW_DUMP_POLICY_OPEN", "evidenceIds": ["diagnostics"], "remainingFindingIds": ["DL-PRIV-06"]}}]

### LOCAL-PROOF-060: done-with-evidence / P2
Bounded implemented portion: Electron 43.2.0 GPU process SIGSEGV in the current-host smoke
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "backlogDisposition": {"id": 60, "priorStatus": "done", "currentOutcome": "HISTORICAL_GPU_SIGSEGV_NOT_REPRODUCED; PHYSICAL_GPU_UNPROVEN", "evidenceIds": ["smoke-before", "smoke-refutation", "packaged"], "remainingFindingIds": ["DL-COV-04"]}}]

### REQ-PROOF-DESK-001: done-with-evidence / P2
Bounded requirement declaration: The desktop shell derives modes, controls, tabs, refusals, assistant states, and tiers from the shared editor-shell vocabulary and counts every control exactly once.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PARTIAL_CURRENT_VOCABULARY_TESTED_GUI_INPUT_COVERAGE_OPEN"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/editor-shell.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-001", "outcome": "PARTIAL_CURRENT_VOCABULARY_TESTED_GUI_INPUT_COVERAGE_OPEN", "evidenceIds": ["renderer", "desktop-tests"], "dependencies": ["shells:#53"]}, "expectedEvidenceLayer": ["apps/desktop-shell/test/control-accounting.test.ts", "tests/e2e/desktop-control-inventory-golden.test.ts"]}]

### REQ-PROOF-DESK-002: done-with-evidence / P2
Bounded requirement declaration: Standalone desktop chrome opens no kernel or presentation runtime and refuses runtime-dependent Open, Save, and Play controls by name.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "EXPECTED_STANDALONE_RUNTIME_REFUSAL"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/product-loop.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-002", "outcome": "EXPECTED_STANDALONE_RUNTIME_REFUSAL", "evidenceIds": ["baseline actual chrome", "desktop-tests"]}, "expectedEvidenceLayer": ["apps/desktop-shell/test/chrome.test.ts", "tests/e2e/desktop-product-loop-golden.test.ts"]}]

### REQ-PROOF-DESK-003: done-with-evidence / P2
Bounded requirement declaration: The packaged Linux desktop owns the application, bridge, renderer, project lifecycle, and local/BYOK assistant paths without adding a second product implementation.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CURRENT_LOCAL_PACKAGE_ONE_RENDERER_PROVEN_ASSISTANT_GUI_HOLE"]
- Source: []
- Targets/owners: [{"reference": "desktop/linux/src/electron"}, {"reference": "desktop/linux/src/lib"}, {"reference": "desktop/linux/src/renderer"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-003", "outcome": "CURRENT_LOCAL_PACKAGE_ONE_RENDERER_PROVEN_ASSISTANT_GUI_HOLE", "evidenceIds": ["renderer", "packaged"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-linux-bridge-golden.test.ts", "pnpm check:desktop"]}]

### REQ-PROOF-DESK-004: done-with-evidence / P2
Bounded requirement declaration: First launch binds no project root and writes no project; roots enter only through a validated native dialog or recent registry.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "SOURCE_AND_LIFECYCLE_GOLDEN_PASS_NATIVE_DIALOGS_UNDRIVEN"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-lifecycle.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-host.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-004", "outcome": "SOURCE_AND_LIFECYCLE_GOLDEN_PASS_NATIVE_DIALOGS_UNDRIVEN", "evidenceIds": ["desktop-tests"], "remainingFindingIds": ["DL-COV-03"]}, "expectedEvidenceLayer": ["tests/desktop/desktop-project-lifecycle.test.ts", "tests/e2e/desktop-linux-bridge-golden.test.ts"]}]

### REQ-PROOF-DESK-005: done-with-evidence / P2
Bounded requirement declaration: The local agent bridge is a same-user Unix socket with a closed versioned tool and permission registry; every call validates capability, permission, and exact input before the desktop bridge.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "REAL_SOCKET_AND_SPAWNED_CLI_PROOF_NATIVE_REBIND_CRASH_CLEANUP_HOLE"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/local-rpc.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-local-bridge.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-005", "outcome": "REAL_SOCKET_AND_SPAWNED_CLI_PROOF_NATIVE_REBIND_CRASH_CLEANUP_HOLE", "evidenceIds": ["desktop-tests"], "remainingFindingIds": ["DL-COV-03"]}, "expectedEvidenceLayer": ["packages/schemas/test/desktop-local-bridge.test.ts", "tests/e2e/desktop-cli-local-bridge-golden.test.ts"]}]

### REQ-PROOF-DESK-006: done-with-evidence / P2
Bounded requirement declaration: Provider credentials never cross CLI arguments, tool input, RPC, discovery, logs, evidence, project documents, or the engine bridge; local and BYOK routes carry no credit route.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "ENCRYPTED_LEASED_REDACTED_FIXTURE_PROOF_NOT_REAL_KEYRING_PROVIDER"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/provider-key-store.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"reference": "desktop/linux/src/renderer"}, {"reference": "desktop/linux/src/lib"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-006", "outcome": "ENCRYPTED_LEASED_REDACTED_FIXTURE_PROOF_NOT_REAL_KEYRING_PROVIDER", "evidenceIds": ["desktop-tests", "provider-origin-probe", "provider-readiness-probe"], "remainingFindingIds": ["DL-SEC-01", "DL-BYOK-02", "DL-PRIV-06"]}, "expectedEvidenceLayer": ["tests/desktop/desktop-byo-secure-storage.test.ts", "tests/e2e/desktop-provider-host-golden.test.ts"]}]

### REQ-PROOF-DESK-007: done-with-evidence / P2
Bounded requirement declaration: Ship → Export Web writes a contained content-addressed static viewer and Delivery Handoff without deploying.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "REAL_PACKAGED_CONTAINED_EXPORT_HANDOFF_DIGESTS_PROVEN_NO_DEPLOY"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/web-export.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/delivery-handoff.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-007", "outcome": "REAL_PACKAGED_CONTAINED_EXPORT_HANDOFF_DIGESTS_PROVEN_NO_DEPLOY", "evidenceIds": ["packaged"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-web-export-golden.test.ts"]}]

### REQ-PROOF-DESK-008: finding-mapped-to-root-tasks / P2
Bounded requirement declaration: macOS and Windows wrappers stage the Linux runtime but do not claim a public signed artifact or enable updates without real release inputs.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CROSS_LANE_NATIVE_RELEASE_PROOF_MISSING"]
- Source: []
- Targets/owners: [{"reference": "desktop/macos"}, {"reference": "desktop/windows"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-008", "outcome": "CROSS_LANE_NATIVE_RELEASE_PROOF_MISSING", "dependencies": ["desktop-release native macOS/Windows/signing"]}, "expectedEvidenceLayer": ["desktop/macos/test/seam.test.ts", "tests/e2e/desktop-project-build-golden.test.ts", "pnpm check:desktop"]}]

### REQ-PROOF-DESK-009: done-with-evidence / P2
Bounded requirement declaration: The umbrella editor constructs no canvas before identity and entitlement access succeeds; browser controls change URL state and never mutate engine state client-side.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "HEADLESS_ACCESS_URL_PARITY_TESTED_REAL_AUTHENTICATED_BROWSER_HOLE"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/site-kit/src/editor-shell.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "sites/umbrella/src/app/editor"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-009", "outcome": "HEADLESS_ACCESS_URL_PARITY_TESTED_REAL_AUTHENTICATED_BROWSER_HOLE", "evidenceIds": ["umbrella-editor-tests"], "dependencies": ["sites-ui/identity actual editor front door"]}, "expectedEvidenceLayer": ["tests/e2e/umbrella-editor-viewport-golden.test.ts", "tests/sites/web-experience-editor.test.ts", "docs/web-editor-shell.md"]}]

### REQ-PROOF-DESK-010: done-with-evidence / P2
Bounded requirement declaration: The desktop assistant supports deterministic Local and injected BYOK paths, while Hosted refuses because this tier owns no identity or credits.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "LOCAL_FIXTURE_LOOPS_PASS_HOSTED_KIDS_EXPECTED_DENY_BYOK_GUI_LIVE_PROOF_HOLE"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/electron/provider-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/assistant-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "authoring", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "DESK-010", "outcome": "LOCAL_FIXTURE_LOOPS_PASS_HOSTED_KIDS_EXPECTED_DENY_BYOK_GUI_LIVE_PROOF_HOLE", "evidenceIds": ["desktop-tests"], "remainingFindingIds": ["DL-COV-03", "DL-BYOK-02"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-provider-authoring-engine-golden.test.ts", "tests/e2e/desktop-linux-bridge-golden.test.ts"]}]

### REQ-PROOF-SURFACE-004: done-with-evidence / P2
Bounded requirement declaration: The packaged Linux desktop is R2 startable with contained New/Open/Recent lifecycle and bounded editor paths.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "FRESH_LOCAL_R2_PACKAGE_LAUNCHES_DRAWS_FULL_LIFECYCLE_EDITOR_ACCEPTANCE_INCOMPLETE"]
- Source: []
- Targets/owners: [{"reference": "desktop/linux"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-desktop-linux.json", "currentSemanticEntry": {"id": "SURFACE-004", "outcome": "FRESH_LOCAL_R2_PACKAGE_LAUNCHES_DRAWS_FULL_LIFECYCLE_EDITOR_ACCEPTANCE_INCOMPLETE", "evidenceIds": ["packaged", "captureEvidence"], "remainingFindingIds": ["DL-COV-03"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-linux-bridge-golden.test.ts", "pnpm check:desktop"]}]

## Shared requests and acceptance obligations

[{"lane": "desktop-linux", "sourceKey": "sharedChangeRequests", "requests": {"packages/schemas": "Only if truly new action/refusal vocabulary is needed; existing editor registry/local-tool vocabulary should be reused. No matrix widening or protection weakening.", "rootManifests": "No new root script needed for recommended fixes; use existing check:desktop/gate and smoke invocations.", "apps/desktop-shell/src/chrome.ts": "Shells owns typed GUI input/readiness and shared inline scripts, coordinate #53 and CSP hashes.", "packages/engine-presentation": "Engine lane owns mountTriangleAsset/disposal/performance counters; disposal exists, no leak assertion.", "docs": "Docs owner reconciles desktop-linux/local-bridge/capability/runnable claims only against fresh evidence; public offer remains release-owned, never local unpublished artifact.", ".github/workflows/desktop-linux.yml": "If existing smoke assertion inventory expands, preserve exact invocation/assertions and synchronize documentation; do not skip or weaken checks."}}]

Submit requested shared changes as exact path/symbol/current→recommended text/API/test deltas to integration; never concurrently edit reserved surfaces. Existing current helpers/public seams and boundary matrix dominate; no second authoring core/no direct CLI-engine imports/no invented provider/legal proof. Verify upstream external documentation before new stack/API or security-version use.

Reproduce confirmed defects through actual public front doors before patch; keep failing-before/passing-after oracles, rebuild dist before running Node binaries. Execute focused existing tests then report real exit/result/assertions/platform/coverage holes. Missing installations are local work, not external blockers. New verbs require ROOT_COMMANDS + SHIPPED_COMMAND_MAP + takesArgs + bin/golden/unknown-flag parity together. Kids shared path/empty dependents, only-advance, held currency-first and LIVE default-off stay intact.

Persist per-task outcome and node commands/evidence under this lane build report; do not claim production PASS. Integration owns FINAL.md/JSON, unchanged full gate, independent actual front doors and serial repair routing capped at three passes. Every remaining intentional capability and external request remains visible in full-production counts.
