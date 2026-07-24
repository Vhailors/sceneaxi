import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  createModelProviderPort,
  type ModelDescriptor,
} from "@sceneaxi/authoring-core";
import {
  OPENROUTER_ADAPTER_ERROR_CODES,
  OpenRouterAdapterError,
  createOpenRouterAdapter,
  seam,
  type OpenRouterTransportRequest,
} from "@sceneaxi/provider-openrouter";

const MODEL: ModelDescriptor = Object.freeze({
  model: "openai/gpt-fixture-2026-07-24",
  provider: "openrouter",
  quantization: "provider-default-pinned",
  version: "2026-07-24",
});

const EVAL = Object.freeze({
  mode: "deterministic" as const,
  allowFallbacks: false as const,
  temperature: 0 as const,
  seed: 46,
});

function fixture(name: "complete" | "tool-call") {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"),
  ) as unknown;
}

function attestedFixture(
  name: "complete" | "tool-call",
  executedModel: ModelDescriptor = MODEL,
) {
  return {
    response: fixture(name),
    executedModel,
  };
}

describe("@sceneaxi/provider-openrouter", () => {
  it("exports a frozen importer-group seam", () => {
    expect(seam).toEqual({
      name: "@sceneaxi/provider-openrouter",
      releaseGroup: "importers",
    });
    expect(Object.isFrozen(seam)).toBe(true);
  });

  it("runs complete through the Model Provider Port with a pinned no-fallback request", async () => {
    const requests: OpenRouterTransportRequest[] = [];
    const adapter = createOpenRouterAdapter({
      model: MODEL,
      eval: EVAL,
      transport(request) {
        requests.push(request);
        return attestedFixture("complete");
      },
    });
    const port = createModelProviderPort({
      adapter,
      profilePolicies: {
        "@sceneaxi/profile-web": () => ({ ok: true }),
      },
    });

    const result = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-web",
      model: MODEL,
      prompt: "fixture prompt",
    });

    expect(result).toMatchObject({
      ok: true,
      response: { text: "fixture completion", finishReason: "stop" },
      evidence: { model: MODEL },
    });
    expect(requests).toEqual([
      {
        schemaVersion: 1,
        operation: "complete",
        modelDescriptor: MODEL,
        model: MODEL.model,
        messages: [{ role: "user", content: "fixture prompt" }],
        provider: { allow_fallbacks: false },
        temperature: 0,
        seed: 46,
      },
    ]);
  });

  it("maps recorded tool-call fixtures without live credentials or spend", async () => {
    const adapter = createOpenRouterAdapter({
      model: MODEL,
      eval: EVAL,
      transport: () => attestedFixture("tool-call"),
    });
    const port = createModelProviderPort({
      adapter,
      profilePolicies: {
        "@sceneaxi/profile-game": () => ({ ok: true }),
      },
    });

    const result = await port.toolCall({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model: MODEL,
      prompt: "move the hero",
      tools: [
        {
          name: "move-entity",
          inputSchema: {
            type: "object",
            properties: { entity: { type: "string" }, x: { type: "number" } },
          },
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      response: {
        toolCalls: [{ name: "move-entity", arguments: { entity: "hero", x: 2 } }],
      },
    });
  });

  it("refuses tool calls that were not offered in the request", async () => {
    const adapter = createOpenRouterAdapter({
      model: MODEL,
      eval: EVAL,
      transport: () => ({
        response: {
          ...fixture("tool-call") as Record<string, unknown>,
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "delete-project",
                      arguments: "{}",
                    },
                  },
                ],
              },
            },
          ],
        },
        executedModel: MODEL,
      }),
    });

    await expect(
      adapter.toolCall?.({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "tool-call",
        profile: "@sceneaxi/profile-game",
        model: MODEL,
        prompt: "move the hero",
        tools: [
          {
            name: "move-entity",
            inputSchema: { type: "object" },
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
    });
  });

  it("refuses truncated tool calls even when their arguments are valid JSON", async () => {
    const adapter = createOpenRouterAdapter({
      model: MODEL,
      eval: EVAL,
      transport: () => ({
        response: {
          ...fixture("tool-call") as Record<string, unknown>,
          choices: [
            {
              finish_reason: "length",
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "move-entity",
                      arguments: "{\"entity\":\"hero\",\"x\":2}",
                    },
                  },
                ],
              },
            },
          ],
        },
        executedModel: MODEL,
      }),
    });

    await expect(
      adapter.toolCall?.({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "tool-call",
        profile: "@sceneaxi/profile-game",
        model: MODEL,
        prompt: "move the hero",
        tools: [
          {
            name: "move-entity",
            inputSchema: { type: "object" },
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
    });
  });

  it("refuses tool-call finish reasons for completions", async () => {
    const adapter = createOpenRouterAdapter({
      model: MODEL,
      eval: EVAL,
      transport: () => ({
        response: {
          ...fixture("complete") as Record<string, unknown>,
          choices: [
            {
              finish_reason: "tool_calls",
              message: { content: "not a completion" },
            },
          ],
        },
        executedModel: MODEL,
      }),
    });

    await expect(
      adapter.complete?.({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        profile: "@sceneaxi/profile-web",
        model: MODEL,
        prompt: "fixture prompt",
      }),
    ).rejects.toMatchObject({
      code: OPENROUTER_ADAPTER_ERROR_CODES.responseInvalid,
    });
  });

  it("cannot bypass the port's non-overridable Kids denial", async () => {
    let calls = 0;
    const adapter = createOpenRouterAdapter({
      model: MODEL,
      eval: EVAL,
      transport() {
        calls += 1;
        return attestedFixture("complete");
      },
    });
    const port = createModelProviderPort({
      adapter,
      profilePolicies: {
        "@sceneaxi/profile-kids": () => ({ ok: true }),
      },
    });
    const result = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-kids",
      model: MODEL,
      prompt: "must refuse",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "THIRD_PARTY_LLM_DENIED_BY_DEFAULT",
    });
    expect(calls).toBe(0);
  });

  it("refuses silent model substitution and non-deterministic configuration", async () => {
    const adapter = createOpenRouterAdapter({
      model: MODEL,
      eval: EVAL,
      transport: () => ({
        response: {
          ...fixture("complete") as Record<string, unknown>,
          model: "openai/silent-substitute",
        },
        executedModel: MODEL,
      }),
    });

    await expect(
      adapter.complete?.({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        profile: "@sceneaxi/profile-web",
        model: MODEL,
        prompt: "fixture prompt",
      }),
    ).rejects.toMatchObject({
      code: OPENROUTER_ADAPTER_ERROR_CODES.responseModelMismatch,
    });

    const unattestedAdapter = createOpenRouterAdapter({
      model: MODEL,
      eval: EVAL,
      transport: () => attestedFixture("complete", {
        ...MODEL,
        quantization: "unattested-substitute",
      }),
    });

    await expect(
      unattestedAdapter.complete?.({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        profile: "@sceneaxi/profile-web",
        model: MODEL,
        prompt: "fixture prompt",
      }),
    ).rejects.toMatchObject({
      code: OPENROUTER_ADAPTER_ERROR_CODES.responseModelMismatch,
    });

    expect(
      () => createOpenRouterAdapter({
        model: MODEL,
        eval: { ...EVAL, allowFallbacks: true } as never,
        transport: () => attestedFixture("complete"),
      }),
    ).toThrowError(OpenRouterAdapterError);
  });
});
