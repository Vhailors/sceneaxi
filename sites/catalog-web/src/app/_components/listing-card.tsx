import { describeListingPrice, type SiteListing } from "@sceneaxi/site-kit";
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
  const steps = listing.item.moderation.history.length;
  const chips = compact
    ? []
    : [
        ...listing.item.compatibility.profiles.map((profile) => ({
          key: `profile-${profile}`,
          label: profile,
        })),
        {
          key: "state",
          label: listing.item.moderation.pipelineState,
          tone: "ok" as const,
        },
      ];

  return (
    <li className="card">
      <a className="card-link" href={`/item/${listing.itemId}`}>
        <DigestFigure
          digest={listing.item.assetPackage.contentHash}
          chips={chips}
          steps={steps}
          stepsLabel={`${steps} recorded curation transitions`}
        />
        <span className="card-head">
          <span className="card-name">{listing.title}</span>
          <span className="card-price">
            {price.ok ? price.value.label : `unpriced (${price.reason})`}
          </span>
        </span>
        {!compact && (
          <span className="card-meta">
            <span className="card-author">by {listing.creatorId}</span>
            <span className="card-licence">{listing.item.rights.license}</span>
          </span>
        )}
      </a>
    </li>
  );
}
