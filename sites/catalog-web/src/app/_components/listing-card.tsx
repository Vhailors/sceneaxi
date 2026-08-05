import {
  CREATOR_SHARE_RULE,
  describeCreatorShare,
  describeListingPrice,
  type SiteListing,
} from "@sceneaxi/site-kit";
import { DigestFigure } from "./digest-figure.js";

/**
 * One listing card.
 *
 * The design's card carries a thumbnail, a kind badge, a triangle count, five pass bars,
 * a name/price row and an author/licence row. Every one of those slots is filled here
 * from the Catalog Item contract or left out: there is no triangle count in the contract,
 * so there is no triangle count on the card, and the pass bars are the item's recorded
 * curation transitions rather than five invented build passes.
 *
 * `compact` is the design's "From the same studio" variant: figure, name, price.
 */
export function ListingCard({
  listing,
  compact = false,
}: {
  readonly listing: SiteListing;
  readonly compact?: boolean;
}) {
  const price = describeListingPrice(listing.price);
  const share = describeCreatorShare(listing.price);
  const chips = compact
    ? []
    : [
        {
          key: "mode",
          label: listing.availability.mode.toUpperCase(),
          tone: "accent" as const,
        },
        { key: "availability", label: listing.availability.asset },
      ];

  return (
    <li className="card">
      <a className="card-link" href={`/item/${listing.itemId}`}>
        <DigestFigure
          digest={listing.recordDigest}
          chips={chips}
        />
        <span className="card-head">
          <span className="card-name">{listing.title}</span>
          <span className="card-price">
            {price.ok ? price.value.label : `unpriced (${price.reason})`}
          </span>
        </span>
        <span className="card-meta">
          <span className="card-author">by {listing.creatorId}</span>
          <span className="card-licence">
            Creator {CREATOR_SHARE_RULE.creatorPercent}%
          </span>
        </span>
        {!compact && share.ok && <span className="card-meta">{share.value.label}</span>}
      </a>
    </li>
  );
}
