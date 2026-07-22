/**
 * Catalog Item contract + fail-closed pipeline state machine (dormant stubs).
 *
 * Policy sources of truth — cite, do not rewrite:
 * - factories-helpers#47 — Asset Package interchange, acceptance transaction, loss ledger
 *   https://github.com/Vhailors/factories-helpers/issues/47
 * - factories-helpers#48 — untrusted-asset ingestion + supply-chain controls
 *   https://github.com/Vhailors/factories-helpers/issues/48
 *
 * Topology-neutral: no one-platform-two-storefronts (or any other) topology is
 * encoded; catalog-storefront-topology remains an open held key. Kids
 * consumption is not implemented here (kids-surface-isolation open;
 * anything → profile-kids denied by the dependency matrix).
 *
 * Human curation is the product: the machine records a represented human
 * verdict; it never fabricates one.
 */

/** Governing policy citations (factories-helpers remains SoT). */
export const CATALOG_POLICY_CITES = Object.freeze({
  assetPackageInterchange: "https://github.com/Vhailors/factories-helpers/issues/47",
  untrustedAssetIngestion: "https://github.com/Vhailors/factories-helpers/issues/48",
});

/** Contract schema version for Catalog Item. */
export const CATALOG_ITEM_SCHEMA_VERSION = 1 as const;

export const CATALOG_METADATA_UNAVAILABLE_TOMBSTONE_SCHEMA_VERSION = 1 as const;

export const CATALOG_DATE_TIME_PATTERN =
  "^(?:(?:\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|02-(?:0[1-9]|1\\d|2[0-8])))|(?:(?:\\d{2}(?:0[48]|[2468][048]|[13579][26])|(?:[02468][048]|[13579][26])00)-02-29))[Tt](?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:[Zz]|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)(?![\\s\\S])";

/**
 * Fail-closed pipeline states.
 * intake (quarantine) → screening → curation → listed → delisted
 */
export type PipelineState =
  | "intake"
  | "screening"
  | "curation"
  | "listed"
  | "delisted";

export const PIPELINE_STATES: readonly PipelineState[] = Object.freeze([
  "intake",
  "screening",
  "curation",
  "listed",
  "delisted",
]);

/**
 * Human curation verdict — representation only.
 * Callers (CLI/protocol/humans) supply this; the pipeline never invents it.
 */
export type HumanCurationVerdict = {
  readonly kind: "human";
  readonly decision: "approve" | "reject";
  readonly curatorId: string;
  readonly rationale: string;
  readonly recordedAt: string;
};

export type TransitionRecord = {
  readonly from: PipelineState;
  readonly to: PipelineState;
  readonly reason: string;
  readonly at: string;
  readonly humanVerdict?: HumanCurationVerdict;
};

export type AssetPackageRef = {
  readonly packageId: string;
  readonly contentHash: string;
};

export type RightsRecord = {
  readonly license: string;
  readonly rightsHolder: string;
  readonly commercialUseAllowed: boolean;
};

export type ProvenanceRecord = {
  readonly origin: string;
  readonly ingestedAt: string;
  readonly sourceDigest: string;
};

export type AiGenerationDisclosure = {
  readonly aiGenerated: boolean;
  readonly disclosureText: string;
  readonly tools?: readonly string[];
};

export type Compatibility = {
  readonly coreRange: string;
  readonly profiles: readonly string[];
};

export type ModerationState = {
  readonly pipelineState: PipelineState;
  readonly history: readonly TransitionRecord[];
};

/**
 * Commerce fields are always structurally inert until tier-6b marketplace
 * activation holds open (read per-storefront). No path in this stub opens them.
 */
export type CommerceFields = {
  readonly activation: "inert";
  readonly price?: { readonly amount: string; readonly currency: string };
  readonly sku?: string;
};

export type CatalogItem = {
  readonly schemaVersion: typeof CATALOG_ITEM_SCHEMA_VERSION;
  readonly itemId: string;
  readonly assetPackage: AssetPackageRef;
  readonly rights: RightsRecord;
  readonly provenance: ProvenanceRecord;
  readonly aiGenerationDisclosure: AiGenerationDisclosure;
  readonly compatibility: Compatibility;
  readonly moderation: ModerationState;
  readonly commerce: CommerceFields;
};

