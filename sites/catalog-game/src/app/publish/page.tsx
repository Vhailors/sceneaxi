import {
  CREATOR_SHARE_ROUNDING_NOTE,
  CREATOR_SHARE_RULE,
  catalogTestPipelineDemo,
  createPublishIntent,
  submitPublishIntent,
} from "@sceneaxi/site-kit";
import { CATALOG_SITE_BRAND, CATALOG_SITE_SURFACE } from "../../lib/site-config.js";
import { StatePanel } from "../_components/state-panel.js";

/**
 * The creator publish surface.
 *
 * Display-only: it shows the share rule plus a deterministic TEST intake/read-model
 * demonstration. The page collects nothing and owns no store or moderation operator.
 */
export default async function PublishPage() {
  const example = createPublishIntent({
    creatorId: "your-account",
    surface: CATALOG_SITE_SURFACE,
    title: "Your asset",
    price: { credits: 100, money: { unitAmount: 1000, currency: "usd" } },
  });
  const refusal = example.ok ? submitPublishIntent(example.value) : null;
  const pipeline = await catalogTestPipelineDemo(CATALOG_SITE_SURFACE);

  return (
    <div className="shell page">
      <p className="eyebrow">For creators</p>
      <h1>Sell your work on {CATALOG_SITE_BRAND.name}</h1>
      <p className="lede">
        List a sculpt artifact or a composed scene, price it in credits or money, and
        keep {CREATOR_SHARE_RULE.creatorPercent}% of the credits on every sale.
      </p>

      <section className="section">
        <h2>What you would earn</h2>
        {example.ok && example.value.share !== null ? (
          <dl className="dl">
            <dt>Listed at</dt>
            <dd>{example.value.share.total} credits</dd>
            <dt>You receive</dt>
            <dd>
              <strong>{example.value.share.creator} credits</strong>
            </dd>
            <dt>Platform receives</dt>
            <dd>{example.value.share.platform} credits</dd>
          </dl>
        ) : (
          <p className="prose">The share preview is unavailable for this example.</p>
        )}
        <p className="prose">{CREATOR_SHARE_RULE.note}</p>
        <p className="reason">{CREATOR_SHARE_ROUNDING_NOTE}</p>
      </section>

      <section className="section" id="requirements">
        <h2>What listing will require</h2>
        <p className="prose">
          These declarations are accepted only by the injected TEST editor-intake seam.
          This storefront collects none of them and has no production submission form.
        </p>
        <ul className="bullets">
          <li>A sculpt artifact whose evidence matches its spec bytes.</li>
          <li>A licence, a named rights holder, and whether commercial use is allowed.</li>
          <li>Provenance: where the asset came from and its content hash.</li>
          <li>An AI-generation disclosure, whether or not AI was involved.</li>
          <li>Compatibility: the core range and the profiles it targets.</li>
        </ul>
        <p className="prose">
          Intake, screening, and curation each record their own transition before a listing
          projection appears. The browse and detail routes still serve only the separate
          committed TEST fixture listing set.
        </p>
      </section>

      <section className="section" id="test-pipeline">
        <h2>TEST editor-to-listing proof</h2>
        {pipeline.ok && pipeline.value.listed.listing !== null ? (
          <>
            <p className="prose">
              A fixed editor fixture enters <strong>{pipeline.value.intake.pipelineState}</strong>{" "}
              with no history. Separate TEST transitions record screening, curation, and
              one explicit human approval before this read model may say <strong>listed</strong>.
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

      <StatePanel tone="warn" title="Production publishing is not open" reason={refusal?.reason}>
        <p>{refusal?.message ?? "Marketplace publishing is not activated."}</p>
        <p>
          Nothing here accepts an upload or payout detail. The TEST proof above has no
          persistent storage or production moderation operator; commerce remains inert.
        </p>
      </StatePanel>
    </div>
  );
}
