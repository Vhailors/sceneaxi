/**
 * The credit pack catalog.
 *
 * The canonical list is a **contract fixture**
 * (`@sceneaxi/schemas/contracts/credit-packs.fixtures.json`), kept in lockstep
 * with `docs/auth-credits.md` by `pnpm check:contracts`. Reading it is isolated
 * in `loadCreditPackCatalog` so every other function takes the catalog as an
 * argument: the checkout path stays pure, injectable, and free of filesystem
 * access, and a test can pass a two-pack catalog without touching the repo's.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import {
  CREDIT_PACKS_FIXTURES_PATH,
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
 * Resolved through the package export map rather than a relative path, so the
 * fixture stays the contract owner's file and cannot drift into a local copy.
 */
export function loadCreditPackCatalog(): BillingOutcome<CreditPackCatalog> {
  if (cached !== undefined) return billingOk(cached);

  let raw: unknown;
  try {
    const require = createRequire(import.meta.url);
    const path = require.resolve(
      `@sceneaxi/schemas/${CREDIT_PACKS_FIXTURES_PATH}`,
    );
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return billingRefuse(
      BILLING_REFUSE_REASONS.catalogInvalid,
      `The credit pack catalog could not be read: ${detail}`,
    );
  }

  const catalog = validateCreditPackCatalog(raw);
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
