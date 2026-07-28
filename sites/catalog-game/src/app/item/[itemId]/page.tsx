import { notFound } from "next/navigation";
import {
  CREATOR_SHARE_ROUNDING_NOTE,
  creatorShare,
  describeListingPrice,
  listSiteCatalog,
  showSiteListing,
} from "@sceneaxi/site-kit";
import { CATALOG_SITE_BRAND, CATALOG_SITE_SURFACE, editorLinkFor } from "../../../lib/site-config.js";
import { curationTrail, sameCreatorListings } from "../../../lib/catalog-facts.js";
import { shortenDigest } from "../../../lib/digest-sigil.js";
import { createCatalogIdentityPlane, resolveCatalogViewer } from "../../../lib/identity-plane.js";
import { readSessionToken } from "../../_session.js";
import { CommerceNotice } from "../../_components/commerce-notice.js";
import { DigestFigure } from "../../_components/digest-figure.js";
import { ListingCard } from "../../_components/listing-card.js";
import { StatePanel } from "../../_components/state-panel.js";

/**
 * Listing detail, on the design's split: figure and record on the left, the panel that
 * would carry a purchase on the right.
 *
 * The archive's right panel is a `$28` headline, two invented licence tiers, an "Add to
 * cart" button and a spec block of placeholder digests, download counts and a refund
 * window. Commerce here is structurally inert — `attemptCatalogPurchase` refuses on every
 * path while tier-6b activation holds open — so the panel's primary action is the one
 * action that does work, the editor deep link, and the slot the cart button occupies is
 * filled by the refusal itself, with its registry citation.
 *
 * Its "Build passes" table becomes the curation record the contract actually holds:
 * the same numbered provenance rows, ending in a verified state, with real reasons and
 * real timestamps.
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
  const { item } = listing;
  const price = describeListingPrice(listing.price);
  const share = listing.price.credits === null ? null : creatorShare(listing.price.credits);
  const link = editorLinkFor(process.env, listing.itemId);
  const trail = curationTrail(item);
  const related = sameCreatorListings(listSiteCatalog(CATALOG_SITE_SURFACE), listing);

  // The storefront reads identity through the shared site-kit port and holds no auth
  // stack of its own; unwired, this is a named refusal rather than an invented viewer.
  // The cookie is read only when an adapter could act on it: `readSessionToken()` is a
  // request API, so reading it unconditionally would opt every listing page out of the
  // route cache to produce output that cannot vary.
  const plane = createCatalogIdentityPlane();
  const viewer = await resolveCatalogViewer(
    plane,
    plane.wired ? await readSessionToken() : null,
  );

  const headlineValue =
    listing.price.credits !== null
      ? String(listing.price.credits)
      : (listing.price.money?.amount ?? "—");
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
        {/*
          Source order is title, price, then the record — the order a phone shows and the
          order a screen reader reads. The stylesheet moves this column to the right at
          the tablet breakpoint and makes it sticky at desktop.
        */}
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
                <h2 className="micro">Priced in</h2>
                <ul className="buy-options">
                  <li className="buy-option">
                    <span className="buy-option-name">Credits</span>
                    <span className="buy-option-value">
                      {listing.price.credits ?? "not offered"}
                    </span>
                  </li>
                  <li className="buy-option">
                    <span className="buy-option-name">Money</span>
                    <span className="buy-option-value">
                      {listing.price.money === null
                        ? "not offered"
                        : `${listing.price.money.amount} ${listing.price.money.currency.toUpperCase()}`}
                    </span>
                  </li>
                  {share !== null && share.ok && (
                    <li className="buy-option">
                      <span className="buy-option-name">Creator receives</span>
                      <span className="buy-option-value">
                        {share.value.creator} of {share.value.total}
                      </span>
                    </li>
                  )}
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
                  The link carries the source surface and this item id and nothing else —
                  no identity, session, or tracking crosses the surface boundary.
                </p>
              </div>
            </div>

            <dl className="buy-spec">
              <div className="spec-row">
                <dt>Item id</dt>
                <dd>{listing.itemId}</dd>
              </div>
              <div className="spec-row">
                <dt>Package</dt>
                <dd>{item.assetPackage.packageId}</dd>
              </div>
              <div className="spec-row">
                <dt>Content hash</dt>
                <dd title={item.assetPackage.contentHash}>
                  {shortenDigest(item.assetPackage.contentHash)}
                </dd>
              </div>
              <div className="spec-row">
                <dt>Engine</dt>
                <dd>core {item.compatibility.coreRange}</dd>
              </div>
              <div className="spec-row">
                <dt>Pipeline state</dt>
                <dd>{item.moderation.pipelineState}</dd>
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
            <h2 className="micro">Works with</h2>
            <ul className="side-list">
              {item.compatibility.profiles.map((profile) => (
                <li className="side-row" key={profile}>
                  <span className="included-check" aria-hidden="true">
                    ✓
                  </span>
                  <span>{profile} profile</span>
                  <span className="side-row-note">declared</span>
                </li>
              ))}
              <li className="side-row">
                <span className="included-check" aria-hidden="true">
                  ✓
                </span>
                <span>Engine core</span>
                <span className="side-row-note">{item.compatibility.coreRange}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="detail-main">
          <DigestFigure
            digest={item.assetPackage.contentHash}
            large
            chips={[
              {
                key: "state",
                label: item.moderation.pipelineState,
                tone: "ok" as const,
              },
              { key: "licence", label: item.rights.license },
            ]}
            stats={[
              { key: "digest", value: shortenDigest(item.assetPackage.contentHash) },
              { key: "profiles", value: item.compatibility.profiles.join(", ") },
              { key: "transitions", value: String(trail.length) },
            ]}
          />
          <p className="reason">
            A mark derived from this listing&apos;s content hash. It is not a render of
            the asset.
          </p>

          <section className="section">
            <h2>What you get</h2>
            <p className="prose">{listing.summary}</p>
            <ul className="included">
              <li className="included-row">
                <span className="included-check" aria-hidden="true">
                  ✓
                </span>
                <span className="included-key">Asset package</span>
                <span className="included-value">{item.assetPackage.packageId}</span>
              </li>
              <li className="included-row">
                <span className="included-check" aria-hidden="true">
                  ✓
                </span>
                <span className="included-key">Content hash</span>
                <span className="included-value" title={item.assetPackage.contentHash}>
                  {shortenDigest(item.assetPackage.contentHash)}
                </span>
              </li>
              <li className="included-row">
                <span className="included-check" aria-hidden="true">
                  ✓
                </span>
                <span className="included-key">Licence</span>
                <span className="included-value">{item.rights.license}</span>
              </li>
              <li className="included-row">
                <span className="included-check" aria-hidden="true">
                  ✓
                </span>
                <span className="included-key">Rights holder</span>
                <span className="included-value">{item.rights.rightsHolder}</span>
              </li>
              <li className="included-row">
                <span className="included-check" aria-hidden="true">
                  ✓
                </span>
                <span className="included-key">Commercial use</span>
                <span className="included-value">
                  {item.rights.commercialUseAllowed ? "allowed" : "not allowed"}
                </span>
              </li>
              <li className="included-row">
                <span className="included-check" aria-hidden="true">
                  ✓
                </span>
                <span className="included-key">AI-generation disclosure</span>
                <span className="included-value">
                  {item.aiGenerationDisclosure.aiGenerated ? "AI-generated" : "not AI-generated"}
                </span>
              </li>
            </ul>
            <p className="prose">{item.aiGenerationDisclosure.disclosureText}</p>
          </section>

          <section className="section">
            <h2>Curation record</h2>
            <p className="prose">
              Every transition this item made, with the reason recorded at the time. It
              reached <code>{item.moderation.pipelineState}</code> through these steps and
              no others.
            </p>
            <ol className="record">
              {trail.map((step) => (
                <li className="record-row" key={`${step.ordinal}-${step.state}`}>
                  <span className="record-n">{step.ordinal}</span>
                  <span className="record-name">{step.state}</span>
                  <span className="record-detail">{step.reason}</span>
                  <span className="record-at">{step.at}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="section">
            <h2>Provenance</h2>
            <dl className="dl">
              <dt>Origin</dt>
              <dd>
                <code>{item.provenance.origin}</code>
              </dd>
              <dt>Ingested</dt>
              <dd>
                <code>{item.provenance.ingestedAt}</code>
              </dd>
              <dt>Source digest</dt>
              <dd>
                <code>{item.provenance.sourceDigest}</code>
              </dd>
              <dt>Content hash</dt>
              <dd>
                <code>{item.assetPackage.contentHash}</code>
              </dd>
            </dl>
          </section>

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
            <StatePanel tone="deny" title="This listing has no price to show" reason={price.reason}>
              <p>{price.message}</p>
            </StatePanel>
          )}
        </div>
      </div>
    </div>
  );
}
