import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DELIVERY_HANDOFF_KIND,
  DELIVERY_HANDOFF_SCHEMA_VERSION,
  contracts,
  parseDeliveryHandoffText,
  validateDeliveryHandoff,
} from "@sceneaxi/schemas";

const SHA256 =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function minimalHandoff() {
  return {
    schemaVersion: DELIVERY_HANDOFF_SCHEMA_VERSION,
    kind: DELIVERY_HANDOFF_KIND,
    product: {
      id: "demo-game",
      displayName: "Demo Game",
      version: "1.0.0",
    },
    targets: ["web"],
    artifacts: [
      {
        path: "artifacts/demo-game.zip",
        role: "application",
        contentType: "application/zip",
        digest: SHA256,
      },
    ],
    artifactSetDigest: SHA256,
    provenance: {
      createdAt: "2026-07-22T10:30:00.000Z",
    },
  };
}

describe("delivery handoff contract", () => {
  it("accepts and parses a valid minimal delivery-neutral handoff", () => {
    const handoff = minimalHandoff();
    const result = validateDeliveryHandoff(handoff);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handoff).toEqual(handoff);
    expect(parseDeliveryHandoffText(JSON.stringify(handoff))).toEqual(result);
  });

  it("ships the public versioned JSON Schema", () => {
    expect(contracts.deliveryHandoff).toBe(
      "contracts/delivery-handoff.schema.json",
    );
    const schema = JSON.parse(
      readFileSync(
        new URL(`../${contracts.deliveryHandoff}`, import.meta.url),
        "utf8",
      ),
    ) as {
      $id?: string;
      additionalProperties?: boolean;
      required?: string[];
      $defs?: Record<string, { additionalProperties?: boolean }>;
    };

    expect(schema.$id).toBe(
      "https://sceneaxi.invalid/contracts/delivery-handoff/v1",
    );
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "schemaVersion",
        "kind",
        "product",
        "targets",
        "artifacts",
        "artifactSetDigest",
        "provenance",
      ]),
    );
    expect(Object.values(schema.$defs ?? {})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ additionalProperties: false }),
      ]),
    );
    expect(
      Object.values(schema.$defs ?? {}).every(
        (definition) => definition.additionalProperties === false,
      ),
    ).toBe(true);
  });

  it("refuses missing required fields with typed diagnostics", () => {
    const withoutProduct: Record<string, unknown> = { ...minimalHandoff() };
    delete withoutProduct["product"];
    const result = validateDeliveryHandoff(withoutProduct);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-field", path: "$.product" }),
      ]),
    );
  });

  it("refuses incompatible schema versions without silent migration", () => {
    const result = validateDeliveryHandoff({
      ...minimalHandoff(),
      schemaVersion: 2,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "schema-major-mismatch",
        path: "$.schemaVersion",
        foundSchemaVersion: 2,
      }),
    );
  });

  it("refuses adapter-private and credential-shaped extension fields", () => {
    const privateExtensions = [
      { mobileFactoryPath: "/private/factory/export" },
      { easProjectId: "private-project" },
      { fastlaneLane: "release" },
      { storeCredentials: { token: "not-a-real-secret" } },
      { approveGateSecret: "not-a-real-secret" },
    ];

    for (const extension of privateExtensions) {
      const result = validateDeliveryHandoff({
        ...minimalHandoff(),
        ...extension,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.diagnostics[0]?.code).toBe("unexpected-field");
      }
    }

    const nested = validateDeliveryHandoff({
      ...minimalHandoff(),
      provenance: {
        ...minimalHandoff().provenance,
        storeCredentials: { token: "not-a-real-secret" },
      },
    });
    expect(nested.ok).toBe(false);
    if (!nested.ok) {
      expect(nested.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "unexpected-field",
          path: "$.provenance.storeCredentials",
        }),
      );
    }
  });

  it("refuses malformed artifact and aggregate sha256 digests", () => {
    const invalidArtifactDigest = validateDeliveryHandoff({
      ...minimalHandoff(),
      artifacts: [
        {
          ...minimalHandoff().artifacts[0],
          digest: "sha256:not-hex",
        },
      ],
    });
    expect(invalidArtifactDigest.ok).toBe(false);
    if (!invalidArtifactDigest.ok) {
      expect(invalidArtifactDigest.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "invalid-digest",
          path: "$.artifacts[0].digest",
        }),
      );
    }

    const invalidSetDigest = validateDeliveryHandoff({
      ...minimalHandoff(),
      artifactSetDigest:
        "sha256:ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    });
    expect(invalidSetDigest.ok).toBe(false);
    if (!invalidSetDigest.ok) {
      expect(invalidSetDigest.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "invalid-digest",
          path: "$.artifactSetDigest",
        }),
      );
    }
  });

  it("refuses non-portable and duplicate artifact paths", () => {
    const traversingPath = validateDeliveryHandoff({
      ...minimalHandoff(),
      artifacts: [
        { ...minimalHandoff().artifacts[0], path: "../outside.zip" },
      ],
    });
    expect(traversingPath.ok).toBe(false);
    if (!traversingPath.ok) {
      expect(traversingPath.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "invalid-field",
          path: "$.artifacts[0].path",
        }),
      );
    }

    const duplicatePath = validateDeliveryHandoff({
      ...minimalHandoff(),
      artifacts: [
        minimalHandoff().artifacts[0],
        { ...minimalHandoff().artifacts[0], role: "metadata" },
      ],
    });
    expect(duplicatePath.ok).toBe(false);
    if (!duplicatePath.ok) {
      expect(duplicatePath.diagnostics[0]?.code).toBe(
        "duplicate-artifact-path",
      );
    }
  });

  it("refuses malformed JSON with a parse diagnostic", () => {
    const result = parseDeliveryHandoffText("{");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]?.code).toBe("parse-error");
      expect(result.diagnostics[0]?.path).toBe("$");
    }
  });
});
