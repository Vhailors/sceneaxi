import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  makeFixture,
  removeFixture,
  runCheck,
  writeTo,
} from "../helpers/fixture.ts";

/**
 * Injected-drift regressions for the entitlement-matrix lockstep surface of
 * check-contracts.mjs.
 *
 * The free-vs-paid boundary is a captain product decision, so the checker does
 * not merely verify that the doc and the JSON agree — it independently refuses
 * any change that would put an account or a price on the three free-path
 * capabilities, or that would move the starter grant off 100. These tests prove
 * that guard fires, so the boundary cannot be edited quietly in either file.
 */

const FIXTURES_REL =
  "packages/schemas/contracts/entitlement-matrix.fixtures.json";
const DOC_REL = "docs/auth-credits.md";

interface MatrixFixture {
  schemaVersion: number;
  starterCreditGrant: number;
  capabilities: {
    capability: string;
    accountRequired: boolean;
    price: string;
  }[];
}

const readMatrix = (root: string): MatrixFixture =>
  JSON.parse(readFileSync(join(root, FIXTURES_REL), "utf8")) as MatrixFixture;

const writeMatrix = (root: string, matrix: MatrixFixture): void => {
  writeTo(root, FIXTURES_REL, `${JSON.stringify(matrix, null, 2)}\n`);
};

const entryFor = (matrix: MatrixFixture, capability: string) => {
  const found = matrix.capabilities.find(
    (entry) => entry.capability === capability,
  );
  if (found === undefined) throw new Error(`fixture has no ${capability}`);
  return found;
};

describe("contract check — injected entitlement-matrix drift", () => {
  let fx: string;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    removeFixture(fx);
  });

  it("control: the unmodified tree passes", () => {
    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.stderr).toBe("");
    expect(res.stdout).toContain("entitlement capabilities schema-locked");
    expect(res.stdout).toContain("free path intact");
    expect(res.status).toBe(0);
  });

  it("fails when the matrix changes in the fixture but not in the doc table", () => {
    const matrix = readMatrix(fx);
    entryFor(matrix, "hosted-ai-assistant").price = "money";
    writeMatrix(fx, matrix);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "entitlement matrix table does not exactly match",
    );
  });

  it("fails when a free-path capability is made to require an account", () => {
    for (const capability of [
      "engine-sdk-download",
      "cli-authoring",
      "byo-model-keys",
    ]) {
      const local = makeFixture();
      try {
        const matrix = readMatrix(local);
        entryFor(matrix, capability).accountRequired = true;
        writeMatrix(local, matrix);

        const res = runCheck(local, "check-contracts.mjs");
        expect(res.status).toBe(1);
        expect(res.stderr).toContain(
          `"${capability}" must stay accountRequired false and price free`,
        );
      } finally {
        removeFixture(local);
      }
    }
  });

  it("fails when a free-path capability is given a price", () => {
    const matrix = readMatrix(fx);
    entryFor(matrix, "byo-model-keys").price = "credits";
    writeMatrix(fx, matrix);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      '"byo-model-keys" must stay accountRequired false and price free',
    );
  });

  it("fails when a free-path capability is removed entirely", () => {
    const matrix = readMatrix(fx);
    matrix.capabilities = matrix.capabilities.filter(
      (entry) => entry.capability !== "cli-authoring",
    );
    writeMatrix(fx, matrix);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'free-path capability "cli-authoring" is missing',
    );
  });

  it("fails when the starter grant moves off the captain-frozen 100", () => {
    const matrix = readMatrix(fx);
    matrix.starterCreditGrant = 250;
    writeMatrix(fx, matrix);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("starterCreditGrant must be 100");
  });

  it("fails on a duplicate capability id", () => {
    const matrix = readMatrix(fx);
    matrix.capabilities.push({
      ...entryFor(matrix, "hosted-ai-assistant"),
      price: "money",
    });
    writeMatrix(fx, matrix);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("duplicate capability id(s)");
  });

  it("fails on a non-boolean accountRequired, now that the subset checks booleans", () => {
    const matrix = readMatrix(fx);
    (entryFor(matrix, "hosted-ai-assistant") as unknown as {
      accountRequired: unknown;
    }).accountRequired = "true";
    writeMatrix(fx, matrix);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("expected boolean");
  });

  it("fails when the doc lockstep markers are missing", () => {
    const doc = readFileSync(join(fx, DOC_REL), "utf8");
    writeTo(fx, DOC_REL, doc.replaceAll("<!-- /entitlement-matrix:list -->", ""));

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("entitlement-matrix:list");
  });

  it("fails when the doc stops naming the canonical fixture path", () => {
    const doc = readFileSync(join(fx, DOC_REL), "utf8");
    writeTo(
      fx,
      DOC_REL,
      doc.replaceAll("entitlement-matrix.fixtures.json", "elsewhere.json"),
    );

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "does not name the canonical entitlement matrix fixture path",
    );
  });
});
