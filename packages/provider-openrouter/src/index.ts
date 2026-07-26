/**
 * @sceneaxi/provider-openrouter — thin OpenRouter transport adapter.
 *
 * The adapter owns no credentials and performs no network I/O itself. A caller
 * injects a transport, then the adapter translates Model Provider Port calls
 * into pinned OpenRouter-shaped requests. Kids denial remains in the port and
 * cannot be bypassed here.
 */
import type {
  ModelCapabilityDescriptor,
  ModelCompleteRequest,
  ModelCompleteResponse,
  ModelDescriptor,
  ModelProviderAdapter,
  ModelToolCallRequest,
  ModelToolCallResponse,
} from "@sceneaxi/authoring-core";
import { Ajv, type ValidateFunction } from "ajv";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  isJsonObject,
  parseUnambiguousJson,
  type JsonObject,
  type PackageSeam,
} from "@sceneaxi/schemas";

export const OPENROUTER_ADAPTER_SCHEMA_VERSION = 1 as const;
export const OPENROUTER_PROVIDER_ID = "openrouter" as const;

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/provider-openrouter",
  releaseGroup: "importers",
});

export type OpenRouterEvalConfig = Readonly<{
  mode: "deterministic";
  allowFallbacks: false;
  temperature: 0;
  seed: number;
}>;

export type OpenRouterTransportRequest = Readonly<{
  schemaVersion: typeof OPENROUTER_ADAPTER_SCHEMA_VERSION;
  operation: "complete" | "tool-call";
  modelDescriptor: ModelDescriptor;
  model: string;
  messages: readonly [
    Readonly<{ role: "user"; content: string }>,
  ];
  provider: Readonly<{ allow_fallbacks: false }>;
  temperature: 0;
  seed: number;
  tools?: ReadonlyArray<
    Readonly<{
      type: "function";
      function: Readonly<{
        name: string;
        description?: string;
        parameters: Readonly<Record<string, unknown>>;
      }>;
    }>
  >;
}>;

export type OpenRouterTransportResult = Readonly<{
  response: unknown;
  executedModel: ModelDescriptor;
}>;

export type OpenRouterTransport = (
  request: OpenRouterTransportRequest,
) => OpenRouterTransportResult | Promise<OpenRouterTransportResult>;

export type CreateOpenRouterAdapterOptions = Readonly<{
  model: ModelDescriptor;
  eval: OpenRouterEvalConfig;
  transport: OpenRouterTransport;
}>;

export const OPENROUTER_ADAPTER_ERROR_CODES = Object.freeze({
  configurationInvalid: "OPENROUTER_ADAPTER_CONFIGURATION_INVALID",
  requestModelNotPinned: "OPENROUTER_REQUEST_MODEL_NOT_PINNED",
  responseInvalid: "OPENROUTER_RESPONSE_INVALID",
  responseModelMismatch: "OPENROUTER_RESPONSE_MODEL_MISMATCH",
  fixtureNotRecorded: "OPENROUTER_FIXTURE_NOT_RECORDED",
} as const);

export class OpenRouterAdapterError extends Error {
  readonly code: (typeof OPENROUTER_ADAPTER_ERROR_CODES)[keyof typeof OPENROUTER_ADAPTER_ERROR_CODES];

  constructor(
    code: OpenRouterAdapterError["code"],
    message: string,
  ) {
    super(message);
    this.name = "OpenRouterAdapterError";
    this.code = code;
  }
}

const capabilities: ModelCapabilityDescriptor = Object.freeze({
  schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  operations: Object.freeze(["complete", "tool-call"] as const),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isModelDescriptor(value: unknown): value is ModelDescriptor {
  return (
    isRecord(value) &&
    typeof value["model"] === "string" &&
    typeof value["provider"] === "string" &&
    typeof value["quantization"] === "string" &&
    typeof value["version"] === "string"
  );
}

function sameModel(left: ModelDescriptor, right: ModelDescriptor) {
  return (
    left.model === right.model &&
    left.provider === right.provider &&
    left.quantization === right.quantization &&
    left.version === right.version
  );
}

function validateOptions(options: CreateOpenRouterAdapterOptions) {
  const validModel =
    options.model.provider === OPENROUTER_PROVIDER_ID &&
    options.model.model.trim().length > 0 &&
    options.model.quantization.trim().length > 0 &&
    options.model.version.trim().length > 0;
  const validEval =
    options.eval.mode === "deterministic" &&
    options.eval.allowFallbacks === false &&
    options.eval.temperature === 0 &&
    Number.isSafeInteger(options.eval.seed);
  if (!validModel || !validEval || typeof options.transport !== "function") {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.configurationInvalid,
      "OpenRouter requires an exact provider/model/quantization/version pin and deterministic no-fallback eval configuration.",
    );
  }
}

function assertPinnedRequest(
  request: ModelCompleteRequest | ModelToolCallRequest,
  pinnedModel: ModelDescriptor,
) {
  if (!sameModel(request.model, pinnedModel)) {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.requestModelNotPinned,
      "The request model does not exactly match the configured OpenRouter model pin.",
    );
  }
}

