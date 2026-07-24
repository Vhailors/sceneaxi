import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MODEL_PROVIDER_CALL_EVIDENCE_KIND,
  MODEL_PROVIDER_OPERATIONS,
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  MODEL_PROVIDER_ROUTE_KINDS,
  contracts,
  type ModelDescriptor,
} from "@sceneaxi/schemas";

describe("Model Provider Port contract", () => {
  it("ships the versioned provider-neutral envelope schema", () => {
    const schema = JSON.parse(
      readFileSync(
        new URL(`../${contracts.modelProviderPort}`, import.meta.url),
        "utf8",
      ),
    ) as {
      $id: string;
      $defs: Record<string, unknown>;
      oneOf: unknown[];
    };

    expect(schema.$id).toBe(
      "https://sceneaxi.invalid/contracts/model-provider-port/v1",
    );
    expect(Object.keys(schema.$defs)).toEqual(
      expect.arrayContaining([
        "model",
        "capabilities",
        "completeRequest",
        "completeResponse",
        "toolCallRequest",
        "toolCallResponse",
        "streamRequest",
        "streamChunk",
        "evidence",
      ]),
    );
    expect(schema.oneOf).toHaveLength(8);
  });

  it("keeps descriptor, operation, route, and evidence discriminators stable", () => {
    const descriptor = {
      model: "fixture/model",
      provider: "fixture-provider",
      quantization: "none",
      version: "fixture-v1",
    } satisfies ModelDescriptor;

    expect(MODEL_PROVIDER_PORT_SCHEMA_VERSION).toBe(1);
    expect(MODEL_PROVIDER_OPERATIONS).toEqual([
      "complete",
      "tool-call",
      "stream",
    ]);
    expect(MODEL_PROVIDER_ROUTE_KINDS).toEqual([
      "third-party",
      "self-hosted",
    ]);
    expect(MODEL_PROVIDER_CALL_EVIDENCE_KIND).toBe(
      "sceneaxi.model-provider-call-evidence",
    );
    expect(descriptor).toEqual({
      model: "fixture/model",
      provider: "fixture-provider",
      quantization: "none",
      version: "fixture-v1",
    });
  });
});