export type CatalogMetadataUnavailableTombstone = {
  readonly schemaVersion:
    typeof CATALOG_METADATA_UNAVAILABLE_TOMBSTONE_SCHEMA_VERSION;
  readonly kind: "catalog-metadata-unavailable-tombstone";
  readonly itemId: string;
  readonly unavailableMetadata: readonly string[];
  readonly moderation: ModerationState & { readonly pipelineState: "delisted" };
  readonly commerce: { readonly activation: "inert" };
};

/** Legal directed edges of the dormant pipeline. */
const LEGAL_TRANSITIONS: ReadonlyMap<PipelineState, ReadonlySet<PipelineState>> =
  new Map([
    ["intake", new Set<PipelineState>(["screening"])],
    ["screening", new Set<PipelineState>(["curation"])],
    ["curation", new Set<PipelineState>(["listed"])],
    ["listed", new Set<PipelineState>(["delisted"])],
    ["delisted", new Set<PipelineState>()],
  ]);

export type CatalogItemTransitionOk = {
  readonly ok: true;
  readonly kind: "catalog-item";
  readonly item: CatalogItem;
  readonly transition: TransitionRecord;
};

export type CatalogTombstoneTransitionOk = {
  readonly ok: true;
  readonly kind: "catalog-metadata-unavailable-tombstone";
  readonly tombstone: CatalogMetadataUnavailableTombstone;
  readonly transition: TransitionRecord;
};

export type TransitionOk =
  | CatalogItemTransitionOk
  | CatalogTombstoneTransitionOk;

export type TransitionRefuse = {
  readonly ok: false;
  readonly code:
    | "illegal-transition"
    | "missing-reason"
    | "missing-human-verdict"
    | "human-verdict-rejected"
    | "missing-mandatory-metadata"
    | "invalid-human-verdict"
    | "invalid-moderation-history";
  readonly message: string;
};

export type TransitionResult = TransitionOk | TransitionRefuse;

export type CatalogItemTransitionResult =
  | CatalogItemTransitionOk
  | TransitionRefuse;

export type CatalogDelistingResult = TransitionOk | TransitionRefuse;

export type TransitionRequest = {
  readonly to: PipelineState;
  readonly reason: string;
  readonly at?: string;
  /** Required when transitioning to `listed`; never simulated by the pipeline. */
  readonly humanVerdict?: HumanCurationVerdict;
};

const DATE_TIME_RE = new RegExp(CATALOG_DATE_TIME_PATTERN);
const SHA256_RE = /^sha256:[0-9a-f]{64}(?![\s\S])/;
const ID_RE = /^[a-z0-9][a-z0-9-]*(?![\s\S])/;

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPipelineState(value: unknown): value is PipelineState {
  return (
    value === "intake" ||
    value === "screening" ||
    value === "curation" ||
    value === "listed" ||
    value === "delisted"
  );
}

function validId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value);
}

function validSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_RE.test(value);
}

function validDateTime(value: unknown): value is string {
  return typeof value === "string" && DATE_TIME_RE.test(value);
}

function normalizeProfiles(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const normalized: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return undefined;
    const profile = value[index];
    if (!validId(profile)) return undefined;
    normalized.push(profile);
  }
  return normalized;
}

function normalizeStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const normalized: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return undefined;
    const entry = value[index];
    if (typeof entry !== "string") return undefined;
    normalized.push(entry);
  }
  return normalized;
}

type CatalogMetadata = Omit<CatalogItem, "moderation">;

