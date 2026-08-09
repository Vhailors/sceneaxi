/** Pure deterministic weighted rarity resolver (sceneaxi#240). */
import {
  RARITY_ALGORITHM_ID,
  RARITY_OUTCOME_KIND,
  RARITY_PROVENANCE_KIND,
  RARITY_REFUSE_CODES,
  RARITY_SCHEMA_VERSION,
  RARITY_TIERS,
  canonicalRarityJson,
  digestRarityOutcome,
  digestRarityPolicy,
  digestRarityRequest,
  refuseRarity,
  validateRarityPolicy,
  validateRarityRollRequest,
  type RarityCandidate,
  type RarityOutcome,
  type RarityPolicy,
  type RarityProvenance,
  type RarityRollRecord,
  type RarityRollRequest,
  type RarityTierId,
  type RarityValidationRefuse,
  type RarityValidationResult,
} from "@sceneaxi/schemas";
import {
  portableKernelDigest,
  prefixedDigest,
  type KernelDigest,
} from "./portable-digest.js";

export type RarityResolutionContext = Readonly<{
  /** Integer seed owned by the existing ProductManifest. */
  projectSeed: number;
  /** Stable project scope; product sessions use ProductManifest.productId. */
  scope: string;
  /** Explicit stable authoring/kernel event identity. */
  eventId: string;
}>;

export type RarityResolution = Readonly<{
  outcome: RarityOutcome;
  provenance: RarityProvenance;
  record: RarityRollRecord;
}>;

export type RarityResolutionResult = RarityValidationResult<RarityResolution>;

const IDENTIFIER_RE = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

function digestCanonical(value: unknown, digest: KernelDigest): string {
  return prefixedDigest(
    canonicalRarityJson(value as Parameters<typeof canonicalRarityJson>[0]),
    digest,
  );
}

function drawFor(digestValue: string, total: number): number {
  const hex = digestValue.slice("sha256:".length);
  return Number(BigInt(`0x${hex}`) % BigInt(total));
}

function selectTier(policy: RarityPolicy, draw: number): RarityTierId {
  let cumulative = 0;
  for (const tier of RARITY_TIERS) {
    cumulative += policy.tierWeights[tier];
    if (draw < cumulative) return tier;
  }
  throw new Error("validated rarity tier interval did not contain its draw");
}

function candidatesFor(
  request: RarityRollRequest,
  tier: RarityTierId,
): readonly RarityCandidate[] {
  return request.candidates.filter((candidate) => candidate.tier === tier);
}

function candidateTotal(candidates: readonly RarityCandidate[]): number {
  return candidates.reduce((total, candidate) => total + candidate.weight, 0);
}

function selectCandidate(
  candidates: readonly RarityCandidate[],
  draw: number,
): RarityCandidate {
  let cumulative = 0;
  for (const candidate of candidates) {
    cumulative += candidate.weight;
    if (draw < cumulative) return candidate;
  }
  throw new Error("validated rarity candidate interval did not contain its draw");
}

function contextRefusal(
  context: RarityResolutionContext,
): RarityValidationRefuse | null {
  if (!Number.isSafeInteger(context.projectSeed)) {
    return refuseRarity(
      RARITY_REFUSE_CODES.seedInvalid,
      "rarity.context.projectSeed",
      "The ProductManifest rarity seed must be a safe integer.",
    );
  }
  if (!IDENTIFIER_RE.test(context.scope)) {
    return refuseRarity(
      RARITY_REFUSE_CODES.invalidIdentifier,
      "rarity.context.scope",
      "Rarity scope must be a stable lowercase identifier.",
    );
  }
  if (!IDENTIFIER_RE.test(context.eventId)) {
    return refuseRarity(
      RARITY_REFUSE_CODES.invalidIdentifier,
      "rarity.context.eventId",
      "Rarity eventId must be a stable lowercase identifier.",
    );
  }
  return null;
}

/**
 * Resolve one tier interval and then one candidate interval.
 *
 * Entropy is exclusively the portable SHA-256 of domain-separated canonical
 * bytes. The request type has no seed, draw, outcome, provenance, provider
 * response, clock, filesystem, or process field.
 */
export function resolveRarityRoll(
  context: RarityResolutionContext,
  policyValue: unknown,
  requestValue: unknown,
): RarityResolutionResult {
  const invalidContext = contextRefusal(context);
  if (invalidContext !== null) return invalidContext;
  const policy = validateRarityPolicy(policyValue);
  if (!policy.ok) return policy;
  const request = validateRarityRollRequest(requestValue, policy.value);
  if (!request.ok) return request;

  const policyDigest = digestRarityPolicy(policy.value);
  const requestDigest = digestRarityRequest(request.value);
  const tierTotalWeight = RARITY_TIERS.reduce(
    (total, tier) => total + policy.value.tierWeights[tier],
    0,
  );
  const tierRollDigest = digestCanonical(
    {
      algorithmId: RARITY_ALGORITHM_ID,
      phase: "tier",
      projectSeed: context.projectSeed,
      scope: context.scope,
      eventId: context.eventId,
      policyDigest,
      requestDigest,
    },
    portableKernelDigest,
  );
  const tierDraw = drawFor(tierRollDigest, tierTotalWeight);
  const tier = selectTier(policy.value, tierDraw);

  const tierCandidates = candidatesFor(request.value, tier);
  const candidateTotalWeight = candidateTotal(tierCandidates);
  const candidateRollDigest = digestCanonical(
    {
      algorithmId: RARITY_ALGORITHM_ID,
      phase: "candidate",
      projectSeed: context.projectSeed,
      scope: context.scope,
      eventId: context.eventId,
      policyDigest,
      requestDigest,
      tier,
      tierRollDigest,
    },
    portableKernelDigest,
  );
  const candidateDraw = drawFor(candidateRollDigest, candidateTotalWeight);
  const candidate = selectCandidate(tierCandidates, candidateDraw);
  const outcome: RarityOutcome = Object.freeze({
    schemaVersion: RARITY_SCHEMA_VERSION,
    kind: RARITY_OUTCOME_KIND,
    tier,
    candidateId: candidate.candidateId,
  });
  const outcomeDigest = digestRarityOutcome(outcome);
  const provenance: RarityProvenance = Object.freeze({
    schemaVersion: RARITY_SCHEMA_VERSION,
    kind: RARITY_PROVENANCE_KIND,
    algorithmId: RARITY_ALGORITHM_ID,
    scope: context.scope,
    eventId: context.eventId,
    policyDigest,
    requestDigest,
    tierRollDigest,
    tierDraw,
    tierTotalWeight,
    candidateRollDigest,
    candidateDraw,
    candidateTotalWeight,
    outcomeDigest,
  });
  const record: RarityRollRecord = Object.freeze({
    eventId: context.eventId,
    request: request.value,
    outcome,
    provenance,
  });
  return Object.freeze({
    ok: true as const,
    value: Object.freeze({ outcome, provenance, record }),
  });
}
