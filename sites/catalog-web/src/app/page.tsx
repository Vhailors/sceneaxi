import {
  CREATOR_SHARE_ROUNDING_NOTE,
  CREATOR_SHARE_RULE,
  SITE_CATALOG_MODE,
  listSiteCatalog,
} from "@sceneaxi/site-kit";
import { CATALOG_SITE_BRAND, CATALOG_SITE_SURFACE } from "../lib/site-config.js";
import { catalogFacets } from "../lib/catalog-facts.js";
import { ListingCard } from "./_components/listing-card.js";
import { LeadPlate } from "./_components/listing-tile.js";
import { PublishSlot } from "./_components/publish-slot.js";
import { StatePanel } from "./_components/state-panel.js";

/**
 * The browse page — the hero and its lead record, the facts strip, then the design's
 * rail-and-grid.
 *
 * The archive's rail is five filter groups of hand-written counts wired to checkboxes
 * that filter nothing, and its results header carries a sort control and a nine-page
 * pager. None of that ships: every count here is a count of the records on this page,
 * every figure in the facts strip is read from a contract, and no control appears whose
 * behaviour a contract does not already define. What survives is the layout, which is the
 * part the design was right about.
 */
export default function StorefrontPage() {
  const listings = listSiteCatalog(CATALOG_SITE_SURFACE);
  const facets = catalogFacets(listings);
  const lead = listings[0];

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
              <LeadPlate listing={lead} />
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
        <aside className="rail" aria-label="What this showroom holds" tabIndex={0}>
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
                      { "--share": String(row.count / listings.length) } as React.CSSProperties
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
          <div className="results-head" id="catalogue">
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
            It is a mark of the record digest, not a render of the scene — the fixture
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
