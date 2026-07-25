import { COMMERCE_ACTIVATION_GATE, attemptCatalogPurchase } from "@sceneaxi/site-kit";
import type { CatalogSurface } from "@sceneaxi/site-kit";
import { StatePanel } from "./state-panel.js";

/**
 * The purchase and publish controls.
 *
 * There is no checkout, cart, or payment field anywhere on this storefront. Commerce is
 * structurally inert while tier-6b marketplace activation stays an open captain
 * decision, so this component renders the pipeline's own refusal — including its policy
 * text and registry citation — instead of a button that could never complete.
 */
export function CommerceNotice({
  surface,
  itemId,
}: {
  readonly surface: CatalogSurface;
  readonly itemId: string;
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
        Registry: <code>{COMMERCE_ACTIVATION_GATE.registry}</code>
      </p>
    </StatePanel>
  );
}
