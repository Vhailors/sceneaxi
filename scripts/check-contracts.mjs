#!/usr/bin/env node
/**
 * Contract check — validates shared contract artifacts against their JSON
 * Schemas and enforces doc/schema/artifact lockstep.
 *
 * Surfaces:
 * 1. Authoring-jobs fixture list + E1/E2 doc binding
 * 2. Plugin capability registry schema + checked-in 1.0.0 seed artifact
 * 3. Plugin-manifest inert example fixture + docs/plugins.md lockstep (sceneaxi#24)
 * 4. Credit pack catalog fixture + docs/auth-credits.md lockstep (sceneaxi#91)
 * 5. Free-vs-paid entitlement matrix + docs/auth-credits.md lockstep (sceneaxi#99)
 * 6. Catalog dual-price listings + docs/auth-credits.md lockstep (sceneaxi#100)
 * 7. Open-path demo policy + docs/open-path-policy.md lockstep (sceneaxi#137)
 *
 * Fail-closed: missing files, schema violations, duplicate ids, seed drift, or
 * a doc whose fixture table drifts from the canonical JSON all exit 1.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

const schemaPath = join(root, "packages", "schemas", "contracts", "authoring-jobs.schema.json");
const fixturesPath = join(root, "packages", "schemas", "contracts", "authoring-jobs.fixtures.json");
const docPath = join(root, "docs", "authoring-contracts.md");
const pluginCapabilityRegistrySchemaPath = join(
  root,
  "packages",
  "schemas",
  "contracts",
  "plugin-capability-registry.schema.json",
);
const pluginCapabilityRegistrySeedPath = join(
  root,
  "packages",
  "schemas",
  "contracts",
  "plugin-capability-registry.1.0.0.json",
);
const pluginsDocPath = join(root, "docs", "plugins.md");
const schemasReadmePath = join(root, "packages", "schemas", "README.md");
const pluginManifestSchemaPath = join(
  root,
  "packages",
  "schemas",
  "contracts",
  "plugin-manifest.schema.json",
);
const pluginManifestInertExamplePath = join(
  root,
  "packages",
  "schemas",
  "contracts",
  "plugin-manifest.inert.example.json",
);
const loadFailed = Symbol("loadFailed");

const load = (path, parse) => {
  try {
    const text = readFileSync(path, "utf8");
    return parse ? JSON.parse(text) : text;
  } catch (e) {
    fail(`cannot load ${relative(root, path)}: ${e.message}`);
    return loadFailed;
  }
};

// Read back the object literal a module freezes into one named export. The span
// is anchored on that export and closed by counting braces (skipping string and
// comment content), so a module that later grows a second frozen export or any
// trailing code still yields this export's literal instead of a wrong span.
const frozenObjectLiteral = (source, exportName) => {
  const anchor = new RegExp(
    `export\\s+const\\s+${exportName}\\s*(?::[^=]*)?=\\s*Object\\.freeze\\(\\s*`,
  ).exec(source);
  if (anchor === null) return undefined;

  const start = anchor.index + anchor[0].length;
  if (source[start] !== "{") return undefined;

  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' || char === "'" || char === "`") {
      i += 1;
      while (i < source.length && source[i] !== char) {
        i += source[i] === "\\" ? 2 : 1;
      }
      continue;
    }
    if (char === "/" && source[i + 1] === "/") {
      const newline = source.indexOf("\n", i);
      if (newline === -1) return undefined;
      i = newline;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      if (close === -1) return undefined;
      i = close + 1;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return undefined;
};

const schema = load(schemaPath, true);
const fixtures = load(fixturesPath, true);
const doc = load(docPath, false);
const pluginCapabilityRegistrySchema = load(pluginCapabilityRegistrySchemaPath, true);
const pluginCapabilityRegistrySeed = load(pluginCapabilityRegistrySeedPath, true);
const pluginsDoc = load(pluginsDocPath, false);
const schemasReadme = load(schemasReadmePath, false);
const pluginManifestSchema = load(pluginManifestSchemaPath, true);
const pluginManifestInertExample = load(pluginManifestInertExamplePath, true);
const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const schemaIsObject = schema !== loadFailed && isPlainObject(schema);
const fixturesIsObject = fixtures !== loadFailed && isPlainObject(fixtures);
const docHasContent = doc !== loadFailed && doc.trim().length > 0;
const pluginRegistrySchemaIsObject =
  pluginCapabilityRegistrySchema !== loadFailed && isPlainObject(pluginCapabilityRegistrySchema);
const pluginRegistrySeedIsObject =
  pluginCapabilityRegistrySeed !== loadFailed && isPlainObject(pluginCapabilityRegistrySeed);
const pluginsDocHasContent = pluginsDoc !== loadFailed && pluginsDoc.trim().length > 0;
const schemasReadmeHasContent =
  schemasReadme !== loadFailed && schemasReadme.trim().length > 0;
const pluginManifestSchemaIsObject =
  pluginManifestSchema !== loadFailed && isPlainObject(pluginManifestSchema);
const pluginManifestInertExampleIsObject =
  pluginManifestInertExample !== loadFailed && isPlainObject(pluginManifestInertExample);

if (schema !== loadFailed && !schemaIsObject) {
  fail(`${relative(root, schemaPath)}: expected a plain JSON object`);
}
if (fixtures !== loadFailed && !fixturesIsObject) {
  fail(`${relative(root, fixturesPath)}: expected a plain JSON object`);
}
if (doc !== loadFailed && !docHasContent) {
  fail(`${relative(root, docPath)}: document is empty or whitespace-only`);
}
if (pluginCapabilityRegistrySchema !== loadFailed && !pluginRegistrySchemaIsObject) {
  fail(`${relative(root, pluginCapabilityRegistrySchemaPath)}: expected a plain JSON object`);
}
if (pluginCapabilityRegistrySeed !== loadFailed && !pluginRegistrySeedIsObject) {
  fail(`${relative(root, pluginCapabilityRegistrySeedPath)}: expected a plain JSON object`);
}
if (pluginsDoc !== loadFailed && !pluginsDocHasContent) {
  fail(`${relative(root, pluginsDocPath)}: document is empty or whitespace-only`);
}
if (schemasReadme !== loadFailed && !schemasReadmeHasContent) {
  fail(`${relative(root, schemasReadmePath)}: document is empty or whitespace-only`);
}
if (pluginManifestSchema !== loadFailed && !pluginManifestSchemaIsObject) {
  fail(`${relative(root, pluginManifestSchemaPath)}: expected a plain JSON object`);
}
if (pluginManifestInertExample !== loadFailed && !pluginManifestInertExampleIsObject) {
  fail(`${relative(root, pluginManifestInertExamplePath)}: expected a plain JSON object`);
}

const schemaMatches = (value, sch) => {
  if (
    sch.const !== undefined &&
    JSON.stringify(value) !== JSON.stringify(sch.const)
  ) {
    return false;
  }
  if (sch.enum !== undefined && !sch.enum.includes(value)) return false;
  if (sch.type === "object") {
    if (!isPlainObject(value)) return false;
    for (const key of sch.required ?? []) {
      if (!Object.hasOwn(value, key)) return false;
    }
    for (const [key, sub] of Object.entries(sch.properties ?? {})) {
      if (Object.hasOwn(value, key) && !schemaMatches(value[key], sub)) return false;
    }
  } else if (sch.type === "array") {
    if (!Array.isArray(value)) return false;
  } else if (sch.type === "string") {
    if (typeof value !== "string") return false;
  } else if (sch.type === "integer") {
    if (!Number.isInteger(value)) return false;
    if (sch.minimum !== undefined && value < sch.minimum) return false;
  } else if (sch.type === "boolean" && typeof value !== "boolean") {
    return false;
  }
  if ((sch.allOf ?? []).some((sub) => !schemaMatches(value, sub))) return false;
  if (sch.if !== undefined && schemaMatches(value, sch.if)) {
    if (sch.then !== undefined && !schemaMatches(value, sch.then)) return false;
  }
  if (sch.not !== undefined && schemaMatches(value, sch.not)) return false;
  return true;
};

// --- minimal JSON Schema subset validator ---
const validate = (value, sch, path) => {
  if (
    sch.const !== undefined &&
    JSON.stringify(value) !== JSON.stringify(sch.const)
  ) {
    fail(`${path}: expected const ${JSON.stringify(sch.const)}, got ${JSON.stringify(value)}`);
    return;
  }
  if (sch.enum !== undefined && !sch.enum.includes(value)) {
    fail(`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(sch.enum)}`);
    return;
  }
  if (sch.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      fail(`${path}: expected object`);
      return;
    }
    for (const key of sch.required ?? []) {
      if (!Object.hasOwn(value, key)) fail(`${path}: missing required property "${key}"`);
    }
    const properties = sch.properties ?? {};
    for (const [key, sub] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) validate(sub, properties[key], `${path}.${key}`);
      else if (sch.additionalProperties === false) fail(`${path}: unexpected property "${key}"`);
    }
  } else if (sch.type === "array") {
    if (!Array.isArray(value)) {
      fail(`${path}: expected array`);
      return;
    }
    if (sch.minItems !== undefined && value.length < sch.minItems) {
      fail(`${path}: expected at least ${sch.minItems} items, got ${value.length}`);
    }
    if (sch.uniqueItems === true) {
      const seen = new Set();
      for (let i = 0; i < value.length; i += 1) {
        const key = JSON.stringify(value[i]);
        if (seen.has(key)) {
          fail(`${path}: duplicate item at index ${i} violates uniqueItems`);
          break;
        }
        seen.add(key);
      }
    }
    if (sch.items) value.forEach((item, i) => validate(item, sch.items, `${path}[${i}]`));
  } else if (sch.type === "string") {
    if (typeof value !== "string") {
      fail(`${path}: expected string`);
      return;
    }
    if (sch.minLength !== undefined && [...value].length < sch.minLength) {
      fail(`${path}: expected string length >= ${sch.minLength}, got ${[...value].length}`);
    }
    if (sch.pattern && !new RegExp(sch.pattern).test(value)) {
      fail(`${path}: ${JSON.stringify(value)} does not match pattern ${sch.pattern}`);
    }
  } else if (sch.type === "integer") {
    if (!Number.isInteger(value)) {
      fail(`${path}: expected integer`);
    } else if (sch.minimum !== undefined && value < sch.minimum) {
      fail(`${path}: expected integer >= ${sch.minimum}, got ${value}`);
    }
  } else if (sch.type === "boolean") {
    if (typeof value !== "boolean") fail(`${path}: expected boolean`);
  }
  for (const sub of sch.allOf ?? []) validate(value, sub, path);
  if (
    sch.if !== undefined &&
    schemaMatches(value, sch.if) &&
    sch.then !== undefined
  ) {
    validate(value, sch.then, path);
  }
  if (sch.not !== undefined && schemaMatches(value, sch.not)) {
    fail(`${path}: value matches a forbidden schema`);
  }
};

const schemaAnnotations = new Set([
  "$schema",
  "$id",
  "$comment",
  "title",
  "description",
  "default",
  "examples",
  "deprecated",
  "readOnly",
  "writeOnly",
]);
const schemaAssertions = new Set([
  "type",
  "required",
  "properties",
  "items",
  "enum",
  "const",
  "pattern",
  "additionalProperties",
  "minItems",
  "minLength",
  "uniqueItems",
  "minimum",
  "allOf",
  "if",
  "then",
  "not",
]);
const supportedTypes = new Set([
  "object",
  "array",
  "string",
  "integer",
  "boolean",
]);

const validateSchemaDefinition = (sch, path) => {
  let supported = true;
  const reject = (message) => {
    fail(`${path}: ${message}`);
    supported = false;
  };

  if (!isPlainObject(sch)) {
    reject("expected a schema object");
    return false;
  }
  for (const keyword of Object.keys(sch)) {
    if (!schemaAnnotations.has(keyword) && !schemaAssertions.has(keyword)) {
      reject(`unsupported JSON Schema keyword "${keyword}"`);
    }
  }
  if ("type" in sch && !supportedTypes.has(sch.type)) {
    reject(`unsupported type declaration ${JSON.stringify(sch.type)}`);
  }
  if ("required" in sch && (!Array.isArray(sch.required) || !sch.required.every((key) => typeof key === "string"))) {
    reject("required must be an array of strings");
  }
  if ("enum" in sch && !Array.isArray(sch.enum)) {
    reject("enum must be an array");
  }
  if ("pattern" in sch) {
    if (typeof sch.pattern !== "string") {
      reject("pattern must be a string");
    } else {
      try {
        new RegExp(sch.pattern);
      } catch (error) {
        reject(`pattern is not a valid regular expression: ${error.message}`);
      }
    }
  }
  if ("additionalProperties" in sch && typeof sch.additionalProperties !== "boolean") {
    reject("additionalProperties must be boolean in the supported schema subset");
  }
  if ("minItems" in sch && (!Number.isInteger(sch.minItems) || sch.minItems < 0)) {
    reject("minItems must be a non-negative integer");
  }
  if ("minLength" in sch && (!Number.isInteger(sch.minLength) || sch.minLength < 0)) {
    reject("minLength must be a non-negative integer");
  }
  if ("uniqueItems" in sch && typeof sch.uniqueItems !== "boolean") {
    reject("uniqueItems must be boolean in the supported schema subset");
  }
  if ("minimum" in sch && typeof sch.minimum !== "number") {
    reject("minimum must be a number");
  }
  if (["required", "properties", "additionalProperties"].some((keyword) => keyword in sch) && sch.type !== "object") {
    reject("object assertion keywords require type \"object\" in the supported schema subset");
  }
  if (["items", "minItems", "uniqueItems"].some((keyword) => keyword in sch) && sch.type !== "array") {
    reject("array assertion keywords require type \"array\" in the supported schema subset");
  }
  if (["pattern", "minLength"].some((keyword) => keyword in sch) && sch.type !== "string") {
    reject("string assertion keywords require type \"string\" in the supported schema subset");
  }
  if ("minimum" in sch && sch.type !== "integer") {
    reject("minimum requires type \"integer\" in the supported schema subset");
  }
  if ("properties" in sch) {
    if (!isPlainObject(sch.properties)) {
      reject("properties must be an object of schemas");
    } else {
      for (const [property, propertySchema] of Object.entries(sch.properties)) {
        if (!validateSchemaDefinition(propertySchema, `${path}.properties.${property}`)) supported = false;
      }
    }
  }
  if ("items" in sch && !validateSchemaDefinition(sch.items, `${path}.items`)) {
    supported = false;
  }
  if ("allOf" in sch) {
    if (!Array.isArray(sch.allOf) || sch.allOf.length === 0) {
      reject("allOf must be a non-empty array of schemas");
    } else {
      sch.allOf.forEach((sub, index) => {
        if (!validateSchemaDefinition(sub, `${path}.allOf[${index}]`)) {
          supported = false;
        }
      });
    }
  }
  for (const keyword of ["if", "then", "not"]) {
    if (keyword in sch && !validateSchemaDefinition(sch[keyword], `${path}.${keyword}`)) {
      supported = false;
    }
  }
  if ("then" in sch && !("if" in sch)) {
    reject("then requires if in the supported schema subset");
  }
  return supported;
};

const loadContractSurface = ({
  contractName,
  schemaFile,
  fixturesFile,
}) => {
  const contractSchemaPath = join(
    root,
    "packages",
    "schemas",
    "contracts",
    schemaFile,
  );
  const contractFixturesPath = join(
    root,
    "packages",
    "schemas",
    "contracts",
    fixturesFile,
  );
  const contractSchema = load(contractSchemaPath, true);
  const contractFixtures = load(contractFixturesPath, true);
  const schemaReady =
    contractSchema !== loadFailed && isPlainObject(contractSchema);
  const fixturesReady =
    contractFixtures !== loadFailed && isPlainObject(contractFixtures);

  if (contractSchema !== loadFailed && !schemaReady) {
    fail(`${relative(root, contractSchemaPath)}: expected a plain JSON object`);
  }
  if (contractFixtures !== loadFailed && !fixturesReady) {
    fail(`${relative(root, contractFixturesPath)}: expected a plain JSON object`);
  }

  const supported =
    schemaReady &&
    validateSchemaDefinition(contractSchema, `${contractName}.schema`);
  if (
    schemaReady &&
    (typeof contractSchema.$id !== "string" ||
      !contractSchema.$id.includes(contractName))
  ) {
    fail(
      `${relative(root, contractSchemaPath)}: $id does not identify the ${contractName} contract`,
    );
  }
  if (schemaReady && fixturesReady && supported) {
    validate(contractFixtures, contractSchema, `${contractName}.fixtures`);
  }

  return {
    fixtures: contractFixtures,
    ready: schemaReady && fixturesReady,
  };
};

const duplicateFieldValues = (records, field) => {
  const values = records
    .map((record) => (isPlainObject(record) ? record[field] : undefined))
    .filter((value) => typeof value === "string");
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
};

const documentBlock = ({ document, documentPath, start, end }) => {
  const starts = document.split(start).length - 1;
  const ends = document.split(end).length - 1;
  const startIndex = document.indexOf(start);
  const endIndex = document.indexOf(end);
  if (
    starts !== 1 ||
    ends !== 1 ||
    startIndex < 0 ||
    endIndex < startIndex
  ) {
    fail(
      `${relative(root, documentPath)}: expected exactly one ${start} ... ${end} block, found ${starts} start and ${ends} end marker(s)`,
    );
    return undefined;
  }
  return document
    .slice(startIndex + start.length, endIndex)
    .trim()
    .replaceAll("\r\n", "\n");
};

const schemaUsesSupportedSubset = schemaIsObject && validateSchemaDefinition(schema, "schema");
let authoringJobCount = 0;

if (schemaIsObject && fixturesIsObject) {
  if (typeof schema.$id !== "string" || !schema.$id.includes("authoring-jobs")) {
    fail(`${relative(root, schemaPath)}: $id does not identify the authoring-jobs contract`);
  }
  if (schemaUsesSupportedSubset) validate(fixtures, schema, "fixtures");

  const jobs = Array.isArray(fixtures.jobs) ? fixtures.jobs : [];
  authoringJobCount = jobs.length;
  const ids = jobs.map((j) => j?.id).filter(Boolean);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) fail(`fixtures: duplicate job id(s): ${[...new Set(dupes)].join(", ")}`);

  // --- doc cross-checks: one shared table matching the JSON, both contracts bound to it ---
  if (docHasContent) {
    const tableStart = "<!-- authoring-jobs:list -->";
    const tableEnd = "<!-- /authoring-jobs:list -->";
    const tableStarts = doc.split(tableStart).length - 1;
    const tableEnds = doc.split(tableEnd).length - 1;
    const tableMatches = [...doc.matchAll(/<!-- authoring-jobs:list -->([\s\S]*?)<!-- \/authoring-jobs:list -->/g)];
    if (tableStarts !== 1 || tableEnds !== 1 || tableMatches.length !== 1) {
      fail(`doc: expected exactly one ${tableStart} ... ${tableEnd} shared fixture table, found ${tableStarts} start and ${tableEnds} end marker(s)`);
    } else {
      const actualTable = tableMatches[0][1].trim().replaceAll("\r\n", "\n");
      const expectedTable = [
        "| id | job | edit class |",
        "|---|---|---|",
        ...jobs.map((job) => `| \`${job.id}\` | ${job.title} | ${job.editClass} |`),
      ].join("\n");
      if (actualTable !== expectedTable) {
        fail(
          "doc: shared fixture table does not exactly match canonical fixture id, title/job, and edit class columns in order"
        );
      }
    }

    const headingMatches = {
      E1: [...doc.matchAll(/^## E1(?:\s|$).*$/gm)],
      E2: [...doc.matchAll(/^## E2(?:\s|$).*$/gm)],
      shared: [...doc.matchAll(/^## Shared authoring-jobs fixture list\s*$/gm)],
    };
    for (const [section, matches] of Object.entries(headingMatches)) {
      if (matches.length !== 1) {
        fail(`doc: expected exactly one ${section} contract boundary heading, found ${matches.length}`);
      }
    }
    const bindMatches = Object.fromEntries(
      ["E1", "E2"].map((contract) => [
        contract,
        [...doc.matchAll(new RegExp(`<!-- authoring-jobs:bind ${contract} -->`, "g"))],
      ])
    );
    for (const contract of ["E1", "E2"]) {
      if (bindMatches[contract].length !== 1) {
        fail(`doc: expected exactly one <!-- authoring-jobs:bind ${contract} --> marker, found ${bindMatches[contract].length}`);
      }
    }
    if (
      headingMatches.E1.length === 1 &&
      headingMatches.E2.length === 1 &&
      headingMatches.shared.length === 1 &&
      bindMatches.E1.length === 1 &&
      bindMatches.E2.length === 1
    ) {
      const e1Heading = headingMatches.E1[0].index;
      const e2Heading = headingMatches.E2[0].index;
      const sharedHeading = headingMatches.shared[0].index;
      const e1Bind = bindMatches.E1[0].index;
      const e2Bind = bindMatches.E2[0].index;
      if (!(e1Heading < e1Bind && e1Bind < e2Heading)) {
        fail("doc: <!-- authoring-jobs:bind E1 --> must appear after the E1 heading and before the E2 heading");
      }
      if (!(e2Heading < e2Bind && e2Bind < sharedHeading)) {
        fail("doc: <!-- authoring-jobs:bind E2 --> must appear after the E2 heading and before the shared fixture list heading");
      }
    }
    if (!doc.includes("packages/schemas/contracts/authoring-jobs.fixtures.json")) {
      fail("doc: does not name the canonical fixture file path");
    }
    for (const link of ["factories-helpers/issues/49", "factories-helpers/issues/45"]) {
      if (!doc.includes(link)) fail(`doc: missing required cross-link to ${link}`);
    }
  }
}

// --- plugin capability registry seed (sceneaxi#21) ---
const PLUGIN_CAPABILITY_REGISTRY_SEED_VERSION = "1.0.0";
const PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI =
  "https://sceneaxi.dev/schemas/plugin-capability-registry-1.0.0.json";
const FORBIDDEN_SEED_SUBSTRINGS = [
  "renderer",
  "physics",
  "storage",
  "hook",
  "engine-internal",
  "service-locator",
];
const REGISTRY_SEED_DOC_START = "<!-- plugin-capability-registry:seed-state -->";
const REGISTRY_SEED_DOC_END = "<!-- /plugin-capability-registry:seed-state -->";

/**
 * Exact rows the v1 seed ships, in order. Every row is a reviewed capability
 * contract; adding one is a deliberate edit here plus the seed artifact plus the
 * TypeScript fixture, so a capability cannot appear in only one of the three.
 */
