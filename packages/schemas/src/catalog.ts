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

/** Legal directed edges of the dormant pipeline. */
const LEGAL_TRANSITIONS: ReadonlyMap<PipelineState, ReadonlySet<PipelineState>> =
  new Map([
    ["intake", new Set<PipelineState>(["screening"])],
    ["screening", new Set<PipelineState>(["curation"])],
    ["curation", new Set<PipelineState>(["listed"])],
    ["listed", new Set<PipelineState>(["delisted"])],
    ["delisted", new Set<PipelineState>()],
  ]);

export type TransitionOk = {
  readonly ok: true;
  readonly item: CatalogItem;
  readonly transition: TransitionRecord;
};

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

function validProfiles(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index) || !validId(value[index])) return false;
  }
  return true;
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

const TOMBSTONE_DIGEST =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000";
const TOMBSTONE_DATE_TIME = "1970-01-01T00:00:00.000Z";

function normalizeCatalogMetadata(
  item: unknown,
  tombstoneAt = TOMBSTONE_DATE_TIME,
): { readonly metadata: CatalogMetadata; readonly missing: string[] } {
  const missing: string[] = [];
  const itemRecord = isRecord(item) ? item : undefined;
  if (itemRecord === undefined) missing.push("catalogItem");

  const schemaVersion = itemRecord?.["schemaVersion"];
  if (schemaVersion !== CATALOG_ITEM_SCHEMA_VERSION) {
    missing.push("schemaVersion");
  }

  const rawItemId = itemRecord?.["itemId"];
  if (!validId(rawItemId)) missing.push("itemId");

  const rawAssetPackage = itemRecord?.["assetPackage"];
  const assetPackage = isRecord(rawAssetPackage) ? rawAssetPackage : undefined;
  if (assetPackage === undefined) missing.push("assetPackage");
  const rawPackageId = assetPackage?.["packageId"];
  const rawContentHash = assetPackage?.["contentHash"];
  if (assetPackage !== undefined && !validId(rawPackageId)) {
    missing.push("assetPackage.packageId");
  }
  if (assetPackage !== undefined && !validSha256(rawContentHash)) {
    missing.push("assetPackage.contentHash");
  }

  const rawRights = itemRecord?.["rights"];
  const rights = isRecord(rawRights) ? rawRights : undefined;
  if (rights === undefined) missing.push("rights");
  const rawLicense = rights?.["license"];
  const rawRightsHolder = rights?.["rightsHolder"];
  const rawCommercialUseAllowed = rights?.["commercialUseAllowed"];
  if (rights !== undefined && !nonEmptyString(rawLicense)) {
    missing.push("rights.license");
  }
  if (rights !== undefined && !nonEmptyString(rawRightsHolder)) {
    missing.push("rights.rightsHolder");
  }
  if (rights !== undefined && typeof rawCommercialUseAllowed !== "boolean") {
    missing.push("rights.commercialUseAllowed");
  }

  const rawProvenance = itemRecord?.["provenance"];
  const provenance = isRecord(rawProvenance) ? rawProvenance : undefined;
  if (provenance === undefined) missing.push("provenance");
  const rawOrigin = provenance?.["origin"];
  const rawIngestedAt = provenance?.["ingestedAt"];
  const rawSourceDigest = provenance?.["sourceDigest"];
  if (provenance !== undefined && !nonEmptyString(rawOrigin)) {
    missing.push("provenance.origin");
  }
  if (provenance !== undefined && !validDateTime(rawIngestedAt)) {
    missing.push("provenance.ingestedAt");
  }
  if (provenance !== undefined && !validSha256(rawSourceDigest)) {
    missing.push("provenance.sourceDigest");
  }

  const rawDisclosure = itemRecord?.["aiGenerationDisclosure"];
  const disclosure = isRecord(rawDisclosure) ? rawDisclosure : undefined;
  if (disclosure === undefined) missing.push("aiGenerationDisclosure");
  const rawAiGenerated = disclosure?.["aiGenerated"];
  const rawDisclosureText = disclosure?.["disclosureText"];
  const rawTools = disclosure?.["tools"];
  const tools =
    rawTools === undefined ? undefined : normalizeStringArray(rawTools);
  if (disclosure !== undefined && typeof rawAiGenerated !== "boolean") {
    missing.push("aiGenerationDisclosure.aiGenerated");
  }
  if (disclosure !== undefined && !nonEmptyString(rawDisclosureText)) {
    missing.push("aiGenerationDisclosure.disclosureText");
  }
  if (disclosure !== undefined && rawTools !== undefined && tools === undefined) {
    missing.push("aiGenerationDisclosure.tools");
  }

  const rawCompatibility = itemRecord?.["compatibility"];
  const compatibility = isRecord(rawCompatibility)
    ? rawCompatibility
    : undefined;
  if (compatibility === undefined) missing.push("compatibility");
  const rawCoreRange = compatibility?.["coreRange"];
  const rawProfiles = compatibility?.["profiles"];
  if (compatibility !== undefined && !nonEmptyString(rawCoreRange)) {
    missing.push("compatibility.coreRange");
  }
  if (compatibility !== undefined && !validProfiles(rawProfiles)) {
    missing.push("compatibility.profiles");
  }
  const profiles: string[] = [];
  if (validProfiles(rawProfiles)) {
    for (let index = 0; index < rawProfiles.length; index += 1) {
      profiles.push(rawProfiles[index] as string);
    }
  }

  const rawCommerce = itemRecord?.["commerce"];
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
  if (commerce !== undefined && rawSku !== undefined && typeof rawSku !== "string") {
    missing.push("commerce.sku");
  }

  const normalizedPrice =
    typeof rawAmount === "string" && typeof rawCurrency === "string"
      ? { amount: rawAmount, currency: rawCurrency }
      : undefined;
  const normalizedSku = typeof rawSku === "string" ? rawSku : undefined;

  return {
    missing,
    metadata: {
      schemaVersion: CATALOG_ITEM_SCHEMA_VERSION,
      itemId: validId(rawItemId) ? rawItemId : "takedown-tombstone",
      assetPackage: {
        packageId: validId(rawPackageId) ? rawPackageId : "takedown-tombstone",
        contentHash: validSha256(rawContentHash)
          ? rawContentHash
          : TOMBSTONE_DIGEST,
      },
      rights: {
        license: nonEmptyString(rawLicense)
          ? rawLicense
          : "unavailable-after-takedown",
        rightsHolder: nonEmptyString(rawRightsHolder)
          ? rawRightsHolder
          : "unavailable-after-takedown",
        commercialUseAllowed:
          typeof rawCommercialUseAllowed === "boolean"
            ? rawCommercialUseAllowed
            : false,
      },
      provenance: {
        origin: nonEmptyString(rawOrigin)
          ? rawOrigin
          : "unavailable-after-takedown",
        ingestedAt: validDateTime(rawIngestedAt) ? rawIngestedAt : tombstoneAt,
        sourceDigest: validSha256(rawSourceDigest)
          ? rawSourceDigest
          : TOMBSTONE_DIGEST,
      },
      aiGenerationDisclosure: {
        aiGenerated: typeof rawAiGenerated === "boolean" ? rawAiGenerated : false,
        disclosureText: nonEmptyString(rawDisclosureText)
          ? rawDisclosureText
          : "Metadata unavailable after takedown.",
        ...(tools === undefined ? {} : { tools }),
      },
      compatibility: {
        coreRange: nonEmptyString(rawCoreRange)
          ? rawCoreRange
          : "unavailable-after-takedown",
        profiles: profiles.length > 0 ? profiles : ["tombstone"],
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
  const normalizedMetadata = normalizeCatalogMetadata(itemSnapshot, at);
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

  const next: CatalogItem = {
    ...normalizedMetadata.metadata,
    moderation: {
      pipelineState: to,
      history: [...moderation.moderation.history, transition],
    },
  };

  return { ok: true, item: next, transition };
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
