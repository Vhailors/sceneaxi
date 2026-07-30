import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("@sceneaxi/schemas");
  vi.resetModules();
});

describe("committed credit pack archive", () => {
  it("keeps an in-flight revision resolvable after the current pack is repriced", async () => {
    vi.resetModules();
    vi.doMock("@sceneaxi/schemas", async () => {
      const actual = await vi.importActual<typeof import("@sceneaxi/schemas")>(
        "@sceneaxi/schemas",
      );
      return {
        ...actual,
        CREDIT_PACK_CATALOG_DATA: Object.freeze({
          schemaVersion: 1,
          mode: "test",
          currentRevisionIds: ["starter-v2"],
          packRevisions: [
            {
              revisionId: "starter-v1",
              packId: "starter",
              credits: 100,
              unitAmount: 500,
              currency: "usd",
              stripePriceId: "price_test_starter_v1",
            },
            {
              revisionId: "starter-v2",
              packId: "starter",
              credits: 120,
              unitAmount: 600,
              currency: "usd",
              stripePriceId: "price_test_starter_v2",
            },
          ],
        }),
      };
    });

    const { loadCreditPackCatalog, resolveCreditPackRevision } = await import(
      "../src/credit-packs.js"
    );

    const current = loadCreditPackCatalog();
    expect(current).toMatchObject({
      ok: true,
      value: {
        packs: [
          {
            packId: "starter",
            credits: 120,
            unitAmount: 600,
            stripePriceId: "price_test_starter_v2",
          },
        ],
      },
    });

    const historical = resolveCreditPackRevision(
      "starter",
      "price_test_starter_v1",
      500,
    );
    expect(historical).toMatchObject({
      ok: true,
      value: {
        revisionId: "starter-v1",
        packId: "starter",
        credits: 100,
        unitAmount: 500,
        stripePriceId: "price_test_starter_v1",
      },
    });
  });

  it("keeps a retired pack revision resolvable outside the current catalog", async () => {
    vi.resetModules();
    vi.doMock("@sceneaxi/schemas", async () => {
      const actual = await vi.importActual<typeof import("@sceneaxi/schemas")>(
        "@sceneaxi/schemas",
      );
      return {
        ...actual,
        CREDIT_PACK_CATALOG_DATA: Object.freeze({
          schemaVersion: 1,
          mode: "test",
          currentRevisionIds: ["maker-v1", "studio-v1"],
          packRevisions: [
            {
              revisionId: "starter-v1",
              packId: "starter",
              credits: 100,
              unitAmount: 500,
              currency: "usd",
              stripePriceId: "price_test_starter_100",
            },
            {
              revisionId: "maker-v1",
              packId: "maker",
              credits: 500,
              unitAmount: 2000,
              currency: "usd",
              stripePriceId: "price_test_maker_500",
            },
            {
              revisionId: "studio-v1",
              packId: "studio",
              credits: 2000,
              unitAmount: 7000,
              currency: "usd",
              stripePriceId: "price_test_studio_2000",
            },
          ],
        }),
      };
    });

    const { loadCreditPackCatalog, resolveCreditPackRevision } = await import(
      "../src/credit-packs.js"
    );

    const current = loadCreditPackCatalog();
    expect(current.ok).toBe(true);
    if (!current.ok) throw new Error(current.message);
    expect(current.value.packs.map((pack) => pack.packId)).toEqual([
      "maker",
      "studio",
    ]);

    const historical = resolveCreditPackRevision(
      "starter",
      "price_test_starter_100",
      500,
    );
    expect(historical).toMatchObject({
      ok: true,
      value: {
        revisionId: "starter-v1",
        packId: "starter",
        credits: 100,
        unitAmount: 500,
        stripePriceId: "price_test_starter_100",
      },
    });
  });
});
