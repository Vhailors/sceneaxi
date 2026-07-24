/**
 * Provider-neutral Model Provider Port owned by authoring-core.
 *
 * Adapters are injected. The port always evaluates the profile policy before
 * dispatch and contains a non-overridable Kids route guard. No live adapter,
 * credential handling, fallback selection, or provider network code lives here.
 */

import {
  MODEL_PROVIDER_CALL_EVIDENCE_KIND,
  MODEL_PROVIDER_OPERATIONS,
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
  operationMismatch: "MODEL_PROVIDER_OPERATION_MISMATCH",
  adapterMissing: "MODEL_PROVIDER_ADAPTER_MISSING",
  profilePolicyMissing: "MODEL_PROVIDER_PROFILE_POLICY_MISSING",
  capabilityInvalid: "MODEL_PROVIDER_CAPABILITY_DESCRIPTOR_INVALID",
  capabilityUnsupported: "MODEL_PROVIDER_CAPABILITY_UNSUPPORTED",
  executedModelMissing: "MODEL_PROVIDER_EXECUTED_MODEL_MISSING",
  responseInvalid: "MODEL_PROVIDER_RESPONSE_ENVELOPE_INVALID",
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

type AdapterSuccessEnvelope = Readonly<{
  response: unknown;
  executedModel: ModelDescriptor;
}>;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: ReadonlyArray<string>,
) {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function isModelDescriptor(value: unknown): value is ModelDescriptor {
  if (!isRecord(value)) return false;
  if (!hasExactKeys(value, ["model", "provider", "quantization", "version"])) {
    return false;
  }
  return (
    typeof value.model === "string" &&
    value.model.length > 0 &&
    typeof value.provider === "string" &&
    value.provider.length > 0 &&
    typeof value.quantization === "string" &&
    value.quantization.length > 0 &&
    typeof value.version === "string" &&
    value.version.length > 0
  );
}

function isCapabilityDescriptor(
  value: unknown,
): value is ModelCapabilityDescriptor {
  if (!isRecord(value)) return false;
  if (!hasExactKeys(value, ["schemaVersion", "operations"])) return false;
  if (value.schemaVersion !== MODEL_PROVIDER_PORT_SCHEMA_VERSION) return false;
  if (!Array.isArray(value.operations)) return false;
  const supportedOperations = new Set<unknown>(MODEL_PROVIDER_OPERATIONS);
  return (
    new Set(value.operations).size === value.operations.length &&
    value.operations.every((operation) => supportedOperations.has(operation))
  );
}

function isAdapterSuccess(value: unknown): value is AdapterSuccessEnvelope {
  return (
    isRecord(value) &&
    Object.hasOwn(value, "response") &&
    Object.hasOwn(value, "executedModel") &&
    isModelDescriptor(value.executedModel)
  );
}

function isCompleteResponse(value: unknown): value is ModelCompleteResponse {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "schemaVersion",
      "operation",
      "text",
      "finishReason",
    ])
  ) {
    return false;
  }
  return (
    value.schemaVersion === MODEL_PROVIDER_PORT_SCHEMA_VERSION &&
    value.operation === "complete" &&
    typeof value.text === "string" &&
    (value.finishReason === "stop" || value.finishReason === "length")
  );
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, ancestors))
    : Object.values(value).every((item) => isJsonValue(item, ancestors));
  ancestors.delete(value);
  return valid;
}

function isToolCallResponse(value: unknown): value is ModelToolCallResponse {
  if (!isRecord(value)) return false;
  if (!hasExactKeys(value, ["schemaVersion", "operation", "toolCalls"])) {
    return false;
  }
  return (
    value.schemaVersion === MODEL_PROVIDER_PORT_SCHEMA_VERSION &&
    value.operation === "tool-call" &&
    Array.isArray(value.toolCalls) &&
    value.toolCalls.every(
      (toolCall) =>
        isRecord(toolCall) &&
        hasExactKeys(toolCall, ["name", "arguments"]) &&
        typeof toolCall.name === "string" &&
        toolCall.name.length > 0 &&
        isRecord(toolCall.arguments) &&
        isJsonValue(toolCall.arguments),
    )
  );
}

