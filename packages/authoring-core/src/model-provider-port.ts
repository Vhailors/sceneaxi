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
import {
  snapshotJsonObject,
  snapshotJsonValue,
} from "./json-invariants.js";

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

type ModelProviderAdapterDispatch<
  Request extends ModelProviderRequest,
  Response,
> = (
  request: Request,
) =>
  | ModelProviderAdapterSuccess<Response>
  | Promise<ModelProviderAdapterSuccess<Response>>;

type ModelProviderPreflight<
  Request extends ModelProviderRequest,
  Response,
> =
  | Readonly<{
      ok: true;
      dispatch: ModelProviderAdapterDispatch<Request, Response>;
      request: Request;
    }>
  | ModelProviderRefuse;

type AdapterSuccessEnvelope = Readonly<{
  response: unknown;
  executedModel: ModelDescriptor;
}>;

type AdapterSuccessCapture =
  | Readonly<{ ok: true; value: AdapterSuccessEnvelope }>
  | Readonly<{ ok: false; invalid: "executed-model" | "response" }>;

type ValueCapture<Value> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ ok: false }>;

type AsyncIteratorClose = (
  this: Record<PropertyKey, unknown>,
) => unknown;

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

function captureValue<Value>(read: () => Value): ValueCapture<Value> {
  try {
    return { ok: true, value: read() };
  } catch {
    return { ok: false };
  }
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

function snapshotModelDescriptor(value: ModelDescriptor): ModelDescriptor {
  return Object.freeze({
    model: value.model,
    provider: value.provider,
    quantization: value.quantization,
    version: value.version,
  });
}

type ModelPromptRequest<Operation extends "complete" | "stream"> = Readonly<{
  schemaVersion: typeof MODEL_PROVIDER_PORT_SCHEMA_VERSION;
  operation: Operation;
  profile: ModelProviderProfile;
  model: ModelDescriptor;
  prompt: string;
}>;

function snapshotPromptRequest<Operation extends "complete" | "stream">(
  request: ModelPromptRequest<Operation>,
): ModelPromptRequest<Operation> {
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

function snapshotCompleteResponse(
  response: ModelCompleteResponse,
): ModelCompleteResponse {
  return Object.freeze({
    schemaVersion: response.schemaVersion,
    operation: response.operation,
    text: response.text,
    finishReason: response.finishReason,
  });
}

function snapshotToolCallResponse(
  response: ModelToolCallResponse,
): ModelToolCallResponse {
  return Object.freeze({
    schemaVersion: response.schemaVersion,
    operation: response.operation,
    toolCalls: Object.freeze(
      response.toolCalls.map((toolCall) =>
        Object.freeze({
          name: toolCall.name,
          arguments: snapshotJsonObject(toolCall.arguments),
        }),
      ),
    ),
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

function captureAdapterSuccess(value: unknown): AdapterSuccessCapture {
  if (!isRecord(value) || !Object.hasOwn(value, "executedModel")) {
    return { ok: false, invalid: "executed-model" };
  }
  const executedModel = captureValue(() => value.executedModel);
  if (!executedModel.ok || !isModelDescriptor(executedModel.value)) {
    return { ok: false, invalid: "executed-model" };
  }
  const executedModelSnapshot = snapshotModelDescriptor(executedModel.value);
  if (!Object.hasOwn(value, "response")) {
    return { ok: false, invalid: "response" };
  }
  const response = captureValue(() => value.response);
  if (!response.ok) return { ok: false, invalid: "response" };
  return {
    ok: true,
    value: Object.freeze({
      response: response.value,
      executedModel: executedModelSnapshot,
    }),
  };
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

function captureAsyncIterable(value: unknown) {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null
  ) {
    return undefined;
  }
  const capturedIteratorMethod = captureValue(
    () =>
      (value as { readonly [Symbol.asyncIterator]?: unknown })[
        Symbol.asyncIterator
      ],
  );
  if (
    !capturedIteratorMethod.ok ||
    typeof capturedIteratorMethod.value !== "function"
  ) {
    return undefined;
  }
  const iteratorMethod = capturedIteratorMethod.value;
  const closeIterator = async (
    iterator: Record<PropertyKey, unknown>,
    close: AsyncIteratorClose,
  ) => {
    let closeResult: unknown;
    try {
      closeResult = await close.call(iterator);
    } catch {
      throw invalidStreamResponse(
        "The adapter async stream iterator could not be closed; stream refused.",
      );
    }
    if (
      (typeof closeResult !== "object" &&
        typeof closeResult !== "function") ||
      closeResult === null
    ) {
      throw invalidStreamResponse(
        "The adapter async stream iterator returned an invalid close result; stream refused.",
      );
    }
  };
  return Object.freeze({
    async *[Symbol.asyncIterator]() {
      const capturedIterator = captureValue(() =>
        iteratorMethod.call(value),
      );
      if (
        !capturedIterator.ok ||
        ((typeof capturedIterator.value !== "object" &&
          typeof capturedIterator.value !== "function") ||
          capturedIterator.value === null)
      ) {
        throw invalidStreamResponse(
          "The adapter returned an invalid async stream iterator; stream refused.",
        );
      }
      const iterator = capturedIterator.value as Record<PropertyKey, unknown>;
      const capturedNext = captureValue(() => iterator.next);
      if (!capturedNext.ok || typeof capturedNext.value !== "function") {
        throw invalidStreamResponse(
          "The adapter returned an async stream iterator without a callable next method; stream refused.",
        );
      }
      const next = capturedNext.value;
      const capturedReturn = captureValue(() => iterator.return);
      if (
        !capturedReturn.ok ||
        (capturedReturn.value !== undefined &&
          typeof capturedReturn.value !== "function")
      ) {
        throw invalidStreamResponse(
          "The adapter returned an async stream iterator with an invalid return method; stream refused.",
        );
      }
      const close = capturedReturn.value as AsyncIteratorClose | undefined;
      let completed = false;
      try {
        while (true) {
          let iterationResult: unknown;
          try {
            iterationResult = await next.call(iterator);
          } catch {
            throw invalidStreamResponse(
              "The adapter async stream iterator failed; stream refused.",
            );
          }
          if (
            (typeof iterationResult !== "object" &&
              typeof iterationResult !== "function") ||
            iterationResult === null
          ) {
            throw invalidStreamResponse(
              "The adapter async stream iterator returned an invalid result; stream refused.",
            );
          }
          const result = iterationResult as Record<PropertyKey, unknown>;
          const capturedDone = captureValue(() => result.done);
          if (
            !capturedDone.ok ||
            (capturedDone.value !== undefined &&
              typeof capturedDone.value !== "boolean")
          ) {
            throw invalidStreamResponse(
              "The adapter async stream iterator returned an invalid result; stream refused.",
            );
          }
          if (capturedDone.value === true) {
            completed = true;
            return;
          }
          const capturedValue = captureValue(() => result.value);
          if (!capturedValue.ok) {
            throw invalidStreamResponse(
              "The adapter async stream iterator returned an invalid result; stream refused.",
            );
          }
          yield capturedValue.value;
        }
      } finally {
        if (!completed && close !== undefined) {
          await closeIterator(iterator, close);
        }
      }
    },
  });
}

function invalidStreamResponse(message: string) {
  return Object.assign(new TypeError(message), {
    reason: MODEL_PROVIDER_REFUSE_REASONS.responseInvalid,
  });
}

function evidenceFor(
  request: ModelProviderRequest,
  executedModel: ModelDescriptor,
) {
  return Object.freeze({
    schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
    kind: MODEL_PROVIDER_CALL_EVIDENCE_KIND,
    operation: request.operation,
    profile: request.profile,
    model: snapshotModelDescriptor(executedModel),
  }) satisfies ModelProviderCallEvidence;
}

export function createModelProviderPort(
  options: CreateModelProviderPortOptions,
): ModelProviderPort {
  const preflight = async <
    Request extends ModelProviderRequest,
    Response,
  >(
    request: Request,
    expectedOperation: Request["operation"],
    snapshotRequest: (request: Request) => Request,
    selectDispatch: (
      adapter: ModelProviderAdapter,
    ) => ModelProviderAdapterDispatch<Request, Response> | undefined,
  ): Promise<ModelProviderPreflight<Request, Response>> => {
    if (!isJsonObject(request)) {
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

    const capturedRouteKind = captureValue(() => adapter.routeKind);
    if (
      !capturedRouteKind.ok ||
      !isModelProviderRouteKind(capturedRouteKind.value)
    ) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.routeKindInvalid,
        "The configured adapter route kind is invalid; dispatch refused.",
      );
    }
    const routeKind = capturedRouteKind.value;

    if (validatedRequest.profile === "@sceneaxi/profile-kids") {
      return kidsPolicyRefusal(routeKind);
    }

    const capturedCapabilities = captureValue(() => adapter.capabilities);
    if (
      !capturedCapabilities.ok ||
      !isCapabilityDescriptor(capturedCapabilities.value)
    ) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.capabilityInvalid,
        `The configured adapter capability descriptor is invalid or uses an unsupported schema version; expected '${MODEL_PROVIDER_PORT_SCHEMA_VERSION}'.`,
      );
    }

    const capabilities = snapshotCapabilities(capturedCapabilities.value);
    const capturedOperationMethod = captureValue(() => selectDispatch(adapter));
    if (
      !capturedOperationMethod.ok ||
      typeof capturedOperationMethod.value !== "function"
    ) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.capabilityUnsupported,
        `The configured adapter does not implement '${validatedRequest.operation}'.`,
      );
    }
    const operationMethod = capturedOperationMethod.value;
    const dispatch = (requestToDispatch: Request) =>
      operationMethod.call(adapter, requestToDispatch);
    const capturedPolicies = captureValue(
      () => options.profilePolicies as unknown,
    );
    if (!capturedPolicies.ok || !isRecord(capturedPolicies.value)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.profilePolicyMissing,
        `No Model Provider policy filter is registered for '${validatedRequest.profile}'; dispatch refused.`,
      );
    }
    const policies = capturedPolicies.value;
    const hasPolicy = captureValue(() =>
      Object.hasOwn(policies, validatedRequest.profile),
    );
    if (!hasPolicy.ok || !hasPolicy.value) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.profilePolicyMissing,
        `No Model Provider policy filter is registered for '${validatedRequest.profile}'; dispatch refused.`,
      );
    }
    const capturedPolicy = captureValue(
      () => policies[validatedRequest.profile],
    );
    if (!capturedPolicy.ok || typeof capturedPolicy.value !== "function") {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.policyDecisionInvalid,
        `The Model Provider policy filter for '${validatedRequest.profile}' is invalid; dispatch refused.`,
      );
    }
    const policy = capturedPolicy.value as ModelProviderPolicyFilter;

    let decision: unknown;
    try {
      decision = await policy(
        Object.freeze({
          profile: validatedRequest.profile,
          operation: validatedRequest.operation,
          model: validatedRequest.model,
          routeKind,
          capabilities,
        }),
      );
    } catch {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.policyDecisionInvalid,
        `The Model Provider policy filter for '${validatedRequest.profile}' failed; dispatch refused.`,
      );
    }
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

    return Object.freeze({ ok: true, dispatch, request: validatedRequest });
  };

  const succeed = async <Response>(
    request: ModelProviderRequest,
    adapterResult: unknown,
    isResponse: (value: unknown) => value is Response,
    snapshotResponse: (response: Response) => Response,
  ): Promise<ModelProviderResult<Response>> => {
    const capturedResult = captureAdapterSuccess(adapterResult);
    if (!capturedResult.ok && capturedResult.invalid === "executed-model") {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.executedModelMissing,
        "The adapter did not attest a valid executed model descriptor; success refused.",
      );
    }
    if (!capturedResult.ok) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.responseInvalid,
        `The adapter returned an invalid '${request.operation}' response envelope; success refused.`,
      );
    }
    const { response: adapterResponse, executedModel } = capturedResult.value;
    if (!isResponse(adapterResponse)) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.responseInvalid,
        `The adapter returned an invalid '${request.operation}' response envelope; success refused.`,
      );
    }
    const response = snapshotResponse(adapterResponse);
    const evidence = evidenceFor(request, executedModel);
    await options.recordEvidence?.(evidence);
    return Object.freeze({
      ok: true,
      response,
      evidence,
    });
  };

  const succeedStream = async (
    request: ModelStreamRequest,
    adapterResult: unknown,
  ): Promise<ModelProviderResult<AsyncIterable<ModelStreamChunk>>> => {
    const capturedResult = captureAdapterSuccess(adapterResult);
    if (!capturedResult.ok && capturedResult.invalid === "executed-model") {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.executedModelMissing,
        "The adapter did not attest a valid executed model descriptor; success refused.",
      );
    }
    if (!capturedResult.ok) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.responseInvalid,
        "The adapter returned an invalid 'stream' response envelope or chunk; success refused.",
      );
    }
    const { response: adapterResponse, executedModel } = capturedResult.value;
    const stream = captureAsyncIterable(adapterResponse);
    if (stream === undefined) {
      return refuse(
        MODEL_PROVIDER_REFUSE_REASONS.responseInvalid,
        "The adapter returned an invalid 'stream' response envelope or chunk; success refused.",
      );
    }
    const evidence = evidenceFor(request, executedModel);
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
        snapshotPromptRequest,
        (adapter) => adapter.complete,
      );
      if (!ready.ok) return ready;
      const { dispatch, request: validatedRequest } = ready;
      return succeed<ModelCompleteResponse>(
        validatedRequest,
        await dispatch(validatedRequest),
        isCompleteResponse,
        snapshotCompleteResponse,
      );
    },

    async toolCall(request) {
      const ready = await preflight(
        request,
        "tool-call",
        snapshotToolCallRequest,
        (adapter) => adapter.toolCall,
      );
      if (!ready.ok) return ready;
      const { dispatch, request: validatedRequest } = ready;
      return succeed<ModelToolCallResponse>(
        validatedRequest,
        await dispatch(validatedRequest),
        isToolCallResponse,
        snapshotToolCallResponse,
      );
    },

    async stream(request) {
      const ready = await preflight(
        request,
        "stream",
        snapshotPromptRequest,
        (adapter) => adapter.stream,
      );
      if (!ready.ok) return ready;
      const { dispatch, request: validatedRequest } = ready;
      return succeedStream(
        validatedRequest,
        await dispatch(validatedRequest),
      );
    },
  });
}
