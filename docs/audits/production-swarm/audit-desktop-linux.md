# Independent desktop/Linux production audit

Graph `sceneaxi-production-swarm` · node `audit-desktop-linux` · **audit PARTIAL / production PARTIAL; local fixes required**.

Root `/home/devuser/Documents/Projects/sceneaxi`; observed HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. Application source was read-only. This node writes only this report and `audit-desktop-linux.json`; ignored build/package artifacts were generated through existing scripts. No commit, push, signing, publication, provider call, account, spending or production mutation occurred. Other agents' report work is preserved.

## Evidence and limits

All commands ran through Empryo shell with cwd `/home/devuser/Documents/Projects/sceneaxi`. Existing tier scripts, root Vitest and the existing Electron `--smoke` boundary were used, not another harness/configuration. Root/ancestor EMPRYO absence is corroborated by baseline. Read AGENTS, desktop ownership sections, runnable-surfaces, production-activation, baseline, decisions, backlog and the dated September gap list. Those claims were not treated as current evidence.

| Command (absolute tier path abbreviated below only) | Exit / assertions | Limit |
|---|---|---|
| `pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux check:renderer` | 0; 91 browser inputs, one renderer owner | Structural graph, no pixels |
| Same `--dir` `build` | 0; main/preload/renderer/chrome and native contained publisher emitted | Bundled source, not installed desktop |
| `xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke` | **1**; asset selector/open failed; selected/opened false, frame/digest null; manifest/digest and protected refusals valid | Transient UI/environment failure retained, not classified as a permanent product defect |
| Same smoke under `dbus-run-session -- xvfb-run -a` | 0; 4 moving kernel ticks, reviewing→applied Save/reopen transform −3.25/45/1.5, add/remove/Reject/Undo, asset select/open/restart, Web export/handoff, WebGL pixels/drawCalls22 | Software renderer; does not cover every GUI feature |
| `xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged` before packaging | **1**, `no packaged binary; run pnpm dist first` | Local setup gap, not external blocker; resolved below |
| `pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux dist` | 0; AppImage + deb + SHA256SUMS; no cleanup TypeError; `publish: null` | Local unsigned 0.0.0 artifacts, not public release |
| `dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged` | 0; same substantive native proof, viewport frame7/drawCalls22 | linux-unpacked binary, not AppImage mount or deb installation |
| Independent SHA-256 recomputation | Both artifacts exactly match SHA256SUMS | Integrity of local bytes, not provenance/signing |
| `dbus-run-session -- xvfb-run -a node /home/devuser/Documents/Projects/sceneaxi/desktop/linux/scripts/smoke-diagnostics.mjs` | 0; real renderer crashed/reloaded, local event recorded | Synthetic renderer loss, not physical GPU crash |
| `pnpm exec vitest run tests/desktop` plus desktop/Linux, CLI socket, hierarchy, lifecycle, browser, transform, ingestion, export, assistant/full-editor goldens and `desktop/linux/test` | `PASS (274) FAIL (0)` | Hermetic seams/DOM/real socket and spawned CLI; not all packaged controls |
| `pnpm exec vitest run tests/e2e/umbrella-editor-viewport-golden.test.ts tests/sites/web-experience-editor.test.ts tests/parity/editor-shell-parity.test.ts` | `PASS (41) FAIL (0)` | DESK-009 headless access/URL-parity evidence; browser/access provider proof belongs to sites/identity |
| Public provider-runtime factory negative/positive probes (esbuild in-memory source bundle, injected fetch and fixture key only) | HTTP approved hostname dispatched bearer; HTTPS positive did too; PRC/untrusted hosts never fetched | Confirmed configurable-adapter defect; default packaged URL is HTTPS; no real network/key |
| Public BYOK configuration/runtime composition probe | OpenRouter configured→runtime ready; actual runner read opencode and refused missing key | Fixture store; confirms provider readiness mismatch, not live provider proof |

