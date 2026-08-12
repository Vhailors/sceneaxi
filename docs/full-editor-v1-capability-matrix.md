# Full desktop editor v1 capability matrix

This is the canonical inventory and todo index for SceneAxi full desktop editor
v1. It records the repository at `482ccc0` (2026-08-11) before the full-editor
implementation program starts. The parent specification is
[sceneaxi#249](https://github.com/Vhailors/sceneaxi/issues/249); the product-scope
parent remains [sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1).

Issue #250 has since landed the first command-registry slice described below;
the rows name that evidence without claiming any capability owned by #251 or
later. The matrix reports current behavior. A `live` control in the visual model is not
automatically **real** here: `live` means that a packaged host may bind it, while
this inventory follows the request through the host and checks what happens.

## Status vocabulary

| Status | Meaning |
|---|---|
| **real** | The current product performs the behavior, persists or reports its real result where applicable, and has evidence at its highest available public seam. A capability may still be intentionally narrow. |
| **partial** | A real path exists, but the exposed capability covers only a bounded subset of full-editor v1 or lacks an applicable client/platform proof. The row names the smallest next dependency. |
| **fake** | No product operation backs the exposed interaction or state. An honest fake is visibly disabled with a named refusal; an active-looking interaction that only refuses after use still needs to become real or visibly disabled. |

Test-only fixtures are evidence inputs, not product capabilities. An empty panel
that says it has no data is not fabricated output, but the capability behind the
panel remains fake or partial until a real command can populate it.

## Inventory accounting

The shared shell model owns **86 unique control ids** across all modes and runtime
projections. A default Game or Web render contains 85 because `dock-timeline`
exists only in Animate while other dock tabs are mode-dependent. The union below
comes from `desktopVisualView()` and is enforced model-to-document and
document-to-model by
`apps/desktop-shell/test/control-accounting.test.ts`. Mounted behavior is covered
by `tests/e2e/desktop-control-inventory-golden.test.ts` and
`tests/e2e/desktop-command-interactions-golden.test.ts`.

The packaged Linux renderer injects four more interactive elements beside that
model: the OpenRouter provider select, password input, Save/Replace key button,
and Remove key button. Their availability is decided by
`desktop/linux/src/lib/byo-configuration-view.ts` and tested in
`tests/desktop/desktop-byo-secure-storage.test.ts`. They are deliberately not
counted as shell controls, so the current packaged-window union is **90**.

The CLI exposes **20 verbs** from `packages/cli/src/commands.ts`; the Electron
bridge exposes **10 actions**, **9 authoring operations**, and **3 legacy
assistant transport operations** from `desktop/linux/src/lib/bridge-contract.ts`;
the same-user local agent bridge exposes **14 tools** from
`packages/schemas/src/desktop-local-bridge.ts`. Their transport names remain
distinct, but first-slice product operations now derive from the one versioned
registry in `packages/schemas/src/editor-command-registry.ts`.

## Desktop controls and states

Every shell-owned id appears in exactly one row in this table. A slash-separated
id family expands only the suffixes printed in the Item(s) cell.

| Item(s) | Count | Status | Current behavior and refusal | Evidence owner | Smallest dependency |
|---|---:|---|---|---|---|
| `change-review-accept`, `change-review-reject` | 2 | **real** | Accept commits the one active proposal through the shared session; Reject discards it without a write. Invalid states name `DESKTOP_PROPOSAL_NOT_REVIEWING` or the upstream authoring refusal. | `apps/desktop-shell/src/session.ts`; `tests/e2e/desktop-product-loop-golden.test.ts` | None for the current single-proposal behavior; [#252](https://github.com/Vhailors/sceneaxi/issues/252) adds full transaction history. |
| `sculpt-start`, `sculpt-cancel` | 2 | **real** | After the packaged viewport binds, Sculpt starts the registered deterministic Local Assistant Build and mounts its validated Sculpt Artifact at the registry's `live-viewport` target. Cancel becomes actionable only for the exact returned job id and reports a terminal bounded-progress result or `EDITOR_COMMAND_ACTIVE_JOB_MISMATCH`; it never changes presentation state by itself. | `packages/schemas/test/editor-command-registry.test.ts`; `tests/e2e/desktop-linux-bridge-golden.test.ts`; renderer typecheck | None for this bounded Local Build slice; broader Sculpt authoring remains under later capability tickets. |
| `assistant-toggle`, `assistant-close` | 2 | **real** | Open/close the assistant column or responsive drawer. Kids makes both inert under `DESKTOP_KIDS_ASSISTANT_DENIED`. | `apps/desktop-shell/src/visual-model.ts`; control inventory golden | None. |
| `assistant-prompt`, `assistant-send`, `assistant-retry` | 3 | **partial** | The standalone shell keeps them inert under `DESKTOP_NO_PRESENTATION_RUNTIME`. Linux promotes them only after the bridge, viewport, and handlers bind. Local Build and bounded Agent work; Ask, Hosted, and unavailable BYOK refuse after Send. Retry resumes or abandons the exact retained job. | `desktop/linux/src/renderer/{viewport,assistant-poll,assistant-start}.ts`; `tests/e2e/assistant-panel-golden.test.ts`; provider-host golden | [#250](https://github.com/Vhailors/sceneaxi/issues/250) supplies the registry; [#261](https://github.com/Vhailors/sceneaxi/issues/261) completes inspect/propose/approve/apply. |
| `assistant-route-local` | 1 | **real** | Selects the deterministic free Local route; Build compiles a typed Sculpt Artifact without provider or credits. | `desktop/linux/src/lib/bridge.ts`; desktop Linux bridge golden | None for the current bounded build. |
| `assistant-route-byo` | 1 | **partial** | Selects BYOK and reveals real secure-key controls. The checked-in host injects no provider transport, so execution refuses `DESKTOP_BYO_PROVIDER_SESSION_UNAVAILABLE` or `DESKTOP_ASSISTANT_BYO_UNAVAILABLE`. | `docs/desktop-local-bridge.md`; provider-host and secure-storage tests | [#261](https://github.com/Vhailors/sceneaxi/issues/261). |
| `assistant-route-hosted` | 1 | **fake** | The chip is active-looking and selectable, but Send always refuses `DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE`; this tier owns no identity or credits. | `desktop/linux/src/lib/bridge-contract.ts`; desktop bridge golden | Full-editor v1 does not authorize desktop metering. Keep the route visibly disabled under its current refusal in [#261](https://github.com/Vhailors/sceneaxi/issues/261). |
| `assistant-mode-ask` | 1 | **fake** | Selectable, but execution refuses `DESKTOP_ASSISTANT_BUILD_MODE_REQUIRED`; the contract says Ask is not implemented. | `desktop/linux/src/lib/bridge-contract.ts`; `desktop/linux/src/renderer/assistant-start.ts` | [#261](https://github.com/Vhailors/sceneaxi/issues/261). |
| `assistant-mode-build` | 1 | **partial** | Local Build is real and mounts its result. BYOK depends on a provider session; Hosted refuses. | `packages/authoring-core/src/assistant-sculpt.ts`; Linux bridge/provider-host goldens | [#261](https://github.com/Vhailors/sceneaxi/issues/261). |
| `assistant-mode-agent` | 1 | **partial** | Runs one no-network rarity fixture through the Model Provider Port and stages a canonical proposal. The UI identifies that the prompt is advisory and the fixture answer is fixed. It is not a general agent. | `docs/rarity-engine.md`; `tests/e2e/rarity-provider-desktop-golden.test.ts` | [#261](https://github.com/Vhailors/sceneaxi/issues/261). |
| `scene-entity-desktop-crate-beside` | 1 | **partial** | Selects one validated composed instance. It has no multi-select or general hierarchy. | `desktop/linux/src/lib/desktop-scene.ts`; scene-property goldens | [#253](https://github.com/Vhailors/sceneaxi/issues/253). |
| `scene-property-{translation,rotation,scale}-{x,y,z}` | 9 | **partial** | Edits bounded numeric transforms for one selected composed instance and stages no write until Stage. No viewport gizmo, snapping, local/world choice, or multi-select exists. | `packages/schemas/src/desktop-scene-edit.ts`; `tests/e2e/desktop-scene-property-golden.test.ts` | [#254](https://github.com/Vhailors/sceneaxi/issues/254). |
| `scene-property-stage` | 1 | **partial** | Builds one `/data/composedScene` proposal against the observed content hash. | Same as transform fields | [#252](https://github.com/Vhailors/sceneaxi/issues/252), then [#254](https://github.com/Vhailors/sceneaxi/issues/254). |
| `project-new-root`, `project-open-root`, `project-recent-select`, `project-open-recent`, `project-remove-recent`, `project-open`, `project-save` | 7 | **real** | Native directory selection, validated recents, Reload/status, proposal apply, recovery, and atomic writes are real on packaged Linux. Standalone chrome refuses `DESKTOP_RUNTIME_UNAVAILABLE`; Kids refuses before dialog or registry access. | `desktop/linux/src/lib/{project-lifecycle,project-host}.ts`; lifecycle tests and golden | [#251](https://github.com/Vhailors/sceneaxi/issues/251) replaces the narrow `scene.json` project shape with the v1 manifest without weakening this path. |
| `project-browser-file-select`, `project-browser-open` | 2 | **real** | Lists only `scene.json` and admitted manifest assets, persists validated selection, and opens document or exact digest-bound asset without changing the authoring target. | `desktop/linux/src/lib/project-browser.ts`; project-browser tests and golden | None for the admitted current subset. |
| `project-browser-rename`, `project-browser-delete` | 2 | **fake** | Both open confirmation UI and then refuse current canonical rows under `DESKTOP_PROJECT_BROWSER_OPERATION_NOT_PERMITTED`. They look actionable before the refusal. | `desktop/linux/src/lib/project-browser-contract.ts`; project-browser golden | [#251](https://github.com/Vhailors/sceneaxi/issues/251) for stable identities and [#256](https://github.com/Vhailors/sceneaxi/issues/256) for manifest-backed assets; until then render them disabled with the existing refusal. |
| `scene-play` | 1 | **partial** | Runs the saved composition through `bootstrapOpenPath()`, advances, observes, closes, redraws, and requires viewport acknowledgement. It is a one-shot closed session, not an isolated Play/Stop/reset lifecycle. | `desktop/linux/src/lib/bridge.ts`; product-loop and packaged smoke evidence | [#258](https://github.com/Vhailors/sceneaxi/issues/258). |
| `ship-export-web` | 1 | **real** | Produces the contained content-addressed static Web viewer and Delivery Handoff on Linux. It never deploys. macOS and Windows refuse `DESKTOP_WEB_EXPORT_PLATFORM_UNSUPPORTED`. | `desktop/linux/src/lib/web-export.ts`; desktop Web export golden | [#266](https://github.com/Vhailors/sceneaxi/issues/266) owns project build/export, which is separate from this real Web export. |
| `scene-instance-add`, `scene-instance-remove` | 2 | **partial** | Add copies one already-validated local artifact; Remove permits a non-root leaf while preserving the two-instance minimum. No general hierarchy or parenting exists. | desktop scene edit contract and goldens | [#253](https://github.com/Vhailors/sceneaxi/issues/253). |
| `web-stage-html` | 1 | **partial** | Web profile stages one bounded starter HTML value as inert data. It is not a site canvas or general HTML editor; Game and Kids name `DESKTOP_WEB_CAPABILITY_REQUIRED`. | `apps/desktop-shell/src/product-loop.ts`; desktop product-loop tests | [#250](https://github.com/Vhailors/sceneaxi/issues/250) registers it; no broader site builder is authorized by full-editor v1. |
| `web-inject-asset` | 1 | **real** | On packaged Linux, opens a native picker and stages the contained GLB/glTF importer through Change Review. Game and Kids name `DESKTOP_WEB_CAPABILITY_REQUIRED`. | `docs/asset-ingestion.md`; asset ingestion and picker tests | [#256](https://github.com/Vhailors/sceneaxi/issues/256) adds the remaining first-class asset families and hot reload. |
| `drawer-left`, `drawer-inspector` | 2 | **real** | Open the responsive Panels and Inspector drawers; Kids centrally demotes them. | control accounting and recorded viewport evidence in `docs/engine-desktop-surface.md` | [#265](https://github.com/Vhailors/sceneaxi/issues/265) adds user-arranged persistent workspaces. |
| `menu-file`, `menu-edit`, `menu-run` | 3 | **real** | Open accessible application menus with focus, arrow, Escape, outside-click, and focus-leave behavior. Their command rows derive label, schema version, and permission from the shared registry. | `apps/desktop-shell/src/interaction-commands.ts`; command interaction golden | None for the registered first-slice commands. |
| `menu-command-{project-new,project-open,project-save,ship-export-web,edit-undo,run-play}` | 6 | **real** | Each invokes the same current handler as its palette row and accelerator through the registered desktop-control contract; native New/Open keep the lifecycle port while the other engine-host operations cross the validated `command` action. Undo is visibly inert until the journal reports availability or while recovery is pending. | command interaction golden; desktop bridge golden | None for this slice. |
| `mode-build` | 1 | **partial** | Opens the only room with selected-instance property authoring. It lacks hierarchy, multi-select, gizmos, snapping, reusable content, and the full inspector. | engine desktop surface doc and scene-property goldens | [#253](https://github.com/Vhailors/sceneaxi/issues/253), [#254](https://github.com/Vhailors/sceneaxi/issues/254), [#255](https://github.com/Vhailors/sceneaxi/issues/255). |
| `mode-sculpt` | 1 | **fake** | Changes presentation only; its room says standalone Sculpt authoring is unavailable and its actions are inert. | visual model and mounted control inventory | [#250](https://github.com/Vhailors/sceneaxi/issues/250). |
| `mode-compose` | 1 | **fake** | Changes presentation only; the room has no bound composition editor. The narrow instance operations live in Build. | `apps/desktop-shell/src/chrome.ts`; mounted control inventory | [#253](https://github.com/Vhailors/sceneaxi/issues/253). |
| `mode-animate` | 1 | **fake** | Changes presentation only; the room and Timeline contain no authoring operation. | chrome mode panel; mounted control inventory | [#259](https://github.com/Vhailors/sceneaxi/issues/259). |
| `mode-run` | 1 | **partial** | The room receives real one-shot Play evidence, but has no long-lived clone, Stop, reset, source switch, or profiling. | product-loop golden and Linux smoke | [#258](https://github.com/Vhailors/sceneaxi/issues/258), then [#264](https://github.com/Vhailors/sceneaxi/issues/264). |
| `mode-ship` | 1 | **partial** | Shows real static Web export evidence. It has no project build targets for Linux, macOS, or Windows. | Web export golden | [#266](https://github.com/Vhailors/sceneaxi/issues/266), [#267](https://github.com/Vhailors/sceneaxi/issues/267), [#268](https://github.com/Vhailors/sceneaxi/issues/268). |
| `mode-plugins` | 1 | **fake** | Changes presentation only; the room says no plugin host runs on this surface and exposes no operation. | chrome mode panel; plugin ADRs 0004–0005 | [#262](https://github.com/Vhailors/sceneaxi/issues/262). |
| `profile-game`, `profile-web`, `profile-kids` | 3 | **real** | Switch the shell projection. Kids replaces the editor with `OPEN_PATH_KIDS_REFUSED`, independently denies the assistant, and leaves only the escape/profile and disclosure controls live. | shared open-path policy, parity test, mounted control inventory | None. Full-editor work must preserve it. |
| `dock-changes` | 1 | **real** | Shows the active proposal diff and decisions. | product-loop golden | [#252](https://github.com/Vhailors/sceneaxi/issues/252) adds command history beyond one proposal. |
| `dock-assets` | 1 | **partial** | Shows admitted manifest assets from the project-browser response. No complete asset families, previews, or hot reload. | project-browser golden | [#256](https://github.com/Vhailors/sceneaxi/issues/256). |
| `dock-console` | 1 | **fake** | The tab works as presentation, but it always says no session is running and owns no log stream. | `apps/desktop-shell/src/chrome.ts` | [#250](https://github.com/Vhailors/sceneaxi/issues/250) supplies command progress/result events; [#258](https://github.com/Vhailors/sceneaxi/issues/258) supplies a runtime session. |
| `dock-evidence` | 1 | **partial** | Shows accepted/staged rarity evidence and honest empty copy; general command and capture evidence is not projected. | rarity desktop golden and chrome | [#250](https://github.com/Vhailors/sceneaxi/issues/250), with final enforcement in [#270](https://github.com/Vhailors/sceneaxi/issues/270). |
| `dock-timeline` | 1 | **fake** | The Animate-only tab works as presentation but contains no tracks or commands. | editor-shell schema and chrome | [#259](https://github.com/Vhailors/sceneaxi/issues/259). |
| `overlay-open-palette`, `status-refusal-help`, `status-overlay-palette`, `overlay-close-outcome-dismiss` | 4 | **real** | Open/close the command palette, refusal disclosure, and outcome dialog with focus containment. These seven outside-refusal controls (including profiles) are the only live Kids controls. | control accounting and command interaction golden | [#265](https://github.com/Vhailors/sceneaxi/issues/265) rechecks the final workspace control set. |
| `palette-{project-new,project-open,project-save,ship-export-web,edit-undo,run-play}` | 6 | **real** | Invoke the same registered commands as menu rows; unavailable commands preserve focus and name the refusal. | command interaction golden | None for this slice. |
| `viewport-source-scene`, `viewport-source-game`, `viewport-source-sculpt-preview` | 3 | **fake** | All three stay visibly inert under `DESKTOP_NO_PRESENTATION_RUNTIME`, including in the packaged chrome; the renderer replaces center content in response to other actions rather than these tabs. | visual model; mounted control inventory | [#258](https://github.com/Vhailors/sceneaxi/issues/258). |
| `assistant-manipulator-{move-x,move-y,rotate-y,scale-up}` | 4 | **partial** | Linux promotes them after an assistant artifact mounts. They apply four fixed Mount API operations only, outside saved scene authoring. | `desktop/linux/src/lib/assistant-viewport.ts`; Linux bridge golden | [#254](https://github.com/Vhailors/sceneaxi/issues/254). |

### Linux-only injected BYOK controls

| Item | Status | Current behavior | Evidence owner | Smallest dependency |
|---|---|---|---|---|
| OpenRouter provider select | **partial** | Real single-option selector. No additional provider or ready transport exists. | `desktop/linux/src/renderer/byo-configuration.ts`; secure-storage tests | [#261](https://github.com/Vhailors/sceneaxi/issues/261). |
| Password input | **real** | Exists only in the renderer, clears on hide and after every submission, and never crosses the engine bridge or local-agent socket. Disabled when secure storage is not ready. | secure-storage contract and tests | None for storage; [#261](https://github.com/Vhailors/sceneaxi/issues/261) for provider execution. |
| Save/Replace key | **real** | Encrypts through Electron `safeStorage`, writes an owner-private atomic envelope, and names unavailable, locked, unsupported, corrupt, failed, missing, and invalid states. | `desktop/linux/src/electron/provider-key-store.ts`; secure-storage tests | None for storage. |
| Remove key | **real** | Deletes only the exact regular owner-private envelope and remains available when the keyring cannot decrypt it. | provider-key-store contract and tests | None. |

The native directory/file dialogs are host interactions reached from modelled
New/Open/Import controls, not extra persistent chrome controls. The three title-bar
window dots and four viewport-tool marks are `aria-hidden` decoration and have no
click or focus behavior.

## CLI, bridge, and assistant inventory

| Surface | Item(s) | Status | Current behavior / gap | Evidence and next dependency |
|---|---|---|---|---|
| CLI | `project new`, `dev`, `test`, `capture`, `report`, `propose`, `apply` | **real** | Versioned envelope, strict flags, text-canonical E1 authoring and evidence. No full-editor command vocabulary. | CLI golden, proposal/apply and lifecycle tests; migrate through [#250](https://github.com/Vhailors/sceneaxi/issues/250). |
| CLI | `scene compose` | **real** | Deterministic offline scene composition with named refusal matrix. | scene composition golden; hierarchy expansion [#253](https://github.com/Vhailors/sceneaxi/issues/253). |
| CLI | `asset import`, `asset list` | **partial** | Import covers the fixed contained GLB/glTF profile; list reports package refs from catalog items. | asset ingestion golden; [#256](https://github.com/Vhailors/sceneaxi/issues/256). |
| CLI | `profile list`, `profile open-path` | **real** | Read-only registry and shared demo policy, including non-zero Kids refusal. | profile/open-path tests. |
| CLI | `catalog list`, `evidence list` | **real** | Read-only bounded listings; catalog commerce remains inert. | registry verb tests. |
| CLI | `desktop bridge call`, `status`, `tools` | **real** | Discovers and authenticates the same-user Unix socket; validates exact tool, permission, and input. `tools` exposes the same command schema version and definitions, and registered calls including Play dispatch through the host command gate. | CLI bridge, local RPC, and CLI→local bridge goldens. |
| CLI | `demo gated` | **fake** | Intentionally synthetic held-key fixture command; no product capability uses it. It fails closed by default. | held-key regression suites; keep outside the full-editor registry. |
| CLI | `protocol version`, `protocol inspect` | **real** | Reports the CLI envelope and exit-code contract. | CLI protocol tests. |
| Desktop interaction table | New, Open, Save, Export Web, Undo, Play | **real** | All six retain their behavior while their identity, label, schema version, and permission derive from the shared registry; menu, palette, button, and accelerator parity remains executable. | `apps/desktop-shell/src/interaction-commands.ts`; command interaction golden. |
| Electron bridge actions | `handshake`, `command`, `scene`, `project-browser-open`, `open-path`, `asset-import`, `ship`, `assistant`, `authoring`, `frame-report` | **real** | `command` validates schema version, declared client, exact input, permission, and Kids denial before adapting to the existing handlers. Legacy transport actions remain for unchanged bounded behavior. | registry unit tests; desktop Linux bridge golden. |
| Authoring operations | `status`, `propose`, `edit-scene`, `edit-property`, `accept`, `reject`, `recover`, `restart`, `undo` | **partial** | Real single-session behaviors; no redo, general hierarchy, animation, physics, package, or Git operations. | desktop session/scene tests; [#252](https://github.com/Vhailors/sceneaxi/issues/252) onward. |
| Assistant operations | `start`, `status`, `abandon` | **partial** | Real retained-job lifecycle for Build and bounded Agent. Ask is excluded by type; Hosted is excluded by route. | assistant poll/start tests; [#261](https://github.com/Vhailors/sceneaxi/issues/261). |
| Local-agent tools | handshake; project status/propose/accept/reject/recover/restart/undo; Play; assistant Local start/BYOK start/bounded Agent/status/abandon | **partial** | Fourteen real permission-bound tools. First-slice product tools derive command id, input, permission, mutation, evidence, progress, refusal, and undo metadata from the shared registry; the transport still excludes credentials, Hosted, renderer-only frame actions, redo, and later full-editor commands. | desktop local bridge contract/tests; CLI→local bridge golden; later capability tickets own expansion. |

`packages/cli/src/held-keys/shipped.ts` is a fail-closed map for captain-held CLI
verbs, not the full-editor command registry. Likewise,
`packages/schemas/src/desktop-local-bridge.ts` is the closed local-agent transport
tool registry. Full-editor work must preserve both purposes while removing copied
product-command definitions.

## Packaging and runtime surfaces

| Surface | Status | Current evidence and blocker | Smallest dependency |
|---|---|---|---|
| Shared Electron product implementation | **real** | `desktop/linux` owns the application; macOS and Windows stage its bundled runtime rather than fork the chrome, bridge, or renderer. ADR 0024 and `pnpm check:desktop` enforce the boundary. | None. |
| Linux editor application build (`AppImage`, `.deb`) | **real** | Build, checksums, CI Xvfb/SwiftShader packaged smoke, and a recorded first-download workflow artifact exist. This packages SceneAxi Engine Desktop, not a user's project. | None for the current editor app; project output is [#266](https://github.com/Vhailors/sceneaxi/issues/266). |
| Current-host Linux packaged smoke | **partial** | Two 2026-08-07 attempts exited in Electron 43.2.0's GPU process after `InitializeSandbox()` and `SIGSEGV`, before SceneAxi printed proof. CI under Xvfb owns the valid packaged-runtime proof. This is a host limitation, not a SceneAxi regression. | External host/runtime change only; do not “fix” product code without new evidence. |
| macOS editor packaging | **partial** | Staging, configuration smoke, fail-closed signing/notarization procedure, update policy, and macOS runner workflow exist. No signed/notarized public artifact or release record exists. | Operator macOS host and credentials for the editor app; user-project target [#267](https://github.com/Vhailors/sceneaxi/issues/267). |
| Windows editor packaging | **partial** | NSIS configuration, signing/update refusals, staging, and host-independent smoke exist. No signed public artifact exists. | Operator Windows host and credentials for the editor app; user-project target [#268](https://github.com/Vhailors/sceneaxi/issues/268). |
| Static Web project export | **real** | Linux writes and verifies a content-addressed viewer plus Delivery Handoff. | None for current scope. |
| Linux project build artifact | **fake** | No full-editor project build target exists. The editor's own AppImage/deb must not be counted as one. | [#266](https://github.com/Vhailors/sceneaxi/issues/266). |
| macOS project build artifact | **fake** | No user-project target or verified artifact exists. | [#267](https://github.com/Vhailors/sceneaxi/issues/267). |
| Windows project build artifact | **fake** | No user-project target or verified artifact exists. | [#268](https://github.com/Vhailors/sceneaxi/issues/268). |

## Full-editor capability gaps

| Capability required by #249 | Current classification | Current owner or evidence | Implementation issue |
|---|---|---|---|
| Shared typed command registry across UI, CLI, assistant | **partial** | The versioned first-slice registry drives existing File/Save/Undo/Play/Change Review/bounded Assistant metadata and dispatch across desktop-control, CLI, and local-agent boundaries. Later full-editor commands are deliberately absent. | [#251](https://github.com/Vhailors/sceneaxi/issues/251) onward add only their own vertical slices. |
| Versioned native project manifest, deterministic ids, migrations, capabilities | **partial** | Contained `scene.json`, recents, manifest assets, and stable rarity starter identity | [#251](https://github.com/Vhailors/sceneaxi/issues/251) |
| Atomic conflict-aware recovery with multi-level undo/redo, progress, evidence | **partial** | One proposal, durable apply recovery, and undo; no redo | [#252](https://github.com/Vhailors/sceneaxi/issues/252) |
| Hierarchy, multi-select, parent/child | **partial** | Flat composed-instance selector and bounded add/remove | [#253](https://github.com/Vhailors/sceneaxi/issues/253) |
| Gizmos, snapping, full transform inspector | **partial** | Nine numeric properties plus four transient assistant nudges | [#254](https://github.com/Vhailors/sceneaxi/issues/254) |
| Prefab-like reusable content | **fake** | No definition/instance/override contract | [#255](https://github.com/Vhailors/sceneaxi/issues/255) |
| First-class assets, previews, manifests, hot reload | **partial** | SceneAxi artifacts and contained GLB/glTF paths exist; remaining families and hot reload do not | [#256](https://github.com/Vhailors/sceneaxi/issues/256) |
| Unified rebindable keyboard/mouse/controller input | **partial** | Six hand-written desktop accelerators, pointer handlers, and presentation orbit controls | [#257](https://github.com/Vhailors/sceneaxi/issues/257) |
| Isolated Play clone and viewport-source lifecycle | **partial** | One-shot closed open path; source tabs disabled | [#258](https://github.com/Vhailors/sceneaxi/issues/258) |
| Animation authoring and deterministic replay | **fake** | Artifact socket/toy runtime support only; empty Animate room | [#259](https://github.com/Vhailors/sceneaxi/issues/259) |
| Physics authoring and deterministic replay | **partial** | Toy ground collision and read-only supported collider inspection | [#260](https://github.com/Vhailors/sceneaxi/issues/260) |
| Assistant inspect → propose → approve → apply; real configured providers | **partial** | Local Build, fixture Agent, secure BYOK storage, injected provider composition | [#261](https://github.com/Vhailors/sceneaxi/issues/261) |
| Package management and Plugins room | **partial** | Capability-manifest Plugin Host exists outside an empty desktop room | [#262](https://github.com/Vhailors/sceneaxi/issues/262) |
| Contained Git workflow | **fake** | No desktop/CLI/assistant project Git surface | [#263](https://github.com/Vhailors/sceneaxi/issues/263) |
| Profiling | **fake** | Frame reports and smoke observations exist, but no profiling command or room | [#264](https://github.com/Vhailors/sceneaxi/issues/264) |
| Accessibility and persistent dockable workspaces | **partial** | Strong fixed/responsive keyboard and focus evidence; no user dock/layout persistence | [#265](https://github.com/Vhailors/sceneaxi/issues/265) |
| Verified Linux/macOS/Windows user-project artifacts | **fake** | Editor application packaging exists; project targets do not | [#266](https://github.com/Vhailors/sceneaxi/issues/266), [#267](https://github.com/Vhailors/sceneaxi/issues/267), [#268](https://github.com/Vhailors/sceneaxi/issues/268) |
| Networking, XR, marketplace, collaboration extension seams | **partial** | Plugin capability model exists; no full-editor declarations or disabled states for these four | [#269](https://github.com/Vhailors/sceneaxi/issues/269) |
| Matrix-to-evidence enforcement | **partial** | Control accounting and several focused matrices exist; no full-editor audit | [#270](https://github.com/Vhailors/sceneaxi/issues/270) |

## Dependency-ordered todo graph

The GitHub sub-issue graph under #249 is the canonical todo list. The secondmate
backlog should mirror it rather than maintaining another checklist. Textual
blocking edges in each issue are authoritative because `gh-axi` exposes GitHub
sub-issues but no native dependency-link command.

| Order | Issue | Blocked by |
|---:|---|---|
| 1 | [#250 Register commands and activate Sculpt](https://github.com/Vhailors/sceneaxi/issues/250) | None; first implementation frontier |
| 2 | [#251 Versioned native project model](https://github.com/Vhailors/sceneaxi/issues/251) | #250 |
| 3 | [#252 Transactional commands with redo](https://github.com/Vhailors/sceneaxi/issues/252) | #250, #251 |
| 4 | [#253 Hierarchy, multi-select, parenting](https://github.com/Vhailors/sceneaxi/issues/253) | #251, #252 |
| 5 | [#254 Transform gizmos, snapping, inspector](https://github.com/Vhailors/sceneaxi/issues/254) | #253 |
| 6 | [#255 Reusable content and overrides](https://github.com/Vhailors/sceneaxi/issues/255) | #253, #254 |
| 7 | [#256 First-class asset pipeline and hot reload](https://github.com/Vhailors/sceneaxi/issues/256) | #251, #252 |
| 8 | [#257 Unified rebindable input](https://github.com/Vhailors/sceneaxi/issues/257) | #250, #251 |
| 9 | [#258 Isolated Play mode and viewport sources](https://github.com/Vhailors/sceneaxi/issues/258) | #252, #253, #257 |
| 10 | [#259 Animation authoring and replay](https://github.com/Vhailors/sceneaxi/issues/259) | #256, #253, #257, #258 |
| 11 | [#260 Physics authoring and replay](https://github.com/Vhailors/sceneaxi/issues/260) | #253, #257, #258 |
| 12 | [#261 Assistant inspect/propose/approve/apply](https://github.com/Vhailors/sceneaxi/issues/261) | #250, #251, #252, #256 |
| 13 | [#262 Package manager and Plugin room](https://github.com/Vhailors/sceneaxi/issues/262) | #250, #251, #252, #256 |
| 14 | [#263 Contained Git workflow](https://github.com/Vhailors/sceneaxi/issues/263) | #250, #251, #252 |
| 15 | [#264 Measured profiling evidence](https://github.com/Vhailors/sceneaxi/issues/264) | #258, #259, #260 |
| 16 | [#265 Accessible persistent workspaces](https://github.com/Vhailors/sceneaxi/issues/265) | #254, #257, #261–#264 |
| 17 | [#266 Project build pipeline and Linux artifact](https://github.com/Vhailors/sceneaxi/issues/266) | #251, #252, #256, #258–#260, #262 |
| 18 | [#267 macOS project artifact](https://github.com/Vhailors/sceneaxi/issues/267) | #266 |
| 19 | [#268 Windows project artifact](https://github.com/Vhailors/sceneaxi/issues/268) | #266 |
| 20 | [#269 Advanced extension seams](https://github.com/Vhailors/sceneaxi/issues/269) | #250, #251, #262 |
| 21 | [#270 Enforce capability-matrix evidence](https://github.com/Vhailors/sceneaxi/issues/270) | Every applicable capability above |

One isolated GPT-5.6-Sol high direct-PR worker takes the current frontier. The
coordinator advances only after that PR has green evidence and is accepted. This
inventory lane implements none of those tickets.

## First implementation slice

[#250](https://github.com/Vhailors/sceneaxi/issues/250) removes the most visible
dead interaction without adding a parallel editor subsystem. The landed slice
introduces the versioned command registry over commands that already work,
migrates current clients without changing their behavior, and binds
`sculpt-start` to the existing Local Assistant Build command and
`sculpt-cancel` to exact-job cancellation. Acceptance requires registry schema
validation, permission/refusal parity, bounded progress/evidence, real Change
Review or viewport output, CLI/local-agent/desktop parity, and independent Kids
denial; those proofs now live in the registry, desktop bridge, local RPC, CLI,
emitted-interaction, and golden suites named above.

## Inventory decisions

The inventory required one update to existing architecture ownership:
[ADR 0003](adr/0003-editor-sequencing-e1-first-e2-specified.md) now records the
captain-authorized packaged-desktop exception for full editor v1. It does not
claim Stage 6 ran, does not widen the Web editor, and does not authorize a Kids
editor. No new ADR is needed: Electron ownership, Three presentation ownership,
plugin capabilities, and platform packaging already have owners in ADRs 0017,
0024, and 0004–0005.
