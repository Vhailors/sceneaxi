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

  it("deep-freezes the shared fixture item", () => {
    expect(Object.isFrozen(listedFixtureItem)).toBe(true);
    expect(Object.isFrozen(listedFixtureItem.assetPackage)).toBe(true);
    expect(Object.isFrozen(listedFixtureItem.rights)).toBe(true);
    expect(Object.isFrozen(listedFixtureItem.provenance)).toBe(true);
    expect(Object.isFrozen(listedFixtureItem.aiGenerationDisclosure)).toBe(true);
    expect(Object.isFrozen(listedFixtureItem.compatibility)).toBe(true);
    expect(Object.isFrozen(listedFixtureItem.compatibility.profiles)).toBe(true);
    expect(Object.isFrozen(listedFixtureItem.moderation)).toBe(true);
    expect(Object.isFrozen(listedFixtureItem.moderation.history)).toBe(true);
    expect(Object.isFrozen(listedFixtureItem.moderation.history[2])).toBe(true);
    expect(
      Object.isFrozen(
        listedFixtureItem.moderation.history[2]?.humanVerdict,
      ),
    ).toBe(true);
    expect(Object.isFrozen(listedFixtureItem.commerce)).toBe(true);
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
