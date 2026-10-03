# Independent engine audit

Graph: `sceneaxi-production-swarm` · node/role: `engine-independent-audit` / code · observed HEAD: `4e532e2fbf43e9948741578ab6208a3277870405` · platform: Linux x86_64, Node 24.21.0, pnpm 9.15.0.

**Audit completed; coverage PARTIAL; full-production status PARTIAL.** This is not shipping, proof-run, deployment or release authority. Source was READ ONLY. Only this report and `audit-engine.json` are owned/written. Findings are before-builder evidence, not claims that later integrated source still fails. Integration must rerun the oracles after fixes. No new credentials/dependencies/services, spend, publication or production mutations.

## Scope and method

Read AGENTS.md, relevant docs/agents/layout.md ownership, runnable-surfaces.md, production-activation.md, baseline.md, decision-log.md, current go-live-backlog.json and go-live-gaps-2026-09-26.md. Baseline records no EMPRYO.md in checked real-root ancestors; root/local engine package searches found none. Real root throughout: `/home/devuser/Documents/Projects/sceneaxi`, never the demo workspace. Examined public `open`, `replay`, `openSceneKernelSession`, `replaySceneKernelSession`, orchestrator bootstrap/resume/close, `createThreePresentationCore`, `createThreePresentationRuntime`, `createSculptMountApi`, Three sculpt asset/environment/effects boundaries, and Rapier host/world lifecycle. Also read relevant cross-lane schema/testing and desktop seams solely to understand requirements/dependencies.

Counterexamples were attempted before confirming findings: ordinary, supported, malformed, hostile-error and overflow inputs; public save/replay JSON round trips; actual browser WebGL, mount reconciliation and resource lifecycle. Headless counters and injected recording surfaces are never pixel evidence. Retained-session references after orchestrator close are **not** classified as an authority defect: ADR0023 intentionally returns the kernel session itself; close refuses subsequent handle.session() access, not existing references.

## Executed evidence

All commands used real-root shell cwd unless a child explicitly used the umbrella install root. The project test tool reported `No test command detected`; exact pnpm/Vitest commands were recovered through shell without changing checks.

