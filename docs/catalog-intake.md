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

The shipped `/editor` route reaches all three through one call:
`buildUmbrellaCatalogIntakeView()` submits the request's already-decided access
and its own render, then reads the record back. Its whole input is one
injection — the TEST provider that would store the record and the submitter's
own declaration — and `umbrellaCatalogIntake()` resolves to `null`, because this
deployment holds no catalog store and no form that collects those declarations.
The default route therefore refuses `CATALOG_INTAKE_STORAGE_UNAVAILABLE` before
a record is built and renders that named state; only an explicitly injected TEST
provider reaches `submitUmbrellaEditorToCatalog()`. The route records no
transition and no curation verdict, so what it can display is `intake` with an
empty history and a `null` listing.

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

Its digests are computed, never written down. `catalogTestPipelineDemo()` renders
the fixed editor state through the same `renderEditorState()` the entitled
`/editor` route uses and submits that render's own saved-document and
composed-artifact hashes, so a digest a storefront prints is a digest of real
editor output. A render that could not save produces no digest, and the seam
refuses `CATALOG_SUBMISSION_DIGEST_INVALID` rather than showing a placeholder.

## Refusal and authority boundary

Before provider dispatch, submission refuses anonymous or preview-only access,
unentitled requests, Kids, unsupported profile/storefront pairings, invalid
idempotency evidence, unreadable or inconsistent principal evidence
(`CATALOG_SUBMISSION_PRINCIPAL_INVALID`), malformed digests, and incomplete
Catalog Item metadata.

Idempotency is **scoped to the authenticated submitter**, not to the key alone.
`CatalogSubmissionIdempotency` carries `{ submittedBy, key }`, `submittedBy` is
resolved from the request's own principal rather than supplied by the caller,
and `catalogSubmissionScopeKey()` is the one composite key a provider stores a
retry under. Two principals reusing one client-chosen key are two unrelated
submissions; the same principal resubmitting identical evidence replays, and the
same principal reusing a key for different evidence still refuses
`CATALOG_SUBMISSION_RETRY_CONFLICT`. Item ids stay globally unique, so a second
principal claiming a stored item id refuses as well. The reference provider
holds the scope rule itself — a submission whose scope does not match its own
record's `submittedBy` refuses before anything is stored.
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
`tests/e2e/editor-catalog-intake-golden.test.ts`, which covers the vertical path,
cross-principal idempotency, the demo's digests against a real render, and both
route outcomes — the default deployment's named refusal and one injected TEST
submission; the shared refusal registry is covered by
`packages/site-kit/test/refuse-matrix.test.ts`.
