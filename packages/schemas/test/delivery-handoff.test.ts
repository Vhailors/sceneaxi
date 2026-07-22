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
      $defs?: Record<
        string,
        { type?: string; additionalProperties?: boolean }
      >;
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
      Object.values(schema.$defs ?? {})
        .filter((definition) => definition.type === "object")
        .every(
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
    expect(new RegExp(pattern ?? "").test("artifacts/demo-game.zip\n")).toBe(
      false,
    );
    expect(new RegExp(pattern ?? "").test("artifacts/demo-game.zip")).toBe(
      true,
    );
  });

  it("requires true-end matches for every anchored field", () => {
    const newlineCases = [
      {
        value: {
          ...minimalHandoff(),
          product: { ...minimalHandoff().product, id: "demo-game\n" },
        },
        path: "$.product.id",
      },
      {
        value: {
          ...minimalHandoff(),
          artifacts: {
            "artifacts/demo-game.zip": {
              ...minimalHandoff().artifacts["artifacts/demo-game.zip"],
              contentType: "application/zip\n",
            },
          },
        },
        path: '$.artifacts["artifacts/demo-game.zip"].contentType',
      },
      {
        value: {
          ...minimalHandoff(),
          artifacts: {
            "artifacts/demo-game.zip": {
              ...minimalHandoff().artifacts["artifacts/demo-game.zip"],
              digest: `${SHA256}\n`,
            },
          },
        },
        path: '$.artifacts["artifacts/demo-game.zip"].digest',
      },
      {
        value: {
          ...minimalHandoff(),
          artifactSetDigest: `${minimalHandoff().artifactSetDigest}\n`,
        },
        path: "$.artifactSetDigest",
      },
      {
        value: {
          ...minimalHandoff(),
          provenance: {
            ...minimalHandoff().provenance,
            sourceCommit: `${"a".repeat(40)}\n`,
          },
        },
        path: "$.provenance.sourceCommit",
      },
      {
        value: {
          ...minimalHandoff(),
          provenance: {
            createdAt: `${minimalHandoff().provenance.createdAt}\n`,
          },
        },
        path: "$.provenance.createdAt",
      },
    ];

    for (const newlineCase of newlineCases) {
      const result = validateDeliveryHandoff(newlineCase.value);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.diagnostics[0]?.path).toBe(newlineCase.path);
      }
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
      properties?: {
        artifacts?: { propertyNames?: { pattern?: string } };
        artifactSetDigest?: { pattern?: string };
      };
      $defs?: {
        product?: { properties?: { id?: { pattern?: string } } };
        artifact?: {
          properties?: {
            contentType?: { pattern?: string };
            digest?: { pattern?: string };
          };
        };
        provenance?: {
          properties?: { sourceCommit?: { pattern?: string } };
        };
        unicodeScalarString?: { pattern?: string };
        dateTime?: { pattern?: string };
      };
    };
    const patterns = [
      schema.properties?.artifacts?.propertyNames?.pattern,
      schema.properties?.artifactSetDigest?.pattern,
      schema.$defs?.product?.properties?.id?.pattern,
      schema.$defs?.artifact?.properties?.contentType?.pattern,
      schema.$defs?.artifact?.properties?.digest?.pattern,
      schema.$defs?.provenance?.properties?.sourceCommit?.pattern,
      schema.$defs?.unicodeScalarString?.pattern,
      schema.$defs?.dateTime?.pattern,
    ];
    expect(patterns.every((pattern) => pattern?.endsWith("(?![\\s\\S])"))).toBe(
      true,
    );

    const restrictedPatterns = [
      [schema.properties?.artifactSetDigest?.pattern, SHA256],
      [schema.$defs?.product?.properties?.id?.pattern, "demo-game"],
      [
        schema.$defs?.artifact?.properties?.contentType?.pattern,
        "application/zip",
      ],
      [schema.$defs?.artifact?.properties?.digest?.pattern, SHA256],
      [
        schema.$defs?.provenance?.properties?.sourceCommit?.pattern,
        "a".repeat(40),
      ],
      [schema.$defs?.dateTime?.pattern, "2026-07-22T10:30:00.000Z"],
    ] as const;
    for (const [pattern, validValue] of restrictedPatterns) {
      expect(pattern).toBeTypeOf("string");
      expect(new RegExp(pattern ?? "").test(validValue)).toBe(true);
      expect(new RegExp(pattern ?? "").test(`${validValue}\n`)).toBe(false);
    }
  });

  it("uses one non-leap RFC 3339 timestamp subset", () => {
    const invalidTimestamps = [
      "2026-07-22T24:00:00Z",
      "2025-02-29T12:00:00Z",
      "1900-02-29T12:00:00Z",
      "2026-04-31T12:00:00Z",
      "1990-12-31T23:59:60Z",
      "1991-01-01T05:29:60+05:30",
      "2026-99-99T99:99:59+99:99",
    ];
    for (const createdAt of invalidTimestamps) {
      expect(
        validateDeliveryHandoff({
          ...minimalHandoff(),
          provenance: { createdAt },
        }).ok,
      ).toBe(false);
    }

    const validTimestamps = [
      "1991-01-01t05:29:59+05:30",
      "2024-02-29T23:59:59Z",
      "2000-02-29t00:00:00.1+23:59",
      "2026-04-30T12:00:00-00:00",
    ];
    for (const createdAt of validTimestamps) {
      expect(
        validateDeliveryHandoff({
          ...minimalHandoff(),
          provenance: { createdAt },
        }).ok,
      ).toBe(true);
    }

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
        dateTime?: { format?: string; pattern?: string };
        build?: {
          properties?: {
            startedAt?: { $ref?: string };
            completedAt?: { $ref?: string };
          };
        };
        provenance?: {
          properties?: { createdAt?: { $ref?: string } };
        };
      };
    };
    expect(schema.$defs?.dateTime?.format).toBe("date-time");
    const timestampReferences = [
      schema.$defs?.build?.properties?.startedAt?.$ref,
      schema.$defs?.build?.properties?.completedAt?.$ref,
      schema.$defs?.provenance?.properties?.createdAt?.$ref,
    ];
    expect(timestampReferences).toEqual([
      "#/$defs/dateTime",
      "#/$defs/dateTime",
      "#/$defs/dateTime",
    ]);
    const timestampPattern = schema.$defs?.dateTime?.pattern;
    expect(timestampPattern).toBeTypeOf("string");
    const timestampRegex = new RegExp(timestampPattern ?? "");
    for (const timestamp of invalidTimestamps) {
      expect(timestampRegex.test(timestamp)).toBe(false);
    }
    for (const timestamp of validTimestamps) {
      expect(timestampRegex.test(timestamp)).toBe(true);
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

  it("refuses unpaired surrogates across all free-text fields", () => {
    const invalidCases = [
      {
        value: {
          ...minimalHandoff(),
          product: { ...minimalHandoff().product, displayName: "\ud800" },
        },
        path: "$.product.displayName",
      },
      {
        value: {
          ...minimalHandoff(),
          product: { ...minimalHandoff().product, version: "\udfff" },
        },
        path: "$.product.version",
      },
      {
        value: {
          ...minimalHandoff(),
          provenance: {
            ...minimalHandoff().provenance,
            build: { id: "\ud800" },
          },
        },
        path: "$.provenance.build.id",
      },
      {
        value: {
          ...minimalHandoff(),
          provenance: {
            ...minimalHandoff().provenance,
            build: { id: "build-1", tool: "\udfff" },
          },
        },
        path: "$.provenance.build.tool",
      },
      {
        value: { ...minimalHandoff(), notes: "\ud800" },
        path: "$.notes",
      },
    ];

    for (const invalidCase of invalidCases) {
      const result = validateDeliveryHandoff(invalidCase.value);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.diagnostics[0]).toEqual(
          expect.objectContaining({
            code: "invalid-field",
            path: invalidCase.path,
          }),
        );
      }
    }

    const parsed = parseDeliveryHandoffText(
      JSON.stringify({
        ...minimalHandoff(),
        product: { ...minimalHandoff().product, displayName: "\ud800" },
      }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "invalid-field",
          path: "$.product.displayName",
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
      properties?: {
        notes?: { allOf?: { $ref?: string }[] };
      };
      $defs?: {
        unicodeScalarString?: { pattern?: string };
        product?: {
          properties?: {
            displayName?: { allOf?: { $ref?: string }[] };
            version?: { allOf?: { $ref?: string }[] };
          };
        };
        build?: {
          properties?: {
            id?: { allOf?: { $ref?: string }[] };
            tool?: { allOf?: { $ref?: string }[] };
          };
        };
      };
    };
    const scalarReference = "#/$defs/unicodeScalarString";
    expect([
      schema.properties?.notes?.allOf?.[0]?.$ref,
      schema.$defs?.product?.properties?.displayName?.allOf?.[0]?.$ref,
      schema.$defs?.product?.properties?.version?.allOf?.[0]?.$ref,
      schema.$defs?.build?.properties?.id?.allOf?.[0]?.$ref,
      schema.$defs?.build?.properties?.tool?.allOf?.[0]?.$ref,
    ]).toEqual(Array.from({ length: 5 }, () => scalarReference));

    const scalarPattern = schema.$defs?.unicodeScalarString?.pattern;
    expect(scalarPattern).toBeTypeOf("string");
    const scalarRegex = new RegExp(scalarPattern ?? "");
    expect(scalarRegex.test("plain 😀 text")).toBe(true);
    expect(scalarRegex.test("\ud800")).toBe(false);
    expect(scalarRegex.test("\udfff")).toBe(false);
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
