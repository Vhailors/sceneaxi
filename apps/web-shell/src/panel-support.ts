/**
 * Plumbing the web shell's view models share, held once so it cannot drift.
 *
 * `createAccountPanel` and `createAssistantPanel` are different surfaces over
 * the same two planes, so they had grown identical copies of three things: the
 * turn/mutation queue, the injected-clock read, and — the one that matters — the
 * chain that turns an injected credits view into a ledger the panel is willing
 * to judge against. That last one is a security-shaped sequence (a throw is not
 * an empty balance, an absent ledger is not a zero, a validated ledger is still
 * refused when it names another user), and two copies of it is two places a
 * future change has to land.
 *
 * What stays with each panel is its **vocabulary**: this module reports *what*
 * went wrong as a closed enumeration and never invents a reason code or a
 * message, so each panel keeps naming its own refusals in its own words.
 */

import { isEpochMilliseconds, type IdentitySurface } from "@sceneaxi/schemas";
import {
  validateLedgerState,
  type BillingRefuseReason,
  type LedgerState,
} from "@sceneaxi/billing";

/** The surfaces a panel may be constructed for. */
export const PANEL_SURFACES: ReadonlyArray<IdentitySurface> = Object.freeze([
  "web-shell",
  "desktop-shell",
  "site",
  "kids",
]);

/** Where a panel reads a user's ledger. Injected; no panel owns storage. */
export type PanelCreditsView = Readonly<{
  ledgerFor(
    userId: string,
  ): Promise<LedgerState | undefined> | LedgerState | undefined;
}>;

/** Why a ledger read did not yield a ledger the caller may be judged against. */
export type LedgerReadFailure = "unavailable" | "missing" | "owner-mismatch";

export type LedgerReadOutcome =
  | Readonly<{ ok: true; state: LedgerState }>
  | Readonly<{ ok: false; failure: LedgerReadFailure }>
  | Readonly<{
      ok: false;
      failure: "invalid";
      reason: BillingRefuseReason;
      message: string;
    }>;

/**
 * Read the ledger that belongs to `userId`, or say precisely why there is none.
 *
 * Every branch here is a refusal rather than a default: a view that throws, a
 * user with no ledger, a ledger that does not validate, and a ledger owned by
 * someone else are four different answers, and none of them is a balance.
 */
export async function readOwnedLedger(
  credits: PanelCreditsView,
  userId: string,
): Promise<LedgerReadOutcome> {
  let state: LedgerState | undefined;
  try {
    state = await credits.ledgerFor(userId);
  } catch {
    return Object.freeze({ ok: false, failure: "unavailable" });
  }
  if (state === undefined) {
    return Object.freeze({ ok: false, failure: "missing" });
  }
  const validated = validateLedgerState(state);
  if (!validated.ok) {
    return Object.freeze({
      ok: false,
      failure: "invalid",
      reason: validated.reason,
      message: validated.message,
    });
  }
  if (validated.value.account.userId !== userId) {
    return Object.freeze({ ok: false, failure: "owner-mismatch" });
  }
  return Object.freeze({ ok: true, state: validated.value });
}

/** The injected clock's reading, or `undefined` if it did not give one. */
export function readEpochClock(clock: () => number): number | undefined {
  let now: unknown;
  try {
    now = clock();
  } catch {
    return undefined;
  }
  return isEpochMilliseconds(now) ? now : undefined;
}

/**
 * One queue that runs its operations in the order they were submitted.
 *
 * The tail is captured and replaced *synchronously*, before the first await, so
 * two operations submitted in the same tick still queue behind each other.
 */
export function createOperationQueue(): <Value>(
  operation: () => Promise<Value>,
) => Promise<Value> {
  let tail: Promise<void> = Promise.resolve();
  return async <Value>(operation: () => Promise<Value>): Promise<Value> => {
    const preceding = tail;
    let release = () => {};
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await preceding;
    try {
      return await operation();
    } finally {
      release();
    }
  };
}
