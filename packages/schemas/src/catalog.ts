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
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    Array.from(value).every((profile) => validId(profile))
  );
}

/**
 * Fail-closed mandatory-metadata check used before leaving intake quarantine
 * (screening gate). Aligns with rights/provenance/AI-disclosure screening in
 * the program catalog pipeline; deeper #48 controls stay factories-helpers SoT.
 */
export function missingMandatoryMetadata(item: CatalogItem): string[] {
  const missing: string[] = [];
  if (!validId(item.itemId)) missing.push("itemId");
  if (!validId(item.assetPackage.packageId)) {
    missing.push("assetPackage.packageId");
  }
  if (!validSha256(item.assetPackage.contentHash)) {
    missing.push("assetPackage.contentHash");
  }
  if (!nonEmptyString(item.rights.license)) missing.push("rights.license");
  if (!nonEmptyString(item.rights.rightsHolder)) missing.push("rights.rightsHolder");
  if (!nonEmptyString(item.provenance.origin)) missing.push("provenance.origin");
  if (!validDateTime(item.provenance.ingestedAt)) {
    missing.push("provenance.ingestedAt");
  }
  if (!validSha256(item.provenance.sourceDigest)) {
    missing.push("provenance.sourceDigest");
  }
  if (!nonEmptyString(item.aiGenerationDisclosure.disclosureText)) {
    missing.push("aiGenerationDisclosure.disclosureText");
  }
  if (!nonEmptyString(item.compatibility.coreRange)) {
    missing.push("compatibility.coreRange");
  }
  if (!validProfiles(item.compatibility.profiles)) {
    missing.push("compatibility.profiles");
  }
  if (item.commerce.activation !== "inert") {
    missing.push("commerce.activation");
  }
  return missing;
}

function validateHumanVerdict(
  verdict: HumanCurationVerdict | undefined,
): TransitionRefuse | null {
  if (verdict === undefined) {
    return {
      ok: false,
      code: "missing-human-verdict",
      message:
        "Human curation verdict is required before listing; the pipeline represents the gate and never simulates it.",
    };
  }
  if (verdict.kind !== "human") {
    return {
      ok: false,
      code: "invalid-human-verdict",
      message: "Curation verdict kind must be \"human\"; automated verdicts are refused.",
    };
  }
  if (!nonEmptyString(verdict.curatorId) || !nonEmptyString(verdict.rationale)) {
    return {
      ok: false,
      code: "invalid-human-verdict",
      message: "Human verdict requires non-empty curatorId and rationale.",
    };
  }
  if (!validDateTime(verdict.recordedAt)) {
    return {
      ok: false,
      code: "invalid-human-verdict",
      message: "Human verdict requires recordedAt timestamp.",
    };
  }
  if (verdict.decision === "reject") {
    return {
      ok: false,
      code: "human-verdict-rejected",
      message: "Human curator rejected the item; listing is refused.",
    };
  }
  if (verdict.decision !== "approve") {
    return {
      ok: false,
      code: "invalid-human-verdict",
      message: "Human verdict decision must be approve or reject.",
    };
  }
  return null;
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

function validateModerationHistory(item: CatalogItem): TransitionRefuse | null {
  const required = REQUIRED_HISTORY[item.moderation.pipelineState];
  if (item.moderation.history.length !== required.length) {
    return {
      ok: false,
      code: "invalid-moderation-history",
      message: `Moderation history does not prove the path to ${item.moderation.pipelineState}.`,
    };
  }
  for (let index = 0; index < required.length; index += 1) {
    const expected = required[index];
    const record = item.moderation.history[index];
    if (
      expected === undefined ||
      record === undefined ||
      record.from !== expected[0] ||
      record.to !== expected[1] ||
      !nonEmptyString(record.reason) ||
      !validDateTime(record.at)
    ) {
      return {
        ok: false,
        code: "invalid-moderation-history",
        message: `Moderation history record ${String(index)} is invalid or out of sequence.`,
      };
    }
    if (record.to === "listed") {
      const verdictError = validateHumanVerdict(record.humanVerdict);
      if (verdictError !== null) {
        return {
          ok: false,
          code: "invalid-moderation-history",
          message: "Moderation history lacks a valid human approval for listing.",
        };
      }
    } else if (record.humanVerdict !== undefined) {
      return {
        ok: false,
        code: "invalid-moderation-history",
        message: "Human curation verdicts may only be recorded on listing transitions.",
      };
    }
  }
  return null;
}

/**
 * Attempt a fail-closed pipeline transition. Every successful transition is
 * recorded with a reason on the item's moderation history.
 */
export function transitionCatalogItem(
  item: CatalogItem,
  request: TransitionRequest,
): TransitionResult {
  const reason = request.reason.trim();
  if (!nonEmptyString(reason)) {
    return {
      ok: false,
      code: "missing-reason",
      message: "Every pipeline transition requires a non-empty reason.",
    };
  }

  const from = item.moderation.pipelineState;
  const to = request.to;
  const allowed = LEGAL_TRANSITIONS.get(from);
  if (!allowed?.has(to)) {
    return {
      ok: false,
      code: "illegal-transition",
      message: `Illegal pipeline transition ${from} → ${to} (fail-closed).`,
    };
  }

  if (to !== "listed" && request.humanVerdict !== undefined) {
    return {
      ok: false,
      code: "invalid-human-verdict",
      message: "Human curation verdicts may only be recorded on listing transitions.",
    };
  }

  const historyError = validateModerationHistory(item);
  if (historyError !== null) return historyError;

  // Leaving quarantine: screening requires mandatory metadata.
  if (from === "intake" && to === "screening") {
    const missing = missingMandatoryMetadata(item);
    if (missing.length > 0) {
      return {
        ok: false,
        code: "missing-mandatory-metadata",
        message: `Mandatory catalog metadata missing: ${missing.join(", ")}.`,
      };
    }
  }

  // Screening → curation also re-checks metadata (no silent drift).
  if (
    (from === "screening" && to === "curation") ||
    (from === "curation" && to === "listed")
  ) {
    const missing = missingMandatoryMetadata(item);
    if (missing.length > 0) {
      return {
        ok: false,
        code: "missing-mandatory-metadata",
        message: `Mandatory catalog metadata missing: ${missing.join(", ")}.`,
      };
    }
  }

  let humanVerdict: HumanCurationVerdict | undefined;
  if (to === "listed") {
    const verdictError = validateHumanVerdict(request.humanVerdict);
    if (verdictError) return verdictError;
    humanVerdict = request.humanVerdict;
  }

  const at = request.at ?? new Date().toISOString();
  if (!validDateTime(at)) {
    return {
      ok: false,
      code: "invalid-moderation-history",
      message: "Pipeline transition timestamp must be a valid date-time.",
    };
  }
  const transition: TransitionRecord =
    humanVerdict === undefined
      ? { from, to, reason, at }
      : { from, to, reason, at, humanVerdict };

  const next: CatalogItem = {
    ...item,
    moderation: {
      pipelineState: to,
      history: [...item.moderation.history, transition],
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
