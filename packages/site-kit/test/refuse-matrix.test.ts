/**
 * Refuse matrix: every named reason in the registry must be reachable.
 *
 * This is the test that stops a refusal reason from being declared and then never
 * wired, and stops a reachable refusal from losing its covering case. Adding a key
 * to `SITE_REFUSALS` without a case here fails the gate.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SITE_REFUSALS,
  SITE_REFUSAL_REASONS,
  type SiteRefusalReason,
  attemptCatalogPurchase,
  buildEditorDeepLink,
  createBillingPlane,
  createCreditsPlane,
  createIdentityPlane,
  createPublishIntent,
  createWebEditorSession,
  decideCapability,
  decideEditorEntitlement,
  ok,
  parseEditorDeepLink,
  parseEditorDeepLinkParams,
  readEngineSdkOffer,
  showSiteListing,
  webEditorStarterArtifact,
} from "@sceneaxi/site-kit";
import type { CatalogSurface, SiteIdentityRequest, SitePrincipal } from "@sceneaxi/site-kit";

const NOW = "2026-07-25T12:00:00.000Z";
const now = () => NOW;
const dirs: string[] = [];

const workspace = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-refuse-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

const principal = (role: string, overrides: Record<string, unknown> = {}): unknown => ({
  user: {
    userId: "user-1",
    email: "captain@example.com",
    emailVerified: true,
    disabled: false,
    ...(overrides["user"] as Record<string, unknown> | undefined),
  },
  role,
  session: {
    sessionId: "session-1",
    userId: "user-1",
    surface: "umbrella",
    issuedAt: "2026-07-25T11:00:00.000Z",
    expiresAt: "2026-07-25T13:00:00.000Z",
    ...(overrides["session"] as Record<string, unknown> | undefined),
  },
});

const identityWith = (value: unknown) =>
  createIdentityPlane({
    now,
    adapter: {
      async resolvePrincipal() {
        return ok(value as SitePrincipal);
      },
    },
  });

const umbrella: SiteIdentityRequest = { surface: "umbrella" };

const reasonOf = (value: unknown): string | null =>
  typeof value === "object" && value !== null && "reason" in value
    ? String((value as { reason: unknown }).reason)
    : null;

/**
 * One case per named reason. Each returns the value that must carry that reason,
 * so the assertion is "this exact path produces this exact reason".
 */
