import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CATALOG_DATE_TIME_PATTERN,
  CATALOG_ITEM_SCHEMA_VERSION,
  CATALOG_METADATA_UNAVAILABLE_TOMBSTONE_SCHEMA_VERSION,
  CATALOG_POLICY_CITES,
  COMMERCE_ACTIVATION_GATE,
  attemptCommerceActivation,
  createCatalogItemAtIntake,
  isCommerceActive,
  legalSuccessors,
  missingMandatoryMetadata,
  transitionCatalogItem,
  contracts,
  type CatalogItem,
  type HumanCurationVerdict,
  type PipelineState,
} from "@sceneaxi/schemas";

const HASH =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

type HistoryShape = {
  minItems?: number;
  maxItems?: number;
  prefixItems?: Array<{ $ref?: string }>;
};

type ModerationRule = {
  if?: {
    properties?: { pipelineState?: { const?: PipelineState } };
  };
  then?: {
    properties?: { history?: HistoryShape };
  };
};

type CatalogSchema = {
  $id?: string;
  $defs?: {
    dateTime?: { format?: string; pattern?: string };
    transitionRecord?: {
      properties?: {
        reason?: { pattern?: string };
        at?: { $ref?: string };
        humanVerdict?: {
          properties?: { recordedAt?: { $ref?: string } };
        };
      };
      allOf?: unknown[];
    };
  };
  properties?: {
    assetPackage?: {
      properties?: { contentHash?: { pattern?: string } };
    };
    provenance?: {
      properties?: {
        ingestedAt?: { $ref?: string };
        sourceDigest?: { pattern?: string };
      };
    };
    aiGenerationDisclosure?: {
      required?: string[];
      properties?: { disclosureText?: { pattern?: string } };
    };
    compatibility?: {
      properties?: {
        profiles?: { items?: { pattern?: string } };
      };
    };
    moderation?: {
      allOf?: ModerationRule[];
    };
  };
};

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

  it("ships the Catalog Item JSON Schema through the public package export", () => {
    expect(contracts.catalogItem).toBe("contracts/catalog-item.schema.json");
    const schema = JSON.parse(
      readFileSync(
        fileURLToPath(
          import.meta.resolve("@sceneaxi/schemas/contracts/catalog-item.schema.json"),
        ),
        "utf8",
      ),
    ) as CatalogSchema;

    expect(schema.$id).toBe("https://sceneaxi.invalid/contracts/catalog-item/v1");
    expect(schema.properties?.aiGenerationDisclosure?.required).toEqual([
      "aiGenerated",
      "disclosureText",
    ]);
    const disclosurePattern =
      schema.properties?.aiGenerationDisclosure?.properties?.disclosureText?.pattern;
    const reasonPattern = schema.$defs?.transitionRecord?.properties?.reason?.pattern;
    const profilePattern =
      schema.properties?.compatibility?.properties?.profiles?.items?.pattern;
    expect(new RegExp(disclosurePattern ?? "").test("   ")).toBe(false);
    expect(new RegExp(disclosurePattern ?? "").test("No generative AI used.")).toBe(
      true,
    );
    expect(new RegExp(reasonPattern ?? "").test("\t")).toBe(false);
    expect(new RegExp(reasonPattern ?? "").test("Screened.")).toBe(true);
    expect(new RegExp(profilePattern ?? "").test("game\n")).toBe(false);
    expect(new RegExp(profilePattern ?? "").test("game")).toBe(true);
    expect(schema.$defs?.transitionRecord?.allOf).toEqual([
      {
        if: {
          properties: { to: { const: "listed" } },
          required: ["to"],
        },
        then: {
          required: ["humanVerdict"],
          properties: {
            humanVerdict: {
              properties: { decision: { const: "approve" } },
            },
          },
        },
        else: { not: { required: ["humanVerdict"] } },
      },
    ]);
    expect(schema.$defs?.dateTime).toEqual({
      type: "string",
      format: "date-time",
      pattern: CATALOG_DATE_TIME_PATTERN,
    });
    expect(schema.$defs?.transitionRecord?.properties?.at?.$ref).toBe(
      "#/$defs/dateTime",
    );
    expect(
      schema.$defs?.transitionRecord?.properties?.humanVerdict?.properties
        ?.recordedAt?.$ref,
    ).toBe("#/$defs/dateTime");
    expect(schema.properties?.provenance?.properties?.ingestedAt?.$ref).toBe(
      "#/$defs/dateTime",
    );

    const historyShape = (state: PipelineState) =>
      schema.properties?.moderation?.allOf?.find(
        (rule) => rule.if?.properties?.pipelineState?.const === state,
      )?.then?.properties?.history;
    expect(historyShape("intake")).toEqual({ maxItems: 0 });
    expect(historyShape("screening")).toEqual({
      minItems: 1,
      maxItems: 1,
      prefixItems: [{ $ref: "#/$defs/intakeToScreening" }],
    });
    expect(historyShape("curation")).toEqual({
      minItems: 2,
      maxItems: 2,
      prefixItems: [
        { $ref: "#/$defs/intakeToScreening" },
        { $ref: "#/$defs/screeningToCuration" },
      ],
    });
    expect(historyShape("listed")).toEqual({
      minItems: 3,
      maxItems: 3,
      prefixItems: [
        { $ref: "#/$defs/intakeToScreening" },
        { $ref: "#/$defs/screeningToCuration" },
        { $ref: "#/$defs/curationToListed" },
      ],
    });
    expect(historyShape("delisted")).toEqual({
      minItems: 4,
      maxItems: 4,
      prefixItems: [
        { $ref: "#/$defs/intakeToScreening" },
        { $ref: "#/$defs/screeningToCuration" },
        { $ref: "#/$defs/curationToListed" },
        { $ref: "#/$defs/listedToDelisted" },
      ],
    });

    const dateTimeRegex = new RegExp(CATALOG_DATE_TIME_PATTERN);
    for (const invalid of [
      "2026-07-22",
      "2026-02-29T12:00:00Z",
      "2026-07-22T12:00:00Z\n",
      "not-a-date",
    ]) {
      expect(dateTimeRegex.test(invalid)).toBe(false);
    }
    expect(dateTimeRegex.test("2024-02-29T12:00:00.000Z")).toBe(true);

    const contentHashPattern =
      schema.properties?.assetPackage?.properties?.contentHash?.pattern;
    const sourceDigestPattern =
      schema.properties?.provenance?.properties?.sourceDigest?.pattern;
    expect(new RegExp(contentHashPattern ?? "").test(HASH + "\n")).toBe(false);
    expect(new RegExp(sourceDigestPattern ?? "").test(HASH + "\n")).toBe(false);
  });

  it("ships an explicit metadata-unavailable tombstone contract", () => {
    expect(contracts.catalogMetadataUnavailableTombstone).toBe(
      "contracts/catalog-metadata-unavailable-tombstone.schema.json",
    );
    const schema = JSON.parse(
      readFileSync(
        fileURLToPath(
          import.meta.resolve(
            "@sceneaxi/schemas/contracts/catalog-metadata-unavailable-tombstone.schema.json",
          ),
        ),
        "utf8",
      ),
    ) as {
      $id?: string;
      properties?: {
        kind?: { const?: string };
        moderation?: {
          properties?: {
            history?: { prefixItems?: Array<{ $ref?: string }> };
          };
        };
      };
    };
    expect(CATALOG_METADATA_UNAVAILABLE_TOMBSTONE_SCHEMA_VERSION).toBe(1);
    expect(schema.$id).toBe(
      "https://sceneaxi.invalid/contracts/catalog-metadata-unavailable-tombstone/v1",
    );
    expect(schema.properties?.kind?.const).toBe(
      "catalog-metadata-unavailable-tombstone",
    );
    expect(JSON.stringify(schema)).not.toMatch(/"\$ref":"https?:/);
    expect(
      schema.properties?.moderation?.properties?.history?.prefixItems,
    ).toEqual([
      { $ref: "#/$defs/intakeToScreening" },
      { $ref: "#/$defs/screeningToCuration" },
      { $ref: "#/$defs/curationToListed" },
      { $ref: "#/$defs/listedToDelisted" },
    ]);
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
    expect(delisted.kind).toBe("catalog-item");
    if (delisted.kind !== "catalog-item") return;
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

  it("refuses missing and non-string reasons without throwing", () => {
    for (const rawReason of [undefined, null, 42, {}]) {
      const request = {
        to: "screening" as const,
        reason: "placeholder",
      };
      if (rawReason === undefined) {
        Reflect.deleteProperty(request, "reason");
      } else {
        Object.assign(request, { reason: rawReason });
      }

      const result = transitionCatalogItem(syntheticAsset(), request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("missing-reason");
    }
  });

  it("normalizes transition inputs and indexed history once", () => {
    const reasonRequest = {
      to: "screening" as const,
      reason: "placeholder",
    };
    let reasonReads = 0;
    Object.defineProperty(reasonRequest, "reason", {
      get() {
        reasonReads += 1;
        if (reasonReads > 1) throw new Error("reason re-read");
        return "snapshot reason";
      },
    });
    const screening = transitionCatalogItem(syntheticAsset(), reasonRequest);
    expect(screening.ok).toBe(true);
    expect(reasonReads).toBe(1);

    const listed = advanceToListed(syntheticAsset());
    const atCuration: CatalogItem = {
      ...listed,
      moderation: {
        pipelineState: "curation",
        history: listed.moderation.history.slice(0, 2),
      },
    };
    const verdictRequest = {
      to: "listed" as const,
      reason: "snapshot verdict",
      humanVerdict: approveVerdict(),
    };
    let verdictReads = 0;
    Object.defineProperty(verdictRequest, "humanVerdict", {
      get() {
        verdictReads += 1;
        return verdictReads === 1 ? approveVerdict() : null;
      },
    });
    const relisted = transitionCatalogItem(atCuration, verdictRequest);
    expect(relisted.ok).toBe(true);
    expect(verdictReads).toBe(1);
    if (relisted.ok) {
      expect(relisted.transition.humanVerdict?.decision).toBe("approve");
    }

    Object.defineProperty(listed.moderation.history, Symbol.iterator, {
      value: function* () {
        yield {
          from: "listed",
          to: "delisted",
          reason: "iterator injection",
          at: "2026-07-21T14:00:00.000Z",
        };
      },
    });
    const delisted = transitionCatalogItem(listed, {
      to: "delisted",
      reason: "indexed history snapshot",
    });
    expect(delisted.ok).toBe(true);
    if (delisted.ok) {
      expect(delisted.kind).toBe("catalog-item");
    }
    if (delisted.ok && delisted.kind === "catalog-item") {
      expect(delisted.item.moderation.history).toHaveLength(4);
      expect(delisted.item.moderation.history[0]?.from).toBe("intake");
      expect(delisted.item.moderation.history[3]?.to).toBe("delisted");
    }
  });

  it("refuses moderation history supplied through inherited array slots", () => {
    const listed = advanceToListed(syntheticAsset());
    const inheritedHistory = new Array<unknown>(3);
    Object.setPrototypeOf(inheritedHistory, {
      0: listed.moderation.history[0],
      1: listed.moderation.history[1],
      2: listed.moderation.history[2],
    });
    const malformed = {
      ...listed,
      moderation: {
        pipelineState: "listed" as const,
        history: inheritedHistory,
      },
    } as unknown as CatalogItem;

    const result = transitionCatalogItem(malformed, {
      to: "delisted",
      reason: "attempt inherited history",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid-moderation-history");
  });

  it("enforces the shared Catalog date-time definition at runtime", () => {
    const invalidTransition = transitionCatalogItem(syntheticAsset(), {
      to: "screening",
      reason: "invalid timestamp",
      at: "2026-07-22",
    });
    expect(invalidTransition.ok).toBe(false);
    if (!invalidTransition.ok) {
      expect(invalidTransition.code).toBe("invalid-moderation-history");
    }

    const invalidProvenance = syntheticAsset({
      provenance: {
        origin: "synthetic-fixture",
        ingestedAt: "2026-02-29T12:00:00Z",
        sourceDigest: HASH,
      },
    });
    expect(missingMandatoryMetadata(invalidProvenance)).toContain(
      "provenance.ingestedAt",
    );

    const listed = advanceToListed(syntheticAsset());
    const atCuration: CatalogItem = {
      ...listed,
      moderation: {
        pipelineState: "curation",
        history: listed.moderation.history.slice(0, 2),
      },
    };
    const invalidVerdict = transitionCatalogItem(atCuration, {
      to: "listed",
      reason: "invalid verdict timestamp",
      humanVerdict: {
        ...approveVerdict(),
        recordedAt: "not-a-date",
      },
    });
    expect(invalidVerdict.ok).toBe(false);
    if (!invalidVerdict.ok) {
      expect(invalidVerdict.code).toBe("invalid-human-verdict");
    }
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

  it("refuses structurally invalid human verdicts without throwing", () => {
    const listed = advanceToListed(syntheticAsset());
    const atCuration: CatalogItem = {
      ...listed,
      moderation: {
        pipelineState: "curation",
        history: listed.moderation.history.slice(0, 2),
      },
    };

    for (const malformedVerdict of [null, 42, "approve"]) {
      const request = {
        to: "listed" as const,
        reason: "attempt malformed verdict",
        humanVerdict: approveVerdict(),
      };
      Object.assign(request, { humanVerdict: malformedVerdict });

      const result = transitionCatalogItem(atCuration, request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("invalid-human-verdict");
    }
  });

  it("refuses a human verdict outside the listing transition", () => {
    const result = transitionCatalogItem(syntheticAsset(), {
      to: "screening",
      reason: "attempt to attach verdict before curation",
      humanVerdict: approveVerdict(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid-human-verdict");
  });

  it("refuses listing when curation history is missing", () => {
    const forged: CatalogItem = {
      ...syntheticAsset(),
      moderation: { pipelineState: "curation", history: [] },
    };

    const result = transitionCatalogItem(forged, {
      to: "listed",
      reason: "attempt forged listing",
      humanVerdict: approveVerdict(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid-moderation-history");
  });

  it("rechecks mandatory metadata at the listing boundary", () => {
    const intake = syntheticAsset();
    const screening = transitionCatalogItem(intake, {
      to: "screening",
      reason: "screened",
      at: "2026-07-21T10:00:00.000Z",
    });
    expect(screening.ok).toBe(true);
    if (!screening.ok) return;
    const curation = transitionCatalogItem(screening.item, {
      to: "curation",
      reason: "curated",
      at: "2026-07-21T11:00:00.000Z",
    });
    expect(curation.ok).toBe(true);
    if (!curation.ok) return;
    const drifted: CatalogItem = {
      ...curation.item,
      rights: { ...curation.item.rights, license: "" },
    };

    const result = transitionCatalogItem(drifted, {
      to: "listed",
      reason: "attempt listing after metadata drift",
      humanVerdict: approveVerdict(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing-mandatory-metadata");
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

  it("refuses malformed nested metadata without throwing", () => {
    const corruptions: Array<{
      path: string;
      corrupt: (item: CatalogItem) => void;
    }> = [
      {
        path: "assetPackage",
        corrupt: (item) => Object.assign(item, { assetPackage: null }),
      },
      {
        path: "rights",
        corrupt: (item) => Object.assign(item, { rights: null }),
      },
      {
        path: "provenance",
        corrupt: (item) => Reflect.deleteProperty(item, "provenance"),
      },
      {
        path: "aiGenerationDisclosure",
        corrupt: (item) =>
          Object.assign(item, { aiGenerationDisclosure: "missing" }),
      },
      {
        path: "compatibility",
        corrupt: (item) => Object.assign(item, { compatibility: null }),
      },
      {
        path: "commerce",
        corrupt: (item) => Object.assign(item, { commerce: null }),
      },
    ];

    for (const { path, corrupt } of corruptions) {
      const malformed = syntheticAsset();
      corrupt(malformed);
      expect(missingMandatoryMetadata(malformed)).toContain(path);

      const result = transitionCatalogItem(malformed, {
        to: "screening",
        reason: "attempt malformed metadata",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("missing-mandatory-metadata");
    }
  });

  it("requires runtime rights and AI disclosure booleans", () => {
    const malformed = syntheticAsset();
    Object.assign(malformed.rights, { commercialUseAllowed: "yes" });
    Reflect.deleteProperty(malformed.aiGenerationDisclosure, "aiGenerated");

    expect(missingMandatoryMetadata(malformed)).toEqual(
      expect.arrayContaining([
        "rights.commercialUseAllowed",
        "aiGenerationDisclosure.aiGenerated",
      ]),
    );
    const result = transitionCatalogItem(malformed, {
      to: "screening",
      reason: "attempt incomplete boolean metadata",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missing-mandatory-metadata");
  });

  it("returns deep-normalized metadata snapshots", () => {
    const intake = syntheticAsset();
    let licenseReads = 0;
    let originReads = 0;
    Object.defineProperty(intake.rights, "license", {
      get() {
        licenseReads += 1;
        return licenseReads === 1 ? "CC-BY-4.0" : "";
      },
    });
    Object.defineProperty(intake.provenance, "origin", {
      get() {
        originReads += 1;
        return originReads === 1 ? "synthetic-fixture" : "";
      },
    });

    const result = transitionCatalogItem(intake, {
      to: "screening",
      reason: "snapshot nested metadata",
    });
    expect(result.ok).toBe(true);
    expect(licenseReads).toBe(1);
    expect(originReads).toBe(1);
    if (result.ok) {
      expect(result.item.rights.license).toBe("CC-BY-4.0");
      expect(result.item.provenance.origin).toBe("synthetic-fixture");
      expect(missingMandatoryMetadata(result.item)).toEqual([]);
    }
  });

  it("refuses non-v1 runtime catalog items", () => {
    const intake = syntheticAsset();
    Object.assign(intake, { schemaVersion: 2 });
    expect(missingMandatoryMetadata(intake)).toContain("schemaVersion");
    const screening = transitionCatalogItem(intake, {
      to: "screening",
      reason: "attempt version drift",
    });
    expect(screening.ok).toBe(false);
    if (!screening.ok) {
      expect(screening.code).toBe("missing-mandatory-metadata");
    }

    const listed = advanceToListed(syntheticAsset());
    Reflect.deleteProperty(listed, "schemaVersion");
    const delisted = transitionCatalogItem(listed, {
      to: "delisted",
      reason: "attempt versionless takedown",
    });
    expect(delisted.ok).toBe(false);
    if (!delisted.ok) {
      expect(delisted.code).toBe("missing-mandatory-metadata");
    }
  });

  it("refuses digests with trailing line terminators", () => {
    const malformed = syntheticAsset({
      assetPackage: {
        packageId: "pkg-prop-crate",
        contentHash: HASH + "\n",
      },
      provenance: {
        origin: "synthetic-fixture",
        ingestedAt: "2026-07-21T12:00:00.000Z",
        sourceDigest: HASH + "\n",
      },
    });

    expect(missingMandatoryMetadata(malformed)).toEqual(
      expect.arrayContaining([
        "assetPackage.contentHash",
        "provenance.sourceDigest",
      ]),
    );
  });

  it("refuses non-string and true-end-invalid compatibility profiles", () => {
    const iteratorBypass = [""];
    Object.defineProperty(iteratorBypass, Symbol.iterator, {
      value: function* () {
        yield "game";
      },
    });
    const malformedProfileSets: unknown[][] = [
      [""],
      ["game\n"],
      [123],
      [null],
      new Array<unknown>(1),
      iteratorBypass,
    ];

    for (const profiles of malformedProfileSets) {
      const malformed = syntheticAsset({
        compatibility: {
          coreRange: "^0.0.0",
          profiles: profiles as readonly string[],
        },
      });

      expect(missingMandatoryMetadata(malformed)).toContain(
        "compatibility.profiles",
      );
      const result = transitionCatalogItem(malformed, {
        to: "screening",
        reason: "attempt malformed compatibility",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("missing-mandatory-metadata");
    }
  });

  it("captures compatibility profile slots exactly once", () => {
    const profiles = ["game"];
    let profileReads = 0;
    Object.defineProperty(profiles, 0, {
      get() {
        profileReads += 1;
        return profileReads <= 2 ? "game" : "game\n";
      },
    });
    const item = syntheticAsset({
      compatibility: { coreRange: "^0.0.0", profiles },
    });

    const result = transitionCatalogItem(item, {
      to: "screening",
      reason: "snapshot compatibility profiles",
    });
    expect(result.ok).toBe(true);
    expect(profileReads).toBe(1);
    if (result.ok) expect(result.item.compatibility.profiles).toEqual(["game"]);
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
  it("forces intake commerce activation to inert", () => {
    const injectedCommerce = {
      activation: "active",
      price: { amount: "9.99", currency: "USD" },
      sku: "SKU-1",
    };
    const item = syntheticAsset({ commerce: injectedCommerce });

    expect(item.commerce).toEqual({
      activation: "inert",
      price: { amount: "9.99", currency: "USD" },
      sku: "SKU-1",
    });
  });

  it("keeps takedown available and forces commerce inert", () => {
    const listed = advanceToListed(syntheticAsset());
    Object.assign(listed, { rights: null });
    Reflect.deleteProperty(listed, "provenance");
    Object.assign(listed.commerce, { activation: "active" });

    const result = transitionCatalogItem(listed, {
      to: "delisted",
      reason: "attempt takedown with active commerce",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("catalog-metadata-unavailable-tombstone");
    }
    if (result.ok && result.kind === "catalog-metadata-unavailable-tombstone") {
      expect(result.tombstone).toEqual({
        schemaVersion: CATALOG_METADATA_UNAVAILABLE_TOMBSTONE_SCHEMA_VERSION,
        kind: "catalog-metadata-unavailable-tombstone",
        itemId: listed.itemId,
        unavailableMetadata: ["rights", "provenance"],
        moderation: {
          pipelineState: "delisted",
          history: [...listed.moderation.history, result.transition],
        },
        commerce: { activation: "inert" },
      });
      expect(result.tombstone).not.toHaveProperty("assetPackage");
      expect(result.tombstone).not.toHaveProperty("aiGenerationDisclosure");
    }
  });

  it("normalizes commerce-only drift without discarding catalog metadata", () => {
    const corruptions: Array<(item: CatalogItem) => void> = [
      (item) => Object.assign(item.commerce, { activation: "active" }),
      (item) => Reflect.deleteProperty(item, "commerce"),
      (item) =>
        Object.assign(item, {
          commerce: {
            activation: "active",
            price: { amount: 42, currency: null },
            sku: 42,
          },
        }),
    ];

    for (const corrupt of corruptions) {
      const listed = advanceToListed(syntheticAsset());
      corrupt(listed);

      const result = transitionCatalogItem(listed, {
        to: "delisted",
        reason: "normalize commerce during takedown",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.kind).toBe("catalog-item");
      if (result.kind !== "catalog-item") continue;
      expect(result.item).toMatchObject({
        itemId: listed.itemId,
        assetPackage: listed.assetPackage,
        rights: listed.rights,
        provenance: listed.provenance,
        aiGenerationDisclosure: listed.aiGenerationDisclosure,
        compatibility: listed.compatibility,
        commerce: { activation: "inert" },
      });
      expect(result.item.commerce).toEqual({ activation: "inert" });
    }
  });

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