| Evidence | Command / actual assertions | Result and limits |
|---|---|---|
| E1 | `pnpm exec vitest run packages/engine-kernel/test packages/engine-orchestrator/test packages/engine-presentation/test packages/physics-rapier/test tests/e2e/{physics-rapier,scene-composition,input-actions,desktop-physics,desktop-animation,umbrella-live-open,umbrella-editor-viewport}-golden.test.ts --reporter=verbose` | exit0, 194 assertions. Kernel digest/save/scene replay, host refusal/close, presentation and real WASM collisions/joints pass. No browser inference. |
| E2 | Exact expanded command in JSON: four package test directories, six relevant schema suites, sixteen golden/parity files; `pnpm exec vitest run ... --reporter=json`, captured through Node spawnSync to avoid output rewriting | exit0, **39 files /333 tests, 333 pass, 0 failed/pending/todo**, 11801ms. Includes three-fresh-process Rapier bytes checked against committed fixture. Root full gate was executed by baseline, not redundantly claimed as this node's command. |
| E3 | Node registerHooks with existing `scripts/workspace-dist-resolver.mjs`; dynamic imports by public package name; valid JSON save/replay plus invalid versions/overflow/snapshot/environment/viewport and close probe | exit0: expected counterexamples reproduced. Product Infinity survives replay while snapshot JSON writes null; duplicate/nonfinite presentation accepted; type backend Group exposed. |
| E4 | Same public import probe; BufferGeometry setAttribute/dispose instrumentation; valid first triangle + invalid second triangle, five failures | exit0: five allocated geometries remain undisposed after backend.dispose. mountTriangleAsset also accepts after dispose. No source patched; prototype probes restored at end. |
| E5 | Local existing Next production build: `node sites/umbrella/node_modules/next/dist/bin/next start -p 3417 -H 127.0.0.1`; installed Playwright API with `/usr/bin/chromium`, headless ANGLE SwiftShader; actual GET /open and buttons | exit0: WebGL2, frame2, drawCalls16, pixelsDrawntrue, three service-crate instances; five root/all cycles, reset and resize to634x356, zero pageErrors. Canvas PNG64324 bytes, SHA256 `bbb2bc4be4dd3fc07de6ee20e21d2ce4b56f277e9db0fc714a4d770d10ef9d5f`. Screenshot bytes were inspected in memory, not stored in an unowned file. Local software-GPU proof, not hardware/platform/production deployment proof. |
| E6 | Second actual /open process port3418; canvas2D drawImage/getImageData pixel oracle and intercepted GL create/delete counters | exit0:1214x558 buffer, **867 sampled distinct RGBA colors**, ten root/all cycles keep Buffer62/Texture5/Program2/Framebuffer3/Renderbuffer0 net allocations. This is real pixel evidence independent of frame labels. Navigation to /profiles cleared document globals; its empty counters were explicitly **refuted as disposal evidence**. |
| E7 | Existing desktop esbuild bundles public package and public schema fixture in memory (`write:false`); installed Chromium invokes public backend + createSculptMountApi directly in the same document | valid behavior passes: WebGL3 draw calls, twenty mount/unmount cycles stable Buffer10/Texture5/Program2/Framebuffer3, resize320x240, capture19505 PNG bytes, mount API disposal refusal, browser kernel save/replay equality. **exit1** for terminal-zero assertion: Texture5 and Framebuffer3 counters remain; counters alone do not establish all handles are bound/live. |
| E8 | Same browser public core, repeated create/draw/dispose on same canvas; retained created handles checked with actual gl.isTexture/gl.isFramebuffer | initial oracle exit1 because predicted5 textures differed from actual4 (empty scene has no shadow texture): harness expectation corrected, not product fixed. Corrected oracle **exit0**, confirms live textures **4→8→12**, live framebuffers0 throughout, contextLostfalse. No framebuffer leak claimed. Terminal browser cleanup releases contexts. |
| E9 | Public bootstrap with ordinary Error vs hostile thrown object's toString; public sculpt clock1e308 | exit0: ordinary Error → OPEN_PATH_HOST_INVALID; hostile error coercion escapes as raw throw. Sculpt accepts clock then contains nonfinite root state. |

Harness failures are not product failures: incorrect nonexistent resolver export; importing `three` from root instead of owning package; shell output rewriting JSON into `PASS (333) FAIL (0)` caused JSON.parse error. All three were corrected without changing product. E7 is a genuine teardown oracle failure; E8's first failure was an incorrect numerical expectation, and its corrected live-handle assertion establishes the narrower actual defect.

## Prioritized findings / exact tasks

Every task is **pending builder/integration**. No local defect is parked as an external blocker. Source lines refer to audited baseline, and will move after builders.

### ENG-002 · P0/high · nonfinite authoritative state from valid-by-validator numbers

- Source/symbol: `packages/engine-kernel/src/session.ts:204 validateManifest`, `:450 isIntegerPair`, `:543 validateClock`, `:663 advance`; `packages/engine-kernel/src/sculpt-session.ts:100 normalizeOptions`, `:154 validateSculptClock`, `:206 SculptNodeSimulation.applyClock`; scene advance delegates to that simulation at `scene-session.ts:143`.
- Reproduction: open entity x1e308, dispatch move1e308, advance tick1/delta16 ⇒ xInfinity; serialized observed position null. Public sculpt artifact + deltaMs1e308 also produces nonfinite root transforms/velocity. `Number.isInteger(1e308)` is true. Valid small-number JSON save/replay passes, refuting a broad determinism failure; narrow overflow remains.
- Impact: corrupt portable snapshots, ambiguous JSON digests, invalid downstream render coordinates; only-advance mutation alone does not protect state validity.
- Owner/files: engine builder owns the three kernel source files above plus package session/sculpt/scene test files. Shared dependency: schemas owner for `packages/schemas/src/kernel-session.ts`, kernel-session contract/fixtures if bounds are made normative; no root dependency change needed.
- Fix: safe integer/range clocks and commands; deterministic state/result overflow guards with all-or-nothing advance across scene instances. Bound rounding and accumulated elapsed time; refusal cannot consume queued commands or partially mutate nodes.
- Acceptance: `pnpm exec vitest run packages/engine-kernel/test/session.test.ts packages/engine-kernel/test/sculpt-session.test.ts packages/engine-kernel/test/scene-session.test.ts`; public huge/unsafe inputs refuse before mutation, snapshots remain finite/JSON-roundtrippable, valid golden digests unchanged. Add multi-instance rollback oracle and repeat rejected frame.

