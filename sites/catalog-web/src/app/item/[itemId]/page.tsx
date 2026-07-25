import { notFound } from "next/navigation";
import { CREATOR_SHARE_ROUNDING_NOTE, creatorShare, describeListingPrice, showSiteListing } from "@sceneaxi/site-kit";
import { CATALOG_SITE_SURFACE, editorLinkFor } from "../../../lib/site-config.js";
import { CommerceNotice } from "../../_components/commerce-notice.js";
import { StatePanel } from "../../_components/state-panel.js";

/**
 * Scene detail.
 *
 * Leads with the scene and its price, then the contract record — rights, provenance,
 * AI-generation disclosure, compatibility, and curation history — because a marketing
 * team decides by look first and audits second. An unknown id answers 404 through the
 * contract's own named refusal.
 */
export default async function ItemPage({
  params,
}: {
  readonly params: Promise<{ readonly itemId: string }>;
}) {
  const { itemId } = await params;
  const found = showSiteListing(CATALOG_SITE_SURFACE, itemId);
  if (!found.ok) notFound();

  const listing = found.value;
  const price = describeListingPrice(listing.price);
  const share = listing.price.credits === null ? null : creatorShare(listing.price.credits);
  const link = editorLinkFor(process.env, listing.itemId);
  const { item } = listing;

  return (
    <>
      <p className="eyebrow">
        <a href="/">Catalogue</a> · {item.compatibility.profiles.join(", ")} profile
      </p>
      <h1>{listing.title}</h1>
      <p className="lede">{listing.summary}</p>

      <div className="actions">
        {link.ok ? (
          <a className="button" href={link.value}>
            Open in the SceneAxi editor
          </a>
        ) : (
          <span className="button" aria-disabled="true" title={link.message}>
            Editor link unavailable
          </span>
        )}
        <span className="listing-price">
          {price.ok ? price.value.label : `unpriced (${price.reason})`}
        </span>
      </div>

      {!link.ok && (
        <StatePanel tone="deny" title="No editor link for this deployment" reason={link.reason}>
          <p>{link.message}</p>
        </StatePanel>
      )}

      <h2>Price and creator share</h2>
      <dl className="dl">
        <dt>Credits</dt>
        <dd>{listing.price.credits ?? "not offered in credits"}</dd>
        <dt>Money</dt>
        <dd>
          {listing.price.money === null
            ? "not offered for money"
            : `${listing.price.money.amount} ${listing.price.money.currency.toUpperCase()}`}
        </dd>
        {share !== null && share.ok && (
          <>
            <dt>Creator receives</dt>
            <dd>
              {share.value.creator} of {share.value.total} credits
            </dd>
            <dt>Platform receives</dt>
            <dd>{share.value.platform} credits</dd>
          </>
        )}
      </dl>

      <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>
        {CREATOR_SHARE_ROUNDING_NOTE}
      </p>
      <h2>Rights</h2>
      <dl className="dl">
        <dt>Licence</dt>
        <dd>
          <code>{item.rights.license}</code>
        </dd>
        <dt>Rights holder</dt>
        <dd>{item.rights.rightsHolder}</dd>
        <dt>Commercial use</dt>
        <dd>{item.rights.commercialUseAllowed ? "allowed" : "not allowed"}</dd>
      </dl>

      <h2>Provenance</h2>
      <dl className="dl">
        <dt>Origin</dt>
        <dd>
          <code>{item.provenance.origin}</code>
        </dd>
        <dt>Ingested</dt>
        <dd>
          <code>{item.provenance.ingestedAt}</code>
        </dd>
        <dt>Source digest</dt>
        <dd>
          <code>{item.provenance.sourceDigest}</code>
        </dd>
        <dt>Package</dt>
        <dd>
          <code>{item.assetPackage.packageId}</code>
        </dd>
        <dt>Content hash</dt>
        <dd>
          <code>{item.assetPackage.contentHash}</code>
        </dd>
      </dl>

      <h2>AI generation disclosure</h2>
      <p>
        {item.aiGenerationDisclosure.aiGenerated
          ? "This asset was AI-generated."
          : "This asset was not AI-generated."}{" "}
        {item.aiGenerationDisclosure.disclosureText}
      </p>

      <h2>Compatibility</h2>
      <dl className="dl">
        <dt>Core range</dt>
        <dd>
          <code>{item.compatibility.coreRange}</code>
        </dd>
        <dt>Profiles</dt>
        <dd>
          <code>{item.compatibility.profiles.join(", ")}</code>
        </dd>
      </dl>

      <h2>Curation record</h2>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>At</th>
              <th className="wrap">Reason</th>
            </tr>
          </thead>
          <tbody>
            {item.moderation.history.map((record) => (
              <tr key={`${record.to}-${record.at}`}>
                <td>
                  <code>{record.to}</code>
                </td>
                <td>
                  <code>{record.at}</code>
                </td>
                <td className="wrap">{record.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>
        Current pipeline state: <code>{item.moderation.pipelineState}</code>
      </p>

      <CommerceNotice surface={CATALOG_SITE_SURFACE} itemId={listing.itemId} />
    </>
  );
}
