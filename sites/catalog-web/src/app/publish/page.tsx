import type { Metadata } from "next";
import {
  CREATOR_SHARE_ROUNDING_NOTE,
  CREATOR_SHARE_RULE,
  catalogTestPipelineDemo,
  createPublishIntent,
  submitPublishIntent,
} from "@sceneaxi/site-kit";
import { CATALOG_SITE_BRAND, CATALOG_SITE_SURFACE, catalogCanonical } from "../../lib/site-config.js";
import { StatePanel } from "../_components/state-panel.js";
import { TestPipelineProof } from "../_components/test-pipeline-proof.js";

export function generateMetadata(): Metadata {
  const canonical = catalogCanonical(process.env, "/publish");

  return canonical === null ? {} : { alternates: { canonical } };
}

/**
 * The creator publish surface.
 *
 * Display-only: it shows the share rule and a worked example of what a listing would
 * pay, then refuses submission with the pipeline's own reason. The requirements it lists
 * are that unopened pipeline's, not fields this showroom collects or displays — the
 * committed fixture record a detail page renders carries none of them. Publishing to a
 * live marketplace is an open captain decision, and this page does not pre-empt it —
 * which is also why the design's "Apply as a seller" button and its payouts column are
 * not here.
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
    <div className="shell page page-persuade">
      <div className="page-head">
        <h1>Submit a scene to {CATALOG_SITE_BRAND.name}</h1>
        <p className="tag">For studios and creators</p>
      </div>
      <p className="lede">
        Publish an interactive scene teams can drop into a page, price it in credits or
        money, and keep {CREATOR_SHARE_RULE.creatorPercent}% of the credits on every sale.
      </p>

      <section className="section" aria-labelledby="publish-earn-heading">
        <h2 id="publish-earn-heading">What you would earn</h2>
        {example.ok && example.value.share !== null ? (
          <p className="worked">
            <span className="worked-figure">{example.value.share.total} credits</span>
            <span className="worked-op" aria-hidden="true">→</span>
            <span className="sr-only">split into</span>
            <strong className="worked-figure">{example.value.share.creator} creator share</strong>
            <span className="worked-op">+</span>
            <span className="worked-figure">{example.value.share.platform} platform share</span>
          </p>
        ) : (
          <p className="prose">The share preview is unavailable for this example.</p>
        )}
        <p className="prose">{CREATOR_SHARE_RULE.note}</p>
        <p className="reason">{CREATOR_SHARE_ROUNDING_NOTE}</p>
      </section>

      <section className="section" id="requirements" aria-labelledby="publish-requirements-heading">
        <h2 id="publish-requirements-heading">What submission will require</h2>
        <p className="prose">
          These declarations are accepted only by the injected TEST editor-intake seam.
          This storefront collects none of them and has no production submission form.
        </p>
        <ol className="steps">
          <li>A composed scene whose artifacts each match their own spec bytes.</li>
          <li>A licence, a named rights holder, and whether commercial use is allowed.</li>
          <li>Provenance: where the asset came from and its content hash.</li>
          <li>An AI-generation disclosure, whether or not AI was involved.</li>
          <li>Compatibility: the core range and the profiles it targets.</li>
        </ol>
        <p className="prose">
          Intake, screening, and curation each record their own transition before a listing
          projection appears. The browse and detail routes still serve only the separate
          committed TEST fixture listing set.
        </p>
      </section>

      <TestPipelineProof pipeline={pipeline} />

      <StatePanel tone="deny" level={2} title="Production publishing is not open" reason={refusal?.reason}>
        <p>{refusal?.message ?? "Marketplace publishing is not activated."}</p>
        <p>
          Nothing here accepts an upload or payout detail. The TEST proof above has no
          persistent storage or production moderation operator; commerce remains inert. The shared durable TEST intake adapter stores submissions in quarantine, never automatically lists them. This deployment has not configured that private registry or authenticated declarations; no submission was saved by viewing this page.
        </p>
      </StatePanel>
    </div>
  );
}
