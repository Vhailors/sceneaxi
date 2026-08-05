import type { SiteBillingMode, SiteCreditPack } from "@sceneaxi/site-kit";

export type CreditPackPurchasePresentation = Readonly<{
  enabled: boolean;
  label: string;
  status: string;
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
}>;

const priceLabel = (pack: SiteCreditPack): string => {
  const currency = pack.currency.toUpperCase();
  const amount = (pack.unitAmount / 100).toFixed(2);
  return `${pack.currency === "usd" ? "$" : ""}${amount} ${currency}`;
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
    });
  }
  if (!options.checkoutConfigured) {
    return Object.freeze({
      enabled: false,
      label: "Stripe TEST checkout unavailable",
      status: "TEST MODE · provider not configured",
    });
  }
  return Object.freeze({
    enabled: true,
    label: `Open Stripe TEST checkout for ${credits} credits`,
    status: "TEST MODE · no real charge",
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
