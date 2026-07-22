import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DELIVERY_HANDOFF_KIND,
  DELIVERY_HANDOFF_SCHEMA_VERSION,
  computeDeliveryArtifactSetDigest,
  contracts,
  parseDeliveryHandoffText,
  validateDeliveryHandoff,
} from "@sceneaxi/schemas";

const SHA256 =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function minimalHandoff() {
  const artifacts = {
    "artifacts/demo-game.zip": {
      role: "application",
      contentType: "application/zip",
      digest: SHA256,
    },
  } as const;
  return {
    schemaVersion: DELIVERY_HANDOFF_SCHEMA_VERSION,
    kind: DELIVERY_HANDOFF_KIND,
    product: {
      id: "demo-game",
      displayName: "Demo Game",
      version: "1.0.0",
    },
    target: "web",
    artifacts,
    artifactSetDigest: computeDeliveryArtifactSetDigest(artifacts),
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
        fileURLToPath(
          import.meta.resolve(
            "@sceneaxi/schemas/contracts/delivery-handoff.schema.json",
          ),
        ),
        "utf8",
      ),
    ) as {
      $id?: string;
      additionalProperties?: boolean;
      required?: string[];
      $defs?: Record<string, { additionalProperties?: boolean }>;
      properties?: {
        artifacts?: {
          type?: string;
          minProperties?: number;
          propertyNames?: { pattern?: string };
        };
      };
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
        "target",
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
    expect(schema.properties?.artifacts).toEqual(
      expect.objectContaining({ type: "object", minProperties: 1 }),
    );
    expect(schema.properties?.artifacts?.propertyNames?.pattern).toBeTypeOf(
      "string",
    );
  });

  it("uses one target so every artifact set has an unambiguous destination", () => {
    const result = validateDeliveryHandoff({
      ...minimalHandoff(),
      targets: ["android", "ios"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "unexpected-field",
          path: "$.targets",
        }),
      );
    }
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
      artifacts: {
        "artifacts/demo-game.zip": {
          ...minimalHandoff().artifacts["artifacts/demo-game.zip"],
          digest: "sha256:not-hex",
        },
      },
    });
    expect(invalidArtifactDigest.ok).toBe(false);
    if (!invalidArtifactDigest.ok) {
      expect(invalidArtifactDigest.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "invalid-digest",
          path: '$.artifacts["artifacts/demo-game.zip"].digest',
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

  it("computes and verifies the RFC 8785 artifact binding digest", () => {
    const handoff = minimalHandoff();
    const canonical =
      '{"artifacts/demo-game.zip":{"contentType":"application/zip","digest":"sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","role":"application"}}';
    expect(handoff.artifactSetDigest).toBe(
      `sha256:${createHash("sha256").update(canonical).digest("hex")}`,
    );

    const changedArtifacts = {
      ...handoff.artifacts,
      "metadata/product.json": {
        role: "metadata",
        contentType: "application/json",
        digest: SHA256,
      },
    } as const;
    const stale = validateDeliveryHandoff({
      ...handoff,
      artifacts: changedArtifacts,
    });
    expect(
      computeDeliveryArtifactSetDigest(changedArtifacts),
    ).toBe(
      computeDeliveryArtifactSetDigest(
        Object.fromEntries(Object.entries(changedArtifacts).reverse()),
      ),
    );
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "artifact-set-digest-mismatch",
          path: "$.artifactSetDigest",
        }),
      );
    }
  });

  it("refuses non-portable artifact path keys in TypeScript and JSON Schema", () => {
    const traversingPath = validateDeliveryHandoff({
      ...minimalHandoff(),
      artifacts: {
        "a\n/../../outside.zip":
          minimalHandoff().artifacts["artifacts/demo-game.zip"],
      },
    });
    expect(traversingPath.ok).toBe(false);
    if (!traversingPath.ok) {
      expect(traversingPath.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "invalid-field",
          path: '$.artifacts["a\\n/../../outside.zip"]',
        }),
      );
    }

    const schema = JSON.parse(
      readFileSync(
        fileURLToPath(
          import.meta.resolve(
            "@sceneaxi/schemas/contracts/delivery-handoff.schema.json",
          ),
        ),
        "utf8",
      ),
    ) as {
      properties?: { artifacts?: { propertyNames?: { pattern?: string } } };
    };
    const pattern = schema.properties?.artifacts?.propertyNames?.pattern;
    expect(pattern).toBeTypeOf("string");
    expect(new RegExp(pattern ?? "").test("a\n/../../outside.zip")).toBe(false);
    expect(new RegExp(pattern ?? "").test("artifacts/")).toBe(false);
    expect(new RegExp(pattern ?? "").test("artifacts/demo-game.zip")).toBe(
      true,
    );
  });

  it("uses one non-leap RFC 3339 timestamp subset", () => {
    for (const createdAt of [
      "2026-07-22T24:00:00Z",
      "2025-02-29T12:00:00Z",
      "1990-12-31T23:59:60Z",
      "1991-01-01T05:29:60+05:30",
    ]) {
      expect(
        validateDeliveryHandoff({
          ...minimalHandoff(),
          provenance: { createdAt },
        }).ok,
      ).toBe(false);
    }

    expect(
      validateDeliveryHandoff({
        ...minimalHandoff(),
        provenance: { createdAt: "1991-01-01t05:29:59+05:30" },
      }).ok,
    ).toBe(true);

    const ordered = validateDeliveryHandoff({
      ...minimalHandoff(),
      provenance: {
        createdAt: "1990-12-31T23:59:59Z",
        build: {
          id: "ordered-build",
          startedAt: "1990-12-31T23:59:59.999Z",
          completedAt: "1991-01-01T00:00:00Z",
        },
      },
    });
    expect(ordered.ok).toBe(true);

    const reversed = validateDeliveryHandoff({
      ...minimalHandoff(),
      provenance: {
        createdAt: "1990-12-31T23:59:59Z",
        build: {
          id: "ordered-build",
          startedAt: "1991-01-01T00:00:00Z",
          completedAt: "1990-12-31T23:59:59.999Z",
        },
      },
    });
    expect(reversed.ok).toBe(false);
    if (!reversed.ok) {
      expect(reversed.diagnostics[0]?.path).toBe(
        "$.provenance.build.completedAt",
      );
    }

    const schema = JSON.parse(
      readFileSync(
        fileURLToPath(
          import.meta.resolve(
            "@sceneaxi/schemas/contracts/delivery-handoff.schema.json",
          ),
        ),
        "utf8",
      ),
    ) as {
      $defs?: {
        build?: {
          properties?: {
            startedAt?: { pattern?: string };
            completedAt?: { pattern?: string };
          };
        };
        provenance?: {
          properties?: { createdAt?: { pattern?: string } };
        };
      };
    };
    const timestampPatterns = [
      schema.$defs?.build?.properties?.startedAt?.pattern,
      schema.$defs?.build?.properties?.completedAt?.pattern,
      schema.$defs?.provenance?.properties?.createdAt?.pattern,
    ];
    for (const pattern of timestampPatterns) {
      expect(pattern).toBeTypeOf("string");
      expect(new RegExp(pattern ?? "").test("1990-12-31T23:59:60Z")).toBe(
        false,
      );
      expect(new RegExp(pattern ?? "").test("1990-12-31T23:59:59Z")).toBe(
        true,
      );
    }
  });

  it("counts string limits by Unicode code point like JSON Schema", () => {
    const astral = "😀";
    const boundary = validateDeliveryHandoff({
      ...minimalHandoff(),
      product: {
        ...minimalHandoff().product,
        displayName: astral.repeat(200),
        version: astral.repeat(100),
      },
      provenance: {
        ...minimalHandoff().provenance,
        build: {
          id: astral.repeat(200),
          tool: astral.repeat(200),
        },
      },
      notes: astral.repeat(10_000),
    });
    expect(boundary.ok).toBe(true);

    const overBoundary = validateDeliveryHandoff({
      ...minimalHandoff(),
      product: {
        ...minimalHandoff().product,
        displayName: astral.repeat(201),
      },
    });
    expect(overBoundary.ok).toBe(false);
    if (!overBoundary.ok) {
      expect(overBoundary.diagnostics[0]?.path).toBe("$.product.displayName");
    }
  });

  it("refuses duplicate JSON member names before value validation", () => {
    const handoff = minimalHandoff();
    const descriptor = JSON.stringify(
      handoff.artifacts["artifacts/demo-game.zip"],
    );
    const duplicateArtifactPath = JSON.stringify(handoff).replace(
      `"artifacts":${JSON.stringify(handoff.artifacts)}`,
      `"artifacts":{"artifacts/demo-game.zip":${descriptor},"artifacts/demo-game.zip":${descriptor}}`,
    );
    const duplicateArtifactResult = parseDeliveryHandoffText(
      duplicateArtifactPath,
    );
    expect(duplicateArtifactResult.ok).toBe(false);
    if (!duplicateArtifactResult.ok) {
      expect(duplicateArtifactResult.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "duplicate-json-member",
          path: '$.artifacts["artifacts/demo-game.zip"]',
        }),
      );
    }

    const duplicateRoot = JSON.stringify(handoff).replace(
      '"target":"web"',
      '"target":"web","target":"ios"',
    );
    const duplicateRootResult = parseDeliveryHandoffText(duplicateRoot);
    expect(duplicateRootResult.ok).toBe(false);
    if (!duplicateRootResult.ok) {
      expect(duplicateRootResult.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "duplicate-json-member",
          path: "$.target",
        }),
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
