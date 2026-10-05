import type { Metadata } from "next";
import {
  CREATOR_SHARE_ROUNDING_NOTE,
  CREATOR_SHARE_RULE,
  listSiteCatalog,
  browseSiteCatalog,
  type SearchParams,
} from "@sceneaxi/site-kit";
import { CATALOG_SITE_BRAND, CATALOG_SITE_SURFACE, catalogCanonical } from "../lib/site-config.js";
import { catalogFacets } from "../lib/catalog-facts.js";
import { FormBusy } from "./_components/form-busy.js";
import { ListingCard } from "./_components/listing-card.js";
import { ListingTile } from "./_components/listing-tile.js";
import { StatePanel } from "./_components/state-panel.js";

function isSearchText(value: SearchParams[string]): value is string {
  return typeof value === "string";
}

export function generateMetadata(): Metadata {
  const canonical = catalogCanonical(process.env, "/");

  return canonical === null ? {} : { alternates: { canonical } };
}

/** The design leads with four hero tiles; the catalogue fills as many as it has. */
const HERO_TILES = 4;

/**
 * The browse page — hero band, then the design's rail-and-grid.
 *
 * The archive's rail is five filter groups of hand-written counts wired to checkboxes
 * that filter nothing, and its results header carries a sort control and a nine-page
 * pager. None of that ships: every count here is a count of the full committed inventory,
 * and no control appears whose behaviour a contract does not already define. What
 * survives is the layout, which is the part the design was right about.
 */
