import { describe, expect, it } from "vitest";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  createModelProviderPort,
  type ModelDescriptor,
  type ModelProviderAdapter,
  type ModelProviderCallEvidence,
  type ModelProviderPolicyFilter,
} from "@sceneaxi/authoring-core";

const model = Object.freeze({
  model: "fake/authoring-model",
  provider: "fake-provider",
  quantization: "none",
  version: "test-v1",
}) satisfies ModelDescriptor;

const allow: ModelProviderPolicyFilter = () => ({ ok: true });

function fakeAdapter(calls: string[] = []) {
  return {
    routeKind: "third-party",
    capabilities: {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operations: ["complete", "tool-call", "stream"],
    },
    async complete(request) {
      calls.push(`complete:${request.prompt}`);
      return {
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        text: `fake:${request.prompt}`,
        finishReason: "stop",
      };
    },
    async toolCall(request) {
      calls.push(`tool-call:${request.prompt}`);
      return {
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "tool-call",
        toolCalls: [
          {
            name: request.tools[0]?.name ?? "unknown",
            arguments: { fixture: true },
          },
        ],
      };
    },
    async stream(request) {
      calls.push(`stream:${request.prompt}`);
      async function* chunks() {
        yield {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operation: "stream" as const,
          delta: "fake:",
          done: false,
        };
        yield {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operation: "stream" as const,
          delta: request.prompt,
          done: true,
        };
      }
      return chunks();
    },
  } satisfies ModelProviderAdapter;
}

describe("Model Provider Port", () => {
  it("applies per-profile filters before allowing complete and tool-call dispatch", async () => {
    const calls: string[] = [];
    const filterCalls: string[] = [];
    const filter: ModelProviderPolicyFilter = (context) => {
      filterCalls.push(`${context.profile}:${context.operation}`);
      return { ok: true };
    };
    const port = createModelProviderPort({
      adapter: fakeAdapter(calls),
      profilePolicies: {
        "@sceneaxi/profile-game": filter,
        "@sceneaxi/profile-web": filter,
      },
    });

    const completed = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "draft a scene",
    });
    const toolCalled = await port.toolCall({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "tool-call",
      profile: "@sceneaxi/profile-web",
      model,
      prompt: "place an entity",
      tools: [{ name: "place-entity", inputSchema: {} }],
    });

    expect(completed).toMatchObject({
      ok: true,
      response: { text: "fake:draft a scene" },
    });
    expect(toolCalled).toMatchObject({
      ok: true,
      response: {
        toolCalls: [{ name: "place-entity", arguments: { fixture: true } }],
      },
    });
    expect(filterCalls).toEqual([
      "@sceneaxi/profile-game:complete",
      "@sceneaxi/profile-web:tool-call",
    ]);
    expect(calls).toEqual([
      "complete:draft a scene",
      "tool-call:place an entity",
    ]);
  });

  it("refuses a denied or missing non-Kids profile policy before adapter dispatch", async () => {
    const calls: string[] = [];
    const deny: ModelProviderPolicyFilter = () => ({
      ok: false,
      reason: "PROFILE_ROUTE_REFUSED",
      message: "This profile does not permit the requested model route.",
    });
    const port = createModelProviderPort({
      adapter: fakeAdapter(calls),
      profilePolicies: { "@sceneaxi/profile-web": deny },
    });
    const request = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      model,
      prompt: "must not dispatch",
    } as const;

    const denied = await port.complete({
      ...request,
      profile: "@sceneaxi/profile-web",
    });
    const missing = await port.complete({
      ...request,
      profile: "@sceneaxi/profile-game",
    });

    expect(denied).toEqual({
      ok: false,
      reason: "PROFILE_ROUTE_REFUSED",
      message: "This profile does not permit the requested model route.",
    });
    expect(missing).toMatchObject({
      ok: false,
      reason: "MODEL_PROVIDER_PROFILE_POLICY_MISSING",
    });
    expect(calls).toEqual([]);
  });

  it("denies Kids third-party routes even if an injected filter would allow them", async () => {
    const calls: string[] = [];
    const port = createModelProviderPort({
      adapter: fakeAdapter(calls),
      profilePolicies: { "@sceneaxi/profile-kids": allow },
    });

    const result = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-kids",
      model,
      prompt: "must remain isolated",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "THIRD_PARTY_LLM_DENIED_BY_DEFAULT",
    });
    expect(calls).toEqual([]);
  });

  it("keeps every other Kids route closed until a Kids route is explicitly enabled", async () => {
    const calls: string[] = [];
    const adapter = { ...fakeAdapter(calls), routeKind: "self-hosted" } satisfies ModelProviderAdapter;
    const port = createModelProviderPort({
      adapter,
      profilePolicies: { "@sceneaxi/profile-kids": allow },
    });

    const result = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-kids",
      model,
      prompt: "no Kids route has been enabled",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "KIDS_LLM_ROUTE_NOT_ALLOWED",
    });
    expect(calls).toEqual([]);
  });

  it("refuses a missing adapter with a stable named reason", async () => {
    const port = createModelProviderPort({
      profilePolicies: { "@sceneaxi/profile-game": allow },
    });

    const result = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "no adapter",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "MODEL_PROVIDER_ADAPTER_MISSING",
    });
  });

  it("refuses undeclared adapter capabilities before calling the method", async () => {
    const calls: string[] = [];
    const adapter = {
      ...fakeAdapter(calls),
      capabilities: {
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operations: ["complete"],
      },
    } satisfies ModelProviderAdapter;
    const port = createModelProviderPort({
      adapter,
      profilePolicies: { "@sceneaxi/profile-game": allow },
    });

    const result = await port.toolCall({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "must not call an undeclared capability",
      tools: [{ name: "fixture", inputSchema: {} }],
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "MODEL_PROVIDER_CAPABILITY_UNSUPPORTED",
    });
    expect(calls).toEqual([]);
  });

  it("stamps the exact model descriptor on stable evidence after success", async () => {
    const recorded: ModelProviderCallEvidence[] = [];
    const port = createModelProviderPort({
      adapter: fakeAdapter(),
      profilePolicies: { "@sceneaxi/profile-game": allow },
      recordEvidence(evidence) {
        recorded.push(evidence);
      },
    });

    const result = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "record this",
    });

    expect(result).toMatchObject({
      ok: true,
      evidence: {
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        kind: "sceneaxi.model-provider-call-evidence",
        operation: "complete",
        profile: "@sceneaxi/profile-game",
        model,
      },
    });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.model).toEqual(model);
    expect(recorded[0]?.model).not.toBe(model);
  });

  it("exposes a typed async stream without network or spend", async () => {
    const port = createModelProviderPort({
      adapter: fakeAdapter(),
      profilePolicies: { "@sceneaxi/profile-game": allow },
    });

    const result = await port.stream({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "stream",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "stream fixture",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const chunks = [];
    for await (const chunk of result.response) chunks.push(chunk);
    expect(chunks).toEqual([
      {
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "stream",
        delta: "fake:",
        done: false,
      },
      {
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "stream",
        delta: "stream fixture",
        done: true,
      },
    ]);
  });
});
