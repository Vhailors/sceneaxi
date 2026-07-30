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
const MODULE_REL = "packages/schemas/src/credit-packs.data.ts";

interface PackCatalog {
  schemaVersion: number;
  mode: string;
  currentRevisionIds: string[];
  packRevisions: {
    revisionId: string;
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
    expect(res.stdout).toContain(
      "credit packs schema-locked, doc-bound, and bundled-module-bound",
    );
    expect(res.status).toBe(0);
  });

  it("fails when the bundled module drifts from the fixture", () => {
    const module = readFileSync(join(fx, MODULE_REL), "utf8");
    writeTo(fx, MODULE_REL, module.replace('"credits": 100', '"credits": 101'));

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "bundled credit pack catalog does not exactly match credit-packs.fixtures.json",
    );
  });

  it("fails when an archived economic row changes in both committed copies", () => {
    const catalog = readCatalog(fx);
    catalog.currentRevisionIds = catalog.currentRevisionIds.filter(
      (revisionId) => revisionId !== "starter-v1",
    );
    const starter = catalog.packRevisions.find(
      (revision) => revision.revisionId === "starter-v1",
    );
    if (starter === undefined) throw new Error("fixture has no starter-v1 revision");
    starter.credits = 101;
    writeCatalog(fx, catalog);

    const module = readFileSync(join(fx, MODULE_REL), "utf8")
      .replace('    "starter-v1",\n    "maker-v1"', '    "maker-v1"')
      .replace('"credits": 100', '"credits": 101');
    writeTo(fx, MODULE_REL, module);

    const doc = readFileSync(join(fx, DOC_REL), "utf8");
    writeTo(
      fx,
      DOC_REL,
      doc.replace(
        "| `starter` | `starter-v1` | 100 | 500 USD minor units | `price_test_starter_100` |\n",
        "",
      ),
    );

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'immutable revision "starter-v1" does not match its pinned economic row',
    );
    expect(res.stderr).not.toContain(
      "bundled credit pack catalog does not exactly match credit-packs.fixtures.json",
    );
    expect(res.stderr).not.toContain("credit pack table does not exactly match");
  });

  it("fails when the bundled module stops being a parseable catalog literal", () => {
    writeTo(fx, MODULE_REL, "export const CREDIT_PACK_CATALOG_DATA: unknown = undefined;\n");

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("is not a parseable JSON literal");
  });

  it("still reads the catalog export when the module grows a second frozen export", () => {
    const module = readFileSync(join(fx, MODULE_REL), "utf8");
    writeTo(
      fx,
      MODULE_REL,
      `${module}\nexport const UNRELATED_DATA: unknown = Object.freeze({ note: "}" });\n`,
    );

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.stderr).toBe("");
    expect(res.status).toBe(0);
  });

  it("still detects drift when the module grows a second frozen export", () => {
    const module = readFileSync(join(fx, MODULE_REL), "utf8");
    writeTo(
      fx,
      MODULE_REL,
      `${module.replace('"credits": 100', '"credits": 101')}\nexport const UNRELATED_DATA: unknown = Object.freeze({ note: "}" });\n`,
    );

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "bundled credit pack catalog does not exactly match credit-packs.fixtures.json",
    );
  });

  it("fails when a pack changes in the fixture but not in the doc table", () => {
    const catalog = readCatalog(fx);
    const first = catalog.packRevisions[0];
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
    catalog.currentRevisionIds.push("injected-v1");
    catalog.packRevisions.push({
      revisionId: "injected-v1",
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

  it("fails when two current revisions have the same packId", () => {
    const catalog = readCatalog(fx);
    const first = catalog.packRevisions[0];
    if (first === undefined) throw new Error("fixture has no packs");
    catalog.currentRevisionIds.push("starter-v2");
    catalog.packRevisions.push({
      ...first,
      revisionId: "starter-v2",
      stripePriceId: "price_test_dupe",
    });
    writeCatalog(fx, catalog);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("duplicate packId(s)");
  });

  it("fails on a duplicate stripePriceId", () => {
    const catalog = readCatalog(fx);
    const [first, second] = catalog.packRevisions;
    if (first === undefined || second === undefined) {
      throw new Error("fixture needs at least two packs");
    }
    second.stripePriceId = first.stripePriceId;
    writeCatalog(fx, catalog);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("duplicate stripePriceId(s)");
  });

  it("fails on a duplicate revisionId", () => {
    const catalog = readCatalog(fx);
    const [first, second] = catalog.packRevisions;
    if (first === undefined || second === undefined) {
      throw new Error("fixture needs at least two pack revisions");
    }
    second.revisionId = first.revisionId;
    writeCatalog(fx, catalog);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("duplicate revisionId(s)");
  });

  it("fails when a current revision id does not resolve", () => {
    const catalog = readCatalog(fx);
    catalog.currentRevisionIds[0] = "missing-v1";
    writeCatalog(fx, catalog);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("current revisionId(s) do not resolve");
  });

  it("fails when a live price id is committed", () => {
    const catalog = readCatalog(fx);
    const first = catalog.packRevisions[0];
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
