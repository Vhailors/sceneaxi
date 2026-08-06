/**
 * Runtime provenance for admin principals and verified Stripe evidence
 * (sceneaxi#126).
 *
 * Five values in the identity/credits plane mean "a trusted step produced me":
 * the `AdminIdentity` a deployment resolves from `SCENEAXI_ADMIN_EMAIL`, the
 * `Principal` an identity port issues, the `VerifiedWebhook` a signature check
 * produces, and the `VerifiedCheckoutCompletion` and `VerifiedCreditPackRefund`
 * parsed out of it. Each had *structural* enforcement — right shape, right
 * contents — plus a type-level brand. Neither stops a JavaScript caller or an
 * `as` cast, and both of those reach the same exported functions inside the
 * server process.
 *
 * This suite is the executable statement of the closed boundary. It builds every
 * plausible impostor of each value — a hand-written literal, a spread, an
 * `Object.assign`, a `structuredClone`, a JSON round-trip, a `Proxy` — and
 * asserts each is refused **by name**, then asserts the genuine article still
 * grants exactly once and a redelivery still grants nothing. That pairing is the
 * point: a boundary that refused everything would also be a passing test.
 *
 * These impostors deliberately carry the *correct* contents. A guard that read
 * only shape would admit every one of them.
 */

import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  createRoleGuards,
  digestSessionToken,
  hasAdminIdentityProvenance,
  hasPrincipalProvenance,
  requireAuthenticated,
  requireRole,
  resolveAdminIdentity,
  type AdminIdentity,
} from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  CHECKOUT_METADATA_KEYS,
  applyCheckoutCompletedGrant,
  applyCreditPackRefund,
  createInMemoryCreditStore,
  createLedgerState,
  hasVerifiedCompletionProvenance,
  hasVerifiedRefundProvenance,
  hasVerifiedWebhookProvenance,
  parseCheckoutCompletedEvent,
  parseCreditPackRefundEvent,
  persistCreditPackRefund,
  settleFixtureListingMoneySale,
  signStripeWebhookPayload,
  verifyStripeWebhookSignature,
  type VerifiedCheckoutCompletion,
  type VerifiedCreditPackRefund,
} from "@sceneaxi/billing";
import type {
  CheckoutSessionIntent,
  CreditAccount,
  Principal,
} from "@sceneaxi/schemas";
import { issuePrincipalForTest } from "@sceneaxi/auth/testing/principal-issuance";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const NOW_SECONDS = Math.floor(NOW / 1000);
const CAPTAIN_EMAIL = "captain@example.com";
const ATTACKER_EMAIL = "attacker@example.com";
const SECRET = "whsec_runtime_provenance_fixture";

const ENV = Object.freeze({ [ADMIN_EMAIL_ENV_VAR]: CAPTAIN_EMAIL });

const resolvedAdmin = (): AdminIdentity => {
  const resolved = resolveAdminIdentity(ENV);
  if (!resolved.ok) throw new Error(`fixture admin unresolved: ${resolved.reason}`);
  return resolved.value;
};

const ACCOUNT = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.credit-account",
  accountId: "acc_captain",
  userId: "usr_captain",
  createdAt: "2026-07-25T09:00:00Z",
}) as CreditAccount;

/**
 * The captain's own principal, assembled the way the identity port assembles
 * one. It is genuinely the admin's user record, so nothing but provenance can
 * be what refuses the impostor guards below.
 */
const captainPrincipal = () =>
  issuePrincipalForTest({
    user: {
      schemaVersion: 1,
      kind: "sceneaxi.user",
      userId: "usr_captain",
      email: CAPTAIN_EMAIL,
      emailVerified: true,
      disabled: false,
      createdAt: "2026-07-25T09:00:00Z",
    },
    role: {
      schemaVersion: 1,
      kind: "sceneaxi.role-assignment",
      userId: "usr_captain",
      role: "admin",
      source: "admin-env",
      assignedAt: "2026-07-25T09:30:00Z",
    },
    session: {
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: "ses_captain",
      userId: "usr_captain",
      surface: "web-shell",
      issuedAt: "2026-07-25T09:00:00Z",
      expiresAt: "2026-07-26T10:00:00Z",
      tokenDigest: digestSessionToken("tok"),
    },
  });

