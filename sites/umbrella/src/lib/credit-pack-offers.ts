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
