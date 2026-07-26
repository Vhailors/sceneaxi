# @sceneaxi/profile-game

Game profile — first **development** consumer of the shared Profile Conformance
suite ([sceneaxi#10](https://github.com/Vhailors/sceneaxi/issues/10)).

- Pins the core train via `sceneaxi.corePin` / `seam.corePin` (`^0.0.0`).
- Exports `conformance` for `runProfileConformanceSuite` from the Node-only
  `@sceneaxi/schemas/node/profile-conformance-suite` subpath.
- The gate-run MVP golden path selects that public `conformance` surface as its
  Game consumer policy (`pnpm test:golden`).
- Retains the `profile-rollout-order` decision citation; `shippingClaim` is
  always false.

## `sceneGoldenPath` — the multi-object path

`ProfileConformanceSurface` is a fixed contract shape and stays single-object.
`sceneGoldenPath` is the separate development-only pin that lets the Game
profile drive the composition vertical
([scene-composition.md](../../docs/scene-composition.md)) end to end: compose
Sculpt Artifacts → project a document → mount N instances → open, advance, save,
and replay a scene kernel session.

That scene session is bootstrapped through `@sceneaxi/engine-orchestrator`
(`bootstrapOpenPath` / `resumeOpenPath`, [ADR 0023](../../docs/adr/0023-open-path-bootstrap-and-session-lifecycle.md)),
and the pinned surface deliberately carries **no** kernel scene entry point
beside it, so the path cannot quietly revert to calling the kernel directly.
Kernel authority is unchanged — the orchestrator hands back the kernel's own
session.

Like `@sceneaxi/profile-web`'s `mvpGoldenPath`, it is **not** a Profile
Conformance registry claim and describes no shipped product — `shippingClaim`
stays false. Everything reachable from it is offline and deterministic: no
provider, no network, no seed drawn at runtime. Proven by
`tests/e2e/profile-game-scene-golden.test.ts` (`pnpm test:golden`).

This development-only path is **not production game-ready** and is not
publication, marketplace, or shipping authorization.

Boundaries are enforced at monorepo package level.
