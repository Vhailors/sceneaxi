import { describe, expect, it } from "vitest";
import {
  CATALOG_ITEM_SCHEMA_VERSION,
  CATALOG_POLICY_CITES,
  COMMERCE_ACTIVATION_GATE,
  attemptCommerceActivation,
  createCatalogItemAtIntake,
  isCommerceActive,
  legalSuccessors,
  missingMandatoryMetadata,
  transitionCatalogItem,
  type CatalogItem,
  type HumanCurationVerdict,
  type PipelineState,
} from "@sceneaxi/schemas";

const HASH =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function syntheticAsset(
  overrides: Partial<Parameters<typeof createCatalogItemAtIntake>[0]> = {},
): CatalogItem {
  return createCatalogItemAtIntake({
    itemId: "synth-prop-crate",
    assetPackage: {
      packageId: "pkg-prop-crate",
      contentHash: HASH,
    },
    rights: {
      license: "CC-BY-4.0",
      rightsHolder: "Synthetic Studio",
      commercialUseAllowed: true,
    },
    provenance: {
      origin: "synthetic-fixture",
      ingestedAt: "2026-07-21T12:00:00.000Z",
      sourceDigest: HASH,
    },
    aiGenerationDisclosure: {
      aiGenerated: true,
      tools: ["fixture-generator"],
      disclosureText: "Generated as a synthetic test asset; not production content.",
    },
    compatibility: {
      coreRange: "^0.0.0",
      profiles: ["game"],
    },
    ...overrides,
  });
}

const approveVerdict = (): HumanCurationVerdict => ({
  kind: "human",
  decision: "approve",
  curatorId: "curator-fixture-1",
  rationale: "Passes craft and rights review for listing.",
  recordedAt: "2026-07-21T13:00:00.000Z",
});

/** Drive the full legal happy path for a synthetic asset. */
function advanceToListed(item: CatalogItem): CatalogItem {
  const toScreening = transitionCatalogItem(item, {
    to: "screening",
    reason: "Quarantine intake complete under #48 controls (stub).",
    at: "2026-07-21T12:10:00.000Z",
  });
  expect(toScreening.ok).toBe(true);
  if (!toScreening.ok) throw new Error("expected screening");

  const toCuration = transitionCatalogItem(toScreening.item, {
    to: "curation",
    reason: "Rights, provenance, and AI-disclosure screening passed.",
    at: "2026-07-21T12:20:00.000Z",
  });
  expect(toCuration.ok).toBe(true);
  if (!toCuration.ok) throw new Error("expected curation");

  const toListed = transitionCatalogItem(toCuration.item, {
    to: "listed",
    reason: "Human curator approved listing.",
    at: "2026-07-21T13:05:00.000Z",
    humanVerdict: approveVerdict(),
  });
  expect(toListed.ok).toBe(true);
  if (!toListed.ok) throw new Error("expected listed");
  return toListed.item;
}

describe("Catalog Item contract + policy cites", () => {
  it("versions the Catalog Item contract and cites factories-helpers #47 and #48", () => {
    const item = syntheticAsset();
    expect(item.schemaVersion).toBe(CATALOG_ITEM_SCHEMA_VERSION);
    expect(CATALOG_ITEM_SCHEMA_VERSION).toBe(1);
    expect(CATALOG_POLICY_CITES.assetPackageInterchange).toContain(
      "factories-helpers/issues/47",
    );
    expect(CATALOG_POLICY_CITES.untrustedAssetIngestion).toContain(
      "factories-helpers/issues/48",
    );
  });

  it("starts at intake (quarantine) with empty history and inert commerce", () => {
    const item = syntheticAsset({
      commerce: { price: { amount: "9.99", currency: "USD" }, sku: "SKU-1" },
    });
    expect(item.moderation.pipelineState).toBe("intake");
    expect(item.moderation.history).toEqual([]);
    expect(item.commerce.activation).toBe("inert");
    expect(item.commerce.price).toEqual({ amount: "9.99", currency: "USD" });
    expect(item.commerce.sku).toBe("SKU-1");
  });

  it("carries rights, provenance, mandatory AI disclosure, compatibility, moderation", () => {
    const item = syntheticAsset();
    expect(item.rights.license).toBeTruthy();
    expect(item.provenance.origin).toBeTruthy();
    expect(item.aiGenerationDisclosure.disclosureText).toBeTruthy();
    expect(item.compatibility.coreRange).toBeTruthy();
    expect(item.compatibility.profiles.length).toBeGreaterThan(0);
    expect(item.moderation.pipelineState).toBe("intake");
  });
});

