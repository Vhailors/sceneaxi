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
 * Injected-drift regressions for the catalog-listing lockstep surface of
 * check-contracts.mjs.
 *
 * The checker validates the JSON Schema price-mode rule and re-states it with
 * targeted fixture errors. It also insists all three price modes stay covered,
 * so a regression cannot pass by deleting the listing shape it broke.
 */

const FIXTURES_REL = "packages/schemas/contracts/catalog-listings.fixtures.json";
const DOC_REL = "docs/auth-credits.md";
const MODULE_REL = "packages/schemas/src/catalog-listings.data.ts";

interface ListingFixture {
  schemaVersion: number;
  mode: string;
  listings: Record<string, unknown>[];
}

const readListings = (root: string): ListingFixture =>
  JSON.parse(readFileSync(join(root, FIXTURES_REL), "utf8")) as ListingFixture;

const writeListings = (root: string, value: ListingFixture): void => {
  writeTo(root, FIXTURES_REL, `${JSON.stringify(value, null, 2)}\n`);
};

const listingAt = (value: ListingFixture, listingId: string) => {
  const found = value.listings.find((entry) => entry["listingId"] === listingId);
  if (found === undefined) throw new Error(`fixture has no ${listingId}`);
  return found;
};

describe("contract check — injected catalog-listing drift", () => {
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
    expect(res.stdout).toContain("catalog listings schema-locked");
    expect(res.stdout).toContain("all price modes covered");
    expect(res.stdout).toContain("doc-bound, and bundled-module-bound");
    expect(res.status).toBe(0);
  });

  it("fails when the bundled module drifts from the fixture", () => {
    const module = readFileSync(join(fx, MODULE_REL), "utf8");
    writeTo(
      fx,
      MODULE_REL,
      module.replace('"creditPrice": 40', '"creditPrice": 41'),
    );

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "bundled catalog listing set does not exactly match catalog-listings.fixtures.json",
    );
  });

  it("fails when the bundled module stops being a parseable listing literal", () => {
    writeTo(
      fx,
      MODULE_REL,
      "export const CATALOG_LISTINGS_DATA: unknown = undefined;\n",
    );

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("is not a parseable JSON literal");
  });

  it("fails when a listing price changes in the fixture but not in the doc table", () => {
    const value = readListings(fx);
    listingAt(value, "lantern-prop")["creditPrice"] = 41;
    writeListings(fx, value);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "catalog listing table does not exactly match",
    );
  });

  it("fails when a credits-only listing gains a dormant money price", () => {
    const value = readListings(fx);
    listingAt(value, "lantern-prop")["moneyPrice"] = {
      unitAmount: 500,
      currency: "usd",
      stripePriceId: "price_test_sneaky",
    };
    writeListings(fx, value);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("forbids moneyPrice");
  });

  it("fails when a credits listing loses its credit price", () => {
    const value = readListings(fx);
    const target = listingAt(value, "lantern-prop");
    value.listings = value.listings.map((entry) =>
      entry === target
        ? Object.fromEntries(
            Object.entries(entry).filter(([name]) => name !== "creditPrice"),
          )
        : entry,
    );
    writeListings(fx, value);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("requires creditPrice");
  });

  it("fails when a listed price is not positive", () => {
    const value = readListings(fx);
    listingAt(value, "lantern-prop")["creditPrice"] = 0;
    writeListings(fx, value);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("expected integer >= 1");
  });

  it("fails when a price mode stops being covered", () => {
    const value = readListings(fx);
    value.listings = value.listings.filter(
      (entry) => entry["priceMode"] !== "money",
    );
    writeListings(fx, value);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('no listing exercises priceMode "money"');
  });

  it("fails on a duplicate listing id", () => {
    const value = readListings(fx);
    value.listings.push({
      ...listingAt(value, "lantern-prop"),
      title: "Duplicate",
    });
    writeListings(fx, value);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("duplicate listingId(s)");
  });

  it("fails when a live price id is committed", () => {
    const value = readListings(fx);
    (
      listingAt(value, "harbour-diorama")["moneyPrice"] as {
        stripePriceId: string;
      }
    ).stripePriceId = "price_live_harbour";
    writeListings(fx, value);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("does not match pattern");
  });

  it("fails when the listing set claims live mode", () => {
    const value = readListings(fx);
    value.mode = "live";
    writeListings(fx, value);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("contract check FAILED");
  });

  it("fails when the doc lockstep markers are missing", () => {
    const doc = readFileSync(join(fx, DOC_REL), "utf8");
    writeTo(fx, DOC_REL, doc.replaceAll("<!-- catalog-listings:list -->", ""));

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("catalog-listings:list");
  });

  it("fails when the doc stops naming the canonical fixture path", () => {
    const doc = readFileSync(join(fx, DOC_REL), "utf8");
    writeTo(
      fx,
      DOC_REL,
      doc.replaceAll("catalog-listings.fixtures.json", "elsewhere.json"),
    );

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "does not name the canonical catalog listing fixture path",
    );
  });
});
