import { describe, expect, it } from "vitest";
import {
  SITE_CAPABILITIES,
  SITE_CAPABILITY_IDS,
  SITE_STARTER_CREDIT_ALLOTMENT,
  type SiteCreditsPort,
  type SiteIdentityPort,
  type SitePrincipal,
  createCreditsPlane,
  createIdentityPlane,
  decideCapability,
  decideEditorEntitlement,
  ok,
  refuse,
  resolveEditorAccess,
} from "@sceneaxi/site-kit";

const NOW = "2026-07-25T12:00:00.000Z";

const principal = (role: "admin" | "user"): SitePrincipal => ({
  user: { userId: "user-1", email: "captain@example.com", emailVerified: true, disabled: false },
  role,
  session: {
    sessionId: "session-1",
    userId: "user-1",
    surface: "site",
    issuedAt: "2026-07-25T11:00:00.000Z",
    expiresAt: "2026-07-25T13:00:00.000Z",
  },
});

const balance = (value: number, starterGrantConsumed: boolean) =>
  ok({ userId: "user-1", balance: value, starterGrantConsumed });

describe("decideEditorEntitlement", () => {
  it("entitles admin unrestricted without consulting any credit reading", () => {
    const decision = decideEditorEntitlement({ principal: principal("admin"), credits: null });
    expect(decision).toEqual({
      entitled: true,
      basis: "admin-unrestricted",
      starterCredits: null,
    });
  });

  it("entitles a user with a positive balance", () => {
    expect(
      decideEditorEntitlement({ principal: principal("user"), credits: balance(1, true) }),
    ).toEqual({ entitled: true, basis: "credit-balance", starterCredits: null });
  });

  it("entitles a user on the unused 100-credit starter allotment", () => {
    expect(
      decideEditorEntitlement({ principal: principal("user"), credits: balance(0, false) }),
    ).toEqual({
      entitled: true,
      basis: "starter-allotment",
      starterCredits: SITE_STARTER_CREDIT_ALLOTMENT,
    });
    expect(SITE_STARTER_CREDIT_ALLOTMENT).toBe(100);
  });

  it("refuses a user with no credits and a consumed starter allotment", () => {
    expect(
      decideEditorEntitlement({ principal: principal("user"), credits: balance(0, true) }),
    ).toMatchObject({ entitled: false, reason: "EDITOR_ENTITLEMENT_NO_CREDITS" });
  });

  it("refuses anonymous access", () => {
    expect(decideEditorEntitlement({ principal: null, credits: null })).toMatchObject({
      entitled: false,
      reason: "EDITOR_ENTITLEMENT_ANONYMOUS",
    });
  });

  it("refuses when no credit reading was supplied for a non-admin", () => {
    expect(
      decideEditorEntitlement({ principal: principal("user"), credits: null }),
    ).toMatchObject({ entitled: false, reason: "EDITOR_ENTITLEMENT_UNAVAILABLE" });
  });

  it("propagates a credits-plane refusal verbatim", () => {
    const decision = decideEditorEntitlement({
      principal: principal("user"),
      credits: refuse("CREDITS_PLANE_NOT_WIRED"),
    });
    expect(decision).toMatchObject({ entitled: false, reason: "CREDITS_PLANE_NOT_WIRED" });
  });

  it.each([-1, 1.5, Number.NaN])("refuses an invalid balance %s", (value) => {
    expect(
      decideEditorEntitlement({
        principal: principal("user"),
        credits: ok({ userId: "user-1", balance: value, starterGrantConsumed: false }),
      }),
    ).toMatchObject({ entitled: false, reason: "EDITOR_ENTITLEMENT_BALANCE_INVALID" });
  });

  it("returns frozen decisions", () => {
    const decision = decideEditorEntitlement({ principal: null, credits: null });
    expect(Object.isFrozen(decision)).toBe(true);
  });
});

describe("resolveEditorAccess", () => {
  const identityFor = (role: "admin" | "user"): SiteIdentityPort =>
    createIdentityPlane({
      now: () => NOW,
      adapter: {
        async resolvePrincipal() {
          return ok(principal(role));
        },
      },
    });

  const spyCredits = (): SiteCreditsPort & { calls: number } => {
    const port = {
      calls: 0,
      async readBalance() {
        port.calls += 1;
        return balance(0, false);
      },
    };
    return port;
  };

  it("never touches the credits port for an admin", async () => {
    const credits = spyCredits();
    const access = await resolveEditorAccess({
      identity: identityFor("admin"),
      credits,
      request: { surface: "site" },
    });
    expect(access.entitlement).toMatchObject({ entitled: true, basis: "admin-unrestricted" });
    expect(credits.calls).toBe(0);
  });

  it("reads the balance for a non-admin", async () => {
    const credits = spyCredits();
    const access = await resolveEditorAccess({
      identity: identityFor("user"),
      credits,
      request: { surface: "site" },
    });
    expect(credits.calls).toBe(1);
    expect(access.entitlement).toMatchObject({ entitled: true, basis: "starter-allotment" });
  });

  it("surfaces the identity refusal when the plane is unwired", async () => {
    const access = await resolveEditorAccess({
      identity: createIdentityPlane({ now: () => NOW }),
      credits: createCreditsPlane(),
      request: { surface: "site" },
    });
    expect(access.principal).toBeNull();
    expect(access.entitlement).toMatchObject({
      entitled: false,
      reason: "IDENTITY_PLANE_NOT_WIRED",
    });
  });
});

