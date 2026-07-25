import { describe, expect, it } from "vitest";
import { AUTH_REFUSE_REASONS, digestSessionToken } from "@sceneaxi/auth";
import {
  ENTITLEMENT_CAPABILITIES,
  ENTITLEMENT_MATRIX,
  STARTER_CREDIT_GRANT,
  validateEntitlementDecision,
  type CreditAccount,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  STARTER_IDEMPOTENCY_PREFIX,
  appendCreditEntry,
  createLedgerState,
  evaluateEntitlement,
  grantStarterCredits,
  type LedgerState,
} from "@sceneaxi/billing";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const admin = { email: "captain@example.com", source: "SCENEAXI_ADMIN_EMAIL" } as const;

const ACCOUNT = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.credit-account",
  accountId: "acc_crew",
  userId: "usr_crew",
  createdAt: "2026-07-25T09:00:00Z",
}) as CreditAccount;

const principal = (
  overrides: {
    userId?: string;
    role?: "admin" | "user";
    surface?: string;
    disabled?: boolean;
    expiresAt?: string;
  } = {},
): unknown => {
  const userId = overrides.userId ?? "usr_crew";
  const role = overrides.role ?? "user";
  return {
    user: {
      schemaVersion: 1,
      kind: "sceneaxi.user",
      userId,
      email: role === "admin" ? "captain@example.com" : "crew@example.com",
      emailVerified: true,
      disabled: overrides.disabled ?? false,
      createdAt: "2026-07-25T09:00:00Z",
    },
    role: {
      schemaVersion: 1,
      kind: "sceneaxi.role-assignment",
      userId,
      role,
      source: role === "admin" ? "admin-env" : "default-user",
      assignedAt: "2026-07-25T09:30:00Z",
    },
    session: {
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: "ses_01",
      userId,
      surface: overrides.surface ?? "web-shell",
      issuedAt: "2026-07-25T09:00:00Z",
      expiresAt: overrides.expiresAt ?? "2026-07-26T10:00:00Z",
      tokenDigest: digestSessionToken("tok"),
    },
  };
};

const funded = (credits: number): LedgerState => {
  if (credits === 0) return createLedgerState(ACCOUNT);
  const appended = appendCreditEntry(createLedgerState(ACCOUNT), {
    entryId: "ent_fund",
    movement: "grant",
    delta: credits,
    reason: "test funding",
    idempotencyKey: "fixture:fund",
    now: NOW,
  });
  if (!appended.ok) throw new Error("fixture funding failed");
  return appended.value.state;
};

const FREE_CAPABILITIES = [
  "engine-sdk-download",
  "cli-authoring",
  "byo-model-keys",
] as const;

const PAID_CAPABILITIES = ENTITLEMENT_CAPABILITIES.filter(
  (capability) => ENTITLEMENT_MATRIX[capability].accountRequired,
);

