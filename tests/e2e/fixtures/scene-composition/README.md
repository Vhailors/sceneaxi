# Scene composition v1 fixtures

- `workshop-bay.scene.json` — the committed Scene Composition Intake: three
  instances built from the two landed sculpt-quality demos, with the service
  crate instanced twice and a two-level parent chain
  (`bay-service-crate` → `bay-stacked-crate` → `bay-field-drone`).
- `golden-digests.json` — fixed-seed composition, document, Mount, kernel
  save/replay, and named-refusal evidence.
- `mount-support-evidence.json` — sceneaxi#87 not-needed decision for the
  presentation seam, proven by `tests/e2e/scene-composition-golden.test.ts`.

The source artifacts are reconstructed from
`tests/e2e/fixtures/sculpt-quality/` at their landed seeds (8001, 8002); the
scene itself opens at seed 9101. Run `pnpm test:golden` or the full `pnpm gate`.
Everything here is offline: no provider, no network, no credential, no spend.