const REGISTRY_SEED_ENTRIES = Object.freeze([
  Object.freeze({
    capabilityId: "sceneaxi.sculpt.intake-source.v1",
    contractRef: "contracts/sculpt-intake.schema.json",
    contractVersion: "1.0.0",
    owningPackage: "@sceneaxi/schemas",
    documentationRef: "docs/plugins.md",
  }),
]);

const REGISTRY_SEED_DOC_STATE =
  `Registry seed state: \`registryVersion\` is \`${PLUGIN_CAPABILITY_REGISTRY_SEED_VERSION}\`; ` +
  `\`entries\` holds exactly ${REGISTRY_SEED_ENTRIES.length} reviewed capability ID: ` +
  `${REGISTRY_SEED_ENTRIES.map((entry) => `\`${entry.capabilityId}\``).join(", ")}.`;

const validateRegistrySeedDoc = (text, hasContent, path) => {
  if (!hasContent) return;

  const starts = text.split(REGISTRY_SEED_DOC_START).length - 1;
  const ends = text.split(REGISTRY_SEED_DOC_END).length - 1;
  const matches = [
    ...text.matchAll(
      /<!-- plugin-capability-registry:seed-state -->([\s\S]*?)<!-- \/plugin-capability-registry:seed-state -->/g,
    ),
  ];
  if (starts !== 1 || ends !== 1 || matches.length !== 1) {
    fail(
      `${path}: expected exactly one ${REGISTRY_SEED_DOC_START} ... ${REGISTRY_SEED_DOC_END} block, found ${starts} start and ${ends} end marker(s)`,
    );
    return;
  }

  const actual = matches[0][1].trim().replaceAll("\r\n", "\n");
  if (actual !== REGISTRY_SEED_DOC_STATE) {
    fail(
      `${path}: registry seed state must exactly document registryVersion ${PLUGIN_CAPABILITY_REGISTRY_SEED_VERSION} and the shipped capability IDs`,
    );
  }
};

const pluginRegistrySchemaUsesSupportedSubset =
  pluginRegistrySchemaIsObject &&
  validateSchemaDefinition(pluginCapabilityRegistrySchema, "plugin-capability-registry.schema");

if (pluginRegistrySchemaIsObject) {
  if (
    typeof pluginCapabilityRegistrySchema.$id !== "string" ||
    !pluginCapabilityRegistrySchema.$id.includes("plugin-capability-registry")
  ) {
    fail(
      `${relative(root, pluginCapabilityRegistrySchemaPath)}: $id does not identify the plugin-capability-registry contract`,
    );
  }
}

if (pluginRegistrySchemaIsObject && pluginRegistrySeedIsObject) {
  if (pluginRegistrySchemaUsesSupportedSubset) {
    validate(
      pluginCapabilityRegistrySeed,
      pluginCapabilityRegistrySchema,
      "plugin-capability-registry.seed",
    );
  }

  if (pluginCapabilityRegistrySeed.$schema !== PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI) {
    fail(
      `plugin-capability-registry.seed: $schema must be ${JSON.stringify(PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI)}`,
    );
  }
  if (pluginCapabilityRegistrySeed.schemaVersion !== PLUGIN_CAPABILITY_REGISTRY_SEED_VERSION) {
    fail(
      `plugin-capability-registry.seed: schemaVersion drift — expected ${PLUGIN_CAPABILITY_REGISTRY_SEED_VERSION}, got ${JSON.stringify(pluginCapabilityRegistrySeed.schemaVersion)}`,
    );
  }
  if (pluginCapabilityRegistrySeed.registryVersion !== PLUGIN_CAPABILITY_REGISTRY_SEED_VERSION) {
    fail(
      `plugin-capability-registry.seed: registryVersion drift — expected ${PLUGIN_CAPABILITY_REGISTRY_SEED_VERSION}, got ${JSON.stringify(pluginCapabilityRegistrySeed.registryVersion)}`,
    );
  }

  const entries = Array.isArray(pluginCapabilityRegistrySeed.entries)
    ? pluginCapabilityRegistrySeed.entries
    : [];
  if (JSON.stringify(entries) !== JSON.stringify(REGISTRY_SEED_ENTRIES)) {
    fail(
      "plugin-capability-registry.seed: entries must exactly match the reviewed capability rows pinned in scripts/check-contracts.mjs; every capability is a deliberate contract change",
    );
  }

  const capabilityIds = entries
    .map((entry) => (isPlainObject(entry) ? entry.capabilityId : undefined))
    .filter((id) => typeof id === "string");
  const duplicateIds = capabilityIds.filter((id, index) => capabilityIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    fail(
      `plugin-capability-registry.seed: duplicate capability id(s): ${[...new Set(duplicateIds)].join(", ")}`,
    );
  }

  const seedText = JSON.stringify(pluginCapabilityRegistrySeed).toLowerCase();
  for (const forbidden of FORBIDDEN_SEED_SUBSTRINGS) {
    if (seedText.includes(forbidden)) {
      fail(
        `plugin-capability-registry.seed: forbidden engine-internal token "${forbidden}" present in seed artifact`,
      );
    }
  }
}

if (pluginsDocHasContent) {
  for (const path of [
    "plugin-capability-registry.schema.json",
    "plugin-capability-registry.1.0.0.json",
  ]) {
    if (!pluginsDoc.includes(path)) {
      fail(`plugins.md: does not name registry contract path ${path}`);
    }
  }
}
validateRegistrySeedDoc(pluginsDoc, pluginsDocHasContent, "docs/plugins.md");
validateRegistrySeedDoc(
  schemasReadme,
  schemasReadmeHasContent,
  "packages/schemas/README.md",
);

// --- plugin-manifest inert example (sceneaxi#24) ---
const PLUGIN_MANIFEST_SCHEMA_URI =
  "https://sceneaxi.dev/schemas/plugin-manifest-1.0.0.json";
const PLUGIN_MANIFEST_SCHEMA_VERSION = "1.0.0";
const INERT_EXAMPLE_DOC_START = "<!-- plugin-manifest:inert-example -->";
const INERT_EXAMPLE_DOC_END = "<!-- /plugin-manifest:inert-example -->";
const INERT_EXAMPLE_CANONICAL = Object.freeze({
  $schema: PLUGIN_MANIFEST_SCHEMA_URI,
  schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION,
  pluginId: "dev.sceneaxi.example.noop",
  pluginVersion: "0.1.0",
  hostApi: "^1.0.0",
  registryVersion: "1.0.0",
  entrypoint: "./dist/plugin.js",
  capabilities: Object.freeze([]),
});

const pluginManifestSchemaUsesSupportedSubset =
  pluginManifestSchemaIsObject &&
  validateSchemaDefinition(pluginManifestSchema, "plugin-manifest.schema");

if (pluginManifestSchemaIsObject) {
  if (
    typeof pluginManifestSchema.$id !== "string" ||
    !pluginManifestSchema.$id.includes("plugin-manifest")
  ) {
    fail(
      `${relative(root, pluginManifestSchemaPath)}: $id does not identify the plugin-manifest contract`,
    );
  }
}

if (pluginManifestSchemaIsObject && pluginManifestInertExampleIsObject) {
  if (pluginManifestSchemaUsesSupportedSubset) {
    validate(
      pluginManifestInertExample,
      pluginManifestSchema,
      "plugin-manifest.inert.example",
    );
  }

  if (pluginManifestInertExample.$schema !== PLUGIN_MANIFEST_SCHEMA_URI) {
    fail(
      `plugin-manifest.inert.example: $schema must be ${JSON.stringify(PLUGIN_MANIFEST_SCHEMA_URI)}`,
    );
  }
  if (pluginManifestInertExample.schemaVersion !== PLUGIN_MANIFEST_SCHEMA_VERSION) {
    fail(
      `plugin-manifest.inert.example: schemaVersion drift — expected ${PLUGIN_MANIFEST_SCHEMA_VERSION}, got ${JSON.stringify(pluginManifestInertExample.schemaVersion)}`,
    );
  }
  if (JSON.stringify(pluginManifestInertExample) !== JSON.stringify(INERT_EXAMPLE_CANONICAL)) {
    fail(
      "plugin-manifest.inert.example: value must exactly match the documented inert noop fixture (empty capabilities; no invented ports)",
    );
  }

  const inertText = JSON.stringify(pluginManifestInertExample).toLowerCase();
  for (const forbidden of FORBIDDEN_SEED_SUBSTRINGS) {
    if (inertText.includes(forbidden)) {
      fail(
        `plugin-manifest.inert.example: forbidden engine-internal token "${forbidden}" present in inert example`,
      );
    }
  }
}

if (pluginsDocHasContent && pluginManifestInertExampleIsObject) {
  const starts = pluginsDoc.split(INERT_EXAMPLE_DOC_START).length - 1;
  const ends = pluginsDoc.split(INERT_EXAMPLE_DOC_END).length - 1;
  const matches = [
    ...pluginsDoc.matchAll(
      /<!-- plugin-manifest:inert-example -->([\s\S]*?)<!-- \/plugin-manifest:inert-example -->/g,
    ),
  ];
  if (starts !== 1 || ends !== 1 || matches.length !== 1) {
    fail(
      `docs/plugins.md: expected exactly one ${INERT_EXAMPLE_DOC_START} ... ${INERT_EXAMPLE_DOC_END} block, found ${starts} start and ${ends} end marker(s)`,
    );
  } else {
    const block = matches[0][1].trim().replaceAll("\r\n", "\n");
    const fence = block.match(/^```json\n([\s\S]*?)\n```$/);
    if (!fence) {
      fail(
        "docs/plugins.md: inert example block must be a single ```json fenced code block",
      );
    } else {
      let documented;
      try {
        documented = JSON.parse(fence[1]);
      } catch (error) {
        fail(
          `docs/plugins.md: inert example JSON parse failed: ${error.message}`,
        );
        documented = loadFailed;
      }
      if (
        documented !== loadFailed &&
        JSON.stringify(documented) !== JSON.stringify(pluginManifestInertExample)
      ) {
        fail(
          "docs/plugins.md: inert example JSON must exactly match packages/schemas/contracts/plugin-manifest.inert.example.json",
        );
      }
    }
  }

  if (!pluginsDoc.includes("plugin-manifest.inert.example.json")) {
    fail("docs/plugins.md: does not name the inert example fixture path plugin-manifest.inert.example.json");
  }
  if (!pluginsDoc.includes("plugin-manifest.schema.json")) {
    fail("docs/plugins.md: does not name plugin-manifest.schema.json");
  }
}

