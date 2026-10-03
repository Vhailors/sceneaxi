# physics-v1 — auxiliary acceptance evidence

Task ID: capacity-work-2026-10-02/physics-v1.

## Executed proof: 14/14 PASS, bounded source subject only

Run from the actual repository root:

```sh
python3 docs/audits/production-swarm/capacity-work-2026-10-02/physics-v1/acceptance.py --record
```

`acceptance.py` compiles a virtual legacy consumer with the existing TypeScript 5.9.3 compiler, then loads actual product TypeScript through an in-memory CommonJS loader. No product algorithm is copied, no build or dist artifact is used. `evidence.json` records the complete consumer input, source hashes, exact outputs/refusals, source symbol locations, and assertions. Final exit code: 0; zero consumer or dependency diagnostics.

- Legacy public barrel exports compile, including `ScenePhysicsCatalog`, `ScenePhysicsShape`, `SCENE_PHYSICS_SHAPE_KINDS`, and unguarded `legacy.shapes.map(shape => shape.shapeId)`. The old TS18048 optional-shapes finding is **not reproduced on the final fingerprint**.
- Shapes/shapeId normalize to colliders/colliderId, default engine remains `toy`, legacy shape-upsert succeeds, and modern collider input succeeds without input mutation.
- Null, poisoned proxy, and accessor worlds refuse through `requireScenePhysicsCatalog`, `parseScenePhysicsCatalog`, toy host `create`, `evaluateScenePhysics`, and `applyScenePhysicsMutation`. Observed require/toy error: `Error: PHYSICS_CATALOG_INVALID`; parse: `null`; evaluation/mutation: `ok:false`, reason `PHYSICS_CATALOG_INVALID`. All hostile reads/writes: 0; caller world identity preserved.
- Positive toy-host runtime probe advances an actual legacy catalog for 16ms, snapshots body-1 at y=1.00748864/vy=-0.15696000000000002, serializes, and disposes without changing the caller catalog.
- Engine `openSceneKernelSession(null, {seed:1})` refuses with `KernelSessionError: ComposedScene must be a JSON object.` This is a boundary probe, **not** a successful composed-scene simulation proof.
- Rapier public module imports and consumer types compile; its asynchronous factory is **not called** in the bounded probe.
- Compile negative control changes shape size to a string and observes TS2322 on the exact shape declaration. Runtime negative control injects `{ok:true}` into the same refusal checker and confirms the checker throws. Both controls PASS.

## Fingerprint and scope

Final `packages/schemas/src/desktop-scene-physics.ts` SHA-256: `77efd8aa05900dc319303dc96f502b927f77db473ba84d106a11d54cafc5d9d3`.
Harness SHA-256: `97b5bdec762b3207e1ff81655b0b898410621a2dfa10f30b8d1f60fa309232d9`.
All six product subject hashes are in `evidence.json`; final probe verifies the hashes remain unchanged throughout execution. Earlier inventory observed desktop-scene-physics hash `b81a0e3b46cf9fe4f9ef9d4d554b3d5fa8f3784c2b566c57c7231bee38c0280d`, so this evidence must not be treated as proof of that earlier candidate. This agent made **no product edits**.

Exact handoff targets: `packages/schemas/src/desktop-scene-physics.ts:53` (`ScenePhysicsShape`), `:96` (`ScenePhysicsLegacyCatalog`), `:107-108` (`ScenePhysicsCatalog`/input alias), `:144` (`requireScenePhysicsCatalog`), `:231` (`parseScenePhysicsCatalog`), `:255` (`applyScenePhysicsMutation`), `:407` (`evaluateScenePhysics`); `packages/schemas/src/physics-world-host.ts:25` (`createToyPhysicsWorldHost`); `packages/engine-kernel/src/scene-session.ts:208` (`openSceneKernelSession`); `packages/physics-rapier/src/index.ts:51` (`createRapierPhysicsWorldHost`).

## Serial integration and deferred checks

No additional source compatibility patch is justified by the final probe. Preserve the existing historical `compatibility-proposal.patch`, but **do not apply it blindly**: recheck its alias changes against the final subject first. `report.json.priorEvidence` preserves the earlier failing read-consumer report; current results supersede it only for the recorded fingerprint. Initial new-probe failures were probe mistakes (wrong literal kind and mistaken require/parse result conventions), corrected before the final run; they were not product findings.

After explicit review handoff and WASM resource approval, with existing Rapier/TypeScript dependencies and an unchanged accepted candidate:

```sh
SCENEAXI_PHYSICS_WASM_HANDOFF=approved python3 docs/audits/production-swarm/capacity-work-2026-10-02/physics-v1/deferred-wasm.py
```

The executable deferred check initializes the actual Rapier public host, exercises legacy/normalized catalogs and poisoned-world refusals, and disposes created handles. Actual WASM execution: **NOT RUN**. Its no-approval gate was executed and returned exit 2 / `NOT RUN`, proving it does not silently initialize WASM. Native/GUI/full-root acceptance remains **NOT RUN** and requires serial integrator-owned fixtures/resource approval; this report makes no desktop certification or duplicate full-review claim.

Owned edits: `acceptance.py`, `deferred-wasm.py`, `evidence.json`, `report.md`, `report.json`, all inside physics-v1. No package installation, build, source/config/test changes, staging, commits, provider/DB access, services, ports, browser/GPU jobs, or workers were used. Temporary captured output was removed; no virtual fixture was emitted; toy handles were disposed.
