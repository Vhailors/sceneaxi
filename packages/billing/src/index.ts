/**
 * @sceneaxi/billing — credits and billing for the SceneAxi identity plane.
 *
 * Owns the append-only credit ledger, metering, entitlement enforcement, and
 * the Stripe test-mode checkout and webhook paths. Neon and the Stripe API are
 * injected adapters, never dependencies; webhook *signature verification* is
 * implemented in-repo because it is the security boundary and is fully
 * deterministic. See docs/auth-credits.md and ADR 0014.
 *
 * Depends only on `@sceneaxi/schemas` and the `@sceneaxi/auth` seam.
 */

import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/billing",
  releaseGroup: "identity",
});

export {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOk,
  type BillingOutcome,
  type BillingRefuse,
  type BillingRefuseReason,
} from "./refusals.js";

export {
  appendCreditEntry,
  createLedgerState,
  deriveBalance,
  deriveEntryId,
  loadLedgerState,
  type AppendCreditEntryRequest,
  type AppendOutcome,
  type LedgerState,
} from "./ledger.js";

export {
  createInMemoryCreditStore,
  type CreditStore,
  type InMemoryCreditStore,
  type InMemoryCreditStoreOptions,
} from "./store.js";

export {
  meterCredits,
  type MeterCreditsRequest,
  type MeterOutcome,
} from "./metering.js";
