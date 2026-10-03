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
 * Display-only: it shows the share rule and a worked example of what a listing would pay,
 * a deterministic TEST intake/read-model demonstration, and then the pipeline's own
 * refusal. The requirements it lists are that unopened pipeline's, not fields this
 * storefront collects: the page collects nothing and owns no store or moderation
 * operator. Publishing to a live marketplace is an open captain decision, and this page
 * does not pre-empt it — which is also why the design's "Apply as a seller" button and
 * its payouts column are not here.
 */

/** The words this storefront says differently from its sibling; the rest is shared. */
const STORE_COPY = Object.freeze({
  eyebrow: "For creators",
  title: `Sell your work on ${CATALOG_SITE_BRAND.name}`,
  offer: "List a sculpt artifact or a composed scene, price it in credits or money,",
  requirementsTitle: "What listing will require",
  firstRequirement: "A sculpt artifact whose evidence matches its spec bytes.",
});

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
    <>
      <div className="shell publish-head">
        <div className="publish-copy">
          <p className="eyebrow">{STORE_COPY.eyebrow}</p>
          <h1>{STORE_COPY.title}</h1>
          <p className="lede">
            {STORE_COPY.offer} and keep {CREATOR_SHARE_RULE.creatorPercent}% of the credits
            on every sale.
          </p>
          <a className="button button-xl button-quiet" href="#requirements">
            {STORE_COPY.requirementsTitle}
          </a>
        </div>

        <section className="earn" aria-labelledby="earn-title">
          <h2 className="micro" id="earn-title">
            What you would earn
          </h2>
          {example.ok && example.value.share !== null ? (
            <dl className="earn-list">
              <div className="earn-row">
                <dt>Listed at</dt>
                <dd>
                  <span className="earn-num">{example.value.share.total}</span>
                  <span className="earn-unit">credits</span>
                </dd>
              </div>
              <div className="earn-row earn-lead">
                <dt>You receive</dt>
                <dd>
                  <strong className="earn-num">{example.value.share.creator}</strong>
                  <span className="earn-unit">credits</span>
                </dd>
              </div>
              <div className="earn-row">
                <dt>Platform receives</dt>
                <dd>
                  <span className="earn-num">{example.value.share.platform}</span>
                  <span className="earn-unit">credits</span>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="prose">The share preview is unavailable for this example.</p>
          )}
          <p className="note">{CREATOR_SHARE_RULE.note}</p>
          <p className="mono-note">{CREATOR_SHARE_ROUNDING_NOTE}</p>
        </section>
      </div>

      <div className="shell publish-flow">
        <section className="section req-section" id="requirements">
          <div className="section-head">
            <h2>{STORE_COPY.requirementsTitle}</h2>
            <p className="prose">
              These declarations are accepted only by the injected TEST editor-intake seam.
              This storefront collects none of them and has no production submission form.
            </p>
            <p className="prose">
              Intake, screening, and curation each record their own transition before a
              listing projection appears. The browse and detail routes still serve only the
              separate committed TEST fixture listing set.
            </p>
          </div>
          <ol className="req-list">
            <li className="req-row">{STORE_COPY.firstRequirement}</li>
            <li className="req-row">
              A licence, a named rights holder, and whether commercial use is allowed.
            </li>
            <li className="req-row">
              Provenance: where the asset came from and its content hash.
            </li>
            <li className="req-row">
              An AI-generation disclosure, whether or not AI was involved.
            </li>
            <li className="req-row">
              Compatibility: the core range and the profiles it targets.
            </li>
          </ol>
        </section>

        <TestPipelineProof pipeline={pipeline} />

      <StatePanel tone="warn" title="Production publishing is not open" reason={refusal?.reason}>
        <p>{refusal?.message ?? "Marketplace publishing is not activated."}</p>
        <p>
          Nothing here accepts an upload or payout detail. The TEST proof above has no
          persistent storage or production moderation operator; commerce remains inert. The shared durable TEST intake adapter stores submissions in quarantine, never automatically lists them. This deployment has not configured that private registry or authenticated declarations; no submission was saved by viewing this page.
        </p>
      </StatePanel>
    </div>
      </>
  );
}
