import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SiteCreditPack } from "@sceneaxi/site-kit";
import { buildCreditPackOffers } from "../../sites/umbrella/src/lib/credit-pack-offers.js";

const PACKS: readonly SiteCreditPack[] = Object.freeze([
  Object.freeze({
    packId: "starter",
    credits: 100,
    unitAmount: 500,
    currency: "usd",
  }),
  Object.freeze({
    packId: "maker",
    credits: 500,
    unitAmount: 2_000,
    currency: "usd",
  }),
  Object.freeze({
    packId: "studio",
    credits: 2_000,
    unitAmount: 7_000,
    currency: "usd",
  }),
]);

describe("SA-PAY-1 credit-pack purchase presentation", () => {
  it("presents every committed pack as a Stripe TEST purchase without implying a real charge", () => {
    const offers = buildCreditPackOffers(PACKS, {
      billingMode: "test",
      checkoutConfigured: true,
    });

    expect(offers.map((offer) => offer.packId)).toEqual([
      "starter",
      "maker",
      "studio",
    ]);
    expect(offers.map((offer) => offer.price)).toEqual([
      "$5.00 USD",
      "$20.00 USD",
      "$70.00 USD",
    ]);
    expect(offers.map((offer) => offer.credits)).toEqual([100, 500, 2_000]);
    expect(offers.filter((offer) => offer.bestRate).map((offer) => offer.packId)).toEqual([
      "studio",
    ]);
    for (const offer of offers) {
      expect(offer.purchase).toEqual({
        enabled: true,
        label: `Open Stripe TEST checkout for ${offer.credits} credits`,
        status: "TEST MODE · no real charge",
      });
    }
  });

  it("disables checkout by name when the TEST provider is not configured", () => {
    const offers = buildCreditPackOffers(PACKS, {
      billingMode: "test",
      checkoutConfigured: false,
    });

    for (const offer of offers) {
      expect(offer.purchase).toEqual({
        enabled: false,
        label: "Stripe TEST checkout unavailable",
        status: "TEST MODE · provider not configured",
      });
    }
  });

  it("never turns a LIVE mode selection into an enabled purchase", () => {
    const offers = buildCreditPackOffers(PACKS, {
      billingMode: "live",
      checkoutConfigured: true,
    });

    for (const offer of offers) {
      expect(offer.purchase).toEqual({
        enabled: false,
        label: "Stripe LIVE checkout unavailable",
        status: "LIVE MODE REFUSED · activation not authorized",
      });
    }
  });

  it("keeps the account surface explicit about balance, starter grant, and admin allowance", () => {
    const account = readFileSync(
      new URL("../../sites/umbrella/src/app/account/page.tsx", import.meta.url),
      "utf8",
    );
    expect(account).toContain("resolved.credits.value.balance");
    expect(account).toContain("Starter grant");
    expect(account).toContain("Administrator — no balance was read");
    expect(account).toContain("Nothing was debited to render this page");
  });
});
