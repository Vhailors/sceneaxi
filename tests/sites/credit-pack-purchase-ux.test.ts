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
      identityConfigured: true,
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
        refusalReason: null,
      });
    }
  });

  it("disables checkout by name when the TEST provider is not configured", () => {
    const offers = buildCreditPackOffers(PACKS, {
      billingMode: "test",
      checkoutConfigured: false,
      identityConfigured: true,
    });

    for (const offer of offers) {
      expect(offer.purchase).toEqual({
        enabled: false,
        label: "Stripe TEST checkout unavailable",
        status: "TEST MODE · provider not configured",
        refusalReason: "BILLING_PLANE_NOT_WIRED",
      });
    }
  });

  it("does not offer a checkout when Stripe exists without the identity provider", () => {
    const offers = buildCreditPackOffers(PACKS, {
      billingMode: "test",
      checkoutConfigured: true,
      identityConfigured: false,
    });

    for (const offer of offers) {
      expect(offer.purchase).toEqual({
        enabled: false,
        label: "Sign-in unavailable",
        status: "TEST MODE · identity provider not configured",
        refusalReason: "IDENTITY_PLANE_NOT_WIRED",
      });
    }
  });

  it("never turns a LIVE mode selection into an enabled purchase", () => {
    const offers = buildCreditPackOffers(PACKS, {
      billingMode: "live",
      checkoutConfigured: true,
      identityConfigured: true,
    });

    for (const offer of offers) {
      expect(offer.purchase).toEqual({
        enabled: false,
        label: "Stripe LIVE checkout unavailable",
        status: "LIVE MODE REFUSED · activation not authorized",
        refusalReason: "BILLING_LIVE_MODE_NOT_AUTHORIZED",
      });
    }
  });

  it("keeps operator billing configuration off the member-facing pricing page", () => {
    const pricing = readFileSync(
      new URL("../../sites/umbrella/src/app/pricing/page.tsx", import.meta.url),
      "utf8",
    );

    expect(pricing).not.toContain('title="Billing mode"');
    expect(pricing).not.toContain('term: "Mode"');
    expect(pricing).not.toContain('term: "Checkout"');
  });

  it("does not assume every currency has two decimal minor units", () => {
    const [offer] = buildCreditPackOffers(
      [
        {
          packId: "future-yen",
          credits: 100,
          unitAmount: 500,
          currency: "jpy",
        },
      ],
      {
        billingMode: "test",
        checkoutConfigured: true,
        identityConfigured: true,
      },
    );

    expect(offer?.price).toBe("500 JPY minor units");
  });

  it("keeps the account surface explicit about balance without exposing operator wiring", () => {
    const account = readFileSync(
      new URL("../../sites/umbrella/src/app/account/page.tsx", import.meta.url),
      "utf8",
    );

    expect(account).toContain("resolved.credits.value.balance");
    expect(account).toContain("Starter grant");
    expect(account).toContain("Administrator — no balance was read");
    expect(account).toContain("Nothing was debited to render this page");
    expect(account).not.toContain("Identity plane");
    expect(account).not.toContain("Billing plane");
    expect(account).not.toContain("IDENTITY_PLANE_DOC");
  });

  it("uses browser redirects for named checkout refusals and requires a stable attempt token", () => {
    const route = readFileSync(
      new URL("../../sites/umbrella/src/app/api/checkout/route.ts", import.meta.url),
      "utf8",
    );

    expect(route).toContain("readSiteMutationRequestSignals(request)");
    expect(route).toContain("verifyLoginRequestOrigin(process.env, signals.formOrigin)");
    expect(route).toContain('request.headers.get("accept")?.includes("application/json")');
    // Named refusals redirect 303 to a same-site relative path carrying the reason.
    expect(route).toContain("status: 303");
    expect(route).toContain("new URLSearchParams(signedOut ? { next: \"/pricing\", reason } : { reason })");
    expect(route).toContain("IDENTITY_SESSION_ABSENT");
    expect(route).toContain("BILLING_CHECKOUT_REQUEST_INVALID");
    expect(route).not.toContain("crypto.randomUUID");
    expect(route).toContain("?checkout=success");
    expect(route).toContain("?checkout=cancelled");
  });

  it("shows payment return states without claiming an unconfirmed ledger grant", () => {
    const pricing = readFileSync(
      new URL("../../sites/umbrella/src/app/pricing/page.tsx", import.meta.url),
      "utf8",
    );

    const account = readFileSync(
      new URL("../../sites/umbrella/src/app/account/page.tsx", import.meta.url),
      "utf8",
    );

    expect(account).toContain("This return link is not proof of payment.");
    expect(account).not.toContain("Payment received.");
    expect(pricing).toContain("No payment was completed. No credits were added.");
    expect(pricing).not.toContain('title="Billing mode"');
    expect(pricing).not.toContain('term: "Checkout"');
  });
});
