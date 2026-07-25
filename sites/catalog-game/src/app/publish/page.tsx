import { CREATOR_SHARE_ROUNDING_NOTE, CREATOR_SHARE_RULE, createPublishIntent, submitPublishIntent } from "@sceneaxi/site-kit";
import { CATALOG_SITE_BRAND, CATALOG_SITE_SURFACE } from "../../lib/site-config.js";
import { StatePanel } from "../_components/state-panel.js";

/**
 * The creator publish surface.
 *
 * Display-only: it shows the share rule and a worked example of what a listing would
 * pay, then refuses submission with the pipeline's own reason. Publishing to a live
 * marketplace is an open captain decision, and this page does not pre-empt it.
 */
export default function PublishPage() {
  const example = createPublishIntent({
    creatorId: "your-account",
    surface: CATALOG_SITE_SURFACE,
    title: "Your asset",
    price: { credits: 100, money: { amount: "10.00", currency: "usd" } },
  });
  const refusal = example.ok ? submitPublishIntent(example.value) : null;

  return (
    <>
      <p className="eyebrow">For creators</p>
      <h1>Sell your work on {CATALOG_SITE_BRAND.name}</h1>
      <p className="lede">
        List a sculpt artifact or a composed scene, price it in credits or money, and
        keep {CREATOR_SHARE_RULE.creatorPercent}% of the credits on every sale.
      </p>

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
        <p>The share preview is unavailable for this example.</p>
      )}
      <p>{CREATOR_SHARE_RULE.note}</p>
      <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>
        {CREATOR_SHARE_ROUNDING_NOTE}
      </p>

      <h2>What listing requires</h2>
      <ul>
        <li>A sculpt artifact whose evidence matches its spec bytes.</li>
        <li>A licence, a named rights holder, and whether commercial use is allowed.</li>
        <li>Provenance: where the asset came from and its content hash.</li>
        <li>An AI-generation disclosure, whether or not AI was involved.</li>
        <li>Compatibility: the core range and the profiles it targets.</li>
      </ul>
      <p>
        Every listing on this storefront passes intake, screening, and curation with a
        recorded human verdict before it appears. That is why the metadata on each detail
        page is complete rather than optional.
      </p>

      <StatePanel
        tone="warn"
        title="Publishing is not open yet"
        reason={refusal?.reason}
      >
        <p>{refusal?.message ?? "Marketplace publishing is not activated."}</p>
        <p>
          Nothing here accepts an upload or a payout detail. When activation opens,
          publishing and payouts run through the shared account plane rather than a
          storefront-local form.
        </p>
      </StatePanel>
    </>
  );
}
