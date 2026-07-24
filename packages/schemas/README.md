# @sceneaxi/schemas

Shared contracts home for SceneAxi. Zero internal dependencies by rule.

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
- `contracts/plugin-capability-registry.1.0.0.json` — checked-in seed with no
  demonstration or engine-internal ports
- TypeScript: `PluginCapabilityRegistry`, `validatePluginCapabilityRegistry`,
  `parsePluginCapabilityRegistryText`, `lookupPluginCapability`,
  `emptyPluginCapabilityRegistrySeed`
- IDs are explicit registry keys only; lookup miss is typed
  (`reason: "unknown-capability"`) for host fail-closed refusal
- **Absent ID means stop.** Do not invent a manifest hook, renderer/physics/storage
  port, engine-private import, or tutorial-only capability string. Propose a
  public semantic contract and a reviewed registry row first; only then declare
  the ID in a plugin manifest. See [`docs/plugins.md`](../../docs/plugins.md).
- Drift between schema, seed artifact, and docs is enforced by `pnpm check:contracts`

<!-- plugin-capability-registry:seed-state -->
Registry seed state: `registryVersion` is `1.0.0`; `entries` is exactly `[]` (empty).
<!-- /plugin-capability-registry:seed-state -->

## Profile Conformance (sceneaxi#10)

- `contracts/profile-conformance.schema.json` — versioned claim document
- Registry: `profileConformanceRegistry` (Game = development-consumer; Web/Kids =
  not-yet-claimed; never a shipping claim; retains the
  `profile-rollout-order` decision citation)
- Shared suite: `runProfileConformanceSuite(surface)` — kernel session + document
  propose/apply through the profile's pinned core + evidence-hook presence
- First development consumer: `@sceneaxi/profile-game` (exports `conformance`)

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