if (schemasReadmeHasContent) {
  if (!schemasReadme.includes("plugin-manifest.inert.example.json")) {
    fail(
      "packages/schemas/README.md: does not name the inert example fixture path plugin-manifest.inert.example.json",
    );
  }
}

// --- credit pack catalog + docs/auth-credits.md lockstep (sceneaxi#91) ---
const CREDIT_PACKS_DOC_START = "<!-- credit-packs:list -->";
const CREDIT_PACKS_DOC_END = "<!-- /credit-packs:list -->";

const authCreditsDocPath = join(root, "docs", "auth-credits.md");

const creditPacksSurface = loadContractSurface({
  contractName: "credit-packs",
  schemaFile: "credit-packs.schema.json",
  fixturesFile: "credit-packs.fixtures.json",
});
const creditPacksFixtures = creditPacksSurface.fixtures;
const authCreditsDoc = load(authCreditsDocPath, false);

const authCreditsDocHasContent =
  authCreditsDoc !== loadFailed && authCreditsDoc.trim().length > 0;

if (authCreditsDoc !== loadFailed && !authCreditsDocHasContent) {
  fail(`${relative(root, authCreditsDocPath)}: document is empty or whitespace-only`);
}

let creditPackCount = 0;

if (creditPacksSurface.ready) {
  const packs = Array.isArray(creditPacksFixtures.packs)
    ? creditPacksFixtures.packs
    : [];
  creditPackCount = packs.length;

  const duplicatePackIds = duplicateFieldValues(packs, "packId");
  if (duplicatePackIds.length > 0) {
    fail(
      `credit-packs.fixtures: duplicate packId(s): ${duplicatePackIds.join(", ")}`,
    );
  }

  const duplicatePriceIds = duplicateFieldValues(packs, "stripePriceId");
  if (duplicatePriceIds.length > 0) {
    fail(
      `credit-packs.fixtures: duplicate stripePriceId(s): ${duplicatePriceIds.join(", ")}`,
    );
  }

  // Test-mode price ids only: a live price id must never be committed.
  for (const pack of packs) {
    if (!isPlainObject(pack) || typeof pack.stripePriceId !== "string") continue;
    if (!pack.stripePriceId.includes("test")) {
      fail(
        `credit-packs.fixtures: stripePriceId ${JSON.stringify(pack.stripePriceId)} is not a test-mode id; live price ids are a separate captain go-live decision`,
      );
    }
  }

  if (authCreditsDocHasContent) {
    const actual = documentBlock({
      document: authCreditsDoc,
      documentPath: authCreditsDocPath,
      start: CREDIT_PACKS_DOC_START,
      end: CREDIT_PACKS_DOC_END,
    });
    if (actual !== undefined) {
      const expected = [
        "| pack | credits | price | stripe test price id |",
        "|---|---|---|---|",
        ...packs.map(
          (pack) =>
            `| \`${pack.packId}\` | ${pack.credits} | ${pack.unitAmount} ${String(pack.currency).toUpperCase()} minor units | \`${pack.stripePriceId}\` |`,
        ),
      ].join("\n");
      if (actual !== expected) {
        fail(
          "docs/auth-credits.md: credit pack table does not exactly match credit-packs.fixtures.json (pack id, credits, price, price id columns in order)",
        );
      }
    }

    if (!authCreditsDoc.includes("credit-packs.fixtures.json")) {
      fail("docs/auth-credits.md: does not name the canonical credit pack fixture path");
    }
  }

  // The bundled twin the deployable sites load must carry exactly this catalog. A
  // serverless bundle is not guaranteed to trace the fixture file into the
  // deployment, so the module is what actually ships — and it may never drift from
  // the contract it copies.
  const creditPacksModulePath = join(
    root,
    "packages",
    "schemas",
    "src",
    "credit-packs.data.ts",
  );
  const creditPacksModule = load(creditPacksModulePath, false);
  if (creditPacksModule === loadFailed) {
    fail(
      "packages/schemas/src/credit-packs.data.ts: the bundled credit pack catalog is missing",
    );
  } else {
    const literal = frozenObjectLiteral(creditPacksModule, "CREDIT_PACK_CATALOG_DATA");
    let bundled;
    if (literal !== undefined) {
      try {
        bundled = JSON.parse(literal);
      } catch {
        bundled = undefined;
      }
    }
    if (bundled === undefined) {
      fail(
        "packages/schemas/src/credit-packs.data.ts: the bundled credit pack catalog CREDIT_PACK_CATALOG_DATA is not a parseable JSON literal frozen into the module",
      );
    } else if (
      JSON.stringify(bundled, null, 2) !== JSON.stringify(creditPacksFixtures, null, 2)
    ) {
      fail(
        "packages/schemas/src/credit-packs.data.ts: bundled credit pack catalog does not exactly match credit-packs.fixtures.json",
      );
    }
  }
}

