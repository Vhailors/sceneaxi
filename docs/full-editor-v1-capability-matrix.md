# Full desktop editor v1 capability matrix

This is the canonical inventory and todo index for SceneAxi full desktop editor
v1. Its first-class asset rows include the #256 implementation evidence. The parent specification is
[sceneaxi#249](https://github.com/Vhailors/sceneaxi/issues/249); the product-scope
parent remains [sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1).

Issues #250 through #253 now supply the command-registry, native-project,
transaction-history, and hierarchy slices; #263 supplies the contained Git slice
described below. The rows name only their evidence and do not claim capabilities
owned by other issues. The matrix reports current behavior. A `live` control in the visual model is not
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

The shared shell model owns **112 unique control ids** across all modes and runtime
projections. A default Game or Web render contains 111 because `dock-timeline`
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
counted as shell controls, so the current packaged-window union is **116**.

The CLI exposes **21 verbs** from `packages/cli/src/commands.ts`; the Electron
bridge exposes **11 actions**, **10 authoring operations**, and **3 legacy
assistant transport operations** from `desktop/linux/src/lib/bridge-contract.ts`;
the same-user local agent bridge exposes **61 tools** from
`packages/schemas/src/desktop-local-bridge.ts`. Their transport names remain
distinct, but first-slice product operations now derive from the one versioned
registry in `packages/schemas/src/editor-command-registry.ts`.

## Desktop controls and states

Every shell-owned id appears in exactly one row in this table. A slash-separated
id family expands only the suffixes printed in the Item(s) cell.

| Item(s) | Count | Status | Current behavior and refusal | Evidence owner | Smallest dependency |
|---|---:|---|---|---|---|
| `change-review-accept`, `change-review-reject` | 2 | **real** | Accept commits the one active proposal through the shared session; Reject discards it without a write. Invalid states name `DESKTOP_PROPOSAL_NOT_REVIEWING` or the upstream authoring refusal. | `apps/desktop-shell/src/session.ts`; `tests/e2e/desktop-product-loop-golden.test.ts` | None for the current single-proposal decision. |
| `sculpt-start`, `sculpt-cancel` | 2 | **real** | After the packaged viewport binds, Sculpt starts the registered deterministic Local Assistant Build and mounts its validated Sculpt Artifact at the registry's `live-viewport` target. Cancel becomes actionable only for the exact returned job id and reports a terminal bounded-progress result or `EDITOR_COMMAND_ACTIVE_JOB_MISMATCH`; it never changes presentation state by itself. | `packages/schemas/test/editor-command-registry.test.ts`; `tests/e2e/desktop-linux-bridge-golden.test.ts`; renderer typecheck | None for this bounded Local Build slice; broader Sculpt authoring remains under later capability tickets. |
| `assistant-toggle`, `assistant-close` | 2 | **real** | Open/close the assistant column or responsive drawer. Kids makes both inert under `DESKTOP_KIDS_ASSISTANT_DENIED`. | `apps/desktop-shell/src/visual-model.ts`; control inventory golden | None. |
| `assistant-prompt`, `assistant-send`, `assistant-retry` | 3 | **partial** | The standalone shell keeps them inert under `DESKTOP_NO_PRESENTATION_RUNTIME`. Linux promotes them only after the bridge, viewport, and handlers bind. Local Build and bounded Agent work; Ask, Hosted, and unavailable BYOK refuse after Send. Retry resumes or abandons the exact retained job. | `desktop/linux/src/renderer/{viewport,assistant-poll,assistant-start}.ts`; `tests/e2e/assistant-panel-golden.test.ts`; provider-host golden | [#261](https://github.com/Vhailors/sceneaxi/issues/261) completes inspect/propose/approve/apply. |
| `assistant-route-local` | 1 | **real** | Selects the deterministic free Local route; Build compiles a typed Sculpt Artifact without provider or credits. | `desktop/linux/src/lib/bridge.ts`; desktop Linux bridge golden | None for the current bounded build. |
| `assistant-route-byo` | 1 | **real** | Selects BYOK and reveals real secure-key controls. Packaged Linux injects the OpenCode DeepSeek V4 Pro complete-only transport; a missing key or unavailable keyring still refuses by name. Gate goldens keep injecting fixture transports. | `docs/desktop-local-bridge.md`; `tests/e2e/desktop-provider-host-golden.test.ts`; `tests/desktop/desktop-opencode-live-transport.test.ts`; `tests/desktop/desktop-byo-secure-storage.test.ts` | None for the packaged OpenCode path. |
| `assistant-route-hosted` | 1 | **fake** | The chip is active-looking and selectable, but Send always refuses `DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE`; this tier owns no identity or credits. | `desktop/linux/src/lib/bridge-contract.ts`; desktop bridge golden | Full-editor v1 does not authorize desktop metering. Keep the route visibly disabled under its current refusal in [#261](https://github.com/Vhailors/sceneaxi/issues/261). |
| `assistant-mode-ask` | 1 | **real** | `assistant-ask` answers from an explicit inspection scope and refuses unsupported questions without a provider or saved-byte write. Kids is denied before inspection. | `packages/schemas/test/desktop-assistant-ask.test.ts`; `tests/e2e/desktop-assistant-ask-golden.test.ts` | None for #261. |
| `assistant-mode-build` | 1 | **partial** | Local Build is real and mounts its result. BYOK depends on a provider session; Hosted refuses. | `packages/authoring-core/src/assistant-sculpt.ts`; Linux bridge/provider-host goldens | [#261](https://github.com/Vhailors/sceneaxi/issues/261). |
| `assistant-mode-agent` | 1 | **partial** | Runs one no-network rarity fixture through the Model Provider Port and stages a canonical proposal. The UI identifies that the prompt is advisory and the fixture answer is fixed. It is not a general agent. | `docs/rarity-engine.md`; `tests/e2e/rarity-provider-desktop-golden.test.ts` | [#261](https://github.com/Vhailors/sceneaxi/issues/261). |
| `scene-entity-desktop-crate-beside` | 1 | **real** | The multi-select tree renders stable object ids, depth, and parent ids from the validated project composition. Click and keyboard changes use one ordered-selection command and stale ids refuse by name. | `desktop/linux/src/lib/desktop-scene.ts`; `tests/e2e/desktop-hierarchy-golden.test.ts`; product-loop golden | None for hierarchy selection; [#257](https://github.com/Vhailors/sceneaxi/issues/257) owns unified rebindable input. |
| `scene-property-{translation,rotation,scale}-{x,y,z}` | 9 | **real** | Numeric inspector fields for the primary selection. Local/world, pivot, axis, and snap are the sibling transform commands, not a second write path. | `packages/schemas/src/desktop-scene-edit.ts`; `tests/e2e/desktop-scene-property-golden.test.ts`; transform golden | None for #254. |
| `scene-property-stage` | 1 | **real** | Builds one `/data/composedScene` proposal against the observed content hash. | `packages/schemas/src/desktop-scene-edit.ts`; `tests/e2e/desktop-scene-property-golden.test.ts` | None for #254. |
| `scene-transform-mode-{translate,rotate,scale}` | 3 | **real** | Chooses the gizmo mode for `scene-transform-apply`. Preview stays off saved bytes until accept. | `packages/schemas/src/desktop-scene-transform.ts`; `tests/e2e/desktop-transform-golden.test.ts` | None for #254. |
| `scene-transform-nudge-{x,y,z}-{plus,minus}` | 6 | **real** | Keyboard nudges through the same `scene-transform-apply` command as numeric entry. | `packages/schemas/src/desktop-scene-transform.ts`; `tests/e2e/desktop-transform-golden.test.ts` | None for #254. |
| `scene-transform-space`, `scene-transform-pivot`, `scene-transform-snap` | 3 | **real** | Local/world space, pivot, and snap are explicit inputs with named refusals. | `packages/schemas/src/desktop-scene-transform.ts`; `tests/e2e/desktop-transform-golden.test.ts` | None for #254. |
| `project-git-commit-message` | 1 | **real** | Collects the commit message for `project-git-commit-prepare`. Preparation creates no commit. | `packages/authoring-core/test/project-git.test.ts`; contained Git golden | None for #263. |
| `project-new-root`, `project-open-root`, `project-recent-select`, `project-open-recent`, `project-remove-recent`, `project-open`, `project-save` | 7 | **real** | New creates `scene.json` and the native v1 manifest atomically; status/Open report the shared version/capability inspection, while a valid legacy project stays byte-identical until its exact migration proposal is approved and committed. Standalone chrome refuses `DESKTOP_RUNTIME_UNAVAILABLE`; Kids refuses before dialog or project reads. | `packages/schemas/src/project-manifest.ts`; `packages/authoring-core/src/project-model.ts`; `desktop/linux/src/lib/{project-lifecycle,project-host}.ts`; project-model, lifecycle, bridge, and CLI/local-agent goldens | None for the v1 project-model slice. |
| `project-browser-file-select`, `project-browser-open` | 2 | **real** | Lists only `scene.json` and admitted manifest assets, persists validated selection, and opens document or exact digest-bound asset without changing the authoring target. | `desktop/linux/src/lib/project-browser.ts`; project-browser tests and golden | None for the admitted current subset. |
| `project-browser-rename`, `project-browser-delete` | 2 | **fake** | Both open confirmation UI and then refuse current canonical rows under `DESKTOP_PROJECT_BROWSER_OPERATION_NOT_PERMITTED`. They look actionable before the refusal. Native project identities now exist, but these operations remain deliberately unimplemented. | `desktop/linux/src/lib/project-browser-contract.ts`; project-browser golden | [#256](https://github.com/Vhailors/sceneaxi/issues/256) owns manifest-backed asset mutation; until then render them disabled with the existing refusal. |
| `scene-play` | 1 | **partial** | Runs the saved composition through `bootstrapOpenPath()`, advances, observes, closes, redraws, and requires viewport acknowledgement. It is a one-shot closed session, not an isolated Play/Stop/reset lifecycle. | `desktop/linux/src/lib/bridge.ts`; product-loop and packaged smoke evidence | [#258](https://github.com/Vhailors/sceneaxi/issues/258). |
| `ship-export-web` | 1 | **real** | Produces the contained content-addressed static Web viewer and Delivery Handoff on Linux. It never deploys. macOS and Windows refuse `DESKTOP_WEB_EXPORT_PLATFORM_UNSUPPORTED`. | `desktop/linux/src/lib/web-export.ts`; desktop Web export golden | [#266](https://github.com/Vhailors/sceneaxi/issues/266) owns project build/export, which is separate from this real Web export. |
| `scene-instance-add`, `scene-instance-remove`, `scene-instance-reparent`, `scene-instance-parent`, `scene-instance-policy` | 5 | **real** | Create copies only an already-validated local artifact under an explicit parent; ordered multi-remove preserves the protected root and refuses orphans; reparent requires preserve-world or preserve-local and stages one canonical review transaction. | desktop scene edit contract; hierarchy and product-loop goldens | None for the #253 hierarchy slice; [#255](https://github.com/Vhailors/sceneaxi/issues/255) owns reusable content. |
| `web-stage-html` | 1 | **partial** | Web profile stages one bounded starter HTML value as inert data. It is not a site canvas or general HTML editor; Game and Kids name `DESKTOP_WEB_CAPABILITY_REQUIRED`. | `apps/desktop-shell/src/product-loop.ts`; desktop product-loop tests | No broader site builder is authorized by full-editor v1. |
| `web-inject-asset` | 1 | **real** | On packaged Linux, opens the Game/Web native picker and stages the shared SceneAxi/model/image/audio/font/animation-data pipeline through Change Review. Kids refuses before reads. | `docs/asset-ingestion.md`; asset-pipeline, asset-ingestion, and picker tests | None for the bounded v2 profiles; later animation authoring remains #259. |
| `drawer-left`, `drawer-inspector` | 2 | **real** | Open the responsive Panels and Inspector drawers; Kids centrally demotes them. | control accounting and recorded viewport evidence in `docs/engine-desktop-surface.md` | [#265](https://github.com/Vhailors/sceneaxi/issues/265) adds user-arranged persistent workspaces. |
| `menu-file`, `menu-edit`, `menu-run` | 3 | **real** | Open accessible application menus with focus, arrow, Escape, outside-click, and focus-leave behavior. Their command rows derive label, schema version, and permission from the shared registry. | `apps/desktop-shell/src/interaction-commands.ts`; command interaction golden | None for the registered first-slice commands. |
| `menu-command-{project-new,project-open,project-save,project-git-status,project-git-diff,project-git-stage,project-git-commit-prepare,ship-export-web,edit-undo,edit-redo,run-play}` | 11 | **real** | Each invokes the same current handler as its palette row and accelerator through the registered desktop-control contract; native New/Open keep the lifecycle port while the other engine-host operations cross the validated `command` action. Git status, diff, staging, and commit preparation render the host's shared repository evidence in Ship; undo and redo are visibly inert until durable history reports availability or while recovery is pending. | command interaction golden; contained Git golden; full-editor transaction golden; desktop bridge golden | None for this slice. |
| `mode-build` | 1 | **partial** | Opens the room with the project-backed hierarchy, ordered multi-select, parenting, selected-object numeric authoring, gizmos, and reusable-content commands. Isolated Play sources and later rooms remain later slices. | engine desktop surface doc; hierarchy, transform, prefab, and scene-property goldens | [#258](https://github.com/Vhailors/sceneaxi/issues/258) onward. |
| `mode-sculpt` | 1 | **partial** | Opens the Sculpt room. Standalone chrome keeps authoring inert, while the packaged runtime binds Sculpt object to the registered Local Assistant Build and mounts its validated result. It is not a general sculpt editor. | visual model, registry tests, and desktop Linux bridge golden | Later capability tickets own broader sculpt and asset authoring. |
| `mode-compose` | 1 | **fake** | Changes presentation only; the room has no separately bound editor and stays inert under `DESKTOP_NO_DOCUMENT_BOUND` until Build authoring is used. | `apps/desktop-shell/src/chrome.ts`; mounted control inventory | Keep one authoring room; no second document model. |
| `mode-animate` | 1 | **partial** | The room opens Timeline, which now authors clips through `animation-apply`. The mode chip itself only changes presentation. | `tests/e2e/desktop-animation-golden.test.ts`; chrome mode panel | None for #259 timeline authoring; the chip is still presentation. |
| `mode-run` | 1 | **partial** | The room receives real one-shot Play evidence, but has no long-lived clone, Stop, reset, source switch, or profiling. | product-loop golden and Linux smoke | [#258](https://github.com/Vhailors/sceneaxi/issues/258), then [#264](https://github.com/Vhailors/sceneaxi/issues/264). |
| `mode-ship` | 1 | **partial** | Shows real static Web export evidence. It has no project build targets for Linux, macOS, or Windows. | Web export golden | [#266](https://github.com/Vhailors/sceneaxi/issues/266), [#267](https://github.com/Vhailors/sceneaxi/issues/267), [#268](https://github.com/Vhailors/sceneaxi/issues/268). |
| `mode-plugins` | 1 | **fake** | Changes presentation only. The room stays locked and names `DESKTOP_NO_DOCUMENT_BOUND` when no project is bound; package install is a command, not this chip. | chrome mode panel; plugin ADRs 0004–0005; `tests/e2e/desktop-package-golden.test.ts` | None for #262; the chip remains a presentation lock. |
| `profile-game`, `profile-web`, `profile-kids` | 3 | **real** | Switch the shell projection. Kids replaces the editor with `OPEN_PATH_KIDS_REFUSED`, independently denies the assistant, and leaves only the escape/profile and disclosure controls live. | shared open-path policy, parity test, mounted control inventory | None. Full-editor work must preserve it. |
| `dock-changes` | 1 | **real** | Shows the active proposal diff and decisions; it does not claim a separate transaction-history browser. | product-loop golden | None for active review. |
| `dock-assets` | 1 | **real** | Shows admitted assets with family, stable identity, byte-derived preview metadata, provenance, and validation from the same manifest entry used by Play and packaging. Explicit reload stages through CLI/bridge Change Review rather than mutating from the dock. | asset-pipeline and project-browser goldens | None for the bounded v2 profiles. |
| `dock-console` | 1 | **fake** | The tab works as presentation, but it always says no session is running and owns no log stream (`DESKTOP_NO_KERNEL_SESSION`). | `apps/desktop-shell/src/chrome.ts` | Isolated Play exists; this dock still has no log stream. |
| `dock-evidence` | 1 | **partial** | Shows accepted/staged rarity evidence and honest empty copy; general command and capture evidence is not projected. | rarity desktop golden and chrome | Final enforcement remains [#270](https://github.com/Vhailors/sceneaxi/issues/270). |
| `dock-timeline` | 1 | **real** | Timeline commands create, edit, move, and remove bounded clips, tracks, and keyframes through Change Review; scrub preview is a non-mutating evaluation of the named project version. | animation golden; command registry | None for #259. |
| `overlay-open-palette`, `status-refusal-help`, `status-overlay-palette`, `overlay-close-outcome-dismiss` | 4 | **real** | Open/close the command palette, refusal disclosure, and outcome dialog with focus containment. These seven outside-refusal controls (including profiles) are the only live Kids controls. | control accounting and command interaction golden | [#265](https://github.com/Vhailors/sceneaxi/issues/265) rechecks the final workspace control set. |
| `palette-{project-new,project-open,project-save,project-git-status,project-git-diff,project-git-stage,project-git-commit-prepare,ship-export-web,edit-undo,edit-redo,run-play}` | 11 | **real** | Invoke the same registered commands as menu rows; Git state and preparation evidence are the same values returned to CLI and local-agent clients, while unavailable document-history commands preserve focus and name the refusal. | command interaction golden; contained Git golden; full-editor transaction golden | None for this slice. |
| `viewport-source-scene`, `viewport-source-game`, `viewport-source-sculpt-preview` | 3 | **real** | The three sources resolve through `viewport-source-set` against the isolated Play session. Game is live only while Play is running; Scene is authoring; Sculpt preview remains the existing assistant preview owner. | play-session golden; command registry | None for #258. |
| `assistant-manipulator-{move-x,move-y,rotate-y,scale-up}` | 4 | **partial** | Linux promotes them after an assistant artifact mounts. They apply four fixed Mount API operations only, outside saved scene authoring. | `desktop/linux/src/lib/assistant-viewport.ts`; Linux bridge golden | [#254](https://github.com/Vhailors/sceneaxi/issues/254). |

### Linux-only injected BYOK controls

| Item | Status | Current behavior | Evidence owner | Smallest dependency |
|---|---|---|---|---|
| OpenRouter provider select | **real** | Two-option selector (OpenCode · DeepSeek V4 Pro and OpenRouter). Packaged execution leases the OpenCode key; OpenRouter remains the fixture-tested composition provider. | `desktop/linux/src/renderer/byo-configuration.ts`; `tests/desktop/desktop-byo-secure-storage.test.ts`; `tests/desktop/desktop-opencode-live-transport.test.ts` | None for the packaged OpenCode path. |
| Password input | **real** | Exists only in the renderer, clears on hide and after every submission, and never crosses the engine bridge or local-agent socket. Disabled when secure storage is not ready. | secure-storage contract and tests | None for storage; [#261](https://github.com/Vhailors/sceneaxi/issues/261) for provider execution. |
| Save/Replace key | **real** | Encrypts through Electron `safeStorage`, writes an owner-private atomic envelope, and names unavailable, locked, unsupported, corrupt, failed, missing, and invalid states. | `desktop/linux/src/electron/provider-key-store.ts`; secure-storage tests | None for storage. |
| Remove key | **real** | Deletes only the exact regular owner-private envelope and remains available when the keyring cannot decrypt it. | `desktop/linux/src/electron/provider-key-store.ts`; `tests/desktop/desktop-byo-secure-storage.test.ts` | None. |

The native directory/file dialogs are host interactions reached from modelled
New/Open/Import controls, not extra persistent chrome controls. The three title-bar
window dots and four viewport-tool marks are `aria-hidden` decoration and have no
click or focus behavior.

## CLI, bridge, and assistant inventory

| Surface | Item(s) | Status | Current behavior / gap | Evidence and next dependency |
|---|---|---|---|---|
| CLI | `project new`, `dev`, `test`, `capture`, `report`, `propose`, `apply` | **real** | Versioned envelope, strict flags, text-canonical E1 authoring and evidence. These direct verbs remain separate from the full-editor commands reached through `desktop bridge call`. | CLI golden, proposal/apply, and lifecycle tests. |
| CLI | `scene compose` | **real** | Deterministic offline scene composition with named refusal matrix; the desktop bridge CLI adds hierarchy inspect/select/create/remove/reparent over the active project rather than widening this offline verb. | scene composition golden; hierarchy and CLI→local bridge goldens. |
| CLI | `asset import`, `asset reload`, `asset list` | **real** | Import and stable-id reload cover all bounded v2 manifest families; reload leaves accepted bytes untouched until `project apply`. `list` continues to report catalog Asset Package refs and is not an ambient project scanner. | asset-pipeline and asset-ingestion goldens. |
| CLI | `profile list`, `profile open-path` | **real** | Read-only registry and shared demo policy, including non-zero Kids refusal. | profile/open-path tests. |
| CLI | `catalog list`, `evidence list` | **real** | Read-only bounded listings; catalog commerce remains inert. | registry verb tests. |
| CLI | `desktop bridge call`, `status`, `tools` | **real** | Discovers and authenticates the same-user Unix socket; validates exact tool, permission, and input. `tools` exposes the same command schema version and definitions; registered calls include project migration, contained Git, hierarchy inspect/select/create/remove/reparent, and input-action inspect/rebind/reset without a second CLI result model. | CLI bridge, local RPC, contained Git, hierarchy, input-action, and CLI→local bridge goldens. |
| CLI | `demo gated` | **fake** | Intentionally synthetic held-key fixture command; no product capability uses it. The shipped runtime refuses `HELD_KEY` and fails closed by default. | held-key regression suites; keep outside the full-editor registry. |
| CLI | `protocol version`, `protocol inspect` | **real** | Reports the CLI envelope and exit-code contract. | CLI protocol tests. |
| Desktop interaction table | New, Open, Save, Git Status, Git Diff, Git Stage, Prepare Git Commit, Export Web, Undo, Redo, Play | **real** | All eleven derive identity, label, schema version, and permission from the shared registry; Git inspection displays the shared repository evidence. Every advertised chord and the palette chord derive from the default input-action map; restored overrides update the same emitted resolver and labels. | `apps/desktop-shell/src/interaction-commands.ts`; command interaction, contained Git, and input-action goldens. |
| Electron bridge actions | `handshake`, `profile`, `command`, `scene`, `project-browser-open`, `open-path`, `asset-import`, `ship`, `assistant`, `authoring`, `frame-report` | **real** | `profile` binds the active registered command profile, while `command` validates schema version, declared client, exact input, permission, and Kids denial before adapting to the existing handlers. Legacy transport actions remain for unchanged bounded behavior. | registry unit tests; desktop Linux bridge golden. |
| Authoring operations | `status`, `propose`, `edit-scene`, `edit-property`, `accept`, `reject`, `recover`, `restart`, `undo`, `redo` | **partial** | Real staged review plus base-versioned atomic commit and restart-durable multi-level history. `edit-scene` carries shared hierarchy operations; animation and physics catalogs write `/data` through their own review commands. Package operations remain a later slice. Git is a separate contained service that reads this authority before index mutation. Input settings stay outside document undo. | transaction-history, full-editor transaction, hierarchy, animation, and physics goldens; desktop session/scene tests; [#254](https://github.com/Vhailors/sceneaxi/issues/254) onward. |
| Assistant operations | `start`, `status`, `abandon` | **real** | Real retained-job lifecycle for Ask, Build, and bounded Agent. Ask inspects typed project state; Build/Agent go through registered review. Hosted is excluded by route. | assistant poll/start tests; assistant-ask golden. |
| Local-agent tools | `sceneaxi.bridge.handshake`, `sceneaxi.project.status`, `sceneaxi.project.inspect`, `sceneaxi.project.migration.propose`, `sceneaxi.project.migration.commit`, `sceneaxi.project.migration.recover`, `sceneaxi.project.git.status`, `sceneaxi.project.git.diff`, `sceneaxi.project.git.stage`, `sceneaxi.project.git.commit.prepare`, `sceneaxi.scene.hierarchy.inspect`, `sceneaxi.scene.selection.set`, `sceneaxi.scene.property.set`, `sceneaxi.scene.transform.apply`, `sceneaxi.scene.object.create`, `sceneaxi.scene.object.remove`, `sceneaxi.scene.object.reparent`, `sceneaxi.scene.prefab.inspect`, `sceneaxi.scene.prefab.define`, `sceneaxi.scene.prefab.instance`, `sceneaxi.scene.prefab.override`, `sceneaxi.scene.prefab.refresh`, `sceneaxi.input-actions.inspect`, `sceneaxi.input-actions.rebind`, `sceneaxi.input-actions.reset`, `sceneaxi.project.propose`, `sceneaxi.project.accept`, `sceneaxi.project.reject`, `sceneaxi.project.recover`, `sceneaxi.project.restart`, `sceneaxi.project.undo`, `sceneaxi.project.redo`, `sceneaxi.run.play`, `sceneaxi.run.stop`, `sceneaxi.run.reset`, `sceneaxi.play.inspect`, `sceneaxi.viewport.source.set`, `sceneaxi.animation.inspect`, `sceneaxi.animation.apply`, `sceneaxi.animation.scrub`, `sceneaxi.animation.evaluate`, `sceneaxi.physics.inspect`, `sceneaxi.physics.apply`, `sceneaxi.physics.evaluate`, `sceneaxi.package.inspect`, `sceneaxi.package.install`, `sceneaxi.package.remove`, `sceneaxi.profile.inspect`, `sceneaxi.workspace.layout.inspect`, `sceneaxi.workspace.layout.apply`, `sceneaxi.workspace.layout.reset`, `sceneaxi.extension.inspect`, `sceneaxi.extension.start`, `sceneaxi.project.build`, `sceneaxi.assistant.ask`, `sceneaxi.assistant.apply-build`, `sceneaxi.assistant.local.start`, `sceneaxi.assistant.byo.start`, `sceneaxi.assistant.local.agent`, `sceneaxi.assistant.status`, `sceneaxi.assistant.abandon` | **partial** | Sixty-one permission-bound tools. Git mutations accept only explicit contained paths, and UI (`desktop-control`), CLI, and local-agent paths receive the same repository state/evidence value. Input settings use the same registered command metadata and explicit review/approval bases while remaining outside document undo. The transport still excludes credentials, Hosted, renderer-only frame actions, push, fetch, and history operations. | `packages/schemas/src/desktop-local-bridge.ts`; contained Git, input-action, full-editor transaction, and hierarchy goldens; CLI→local bridge golden. Credentials, Hosted, and history operations remain excluded. |

`packages/cli/src/held-keys/shipped.ts` is a fail-closed map for captain-held CLI
verbs, not the full-editor command registry. Likewise,
`packages/schemas/src/desktop-local-bridge.ts` is the closed local-agent transport
tool registry. Full-editor work must preserve both purposes while removing copied
product-command definitions.

## Packaging and runtime surfaces

| Surface | Status | Current evidence and blocker | Smallest dependency |
|---|---|---|---|
| Shared Electron product implementation | **real** | `desktop/linux` owns the application; macOS and Windows stage its bundled runtime rather than fork the chrome, bridge, or renderer. ADR 0024 and `pnpm check:desktop` enforce the boundary. | None. |
| Linux editor application build (`AppImage`, `.deb`) | **real** | Build, checksums, CI Xvfb/SwiftShader packaged smoke, and a recorded first-download workflow artifact exist. This packages SceneAxi Engine Desktop, not a user's project. | `docs/desktop-linux.md`; `desktop/linux` | None for the current editor app; project output remains closed [#266](https://github.com/Vhailors/sceneaxi/issues/266). |
| Current-host Linux packaged smoke | **partial** | Two 2026-08-07 attempts exited in Electron 43.2.0's GPU process after `InitializeSandbox()` and `SIGSEGV`, before SceneAxi printed proof. CI under Xvfb owns the valid packaged-runtime proof. This is a host limitation, not a SceneAxi regression. | External host/runtime change only; do not “fix” product code without new evidence. |
| macOS editor packaging | **partial** | Staging, configuration smoke, fail-closed signing/notarization procedure, update policy, and macOS runner workflow exist. No signed/notarized public artifact or release record exists. | Operator macOS host and credentials for the editor app; user-project target [#267](https://github.com/Vhailors/sceneaxi/issues/267). |
| Windows editor packaging | **partial** | NSIS configuration, signing/update refusals, staging, and host-independent smoke exist. No signed public artifact exists. | Operator Windows host and credentials for the editor app; user-project target [#268](https://github.com/Vhailors/sceneaxi/issues/268). |
| Static Web project export | **real** | Linux writes and verifies a content-addressed viewer plus Delivery Handoff. | `desktop/linux/src/lib/web-export.ts`; `tests/e2e/desktop-web-export-golden.test.ts` | None for current scope. |
| Linux project build artifact | **fake** | Shared `project-build` can name linux, but this host refuses `PROJECT_BUILD_SIGNING_MISSING` before packaging. #266 stays closed; the editor AppImage/deb is not a user-project artifact. | Closed [#266](https://github.com/Vhailors/sceneaxi/issues/266); signing and release authority remain absent. |
| macOS project build artifact | **partial** | Shared `project-build` names the macos target and refuses `PROJECT_BUILD_HOST_UNSUPPORTED` on this Linux host before signing, notarization, or a release-ready claim. No signed/notarized user-project artifact exists here. Evidence: `packages/schemas/test/desktop-project-build.test.ts`; `tests/e2e/desktop-project-build-golden.test.ts`. | Operator macOS host, signing, and notarization credentials. |
| Windows project build artifact | **partial** | Shared `project-build` names the windows target and refuses `PROJECT_BUILD_HOST_UNSUPPORTED` on this Linux host before SignTool or a release-ready claim. No signed user-project artifact exists here. Evidence: `packages/schemas/test/desktop-project-build.test.ts`; `tests/e2e/desktop-project-build-golden.test.ts`. | Operator Windows host, SignTool, and signing credentials. |

## Full-editor capability gaps

| Capability required by #249 | Current classification | Current owner or evidence | Implementation issue |
|---|---|---|---|
| Shared typed command registry across UI, CLI, assistant | **partial** | The versioned registry drives File/Save/Undo/Redo/Play/Change Review/bounded Assistant metadata, project inspect and migration, plus hierarchy inspect/select/property/create/remove/reparent across desktop-control, CLI, and local-agent boundaries. Later full-editor commands are deliberately absent. | [#254](https://github.com/Vhailors/sceneaxi/issues/254) onward add only their own vertical slices. |
| Versioned native project manifest, deterministic ids, migrations, capabilities | **real** | `project-manifest.schema.json` and the public validator own v1; New writes document + manifest atomically; object/asset identities derive only from persisted project/source identity; inspection refuses unknown major, invalid chain, duplicates, undeclared grants, traversal, and canonical escapes; migration proposal/approval/commit/recovery and evidence replay byte-identically across roots. | `packages/schemas/test/project-manifest.test.ts`; `packages/authoring-core/test/project-model.test.ts`; `tests/desktop/desktop-project-lifecycle.test.ts`; desktop bridge and CLI→local bridge goldens; [#252](https://github.com/Vhailors/sceneaxi/issues/252) owns broader transactions, not this manifest flow. |
| Atomic conflict-aware recovery with multi-level undo/redo, progress, evidence | **real** | Explicit base hashes refuse stale writes before journal creation; prepared/undoing/redoing phases recover deterministically; exact canonical before/after bytes and ordered history survive restart; a new commit alone invalidates the superseded redo suffix; every client receives one bounded transaction result. | `packages/authoring-core/test/transaction-history.test.ts`; `tests/e2e/full-editor-transactions-golden.test.ts`; journal recovery suite |
| Hierarchy, multi-select, parent/child | **real** | Versioned composition projection, canonical ordered selection, bounded create/multi-remove, explicit-policy reparenting, review/undo/redo/reopen/Play, CLI and assistant inspection | `tests/e2e/desktop-hierarchy-golden.test.ts` |
| Gizmos, snapping, full transform inspector | **real** | `scene-transform-apply` is the one command for numeric entry and keyboard gizmo nudges. Local/world, pivot, axis constraints, and snap are explicit inputs with named refusals. Multi-selection reports every affected id; preview stays off saved bytes until accept. Headless command evidence is `tests/e2e/desktop-transform-golden.test.ts`; pixels remain a separate browser observation. | `packages/schemas/test/desktop-scene-transform.test.ts`; transform golden | None for #254. |
| Prefab-like reusable content | **real** | `scene-prefab-{inspect,define,instance,override,refresh}` own one versioned catalog of definition snapshots, deterministic instance ids, explicit transform overrides, and named source-conflict refusals. Desktop, CLI, and local-agent inspect the same resolved instance; mutations are ordinary E1 reviews. | `packages/schemas/test/desktop-scene-prefab.test.ts`; `tests/e2e/desktop-prefab-golden.test.ts` | None for #255. |
| First-class assets, previews, manifests, hot reload | **real** | Manifest v2 admits bounded SceneAxi artifacts, contained GLB/glTF, PNG/JPEG/WebP, WAV/Ogg/MP3, WOFF2/WOFF/TTF/OTF, and animation-data metadata with stable ids, byte-derived previews, exact provenance, contained materialization, and review-only digest reload. Browser, assistant inspection, applicable Play loading, CLI, and Web export consume the same entry. | `packages/schemas/contracts/project-asset-manifest.schema.json`; importer tests; asset-pipeline and asset-ingestion goldens |
| Unified rebindable keyboard/mouse/controller input | **real** | `input-action-map.schema.json` and `input-action-registry.ts` own versioned keyboard, pointer, wheel, and controller vocabulary, contexts, defaults, stable refusals, conflict checks, and project-over-workspace composition. Desktop accelerators and the current editor/Play viewport resolve the effective map; inspect/rebind/reset are review/approval commands with atomic restart-durable settings and no document-undo or layout coupling. | schema registry tests; `tests/e2e/input-actions-golden.test.ts`; command-interaction golden; viewport input-action test; CLI bridge test |
| Isolated Play clone and viewport-source lifecycle | **real** | `run-play` records an isolated clone digest against the explicit source content hash; Game/Scene/Sculpt-preview switch one viewport owner; Stop and reset dispose or replace the clone without writing authoring bytes. CLI and assistant inspect the session without frame-report authority. | `packages/schemas/test/desktop-play-session.test.ts`; `tests/e2e/desktop-play-session-golden.test.ts` | None for #258. |
| Animation authoring and deterministic replay | **real** | `animation-{inspect,apply,scrub,evaluate}` own one versioned catalog of clips, tracks, and keyframes. Scrub names the exact project version and writes no saved bytes. Play evaluation of the same catalog and hash is digest-identical. Imported animation-data stays unbound until `bind-asset`. | `packages/schemas/test/desktop-scene-animation.test.ts`; `tests/e2e/desktop-animation-golden.test.ts` | None for #259. |
| Physics authoring and deterministic replay | **real** | `physics-{inspect,apply,evaluate}` own bodies, shapes, materials, constraints, gravity, and a 1–32ms fixed step. Play replay is seed/step deterministic, never writes authoring bytes, and applies animation then physics when both affect one object. | `packages/schemas/test/desktop-scene-physics.test.ts`; `tests/e2e/desktop-physics-golden.test.ts` | None for #260. |
| Assistant inspect → propose → approve → apply; real configured providers | **real** | `assistant-ask` answers from an explicit scope; Local/BYOK Build artifacts apply through `assistant-apply-build` and Change Review, which now catalogs the artifact and places it as a new composed-scene instance; Agent remains the labelled rarity fixture and cannot stand in for a configured cloud provider. Packaged BYOK leases the OpenCode DeepSeek V4 Pro key and records model/provider/version/no-fallback. | `packages/schemas/test/desktop-assistant-ask.test.ts`; `tests/e2e/desktop-assistant-ask-golden.test.ts`; `tests/desktop/desktop-scene-property.test.ts`; `tests/e2e/desktop-provider-authoring-engine-golden.test.ts` | None for #261. |
| Package management and Plugins room | **real** | `package-{inspect,install,remove}` own a versioned lock of contained, capability-declared packages. Discovery reads metadata only and never executes an unapproved package. Install/removal are Change Review transactions. Marketplace and networking stay named false. | `packages/schemas/test/desktop-scene-package.test.ts`; `tests/e2e/desktop-package-golden.test.ts` | None for #262. |
| Contained Git workflow | **real** | `project-git-{status,diff,stage,commit-prepare}` share one project-root service and typed repository evidence across desktop, CLI, and local-agent clients. Status/diff report canonical manifest-owned files plus unrelated changes without writes; stage accepts exact reported files only; preparation requires the complete staged selection and creates no commit. Named pre-mutation refusals cover SceneAxi review/recovery/transaction state, conflicts, detached worktrees, missing Git/capability, Kids, path/repository escape, and unsupported push/fetch/credential/history/branch-deletion/hook-bypass operations. Document undo/redo remains explicitly `sceneaxi-document-only`. | `packages/authoring-core/test/project-git.test.ts`; `tests/e2e/contained-git-golden.test.ts`; command interaction golden | None for #263; no remote or history-mutating Git surface is authorized. |
| Profiling | **real** | `profile-inspect` records Play-backed metrics with source, unit, sample window, and project/runtime identity. Absent measurements are named disabled states. Headless evidence never claims pixels or GPU timing and writes no authoring bytes. | `packages/schemas/test/desktop-profile-evidence.test.ts`; `tests/e2e/desktop-profile-golden.test.ts` | None for #264. |
| Accessibility and persistent dockable workspaces | **real** | `workspace-layout-{inspect,apply,reset}` persist a versioned layout outside the Scene Document. Corrupt, stale, and off-screen bytes recover to the named default without silent overwrite. Kids cannot restore editor chrome. Document undo is explicitly false. | `packages/schemas/test/desktop-workspace-layout.test.ts`; `tests/e2e/desktop-workspace-layout-golden.test.ts` | None for #265. |
| Verified Linux/macOS/Windows user-project artifacts | **partial** | Shared `project-build` command exists. Linux project packaging remains the closed #266 gap. macOS and Windows refuse missing host/signing/notarization/release authority and never report release-ready. | project-build tests | Operator macOS/Windows hosts and credentials. |
| Networking, XR, marketplace, collaboration extension seams | **real** | `extension-inspect` and `extension-start` declare networking, XR, marketplace, and collaboration as versioned disabled seams. Start always refuses `EXTENSION_ADAPTER_ABSENT`. Package metadata cannot grant those capability ids. Enabling a future adapter requires a new issue, not a runtime flag. | `packages/schemas/test/desktop-extension-seams.test.ts`; `tests/e2e/desktop-extension-seams-golden.test.ts` | None for #269. |
| Matrix-to-evidence enforcement | **real** | `tests/docs/capability-matrix-audit.test.ts` and `tests/e2e/desktop-capability-matrix-audit.test.ts` fail on unknown status, missing owner, stale evidence path, unsupported real claim, unaccounted control, or a missing Electron 43.2.0 host-limitation record. | `tests/docs/capability-matrix-audit.ts`; `tests/e2e/desktop-capability-matrix-audit.test.ts` | None for #270. |

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

Children #250–#270 are implemented or honestly refused on `main`. This graph is
historical sequencing, not a second todo list. Remaining partial and fake rows
above name host credentials, closed #266 Linux project packaging, or
intentionally denied surfaces.

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

## Native project-model slice

[#251](https://github.com/Vhailors/sceneaxi/issues/251) adds
`sceneaxi.project.json` v1 without changing the Scene Document model. New Project
creates both canonical files atomically. Existing valid projects inspect as
legacy and no open/seed path rewrites them; the registered migration commands
persist a deterministic proposal, require approval bound to its digest, prepare
a recoverable commit, and emit path-free deterministic evidence. Structural
validation is browser-safe in `@sceneaxi/schemas`; filesystem containment and
canonical-path checks stay in `@sceneaxi/authoring-core`. This slice adds no
hierarchy, asset-family expansion, provider,
deployment, publication, or Kids activation behavior.

## Transaction and hierarchy slices

[#252](https://github.com/Vhailors/sceneaxi/issues/252) makes the existing
authoring session the one command transaction authority, including durable
multi-level undo and redo. [#253](https://github.com/Vhailors/sceneaxi/issues/253)
builds on that authority rather than adding a hierarchy document or journal.
The validated `ComposedScene` already persists stable instance ids,
`rootInstanceId`, parent ids, local transforms, world transforms, artifact bytes,
and digest evidence. The desktop projects it as
`sceneaxi.desktop-scene-hierarchy` schema version 1, orders every client
selection by the composition's canonical depth/id traversal, and stages
create/remove/reparent as the existing single `/data/composedScene` edit.

Reparenting requires `preserve-world` or `preserve-local`; both policies produce
canonical bytes for the axis-aligned v1 transform contract. The shared command
boundary denies Kids or an absent `scene.compose` capability before project I/O.
The operation boundary then names cycles, a missing parent, the protected root,
a stale selection, an invalid policy, and unsupported input before proposal or
write. The hierarchy golden proves review, Save, fresh-session reopen, Play,
Undo, Redo, desktop/CLI/local-agent parity, and local validated-artifact
create/multi-remove.

Compatibility is a projection, not an artifact migration: existing valid
composed-scene fixtures are read through `composedSceneFromDocumentData()` and
projected into hierarchy v1 without changing their document or Sculpt Artifact
bytes. A valid legacy project therefore stays byte-identical until its separately
reviewed native-project migration is approved; hierarchy inspection itself never
migrates it. New projects receive the native v1 `scene.compose` grant from the
existing manifest seed.

## Inventory decisions

The inventory required one update to existing architecture ownership:
[ADR 0003](adr/0003-editor-sequencing-e1-first-e2-specified.md) now records the
captain-authorized packaged-desktop exception for full editor v1. It does not
claim Stage 6 ran, does not widen the Web editor, and does not authorize a Kids
editor. No new ADR is needed: Electron ownership, Three presentation ownership,
plugin capabilities, and platform packaging already have owners in ADRs 0017,
0024, and 0004–0005.
