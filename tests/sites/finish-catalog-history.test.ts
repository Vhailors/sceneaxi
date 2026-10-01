import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { browseSiteCatalog, listSiteCatalog, createSitePurchaseHistoryPort, ok } from "@sceneaxi/site-kit";

describe("bounded catalog GET browse", () => {
  for (const surface of ["catalog-game", "catalog-web"] as const) {
    it(`${surface} searches title/id/creator and filters exact modes without mutating inventory`, () => {
      const all = listSiteCatalog(surface);

      for (const item of all) {
        for (const q of [item.title.toUpperCase(), item.itemId, item.creatorId]) expect(browseSiteCatalog(surface, { q })).toContain(item);
        expect(browseSiteCatalog(surface, { price: item.priceMode })).toContain(item);
      }

      expect(browseSiteCatalog(surface, { q: "no-matching-item-xyz" })).toEqual([]);
      expect(browseSiteCatalog(surface)).toEqual(all);
    });
    it(`${surface} sorts deterministically with item-id tie breaks`, () => {
      for (const sort of ["title", "newest"] as const) {
        const expected = [...listSiteCatalog(surface)].sort((a, b) => {
          const left = sort === "title" ? a.title : b.publishedAt;
          const right = sort === "title" ? b.title : a.publishedAt;

          return left < right ? -1 : left > right ? 1 : a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0;
        });

        expect(browseSiteCatalog(surface, { sort })).toEqual(expected);
      }
    });
    it(`${surface} has mirrored labelled GET controls and accessible empty state`, () => {
      const source = readFileSync(`sites/${surface}/src/app/page.tsx`, "utf8");
      expect(source).toContain('method="get"');expect(source).toContain('maxLength={100}');expect(source).toContain('role="status"');

      for (const name of ["q", "price", "sort"]) expect(source).toContain(`name="${name}"`);
      expect(source).toContain('browseSiteCatalog(CATALOG_SITE_SURFACE, params)');
    });
  }

  it.each([{ q: " ".repeat(101) }, { q: ["x", "y"] }, { sort: "money" }, { price: "free" }, { userId: "forged" }])("refuses unbounded/duplicate/unsupported query %j", params => {
    expect(() => browseSiteCatalog("catalog-game", params)).toThrow("CATALOG_BROWSE_QUERY_INVALID");
  });
});

describe("history contract", () => {
  it("is bounded and Kids/forged-user requests never reach an adapter", async () => {
    let calls = 0;

    const port = createSitePurchaseHistoryPort(async () => { calls++;

 return ok({ purchases: [], reconciliationTruncated: false }); });

    for (const request of [{ surface: "kids" }, { surface: "site", limit: 51 }, { surface: "site", userId: "victim" }, { surface: "site", before: { createdAt: "invalid", intentId: "x" } }]) {
      // SAFETY: this deliberately invalid fixture is passed only to the port request validator; refusal and zero adapter calls are asserted below.
      expect((await port.read(request as never)).ok).toBe(false);
    }

    expect(calls).toBe(0);
    expect(await port.read({ surface: "site", limit: 1 })).toEqual({ ok: true, value: { purchases: [], reconciliationTruncated: false } });
  });
  it("refuses absent persistence, thrown provider and invalid output", async () => {
    expect(await createSitePurchaseHistoryPort().read({ surface: "site" })).toMatchObject({ ok: false, reason: "BILLING_PLANE_NOT_WIRED" });
    expect(await createSitePurchaseHistoryPort(async () => { throw new Error("private"); }).read({ surface: "site" })).toMatchObject({ ok: false, reason: "BILLING_PLANE_UNAVAILABLE" });
    // SAFETY: the deliberately incomplete purchase is adapter test data; the port validates output and this assertion requires its named refusal.
    expect(await createSitePurchaseHistoryPort(async () => ok({ purchases: [ {} ] as never, reconciliationTruncated: false })).read({ surface: "site" })).toMatchObject({ ok: false, reason: "BILLING_ADAPTER_OUTPUT_INVALID" });
  });
});
