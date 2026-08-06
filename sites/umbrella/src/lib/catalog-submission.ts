/**
 * Umbrella-owned adapter from the entitled editor render to catalog intake.
 *
 * Identity and entitlement are carried from the request's already-resolved access;
 * this module reads no environment, provider credential, or deployment store. The
 * only persistence boundary is the explicitly injected TEST provider.
 *
 * The `/editor` route reaches intake through `buildUmbrellaCatalogIntakeView()`,
 * whose whole input is one injection: the TEST provider that would store the record
 * and the submitter's own declaration. This repository ships no catalog store and no
 * declaration form, so `umbrellaCatalogIntake()` resolves to `null` and every request
 * on the deployed route refuses `CATALOG_INTAKE_STORAGE_UNAVAILABLE` before a record
 * is built. Nothing here invents a licence, a rights holder, a disclosure, or a
 * curation verdict on a visitor's behalf.
 */
import {
  ok,
  readCatalogPipelineItem,
  refuse,
  submitEditorCatalogItem,
  type CatalogListedProjection,
  type CatalogSubmissionMetadata,
  type CatalogSubmissionProfile,
  type CatalogSubmissionReceipt,
  type CatalogTestPipelineProvider,
  type EditorRender,
  type EditorSessionAccess,
  type PipelineState,
  type SiteResult,
} from "@sceneaxi/site-kit";

export async function submitUmbrellaEditorToCatalog(input: {
  readonly access: EditorSessionAccess;
  readonly render: EditorRender;
  readonly profile: CatalogSubmissionProfile;
  readonly surface: string;
  readonly metadata: CatalogSubmissionMetadata;
  readonly idempotencyKey: string;
  readonly provider: CatalogTestPipelineProvider;
}): Promise<SiteResult<CatalogSubmissionReceipt>> {
  return submitEditorCatalogItem({
    access: input.access,
    profile: input.profile,
    surface: input.surface,
    evidence: {
      documentDigest: input.render.documentDigest,
      artifactDigest: input.render.artifactDigest,
    },
    metadata: input.metadata,
    idempotencyKey: input.idempotencyKey,
    provider: input.provider,
  });
}

/** Everything a deployment would have to supply before one submission may happen. */
export type UmbrellaCatalogIntakeInjection = {
  readonly provider: CatalogTestPipelineProvider;
  /** The submitter's own Catalog Item declarations. Never derived from the render. */
  readonly declaration: CatalogSubmissionMetadata;
};

/** What the route renders after one submission: honest state, never a listing it invented. */
export type UmbrellaCatalogIntakeView = {
  readonly itemId: string;
  readonly pipelineState: PipelineState;
  readonly recordedTransitions: number;
  readonly documentDigest: string;
  readonly artifactDigest: string;
  readonly replayed: boolean;
  readonly listing: CatalogListedProjection | null;
};

/**
 * This deployment's catalog intake injection.
 *
 * Absent by construction: there is no production store to write to and no form that
 * collects the declarations intake requires, so the honest answer is `null` rather
 * than a process-local stand-in pretending to be persistence.
 */
export function umbrellaCatalogIntake(): UmbrellaCatalogIntakeInjection | null {
  return null;
}

/**
 * The idempotency key for one editor render.
 *
 * Derived from the render's own digests, so re-opening the same editor URL replays
 * the submission it already made instead of conflicting with it. The submitter is
 * not part of this key: the seam scopes it by the request's authenticated principal.
 */
export function umbrellaCatalogIntakeKey(render: EditorRender): string {
  return `editor-render:${render.documentDigest}:${render.artifactDigest}`;
}

/**
 * Submit the current entitled render and read back what the pipeline actually holds.
 *
 * Listing is not part of this path: a fresh record is `intake` with no history, and
 * `listing` stays `null` until screening, curation, and an explicit human approval
 * have each been recorded elsewhere.
 */
export async function buildUmbrellaCatalogIntakeView(input: {
  readonly access: EditorSessionAccess;
  readonly render: EditorRender;
  readonly profile: CatalogSubmissionProfile;
  readonly surface: string;
  readonly injection: UmbrellaCatalogIntakeInjection | null;
}): Promise<SiteResult<UmbrellaCatalogIntakeView>> {
  if (input.injection === null) return refuse("CATALOG_INTAKE_STORAGE_UNAVAILABLE");
  const provider = input.injection.provider;
  const submitted = await submitUmbrellaEditorToCatalog({
    access: input.access,
    render: input.render,
    profile: input.profile,
    surface: input.surface,
    metadata: input.injection.declaration,
    idempotencyKey: umbrellaCatalogIntakeKey(input.render),
    provider,
  });
  if (!submitted.ok) return submitted;

  const stored = await readCatalogPipelineItem({
    provider,
    itemId: submitted.value.record.item.itemId,
  });
  if (!stored.ok) return stored;

  return ok(
    Object.freeze({
      itemId: stored.value.itemId,
      pipelineState: stored.value.pipelineState,
      recordedTransitions: stored.value.history.length,
      documentDigest: submitted.value.record.documentDigest,
      artifactDigest: submitted.value.record.artifactDigest,
      replayed: submitted.value.replayed,
      listing: stored.value.listing,
    }),
  );
}
