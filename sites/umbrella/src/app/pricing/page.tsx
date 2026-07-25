import { CREATOR_SHARE_ROUNDING_NOTE, CREATOR_SHARE_RULE, SITE_STARTER_CREDIT_ALLOTMENT } from "@sceneaxi/site-kit";
import { IDENTITY_PLANE_PENDING_NOTE, createUmbrellaIdentityPlane } from "../../lib/identity-plane.js";
import { CapabilityTable } from "../_components/capability-table.js";
import { StatePanel } from "../_components/state-panel.js";

/**
 * Pricing: the free-vs-paid matrix and credit packs.
 *
 * The pack list comes from the billing plane, never from a constant here — pack
 * pricing is a product decision owned by `@sceneaxi/billing`, and inventing prices on
 * a page would be inventing that decision. Unwired, the page says so.
 */
export default async function PricingPage() {
  const plane = createUmbrellaIdentityPlane(process.env);
  const packs = await plane.billing.listCreditPacks();

  return (
    <>
      <p className="eyebrow">Pricing</p>
      <h1>Free to build with. Credits for hosted work.</h1>
      <p className="lede">
        The engine SDK, the CLI, and bringing your own AI provider cost nothing. Hosted
        AI and catalog assets are paid in credits or money. New accounts receive{" "}
        {SITE_STARTER_CREDIT_ALLOTMENT} credits once.
      </p>

      <h2>What each capability requires</h2>
      <CapabilityTable />

      <h2>Credit packs</h2>
      {packs.ok ? (
        <>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Pack</th>
                  <th>Credits</th>
                  <th>Price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {packs.value.map((pack) => (
                  <tr key={pack.packId}>
                    <td>
                      <code>{pack.packId}</code>
                    </td>
                    <td>{pack.credits}</td>
                    <td>
                      {(pack.unitAmount / 100).toFixed(2)} {pack.currency.toUpperCase()}
                    </td>
                    <td>
                      <form method="post" action="/api/checkout">
                        <input type="hidden" name="packId" value={pack.packId} />
                        <input type="hidden" name="attempt" value={crypto.randomUUID()} autoComplete="off" />
                        <button className="button" type="submit">Buy</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StatePanel tone="warn" title={`Billing mode: ${plane.billingMode}`}>
            <p>
              Checkout runs against Stripe <strong>test</strong> mode on this
              deployment. Live charges need a separate captain decision, and the billing
              port refuses live mode without explicit authorization.
            </p>
          </StatePanel>
        </>
      ) : (
        <StatePanel tone="deny" title="No credit packs to offer yet" reason={packs.reason}>
          <p>{packs.message}</p>
          <p>{IDENTITY_PLANE_PENDING_NOTE}</p>
          <p>
            Pack contents and prices are a product decision owned by the billing
            vertical, so this page shows nothing rather than inventing a price.
          </p>
        </StatePanel>
      )}

      <h2>Selling your own assets</h2>
      <p>
        Creators receive {CREATOR_SHARE_RULE.creatorPercent}% of the credits on a sale,
        and money sales are booked{" "}
        {CREATOR_SHARE_RULE.creatorPercent}/{CREATOR_SHARE_RULE.platformPercent}.{" "}
        {CREATOR_SHARE_RULE.note}
      </p>
      <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>
        {CREATOR_SHARE_ROUNDING_NOTE}
      </p>

      <StatePanel tone="warn" title="Catalog purchases are not open">
        <p>
          Catalog listings display prices and the creator share, but buying an asset is
          structurally inert while marketplace activation remains an open captain
          decision. Both storefronts refuse a purchase with a named reason rather than
          showing a checkout that cannot complete.
        </p>
      </StatePanel>
    </>
  );
}