describe("the free path", () => {
  it("resolves with no principal at all", () => {
    for (const capability of FREE_CAPABILITIES) {
      const result = evaluateEntitlement({ capability, now: NOW });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.outcome).toBe("allow-free");
      expect(validateEntitlementDecision(result.value).ok).toBe(true);
    }
  });

  it("resolves without consulting a ledger, even when one is passed", () => {
    for (const capability of FREE_CAPABILITIES) {
      const result = evaluateEntitlement({
        capability,
        now: NOW,
        state: funded(0),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.outcome).toBe("allow-free");
    }
  });

  it("never burns credits for bring-your-own model keys", () => {
    const state = funded(500);
    const result = evaluateEntitlement({
      capability: "byo-model-keys",
      now: NOW,
      principal: principal(),
      admin,
      state,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe("allow-free");
    // The decision names no charge, and nothing was appended.
    expect(result.value).not.toHaveProperty("credits");
    expect(state.entries.length).toBe(1);
    expect(state.balance).toBe(500);
  });
});

describe("paid capabilities", () => {
  it("refuse an anonymous caller before reading any balance", () => {
    for (const capability of PAID_CAPABILITIES) {
      const result = evaluateEntitlement({ capability, now: NOW });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountRequired);
    }
  });

  it("charge the exact credit amount when the balance covers it", () => {
    const result = evaluateEntitlement({
      capability: "hosted-ai-assistant",
      now: NOW,
      principal: principal(),
      admin,
      state: funded(100),
      creditAmount: 25,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe("charge-credits");
    expect(result.value.credits).toBe(25);
  });

  it("refuse an insufficient balance", () => {
    const result = evaluateEntitlement({
      capability: "hosted-ai-assistant",
      now: NOW,
      principal: principal(),
      admin,
      state: funded(10),
      creditAmount: 25,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.balanceInsufficient);
  });

  it("allow an exact-balance charge", () => {
    const result = evaluateEntitlement({
      capability: "metered-model-port",
      now: NOW,
      principal: principal(),
      admin,
      state: funded(25),
      creditAmount: 25,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe("charge-credits");
  });

  it("refuse a credit-priced capability with no amount or no ledger", () => {
    const noAmount = evaluateEntitlement({
      capability: "hosted-ai-assistant",
      now: NOW,
      principal: principal(),
      admin,
      state: funded(100),
    });
    expect(noAmount.ok).toBe(false);
    if (!noAmount.ok) {
      expect(noAmount.reason).toBe(
        BILLING_REFUSE_REASONS.creditAmountRequired,
      );
    }

    const noState = evaluateEntitlement({
      capability: "hosted-ai-assistant",
      now: NOW,
      principal: principal(),
      admin,
      creditAmount: 5,
    });
    expect(noState.ok).toBe(false);
    if (!noState.ok) {
      expect(noState.reason).toBe(BILLING_REFUSE_REASONS.ledgerStateInvalid);
    }
  });

  it("refuse a ledger belonging to someone else", () => {
    const result = evaluateEntitlement({
      capability: "hosted-ai-assistant",
      now: NOW,
      principal: principal({ userId: "usr_someone" }),
      admin,
      state: funded(100),
      creditAmount: 5,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.accountNotOwned);
  });

  it("send a money-priced capability to checkout", () => {
    const result = evaluateEntitlement({
      capability: "credit-pack-purchase",
      now: NOW,
      principal: principal(),
      admin,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe("allow-checkout");
  });

  it("treat creator-publish as free but account-gated", () => {
    const anonymous = evaluateEntitlement({
      capability: "creator-publish",
      now: NOW,
    });
    expect(anonymous.ok).toBe(false);
    if (!anonymous.ok) {
      expect(anonymous.reason).toBe(BILLING_REFUSE_REASONS.accountRequired);
    }

    const signedIn = evaluateEntitlement({
      capability: "creator-publish",
      now: NOW,
      principal: principal(),
      admin,
    });
    expect(signedIn.ok).toBe(true);
    if (signedIn.ok) expect(signedIn.value.outcome).toBe("allow-free");
  });

  it("require a payment method for a credits-or-money capability", () => {
    const unstated = evaluateEntitlement({
      capability: "catalog-asset-purchase",
      now: NOW,
      principal: principal(),
      admin,
      state: funded(100),
      creditAmount: 10,
    });
    expect(unstated.ok).toBe(false);
    if (!unstated.ok) {
      expect(unstated.reason).toBe(
        BILLING_REFUSE_REASONS.paymentMethodRequired,
      );
    }

    const withCredits = evaluateEntitlement({
      capability: "catalog-asset-purchase",
      now: NOW,
      principal: principal(),
      admin,
      state: funded(100),
      creditAmount: 10,
      payWith: "credits",
    });
    expect(withCredits.ok).toBe(true);
    if (withCredits.ok) {
      expect(withCredits.value.outcome).toBe("charge-credits");
    }

    const withMoney = evaluateEntitlement({
      capability: "catalog-asset-purchase",
      now: NOW,
      principal: principal(),
      admin,
      payWith: "money",
    });
    expect(withMoney.ok).toBe(true);
    if (withMoney.ok) expect(withMoney.value.outcome).toBe("allow-checkout");
  });

  it("refuse an unrecognised payment method", () => {
    const result = evaluateEntitlement({
      capability: "catalog-asset-purchase",
      now: NOW,
      principal: principal(),
      admin,
      payWith: "barter" as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.paymentMethodRequired);
  });
});

describe("admin allowance", () => {
  it("is unlimited for every paid capability and charges nothing", () => {
    const state = funded(0);
    for (const capability of PAID_CAPABILITIES) {
      const result = evaluateEntitlement({
        capability,
        now: NOW,
        principal: principal({ role: "admin" }),
        admin,
        state,
        creditAmount: 1_000_000,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.outcome).toBe("allow-unlimited");
      expect(result.value).not.toHaveProperty("credits");
    }
    expect(state.entries.length).toBe(0);
    expect(state.balance).toBe(0);
  });
});

describe("Kids commerce", () => {
  it("is denied on every capability, free ones included", () => {
    for (const capability of ENTITLEMENT_CAPABILITIES) {
      const result = evaluateEntitlement({
        capability,
        now: NOW,
        surface: "kids",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
    }
  });

  it("is denied even for an admin with a Kids surface", () => {
    const result = evaluateEntitlement({
      capability: "hosted-ai-assistant",
      now: NOW,
      surface: "kids",
      principal: principal({ role: "admin", surface: "kids" }),
      admin,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
  });

  it("is denied when only the principal's session is Kids", () => {
    for (const capability of ENTITLEMENT_CAPABILITIES) {
      const result = evaluateEntitlement({
        capability,
        now: NOW,
        principal: principal({ surface: "kids" }),
        admin,
        state: funded(100),
        creditAmount: 5,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.kidsCommerceDenied);
    }
  });
});

describe("unknown capabilities and bad input", () => {
  it("refuse rather than defaulting to allow", () => {
    for (const capability of [
      "everything",
      "",
      "__proto__",
      "toString",
      42,
      undefined,
      null,
    ]) {
      const result = evaluateEntitlement({ capability, now: NOW });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.capabilityUnknown);
    }
  });

  it("refuse a bad clock", () => {
    const result = evaluateEntitlement({
      capability: "cli-authoring",
      now: Number.NaN,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.clockInvalid);
  });

  it("surface the guard's reason for a disabled or expired principal", () => {
    const disabled = evaluateEntitlement({
      capability: "hosted-ai-assistant",
      now: NOW,
      principal: principal({ disabled: true }),
      admin,
      state: funded(100),
      creditAmount: 5,
    });
    expect(disabled.ok).toBe(false);
    if (!disabled.ok) {
      expect(disabled.reason).toBe(AUTH_REFUSE_REASONS.userDisabled);
    }

    const expired = evaluateEntitlement({
      capability: "hosted-ai-assistant",
      now: NOW,
      principal: principal({ expiresAt: "2026-07-25T09:30:00Z" }),
      admin,
      state: funded(100),
      creditAmount: 5,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.reason).toBe(AUTH_REFUSE_REASONS.sessionExpired);
    }
  });
});

describe("grantStarterCredits", () => {
  it("refuses a malformed request envelope", () => {
    const result = grantStarterCredits(null as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.requestInvalid);
    }
  });

  it("grants exactly 100 credits", () => {
    const result = grantStarterCredits({
      state: createLedgerState(ACCOUNT),
      userId: "usr_crew",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.balance).toBe(STARTER_CREDIT_GRANT);
    expect(result.value.state.balance).toBe(100);
    expect(result.value.entry?.idempotencyKey).toBe(
      `${STARTER_IDEMPOTENCY_PREFIX}usr_crew`,
    );
    expect(result.value.replayed).toBe(false);
  });

  it("grants nothing on a second attempt", () => {
    const first = grantStarterCredits({
      state: createLedgerState(ACCOUNT),
      userId: "usr_crew",
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = grantStarterCredits({
      state: first.value.state,
      userId: "usr_crew",
      now: NOW + 86_400_000,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.replayed).toBe(true);
    expect(second.value.state.balance).toBe(100);
    expect(second.value.state.entries.length).toBe(1);
  });

  it("is safe to attempt on every sign-in", () => {
    let state = createLedgerState(ACCOUNT);
    for (let i = 0; i < 5; i += 1) {
      const result = grantStarterCredits({
        state,
        userId: "usr_crew",
        now: NOW + i * 1_000,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.value.state;
    }
    expect(state.balance).toBe(100);
    expect(state.entries.length).toBe(1);
  });

  it("refuses another user's account, an empty id, and a bad state", () => {
    expect(
      grantStarterCredits({
        state: createLedgerState(ACCOUNT),
        userId: "usr_someone",
        now: NOW,
      }).ok,
    ).toBe(false);
    expect(
      grantStarterCredits({
        state: createLedgerState(ACCOUNT),
        userId: "",
        now: NOW,
      }).ok,
    ).toBe(false);
    expect(
      grantStarterCredits({
        state: { entries: [] } as never,
        userId: "usr_crew",
        now: NOW,
      }).ok,
    ).toBe(false);
  });
});
