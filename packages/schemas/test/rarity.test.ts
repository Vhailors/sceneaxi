import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RARITY_ALGORITHM_ID,
  RARITY_FIXTURES_PATH,
  RARITY_NAMESPACE_KIND,
  RARITY_OUTCOME_KIND,
  RARITY_POLICY_KIND,
  RARITY_PROVIDER_DESCRIPTOR_MAX_CHARS,
  RARITY_PROVENANCE_KIND,
  RARITY_REFUSE_CODES,
  RARITY_REQUEST_KIND,
  RARITY_SCHEMA_VERSION,
  RARITY_TIERS,
  digestRarityValue,
  digestRarityPolicy,
  digestRarityRequest,
  serializeRarityNamespace,
  validateRarityNamespace,
  validateRarityPolicy,
  validateRarityRollRequest,
  type RarityNamespace,
  type JsonValue,
  type RarityPolicy,
  type RarityRollRequest,
} from "@sceneaxi/schemas";

type Fixture = {
  readonly policy: RarityPolicy;
  readonly request: RarityRollRequest;
  readonly vectors: ReadonlyArray<{
    readonly eventId: string;
    readonly outcome: {
      readonly schemaVersion: 1;
      readonly kind: typeof RARITY_OUTCOME_KIND;
      readonly tier: (typeof RARITY_TIERS)[number];
      readonly candidateId: string;
    };
    readonly provenance: {
      readonly schemaVersion: 1;
      readonly kind: typeof RARITY_PROVENANCE_KIND;
      readonly algorithmId: typeof RARITY_ALGORITHM_ID;
      readonly scope: string;
      readonly eventId: string;
      readonly policyDigest: string;
      readonly requestDigest: string;
      readonly tierRollDigest: string;
      readonly tierDraw: number;
      readonly tierTotalWeight: number;
      readonly candidateRollDigest: string;
      readonly candidateDraw: number;
      readonly candidateTotalWeight: number;
      readonly outcomeDigest: string;
    };
  }>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL(`../${RARITY_FIXTURES_PATH}`, import.meta.url),
    "utf8",
  ),
) as Fixture;

const schema = JSON.parse(
  readFileSync(new URL("../contracts/rarity.schema.json", import.meta.url), "utf8"),
) as {
  readonly $id: string;
  readonly $defs: {
    readonly tier: { readonly enum: readonly string[] };
    readonly policy: {
      readonly properties: { readonly schemaVersion: { readonly const: number } };
    };
    readonly request: { readonly additionalProperties: boolean };
    readonly provenance: {
      readonly oneOf: ReadonlyArray<{ readonly $ref: string }>;
    };
    readonly plainProvenance: {
      readonly properties: { readonly algorithmId: { readonly const: string } };
    };
    readonly providerProvenance: {
      readonly properties: { readonly algorithmId: { readonly const: string } };
    };
  };
};

type SchemaNode = Readonly<Record<string, unknown>>;

/**
 * The keywords `rarity.schema.json` is allowed to use. An unlisted keyword
 * throws rather than being ignored, so the shipped contract can never gain a
 * rule this evaluator would silently skip.
 */
const SUPPORTED_KEYWORDS = new Set([
  "$schema",
  "$id",
  "title",
  "description",
  "$defs",
  "$ref",
  "oneOf",
  "type",
  "required",
  "additionalProperties",
  "properties",
  "enum",
  "const",
  "pattern",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "items",
]);

/** The `type` values this evaluator implements; any other one throws. */
const SUPPORTED_TYPES = new Set(["object", "array", "string", "integer"]);

/** Keywords that, on their own, constrain a value. A node with none is inert. */
const CONSTRAINING_KEYWORDS = ["$ref", "oneOf", "type", "const", "enum"];

