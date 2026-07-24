/**
 * Provider-neutral Model Provider Port owned by authoring-core.
 *
 * Adapters are injected. The port always evaluates the profile policy before
 * dispatch and contains a non-overridable Kids route guard. No live adapter,
 * credential handling, fallback selection, or provider network code lives here.
 */

import {
  MODEL_PROVIDER_CALL_EVIDENCE_KIND,
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  type ModelCapabilityDescriptor,
  type ModelCompleteRequest,
  type ModelCompleteResponse,
  type ModelProviderCallEvidence,
  type ModelProviderOperation,
  type ModelProviderProfile,
  type ModelProviderRequest,
  type ModelProviderRouteKind,
  type ModelStreamChunk,
  type ModelStreamRequest,
  type ModelToolCallRequest,
  type ModelToolCallResponse,
} from "@sceneaxi/schemas";

export const MODEL_PROVIDER_REFUSE_REASONS = Object.freeze({
  adapterMissing: "MODEL_PROVIDER_ADAPTER_MISSING",
  profilePolicyMissing: "MODEL_PROVIDER_PROFILE_POLICY_MISSING",
  capabilityUnsupported: "MODEL_PROVIDER_CAPABILITY_UNSUPPORTED",
  kidsThirdPartyDenied: "THIRD_PARTY_LLM_DENIED_BY_DEFAULT",
  kidsRouteNotAllowed: "KIDS_LLM_ROUTE_NOT_ALLOWED",
} as const);

export type ModelProviderPolicyAllow = Readonly<{ ok: true }>;

export type ModelProviderPolicyRefuse = Readonly<{
  ok: false;
  reason: string;
  message: string;
}>;

export type ModelProviderPolicyDecision =
  | ModelProviderPolicyAllow
  | ModelProviderPolicyRefuse;

export type ModelProviderPolicyContext = Readonly<{
  profile: ModelProviderProfile;
  operation: ModelProviderOperation;
  model: ModelProviderRequest["model"];
  routeKind: ModelProviderRouteKind;
  capabilities: ModelCapabilityDescriptor;
}>;

export type ModelProviderPolicyFilter = (
  context: ModelProviderPolicyContext,
) => ModelProviderPolicyDecision | Promise<ModelProviderPolicyDecision>;

export type ModelProviderAdapter = Readonly<{
  routeKind: ModelProviderRouteKind;
  capabilities: ModelCapabilityDescriptor;
  complete?: (
    request: ModelCompleteRequest,
  ) => ModelCompleteResponse | Promise<ModelCompleteResponse>;
  toolCall?: (
    request: ModelToolCallRequest,
  ) => ModelToolCallResponse | Promise<ModelToolCallResponse>;
  stream?: (
    request: ModelStreamRequest,
  ) =>
    | AsyncIterable<ModelStreamChunk>
    | Promise<AsyncIterable<ModelStreamChunk>>;
}>;

export type ModelProviderRefuse = Readonly<{
  ok: false;
  reason: string;
  message: string;
}>;

export type ModelProviderSuccess<Response> = Readonly<{
  ok: true;
  response: Response;
  evidence: ModelProviderCallEvidence;
}>;

export type ModelProviderResult<Response> =
  | ModelProviderSuccess<Response>
  | ModelProviderRefuse;

export type ModelProviderPort = Readonly<{
  complete: (
    request: ModelCompleteRequest,
  ) => Promise<ModelProviderResult<ModelCompleteResponse>>;
  toolCall: (
    request: ModelToolCallRequest,
  ) => Promise<ModelProviderResult<ModelToolCallResponse>>;
  stream: (
    request: ModelStreamRequest,
  ) => Promise<ModelProviderResult<AsyncIterable<ModelStreamChunk>>>;
}>;

export type CreateModelProviderPortOptions = Readonly<{
  adapter?: ModelProviderAdapter;
  profilePolicies: Readonly<
    Partial<Record<ModelProviderProfile, ModelProviderPolicyFilter>>
  >;
  recordEvidence?: (
    evidence: ModelProviderCallEvidence,
  ) => void | Promise<void>;
}>;

