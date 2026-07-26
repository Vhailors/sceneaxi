import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docRelativePath = join("docs", "authoring-contracts.md");
const fixturesRelativePath = join("packages", "schemas", "contracts", "authoring-jobs.fixtures.json");
const schemaRelativePath = join("packages", "schemas", "contracts", "authoring-jobs.schema.json");
const pluginRegistrySchemaRelativePath = join(
  "packages",
  "schemas",
  "contracts",
  "plugin-capability-registry.schema.json",
);
const pluginRegistrySeedRelativePath = join(
  "packages",
  "schemas",
  "contracts",
  "plugin-capability-registry.1.0.0.json",
);
const pluginsDocRelativePath = join("docs", "plugins.md");
const schemasReadmeRelativePath = join("packages", "schemas", "README.md");
const pluginManifestSchemaRelativePath = join(
  "packages",
  "schemas",
  "contracts",
  "plugin-manifest.schema.json",
);
const pluginManifestInertExampleRelativePath = join(
  "packages",
  "schemas",
  "contracts",
  "plugin-manifest.inert.example.json",
);
const checkerRelativePath = join("scripts", "check-contracts.mjs");
const sourcePaths = [
  docRelativePath,
  fixturesRelativePath,
  schemaRelativePath,
  pluginRegistrySchemaRelativePath,
  pluginRegistrySeedRelativePath,
  pluginManifestSchemaRelativePath,
  pluginManifestInertExampleRelativePath,
  pluginsDocRelativePath,
  schemasReadmeRelativePath,
  checkerRelativePath,
];

const createSandbox = () => {
  const sandbox = mkdtempSync(join(root, ".check-contracts-test-"));
  for (const relativePath of sourcePaths) {
    const destination = join(sandbox, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(root, relativePath), destination);
  }
  return sandbox;
};

const runChecker = (sandbox) =>
  spawnSync(process.execPath, [join(sandbox, checkerRelativePath)], {
    cwd: sandbox,
    encoding: "utf8",
  });

const readDoc = (sandbox) => readFileSync(join(sandbox, docRelativePath), "utf8");
const writeDoc = (sandbox, doc) => writeFileSync(join(sandbox, docRelativePath), doc);
const readSchema = (sandbox) => JSON.parse(readFileSync(join(sandbox, schemaRelativePath), "utf8"));
const readFixtures = (sandbox) => JSON.parse(readFileSync(join(sandbox, fixturesRelativePath), "utf8"));
const writeFixtures = (sandbox, fixtures) =>
  writeFileSync(join(sandbox, fixturesRelativePath), `${JSON.stringify(fixtures, null, 2)}\n`);
const writeRawJson = (sandbox, relativePath, value) =>
  writeFileSync(join(sandbox, relativePath), `${JSON.stringify(value)}\n`);
const readPluginRegistrySeed = (sandbox) =>
  JSON.parse(readFileSync(join(sandbox, pluginRegistrySeedRelativePath), "utf8"));
const writePluginRegistrySeed = (sandbox, seed) =>
  writeFileSync(join(sandbox, pluginRegistrySeedRelativePath), `${JSON.stringify(seed, null, 2)}\n`);
const readPluginsDoc = (sandbox) => readFileSync(join(sandbox, pluginsDocRelativePath), "utf8");
const writePluginsDoc = (sandbox, doc) => writeFileSync(join(sandbox, pluginsDocRelativePath), doc);
const readSchemasReadme = (sandbox) =>
  readFileSync(join(sandbox, schemasReadmeRelativePath), "utf8");
const writeSchemasReadme = (sandbox, doc) =>
  writeFileSync(join(sandbox, schemasReadmeRelativePath), doc);
const readPluginManifestInertExample = (sandbox) =>
  JSON.parse(readFileSync(join(sandbox, pluginManifestInertExampleRelativePath), "utf8"));
const writePluginManifestInertExample = (sandbox, example) =>
  writeFileSync(
    join(sandbox, pluginManifestInertExampleRelativePath),
    `${JSON.stringify(example, null, 2)}\n`,
  );
const readPluginManifestSchema = (sandbox) =>
  JSON.parse(readFileSync(join(sandbox, pluginManifestSchemaRelativePath), "utf8"));
const writePluginManifestSchema = (sandbox, schema) =>
  writeFileSync(
    join(sandbox, pluginManifestSchemaRelativePath),
    `${JSON.stringify(schema, null, 2)}\n`,
  );
const registrySeedState =
  "Registry seed state: `registryVersion` is `1.0.0`; `entries` holds exactly 1 reviewed capability ID: `sceneaxi.sculpt.intake-source.v1`.";
const inertExampleStart = "<!-- plugin-manifest:inert-example -->";
const inertExampleEnd = "<!-- /plugin-manifest:inert-example -->";

