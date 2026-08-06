import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("SA-OPS-1 production activation runbook", () => {
  const runbook = read("docs/production-activation.md");
  const normalizedRunbook = runbook.replace(/\s+/g, " ");

  it("holds the explicit authorization boundary and complete operator phases", () => {
    expect(runbook).toContain("RUNBOOK ONLY — NO PRODUCTION ACTION IS AUTHORIZED");
    expect(runbook).toContain(
      "authorized preparing this checklist and considering activation now",
    );
    expect(runbook).toContain("explicit captain authorization naming the action");
    expect(runbook).toContain("real configured credentials");

    for (const heading of [
      "Authorization gate",
      "Exact production inputs and owners",
      "Preflight checklist",
      "Activation checklist",
      "Verification checklist",
      "Rollback and refusal checklist",
      "Evidence-capture checklist",
      "Actions that remain parked",
    ]) {
      expect(runbook).toContain(`## ${heading}`);
    }
  });

  it("pins the exact web, Neon, Stripe, alias, and desktop inputs", () => {
    for (const exactName of [
      "BETTER_AUTH_ORIGIN",
      "DATABASE_URL",
      "SCENEAXI_ADMIN_EMAIL",
      "SCENEAXI_ADMIN_BOOTSTRAP_SECRET",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "SCENEAXI_BILLING_MODE",
      "SCENEAXI_STRIPE_LIVE_AUTHORIZED",
      "NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN",
      "NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN",
      "NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN",
      "SCENEAXI_SITE_EDITOR_PREVIEW",
      "CSC_LINK",
      "CSC_KEY_PASSWORD",
      "APPLE_ID",
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_TEAM_ID",
      "SCENEAXI_MACOS_RELEASE_BASE_URL",
      "WIN_CSC_LINK",
      "WIN_CSC_KEY_PASSWORD",
      "GITHUB_RELEASE_TOKEN",
      "SCENEAXI_WINDOWS_RELEASE_TAG",
    ]) {
      expect(runbook).toContain(`\`${exactName}\``);
    }

    for (const exactValue of [
      "sceneaxi-prod",
      "misty-king-68383952",
      "aws-us-east-2",
      "neondb",
      "https://sceneaxi-umbrella.vercel.app",
      "https://sceneaxi-catalog-game.vercel.app",
      "https://sceneaxi-catalog-web.vercel.app",
      "checkout.session.completed",
      "charge.refunded",
    ]) {
      expect(runbook).toContain(exactValue);
    }
  });

  it("requires named fail-closed evidence and preserves parked work", () => {
    for (const refusal of [
      "IDENTITY_PLANE_NOT_WIRED",
      "IDENTITY_SESSION_ABSENT",
      "CREDITS_PLANE_UNAVAILABLE",
      "BILLING_CHECKOUT_ORIGIN_UNTRUSTED",
      "STRIPE_WEBHOOK_SECRET_MISSING",
      "STRIPE_LIVE_MODE_NOT_AUTHORIZED",
      "STRIPE_CONNECT_LIVE_UNAVAILABLE",
      "CATALOG_COMMERCE_INERT",
      "MACOS_ENV_REQUIRED:<name>",
      "WINDOWS_RELEASE_ENV_MISSING:<name>",
    ]) {
      expect(runbook).toContain(`\`${refusal}\``);
    }

    for (const held of [
      "custom domains",
      "Kids deployment",
      "tier-6b marketplace activation",
      "Stripe LIVE credit-pack charging",
      "Stripe Connect LIVE onboarding or payout",
      "package publication",
    ]) {
      expect(normalizedRunbook).toContain(held);
    }
  });

  it("is linked from every narrower operations owner", () => {
    for (const path of [
      "README.md",
      "docs/websites-deploy.md",
      "docs/auth-credits.md",
      "docs/stripe-live-activation.md",
      "docs/stripe-connect-operations.md",
      "docs/desktop-linux.md",
      "docs/desktop-macos.md",
      "docs/desktop-windows.md",
      "docs/program/NEXT-STEP.md",
    ]) {
      expect(read(path)).toContain("production-activation.md");
    }
  });
});
