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
        response: {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operation: "complete",
          text: `fake:${request.prompt}`,
          finishReason: "stop",
        },
        executedModel: model,
      };
    },
    async toolCall(request) {
      calls.push(`tool-call:${request.prompt}`);
      return {
        response: {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operation: "tool-call",
          toolCalls: [
            {
              name: request.tools[0]?.name ?? "unknown",
              arguments: { fixture: true },
            },
          ],
        },
        executedModel: model,
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
      return { response: chunks(), executedModel: model };
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

  it("stamps the adapter-attested executed model on evidence after success", async () => {
    const recorded: ModelProviderCallEvidence[] = [];
    const executedModel = Object.freeze({
      model: "fake/executed-model",
      provider: "fake-executing-provider",
      quantization: "q8",
      version: "runtime-v2",
    }) satisfies ModelDescriptor;
    const adapter = {
      ...fakeAdapter(),
      async complete(request) {
        return {
          response: {
            schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
            operation: "complete",
            text: `fake:${request.prompt}`,
            finishReason: "stop",
          },
          executedModel,
        };
      },
    } satisfies ModelProviderAdapter;
    const port = createModelProviderPort({
      adapter,
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
        model: executedModel,
      },
    });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.model).toEqual(executedModel);
    expect(recorded[0]?.model).not.toBe(executedModel);
  });

  it("refuses adapter successes without an executed model attestation", async () => {
    const calls: string[] = [];
    const recorded: ModelProviderCallEvidence[] = [];
    const adapter = {
      ...fakeAdapter(calls),
      async complete(
        request: Parameters<
          NonNullable<ModelProviderAdapter["complete"]>
        >[0],
      ) {
        calls.push(`complete:${request.prompt}`);
        return {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operation: "complete",
          text: `fake:${request.prompt}`,
          finishReason: "stop",
        };
      },
    } as unknown as ModelProviderAdapter;
    const port = createModelProviderPort({
      adapter,
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
      prompt: "unattested execution",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "MODEL_PROVIDER_EXECUTED_MODEL_MISSING",
    });
    expect(calls).toEqual(["complete:unattested execution"]);
    expect(recorded).toEqual([]);
  });

  it("refuses unsupported request versions before policy or dispatch for every operation", async () => {
    const calls: string[] = [];
    const filterCalls: string[] = [];
    const port = createModelProviderPort({
      adapter: fakeAdapter(calls),
      profilePolicies: {
        "@sceneaxi/profile-game": (context) => {
          filterCalls.push(context.operation);
          return { ok: true };
        },
      },
    });
    const invalidVersion =
      2 as unknown as typeof MODEL_PROVIDER_PORT_SCHEMA_VERSION;

    const complete = await port.complete({
      schemaVersion: invalidVersion,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "unsupported complete",
    });
    const toolCall = await port.toolCall({
      schemaVersion: invalidVersion,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "unsupported tool call",
      tools: [],
    });
    const stream = await port.stream({
      schemaVersion: invalidVersion,
      operation: "stream",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "unsupported stream",
    });

    for (const result of [complete, toolCall, stream]) {
      expect(result).toMatchObject({
        ok: false,
        reason: "MODEL_PROVIDER_SCHEMA_VERSION_UNSUPPORTED",
      });
    }
    expect(filterCalls).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("binds each operation discriminator to its entrypoint before policy or dispatch", async () => {
    const calls: string[] = [];
    const filterCalls: string[] = [];
    const port = createModelProviderPort({
      adapter: fakeAdapter(calls),
      profilePolicies: {
        "@sceneaxi/profile-game": (context) => {
          filterCalls.push(context.operation);
          return { ok: true };
        },
      },
    });
    const completeRequest = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "wrong complete discriminator",
      tools: [],
    } as const;
    const toolCallRequest = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "stream",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "wrong tool-call discriminator",
    } as const;
    const streamRequest = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "wrong stream discriminator",
    } as const;

    const results = [
      await port.complete(
        completeRequest as unknown as Parameters<typeof port.complete>[0],
      ),
      await port.toolCall(
        toolCallRequest as unknown as Parameters<typeof port.toolCall>[0],
      ),
      await port.stream(
        streamRequest as unknown as Parameters<typeof port.stream>[0],
      ),
    ];

    for (const result of results) {
      expect(result).toMatchObject({
        ok: false,
        reason: "MODEL_PROVIDER_OPERATION_MISMATCH",
      });
    }
    expect(filterCalls).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("refuses invalid capability descriptors before policy or dispatch", async () => {
    const calls: string[] = [];
    const filterCalls: string[] = [];
    const invalidCapabilities = [
      { schemaVersion: 2, operations: ["complete"] },
      { schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION, operations: null },
      {
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operations: ["complete", "unknown"],
      },
    ];

    for (const capabilities of invalidCapabilities) {
      const adapter = {
        ...fakeAdapter(calls),
        capabilities,
      } as unknown as ModelProviderAdapter;
      const port = createModelProviderPort({
        adapter,
        profilePolicies: {
          "@sceneaxi/profile-game": (context) => {
            filterCalls.push(context.operation);
            return { ok: true };
          },
        },
      });

      const result = await port.complete({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        profile: "@sceneaxi/profile-game",
        model,
        prompt: "invalid capability descriptor",
      });

      expect(result).toMatchObject({
        ok: false,
        reason: "MODEL_PROVIDER_CAPABILITY_DESCRIPTOR_INVALID",
      });
    }
    expect(filterCalls).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("refuses malformed complete and tool-call response envelopes without evidence", async () => {
    const recorded: ModelProviderCallEvidence[] = [];
    const invalidCompleteAdapter = {
      ...fakeAdapter(),
      async complete() {
        return {
          response: {
            schemaVersion: 2,
            operation: "complete",
            text: "invalid",
            finishReason: "stop",
          },
          executedModel: model,
        };
      },
    } as unknown as ModelProviderAdapter;
    const invalidToolCallAdapter = {
      ...fakeAdapter(),
      async toolCall() {
        return {
          response: {
            schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
            operation: "complete",
            toolCalls: [],
          },
          executedModel: model,
        };
      },
    } as unknown as ModelProviderAdapter;
    const options = {
      profilePolicies: { "@sceneaxi/profile-game": allow },
      recordEvidence(evidence: ModelProviderCallEvidence) {
        recorded.push(evidence);
      },
    };

    const complete = await createModelProviderPort({
      ...options,
      adapter: invalidCompleteAdapter,
    }).complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "invalid response version",
    });
    const toolCall = await createModelProviderPort({
      ...options,
      adapter: invalidToolCallAdapter,
    }).toolCall({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "invalid response operation",
      tools: [],
    });

    for (const result of [complete, toolCall]) {
      expect(result).toMatchObject({
        ok: false,
        reason: "MODEL_PROVIDER_RESPONSE_ENVELOPE_INVALID",
      });
    }
    expect(recorded).toEqual([]);
  });

  it("refuses non-iterable streams and malformed chunks before evidence or success", async () => {
    const recorded: ModelProviderCallEvidence[] = [];
    const invalidStreamResponses: unknown[] = [
      undefined,
      (async function* () {
        yield {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operation: "complete",
          delta: "invalid",
          done: true,
        };
      })(),
    ];

    for (const response of invalidStreamResponses) {
      const adapter = {
        ...fakeAdapter(),
        async stream() {
          return { response, executedModel: model };
        },
      } as unknown as ModelProviderAdapter;
      const port = createModelProviderPort({
        adapter,
        profilePolicies: { "@sceneaxi/profile-game": allow },
        recordEvidence(evidence) {
          recorded.push(evidence);
        },
      });

      const result = await port.stream({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "stream",
        profile: "@sceneaxi/profile-game",
        model,
        prompt: "invalid stream response",
      });

      expect(result).toMatchObject({
        ok: false,
        reason: "MODEL_PROVIDER_RESPONSE_ENVELOPE_INVALID",
      });
    }
    expect(recorded).toEqual([]);
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
