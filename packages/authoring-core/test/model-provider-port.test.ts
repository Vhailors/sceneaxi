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

  it("refuses malformed request bodies before policy or dispatch", async () => {
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
    const malformedComplete = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "__proto__",
      model,
      prompt: "invalid profile",
    };
    const malformedToolCall = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "invalid tool schema",
      tools: [{ name: "fixture", inputSchema: new Date() }],
    };
    const malformedStream = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "stream",
      profile: "@sceneaxi/profile-game",
      model: { ...model, provider: "" },
      prompt: "invalid model",
    };

    const results = await Promise.all([
      port.complete(
        malformedComplete as unknown as Parameters<typeof port.complete>[0],
      ),
      port.toolCall(
        malformedToolCall as unknown as Parameters<typeof port.toolCall>[0],
      ),
      port.stream(
        malformedStream as unknown as Parameters<typeof port.stream>[0],
      ),
    ]);

    for (const result of results) {
      expect(result).toMatchObject({
        ok: false,
        reason: "MODEL_PROVIDER_REQUEST_ENVELOPE_INVALID",
      });
    }
    expect(filterCalls).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("refuses accessor-backed request discriminators without throwing", async () => {
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

    for (const discriminator of ["schemaVersion", "operation"] as const) {
      const request = {
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        profile: "@sceneaxi/profile-game",
        model,
        prompt: "accessor discriminator",
      };
      Object.defineProperty(request, discriminator, {
        enumerable: true,
        get() {
          throw new Error(`unexpected ${discriminator} read`);
        },
      });

      await expect(
        port.complete(
          request as unknown as Parameters<typeof port.complete>[0],
        ),
      ).resolves.toMatchObject({
        ok: false,
        reason: "MODEL_PROVIDER_REQUEST_ENVELOPE_INVALID",
      });
    }

    expect(filterCalls).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("does not resolve profile policies through the prototype chain", async () => {
    const calls: string[] = [];
    const inheritedPolicies = Object.create({
      "@sceneaxi/profile-game": allow,
    }) as Record<string, ModelProviderPolicyFilter>;
    const port = createModelProviderPort({
      adapter: fakeAdapter(calls),
      profilePolicies: inheritedPolicies,
    });

    const result = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "inherited policy",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "MODEL_PROVIDER_PROFILE_POLICY_MISSING",
    });
    expect(calls).toEqual([]);
  });

  it("refuses invalid policy registries and filters without throwing", async () => {
    const calls: string[] = [];
    const accessorRegistry = Object.defineProperty(
      {},
      "@sceneaxi/profile-game",
      {
        enumerable: true,
        get() {
          throw new Error("unexpected policy getter");
        },
      },
    );
    const cases = [
      {
        profilePolicies: undefined,
        reason: "MODEL_PROVIDER_PROFILE_POLICY_MISSING",
      },
      {
        profilePolicies: null,
        reason: "MODEL_PROVIDER_PROFILE_POLICY_MISSING",
      },
      {
        profilePolicies: { "@sceneaxi/profile-game": "allow" },
        reason: "MODEL_PROVIDER_POLICY_DECISION_INVALID",
      },
      {
        profilePolicies: accessorRegistry,
        reason: "MODEL_PROVIDER_POLICY_DECISION_INVALID",
      },
    ];

    for (const testCase of cases) {
      const port = createModelProviderPort({
        adapter: fakeAdapter(calls),
        profilePolicies: testCase.profilePolicies,
      } as unknown as Parameters<typeof createModelProviderPort>[0]);

      await expect(
        port.complete({
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operation: "complete",
          profile: "@sceneaxi/profile-game",
          model,
          prompt: "invalid policy registry",
        }),
      ).resolves.toMatchObject({ ok: false, reason: testCase.reason });
    }

    expect(calls).toEqual([]);
  });

  it("refuses invalid adapter route kinds before policy or dispatch", async () => {
    const calls: string[] = [];
    const filterCalls: string[] = [];
    const adapter = {
      ...fakeAdapter(calls),
      routeKind: "first-party",
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
      prompt: "invalid route kind",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "MODEL_PROVIDER_ROUTE_KIND_INVALID",
    });
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

  it("refuses non-callable dispatch before policy evaluation", async () => {
    const calls: string[] = [];
    const filterCalls: string[] = [];
    const adapter = {
      ...fakeAdapter(calls),
      complete: "not-callable",
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

    await expect(
      port.complete({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        profile: "@sceneaxi/profile-game",
        model,
        prompt: "non-callable dispatch",
      }),
    ).resolves.toMatchObject({
      ok: false,
      reason: "MODEL_PROVIDER_CAPABILITY_UNSUPPORTED",
    });
    expect(filterCalls).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("uses one frozen request snapshot across policy, dispatch, and evidence", async () => {
    let releasePolicy = () => {};
    let policyStarted = () => {};
    const policyWaiting = new Promise<void>((resolve) => {
      releasePolicy = resolve;
    });
    const started = new Promise<void>((resolve) => {
      policyStarted = resolve;
    });
    const dispatched: Parameters<
      NonNullable<ModelProviderAdapter["complete"]>
    >[0][] = [];
    const adapter = {
      ...fakeAdapter(),
      async complete(request) {
        dispatched.push(request);
        return {
          response: {
            schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
            operation: "complete" as const,
            text: request.prompt,
            finishReason: "stop" as const,
          },
          executedModel: model,
        };
      },
    } satisfies ModelProviderAdapter;
    const port = createModelProviderPort({
      adapter,
      profilePolicies: {
        "@sceneaxi/profile-game": async () => {
          policyStarted();
          await policyWaiting;
          return { ok: true };
        },
      },
    });
    const mutableModel: {
      model: string;
      provider: string;
      quantization: string;
      version: string;
    } = { ...model };
    const request = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete" as const,
      profile: "@sceneaxi/profile-game" as const,
      model: mutableModel,
      prompt: "original prompt",
    };

    const resultPromise = port.complete(request);
    await started;
    request.profile = "@sceneaxi/profile-kids" as typeof request.profile;
    request.model.provider = "mutated-provider";
    request.prompt = "mutated prompt";
    releasePolicy();
    const result = await resultPromise;

    expect(result).toMatchObject({
      ok: true,
      response: { text: "original prompt" },
      evidence: {
        profile: "@sceneaxi/profile-game",
        model: { provider: "fake-provider" },
      },
    });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).not.toBe(request);
    expect(dispatched[0]).toMatchObject({
      profile: "@sceneaxi/profile-game",
      prompt: "original prompt",
      model: { provider: "fake-provider" },
    });
    expect(Object.isFrozen(dispatched[0])).toBe(true);
    expect(Object.isFrozen(dispatched[0]?.model)).toBe(true);
  });

  it("captures the authorized dispatch method before awaiting policy", async () => {
    let releasePolicy = () => {};
    let policyStarted = () => {};
    const policyWaiting = new Promise<void>((resolve) => {
      releasePolicy = resolve;
    });
    const started = new Promise<void>((resolve) => {
      policyStarted = resolve;
    });
    const calls: string[] = [];
    const adapter = {
      ...fakeAdapter(),
      async complete(request) {
        calls.push("authorized");
        return {
          response: {
            schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
            operation: "complete" as const,
            text: `authorized:${request.prompt}`,
            finishReason: "stop" as const,
          },
          executedModel: model,
        };
      },
    } satisfies ModelProviderAdapter;
    const port = createModelProviderPort({
      adapter,
      profilePolicies: {
        "@sceneaxi/profile-game": async () => {
          policyStarted();
          await policyWaiting;
          return { ok: true };
        },
      },
    });

    const resultPromise = port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "dispatch snapshot",
    });
    await started;
    adapter.complete = async (request) => {
      calls.push("replacement");
      return {
        response: {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operation: "complete",
          text: `replacement:${request.prompt}`,
          finishReason: "stop",
        },
        executedModel: model,
      };
    };
    releasePolicy();
    const result = await resultPromise;

    expect(result).toMatchObject({
      ok: true,
      response: { text: "authorized:dispatch snapshot" },
    });
    expect(calls).toEqual(["authorized"]);
  });

  it("returns deep response snapshots across evidence awaits", async () => {
    let releaseCompleteEvidence = () => {};
    let completeEvidenceStarted = () => {};
    const completeEvidenceWaiting = new Promise<void>((resolve) => {
      releaseCompleteEvidence = resolve;
    });
    const completeStarted = new Promise<void>((resolve) => {
      completeEvidenceStarted = resolve;
    });
    let releaseToolEvidence = () => {};
    let toolEvidenceStarted = () => {};
    const toolEvidenceWaiting = new Promise<void>((resolve) => {
      releaseToolEvidence = resolve;
    });
    const toolStarted = new Promise<void>((resolve) => {
      toolEvidenceStarted = resolve;
    });
    const completeResponse = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete" as const,
      text: "original complete",
      finishReason: "stop" as const,
    };
    const toolCallResponse = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "tool-call" as const,
      toolCalls: [
        {
          name: "original-tool",
          arguments: { nested: { value: "original" } },
        },
      ],
    };
    let evidenceCall = 0;
    const port = createModelProviderPort({
      adapter: {
        ...fakeAdapter(),
        async complete() {
          return { response: completeResponse, executedModel: model };
        },
        async toolCall() {
          return { response: toolCallResponse, executedModel: model };
        },
      },
      profilePolicies: { "@sceneaxi/profile-game": allow },
      async recordEvidence() {
        evidenceCall += 1;
        if (evidenceCall === 1) {
          completeEvidenceStarted();
          await completeEvidenceWaiting;
          return;
        }
        toolEvidenceStarted();
        await toolEvidenceWaiting;
      },
    });

    const completePromise = port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "response snapshot",
    });
    await completeStarted;
    completeResponse.text = "mutated complete";
    releaseCompleteEvidence();
    const complete = await completePromise;

    const toolCallPromise = port.toolCall({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "tool response snapshot",
      tools: [],
    });
    await toolStarted;
    const mutableToolCall = toolCallResponse.toolCalls[0];
    if (mutableToolCall === undefined) {
      throw new Error("Expected one mutable tool call fixture.");
    }
    mutableToolCall.name = "mutated-tool";
    mutableToolCall.arguments.nested.value = "mutated";
    releaseToolEvidence();
    const toolCall = await toolCallPromise;

    expect(complete).toMatchObject({
      ok: true,
      response: { text: "original complete" },
    });
    expect(toolCall).toMatchObject({
      ok: true,
      response: {
        toolCalls: [
          {
            name: "original-tool",
            arguments: { nested: { value: "original" } },
          },
        ],
      },
    });
    if (!complete.ok || !toolCall.ok) return;
    expect(Object.isFrozen(complete.response)).toBe(true);
    expect(Object.isFrozen(toolCall.response)).toBe(true);
    expect(Object.isFrozen(toolCall.response.toolCalls)).toBe(true);
    expect(Object.isFrozen(toolCall.response.toolCalls[0])).toBe(true);
    expect(
      Object.isFrozen(toolCall.response.toolCalls[0]?.arguments.nested),
    ).toBe(true);
  });

  it("captures adapter success response and model attestation exactly once", async () => {
    const completeResponse = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete" as const,
      text: "captured response",
      finishReason: "stop" as const,
    };
    let completeResponseReads = 0;
    let completeModelReads = 0;
    const completeAdapter = {
      ...fakeAdapter(),
      async complete() {
        return Object.defineProperties(
          {},
          {
            response: {
              enumerable: true,
              get() {
                completeResponseReads += 1;
                return completeResponseReads === 1
                  ? completeResponse
                  : { invalid: true };
              },
            },
            executedModel: {
              enumerable: true,
              get() {
                completeModelReads += 1;
                return completeModelReads === 1 ? model : { invalid: true };
              },
            },
          },
        );
      },
    } as unknown as ModelProviderAdapter;
    const complete = await createModelProviderPort({
      adapter: completeAdapter,
      profilePolicies: { "@sceneaxi/profile-game": allow },
    }).complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "capture adapter result",
    });

    expect(complete).toMatchObject({
      ok: true,
      response: completeResponse,
      evidence: { model },
    });
    expect(completeResponseReads).toBe(1);
    expect(completeModelReads).toBe(1);

    async function* chunks() {
      yield {
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "stream" as const,
        delta: "captured",
        done: true,
      };
    }
    let streamResponseReads = 0;
    let streamModelReads = 0;
    const streamAdapter = {
      ...fakeAdapter(),
      async stream() {
        return Object.defineProperties(
          {},
          {
            response: {
              enumerable: true,
              get() {
                streamResponseReads += 1;
                return streamResponseReads === 1 ? chunks() : undefined;
              },
            },
            executedModel: {
              enumerable: true,
              get() {
                streamModelReads += 1;
                return streamModelReads === 1 ? model : { invalid: true };
              },
            },
          },
        );
      },
    } as unknown as ModelProviderAdapter;
    const streamed = await createModelProviderPort({
      adapter: streamAdapter,
      profilePolicies: { "@sceneaxi/profile-game": allow },
    }).stream({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "stream",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "capture stream adapter result",
    });

    expect(streamed).toMatchObject({ ok: true, evidence: { model } });
    expect(streamResponseReads).toBe(1);
    expect(streamModelReads).toBe(1);
  });

  it("refuses malformed policy decisions before adapter dispatch", async () => {
    const malformedDecisions = [undefined, {}, { ok: "allow" }];

    for (const decision of malformedDecisions) {
      const calls: string[] = [];
      const port = createModelProviderPort({
        adapter: fakeAdapter(calls),
        profilePolicies: {
          "@sceneaxi/profile-game": (() =>
            decision) as unknown as ModelProviderPolicyFilter,
        },
      });

      const result = await port.complete({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        profile: "@sceneaxi/profile-game",
        model,
        prompt: "invalid policy decision",
      });

      expect(result).toMatchObject({
        ok: false,
        reason: "MODEL_PROVIDER_POLICY_DECISION_INVALID",
      });
      expect(calls).toEqual([]);
    }
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

  it("uses canonical JSON validation for tool-call arguments", async () => {
    const recorded: ModelProviderCallEvidence[] = [];
    const sparse = ["present"];
    sparse.length = 2;
    const invalidArguments = [new Date(), new Map(), { nested: sparse }];

    for (const argumentsValue of invalidArguments) {
      const adapter = {
        ...fakeAdapter(),
        async toolCall() {
          return {
            response: {
              schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
              operation: "tool-call",
              toolCalls: [{ name: "fixture", arguments: argumentsValue }],
            },
            executedModel: model,
          };
        },
      } as unknown as ModelProviderAdapter;
      const result = await createModelProviderPort({
        adapter,
        profilePolicies: { "@sceneaxi/profile-game": allow },
        recordEvidence(evidence) {
          recorded.push(evidence);
        },
      }).toolCall({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "tool-call",
        profile: "@sceneaxi/profile-game",
        model,
        prompt: "invalid arguments",
        tools: [],
      });

      expect(result).toMatchObject({
        ok: false,
        reason: "MODEL_PROVIDER_RESPONSE_ENVELOPE_INVALID",
      });
    }
    expect(recorded).toEqual([]);
  });

  it("refuses non-iterable stream envelopes before evidence or success", async () => {
    const recorded: ModelProviderCallEvidence[] = [];
    const adapter = {
      ...fakeAdapter(),
      async stream() {
        return { response: undefined, executedModel: model };
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
    expect(recorded).toEqual([]);
  });

  it("captures the stream iterator method once before exposing success", async () => {
    let iteratorReads = 0;
    const response = Object.defineProperty({}, Symbol.asyncIterator, {
      get() {
        iteratorReads += 1;
        if (iteratorReads > 1) return undefined;
        return async function* () {
          yield {
            schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
            operation: "stream" as const,
            delta: "captured iterator",
            done: true,
          };
        };
      },
    });
    const adapter = {
      ...fakeAdapter(),
      async stream() {
        return { response, executedModel: model };
      },
    } as unknown as ModelProviderAdapter;

    const result = await createModelProviderPort({
      adapter,
      profilePolicies: { "@sceneaxi/profile-game": allow },
    }).stream({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "stream",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "capture iterator",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const chunks = [];
    for await (const chunk of result.response) chunks.push(chunk);
    expect(chunks).toEqual([
      {
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "stream",
        delta: "captured iterator",
        done: true,
      },
    ]);
    expect(iteratorReads).toBe(1);
  });

  it("refuses throwing stream iterator accessors with the named reason", async () => {
    const response = Object.defineProperty({}, Symbol.asyncIterator, {
      get() {
        throw new TypeError("invalid iterator accessor");
      },
    });
    const adapter = {
      ...fakeAdapter(),
      async stream() {
        return { response, executedModel: model };
      },
    } as unknown as ModelProviderAdapter;

    const result = await createModelProviderPort({
      adapter,
      profilePolicies: { "@sceneaxi/profile-game": allow },
    }).stream({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "stream",
      profile: "@sceneaxi/profile-game",
      model,
      prompt: "throwing iterator accessor",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "MODEL_PROVIDER_RESPONSE_ENVELOPE_INVALID",
    });
  });

  it("normalizes invalid lazy stream iterator construction and results", async () => {
    const invalidResponses = [
      {
        [Symbol.asyncIterator]() {
          throw new TypeError("iterator construction failed");
        },
      },
      {
        [Symbol.asyncIterator]() {
          return {};
        },
      },
      {
        [Symbol.asyncIterator]() {
          return Object.defineProperty({}, "next", {
            get() {
              throw new TypeError("next accessor failed");
            },
          });
        },
      },
      {
        [Symbol.asyncIterator]() {
          return {
            next() {
              throw new TypeError("next call failed");
            },
          };
        },
      },
      {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return 1;
            },
          };
        },
      },
    ];

    for (const response of invalidResponses) {
      const adapter = {
        ...fakeAdapter(),
        async stream() {
          return { response, executedModel: model };
        },
      } as unknown as ModelProviderAdapter;
      const result = await createModelProviderPort({
        adapter,
        profilePolicies: { "@sceneaxi/profile-game": allow },
      }).stream({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "stream",
        profile: "@sceneaxi/profile-game",
        model,
        prompt: "invalid lazy iterator",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      await expect(
        result.response[Symbol.asyncIterator]().next(),
      ).rejects.toMatchObject({
        reason: "MODEL_PROVIDER_RESPONSE_ENVELOPE_INVALID",
      });
    }
  });

  it("validates stream chunks lazily and withholds evidence on failure", async () => {
    const recorded: ModelProviderCallEvidence[] = [];
    const adapter = {
      ...fakeAdapter(),
      async stream() {
        async function* chunks() {
          yield {
            schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
            operation: "complete",
            delta: "invalid",
            done: true,
          };
        }
        return { response: chunks(), executedModel: model };
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
      prompt: "invalid stream chunk",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await expect(
      (async () => {
        for await (const chunk of result.response) void chunk;
      })(),
    ).rejects.toMatchObject({
      reason: "MODEL_PROVIDER_RESPONSE_ENVELOPE_INVALID",
    });
    expect(recorded).toEqual([]);
  });

  it("keeps stream delivery lazy and records terminal evidence exactly once", async () => {
    const events: string[] = [];
    const recorded: ModelProviderCallEvidence[] = [];
    const adapter = {
      ...fakeAdapter(),
      async stream() {
        async function* chunks() {
          events.push("started");
          yield {
            schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
            operation: "stream" as const,
            delta: "first",
            done: false,
          };
          events.push("resumed");
          yield {
            schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
            operation: "stream" as const,
            delta: "second",
            done: true,
          };
          yield {
            schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
            operation: "stream" as const,
            delta: "after-terminal",
            done: false,
          };
        }
        return { response: chunks(), executedModel: model };
      },
    } satisfies ModelProviderAdapter;
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
      prompt: "lazy stream",
    });

    expect(result.ok).toBe(true);
    expect(events).toEqual([]);
    expect(recorded).toEqual([]);
    if (!result.ok) return;
    const iterator = result.response[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toMatchObject({
      value: { delta: "first" },
      done: false,
    });
    expect(events).toEqual(["started"]);
    expect(recorded).toEqual([]);
    await expect(iterator.next()).resolves.toMatchObject({
      value: { delta: "second" },
      done: false,
    });
    expect(events).toEqual(["started", "resumed"]);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toEqual(result.evidence);
    await expect(iterator.next()).rejects.toMatchObject({
      reason: "MODEL_PROVIDER_RESPONSE_ENVELOPE_INVALID",
    });
    expect(recorded).toHaveLength(1);
  });

  it("forwards early stream cancellation without recording success evidence", async () => {
    const recorded: ModelProviderCallEvidence[] = [];
    let cleanupCount = 0;
    const adapter = {
      ...fakeAdapter(),
      async stream() {
        async function* chunks() {
          try {
            yield {
              schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
              operation: "stream" as const,
              delta: "first",
              done: false,
            };
            yield {
              schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
              operation: "stream" as const,
              delta: "second",
              done: true,
            };
          } finally {
            cleanupCount += 1;
          }
        }
        return { response: chunks(), executedModel: model };
      },
    } satisfies ModelProviderAdapter;
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
      prompt: "cancel stream",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for await (const chunk of result.response) {
      expect(chunk.delta).toBe("first");
      break;
    }
    expect(cleanupCount).toBe(1);
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
