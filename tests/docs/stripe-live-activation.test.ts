import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("SA-PAY-1 Stripe LIVE activation checklist", () => {
  const checklist = read("docs/stripe-live-activation.md");

  it("is complete enough to gate Stripe, webhook, tax/legal, refund, and deployment work", () => {
    for (const section of [
      "Stripe account and LIVE products",
      "Webhook and settlement safety",
      "Tax, legal, support, and refunds",
      "Deployment and data prerequisites",
      "Preflight evidence and rollback",
    ]) {
      expect(checklist).toContain(`## ${section}`);
    }
    for (const exactName of [
      "SCENEAXI_BILLING_MODE",
      "SCENEAXI_STRIPE_LIVE_AUTHORIZED",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN",
    ]) {
      expect(checklist).toContain(`\`${exactName}\``);
    }
    expect(checklist).toContain("checkout.session.completed");
    expect(checklist).toContain("append-only adjustment");
    expect(checklist).toContain("SA-CON-1");
  });

  it("documents prerequisites without enabling LIVE in shipped code", () => {
    expect(checklist).toContain("Status: NOT AUTHORIZED — DO NOT EXECUTE");
    expect(checklist).toContain("No secret value belongs in this file");

    const identityPlane = read("sites/umbrella/src/lib/identity-plane.ts");
    const providers = read("sites/umbrella/src/lib/provider-adapters.ts");
    expect(identityPlane).not.toContain("liveModeAuthorizedFlag");
    expect(providers).toContain('secretKey.startsWith("sk_test_")');
    expect(providers).not.toContain('secretKey.startsWith("sk_live_")');
  });
});
