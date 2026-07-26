# @sceneaxi/schemas

Shared contracts home for SceneAxi. Zero internal dependencies by rule.

## Hybrid sculpt contracts

The authoritative v1 shapes are the package-exported
`contracts/sculpt-intake.schema.json`,
`contracts/object-sculpt-spec.schema.json`, and
`contracts/sculpt-artifact.schema.json`. Package-root exports include their
constants and TypeScript types plus `validateSculptIntake`,
`validateObjectSculptSpec`, and `validateSculptArtifact`.

Sculpt-quality v1 makes the ObjectSculptSpec pass ledger and complexity class
explicit, requires a detail inventory for non-trivial specs, and projects a
versioned animation-ready runtime hierarchy with pivots, sockets, descriptive
colliders, material bindings, and attachment points. Stable quality and
incomplete-hierarchy diagnostics are part of the public TypeScript result.
Legacy PR #75 v1 payloads remain accepted and can be upgraded with
`normalizeObjectSculptSpec`; the stricter quality branch requires its ordered
ledger and an attachment. Procedural evidence is recomputed from spec plus
seed during artifact validation; schemas does not package-export a procedural
emitter. See
[`docs/sculpt-quality.md`](../../docs/sculpt-quality.md) and ADRs 0010–0013.

Reconstruction behavior belongs to
[`@sceneaxi/authoring-core`](../authoring-core/README.md#hybrid-sculpt-reconstruction-and-minimum-e2);
renderer mounting belongs to
[`@sceneaxi/engine-presentation`](../engine-presentation/README.md#mount-api).
The schemas contain neither provider credentials nor renderer types.

## Scene composition contracts (sceneaxi#85)

`contracts/scene-composition.schema.json` is the authoritative v1 shape for both
the **Scene Composition Intake** (several Sculpt Artifacts placed relative to one
another) and the resolved **ComposedScene**. Package-root exports add
`validateSceneCompositionIntake`, `validateComposedScene`,
`resolveScenePlacements`, `composeSculptTransforms`,
`projectSceneInstanceHierarchy`, the `digest*` helpers, and their types.

Placement composition is axis-aligned in v1: scales multiply, rotations add and
wrap into `[0, 360)`, and a child offset is scaled by its parent but never
rotated. Because that would mis-nest children, a non-leaf instance carrying a
non-zero rotation refuses (`rotated-parent-unsupported`) rather than
approximating; leaf instances rotate freely.

Placement is a **projection, never an artifact rewrite**. A Sculpt Artifact's
evidence binds its exact spec bytes, so `projectSceneInstanceHierarchy` composes
the world transform into the instance's root node only and leaves the artifact —
and its digests — untouched. Existing root-local transforms remain part of the
artifact and are composed after the instance world transform.

`validateComposedScene` recomputes instance order, depths, world transforms, the
placement digest, every embedded artifact digest, and the scene digest, so a
tampered scene refuses instead of opening. The composition pipeline itself lives
in [`@sceneaxi/authoring-core`](../authoring-core/README.md#scene-composition);
the multi-object open path lives in
[`@sceneaxi/engine-kernel`](../engine-kernel/README.md#scene-kernel-sessions).

## Unambiguous JSON

`parseUnambiguousJson` is the package-root parser for JSON text that must refuse
duplicate member names before contract validation. Delivery Handoff, external
document import, and provider tool-call parsing share this one implementation.

## Delivery Handoff

- `@sceneaxi/schemas/contracts/delivery-handoff.schema.json` — public,
  package-exported portable manifest for independent delivery adapters
- TypeScript: `DeliveryHandoff`, `computeDeliveryArtifactSetDigest`,
  `validateDeliveryHandoff`, and `parseDeliveryHandoffText`
- Adapter configuration, provider credentials, signing, uploads, approvals, and
  releases are outside this closed contract

See [`docs/delivery-handoff.md`](../../docs/delivery-handoff.md) for digest
semantics and the SceneAxi-versus-adapter boundary.

## Plugin Manifest (sceneaxi#20 / ADR 0005)

- `contracts/plugin-manifest.schema.json` — v1 capability-manifest descriptor
  (export: `@sceneaxi/schemas/contracts/plugin-manifest.schema.json`)
- `contracts/plugin-manifest.inert.example.json` — checked-in inert noop example
  matching `docs/plugins.md` (export:
  `@sceneaxi/schemas/contracts/plugin-manifest.inert.example.json`)
- TypeScript: `PluginManifest`, `validatePluginManifest`, `parsePluginManifestText`,
  `inertPluginManifestFixture`, `PLUGIN_MANIFEST_PATH`, `PLUGIN_MANIFEST_SCHEMA_URI`
- Shape-only contract; host runtime lives in
  [`@sceneaxi/plugin-host`](../plugin-host/README.md), which owns the
  deterministic load/refuse fixture matrix (sceneaxi#23) and refusal guidance
  (sceneaxi#24)
- Fixed package path: `sceneaxi.plugin.manifest.json` (`PLUGIN_MANIFEST_PATH`)
- Agent overview: [`docs/plugins.md`](../../docs/plugins.md)
- Drift between schema, inert example, and docs is enforced by `pnpm check:contracts`

## Plugin Capability ID Registry (sceneaxi#21 / ADR 0005)

- `contracts/plugin-capability-registry.schema.json` — versioned registry document shape
- `contracts/plugin-capability-registry.1.0.0.json` — checked-in seed; reviewed
  capability rows only, no demonstration or engine-internal ports
- TypeScript: `PluginCapabilityRegistry`, `validatePluginCapabilityRegistry`,
  `parsePluginCapabilityRegistryText`, `lookupPluginCapability`,
  `pluginCapabilityRegistrySeed`, `emptyPluginCapabilityRegistry`,
  `SHIPPED_PLUGIN_CAPABILITY_IDS`
- Registered capability contracts live beside the registry; today that is
  `sceneaxi.sculpt.intake-source.v1` (`SCULPT_INTAKE_SOURCE_CAPABILITY_ID`,
  `checkSculptIntakeSourceImplementation`, `requestSculptIntake`), which produces
  a Sculpt Intake and is documented in [`docs/plugins.md`](../../docs/plugins.md)
- IDs are explicit registry keys only; lookup miss is typed
  (`reason: "unknown-capability"`) for host fail-closed refusal
- **Absent ID means stop.** Do not invent a manifest hook, renderer/physics/storage
  port, engine-private import, or tutorial-only capability string. Propose a
  public semantic contract and a reviewed registry row first; only then declare
  the ID in a plugin manifest. See [`docs/plugins.md`](../../docs/plugins.md).
- Drift between schema, seed artifact, and docs is enforced by `pnpm check:contracts`

<!-- plugin-capability-registry:seed-state -->
Registry seed state: `registryVersion` is `1.0.0`; `entries` holds exactly 1 reviewed capability ID: `sceneaxi.sculpt.intake-source.v1`.
<!-- /plugin-capability-registry:seed-state -->

## Profile Conformance (sceneaxi#10)

- `contracts/profile-conformance.schema.json` — versioned claim document
- Registry: `profileConformanceRegistry` (Game = development-consumer; Web/Kids =
  not-yet-claimed; never a shipping claim; retains the
  `profile-rollout-order` decision citation)
- Node-only shared suite:
  `@sceneaxi/schemas/node/profile-conformance-suite` exports
  `runProfileConformanceSuite(surface)` — kernel session + document propose/apply
  through the profile's pinned core + evidence-hook presence. The browser-facing
  package root exports the contract and registry, not this filesystem-backed suite.
- First development consumer: `@sceneaxi/profile-game` (exports `conformance`)

## Open-path demo policy (sceneaxi#137)

- `contracts/open-path-policy.schema.json` — the closed policy enumeration
- Canonical data: `contracts/open-path-policy.fixtures.json`, mirrored by
  `OPEN_PATH_POLICY` in `src/open-path-policy.ts`; `pnpm check:contracts` keeps
  the fixture, the schema, and the `docs/open-path-policy.md` table in lockstep,
  and the seam test `test/open-path-policy.test.ts` asserts the TypeScript table
  and the fixture are identical
- Shared decision function: `evaluateOpenPathDemo()`; shared surface payload:
  `openPathPolicyView()`; shared one-profile projection:
  `openPathPolicyViewFor()` — keeps the true `policyCount`, marks itself with
  `filteredTo`, and refuses an off-policy profile with the same
  `OPEN_PATH_PROFILE_UNKNOWN` an evaluation gives
- Shared command-surface helpers: `resolveOpenPathSurfaceRequest()` turns the two
  optional flag values into one tagged report/project/evaluate/refuse outcome,
  and `openPathSurfaceNotes()` owns the sentences printed beside it, so neither
  command surface re-implements the branch table or restates the policy
- Lives here because `schemas` is the only package the dependency matrix lets
  both profiles, the CLI, and both shells name — so parity cost no boundary
- `shippingClaim` is `false` structurally, and `@sceneaxi/profile-kids` is
  refuse-only: neither is a convention this package can be talked out of

## Model Provider Port (sceneaxi#45)

- `contracts/model-provider-port.schema.json` — v1 model/capability descriptors,
  complete/tool-call/stream envelopes, and successful-call evidence shape
- TypeScript contract: `src/model-provider.ts`; executable policy and adapter
  dispatch remain owned by `@sceneaxi/authoring-core`
- Provider policy authority: [SPEC § Model Provider Port](../../docs/program/SPEC.md#model-provider-port)

## Document + propose/apply (sceneaxi#9)

- `contracts/document.schema.json` — text-canonical SceneAxi document (v1)
- `contracts/proposal.schema.json` — propose/apply proposal artifact (v1)
- TypeScript validators: `validateDocument`, `validateProposal` (shared by
  authoring-core direct edits and proposals)

## Catalog Item (sceneaxi#12)

Versioned **Catalog Item** contract (`contracts/catalog-item.schema.json`) and a
fail-closed **pipeline state machine** stub (`src/catalog.ts`):

The JSON Schema is exported at
`@sceneaxi/schemas/contracts/catalog-item.schema.json` for package consumers.
Metadata-unavailable takedowns use the distinct, package-exported
`catalog-metadata-unavailable-tombstone.schema.json` contract. Delisting can
return this tombstone only when the item identity and valid listed moderation
history remain; it records which authoritative metadata was unavailable rather
than inventing it.

`intake (quarantine) → screening → curation → listed → delisted`

- Every legal transition is recorded with a reason.
- Illegal transitions, missing reasons, and missing mandatory metadata refuse
  (fail-closed), except for the explicit metadata-unavailable delisting result
  above. Listing also refuses without a **human** curation verdict.
- The pipeline represents the human gate; it never simulates a verdict.
- Commerce fields are present and **structurally inert** until tier-6b
  marketplace activation holds open (per-storefront).

### Policy sources of truth (cite, do not rewrite)

| Topic | SoT |
|---|---|
| Asset Package interchange, acceptance, loss ledger | [factories-helpers#47](https://github.com/Vhailors/factories-helpers/issues/47) |
| Untrusted-asset ingestion + supply-chain controls | [factories-helpers#48](https://github.com/Vhailors/factories-helpers/issues/48) |

The contract remains topology-neutral; the locked storefront topology is owned
by the canonical product spec
([sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1)). Kids consumption is
not implemented here.

## Identity, credits, and billing (sceneaxi#90)

- `contracts/identity.schema.json`, `contracts/credit-ledger.schema.json`,
  `contracts/billing-checkout.schema.json`, `contracts/credit-packs.schema.json`,
  `contracts/entitlement-decision.schema.json`,
  `contracts/entitlement-matrix.schema.json`,
  `contracts/catalog-listings.schema.json`, `contracts/revenue-share.schema.json`
- TypeScript contracts: `src/identity.ts`, `src/credits.ts`, `src/billing.ts`,
  `src/entitlements.ts`, `src/catalog-listing.ts`, `src/revenue-share.ts`
- Canonical fixtures (`credit-packs`, `entitlement-matrix`, `catalog-listings`) are
  kept in lockstep with the tables in
  [`docs/auth-credits.md`](../../docs/auth-credits.md) by `pnpm check:contracts` —
  that document owns the shapes, invariants, and configuration; enforcement lives in
  `@sceneaxi/auth` and `@sceneaxi/billing` (ADR 0021)
- `src/credit-packs.data.ts` (`CREDIT_PACK_CATALOG_DATA`) is the bundled twin of the
  credit-pack fixture, exported from the package root because a bundled serverless site
  cannot rely on tracing a package-relative JSON file. The same `pnpm check:contracts`
  run holds it byte-for-byte against the fixture, so it is a copy that cannot drift, not
  a second source of truth
