# Hybrid sculpt evidence fixtures

Stable CI paths for issue #73:

- `structured-spec.intake.json` — deterministic golden path input.
- `demo-image-brief.intake.json` — self-contained one-pixel PNG plus the live
  demo brief; reconstructs to the openable `demo-lantern-artifact`.
- `.sceneaxi/evidence/issue-73-hybrid-sculpt-golden.json` — checked-in expected
  digests for reconstruction, mount, kernel animation/collision/replay, editor
  save/load, and live demo preview.

The Three preview in this path is experimental and a non-decision. This fixture
does not run Stage 1 or make a renderer winner claim.
