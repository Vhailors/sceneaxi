/**
 * The credit pack catalog.
 *
 * The canonical artifact is a **versioned contract fixture**
 * (`@sceneaxi/schemas/contracts/credit-packs.fixtures.json`): immutable
 * `packRevisions` rows plus the `currentRevisionIds` pointer index, kept in
 * lockstep with `docs/auth-credits.md`, the bundled module below, and the
 * per-revision digest pins by `pnpm check:contracts`. Loading it is isolated in
 * `loadCreditPackCatalog`, which projects only the current pointers, so every
 * other current-catalog function takes the catalog as an argument: the checkout
 * path stays pure, injectable, and a test can pass a two-pack catalog without
 * touching the repo's. Historical resolution is the deliberate exception —
 * `resolveCreditPackRevision` accepts lookup keys only, never a caller-supplied
 * archive, because a paid revision must come from the committed record.
 * Contract owner: `docs/auth-credits.md`.
 */

import {
  CREDIT_PACK_CATALOG_DATA,
  validateCreditPackCatalogArchive,
  validateCreditPackCatalog,
  type CreditPack,
  type CreditPackCatalog,
  type CreditPackCatalogArchive,
  type CreditPackRevision,
} from "@sceneaxi/schemas";
import {
  BILLING_REFUSE_REASONS,
  billingOk,
  billingRefuse,
  type BillingOutcome,
} from "./refusals.js";

let cached: CreditPackCatalog | undefined;
let cachedArchive: CreditPackCatalogArchive | undefined;

const loadArchive = (): BillingOutcome<CreditPackCatalogArchive> => {
  if (cachedArchive !== undefined) return billingOk(cachedArchive);

  const archive = validateCreditPackCatalogArchive(CREDIT_PACK_CATALOG_DATA);
  if (!archive.ok) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.catalogInvalid,
      `The credit pack catalog archive is invalid (${archive.code}): ${archive.message}`,
    );
  }

  cachedArchive = archive.value;
  return billingOk(archive.value);
};

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

  const archive = loadArchive();
  if (!archive.ok) return archive;

  const byRevisionId = new Map(
    archive.value.packRevisions.map((revision) => [
      revision.revisionId,
      revision,
    ]),
  );
  const packs: CreditPack[] = [];
  for (const revisionId of archive.value.currentRevisionIds) {
    const revision = byRevisionId.get(revisionId);
    if (revision === undefined) {
      return billingRefuse(
        BILLING_REFUSE_REASONS.catalogInvalid,
        `The validated credit pack archive lost current revision "${revisionId}".`,
      );
    }
    packs.push(
      Object.freeze({
        packId: revision.packId,
        credits: revision.credits,
        unitAmount: revision.unitAmount,
        currency: revision.currency,
        stripePriceId: revision.stripePriceId,
      }),
    );
  }
  const catalog = Object.freeze({
    schemaVersion: archive.value.schemaVersion,
    mode: archive.value.mode,
    packs: Object.freeze(packs),
  });

  cached = catalog;
  return billingOk(catalog);
}

/**
 * Resolve the immutable committed revision selected by the tuple already held
 * by a persisted checkout intent. The caller supplies lookup keys only; the
 * historical value always comes from the bundled committed archive.
 */
export function resolveCreditPackRevision(
  itemId: unknown,
  stripePriceId: unknown,
  unitAmount: unknown,
): BillingOutcome<CreditPackRevision> {
  const archive = loadArchive();
  if (!archive.ok) return archive;

  if (
    typeof itemId !== "string" ||
    itemId.length === 0 ||
    typeof stripePriceId !== "string" ||
    stripePriceId.length === 0 ||
    typeof unitAmount !== "number" ||
    !Number.isSafeInteger(unitAmount) ||
    unitAmount < 1
  ) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.catalogRevisionUnresolvable,
      "A credit pack revision requires an itemId, stripePriceId, and positive unitAmount.",
    );
  }

  const revision = archive.value.packRevisions.find(
    (candidate) =>
      candidate.packId === itemId &&
      candidate.stripePriceId === stripePriceId &&
      candidate.unitAmount === unitAmount,
  );
  if (revision === undefined) {
    return billingRefuse(
      BILLING_REFUSE_REASONS.catalogRevisionUnresolvable,
      `No committed credit pack revision resolves itemId "${itemId}" at the supplied Stripe price and amount.`,
    );
  }
  return billingOk(revision);
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