function normalizeCatalogMetadata(item: unknown): {
  readonly metadata?: CatalogMetadata;
  readonly itemId?: string;
  readonly missing: string[];
} {
  const missing: string[] = [];
  if (!isRecord(item)) return { missing: ["catalogItem"] };

  const schemaVersion = item["schemaVersion"];
  if (schemaVersion !== CATALOG_ITEM_SCHEMA_VERSION) {
    missing.push("schemaVersion");
  }

  const rawItemId = item["itemId"];
  const itemId = validId(rawItemId) ? rawItemId : undefined;
  if (itemId === undefined) missing.push("itemId");

  const rawAssetPackage = item["assetPackage"];
  const assetPackage = isRecord(rawAssetPackage) ? rawAssetPackage : undefined;
  if (assetPackage === undefined) missing.push("assetPackage");
  const rawPackageId = assetPackage?.["packageId"];
  const rawContentHash = assetPackage?.["contentHash"];
  const packageId = validId(rawPackageId) ? rawPackageId : undefined;
  const contentHash = validSha256(rawContentHash) ? rawContentHash : undefined;
  if (assetPackage !== undefined && packageId === undefined) {
    missing.push("assetPackage.packageId");
  }
  if (assetPackage !== undefined && contentHash === undefined) {
    missing.push("assetPackage.contentHash");
  }

  const rawRights = item["rights"];
  const rights = isRecord(rawRights) ? rawRights : undefined;
  if (rights === undefined) missing.push("rights");
  const rawLicense = rights?.["license"];
  const rawRightsHolder = rights?.["rightsHolder"];
  const rawCommercialUseAllowed = rights?.["commercialUseAllowed"];
  const license = nonEmptyString(rawLicense) ? rawLicense : undefined;
  const rightsHolder = nonEmptyString(rawRightsHolder)
    ? rawRightsHolder
    : undefined;
  const commercialUseAllowed =
    typeof rawCommercialUseAllowed === "boolean"
      ? rawCommercialUseAllowed
      : undefined;
  if (rights !== undefined && license === undefined) {
    missing.push("rights.license");
  }
  if (rights !== undefined && rightsHolder === undefined) {
    missing.push("rights.rightsHolder");
  }
  if (rights !== undefined && commercialUseAllowed === undefined) {
    missing.push("rights.commercialUseAllowed");
  }

  const rawProvenance = item["provenance"];
  const provenance = isRecord(rawProvenance) ? rawProvenance : undefined;
  if (provenance === undefined) missing.push("provenance");
  const rawOrigin = provenance?.["origin"];
  const rawIngestedAt = provenance?.["ingestedAt"];
  const rawSourceDigest = provenance?.["sourceDigest"];
  const origin = nonEmptyString(rawOrigin) ? rawOrigin : undefined;
  const ingestedAt = validDateTime(rawIngestedAt) ? rawIngestedAt : undefined;
  const sourceDigest = validSha256(rawSourceDigest)
    ? rawSourceDigest
    : undefined;
  if (provenance !== undefined && origin === undefined) {
    missing.push("provenance.origin");
  }
  if (provenance !== undefined && ingestedAt === undefined) {
    missing.push("provenance.ingestedAt");
  }
  if (provenance !== undefined && sourceDigest === undefined) {
    missing.push("provenance.sourceDigest");
  }

  const rawDisclosure = item["aiGenerationDisclosure"];
  const disclosure = isRecord(rawDisclosure) ? rawDisclosure : undefined;
  if (disclosure === undefined) missing.push("aiGenerationDisclosure");
  const rawAiGenerated = disclosure?.["aiGenerated"];
  const rawDisclosureText = disclosure?.["disclosureText"];
  const rawTools = disclosure?.["tools"];
  const aiGenerated =
    typeof rawAiGenerated === "boolean" ? rawAiGenerated : undefined;
  const disclosureText = nonEmptyString(rawDisclosureText)
    ? rawDisclosureText
    : undefined;
  const tools =
    rawTools === undefined ? undefined : normalizeStringArray(rawTools);
  if (disclosure !== undefined && aiGenerated === undefined) {
    missing.push("aiGenerationDisclosure.aiGenerated");
  }
  if (disclosure !== undefined && disclosureText === undefined) {
    missing.push("aiGenerationDisclosure.disclosureText");
  }
  if (disclosure !== undefined && rawTools !== undefined && tools === undefined) {
    missing.push("aiGenerationDisclosure.tools");
  }

  const rawCompatibility = item["compatibility"];
  const compatibility = isRecord(rawCompatibility)
    ? rawCompatibility
    : undefined;
  if (compatibility === undefined) missing.push("compatibility");
  const rawCoreRange = compatibility?.["coreRange"];
  const rawProfiles = compatibility?.["profiles"];
  const coreRange = nonEmptyString(rawCoreRange) ? rawCoreRange : undefined;
  const profiles = normalizeProfiles(rawProfiles);
  if (compatibility !== undefined && coreRange === undefined) {
    missing.push("compatibility.coreRange");
  }
  if (compatibility !== undefined && profiles === undefined) {
    missing.push("compatibility.profiles");
  }

  const rawCommerce = item["commerce"];
  const commerce = isRecord(rawCommerce) ? rawCommerce : undefined;
  if (commerce === undefined) missing.push("commerce");
  const rawActivation = commerce?.["activation"];
  if (commerce !== undefined && rawActivation !== "inert") {
    missing.push("commerce.activation");
  }
  const rawPrice = commerce?.["price"];
  const price = isRecord(rawPrice) ? rawPrice : undefined;
  const rawAmount = price?.["amount"];
  const rawCurrency = price?.["currency"];
  if (
    commerce !== undefined &&
    rawPrice !== undefined &&
    (price === undefined ||
      typeof rawAmount !== "string" ||
      typeof rawCurrency !== "string")
  ) {
    missing.push("commerce.price");
  }
  const rawSku = commerce?.["sku"];
  if (
    commerce !== undefined &&
    rawSku !== undefined &&
    typeof rawSku !== "string"
  ) {
    missing.push("commerce.sku");
  }

  const normalizedPrice =
    typeof rawAmount === "string" && typeof rawCurrency === "string"
      ? { amount: rawAmount, currency: rawCurrency }
      : undefined;
  const normalizedSku = typeof rawSku === "string" ? rawSku : undefined;

  if (
    schemaVersion !== CATALOG_ITEM_SCHEMA_VERSION ||
    itemId === undefined ||
    packageId === undefined ||
    contentHash === undefined ||
    license === undefined ||
    rightsHolder === undefined ||
    commercialUseAllowed === undefined ||
    origin === undefined ||
    ingestedAt === undefined ||
    sourceDigest === undefined ||
    aiGenerated === undefined ||
    disclosureText === undefined ||
    (rawTools !== undefined && tools === undefined) ||
    coreRange === undefined ||
    profiles === undefined ||
    rawActivation !== "inert" ||
    (rawPrice !== undefined && normalizedPrice === undefined) ||
    (rawSku !== undefined && normalizedSku === undefined)
  ) {
    return { missing, ...(itemId === undefined ? {} : { itemId }) };
  }

  return {
    missing,
    itemId,
    metadata: {
      schemaVersion: CATALOG_ITEM_SCHEMA_VERSION,
      itemId,
      assetPackage: {
        packageId,
        contentHash,
      },
      rights: {
        license,
        rightsHolder,
        commercialUseAllowed,
      },
      provenance: {
        origin,
        ingestedAt,
        sourceDigest,
      },
      aiGenerationDisclosure: {
        aiGenerated,
        disclosureText,
        ...(tools === undefined ? {} : { tools }),
      },
      compatibility: {
        coreRange,
        profiles,
      },
      commerce: {
        activation: "inert",
        ...(normalizedPrice === undefined ? {} : { price: normalizedPrice }),
        ...(normalizedSku === undefined ? {} : { sku: normalizedSku }),
      },
    },
  };
}

