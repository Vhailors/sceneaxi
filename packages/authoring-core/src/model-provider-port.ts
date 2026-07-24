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
  MODEL_PROVIDER_ROUTE_KINDS,
  isJsonObject,
  isJsonValue,
  type JsonObject,
  type JsonValue,
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
  requestInvalid: "MODEL_PROVIDER_REQUEST_ENVELOPE_INVALID",
  adapterMissing: "MODEL_PROVIDER_ADAPTER_MISSING",
  routeKindInvalid: "MODEL_PROVIDER_ROUTE_KIND_INVALID",
  profilePolicyMissing: "MODEL_PROVIDER_PROFILE_POLICY_MISSING",
  policyDecisionInvalid: "MODEL_PROVIDER_POLICY_DECISION_INVALID",
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

type ModelProviderPreflight<Request extends ModelProviderRequest> =
  | Readonly<{
      ok: true;
      adapter: ModelProviderAdapter;
      request: Request;
    }>
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
  if (!isJsonObject(value)) return false;
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
  if (!isJsonObject(value)) return false;
  if (!hasExactKeys(value, ["schemaVersion", "operations"])) return false;
  if (value.schemaVersion !== MODEL_PROVIDER_PORT_SCHEMA_VERSION) return false;
  if (!Array.isArray(value.operations) || !isJsonValue(value.operations)) {
    return false;
  }
  const supportedOperations = new Set<unknown>(MODEL_PROVIDER_OPERATIONS);
  return (
    new Set(value.operations).size === value.operations.length &&
    value.operations.every((operation) => supportedOperations.has(operation))
  );
}

function isModelProviderRouteKind(
  value: unknown,
): value is ModelProviderRouteKind {
  return MODEL_PROVIDER_ROUTE_KINDS.some((routeKind) => routeKind === value);
}

function isModelProviderProfile(
  value: unknown,
): value is ModelProviderProfile {
  return (
    typeof value === "string" &&
    /^@sceneaxi\/profile-[a-z][a-z0-9-]*$/.test(value)
  );
}

function snapshotJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(snapshotJsonValue));
  }
  if (isJsonObject(value)) {
    return snapshotJsonObject(value);
  }
  return value;
}

function snapshotJsonObject(value: JsonObject): JsonObject {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        snapshotJsonValue(entry),
      ]),
    ),
  );
}

function snapshotModelDescriptor(value: ModelDescriptor): ModelDescriptor {
  return Object.freeze({
    model: value.model,
    provider: value.provider,
    quantization: value.quantization,
    version: value.version,
  });
}

function snapshotCompleteRequest(
  request: ModelCompleteRequest,
): ModelCompleteRequest {
  return Object.freeze({
    schemaVersion: request.schemaVersion,
    operation: request.operation,
    profile: request.profile,
    model: snapshotModelDescriptor(request.model),
    prompt: request.prompt,
  });
}

function snapshotToolCallRequest(
  request: ModelToolCallRequest,
): ModelToolCallRequest {
  return Object.freeze({
    schemaVersion: request.schemaVersion,
    operation: request.operation,
    profile: request.profile,
    model: snapshotModelDescriptor(request.model),
    prompt: request.prompt,
    tools: Object.freeze(
      request.tools.map((tool) =>
        Object.freeze({
          name: tool.name,
          ...(tool.description === undefined
            ? {}
            : { description: tool.description }),
          inputSchema: snapshotJsonObject(tool.inputSchema),
        }),
      ),
    ),
  });
}

function snapshotStreamRequest(request: ModelStreamRequest): ModelStreamRequest {
  return Object.freeze({
    schemaVersion: request.schemaVersion,
    operation: request.operation,
    profile: request.profile,
    model: snapshotModelDescriptor(request.model),
    prompt: request.prompt,
  });
}

function snapshotCapabilities(
  capabilities: ModelCapabilityDescriptor,
): ModelCapabilityDescriptor {
  return Object.freeze({
    schemaVersion: capabilities.schemaVersion,
    operations: Object.freeze([...capabilities.operations]),
  });
}

