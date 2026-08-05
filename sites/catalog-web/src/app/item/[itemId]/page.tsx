import { notFound } from "next/navigation";
import {
  CREATOR_SHARE_ROUNDING_NOTE,
  SITE_CATALOG_FIXTURE_PATH,
  describeCreatorShare,
  describeListingPrice,
  formatMoneyPrice,
  listSiteCatalog,
  showSiteListing,
} from "@sceneaxi/site-kit";
import {
  CATALOG_SITE_BRAND,
  CATALOG_SITE_SURFACE,
  editorLinkFor,
} from "../../../lib/site-config.js";
import {
  listingRecord,
  sameCreatorListings,
} from "../../../lib/catalog-facts.js";
import { shortenDigest } from "../../../lib/digest-sigil.js";
import {
  createCatalogIdentityPlane,
  resolveCatalogViewer,
} from "@sceneaxi/site-kit/catalog-identity";
import { readSessionToken } from "../../_session.js";
import { CommerceNotice } from "../../_components/commerce-notice.js";
import { DigestFigure } from "../../_components/digest-figure.js";
import { ListingCard } from "../../_components/listing-card.js";
import { StatePanel } from "../../_components/state-panel.js";

/**
 * Listing detail over the committed TEST fixture contract.
 *
 * The record contains seller, title, price mode, prices, and publication time. It
 * contains no asset payload or payment evidence, so the page names those absences
 * and never fills the design with invented package, licence, preview, or delivery data.
 */
