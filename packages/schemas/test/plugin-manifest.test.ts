import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PLUGIN_MANIFEST_HOST_API_DIALECT,
  PLUGIN_MANIFEST_PATH,
  PLUGIN_MANIFEST_SCHEMA_URI,
  PLUGIN_MANIFEST_SCHEMA_VERSION,
  contracts,
  inertPluginManifestFixture,
  parsePluginManifestText,
  validatePluginManifest,
} from "@sceneaxi/schemas";

type SchemaSubset = {
  readonly const?: unknown;
  readonly type?: "object" | "array" | "string";
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly properties?: Readonly<Record<string, SchemaSubset>>;
  readonly items?: SchemaSubset;
  readonly pattern?: string;
  readonly uniqueItems?: boolean;
  readonly minLength?: number;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const schemaDefinitionErrors = (schema: unknown) => {
  const errors: string[] = [];
  const supportedKeywords = new Set([
    "$schema",
    "$id",
    "$comment",
    "title",
    "description",
    "const",
    "type",
    "required",
    "additionalProperties",
    "properties",
    "items",
    "pattern",
    "uniqueItems",
    "minLength",
  ]);

  const visit = (candidate: unknown, path: string): void => {
    if (!isPlainObject(candidate)) {
      errors.push(`${path}: expected schema object`);
      return;
    }

    for (const keyword of Object.keys(candidate)) {
      if (!supportedKeywords.has(keyword)) {
        errors.push(`${path}: unsupported keyword ${keyword}`);
      }
    }

    const definition = candidate as SchemaSubset;
    if (
      definition.type !== undefined &&
      !["object", "array", "string"].includes(definition.type)
    ) {
      errors.push(`${path}: unsupported type ${String(definition.type)}`);
    }
    if (
      definition.required !== undefined &&
      (!Array.isArray(definition.required) ||
        !definition.required.every((field) => typeof field === "string"))
    ) {
      errors.push(`${path}: required must be an array of strings`);
    }
    if (
      definition.additionalProperties !== undefined &&
      typeof definition.additionalProperties !== "boolean"
    ) {
      errors.push(`${path}: additionalProperties must be boolean`);
    }
    if (
      definition.uniqueItems !== undefined &&
      typeof definition.uniqueItems !== "boolean"
    ) {
      errors.push(`${path}: uniqueItems must be boolean`);
    }
    if (
      definition.minLength !== undefined &&
      (!Number.isInteger(definition.minLength) || definition.minLength < 0)
    ) {
      errors.push(`${path}: minLength must be a non-negative integer`);
    }
    if (definition.pattern !== undefined) {
      if (typeof definition.pattern !== "string") {
        errors.push(`${path}: pattern must be a string`);
      } else {
        try {
          new RegExp(definition.pattern);
        } catch {
          errors.push(`${path}: pattern must compile`);
        }
      }
    }
    if (
      ["required", "additionalProperties", "properties"].some((keyword) =>
        Object.hasOwn(candidate, keyword),
      ) &&
      definition.type !== "object"
    ) {
      errors.push(`${path}: object keywords require type object`);
    }
    if (
      ["items", "uniqueItems"].some((keyword) =>
        Object.hasOwn(candidate, keyword),
      ) &&
      definition.type !== "array"
    ) {
      errors.push(`${path}: array keywords require type array`);
    }
    if (
      ["pattern", "minLength"].some((keyword) =>
        Object.hasOwn(candidate, keyword),
      ) &&
      definition.type !== "string"
    ) {
      errors.push(`${path}: string keywords require type string`);
    }

    if (Object.hasOwn(candidate, "properties")) {
      if (!isPlainObject(definition.properties)) {
        errors.push(`${path}: properties must be an object`);
      } else {
        for (const [field, propertySchema] of Object.entries(
          definition.properties,
        )) {
          visit(propertySchema, `${path}.properties.${field}`);
        }
      }
    }
    if (Object.hasOwn(candidate, "items")) {
      visit(definition.items, `${path}.items`);
    }
  };

  visit(schema, "$schema");
  return errors;
};

const validateWithSchemaSubset = (value: unknown, schema: SchemaSubset) => {
  const errors: string[] = [];

  const visit = (
    candidate: unknown,
    definition: SchemaSubset,
    path: string,
  ): void => {
    if (
      Object.hasOwn(definition, "const") &&
      !isDeepStrictEqual(candidate, definition.const)
    ) {
      errors.push(`${path}: const mismatch`);
      return;
    }

    if (definition.type === "object") {
      if (!isPlainObject(candidate)) {
        errors.push(`${path}: expected object`);
        return;
      }
      for (const field of definition.required ?? []) {
        if (!Object.hasOwn(candidate, field)) {
          errors.push(`${path}: missing ${field}`);
        }
      }
      const properties = definition.properties ?? {};
      for (const [field, fieldValue] of Object.entries(candidate)) {
        if (Object.hasOwn(properties, field)) {
          visit(fieldValue, properties[field]!, `${path}.${field}`);
        } else if (definition.additionalProperties === false) {
          errors.push(`${path}: unexpected ${field}`);
        }
      }
      return;
    }

    if (definition.type === "array") {
      if (!Array.isArray(candidate)) {
        errors.push(`${path}: expected array`);
        return;
      }
      if (
        definition.uniqueItems === true &&
        candidate.some((item, index) =>
          candidate.slice(0, index).some((prior) => isDeepStrictEqual(prior, item)),
        )
      ) {
        errors.push(`${path}: expected unique items`);
      }
      if (definition.items !== undefined) {
        candidate.forEach((item, index) =>
          visit(item, definition.items!, `${path}[${index}]`),
        );
      }
      return;
    }

    if (definition.type === "string") {
      if (typeof candidate !== "string") {
        errors.push(`${path}: expected string`);
        return;
      }
      if (
        definition.minLength !== undefined &&
        [...candidate].length < definition.minLength
      ) {
        errors.push(`${path}: shorter than minLength`);
      }
      if (
        definition.pattern !== undefined &&
        !new RegExp(definition.pattern).test(candidate)
      ) {
        errors.push(`${path}: pattern mismatch`);
      }
    }
  };

  visit(value, schema, "$manifest");
  return errors;
};

const pluginManifestSchema = JSON.parse(
  readFileSync(
    fileURLToPath(
      import.meta.resolve(
        "@sceneaxi/schemas/contracts/plugin-manifest.schema.json",
      ),
    ),
    "utf8",
  ),
) as SchemaSubset & { readonly $id?: string };

const requiredManifestFields = [
  "$schema",
  "schemaVersion",
  "pluginId",
  "pluginVersion",
  "hostApi",
  "registryVersion",
  "entrypoint",
  "capabilities",
] as const;

const missingRequiredFieldCases = requiredManifestFields.map((field) => {
  const value: Record<string, unknown> = {
    ...inertPluginManifestFixture(),
  };
  delete value[field];
  return {
    field,
    name: `missing required field ${field}`,
    value,
    valid: false,
  };
});

const manifestCorpus: ReadonlyArray<{
  readonly name: string;
  readonly value: unknown;
  readonly valid: boolean;
}> = [
  {
    name: "documented inert fixture",
    value: inertPluginManifestFixture(),
    valid: true,
  },
  {
    name: "space-separated comparator terms and opaque capabilities",
    value: {
      ...inertPluginManifestFixture(),
      hostApi: ">=1.0.0 <2.0.0",
      capabilities: ["Renderer/V2 + Experimental", "urn:sceneaxi:CAPABILITY#1"],
    },
    valid: true,
  },
  {
    name: "OR-joined ranges",
    value: { ...inertPluginManifestFixture(), hostApi: "^1.0.0 || ^2.0.0" },
    valid: true,
  },
  {
    name: "exact-core hyphen range",
    value: { ...inertPluginManifestFixture(), hostApi: "1.2.3 - 2.3.4" },
    valid: true,
  },
  {
    name: "x-range OR comparator set",
    value: {
      ...inertPluginManifestFixture(),
      hostApi: "1.2.x || >=2.0.0 <3.0.0",
    },
    valid: true,
  },
  { name: "non-object", value: null, valid: false },
  ...missingRequiredFieldCases,
  {
    name: "unexpected field",
    value: { ...inertPluginManifestFixture(), hooks: ["onLoad"] },
    valid: false,
  },
  {
    name: "wrong schema URI",
    value: { ...inertPluginManifestFixture(), $schema: "wrong" },
    valid: false,
  },
  {
    name: "wrong schema version",
    value: { ...inertPluginManifestFixture(), schemaVersion: "2.0.0" },
    valid: false,
  },
  {
    name: "bad plugin identity",
    value: { ...inertPluginManifestFixture(), pluginId: "Not A Valid Id" },
    valid: false,
  },
  {
    name: "plugin identity trailing newline",
    value: {
      ...inertPluginManifestFixture(),
      pluginId: "dev.sceneaxi.plugin\n",
    },
    valid: false,
  },
  {
    name: "bad plugin version",
    value: { ...inertPluginManifestFixture(), pluginVersion: "v1" },
    valid: false,
  },
  {
    name: "host API garbage",
    value: { ...inertPluginManifestFixture(), hostApi: "latest!!!" },
    valid: false,
  },
  {
    name: "host API partial core",
    value: { ...inertPluginManifestFixture(), hostApi: "1.2" },
    valid: false,
  },
  {
    name: "host API malformed OR",
    value: { ...inertPluginManifestFixture(), hostApi: "^1.0.0||^2.0.0" },
    valid: false,
  },
  {
    name: "host API x-range hyphen",
    value: { ...inertPluginManifestFixture(), hostApi: "1.2.x - 2.0.0" },
    valid: false,
  },
  {
    name: "host API trailing newline",
    value: { ...inertPluginManifestFixture(), hostApi: "^1.0.0\n" },
    valid: false,
  },
  {
    name: "bad registry version",
    value: { ...inertPluginManifestFixture(), registryVersion: "v1" },
    valid: false,
  },
  {
    name: "absolute entrypoint",
    value: { ...inertPluginManifestFixture(), entrypoint: "/plugin.js" },
    valid: false,
  },
  {
    name: "entrypoint trailing newline",
    value: { ...inertPluginManifestFixture(), entrypoint: "plugin.js\n" },
    valid: false,
  },
  {
    name: "capabilities not an array",
    value: { ...inertPluginManifestFixture(), capabilities: "capability" },
    valid: false,
  },
  {
    name: "non-string capability",
    value: { ...inertPluginManifestFixture(), capabilities: [1] },
    valid: false,
  },
  {
    name: "empty capability",
    value: { ...inertPluginManifestFixture(), capabilities: [""] },
    valid: false,
  },
  {
    name: "capability trailing newline",
    value: { ...inertPluginManifestFixture(), capabilities: ["opaque\n"] },
    valid: false,
  },
  {
    name: "duplicate capability",
    value: { ...inertPluginManifestFixture(), capabilities: ["opaque", "opaque"] },
    valid: false,
  },
];

describe("plugin manifest contract", () => {
  it("keeps the TypeScript validator aligned with the JSON Schema corpus", () => {
    expect(schemaDefinitionErrors(pluginManifestSchema)).toEqual([]);
    expect(pluginManifestSchema.required).toEqual(requiredManifestFields);

    for (const testCase of manifestCorpus) {
      const validatorAccepted = validatePluginManifest(testCase.value).ok;
      const schemaAccepted =
        validateWithSchemaSubset(testCase.value, pluginManifestSchema).length === 0;

      expect(
        { validatorAccepted, schemaAccepted },
        testCase.name,
      ).toEqual({
        validatorAccepted: testCase.valid,
        schemaAccepted: testCase.valid,
      });
    }
  });

  it.each(missingRequiredFieldCases)(
    "refuses missing required field $field consistently",
    ({ field, value }) => {
      const result = validatePluginManifest(value);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "missing-field",
          path: `$.${field}`,
        }),
      );
      expect(
        validateWithSchemaSubset(value, pluginManifestSchema),
      ).not.toEqual([]);
    },
  );

  it("accepts the documented inert capabilities:[] fixture", () => {
    const fixture = inertPluginManifestFixture();
    const result = validatePluginManifest(fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest).toEqual(fixture);
    expect(result.manifest.capabilities).toEqual([]);
    expect(parsePluginManifestText(JSON.stringify(fixture))).toEqual(result);
  });

  it("accepts a valid manifest with unique capability IDs", () => {
    const result = validatePluginManifest({
      ...inertPluginManifestFixture(),
      capabilities: ["Renderer/V2 + Experimental", "urn:sceneaxi:CAPABILITY#1"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.capabilities).toEqual([
      "Renderer/V2 + Experimental",
      "urn:sceneaxi:CAPABILITY#1",
    ]);
  });

  it("ships the public versioned JSON Schema and rejects unknown properties", () => {
    expect(contracts.pluginManifest).toBe("contracts/plugin-manifest.schema.json");
    expect(PLUGIN_MANIFEST_PATH).toBe("sceneaxi.plugin.manifest.json");
    expect(PLUGIN_MANIFEST_SCHEMA_VERSION).toBe("1.0.0");
    expect(PLUGIN_MANIFEST_HOST_API_DIALECT).toContain('OR uses " || "');
    expect(PLUGIN_MANIFEST_SCHEMA_URI).toBe(
      "https://sceneaxi.dev/schemas/plugin-manifest-1.0.0.json",
    );

    expect(pluginManifestSchema.$id).toBe(
      "https://sceneaxi.invalid/contracts/plugin-manifest/v1",
    );
    expect(pluginManifestSchema.additionalProperties).toBe(false);
    expect(pluginManifestSchema.properties?.schemaVersion?.const).toBe("1.0.0");
    expect(pluginManifestSchema.properties?.capabilities?.uniqueItems).toBe(
      true,
    );
    expect(pluginManifestSchema.required).toEqual(requiredManifestFields);
  });

  it("refuses unknown properties (hooks / ports / extra fields)", () => {
    const result = validatePluginManifest({
      ...inertPluginManifestFixture(),
      hooks: ["onLoad"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "unexpected-field",
        path: "$.hooks",
      }),
    );
  });

  it("refuses unsupported schemaVersion without silent migration", () => {
    const result = validatePluginManifest({
      ...inertPluginManifestFixture(),
      schemaVersion: "2.0.0",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "schema-version-mismatch",
        path: "$.schemaVersion",
        foundSchemaVersion: "2.0.0",
      }),
    );
  });

  it("refuses bad pluginId", () => {
    const result = validatePluginManifest({
      ...inertPluginManifestFixture(),
      pluginId: "Not A Valid Id",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "invalid-field",
        path: "$.pluginId",
      }),
    );
  });

  it("refuses invalid pluginVersion and hostApi ranges", () => {
    const badVersion = validatePluginManifest({
      ...inertPluginManifestFixture(),
      pluginVersion: "not-a-semver",
    });
    expect(badVersion.ok).toBe(false);
    if (!badVersion.ok) {
      expect(badVersion.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "invalid-field",
          path: "$.pluginVersion",
        }),
      );
    }

    const badRange = validatePluginManifest({
      ...inertPluginManifestFixture(),
      hostApi: "latest!!!",
    });
    expect(badRange.ok).toBe(false);
    if (!badRange.ok) {
      expect(badRange.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "invalid-field",
          path: "$.hostApi",
        }),
      );
    }

    const badRegistry = validatePluginManifest({
      ...inertPluginManifestFixture(),
      registryVersion: "v1",
    });
    expect(badRegistry.ok).toBe(false);
    if (!badRegistry.ok) {
      expect(badRegistry.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "invalid-field",
          path: "$.registryVersion",
        }),
      );
    }
  });

  it("refuses absolute or escaping entrypoints", () => {
    for (const entrypoint of [
      "/abs/plugin.js",
      "../escape.js",
      "./foo/../../escape.js",
      "C:\\windows\\plugin.js",
      "",
    ]) {
      const result = validatePluginManifest({
        ...inertPluginManifestFixture(),
        entrypoint,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.diagnostics[0]).toEqual(
          expect.objectContaining({
            code: "invalid-field",
            path: "$.entrypoint",
          }),
        );
      }
    }
  });

  it("refuses duplicate capability IDs", () => {
    const result = validatePluginManifest({
      ...inertPluginManifestFixture(),
      capabilities: [
        "dev.sceneaxi.capability.alpha",
        "dev.sceneaxi.capability.alpha",
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "duplicate-capability",
        path: "$.capabilities[1]",
      }),
    );
  });

  it("refuses missing required fields and non-objects", () => {
    const missing: Record<string, unknown> = { ...inertPluginManifestFixture() };
    delete missing["pluginId"];
    const missingResult = validatePluginManifest(missing);
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "missing-field",
          path: "$.pluginId",
        }),
      );
    }

    const notObject = validatePluginManifest(null);
    expect(notObject.ok).toBe(false);
    if (!notObject.ok) {
      expect(notObject.diagnostics[0]?.code).toBe("not-object");
    }

    const parseFail = parsePluginManifestText("{not-json");
    expect(parseFail.ok).toBe(false);
    if (!parseFail.ok) {
      expect(parseFail.diagnostics[0]?.code).toBe("parse-error");
    }
  });
});
