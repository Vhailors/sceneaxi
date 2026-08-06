/**
 * The labeled TEST editor-to-listing proof, shared by both storefronts.
 *
 * It prints only what the injected TEST pipeline returned for this surface: the state
 * intake actually recorded, the transitions actually stored, and the digests the
 * validated record is bound to. A refusal renders the refusal line instead of a
 * listing projection, because a proof this page cannot obtain is not one it may draw.
 */
import type { CatalogPipelineReadModel, SiteResult } from "@sceneaxi/site-kit";

export function TestPipelineProof({
  pipeline,
}: {
  readonly pipeline: SiteResult<{
    readonly intake: CatalogPipelineReadModel;
    readonly listed: CatalogPipelineReadModel;
  }>;
}) {
  return (
    <section className="section" id="test-pipeline">
      <h2>TEST editor-to-listing proof</h2>
      {pipeline.ok && pipeline.value.listed.listing !== null ? (
        <>
          <p className="prose">
            A real render of the fixed editor state enters{" "}
            <strong>{pipeline.value.intake.pipelineState}</strong> with no history, carrying
            that render&rsquo;s own saved-document and composed-artifact digests. Separate
            TEST transitions record screening, curation, and one explicit human approval
            before this read model may say <strong>listed</strong>.
          </p>
          <dl className="dl">
            <dt>Item</dt>
            <dd>{pipeline.value.listed.itemId}</dd>
            <dt>Pipeline</dt>
            <dd>{pipeline.value.listed.pipelineState} · TEST only</dd>
            <dt>Recorded transitions</dt>
            <dd>{pipeline.value.listed.history.length}</dd>
            <dt>Document digest</dt>
            <dd>{pipeline.value.listed.listing.documentDigest}</dd>
            <dt>Asset-package digest</dt>
            <dd>{pipeline.value.listed.listing.assetPackage.contentHash}</dd>
          </dl>
          <p className="prose">
            This process-local proof record is not a public release. It represents no
            asset delivery, purchase, payout, legal or tax approval, deployment, Stripe
            LIVE, or Connect LIVE operation.
          </p>
        </>
      ) : (
        <p className="prose">The injected TEST pipeline refused, so no listing projection is shown.</p>
      )}
    </section>
  );
}
