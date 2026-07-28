/**
 * What the storefront can truthfully say about its own catalogue.
 *
 * The accepted design's left rail is five filter groups with hand-written counts —
 * `Single sculpt 184`, `Studio 144`, `Under $20 146` — invented numbers attached to
 * checkboxes that filter nothing. Both halves fail here for the same reason: this
 * storefront lists the committed fixtures and nothing else, and a control whose
 * behaviour no contract defines is an affordance the site cannot honour.
 *
 * The rail's shape survives, filled from the listings actually on the page. Every count
 * is a count of real records, so the rail is a description of the catalogue rather than
 * a promise about it, and it goes stale only when the fixtures do.
 */
import type { CatalogItem, PipelineState, SiteListing } from "@sceneaxi/site-kit";

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

const priceMode = (listing: SiteListing): string => {
  const { credits, money } = listing.price;
  if (credits !== null && money !== null) return "Credits or money";
  if (credits !== null) return "Credits only";
  if (money !== null) return "Money only";
  return "No price recorded";
};

/**
 * The rail's facets, in the design's order: what it is, how it is licensed, what it
 * targets, how it is priced, how it was reviewed.
 *
 * A facet with no rows is dropped rather than rendered empty, so an emptied catalogue
 * shows a short rail instead of five headings over nothing.
 */
export function catalogFacets(listings: readonly SiteListing[]): readonly CatalogFacet[] {
  const facets: readonly CatalogFacet[] = [
    { title: "Licence", rows: tally(listings.map((l) => l.item.rights.license)) },
    {
      title: "Profile",
      rows: tally(listings.flatMap((l) => [...l.item.compatibility.profiles])),
    },
    { title: "Pricing", rows: tally(listings.map(priceMode)) },
    {
      title: "Curation",
      rows: tally(listings.map((l) => l.item.moderation.pipelineState)),
    },
    {
      title: "AI disclosure",
      rows: tally(
        listings.map((l) =>
          l.item.aiGenerationDisclosure.aiGenerated ? "AI-generated" : "Not AI-generated",
        ),
      ),
    },
  ];
  return Object.freeze(facets.filter((facet) => facet.rows.length > 0));
}

export type CurationStep = {
  /** `01`, `02`, … the way the design numbers its provenance rows. */
  readonly ordinal: string;
  readonly state: PipelineState;
  readonly reason: string;
  readonly at: string;
};

/**
 * The item's curation record as an ordered trail.
 *
 * This is the honest occupant of the design's "Build passes" table: same five-ish
 * numbered rows ending in a verified state, except the rows are the transitions the
 * contract actually recorded, with their real reasons and timestamps.
 */
export function curationTrail(item: CatalogItem): readonly CurationStep[] {
  return Object.freeze(
    item.moderation.history.map((record, index) =>
      Object.freeze({
        ordinal: String(index + 1).padStart(2, "0"),
        state: record.to,
        reason: record.reason,
        at: record.at,
      }),
    ),
  );
}

/**
 * Other listings by the same creator on this surface — the design's "From the same
 * studio" row, with no cross-surface reach and no invented neighbours.
 */
export function sameCreatorListings(
  listings: readonly SiteListing[],
  current: SiteListing,
): readonly SiteListing[] {
  return Object.freeze(
    listings.filter(
      (listing) =>
        listing.itemId !== current.itemId && listing.creatorId === current.creatorId,
    ),
  );
}