### ENG-005 · P1/high · partial asset allocation leakage and post-dispose mutation

- Source/symbol: `packages/engine-presentation/src/three-sculpt.ts:139 buildTriangleAsset`, `:279 replace`, `:383 mountTriangleAsset`, `:415 dispose`.
- Reproduction: two meshes, first valid triangle, second positionsNaN; repeat five failed mountTriangleAsset calls ⇒ first geometry from each build never disposed, even after backend.dispose. Separate backend.dispose then valid mountTriangleAsset succeeds, while render refuses disposed. The safer `createSculptMountApi` denies its own post-dispose calls, refuting a blanket claim that all mount paths fail.
- Impact: repeated malformed contained projections allocate unreachable CPU resources and post-dispose geometry; failed replacement lacks transactional ownership.
- Owner/files: engine builder three-sculpt.ts, three-presentation.test.ts; assets lane owns upstream importer validation but cannot replace this public seam guard.
- Fix: validate entire mesh/node/transform tree before allocation, catch/clean partially built roots, guard every backend mutator and keep old visible root on failed replacement. Include group-cycle/duplicate/missing-parent refusals; do not silently omit disconnected nodes.
- Acceptance: `pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts`; public valid+invalid mesh sequence produces zero residual allocations, old frame remains usable, direct backend methods after dispose consistently refuse, repeated dispose is safe.

### ENG-003 · P1/medium · presentation runtime trusts malformed neutral data and unbounded framebuffer sizes

- Source/symbol: `packages/engine-presentation/src/three-runtime.ts:76 requireSnapshot`, `:162 present`; `three-core.ts:126 resolveViewport`, `:197 applyEnvironment`.
- Reproduction: duplicate entity ids plus NaN/Infinity coords are accepted; lastFrame.entityCount2 while one marker exists. NaN ambient intensity, infinite key direction, fog near10/far-1 accepted. Headless resize1e9×1e9 with ratio1e9 accepted; huge allocation was deliberately NOT attempted on GPU.
- Impact: misleading frame metadata and unstable/invalid draw state; hostile or erroneous SDK caller can request excessive GPU allocation. Current site consumer clamps ratio2, so this is public-library boundary exposure, not an established remote site exploit.
- Owner/files: engine builder three-runtime.ts/three-core.ts and presentation tests. Shared schemas/catalog owner must align documented numeric budgets and identifier vocabulary, without widening matrix.
- Fix: unique bounded ids, finite renderer-representable positions, safe ticks, full environment validation before mutation, explicit framebuffer dimension/pixel-budget rejection. Preserve last good frame on refusal.
- Acceptance: `pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts packages/engine-presentation/test/three-surface.test.ts`; malformed cases throw named ThreePresentationError without changing frame/camera/resources. Test safe boundary dimensions, not destructive huge GPU allocations.

### ENG-006 · P1/medium · renderer-owned live texture accumulation after terminal dispose

- Source/symbol: `packages/engine-presentation/src/three-surface.ts:343 dispose`, `three-core.ts:384 dispose`. Pinned Three WebGLState creates four default textures at dependency `src/renderers/webgl/WebGLState.js:438`.
- Reproduction: actual Chromium public core create/draw/dispose three times on same retained canvas ⇒ gl.isTexture confirms4,8,12 still-live textures and context remains active. Bound mesh buffers/programs are released; no live-framebuffer leak proven. This refutes the tempting broader GPU-everything-leaks claim.
- Impact: recreated views/SDK remounts retain per-renderer defaults until context/GC teardown; stable resource acceptance is incomplete across renderer lifecycle, even though ordinary mount reconciliation is stable.
- Owner/files: engine builder three-surface.ts and surface tests; sites-ui/desktop owners must agree canvas context ownership/remount semantics.
- Fix: terminal context ownership/teardown that releases renderer defaults (own canvas terminal loss, or explicitly reusable surface owner), with correct restoration/remount behavior and no disruption to externally injected surfaces. Do not patch vendor or count context invalidation as pixels.
- Acceptance: existing presentation suites plus actual Chromium repeated public mount/draw/dispose on one retained canvas; no linear live-handle growth; remount supported or explicitly named refusal; context-loss frames report pixelsDrawnfalse; no stale capture; verify real restored frame.

