import { describeListingPrice, type SiteListing } from "@sceneaxi/site-kit";
import { DigestFigure } from "./digest-figure.js";
import { ListingPrice } from "./listing-card.js";

/**
 * The hero's lead record plate.
 *
 * The design fills the hero with four curated *collections* — "Depot collection, 42
 * assets" — which this storefront does not have: there is no collection in the Catalog
 * Item contract, and a count of 42 would be a number nobody could check. The hero leads
 * with one listing the catalogue actually publishes instead, shown as what it is: the
 * record mark of its digest, with the record's own TEST and availability chips, an
 * on-plate legend, and a caption with its title and committed price.
 */
export function LeadPlate({ listing }: { readonly listing: SiteListing }) {
  return (
    <a className="lead" href={`/item/${listing.itemId}`}>
      <DigestFigure
        digest={listing.recordDigest}
        variant="lead"
        chips={[
          {
            key: "mode",
            label: listing.availability.mode.toUpperCase(),
            tone: "accent" as const,
          },
          { key: "availability", label: listing.availability.asset },
        ]}
      />
      <span className="lead-caption">
        <span className="lead-title">{listing.title}</span>
        <ListingPrice price={describeListingPrice(listing.price)} />
      </span>
    </a>
  );
}
