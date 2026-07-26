/**
 * The credit pack catalog.
 *
 * The canonical list is a **contract fixture**
 * (`@sceneaxi/schemas/contracts/credit-packs.fixtures.json`), kept in lockstep
 * with `docs/auth-credits.md` and with the bundled module below by
 * `pnpm check:contracts`. Loading it is isolated in `loadCreditPackCatalog` so
 * every other function takes the catalog as an argument: the checkout path stays
 * pure, injectable, and a test can pass a two-pack catalog without touching the
 * repo's.
 */

import {
  CREDIT_PACK_CATALOG_DATA,
  validateCreditPackCatalog,
  type CreditPack,
  type CreditPackCatalog,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";

let cached: CreditPackCatalog | undefined;

/**
 * Load and validate the canonical committed catalog, caching the result.
 *
 * Read from the contract owner's bundled module rather than from the filesystem:
 * the same catalog is loaded inside a bundled serverless site, where a
 * package-relative file read is not guaranteed to be traced into the deployment.
 * `pnpm check:contracts` holds that module and the canonical fixture in lockstep,
 * so the value here cannot drift from the contract it is a copy of.
 */
export function loadCreditPackCatalog(): BillingOutcome<CreditPackCatalog> {
  if (cached !== undefined) return billingOk(cached);

  const catalog = validateCreditPackCatalog(CREDIT_PACK_CATALOG_DATA);
  if (!catalog.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.catalogInvalid,
      `The credit pack catalog is invalid (${catalog.code}): ${catalog.message}`,
    );
  }

  cached = catalog.value;
  return billingOk(catalog.value);
}

/** Look a pack up by id, refusing an unknown one rather than returning undefined. */
export function lookupCreditPack(
  catalog: unknown,
  packId: unknown,
): BillingOutcome<CreditPack> {
  const validated = validateCreditPackCatalog(catalog);
  if (!validated.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.catalogInvalid,
      `The credit pack catalog is invalid (${validated.code}): ${validated.message}`,
    );
  }
  if (typeof packId !== "string" || packId.length === 0) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.packUnknown,
      "A credit pack id is required.",
    );
  }
  const pack = validated.value.packs.find((held) => held.packId === packId);
  if (pack === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.packUnknown,
      `No credit pack named "${packId}" exists in the catalog.`,
    );
  }
  return billingOk(pack);
}
