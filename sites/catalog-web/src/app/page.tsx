import { CREATOR_SHARE_ROUNDING_NOTE, CREATOR_SHARE_RULE, describeListingPrice, listSiteCatalog } from "@sceneaxi/site-kit";
import { CATALOG_SITE_BRAND, CATALOG_SITE_SURFACE, editorLinkFor } from "../lib/site-config.js";
import { StatePanel } from "./_components/state-panel.js";

export default function ShowroomPage() {
  const listings = listSiteCatalog(CATALOG_SITE_SURFACE);

  return (
    <>
      <p className="eyebrow">Website assets · curated for the Web Experience profile</p>
      <h1>{CATALOG_SITE_BRAND.tagline}</h1>
      <p className="lede">{CATALOG_SITE_BRAND.audience}</p>

      <div className="listings">
        {listings.map((listing) => {
          const price = describeListingPrice(listing.price);
          const link = editorLinkFor(process.env, listing.itemId);
          return (
            <article className="listing" key={listing.itemId}>
              <h3>
                <a href={`/item/${listing.itemId}`}>{listing.title}</a>
              </h3>
              <p>{listing.summary}</p>
              <p className="listing-price">
                {price.ok ? price.value.label : `unpriced (${price.reason})`}
              </p>
              <div className="listing-foot">
                <span>
                  by <strong>{listing.creatorId}</strong>
                </span>
                <span>·</span>
                <span>{listing.item.rights.license}</span>
                {link.ok && (
                  <>
                    <span>·</span>
                    <a href={link.value}>Open in editor</a>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <h2>How pricing reads</h2>
      <p>
        A scene may be priced in credits, in money, or both — you pick at purchase.
        Creators receive {CREATOR_SHARE_RULE.creatorPercent}% of the credits on a sale.
      </p>
      <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>
        {CREATOR_SHARE_ROUNDING_NOTE}
      </p>

      <StatePanel tone="warn" title="This showroom is evaluation-only for now">
        <p>
          Every scene here is a curated fixture carrying real rights, provenance, and
          AI-disclosure metadata, so legal and brand review can happen before purchasing
          opens. Buying is not activated, and nothing on this site collects payment
          details.
        </p>
      </StatePanel>
    </>
  );
}
