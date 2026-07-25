import { describe, expect, it } from "vitest";
import {
  type SiteBillingAdapter,
  type SiteCreditsAdapter,
  type SiteIdentityAdapter,
  type SiteIdentityRequest,
  type SitePrincipal,
  createBillingPlane,
  createCreditsPlane,
  createIdentityPlane,
  hasClientRoleClaim,
  ok,
  refuse,
} from "@sceneaxi/site-kit";

const NOW = "2026-07-25T12:00:00.000Z";
const now = () => NOW;

const principal = (
  overrides: {
    readonly role?: "admin" | "user" | string;
    readonly disabled?: boolean;
    readonly surface?: string;
    readonly expiresAt?: string;
  } = {},
): unknown => ({
  user: {
    userId: "user-1",
    email: "captain@example.com",
    emailVerified: true,
    disabled: overrides.disabled ?? false,
  },
  role: overrides.role ?? "user",
  session: {
    sessionId: "session-1",
    userId: "user-1",
    surface: overrides.surface ?? "umbrella",
    issuedAt: "2026-07-25T11:00:00.000Z",
    expiresAt: overrides.expiresAt ?? "2026-07-25T13:00:00.000Z",
  },
});

const adapterReturning = (value: unknown): SiteIdentityAdapter & { calls: number } => {
  const adapter = {
    calls: 0,
    async resolvePrincipal() {
      adapter.calls += 1;
      return ok(value as SitePrincipal);
    },
  };
  return adapter;
};

const umbrella: SiteIdentityRequest = { surface: "umbrella" };

