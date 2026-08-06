import type {
  SiteBillingMode,
  SiteCreditPack,
  SiteRefusalReason,
} from "@sceneaxi/site-kit";

export type CreditPackPurchasePresentation = Readonly<{
  enabled: boolean;
  label: string;
  status: string;
  refusalReason: SiteRefusalReason | null;
}>;

export type CreditPackOffer = Readonly<{
  packId: string;
  credits: number;
  price: string;
  bestRate: boolean;
  purchase: CreditPackPurchasePresentation;
}>;

export type CreditPackOfferOptions = Readonly<{
  billingMode: SiteBillingMode;
  checkoutConfigured: boolean;
  identityConfigured: boolean;
}>;

const priceLabel = (pack: SiteCreditPack): string => {
  const currency = pack.currency.toUpperCase();
  // The current committed catalog is USD. Preserve an honest minor-unit label for a
  // future currency rather than assuming every ISO-4217 currency has two decimals.
  return pack.currency === "usd"
    ? `$${(pack.unitAmount / 100).toFixed(2)} ${currency}`
    : `${pack.unitAmount} ${currency} minor units`;
};

const hasBetterRate = (candidate: SiteCreditPack, held: SiteCreditPack): boolean =>
  candidate.credits * held.unitAmount > held.credits * candidate.unitAmount;

const bestRatePackId = (packs: readonly SiteCreditPack[]): string | null => {
  if (packs.length < 2) return null;
  let best = packs[0];
  if (best === undefined) return null;
  for (const candidate of packs.slice(1)) {
    if (hasBetterRate(candidate, best)) best = candidate;
  }
  const tied = packs.some(
    (candidate) =>
      candidate.packId !== best.packId &&
      !hasBetterRate(best, candidate) &&
      !hasBetterRate(candidate, best),
  );
  return tied ? null : best.packId;
};

const purchasePresentation = (
  credits: number,
  options: CreditPackOfferOptions,
): CreditPackPurchasePresentation => {
  if (options.billingMode === "live") {
    return Object.freeze({
      enabled: false,
      label: "Stripe LIVE checkout unavailable",
      status: "LIVE MODE REFUSED · activation not authorized",
      refusalReason: "BILLING_LIVE_MODE_NOT_AUTHORIZED",
    });
  }
  if (!options.checkoutConfigured) {
    return Object.freeze({
      enabled: false,
      label: "Stripe TEST checkout unavailable",
      status: "TEST MODE · provider not configured",
      refusalReason: "BILLING_PLANE_NOT_WIRED",
    });
  }
  if (!options.identityConfigured) {
    return Object.freeze({
      enabled: false,
      label: "Sign-in unavailable",
      status: "TEST MODE · identity provider not configured",
      refusalReason: "IDENTITY_PLANE_NOT_WIRED",
    });
  }
  return Object.freeze({
    enabled: true,
    label: `Open Stripe TEST checkout for ${credits} credits`,
    status: "TEST MODE · no real charge",
    refusalReason: null,
  });
};

export type CreditPackBillingModeNotice = Readonly<{
  /** The mode word the panel emphasises, matching the plane's own evidence row. */
  mode: string;
  /** What that mode means for a visitor about to press a checkout button. */
  charge: string;
  /** Why a live charge is still not available whichever mode is configured. */
  activation: string;
}>;

/**
 * State the deployment's billing mode, never a mode it is not in.
 *
 * The panel sits beside an evidence row printing `plane.billingMode`, so a fixed
 * "runs against TEST" sentence becomes a contradiction the moment a deployment sets
 * `SCENEAXI_BILLING_MODE=live` — and it contradicts the packs beside it, which already
 * refuse live checkout by name. The mode is a plane-owned fact, so the copy is derived
 * from it here rather than asserted in the page.
 */
export function creditPackBillingModeNotice(
  billingMode: SiteBillingMode,
): CreditPackBillingModeNotice {
  return billingMode === "live"
    ? Object.freeze({
        mode: "LIVE",
        charge:
          "This deployment names Stripe LIVE mode, and no checkout is offered here: every pack above refuses, so no charge can be made from this page.",
        activation:
          "Live charges need a separate captain decision, and the billing port refuses live mode without explicit authorization — naming the mode is not that authorization.",
      })
    : Object.freeze({
        mode: "TEST",
        charge:
          "Checkout runs against Stripe TEST mode on this deployment. TEST mode does not make a real charge.",
        activation:
          "Live charges need a separate captain decision, and the billing port refuses live mode without explicit authorization.",
      });
}

/** Build the complete, truthful purchase presentation from plane-owned facts. */
export function buildCreditPackOffers(
  packs: readonly SiteCreditPack[],
  options: CreditPackOfferOptions,
): readonly CreditPackOffer[] {
  const bestPackId = bestRatePackId(packs);
  return Object.freeze(
    packs.map((pack) =>
      Object.freeze({
        packId: pack.packId,
        credits: pack.credits,
        price: priceLabel(pack),
        bestRate: pack.packId === bestPackId,
        purchase: purchasePresentation(pack.credits, options),
      }),
    ),
  );
}
