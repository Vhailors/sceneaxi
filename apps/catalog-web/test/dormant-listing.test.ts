import { describe, expect, it } from "vitest";
import {
  attemptCatalogMarketplacePublish,
  attemptCatalogPurchase,
  listCatalogItems,
  listedFixtureItem,
  showCatalogItem,
} from "@sceneaxi/catalog-web";

describe("catalog-web dormant MVP pipeline", () => {
  it("lists and shows exactly one deterministic fixture item", () => {
    expect(listCatalogItems()).toEqual([listedFixtureItem]);
    expect(listCatalogItems()).toHaveLength(1);
    expect(listedFixtureItem.moderation.pipelineState).toBe("listed");
    expect(listedFixtureItem.moderation.history).toHaveLength(3);
    expect(listedFixtureItem.moderation.history[2]?.humanVerdict).toMatchObject({
      kind: "human",
      decision: "approve",
      curatorId: "fixture-human-curator",
    });
    expect(showCatalogItem("web-golden-fixture")).toEqual({
      ok: true,
      item: listedFixtureItem,
    });
    expect(showCatalogItem("missing-fixture")).toMatchObject({
      ok: false,
      code: "catalog-item-not-found",
    });
  });

  it("keeps commerce, purchase, billing, and marketplace publish disabled", () => {
    expect(listedFixtureItem.commerce.activation).toBe("inert");
    expect(attemptCatalogPurchase(listedFixtureItem.itemId)).toMatchObject({
      ok: false,
      code: "catalog-purchase-disabled",
    });
    expect(
      attemptCatalogMarketplacePublish(listedFixtureItem.itemId),
    ).toMatchObject({
      ok: false,
      code: "catalog-marketplace-publish-disabled",
    });
  });
});