function assertEvaluable(node: SchemaNode, path: string): void {
  const unsupported = Object.keys(node).find(
    (keyword) => !SUPPORTED_KEYWORDS.has(keyword),
  );
  if (unsupported !== undefined) {
    throw new Error(`rarity schema keyword "${unsupported}" is not evaluated`);
  }
  if (Object.hasOwn(node, "type") && !SUPPORTED_TYPES.has(node["type"] as string)) {
    throw new Error(
      `rarity schema type ${JSON.stringify(node["type"])} at ${path} is not evaluated`,
    );
  }
  if (Object.hasOwn(node, "additionalProperties") && node["additionalProperties"] !== false) {
    throw new Error(
      `rarity schema additionalProperties at ${path} is only evaluated as false`,
    );
  }
  if (
    Object.hasOwn(node, "items") &&
    (Array.isArray(node["items"]) ||
      node["items"] === null ||
      typeof node["items"] !== "object")
  ) {
    throw new Error(
      `rarity schema items at ${path} is only evaluated as a single subschema`,
    );
  }
  if (!CONSTRAINING_KEYWORDS.some((keyword) => Object.hasOwn(node, keyword))) {
    throw new Error(`rarity schema node at ${path} constrains nothing`);
  }
}

function resolveRef(ref: string): SchemaNode {
  if (!ref.startsWith("#/")) throw new Error(`unsupported $ref "${ref}"`);
  let node: unknown = schema;
  for (const segment of ref.slice(2).split("/")) {
    node = (node as Record<string, unknown>)[segment];
  }
  if (node === null || typeof node !== "object") {
    throw new Error(`unresolved $ref "${ref}"`);
  }
  return node as SchemaNode;
}

function schemaViolations(
  node: SchemaNode,
  value: unknown,
  path: string,
): string[] {
  assertEvaluable(node, path);
  if (typeof node["$ref"] === "string") {
    return schemaViolations(resolveRef(node["$ref"]), value, path);
  }
  if (Array.isArray(node["oneOf"])) {
    const matched = (node["oneOf"] as SchemaNode[]).filter(
      (branch) => schemaViolations(branch, value, path).length === 0,
    );
    return matched.length === 1
      ? []
      : [`${path}: matched ${String(matched.length)} oneOf branches`];
  }

  const violations: string[] = [];
  const type = node["type"];
  if (type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return [`${path}: expected object`];
    }
    const record = value as Record<string, unknown>;
    const properties = (node["properties"] ?? {}) as Record<string, SchemaNode>;
    for (const key of (node["required"] as string[] | undefined) ?? []) {
      if (!Object.hasOwn(record, key)) violations.push(`${path}.${key}: required`);
    }
    if (node["additionalProperties"] === false) {
      for (const key of Object.keys(record)) {
        if (!Object.hasOwn(properties, key)) {
          violations.push(`${path}.${key}: additional property`);
        }
      }
    }
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(record, key)) {
        violations.push(...schemaViolations(child, record[key], `${path}.${key}`));
      }
    }
    return violations;
  }
  if (type === "array") {
    if (!Array.isArray(value)) return [`${path}: expected array`];
    const minItems = node["minItems"];
    if (typeof minItems === "number" && value.length < minItems) {
      violations.push(`${path}: fewer than ${String(minItems)} items`);
    }
    const maxItems = node["maxItems"];
    if (typeof maxItems === "number" && value.length > maxItems) {
      violations.push(`${path}: more than ${String(maxItems)} items`);
    }
    const items = node["items"] as SchemaNode | undefined;
    if (items !== undefined) {
      value.forEach((entry, index) => {
        violations.push(
          ...schemaViolations(items, entry, `${path}[${String(index)}]`),
        );
      });
    }
    return violations;
  }
  if (type === "string") {
    if (typeof value !== "string") return [`${path}: expected string`];
    const minLength = node["minLength"];
    if (typeof minLength === "number" && value.length < minLength) {
      violations.push(`${path}: shorter than ${String(minLength)} characters`);
    }
    const maxLength = node["maxLength"];
    if (typeof maxLength === "number" && value.length > maxLength) {
      violations.push(`${path}: longer than ${String(maxLength)} characters`);
    }
    const pattern = node["pattern"];
    if (typeof pattern === "string" && !new RegExp(pattern).test(value)) {
      violations.push(`${path}: pattern`);
    }
  }
  if (type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return [`${path}: expected integer`];
    }
    const minimum = node["minimum"];
    const maximum = node["maximum"];
    if (typeof minimum === "number" && value < minimum) {
      violations.push(`${path}: below minimum`);
    }
    if (typeof maximum === "number" && value > maximum) {
      violations.push(`${path}: above maximum`);
    }
  }
  if (Object.hasOwn(node, "const") && value !== node["const"]) {
    violations.push(`${path}: const`);
  }
  const allowed = node["enum"];
  if (Array.isArray(allowed) && !allowed.includes(value)) {
    violations.push(`${path}: enum`);
  }
  return violations;
}