function isStreamChunk(value: unknown): value is ModelStreamChunk {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, ["schemaVersion", "operation", "delta", "done"])
  ) {
    return false;
  }
  return (
    value.schemaVersion === MODEL_PROVIDER_PORT_SCHEMA_VERSION &&
    value.operation === "stream" &&
    typeof value.delta === "string" &&
    typeof value.done === "boolean"
  );
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null ||
    !(Symbol.asyncIterator in value)
  ) {
    return false;
  }
  return typeof value[Symbol.asyncIterator] === "function";
}

async function collectStreamChunks(value: unknown) {
  if (!isAsyncIterable(value)) return undefined;
  const chunks: ModelStreamChunk[] = [];
  for await (const chunk of value) {
    if (!isStreamChunk(chunk)) return undefined;
    chunks.push(
      Object.freeze({
        schemaVersion: chunk.schemaVersion,
        operation: chunk.operation,
        delta: chunk.delta,
        done: chunk.done,
      }),
    );
  }
  return Object.freeze(chunks);
}

function replayStreamChunks(chunks: ReadonlyArray<ModelStreamChunk>) {
  return Object.freeze({
    async *[Symbol.asyncIterator]() {
      yield* chunks;
    },
  });
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
    expectedOperation: ModelProviderOperation,
  ): Promise<ModelProviderPreflight> => {
    if (request.schemaVersion !== MODEL_PROVIDER_PORT_SCHEMA_VERSION) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.schemaVersionUnsupported,
        `Model Provider request schema version '${String(request.schemaVersion)}' is unsupported; expected '${MODEL_PROVIDER_PORT_SCHEMA_VERSION}'.`,
      );
    }

    if (request.operation !== expectedOperation) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.operationMismatch,
        `Model Provider operation '${String(request.operation)}' does not match the '${expectedOperation}' entrypoint.`,
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

    if (!isCapabilityDescriptor(adapter.capabilities)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.capabilityInvalid,
        `The configured adapter capability descriptor is invalid or uses an unsupported schema version; expected '${MODEL_PROVIDER_PORT_SCHEMA_VERSION}'.`,
      );
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
    isResponse: (value: unknown) => value is Response,
  ): Promise<ModelProviderResult<Response>> => {
    if (!isAdapterSuccess(adapterResult)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.executedModelMissing,
        "The adapter did not attest a valid executed model descriptor; success refused.",
      );
    }
    if (!isResponse(adapterResult.response)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.responseInvalid,
        `The adapter returned an invalid '${request.operation}' response envelope; success refused.`,
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

  const succeedStream = async (
    request: ModelStreamRequest,
    adapterResult: unknown,
  ): Promise<ModelProviderResult<AsyncIterable<ModelStreamChunk>>> => {
    if (!isAdapterSuccess(adapterResult)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.executedModelMissing,
        "The adapter did not attest a valid executed model descriptor; success refused.",
      );
    }
    const chunks = await collectStreamChunks(adapterResult.response);
    if (chunks === undefined) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.responseInvalid,
        "The adapter returned an invalid 'stream' response envelope or chunk; success refused.",
      );
    }
    const evidence = evidenceFor(request, adapterResult.executedModel);
    await options.recordEvidence?.(evidence);
    return Object.freeze({
      ok: true,
      response: replayStreamChunks(chunks),
      evidence,
    });
  };

  return Object.freeze({
    async complete(request) {
      const ready = await preflight(request, "complete");
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
        isCompleteResponse,
      );
    },

    async toolCall(request) {
      const ready = await preflight(request, "tool-call");
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
        isToolCallResponse,
      );
    },

    async stream(request) {
      const ready = await preflight(request, "stream");
      if (!ready.ok) return ready;
      const { adapter } = ready;
      if (adapter.stream === undefined) {
        return refuse(
          MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
          "The configured adapter does not implement 'stream'.",
        );
      }
      return succeedStream(request, await adapter.stream(request));
    },
  });
}
