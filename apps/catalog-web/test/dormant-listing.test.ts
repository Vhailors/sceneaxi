import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
      curatorId: "Vhailors",
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

  it("ties source provenance and human approval to committed fixture records", () => {
    const sourcePath = new URL(
      "../../../tests/e2e/fixtures/golden-project.ts",
      import.meta.url,
    );
    const approvalPath = new URL(
      "../fixtures/web-golden-fixture.human-verdict.json",
      import.meta.url,
    );
    const sourceDigest = `sha256:${createHash("sha256")
      .update(readFileSync(sourcePath))
      .digest("hex")}`;
    const approval: unknown = JSON.parse(readFileSync(approvalPath, "utf8"));

    expect(listedFixtureItem.provenance).toMatchObject({
      origin: "tests/e2e/fixtures/golden-project.ts",
      sourceDigest,
    });
    expect(listedFixtureItem.assetPackage.contentHash).toBe(sourceDigest);
    expect(listedFixtureItem.moderation.history[2]?.humanVerdict).toEqual(
      approval,
    );
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
    expect(listedFixtureItem.rights).toMatchObject({
      license: "CC-BY-4.0",
      commercialUseAllowed: true,
    });
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
