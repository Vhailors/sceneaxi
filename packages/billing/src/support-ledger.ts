import { requireAuthenticated, requireRole, type AdminIdentity, type IdentityStore } from "@sceneaxi/auth";
import {
  validateCheckoutSessionIntent,
  validateUser,
  isNonEmptyString,
  type CheckoutSessionIntent,
  type IdentitySurface,
} from "@sceneaxi/schemas";
import { appendCreditEntry, deriveEntryId, loadLedgerState } from "./ledger.js";
import { BILLING_REFUSE_REASONS, billingOk, billingRefuse, type BillingOutcome } from "./refusals.js";
import { readCommittedEntry, type CommittedEntry, type CreditStore } from "./store.js";

export type LedgerSupportAccess = Readonly<{
  principal: unknown;
  admin: AdminIdentity;
  surface: IdentitySurface;
  now: number;
}>;

export type LedgerSupportStore = Readonly<{
  users: Pick<IdentityStore, "findUserByEmail" | "findUserById">;
  listCheckoutIntents(userId: string, page?: PurchaseHistoryPage): Promise<ReadonlyArray<CheckoutSessionIntent>>;
}>;

export type LedgerSupportTarget = Readonly<{ kind: "email" | "userId"; value: string }>;

export type LedgerAdjustmentFields = Readonly<{
  userId: unknown;
  delta: unknown;
  reason: unknown;
  idempotencyKey: unknown;
}>;

export function requireLedgerSupportAdmin(access: LedgerSupportAccess) {
  if (access.surface === "kids") {
    return billingRefuse(BILLING_REFUSE_REASONS.kidsCommerceDenied, "Kids cannot use ledger support.");
  }

  return requireRole(access.principal, "admin", { admin: access.admin, surface: access.surface, now: access.now });
}

export async function readSupportLedger(input: LedgerSupportAccess & Readonly<{
  credits: CreditStore;
  support: LedgerSupportStore;
  target: LedgerSupportTarget;
}>) {
  const allowed = requireLedgerSupportAdmin(input);

  if (!allowed.ok) return allowed;
  const target = input.target.value.trim();

  if (target.length === 0 || target.length > 320) {
    return billingRefuse(BILLING_REFUSE_REASONS.requestInvalid, "Enter an email or user id.");
  }

  try {
    const candidate = input.target.kind === "email"
      ? await input.support.users.findUserByEmail(target.toLowerCase())
      : await input.support.users.findUserById(target);

    if (candidate === undefined) {
      return billingRefuse(BILLING_REFUSE_REASONS.supportTargetNotFound, "No user matches this lookup.");
    }

    const user = validateUser(candidate);

    if (!user.ok || (input.target.kind === "email" ? user.value.email.toLowerCase() !== target.toLowerCase() : user.value.userId !== target)) {
      return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "The lookup returned a different or invalid user.");
    }

    const state = await readSupportState(input.credits, user.value.userId);

    if (!state.ok) return state;
    const checkoutIntents = await input.support.listCheckoutIntents(user.value.userId);

    if (checkoutIntents.some((intent) => intent.userId !== user.value.userId)) {
      return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "Checkout lookup returned another user's intent.");
    }

    const reconciliations = await input.credits.listReconciliations({ userId: user.value.userId, limit: 100 });

    return billingOk(Object.freeze({ user: user.value, state: state.value, checkoutIntents, reconciliations }));
  } catch {
    return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "Ledger support could not read persistence.");
  }
}

async function readSupportState(store: CreditStore, userId: string) {
  const account = await store.findAccountByUserId(userId);

  if (account === undefined || account.userId !== userId) {
    return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "No matching provisioned credit account was found.");
  }

  return loadLedgerState(account, await store.listEntries(account.accountId));
}

export async function adjustSupportLedger(input: LedgerSupportAccess & Readonly<{
  credits: CreditStore;
  fields: LedgerAdjustmentFields;
}>): Promise<BillingOutcome<CommittedEntry>> {
  const allowed = requireLedgerSupportAdmin(input);

  if (!allowed.ok) return allowed;
  const { userId, delta, reason, idempotencyKey } = input.fields;

  if (
    !isNonEmptyString(userId) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(userId) ||
    !isNonEmptyString(delta) || !/^[+-]?[0-9]+$/.test(delta) ||
    !Number.isSafeInteger(Number(delta)) || Number(delta) === 0 ||
    !isNonEmptyString(reason) || reason.trim().length === 0 || reason.length > 1000 ||
    !isNonEmptyString(idempotencyKey) || !/^[A-Za-z0-9._-]{1,128}$/.test(idempotencyKey)
  ) {
    return billingRefuse(BILLING_REFUSE_REASONS.requestInvalid, "An adjustment requires a user id, signed non-zero integer credits, a reason, and a unique key.");
  }

  const key = `support-adjustment:${idempotencyKey}`;

  try {
    const loaded = await readSupportState(input.credits, userId);

    if (!loaded.ok) return loaded;

    const appended = appendCreditEntry(loaded.value, {
      entryId: deriveEntryId(key), movement: "adjustment", delta: Number(delta),
      reason: `support:${allowed.value.user.userId}: ${reason.trim()}`,
      idempotencyKey: key, now: input.now,
    });

    if (!appended.ok) return appended;
    const requested = appended.value.entry;

    if (requested === undefined) {
      return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "No adjustment entry was produced.");
    }

    if (appended.value.replayed) return billingOk({ entry: requested, replayed: true });
    const committed = readCommittedEntry(requested, await input.credits.appendOrReplayEntry(requested));

    if (committed === undefined) {
      return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "The adjustment commit could not be confirmed. Retry with the same key.");
    }

    return billingOk(committed);
  } catch {
    return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "The adjustment commit could not be confirmed. Retry with the same key.");
  }
}