/**
 * Fail-closed mandatory-metadata check used before leaving intake quarantine
 * (screening gate). Aligns with rights/provenance/AI-disclosure screening in
 * the program catalog pipeline; deeper #48 controls stay factories-helpers SoT.
 */
export function missingMandatoryMetadata(item: unknown): string[] {
  return normalizeCatalogMetadata(item).missing;
}

type HumanVerdictNormalization =
  | { readonly ok: true; readonly verdict: HumanCurationVerdict }
  | { readonly ok: false; readonly refusal: TransitionRefuse };

function normalizeHumanVerdict(verdict: unknown): HumanVerdictNormalization {
  if (verdict === undefined) {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "missing-human-verdict",
        message:
          "Human curation verdict is required before listing; the pipeline represents the gate and never simulates it.",
      },
    };
  }
  if (!isRecord(verdict)) {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "invalid-human-verdict",
        message: "Curation verdict kind must be \"human\"; automated verdicts are refused.",
      },
    };
  }

  const kind = verdict["kind"];
  const decision = verdict["decision"];
  const curatorId = verdict["curatorId"];
  const rationale = verdict["rationale"];
  const recordedAt = verdict["recordedAt"];
  if (kind !== "human") {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "invalid-human-verdict",
        message: "Curation verdict kind must be \"human\"; automated verdicts are refused.",
      },
    };
  }
  if (
    !nonEmptyString(curatorId) ||
    !nonEmptyString(rationale)
  ) {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "invalid-human-verdict",
        message: "Human verdict requires non-empty curatorId and rationale.",
      },
    };
  }
  if (!validDateTime(recordedAt)) {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "invalid-human-verdict",
        message: "Human verdict requires recordedAt timestamp.",
      },
    };
  }
  if (decision === "reject") {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "human-verdict-rejected",
        message: "Human curator rejected the item; listing is refused.",
      },
    };
  }
  if (decision !== "approve") {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "invalid-human-verdict",
        message: "Human verdict decision must be approve or reject.",
      },
    };
  }
  return {
    ok: true,
    verdict: { kind, decision, curatorId, rationale, recordedAt },
  };
}