const CASES: Readonly<Record<SiteRefusalReason, () => Promise<unknown> | unknown>> = {
  IDENTITY_PLANE_NOT_WIRED: () => createIdentityPlane({ now }).resolvePrincipal(umbrella),
  CREDITS_PLANE_NOT_WIRED: () => createCreditsPlane().readBalance({ userId: "user-1" }),
  BILLING_PLANE_NOT_WIRED: () =>
    createBillingPlane().createCheckout({
      userId: "user-1",
      packId: "pack-100",
      successUrl: "https://example.vercel.app/ok",
      cancelUrl: "https://example.vercel.app/cancel",
      idempotencyKey: "idem-1",
    }),
  KIDS_SURFACE_DENIED: () => createIdentityPlane({ now }).resolvePrincipal({ surface: "kids" }),
  ROLE_CLAIM_FROM_CLIENT_DENIED: () =>
    createIdentityPlane({ now }).resolvePrincipal({
      surface: "umbrella",
      credentials: { isAdmin: true },
    }),
  SITE_SURFACE_UNKNOWN: () =>
    createIdentityPlane({ now }).resolvePrincipal({
      surface: "storefront",
    } as unknown as SiteIdentityRequest),
  SITE_REQUEST_MALFORMED: () =>
    createIdentityPlane({ now }).resolvePrincipal(null as unknown as SiteIdentityRequest),
  IDENTITY_ADAPTER_OUTPUT_INVALID: () => identityWith("nope").resolvePrincipal(umbrella),
  IDENTITY_ROLE_UNKNOWN: () => identityWith(principal("superuser")).resolvePrincipal(umbrella),
  IDENTITY_USER_DISABLED: () =>
    identityWith(principal("user", { user: { disabled: true } })).resolvePrincipal(umbrella),
  IDENTITY_SESSION_EXPIRED: () =>
    identityWith(
      principal("user", { session: { expiresAt: "2026-07-25T11:00:01.000Z" } }),
    ).resolvePrincipal(umbrella),
  IDENTITY_SESSION_SURFACE_MISMATCH: () =>
    identityWith(
      principal("user", { session: { surface: "catalog-game" } }),
    ).resolvePrincipal(umbrella),
  CREDIT_BALANCE_INVALID: () =>
    createCreditsPlane({
      adapter: {
        async readBalance() {
          return ok({ userId: "user-1", balance: -5, starterGrantConsumed: false });
        },
      },
    }).readBalance({ userId: "user-1" }),
  CREDIT_ADAPTER_OUTPUT_INVALID: () =>
    createCreditsPlane({
      adapter: {
        async readBalance() {
          return ok({ userId: "user-1" } as never);
        },
      },
    }).readBalance({ userId: "user-1" }),
  EDITOR_ENTITLEMENT_ANONYMOUS: () => decideEditorEntitlement({ principal: null, credits: null }),
  EDITOR_ENTITLEMENT_NO_CREDITS: () =>
    decideEditorEntitlement({
      principal: principal("user") as SitePrincipal,
      credits: ok({ userId: "user-1", balance: 0, starterGrantConsumed: true }),
    }),
  EDITOR_ENTITLEMENT_BALANCE_INVALID: () =>
    decideEditorEntitlement({
      principal: principal("user") as SitePrincipal,
      credits: ok({ userId: "user-1", balance: 1.5, starterGrantConsumed: false }),
    }),
  EDITOR_ENTITLEMENT_UNAVAILABLE: () =>
    decideEditorEntitlement({ principal: principal("user") as SitePrincipal, credits: null }),
  CAPABILITY_UNKNOWN: () => decideCapability({ capability: "teleport", access: null }),
  BILLING_LIVE_MODE_NOT_AUTHORIZED: () =>
    createBillingPlane({ mode: "live" }).listCreditPacks(),
  BILLING_URL_INSECURE: () =>
    createBillingPlane({
      adapter: {
        async listCreditPacks() {
          return ok([]);
        },
        async createCheckout() {
          return ok({ intentId: "i", redirectUrl: "https://x.example/y", mode: "test" as const });
        },
      },
    }).createCheckout({
      userId: "user-1",
      packId: "pack-100",
      successUrl: "http://insecure.example/ok",
      cancelUrl: "https://example.vercel.app/cancel",
      idempotencyKey: "idem-1",
    }),
  BILLING_CHECKOUT_REQUEST_INVALID: () =>
    createBillingPlane().createCheckout({
      userId: "",
      packId: "pack-100",
      successUrl: "https://example.vercel.app/ok",
      cancelUrl: "https://example.vercel.app/cancel",
      idempotencyKey: "idem-1",
    }),
  BILLING_ADAPTER_OUTPUT_INVALID: () =>
    createBillingPlane({
      adapter: {
        async listCreditPacks() {
          return ok([{ packId: "", credits: 1, unitAmount: 1, currency: "usd" }]);
        },
        async createCheckout() {
          return ok({ intentId: "i", redirectUrl: "https://x.example/y", mode: "test" as const });
        },
      },
    }).listCreditPacks(),
  CATALOG_COMMERCE_INERT: () =>
    attemptCatalogPurchase({
      surface: "catalog-game",
      itemId: "game-lantern-prop",
      payWith: "credits",
    }),
  CATALOG_PRICE_UNAVAILABLE: () =>
    createPublishIntent({
      creatorId: "Vhailors",
      surface: "catalog-web",
      title: "Priceless",
      price: { credits: null, money: null },
    }),
  CATALOG_ITEM_NOT_FOUND: () => showSiteListing("catalog-game", "no-such-item"),
  DEEP_LINK_SOURCE_UNKNOWN: () =>
    buildEditorDeepLink({
      umbrellaOrigin: "https://umbrella.vercel.app",
      source: "kids" as unknown as CatalogSurface,
      itemId: "x",
    }),
  DEEP_LINK_ORIGIN_INSECURE: () =>
    buildEditorDeepLink({
      umbrellaOrigin: "http://evil.example",
      source: "catalog-game",
      itemId: "x",
    }),
  DEEP_LINK_ITEM_MISSING: () =>
    parseEditorDeepLink("https://umbrella.vercel.app/editor?source=catalog-game"),
  DEEP_LINK_UNKNOWN_PARAMETER: () =>
    parseEditorDeepLinkParams({ source: "catalog-game", item: "x", token: "abc" }),
  ENGINE_SDK_ARTIFACT_MISSING: () => readEngineSdkOffer(workspace()),
  ENGINE_SDK_MANIFEST_INVALID: () => {
    const siteRoot = workspace();
    mkdirSync(join(siteRoot, "public", "engine-sdk"), { recursive: true });
    writeFileSync(join(siteRoot, "public", "engine-sdk", "sdk-manifest.json"), "{ not json");
    return readEngineSdkOffer(siteRoot);
  },
  EDITOR_SESSION_DISPOSED: () => {
    const created = createWebEditorSession({ workspaceRoot: workspace(), backend: "null" });
    if (!created.ok) return created;
    created.value.dispose();
    try {
      created.value.snapshot();
    } catch (error) {
      return error;
    }
    return null;
  },
  EDITOR_WORKSPACE_ESCAPE: () =>
    createWebEditorSession({
      workspaceRoot: workspace(),
      documentPath: "../escape.json",
      backend: "null",
    }),
  EDITOR_WORKSPACE_INVALID: () =>
    createWebEditorSession({ workspaceRoot: "not/absolute", backend: "null" }),
};

describe("refuse matrix", () => {
  it("declares a case for exactly the reasons in the registry", () => {
    expect(Object.keys(CASES).sort()).toEqual([...SITE_REFUSAL_REASONS].sort());
  });

  it("gives every reason a non-empty message", () => {
    for (const reason of SITE_REFUSAL_REASONS) {
      expect(SITE_REFUSALS[reason].length).toBeGreaterThan(0);
    }
  });

  it.each([...SITE_REFUSAL_REASONS])("reaches %s", async (reason) => {
    const produced = await CASES[reason]();
    expect(reasonOf(produced)).toBe(reason);
  });

  it("keeps the registry frozen", () => {
    expect(Object.isFrozen(SITE_REFUSALS)).toBe(true);
    expect(() => {
      (SITE_REFUSALS as Record<string, string>)["NEW_REASON"] = "x";
    }).toThrow();
  });

  it("starts from a working starter artifact, so editor cases exercise real state", () => {
    expect(webEditorStarterArtifact().ok).toBe(true);
  });
});