const cases = [
  {
    name: "accepts the canonical contracts",
    expectedStatus: 0,
    expectedOutput: "contract check OK",
  },
  {
    name: "rejects fixture title drift",
    mutate(sandbox) {
      writeDoc(sandbox, readDoc(sandbox).replace("Move/rotate an entity", "Move or rotate an entity"));
    },
    expectedOutput: "id, title/job, and edit class columns in order",
  },
  {
    name: "rejects fixture edit-class drift",
    mutate(sandbox) {
      writeDoc(sandbox, readDoc(sandbox).replace("| `move-rotate-entity` | Move/rotate an entity | transform |", "| `move-rotate-entity` | Move/rotate an entity | layout |"));
    },
    expectedOutput: "id, title/job, and edit class columns in order",
  },
  {
    name: "rejects an E1 marker in the E2 section",
    mutate(sandbox) {
      const marker = "<!-- authoring-jobs:bind E1 -->";
      const e2Marker = "<!-- authoring-jobs:bind E2 -->";
      writeDoc(sandbox, readDoc(sandbox).replace(marker, "").replace(e2Marker, `${e2Marker}\n${marker}`));
    },
    expectedOutput: "must appear after the E1 heading and before the E2 heading",
  },
  {
    name: "rejects an E2 marker in the E1 section",
    mutate(sandbox) {
      const marker = "<!-- authoring-jobs:bind E2 -->";
      const e1Marker = "<!-- authoring-jobs:bind E1 -->";
      writeDoc(sandbox, readDoc(sandbox).replace(marker, "").replace(e1Marker, `${e1Marker}\n${marker}`));
    },
    expectedOutput: "must appear after the E2 heading and before the shared fixture list heading",
  },
  {
    name: "rejects a duplicate bind marker",
    mutate(sandbox) {
      const marker = "<!-- authoring-jobs:bind E1 -->";
      writeDoc(sandbox, readDoc(sandbox).replace(marker, `${marker}\n${marker}`));
    },
    expectedOutput: "expected exactly one <!-- authoring-jobs:bind E1 --> marker, found 2",
  },
  {
    name: "rejects a missing bind marker",
    mutate(sandbox) {
      writeDoc(sandbox, readDoc(sandbox).replace("<!-- authoring-jobs:bind E2 -->", ""));
    },
    expectedOutput: "expected exactly one <!-- authoring-jobs:bind E2 --> marker, found 0",
  },
  {
    name: "rejects a duplicate fixture id",
    mutate(sandbox) {
      const fixtures = readFixtures(sandbox);
      fixtures.jobs[1].id = fixtures.jobs[0].id;
      writeFixtures(sandbox, fixtures);
    },
    expectedOutput: "duplicate job id(s)",
  },
  {
    name: "rejects an extra fixture property",
    mutate(sandbox) {
      const fixtures = readFixtures(sandbox);
      fixtures.jobs[0].unexpected = true;
      writeFixtures(sandbox, fixtures);
    },
    expectedOutput: "unexpected property",
  },
  {
    name: "rejects a null schema",
    mutate(sandbox) {
      writeRawJson(sandbox, schemaRelativePath, null);
    },
    expectedOutput: "authoring-jobs.schema.json: expected a plain JSON object",
  },
  {
    name: "distinguishes a malformed schema from a non-object schema",
    mutate(sandbox) {
      writeFileSync(join(sandbox, schemaRelativePath), "{");
    },
    expectedOutput: "cannot load packages/schemas/contracts/authoring-jobs.schema.json",
  },
  {
    name: "rejects null fixtures",
    mutate(sandbox) {
      writeRawJson(sandbox, fixturesRelativePath, null);
    },
    expectedOutput: "authoring-jobs.fixtures.json: expected a plain JSON object",
  },
  {
    name: "rejects array fixtures",
    mutate(sandbox) {
      writeRawJson(sandbox, fixturesRelativePath, []);
    },
    expectedOutput: "authoring-jobs.fixtures.json: expected a plain JSON object",
  },
  {
    name: "rejects a whitespace-only contract document",
    mutate(sandbox) {
      writeDoc(sandbox, " \n\t\n");
    },
    expectedOutput: "authoring-contracts.md: document is empty or whitespace-only",
  },
  {
    name: "rejects an unsupported root schema keyword",
    mutate(sandbox) {
      const schema = readSchema(sandbox);
      schema.maxItems = 5;
      writeRawJson(sandbox, schemaRelativePath, schema);
    },
    expectedOutput: 'schema: unsupported JSON Schema keyword "maxItems"',
  },
  {
    name: "rejects an unsupported nested schema keyword",
    mutate(sandbox) {
      const schema = readSchema(sandbox);
      schema.properties.jobs.items.properties.title.maxLength = 1;
      writeRawJson(sandbox, schemaRelativePath, schema);
    },
    expectedOutput: 'schema.properties.jobs.items.properties.title: unsupported JSON Schema keyword "maxLength"',
  },
  {
    name: "allows property names that resemble schema keywords",
    mutate(sandbox) {
      const schema = readSchema(sandbox);
      const fixtures = readFixtures(sandbox);
      schema.properties.maxItems = { type: "string" };
      fixtures.maxItems = "fixture property";
      writeRawJson(sandbox, schemaRelativePath, schema);
      writeFixtures(sandbox, fixtures);
    },
    expectedStatus: 0,
    expectedOutput: "contract check OK",
  },
  {
    name: "rejects an unsupported type declaration",
    mutate(sandbox) {
      const schema = readSchema(sandbox);
      schema.properties.jobs.type = ["array", "null"];
      writeRawJson(sandbox, schemaRelativePath, schema);
    },
    expectedOutput: "unsupported type declaration",
  },
  {
    name: "rejects schema-valued additional properties",
    mutate(sandbox) {
      const schema = readSchema(sandbox);
      schema.additionalProperties = { type: "string" };
      writeRawJson(sandbox, schemaRelativePath, schema);
    },
    expectedOutput: "additionalProperties must be boolean in the supported schema subset",
  },
  ...["constructor", "toString", "__proto__"].map((property) => ({
    name: `rejects the prototype-named extra property ${property}`,
    mutate(sandbox) {
      const fixtures = readFixtures(sandbox);
      Object.defineProperty(fixtures, property, {
        value: "unexpected",
        enumerable: true,
        configurable: true,
        writable: true,
      });
      writeFixtures(sandbox, fixtures);
    },
    expectedOutput: `unexpected property "${property}"`,
  })),
  {
    name: "does not satisfy required fields through the prototype chain",
    mutate(sandbox) {
      const schema = readSchema(sandbox);
      schema.required.push("constructor");
      writeRawJson(sandbox, schemaRelativePath, schema);
    },
    expectedOutput: 'missing required property "constructor"',
  },
  {
    name: "rejects plugin capability registry seed version drift",
    mutate(sandbox) {
      const seed = readPluginRegistrySeed(sandbox);
      seed.registryVersion = "1.0.1";
      writePluginRegistrySeed(sandbox, seed);
    },
    expectedOutput: "registryVersion drift",
  },
  {
    name: "rejects an unreviewed capability row added to the seed",
    mutate(sandbox) {
      const seed = readPluginRegistrySeed(sandbox);
      seed.entries = [
        ...seed.entries,
        {
          capabilityId: "dev.sceneaxi.capability.demo",
          contractRef: "contracts/plugin-manifest.schema.json",
          contractVersion: "1.0.0",
          owningPackage: "@sceneaxi/schemas",
          documentationRef: "docs/plugins.md",
        },
      ];
      writePluginRegistrySeed(sandbox, seed);
    },
    expectedOutput: "entries must exactly match the reviewed capability rows",
  },
  {
    name: "rejects silently dropping a reviewed capability row from the seed",
    mutate(sandbox) {
      const seed = readPluginRegistrySeed(sandbox);
      seed.entries = [];
      writePluginRegistrySeed(sandbox, seed);
    },
    expectedOutput: "entries must exactly match the reviewed capability rows",
  },
  {
    name: "rejects plugins.md missing the registry seed path",
    mutate(sandbox) {
      writePluginsDoc(
        sandbox,
        readPluginsDoc(sandbox).replaceAll("plugin-capability-registry.1.0.0.json", "missing-seed.json"),
      );
    },
    expectedOutput: "plugin-capability-registry.1.0.0.json",
  },
  {
    name: "rejects plugins.md registry version documentation drift",
    mutate(sandbox) {
      writePluginsDoc(
        sandbox,
        readPluginsDoc(sandbox).replace(
          registrySeedState,
          registrySeedState.replace("`1.0.0`", "`1.0.1`"),
        ),
      );
    },
    expectedOutput: "docs/plugins.md: registry seed state must exactly document registryVersion 1.0.0",
  },
  {
    name: "rejects plugins.md empty-seed documentation drift",
    mutate(sandbox) {
      writePluginsDoc(
        sandbox,
        readPluginsDoc(sandbox).replace(
          registrySeedState,
          registrySeedState.replace("exactly `[]` (empty)", "non-empty"),
        ),
      );
    },
    expectedOutput: "docs/plugins.md: registry seed state must exactly document registryVersion 1.0.0",
  },
  {
    name: "rejects schemas README registry version documentation drift",
    mutate(sandbox) {
      writeSchemasReadme(
        sandbox,
        readSchemasReadme(sandbox).replace(
          registrySeedState,
          registrySeedState.replace("`1.0.0`", "`1.0.1`"),
        ),
      );
    },
    expectedOutput: "packages/schemas/README.md: registry seed state must exactly document registryVersion 1.0.0",
  },
  {
    name: "rejects schemas README empty-seed documentation drift",
    mutate(sandbox) {
      writeSchemasReadme(
        sandbox,
        readSchemasReadme(sandbox).replace(
          registrySeedState,
          registrySeedState.replace("exactly `[]` (empty)", "non-empty"),
        ),
      );
    },
    expectedOutput: "packages/schemas/README.md: registry seed state must exactly document registryVersion 1.0.0",
  },
  {
    name: "rejects inert example fixture field drift",
    mutate(sandbox) {
      const example = readPluginManifestInertExample(sandbox);
      example.pluginId = "dev.sceneaxi.example.drifted";
      writePluginManifestInertExample(sandbox, example);
    },
    expectedOutput: "plugin-manifest.inert.example: value must exactly match the documented inert noop fixture",
  },
  {
    name: "rejects inert example inventing a capability ID",
    mutate(sandbox) {
      const example = readPluginManifestInertExample(sandbox);
      example.capabilities = ["dev.sceneaxi.capability.invented"];
      writePluginManifestInertExample(sandbox, example);
    },
    expectedOutput: "plugin-manifest.inert.example: value must exactly match the documented inert noop fixture",
  },
  {
    name: "rejects docs/plugins.md inert example drift from the checked-in fixture",
    mutate(sandbox) {
      const doc = readPluginsDoc(sandbox);
      const drifted = doc.replace(
        '"pluginId": "dev.sceneaxi.example.noop"',
        '"pluginId": "dev.sceneaxi.example.docs-drift"',
      );
      writePluginsDoc(sandbox, drifted);
    },
    expectedOutput:
      "docs/plugins.md: inert example JSON must exactly match packages/schemas/contracts/plugin-manifest.inert.example.json",
  },
  {
    name: "rejects docs/plugins.md missing the inert example markers",
    mutate(sandbox) {
      writePluginsDoc(
        sandbox,
        readPluginsDoc(sandbox)
          .replace(inertExampleStart, "")
          .replace(inertExampleEnd, ""),
      );
    },
    expectedOutput: "docs/plugins.md: expected exactly one <!-- plugin-manifest:inert-example -->",
  },
  {
    name: "rejects schemas README missing the inert example fixture path",
    mutate(sandbox) {
      writeSchemasReadme(
        sandbox,
        readSchemasReadme(sandbox).replaceAll(
          "plugin-manifest.inert.example.json",
          "plugin-manifest.missing.example.json",
        ),
      );
    },
    expectedOutput:
      "packages/schemas/README.md: does not name the inert example fixture path plugin-manifest.inert.example.json",
  },
  {
    name: "rejects inert example schema validation failure",
    mutate(sandbox) {
      const example = readPluginManifestInertExample(sandbox);
      example.schemaVersion = "9.9.9";
      writePluginManifestInertExample(sandbox, example);
    },
    expectedOutput:
      'plugin-manifest.inert.example.schemaVersion: expected const "1.0.0", got "9.9.9"',
  },
  {
    name: "rejects an unsupported plugin-manifest schema keyword",
    mutate(sandbox) {
      const schema = readPluginManifestSchema(sandbox);
      schema.properties.capabilities.maxItems = 5;
      writePluginManifestSchema(sandbox, schema);
    },
    expectedOutput:
      'plugin-manifest.schema.properties.capabilities: unsupported JSON Schema keyword "maxItems"',
  },
  {
    name: "rejects a plugin-manifest schema $id that does not identify the contract",
    mutate(sandbox) {
      const schema = readPluginManifestSchema(sandbox);
      schema.$id = "https://sceneaxi.invalid/contracts/renamed-contract/v1";
      writePluginManifestSchema(sandbox, schema);
    },
    expectedOutput:
      "plugin-manifest.schema.json: $id does not identify the plugin-manifest contract",
  },
  {
    name: "rejects the inert example when the plugin-manifest schema tightens against it",
    mutate(sandbox) {
      const schema = readPluginManifestSchema(sandbox);
      schema.properties.pluginId.pattern = "^refuse(?![\\s\\S])";
      writePluginManifestSchema(sandbox, schema);
    },
    expectedOutput:
      'plugin-manifest.inert.example.pluginId: "dev.sceneaxi.example.noop" does not match pattern',
  },
];

for (const scenario of cases) {
  test(scenario.name, (t) => {
    const sandbox = createSandbox();
    t.after(() => rmSync(sandbox, { recursive: true, force: true }));
    scenario.mutate?.(sandbox);

    const result = runChecker(sandbox);
    const output = `${result.stdout}${result.stderr}`;
    assert.equal(result.status, scenario.expectedStatus ?? 1, output);
    assert.match(output, new RegExp(scenario.expectedOutput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
}