const REQUIRED_HISTORY: Readonly<
  Record<PipelineState, readonly (readonly [PipelineState, PipelineState])[]>
> = Object.freeze({
  intake: [],
  screening: [["intake", "screening"]],
  curation: [
    ["intake", "screening"],
    ["screening", "curation"],
  ],
  listed: [
    ["intake", "screening"],
    ["screening", "curation"],
    ["curation", "listed"],
  ],
  delisted: [
    ["intake", "screening"],
    ["screening", "curation"],
    ["curation", "listed"],
    ["listed", "delisted"],
  ],
});

type ModerationNormalization =
  | { readonly ok: true; readonly moderation: ModerationState }
  | { readonly ok: false; readonly refusal: TransitionRefuse };

function normalizeModerationHistory(item: unknown): ModerationNormalization {
  if (!isRecord(item)) {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "invalid-moderation-history",
        message: "Catalog item must contain a valid moderation history.",
      },
    };
  }

  const moderation = item["moderation"];
  if (
    !isRecord(moderation) ||
    !isPipelineState(moderation["pipelineState"]) ||
    !Array.isArray(moderation["history"])
  ) {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "invalid-moderation-history",
        message: "Catalog item must contain a valid moderation history.",
      },
    };
  }

  const pipelineState = moderation["pipelineState"];
  const history = moderation["history"];
  const required = REQUIRED_HISTORY[pipelineState];
  if (history.length !== required.length) {
    return {
      ok: false,
      refusal: {
        ok: false,
        code: "invalid-moderation-history",
        message: "Moderation history does not prove the path to " + pipelineState + ".",
      },
    };
  }

  const normalizedHistory: TransitionRecord[] = [];
  for (let index = 0; index < required.length; index += 1) {
    const expected = required[index];
    if (!Object.hasOwn(history, index)) {
      return {
        ok: false,
        refusal: {
          ok: false,
          code: "invalid-moderation-history",
          message:
            "Moderation history record " +
            String(index) +
            " is invalid or out of sequence.",
        },
      };
    }
    const record = history[index];
    if (!isRecord(record)) {
      return {
        ok: false,
        refusal: {
          ok: false,
          code: "invalid-moderation-history",
          message:
            "Moderation history record " +
            String(index) +
            " is invalid or out of sequence.",
        },
      };
    }

    const from = record["from"];
    const to = record["to"];
    const reason = record["reason"];
    const at = record["at"];
    const rawHumanVerdict = record["humanVerdict"];
    if (
      expected === undefined ||
      from !== expected[0] ||
      to !== expected[1] ||
      !nonEmptyString(reason) ||
      !validDateTime(at)
    ) {
      return {
        ok: false,
        refusal: {
          ok: false,
          code: "invalid-moderation-history",
          message:
            "Moderation history record " +
            String(index) +
            " is invalid or out of sequence.",
        },
      };
    }

    if (to === "listed") {
      const verdict = normalizeHumanVerdict(rawHumanVerdict);
      if (!verdict.ok) {
        return {
          ok: false,
          refusal: {
            ok: false,
            code: "invalid-moderation-history",
            message: "Moderation history lacks a valid human approval for listing.",
          },
        };
      }
      normalizedHistory.push({
        from,
        to,
        reason,
        at,
        humanVerdict: verdict.verdict,
      });
    } else {
      if (rawHumanVerdict !== undefined) {
        return {
          ok: false,
          refusal: {
            ok: false,
            code: "invalid-moderation-history",
            message:
              "Human curation verdicts may only be recorded on listing transitions.",
          },
        };
      }
      normalizedHistory.push({ from, to, reason, at });
    }
  }

  return {
    ok: true,
    moderation: { pipelineState, history: normalizedHistory },
  };
}

