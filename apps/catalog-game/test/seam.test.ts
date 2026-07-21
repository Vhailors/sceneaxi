import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogSurface, seam } from "@sceneaxi/catalog-game";
import type { HumanCurationVerdict } from "@sceneaxi/schemas";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string }; dependencies: Record<string, string> };

const HASH =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("@sceneaxi/catalog-game public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(seam.name).toBe(manifest.name);
    expect(seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
  });

  it("is immutable", () => {
    expect(typeof seam).toBe("object");
    expect(Object.isFrozen(seam)).toBe(true);
    expect(Object.isFrozen(catalogSurface)).toBe(true);
  });

  it("depends only on @sceneaxi/schemas (matrix allow list)", () => {
    expect(Object.keys(manifest.dependencies)).toEqual(["@sceneaxi/schemas"]);
  });

  it("exposes a dormant, topology-neutral surface citing #47/#48 with inert commerce", () => {
    expect(catalogSurface.dormant).toBe(true);
    expect(catalogSurface.topologyNeutral).toBe(true);
    expect(catalogSurface.policyCites.assetPackageInterchange).toContain(
      "factories-helpers/issues/47",
    );
    expect(catalogSurface.policyCites.untrustedAssetIngestion).toContain(
      "factories-helpers/issues/48",
    );
    expect(catalogSurface.commerceGate.status).toBe("inert");
  });

  it("runs the shared pipeline stub without activating commerce", () => {
    const item = catalogSurface.createCatalogItemAtIntake({
      itemId: "game-fixture-asset",
      assetPackage: { packageId: "pkg-game-fixture", contentHash: HASH },
      rights: {
        license: "CC0-1.0",
        rightsHolder: "Fixture",
        commercialUseAllowed: true,
      },
      provenance: {
        origin: "fixture",
        ingestedAt: "2026-07-21T12:00:00.000Z",
        sourceDigest: HASH,
      },
      aiGenerationDisclosure: {
        aiGenerated: false,
        disclosureText: "Hand-authored fixture; no generative AI.",
      },
      compatibility: { coreRange: "^0.0.0", profiles: ["game"] },
      commerce: { price: { amount: "1.00", currency: "USD" } },
    });

    const screening = catalogSurface.transitionCatalogItem(item, {
      to: "screening",
      reason: "quarantine ok",
    });
    expect(screening.ok).toBe(true);
    if (!screening.ok) return;

    const curation = catalogSurface.transitionCatalogItem(screening.item, {
      to: "curation",
      reason: "screening ok",
    });
    expect(curation.ok).toBe(true);
    if (!curation.ok) return;

    const verdict: HumanCurationVerdict = {
      kind: "human",
      decision: "approve",
      curatorId: "game-curator",
      rationale: "ok",
      recordedAt: "2026-07-21T13:00:00.000Z",
    };
    const listed = catalogSurface.transitionCatalogItem(curation.item, {
      to: "listed",
      reason: "human approved",
      humanVerdict: verdict,
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;

    const commerce = catalogSurface.attemptCommerceActivation(listed.item);
    expect(commerce.ok).toBe(false);
    expect(commerce.code).toBe("commerce-inert");
  });
});
