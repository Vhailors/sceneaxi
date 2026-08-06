import {
  CREATOR_SHARE_ROUNDING_NOTE,
  CREATOR_SHARE_RULE,
  SITE_REFUSALS,
  SITE_STARTER_CREDIT_ALLOTMENT,
} from "@sceneaxi/site-kit";
import {
  BILLING_PLANE_PENDING_NOTE,
  umbrellaRequestAuthority,
} from "../../lib/request-authority.js";
import {
  CREDIT_LEDGER_COPY,
  CREDIT_LEDGER_FACTS,
  PRICING_FAQ,
} from "../../lib/site-content.js";
import {
  buildCreditPackOffers,
  creditPackBillingModeNotice,
} from "../../lib/credit-pack-offers.js";
import { CapabilityTable } from "../_components/capability-table.js";
import { StatePanel } from "../_components/state-panel.js";

/**
 * Pricing: the free-vs-paid matrix and credit packs.
 *
 * The accepted screen prices three subscription tiers. SceneAxi does not sell seats —
 * the billing vertical owns credit packs — so the tier-card layout is applied to the
 * packs the billing plane actually returns. The pack list never comes from a constant
 * here: pack pricing is a product decision owned by `@sceneaxi/billing`, and inventing
 * prices on a page would be inventing that decision. Unwired, the page says so.
 *
 * The page is rendered per request because its checkout attempt token must be. A
 * prerender would evaluate that token once at build time and serve every visitor the
 * same one, which the checkout route folds into its idempotency key — so a second
 * purchase of the same pack would derive the first purchase's intent id and hand back a
 * completed session instead of a new checkout. The token is per render, so the render
 * has to be per request.
 */
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plane = umbrellaRequestAuthority().plane();
  const packs = await plane.billing.listCreditPacks();
  const offers = packs.ok
    ? buildCreditPackOffers(packs.value, {
        billingMode: plane.billingMode,
        checkoutConfigured: plane.wired.billing,
        identityConfigured: plane.wired.identity,
      })
    : [];
  const modeNotice = creditPackBillingModeNotice(plane.billingMode);

  return (
    <div className="page">
      <div className="page-head page-head-center">
        <p className="eyebrow">Pricing</p>
        <h1>The engine is free. You pay for hosted work.</h1>
        <p className="lede">
          The engine SDK, the CLI, and bringing your own AI provider cost nothing. Hosted
          AI uses credits. Catalog listings may be priced in credits, money, or both;
          catalog purchases are not open. New accounts receive{" "}
          {SITE_STARTER_CREDIT_ALLOTMENT} credits once.
        </p>
      </div>

      <div className="stack">
        <h2>Credit packs</h2>
        {packs.ok ? (
          <>
            <div className="grid grid-3">
              {offers.map((offer) => {
                const featured = offer.bestRate;
                return (
                  <article
                    className={featured ? "tier tier-featured" : "tier"}
                    key={offer.packId}
                  >
                    {featured && <p className="tier-flag">BEST RATE PER CREDIT</p>}
                    <div className="tier-body">
                      <h3>
                        <code>{offer.packId}</code>
                      </h3>
                      <p className="tier-price">
                        <span className="tier-amount">{offer.price}</span>
                        <span className="tier-unit">once</span>
                      </p>
                      <p className="body-copy">
                        {offer.credits} credits, appended to your ledger as one entry when
                        the checkout settles. Credits do not expire and are never a
                        subscription.
                      </p>
                      <hr className="tier-rule" />
                      <ul className="checks panel-grow">
                        <li>
                          <span className="mark-box mark-yes" aria-hidden="true">
                            ✓
                          </span>
                          Hosted AI generation
                        </li>
                        <li>
                          <span className="mark-box mark-yes" aria-hidden="true">
                            ✓
                          </span>
                          Minimum E2 web editor access
                        </li>
                        <li>
                          <span className="mark-box mark-no" aria-hidden="true">
                            ✕
                          </span>
                          Catalog asset purchase — not open
                        </li>
                      </ul>
                      <p className="note">
                        <span
                          className={`chip chip-${offer.purchase.enabled ? "validated" : "dormant"}`}
                        >
                          {offer.purchase.status}
                        </span>
                      </p>
                      {offer.purchase.enabled ? (
                        <form method="post" action="/api/checkout">
                          <input type="hidden" name="packId" value={offer.packId} />
                          <input
                            type="hidden"
                            name="attempt"
                            value={crypto.randomUUID()}
                            autoComplete="off"
                          />
                          <button className="button button-block" type="submit">
                            {offer.purchase.label}
                          </button>
                        </form>
                      ) : (
                        <span
                          className="button button-block"
                          aria-disabled="true"
                          title={
                            offer.purchase.refusalReason === null
                              ? undefined
                              : SITE_REFUSALS[offer.purchase.refusalReason]
                          }
                        >
                          {offer.purchase.label}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <StatePanel
              tone="warn"
              title="Billing mode"
              evidence={[
                { term: "Mode", value: plane.billingMode },
                { term: "Checkout", value: plane.wired.billing ? "wired" : "not wired" },
              ]}
            >
              <p>
                <strong>{modeNotice.mode}</strong> — {modeNotice.charge}{" "}
                {modeNotice.activation}
              </p>
              <p>{CREDIT_LEDGER_COPY.retryIsNotASecondCharge}</p>
              {!plane.wired.billing && (
                <p>
                  These prices are shown for information and no purchase is offered.{" "}
                  {BILLING_PLANE_PENDING_NOTE}
                </p>
              )}
            </StatePanel>
          </>
        ) : (
          <StatePanel tone="deny" title="No credit packs to offer yet" reason={packs.reason}>
            <p>{packs.message}</p>
            <p>{BILLING_PLANE_PENDING_NOTE}</p>
            <p>
              Pack contents and prices are a product decision owned by the billing
              vertical, so this page shows nothing rather than inventing a price.
            </p>
          </StatePanel>
        )}
      </div>

      <div className="stack">
        <h2>What a credit is</h2>
        <p className="prose prose-wide">{CREDIT_LEDGER_COPY.model}</p>
        <div className="grid grid-2">
          {CREDIT_LEDGER_FACTS.map((fact) => (
            <article className="note-card" key={fact.title}>
              <h3>
                <span className="dot" aria-hidden="true" />
                {fact.title}
              </h3>
              <p>{fact.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="stack">
        <h2>What each capability requires</h2>
        <CapabilityTable />
      </div>

      <div className="stack">
        <h2>Selling your own assets</h2>
        {/*
          The split is stated once, by the rule that owns it. `CREATOR_SHARE_RULE.note`
          already carries the percentages, so restating them above it would print the
          same sentence twice.
        */}
        <p className="prose prose-wide">{CREATOR_SHARE_RULE.note}</p>
        <p className="note">{CREATOR_SHARE_ROUNDING_NOTE}</p>

        <StatePanel tone="warn" title="Catalog purchases are not open">
          <p>
            Catalog listings display prices and the creator share, but buying an asset is
            structurally inert while marketplace activation remains an open captain
            decision. Both storefronts refuse a purchase with a named reason rather than
            showing a checkout that cannot complete.
          </p>
        </StatePanel>
      </div>

      <div className="stack">
        <h2>Questions</h2>
        <dl className="faq">
          {PRICING_FAQ.map((entry) => (
            <div className="faq-item" key={entry.q}>
              <dt>{entry.q}</dt>
              <dd>{entry.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