/**
 * Attempt a fail-closed pipeline transition. Every successful transition is
 * recorded with a reason on the item's moderation history.
 */
export function transitionCatalogItem(
  item: CatalogItem,
  request: TransitionRequest & {
    readonly to: Exclude<PipelineState, "delisted">;
  },
): CatalogItemTransitionResult;
export function transitionCatalogItem(
  item: CatalogItem,
  request: TransitionRequest & { readonly to: "delisted" },
): CatalogDelistingResult;
export function transitionCatalogItem(
  item: CatalogItem,
  request: TransitionRequest,
): TransitionResult;
export function transitionCatalogItem(
  item: CatalogItem,
  request: TransitionRequest,
): TransitionResult {
  const requestValue: unknown = request;
  if (!isRecord(requestValue)) {
    return {
      ok: false,
      code: "missing-reason",
      message: "Every pipeline transition requires a non-empty reason.",
    };
  }

  const rawReason = requestValue["reason"];
  const rawTo = requestValue["to"];
  const rawHumanVerdict = requestValue["humanVerdict"];
  const rawAt = requestValue["at"];
  if (!nonEmptyString(rawReason)) {
    return {
      ok: false,
      code: "missing-reason",
      message: "Every pipeline transition requires a non-empty reason.",
    };
  }
  const reason = rawReason.trim();

  const itemValue: unknown = item;
  if (!isRecord(itemValue)) {
    return {
      ok: false,
      code: "missing-mandatory-metadata",
      message: "Mandatory catalog metadata missing: catalogItem.",
    };
  }

  const rawModeration = itemValue["moderation"];
  const moderationSnapshot = isRecord(rawModeration)
    ? {
        pipelineState: rawModeration["pipelineState"],
        history: rawModeration["history"],
      }
    : rawModeration;
  const itemSnapshot = {
    schemaVersion: itemValue["schemaVersion"],
    itemId: itemValue["itemId"],
    assetPackage: itemValue["assetPackage"],
    rights: itemValue["rights"],
    provenance: itemValue["provenance"],
    aiGenerationDisclosure: itemValue["aiGenerationDisclosure"],
    compatibility: itemValue["compatibility"],
    moderation: moderationSnapshot,
    commerce: itemValue["commerce"],
  } as unknown as CatalogItem;

  if (itemSnapshot.schemaVersion !== CATALOG_ITEM_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "missing-mandatory-metadata",
      message: "Mandatory catalog metadata missing: schemaVersion.",
    };
  }

  if (
    !isRecord(moderationSnapshot) ||
    !isPipelineState(moderationSnapshot["pipelineState"])
  ) {
    return {
      ok: false,
      code: "invalid-moderation-history",
      message: "Catalog item must contain a valid moderation history.",
    };
  }
  const from = moderationSnapshot["pipelineState"];
  if (!isPipelineState(rawTo)) {
    return {
      ok: false,
      code: "illegal-transition",
      message: "Pipeline transition target is invalid (fail-closed).",
    };
  }
  const to = rawTo;
  const allowed = LEGAL_TRANSITIONS.get(from);
  if (!allowed?.has(to)) {
    return {
      ok: false,
      code: "illegal-transition",
      message:
        "Illegal pipeline transition " + from + " → " + to + " (fail-closed).",
    };
  }

  const moderation = normalizeModerationHistory(itemSnapshot);
  if (!moderation.ok) return moderation.refusal;

  if (to !== "listed" && rawHumanVerdict !== undefined) {
    return {
      ok: false,
      code: "invalid-human-verdict",
      message: "Human curation verdicts may only be recorded on listing transitions.",
    };
  }

  let humanVerdict: HumanCurationVerdict | undefined;
  if (to === "listed") {
    const verdict = normalizeHumanVerdict(rawHumanVerdict);
    if (!verdict.ok) return verdict.refusal;
    humanVerdict = verdict.verdict;
  }

  const at = rawAt ?? new Date().toISOString();
  if (!validDateTime(at)) {
    return {
      ok: false,
      code: "invalid-moderation-history",
      message: "Pipeline transition timestamp must be a valid date-time.",
    };
  }
  const normalizedMetadata = normalizeCatalogMetadata(itemSnapshot);
  if (to !== "delisted" && normalizedMetadata.missing.length > 0) {
    return {
      ok: false,
      code: "missing-mandatory-metadata",
      message:
        "Mandatory catalog metadata missing: " +
        normalizedMetadata.missing.join(", ") +
        ".",
    };
  }
  const transition: TransitionRecord =
    humanVerdict === undefined
      ? { from, to, reason, at }
      : { from, to, reason, at, humanVerdict };

  if (normalizedMetadata.metadata === undefined) {
    if (to !== "delisted" || normalizedMetadata.itemId === undefined) {
      return {
        ok: false,
        code: "missing-mandatory-metadata",
        message:
          "Mandatory catalog metadata missing: " +
          normalizedMetadata.missing.join(", ") +
          ".",
      };
    }

    const tombstone: CatalogMetadataUnavailableTombstone = {
      schemaVersion: CATALOG_METADATA_UNAVAILABLE_TOMBSTONE_SCHEMA_VERSION,
      kind: "catalog-metadata-unavailable-tombstone",
      itemId: normalizedMetadata.itemId,
      unavailableMetadata: normalizedMetadata.missing,
      moderation: {
        pipelineState: "delisted",
        history: [...moderation.moderation.history, transition],
      },
      commerce: { activation: "inert" },
    };

    return {
      ok: true,
      kind: "catalog-metadata-unavailable-tombstone",
      tombstone,
      transition,
    };
  }

  const next: CatalogItem = {
    ...normalizedMetadata.metadata,
    moderation: {
      pipelineState: to,
      history: [...moderation.moderation.history, transition],
    },
  };

  return { ok: true, kind: "catalog-item", item: next, transition };
}

