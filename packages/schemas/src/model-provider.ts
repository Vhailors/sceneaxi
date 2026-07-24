/**
 * Model Provider Port payload contracts (v1).
 *
 * These types describe provider-neutral calls and their evidence stamp. They
 * contain no adapter credentials, endpoint configuration, or live-provider
 * behavior.
 */

import type { JsonObject } from "./document.js";

export const MODEL_PROVIDER_PORT_SCHEMA_VERSION = 1 as const;

export const MODEL_PROVIDER_CALL_EVIDENCE_KIND =
  "sceneaxi.model-provider-call-evidence" as const;

export const MODEL_PROVIDER_OPERATIONS = Object.freeze([
  "complete",
  "tool-call",
  "stream",
] as const);

export const MODEL_PROVIDER_ROUTE_KINDS = Object.freeze([
  "third-party",
  "self-hosted",
] as const);

export type ModelProviderOperation =
  (typeof MODEL_PROVIDER_OPERATIONS)[number];

export type ModelProviderRouteKind =
  (typeof MODEL_PROVIDER_ROUTE_KINDS)[number];

export type ModelProviderProfile = `@sceneaxi/profile-${string}`;

/** Exact route/model identity required on every request and evidence record. */
export type ModelDescriptor = {
  readonly model: string;
  readonly provider: string;
  readonly quantization: string;
  readonly version: string;
};

/** Operations an injected adapter declares before the port dispatches to it. */
export type ModelCapabilityDescriptor = {
  readonly schemaVersion: typeof MODEL_PROVIDER_PORT_SCHEMA_VERSION;
  readonly operations: ReadonlyArray<ModelProviderOperation>;
};

export type ModelProviderRequestBase = {
  readonly schemaVersion: typeof MODEL_PROVIDER_PORT_SCHEMA_VERSION;
  readonly profile: ModelProviderProfile;
  readonly model: ModelDescriptor;
};

export type ModelCompleteRequest = ModelProviderRequestBase & {
  readonly operation: "complete";
  readonly prompt: string;
};

export type ModelCompleteResponse = {
  readonly schemaVersion: typeof MODEL_PROVIDER_PORT_SCHEMA_VERSION;
  readonly operation: "complete";
  readonly text: string;
  readonly finishReason: "stop" | "length";
};

export type ModelToolDescriptor = {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: JsonObject;
};

export type ModelToolCall = {
  readonly name: string;
  readonly arguments: JsonObject;
};

export type ModelToolCallRequest = ModelProviderRequestBase & {
  readonly operation: "tool-call";
  readonly prompt: string;
  readonly tools: ReadonlyArray<ModelToolDescriptor>;
};

export type ModelToolCallResponse = {
  readonly schemaVersion: typeof MODEL_PROVIDER_PORT_SCHEMA_VERSION;
  readonly operation: "tool-call";
  readonly toolCalls: ReadonlyArray<ModelToolCall>;
};

export type ModelStreamRequest = ModelProviderRequestBase & {
  readonly operation: "stream";
  readonly prompt: string;
};

export type ModelStreamChunk = {
  readonly schemaVersion: typeof MODEL_PROVIDER_PORT_SCHEMA_VERSION;
  readonly operation: "stream";
  readonly delta: string;
  readonly done: boolean;
};

export type ModelProviderRequest =
  | ModelCompleteRequest
  | ModelToolCallRequest
  | ModelStreamRequest;

/** Stable evidence-shaped record emitted only after an adapter call succeeds. */
export type ModelProviderCallEvidence = {
  readonly schemaVersion: typeof MODEL_PROVIDER_PORT_SCHEMA_VERSION;
  readonly kind: typeof MODEL_PROVIDER_CALL_EVIDENCE_KIND;
  readonly operation: ModelProviderOperation;
  readonly profile: ModelProviderProfile;
  readonly model: ModelDescriptor;
};
