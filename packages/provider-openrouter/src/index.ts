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
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  isJsonObject,
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

export type OpenRouterTransport = (
  request: OpenRouterTransportRequest,
) => unknown | Promise<unknown>;

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
  try {
    const parsed: unknown = JSON.parse(value);
    return isJsonObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function parseToolCall(
  payload: unknown,
  pinnedModel: ModelDescriptor,
  offeredToolNames: ReadonlySet<string>,
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
    if (
      typeof name !== "string" ||
      name.length === 0 ||
      !offeredToolNames.has(name) ||
      args === undefined
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
      const payload = await options.transport(
        transportRequest(request, evalConfig),
      );
      return Object.freeze({
        response: parseComplete(payload, pinnedModel),
        executedModel: pinnedModel,
      });
    },
    async toolCall(request) {
      assertPinnedRequest(request, pinnedModel);
      const offeredToolNames = new Set(request.tools.map((tool) => tool.name));
      const payload = await options.transport(
        transportRequest(request, evalConfig),
      );
      return Object.freeze({
        response: parseToolCall(payload, pinnedModel, offeredToolNames),
        executedModel: pinnedModel,
      });
    },
  });
}
