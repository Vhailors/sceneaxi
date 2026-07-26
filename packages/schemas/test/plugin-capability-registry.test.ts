import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_PATH,
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI,
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION,
  PLUGIN_CAPABILITY_REGISTRY_SEED_PATH,
  PLUGIN_CAPABILITY_REGISTRY_VERSION,
  SHIPPED_PLUGIN_CAPABILITY_IDS,
  contracts,
  pluginCapabilityRegistrySeed,
  lookupPluginCapability,
  parsePluginCapabilityRegistryText,
  validatePluginCapabilityRegistry,
  type PluginCapabilityRegistry,
  type PluginCapabilityRegistryEntry,
} from "@sceneaxi/schemas";

type SchemaSubset = {
  readonly const?: unknown;
  readonly type?: "object" | "array" | "string";
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly properties?: Readonly<Record<string, SchemaSubset>>;
  readonly items?: SchemaSubset;
  readonly pattern?: string;
  readonly minLength?: number;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

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
        const fieldDefinition = properties[field];
        if (Object.hasOwn(properties, field) && fieldDefinition !== undefined) {
          visit(fieldValue, fieldDefinition, `${path}.${field}`);
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
      const itemDefinition = definition.items;
      if (itemDefinition !== undefined) {
        candidate.forEach((item, index) =>
          visit(item, itemDefinition, `${path}[${index}]`),
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

  visit(value, schema, "$registry");
  return errors;
};

const registrySchema = JSON.parse(
  readFileSync(
    fileURLToPath(
      import.meta.resolve(
        "@sceneaxi/schemas/contracts/plugin-capability-registry.schema.json",
      ),
    ),
    "utf8",
  ),
) as SchemaSubset & { readonly $id?: string; readonly additionalProperties?: boolean };

const seedArtifact = JSON.parse(
  readFileSync(
    fileURLToPath(
      import.meta.resolve(
        "@sceneaxi/schemas/contracts/plugin-capability-registry.1.0.0.json",
      ),
    ),
    "utf8",
  ),
) as unknown;

const sampleEntry = (): PluginCapabilityRegistryEntry => ({
  capabilityId: "dev.sceneaxi.capability.example.alpha",
  contractRef: "@sceneaxi/schemas/contracts/plugin-manifest.schema.json",
  contractVersion: "1.0.0",
  owningPackage: "@sceneaxi/schemas",
  documentationRef: "docs/plugins.md",
});

const registryWith = (
  entries: readonly PluginCapabilityRegistryEntry[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  ...pluginCapabilityRegistrySeed(),
  entries: [...entries],
  ...overrides,
});

/** Names that must never appear as seeded engine-internal ports. */
const FORBIDDEN_SEED_SUBSTRINGS = [
  "renderer",
  "physics",
  "storage",
  "hook",
  "engine-internal",
  "service-locator",
] as const;

describe("plugin capability registry contract", () => {
  it("ships the public schema path and 1.0.0 seed artifact", () => {
    expect(contracts.pluginCapabilityRegistry).toBe(
      "contracts/plugin-capability-registry.schema.json",
    );
    expect(PLUGIN_CAPABILITY_REGISTRY_SCHEMA_PATH).toBe(
      "contracts/plugin-capability-registry.schema.json",
    );
    expect(PLUGIN_CAPABILITY_REGISTRY_SEED_PATH).toBe(
      "contracts/plugin-capability-registry.1.0.0.json",
    );
    expect(PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION).toBe("1.0.0");
    expect(PLUGIN_CAPABILITY_REGISTRY_VERSION).toBe("1.0.0");
    expect(PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI).toBe(
      "https://sceneaxi.dev/schemas/plugin-capability-registry-1.0.0.json",
    );
    expect(registrySchema.$id).toBe(
      "https://sceneaxi.invalid/contracts/plugin-capability-registry/v1",
    );
    expect(registrySchema.additionalProperties).toBe(false);
  });

  it("accepts the checked-in seed and keeps TypeScript fixture in lockstep", () => {
    const seed = pluginCapabilityRegistrySeed();
    const fromArtifact = validatePluginCapabilityRegistry(seedArtifact, {
      expectedRegistryVersion: PLUGIN_CAPABILITY_REGISTRY_VERSION,
    });
    const fromFixture = validatePluginCapabilityRegistry(seed, {
      expectedRegistryVersion: PLUGIN_CAPABILITY_REGISTRY_VERSION,
    });

    expect(fromArtifact.ok).toBe(true);
    expect(fromFixture.ok).toBe(true);
    if (!fromArtifact.ok || !fromFixture.ok) return;

    expect(fromArtifact.registry.entries.map((e) => e.capabilityId)).toEqual([
      ...SHIPPED_PLUGIN_CAPABILITY_IDS,
    ]);
    expect(fromFixture.registry.entries.map((e) => e.capabilityId)).toEqual([
      ...SHIPPED_PLUGIN_CAPABILITY_IDS,
    ]);
    expect(fromArtifact.registry).toEqual(seed);
    expect(fromFixture.registry).toEqual(seed);
    expect(seedArtifact).toEqual(seed);
    expect(
      validateWithSchemaSubset(seedArtifact, registrySchema),
    ).toEqual([]);
    expect(
      parsePluginCapabilityRegistryText(JSON.stringify(seedArtifact), {
        expectedRegistryVersion: "1.0.0",
      }),
    ).toEqual(fromArtifact);
  });

  it("proves no renderer, physics, storage, hook, or engine-internal port is seeded", () => {
    const seed = pluginCapabilityRegistrySeed();
    expect(seed.entries.length).toBe(SHIPPED_PLUGIN_CAPABILITY_IDS.length);

    const serialized = JSON.stringify(seedArtifact).toLowerCase();
    for (const forbidden of FORBIDDEN_SEED_SUBSTRINGS) {
      expect(serialized.includes(forbidden), forbidden).toBe(false);
    }
    for (const entry of seed.entries) {
      const haystack = JSON.stringify(entry).toLowerCase();
      for (const forbidden of FORBIDDEN_SEED_SUBSTRINGS) {
        expect(haystack.includes(forbidden), forbidden).toBe(false);
      }
    }
  });

  it("accepts a well-formed non-empty registry used only in tests (not the seed)", () => {
    const value = registryWith([sampleEntry()]);
    const result = validatePluginCapabilityRegistry(value);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.registry.entries).toEqual([sampleEntry()]);
    expect(validateWithSchemaSubset(value, registrySchema)).toEqual([]);
  });

  it.each([
    "https://sceneaxi.dev/contracts/a%20b",
    "https://sceneaxi.dev/contracts/a?q=%2F#v%31",
  ])("accepts valid HTTPS percent escapes in %s", (contractRef) => {
    const value = registryWith([{ ...sampleEntry(), contractRef }]);

    expect(validatePluginCapabilityRegistry(value).ok).toBe(true);
    expect(validateWithSchemaSubset(value, registrySchema)).toEqual([]);
  });

  it("lookup is exact and deterministic; unknown IDs return a typed miss", () => {
    const entryA = sampleEntry();
    const entryB: PluginCapabilityRegistryEntry = {
      ...sampleEntry(),
      capabilityId: "dev.sceneaxi.capability.example.beta",
      contractRef: "contracts/plugin-manifest.schema.json",
      documentationRef: "https://sceneaxi.dev/docs/plugins",
    };
    const validated = validatePluginCapabilityRegistry(
      registryWith([entryB, entryA]),
    );
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const registry: PluginCapabilityRegistry = validated.registry;

    expect(lookupPluginCapability(registry, entryA.capabilityId)).toEqual({
      ok: true,
      capabilityId: entryA.capabilityId,
      entry: entryA,
    });
    expect(lookupPluginCapability(registry, entryB.capabilityId)).toEqual({
      ok: true,
      capabilityId: entryB.capabilityId,
      entry: entryB,
    });

    const miss = lookupPluginCapability(
      registry,
      "dev.sceneaxi.capability.absent",
    );
    expect(miss).toEqual({
      ok: false,
      capabilityId: "dev.sceneaxi.capability.absent",
      reason: "unknown-capability",
    });

    // Empty seed: every lookup is a typed miss.
    const seed = pluginCapabilityRegistrySeed();
    expect(lookupPluginCapability(seed, "anything")).toEqual({
      ok: false,
      capabilityId: "anything",
      reason: "unknown-capability",
    });
  });

  it("refuses duplicate capability IDs", () => {
    const result = validatePluginCapabilityRegistry(
      registryWith([sampleEntry(), sampleEntry()]),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "duplicate-capability-id",
        path: "$.entries[1].capabilityId",
      }),
    );
  });

  it("refuses malformed contract references", () => {
    for (const contractRef of [
      "",
      "not a ref",
      "ftp://example.com/contract",
      "../private/port.ts",
      "engine/internal/renderer",
      "@sceneaxi/schemas/../../engine/private",
      "@sceneaxi/schemas/contracts//private",
      "@sceneaxi/schemas/contracts/",
      "contracts/a//private.schema.json",
      "contracts/a/../private.schema.json",
      "contracts/a/",
      "https://sceneaxi.dev/contracts//private",
      "https://sceneaxi.dev/contracts/../private",
      "https://sceneaxi.dev/contracts/",
      "https://sceneaxi.dev/contracts/a%",
      "https://sceneaxi.dev/contracts/a?q=%ZZ",
    ]) {
      const value = registryWith([{ ...sampleEntry(), contractRef }]);
      const result = validatePluginCapabilityRegistry(value);
      expect(result.ok, contractRef).toBe(false);
      expect(
        validateWithSchemaSubset(value, registrySchema),
        contractRef,
      ).not.toEqual([]);
      if (!result.ok) {
        expect(result.diagnostics[0]).toEqual(
          expect.objectContaining({
            code: "invalid-field",
            path: "$.entries[0].contractRef",
          }),
        );
      }
    }
  });

  it("refuses unknown fields at registry and entry level", () => {
    const top = validatePluginCapabilityRegistry({
      ...pluginCapabilityRegistrySeed(),
      hooks: ["onLoad"],
    });
    expect(top.ok).toBe(false);
    if (!top.ok) {
      expect(top.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "unexpected-field",
          path: "$.hooks",
        }),
      );
    }

    const entry = validatePluginCapabilityRegistry(
      registryWith([{ ...sampleEntry(), port: "renderer" } as never]),
    );
    expect(entry.ok).toBe(false);
    if (!entry.ok) {
      expect(entry.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "unexpected-field",
          path: "$.entries[0].port",
        }),
      );
    }
  });

  it("refuses schema-version mismatch and registry-version drift", () => {
    const schemaMismatch = validatePluginCapabilityRegistry({
      ...pluginCapabilityRegistrySeed(),
      schemaVersion: "2.0.0",
    });
    expect(schemaMismatch.ok).toBe(false);
    if (!schemaMismatch.ok) {
      expect(schemaMismatch.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "schema-version-mismatch",
          path: "$.schemaVersion",
          foundSchemaVersion: "2.0.0",
        }),
      );
    }

    const drift = validatePluginCapabilityRegistry(
      {
        ...pluginCapabilityRegistrySeed(),
        registryVersion: "1.0.1",
      },
      { expectedRegistryVersion: "1.0.0" },
    );
    expect(drift.ok).toBe(false);
    if (!drift.ok) {
      expect(drift.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "registry-version-drift",
          path: "$.registryVersion",
          foundRegistryVersion: "1.0.1",
        }),
      );
    }
  });

  it("refuses missing required fields, non-objects, and parse errors", () => {
    const missing: Record<string, unknown> = {
      ...pluginCapabilityRegistrySeed(),
    };
    delete missing["entries"];
    const missingResult = validatePluginCapabilityRegistry(missing);
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.diagnostics[0]).toEqual(
        expect.objectContaining({
          code: "missing-field",
          path: "$.entries",
        }),
      );
    }

    const notObject = validatePluginCapabilityRegistry(null);
    expect(notObject.ok).toBe(false);
    if (!notObject.ok) {
      expect(notObject.diagnostics[0]?.code).toBe("not-object");
    }

    const parseFail = parsePluginCapabilityRegistryText("{not-json");
    expect(parseFail.ok).toBe(false);
    if (!parseFail.ok) {
      expect(parseFail.diagnostics[0]?.code).toBe("parse-error");
    }
  });

  it("refuses bad owningPackage, contractVersion, and documentationRef", () => {
    const badPackage = validatePluginCapabilityRegistry(
      registryWith([{ ...sampleEntry(), owningPackage: "unscoped" }]),
    );
    expect(badPackage.ok).toBe(false);
    if (!badPackage.ok) {
      expect(badPackage.diagnostics[0]?.path).toBe("$.entries[0].owningPackage");
    }

    const badVersion = validatePluginCapabilityRegistry(
      registryWith([{ ...sampleEntry(), contractVersion: "v1" }]),
    );
    expect(badVersion.ok).toBe(false);
    if (!badVersion.ok) {
      expect(badVersion.diagnostics[0]?.path).toBe(
        "$.entries[0].contractVersion",
      );
    }

    const badDocs = validatePluginCapabilityRegistry(
      registryWith([{ ...sampleEntry(), documentationRef: "readme.txt" }]),
    );
    expect(badDocs.ok).toBe(false);
    if (!badDocs.ok) {
      expect(badDocs.diagnostics[0]?.path).toBe(
        "$.entries[0].documentationRef",
      );
    }
  });
});