function transportRequest(
  request: ModelCompleteRequest | ModelToolCallRequest,
  evalConfig: OpenRouterEvalConfig,
): OpenRouterTransportRequest {
  const base = {
    schemaVersion: OPENROUTER_ADAPTER_SCHEMA_VERSION,
    operation: request.operation,
    modelDescriptor: Object.freeze({ ...request.model }),
    model: request.model.model,
    messages: Object.freeze([
      Object.freeze({ role: "user" as const, content: request.prompt }),
    ]) as OpenRouterTransportRequest["messages"],
    provider: Object.freeze({ allow_fallbacks: false as const }),
    temperature: 0 as const,
    seed: evalConfig.seed,
  };
  if (request.operation === "complete") return Object.freeze(base);
  return Object.freeze({
    ...base,
    tools: Object.freeze(
      request.tools.map((tool) =>
        Object.freeze({
          type: "function" as const,
          function: Object.freeze({
            name: tool.name,
            ...(tool.description === undefined
              ? {}
              : { description: tool.description }),
            parameters: tool.inputSchema,
          }),
        }),
      ),
    ),
  });
}

function parseTransportResult(
  result: OpenRouterTransportResult,
  pinnedModel: ModelDescriptor,
) {
  const executedModel = isRecord(result) ? result["executedModel"] : undefined;
  if (
    !isModelDescriptor(executedModel) ||
    !sameModel(executedModel, pinnedModel)
  ) {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.responseModelMismatch,
      "The OpenRouter transport did not attest the exact configured model descriptor.",
    );
  }
  return Object.freeze({
    response: result.response,
    executedModel: Object.freeze({ ...executedModel }),
  });
}

type OpenRouterChoice = Readonly<{
  finishReason: "stop" | "length" | "tool_calls";
  message: Record<string, unknown>;
}>;

function parseChoice(payload: unknown, pinnedModel: ModelDescriptor) {
  if (!isRecord(payload) || typeof payload["model"] !== "string") {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
      "OpenRouter returned an invalid response envelope.",
    );
  }
  if (payload["model"] !== pinnedModel.model) {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.responseModelMismatch,
      "OpenRouter reported a model different from the exact configured pin.",
    );
  }
  const rawChoices = payload["choices"];
  const first = Array.isArray(rawChoices) ? rawChoices[0] : undefined;
  if (!isRecord(first) || !isRecord(first["message"])) {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
      "OpenRouter returned no valid first choice.",
    );
  }
  const rawFinish = first["finish_reason"];
  const finishReason =
    rawFinish === "stop" ||
    rawFinish === "length" ||
    rawFinish === "tool_calls"
      ? rawFinish
      : undefined;
  if (finishReason === undefined) {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
      "OpenRouter returned an unsupported finish reason.",
    );
  }
  return { finishReason, message: first["message"] } satisfies OpenRouterChoice;
}

function parseComplete(
  payload: unknown,
  pinnedModel: ModelDescriptor,
): ModelCompleteResponse {
  const choice = parseChoice(payload, pinnedModel);
  if (choice.finishReason === "tool_calls") {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
      "OpenRouter returned a tool-call finish reason for a completion.",
    );
  }
  const content = choice.message["content"];
  if (typeof content !== "string") {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
      "OpenRouter returned a non-text completion.",
    );
  }
  return Object.freeze({
    schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
    operation: "complete" as const,
    text: content,
    finishReason: choice.finishReason,
  });
}

function parseToolCallArguments(value: unknown): JsonObject | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = parseUnambiguousJson(value);
  return parsed.ok && isJsonObject(parsed.value) ? parsed.value : undefined;
}

