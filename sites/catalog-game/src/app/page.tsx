import type { Metadata } from "next";
import {
  CREATOR_SHARE_ROUNDING_NOTE,
  CREATOR_SHARE_RULE,
  SITE_CATALOG_MODE,
  listSiteCatalog,
  browseSiteCatalog,
  type SearchParams,
} from "@sceneaxi/site-kit";
import { CATALOG_SITE_BRAND, CATALOG_SITE_SURFACE, catalogCanonical } from "../lib/site-config.js";
import { catalogFacets } from "../lib/catalog-facts.js";
import { ListingCard } from "./_components/listing-card.js";
import { LeadPlate } from "./_components/listing-tile.js";
import { PublishSlot } from "./_components/publish-slot.js";
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
 * The browse page — the hero and its lead record, the facts strip, then the design's
 * rail-and-grid.
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
      <button type="submit" aria-controls={refused ? undefined : "catalogue"}>Apply filters</button> <a href="/">Clear filters</a>
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
  const lead = featured[0];

  const word =
    listings.length === 1
      ? CATALOG_SITE_BRAND.listingWord
      : CATALOG_SITE_BRAND.listingWordPlural;

  const priceModes = facets.find((facet) => facet.title === "Pricing")?.rows ?? [];

  return (
    <>
      <section className="hero">
        <div className="shell hero-inner">
          <div className="hero-copy">
            <p className="kicker">
              <span className="kicker-dot" aria-hidden="true" />
              {CATALOG_SITE_BRAND.heroKicker}
            </p>
            <h1>{CATALOG_SITE_BRAND.tagline}</h1>
            <p className="lede">{CATALOG_SITE_BRAND.audience}</p>
            <div className="hero-actions">
              <a className="button button-xl" href="#catalogue">
                {CATALOG_SITE_BRAND.heroCta}
                <span className="glyph glyph-nudge" aria-hidden="true">
                  →
                </span>
              </a>
              <a className="button button-xl button-quiet" href="#pricing">
                {CATALOG_SITE_BRAND.heroSecondaryCta}
              </a>
            </div>
          </div>

          {lead !== undefined && (
            <div className="hero-plate">
              <h2 className="sr-only">
                In the {CATALOG_SITE_BRAND.catalogueWord.toLowerCase()} now
              </h2>
              <ul className="hero-plates">
                {featured.map((listing) => <li key={listing.itemId}><LeadPlate listing={listing} /></li>)}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="facts">
        <div className="shell">
          <h2 className="sr-only">At a glance</h2>
          <ul className="facts-list">
            <li className="fact">
              <span className="fact-value">{listings.length}</span>
              <span className="fact-label">
                {word} in this {CATALOG_SITE_BRAND.catalogueWord.toLowerCase()}
              </span>
            </li>
            <li className="fact">
              <span className="fact-value">{priceModes.length}</span>
              <span className="fact-label">
                price {priceModes.length === 1 ? "mode" : "modes"} ·{" "}
                {priceModes.map((row) => row.name.toLowerCase()).join(", ")}
              </span>
            </li>
            <li className="fact">
              <span className="fact-value">{CREATOR_SHARE_RULE.creatorPercent}%</span>
              <span className="fact-label">creator share</span>
            </li>
            <li className="fact">
              <span className="fact-value">{SITE_CATALOG_MODE.toUpperCase()} mode</span>
              <span className="fact-label">purchases refuse by name</span>
            </li>
          </ul>
        </div>
      </section>

      <div className="shell browse">
        <aside className="rail" aria-label="What this catalogue holds" tabIndex={0}>
            <p className="prose">All inventory · {inventory.length} fixture records. Counts do not change with filters.</p>
          {facets.map((facet) => (
            <div className="rail-group" key={facet.title}>
              <h2 className="rail-title">{facet.title}</h2>
              <ul className="rail-list">
                {facet.rows.map((row) => (
                  <li
                    className="rail-row"
                    key={row.name}
                    style={
                      // SAFETY: the object sets one custom property, which React's
                      // CSSProperties type does not model; the value is a plain number.
                      { "--share": String(inventory.length === 0 ? 0 : row.count / inventory.length) } as React.CSSProperties
                    }
                  >
                    <span className="rail-name">{row.name}</span>
                    <span className="rail-count">{row.count}</span>
                    <span className="rail-bar" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rail-note">
            <p>Every {CATALOG_SITE_BRAND.listingWord} is a committed fixture record</p>
            <p>
              Price mode, seller, publication time, TEST mode, and availability come from
              the validated catalog-listing contract. Asset payload, licence, preview,
              compatibility, and delivery are not in that fixture and are not implied here.
            </p>
          </div>
        </aside>

        <div className="results">
            {renderSearchControls()}
            {listings.length === 0 && <section role="status" aria-labelledby="catalog-empty"><h2 id="catalog-empty">{inventory.length === 0 ? "No listings in this catalogue yet" : "No matching listings"}</h2><p>{inventory.length === 0 ? "There are no committed fixture records on this surface. Asset delivery and purchases remain unavailable." : "Try a different title, item ID, creator or price mode."}</p>{inventory.length > 0 && <a href="/">Clear filters</a>}</section>}
          <div className="results-head" id="catalogue" role="status" aria-live="polite" aria-atomic="true">
            <p className="results-count">
              {listings.length} <span className="results-word">{word}</span>
            </p>
            <p className="results-surface">
              on the {CATALOG_SITE_SURFACE.replace("catalog-", "")} surface
            </p>
          </div>

          <ul className="cards">
            {listings.map((listing) => (
              <ListingCard listing={listing} key={listing.itemId} />
            ))}
            <PublishSlot />
          </ul>

          <p className="grid-note">
            Each card is marked with a figure derived from the validated listing record.
            It is a mark of the record digest, not a render of the asset — the fixture
            carries no asset payload or preview.
          </p>

          <section className="pricing" id="pricing" aria-labelledby="pricing-title">
            <div className="pricing-copy">
              <h2 id="pricing-title">{CATALOG_SITE_BRAND.heroSecondaryCta}</h2>
              <p className="lede">
                A {CATALOG_SITE_BRAND.listingWord} may be priced in credits, money, or both.
                The display keeps the seller&apos;s choice exactly; it does not convert
                currencies. Creators receive {CREATOR_SHARE_RULE.creatorPercent}% in the
                established share model.
              </p>
            </div>
            <div className="share">
              <p className="share-figure">
                <span className="share-num">{CREATOR_SHARE_RULE.creatorPercent}%</span>
                <span className="share-label">creator share</span>
              </p>
              <p className="mono-note">{CREATOR_SHARE_ROUNDING_NOTE}</p>
            </div>
          </section>

          <StatePanel tone="warn" title="TEST catalog · purchases refuse here">
            <p>
              These are committed TEST fixture listings. Browse and detail are available;
              asset delivery and payment completion are not. The catalog sites own no
              billing stack, collect no payment details, and cannot report a purchase as
              complete.
            </p>
          </StatePanel>
        </div>
      </div>
    </>
  );
}
