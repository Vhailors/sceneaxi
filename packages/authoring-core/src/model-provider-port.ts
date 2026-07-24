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
  type ModelDescriptor,
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
  schemaVersionUnsupported: "MODEL_PROVIDER_SCHEMA_VERSION_UNSUPPORTED",
  adapterMissing: "MODEL_PROVIDER_ADAPTER_MISSING",
  profilePolicyMissing: "MODEL_PROVIDER_PROFILE_POLICY_MISSING",
  capabilityUnsupported: "MODEL_PROVIDER_CAPABILITY_UNSUPPORTED",
  executedModelMissing: "MODEL_PROVIDER_EXECUTED_MODEL_MISSING",
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

export type ModelProviderAdapterSuccess<Response> = Readonly<{
  response: Response;
  executedModel: ModelDescriptor;
}>;

export type ModelProviderAdapter = Readonly<{
  routeKind: ModelProviderRouteKind;
  capabilities: ModelCapabilityDescriptor;
  complete?: (
    request: ModelCompleteRequest,
  ) =>
    | ModelProviderAdapterSuccess<ModelCompleteResponse>
    | Promise<ModelProviderAdapterSuccess<ModelCompleteResponse>>;
  toolCall?: (
    request: ModelToolCallRequest,
  ) =>
    | ModelProviderAdapterSuccess<ModelToolCallResponse>
    | Promise<ModelProviderAdapterSuccess<ModelToolCallResponse>>;
  stream?: (
    request: ModelStreamRequest,
  ) =>
    | ModelProviderAdapterSuccess<AsyncIterable<ModelStreamChunk>>
    | Promise<ModelProviderAdapterSuccess<AsyncIterable<ModelStreamChunk>>>;
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

function isModelDescriptor(value: unknown): value is ModelDescriptor {
  if (typeof value !== "object" || value === null) return false;
  const descriptor = value as Partial<Record<keyof ModelDescriptor, unknown>>;
  return (
    typeof descriptor.model === "string" &&
    descriptor.model.length > 0 &&
    typeof descriptor.provider === "string" &&
    descriptor.provider.length > 0 &&
    typeof descriptor.quantization === "string" &&
    descriptor.quantization.length > 0 &&
    typeof descriptor.version === "string" &&
    descriptor.version.length > 0
  );
}

function isAdapterSuccess<Response>(
  value: unknown,
): value is ModelProviderAdapterSuccess<Response> {
  return (
    typeof value === "object" &&
    value !== null &&
    "response" in value &&
    "executedModel" in value &&
    isModelDescriptor(value.executedModel)
  );
}

function evidenceFor(
  request: ModelProviderRequest,
  executedModel: ModelDescriptor,
) {
  const model = Object.freeze({
    model: executedModel.model,
    provider: executedModel.provider,
    quantization: executedModel.quantization,
    version: executedModel.version,
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
    if (request.schemaVersion !== MODEL_PROVIDER_PORT_SCHEMA_VERSION) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.schemaVersionUnsupported,
        `Model Provider request schema version '${String(request.schemaVersion)}' is unsupported; expected '${MODEL_PROVIDER_PORT_SCHEMA_VERSION}'.`,
      );
    }

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
    request: ModelProviderRequest,
    adapterResult: unknown,
  ): Promise<ModelProviderResult<Response>> => {
    if (!isAdapterSuccess<Response>(adapterResult)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.executedModelMissing,
        "The adapter did not attest a valid executed model descriptor; success refused.",
      );
    }
    const evidence = evidenceFor(request, adapterResult.executedModel);
    await options.recordEvidence?.(evidence);
    return Object.freeze({
      ok: true,
      response: adapterResult.response,
      evidence,
    });
  };

  return Object.freeze({
    async complete(request) {
      const ready = await preflight(request);
      if (!ready.ok) return ready;
      const { adapter } = ready;
      if (adapter.complete === undefined) {
        return refuse(
          MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
          "The configured adapter does not implement 'complete'.",
        );
      }
      return succeed<ModelCompleteResponse>(
        request,
        await adapter.complete(request),
      );
    },

    async toolCall(request) {
      const ready = await preflight(request);
      if (!ready.ok) return ready;
      const { adapter } = ready;
      if (adapter.toolCall === undefined) {
        return refuse(
          MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
          "The configured adapter does not implement 'tool-call'.",
        );
      }
      return succeed<ModelToolCallResponse>(
        request,
        await adapter.toolCall(request),
      );
    },

    async stream(request) {
      const ready = await preflight(request);
      if (!ready.ok) return ready;
      const { adapter } = ready;
      if (adapter.stream === undefined) {
        return refuse(
          MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
          "The configured adapter does not implement 'stream'.",
        );
      }
      return succeed<AsyncIterable<ModelStreamChunk>>(
        request,
        await adapter.stream(request),
      );
    },
  });
}