describe("free-vs-paid capability matrix", () => {
  it("refuses an unknown capability", () => {
    expect(decideCapability({ capability: "teleport", access: null })).toMatchObject({
      allowed: false,
      reason: "CAPABILITY_UNKNOWN",
    });
  });

  it("serves every free capability to an anonymous visitor", () => {
    const free = SITE_CAPABILITY_IDS.filter((id) => SITE_CAPABILITIES[id].tier === "free");
    expect(free.length).toBeGreaterThan(0);
    for (const capability of free) {
      expect(decideCapability({ capability, access: null })).toMatchObject({
        allowed: true,
        tier: "free",
      });
    }
  });

  it("refuses every paid capability while the planes are unwired", async () => {
    const access = await resolveEditorAccess({
      identity: createIdentityPlane({ now: () => NOW }),
      credits: createCreditsPlane(),
      request: { surface: "site" },
    });
    const paid = SITE_CAPABILITY_IDS.filter((id) => SITE_CAPABILITIES[id].tier === "paid");
    expect(paid.length).toBeGreaterThan(0);
    for (const capability of paid) {
      expect(decideCapability({ capability, access })).toMatchObject({ allowed: false });
    }
  });

  it("keeps catalog purchase inert even for an entitled admin", async () => {
    const access = await resolveEditorAccess({
      identity: createIdentityPlane({
        now: () => NOW,
        adapter: {
          async resolvePrincipal() {
            return ok(principal("admin"));
          },
        },
      }),
      credits: createCreditsPlane(),
      request: { surface: "site" },
    });
    expect(access.entitlement.entitled).toBe(true);
    expect(decideCapability({ capability: "catalog-purchase", access })).toMatchObject({
      allowed: false,
      reason: "CATALOG_COMMERCE_INERT",
    });
    expect(decideCapability({ capability: "web-editor", access })).toMatchObject({
      allowed: true,
      tier: "paid",
    });
  });

  it("allows credit-pack checkout only when billing is wired", () => {
    expect(
      decideCapability({ capability: "credit-pack-checkout", access: null }),
    ).toMatchObject({ allowed: false, reason: "BILLING_PLANE_NOT_WIRED" });
    expect(
      decideCapability({ capability: "credit-pack-checkout", access: null, billingWired: true }),
    ).toMatchObject({ allowed: true });
  });

  describe("hosted-ai requires a positive credit balance for a non-admin", () => {
    const accessFor = (
      role: "admin" | "user",
      credits: ReturnType<typeof balance> | null,
    ) => {
      const p = principal(role);
      return {
        principal: p,
        identity: ok(p),
        credits,
        entitlement: decideEditorEntitlement({ principal: p, credits }),
      };
    };

    it("allows an admin without consulting a credit balance", () => {
      expect(
        decideCapability({ capability: "hosted-ai", access: accessFor("admin", null) }),
      ).toMatchObject({ allowed: true });
    });

    it("allows a non-admin with a positive balance", () => {
      expect(
        decideCapability({ capability: "hosted-ai", access: accessFor("user", balance(5, true)) }),
      ).toMatchObject({ allowed: true });
    });

    it("refuses a non-admin whose only eligibility is the unused starter allotment", () => {
      const access = accessFor("user", balance(0, false));
      expect(access.entitlement).toMatchObject({ entitled: true, basis: "starter-allotment" });
      expect(decideCapability({ capability: "hosted-ai", access })).toMatchObject({
        allowed: false,
        reason: "HOSTED_AI_REQUIRES_CREDITS",
      });
    });

    it("refuses when no credit reading is available for a non-admin", () => {
      expect(
        decideCapability({ capability: "hosted-ai", access: accessFor("user", null) }),
      ).toMatchObject({ allowed: false, reason: "HOSTED_AI_REQUIRES_CREDITS" });
    });
  });

  it("publishes a frozen matrix covering exactly the documented capabilities", () => {
    expect(Object.isFrozen(SITE_CAPABILITIES)).toBe(true);
    expect([...SITE_CAPABILITY_IDS].sort()).toEqual(
      [
        "catalog-browse",
        "catalog-detail",
        "catalog-purchase",
        "cli-byo-ai-docs",
        "credit-pack-checkout",
        "docs-and-product",
        "engine-sdk-download",
        "hosted-ai",
        "web-editor",
      ].sort(),
    );
  });
});
