# Assignment — engine-physics

**Status:** READY FOR DISPATCH, not implemented or verified by baseline.

## Role and safety

Lead: GPT-6.1 Sol, standard tier requested; independent reviewer/judge: GPT-6 Astra, standard tier requested. Orchestrator must confirm actual dispatch. Repair bound: three passes. Parent is coordinator; no recursive grandchildren. Do not duplicate live builders. No writes to child-owned files until explicit completion handoff.

Read whole target files and canonical helpers before writing. Preserve all inherited dirty/untracked work. Reproduce exact failures and retain fail-before/pass-after oracles. No blanket casts, weakened checks, skipped assertions or invented external resources. No staging, commits, pushes, public posts, merge, deployment, spending, accounts, LIVE activation, production DB or held proof.

ALL manifests, locks, dependency manifests and workflows belong to security-delivery, even inside your package/site/desktop directories. Shared schemas/index, root configurations/exports, root tests and owning docs are serial-integration-only. Source files not listed below are read-only; submit exact requests to their owner.

Root/site builds and full gate belong to serial integration. No more than one heavy build/browser/native/packaging process runs graph-wide. Lightweight static/code work may fan out under available-memory monitoring.

## Task acceptance

Primary tasks (40): ENG-002, ENG-005, ENG-003, ENG-006, ENG-004, ENG-007, ENG-001, ENG-008, ENG-009, ENG-010, ENG-011, ENG-012, ENG-013, ENG-014, ENG-015, ENG-017, COVERAGE-ENGINE, ENG-016, GATE-DEVICES, LOCAL-PROOF-063, LOCAL-PROOF-066, LOCAL-PROOF-067, LOCAL-PROOF-068, LOCAL-PROOF-069, LOCAL-PROOF-090, REQ-PROOF-CORE-001, REQ-PROOF-CORE-002, REQ-PROOF-CORE-003, REQ-PROOF-CORE-005, REQ-PROOF-CORE-007, REQ-PROOF-CORE-011, REQ-PROOF-CORE-012, REQ-PROOF-CORE-014, REQ-PROOF-CORE-015, REQ-PROOF-CORE-017, REQ-PROOF-CORE-018, 06-01, 06-02, 06-03, DEEP-08-ADDITIONAL-1.

Read exact targets, symbols, SHA-256, dependency owners, commands and nonblank assertions from `../ledger.json`. A named suite exit is insufficient if the task assertion has no executed matching oracle. Baseline verification state is NOT_EXECUTED; no DONE or percentage transferred from finish reports.

Astra PASS requires every assigned assertion tied to current exact source/artifact, preserved positive/negative safety, and recorded command/exit/cleanup. Local and published and full-production are separately classified. Reports must use DONE_VERIFIED, NEEDS_LOCAL_FIX, EXTERNAL_BLOCKER with exact missing input, or INTENTIONAL_FULL_PRODUCTION_GAP; the latter never closes the full goal.

## One-level parallel child packets

### kernel-orchestrator

Task IDs: ENG-002, ENG-007, ENG-001, ENG-009, ENG-015, GATE-DEVICES, LOCAL-PROOF-069, REQ-PROOF-CORE-001, REQ-PROOF-CORE-002, REQ-PROOF-CORE-003, DEEP-08-ADDITIONAL-1.

Exclusive exact files:

- `packages/engine-kernel/README.md`
- `packages/engine-kernel/src/errors.ts`
- `packages/engine-kernel/src/gameplay.ts`
- `packages/engine-kernel/src/index.ts`
- `packages/engine-kernel/src/portable-digest.ts`
- `packages/engine-kernel/src/rarity.ts`
- `packages/engine-kernel/src/scene-session.ts`
- `packages/engine-kernel/src/sculpt-session.ts`
- `packages/engine-kernel/src/session.ts`
- `packages/engine-kernel/test/browser-open-play.test.ts`
- `packages/engine-kernel/test/final-acceptance.test.ts`
- `packages/engine-kernel/test/gameplay.test.ts`
- `packages/engine-kernel/test/kernel-contract.test.ts`
- `packages/engine-kernel/test/portable-digest.test.ts`
- `packages/engine-kernel/test/production-hardening.test.ts`
- `packages/engine-kernel/test/rarity.test.ts`
- `packages/engine-kernel/test/scene-session.test.ts`
- `packages/engine-kernel/test/sculpt-session.test.ts`
- `packages/engine-kernel/test/seam.test.ts`
- `packages/engine-kernel/test/session.test.ts`
- `packages/engine-kernel/tsconfig.json`
- `packages/engine-orchestrator/README.md`
- `packages/engine-orchestrator/src/index.ts`
- `packages/engine-orchestrator/src/open-path.ts`
- `packages/engine-orchestrator/src/refusals.ts`
- `packages/engine-orchestrator/test/fixtures.ts`
- `packages/engine-orchestrator/test/golden-path-orchestrated.test.ts`
- `packages/engine-orchestrator/test/open-path.test.ts`
- `packages/engine-orchestrator/test/production-hardening.test.ts`
- `packages/engine-orchestrator/test/refuse-matrix.test.ts`
- `packages/engine-orchestrator/test/seam.test.ts`
- `packages/engine-orchestrator/tsconfig.json`