### ENG-004 · P2/medium · backend type crosses advertised hidden seam

- Source/symbol: `packages/engine-presentation/src/index.ts:42 createThreePresentationCore` export; `three-core.ts:109 ThreePresentationCore`, `:114 content:Group`; emitted declaration `dist/src/three-core.d.ts:76`.
- Reproduction: public return.content.type is Group and inferred return declaration imports Three.Group. Not merely a private internal deep import: public factory exposes it.
- Impact: consumers can couple to/mutate backend internals, contradicting ADR0002 and docs/three-presentation-core.md:51 no Three exported types. Kernel authority is still separate; no kernel mutation exploit alleged.
- Owner/files: engine builder index.ts/three-core.ts/three-runtime.ts/three-sculpt.ts and seam tests; docs owner `docs/three-presentation-core.md`, package README/API output; root manifest exports need no widening.
- Fix: split package-private internal core factory from public opaque/numeric core facade; keep existing internal facades sharing one renderer. Preserve useful public draw/resize/capture/environment controls.
- Acceptance: `pnpm build && pnpm exec vitest run packages/engine-presentation/test/seam.test.ts packages/engine-presentation/test/three-presentation.test.ts`; compile consumer type oracle ensures public return exposes no Three/importable Group, while WebGL behavior/goldens unchanged.

### ENG-007 · P2/medium · hostile thrown values bypass named orchestrator refusals

- Source/symbol: `packages/engine-orchestrator/src/open-path.ts:194 kernelMessage`, `:213 resolveHost`, `:317 bootstrapWith`.
- Reproduction: injected nowMs throws `{toString(){throw Error('hostile-error-coercion')}}` ⇒ raw error escapes bootstrapOpenPath; ordinary Error correctly becomes OPEN_PATH_HOST_INVALID. Current injected host is trusted, so this is resilience/protocol failure, not demonstrated remote code execution.
- Owner/files: engine builder open-path.ts/refuse-matrix.test.ts. No schema/manifest edge needed.
- Fix: total, bounded, accessor-safe error description with stable fallback and no incidental execution/leakage; cover hostile Error.message accessors/proxies as well as arbitrary thrown values.
- Acceptance: `pnpm exec vitest run packages/engine-orchestrator/test/refuse-matrix.test.ts packages/engine-orchestrator/test/open-path.test.ts`; bootstrap/resume never leak diagnostic coercion errors, reasons stable, no provider/secret dumps.

### ENG-001 · P2/medium · explicit engine/BOM compatibility policy missing (NOT a confirmed current contract violation)

- Source/symbol: `packages/engine-kernel/src/session.ts:98 replay`, `:111 VERSION_RE` checks; package README:9-10 explicitly promises **schema** major refusal only.
- Reproduction: valid save with kernelVersion or bomVersion99.0.0 is accepted unchanged. Refutation: schemaVersion mismatch DOES refuse and only schema-major policy is normative here. Initial candidate high-defect severity is withdrawn.
- Impact: future engine/BOM changes have no explicit acceptance/migration policy; current digest equality remains necessary and working.
- Owner/files: engine builder session.ts/session.test.ts; schemas owner kernel-session contract; docs owner README/kernel-browser-open and compatibility ADR clarification.
- Recommended default: support documented same-major engine/BOM compatibility, otherwise named refusal until a migration exists; preserve exact current0.0.0 artifacts/goldens. Document rather than pretending old contract was stronger.
- Acceptance: session test command above plus public compatibility table/schema drift checks; same supported save JSON reproduces exact digest; unsupported major rejected before event work. No assertion weakening.

