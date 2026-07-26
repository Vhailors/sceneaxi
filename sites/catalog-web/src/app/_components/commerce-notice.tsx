import { COMMERCE_ACTIVATION_GATE, attemptCatalogPurchase } from "@sceneaxi/site-kit";
import type { CatalogSurface, SitePrincipal, SiteResult } from "@sceneaxi/site-kit";
import { StatePanel } from "./state-panel.js";

/**
 * The purchase and publish controls.
 *
 * There is no checkout, cart, or payment field anywhere on this storefront. Commerce is
 * structurally inert while tier-6b marketplace activation stays an open captain
 * decision, so this component renders the pipeline's own refusal — including its policy
 * text and registry citation — instead of a button that could never complete.
 *
 * The viewer line exists because this panel claims a future purchase "settles through
 * the shared account plane". It shows what that plane actually says about this request
 * today, rather than letting the claim go unevidenced. It is display only: no decision
 * on this page depends on it, and the role shown is the server-derived one the identity
 * port returned — a storefront never reads a role from a client.
 */
export function CommerceNotice({
  surface,
  itemId,
  viewer,
}: {
  readonly surface: CatalogSurface;
  readonly itemId: string;
  readonly viewer: SiteResult<SitePrincipal>;
}) {
  const attempt = attemptCatalogPurchase({ surface, itemId, payWith: "credits" });
  const reason = attempt.ok ? undefined : attempt.reason;

  return (
    <StatePanel tone="warn" title="Buying is not open yet" reason={reason}>
      <p>{COMMERCE_ACTIVATION_GATE.policy}</p>
      <p>
        Prices and the creator share are shown so listings can be evaluated now. When
        activation opens, purchases settle in credits through the shared account plane —
        nothing on this page collects payment details in the meantime.
      </p>
      <p>
        Account plane:{" "}
        {viewer.ok ? (
          <>
            signed in as <code>{viewer.value.user.email}</code> · role{" "}
            <code>{viewer.value.role}</code>
          </>
        ) : (
          <>
            no viewer resolved · <code>{viewer.reason}</code>
          </>
        )}
      </p>
      <p>
        Registry: <code>{COMMERCE_ACTIVATION_GATE.registry}</code>
      </p>
    </StatePanel>
  );
}