### presentation

Task IDs: ENG-005, ENG-003, ENG-006, ENG-004, ENG-012, ENG-013, ENG-014, ENG-017, LOCAL-PROOF-066, LOCAL-PROOF-067, LOCAL-PROOF-068, LOCAL-PROOF-090.

Exclusive exact files:

- `packages/engine-presentation/README.md`
- `packages/engine-presentation/src/audio-playback.ts`
- `packages/engine-presentation/src/contained-image.ts`
- `packages/engine-presentation/src/index.ts`
- `packages/engine-presentation/src/orbit-camera.ts`
- `packages/engine-presentation/src/render-loop.ts`
- `packages/engine-presentation/src/runtime.ts`
- `packages/engine-presentation/src/sculpt-mount.ts`
- `packages/engine-presentation/src/three-core.ts`
- `packages/engine-presentation/src/three-presentation-error.ts`
- `packages/engine-presentation/src/three-runtime.ts`
- `packages/engine-presentation/src/three-sculpt.ts`
- `packages/engine-presentation/src/three-surface.ts`
- `packages/engine-presentation/src/triangle-animation.ts`
- `packages/engine-presentation/test/.finish-results.json`
- `packages/engine-presentation/test/audio-playback.test.ts`
- `packages/engine-presentation/test/browser-engine-frontdoors.mjs`
- `packages/engine-presentation/test/browser-production-proof.mjs`
- `packages/engine-presentation/test/completion.test.ts`
- `packages/engine-presentation/test/contained-image.test.ts`
- `packages/engine-presentation/test/declaration-consumer.test.ts`
- `packages/engine-presentation/test/production-hardening.test.ts`
- `packages/engine-presentation/test/runtime.test.ts`
- `packages/engine-presentation/test/sculpt-mount.test.ts`
- `packages/engine-presentation/test/seam.test.ts`
- `packages/engine-presentation/test/three-presentation.test.ts`
- `packages/engine-presentation/test/three-surface.test.ts`
- `packages/engine-presentation/tsconfig.json`

### physics

Task IDs: 06-02.

Exclusive exact files:

- `packages/physics-rapier/src/index.ts`
- `packages/physics-rapier/src/world.ts`
- `packages/physics-rapier/test/production-hardening.test.ts`
- `packages/physics-rapier/test/seam.test.ts`
- `packages/physics-rapier/tsconfig.json`

## Lead-only cross-file task coordination

ENG-008, ENG-010, ENG-011, COVERAGE-ENGINE, ENG-016, LOCAL-PROOF-063, REQ-PROOF-CORE-005, REQ-PROOF-CORE-007, REQ-PROOF-CORE-011, REQ-PROOF-CORE-012, REQ-PROOF-CORE-014, REQ-PROOF-CORE-015, REQ-PROOF-CORE-017, REQ-PROOF-CORE-018, 06-01, 06-03

All task source owners outside this lane are dependencies, not overlapping write grants. Exact requests are machine-readable in `../assignments.json`. A missing-capabilities task owner may not rewrite source belonging to another lane; it must obtain a bounded owner implementation/handoff and retain responsibility for complete acceptance.

## Report ownership and handoff

Own only `../fix-engine-physics.md` and `../fix-engine-physics.json` for lane findings. Write them early; retain source hashes, commands, exits, assertion names, failures, resource cleanup and external inputs. Other audit/repair/finish directories are READ ONLY. After completion explicitly release these reports and child file claims to serial integration; no permanent report lock.
