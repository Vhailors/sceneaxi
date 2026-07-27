import { describeListingPrice, type SiteListing } from "@sceneaxi/site-kit";
import { DigestFigure } from "./digest-figure.js";

/**
 * A hero tile.
 *
 * The design fills this slot with four curated *collections* — "Depot collection, 42
 * assets" — which this storefront does not have: there is no collection in the Catalog
 * Item contract, and a count of 42 would be a number nobody could check. The tile shape
 * is kept and filled with listings the catalogue actually publishes.
 */
export function ListingTile({ listing }: { readonly listing: SiteListing }) {
  const price = describeListingPrice(listing.price);

  return (
    <li>
      <a className="tile" href={`/item/${listing.itemId}`}>
        <DigestFigure
          digest={listing.item.assetPackage.contentHash}
          chips={[
            {
              key: "state",
              label: listing.item.moderation.pipelineState,
              tone: "ok" as const,
            },
          ]}
        />
        <span className="tile-name">{listing.title}</span>
        <span className="tile-meta">
          {price.ok ? price.value.label : `unpriced (${price.reason})`} ·{" "}
          {listing.item.rights.license}
        </span>
      </a>
    </li>
  );
}
