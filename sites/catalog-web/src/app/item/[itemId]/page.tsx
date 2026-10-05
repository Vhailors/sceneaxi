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
        <span aria-hidden="true">/</span>
        <span aria-current="page">{listing.title}</span>
      </nav>

      <div className="detail-grid">
        <div
          className="detail-side"
          role="region"
          aria-label="Pricing and listing record"
          tabIndex={0}
        >
          <div className="detail-head">
            <h1>{listing.title}</h1>
            <p className="detail-by">by {listing.creatorId}</p>
          </div>

          <p className="price">
            <span className="price-num">{headlineValue}</span>
            <span className="price-unit">{headlineUnit}</span>
            <span className="chip chip-accent">{listing.availability.mode.toUpperCase()}</span>
          </p>

          <section className="detail-block" aria-labelledby="detail-price-heading">
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
            <p className="reason">{CREATOR_SHARE_ROUNDING_NOTE}</p>
          </section>

          <div className="detail-actions">
            {link.ok ? (
              <a className="button button-lg" href={link.value}>
                Open in the SceneAxi editor
              </a>
            ) : (
              <span className="button button-lg" aria-disabled="true" title={link.message}>
                Editor link unavailable
              </span>
            )}
            <p className="reason">
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

          <dl className="evidence evidence-spec">
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
              <dd title={listing.recordDigest}>
                {shortenDigest(listing.recordDigest)}
              </dd>
            </div>
            <div className="evidence-row">
              <dt>Published</dt>
              <dd>{listing.publishedAt}</dd>
            </div>
            <div className="evidence-row">
              <dt>Mode</dt>
              <dd>{listing.availability.mode.toUpperCase()}</dd>
            </div>
          </dl>

          <section className="detail-block" aria-labelledby="detail-availability-heading">
            <h2 className="block-title" id="detail-availability-heading">Availability</h2>
            <dl className="evidence">
              <div className="evidence-row">
                <dt>Browse and detail</dt>
                <dd>{listing.availability.browse}</dd>
              </div>
              <div className="evidence-row">
                <dt>Asset payload</dt>
                <dd>{listing.availability.asset}</dd>
              </div>
              <div className="evidence-row">
                <dt>Purchase</dt>
                <dd>{listing.availability.purchase}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="detail-main">
          <figure className="detail-figure">
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
            <figcaption className="reason">
              A mark derived from the validated listing record. It is not a render of
              an asset, and the digest is not presented as an asset content hash.
            </figcaption>
          </figure>

          <section className="section" aria-labelledby="detail-record-heading">
            <h2 id="detail-record-heading">Fixture listing record</h2>
            <p className="prose">
              This page presents every non-price field the committed listing contract
              carries. The canonical source is <code>{SITE_CATALOG_FIXTURE_PATH}</code>.
            </p>
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
            <section className="section" aria-labelledby="detail-related-heading">
              <h2 id="detail-related-heading">From the same creator</h2>
              <ul className="related">
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