function compileToolValidators(tools: ModelToolCallRequest["tools"]) {
  const compiler = new Ajv({ allErrors: false, strict: true });
  const validators = new Map<string, ValidateFunction>();
  for (const tool of tools) {
    if (validators.has(tool.name)) {
      throw new OpenRouterAdapterError(
        OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
        "OpenRouter tool descriptors must have unique names.",
      );
    }
    try {
      const validator = compiler.compile(tool.inputSchema);
      if ("$async" in validator && validator.$async === true) {
        throw new Error("Async tool input schemas are not supported.");
      }
      validators.set(tool.name, validator);
    } catch {
      throw new OpenRouterAdapterError(
        OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
        "OpenRouter received an invalid tool input schema.",
      );
    }
  }
  return validators;
}

function parseToolCall(
  payload: unknown,
  pinnedModel: ModelDescriptor,
  toolValidators: ReadonlyMap<string, ValidateFunction>,
): ModelToolCallResponse {
  const choice = parseChoice(payload, pinnedModel);
  if (choice.finishReason !== "tool_calls") {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
      "OpenRouter returned an incomplete tool call.",
    );
  }
  const rawToolCalls = choice.message["tool_calls"];
  if (!Array.isArray(rawToolCalls) || rawToolCalls.length === 0) {
    throw new OpenRouterAdapterError(
      OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
      "OpenRouter returned no tool calls.",
    );
  }
  const toolCalls = rawToolCalls.map((raw) => {
    const fn = isRecord(raw) && isRecord(raw["function"])
      ? raw["function"]
      : undefined;
    const name = fn?.["name"];
    const args = parseToolCallArguments(fn?.["arguments"]);
    const validateArguments =
      typeof name === "string" ? toolValidators.get(name) : undefined;
    if (
      typeof name !== "string" ||
      name.length === 0 ||
      validateArguments === undefined ||
      args === undefined ||
      !validateArguments(args)
    ) {
      throw new OpenRouterAdapterError(
        OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
        "OpenRouter returned an invalid tool call.",
      );
    }
    return Object.freeze({ name, arguments: args });
  });
  return Object.freeze({
    schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
    operation: "tool-call" as const,
    toolCalls: Object.freeze(toolCalls),
  });
}

export type OpenRouterFixtureTransportOptions = Readonly<{
  model: ModelDescriptor;
  /** Recorded OpenRouter response envelopes, keyed by operation. */
  responses: Readonly<
    Partial<Record<OpenRouterTransportRequest["operation"], unknown>>
  >;
}>;

/**
 * A transport that replays recorded responses and can reach no network.
 *
 * The point is structural, not conventional: this is an ordinary
 * `OpenRouterTransport`, so a caller who wires it gets the whole adapter and port
 * path — pinning, attestation, response parsing, tool-argument validation — with
 * no credential, no `fetch`, and nothing that varies between runs. An operation
 * with no recorded response *refuses* rather than returning an empty envelope,
 * because a silent blank would read downstream as a model that answered nothing.
 */
export function createFixtureTransport(
  options: OpenRouterFixtureTransportOptions,
): OpenRouterTransport {
  const pinnedModel = Object.freeze({ ...options.model });
  const responses = Object.freeze({ ...options.responses });
  return (request) => {
    if (!Object.hasOwn(responses, request.operation)) {
      throw new OpenRouterAdapterError(
        OPENROUTER_ADAPTER_ERROR_CODES.fixtureNotRecorded,
        `No OpenRouter fixture is recorded for the '${request.operation}' operation; the fixture transport refuses rather than inventing a response.`,
      );
    }
    return Object.freeze({
      response: responses[request.operation],
      executedModel: pinnedModel,
    });
  };
}

/** Create an injected, non-Kids OpenRouter adapter with no ambient I/O. */
export function createOpenRouterAdapter(
  options: CreateOpenRouterAdapterOptions,
): ModelProviderAdapter {
  validateOptions(options);
  const pinnedModel = Object.freeze({ ...options.model });
  const evalConfig = Object.freeze({ ...options.eval });

  return Object.freeze({
    routeKind: "third-party" as const,
    capabilities,
    async complete(request) {
      assertPinnedRequest(request, pinnedModel);
      const transportResult = parseTransportResult(
        await options.transport(transportRequest(request, evalConfig)),
        pinnedModel,
      );
      return Object.freeze({
        response: parseComplete(transportResult.response, pinnedModel),
        executedModel: transportResult.executedModel,
      });
    },
    async toolCall(request) {
      assertPinnedRequest(request, pinnedModel);
      const toolValidators = compileToolValidators(request.tools);
      const transportResult = parseTransportResult(
        await options.transport(transportRequest(request, evalConfig)),
        pinnedModel,
      );
      return Object.freeze({
        response: parseToolCall(
          transportResult.response,
          pinnedModel,
          toolValidators,
        ),
        executedModel: transportResult.executedModel,
      });
    },
  });
}
