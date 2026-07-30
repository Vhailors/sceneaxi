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
});
