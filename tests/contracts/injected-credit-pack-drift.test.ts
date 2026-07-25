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
 * Injected-drift regressions for the credit-pack lockstep surface of
 * check-contracts.mjs. Each test copies the real tree, injects one drift, and
 * proves the checker fails closed on exactly that drift. The control test
 * proves the clean copy passes, so every failure below is caused by its
 * injection alone — the same pattern as tests/boundary and tests/syntax.
 */

const FIXTURES_REL = "packages/schemas/contracts/credit-packs.fixtures.json";
const DOC_REL = "docs/auth-credits.md";

interface PackCatalog {
  schemaVersion: number;
  mode: string;
  packs: {
    packId: string;
    credits: number;
    unitAmount: number;
    currency: string;
    stripePriceId: string;
  }[];
}

const readCatalog = (root: string): PackCatalog =>
  JSON.parse(readFileSync(join(root, FIXTURES_REL), "utf8")) as PackCatalog;

const writeCatalog = (root: string, catalog: PackCatalog): void => {
  writeTo(root, FIXTURES_REL, `${JSON.stringify(catalog, null, 2)}\n`);
};

describe("contract check — injected credit-pack drift", () => {
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
    expect(res.stdout).toContain("contract check OK");
    expect(res.stdout).toContain("credit packs schema-locked and doc-bound");
    expect(res.status).toBe(0);
  });

  it("fails when a pack changes in the fixture but not in the doc table", () => {
    const catalog = readCatalog(fx);
    const first = catalog.packs[0];
    if (first === undefined) throw new Error("fixture has no packs");
    first.credits += 1;
    writeCatalog(fx, catalog);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("contract check FAILED");
    expect(res.stderr).toContain("credit pack table does not exactly match");
  });

  it("fails when a pack is added to the fixture but not to the doc table", () => {
    const catalog = readCatalog(fx);
    catalog.packs.push({
      packId: "injected",
      credits: 1,
      unitAmount: 1,
      currency: "usd",
      stripePriceId: "price_test_injected",
    });
    writeCatalog(fx, catalog);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("credit pack table does not exactly match");
  });

  it("fails on a duplicate packId", () => {
    const catalog = readCatalog(fx);
    const first = catalog.packs[0];
    if (first === undefined) throw new Error("fixture has no packs");
    catalog.packs.push({ ...first, stripePriceId: "price_test_dupe" });
    writeCatalog(fx, catalog);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("duplicate packId(s)");
  });

  it("fails on a duplicate stripePriceId", () => {
    const catalog = readCatalog(fx);
    const [first, second] = catalog.packs;
    if (first === undefined || second === undefined) {
      throw new Error("fixture needs at least two packs");
    }
    second.stripePriceId = first.stripePriceId;
    writeCatalog(fx, catalog);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("duplicate stripePriceId(s)");
  });

  it("fails when a live price id is committed", () => {
    const catalog = readCatalog(fx);
    const first = catalog.packs[0];
    if (first === undefined) throw new Error("fixture has no packs");
    first.stripePriceId = "price_live_starter_100";
    writeCatalog(fx, catalog);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("is not a test-mode id");
  });

  it("fails when the catalog claims live mode", () => {
    const catalog = readCatalog(fx);
    catalog.mode = "live";
    writeCatalog(fx, catalog);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("contract check FAILED");
  });

  it("fails when the doc lockstep markers are missing", () => {
    const doc = readFileSync(join(fx, DOC_REL), "utf8");
    writeTo(fx, DOC_REL, doc.replaceAll("<!-- credit-packs:list -->", ""));

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("credit-packs:list");
  });

  it("fails when the doc stops naming the canonical fixture path", () => {
    const doc = readFileSync(join(fx, DOC_REL), "utf8");
    writeTo(fx, DOC_REL, doc.replaceAll("credit-packs.fixtures.json", "elsewhere.json"));

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "does not name the canonical credit pack fixture path",
    );
  });

  it("fails when the fixture file is deleted", () => {
    writeTo(fx, FIXTURES_REL, "not json");

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("contract check FAILED");
  });
});