/**
 * The same principal, but named by the attacker's address — the shape a caller
 * who also supplies the `admin` option would build to elevate themselves.
 */
const attackerPrincipal = () =>
  issuePrincipalForTest({
    user: {
      schemaVersion: 1,
      kind: "sceneaxi.user",
      userId: "usr_attacker",
      email: ATTACKER_EMAIL,
      emailVerified: true,
      disabled: false,
      createdAt: "2026-07-25T09:00:00Z",
    },
    role: {
      schemaVersion: 1,
      kind: "sceneaxi.role-assignment",
      userId: "usr_attacker",
      role: "admin",
      source: "admin-env",
      assignedAt: "2026-07-25T09:30:00Z",
    },
    session: {
      schemaVersion: 1,
      kind: "sceneaxi.session",
      sessionId: "ses_attacker",
      userId: "usr_attacker",
      surface: "web-shell",
      issuedAt: "2026-07-25T09:00:00Z",
      expiresAt: "2026-07-26T10:00:00Z",
      tokenDigest: digestSessionToken("tok"),
    },
  });

/**
 * Every way to end up holding a look-alike of an issued value without having
 * called the step that issues it. Each returns a *plain* object of exactly the
 * right shape, so structural validation downstream would accept all of them.
 */
const copiesOf = <Value extends object>(
  value: Value,
): ReadonlyArray<readonly [string, Value]> => [
  ["spread copy", { ...value }],
  ["Object.assign target", Object.assign({}, value)],
  ["structuredClone", structuredClone(value) as Value],
  ["JSON round-trip", JSON.parse(JSON.stringify(value)) as Value],
  ["Proxy wrapper", new Proxy(value, {})],
];

const INTENT: CheckoutSessionIntent = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.checkout-session-intent",
  intentId: "int_provenance",
  userId: "usr_captain",
  purpose: "credit-pack",
  itemId: "starter",
  credits: 100,
  unitAmount: 500,
  currency: "usd",
  stripePriceId: "price_test_starter_100",
  mode: "test",
  successUrl: "https://sceneaxi.example/ok",
  cancelUrl: "https://sceneaxi.example/no",
  idempotencyKey: "checkout:provenance",
  createdAt: "2026-07-25T09:00:00Z",
}) as CheckoutSessionIntent;

const SESSION_ID = "cs_provenance";

const SETTLEMENT = Object.freeze({
  sessionId: SESSION_ID,
  paymentStatus: "paid",
  amountTotal: INTENT.unitAmount,
  currency: INTENT.currency,
  quantity: 1,
  stripePriceId: INTENT.stripePriceId,
});

const EVENT_BODY = JSON.stringify({
  id: "evt_provenance",
  type: "checkout.session.completed",
  created: NOW_SECONDS,
  livemode: false,
  data: {
    object: {
      id: SESSION_ID,
      metadata: {
        [CHECKOUT_METADATA_KEYS.userId]: INTENT.userId,
        [CHECKOUT_METADATA_KEYS.purpose]: INTENT.purpose,
        [CHECKOUT_METADATA_KEYS.itemId]: INTENT.itemId,
        [CHECKOUT_METADATA_KEYS.intentId]: INTENT.intentId,
      },
    },
  },
});

/** A charge fully refunding the purchase above, carrying the same intent metadata. */
const REFUND_BODY = JSON.stringify({
  id: "evt_provenance_refund",
  type: "charge.refunded",
  created: NOW_SECONDS,
  livemode: false,
  data: {
    object: {
      id: "ch_provenance",
      refunded: true,
      amount_refunded: INTENT.unitAmount,
      currency: INTENT.currency,
      metadata: {
        [CHECKOUT_METADATA_KEYS.userId]: INTENT.userId,
        [CHECKOUT_METADATA_KEYS.purpose]: INTENT.purpose,
        [CHECKOUT_METADATA_KEYS.itemId]: INTENT.itemId,
        [CHECKOUT_METADATA_KEYS.intentId]: INTENT.intentId,
      },
    },
  },
});

