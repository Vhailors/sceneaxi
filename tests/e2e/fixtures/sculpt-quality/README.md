# Sculpt-quality v1 fixtures

- `hard-surface-service-crate.intake.json` — non-trivial hard-surface prop.
- `richer-field-drone.intake.json` — slightly richer multi-part object.
- `golden-digests.json` — fixed-seed reconstruction, emit, Mount, kernel,
  Minimum E2, and named-refusal evidence.
- `minimal-support-evidence.json` — sceneaxi#81 not-needed decision, proven by
  `tests/e2e/sculpt-quality-golden.test.ts`.

Run `pnpm test:golden` or the full `pnpm gate`. Vision scores are not part of
either hard gate.
