import {
  CREATOR_SHARE_ROUNDING_NOTE,
  CREATOR_SHARE_RULE,
  listSiteCatalog,
} from "@sceneaxi/site-kit";
import { CATALOG_SITE_BRAND, CATALOG_SITE_SURFACE } from "../lib/site-config.js";
import { catalogFacets } from "../lib/catalog-facts.js";
import { ListingCard } from "./_components/listing-card.js";
import { ListingTile } from "./_components/listing-tile.js";
import { StatePanel } from "./_components/state-panel.js";

/** The design leads with four hero tiles; the catalogue fills as many as it has. */
const HERO_TILES = 4;

/**
 * The browse page — hero band, then the design's rail-and-grid.
 *
 * The archive's rail is five filter groups of hand-written counts wired to checkboxes
 * that filter nothing, and its results header carries a sort control and a nine-page
 * pager. None of that ships: every count here is a count of the listings on this page,
 * and no control appears whose behaviour a contract does not already define. What
 * survives is the layout, which is the part the design was right about.
 */
export default function CataloguePage() {
  const listings = listSiteCatalog(CATALOG_SITE_SURFACE);
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
            <h2 className="sr-only">In the catalogue now</h2>
            <ul className="hero-tiles">
              {featured.map((listing) => (
                <ListingTile listing={listing} key={listing.itemId} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="shell browse">
        <aside className="rail" aria-label="What this catalogue holds" tabIndex={0}>
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
              <strong>Every listing carries its record</strong>
            </p>
            <p>
              Rights, provenance, an AI-generation disclosure, compatibility, and the
              curation history that put it here — published on the detail page rather than
              summarised into a badge. These counts describe the listings on this page and
              nothing beyond them.
            </p>
          </div>
        </aside>

        <div className="results">
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
            Each card is marked with a figure derived from that listing&apos;s own
            content hash. It is a mark of the digest, not a render of the asset — this
            storefront has never rendered these assets and does not draw a picture that
            would imply otherwise.
          </p>

          <section className="section" id="pricing">
            <h2>How pricing reads</h2>
            <p className="prose">
              A listing may be priced in credits, in money, or both — you pick at
              purchase. Creators receive {CREATOR_SHARE_RULE.creatorPercent}% of the
              credits on a sale.
            </p>
            <p className="reason">{CREATOR_SHARE_ROUNDING_NOTE}</p>
          </section>

          <StatePanel tone="warn" title="This catalogue is evaluation-only for now">
            <p>
              Every listing here is a curated fixture with real rights, provenance, and
              AI-disclosure metadata, so the contract surface can be inspected before
              purchasing opens. Buying is not activated, and nothing on this site collects
              payment details.
            </p>
          </StatePanel>
        </div>
      </div>
    </>
  );
}
