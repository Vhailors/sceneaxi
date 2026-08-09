/** Provider-neutral rarity input and the existing E1 proposal edit boundary. */
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  RARITY_NAMESPACE_KIND,
  RARITY_REFUSE_CODES,
  RARITY_SCHEMA_VERSION,
  canonicalRarityJson,
  digestRarityNamespace,
  digestRarityPolicy,
  digestRarityProvenance,
  digestRarityRequest,
  isJsonObject,
  isRarityForbiddenInputKey,
  isRarityIdentifier,
  validateRarityNamespace,
  validateRarityPolicy,
  validateRarityProviderEvidence,
  validateRarityRollRequest,
  type JsonObject,
  type JsonValue,
  type ModelDescriptor,
  type ModelProviderCallEvidence,
  type ModelProviderProfile,
  type RarityNamespace,
  type RarityPolicy,
  type RarityRollRequest,
} from "@sceneaxi/schemas";
import type { ModelProviderPort } from "./model-provider-port.js";

export const RARITY_PROVIDER_TOOL_NAME = "propose_rarity" as const;

export const RARITY_AUTHORING_REFUSALS = Object.freeze({
  unsupportedProfile: "RARITY_AUTHORING_PROFILE_UNSUPPORTED",
  providerRefused: "RARITY_AUTHORING_PROVIDER_REFUSED",
  providerResponseInvalid: "RARITY_AUTHORING_PROVIDER_RESPONSE_INVALID",
  documentInvalid: "RARITY_AUTHORING_DOCUMENT_INVALID",
  providerEvidenceAbsent: "RARITY_AUTHORING_PROVIDER_EVIDENCE_ABSENT",
  providerEvidenceConflict: "RARITY_AUTHORING_PROVIDER_EVIDENCE_CONFLICT",
  providerEvidenceInvalid: "RARITY_AUTHORING_PROVIDER_EVIDENCE_INVALID",
  projectIdentityInvalid: "RARITY_AUTHORING_PROJECT_IDENTITY_INVALID",
  resolutionRefused: "RARITY_AUTHORING_KERNEL_RESOLUTION_REFUSED",
  resolutionMismatch: "RARITY_AUTHORING_KERNEL_RESOLUTION_MISMATCH",
} as const);

export type RarityAuthoringRefusal = Readonly<{
  ok: false;
  reason: string;
  message: string;
  path?: string;
}>;

export type RarityProviderContribution = Readonly<{
  policy: RarityPolicy;
  request: RarityRollRequest;
  providerEvidence: ModelProviderCallEvidence;
}>;

export type RarityProviderContributionResult =
  | Readonly<{ ok: true; value: RarityProviderContribution }>
  | RarityAuthoringRefusal;

export type RarityKernelResolutionInput = Readonly<{
  productId: string;
  seed: number;
  eventId: string;
  namespace: RarityNamespace;
  request: RarityRollRequest;
}>;

export type RarityKernelResolver = (
  input: RarityKernelResolutionInput,
) =>
  | Readonly<{ ok: true; value: RarityNamespace }>
  | Readonly<{ ok: false; reason: string; message: string; path?: string }>;

export type RarityProposalEdit = Readonly<{
  documentPath: string;
  jsonPointer: "/data";
  expectedContentHash: string;
  newValue: JsonObject;
}>;

export type SafeRarityEvidence = Readonly<{
  eventId: string;
  tier: string;
  candidateId: string;
  namespaceDigest: string;
  provenanceDigest: string;
  algorithmId: string;
  scope: string;
  projectSeed: number | null;
  policyDigest: string;
  requestDigest: string;
  outcomeDigest: string;
  tierRollDigest: string;
  candidateRollDigest: string;
  tierDraw: number;
  tierTotalWeight: number;
  candidateDraw: number;
  candidateTotalWeight: number;
  providerEvidence: ModelProviderCallEvidence;
}>;

export type RarityProposalStageResult =
  | Readonly<{
      ok: true;
      edit: RarityProposalEdit;
      namespace: RarityNamespace;
      evidence: SafeRarityEvidence;
      replayed: false;
    }>
  | Readonly<{
      ok: true;
      namespace: RarityNamespace;
      evidence: SafeRarityEvidence;
      replayed: true;
    }>
  | RarityAuthoringRefusal;

const providerToolSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: Object.freeze(["policy", "request"]),
  properties: Object.freeze({
    policy: Object.freeze({ type: "object" }),
    request: Object.freeze({ type: "object" }),
  }),
}) as JsonObject;

const refuse = (
  reason: string,
  message: string,
  path?: string,
): RarityAuthoringRefusal =>
  Object.freeze({ ok: false as const, reason, message, ...(path === undefined ? {} : { path }) });