function hasRequiredAndOptionalKeys(
  value: Record<string, unknown>,
  required: ReadonlyArray<string>,
  optional: ReadonlyArray<string>,
) {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function isToolDescriptor(value: unknown) {
  if (!isJsonObject(value)) return false;
  if (
    !hasRequiredAndOptionalKeys(
      value,
      ["name", "inputSchema"],
      ["description"],
    )
  ) {
    return false;
  }
  return (
    typeof value.name === "string" &&
    value.name.length > 0 &&
    (!Object.hasOwn(value, "description") ||
      typeof value.description === "string") &&
    isJsonObject(value.inputSchema)
  );
}

function isRequestEnvelope(
  value: Record<string, unknown>,
  expectedOperation: ModelProviderOperation,
): boolean {
  if (
    !isJsonObject(value) ||
    !isModelProviderProfile(value.profile) ||
    !isModelDescriptor(value.model) ||
    typeof value.prompt !== "string"
  ) {
    return false;
  }
  if (expectedOperation === "tool-call") {
    return (
      hasExactKeys(value, [
        "schemaVersion",
        "operation",
        "profile",
        "model",
        "prompt",
        "tools",
      ]) &&
      Array.isArray(value.tools) &&
      isJsonValue(value.tools) &&
      value.tools.every(isToolDescriptor)
    );
  }
  return hasExactKeys(value, [
    "schemaVersion",
    "operation",
    "profile",
    "model",
    "prompt",
  ]);
}

function isAdapterSuccess(value: unknown): value is AdapterSuccessEnvelope {
  return (
    isRecord(value) &&
    Object.hasOwn(value, "response") &&
    Object.hasOwn(value, "executedModel") &&
    isModelDescriptor(value.executedModel)
  );
}

function isPolicyDecision(value: unknown): value is ModelProviderPolicyDecision {
  if (!isJsonObject(value)) return false;
  if (value.ok === true) return hasExactKeys(value, ["ok"]);
  return (
    value.ok === false &&
    hasExactKeys(value, ["ok", "reason", "message"]) &&
    typeof value.reason === "string" &&
    value.reason.length > 0 &&
    typeof value.message === "string" &&
    value.message.length > 0
  );
}

function isCompleteResponse(value: unknown): value is ModelCompleteResponse {
  if (!isJsonObject(value)) return false;
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

function isToolCallResponse(value: unknown): value is ModelToolCallResponse {
  if (!isJsonObject(value)) return false;
  if (!hasExactKeys(value, ["schemaVersion", "operation", "toolCalls"])) {
    return false;
  }
  return (
    value.schemaVersion === MODEL_PROVIDER_PORT_SCHEMA_VERSION &&
    value.operation === "tool-call" &&
    Array.isArray(value.toolCalls) &&
    isJsonValue(value.toolCalls) &&
    value.toolCalls.every(
      (toolCall) =>
        isJsonObject(toolCall) &&
        hasExactKeys(toolCall, ["name", "arguments"]) &&
        typeof toolCall.name === "string" &&
        toolCall.name.length > 0 &&
        isJsonObject(toolCall.arguments),
    )
  );
}

function isStreamChunk(value: unknown): value is ModelStreamChunk {
  if (!isJsonObject(value)) return false;
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

function asAsyncIterable(value: unknown) {
  return isAsyncIterable(value) ? value : undefined;
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
  const preflight = async <Request extends ModelProviderRequest>(
    request: Request,
    expectedOperation: Request["operation"],
    snapshotRequest: (request: Request) => Request,
  ): Promise<ModelProviderPreflight<Request>> => {
    if (!isRecord(request)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.requestInvalid,
        `The '${expectedOperation}' Model Provider request envelope is invalid; dispatch refused.`,
      );
    }

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

    if (!isRequestEnvelope(request, expectedOperation)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.requestInvalid,
        `The '${expectedOperation}' Model Provider request envelope is invalid; dispatch refused.`,
      );
    }

    const validatedRequest = snapshotRequest(request);
    const adapter = options.adapter;
    if (adapter === undefined) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.adapterMissing,
        "No Model Provider adapter is configured; dispatch refused.",
      );
    }

    const routeKind = adapter.routeKind;
    if (!isModelProviderRouteKind(routeKind)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.routeKindInvalid,
        "The configured adapter route kind is invalid; dispatch refused.",
      );
    }

    if (validatedRequest.profile === "@sceneaxi/profile-kids") {
      return kidsPolicyRefusal(routeKind);
    }

    const adapterCapabilities = adapter.capabilities;
    if (!isCapabilityDescriptor(adapterCapabilities)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.capabilityInvalid,
        `The configured adapter capability descriptor is invalid or uses an unsupported schema version; expected '${MODEL_PROVIDER_PORT_SCHEMA_VERSION}'.`,
      );
    }

    const capabilities = snapshotCapabilities(adapterCapabilities);
    const policy = Object.hasOwn(
      options.profilePolicies,
      validatedRequest.profile,
    )
      ? options.profilePolicies[validatedRequest.profile]
      : undefined;
    if (policy === undefined) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.profilePolicyMissing,
        `No Model Provider policy filter is registered for '${validatedRequest.profile}'; dispatch refused.`,
      );
    }

    const decision = await policy(
      Object.freeze({
        profile: validatedRequest.profile,
        operation: validatedRequest.operation,
        model: validatedRequest.model,
        routeKind,
        capabilities,
      }),
    );
    if (!isPolicyDecision(decision)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.policyDecisionInvalid,
        `The Model Provider policy filter for '${validatedRequest.profile}' returned an invalid decision; dispatch refused.`,
      );
    }
    if (!decision.ok) return refuse(decision.reason, decision.message);

    if (!capabilities.operations.includes(validatedRequest.operation)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
        `The configured adapter does not declare '${validatedRequest.operation}' capability.`,
      );
    }

    return Object.freeze({ ok: true, adapter, request: validatedRequest });
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
    const stream = asAsyncIterable(adapterResult.response);
    if (stream === undefined) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.responseInvalid,
        "The adapter returned an invalid 'stream' response envelope or chunk; success refused.",
      );
    }
    const evidence = evidenceFor(request, adapterResult.executedModel);
    let evidenceRecorded = false;
    const recordEvidenceOnce = async () => {
      if (evidenceRecorded) return;
      evidenceRecorded = true;
      await options.recordEvidence?.(evidence);
    };
    const response = Object.freeze({
      async *[Symbol.asyncIterator]() {
        let terminalAccepted = false;
        for await (const chunk of stream) {
          if (terminalAccepted) {
            throw Object.assign(
              new TypeError(
                "The adapter returned a 'stream' chunk after termination; stream refused.",
              ),
              { reason: MODEL_PROVIDER_REFUSE_REASONS.responseInvalid },
            );
          }
          if (!isStreamChunk(chunk)) {
            throw Object.assign(
              new TypeError(
                "The adapter returned an invalid 'stream' chunk; stream refused.",
              ),
              { reason: MODEL_PROVIDER_REFUSE_REASONS.responseInvalid },
            );
          }
          const acceptedChunk = Object.freeze({
            schemaVersion: chunk.schemaVersion,
            operation: chunk.operation,
            delta: chunk.delta,
            done: chunk.done,
          });
          if (acceptedChunk.done) {
            terminalAccepted = true;
            await recordEvidenceOnce();
          }
          yield acceptedChunk;
        }
        await recordEvidenceOnce();
      },
    });
    return Object.freeze({
      ok: true,
      response,
      evidence,
    });
  };

  return Object.freeze({
    async complete(request) {
      const ready = await preflight(
        request,
        "complete",
        snapshotCompleteRequest,
      );
      if (!ready.ok) return ready;
      const { adapter, request: validatedRequest } = ready;
      if (adapter.complete === undefined) {
        return refuse(
          MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
          "The configured adapter does not implement 'complete'.",
        );
      }
      return succeed<ModelCompleteResponse>(
        validatedRequest,
        await adapter.complete(validatedRequest),
        isCompleteResponse,
      );
    },

    async toolCall(request) {
      const ready = await preflight(
        request,
        "tool-call",
        snapshotToolCallRequest,
      );
      if (!ready.ok) return ready;
      const { adapter, request: validatedRequest } = ready;
      if (adapter.toolCall === undefined) {
        return refuse(
          MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
          "The configured adapter does not implement 'tool-call'.",
        );
      }
      return succeed<ModelToolCallResponse>(
        validatedRequest,
        await adapter.toolCall(validatedRequest),
        isToolCallResponse,
      );
    },

    async stream(request) {
      const ready = await preflight(request, "stream", snapshotStreamRequest);
      if (!ready.ok) return ready;
      const { adapter, request: validatedRequest } = ready;
      if (adapter.stream === undefined) {
        return refuse(
          MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
          "The configured adapter does not implement 'stream'.",
        );
      }
      return succeedStream(
        validatedRequest,
        await adapter.stream(validatedRequest),
      );
    },
  });
}