/** Every rarity value the repository produces is a document of the shipped schema. */
function shippedSchemaViolations(value: unknown): string[] {
  return schemaViolations(schema as unknown as SchemaNode, value, "$");
}

/** Every schema node the shipped contract declares, whether or not a value reaches it. */
function everySchemaNode(): ReadonlyArray<readonly [string, SchemaNode]> {
  const nodes: Array<readonly [string, SchemaNode]> = [];
  const visit = (node: unknown, path: string): void => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return;
    const record = node as SchemaNode;
    nodes.push([path, record]);
    for (const key of ["properties", "$defs"]) {
      const group = record[key];
      if (group !== null && typeof group === "object" && !Array.isArray(group)) {
        for (const [name, child] of Object.entries(group)) {
          visit(child, `${path}.${key}.${name}`);
        }
      }
    }
    visit(record["items"], `${path}.items`);
    const branches = record["oneOf"];
    if (Array.isArray(branches)) {
      branches.forEach((branch, index) => {
        visit(branch, `${path}.oneOf[${String(index)}]`);
      });
    }
  };
  visit(schema, "$");
  return nodes;
}

const policy = (tierWeights: Record<(typeof RARITY_TIERS)[number], number>) => ({
  schemaVersion: RARITY_SCHEMA_VERSION,
  kind: RARITY_POLICY_KIND,
  tierWeights,
});

