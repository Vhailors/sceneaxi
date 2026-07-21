# @sceneaxi/schemas

Shared contracts home for SceneAxi. Zero internal dependencies by rule.

## Catalog Item (sceneaxi#12)

Versioned **Catalog Item** contract (`contracts/catalog-item.schema.json`) and a
fail-closed **pipeline state machine** stub (`src/catalog.ts`):

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
