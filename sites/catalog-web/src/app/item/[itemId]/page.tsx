import type { Metadata } from "next";
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
  catalogCanonical,
  CATALOG_SITE_SURFACE,
  editorLinkFor,
} from "../../../lib/site-config.js";
import {
  listingRecord,
  sameCreatorListings,
} from "../../../lib/catalog-facts.js";
import { shortenDigest } from "../../../lib/digest-sigil.js";
import {
  createCatalogRequestIdentityPlane,
  resolveCatalogViewer,
} from "../../../lib/identity-plane.js";
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
 *
 * The buy column comes first in source order, which is what a phone and a screen reader
 * want: title, price, options and the one working action, then the inert purchase notice
 * in the slot a cart button would take, then the record itself. Term → value facts are
 * evidence lists (`dl.evidence`); the refusals are named state panels.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly itemId: string }>;
}): Promise<Metadata> {
  const { itemId } = await params;

  const found = showSiteListing(CATALOG_SITE_SURFACE, itemId);

  if (!found.ok) return {};

  const canonical = catalogCanonical(process.env, `/item/${encodeURIComponent(itemId)}`);

  const metadata: Metadata = {
    title: found.value.title,
    description: `${found.value.title} by ${found.value.creatorId}.`,
  };

  if (canonical !== null) metadata.alternates = { canonical };

  return metadata;
}

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
  const plane = createCatalogRequestIdentityPlane({
      // Explicit server-only approval and RAW configured origin; never request Host.
      approved: process.env.SCENEAXI_CATALOG_OWN_SESSION_APPROVED === "true",
      configuredOrigin: process.env.NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN ?? null,
      allowLoopbackDevelopment: process.env.NODE_ENV === "development",
    });

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
        <span className="glyph" aria-hidden="true">
          ›
        </span>
        <span aria-current="page">{listing.title}</span>
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
              <div className="buy-title">
                <h1>{listing.title}</h1>
                <p className="buy-by">
                  by <span className="creator-chip">{listing.creatorId}</span>
                </p>
              </div>

              <p className="buy-price">
                <span className="buy-price-num">{headlineValue}</span>
                <span className="buy-price-unit">{headlineUnit}</span>
                <span className="chip chip-accent">{listing.availability.mode.toUpperCase()}</span>
              </p>

              <section className="buy-block" aria-labelledby="detail-price-heading">
                <h2 className="block-title" id="detail-price-heading">Committed TEST price</h2>
                <dl className="evidence">
                  <div className="evidence-row">
                    <dt>Credits</dt>
                    <dd>{price.ok ? (price.value.credits ?? "not offered") : "unavailable"}</dd>
                  </div>
                  <div className="evidence-row">
                    <dt>Money</dt>
                    <dd>{price.ok ? (price.value.money ?? "not offered") : "unavailable"}</dd>
                  </div>
                  <div className="evidence-row">
                    <dt>Creator share · credits</dt>
                    <dd>{share.ok ? (share.value.credits ?? "not applicable") : "unavailable"}</dd>
                  </div>
                  <div className="evidence-row">
                    <dt>Creator share · money</dt>
                    <dd>{share.ok ? (share.value.money ?? "not applicable") : "unavailable"}</dd>
                  </div>
                </dl>
                <p className="mono-note">{CREATOR_SHARE_ROUNDING_NOTE}</p>
              </section>

              <div className="buy-actions">
                {link.ok ? (
                  <a className="button button-xl button-block" href={link.value}>
                    Open in the SceneAxi editor
                    <span className="glyph glyph-nudge" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                ) : (
                  <span
                    className="button button-xl button-block"
                    aria-disabled="true"
                    title={link.message}
                  >
                    Editor link unavailable
                  </span>
                )}
                <p className="note">
                  The link carries this listing id and source catalog only. It is a
                  reference for the umbrella editor, not a claim that this fixture
                  includes an asset payload.
                </p>
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
              </div>
            </div>

            <dl className="evidence buy-spec" aria-label="Listing record summary">
              <div className="evidence-row">
                <dt>Listing id</dt>
                <dd>{listing.itemId}</dd>
              </div>
              <div className="evidence-row">
                <dt>Contract</dt>
                <dd>{listing.listing.kind}</dd>
              </div>
              <div className="evidence-row">
                <dt>Record digest</dt>
                <dd title={listing.recordDigest}>{shortenDigest(listing.recordDigest)}</dd>
              </div>
              <div className="evidence-row">
                <dt>Published</dt>
                <dd>{listing.publishedAt}</dd>
              </div>
              <div className="evidence-row">
                <dt>Mode</dt>
                <dd>{listing.availability.mode.toUpperCase()}</dd>
              </div>
              <div className="evidence-row">
                <dt>Availability</dt>
                <dd>
                  browse {listing.availability.browse} · asset {listing.availability.asset} ·
                  purchase {listing.availability.purchase}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="detail-main">
          <figure className="detail-figure" id="record-mark">
            <DigestFigure
              digest={listing.recordDigest}
              variant="detail"
              chips={[
                {
                  key: "mode",
                  label: listing.availability.mode.toUpperCase(),
                  tone: "accent" as const,
                },
                { key: "availability", label: listing.availability.asset },
              ]}
              stats={[
                { key: "catalog", value: listing.listing.catalog },
                { key: "price mode", value: listing.priceMode },
              ]}
            />
            <figcaption className="mono-note">
              A mark derived from the validated listing record. It is not a render of
              an asset, and the digest is not presented as an asset content hash.
            </figcaption>
          </figure>

          <section className="section" id="record" aria-labelledby="record-heading">
            <div className="section-head">
              <h2 id="record-heading">Fixture listing record</h2>
              <p className="prose">
                This page presents every non-price field the committed listing contract
                carries. The canonical source is <code>{SITE_CATALOG_FIXTURE_PATH}</code>.
              </p>
            </div>
            <dl className="evidence evidence-record">
              {record.map((row) => (
                <div className="evidence-row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <StatePanel
            tone="warn"
            level={2}
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
            <section className="section" id="related" aria-labelledby="related-heading">
              <div className="section-head">
                <h2 id="related-heading">From the same creator</h2>
              </div>
              <ul className="cards cards-compact">
                {related.map((other) => (
                  <ListingCard listing={other} key={other.itemId} compact />
                ))}
              </ul>
            </section>
          )}

          {!price.ok && (
            <StatePanel
              tone="deny"
              level={2}
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
