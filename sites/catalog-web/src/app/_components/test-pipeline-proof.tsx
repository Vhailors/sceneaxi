/**
 * The labeled TEST editor-to-listing proof, shared by both storefronts.
 *
 * It prints only what the injected TEST pipeline returned for this surface: the state
 * intake actually recorded, the transitions actually stored, and the digests the
 * validated record is bound to. A refusal renders the refusal line instead of a
 * listing projection, because a proof this page cannot obtain is not one it may draw.
 *
 * The four states are step cards in the order the projection records them. Each card's
 * state, reason, time and human verdict are the stored record's own; a digest is printed
 * shortened, with the full value in `title`, never as a raw hash in the running text.
 */
import type { CatalogPipelineReadModel, SiteResult } from "@sceneaxi/site-kit";
import { shortenDigest } from "../../lib/digest-sigil.js";

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
      <div className="section-head">
        <h2>TEST editor-to-listing proof</h2>
        {pipeline.ok && pipeline.value.listed.listing !== null ? (
          <p className="prose">
            A real render of the fixed editor state enters{" "}
            <strong>{pipeline.value.intake.pipelineState}</strong> with no history, carrying
            that render&rsquo;s own saved-document and composed-artifact digests. Separate
            TEST transitions record screening, curation, and one explicit human approval
            before this read model may say <strong>listed</strong>.
          </p>
        ) : (
          <p className="prose">
            The injected TEST pipeline refused, so no listing projection is shown.
          </p>
        )}
      </div>
      {pipeline.ok && pipeline.value.listed.listing !== null && (
        <>
          <ol className="flow">
            <li className="flow-step">
              <span className="flow-head">
                <span className="flow-num" />
                <span className="chip">recorded</span>
              </span>
              <h3 className="flow-state">{pipeline.value.intake.pipelineState}</h3>
              <p className="flow-note">
                Read back with {pipeline.value.intake.history.length} stored transitions.
              </p>
              <p className="flow-at">
                document{" "}
                <code title={pipeline.value.intake.documentDigest}>
                  {shortenDigest(pipeline.value.intake.documentDigest)}
                </code>
                {" · "}artifact{" "}
                <code title={pipeline.value.intake.artifactDigest}>
                  {shortenDigest(pipeline.value.intake.artifactDigest)}
                </code>
              </p>
            </li>
            {pipeline.value.listed.history.map((record) => (
              <li className="flow-step" key={`${record.from}-${record.to}`}>
                <span className="flow-head">
                  <span className="flow-num" />
                  {record.to === pipeline.value.listed.pipelineState ? (
                    <span className="chip chip-accent">{pipeline.value.listed.mode}</span>
                  ) : (
                    <span className="chip">recorded</span>
                  )}
                </span>
                <h3 className="flow-state">{record.to}</h3>
                <p className="flow-note">{record.reason}</p>
                <p className="flow-at">
                  {record.humanVerdict !== undefined && (
                    <>
                      verdict {record.humanVerdict.decision} ·{" "}
                      {record.humanVerdict.curatorId}
                      <br />
                    </>
                  )}
                  <time dateTime={record.at}>{record.at}</time>
                </p>
              </li>
            ))}
          </ol>
          <dl className="dl">
            <dt>Item</dt>
            <dd>{pipeline.value.listed.itemId}</dd>
            <dt>Pipeline</dt>
            <dd>{pipeline.value.listed.pipelineState} · TEST only</dd>
            <dt>Recorded transitions</dt>
            <dd>{pipeline.value.listed.history.length}</dd>
            <dt>Document digest</dt>
            <dd>
              <code title={pipeline.value.listed.listing.documentDigest}>
                {shortenDigest(pipeline.value.listed.listing.documentDigest)}
              </code>
            </dd>
            <dt>Asset-package digest</dt>
            <dd>
              <code title={pipeline.value.listed.listing.assetPackage.contentHash}>
                {shortenDigest(pipeline.value.listed.listing.assetPackage.contentHash)}
              </code>
            </dd>
          </dl>
          <p className="prose">
            This process-local proof record is not a public release. It represents no
            asset delivery, purchase, payout, legal or tax approval, deployment, Stripe
            LIVE, or Connect LIVE operation.
          </p>
        </>
      )}
    </section>
  );
}
