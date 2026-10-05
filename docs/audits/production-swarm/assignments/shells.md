# Builder assignment — shells

Graph `sceneaxi-production-swarm`; role `code`; real root/cwd `/home/devuser/Documents/Projects/sceneaxi`. Read-only audit input `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json` and its MD; full source findings are preserved in MEGALIST.json.

## Exclusive exact source/test path ownership

Only the following existing/new exact paths are claimed by this lane. Existing owning docs/README, manifests/locks/config, schemas/site-kit, tests/*, scripts/*, workflows and SQL migrations are **RESERVED integration after all builders**. No adjacent-file ownership is implied; request any additional exact path before editing.
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/bin/sceneaxi-desktop.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/app.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/commands.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/product-loop.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/protocol-client.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/session.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-tokens.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/app.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/bin-smoke.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/chrome.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/control-accounting.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/open-path.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/product-loop.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/protocol-client.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/seam.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/session-recovery.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/visual-model.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/test/visual-tokens.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/bin/sceneaxi-web-shell.mjs`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/account-panel.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-default.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/dev-server.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/open-path-view.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/panel-support.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/protocol-client.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/account-panel.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/assistant-panel.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/bin-smoke.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/dev-server.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/inspector-app.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/inspector.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/minimum-e2.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/open-path-view.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/refuse-matrix.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/seam.test.ts`

## Full assigned scope / measurable acceptance

Historical backlog IDs: [53, 57]. Authority requirement IDs: ['SURFACE-002', 'SURFACE-003'].

### COVERAGE-SHELLS: implementation-needed / P1
Remaining current-source/front-door coverage: shells
- Chosen solution: Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
- Acceptance: ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "Native packaged Electron launch and GPU pixels not performed by this node", "All66 native GUI commands not exercised", "Gamepad hardware/OS keychain/live BYOK not exercised", "No long-duration exhaustion/concurrent queue load measurement", "No real provider/production billing/signing/macOS/Windows proof", "No automated accessibility audit; control accounting is not full accessibility certification"]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json"]

### SH-T01: implementation-needed / P1
Sentinel absent from500; state200 after error; expected named diagnostics preserved.
- Chosen solution: Sentinel absent from500; state200 after error; expected named diagnostics preserved.
- Acceptance: ["Sentinel absent from500; state200 after error; expected named diagnostics preserved."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/inspector-app.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/dev-server.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []
- Commands: ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/inspector-app.test.ts /home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/dev-server.test.ts"]

### SH-T02: implementation-needed / P1
Repeat real Chromium E3 with root replacement, cleared rejected diff and aborted/nonJSON/uncertain Accept, explicit accessible feedback and no pageerror; no writes until accept and CLI byte parity.
- Chosen solution: Repeat real Chromium E3 with root replacement, cleared rejected diff and aborted/nonJSON/uncertain Accept, explicit accessible feedback and no pageerror; no writes until accept and CLI byte parity.
- Acceptance: ["Repeat real Chromium E3 with root replacement, cleared rejected diff and aborted/nonJSON/uncertain Accept, explicit accessible feedback and no pageerror; no writes until accept and CLI byte parity."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/inspector-app.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []
- Commands: ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/inspector-app.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/parity/shell-cli-parity.test.ts"]

### SH-T03: implementation-needed / P1
GUI effective binding and persisted map actually change, approval/stale/Kids refused; keyboard changes observed; no assertion weakening.
- Chosen solution: GUI effective binding and persisted map actually change, approval/stale/Kids refused; keyboard changes observed; no assertion weakening.
- Acceptance: ["GUI effective binding and persisted map actually change, approval/stale/Kids refused; keyboard changes observed; no assertion weakening."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["desktop-linux real host/input acceptance"]
- Evidence/reproduction: []
- Commands: ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-linux-bridge-golden.test.ts"]

### SH-T04: implementation-needed / P1
Real GUI→host typed operations stage then Save canonical changes; reject unchanged; bad references/stale hash refused.
- Chosen solution: Real GUI→host typed operations stage then Save canonical changes; reject unchanged; bad references/stale hash refused.
- Acceptance: ["Real GUI→host typed operations stage then Save canonical changes; reject unchanged; bad references/stale hash refused."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-prefab-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []
- Commands: ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-prefab-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts"]

### SH-T05: implementation-needed / P1
GUI source changes real single viewport owner; physics replay deterministic and read-only; invalid/Kids refused.
- Chosen solution: GUI source changes real single viewport owner; physics replay deterministic and read-only; invalid/Kids refused.
- Acceptance: ["GUI source changes real single viewport owner; physics replay deterministic and read-only; invalid/Kids refused."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["desktop/linux/src/renderer/viewport.ts", "desktop/linux/src/renderer/viewport-playback.ts"]
- Evidence/reproduction: []
- Commands: ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-play-session-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-physics-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts"]

### SH-T06: implementation-needed / P1
GUI uses inspected contained locator/digests/approval and real lock changes; escape/stale/Kids refuse, no network marketplace activation.
- Chosen solution: GUI uses inspected contained locator/digests/approval and real lock changes; escape/stale/Kids refuse, no network marketplace activation.
- Acceptance: ["GUI uses inspected contained locator/digests/approval and real lock changes; escape/stale/Kids refuse, no network marketplace activation."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-package-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["assets-plugins contained lock/locator semantics", "desktop-linux"]
- Evidence/reproduction: []
- Commands: ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-package-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts"]

### SH-T07: implementation-needed / P1
Actual GUI migration review/commit changes owned fixture; extension id/capability approval reaches host or genuine typed refusal; no arbitrary sandbox claim.
- Chosen solution: Actual GUI migration review/commit changes owned fixture; extension id/capability approval reaches host or genuine typed refusal; no arbitrary sandbox claim.
- Acceptance: ["Actual GUI migration review/commit changes owned fixture; extension id/capability approval reaches host or genuine typed refusal; no arbitrary sandbox claim."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/visual-model.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["authoring migration/journal authority", "desktop-linux approved extension host"]
- Evidence/reproduction: []
- Commands: ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-extension-seams-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-project-lifecycle-golden.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts"]

### SH-T09: finding-mapped-to-root-tasks / P1
Actual packaged Linux controls/input and source ownership verified for new GUI actions; canonical persistence/replay and real viewport changes. Native environment failure must be recorded, not hidden.
- Chosen solution: Actual packaged Linux controls/input and source ownership verified for new GUI actions; canonical persistence/replay and real viewport changes. Native environment failure must be recorded, not hidden.
- Acceptance: ["Actual packaged Linux controls/input and source ownership verified for new GUI actions; canonical persistence/replay and real viewport changes. Native environment failure must be recorded, not hidden."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/viewport.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/renderer/viewport-playback.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: []
- Commands: ["pnpm gate"]

### SHELL-001: finding-mapped-to-root-tasks / P1
Typed GUI controls for eight missing ids using existing host and review/Save rules.
- Chosen solution: Typed GUI controls for eight missing ids using existing host and review/Save rules.
- Acceptance: ["Real GUI click reaches host; actual mutation or evidence change verified; invalid/Kids/stale hash refuse."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts", "line": 98, "symbol": "DESKTOP_INTERACTION_COMMANDS"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": 4316, "symbol": "commandHandlers"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/interaction-commands.ts", "line": 98, "symbol": "DESKTOP_INTERACTION_COMMANDS", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": 4316, "symbol": "commandHandlers", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: ["desktop-linux host", "existing schemas registry"]
- Evidence/reproduction: {"reproduction": "Inventory66 accepted desktop-control registry commands; eight ids absent from all desktop-shell source and Linux renderer, no menu/palette/control dispatch path.", "refutationAttempt": "Examined computed dispatch, host bridge/local-tool surface and newer timeline/run/material controls. Existing backend/local-agent path does not create GUI reachability.", "impact": "Reusable-content, input inspection, viewport-source and physics-evaluation operations remain inaccessible in desktop GUI.", "status": "confirmed-open"}

### SHELL-002: finding-mapped-to-root-tasks / P1
Collect complete current-schema fields, inspected digests and explicit approvals; never weaken validation.
- Chosen solution: Collect complete current-schema fields, inspected digests and explicit approvals; never weaken validation.
- Acceptance: ["Each real GUI valid-input case reaches host and changes fixture/effective binding; reject/stale/escape/unauthorized/Kids stay refused."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": 4219, "symbol": "runEditorCommand"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": 58, "symbol": "INPUT_REQUIRED_COMMANDS"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/src/chrome.ts", "line": 4219, "symbol": "runEditorCommand", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/tests/e2e/desktop-command-interactions-golden.test.ts", "line": 58, "symbol": "INPUT_REQUIRED_COMMANDS", "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: ["assets-plugins", "authoring", "desktop-linux"]
- Evidence/reproduction: {"reproduction": "Click six listed input-required menu/palette rows: handler sends empty object and shared validator refuses before host.", "refutationAttempt": "Dispatch handlers do exist, disproving older no-handler statement. Tests intentionally pin validator refusal because no input is collected; exit0 is not feature success.", "impact": "Package changes, migration commit, approved extension launch and binding changes advertised by registry cannot be completed via these GUI rows.", "status": "confirmed-open"}

### SHELL-004: finding-mapped-to-root-tasks / P1
Catch fetch/parse exceptions, accessible failure/unknown state, reread authoritative state before further writes; no automatic accept retry.
- Chosen solution: Catch fetch/parse exceptions, accessible failure/unknown state, reread authoritative state before further writes; no automatic accept retry.
- Acceptance: ["Abort/nonJSON/uncertain Accept: no pageerror, explicit feedback, disabled unsafe retry until reconciliation; no duplicate or blind write."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 787, "symbol": "inspectorPageHtml.call"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 787, "symbol": "inspectorPageHtml.call", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": "Chromium route.abort for actual /api/propose; Failed to fetch unhandled pageerror, note empty, phase remains old applied.", "refutationAttempt": "Backend remained healthy; transport failure simulation deliberately isolates browser recovery/error handling. JSON parse failure follows same uncaught path.", "impact": "User sees no failure/uncertain-outcome guidance and may retry acceptance after an ambiguous write result.", "status": "confirmed-open"}

### SHELL-006: finding-mapped-to-root-tasks / P1
Generic handler-failed public response in both catches; preserve expected typed refusals, never log raw secret-bearing error.
- Chosen solution: Generic handler-failed public response in both catches; preserve expected typed refusals, never log raw secret-bearing error.
- Acceptance: ["Sentinel absent in500 both sync/async public boundaries and real socket; reason/status unchanged; server survives; expected diagnostics retain contract."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 648, "symbol": "handleSync"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 680, "symbol": "handleAsync"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 648, "symbol": "handleSync", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 680, "symbol": "handleAsync", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: ["delivery-ops only if shared redacted diagnostic helper added"]
- Evidence/reproduction: {"reproduction": "Public injected AssistantPanel.ask throws safe AUDIT_REDACTION_SENTINEL; actual socket HTTP500 body echoes it; subsequent state200 succeeds.", "refutationAttempt": "Normal model/billing failures are sanitized/by-value; unexpected catch path still echoes arbitrary exception.message. No actual secret leak claimed.", "impact": "Configured embedders can expose provider/credential/internal error text in served response.", "status": "confirmed-open"}

### LOCAL-PROOF-057: done-with-evidence / P2
Bounded implemented portion: Fake controls
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "backlogDisposition": {"id": 57, "datedStatus": "done", "revalidatedStatus": "truthful-refusals-retained-capabilities-incomplete", "source": ["apps/desktop-shell/src/visual-model.ts:1371-1372", "apps/desktop-shell/src/chrome.ts:159,191,575,733,927,2307"], "staleClaimRefuted": "Console is now a real host evidence log, not merely inert.", "intentionalRefusals": ["hosted assistant metering unavailable and visibly named", "project-browser Rename/Delete inert to preserve canonical boundaries", "Compose explicitly has no bound composition editor"], "remaining": "Full capabilities still absent; Plugins mutating generic commands affected by SHELL-002. Do not widen matrix or activate hosted billing from a refusal-control fix."}}]

### REQ-PROOF-SURFACE-002: done-with-evidence / P2
Bounded requirement declaration: The desktop shell is R2 startable from its built binary and standalone chrome command.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "bounded-local-proof"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/desktop-shell/bin/sceneaxi-desktop.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "currentSemanticEntry": {"id": "SURFACE-002", "symbols": ["DesktopSession", "createDesktopSession"], "source": "apps/desktop-shell/src/session.ts:91", "outcome": "bounded-local-proof", "evidence": ["E1", "E3", "E6"], "remaining": ["SHELL-001", "SHELL-002", "native packaged GUI coverage"]}, "expectedEvidenceLayer": ["apps/desktop-shell/test/bin-smoke.test.ts", "tests/e2e/desktop-product-loop-golden.test.ts"]}]

### REQ-PROOF-SURFACE-003: done-with-evidence / P2
Bounded requirement declaration: The web shell is R2 startable on loopback and exposes the existing inspector and assistant transport.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "bounded-local-proof-with-local-defects"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/bin/sceneaxi-web-shell.mjs", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-shells.json", "currentSemanticEntry": {"id": "SURFACE-003", "symbols": ["createInspectorApp", "createInspectorSession", "createAssistantPanel", "parseDevServerArgs", "LOOPBACK_HOSTS"], "source": "apps/web-shell/src/inspector-app.ts:398; inspector.ts:54; assistant-panel.ts:449; dev-server.ts:122,53", "outcome": "bounded-local-proof-with-local-defects", "evidence": ["E1", "E2", "E3", "E4"], "remaining": ["SHELL-003", "SHELL-004", "SHELL-005", "SHELL-006", "SHELL-007", "real provider use"]}, "expectedEvidenceLayer": ["apps/web-shell/test/bin-smoke.test.ts", "tests/parity/shell-cli-parity.test.ts"]}]

### SCOPE-COMPOSE-UI: intentional-nonlaunch-capability / P2
General composition-editor and project-file rename/delete capability excluded
- Chosen solution: Expose supported typed controls; preserve canonical/journal/asset ownership. Inert/refused general composition/rename/delete must stay truthful and counted; standalone chrome has no runtime.
- Acceptance: ["Supported bounded workflows and named unsupported/refused states match actual controls/public tests; broader capability remains visible until genuinely implemented."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []

### SH-T08: implementation-needed / P2
120-turn/UTF8/response bounds and concurrent admission; mode capture/ledger/debit/Kids unchanged; honest truncation, no late debit race.
- Chosen solution: 120-turn/UTF8/response bounds and concurrent admission; mode capture/ledger/debit/Kids unchanged; honest truncation, no late debit race.
- Acceptance: ["120-turn/UTF8/response bounds and concurrent admission; mode capture/ledger/debit/Kids unchanged; honest truncation, no late debit race."]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/panel-support.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/assistant-panel.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/account-panel.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: ["account-panel shared queue tests", "schemas/doc vocabulary owner if contract additions needed"]
- Evidence/reproduction: []
- Commands: ["pnpm exec vitest run /home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/assistant-panel.test.ts /home/devuser/Documents/Projects/sceneaxi/apps/web-shell/test/account-panel.test.ts /home/devuser/Documents/Projects/sceneaxi/tests/e2e/assistant-panel-golden.test.ts"]

### SHELL-003: finding-mapped-to-root-tasks / P2
Clear or explicitly mark history whenever snapshot has no current diff.
- Chosen solution: Clear or explicitly mark history whenever snapshot has no current diff.
- Acceptance: ["Reject/idle/error/null snapshots never display old proposal as current; accepted historical view remains honestly labeled."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 780, "symbol": "inspectorPageHtml.render"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 780, "symbol": "inspectorPageHtml.render", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": "Chromium Propose then Reject; phase rejected/file unchanged but previous diff text remains.", "refutationAttempt": "Session really clears proposal/renderedDiff; renderer only replaces truthy diff, proving renderer defect not authoring mutation.", "impact": "Rejected/outdated change remains visually presented as current diff.", "status": "confirmed-open"}

### SHELL-005: finding-mapped-to-root-tasks / P2
Remove required only on pointer, retain other fields and server/core validation.
- Chosen solution: Remove required only on pointer, retain other fields and server/core validation.
- Acceptance: ["Valid root replacement submits/reviews; invalid document still refuses and reject leaves bytes untouched."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 747, "symbol": "inspectorPageHtml"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 458, "symbol": "propose"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 747, "symbol": "inspectorPageHtml", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/inspector-app.ts", "line": 458, "symbol": "propose", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": "Set #jsonPointer empty; native input.checkValidity returns false and form cannot submit.", "refutationAttempt": "Route explicitly allows empty/root pointer; canonical validation remains in core, so browser required mismatch is real.", "impact": "Valid public root replacement cannot be initiated with form.", "status": "confirmed-open"}

### SHELL-007: finding-mapped-to-root-tasks / P2
Count+UTF8 byte transcript bound and bounded admission; maintain mode capture/ledger ordering/idempotency and honest truncation.
- Chosen solution: Count+UTF8 byte transcript bound and bounded admission; maintain mode capture/ledger ordering/idempotency and honest truncation.
- Acceptance: ["Boundary/UTF8/120-turn/concurrency probes remain bounded; existing credit/Kids/refusal tests unchanged; no race-and-forget provider timeout."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": 555, "symbol": "turns"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": 784, "symbol": "ask"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/panel-support.ts", "line": 105, "symbol": "createOperationQueue"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": 555, "symbol": "turns", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/assistant-panel.ts", "line": 784, "symbol": "ask", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/apps/web-shell/src/panel-support.ts", "line": 105, "symbol": "createOperationQueue", "existsAtSynthesis": true, "writeOwner": "shells", "baselineSourceReadOnly": true}]
- Dependencies: ["account-panel shares operation queue", "schemas/doc owner for added busy/truncation vocabulary"]
- Evidence/reproduction: {"reproduction": "120 sequential fixture asks with2048-byte prompts retain120 turns; complete snapshot response grows2883→315615 bytes.", "refutationAttempt": "Per-request64KiB limit does hold, but does not bound cumulative transcript/response. Full session history is intentional yet unbounded retention/serialization unnecessary.", "impact": "Long-lived local session accumulates memory and repeatedly serializes entire history; admission queue also source-confirmed unbounded, not measured outage.", "status": "confirmed-open"}

## Shared requests and acceptance obligations

[{"lane": "shells", "sourceKey": "sharedChangeRequests", "requests": [{"owner": "schemas", "paths": ["packages/schemas/src/editor-command-registry.ts", "packages/schemas/src/desktop-local-bridge.ts"], "request": "Existing typed definitions suffice for missing GUI; do not weaken validator or accepted clients. New busy/truncation/proof vocabulary, if required, gets schema-owner contract tests."}, {"owner": "root-manifests-and-boundaries", "paths": ["package.json", "docs/dependency-matrix.json"], "request": "No dependency/script/matrix change recommended or necessary; do not add shell engine/site/billing bypass."}, {"owner": "delivery-ops-and-integration", "paths": ["docs/runnable-surfaces.md", "docs/engine-desktop-surface.md", "docs/full-editor-v1-capability-matrix.md", "docs/audits/go-live-backlog.json", "docs/audits/go-live-gaps-2026-09-26.md"], "request": "Reconcile dated claims/status after semantic GUI proofs; preserve explicit capabilities and refusal limitations."}, {"owner": "shells-builder", "paths": ["apps/web-shell/README.md"], "request": "Document redacted errors, unknown transport outcome and bounded transcript/admission semantics after fixes."}, {"owner": "desktop-linux", "paths": ["desktop/linux/src/renderer/viewport.ts", "desktop/linux/src/renderer/viewport-playback.ts", "desktop/linux/src/lib/bridge.ts"], "request": "Own native input/viewport/bridge acceptance; coordinate rather than concurrent edits."}]}]

Submit requested shared changes as exact path/symbol/current→recommended text/API/test deltas to integration; never concurrently edit reserved surfaces. Existing current helpers/public seams and boundary matrix dominate; no second authoring core/no direct CLI-engine imports/no invented provider/legal proof. Verify upstream external documentation before new stack/API or security-version use.

Reproduce confirmed defects through actual public front doors before patch; keep failing-before/passing-after oracles, rebuild dist before running Node binaries. Execute focused existing tests then report real exit/result/assertions/platform/coverage holes. Missing installations are local work, not external blockers. New verbs require ROOT_COMMANDS + SHIPPED_COMMAND_MAP + takesArgs + bin/golden/unknown-flag parity together. Kids shared path/empty dependents, only-advance, held currency-first and LIVE default-off stay intact.

Persist per-task outcome and node commands/evidence under this lane build report; do not claim production PASS. Integration owns FINAL.md/JSON, unchanged full gate, independent actual front doors and serial repair routing capped at three passes. Every remaining intentional capability and external request remains visible in full-production counts.
