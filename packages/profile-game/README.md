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

This development-only path is **not production game-ready** and is not
publication, marketplace, or shipping authorization.

Boundaries are enforced at monorepo package level.
