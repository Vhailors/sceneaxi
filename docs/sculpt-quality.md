# Sculpt-quality v1

Sculpt-quality v1 is the additive quality layer over the openable hybrid
vertical from PR #75. It does not replace the Sculpt Intake, Mount, kernel, or
Minimum E2 entry points.

## Shipped contract depth

- The sculpt-quality branch of `ObjectSculptSpec` requires deterministic
  `blockout → structure → materials → sockets` passes; the closed v1 extension
  permits only `surface-detail` immediately before `sockets`.
- Non-trivial specs require a reference-checked detail inventory and refuse
  shallow declared or structural depth with stable diagnostics.
- Sculpt Artifacts carry a versioned animation-ready runtime hierarchy with
  pivots, sockets, descriptive colliders, material bindings, and attachment
  points.
- `emitSculptProcedural()` emits fixed-seed geometry, material, and hierarchy
  plans. The artifact binds the real public export, source digest, seed, and
  emitted-plan digest.
- Offline agent assistance is injected and default-off. When enabled, identical
  input is refined twice and unequal output refuses. The normal gate has no
  provider call or production spend.

The authoritative shapes remain
[`object-sculpt-spec.schema.json`](../packages/schemas/contracts/object-sculpt-spec.schema.json)
and
[`sculpt-artifact.schema.json`](../packages/schemas/contracts/sculpt-artifact.schema.json).
Runtime validators and public types live at `@sceneaxi/schemas`; reconstruction
and procedural emit live at `@sceneaxi/authoring-core`.

PR #75 ObjectSculptSpec and Sculpt Artifact v1 payloads remain valid as the
legacy v1 branch. Default reconstruction preserves that branch and returns a
legacy artifact. Only explicit sculpt-quality reconstruction calls
`normalizeObjectSculptSpec` to add the four quality passes and an attachment
socket. Quality procedural evidence resolves through the public
`@sceneaxi/authoring-core` `emitSculptProcedural` export and is recomputed from
spec plus seed during artifact validation.

## Demos and evidence

The two committed structured-spec intakes are:

- [hard-surface service crate](../tests/e2e/fixtures/sculpt-quality/hard-surface-service-crate.intake.json)
- [richer field drone](../tests/e2e/fixtures/sculpt-quality/richer-field-drone.intake.json)

[`sculpt-quality-golden.test.ts`](../tests/e2e/sculpt-quality-golden.test.ts)
opens both through deterministic reconstruction, the existing Mount API, toy
kernel save/replay, and the existing Minimum E2 save/reload surface. Its stable
artifact, procedural, frame, kernel, and document digests are checked in at
[`golden-digests.json`](../tests/e2e/fixtures/sculpt-quality/golden-digests.json).

No new mount/kernel adapter was needed. The tested not-needed decision for
sceneaxi#81 is
[`minimal-support-evidence.json`](../tests/e2e/fixtures/sculpt-quality/minimal-support-evidence.json).

## Boundaries

This ship adds no Minimum E2 checklist item, Stage 1 run, renderer decision,
production physics suite, marketplace or Kids surface, production provider
spend, or vision-score hard gate. It is deterministic contract and demo
evidence, not an engine-ready or commercially validated claim.
