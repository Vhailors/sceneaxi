import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PLUGIN_MANIFEST_PATH,
  PLUGIN_MANIFEST_SCHEMA_URI,
  PLUGIN_MANIFEST_SCHEMA_VERSION,
  contracts,
  inertPluginManifestFixture,
  parsePluginManifestText,
  validatePluginManifest,
} from "@sceneaxi/schemas";

describe("plugin manifest contract", () => {
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
      capabilities: ["dev.sceneaxi.capability.alpha", "dev.sceneaxi.capability.beta"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.capabilities).toEqual([
      "dev.sceneaxi.capability.alpha",
      "dev.sceneaxi.capability.beta",
    ]);
  });

  it("ships the public versioned JSON Schema and rejects unknown properties", () => {
    expect(contracts.pluginManifest).toBe("contracts/plugin-manifest.schema.json");
    expect(PLUGIN_MANIFEST_PATH).toBe("sceneaxi.plugin.manifest.json");
    expect(PLUGIN_MANIFEST_SCHEMA_VERSION).toBe("1.0.0");
    expect(PLUGIN_MANIFEST_SCHEMA_URI).toBe(
      "https://sceneaxi.dev/schemas/plugin-manifest-1.0.0.json",
    );

    const schema = JSON.parse(
      readFileSync(
        fileURLToPath(
          import.meta.resolve(
            "@sceneaxi/schemas/contracts/plugin-manifest.schema.json",
          ),
        ),
        "utf8",
      ),
    ) as {
      $id?: string;
      additionalProperties?: boolean;
      required?: string[];
      properties?: {
        schemaVersion?: { const?: string };
        capabilities?: { uniqueItems?: boolean };
      };
    };

    expect(schema.$id).toBe(
      "https://sceneaxi.invalid/contracts/plugin-manifest/v1",
    );
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties?.schemaVersion?.const).toBe("1.0.0");
    expect(schema.properties?.capabilities?.uniqueItems).toBe(true);
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "$schema",
        "schemaVersion",
        "pluginId",
        "pluginVersion",
        "hostApi",
        "registryVersion",
        "entrypoint",
        "capabilities",
      ]),
    );
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