export function safeRarityEvidenceFromNamespace(
  namespace: RarityNamespace,
  eventId: string,
  projectSeed: number | null = null,
): SafeRarityEvidence {
  const roll = namespace.rolls.find((candidate) => candidate.eventId === eventId);
  if (roll === undefined || namespace.providerEvidence === undefined) {
    throw new Error("validated rarity namespace is missing its accepted roll evidence");
  }
  return Object.freeze({
    eventId,
    tier: roll.outcome.tier,
    candidateId: roll.outcome.candidateId,
    namespaceDigest: digestRarityNamespace(namespace),
    provenanceDigest: digestRarityProvenance(roll.provenance),
    algorithmId: roll.provenance.algorithmId,
    scope: roll.provenance.scope,
    projectSeed,
    policyDigest: roll.provenance.policyDigest,
    requestDigest: roll.provenance.requestDigest,
    outcomeDigest: roll.provenance.outcomeDigest,
    tierRollDigest: roll.provenance.tierRollDigest,
    candidateRollDigest: roll.provenance.candidateRollDigest,
    tierDraw: roll.provenance.tierDraw,
    tierTotalWeight: roll.provenance.tierTotalWeight,
    candidateDraw: roll.provenance.candidateDraw,
    candidateTotalWeight: roll.provenance.candidateTotalWeight,
    providerEvidence: namespace.providerEvidence,
  });
}

/** Longest operator request carried into one provider envelope. */
export const RARITY_PROVIDER_REQUEST_MAX_CHARS = 2_000;

const RARITY_PROVIDER_INSTRUCTION =
  "Return one bounded SceneAxi rarity policy and candidate request. Do not return a seed, draw, outcome, provenance, credential, or transcript.";

/**
 * Ask one injected Model Provider Port for the bounded tool-call payload.
 *
 * A caller's own request text may ride along, truncated to
 * `RARITY_PROVIDER_REQUEST_MAX_CHARS` so an operator cannot put an unbounded
 * transcript in the envelope, and marked advisory: the outbound instruction is
 * the only thing that decides what shape comes back, and every returned byte is
 * still validated here. Nothing it says can supply a seed, draw, or outcome —
 * those are refused on the return path whatever was asked. Adapter responses
 * stop here; callers receive validated policy, request, and the port's exact
 * evidence record only.
 */
export async function requestRarityProviderContribution(input: Readonly<{
  port: ModelProviderPort;
  profile: ModelProviderProfile;
  model: ModelDescriptor;
  prompt?: string;
}>): Promise<RarityProviderContributionResult> {
  const operatorRequest = (input.prompt ?? "")
    .trim()
    .slice(0, RARITY_PROVIDER_REQUEST_MAX_CHARS);
  const result = await input.port.toolCall({
    schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
    operation: "tool-call",
    profile: input.profile,
    model: input.model,
    prompt: operatorRequest.length === 0
      ? RARITY_PROVIDER_INSTRUCTION
      : `${RARITY_PROVIDER_INSTRUCTION}\n\nOperator request (advisory only): ${operatorRequest}`,
    tools: Object.freeze([
      Object.freeze({
        name: RARITY_PROVIDER_TOOL_NAME,
        description: "Propose bounded rarity policy and candidate input.",
        inputSchema: providerToolSchema,
      }),
    ]),
  });
  if (!result.ok) {
    return refuse(
      result.reason,
      "The Model Provider Port refused the rarity input request before a proposal was staged.",
    );
  }
  const calls = result.response.toolCalls;
  const call = calls[0];
  if (calls.length !== 1 || call?.name !== RARITY_PROVIDER_TOOL_NAME) {
    return refuse(
      RARITY_AUTHORING_REFUSALS.providerResponseInvalid,
      "The provider did not return exactly one typed rarity proposal tool call.",
    );
  }
  if (!isJsonObject(call.arguments)) {
    return refuse(
      RARITY_AUTHORING_REFUSALS.providerResponseInvalid,
      "The provider rarity proposal arguments are not a JSON object.",
    );
  }
  const keys = Object.keys(call.arguments);
  if (
    keys.length !== 2 ||
    !Object.hasOwn(call.arguments, "policy") ||
    !Object.hasOwn(call.arguments, "request")
  ) {
    const forbidden = keys.find(isRarityForbiddenInputKey);
    return refuse(
      forbidden === undefined
        ? RARITY_AUTHORING_REFUSALS.providerResponseInvalid
        : RARITY_REFUSE_CODES.providerEntropyForbidden,
      "The provider rarity proposal contains unknown or authoritative fields.",
      forbidden === undefined ? undefined : `rarity.provider.${forbidden}`,
    );
  }
  const policy = validateRarityPolicy(call.arguments.policy);
  if (!policy.ok) return refuse(policy.code, policy.message, policy.path);
  const request = validateRarityRollRequest(call.arguments.request, policy.value);
  if (!request.ok) return refuse(request.code, request.message, request.path);
  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      policy: policy.value,
      request: request.value,
      providerEvidence: result.evidence,
    }),
  });
}