The full packaged proof and **real screenshot** are embedded in `audit-desktop-linux.json.captureEvidence`. Existing `SCENEAXI_SMOKE_SHOT`/Electron `capturePage()` produced PNG **1280×900, 271093 bytes**, SHA-256 `8d1b7c5e6073a8b738553df9a001c7be630ad1ab3d7cff1a5b05c1721e01b24e`. A first attempt using `/dev/stdout` failed with redacted startup failure; a normal report-path capture succeeded, so this is a harness-routing failure, not a confirmed product startup defect. Image bytes are embedded rather than creating a third owned file. PNG structure/dimensions were checked; no image-viewing tool was available, so **visual layout/accessibility correctness is not attested**.

Artifacts independently hashed:
- deb `13a155f5fae03ec248a0d66742e080c94c5b2ff64ced8f484e1779bc699eb617`
- AppImage `a426d1392487e345beabbbc61a485a041c2f6cddbf05f6b0446d0eed46ad42ac`

## Confirmed findings and prioritized implementable work

### DL-SEC-01 — P1/high: privileged BYOK API-base bypasses HTTPS contract

- **Source/symbol:** `desktop/linux/src/electron/live-transport.ts:70-109 createDesktopOpenCodeLiveTransport`; public entry `desktop/linux/src/electron/provider-runtime.ts:234-252 createDesktopOpenCodeProviderSession`.
- **Reproduction:** call public provider factory with `apiBase: "http://opencode.ai/zen/v1"`, injected fetch spy and fixture credential accessor; run `{profile:"@sceneaxi/profile-game",prompt:"a small stone",onProgress:noop}`. Spy observes `http:` and `bearerPresent:true`, `redirect:default-follow`. Returning `{}` correctly refuses output, but only after bearer dispatch.
- **Refutation:** HTTPS positive fetches; `https://api.deepseek.com/v1` and untrusted host refuse before fetch; packaged main passes no override and has safe HTTPS default. Thus this is a privileged configurable-adapter flaw, **not evidence of default GUI plaintext traffic or an actual leaked key**.
- **Impact:** an admitted hostname with HTTP/other unexpected URL attributes bypasses the documented HTTPS-only credential transport invariant. Default redirect following also lacks explicit approved-destination enforcement; no cross-origin bearer redirect leak is claimed (standard Fetch may strip it).
- **Owner/dependencies/fix:** Linux builder owns `live-transport.ts` and provider-runtime tests. Require HTTPS, no userinfo, approved origin/port before credential reads; use `redirect:"error"`; bound response body before parse. Reuse existing named provider-session refusal. No schema/matrix/dependency expansion needed.
- **Acceptance:** extend `tests/desktop/desktop-opencode-live-transport.test.ts` through the public factory: forbidden HTTP/userinfo/port/PRC/unknown origin → zero key reads/fetch; approved HTTPS positive; redirect fails closed; malformed/oversized/timeout body redacted. Run `pnpm exec vitest run tests/desktop/desktop-opencode-live-transport.test.ts tests/e2e/desktop-assistant-scene-loop-golden.test.ts`, tier build/smoke, unchanged gate. HTTP case is failing-before oracle.

### DL-BYOK-02 — P1/high: OpenRouter advertised ready but runner is OpenCode-only

- **Source/symbol:** `desktop/linux/src/lib/byo-configuration.ts:64-83 createDesktopByoConfiguration`; `desktop/linux/src/electron/provider-runtime.ts:203-225 createPrivilegedDesktopByoRuntime`; `desktop/linux/src/electron/main.ts:217-220 start` injects only opencode.
- **Reproduction:** public runtime with provider opencode and a fixture store having only OpenRouter configured. `configuration.handle({action:"status",provider:"openrouter",profile:"@sceneaxi/profile-game"})` returns storage/runtime `ready`. `runByoAssistant(...)` reads opencode and refuses `DESKTOP_PROVIDER_KEY_MISSING`.
- **Refutation:** host's runner intentionally pins opencode; both providers can safely store/remove keys. No secret crosses boundaries. The defect is global readiness applied to the unsupported selected provider, not the absence of live OpenRouter authority.
- **Impact:** user can configure the offered provider successfully and see readiness while Send cannot use it, or uses a different already-configured provider.
- **Owner/dependencies/fix:** Linux builder owns `lib/byo-configuration.ts`, `electron/provider-runtime.ts`, `renderer/byo-configuration.ts` and associated existing tests. Make runtime availability provider-specific; label unsupported OpenRouter unavailable/fixture-only, keep stored-key Remove. Prefer this locally achievable truthful default over adding a new provider/model/network route. Backlog59 is **partly local**, not wholly externally parked.
- **Acceptance:** public composition status for OpenRouter unavailable; opencode ready only with injected runner; no changed key read target from UI status; existing encrypted replace/remove/locked/Kids tests continue. Run `pnpm exec vitest run tests/desktop` and actual packaged BYOK status UI, without a real provider call.

