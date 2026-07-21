#!/usr/bin/env node
/**
 * Contract check — validates the shared authoring-jobs fixture list against its
 * JSON Schema and enforces that the E1/E2 authoring contracts doc binds both
 * contracts to the one canonical list (identical jobs, no per-contract forks).
 * Fail-closed: missing files, schema violations, duplicate ids, or a doc whose
 * fixture table drifts from the canonical JSON all exit 1.
 */
import { readFileSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

const schemaPath = join(root, "packages", "schemas", "contracts", "authoring-jobs.schema.json");
const fixturesPath = join(root, "packages", "schemas", "contracts", "authoring-jobs.fixtures.json");
const docPath = join(root, "docs", "authoring-contracts.md");
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

const schema = load(schemaPath, true);
const fixtures = load(fixturesPath, true);
const doc = load(docPath, false);
const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const schemaIsObject = schema !== loadFailed && isPlainObject(schema);
const fixturesIsObject = fixtures !== loadFailed && isPlainObject(fixtures);
const docHasContent = doc !== loadFailed && doc.trim().length > 0;

if (schema !== loadFailed && !schemaIsObject) {
  fail(`${relative(root, schemaPath)}: expected a plain JSON object`);
}
if (fixtures !== loadFailed && !fixturesIsObject) {
  fail(`${relative(root, fixturesPath)}: expected a plain JSON object`);
}
if (doc !== loadFailed && !docHasContent) {
  fail(`${relative(root, docPath)}: document is empty or whitespace-only`);
}

// --- minimal JSON Schema subset validator (type/required/properties/items/enum/const/pattern/additionalProperties/minItems) ---
const validate = (value, sch, path) => {
  if (sch.const !== undefined && value !== sch.const) {
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
      if (!(key in value)) fail(`${path}: missing required property "${key}"`);
    }
    for (const [key, sub] of Object.entries(value)) {
      const propSchema = (sch.properties ?? {})[key];
      if (propSchema) validate(sub, propSchema, `${path}.${key}`);
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
    if (sch.items) value.forEach((item, i) => validate(item, sch.items, `${path}[${i}]`));
  } else if (sch.type === "string") {
    if (typeof value !== "string") {
      fail(`${path}: expected string`);
      return;
    }
    if (sch.pattern && !new RegExp(sch.pattern).test(value)) {
      fail(`${path}: ${JSON.stringify(value)} does not match pattern ${sch.pattern}`);
    }
  } else if (sch.type === "integer") {
    if (!Number.isInteger(value)) fail(`${path}: expected integer`);
  }
};

if (schemaIsObject && fixturesIsObject) {
  if (typeof schema.$id !== "string" || !schema.$id.includes("authoring-jobs")) {
    fail(`${relative(root, schemaPath)}: $id does not identify the authoring-jobs contract`);
  }
  validate(fixtures, schema, "fixtures");

  const jobs = Array.isArray(fixtures.jobs) ? fixtures.jobs : [];
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

if (errors.length > 0) {
  for (const e of errors) console.error(`contract check FAIL: ${e}`);
  console.error(`contract check FAILED — ${errors.length} error(s)`);
  process.exit(1);
}
console.log(
  `contract check OK — ${fixtures.jobs.length} shared authoring jobs valid, doc table matches, E1+E2 bound to one list`
);