export default async function CataloguePage({ searchParams }: { readonly searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  // Keep scalar URL state only: repeated or unsupported values are never silently accepted.
  const searchText = isSearchText(params.q) && params.q.length <= 100 ? params.q : "";
  const priceMode = isSearchText(params.price) && ["credits", "money", "credits-and-money"].includes(params.price) ? params.price : "";
  const sort = isSearchText(params.sort) && ["inventory", "title", "newest"].includes(params.sort) ? params.sort : "inventory";
  const renderSearchControls = (refused = false) => (
    <form className="catalog-controls" method="get" action="/" aria-label="Search and filter catalog">
      <label htmlFor="catalog-search">Title, item ID or creator</label>
      <input id="catalog-search" name="q" type="search" maxLength={100} aria-describedby="catalog-search-help" defaultValue={searchText} />
      <p id="catalog-search-help">Search titles, item IDs and creators. Up to 100 characters; filters apply together.</p>
      <label htmlFor="catalog-price">Price mode</label>
      <select id="catalog-price" name="price" defaultValue={priceMode}>
        <option value="">All price modes</option><option value="credits">Credits</option><option value="money">Money</option><option value="credits-and-money">Credits and money</option>
      </select>
      <label htmlFor="catalog-sort">Sort</label>
      <select id="catalog-sort" name="sort" defaultValue={sort}>
        <option value="inventory">Inventory order</option><option value="title">Title</option><option value="newest">Newest</option>
      </select>
      <button className="button button-quiet" type="submit" aria-controls={refused ? undefined : "catalogue"}>Apply filters</button> <a href="/">Clear filters</a>
      <FormBusy />
    </form>
  );
  let listings: ReturnType<typeof listSiteCatalog>;

  try { listings = browseSiteCatalog(CATALOG_SITE_SURFACE, params); }
  catch (error) {
    // Only a confirmed invalid query is recoverable here. Real failures reach error.tsx.
    if (!(error instanceof Error) || error.message !== "CATALOG_BROWSE_QUERY_INVALID") throw error;
    return <StatePanel tone="deny" title="Browse query refused" reason="CATALOG_BROWSE_QUERY_INVALID"><p>Use a single bounded search, price mode and supported sort. Unsupported values have been reset below; no purchase was made.</p>{renderSearchControls(true)}</StatePanel>;
  }

  const inventory = listSiteCatalog(CATALOG_SITE_SURFACE);
  const facets = catalogFacets(inventory);
  const featured = listings.slice(0, HERO_TILES);

  const word =
    listings.length === 1
      ? CATALOG_SITE_BRAND.listingWord
      : CATALOG_SITE_BRAND.listingWordPlural;

  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="shell hero-inner">
          <div className="hero-copy">
            <h1 id="hero-heading">{CATALOG_SITE_BRAND.tagline}</h1>
            <p className="lede">{CATALOG_SITE_BRAND.audience}</p>
            <div className="hero-actions">
              <a className="button button-lg" href="#catalogue">
                {CATALOG_SITE_BRAND.heroCta}
              </a>
              <a className="button button-quiet button-lg" href="#pricing">
                {CATALOG_SITE_BRAND.heroSecondaryCta}
              </a>
            </div>
            <StatePanel tone="warn" level={2} title="TEST catalog · purchases refuse here">
              <p>
                These are committed TEST fixture listings. Browse and detail are available;
                asset delivery and payment completion are not. The catalog sites own no
                billing stack, collect no payment details, and cannot report a purchase as
                complete.
              </p>
            </StatePanel>
          </div>

          <div className="hero-shelf">
            <h2 className="sr-only">In the catalogue now</h2>
            <ul className="hero-tiles" data-count={featured.length}>
              {featured.map((listing) => (
                <ListingTile listing={listing} key={listing.itemId} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="shell browse">
        <aside className="rail" aria-label="What this catalogue holds" tabIndex={0}>
          <h2 className="rail-heading">All inventory</h2>
          <p className="rail-intro">{inventory.length} fixture records. Counts do not change with filters.</p>
          {facets.map((facet) => (
            <div className="rail-group" key={facet.title}>
              <h2 className="rail-title">{facet.title}</h2>
              <ul className="rail-list">
                {facet.rows.map((row) => (
                  <li className="rail-row" key={row.name}>
                    <span className="rail-name">{row.name}</span>
                    <span className="rail-count">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rail-note">
            <p>
              <strong>Every listing is a committed fixture record</strong>
            </p>
            <p>
              Price mode, seller, publication time, TEST mode, and availability come from
              the validated catalog-listing contract. Asset payload, licence, preview,
              compatibility, and delivery are not in that fixture and are not implied here.
            </p>
          </div>
        </aside>

        <div className="results">
          {renderSearchControls()}
          {listings.length === 0 && (
            <section className="results-empty" role="status" aria-labelledby="catalog-empty">
              <h2 id="catalog-empty">{inventory.length === 0 ? "No listings in this catalogue yet" : "No matching listings"}</h2>
              <p>{inventory.length === 0 ? "There are no committed fixture records on this surface. Asset delivery and purchases remain unavailable." : "Try a different title, item ID, creator or price mode."}</p>
              {inventory.length > 0 && <a href="/">Clear filters</a>}
            </section>
          )}
          <div className="results-head" id="catalogue" role="status" aria-live="polite" aria-atomic="true">
            <span>
              <span className="results-count">{listings.length}</span> {word}
            </span>
            <span>on the {CATALOG_SITE_SURFACE.replace("catalog-", "")} surface</span>
          </div>

          <ul className="cards" data-count={listings.length}>
            {listings.map((listing) => (
              <ListingCard listing={listing} key={listing.itemId} />
            ))}
          </ul>

          <p className="prose results-caption">
            Each card is marked with a figure derived from the validated listing record.
            It is a mark of the record digest, not a render of the asset — the fixture
            carries no asset payload or preview.
          </p>

          <section className="section results-notes" id="pricing" aria-labelledby="pricing-heading">
            <h2 id="pricing-heading">How pricing reads</h2>
            <p className="prose">
              A listing may be priced in credits, money, or both. The display keeps the
              seller&apos;s choice exactly; it does not convert currencies. Creators receive
              {" "}{CREATOR_SHARE_RULE.creatorPercent}% in the established share model.
            </p>
            <p className="reason">{CREATOR_SHARE_ROUNDING_NOTE}</p>
          </section>
        </div>
      </div>
    </>
  );
}