### DL-COV-03 — P1/high: existing packaged smoke does not cover current full-editor front doors (#61)

- **Source/symbol:** `desktop/linux/scripts/smoke.mjs:78-198` assertion inventory; `desktop/linux/src/electron/main.ts:523-542 start` cancels native New/Open in smoke; `main.ts:835-914` browser UI smoke; `desktop/linux/README.md:63-64` explicitly disclaims later lifecycle work.
- **Reproduction/refutation:** fresh packaged smoke succeeds, proving older genuine pixel/authoring/export paths. Read executable assertions: there is no packaged native New/Open/Recent, Redo, hierarchy parenting/multi-select, import/reload dialog, assistant Ask/Build/approve/apply/cancel/timeout, or complete newer registered-control exercise. Root goldens prove these at lower layers; that does not refute the packaged coverage hole.
- **Impact:** green smoke can coexist with broken new controls or renderer/host wiring. Initial selector failure shows lower-level gate alone cannot close front-door readiness.
- **Owner/dependencies/fix:** Linux builder owns `src/electron/main.ts`, `scripts/smoke.mjs`; shells owns `apps/desktop-shell/src/chrome.ts` and its tests. Extend existing smoke (no parallel harness): explicit isolated dialogs via typed dialog port, actual control clicks/typed input, exact proposal/hash/Save persistence/Undo+Redo/reopen/frame oracles, stale-job/cancel/refusal oracles. Keep Local and no-network Agent fixtures separate from real BYOK evidence. Coordinate #53 GUI input fixes; do not route unavailable work as successful.
- **Acceptance:** build→dist→`dbus-run-session -- xvfb-run -a pnpm --dir /home/devuser/Documents/Projects/sceneaxi/desktop/linux smoke --packaged`; each required control has input/result/bytes/frame evidence, no disabled or skipped assertions. Record fresh capture and 3 consecutive unchanged full smoke runs. Explicit installation/AppImage/physical-GPU coverage remains separate.

### DL-COV-04 — P2/medium: asset selection smoke failed once, then passed unchanged

- **Source/symbol:** `desktop/linux/src/electron/main.ts:837-857` browser wait/selection; global `[data-busy]` readiness and 4-second predicate polling.
- **Observed impact:** first real built runtime failed selection/open; D-Bus-session retry, fresh package smoke and screenshot run passed. Historical GPU SIGSEGV did not recur. This is **unresolved environment/timing evidence**, not a confirmed permanent asset or GPU bug.
- **Fix/owner:** Linux+shells synchronize on actual browser-ready state/result and selected asset revision rather than all-document busy state; capture bounded diagnostics on failure. Do not simply increase sleep/timeout, skip or weaken predicates. Include in DL-COV-03, preserve first failure in integration results.
- **Acceptance:** exact smoke both documented Xvfb and D-Bus-session paths repeated, with selection/event/frame assertions. Reproducible failures route back within three passes.

### DL-HARD-05 — P2/medium: renderer document has no CSP (hardening gap, no exploit demonstrated)