### ENG-008 · P2/medium · no explicit session/renderer/Rapier resource budgets

- Source/symbol: `session.ts:652 pending.push`, `:678 events.push`; `scene-session.ts:105 advances`, `:148 advances.push`; `physics-rapier/src/world.ts:96 createWorld` filters shapes per body; three-runtime marker lookup `:127 markerFor` and scene child lookup.
- Evidence: inspected allocation paths lack declared maximum entities, pending commands, event history/replay length, bodies/shapes or drawing pixel budget. Normal golden sizes pass. No destructive OOM or invented benchmark SLA was attempted.
- Impact: replay/history grows without bound; pending command validation and per-body shape filtering scale quadratically; production capacity is not evidenced.
- Owner/files: engine kernel/session/scene/sculpt, Rapier world, presentation runtime/core and tests; shared schemas/physics-world-host/catalog contracts for budgets and snapshot/checkpoint format. Root package script/benchmark additions belong integration/delivery owner, not this audit.
- Fix: deterministic safe limits/refusals; index shapes/materials once; bounded queue/history or versioned checkpoints that preserve save/replay digests; document limits and measure actual sustained use. Refuse oversize input before WASM/GPU allocation.
- Acceptance: all four package suites, controlled limit/limit+1 public tests, session resume at maximum supported length, resource plateau over100 lifecycle cycles and repeatable measured CPU/memory records. Never call headless counts GPU proof.

## Existing backlog revalidated / remaining production capabilities

All nine engine-owned existing ids are accounted for. Old labels are preserved in JSON, not rewritten as closed production claims.

