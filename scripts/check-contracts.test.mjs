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
const checkerRelativePath = join("scripts", "check-contracts.mjs");
const sourcePaths = [docRelativePath, fixturesRelativePath, schemaRelativePath, checkerRelativePath];

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
const readFixtures = (sandbox) => JSON.parse(readFileSync(join(sandbox, fixturesRelativePath), "utf8"));
const writeFixtures = (sandbox, fixtures) =>
  writeFileSync(join(sandbox, fixturesRelativePath), `${JSON.stringify(fixtures, null, 2)}\n`);
const writeRawJson = (sandbox, relativePath, value) =>
  writeFileSync(join(sandbox, relativePath), `${JSON.stringify(value)}\n`);

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