describe("rarity domain contracts", () => {
  it("ships a versioned schema that pins the runtime tier and algorithm contract", () => {
    expect(schema.$id).toBe("https://sceneaxi.invalid/contracts/rarity/v1");
    expect(schema.$defs.tier.enum).toEqual(RARITY_TIERS);
    expect(schema.$defs.policy.properties.schemaVersion.const).toBe(
      RARITY_SCHEMA_VERSION,
    );
    expect(schema.$defs.provenance.oneOf).toEqual([
      { $ref: "#/$defs/plainProvenance" },
      { $ref: "#/$defs/providerProvenance" },
    ]);
    expect(schema.$defs.plainProvenance.properties.algorithmId.const).toBe(
      RARITY_ALGORITHM_ID,
    );
    expect(schema.$defs.providerProvenance.properties.algorithmId.const).toBe(
      RARITY_ALGORITHM_ID,
    );
    expect(schema.$defs.request.additionalProperties).toBe(false);
  });

  it("declares no schema rule this suite would silently skip", () => {
    const nodes = everySchemaNode();
    expect(nodes.length).toBeGreaterThan(12);
    for (const [path, node] of nodes) {
      expect(() => {
        assertEvaluable(node, path);
      }, path).not.toThrow();
    }
  });

  it.each([
    ["numeric type", { type: "number", minimum: 0 }],
    ["boolean type", { type: "boolean" }],
    ["union type", { type: ["string", "null"] }],
    ["subschema additionalProperties", { type: "object", additionalProperties: {} }],
    ["open additionalProperties", { type: "object", additionalProperties: true }],
    ["tuple items", { type: "array", items: [{ type: "string" }] }],
    ["unknown keyword", { type: "string", multipleOf: 2 }],
    ["inert node", { description: "constrains nothing" }],
  ])("refuses to silently skip a %s rule", (_label, node) => {
    expect(() => {
      assertEvaluable(node as SchemaNode, "$.probe");
    }).toThrow();
  });

  it("accepts every accepted rarity value this repository produces", () => {
    const rolls = fixture.vectors.map((vector) => ({
      eventId: vector.eventId,
      request: fixture.request,
      outcome: vector.outcome,
      provenance: vector.provenance,
    }));
    const validated = validateRarityNamespace({
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_NAMESPACE_KIND,
      policy: fixture.policy,
      rolls,
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    expect(shippedSchemaViolations(validated.value)).toEqual([]);
    expect(shippedSchemaViolations(fixture.policy)).toEqual([]);
    expect(shippedSchemaViolations(fixture.request)).toEqual([]);
    for (const vector of fixture.vectors) {
      expect(shippedSchemaViolations(vector.outcome), vector.eventId).toEqual([]);
      expect(shippedSchemaViolations(vector.provenance), vector.eventId).toEqual([]);
    }
  });

  it("keeps stored provider evidence identical in the schema and runtime", () => {
    const vector = fixture.vectors[0];
    const nextVector = fixture.vectors[1];
    if (vector === undefined || nextVector === undefined) {
      throw new Error("rarity fixture needs two vectors");
    }
    const providerEvidence = {
      schemaVersion: 1,
      kind: "sceneaxi.model-provider-call-evidence",
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model: {
        model: "fixture-rarity",
        provider: "sceneaxi-fixture",
        quantization: "deterministic",
        version: "v1",
      },
    } as const;
    const namespace = {
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_NAMESPACE_KIND,
      policy: fixture.policy,
      rolls: [{
        eventId: vector.eventId,
        request: fixture.request,
        outcome: vector.outcome,
        provenance: {
          ...vector.provenance,
          providerEvidenceDigest: digestRarityValue(providerEvidence as unknown as JsonValue),
        },
        providerEvidence,
      }],
    };
    expect(validateRarityNamespace(namespace).ok).toBe(true);
    expect(shippedSchemaViolations(namespace)).toEqual([]);
    const nextProviderEvidence = {
      ...providerEvidence,
      model: { ...providerEvidence.model, version: "v2" },
    };
    const nextEvidencedRoll = {
      eventId: nextVector.eventId,
      request: fixture.request,
      outcome: nextVector.outcome,
      provenance: {
        ...nextVector.provenance,
        providerEvidenceDigest: digestRarityValue(
          nextProviderEvidence as unknown as JsonValue,
        ),
      },
      providerEvidence: nextProviderEvidence,
    };
    expect(
      validateRarityNamespace({ ...namespace, rolls: [namespace.rolls[0], nextEvidencedRoll] }),
    ).toMatchObject({ ok: true });
    expect(
      validateRarityNamespace({
        ...namespace,
        rolls: [{
          eventId: vector.eventId,
          request: fixture.request,
          outcome: vector.outcome,
          provenance: vector.provenance,
        }, nextEvidencedRoll],
      }),
    ).toMatchObject({ ok: true });
    const retroactivelyAttributed = {
      ...namespace,
      rolls: [{
        ...namespace.rolls[0],
        provenance: vector.provenance,
      }],
    };
    expect(validateRarityNamespace(retroactivelyAttributed)).toMatchObject({ ok: false });
    expect(shippedSchemaViolations(retroactivelyAttributed)).not.toEqual([]);

    for (const [label, invalidEvidence] of [
      ["complete operation", { ...providerEvidence, operation: "complete" }],
      ["Kids profile", { ...providerEvidence, profile: "@sceneaxi/profile-kids" }],
      ["multiline descriptor", {
        ...providerEvidence,
        model: { ...providerEvidence.model, model: "fixture-rarity\nraw-detail" },
      }],
      ["trailing newline descriptor", {
        ...providerEvidence,
        model: { ...providerEvidence.model, provider: "sceneaxi-fixture\n" },
      }],
      ["unbounded descriptor", {
        ...providerEvidence,
        model: {
          ...providerEvidence.model,
          version: "v".repeat(RARITY_PROVIDER_DESCRIPTOR_MAX_CHARS + 1),
        },
      }],
      ["credential-shaped descriptor", {
        ...providerEvidence,
        model: { ...providerEvidence.model, provider: "sk_live_fixture" },
      }],
      ["webhook-secret-shaped descriptor", {
        ...providerEvidence,
        model: { ...providerEvidence.model, provider: "whsec_abcdefgh" },
      }],
      ["slack-token-shaped descriptor", {
        ...providerEvidence,
        model: { ...providerEvidence.model, provider: "xoxb-12345678-abcdefghijklmnop" },
      }],
    ] as const) {
      const invalid = {
        ...namespace,
        rolls: [{ ...namespace.rolls[0], providerEvidence: invalidEvidence }],
      };
      expect(validateRarityNamespace(invalid), label).toMatchObject({ ok: false });
      expect(shippedSchemaViolations(invalid), label).not.toEqual([]);
    }
  });

  it("refuses through the shipped schema what the runtime validators refuse", () => {
    const vector = fixture.vectors[0];
    if (vector === undefined) throw new Error("rarity fixture is empty");
    const withoutTierDraw = Object.fromEntries(
      Object.entries(vector.provenance).filter(([key]) => key !== "tierDraw"),
    );

    for (const [label, value] of [
      ["extra policy property", { ...fixture.policy, extra: true }],
      ["extra provenance property", { ...vector.provenance, extra: "x" }],
      ["missing provenance field", withoutTierDraw],
      ["migrated schemaVersion", { ...fixture.policy, schemaVersion: 2 }],
      ["unknown tier", { ...vector.outcome, tier: "mythic" }],
      ["uppercase candidate id", {
        ...fixture.request,
        candidates: [{ candidateId: "INVALID", tier: "common", weight: 1 }],
      }],
      ["fractional weight", {
        ...fixture.request,
        candidates: [{ candidateId: "fraction", tier: "common", weight: 1.5 }],
      }],
      ["empty candidates", { ...fixture.request, candidates: [] }],
    ] as const) {
      expect(shippedSchemaViolations(value), label).not.toEqual([]);
    }
  });

  it("pins the stable tier identifiers, order, algorithm, and canonical digests", () => {
    expect(RARITY_TIERS).toEqual([
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
    ]);
    expect(RARITY_ALGORITHM_ID).toBe("sceneaxi.rarity.weighted-sha256-v1");
    expect(digestRarityPolicy(fixture.policy)).toBe(
      "sha256:ab1a0d4aee9b7776fe0e93bd065f5d8d06eed6ec7458dfaeb770f6efc0154f26",
    );
    expect(digestRarityRequest(fixture.request)).toBe(
      "sha256:85e2b410d81dc9a0c36837ad676c950e32e3fbeddcb5b1adfde39a95e9e04936",
    );
  });

  it.each([
    ["fractional", 1.5, RARITY_REFUSE_CODES.invalidWeight],
    ["negative", -1, RARITY_REFUSE_CODES.invalidWeight],
    ["non-finite positive", Number.POSITIVE_INFINITY, RARITY_REFUSE_CODES.invalidWeight],
    ["non-finite NaN", Number.NaN, RARITY_REFUSE_CODES.invalidWeight],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1, RARITY_REFUSE_CODES.invalidWeight],
  ])("refuses %s policy weights", (_label, weight, code) => {
    const result = validateRarityPolicy(
      policy({ common: weight, uncommon: 0, rare: 0, epic: 0, legendary: 0 }),
    );
    expect(result).toMatchObject({ ok: false, code });
  });

  it("refuses zero totals and safe-integer total overflow", () => {
    expect(
      validateRarityPolicy(
        policy({ common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }),
      ),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.zeroTotal });
    expect(
      validateRarityPolicy(
        policy({
          common: Number.MAX_SAFE_INTEGER,
          uncommon: 1,
          rare: 0,
          epic: 0,
          legendary: 0,
        }),
      ),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.weightOverflow });
  });

  it("refuses empty, zero-total, duplicate, overflowing, and unavailable candidate pools", () => {
    const base = {
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_REQUEST_KIND,
    } as const;
    expect(validateRarityRollRequest({ ...base, candidates: [] })).toMatchObject({
      ok: false,
      code: RARITY_REFUSE_CODES.emptyInput,
    });
    expect(
      validateRarityRollRequest({
        ...base,
        candidates: [{ candidateId: "only", tier: "common", weight: 0 }],
      }),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.zeroTotal });
    expect(
      validateRarityRollRequest({
        ...base,
        candidates: [
          { candidateId: "same", tier: "common", weight: 1 },
          { candidateId: "same", tier: "common", weight: 1 },
        ],
      }),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.duplicateCandidate });
    expect(
      validateRarityRollRequest({
        ...base,
        candidates: [
          { candidateId: "one", tier: "common", weight: Number.MAX_SAFE_INTEGER },
          { candidateId: "two", tier: "uncommon", weight: 1 },
        ],
      }),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.weightOverflow });
    expect(
      validateRarityRollRequest(
        {
          ...base,
          candidates: [{ candidateId: "only", tier: "common", weight: 1 }],
        },
        fixture.policy,
      ),
    ).toMatchObject({
      ok: false,
      code: RARITY_REFUSE_CODES.candidatePoolUnavailable,
    });
  });

  it.each([
    ["fractional", 0.5],
    ["negative", -1],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["NaN", Number.NaN],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1],
  ])("refuses %s candidate weights", (_label, weight) => {
    expect(
      validateRarityRollRequest({
        schemaVersion: RARITY_SCHEMA_VERSION,
        kind: RARITY_REQUEST_KIND,
        candidates: [{ candidateId: "candidate", tier: "common", weight }],
      }),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.invalidWeight });
  });

  it.each(["seed", "draw", "outcome", "provenance", "providerResponse"])(
    "refuses provider-authored %s authority",
    (field) => {
      const request = { ...fixture.request, [field]: 1 };
      expect(validateRarityRollRequest(request)).toMatchObject({
        ok: false,
        code: RARITY_REFUSE_CODES.providerEntropyForbidden,
      });
    },
  );

  it("validates and canonically serializes the complete project-owned namespace", () => {
    const first = fixture.vectors[0];
    if (first === undefined) throw new Error("rarity fixture is empty");
    const namespace: RarityNamespace = {
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_NAMESPACE_KIND,
      policy: fixture.policy,
      rolls: [
        {
          eventId: first.eventId,
          request: fixture.request,
          outcome: first.outcome,
          provenance: first.provenance,
        },
      ],
    };
    const validated = validateRarityNamespace(namespace);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const serialized = serializeRarityNamespace(validated.value);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(JSON.parse(serialized)).toEqual(namespace);
    expect(serialized.indexOf('"kind"')).toBeLessThan(
      serialized.indexOf('"schemaVersion"'),
    );
  });

  it("refuses schema/version and record-envelope tampering", () => {
    expect(validateRarityPolicy({ ...fixture.policy, schemaVersion: 2 })).toMatchObject({
      ok: false,
      code: RARITY_REFUSE_CODES.schemaVersionMismatch,
    });
    expect(validateRarityPolicy({ ...fixture.policy, kind: "parallel-policy" })).toMatchObject({
      ok: false,
      code: RARITY_REFUSE_CODES.kindMismatch,
    });
    expect(validateRarityPolicy({ ...fixture.policy, extra: true })).toMatchObject({
      ok: false,
      code: RARITY_REFUSE_CODES.unexpectedProperty,
    });
  });

  it("retains exact Model Provider Port evidence and refuses tampered or unbounded input", () => {
    const providerEvidence = {
      schemaVersion: 1,
      kind: "sceneaxi.model-provider-call-evidence",
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model: {
        model: "wayfinder-rarity-fixture",
        provider: "sceneaxi-fixture",
        quantization: "deterministic-json",
        version: "2026-08-09",
      },
    } as const;
    const vector = fixture.vectors[0];
    if (vector === undefined) throw new Error("rarity fixture is empty");
    const evidencedRoll = {
      eventId: vector.eventId,
      request: fixture.request,
      outcome: vector.outcome,
      provenance: {
        ...vector.provenance,
        providerEvidenceDigest: digestRarityValue(providerEvidence as unknown as JsonValue),
      },
      providerEvidence,
    };
    expect(
      validateRarityNamespace({
        schemaVersion: RARITY_SCHEMA_VERSION,
        kind: RARITY_NAMESPACE_KIND,
        policy: fixture.policy,
        rolls: [evidencedRoll],
      }),
    ).toMatchObject({ ok: true, value: { rolls: [{ providerEvidence }] } });
    for (const invalidEvidence of [
      { ...providerEvidence, operation: "complete" },
      { ...providerEvidence, profile: "@sceneaxi/profile-kids" },
      {
        ...providerEvidence,
        model: { ...providerEvidence.model, model: "fixture\nraw-detail" },
      },
      {
        ...providerEvidence,
        model: { ...providerEvidence.model, provider: "sceneaxi-fixture\n" },
      },
      {
        ...providerEvidence,
        model: {
          ...providerEvidence.model,
          version: "v".repeat(RARITY_PROVIDER_DESCRIPTOR_MAX_CHARS + 1),
        },
      },
      {
        ...providerEvidence,
        model: { ...providerEvidence.model, provider: "sk_live_fixture" },
      },
      {
        ...providerEvidence,
        model: { ...providerEvidence.model, provider: "whsec_abcdefgh" },
      },
      {
        ...providerEvidence,
        model: { ...providerEvidence.model, provider: "xoxb-12345678-abcdefghijklmnop" },
      },
    ]) {
      expect(
        validateRarityNamespace({
          schemaVersion: RARITY_SCHEMA_VERSION,
          kind: RARITY_NAMESPACE_KIND,
          policy: fixture.policy,
          rolls: [{ ...evidencedRoll, providerEvidence: invalidEvidence }],
        }),
      ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.provenanceMismatch });
    }
    expect(
      validateRarityNamespace({
        schemaVersion: RARITY_SCHEMA_VERSION,
        kind: RARITY_NAMESPACE_KIND,
        policy: fixture.policy,
        rolls: [{
          ...evidencedRoll,
          providerEvidence: { ...providerEvidence, credential: "must-not-pass" },
        }],
      }),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.provenanceMismatch });
    expect(
      validateRarityRollRequest({
        ...fixture.request,
        candidates: Array.from({ length: 65 }, (_, index) => ({
          candidateId: `bounded-${String(index)}`,
          tier: "common",
          weight: 1,
        })),
      }),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.inputBoundExceeded });
  });

  it("keeps the remaining structural refusal codes reachable", () => {
    expect(validateRarityPolicy(null)).toMatchObject({
      ok: false,
      code: RARITY_REFUSE_CODES.notObject,
    });
    expect(
      validateRarityPolicy({
        schemaVersion: RARITY_SCHEMA_VERSION,
        kind: RARITY_POLICY_KIND,
      }),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.missingProperty });
    expect(
      validateRarityRollRequest({
        schemaVersion: RARITY_SCHEMA_VERSION,
        kind: RARITY_REQUEST_KIND,
        candidates: [{ candidateId: "INVALID", tier: "common", weight: 1 }],
      }),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.invalidIdentifier });

    const vector = fixture.vectors[0];
    if (vector === undefined) throw new Error("rarity fixture is empty");
    const roll = {
      eventId: vector.eventId,
      request: fixture.request,
      outcome: vector.outcome,
      provenance: vector.provenance,
    };
    expect(
      validateRarityNamespace({
        schemaVersion: RARITY_SCHEMA_VERSION,
        kind: RARITY_NAMESPACE_KIND,
        policy: fixture.policy,
        rolls: [roll, roll],
      }),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.duplicateEvent });
  });
});
