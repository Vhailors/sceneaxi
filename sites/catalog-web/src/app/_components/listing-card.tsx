import {
  CREATOR_SHARE_RULE,
  describeCreatorShare,
  describeListingPrice,
  type PriceDisplay,
  type SiteListing,
  type SiteResult,
} from "@sceneaxi/site-kit";
import { DigestFigure } from "./digest-figure.js";

/**
 * A listing's price as the shared display model words it.
 *
 * The lead side is set as a numeral and its unit, split out of the model's own string
 * ("40 credits", "12.00 USD"), so the word, its plural and the currency code are the
 * model's and never this component's; a listing offering both sides prints the money
 * side after it in mono. A listing the model cannot price keeps the model's refusal.
 */
export function ListingPrice({ price }: { readonly price: SiteResult<PriceDisplay> }) {
  if (!price.ok) return <span className="price">unpriced ({price.reason})</span>;

  const lead = price.value.credits ?? price.value.money ?? price.value.label;
  const split = lead.indexOf(" ");
  const numeral = split === -1 ? lead : lead.slice(0, split);
  const unit = split === -1 ? "" : lead.slice(split + 1);
  const alternative = price.value.credits === null ? null : price.value.money;

  return (
    <span className="price">
      <span className="price-num">{numeral}</span>
      {unit !== "" && <span className="price-unit">{unit}</span>}
      {alternative !== null && (
        <>
          <span className="price-or">or</span>
          <span className="price-alt">{alternative}</span>
        </>
      )}
    </span>
  );
}

/**
 * One listing card.
 *
 * The design's card carries a thumbnail, a kind badge, a triangle count, five pass bars,
 * a name/price row and an author/licence row. Every one of those slots is filled here
 * from the committed Catalog Listing contract or left out: the contract carries no
 * triangle count, licence, or build pass, so none of them appears on the card. The chips
 * carry the fixture's TEST mode and its metadata-only availability instead, and the plate
 * is the record mark of the listing's digest, never a preview.
 *
 * `compact` is the design's "From the same studio" variant: plate, name, price, seller.
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

  // The card prints the model's own price label ("40 credits or 4.00 USD") on one mono
  // line under the title; the lead plate keeps the split numeral form (`ListingPrice`).
  return (
    <li className={compact ? "card card-compact" : "card"}>
      <a className="card-link" href={`/item/${listing.itemId}`}>
        <DigestFigure digest={listing.recordDigest} chips={chips} />
        <span className="card-body">
          <span className="card-name">{listing.title}</span>
          <span className="card-price">{price.ok ? price.value.label : `unpriced (${price.reason})`}</span>
          <span className="card-meta">
            <span className="card-author">by {listing.creatorId}</span>
            {!compact && (
              <span className="chip">Creator {CREATOR_SHARE_RULE.creatorPercent}%</span>
            )}
          </span>
          {!compact && share.ok && <span className="card-share">{share.value.label}</span>}
          {listing.availability.purchase === "refused" && <span className="card-meta card-refusal">View details · purchases unavailable</span>}
        </span>
      </a>
    </li>
  );
}