// --- entitlement matrix + docs/auth-credits.md lockstep (sceneaxi#99) ---
const ENTITLEMENT_DOC_START = "<!-- entitlement-matrix:list -->";
const ENTITLEMENT_DOC_END = "<!-- /entitlement-matrix:list -->";

const entitlementSurface = loadContractSurface({
  contractName: "entitlement-matrix",
  schemaFile: "entitlement-matrix.schema.json",
  fixturesFile: "entitlement-matrix.fixtures.json",
});
const entitlementFixtures = entitlementSurface.fixtures;

let entitlementCapabilityCount = 0;

if (entitlementSurface.ready) {
  const capabilities = Array.isArray(entitlementFixtures.capabilities)
    ? entitlementFixtures.capabilities
    : [];
  entitlementCapabilityCount = capabilities.length;

  const duplicateIds = duplicateFieldValues(capabilities, "capability");
  if (duplicateIds.length > 0) {
    fail(
      `entitlement-matrix.fixtures: duplicate capability id(s): ${duplicateIds.join(", ")}`,
    );
  }

  // The free path is a product guarantee: these three must stay account-free.
  const FREE_WITHOUT_ACCOUNT = [
    "engine-sdk-download",
    "cli-authoring",
    "byo-model-keys",
  ];
  for (const capability of FREE_WITHOUT_ACCOUNT) {
    const entry = capabilities.find(
      (candidate) => isPlainObject(candidate) && candidate.capability === capability,
    );
    if (entry === undefined) {
      fail(
        `entitlement-matrix.fixtures: free-path capability "${capability}" is missing; the free path is a captain product guarantee`,
      );
      continue;
    }
    if (entry.accountRequired !== false || entry.price !== "free") {
      fail(
        `entitlement-matrix.fixtures: "${capability}" must stay accountRequired false and price free; changing it needs a captain decision`,
      );
    }
  }

  if (entitlementFixtures.starterCreditGrant !== 100) {
    fail(
      `entitlement-matrix.fixtures: starterCreditGrant must be 100 (captain-frozen), got ${JSON.stringify(entitlementFixtures.starterCreditGrant)}`,
    );
  }

  if (authCreditsDocHasContent) {
    const actual = documentBlock({
      document: authCreditsDoc,
      documentPath: authCreditsDocPath,
      start: ENTITLEMENT_DOC_START,
      end: ENTITLEMENT_DOC_END,
    });
    if (actual !== undefined) {
      const expected = [
        "| capability | account | price |",
        "|---|---|---|",
        ...capabilities.map(
          (entry) =>
            `| \`${entry.capability}\` | ${entry.accountRequired === true ? "required" : "not required"} | ${entry.price} |`,
        ),
      ].join("\n");
      if (actual !== expected) {
        fail(
          "docs/auth-credits.md: entitlement matrix table does not exactly match entitlement-matrix.fixtures.json (capability, account, price columns in order)",
        );
      }
    }

    if (!authCreditsDoc.includes("entitlement-matrix.fixtures.json")) {
      fail(
        "docs/auth-credits.md: does not name the canonical entitlement matrix fixture path",
      );
    }
  }
}