type ModelProviderPreflight =
  | Readonly<{ ok: true; adapter: ModelProviderAdapter }>
  | ModelProviderRefuse;

function refuse(reason: string, message: string): ModelProviderRefuse {
  return Object.freeze({ ok: false, reason, message });
}

function kidsPolicyRefusal(
  routeKind: ModelProviderRouteKind,
): ModelProviderRefuse {
  if (routeKind === "third-party") {
    return refuse(
      MODEL_PROVIDER_REFUSE_REASONS.kidsThirdPartyDenied,
      "Third-party LLM routes are denied by default for Kids.",
    );
  }
  return refuse(
    MODEL_PROVIDER_REFUSE_REASONS.kidsRouteNotAllowed,
    "No Kids LLM route is enabled by the compiled port policy.",
  );
}

function evidenceFor(request: ModelProviderRequest) {
  const model = Object.freeze({
    model: request.model.model,
    provider: request.model.provider,
    quantization: request.model.quantization,
    version: request.model.version,
  });
  return Object.freeze({
    schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
    kind: MODEL_PROVIDER_CALL_EVIDENCE_KIND,
    operation: request.operation,
    profile: request.profile,
    model,
  }) satisfies ModelProviderCallEvidence;
}

export function createModelProviderPort(
  options: CreateModelProviderPortOptions,
): ModelProviderPort {
  const preflight = async (
    request: ModelProviderRequest,
  ): Promise<ModelProviderPreflight> => {
    const adapter = options.adapter;
    if (adapter === undefined) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.adapterMissing,
        "No Model Provider adapter is configured; dispatch refused.",
      );
    }

    if (request.profile === "@sceneaxi/profile-kids") {
      return kidsPolicyRefusal(adapter.routeKind);
    }

    const policy = options.profilePolicies[request.profile];
    if (policy === undefined) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.profilePolicyMissing,
        `No Model Provider policy filter is registered for '${request.profile}'; dispatch refused.`,
      );
    }

    const decision = await policy({
      profile: request.profile,
      operation: request.operation,
      model: request.model,
      routeKind: adapter.routeKind,
      capabilities: adapter.capabilities,
    });
    if (!decision.ok) return refuse(decision.reason, decision.message);

    if (!adapter.capabilities.operations.includes(request.operation)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
        `The configured adapter does not declare '${request.operation}' capability.`,
      );
    }

    return { ok: true, adapter };
  };

  const succeed = async <Response>(
    evidence: ModelProviderCallEvidence,
    response: Response,
  ): Promise<ModelProviderSuccess<Response>> => {
    await options.recordEvidence?.(evidence);
    return Object.freeze({ ok: true, response, evidence });
  };

  return Object.freeze({
    async complete(request) {
      const evidence = evidenceFor(request);
      const ready = await preflight(request);
      if (!ready.ok) return ready;
      const { adapter } = ready;
      if (adapter.complete === undefined) {
        return refuse(
          MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
          "The configured adapter does not implement 'complete'.",
        );
      }
      return succeed(evidence, await adapter.complete(request));
    },

    async toolCall(request) {
      const evidence = evidenceFor(request);
      const ready = await preflight(request);
      if (!ready.ok) return ready;
      const { adapter } = ready;
      if (adapter.toolCall === undefined) {
        return refuse(
          MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
          "The configured adapter does not implement 'tool-call'.",
        );
      }
      return succeed(evidence, await adapter.toolCall(request));
    },

    async stream(request) {
      const evidence = evidenceFor(request);
      const ready = await preflight(request);
      if (!ready.ok) return ready;
      const { adapter } = ready;
      if (adapter.stream === undefined) {
        return refuse(
          MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
          "The configured adapter does not implement 'stream'.",
        );
      }
      return succeed(evidence, await adapter.stream(request));
    },
  });
}