/**
 * Convert validated provider input into the ordinary `/data` E1 edit. The
 * validated replacement preserves every existing data value and adds only the
 * canonical `rarity` member; the pointer editor cannot create a missing leaf.
 * The injected resolver must return a kernel-produced namespace; this module
 * verifies every accepted byte before the DesktopSession can stage it.
 */
export function stageRarityProviderProposal(input: Readonly<{
  documentData: unknown;
  documentPath: string;
  expectedContentHash: string;
  profile: ModelProviderProfile;
  eventId: string;
  contribution: RarityProviderContribution;
  resolve: RarityKernelResolver;
}>): RarityProposalStageResult {
  if (input.profile !== "@sceneaxi/profile-game" && input.profile !== "@sceneaxi/profile-web") {
    return refuse(
      RARITY_AUTHORING_REFUSALS.unsupportedProfile,
      "Rarity authoring is available only to the Game and Web profiles; Kids remains refuse-only.",
    );
  }
  if (!isJsonObject(input.documentData)) {
    return refuse(
      RARITY_AUTHORING_REFUSALS.documentInvalid,
      "The active Scene Document data is not a JSON object.",
    );
  }
  const providerEvidence = validateRarityProviderEvidence(
    input.contribution.providerEvidence,
  );
  if (
    !providerEvidence.ok ||
    providerEvidence.value.operation !== "tool-call" ||
    providerEvidence.value.profile !== input.profile
  ) {
    return refuse(
      RARITY_AUTHORING_REFUSALS.providerEvidenceInvalid,
      "Rarity proposals require exact tool-call evidence for the profile being authored.",
      "rarity.providerEvidence",
    );
  }
  const productId = input.documentData.productId;
  const seed = input.documentData.seed;
  if (!isRarityIdentifier(productId) || !Number.isSafeInteger(seed)) {
    return refuse(
      RARITY_AUTHORING_REFUSALS.projectIdentityInvalid,
      "The active project must own a stable productId and safe integer seed before rarity can be proposed.",
    );
  }
  if (!isRarityIdentifier(input.eventId)) {
    return refuse(
      RARITY_REFUSE_CODES.invalidIdentifier,
      "The authoring-owned rarity event id is invalid.",
      "rarity.eventId",
    );
  }
  const policy = validateRarityPolicy(input.contribution.policy);
  if (!policy.ok) return refuse(policy.code, policy.message, policy.path);
  const request = validateRarityRollRequest(input.contribution.request, policy.value);
  if (!request.ok) return refuse(request.code, request.message, request.path);

  let existing: RarityNamespace = Object.freeze({
    schemaVersion: RARITY_SCHEMA_VERSION,
    kind: RARITY_NAMESPACE_KIND,
    policy: policy.value,
    rolls: Object.freeze([]),
    providerEvidence: providerEvidence.value,
  });
  if (input.documentData.rarity !== undefined) {
    const current = validateRarityNamespace(input.documentData.rarity);
    if (!current.ok) return refuse(current.code, current.message, current.path);
    existing = current.value;
    if (
      existing.rolls.length > 0 &&
      digestRarityPolicy(existing.policy) !== digestRarityPolicy(policy.value)
    ) {
      return refuse(
        RARITY_REFUSE_CODES.policyChanged,
        "An accepted rarity policy cannot change after the project has rolled.",
        "rarity.policy",
      );
    }
    // One namespace holds one provider call descriptor, and it describes every
    // roll in it. Both ways of breaking that are refused here, at the single
    // point the stored namespace is read, rather than on the branches that
    // happen to reach it: a namespace whose rolls have no descriptor cannot
    // borrow this call's — including the rolls a #240 kernel-only path produced,
    // which legitimately have none — and one that already has a descriptor
    // cannot be extended by a call carrying a different one.
    if (existing.rolls.length > 0 && existing.providerEvidence === undefined) {
      return refuse(
        RARITY_AUTHORING_REFUSALS.providerEvidenceAbsent,
        "The accepted rarity namespace already holds rolls with no provider evidence, so this call's descriptor cannot be attached to them; start a new rarity namespace instead.",
        "rarity.providerEvidence",
      );
    }
    if (
      existing.providerEvidence !== undefined &&
      canonicalRarityJson(existing.providerEvidence as unknown as JsonValue) !==
        canonicalRarityJson(providerEvidence.value as unknown as JsonValue)
    ) {
      return refuse(
        RARITY_AUTHORING_REFUSALS.providerEvidenceConflict,
        "The namespace records one provider call descriptor for every roll it holds, so a call with different model evidence cannot extend it; start a new rarity namespace instead.",
        "rarity.providerEvidence",
      );
    }
  }
  const prior = existing.rolls.find((roll) => roll.eventId === input.eventId);
  if (prior !== undefined) {
    if (digestRarityRequest(prior.request) !== digestRarityRequest(request.value)) {
      return refuse(
        RARITY_REFUSE_CODES.eventInputConflict,
        "An existing rarity event id cannot be reused with changed request bytes; reroll with a new event id.",
        `rarity.rolls.${input.eventId}.request`,
      );
    }
    let replayed: ReturnType<RarityKernelResolver>;
    try {
      replayed = input.resolve({
        productId,
        seed: seed as number,
        eventId: input.eventId,
        namespace: existing,
        request: request.value,
      });
    } catch {
      return refuse(
        RARITY_AUTHORING_REFUSALS.resolutionRefused,
        "The authoritative kernel rarity replay failed; no evidence was reported.",
      );
    }
    if (!replayed.ok) return refuse(replayed.reason, replayed.message, replayed.path);
    const verified = validateRarityNamespace(replayed.value);
    if (
      !verified.ok ||
      canonicalRarityJson(verified.value as unknown as JsonValue) !==
        canonicalRarityJson(existing as unknown as JsonValue)
    ) {
      return refuse(
        RARITY_AUTHORING_REFUSALS.resolutionMismatch,
        "The authoritative kernel replay did not reproduce the accepted rarity namespace exactly.",
      );
    }
    return Object.freeze({
      ok: true as const,
      namespace: verified.value,
      evidence: safeRarityEvidenceFromNamespace(verified.value, input.eventId, seed as number),
      replayed: true as const,
    });
  }

  const namespace: RarityNamespace = Object.freeze({
    schemaVersion: RARITY_SCHEMA_VERSION,
    kind: RARITY_NAMESPACE_KIND,
    policy: existing.rolls.length === 0 ? policy.value : existing.policy,
    rolls: existing.rolls,
    providerEvidence: existing.providerEvidence ?? providerEvidence.value,
  });
  let resolved: ReturnType<RarityKernelResolver>;
  try {
    resolved = input.resolve({
      productId,
      seed: seed as number,
      eventId: input.eventId,
      namespace,
      request: request.value,
    });
  } catch {
    return refuse(
      RARITY_AUTHORING_REFUSALS.resolutionRefused,
      "The authoritative kernel rarity resolver failed; no proposal was staged.",
    );
  }
  if (!resolved.ok) return refuse(resolved.reason, resolved.message, resolved.path);
  const accepted = validateRarityNamespace(resolved.value);
  if (!accepted.ok) return refuse(accepted.code, accepted.message, accepted.path);
  const roll = accepted.value.rolls.find((candidate) => candidate.eventId === input.eventId);
  const prefix = accepted.value.rolls.slice(0, existing.rolls.length);
  if (
    roll === undefined ||
    accepted.value.rolls.length !== existing.rolls.length + 1 ||
    canonicalRarityJson(prefix as unknown as JsonValue) !==
      canonicalRarityJson(existing.rolls as unknown as JsonValue) ||
    digestRarityPolicy(accepted.value.policy) !== digestRarityPolicy(namespace.policy) ||
    digestRarityRequest(roll.request) !== digestRarityRequest(request.value) ||
    canonicalRarityJson(accepted.value.providerEvidence as unknown as JsonValue) !==
      canonicalRarityJson(namespace.providerEvidence as unknown as JsonValue)
  ) {
    return refuse(
      RARITY_AUTHORING_REFUSALS.resolutionMismatch,
      "The kernel rarity resolution did not preserve the accepted policy, request, event, and provider evidence bytes.",
    );
  }
  return Object.freeze({
    ok: true as const,
    edit: Object.freeze({
      documentPath: input.documentPath,
      jsonPointer: "/data" as const,
      expectedContentHash: input.expectedContentHash,
      newValue: Object.freeze({ ...input.documentData, rarity: accepted.value }),
    }),
    namespace: accepted.value,
    evidence: safeRarityEvidenceFromNamespace(accepted.value, input.eventId, seed as number),
    replayed: false as const,
  });
}
