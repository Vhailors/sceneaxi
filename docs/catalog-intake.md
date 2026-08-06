# Web editor catalog intake (TEST only)

Issue [sceneaxi#218](https://github.com/Vhailors/sceneaxi/issues/218) closes the
ORDER.md Workstream 6 connection gap without opening marketplace publication.
The connection has three deliberately separate layers:

1. `renderEditorState()` produces the current text-canonical document SHA-256
   and the composed-scene artifact digest from the same real editor render.
2. `sites/umbrella/src/lib/catalog-submission.ts` carries those hashes together
   with the already-resolved principal and entitlement into
   `submitEditorCatalogItem()` in `packages/site-kit/src/catalog-pipeline.ts`.
3. An explicitly injected `CatalogTestPipelineProvider` atomically stores and
   reads the record. This repository ships only the process-local TEST reference
   provider; it has no production database adapter or moderation operator.

The submitter supplies the existing Catalog Item declarations: Asset Package id,
rights holder, licence and commercial-use flag, provenance origin and timestamp,
mandatory AI disclosure, and core/profile compatibility. The seam supplies the
hashes: `assetPackage.contentHash` is the editor artifact digest and
`provenance.sourceDigest` is the saved canonical document digest. It then calls
`createCatalogItemAtIntake()` and `validateCatalogItem()`. A successful record is
therefore `intake` with an empty transition history and inert commerce; no caller
can supply a different starting state.

## Curation and read model

`transitionTestCatalogItem()` applies one request at a time through the existing
`transitionCatalogItem()` contract. The only legal route remains:

`intake → screening → curation → listed`

Every successful step appends one immutable history entry. The `listed` step
requires a structurally valid `HumanCurationVerdict` whose decision is
`approve`; missing, malformed, or rejected verdicts refuse and do not commit.
The in-memory provider uses expected state plus expected history length as its
atomic compare point, so concurrent or conflicting retries refuse.

Every provider answer is re-validated before it becomes an authoritative result:
the submit echo, the read record, and the committed record all pass
`validateCatalogItem()` and both digest bindings again, and the commit must hand
back exactly the transition that was staged. Record identity is structural
rather than textual, so a provider that rebuilds the same record with a
different property order is the same record and neither refuses nor turns an
identical retry into a conflict.

`readCatalogPipelineItem()` validates the stored Catalog Item and rechecks both
digest bindings before projecting anything. It reports the honest pipeline state
at every stage, but its `listing` field is `null` until the validated state is
`listed`. Even then the projection says TEST, metadata-only, no asset delivery,
and `CATALOG_COMMERCE_INERT`.

Both storefront `/publish` pages render a deterministic process-local example:
one intake snapshot and a separately transitioned, explicitly human-approved
listed read model. This is a display proof, not an upload form and not evidence
of a persisted user submission.

## Refusal and authority boundary

Before provider dispatch, submission refuses anonymous or preview-only access,
unentitled requests, Kids, unsupported profile/storefront pairings, invalid
idempotency evidence, malformed digests, and incomplete Catalog Item metadata.
Provider throws, unavailable storage, invalid provider output, illegal
transitions, and conflicting retries are named refusals. Validation completes
before a write, and transition state is staged before the single atomic commit,
so these outcomes make no partial mutation.

This connection adds no production storage, Neon/Vercel activation, provider
credential, hosted model adapter, Stripe LIVE, Connect LIVE, asset delivery,
purchase completion, payout, legal/tax approval, deployment, or public release.
Catalog sites import only `@sceneaxi/site-kit`; they do not import authoring,
identity, billing, profile, or Kids packages. Kids receives no route, dependency,
catalog record, or submission path.

Executable proof is
`tests/e2e/editor-catalog-intake-golden.test.ts`; the shared refusal registry is
covered by `packages/site-kit/test/refuse-matrix.test.ts`.