// --- catalog listings + docs/auth-credits.md lockstep (sceneaxi#100) ---
const LISTINGS_DOC_START = "<!-- catalog-listings:list -->";
const LISTINGS_DOC_END = "<!-- /catalog-listings:list -->";

const listingsSurface = loadContractSurface({
  contractName: "catalog-listings",
  schemaFile: "catalog-listings.schema.json",
  fixturesFile: "catalog-listings.fixtures.json",
});
const listingsFixtures = listingsSurface.fixtures;

let listingCount = 0;

if (listingsSurface.ready) {
  const listings = Array.isArray(listingsFixtures.listings)
    ? listingsFixtures.listings
    : [];
  listingCount = listings.length;

  const duplicateIds = duplicateFieldValues(listings, "listingId");
  if (duplicateIds.length > 0) {
    fail(
      `catalog-listings.fixtures: duplicate listingId(s): ${duplicateIds.join(", ")}`,
    );
  }

  // The cross-field price-mode rule is checked here too, with targeted errors
  // for the lockstep fixture and documentation surface.
  for (const listing of listings) {
    if (!isPlainObject(listing)) continue;
    const mode = listing.priceMode;
    const wantsCredits = mode === "credits" || mode === "credits-and-money";
    const wantsMoney = mode === "money" || mode === "credits-and-money";
    const hasCredits = Object.hasOwn(listing, "creditPrice");
    const hasMoney = Object.hasOwn(listing, "moneyPrice");
    if (wantsCredits !== hasCredits) {
      fail(
        `catalog-listings.fixtures: listing "${listing.listingId}" priceMode ${JSON.stringify(mode)} ${wantsCredits ? "requires" : "forbids"} creditPrice`,
      );
    }
    if (wantsMoney !== hasMoney) {
      fail(
        `catalog-listings.fixtures: listing "${listing.listingId}" priceMode ${JSON.stringify(mode)} ${wantsMoney ? "requires" : "forbids"} moneyPrice`,
      );
    }
  }

  // Every price mode must be exercised, so a regression cannot pass by dropping
  // the shape it breaks.
  for (const mode of ["credits", "money", "credits-and-money"]) {
    if (
      !listings.some(
        (listing) => isPlainObject(listing) && listing.priceMode === mode,
      )
    ) {
      fail(
        `catalog-listings.fixtures: no listing exercises priceMode "${mode}"; all three modes must stay covered`,
      );
    }
  }

  if (authCreditsDocHasContent) {
    const actual = documentBlock({
      document: authCreditsDoc,
      documentPath: authCreditsDocPath,
      start: LISTINGS_DOC_START,
      end: LISTINGS_DOC_END,
    });
    if (actual !== undefined) {
      const expected = [
        "| listing | catalog | price mode | credits | money |",
        "|---|---|---|---|---|",
        ...listings.map((listing) => {
          const credits =
            listing.creditPrice === undefined ? "—" : String(listing.creditPrice);
          const money = isPlainObject(listing.moneyPrice)
            ? `${listing.moneyPrice.unitAmount} ${String(listing.moneyPrice.currency).toUpperCase()} minor units`
            : "—";
          return `| \`${listing.listingId}\` | ${listing.catalog} | ${listing.priceMode} | ${credits} | ${money} |`;
        }),
      ].join("\n");
      if (actual !== expected) {
        fail(
          "docs/auth-credits.md: catalog listing table does not exactly match catalog-listings.fixtures.json (listing, catalog, price mode, credits, money columns in order)",
        );
      }
    }

    if (!authCreditsDoc.includes("catalog-listings.fixtures.json")) {
      fail(
        "docs/auth-credits.md: does not name the canonical catalog listing fixture path",
      );
    }
  }

  // The bundled twin the deployable sites load must carry exactly this listing
  // set, for the same reason the credit-pack module must: a bundle cannot read
  // the fixture file, so the module is what actually ships — and it may never
  // drift from the contract it copies.
  const listingsModulePath = join(
    root,
    "packages",
    "schemas",
    "src",
    "catalog-listings.data.ts",
  );
  const listingsModule = load(listingsModulePath, false);
  if (listingsModule === loadFailed) {
    fail(
      "packages/schemas/src/catalog-listings.data.ts: the bundled catalog listing set is missing",
    );
  } else {
    const literal = frozenObjectLiteral(listingsModule, "CATALOG_LISTINGS_DATA");
    let bundled;
    if (literal !== undefined) {
      try {
        bundled = JSON.parse(literal);
      } catch {
        bundled = undefined;
      }
    }
    if (bundled === undefined) {
      fail(
        "packages/schemas/src/catalog-listings.data.ts: the bundled catalog listing set CATALOG_LISTINGS_DATA is not a parseable JSON literal frozen into the module",
      );
    } else if (
      JSON.stringify(bundled, null, 2) !== JSON.stringify(listingsFixtures, null, 2)
    ) {
      fail(
        "packages/schemas/src/catalog-listings.data.ts: bundled catalog listing set does not exactly match catalog-listings.fixtures.json",
      );
    }
  }
}

