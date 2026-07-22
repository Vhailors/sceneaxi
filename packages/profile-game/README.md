# @sceneaxi/profile-game

Game profile — first **development** consumer of the shared Profile Conformance
suite ([sceneaxi#10](https://github.com/Vhailors/sceneaxi/issues/10)).

- Pins the core train via `sceneaxi.corePin` / `seam.corePin` (`^0.0.0`).
- Exports `conformance` for the shared suite in `@sceneaxi/schemas`
  (`runProfileConformanceSuite`).
- Cites open held key `profile-rollout-order`; `shippingClaim` is always false.

This is **not** a shipping or publication decision.

Boundaries are enforced at monorepo package level.