export default async function ItemPage({
  params,
}: {
  readonly params: Promise<{ readonly itemId: string }>;
}) {
  const { itemId } = await params;
  const found = showSiteListing(CATALOG_SITE_SURFACE, itemId);
  if (!found.ok) notFound();

  const listing = found.value;
  const price = describeListingPrice(listing.price);
  const share = describeCreatorShare(listing.price);
  const link = editorLinkFor(process.env, listing.itemId);
  const record = listingRecord(listing);
  const related = sameCreatorListings(
    listSiteCatalog(CATALOG_SITE_SURFACE),
    listing,
  );

  // The storefront reads identity through the shared site-kit port and holds no auth
  // stack of its own; unwired, this is a named refusal rather than an invented viewer.
  const plane = createCatalogIdentityPlane();
  const viewer = await resolveCatalogViewer(
    plane,
    plane.wired ? await readSessionToken() : null,
  );

  const headlineValue =
    listing.price.credits !== null
      ? String(listing.price.credits)
      : listing.price.money === null
        ? "—"
        : formatMoneyPrice(listing.price.money).split(" ")[0];
  const headlineUnit =
    listing.price.credits !== null
      ? `credit${listing.price.credits === 1 ? "" : "s"}`
      : (listing.price.money?.currency.toUpperCase() ?? "no price recorded");

  return (
    <div className="shell detail">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="/">{CATALOG_SITE_BRAND.catalogueWord}</a>
        <span aria-hidden="true">/</span>
        <span>{listing.title}</span>
      </nav>

      <div className="detail-grid">
        <div
          className="detail-side"
          role="region"
          aria-label="Pricing and listing record"
          tabIndex={0}
        >
          <div className="buy">
            <div className="buy-body">
              <div>
                <h1>{listing.title}</h1>
                <p className="buy-by">by {listing.creatorId}</p>
              </div>

              <p className="buy-price">
                <span className="buy-price-num">{headlineValue}</span>
                <span className="buy-price-unit">{headlineUnit}</span>
              </p>

              <div className="section">
                <h2 className="micro">Committed TEST price</h2>
                <ul className="buy-options">
                  <li className="buy-option">
                    <span className="buy-option-name">Credits</span>
                    <span className="buy-option-value">
                      {price.ok ? (price.value.credits ?? "not offered") : "unavailable"}
                    </span>
                  </li>
                  <li className="buy-option">
                    <span className="buy-option-name">Money</span>
                    <span className="buy-option-value">
                      {price.ok ? (price.value.money ?? "not offered") : "unavailable"}
                    </span>
                  </li>
                  <li className="buy-option">
                    <span className="buy-option-name">Creator share · credits</span>
                    <span className="buy-option-value">
                      {share.ok ? (share.value.credits ?? "not applicable") : "unavailable"}
                    </span>
                  </li>
                  <li className="buy-option">
                    <span className="buy-option-name">Creator share · money</span>
                    <span className="buy-option-value">
                      {share.ok ? (share.value.money ?? "not applicable") : "unavailable"}
                    </span>
                  </li>
                </ul>
                <p className="reason">{CREATOR_SHARE_ROUNDING_NOTE}</p>
              </div>

              <div className="buy-actions">
                {link.ok ? (
                  <a className="button" href={link.value}>
                    Open in the SceneAxi editor
                  </a>
                ) : (
                  <span className="button" aria-disabled="true" title={link.message}>
                    Editor link unavailable
                  </span>
                )}
                <p className="reason">
                  The link carries this listing id and source catalog only. It is a
                  reference for the umbrella editor, not a claim that this fixture
                  includes an asset payload.
                </p>
              </div>
            </div>

            <dl className="buy-spec">
              <div className="spec-row">
                <dt>Listing id</dt>
                <dd>{listing.itemId}</dd>
              </div>
              <div className="spec-row">
                <dt>Contract</dt>
                <dd>{listing.listing.kind}</dd>
              </div>
              <div className="spec-row">
                <dt>Record digest</dt>
                <dd title={listing.recordDigest}>
                  {shortenDigest(listing.recordDigest)}
                </dd>
              </div>
              <div className="spec-row">
                <dt>Published</dt>
                <dd>{listing.publishedAt}</dd>
              </div>
              <div className="spec-row">
                <dt>Mode</dt>
                <dd>{listing.availability.mode.toUpperCase()}</dd>
              </div>
            </dl>
          </div>

          {!link.ok && (
            <StatePanel
              tone="deny"
              title="No editor link for this deployment"
              reason={link.reason}
            >
              <p>{link.message}</p>
            </StatePanel>
          )}

          <CommerceNotice
            surface={CATALOG_SITE_SURFACE}
            itemId={listing.itemId}
            viewer={viewer}
          />

          <div className="side-panel">
            <h2 className="micro">Availability</h2>
            <ul className="side-list">
              <li className="side-row">
                <span className="included-check" aria-hidden="true">
                  ✓
                </span>
                <span>Browse and detail</span>
                <span className="side-row-note">{listing.availability.browse}</span>
              </li>
              <li className="side-row">
                <span aria-hidden="true">—</span>
                <span>Asset payload</span>
                <span className="side-row-note">{listing.availability.asset}</span>
              </li>
              <li className="side-row">
                <span aria-hidden="true">—</span>
                <span>Purchase</span>
                <span className="side-row-note">{listing.availability.purchase}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="detail-main">
          <DigestFigure
            digest={listing.recordDigest}
            large
            chips={[
              {
                key: "mode",
                label: listing.availability.mode.toUpperCase(),
                tone: "accent" as const,
              },
              { key: "availability", label: listing.availability.asset },
            ]}
            stats={[
              { key: "record", value: shortenDigest(listing.recordDigest) },
              { key: "catalog", value: listing.listing.catalog },
              { key: "price mode", value: listing.priceMode },
            ]}
          />
          <p className="reason">
            A mark derived from the validated listing record. It is not a render of
            an asset, and the digest is not presented as an asset content hash.
          </p>

          <section className="section">
            <h2>Fixture listing record</h2>
            <p className="prose">
              This page presents every non-price field the committed listing contract
              carries. The canonical source is <code>{SITE_CATALOG_FIXTURE_PATH}</code>.
            </p>
            <ul className="included">
              {record.map((row) => (
                <li className="included-row" key={row.label}>
                  <span className="included-check" aria-hidden="true">
                    ✓
                  </span>
                  <span className="included-key">{row.label}</span>
                  <span className="included-value">{row.value}</span>
                </li>
              ))}
            </ul>
          </section>

          <StatePanel
            tone="warn"
            title="Metadata-only fixture"
            reason={listing.availability.reason}
          >
            <p>
              No asset package, licence, preview, compatibility declaration, delivery
              artifact, payment form, or completion is part of this listing record.
              The storefront leaves those states unavailable instead of inventing them.
            </p>
          </StatePanel>

          {related.length > 0 && (
            <section className="section">
              <h2>From the same creator</h2>
              <ul className="cards">
                {related.map((other) => (
                  <ListingCard listing={other} key={other.itemId} compact />
                ))}
              </ul>
            </section>
          )}

          {!price.ok && (
            <StatePanel
              tone="deny"
              title="This listing has no price to show"
              reason={price.reason}
            >
              <p>{price.message}</p>
            </StatePanel>
          )}
        </div>
      </div>
    </div>
  );
}