// --- open-path demo policy + docs/open-path-policy.md lockstep (sceneaxi#137) ---
const OPEN_PATH_DOC_START = "<!-- open-path-policy:list -->";
const OPEN_PATH_DOC_END = "<!-- /open-path-policy:list -->";

const openPathDocPath = join(root, "docs", "open-path-policy.md");

const openPathSurface = loadContractSurface({
  contractName: "open-path-policy",
  schemaFile: "open-path-policy.schema.json",
  fixturesFile: "open-path-policy.fixtures.json",
});
const openPathFixtures = openPathSurface.fixtures;
const openPathDoc = load(openPathDocPath, false);

const openPathDocHasContent =
  openPathDoc !== loadFailed && openPathDoc.trim().length > 0;

if (openPathDoc !== loadFailed && !openPathDocHasContent) {
  fail(`${relative(root, openPathDocPath)}: document is empty or whitespace-only`);
}

let openPathProfileCount = 0;

if (openPathSurface.ready) {
  const profiles = Array.isArray(openPathFixtures.profiles)
    ? openPathFixtures.profiles
    : [];
  openPathProfileCount = profiles.length;

  const duplicateProfiles = duplicateFieldValues(profiles, "profile");
  if (duplicateProfiles.length > 0) {
    fail(
      `open-path-policy.fixtures: duplicate profile(s): ${duplicateProfiles.join(", ")}`,
    );
  }

  // No row may claim shipping, and the Kids row must stay refuse-only with no
  // operations — the two invariants the whole policy exists to hold.
  for (const row of profiles) {
    if (!isPlainObject(row)) continue;
    if (row.shippingClaim !== false) {
      fail(
        `open-path-policy.fixtures: ${JSON.stringify(row.profile)} shippingClaim must be false; the open-path policy never authorizes shipping or publication`,
      );
    }
    if (typeof row.evidence !== "string" || row.evidence.trim().length === 0) {
      fail(
        `open-path-policy.fixtures: ${JSON.stringify(row.profile)} names no committed evidence for its demo level`,
      );
    } else if (!existsSync(join(root, row.evidence))) {
      // "Every level names the committed test that proves it" is only an
      // invariant if the name resolves; a non-empty string alone lets a rename
      // or deletion leave a row pointing at nothing while surfaces keep
      // printing the stale path as proof.
      fail(
        `open-path-policy.fixtures: ${JSON.stringify(row.profile)} names evidence that does not exist: ${row.evidence}`,
      );
    }
    const isKids = row.profile === openPathFixtures.refuseOnlyProfile;
    if (isKids && (row.demoLevel !== "refuse-only" || row.sessionKind !== "none")) {
      fail(
        "open-path-policy.fixtures: the refuse-only profile must stay refuse-only with sessionKind none",
      );
    }
    if (
      isKids &&
      (!Array.isArray(row.operations) || row.operations.length !== 0)
    ) {
      fail(
        "open-path-policy.fixtures: the refuse-only profile must declare an empty operation set",
      );
    }
  }

  if (openPathDocHasContent) {
    const actual = documentBlock({
      document: openPathDoc,
      documentPath: openPathDocPath,
      start: OPEN_PATH_DOC_START,
      end: OPEN_PATH_DOC_END,
    });
    if (actual !== undefined) {
      const expected = [
        "| profile | demo level | session kind | operations | evidence | shipping claim |",
        "|---|---|---|---|---|---|",
        ...profiles.map((row) => {
          const operations =
            Array.isArray(row.operations) && row.operations.length > 0
              ? row.operations.map((op) => `\`${op}\``).join(", ")
              : "—";
          return `| \`${row.profile}\` | \`${row.demoLevel}\` | \`${row.sessionKind}\` | ${operations} | \`${row.evidence}\` | \`${row.shippingClaim}\` |`;
        }),
      ].join("\n");
      if (actual !== expected) {
        fail(
          "docs/open-path-policy.md: policy table does not exactly match open-path-policy.fixtures.json (profile, demo level, session kind, operations, evidence, shipping claim columns in order)",
        );
      }
    }

    if (!openPathDoc.includes("open-path-policy.fixtures.json")) {
      fail(
        "docs/open-path-policy.md: does not name the canonical open-path policy fixture path",
      );
    }
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`contract check FAIL: ${e}`);
  console.error(`contract check FAILED — ${errors.length} error(s)`);
  process.exit(1);
}
console.log(
  `contract check OK — ${authoringJobCount} shared authoring jobs valid, doc table matches, E1+E2 bound to one list; plugin capability registry 1.0.0 seed pinned to ${REGISTRY_SEED_ENTRIES.length} reviewed capability and schema-locked; plugin-manifest inert example schema-locked; ${creditPackCount} test-mode credit packs schema-locked, doc-bound, and bundled-module-bound; ${entitlementCapabilityCount} entitlement capabilities schema-locked, free path intact, doc-bound; ${listingCount} test-mode catalog listings schema-locked, all price modes covered, doc-bound, and bundled-module-bound; ${openPathProfileCount} open-path policy rows schema-locked, no shipping claim, Kids refuse-only, doc-bound`,
);
