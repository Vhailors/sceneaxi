/**
 * Umbrella-owned adapter from the entitled editor render to catalog intake.
 *
 * Identity and entitlement are carried from the request's already-resolved access;
 * this module reads no environment, provider credential, or deployment store. The
 * only persistence boundary is the explicitly injected TEST provider.
 */
import {
  submitEditorCatalogItem,
  type CatalogSubmissionMetadata,
  type CatalogSubmissionProfile,
  type CatalogSubmissionReceipt,
  type CatalogTestPipelineProvider,
  type EditorRender,
  type EditorSessionAccess,
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