- **Source/symbol:** `desktop/linux/src/lib/chrome-document.ts:82-110 desktopLinuxIndexHtml`; `src/electron/main.ts:442-451 start` sandbox/isolation/navigation protections.
- **Reproduction/refutation:** real built Electron emits the insecure/missing CSP warning; emitter adds runtime meta and renderer script only. Sandbox, no Node integration, navigation prevention and window-open denial are present. No unescaped-input/XSS exploit was found; do not misstate their absence.
- **Fix/owner/dependencies:** Linux document/build owner plus shells inline-script owner add deterministic inline-script hashes and explicit local-only script/object/frame/connect policy; deny browser permissions by default and validate IPC sender main-frame/document before privileged actions. BYOK network remains main-process only. No permissive `unsafe-eval` or package-edge widening.
- **Acceptance:** built/packaged document has enforcing CSP; actual chrome/viewport/assistant still work; injected remote script/frame/permissions/cross-frame IPC refuse. Run renderer check, desktop boundary suites, existing smoke and gate.

### DL-PRIV-06 — P2/medium: local raw minidumps remain sensitive despite redacted logs (#54)

- **Source/symbol:** `desktop/linux/src/electron/main.ts:115-129 start` starts no-upload crashReporter; `src/lib/diagnostics.ts:110-129 pruneDesktopCrashDumps` retains newest five at startup and warns dumps may contain decrypted BYOK memory.
- **Refutation:** no network upload; bounded structured diagnostics omit arbitrary messages/stacks; diagnostics smoke proves recovery. No real secret leakage was attempted or observed. The old categorical "no crash handling" is false.
- **Impact/fix:** raw crash memory cannot be treated like redacted logs. Safe local default: opt out of raw dumps unless explicit local consent; redacted event/recovery retained, no automatic sharing. Linux builder owns `main.ts`, `diagnostics.ts` and diagnostics tests; docs owner records sensitivity, local retention/removal and manual sharing warning. This local privacy default is achievable without buying telemetry or waiting for legal policy.
- **Acceptance:** no raw dump generation in default/BYOK session, renderer reload and redacted diagnostics still pass existing diagnostics smoke; synthetic tests establish opt-in/retention/removal without real credentials. External sharing/telemetry still requires actual policy/authority.

### DL-DOC-07 / DL-PERF-08 — P2/medium follow-ups

- **Docs:** `desktop/linux/README.md:99` says Ask refuses, while `src/renderer/assistant-start.ts:69` admits Ask and `src/renderer/viewport.ts:720-727` routes `assistant-ask`; current bridge tests cover Local assistant builds. Update README and `docs/desktop-linux.md`, `docs/desktop-local-bridge.md`, capability matrix/runnable-surface claims only after new packaged evidence. Owner Linux/docs with shells input; acceptance source/controls/docs parity + traceability. This is local, not a provider gate.
- **Performance:** current evidence uses small synthetic models and software WebGL; no maximum admitted asset, repeated hot reload/mount, memory/resource plateau, or physical GPU budget evidence. `src/renderer/viewport-playback.ts:121-145 mountDesktopScene` delegates real triangles to the sole backend; Three disposal is implemented (`packages/engine-presentation/src/three-sculpt.ts:346-353 unmount`), so a memory leak is **not** asserted. Add bounded repeated import/reload/play/export and teardown/latency/resource assertions in existing desktop/golden/smoke tests; coordinate engine-presentation for true backend resource counters only if needed. No broadened limits or disabled checks.

## Requirement and front-door coverage

| Requirement | Current audit evidence/outcome |
|---|---|
| DESK-001 shared vocabulary/counting | Desktop suite passes; schema/renderer graph present. #53 current GUI coverage/input ownership remains shells; no claim all controls drive |
| DESK-002 standalone chrome refuses | Baseline actual chrome refusal + desktop tests; intentional no viewport/runtime, not defect |
| DESK-003 one packaged implementation | Fresh build/package/native smoke + one renderer check; assistant comprehensive UI proof incomplete |
| DESK-004 first launch/native lifecycle | Source only-dialog/validated-recents + lifecycle golden passes; actual native chooser/New/Open/Recent not driven in smoke |
| DESK-005 closed same-user socket | local-rpc validates exact envelope/capability/permission, private socket/descriptor; real socket + spawned CLI golden passes; native host rebind/crash cleanup still needs expanded smoke |
| DESK-006 credential separation/no credits | encrypted/leased/redacted store tests pass, basic_text refuses; no real keyring credential stored; DL-SEC-01/DL-BYOK-02 and raw-dump risk remain |
| DESK-007 offline contained Web export | Actual packaged export/handoff and independently compared digests; no deploy; clean-bound-project refusal intentional |
| DESK-008 platform wrappers/no release claim | Native macOS/Windows and signatures outside Linux audit; desktop-release owns actual proof/gates; never infer from Linux |
| DESK-009 entitled umbrella editor | 41 targeted headless access/URL/parity tests pass; cross-lane sites/identity must furnish real browser authenticated/refused canvas proof |
| DESK-010 Local/BYOK/Hosted | Local/fixture lower-level loops pass; Hosted/Kids deny intentionally, not defects; live provider and packaged assistant controls not proved |
| SURFACE-004 packaged Linux R2 | Fresh local package launches/draws; fuller New/Open/Recent/full-editor acceptance incomplete; no public-release assertion |

