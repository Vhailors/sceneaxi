# @sceneaxi/schemas

Shared contracts home for SceneAxi. Zero internal dependencies by rule.

## Delivery Handoff

- `@sceneaxi/schemas/contracts/delivery-handoff.schema.json` — public,
  package-exported portable manifest for independent delivery adapters
- TypeScript: `DeliveryHandoff`, `computeDeliveryArtifactSetDigest`,
  `validateDeliveryHandoff`, and `parseDeliveryHandoffText`
- Adapter configuration, provider credentials, signing, uploads, approvals, and
  releases are outside this closed contract

See [`docs/delivery-handoff.md`](../../docs/delivery-handoff.md) for digest
semantics and the SceneAxi-versus-adapter boundary.

## Profile Conformance (sceneaxi#10)

- `contracts/profile-conformance.schema.json` — versioned claim document
- Registry: `profileConformanceRegistry` (Game = development-consumer; Web/Kids =
  not-yet-claimed; never a shipping claim; always cites `profile-rollout-order`)
- Shared suite: `runProfileConformanceSuite(surface)` — kernel session + document
  propose/apply through the profile's pinned core + evidence-hook presence
- First development consumer: `@sceneaxi/profile-game` (exports `conformance`)

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
`catalog-metadata-unavailable-tombstone.schema.json` contract.

`intake (quarantine) → screening → curation → listed → delisted`

- Every legal transition is recorded with a reason.
- Illegal transitions, missing reasons, missing mandatory metadata, and listing
  without a **human** curation verdict refuse (fail-closed).
- The pipeline represents the human gate; it never simulates a verdict.
- Commerce fields are present and **structurally inert** until tier-6b
  marketplace activation holds open (per-storefront).

### Policy sources of truth (cite, do not rewrite)

| Topic | SoT |
|---|---|
| Asset Package interchange, acceptance, loss ledger | [factories-helpers#47](https://github.com/Vhailors/factories-helpers/issues/47) |
| Untrusted-asset ingestion + supply-chain controls | [factories-helpers#48](https://github.com/Vhailors/factories-helpers/issues/48) |

Topology-neutral: `catalog-storefront-topology` remains open. Kids consumption
is not implemented here.
