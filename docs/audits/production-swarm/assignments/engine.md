# Builder assignment — engine

Graph `sceneaxi-production-swarm`; role `code`; real root/cwd `/home/devuser/Documents/Projects/sceneaxi`. Read-only audit input `/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json` and its MD; full source findings are preserved in MEGALIST.json.

## Exclusive exact source/test path ownership

Only the following existing/new exact paths are claimed by this lane. Existing owning docs/README, manifests/locks/config, schemas/site-kit, tests/*, scripts/*, workflows and SQL migrations are **RESERVED integration after all builders**. No adjacent-file ownership is implied; request any additional exact path before editing.
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/errors.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/gameplay.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/portable-digest.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/rarity.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/sculpt-session.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/browser-open-play.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/gameplay.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/portable-digest.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/rarity.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/scene-session.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/sculpt-session.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/seam.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/session.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/open-path.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/refusals.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/test/fixtures.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/test/golden-path-orchestrated.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/test/open-path.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/test/refuse-matrix.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/test/seam.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/audio-playback.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/orbit-camera.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/render-loop.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/runtime.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/sculpt-mount.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-presentation-error.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-surface.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/audio-playback.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/runtime.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/sculpt-mount.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/seam.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-surface.test.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/src/index.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/src/world.ts`
- `/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/test/seam.test.ts`

## Full assigned scope / measurable acceptance

Historical backlog IDs: [62, 63, 64, 66, 67, 68, 69, 72, 90]. Authority requirement IDs: ['CORE-001', 'CORE-002', 'CORE-003', 'CORE-005', 'CORE-007', 'CORE-011', 'CORE-012', 'CORE-014', 'CORE-015', 'CORE-017', 'CORE-018'].

### ENG-002: implementation-needed / P0
Safe integer/range inputs, finite result and rounding guards, accumulated time bounds, transactional advance across every scene instance; refuse without consuming queued commands or partial state.
- Chosen solution: Safe integer/range inputs, finite result and rounding guards, accumulated time bounds, transactional advance across every scene instance; refuse without consuming queued commands or partial state.
- Acceptance: ["Unsafe/overflow inputs refuse; before/after/retried snapshot and pending commands stable; scene rollback oracle; supported golden digests unchanged and snapshots finite/JSON-roundtrippable."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 204, "symbol": "validateManifest"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 450, "symbol": "isIntegerPair"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 543, "symbol": "validateClock"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/sculpt-session.ts", "line": 154, "symbol": "validateSculptClock"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/sculpt-session.ts", "line": 206, "symbol": "SculptNodeSimulation.applyClock"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts", "line": 143, "symbol": "SceneSessionImpl.advance"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/sculpt-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/session.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/sculpt-session.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/scene-session.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["schemas owner: kernel-session.ts/contract bounds; no root dependency change"]
- Evidence/reproduction: {"reproduction": "const s=K.open({productId:'overflow',seed:1,entities:[{id:'player',x:1e308,y:0}]},host);s.dispatch({type:'move',actor:'player',axis:[1e308,0]});s.advance({tick:1,deltaMs:16});assert.equal(s.observe().entities[0].x,Infinity);assert.equal(JSON.parse(JSON.stringify(s.observe())).entities[0].x,null);", "refutation": "Small supported product/scene/sculpt inputs and JSON save/replay goldens pass. Number.isInteger nevertheless accepts1e308; sculpt huge frame also fails finite-state invariant.", "actualImpact": "Nonfinite authoritative state, null JSON projection and invalid downstream renderer coordinates; mutation authority is preserved but value validity is not.", "type": "confirmed-defect", "status": "PENDING_BUILDER"}
- Commands: ["pnpm exec vitest run packages/engine-kernel/test/session.test.ts packages/engine-kernel/test/sculpt-session.test.ts packages/engine-kernel/test/scene-session.test.ts"]

### COVERAGE-ENGINE: implementation-needed / P1
Remaining current-source/front-door coverage: engine
- Chosen solution: Independently verify all local holes via existing package/seam/bin/site/native helpers; genuine device/provider/signing/publication holes link to separate external gates. No new harness or skipped assertions.
- Acceptance: ["Exact command/exit/assertions/platform recorded; tested input/result/persistence or pixels where required.", "Full unchanged gate plus relevant actual front doors; 3-pass FAIL routing; every unresolved hole classified local/intentional/external.", "Actual authored checker texture, imported animation, bloom/vignette/particles/material override pixel fixtures not exercised; positive /open scene pixels do not prove every feature", "Actual WebGL lost/restored public front door not exercised by this node; mocked lifecycle tests are not restored-pixel evidence", "No genuine physical gamepad/audio-device/physical GPU acceptance in this node", "No macOS/Windows/mobile/Firefox/Safari hardware rendering evidence", "No production deployment pixels or entitled production editor session; local public /open existing production build only", "No sustained multi-hour session, explicit capacity SLA or maximum-supported replay memory benchmark", "Packaged Linux GUI/input/play feature acceptance belongs desktop/shell integration owners, not this SDK audit", "General gameplay, audio, full posed physics persistence,skin/CUBICSPLINE,compressed texture decoding,texture binding and optional renderer/network scope remain full-product gaps until genuinely implemented"]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: ["/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json"]

### ENG-003: implementation-needed / P1
Validate complete neutral snapshot/environment before mutation; unique bounded ids, finite renderer-range coordinates and safe ticks; deterministic max framebuffer pixel/dimension budgets.
- Chosen solution: Validate complete neutral snapshot/environment before mutation; unique bounded ids, finite renderer-range coordinates and safe ticks; deterministic max framebuffer pixel/dimension budgets.
- Acceptance: ["Malformed inputs throw named errors without altering last good frame/camera/resources; bounded limit/limit+1 viewport oracle, valid goldens unchanged."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts", "line": 76, "symbol": "requireSnapshot"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": 126, "symbol": "resolveViewport"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": 197, "symbol": "applyEnvironment"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-surface.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["schemas owner for documented renderer/catalog numeric budgets"]
- Evidence/reproduction: {"reproduction": "const r=P.createThreePresentationRuntime();r.mount();r.present({tick:1,seed:1,digest:'ignored',entities:[{id:'same',x:NaN,y:Infinity},{id:'same',x:2,y:3}]},[],1);assert.equal(r.lastFrame().entityCount,2);r.dispose();const c=P.createThreePresentationCore();c.setEnvironment({ambientIntensity:NaN,keyDirection:[Infinity,0,0],fog:{enabled:true,color:'#fff',near:10,far:-1}});c.resize(1e9,1e9,1e9);c.dispose();", "refutation": "Actual site clamps device ratio2 and valid alpha/negative dimensions already refuse. No destructive huge GPU allocation attempted. Exposure is public SDK boundary, not proven remote HTTP attack.", "actualImpact": "Misleading entity/frame metadata, invalid lighting/coordinates, potential unreasonable framebuffer allocation requests.", "type": "confirmed-defect", "status": "PENDING_BUILDER"}
- Commands: ["pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts packages/engine-presentation/test/three-surface.test.ts"]

### ENG-005: implementation-needed / P1
Prevalidate full mesh/node/transform batch; cleanup partial roots on every failure; guard all direct mutators; retain previous visible root on failed replacement; reject disconnected/cyclic/duplicate nodes.
- Chosen solution: Prevalidate full mesh/node/transform batch; cleanup partial roots on every failure; guard all direct mutators; retain previous visible root on failed replacement; reject disconnected/cyclic/duplicate nodes.
- Acceptance: ["Five malformed replacements leave zero new live resources and old render works; direct disposed backend methods refuse and repeated dispose safe."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": 139, "symbol": "buildTriangleAsset"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": 383, "symbol": "mountTriangleAsset"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": 415, "symbol": "dispose"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["assets importer validation is upstream defense only, not a replacement for public engine guard"]
- Evidence/reproduction: {"reproduction": "Valid first triangle mesh followed by second positions:[NaN,0,0]; five refused public mountTriangleAsset calls allocate5 first-mesh geometries that remain undisposed after backend.dispose. Separate disposed backend accepts a new valid triangle mount.", "refutation": "createSculptMountApi guards its own disposed state; ordinary valid mounts release geometry. Direct imported-asset backend path bypasses that protection.", "actualImpact": "Unreachable CPU resource accumulation on malformed batches and post-dispose mutation; nontransactional replacement ownership.", "type": "confirmed-defect", "status": "PENDING_BUILDER"}
- Commands: ["pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts"]

### ENG-006: implementation-needed / P1
Explicit terminal owned-context release or reusable renderer/surface owner, with clear remount semantics; no vendor patch, no false lost-context pixel claim.
- Chosen solution: Explicit terminal owned-context release or reusable renderer/surface owner, with clear remount semantics; no vendor patch, no false lost-context pixel claim.
- Acceptance: ["Actual Chromium same-canvas100 create/draw/dispose rounds have bounded live handles; supported remount/restoration draws real pixels, lost context reportsfalse and capture unavailable."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-surface.ts", "line": 343, "symbol": "dispose"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": 384, "symbol": "dispose"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-surface.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-surface.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["site and desktop canvas context ownership/remount agreement; externally injected surfaces must not be terminally destroyed by internal owner"]
- Evidence/reproduction: {"reproduction": "In installed Chromium, retain canvas/gl and created texture handles; three public createThreePresentationCore({canvas,viewport:{width:100,height:100}}).draw/dispose rounds; gl.isTexture confirms4,8,12 still-live textures.", "refutation": "Buffers/programs released and same-renderer mount cycles plateau. Counter-only framebuffer assertion not reliable; actual gl.isFramebuffer returns0. Four default pinned-Three state textures remain, not an invented all-resource leak.", "actualImpact": "Recreating terminal renderer on retained canvas accumulates defaults until eventual context/GC teardown; full lifecycle resource bound unproven.", "type": "confirmed-resource-lifecycle-gap", "status": "PENDING_BUILDER"}
- Commands: ["pnpm exec vitest run packages/engine-presentation/test/three-surface.test.ts packages/engine-presentation/test/three-presentation.test.ts"]

### ENG-009: implementation-needed / P1
MISSING_GENERAL_GAMEPLAY; narrow spawn/move/rarity-roll intentional union
- Chosen solution: DEC04 bounded declarative action/state/timer behavior, no eval; only advance resolves; input/time/save replay deterministic; do not park local design solely for approval
- Acceptance: ["Actual input action→dispatch→advance→save/replay outcome and invalid/Kids/unknown-action refusal through packaged play front door", "pnpm exec vitest run packages/engine-kernel/test/session.test.ts tests/e2e/input-actions-golden.test.ts tests/e2e/desktop-play-session-golden.test.ts"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": "459", "symbol": "validateCommand"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/session.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["packages/schemas/src/kernel-session.ts", "packages/schemas/contracts/kernel-session.schema.json", "desktop/linux/src/renderer/viewport.ts", "desktop/linux/src/lib/bridge.ts"]
- Evidence/reproduction: []

### ENG-010: implementation-needed / P1
OLD_CATEGORICAL_CLAIM_REFUTED; real WASM bounded adapter passes; full scene pose/resume incomplete
- Chosen solution: Explicit scene pose/joint-frame/animation-order contract, physics-aware persistence/resume; keep nonzero animation-offset refusal until implemented; narrow serialize currently diagnostic rather than generic restore
- Acceptance: ["Public posed multi-object save/load/replay joint/collision digest and real renderer pose evidence", "pnpm exec vitest run packages/physics-rapier/test/seam.test.ts tests/e2e/physics-rapier-golden.test.ts tests/e2e/desktop-physics-golden.test.ts tests/e2e/desktop-animation-golden.test.ts"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/src/index.ts", "line": "47", "symbol": "createRapierPhysicsWorldHost; world.ts:108 index-derived vertical pose"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/src/world.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/test/seam.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["packages/schemas/src/physics-world-host.ts", "packages/schemas/src/desktop-scene-physics.ts", "desktop/linux/src/lib/desktop-scene.ts", "desktop/linux/src/renderer/viewport.ts"]
- Evidence/reproduction: ["E1", "E2"]

### ENG-011: implementation-needed / P1
CONFIRMED_MISSING_LOCAL_AUDIO_RUNTIME
- Chosen solution: User-gesture unlock; contained admitted assets; explicit start/stop/volume/dispose/visibility; no autoplay/network/provider
- Acceptance: ["Real browser gesture unlock/play/stop and zero active sources after dispose; actual audible/device observation separately recorded, not AudioContext counters", "pnpm exec vitest run packages/engine-presentation/test && pnpm --dir desktop/linux smoke --packaged"]
- Source: []
- Targets/owners: [{"reference": "packages/engine-presentation/src/ (new bounded audio adapter)"}, {"reference": "packages/engine-presentation/test/ (public audio seam tests)"}]
- Dependencies: ["packages/schemas/ (audio admission/playback contract)", "packages/importers/ (contained admitted audio)", "desktop/linux/src/renderer/viewport.ts"]
- Evidence/reproduction: []

### ENG-015: implementation-needed / P1
OLD_NO_GAMEPAD_CLAIM_REFUTED; standard input sampling/deadzones supported; primary gameplay and physical-device proof missing
- Chosen solution: Connect bounded play.primary to ENG009, preserve contexts/source-hash clone and restart-durable rebinding; physical controller evidence distinct
- Acceptance: ["Actual packaged input/play flow and genuine connected standard-controller test, not navigator mock", "pnpm exec vitest run tests/e2e/input-actions-golden.test.ts packages/schemas/test/input-action-registry.test.ts"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["packages/schemas/src/input-action-registry.ts", "desktop/linux/src/renderer/viewport.ts", "desktop/linux/src/lib/bridge.ts"]
- Evidence/reproduction: ["E2"]

### GATE-DEVICES: genuine-external-blocker / P1
Physical controller/audio/GPU/platform evidence absent
- Chosen solution: Preserve fail-closed behavior; gather exact missing inputs without external action in this swarm.
- Acceptance: ["Genuine supplied input and independently verified actual target/evidence under matching action-specific authorization; never fixture-substitute."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: []
- Exact missing input (no local implementation parked): Genuine supported connected controller/audio device and physical GPU/browser/platform hosts; actual input/audio/render/recovery behavior, names and measured capacity. navigator fixtures, SwiftShader and AudioContext counts are not physical-device acceptance.

### ENG-001: implementation-needed / P2
Recommended explicit same-major engine/BOM compatibility and named refusal for unsupported major until migration exists; preserve0.0.0 goldens and document narrower old policy.
- Chosen solution: Recommended explicit same-major engine/BOM compatibility and named refusal for unsupported major until migration exists; preserve0.0.0 goldens and document narrower old policy.
- Acceptance: ["Compatibility table executably covered; supported JSON saves replay exact digest, unsupported version policy explicit before event work."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 98, "symbol": "replay"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/test/session.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["schemas kernel-session contract owner; docs compatibility policy owner"]
- Evidence/reproduction: {"reproduction": "const s=K.open({productId:'audit',seed:1},host);s.advance({tick:1,deltaMs:0});const save=s.save();for(const field of ['kernelVersion','bomVersion'])assert.equal(K.replay({...save,[field]:'99.0.0'},host).observe().digest,s.observe().digest);", "refutation": "README9-10 promises schema major refusal only, which is implemented. Initial high-defect interpretation withdrawn; accepting syntax-valid engine/BOM major is not a confirmed breach of current normative policy.", "actualImpact": "Future engine/BOM compatibility/migration policy unspecified; current digest equality still enforced.", "type": "recommended-compatibility-hardening", "status": "PENDING_BUILDER_DECISION"}
- Commands: ["pnpm exec vitest run packages/engine-kernel/test/session.test.ts && pnpm check:contracts"]

### ENG-004: implementation-needed / P2
Private internal core factory plus opaque/numeric public facade; keep one shared renderer and useful public controls.
- Chosen solution: Private internal core factory plus opaque/numeric public facade; keep one shared renderer and useful public controls.
- Acceptance: ["External consumer type oracle exposes no Three Group/types; real WebGL and goldens preserved."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/index.ts", "line": 42, "symbol": "createThreePresentationCore export"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": 114, "symbol": "ThreePresentationCore.content"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/seam.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["docs owner: three-presentation-core.md, package README/generated API; root export map need not widen"]
- Evidence/reproduction: {"reproduction": "const c=P.createThreePresentationCore();assert.equal(c.content.type,'Group');c.dispose(); emitted public factory return declaration exposes content:Group at dist/src/three-core.d.ts:76.", "refutation": "Not merely a private deep import; publicly exported factory exposes the type. Kernel remains separate and cannot be advanced through this object.", "actualImpact": "Three backend types and mutable scene graph cross advertised opaque ADR0002 public seam.", "type": "confirmed-contract-leak", "status": "PENDING_BUILDER"}
- Commands: ["pnpm build && pnpm exec vitest run packages/engine-presentation/test/seam.test.ts packages/engine-presentation/test/three-presentation.test.ts"]

### ENG-007: implementation-needed / P2
Total bounded accessor-safe error description with stable fallback; no secret/host-object stringification.
- Chosen solution: Total bounded accessor-safe error description with stable fallback; no secret/host-object stringification.
- Acceptance: ["Hostile toString/Error.message/proxy thrown values never escape bootstrap/resume; named reasons stable."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/open-path.ts", "line": 194, "symbol": "kernelMessage"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/open-path.ts", "line": 213, "symbol": "resolveHost"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/open-path.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/test/refuse-matrix.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/test/open-path.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: {"reproduction": "assert.throws(()=>O.bootstrapOpenPath({kind:'product',productManifest:{productId:'audit',seed:1}},{nowMs(){throw {toString(){throw new Error('hostile-error-coercion')}}}}),/hostile-error-coercion/);", "refutation": "Ordinary Error correctly returns OPEN_PATH_HOST_INVALID; injected host is trusted, so no remote exploit claimed.", "actualImpact": "Named-refusal guarantee bypassed by unsafe diagnostic coercion/accessors; host failure can crash caller.", "type": "confirmed-error-handling-defect", "status": "PENDING_BUILDER"}
- Commands: ["pnpm exec vitest run packages/engine-orchestrator/test/refuse-matrix.test.ts packages/engine-orchestrator/test/open-path.test.ts"]

### ENG-008: implementation-needed / P2
Deterministic budgets/refusals and preallocation checks; index shapes/materials, bounded queue/history or versioned digest-preserving checkpoints; measured sustained use.
- Chosen solution: Deterministic budgets/refusals and preallocation checks; index shapes/materials, bounded queue/history or versioned digest-preserving checkpoints; measured sustained use.
- Acceptance: ["Limit/limit+1 public oracles, maximum-supported session replay,100 lifecycle resource plateau and measured repeated CPU/memory records; headless counters never GPU proof."]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 652, "symbol": "recordValidatedDispatch.pending.push"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": 678, "symbol": "advance.events.push"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts", "line": 148, "symbol": "advance.advances.push"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/src/world.ts", "line": 109, "symbol": "createWorld per-body shape filtering"}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts", "line": 127, "symbol": "markerFor"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/scene-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/sculpt-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/physics-rapier/src/world.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-runtime.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["schemas resource/checkpoint/catalog contracts owner; root script/benchmark registration integration owner"]
- Evidence/reproduction: {"reproduction": "Source inspection: no declared maxima for pending/history/replay/entities/physics body+shape lists; pending validation scans pending list and Rapier filters all shapes per body. Normal golden workloads pass; no destructive OOM or invented SLA benchmark attempted.", "refutation": "PNG pixel projection and Rapier numeric/fixed-step validation already have some explicit bounds; this finding is missing holistic capacity, not absence of every guard.", "actualImpact": "Growing session histories/replay work and quadratic construction/lookup paths; production latency/memory bound not evidenced.", "type": "capacity-and-performance-gap", "status": "PENDING_BUILDER"}
- Commands: ["pnpm exec vitest run packages/engine-kernel/test packages/engine-orchestrator/test packages/engine-presentation/test packages/physics-rapier/test"]

### ENG-012: implementation-needed / P2
OLD_CATEGORICAL_CLAIM_REFUTED; UV+contained PNG RGBA DataTexture implemented; compressed format/pixel holes remain
- Chosen solution: Real admitted checker-texture pixel/resource proof; bounded contained JPEG/WebP decoding if supported
- Acceptance: ["Actual admitted textured GLB/glTF browser/packaged checker pixels,resize/dispose,malformed bounds; numeric PNG-array test alone insufficient", "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts tests/e2e/asset-ingestion-golden.test.ts"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": "166", "symbol": "buildTriangleAsset"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["packages/importers/ (glTF decoder)", "packages/schemas/ (asset render contracts)", "desktop/linux/src/renderer/viewport.ts"]
- Evidence/reproduction: []

### ENG-013: implementation-needed / P2
NODE_TRS_PLAYBACK_IMPLEMENTED; skeleton/CUBICSPLINE and feature pixel proof absent
- Chosen solution: Real STEP/LINEAR node animation pixels/replay/time bounds; implement validated skinning/CUBICSPLINE separately or preserve unsupported refusal and missing-capability list
- Acceptance: ["Real imported animation before/after pixel changes,deterministic time replay and stable resources; explicit unsupported formats remain visible", "pnpm exec vitest run tests/e2e/desktop-animation-golden.test.ts packages/engine-presentation/test/three-presentation.test.ts"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": "397", "symbol": "playTriangleAnimation"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["packages/schemas/ (glTF animation/skin contracts)", "packages/importers/ (glTF projection)", "desktop/linux/src/renderer/viewport.ts"]
- Evidence/reproduction: []

### ENG-014: implementation-needed / P2
OLD_CATEGORICAL_CLAIM_REFUTED; renderer implementations exist, feature pixel/performance proof incomplete
- Chosen solution: Actual bloom/vignette/particle/emissive/opacity pixel comparisons, switching/disposal/restoration resource plateau
- Acceptance: ["Real authored-catalog WebGL comparisons and long-lived performance; no headless pixel inference", "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts packages/engine-presentation/test/three-surface.test.ts"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-surface.ts", "line": "224", "symbol": "configureEffects; three-core.ts:294 sampleEffects; three-sculpt.ts:320 setMaterialOverrides"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-surface.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-core.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["sites/umbrella/src/app/_components/sculpt-viewport.tsx", "desktop/linux/src/renderer/viewport.ts"]
- Evidence/reproduction: []

### ENG-017: implementation-needed / P2
CATALOG_FORWARDING_IMPLEMENTED; non-null texture slots intentionally refused; feature pixels incomplete
- Chosen solution: Contained asset-to-texture binding contract including UV set,color space,sampler,pixel transport; deterministic lookup and actual texture pixels; no external URL loads,independent Kids refusal
- Acceptance: ["Real contained authored texture positive/negative pixels; non-null slots refuse until genuinely supported; never null placeholders claiming texture binding", "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts tests/e2e/umbrella-editor-viewport-golden.test.ts && pnpm check:contracts"]
- Source: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": "325", "symbol": "setMaterialOverrides texture binding refusal"}]
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/src/three-sculpt.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-presentation/test/three-presentation.test.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: ["packages/schemas/src/desktop-scene-materials.ts", "packages/site-kit/src/mountable-scene.ts", "desktop/linux/src/renderer/viewport.ts", "sites/umbrella/src/app/_components/sculpt-viewport.tsx"]
- Evidence/reproduction: []

### LOCAL-PROOF-063: done-with-evidence / P2
Bounded implemented portion: Physics is contract-only
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 63, "oldStatus": "done", "oldClaim": "Physics is contract-only/no Rapier adapter", "currentOutcome": "OLD_CATEGORICAL_CLAIM_REFUTED; real WASM bounded adapter passes; full scene pose/resume incomplete", "source": "packages/physics-rapier/src/index.ts:47 createRapierPhysicsWorldHost; world.ts:108 index-derived vertical pose", "remainingTask": "ENG-010", "priority": "P1", "owner": "engine-builder + schemas + desktop-scene", "fix": "Explicit scene pose/joint-frame/animation-order contract, physics-aware persistence/resume; keep nonzero animation-offset refusal until implemented; narrow serialize currently diagnostic rather than generic restore", "ownedFiles": ["packages/physics-rapier/src/world.ts", "packages/engine-kernel/src/scene-session.ts", "packages/physics-rapier/test/seam.test.ts"], "sharedFiles": ["packages/schemas/src/physics-world-host.ts", "packages/schemas/src/desktop-scene-physics.ts", "desktop/linux/src/lib/desktop-scene.ts", "desktop/linux/src/renderer/viewport.ts"], "acceptanceCommand": "pnpm exec vitest run packages/physics-rapier/test/seam.test.ts tests/e2e/physics-rapier-golden.test.ts tests/e2e/desktop-physics-golden.test.ts tests/e2e/desktop-animation-golden.test.ts", "additionalAcceptance": "Public posed multi-object save/load/replay joint/collision digest and real renderer pose evidence", "evidence": ["E1", "E2"]}}]

### LOCAL-PROOF-066: done-with-evidence / P2
Bounded implemented portion: Imported models are untextured
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 66, "oldStatus": "done", "oldClaim": "Imported models untextured", "currentOutcome": "OLD_CATEGORICAL_CLAIM_REFUTED; UV+contained PNG RGBA DataTexture implemented; compressed format/pixel holes remain", "source": "packages/engine-presentation/src/three-sculpt.ts:166 buildTriangleAsset", "remainingTask": "ENG-012", "priority": "P2", "owner": "engine-builder + assets/importers/schema", "fix": "Real admitted checker-texture pixel/resource proof; bounded contained JPEG/WebP decoding if supported", "ownedFiles": ["packages/engine-presentation/src/three-sculpt.ts", "packages/engine-presentation/test/three-presentation.test.ts"], "sharedFiles": ["packages/importers/ (glTF decoder)", "packages/schemas/ (asset render contracts)", "desktop/linux/src/renderer/viewport.ts"], "acceptanceCommand": "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts tests/e2e/asset-ingestion-golden.test.ts", "additionalAcceptance": "Actual admitted textured GLB/glTF browser/packaged checker pixels,resize/dispose,malformed bounds; numeric PNG-array test alone insufficient"}}]

### LOCAL-PROOF-067: done-with-evidence / P2
Bounded implemented portion: No imported-animation playback or skeletal animation
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 67, "oldStatus": "done", "oldClaim": "No imported-animation playback or skeletal animation", "currentOutcome": "NODE_TRS_PLAYBACK_IMPLEMENTED; skeleton/CUBICSPLINE and feature pixel proof absent", "source": "packages/engine-presentation/src/three-sculpt.ts:397 playTriangleAnimation", "remainingTask": "ENG-013", "priority": "P2", "owner": "engine-builder + assets/glTF schema + desktop-playback", "fix": "Real STEP/LINEAR node animation pixels/replay/time bounds; implement validated skinning/CUBICSPLINE separately or preserve unsupported refusal and missing-capability list", "ownedFiles": ["packages/engine-presentation/src/three-sculpt.ts", "packages/engine-presentation/test/three-presentation.test.ts"], "sharedFiles": ["packages/schemas/ (glTF animation/skin contracts)", "packages/importers/ (glTF projection)", "desktop/linux/src/renderer/viewport.ts"], "acceptanceCommand": "pnpm exec vitest run tests/e2e/desktop-animation-golden.test.ts packages/engine-presentation/test/three-presentation.test.ts", "additionalAcceptance": "Real imported animation before/after pixel changes,deterministic time replay and stable resources; explicit unsupported formats remain visible"}}]

### LOCAL-PROOF-068: done-with-evidence / P2
Bounded implemented portion: Post-processing, particles, and material overrides are in schemas only and never drawn
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 68, "oldStatus": "done", "oldClaim": "Postprocess/particles/material overrides schemas-only", "currentOutcome": "OLD_CATEGORICAL_CLAIM_REFUTED; renderer implementations exist, feature pixel/performance proof incomplete", "source": "packages/engine-presentation/src/three-surface.ts:224 configureEffects; three-core.ts:294 sampleEffects; three-sculpt.ts:320 setMaterialOverrides", "remainingTask": "ENG-014", "priority": "P2", "owner": "engine-builder + sites/desktop fixture wiring", "fix": "Actual bloom/vignette/particle/emissive/opacity pixel comparisons, switching/disposal/restoration resource plateau", "ownedFiles": ["packages/engine-presentation/src/three-surface.ts", "packages/engine-presentation/src/three-core.ts", "packages/engine-presentation/src/three-sculpt.ts"], "sharedFiles": ["sites/umbrella/src/app/_components/sculpt-viewport.tsx", "desktop/linux/src/renderer/viewport.ts"], "acceptanceCommand": "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts packages/engine-presentation/test/three-surface.test.ts", "additionalAcceptance": "Real authored-catalog WebGL comparisons and long-lived performance; no headless pixel inference"}}]

### LOCAL-PROOF-069: done-with-evidence / P2
Bounded implemented portion: No gamepad support; the kernel consumes no input.
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 69, "oldStatus": "done", "oldClaim": "No gamepad support/kernel input", "currentOutcome": "OLD_NO_GAMEPAD_CLAIM_REFUTED; standard input sampling/deadzones supported; primary gameplay and physical-device proof missing", "remainingTask": "ENG-015", "priority": "P1", "owner": "desktop-input/play + engine-builder/schema", "fix": "Connect bounded play.primary to ENG009, preserve contexts/source-hash clone and restart-durable rebinding; physical controller evidence distinct", "ownedFiles": ["packages/engine-kernel/src/session.ts"], "sharedFiles": ["packages/schemas/src/input-action-registry.ts", "desktop/linux/src/renderer/viewport.ts", "desktop/linux/src/lib/bridge.ts"], "acceptanceCommand": "pnpm exec vitest run tests/e2e/input-actions-golden.test.ts packages/schemas/test/input-action-registry.test.ts", "additionalAcceptance": "Actual packaged input/play flow and genuine connected standard-controller test, not navigator mock", "evidence": ["E2"]}}]

### LOCAL-PROOF-090: done-with-evidence / P2
Bounded implemented portion: Product viewports do not forward authored environment/material/effect catalogs (effects payload lacks its seed; texture slots need an asset-to-texture binding contract)
- Chosen solution: Preserve the explicitly tested bounded part; not full-production closure.
- Acceptance: ["Exact passing current lane evidence only; residual gap IDs below remain open."]
- Source: []
- Targets/owners: []
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "backlogDisposition": {"id": 90, "oldStatus": "done", "oldClaim": "Product viewports do not forward environment/material/effect catalogs", "currentOutcome": "CATALOG_FORWARDING_IMPLEMENTED; non-null texture slots intentionally refused; feature pixels incomplete", "source": "packages/engine-presentation/src/three-sculpt.ts:325 setMaterialOverrides texture binding refusal", "remainingTask": "ENG-017", "priority": "P2", "owner": "schemas + assets + engine-builder + site-kit/desktop", "fix": "Contained asset-to-texture binding contract including UV set,color space,sampler,pixel transport; deterministic lookup and actual texture pixels; no external URL loads,independent Kids refusal", "ownedFiles": ["packages/engine-presentation/src/three-sculpt.ts", "packages/engine-presentation/test/three-presentation.test.ts"], "sharedFiles": ["packages/schemas/src/desktop-scene-materials.ts", "packages/site-kit/src/mountable-scene.ts", "desktop/linux/src/renderer/viewport.ts", "sites/umbrella/src/app/_components/sculpt-viewport.tsx"], "acceptanceCommand": "pnpm exec vitest run packages/engine-presentation/test/three-presentation.test.ts tests/e2e/umbrella-editor-viewport-golden.test.ts && pnpm check:contracts", "additionalAcceptance": "Real contained authored texture positive/negative pixels; non-null slots refuse until genuinely supported; never null placeholders claiming texture binding"}}]

### REQ-PROOF-CORE-001: done-with-evidence / P2
Bounded requirement declaration: The Game Kernel public seam is open, dispatch, advance, observe, save, and replay, with only advance allowed to mutate.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "BOUNDED_HERMETIC_PASS_WITH_DEFECTS"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-001", "outcome": "BOUNDED_HERMETIC_PASS_WITH_DEFECTS", "evidence": ["E1", "E2", "E3", "E9"], "remaining": ["ENG-002", "ENG-001", "ENG-008", "ENG-009"]}, "expectedEvidenceLayer": ["packages/engine-kernel/test/scene-session.test.ts", "tests/e2e/cli-golden-path.test.ts"]}]

### REQ-PROOF-CORE-002: done-with-evidence / P2
Bounded requirement declaration: The open path above the kernel resolves one host, stamps a deterministic bootstrap record, turns kernel throws into named refusals, and closes each handle once without a job system.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "BOUNDED_PASS_ORDINARY_ERRORS"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-orchestrator/src/index.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-002", "outcome": "BOUNDED_PASS_ORDINARY_ERRORS", "evidence": ["E1", "E2", "E3", "E9"], "remaining": ["ENG-007"], "intentionalBoundary": "close denies subsequent session() retrieval, not already-returned pure kernel references"}, "expectedEvidenceLayer": ["packages/engine-orchestrator/test/golden-path-orchestrated.test.ts", "tests/e2e/profile-game-scene-golden.test.ts"]}]

### REQ-PROOF-CORE-003: done-with-evidence / P2
Bounded requirement declaration: Kernel digests remain portable and browser-safe, with no Node builtins or Node-only globals in the kernel source.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PORTABILITY_AND_ACTUAL_BROWSER_REPLAY_PASS"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/engine-kernel/src/portable-digest.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "engine", "baselineSourceReadOnly": true}, {"reference": "packages/engine-kernel/src"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-003", "outcome": "PORTABILITY_AND_ACTUAL_BROWSER_REPLAY_PASS", "evidence": ["E2", "E7"], "remaining": ["cross-browser/native-host performance"], "caution": "browser-open-play.test.ts executes Node portability checks; actual browser replay separately exercised in E7"}, "expectedEvidenceLayer": ["packages/engine-kernel/test/browser-open-play.test.ts", "pnpm check:boundaries"]}]

### REQ-PROOF-CORE-005: done-with-evidence / P2
Bounded requirement declaration: The shared open-path policy is one data identity across CLI, profiles, desktop shell, and web shell; Kids is refuse-only and shippingClaim is false.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "POLICY_PARITY_REFUSAL_PASS"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/open-path-policy.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "packages/profile-game"}, {"reference": "packages/profile-web"}, {"reference": "packages/profile-kids"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-005", "outcome": "POLICY_PARITY_REFUSAL_PASS", "evidence": ["E2"], "remaining": ["production shipping claims remain false by protected shared contract"], "intentionalBoundary": "Kids shared open refuses; no dependency/identity/LIVE widening"}, "expectedEvidenceLayer": ["tests/parity/open-path-policy-parity.test.ts", "tests/e2e/profile-kids-refuse-golden.test.ts"]}]

### REQ-PROOF-CORE-007: done-with-evidence / P2
Bounded requirement declaration: Headless frames identify that no pixels were drawn; frame counters, tests, and gate output never imply a pixel or GPU claim.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "HEADLESS_TRUTH_AND_REAL_PIXEL_SEPARATION_PASS"]
- Source: []
- Targets/owners: [{"reference": "packages/engine-presentation/src"}, {"reference": "tests/e2e/"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-007", "outcome": "HEADLESS_TRUTH_AND_REAL_PIXEL_SEPARATION_PASS", "evidence": ["E2", "E5", "E6"], "remaining": ["ENG-006", "authored feature-specific pixels"]}, "expectedEvidenceLayer": ["packages/engine-presentation/test/", "docs/three-presentation-core.md"]}]

### REQ-PROOF-CORE-011: done-with-evidence / P2
Bounded requirement declaration: Hierarchy, ordered multi-select, explicit-policy parenting, protected-root rules, and stable object identities project from the validated composed scene.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PUBLIC_HIERARCHY_PREFAB_GOLDEN_PASS"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-edit.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/desktop-scene.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-011", "outcome": "PUBLIC_HIERARCHY_PREFAB_GOLDEN_PASS", "evidence": ["E2"], "remaining": ["actual packaged GUI controls owned desktop/shell lanes"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-hierarchy-golden.test.ts", "tests/e2e/desktop-prefab-golden.test.ts"]}]

### REQ-PROOF-CORE-012: done-with-evidence / P2
Bounded requirement declaration: Transforms use one review command for numeric fields and gizmo nudges, with explicit local/world, pivot, axis, and snap inputs and no preview write before acceptance.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "PUBLIC_TRANSFORM_REVIEW_GOLDEN_PASS"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-transform.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "desktop/linux/src/lib"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-012", "outcome": "PUBLIC_TRANSFORM_REVIEW_GOLDEN_PASS", "evidence": ["E2"], "remaining": ["real gizmo/numeric-control input owner front door"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-transform-golden.test.ts", "packages/schemas/test/desktop-scene-transform.test.ts"]}]

### REQ-PROOF-CORE-014: done-with-evidence / P2
Bounded requirement declaration: Unified input actions cover keyboard, pointer, wheel, legacy controller, and standard gamepad buttons/axes with deadzones across editor and play contexts, with defaults, conflict checks, rebind/reset review, and restart-durable settings outside document undo.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "INPUT_REGISTRY_GOLDEN_PASS"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/input-action-registry.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "desktop/linux/src"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-014", "outcome": "INPUT_REGISTRY_GOLDEN_PASS", "evidence": ["E2"], "remaining": ["ENG-015", "physical-controller proof"]}, "expectedEvidenceLayer": ["tests/e2e/input-actions-golden.test.ts", "packages/schemas/test/input-action-registry.test.ts"]}]

### REQ-PROOF-CORE-015: done-with-evidence / P2
Bounded requirement declaration: Play uses an isolated clone bound to an explicit source hash; viewport sources switch through one owner and stop/reset never write authoring bytes.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "ISOLATED_PLAY_SOURCE_HASH_GOLDEN_PASS"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-play-session.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/bridge.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "desktop-linux", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-015", "outcome": "ISOLATED_PLAY_SOURCE_HASH_GOLDEN_PASS", "evidence": ["E2"], "remaining": ["actual packaged play/stop/reset front door owned desktop lane"]}, "expectedEvidenceLayer": ["tests/e2e/desktop-play-session-golden.test.ts", "tests/e2e/desktop-linux-bridge-golden.test.ts"]}]

### REQ-PROOF-CORE-017: done-with-evidence / P2
Bounded requirement declaration: Physics commands author deterministic bodies, shapes, materials, constraints, gravity, and a fixed 1–32ms step; animation precedes physics when both affect an object.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "REAL_WASM_FIXED_STEP_AND_GOLDEN_ORDER_PASS_BOUNDED"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-physics.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"reference": "packages/engine-presentation/src"}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-017", "outcome": "REAL_WASM_FIXED_STEP_AND_GOLDEN_ORDER_PASS_BOUNDED", "evidence": ["E1", "E2"], "remaining": ["ENG-010", "ENG-008"], "intentionalBoundary": "nonzero Rapier animation offsets still explicitly refuse; pose contract incomplete"}, "expectedEvidenceLayer": ["tests/e2e/desktop-physics-golden.test.ts", "packages/schemas/test/desktop-scene-physics.test.ts"]}]

### REQ-PROOF-CORE-018: done-with-evidence / P2
Bounded requirement declaration: Environment, material, and seeded decorative-effect authoring stays presentation-authored, bounded, digest-stamped, and independently Kids-refusable.
- Chosen solution: Retain/refute the exact normative statement, not the broader launch capability; preserve original owner authority.
- Acceptance: ["Current-source/public assertion for this full statement, including refusal/negative controls; proof-path presence alone insufficient.", "CATALOG_AUTHORING_SCHEMA_AND_RENDERER_HERMETIC_PASS"]
- Source: []
- Targets/owners: [{"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-environment.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-materials.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}, {"path": "/home/devuser/Documents/Projects/sceneaxi/packages/schemas/src/desktop-scene-effects.ts", "line": null, "symbol": null, "existsAtSynthesis": true, "writeOwner": "integration", "baselineSourceReadOnly": true}]
- Dependencies: []
- Evidence/reproduction: [{"audit": "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/audit-engine.json", "currentSemanticEntry": {"id": "CORE-018", "outcome": "CATALOG_AUTHORING_SCHEMA_AND_RENDERER_HERMETIC_PASS", "evidence": ["E2"], "remaining": ["ENG-003", "ENG-014", "ENG-017"]}, "expectedEvidenceLayer": ["packages/schemas/test/desktop-scene-environment.test.ts", "packages/schemas/test/desktop-scene-materials.test.ts", "packages/schemas/test/desktop-scene-effects.test.ts"]}]

### ENG-016: intentional-nonlaunch-capability / P3
INTENTIONAL_WEBGL_OFFLINE_DEFAULT; additional renderer/network product scope missing
- Chosen solution: Truthful offline/WebGL defaults; explicitly charter and design second renderer/bounded replication before implementation; do not invent server/account/provider or widen dependency matrix
- Acceptance: ["Any admitted new adapter/protocol needs real two-adapter/peer correctness,disconnect/replay/auth/input-bound proofs; current absence is not a defect in intentional refusal or missing credential", "pnpm check:boundaries && pnpm exec vitest run packages/engine-kernel/test packages/engine-presentation/test"]
- Source: []
- Targets/owners: [{"reference": "packages/engine-presentation/ (future adapter only under charter)"}, {"reference": "packages/engine-kernel/ (future deterministic protocol only under charter)"}]
- Dependencies: ["docs/dependency-matrix.json", "docs/adr/", "packages/schemas/ (future protocol contracts)"]
- Evidence/reproduction: []

## Shared requests and acceptance obligations

[{"lane": "engine", "sourceKey": "sharedChangesRequired", "requests": [{"owner": "schemas", "paths": ["packages/schemas/src/kernel-session.ts", "packages/schemas/contracts/kernel-session.schema.json", "packages/schemas/src/physics-world-host.ts", "packages/schemas/src/desktop-scene-physics.ts", "packages/schemas/src/desktop-scene-materials.ts", "packages/schemas/src/desktop-scene-effects.ts", "packages/schemas/src/input-action-registry.ts", "packages/schemas/ (glTF asset/animation and new audio/behavior contracts)"], "reason": "Normative numeric/resource/compatibility/pose/behavior/texture/audio bounds and fixtures; keep schema source of truth and no duplicate physics schema"}, {"owner": "desktop-linux", "paths": ["desktop/linux/src/lib/desktop-scene.ts", "desktop/linux/src/lib/bridge.ts", "desktop/linux/src/renderer/viewport.ts", "desktop/linux/ (input/play/control and packaged smoke owners)"], "reason": "Sole production physics importer,actual playback/input/audio/texture resource front doors and context ownership"}, {"owner": "sites-ui/site-kit", "paths": ["sites/umbrella/src/app/_components/sculpt-viewport.tsx", "packages/site-kit/src/mountable-scene.ts"], "reason": "One site renderer,neutral catalogs,actual pixel and canvas lifecycle fixtures; no catalog/Kids engine import edges"}, {"owner": "assets-importers", "paths": ["packages/importers/", "packages/schemas/ (asset render projections)"], "reason": "Contained supported PNG/JPEG/WebP/glTF/audio/skin projection and validation,not replacement for engine public guard"}, {"owner": "integration/delivery-docs", "paths": ["package.json", "docs/dependency-matrix.json", "docs/three-presentation-core.md", "docs/kernel-browser-open.md", "docs/asset-ingestion.md", "docs/adr/", "docs/audits/production-swarm/FINAL.md", "docs/audits/production-swarm/FINAL.json"], "reason": "Root script/contract/API/browser evidence registration and updated factual capability wording; confirmed fixes require no new dependency or widened matrix"}]}]

Submit requested shared changes as exact path/symbol/current→recommended text/API/test deltas to integration; never concurrently edit reserved surfaces. Existing current helpers/public seams and boundary matrix dominate; no second authoring core/no direct CLI-engine imports/no invented provider/legal proof. Verify upstream external documentation before new stack/API or security-version use.

Reproduce confirmed defects through actual public front doors before patch; keep failing-before/passing-after oracles, rebuild dist before running Node binaries. Execute focused existing tests then report real exit/result/assertions/platform/coverage holes. Missing installations are local work, not external blockers. New verbs require ROOT_COMMANDS + SHIPPED_COMMAND_MAP + takesArgs + bin/golden/unknown-flag parity together. Kids shared path/empty dependents, only-advance, held currency-first and LIVE default-off stay intact.

Persist per-task outcome and node commands/evidence under this lane build report; do not claim production PASS. Integration owns FINAL.md/JSON, unchanged full gate, independent actual front doors and serial repair routing capped at three passes. Every remaining intentional capability and external request remains visible in full-production counts.
