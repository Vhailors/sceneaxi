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
import { ListingCard } from "./_components/listing-card.js";
import { ListingTile } from "./_components/listing-tile.js";
import { StatePanel } from "./_components/state-panel.js";

export function generateMetadata(): Metadata {
  const canonical = catalogCanonical(process.env, "/");

  return canonical === null ? {} : { alternates: { canonical } };
}

/** The design leads with four hero tiles; the showroom fills as many as it has. */
const HERO_TILES = 4;

/**
 * The showroom page — hero band, then the design's rail-and-grid.
 *
 * The archive's rail is five filter groups of hand-written counts wired to checkboxes
 * that filter nothing, and its results header carries a sort control and a nine-page
 * pager. None of that ships: every count here is a count of the scenes on this page,
 * and no control appears whose behaviour a contract does not already define. What
 * survives is the layout, which is the part the design was right about.
 */
export default async function ShowroomPage({ searchParams }: { readonly searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  let listings: ReturnType<typeof listSiteCatalog>;

  try { listings = browseSiteCatalog(CATALOG_SITE_SURFACE, params); }
  catch { return <StatePanel tone="deny" title="Browse query refused" reason="CATALOG_BROWSE_QUERY_INVALID"><p>Use a single bounded search, price mode and supported sort.</p><a href="/">Clear filters</a></StatePanel>; }

  const facets = catalogFacets(listings);
  const featured = listings.slice(0, HERO_TILES);

  const word =
    listings.length === 1
      ? CATALOG_SITE_BRAND.listingWord
      : CATALOG_SITE_BRAND.listingWordPlural;

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
              <a className="button" href="#catalogue">
                {CATALOG_SITE_BRAND.heroCta}
              </a>
              <a className="button button-quiet" href="#pricing">
                {CATALOG_SITE_BRAND.heroSecondaryCta}
              </a>
            </div>
          </div>

          <div>
            <h2 className="sr-only">In the showroom now</h2>
            <ul className="hero-tiles">
              {featured.map((listing) => (
                <ListingTile listing={listing} key={listing.itemId} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="shell browse">
        <aside className="rail" aria-label="What this showroom holds" tabIndex={0}>
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
              <strong>Every scene is a committed fixture record</strong>
            </p>
            <p>
              Price mode, seller, publication time, TEST mode, and availability come from
              the validated catalog-listing contract. Asset payload, licence, preview,
              compatibility, and delivery are not in that fixture and are not implied here.
            </p>
          </div>
        </aside>

        <div className="results">
          <form method="get" action="/" aria-label="Search and filter catalog">
            <label htmlFor="catalog-search">Title, item ID or creator</label>
            <input id="catalog-search" name="q" type="search" maxLength={100} defaultValue={typeof params.q === "string" ? params.q : ""} />
            <label htmlFor="catalog-price">Price mode</label>
            <select id="catalog-price" name="price" defaultValue={typeof params.price === "string" ? params.price : ""}>
              <option value="">All price modes</option><option value="credits">Credits</option><option value="money">Money</option><option value="credits-and-money">Credits and money</option>
            </select>
            <label htmlFor="catalog-sort">Sort</label>
            <select id="catalog-sort" name="sort" defaultValue={typeof params.sort === "string" ? params.sort : "inventory"}>
              <option value="inventory">Inventory order</option><option value="title">Title</option><option value="newest">Newest</option>
            </select>
            <button type="submit">Apply filters</button> <a href="/">Clear filters</a>
          </form>
          {listings.length === 0 && <section role="status" aria-labelledby="catalog-empty"><h2 id="catalog-empty">No matching listings</h2><p>Try a different title, item ID, creator or price mode.</p><a href="/">Clear filters</a></section>}
          <div className="results-head" id="catalogue">
            <span>
              <span className="results-count">{listings.length}</span> {word}
            </span>
            <span>on the {CATALOG_SITE_SURFACE.replace("catalog-", "")} surface</span>
          </div>

          <ul className="cards">
            {listings.map((listing) => (
              <ListingCard listing={listing} key={listing.itemId} />
            ))}
          </ul>

          <p className="prose">
            Each card is marked with a figure derived from the validated listing record.
            It is a mark of the record digest, not a render of the scene — the fixture
            carries no asset payload or preview.
          </p>

          <section className="section" id="pricing">
            <h2>How pricing reads</h2>
            <p className="prose">
              A scene may be priced in credits, money, or both. The display keeps the
              seller&apos;s choice exactly; it does not convert currencies. Creators receive
              {" "}{CREATOR_SHARE_RULE.creatorPercent}% in the established share model.
            </p>
            <p className="reason">{CREATOR_SHARE_ROUNDING_NOTE}</p>
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