| Id / old status | Current outcome / implementation | Complete remaining tasks and owners |
|---|---|---|
| 62 parked | `session.ts:459 validateCommand`: spawn/move/rarity-roll only; no general game behavior runtime. Current refusal is intentional narrow union, but missing full-engine gameplay remains. | **ENG-009 P1/local**: choose DEC04 bounded declarative action/state/timer behavior (no eval); only advance resolves it and all inputs/timers replay. Engine kernel owner + schemas `kernel-session.ts`, new versioned behavior contract; desktop input/play owner and examples/docs owner. Acceptance public keyboard/gamepad action → dispatch → advance → save/replay same outcomes; malformed behavior, Kids and unknown actions refuse; add kernel and real packaged-play tests. User delegated local design, so do not park solely for preference. |
| 63 done | Real pinned deterministic Rapier WASM exists (`physics-rapier/src/index.ts:47`; `world.ts:96`), collisions/restitution/fixed+hinge and fresh-process byte replay pass. Categorical no-adapter claim FALSE. | **ENG-010 P1/local**: scene pose/joint-frame/animation integration and physics-aware persistent resume remain incomplete. Current host initializes arbitrary index-based vertical positions at world.ts:108 and snapshots expose y/vy only, not full scene pose. Keep nonzero animation offset refusal until an explicit schema/host pose contract is implemented; never silently ignore it. Shared `schemas/src/physics-world-host.ts`, `desktop-scene-physics.ts`, kernel scene and Rapier world + desktop-scene/viewport owners; compare pose/save/load/collision/joint digests through public desktop bridge and real browser. Existing narrow host does not claim a generic restore method. |
| 64 open | No audio playback seam in audited packages; old metadata-only claim remains accurate. | **ENG-011 P1/local**: user-gesture unlock, contained admitted audio assets, explicit start/stop/volume, disposal/visibility suspend and named unsupported/unavailable refusal; no autoplay/network/provider. Engine new bounded playback adapter/test files, assets/schema admission owner, desktop renderer/control owner. Acceptance existing packaged front-door smoke plus real browser gesture/unlock/play/stop/audio-state oracle; muted autoplay/no gesture refuses, asset/path invalid rejected, zero active audio sources after dispose. Actual audible/device proof is separate from an AudioContext counter. |
| 66 done | `three-sculpt.ts:166` imports UV and contained RGBA DataTexture; PNG path exists. Old no-textures claim FALSE. | **ENG-012 P2/local**: repeatable real checker-texture pixels/resize/dispose evidence using admitted GLB/glTF, then contained JPEG/WebP decoder with explicit bounds if supported. Assets/importer owner + schemas asset-render and engine three-sculpt owner; existing triangle-asset/refusal test and actual packaged/browser front door. PNG numeric array test is not textured-pixel evidence. |
| 67 done | Imported node TRS/quaternion playback at three-sculpt.ts:397 works in existing tests; not skeletal animation. | **ENG-013 P2/local**: real imported-animation before/after pixels, STEP/LINEAR/replay/time-bound proof; then separately implement validated JOINTS_0/WEIGHTS_0 and CUBICSPLINE or retain explicit unsupported errors and full-production gap. Shared schemas glTF-animation/importer, engine backend, assets lane, desktop playback owner; acceptance current desktop-animation golden plus real public fixture animation pixel and resource oracle. |
| 68 done | Bloom/vignette EffectComposer, seeded Points and emissive/opacity overrides now drawn (`three-surface.ts:224`, `three-core.ts:294`, `three-sculpt.ts:320`). Old schema-only claim FALSE. | **ENG-014 P2/local**: actual browser positive/negative postprocess/particle/material pixel comparisons; repeated effects switching/dispose resource counts and context restoration. Presentation owner + site/desktop fixture wiring; existing package suites and real browser catalog changes. Performance budget must cover software and physical GPUs separately. |
| 69 done | Input registry/golden supports standard gamepad actions/deadzones; no built-in gameplay consumer of play.primary. Categorical no-gamepad claim FALSE; physical controller acceptance not executed here. | **ENG-015 P1/local**: wire bounded primary action via ENG009, preserve editor/play contexts and source-hash clone isolation; durable rebinding remains existing schema/desktop owner. Acceptance `pnpm exec vitest run tests/e2e/input-actions-golden.test.ts packages/schemas/test/input-action-registry.test.ts` plus actual packaged event path; physical device proof requires real connected controller and cannot be fabricated by navigator mocks. |
| 72 parked | WebGL presentation and offline deterministic core; no WebGPU/network replication implementation in these public exports. | **ENG-016 P3/design-scope**: keep truthful WebGL/offline defaults; any WebGPU second adapter or bounded network protocol must be explicitly chartered, designed and tested through existing authority/matrix owners. Local user mandate is not grounds to widen matrix or invent a server/provider. This remains a full-product scope gap, not missing credentials or a defect in intended refusal. |
| 90 done | Existing site/desktop neutral catalogs reach renderer, seeded effects sampler and overrides. Non-null material texture slots intentionally refuse at three-sculpt.ts:325. | **ENG-017 P2/local/shared-contract**: define contained asset→texture binding (UV set/color-space/sampler/pixel transport), implement replayable lookup and genuine texture pixels; default no external URL loads; Kids refuses. Shared schemas `desktop-scene-materials.ts`, assets import contracts, site-kit mountable-scene, desktop payload and one viewport owner. Existing override refusal must remain until supported, never null placeholders claiming textures. |

### Cross-lane exact files that must not be edited by engine audit

- **Schemas owner:** `packages/schemas/src/kernel-session.ts`, `contracts/kernel-session.schema.json`, associated fixtures; `src/physics-world-host.ts`, `desktop-scene-physics.ts`, `desktop-scene-materials.ts`, `desktop-scene-effects.ts`, `input-action-registry.ts`, glTF animation/asset render contracts. All shared contract changes need `pnpm check:contracts` and boundary checks; no duplicate physics schema.
- **Desktop-linux owner:** `desktop/linux/src/lib/desktop-scene.ts`, `bridge.ts`, `src/renderer/viewport.ts`, control/input/playback owner modules and packaged smoke. Sole production Rapier importer stays desktop. Engine audit does not own these files.
- **Sites-ui owner:** `sites/umbrella/src/app/_components/sculpt-viewport.tsx` (one site renderer), served fixture and neutral payload in `packages/site-kit/src/mountable-scene.ts`; real `/open` and entitled `/editor` front doors. No engine import edge to catalogs or Kids.
- **Assets owner:** importer glTF/contained audio admission, neutral UV/texture/animation projection and bounds; upstream validation cannot replace engine public boundary checks.
- **Root/docs/integration owner:** `package.json` scripts, dependency matrix, generated API/reference and traceability, relevant ADR/three-presentation-core/kernel-browser-open/sculpt/physics/asset-ingestion docs, production-swarm FINAL. No new dependency/manifests are presently required for confirmed fixes; do not widen matrix. Register real browser/resource acceptance without skipping hermetic checks or claiming pixels from injected surfaces.