const verifyBody = (payload: string) => {
  const result = verifyStripeWebhookSignature({
    payload,
    header: signStripeWebhookPayload({
      payload,
      secret: SECRET,
      timestamp: NOW_SECONDS,
    }),
    secret: SECRET,
    now: NOW,
  });
  if (!result.ok) throw new Error(`verify fixture failed: ${result.message}`);
  return result.value;
};

const verifiedWebhook = () => verifyBody(EVENT_BODY);

const verifiedCompletion = (): VerifiedCheckoutCompletion => {
  const parsed = parseCheckoutCompletedEvent({
    verified: verifiedWebhook(),
    intent: INTENT,
    settlement: SETTLEMENT,
  });
  if (!parsed.ok) throw new Error(`parse fixture failed: ${parsed.message}`);
  return parsed.value;
};

const verifiedRefund = (): VerifiedCreditPackRefund => {
  const parsed = parseCreditPackRefundEvent({
    verified: verifyBody(REFUND_BODY),
    intent: INTENT,
  });
  if (!parsed.ok) throw new Error(`refund fixture failed: ${parsed.message}`);
  return parsed.value;
};

const emptyLedger = () => createLedgerState(ACCOUNT);

/**
 * The ledger as it stands after the genuine purchase settled, which is the only
 * state a refund can be reconciled against. Building it from the real grant path
 * keeps the intent anchor `applyCreditPackRefund` reads back genuine, so nothing
 * but provenance can be what refuses the impostors below.
 */
const grantedLedger = () => {
  const granted = applyCheckoutCompletedGrant({
    state: emptyLedger(),
    completion: verifiedCompletion(),
    now: NOW,
  });
  if (!granted.ok) throw new Error(`grant fixture failed: ${granted.message}`);
  return granted.value.state;
};

