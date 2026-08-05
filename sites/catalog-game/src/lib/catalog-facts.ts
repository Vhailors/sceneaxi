/** Honest, contract-derived facts shared by the two storefront presentations. */
import type { SiteListing } from "@sceneaxi/site-kit";

export type CatalogFacetRow = {
  readonly name: string;
  readonly count: number;
};

export type CatalogFacet = {
  readonly title: string;
  readonly rows: readonly CatalogFacetRow[];
};

/** Group into stable insertion order, so the rail does not reshuffle between builds. */
function tally(values: readonly string[]): readonly CatalogFacetRow[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.freeze([...counts].map(([name, count]) => Object.freeze({ name, count })));
}

const priceModeLabel = (listing: SiteListing) => {
  if (listing.priceMode === "credits-and-money") return "Credits or money";
  if (listing.priceMode === "credits") return "Credits only";
  return "Money only";
};

/** Counts only facts carried by the committed listing records. */
export function catalogFacets(listings: readonly SiteListing[]): readonly CatalogFacet[] {
  const facets: readonly CatalogFacet[] = [
    { title: "Pricing", rows: tally(listings.map(priceModeLabel)) },
    { title: "Seller", rows: tally(listings.map((listing) => listing.creatorId)) },
    { title: "Mode", rows: tally(listings.map((listing) => listing.availability.mode.toUpperCase())) },
    {
      title: "Asset availability",
      rows: tally(listings.map((listing) => listing.availability.asset)),
    },
    {
      title: "Purchase",
      rows: tally(listings.map((listing) => listing.availability.purchase)),
    },
  ];
  return Object.freeze(facets.filter((facet) => facet.rows.length > 0));
}

export type ListingRecordRow = {
  readonly label: string;
  readonly value: string;
};

/** The complete non-price record the fixture contract makes available to a detail page. */
export function listingRecord(listing: SiteListing): readonly ListingRecordRow[] {
  return Object.freeze([
    Object.freeze({ label: "Schema", value: `${listing.listing.kind} v${listing.listing.schemaVersion}` }),
    Object.freeze({ label: "Catalog", value: listing.listing.catalog }),
    Object.freeze({ label: "Seller", value: listing.listing.sellerUserId }),
    Object.freeze({ label: "Published", value: listing.listing.publishedAt }),
    Object.freeze({ label: "Price mode", value: listing.listing.priceMode }),
    Object.freeze({ label: "Fixture mode", value: listing.availability.mode }),
    Object.freeze({ label: "Asset payload", value: listing.availability.asset }),
    Object.freeze({ label: "Purchase", value: listing.availability.purchase }),
  ]);
}

/** Other listings by the same creator on this surface, never across catalogs. */
export function sameCreatorListings(
  listings: readonly SiteListing[],
  current: SiteListing,
): readonly SiteListing[] {
  return Object.freeze(
    listings.filter(
      (listing) =>
        listing.itemId !== current.itemId &&
        listing.creatorId === current.creatorId &&
        listing.surface === current.surface,
    ),
  );
}