## Requirement coverage

| Requirement | Evidence/current outcome | Remaining hole |
|---|---|---|
| CORE001 kernel seam/only-advance | E1/E2/E3/E9, session tests and scene golden PASS on bounded inputs | ENG002/001/008; general gameplay missing |
| CORE002 orchestration/one host/refusals/close | E1/E2/E3 PASS ordinary errors, no job machinery | ENG007 hostile diagnostic throw; previously retrieved kernel reference intentionally not revoked |
| CORE003 portable/browser-safe | portable-digest/browser-open-play suites plus actual browser kernel JSON replay E7 PASS | browser-open-play.test.ts is Node portability proof, not alone a browser test; cross-browser/platform performance not proven |
| CORE005 policy/Kids/shippingClaimfalse parity | E2 parity/refuse golden PASS | Production shipping claims intentionally remain false; Kids shared open remains refused |
| CORE007 no fake headless pixels | E1/E2 headless frame assertions; E5/E6 real WebGL/pixel separation PASS | ENG004 hidden-type invariant and ENG006 lifecycle still open |
| CORE011 hierarchy/identity/selection/parenting | E2 hierarchy/prefab goldens PASS through public bridge/schema | Packaged GUI owner must verify actual controls; not inferred from this SDK test |
| CORE012 transforms/review/no-write | E2 schema and desktop-transform golden PASS | Real gizmo/control/device front door delegated desktop/shell lanes |
| CORE014 unified inputs/rebinding | E2 input golden/schema PASS | ENG015 primary gameplay/physical controller; no physical device claim |
| CORE015 isolated play/source hash/reset | E2 play-session and Linux bridge goldens PASS | Packaged play/front-door proof delegated desktop owner, no immutable-source byte write inferred from screenshot |
| CORE017 physics/fixed step/animation order | E2 Rapier/desktop physics/animation tests PASS bounded host; fresh-process WASM bytes exact | ENG010 scene-pose/full resume; ENG008 catalog capacities; unsupported offset is intentional refusal |
| CORE018 bounded seeded decorative authoring | E2 environment/material/effects schema tests and presentation tests PASS | ENG003 direct renderer input guard; ENG014/017 authored-feature pixels/texture binding |

## Exact gates / completion requests

1. Integration routes **ENG002/005/003/006/004/007** to engine builder with exact owned paths; ENG001/008 are recommended hardening, not fabricated current contract failures. Require failing-before/passing-after oracles and independently rerun actual browser/public entrypoints. This audit changes no source.
2. Complete all locally achievable ENG009–017 work through coordinated owners. Do not call missing gameplay/audio/pose/skin/texture work external merely because it needs a local design or shared schema. Unsupported features remain honest refusals until implemented. User's full-production goal stays intact.
3. Genuine evidence gates: real connected audio/controller/physical-GPU device proofs where those claims are made; broader browser/mobile/platform hosts; held general-E2/Stage proof authority remains external and separate; any production deployment/release/publication requires named action authority and real provider/signing inputs held in baseline. No new external account/server/payment/provider is necessary for confirmed local fixes.
4. Remaining coverage: authored checker texture, animation, postprocess/effects pixels, WebGL lost/restored front door, physical input/audio, sustained long-session CPU/memory, hardware GPU and packaged Linux feature proof were **not completed by this node**. This is visible PARTIAL, not a skipped check relabeled PASS. Run unchanged full gate after integration; baseline's green gate is necessary but insufficient.

Reports: `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.md` and `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json`.
