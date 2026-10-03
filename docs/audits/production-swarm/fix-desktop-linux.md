# Linux implementation outcome — PARTIAL

Graph `sceneaxi-production-swarm`; node `fix-desktop-linux`; role `code`.
Real checkout `/home/devuser/Documents/Projects/sceneaxi`; rechecked HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. Checkout already contained work from multiple lanes; no clean-tree claim. Preserved it.

## Actual edits in this continuation

- `desktop/linux/src/electron/main.ts:725` — native Play smoke now opens the real `run-play` menu through enabled/visible controls, instead of selecting an unrelated disabled match.
- `desktop/linux/src/electron/main.ts:632` — actual BrowserWindow CSP negative probes for injected inline and remote scripts, remote frame network refusal, and denied Notification permission. Synthetic probes only; no credentials, provider requests or legal/signing claims.
- `desktop/linux/src/electron/main.ts:729` — smoke-only native PNG capture, explicit window visibility and compositor frames.
- `desktop/linux/scripts/smoke.mjs:61,81` — capture path resolved from script directory into excluded build evidence, with required PNG signature assertion. Existing control, byte, frame and export assertions remain intact.

Earlier Linux implementation already present at entry was retained: bounded privileged transport, provider-specific readiness, Local-route preservation, deterministic CSP, trusted main-frame IPC, explicit sensitive-dump consent, isolated typed New/Open choices, and assistant staging without automatic approval. These are not falsely attributed as edits newly made by this continuation.

## Per-item outcomes

| Task | Outcome | Evidence / outstanding acceptance |
| --- | --- | --- |
| DL-SEC-01 | DONE, bounded local | 13 synthetic hardening regressions pass, including rejection before credential reads/fetch, exact origin, redirects, oversize/stalled body cancellation and redaction. No live provider proof. |
| DL-BYOK-02 | DONE, bounded local | Injected runner only advertises its provider; unsupported provider unavailable; Remove and Kids refusal retained; Local route preserved. Real keyring/provider evidence absent. |
| DL-COV-03 | PARTIAL, local FAIL | Play-selector failing-before/passing-after reproduced. Pre-capture runtime and three consecutive fresh linux-unpacked runs prove native New/Open, hierarchy/transform, exact Save/Undo/Redo bytes, Local Ask/Build/staging/explicit approval, Play and contained Web export. **Current screenshot-enabled runtime fails before proof line.** Native Recent/import/reload/cancel/timeout/new command coverage still incomplete. |
| DL-COV-04 | PARTIAL | Prior exact project-root/hierarchy readiness and repeated browser evidence retained; original browser selection revision fix not independently proven. Current final smoke must be repaired and repeated. |
| DL-HARD-05 | PARTIAL | Hash/CSP tests, renderer graph and actual CSP/permission probes exercised. Hostile non-main/document IPC negative assertion and final current-source host PASS outstanding. |
| DL-PRIV-06 | PARTIAL | Synthetic zero-retention purge preserves log; real renderer crash/reload diagnostics passed. Real BYOK/default dump absence, opt-in retention and shared documentation acceptance outstanding. |
| DL-DOC-07 | Integration-owned request | Correct Local Ask/Build/review guidance; distinguish fixture, live, unsigned package and failed current native evidence. README and shared docs ownership retained. |

## Commands and retained failures

All shell commands used the real app cwd. `project test` reported **No test command detected**, so exact pnpm commands were used. The initial workspace filter matched no projects and was **not** accepted as verification; corrected to `pnpm -C desktop/linux typecheck`.

- `pnpm -C desktop/linux typecheck`: exit 0 after final main edit.
- Focused owned tests + live transport + injected desktop boundary: **59 passed, 0 failed** before final capture-visibility edit.
- `pnpm -C desktop/linux check:renderer`: exit 0, 92 inputs through one presentation owner.
- Broader `tests/desktop` + boundary suite: exit 1, **131 passed, 2 failed**, both `tests/desktop/desktop-windows-packaging.test.ts`: line 86 expects `publish: "onTagOrDraft"`; line 130 update-transport refusal mismatch. Routed to desktop-release/integration, no shared edits.
- Initial plain smoke: exit 1, Electron **SIGSEGV**, no proof line. Retained, not silently replaced with green aggregate.
- D-Bus/Xvfb smoke initially failed `SMOKE_CONTROL_FAILED [data-command="run-play"]`; actual menu repair passed equivalent host smoke.
- Pre-capture runtime and three fresh packaged runs: exit 0; actual Three/WebGL pixels, 17 draw calls, four deterministic tick digests, persisted-byte and export assertions.
- `dbus-run-session -- xvfb-run -a node desktop/linux/scripts/smoke-diagnostics.mjs`: exit 0, renderer reloaded/local event recorded.
- Latest `pnpm -C desktop/linux dist`: exit 0, local unsigned .deb/AppImage, **no publication**. Default Electron icon/desktopName warnings remain.
- Latest capture-enabled D-Bus/Xvfb runtime: **exit 1**. Output: `smoke FAILED — the packaged app did not print its proof line`; `{"ok":false,"message":"Desktop startup failed. See local logs."}`. Expected blocked inline/remote-script/frame CSP messages precede failure. Cause unproven: **local failure, not an external blocker**.
- Three bounded capture/visibility/path repair attempts exhausted. Final packaged repeats and `file`/SHA256 image checks were **not executed** because the chained runtime command failed. No successful screenshot claim.
- Whole-tree gates/contracts/traceability deferred to serial integration, per concurrent lane restrictions, not represented as passed or irrelevant.

Latest local artifacts:

- `.deb`: `b512dcf664147189bc9993ac401301d4c79fce7955f607bf661116b56b7be786`
- `.AppImage`: `ffabd6652616caeea458fa634a5c18258d10fba77a91d8d41959237df15084f9`

## Integration route and missing inputs

Repair the current native startup/capture failure with isolated redacted logs, preserving all old byte/frame and new security/PNG assertions; independently repeat current runtime and three fresh packaged front doors. Finish remaining GUI/IPC/browser/dump acceptance. Resolve Windows failures and shared docs parity in their owning lanes. Full provider/keyring/model, supported release-host, legal/signing/publication evidence remains unsupplied; none was invented.

Smoke driver removes isolated XDG config after the child returns. Local build/dist/release resources are retained for integration. Failed-startup temporary project cleanup, especially the new-project root, must be inspected; no broad prefix deletion of potentially unrelated roots was performed. No background jobs, stash/reset/clean, commit/push, deploy/publish, production changes or secret output.

Machine-readable per-task/status/evidence details: `fix-desktop-linux.json`. This lane does not own global FINAL reports; integration must incorporate these explicit remaining gaps.