describe("identity plane — fail closed", () => {
  it("refuses IDENTITY_PLANE_NOT_WIRED with no adapter, never an anonymous allow", async () => {
    const result = await createIdentityPlane({ now }).resolvePrincipal(umbrella);
    expect(result).toEqual({
      ok: false,
      reason: "IDENTITY_PLANE_NOT_WIRED",
      message: expect.any(String),
    });
  });

  it("refuses the Kids surface before any adapter dispatch, not overridable by an adapter", async () => {
    const adapter = adapterReturning(principal());
    const port = createIdentityPlane({ adapter, now });
    const result = await port.resolvePrincipal({ surface: "kids" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("KIDS_SURFACE_DENIED");
    expect(adapter.calls).toBe(0);
  });

  it.each(["role", "roles", "admin", "isAdmin"])(
    "refuses a client-supplied '%s' claim before any adapter dispatch",
    async (key) => {
      const adapter = adapterReturning(principal());
      const port = createIdentityPlane({ adapter, now });
      const result = await port.resolvePrincipal({
        surface: "umbrella",
        credentials: { email: "a@b.c", [key]: "admin" },
      });
      expect(result.ok === false && result.reason).toBe("ROLE_CLAIM_FROM_CLIENT_DENIED");
      expect(adapter.calls).toBe(0);
    },
  );

  it("finds a nested role claim, because depth does not make it safe", () => {
    expect(hasClientRoleClaim({ user: { profile: { isAdmin: true } } })).toBe(true);
    expect(hasClientRoleClaim({ user: { email: "a@b.c" } })).toBe(false);
  });

  it("finds claims at arbitrary depth and terminates on cycles", () => {
    let nested: Record<string, unknown> = { role: "admin" };
    for (let depth = 0; depth < 20; depth += 1) nested = { nested };
    expect(hasClientRoleClaim(nested)).toBe(true);
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    expect(hasClientRoleClaim(cyclic)).toBe(false);
  });

  it("refuses an unknown surface and a malformed request", async () => {
    const port = createIdentityPlane({ now });
    expect(
      await port.resolvePrincipal({ surface: "storefront" } as unknown as SiteIdentityRequest),
    ).toMatchObject({ reason: "SITE_SURFACE_UNKNOWN" });
    expect(
      await port.resolvePrincipal(undefined as unknown as SiteIdentityRequest),
    ).toMatchObject({ reason: "SITE_REQUEST_MALFORMED" });
    expect(
      await port.resolvePrincipal({ surface: "umbrella", sessionToken: 7 } as unknown as SiteIdentityRequest),
    ).toMatchObject({ reason: "SITE_REQUEST_MALFORMED" });
  });

  it("accepts a valid principal and freezes it", async () => {
    const port = createIdentityPlane({ adapter: adapterReturning(principal()), now });
    const result = await port.resolvePrincipal(umbrella);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.role).toBe("user");
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(() => {
      (result.value as { role: string }).role = "admin";
    }).toThrow();
  });

  it.each([
    ["IDENTITY_ROLE_UNKNOWN", principal({ role: "superuser" })],
    ["IDENTITY_USER_DISABLED", principal({ disabled: true })],
    ["IDENTITY_SESSION_SURFACE_MISMATCH", principal({ surface: "catalog-game" })],
    ["IDENTITY_SESSION_EXPIRED", principal({ expiresAt: "2026-07-25T11:59:59.000Z" })],
    ["IDENTITY_ADAPTER_OUTPUT_INVALID", { user: {}, role: "user", session: {} }],
    ["IDENTITY_ADAPTER_OUTPUT_INVALID", "not-an-object"],
  ])("validates adapter output and refuses %s", async (reason, value) => {
    const port = createIdentityPlane({ adapter: adapterReturning(value), now });
    const result = await port.resolvePrincipal(umbrella);
    expect(result.ok === false && result.reason).toBe(reason);
  });

  it("canonicalizes a known adapter refusal", async () => {
    const forged = {
      ok: false as const,
      reason: "IDENTITY_SESSION_EXPIRED" as const,
      message: "forged",
    };
    const adapter: SiteIdentityAdapter = {
      async resolvePrincipal() {
        return forged;
      },
    };
    const result = await createIdentityPlane({ adapter, now }).resolvePrincipal(umbrella);
    expect(result).toEqual(refuse("IDENTITY_SESSION_EXPIRED"));
    expect(result).not.toBe(forged);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("refuses an unknown adapter refusal reason", async () => {
    const adapter: SiteIdentityAdapter = {
      async resolvePrincipal() {
        return {
          ok: false,
          reason: "INVENTED_REASON",
          message: "not registered",
        } as never;
      },
    };
    expect(await createIdentityPlane({ adapter, now }).resolvePrincipal(umbrella)).toMatchObject({
      reason: "IDENTITY_ADAPTER_OUTPUT_INVALID",
    });
  });
});

describe("credits plane — reads a balance, never derives one", () => {
  it("refuses CREDITS_PLANE_NOT_WIRED with no adapter", async () => {
    const result = await createCreditsPlane().readBalance({ userId: "user-1" });
    expect(result.ok === false && result.reason).toBe("CREDITS_PLANE_NOT_WIRED");
  });

  it("refuses a malformed input", async () => {
    const result = await createCreditsPlane().readBalance({ userId: "  " });
    expect(result.ok === false && result.reason).toBe("SITE_REQUEST_MALFORMED");
  });

  it.each([
    ["CREDIT_BALANCE_INVALID", { userId: "user-1", balance: -1, starterGrantConsumed: false }],
    ["CREDIT_BALANCE_INVALID", { userId: "user-1", balance: 1.5, starterGrantConsumed: false }],
    ["CREDIT_ADAPTER_OUTPUT_INVALID", { userId: "user-2", balance: 5, starterGrantConsumed: false }],
    ["CREDIT_ADAPTER_OUTPUT_INVALID", { userId: "user-1", balance: 5 }],
    ["CREDIT_ADAPTER_OUTPUT_INVALID", null],
  ])("validates adapter output and refuses %s", async (reason, value) => {
    const adapter: SiteCreditsAdapter = {
      async readBalance() {
        return ok(value as never);
      },
    };
    const result = await createCreditsPlane({ adapter }).readBalance({ userId: "user-1" });
    expect(result.ok === false && result.reason).toBe(reason);
  });

  it("accepts a valid balance and freezes it", async () => {
    const adapter: SiteCreditsAdapter = {
      async readBalance() {
        return ok({ userId: "user-1", balance: 42, starterGrantConsumed: true });
      },
    };
    const result = await createCreditsPlane({ adapter }).readBalance({ userId: "user-1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.balance).toBe(42);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it("canonicalizes valid refusals and rejects unknown refusal reasons", async () => {
    const known: SiteCreditsAdapter = {
      async readBalance() {
        return {
          ok: false,
          reason: "CREDIT_BALANCE_INVALID",
          message: "forged",
        };
      },
    };
    const canonical = await createCreditsPlane({ adapter: known }).readBalance({
      userId: "user-1",
    });
    expect(canonical).toEqual(refuse("CREDIT_BALANCE_INVALID"));
    expect(Object.isFrozen(canonical)).toBe(true);

    const unknown: SiteCreditsAdapter = {
      async readBalance() {
        return { ok: false, reason: "INVENTED_REASON", message: "forged" } as never;
      },
    };
    expect(
      await createCreditsPlane({ adapter: unknown }).readBalance({ userId: "user-1" }),
    ).toMatchObject({ reason: "CREDIT_ADAPTER_OUTPUT_INVALID" });
  });
});

describe("billing plane — test by default, live behind a captain gate", () => {
  const checkout = {
    userId: "user-1",
    packId: "pack-100",
    successUrl: "https://sceneaxi-umbrella.vercel.app/pricing?ok=1",
    cancelUrl: "https://sceneaxi-umbrella.vercel.app/pricing?cancel=1",
    idempotencyKey: "idem-1",
  };

  const adapter: SiteBillingAdapter = {
    async listCreditPacks() {
      return ok([{ packId: "pack-100", credits: 100, unitAmount: 500, currency: "usd" }]);
    },
    async createCheckout(request) {
      return ok({
        intentId: "intent-1",
        redirectUrl: "https://checkout.stripe.com/test/session",
        mode: request.mode,
      });
    },
  };

  it("defaults to test mode", () => {
    expect(createBillingPlane().mode).toBe("test");
  });

  it("refuses BILLING_PLANE_NOT_WIRED with no adapter", async () => {
    const plane = createBillingPlane();
    expect((await plane.listCreditPacks()).ok).toBe(false);
    expect(await plane.createCheckout(checkout)).toMatchObject({
      reason: "BILLING_PLANE_NOT_WIRED",
    });
  });

  it("refuses live mode without explicit authorization", async () => {
    const plane = createBillingPlane({ adapter, mode: "live" });
    expect(await plane.createCheckout(checkout)).toMatchObject({
      reason: "BILLING_LIVE_MODE_NOT_AUTHORIZED",
    });
    expect(await plane.listCreditPacks()).toMatchObject({
      reason: "BILLING_LIVE_MODE_NOT_AUTHORIZED",
    });
  });

  it("refuses non-https checkout URLs", async () => {
    const plane = createBillingPlane({ adapter });
    expect(
      await plane.createCheckout({ ...checkout, successUrl: "http://evil.example/ok" }),
    ).toMatchObject({ reason: "BILLING_URL_INSECURE" });
  });

  it("refuses a malformed checkout request", async () => {
    const plane = createBillingPlane({ adapter });
    expect(await plane.createCheckout({ ...checkout, idempotencyKey: "" })).toMatchObject({
      reason: "BILLING_CHECKOUT_REQUEST_INVALID",
    });
  });

  it("stamps test mode onto the handoff and validates adapter output", async () => {
    const plane = createBillingPlane({ adapter });
    const result = await plane.createCheckout(checkout);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mode).toBe("test");
    expect(Object.isFrozen(result.value)).toBe(true);

    const liar: SiteBillingAdapter = {
      ...adapter,
      async createCheckout() {
        return ok({ intentId: "x", redirectUrl: "http://insecure", mode: "test" as const });
      },
    };
    expect(await createBillingPlane({ adapter: liar }).createCheckout(checkout)).toMatchObject({
      reason: "BILLING_ADAPTER_OUTPUT_INVALID",
    });
  });

  it("refuses a malformed credit pack list", async () => {
    const liar: SiteBillingAdapter = {
      ...adapter,
      async listCreditPacks() {
        return ok([{ packId: "", credits: 1, unitAmount: 1, currency: "usd" }]);
      },
    };
    expect(await createBillingPlane({ adapter: liar }).listCreditPacks()).toMatchObject({
      reason: "BILLING_ADAPTER_OUTPUT_INVALID",
    });
  });

  it("canonicalizes valid refusals and rejects unknown refusal reasons", async () => {
    const known: SiteBillingAdapter = {
      ...adapter,
      async listCreditPacks() {
        return {
          ok: false,
          reason: "BILLING_PLANE_NOT_WIRED",
          message: "forged",
        };
      },
    };
    const canonical = await createBillingPlane({ adapter: known }).listCreditPacks();
    expect(canonical).toEqual(refuse("BILLING_PLANE_NOT_WIRED"));
    expect(Object.isFrozen(canonical)).toBe(true);

    const unknown: SiteBillingAdapter = {
      ...adapter,
      async listCreditPacks() {
        return { ok: false, reason: "INVENTED_REASON", message: "forged" } as never;
      },
    };
    expect(await createBillingPlane({ adapter: unknown }).listCreditPacks()).toMatchObject({
      reason: "BILLING_ADAPTER_OUTPUT_INVALID",
    });
  });
});