Required workflow coverage: **Save/reopen/Undo/transform/asset browser/Play/Export Web** actual packaged smoke PASS within bounds; **New/Open/Recent native dialogs, Redo, hierarchy, import/reload, Ask/Build/approve/apply and secure real-keyring/provider CLI lifecycle** lower-layer proof only or coverage holes. Full-production PASS is prohibited while these or external inputs remain.

## Existing backlog revalidation and remaining gates

- **54 done:** old missing-crash claim refuted by current handlers, redacted rotating local log and live diagnostics reload. Raw dumps/sharing still need DL-PRIV-06; no paid telemetry implied.
- **59 parked:** OpenCode live transport implementation exists but no real configured-provider proof; OpenRouter public composition remains injected/fixture, not live shipment. Readiness mismatch/HTTP guards can and should be fixed locally now. Do not invent a model/version/provider verification.
- **60 done:** no historical GPU SIGSEGV reproduced; SwiftShader pixel smoke passes. Physical GPU cause/driver matrix unproven, retain prior openDecision; first asset-selection failure is a separate issue.
- **61 open:** confirmed, DL-COV-03; locally achievable extension, not permission to leave interrupted work.
- **89 done:** freshly executed dist exits0, both package hashes match; stale cleanup TypeError refuted.
- **53 shells / 64 engine:** newer control dispatch/input and audio acceptance require coordinated Linux smoke; no schemas/root manifests edits from this auditor.
- **52/55/56/58 desktop-release:** local AppImage/deb bytes do not resolve stale public offer, genuine signed native macOS/Windows builds, update authentication or separately authorized publication. Maintain disabled update/public-download boundaries until genuine record exists.

**Exact shared-change requests:** packages/schemas editor registry/shared local-tool vocabulary only if a builder truly needs a new action; reuse existing admitted actions/refusals, no additional matrix edges. `apps/desktop-shell/src/chrome.ts` owns control inputs/readiness and shared inline script; engine-presentation owns triangle rendering/disposal/resource instrumentation and engine lane owns audio/runtime. Root package scripts need no new script for these fixes; if existing smoke assertion inventory is expanded, synchronize `.github/workflows/desktop-linux.yml`/owning docs with unchanged invocation. Docs owner updates the aforementioned Linux/local-bridge/capability/runnable/activation claims based on fresh bytes; desktop-release/site-kit owns public offer (never overwrite it with an unpublished local artifact).

**External requests:** real OS keyring availability/unlocked supported backend plus explicit configured BYOK credential and authority for any live network/provider usage; name-only model/API contract verification and actual live completion evidence (no fixture substitution). Genuine native macOS/Windows hosts/signing/notarization/certificates and platform/action-bound authority belong to release lane. Public Release/update feed requires separately named verified artifact/source/hash/operator/window/rollback/publication authority. Keep Kids, held-key epoch/currency and Hosted/LIVE default-off gates untouched. No secret values belong in FINAL or this report.

Audit status is PARTIAL because required front-door/visual/platform coverage remains incomplete. Confirmed local failures must route to Linux/shells integration; final production status cannot be PASS. Machine-readable per-task and per-requirement outcomes, commands, failures, external inputs and capture are in the companion JSON.