describe("admin identity provenance", () => {
  it("refuses a hand-built identity naming the attacker's own address", () => {
    // The whole finding in one call: the caller supplies both sides, so a
    // structural guard would be asking them to confirm their own claim.
    const forged = {
      email: ATTACKER_EMAIL,
      source: ADMIN_EMAIL_ENV_VAR,
    } as AdminIdentity;

    const guarded = requireRole(attackerPrincipal(), "admin", {
      now: NOW,
      admin: forged,
    });
    expect(guarded.ok).toBe(false);
    if (guarded.ok) return;
    expect(guarded.reason).toBe(AUTH_REFUSE_REASONS.adminIdentityUnproven);
  });

  it("refuses a hand-built identity even when it names the real captain", () => {
    const forged = {
      email: CAPTAIN_EMAIL,
      source: ADMIN_EMAIL_ENV_VAR,
    } as AdminIdentity;

    const guarded = requireRole(captainPrincipal(), "admin", {
      now: NOW,
      admin: forged,
    });
    expect(guarded.ok).toBe(false);
    if (guarded.ok) return;
    expect(guarded.reason).toBe(AUTH_REFUSE_REASONS.adminIdentityUnproven);
  });

  it("refuses every copy of a genuinely resolved identity", () => {
    const admin = resolvedAdmin();
    for (const [how, impostor] of copiesOf(admin)) {
      expect(hasAdminIdentityProvenance(impostor), how).toBe(false);

      const guarded = requireRole(captainPrincipal(), "admin", {
        now: NOW,
        admin: impostor,
      });
      expect(guarded.ok, how).toBe(false);
      if (guarded.ok) continue;
      expect(guarded.reason, how).toBe(
        AUTH_REFUSE_REASONS.adminIdentityUnproven,
      );

      // `requireAuthenticated` is the guard most call sites use, and it derives
      // the same role, so it has to refuse the same way rather than letting an
      // unproven identity through on the "any signed-in principal" path.
      const authenticated = requireAuthenticated(captainPrincipal(), {
        now: NOW,
        admin: impostor,
      });
      expect(authenticated.ok, how).toBe(false);
    }
  });

  it("accepts only the object the environment resolution issued", () => {
    const admin = resolvedAdmin();
    expect(hasAdminIdentityProvenance(admin)).toBe(true);
    expect(requireRole(captainPrincipal(), "admin", { now: NOW, admin }).ok).toBe(
      true,
    );

    // Resolving twice issues two distinct provenant identities; neither is a
    // copy of the other, and both are genuine.
    const again = resolvedAdmin();
    expect(again).not.toBe(admin);
    expect(hasAdminIdentityProvenance(again)).toBe(true);
  });

  it("binds guards to the resolved environment identity, taking no admin argument", () => {
    const guards = createRoleGuards(resolveAdminIdentity(ENV));
    expect(guards.requireRole(captainPrincipal(), "admin", { now: NOW }).ok).toBe(
      true,
    );

    const denied = guards.requireRole(attackerPrincipal(), "admin", {
      now: NOW,
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    // The attacker's principal claims `admin`/`admin-env`, but the bound guard
    // derives `user` from the environment identity, so the claim is what fails.
    expect(denied.reason).toBe(AUTH_REFUSE_REASONS.principalInvalid);
  });

  it("carries a refused resolution into every bound guard, by its own name", () => {
    const guards = createRoleGuards(resolveAdminIdentity({}));
    const guarded = guards.requireAuthenticated(captainPrincipal(), {
      now: NOW,
    });
    expect(guarded.ok).toBe(false);
    if (guarded.ok) return;
    expect(guarded.reason).toBe(AUTH_REFUSE_REASONS.adminEmailMissing);
  });

  it("refuses guards built from a fabricated resolution result", () => {
    const guards = createRoleGuards({
      ok: true,
      value: { email: ATTACKER_EMAIL, source: ADMIN_EMAIL_ENV_VAR },
    } as never);
    const guarded = guards.requireRole(attackerPrincipal(), "admin", {
      now: NOW,
    });
    expect(guarded.ok).toBe(false);
    if (guarded.ok) return;
    expect(guarded.reason).toBe(AUTH_REFUSE_REASONS.adminIdentityUnresolved);
  });
});

describe("principal provenance", () => {
  it("refuses a hand-built principal at every role guard", () => {
    const issued = captainPrincipal();
    const handBuilt = {
      user: issued.user,
      role: issued.role,
      session: issued.session,
    } as Principal;

    expect(hasPrincipalProvenance(handBuilt)).toBe(false);
    for (const guarded of [
      requireAuthenticated(handBuilt, { now: NOW, admin: resolvedAdmin() }),
      requireRole(handBuilt, "admin", { now: NOW, admin: resolvedAdmin() }),
      createRoleGuards(resolveAdminIdentity(ENV)).requireAuthenticated(handBuilt, {
        now: NOW,
      }),
      createRoleGuards(resolveAdminIdentity(ENV)).requireRole(
        handBuilt,
        "admin",
        { now: NOW },
      ),
    ]) {
      expect(guarded.ok).toBe(false);
      if (guarded.ok) continue;
      expect(guarded.reason).toBe(AUTH_REFUSE_REASONS.principalUnproven);
    }
  });

  it("refuses every copy while accepting the exact issued object", () => {
    const issued = captainPrincipal();
    expect(hasPrincipalProvenance(issued)).toBe(true);
    expect(
      requireAuthenticated(issued, { now: NOW, admin: resolvedAdmin() }).ok,
    ).toBe(true);

    for (const [how, impostor] of copiesOf(issued)) {
      expect(hasPrincipalProvenance(impostor), how).toBe(false);
      const guarded = requireAuthenticated(impostor, {
        now: NOW,
        admin: resolvedAdmin(),
      });
      expect(guarded.ok, how).toBe(false);
      if (guarded.ok) continue;
      expect(guarded.reason, how).toBe(
        AUTH_REFUSE_REASONS.principalUnproven,
      );
    }
  });
});

describe("verified checkout completion provenance", () => {
  it("refuses an `as`-cast completion at the grant path", () => {
    // Structurally perfect: this is exactly what a real completion looks like.
    const forged = {
      schemaVersion: 1,
      kind: "sceneaxi.checkout-completed-event",
      eventId: "evt_forged",
      type: "checkout.session.completed",
      mode: "test",
      checkoutSessionId: SESSION_ID,
      intentId: INTENT.intentId,
      userId: INTENT.userId,
      purpose: "credit-pack",
      itemId: INTENT.itemId,
      credits: 1_000_000,
      unitAmount: INTENT.unitAmount,
      currency: INTENT.currency,
      stripePriceId: INTENT.stripePriceId,
      occurredAt: "2026-07-25T10:00:00Z",
    } as unknown as VerifiedCheckoutCompletion;

    const granted = applyCheckoutCompletedGrant({
      state: emptyLedger(),
      completion: forged,
      now: NOW,
    });
    expect(granted.ok).toBe(false);
    if (granted.ok) return;
    expect(granted.reason).toBe(BILLING_REFUSE_REASONS.completionNotVerified);
  });

  it("refuses every copy of a genuine completion", () => {
    const completion = verifiedCompletion();
    for (const [how, impostor] of copiesOf(completion)) {
      expect(hasVerifiedCompletionProvenance(impostor), how).toBe(false);

      const granted = applyCheckoutCompletedGrant({
        state: emptyLedger(),
        completion: impostor,
        now: NOW,
      });
      expect(granted.ok, how).toBe(false);
      if (granted.ok) continue;
      expect(granted.reason, how).toBe(
        BILLING_REFUSE_REASONS.completionNotVerified,
      );

      // Money bookkeeping is the second consumer of the same evidence, so it
      // has to refuse the same impostors rather than relying on the grant path.
      const settled = settleFixtureListingMoneySale({
        completion: impostor,
        intent: INTENT,
      });
      expect(settled.ok, how).toBe(false);
      if (settled.ok) continue;
      expect(settled.reason, how).toBe(
        BILLING_REFUSE_REASONS.completionNotVerified,
      );
    }
  });

  it("refuses a hand-built verified webhook at the parse step", () => {
    // The signed body itself, so nothing but provenance can be what refuses:
    // this payload would parse and grant if the parser trusted its shape.
    const forged = { timestamp: NOW_SECONDS, payload: EVENT_BODY };
    expect(hasVerifiedWebhookProvenance(forged)).toBe(false);

    const parsed = parseCheckoutCompletedEvent({
      verified: forged as never,
      intent: INTENT,
      settlement: SETTLEMENT,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe(BILLING_REFUSE_REASONS.webhookNotVerified);
  });

  it("refuses every copy of a genuine verified webhook", () => {
    for (const [how, impostor] of copiesOf(verifiedWebhook())) {
      expect(hasVerifiedWebhookProvenance(impostor), how).toBe(false);
      const parsed = parseCheckoutCompletedEvent({
        verified: impostor,
        intent: INTENT,
        settlement: SETTLEMENT,
      });
      expect(parsed.ok, how).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.reason, how).toBe(
        BILLING_REFUSE_REASONS.webhookNotVerified,
      );
    }
  });

  it("still grants a genuine completion exactly once, and nothing on replay", () => {
    const completion = verifiedCompletion();
    expect(hasVerifiedCompletionProvenance(completion)).toBe(true);

    const first = applyCheckoutCompletedGrant({
      state: emptyLedger(),
      completion,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.replayed).toBe(false);
    expect(first.value.state.balance).toBe(INTENT.credits);

    // Stripe delivers at least once. A redelivery is parsed afresh — a second
    // genuine completion object — and must still settle to the same one entry.
    const replay = applyCheckoutCompletedGrant({
      state: first.value.state,
      completion: verifiedCompletion(),
      now: NOW,
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(replay.value.state.entries).toHaveLength(1);
    expect(replay.value.state.balance).toBe(INTENT.credits);
  });
});

describe("verified credit-pack refund provenance", () => {
  it("refuses an `as`-cast refund at the adjustment path", () => {
    // Structurally perfect, and it names a grant that really is in the ledger:
    // only provenance stands between this object and a reversal nobody refunded.
    const forged = {
      schemaVersion: 1,
      kind: "sceneaxi.credit-pack-refund",
      eventId: "evt_forged_refund",
      chargeId: "ch_forged",
      intentId: INTENT.intentId,
      userId: INTENT.userId,
      itemId: INTENT.itemId,
      mode: "test",
      unitAmount: INTENT.unitAmount,
      currency: INTENT.currency,
      credits: INTENT.credits,
      occurredAt: "2026-07-25T10:00:00Z",
    } as unknown as VerifiedCreditPackRefund;

    const adjusted = applyCreditPackRefund({
      state: grantedLedger(),
      refund: forged,
      now: NOW + 1_000,
    });
    expect(adjusted.ok).toBe(false);
    if (adjusted.ok) return;
    expect(adjusted.reason).toBe(BILLING_REFUSE_REASONS.webhookNotVerified);
  });

  it("refuses every copy of a genuine refund", async () => {
    const refund = verifiedRefund();
    for (const [how, impostor] of copiesOf(refund)) {
      expect(hasVerifiedRefundProvenance(impostor), how).toBe(false);

      const adjusted = applyCreditPackRefund({
        state: grantedLedger(),
        refund: impostor,
        now: NOW + 1_000,
      });
      expect(adjusted.ok, how).toBe(false);
      if (adjusted.ok) continue;
      expect(adjusted.reason, how).toBe(
        BILLING_REFUSE_REASONS.webhookNotVerified,
      );

      // The commit boundary is the second consumer of the same evidence, and it
      // is the one a webhook endpoint actually calls, so it has to refuse the
      // same impostors before it can reach the store.
      const persisted = await persistCreditPackRefund({
        state: grantedLedger(),
        refund: impostor,
        now: NOW + 1_000,
        store: createInMemoryCreditStore({ accounts: [ACCOUNT] }),
      });
      expect(persisted.ok, how).toBe(false);
      if (persisted.ok) continue;
      expect(persisted.reason, how).toBe(
        BILLING_REFUSE_REASONS.webhookNotVerified,
      );
    }
  });

  it("refuses every copy of a genuine verified webhook at the refund parse step", () => {
    for (const [how, impostor] of copiesOf(verifyBody(REFUND_BODY))) {
      expect(hasVerifiedWebhookProvenance(impostor), how).toBe(false);
      const parsed = parseCreditPackRefundEvent({
        verified: impostor,
        intent: INTENT,
      });
      expect(parsed.ok, how).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.reason, how).toBe(
        BILLING_REFUSE_REASONS.webhookNotVerified,
      );
    }
  });

  it("still reverses a genuine refund exactly once, and nothing on replay", () => {
    const refund = verifiedRefund();
    expect(hasVerifiedRefundProvenance(refund)).toBe(true);

    const first = applyCreditPackRefund({
      state: grantedLedger(),
      refund,
      now: NOW + 1_000,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.replayed).toBe(false);
    expect(first.value.state.balance).toBe(0);

    // A redelivered refund parses into a second genuine object, and must still
    // settle to the one intent-scoped adjustment rather than reversing twice.
    const replay = applyCreditPackRefund({
      state: first.value.state,
      refund: verifiedRefund(),
      now: NOW + 2_000,
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.replayed).toBe(true);
    expect(replay.value.state.entries).toHaveLength(2);
    expect(replay.value.state.balance).toBe(0);
  });
});
