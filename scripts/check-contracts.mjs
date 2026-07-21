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

const load = (path, parse) => {
  try {
    const text = readFileSync(path, "utf8");
    return parse ? JSON.parse(text) : text;
  } catch (e) {
    fail(`cannot load ${relative(root, path)}: ${e.message}`);
    return null;
  }
};

const schema = load(schemaPath, true);
const fixtures = load(fixturesPath, true);
const doc = load(docPath, false);

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

if (schema && fixtures) {
  if (typeof schema.$id !== "string" || !schema.$id.includes("authoring-jobs")) {
    fail(`${relative(root, schemaPath)}: $id does not identify the authoring-jobs contract`);
  }
  validate(fixtures, schema, "fixtures");

  const ids = (fixtures.jobs ?? []).map((j) => j?.id).filter(Boolean);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) fail(`fixtures: duplicate job id(s): ${[...new Set(dupes)].join(", ")}`);

  // --- doc cross-checks: one shared table matching the JSON, both contracts bound to it ---
  if (doc) {
    const tableMatch = doc.match(/<!-- authoring-jobs:list -->([\s\S]*?)<!-- \/authoring-jobs:list -->/);
    if (!tableMatch) {
      fail("doc: missing <!-- authoring-jobs:list --> ... <!-- /authoring-jobs:list --> shared fixture table markers");
    } else {
      const docIds = [...tableMatch[1].matchAll(/^\|\s*`([a-z0-9-]+)`/gm)].map((m) => m[1]);
      if (docIds.join("\n") !== ids.join("\n")) {
        fail(
          `doc: shared fixture table ids [${docIds.join(", ")}] do not exactly match canonical fixtures [${ids.join(", ")}]`
        );
      }
    }
    for (const contract of ["E1", "E2"]) {
      if (!doc.includes(`<!-- authoring-jobs:bind ${contract} -->`)) {
        fail(`doc: ${contract} section does not bind to the shared fixture list (missing <!-- authoring-jobs:bind ${contract} --> marker)`);
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