/** Create a Catalog Item at intake (quarantine). Commerce always starts inert. */
export function createCatalogItemAtIntake(
  input: Omit<CatalogItem, "schemaVersion" | "moderation" | "commerce"> & {
    commerce?: Omit<CommerceFields, "activation">;
  },
): CatalogItem {
  const commerce: CommerceFields =
    input.commerce === undefined
      ? { activation: "inert" }
      : { ...input.commerce, activation: "inert" };

  return {
    schemaVersion: CATALOG_ITEM_SCHEMA_VERSION,
    itemId: input.itemId,
    assetPackage: input.assetPackage,
    rights: input.rights,
    provenance: input.provenance,
    aiGenerationDisclosure: input.aiGenerationDisclosure,
    compatibility: input.compatibility,
    moderation: {
      pipelineState: "intake",
      history: [],
    },
    commerce,
  };
}

/**
 * Commerce activation gate — always refuses.
 * Tier-6b marketplace activation/scope holds remain open (factories-helpers#42
 * registry). Fields may be populated for future use but no activation path opens.
 */
export const COMMERCE_ACTIVATION_GATE = Object.freeze({
  status: "inert" as const,
  policy:
    "Commerce fields are structurally inactive until tier-6b marketplace activation holds open (read per-storefront).",
  registry: "factories-helpers#42",
});

export type CommerceActivationResult = {
  readonly ok: false;
  readonly code: "commerce-inert";
  readonly message: string;
  readonly gate: typeof COMMERCE_ACTIVATION_GATE;
};

/** No activation path: always fails closed while 6b holds remain open. */
export function attemptCommerceActivation(
  item: CatalogItem,
): CommerceActivationResult {
  void item; // signature reserved for future per-item 6b checks; always inert now
  return {
    ok: false,
    code: "commerce-inert",
    message: COMMERCE_ACTIVATION_GATE.policy,
    gate: COMMERCE_ACTIVATION_GATE,
  };
}

/** Whether commerce is active for an item — always false in this dormant stub. */
export function isCommerceActive(item: CatalogItem): boolean {
  return item.commerce.activation !== "inert" && attemptCommerceActivation(item).ok;
}

/** Legal successors for a state (empty for terminal delisted). */
export function legalSuccessors(state: PipelineState): readonly PipelineState[] {
  return [...(LEGAL_TRANSITIONS.get(state) ?? [])];
}