describe("fail-closed catalog pipeline state machine", () => {
  it("moves a synthetic asset intake → screening → curation → listed → delisted with recorded reasons", () => {
    const listed = advanceToListed(syntheticAsset());
    expect(listed.moderation.pipelineState).toBe("listed");
    expect(listed.moderation.history.map((t) => `${t.from}->${t.to}`)).toEqual([
      "intake->screening",
      "screening->curation",
      "curation->listed",
    ]);
    for (const step of listed.moderation.history) {
      expect(step.reason.trim().length).toBeGreaterThan(0);
      expect(step.at).toBeTruthy();
    }
    expect(listed.moderation.history[2]?.humanVerdict?.kind).toBe("human");
    expect(listed.moderation.history[2]?.humanVerdict?.decision).toBe("approve");

    const delisted = transitionCatalogItem(listed, {
      to: "delisted",
      reason: "Takedown: fixture end-of-life.",
      at: "2026-07-21T14:00:00.000Z",
    });
    expect(delisted.ok).toBe(true);
    if (!delisted.ok) return;
    expect(delisted.item.moderation.pipelineState).toBe("delisted");
    expect(delisted.item.moderation.history).toHaveLength(4);
    expect(delisted.item.moderation.history[3]?.reason).toContain("Takedown");
  });

  it("refuses illegal transitions (fail-closed)", () => {
    const item = syntheticAsset();
    const illegal: Array<{ from: PipelineState; to: PipelineState }> = [
      { from: "intake", to: "listed" },
      { from: "intake", to: "curation" },
      { from: "intake", to: "delisted" },
      { from: "screening", to: "listed" },
      { from: "screening", to: "intake" },
      { from: "curation", to: "screening" },
      { from: "listed", to: "curation" },
      { from: "delisted", to: "listed" },
    ];

    for (const { from, to } of illegal) {
      const seeded: CatalogItem = {
        ...item,
        moderation: { pipelineState: from, history: [] },
      };
      const result = transitionCatalogItem(
        seeded,
        to === "listed"
          ? { to, reason: "attempt illegal", humanVerdict: approveVerdict() }
          : { to, reason: "attempt illegal" },
      );
      expect(result.ok, `${from}→${to}`).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("illegal-transition");
      }
    }
  });

  it("refuses transitions without a reason", () => {
    const result = transitionCatalogItem(syntheticAsset(), {
      to: "screening",
      reason: "   ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missing-reason");
  });

  it("refuses listing without a human curation verdict (never simulated)", () => {
    const listed = advanceToListed(syntheticAsset());
    // rewind conceptually: take a curation-state item without using auto-list
    const atCuration: CatalogItem = {
      ...listed,
      moderation: {
        pipelineState: "curation",
        history: listed.moderation.history.slice(0, 2),
      },
    };
    const noVerdict = transitionCatalogItem(atCuration, {
      to: "listed",
      reason: "would list without human",
    });
    expect(noVerdict.ok).toBe(false);
    if (!noVerdict.ok) expect(noVerdict.code).toBe("missing-human-verdict");

    const reject = transitionCatalogItem(atCuration, {
      to: "listed",
      reason: "curator rejected",
      humanVerdict: {
        kind: "human",
        decision: "reject",
        curatorId: "curator-fixture-1",
        rationale: "Fails originality bar.",
        recordedAt: "2026-07-21T13:00:00.000Z",
      },
    });
    expect(reject.ok).toBe(false);
    if (!reject.ok) expect(reject.code).toBe("human-verdict-rejected");
  });

  it("refuses when mandatory metadata is missing", () => {
    const incomplete = syntheticAsset({
      rights: { license: "", rightsHolder: "X", commercialUseAllowed: false },
      aiGenerationDisclosure: { aiGenerated: false, disclosureText: "" },
    });
    expect(missingMandatoryMetadata(incomplete).length).toBeGreaterThan(0);
    const result = transitionCatalogItem(incomplete, {
      to: "screening",
      reason: "try advance incomplete",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missing-mandatory-metadata");
  });

  it("exposes only legal successors per state", () => {
    expect(legalSuccessors("intake")).toEqual(["screening"]);
    expect(legalSuccessors("screening")).toEqual(["curation"]);
    expect(legalSuccessors("curation")).toEqual(["listed"]);
    expect(legalSuccessors("listed")).toEqual(["delisted"]);
    expect(legalSuccessors("delisted")).toEqual([]);
  });
});

describe("commerce fields inert (no 6b activation path)", () => {
  it("refuses commerce activation for listed items with price fields populated", () => {
    const listed = advanceToListed(
      syntheticAsset({
        commerce: { price: { amount: "4.00", currency: "USD" }, sku: "GAME-1" },
      }),
    );
    expect(listed.commerce.activation).toBe("inert");
    expect(isCommerceActive(listed)).toBe(false);

    const attempt = attemptCommerceActivation(listed);
    expect(attempt.ok).toBe(false);
    expect(attempt.code).toBe("commerce-inert");
    expect(attempt.gate).toBe(COMMERCE_ACTIVATION_GATE);
    expect(attempt.gate.status).toBe("inert");
    expect(attempt.message).toMatch(/6b|inert|activation/i);
  });

  it("cannot flip activation through item shape alone", () => {
    const listed = advanceToListed(syntheticAsset());
    // Even a forged activation value is not accepted by the gate helper.
    const forged = {
      ...listed,
      commerce: { activation: "active" as unknown as "inert" },
    } as CatalogItem;
    const attempt = attemptCommerceActivation(forged);
    expect(attempt.ok).toBe(false);
    expect(isCommerceActive(forged)).toBe(false);
  });
});

describe("topology neutrality", () => {
  it("does not encode a storefront topology in the item contract", () => {
    const item = syntheticAsset();
    const keys = Object.keys(item);
    expect(keys).not.toContain("storefront");
    expect(keys).not.toContain("platform");
    expect(keys).not.toContain("topology");
    // Policy cites remain external pointers, not topology decisions.
    expect(CATALOG_POLICY_CITES.assetPackageInterchange).toBeTruthy();
    expect(CATALOG_POLICY_CITES.untrustedAssetIngestion).toBeTruthy();
  });
});
