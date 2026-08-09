/**
 * Deterministic rarity domain contract (sceneaxi#240).
 *
 * This module owns only plain, versioned project data and its validation and
 * canonical byte conventions. The authoritative weighted resolver lives in
 * @sceneaxi/engine-kernel, where the project seed and event identity can be
 * supplied by the kernel instead of by provider-authored request data.
 */
import type { JsonValue } from "./document.js";
import {
  MODEL_PROVIDER_CALL_EVIDENCE_KIND,
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  type ModelProviderCallEvidence,
} from "./model-provider.js";
import {
  firstMissingKey,
  firstUnexpectedKey,
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./record-validation.js";
import {
  canonicalSculptJson,
  digestSculptJson,
  snapshotSculptJson,
} from "./sculpt-json.js";

export const RARITY_SCHEMA_VERSION = 1 as const;
export const RARITY_FIXTURES_PATH = "contracts/rarity.fixtures.json" as const;
export const RARITY_ALGORITHM_ID =
  "sceneaxi.rarity.weighted-sha256-v1" as const;

export const RARITY_POLICY_KIND = "sceneaxi.rarity.policy" as const;
export const RARITY_REQUEST_KIND = "sceneaxi.rarity.request" as const;
export const RARITY_OUTCOME_KIND = "sceneaxi.rarity.outcome" as const;
export const RARITY_PROVENANCE_KIND = "sceneaxi.rarity.provenance" as const;
export const RARITY_NAMESPACE_KIND = "sceneaxi.rarity.namespace" as const;
export const RARITY_MAX_CANDIDATES = 64 as const;

/** Stable identifiers and cumulative-selection order. */
export const RARITY_TIERS = Object.freeze([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const);

export type RarityTierId = (typeof RARITY_TIERS)[number];

export const RARITY_REFUSE_CODES = Object.freeze({
  notObject: "RARITY_NOT_OBJECT",
  schemaVersionMismatch: "RARITY_SCHEMA_VERSION_MISMATCH",
  kindMismatch: "RARITY_KIND_MISMATCH",
  missingProperty: "RARITY_REQUIRED_PROPERTY_MISSING",
  unexpectedProperty: "RARITY_UNEXPECTED_PROPERTY",
  invalidIdentifier: "RARITY_IDENTIFIER_INVALID",
  invalidWeight: "RARITY_WEIGHT_INVALID",
  weightOverflow: "RARITY_WEIGHT_TOTAL_OVERFLOW",
  emptyInput: "RARITY_INPUT_EMPTY",
  inputBoundExceeded: "RARITY_INPUT_BOUND_EXCEEDED",
  zeroTotal: "RARITY_WEIGHT_TOTAL_ZERO",
  candidatePoolUnavailable: "RARITY_CANDIDATE_POOL_UNAVAILABLE",
  duplicateCandidate: "RARITY_CANDIDATE_DUPLICATE",
  duplicateEvent: "RARITY_EVENT_DUPLICATE",
  eventInputConflict: "RARITY_EVENT_INPUT_CONFLICT",
  providerEntropyForbidden: "RARITY_PROVIDER_ENTROPY_FORBIDDEN",
  seedInvalid: "RARITY_PROJECT_SEED_INVALID",
  policyAbsent: "RARITY_POLICY_ABSENT",
  policyChanged: "RARITY_POLICY_CHANGED",
  outcomeMismatch: "RARITY_OUTCOME_MISMATCH",
  provenanceMismatch: "RARITY_PROVENANCE_MISMATCH",
} as const);

export type RarityRefuseCode =
  (typeof RARITY_REFUSE_CODES)[keyof typeof RARITY_REFUSE_CODES];

export type RarityTierWeights = Readonly<Record<RarityTierId, number>>;

export type RarityPolicy = Readonly<{
  schemaVersion: typeof RARITY_SCHEMA_VERSION;
  kind: typeof RARITY_POLICY_KIND;
  tierWeights: RarityTierWeights;
}>;

export type RarityCandidate = Readonly<{
  candidateId: string;
  tier: RarityTierId;
  weight: number;
}>;

/** Provider/authoring-safe input: seed, draws, outcome, and provenance are absent. */
export type RarityRollRequest = Readonly<{
  schemaVersion: typeof RARITY_SCHEMA_VERSION;
  kind: typeof RARITY_REQUEST_KIND;
  candidates: ReadonlyArray<RarityCandidate>;
}>;

export type RarityOutcome = Readonly<{
  schemaVersion: typeof RARITY_SCHEMA_VERSION;
  kind: typeof RARITY_OUTCOME_KIND;
  tier: RarityTierId;
  candidateId: string;
}>;

export type RarityProvenance = Readonly<{
  schemaVersion: typeof RARITY_SCHEMA_VERSION;
  kind: typeof RARITY_PROVENANCE_KIND;
  algorithmId: typeof RARITY_ALGORITHM_ID;
  scope: string;
  eventId: string;
  policyDigest: string;
  requestDigest: string;
  tierRollDigest: string;
  tierDraw: number;
  tierTotalWeight: number;
  candidateRollDigest: string;
  candidateDraw: number;
  candidateTotalWeight: number;
  outcomeDigest: string;
}>;

export type RarityRollRecord = Readonly<{
  eventId: string;
  request: RarityRollRequest;
  outcome: RarityOutcome;
  provenance: RarityProvenance;
}>;

/** Canonical project-owned namespace; this extends ProductManifest, not a second model. */
export type RarityNamespace = Readonly<{
  schemaVersion: typeof RARITY_SCHEMA_VERSION;
  kind: typeof RARITY_NAMESPACE_KIND;
  policy: RarityPolicy;
  rolls: ReadonlyArray<RarityRollRecord>;
  /** Exact, bounded input provenance when a Model Provider Port proposed this namespace. */
  providerEvidence?: ModelProviderCallEvidence;
}>;

export type RarityValidationOk<Value> = Readonly<{
  ok: true;
  value: Value;
}>;

export type RarityValidationRefuse = Readonly<{
  ok: false;
  code: RarityRefuseCode;
  path: string;
  message: string;
}>;

export type RarityValidationResult<Value> =
  | RarityValidationOk<Value>
  | RarityValidationRefuse;

export function validateRarityProviderEvidence(
  value: unknown,
  path = "rarity.providerEvidence",
): RarityValidationResult<ModelProviderCallEvidence> {
  const evidence = snapshotPlainRecord(value);
  const evidenceFields = evidence === undefined
    ? null
    : requireExactFields(
        evidence,
        ["schemaVersion", "kind", "operation", "profile", "model"],
        path,
      );
  const model = evidence === undefined
    ? undefined
    : snapshotPlainRecord(evidence["model"]);
  const modelFields = model === undefined
    ? null
    : requireExactFields(
        model,
        ["model", "provider", "quantization", "version"],
        `${path}.model`,
      );
  if (
    evidence === undefined ||
    evidenceFields !== null ||
    evidence["schemaVersion"] !== MODEL_PROVIDER_PORT_SCHEMA_VERSION ||
    evidence["kind"] !== MODEL_PROVIDER_CALL_EVIDENCE_KIND ||
    evidence["operation"] !== "tool-call" ||
    (evidence["profile"] !== "@sceneaxi/profile-game" &&
      evidence["profile"] !== "@sceneaxi/profile-web") ||
    model === undefined ||
    modelFields !== null ||
    !["model", "provider", "quantization", "version"].every(
      (field) => typeof model[field] === "string" && model[field].length > 0,
    )
  ) {
    return refuseRarity(
      RARITY_REFUSE_CODES.provenanceMismatch,
      path,
      "Rarity provider evidence must be an exact Game or Web tool-call descriptor.",
    );
  }
  return ok(snapshotSculptJson(evidence) as unknown as ModelProviderCallEvidence);
}

const IDENTIFIER_RE = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

/**
 * The one key set no authoring or provider caller may supply on rarity input,
 * shared by every boundary that accepts caller-authored rarity data.
 */
export const RARITY_FORBIDDEN_INPUT_KEYS = Object.freeze([
  "seed",
  "projectSeed",
  "draw",
  "tierDraw",
  "candidateDraw",
  "outcome",
  "provenance",
  "providerResponse",
] as const);

export const RARITY_PROVIDER_REQUEST_MAX_CHARS = 2_000;

const FORBIDDEN_REQUEST_KEYS: ReadonlySet<string> = new Set<string>(
  RARITY_FORBIDDEN_INPUT_KEYS,
);

export function isRarityForbiddenInputKey(key: string): boolean {
  return FORBIDDEN_REQUEST_KEYS.has(key);
}

/**
 * The one rarity identifier predicate; scopes, event ids, and candidate ids all
 * answer to it so a caller-facing boundary cannot accept what the resolver
 * refuses.
 */
export function isRarityIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_RE.test(value);
}

function ok<Value>(value: Value): RarityValidationOk<Value> {
  return Object.freeze({ ok: true as const, value });
}

export function refuseRarity(
  code: RarityRefuseCode,
  path: string,
  message: string,
): RarityValidationRefuse {
  return Object.freeze({ ok: false as const, code, path, message });
}

function requireExactFields(
  record: Readonly<Record<string, unknown>>,
  required: readonly string[],
  path: string,
): RarityValidationRefuse | null {
  const missing = firstMissingKey(record, required);
  if (missing !== undefined) {
    return refuseRarity(
      RARITY_REFUSE_CODES.missingProperty,
      `${path}.${missing}`,
      `Missing required rarity property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(record, required);
  if (unexpected !== undefined) {
    return refuseRarity(
      RARITY_REFUSE_CODES.unexpectedProperty,
      `${path}.${unexpected}`,
      `Unexpected rarity property "${unexpected}".`,
    );
  }
  return null;
}

function validateHeader(
  value: unknown,
  kind: string,
  required: readonly string[],
  path: string,
):
  | Readonly<Record<string, unknown>>
  | RarityValidationRefuse {
  const record = snapshotPlainRecord(value);
  if (record === undefined) {
    return refuseRarity(
      RARITY_REFUSE_CODES.notObject,
      path,
      "Rarity contract value must be a plain JSON object.",
    );
  }
  if (record["schemaVersion"] !== RARITY_SCHEMA_VERSION) {
    return refuseRarity(
      RARITY_REFUSE_CODES.schemaVersionMismatch,
      `${path}.schemaVersion`,
      `Rarity schemaVersion must be ${String(RARITY_SCHEMA_VERSION)}; silent migration is refused.`,
    );
  }
  if (record["kind"] !== kind) {
    return refuseRarity(
      RARITY_REFUSE_CODES.kindMismatch,
      `${path}.kind`,
      `Rarity kind must be "${kind}".`,
    );
  }
  const fields = requireExactFields(record, required, path);
  return fields ?? record;
}

function isRefusal(
  value: Readonly<Record<string, unknown>> | RarityValidationRefuse,
): value is RarityValidationRefuse {
  return "ok" in value && value.ok === false;
}

function isRarityTier(value: unknown): value is RarityTierId {
  return RARITY_TIERS.some((tier) => tier === value);
}

function validWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function addWeight(
  total: number,
  weight: number,
  path: string,
): number | RarityValidationRefuse {
  if (weight > Number.MAX_SAFE_INTEGER - total) {
    return refuseRarity(
      RARITY_REFUSE_CODES.weightOverflow,
      path,
      "Rarity weight total exceeds Number.MAX_SAFE_INTEGER.",
    );
  }
  return total + weight;
}

export function validateRarityPolicy(
  value: unknown,
): RarityValidationResult<RarityPolicy> {
  const header = validateHeader(
    value,
    RARITY_POLICY_KIND,
    ["schemaVersion", "kind", "tierWeights"],
    "rarity.policy",
  );
  if (isRefusal(header)) return header;
  const weights = snapshotPlainRecord(header["tierWeights"]);
  if (weights === undefined) {
    return refuseRarity(
      RARITY_REFUSE_CODES.notObject,
      "rarity.policy.tierWeights",
      "Rarity tierWeights must be a plain JSON object.",
    );
  }
  const fields = requireExactFields(weights, RARITY_TIERS, "rarity.policy.tierWeights");
  if (fields !== null) return fields;

  let total = 0;
  const normalized = {} as Record<RarityTierId, number>;
  for (const tier of RARITY_TIERS) {
    const weight = weights[tier];
    if (!validWeight(weight)) {
      return refuseRarity(
        RARITY_REFUSE_CODES.invalidWeight,
        `rarity.policy.tierWeights.${tier}`,
        "Rarity policy weights must be non-negative safe integers.",
      );
    }
    const next = addWeight(total, weight, `rarity.policy.tierWeights.${tier}`);
    if (typeof next !== "number") return next;
    total = next;
    normalized[tier] = weight;
  }
  if (total === 0) {
    return refuseRarity(
      RARITY_REFUSE_CODES.zeroTotal,
      "rarity.policy.tierWeights",
      "Rarity policy tier weights must have a non-zero total.",
    );
  }
  return ok(
    snapshotSculptJson({
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_POLICY_KIND,
      tierWeights: normalized,
    }),
  );
}

function validateCandidate(
  value: unknown,
  index: number,
): RarityValidationResult<RarityCandidate> {
  const path = `rarity.request.candidates[${String(index)}]`;
  const record = snapshotPlainRecord(value);
  if (record === undefined) {
    return refuseRarity(
      RARITY_REFUSE_CODES.notObject,
      path,
      "Rarity candidate must be a plain JSON object.",
    );
  }
  const fields = requireExactFields(record, ["candidateId", "tier", "weight"], path);
  if (fields !== null) return fields;
  if (!isRarityIdentifier(record["candidateId"])) {
    return refuseRarity(
      RARITY_REFUSE_CODES.invalidIdentifier,
      `${path}.candidateId`,
      "Rarity candidateId must be a stable lowercase identifier.",
    );
  }
  if (!isRarityTier(record["tier"])) {
    return refuseRarity(
      RARITY_REFUSE_CODES.invalidIdentifier,
      `${path}.tier`,
      `Rarity tier must be one of ${RARITY_TIERS.join(", ")}.`,
    );
  }
  if (!validWeight(record["weight"])) {
    return refuseRarity(
      RARITY_REFUSE_CODES.invalidWeight,
      `${path}.weight`,
      "Rarity candidate weights must be non-negative safe integers.",
    );
  }
  return ok(
    Object.freeze({
      candidateId: record["candidateId"],
      tier: record["tier"],
      weight: record["weight"],
    }),
  );
}

export function validateRarityRollRequest(
  value: unknown,
  policy?: RarityPolicy,
): RarityValidationResult<RarityRollRequest> {
  const raw = snapshotPlainRecord(value);
  if (raw !== undefined) {
    const forbidden = Object.keys(raw).find(isRarityForbiddenInputKey);
    if (forbidden !== undefined) {
      return refuseRarity(
        RARITY_REFUSE_CODES.providerEntropyForbidden,
        `rarity.request.${forbidden}`,
        `Provider/authoring rarity input cannot supply authoritative "${forbidden}" data.`,
      );
    }
  }
  const header = validateHeader(
    value,
    RARITY_REQUEST_KIND,
    ["schemaVersion", "kind", "candidates"],
    "rarity.request",
  );
  if (isRefusal(header)) return header;
  const candidates = snapshotPlainArray(header["candidates"]);
  if (candidates === undefined) {
    return refuseRarity(
      RARITY_REFUSE_CODES.emptyInput,
      "rarity.request.candidates",
      "Rarity candidates must be a dense JSON array.",
    );
  }
  if (candidates.length === 0) {
    return refuseRarity(
      RARITY_REFUSE_CODES.emptyInput,
      "rarity.request.candidates",
      "Rarity candidates cannot be empty.",
    );
  }
  if (candidates.length > RARITY_MAX_CANDIDATES) {
    return refuseRarity(
      RARITY_REFUSE_CODES.inputBoundExceeded,
      "rarity.request.candidates",
      `Rarity candidates cannot exceed ${String(RARITY_MAX_CANDIDATES)} entries.`,
    );
  }

  const normalized: RarityCandidate[] = [];
  const ids = new Set<string>();
  const totals: Record<RarityTierId, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  let candidateTotal = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = validateCandidate(candidates[index], index);
    if (!candidate.ok) return candidate;
    if (ids.has(candidate.value.candidateId)) {
      return refuseRarity(
        RARITY_REFUSE_CODES.duplicateCandidate,
        `rarity.request.candidates[${String(index)}].candidateId`,
        `Duplicate rarity candidateId "${candidate.value.candidateId}".`,
      );
    }
    ids.add(candidate.value.candidateId);
    const prior = totals[candidate.value.tier];
    const next = addWeight(
      prior,
      candidate.value.weight,
      `rarity.request.candidates[${String(index)}].weight`,
    );
    if (typeof next !== "number") return next;
    totals[candidate.value.tier] = next;
    const nextCandidateTotal = addWeight(
      candidateTotal,
      candidate.value.weight,
      `rarity.request.candidates[${String(index)}].weight`,
    );
    if (typeof nextCandidateTotal !== "number") return nextCandidateTotal;
    candidateTotal = nextCandidateTotal;
    normalized.push(candidate.value);
  }

  if (candidateTotal === 0) {
    return refuseRarity(
      RARITY_REFUSE_CODES.zeroTotal,
      "rarity.request.candidates",
      "Rarity candidate weights must have a non-zero total.",
    );
  }
  if (policy !== undefined) {
    for (const tier of RARITY_TIERS) {
      if (policy.tierWeights[tier] > 0 && totals[tier] === 0) {
        return refuseRarity(
          RARITY_REFUSE_CODES.candidatePoolUnavailable,
          "rarity.request.candidates",
          `Positive-weight rarity tier "${tier}" needs a positive candidate pool.`,
        );
      }
    }
  }
  return ok(
    snapshotSculptJson({
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_REQUEST_KIND,
      candidates: normalized,
    }),
  );
}

export function validateRarityOutcome(
  value: unknown,
): RarityValidationResult<RarityOutcome> {
  const header = validateHeader(
    value,
    RARITY_OUTCOME_KIND,
    ["schemaVersion", "kind", "tier", "candidateId"],
    "rarity.outcome",
  );
  if (isRefusal(header)) return header;
  if (!isRarityTier(header["tier"])) {
    return refuseRarity(
      RARITY_REFUSE_CODES.invalidIdentifier,
      "rarity.outcome.tier",
      "Rarity outcome tier is invalid.",
    );
  }
  if (!isRarityIdentifier(header["candidateId"])) {
    return refuseRarity(
      RARITY_REFUSE_CODES.invalidIdentifier,
      "rarity.outcome.candidateId",
      "Rarity outcome candidateId is invalid.",
    );
  }
  return ok(
    Object.freeze({
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_OUTCOME_KIND,
      tier: header["tier"],
      candidateId: header["candidateId"],
    }),
  );
}

const PROVENANCE_FIELDS = Object.freeze([
  "schemaVersion",
  "kind",
  "algorithmId",
  "scope",
  "eventId",
  "policyDigest",
  "requestDigest",
  "tierRollDigest",
  "tierDraw",
  "tierTotalWeight",
  "candidateRollDigest",
  "candidateDraw",
  "candidateTotalWeight",
  "outcomeDigest",
]);

export function validateRarityProvenance(
  value: unknown,
): RarityValidationResult<RarityProvenance> {
  const header = validateHeader(
    value,
    RARITY_PROVENANCE_KIND,
    PROVENANCE_FIELDS,
    "rarity.provenance",
  );
  if (isRefusal(header)) return header;
  if (header["algorithmId"] !== RARITY_ALGORITHM_ID) {
    return refuseRarity(
      RARITY_REFUSE_CODES.kindMismatch,
      "rarity.provenance.algorithmId",
      `Rarity algorithmId must be "${RARITY_ALGORITHM_ID}".`,
    );
  }
  if (!isRarityIdentifier(header["scope"]) || !isRarityIdentifier(header["eventId"])) {
    return refuseRarity(
      RARITY_REFUSE_CODES.invalidIdentifier,
      "rarity.provenance",
      "Rarity provenance scope and eventId must be stable lowercase identifiers.",
    );
  }
  for (const field of [
    "policyDigest",
    "requestDigest",
    "tierRollDigest",
    "candidateRollDigest",
    "outcomeDigest",
  ]) {
    if (typeof header[field] !== "string" || !DIGEST_RE.test(header[field])) {
      return refuseRarity(
        RARITY_REFUSE_CODES.provenanceMismatch,
        `rarity.provenance.${field}`,
        `Rarity provenance ${field} must be sha256:<64 lowercase hex>.`,
      );
    }
  }
  for (const field of [
    "tierDraw",
    "tierTotalWeight",
    "candidateDraw",
    "candidateTotalWeight",
  ]) {
    const number = header[field];
    if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0) {
      return refuseRarity(
        RARITY_REFUSE_CODES.provenanceMismatch,
        `rarity.provenance.${field}`,
        `Rarity provenance ${field} must be a non-negative safe integer.`,
      );
    }
  }
  if (
    header["tierTotalWeight"] === 0 ||
    header["candidateTotalWeight"] === 0 ||
    (header["tierDraw"] as number) >= (header["tierTotalWeight"] as number) ||
    (header["candidateDraw"] as number) >= (header["candidateTotalWeight"] as number)
  ) {
    return refuseRarity(
      RARITY_REFUSE_CODES.provenanceMismatch,
      "rarity.provenance",
      "Rarity provenance draws must lie inside their non-zero weighted intervals.",
    );
  }
  return ok(snapshotSculptJson(header) as unknown as RarityProvenance);
}

function validateRarityRollRecord(
  value: unknown,
  index: number,
  policy: RarityPolicy,
): RarityValidationResult<RarityRollRecord> {
  const path = `rarity.rolls[${String(index)}]`;
  const record = snapshotPlainRecord(value);
  if (record === undefined) {
    return refuseRarity(
      RARITY_REFUSE_CODES.notObject,
      path,
      "Rarity roll record must be a plain JSON object.",
    );
  }
  const fields = requireExactFields(
    record,
    ["eventId", "request", "outcome", "provenance"],
    path,
  );
  if (fields !== null) return fields;
  if (!isRarityIdentifier(record["eventId"])) {
    return refuseRarity(
      RARITY_REFUSE_CODES.invalidIdentifier,
      `${path}.eventId`,
      "Rarity eventId must be a stable lowercase identifier.",
    );
  }
  const request = validateRarityRollRequest(record["request"], policy);
  if (!request.ok) return request;
  const outcome = validateRarityOutcome(record["outcome"]);
  if (!outcome.ok) return outcome;
  const provenance = validateRarityProvenance(record["provenance"]);
  if (!provenance.ok) return provenance;
  if (provenance.value.eventId !== record["eventId"]) {
    return refuseRarity(
      RARITY_REFUSE_CODES.provenanceMismatch,
      `${path}.provenance.eventId`,
      "Rarity provenance eventId must equal the roll record eventId.",
    );
  }
  return ok(
    snapshotSculptJson({
      eventId: record["eventId"],
      request: request.value,
      outcome: outcome.value,
      provenance: provenance.value,
    }),
  );
}

export function validateRarityNamespace(
  value: unknown,
): RarityValidationResult<RarityNamespace> {
  const raw = snapshotPlainRecord(value);
  const hasProviderEvidence = raw !== undefined && Object.hasOwn(raw, "providerEvidence");
  const header = validateHeader(
    value,
    RARITY_NAMESPACE_KIND,
    [
      "schemaVersion",
      "kind",
      "policy",
      "rolls",
      ...(hasProviderEvidence ? ["providerEvidence"] : []),
    ],
    "rarity",
  );
  if (isRefusal(header)) return header;
  const policy = validateRarityPolicy(header["policy"]);
  if (!policy.ok) return policy;
  const rolls = snapshotPlainArray(header["rolls"]);
  if (rolls === undefined) {
    return refuseRarity(
      RARITY_REFUSE_CODES.notObject,
      "rarity.rolls",
      "Rarity rolls must be a dense JSON array.",
    );
  }
  const normalized: RarityRollRecord[] = [];
  const events = new Set<string>();
  for (let index = 0; index < rolls.length; index += 1) {
    const roll = validateRarityRollRecord(rolls[index], index, policy.value);
    if (!roll.ok) return roll;
    if (events.has(roll.value.eventId)) {
      return refuseRarity(
        RARITY_REFUSE_CODES.duplicateEvent,
        `rarity.rolls[${String(index)}].eventId`,
        `Duplicate rarity eventId "${roll.value.eventId}".`,
      );
    }
    events.add(roll.value.eventId);
    normalized.push(roll.value);
  }
  let providerEvidence: ModelProviderCallEvidence | undefined;
  if (hasProviderEvidence) {
    const evidence = validateRarityProviderEvidence(header["providerEvidence"]);
    if (!evidence.ok) return evidence;
    providerEvidence = evidence.value;
  }
  return ok(
    snapshotSculptJson({
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_NAMESPACE_KIND,
      policy: policy.value,
      rolls: normalized,
      ...(providerEvidence === undefined ? {} : { providerEvidence }),
    }),
  );
}

/** Canonical compact JSON bytes used by all rarity digests. */
export function canonicalRarityJson(value: JsonValue): string {
  return canonicalSculptJson(value);
}

/** Canonical project serialization ends in one newline, matching other artifacts. */
export function serializeRarityNamespace(value: RarityNamespace): string {
  return `${canonicalRarityJson(value as unknown as JsonValue)}\n`;
}

export function digestRarityValue(value: JsonValue): string {
  return digestSculptJson(value);
}

export function digestRarityPolicy(value: RarityPolicy): string {
  return digestRarityValue(value as unknown as JsonValue);
}

export function digestRarityRequest(value: RarityRollRequest): string {
  return digestRarityValue(value as unknown as JsonValue);
}

export function digestRarityOutcome(value: RarityOutcome): string {
  return digestRarityValue(value as unknown as JsonValue);
}

export function digestRarityProvenance(value: RarityProvenance): string {
  return digestRarityValue(value as unknown as JsonValue);
}

export function digestRarityNamespace(value: RarityNamespace): string {
  return digestRarityValue(value as unknown as JsonValue);
}