/** A bounded newest-first keyset page, never a caller-selected user. */
export type PurchaseHistoryPage = Readonly<{
  limit?: number;
  before?: Readonly<{ createdAt: string; intentId: string }>;
}>;

export type PurchaseHistoryItem = Readonly<{
  intentId: string; itemId: string; createdAt: string; credits: number;
  unitAmount: number; currency: string; mode: "test" | "live";
  status: "pending" | "granted" | "refunded" | "reconciliation-required";
  grantEntryId?: string; refundEntryId?: string;
}>;

export async function readPurchaseHistory(input: Readonly<{
  principal: unknown; admin: AdminIdentity; surface: IdentitySurface; now: number;
  credits: CreditStore; support: LedgerSupportStore; page?: PurchaseHistoryPage;
}>): Promise<BillingOutcome<Readonly<{
  purchases: ReadonlyArray<PurchaseHistoryItem>;
  next?: Readonly<{ createdAt: string; intentId: string }>;
  reconciliationTruncated: boolean;
}>>> {
  if (input.surface === "kids") return billingRefuse(BILLING_REFUSE_REASONS.kidsCommerceDenied, "Kids cannot read purchase history.");
  const guarded = requireAuthenticated(input.principal, { admin: input.admin, surface: input.surface, now: input.now });

  if (!guarded.ok) return guarded;
  const userId = guarded.value.user.userId;
  const limit = input.page?.limit ?? 50;
  const before = input.page?.before;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || (before !== undefined && (!Number.isFinite(Date.parse(before.createdAt)) || !/^[A-Za-z0-9._-]{1,128}$/.test(before.intentId)))) {
    return billingRefuse(BILLING_REFUSE_REASONS.requestInvalid, "Invalid purchase history page.");
  }

  try {
    const account = await input.credits.findAccountByUserId(userId);

    if (account === undefined || account.userId !== userId || input.credits.listPurchaseEntries === undefined) {
      return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "Purchase history persistence is unavailable.");
    }

    const page: PurchasePageQuery = { limit: limit + 1 };

    if (before !== undefined) page.before = before;
    const rows = await input.support.listCheckoutIntents(userId, page);

    if (rows.length > limit + 1 || rows.some((intent) => !validateCheckoutSessionIntent(intent).ok || intent.userId !== userId || intent.purpose !== "credit-pack")) {
      return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "Purchase lookup returned invalid or unscoped records.");
    }

    const visible = rows.slice(0, limit);
    const ids = visible.map((intent) => intent.intentId);
    const entries = await input.credits.listPurchaseEntries(account.accountId, ids);
    const reconciliations = await input.credits.listReconciliations({ userId, intentIds: ids, limit: 100 });

    if (entries.some((entry) => entry.accountId !== account.accountId) || reconciliations.some((record) => record.userId !== userId || !ids.includes(record.intentId))) {
      return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "Purchase evidence returned another account.");
    }

    const purchases: PurchaseHistoryItem[] = visible.map((intent) => {
      const anchored = entries.filter((entry) => entry.reason.split(";").some((segment) => segment.trim() === `intent:${intent.intentId}`));
      const grant = anchored.find((entry) => entry.movement === "grant" && entry.delta === intent.credits && entry.idempotencyKey.startsWith("stripe-event:"));
      const refund = anchored.find((entry) => entry.movement === "adjustment" && entry.delta === -(intent.credits ?? 0) && entry.idempotencyKey === `stripe-refund:${intent.intentId}`);
      const status = refund !== undefined && grant !== undefined ? "refunded" : reconciliations.some((record) => record.intentId === intent.intentId) ? "reconciliation-required" : grant !== undefined ? "granted" : "pending";

      const purchase: PurchaseHistoryDraft = { intentId: intent.intentId, itemId: intent.itemId, createdAt: intent.createdAt, credits: intent.credits ?? 0, unitAmount: intent.unitAmount, currency: intent.currency, mode: intent.mode, status };

      if (grant !== undefined) purchase.grantEntryId = grant.entryId;

      if (refund !== undefined) purchase.refundEntryId = refund.entryId;

      return Object.freeze(purchase);
    });

    const tail = visible.at(-1);

    const history: PurchaseHistoryResult = { purchases: Object.freeze(purchases), reconciliationTruncated: reconciliations.length === 100 };

    if (rows.length > limit && tail !== undefined) history.next = Object.freeze({ createdAt: tail.createdAt, intentId: tail.intentId });

    return billingOk(Object.freeze(history));
  } catch {
    return billingRefuse(BILLING_REFUSE_REASONS.storeFailed, "Purchase history could not read persistence.");
  }
}

type PurchasePageQuery = { limit: number; before?: NonNullable<PurchaseHistoryPage["before"]> };

type PurchaseHistoryDraft = { -readonly [Key in keyof PurchaseHistoryItem]: PurchaseHistoryItem[Key] };

type PurchaseHistoryResult = { purchases: ReadonlyArray<PurchaseHistoryItem>; reconciliationTruncated: boolean; next?: { createdAt: string; intentId: string } };
