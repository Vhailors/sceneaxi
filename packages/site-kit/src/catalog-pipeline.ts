/**
 * TEST-only editor -> catalog intake, curation, and read-model seam.
 *
 * This module connects the existing entitled editor evidence to the existing
 * `CatalogItem` state machine. It owns no production store, moderation operator,
 * deployment, asset delivery, or commerce path. Callers must inject a provider;
 * the reference provider below is deliberately process-local and TEST-only.
 */
import {
  createCatalogItemAtIntake,
  transitionCatalogItem,
  validateCatalogItem,
  type AiGenerationDisclosure,
  type CatalogItem,
  type Compatibility,
  type HumanCurationVerdict,
  type PipelineState,
  type RightsRecord,
  type TransitionRefuse,
} from "@sceneaxi/schemas";
import type { CatalogSurface } from "./catalog.js";
import type { EditorSessionAccess } from "./entitlement.js";
import { type SiteRefusal, type SiteResult, ok, refuse } from "./refusals.js";

export const CATALOG_PIPELINE_MODE = "test" as const;

const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const SUPPORTED_PROFILE_BY_SURFACE = Object.freeze({
  "catalog-game": "game",
  "catalog-web": "web",
} as const satisfies Readonly<Record<CatalogSurface, "game" | "web">>);

export type CatalogSubmissionProfile = "game" | "web" | "kids";

/** Metadata the editor submitter must attest; digest fields come from editor evidence. */
export type CatalogSubmissionMetadata = {
  readonly itemId: string;
  readonly packageId: string;
  readonly rights: RightsRecord;
  readonly provenance: {
    readonly origin: string;
    readonly ingestedAt: string;
  };
  readonly aiGenerationDisclosure: AiGenerationDisclosure;
  readonly compatibility: Compatibility;
};

/** Existing canonical hashes produced by the rendered editor session. */
export type EditorCatalogEvidence = {
  readonly documentDigest: string;
  readonly artifactDigest: string;
};

export type CatalogIntakeRecord = {
  readonly mode: typeof CATALOG_PIPELINE_MODE;
  readonly surface: CatalogSurface;
  readonly submittedBy: string;
  readonly documentDigest: string;
  readonly artifactDigest: string;
  readonly item: CatalogItem;
};

export type CatalogSubmissionReceipt = {
  readonly record: CatalogIntakeRecord;
  readonly replayed: boolean;
};

export type CatalogPipelineCommitInput = {
  readonly itemId: string;
  readonly expectedState: PipelineState;
  readonly expectedHistoryLength: number;
  readonly next: CatalogIntakeRecord;
};

/**
 * Explicit injected persistence/read-model boundary. A production implementation
 * is intentionally absent; implementations must remain atomic at each method.
 */
export interface CatalogTestPipelineProvider {
  readonly mode: typeof CATALOG_PIPELINE_MODE;
  submit(input: {
    readonly idempotencyKey: string;
    readonly record: CatalogIntakeRecord;
  }): Promise<SiteResult<CatalogSubmissionReceipt>>;
  read(itemId: string): Promise<SiteResult<CatalogIntakeRecord | null>>;
  commitTransition(input: CatalogPipelineCommitInput): Promise<SiteResult<CatalogIntakeRecord>>;
}

export type SubmitEditorCatalogItemInput = {
  readonly access: EditorSessionAccess;
  readonly profile: CatalogSubmissionProfile;
  readonly surface: string;
  readonly evidence: EditorCatalogEvidence;
  readonly metadata: CatalogSubmissionMetadata;
  readonly idempotencyKey: string;
  readonly provider: CatalogTestPipelineProvider;
};

export type CatalogTransitionRefusal = SiteRefusal & {
  readonly transitionCode: TransitionRefuse["code"];
};

export type CatalogPipelineTransitionResult =
  | { readonly ok: true; readonly value: CatalogIntakeRecord }
  | SiteRefusal
  | CatalogTransitionRefusal;

export type CatalogListedProjection = {
  readonly mode: typeof CATALOG_PIPELINE_MODE;
  readonly status: "listed";
  readonly surface: CatalogSurface;
  readonly itemId: string;
  readonly submittedBy: string;
  readonly documentDigest: string;
  readonly assetPackage: CatalogItem["assetPackage"];
  readonly rights: CatalogItem["rights"];
  readonly provenance: CatalogItem["provenance"];
  readonly aiGenerationDisclosure: CatalogItem["aiGenerationDisclosure"];
  readonly compatibility: CatalogItem["compatibility"];
  readonly history: CatalogItem["moderation"]["history"];
  readonly availability: {
    readonly assetDelivery: "not-provided";
    readonly purchase: "refused";
    readonly reason: "CATALOG_COMMERCE_INERT";
  };
};

export type CatalogPipelineReadModel = {
  readonly mode: typeof CATALOG_PIPELINE_MODE;
  readonly surface: CatalogSurface;
  readonly itemId: string;
  readonly pipelineState: PipelineState;
  readonly history: CatalogItem["moderation"]["history"];
  readonly listing: CatalogListedProjection | null;
};

const isSupportedSurface = (surface: string): surface is CatalogSurface =>
  surface === "catalog-game" || surface === "catalog-web";

const nonEmpty = (value: string): boolean => value.trim().length > 0;

/**
 * Structural, property-order-insensitive identity for one intake record.
 *
 * A provider that round-trips a record through persistence may rebuild it with a
 * different key order; that is the same record, so the echo check and the retry
 * discriminator both compare canonical bytes rather than raw `JSON.stringify`.
 */
function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .flatMap((key) =>
        record[key] === undefined ? [] : [[key, canonicalValue(record[key])] as const],
      ),
  );
}

function recordFingerprint(record: CatalogIntakeRecord): string {
  return JSON.stringify(canonicalValue(record));
}

function validRecord(record: CatalogIntakeRecord): boolean {
  const validated = validateCatalogItem(record.item);
  return (
    record.mode === CATALOG_PIPELINE_MODE &&
    isSupportedSurface(record.surface) &&
    nonEmpty(record.submittedBy) &&
    SHA256_RE.test(record.documentDigest) &&
    SHA256_RE.test(record.artifactDigest) &&
    validated.ok &&
    validated.item.provenance.sourceDigest === record.documentDigest &&
    validated.item.assetPackage.contentHash === record.artifactDigest
  );
}

/**
 * Submit one current editor render to intake. Validation and entitlement happen
 * before the injected provider is called, so refused requests cannot partially write.
 */
export async function submitEditorCatalogItem(
  input: SubmitEditorCatalogItemInput,
): Promise<SiteResult<CatalogSubmissionReceipt>> {
  if (input.profile === "kids" || input.metadata.compatibility.profiles.includes("kids")) {
    return refuse("KIDS_SURFACE_DENIED");
  }
  if (!isSupportedSurface(input.surface)) {
    return refuse("CATALOG_SUBMISSION_SURFACE_UNSUPPORTED");
  }
  if (SUPPORTED_PROFILE_BY_SURFACE[input.surface] !== input.profile) {
    return refuse("CATALOG_SUBMISSION_SURFACE_UNSUPPORTED");
  }

  const principal = input.access.access.principal;
  if (principal === null) return refuse("EDITOR_ENTITLEMENT_ANONYMOUS");
  if (!input.access.decision.granted) return refuse(input.access.decision.reason);
  if (input.access.decision.mode !== "entitled") {
    return refuse("CATALOG_SUBMISSION_ENTITLEMENT_REQUIRED");
  }
  if (!nonEmpty(input.idempotencyKey)) return refuse("CATALOG_SUBMISSION_REQUEST_INVALID");
  if (
    !SHA256_RE.test(input.evidence.documentDigest) ||
    !SHA256_RE.test(input.evidence.artifactDigest)
  ) {
    return refuse("CATALOG_SUBMISSION_DIGEST_INVALID");
  }
  if (!input.metadata.compatibility.profiles.includes(input.profile)) {
    return refuse("CATALOG_SUBMISSION_METADATA_INVALID");
  }
  if (input.provider.mode !== CATALOG_PIPELINE_MODE) {
    return refuse("CATALOG_PIPELINE_PROVIDER_FAILED");
  }

  const item = createCatalogItemAtIntake({
    itemId: input.metadata.itemId,
    assetPackage: {
      packageId: input.metadata.packageId,
      contentHash: input.evidence.artifactDigest,
    },
    rights: input.metadata.rights,
    provenance: {
      origin: input.metadata.provenance.origin,
      ingestedAt: input.metadata.provenance.ingestedAt,
      sourceDigest: input.evidence.documentDigest,
    },
    aiGenerationDisclosure: input.metadata.aiGenerationDisclosure,
    compatibility: input.metadata.compatibility,
  });
  const validated = validateCatalogItem(item);
  if (!validated.ok) return refuse("CATALOG_SUBMISSION_METADATA_INVALID");

  const record: CatalogIntakeRecord = Object.freeze({
    mode: CATALOG_PIPELINE_MODE,
    surface: input.surface,
    submittedBy: principal.user.userId,
    documentDigest: input.evidence.documentDigest,
    artifactDigest: input.evidence.artifactDigest,
    item: validated.item,
  });

  try {
    const submitted = await input.provider.submit({
      idempotencyKey: input.idempotencyKey,
      record,
    });
    if (!submitted.ok) return submitted;
    if (
      !validRecord(submitted.value.record) ||
      submitted.value.record.item.moderation.pipelineState !== "intake" ||
      submitted.value.record.item.moderation.history.length !== 0 ||
      recordFingerprint(submitted.value.record) !== recordFingerprint(record)
    ) {
      return refuse("CATALOG_PIPELINE_PROVIDER_FAILED");
    }
    return ok(
      Object.freeze({
        record: submitted.value.record,
        replayed: submitted.value.replayed,
      }),
    );
  } catch {
    return refuse("CATALOG_PIPELINE_PROVIDER_FAILED");
  }
}

/** Apply exactly one legal catalog transition, then atomically commit it. */
export async function transitionTestCatalogItem(input: {
  readonly provider: CatalogTestPipelineProvider;
  readonly itemId: string;
  readonly to: Exclude<PipelineState, "intake" | "delisted">;
  readonly reason: string;
  readonly at: string;
  readonly humanVerdict?: HumanCurationVerdict;
}): Promise<CatalogPipelineTransitionResult> {
  if (input.provider.mode !== CATALOG_PIPELINE_MODE) {
    return refuse("CATALOG_PIPELINE_PROVIDER_FAILED");
  }
  try {
    const found = await input.provider.read(input.itemId);
    if (!found.ok) return found;
    if (found.value === null) return refuse("CATALOG_ITEM_NOT_FOUND");
    if (!validRecord(found.value)) return refuse("CATALOG_PIPELINE_READ_MODEL_INVALID");

    const current = found.value;
    const transitioned = transitionCatalogItem(current.item, {
      to: input.to,
      reason: input.reason,
      at: input.at,
      ...(input.humanVerdict === undefined ? {} : { humanVerdict: input.humanVerdict }),
    });
    if (!transitioned.ok) {
      return Object.freeze({
        ...refuse("CATALOG_PIPELINE_TRANSITION_INVALID"),
        transitionCode: transitioned.code,
      });
    }
    if (transitioned.kind !== "catalog-item") {
      return refuse("CATALOG_PIPELINE_TRANSITION_INVALID");
    }

    const next: CatalogIntakeRecord = Object.freeze({
      ...current,
      item: transitioned.item,
    });
    const committed = await input.provider.commitTransition({
      itemId: current.item.itemId,
      expectedState: current.item.moderation.pipelineState,
      expectedHistoryLength: current.item.moderation.history.length,
      next,
    });
    if (!committed.ok) return committed;
    if (
      !validRecord(committed.value) ||
      recordFingerprint(committed.value) !== recordFingerprint(next)
    ) {
      return refuse("CATALOG_PIPELINE_PROVIDER_FAILED");
    }
    return committed;
  } catch {
    return refuse("CATALOG_PIPELINE_PROVIDER_FAILED");
  }
}

/** Read pipeline state; only a validated `listed` item receives a listing projection. */
export async function readCatalogPipelineItem(input: {
  readonly provider: CatalogTestPipelineProvider;
  readonly itemId: string;
}): Promise<SiteResult<CatalogPipelineReadModel>> {
  if (input.provider.mode !== CATALOG_PIPELINE_MODE) {
    return refuse("CATALOG_PIPELINE_PROVIDER_FAILED");
  }
  try {
    const found = await input.provider.read(input.itemId);
    if (!found.ok) return found;
    if (found.value === null) return refuse("CATALOG_ITEM_NOT_FOUND");
    const record = found.value;
    if (!validRecord(record)) return refuse("CATALOG_PIPELINE_READ_MODEL_INVALID");
    const item = record.item;
    const listing: CatalogListedProjection | null =
      item.moderation.pipelineState === "listed"
        ? Object.freeze({
            mode: CATALOG_PIPELINE_MODE,
            status: "listed" as const,
            surface: record.surface,
            itemId: item.itemId,
            submittedBy: record.submittedBy,
            documentDigest: record.documentDigest,
            assetPackage: item.assetPackage,
            rights: item.rights,
            provenance: item.provenance,
            aiGenerationDisclosure: item.aiGenerationDisclosure,
            compatibility: item.compatibility,
            history: item.moderation.history,
            availability: Object.freeze({
              assetDelivery: "not-provided" as const,
              purchase: "refused" as const,
              reason: "CATALOG_COMMERCE_INERT" as const,
            }),
          })
        : null;
    return ok(
      Object.freeze({
        mode: CATALOG_PIPELINE_MODE,
        surface: record.surface,
        itemId: item.itemId,
        pipelineState: item.moderation.pipelineState,
        history: item.moderation.history,
        listing,
      }),
    );
  } catch {
    return refuse("CATALOG_PIPELINE_PROVIDER_FAILED");
  }
}

/** Process-local reference provider used only by tests and the labeled UI demonstration. */
export function createInMemoryCatalogTestPipelineProvider(): CatalogTestPipelineProvider {
  const records = new Map<string, CatalogIntakeRecord>();
  const retries = new Map<
    string,
    { readonly fingerprint: string; readonly receipt: CatalogSubmissionReceipt }
  >();

  const provider: CatalogTestPipelineProvider = {
    mode: CATALOG_PIPELINE_MODE,
    async submit(input: {
      readonly idempotencyKey: string;
      readonly record: CatalogIntakeRecord;
    }) {
      const fingerprint = recordFingerprint(input.record);
      const retry = retries.get(input.idempotencyKey);
      if (retry !== undefined) {
        return retry.fingerprint === fingerprint
          ? ok(Object.freeze({ ...retry.receipt, replayed: true as const }))
          : refuse("CATALOG_SUBMISSION_RETRY_CONFLICT");
      }
      if (records.has(input.record.item.itemId)) {
        return refuse("CATALOG_SUBMISSION_RETRY_CONFLICT");
      }
      const receipt = Object.freeze({ record: input.record, replayed: false as const });
      records.set(input.record.item.itemId, input.record);
      retries.set(input.idempotencyKey, { fingerprint, receipt });
      return ok(receipt);
    },
    async read(itemId: string) {
      return ok(records.get(itemId) ?? null);
    },
    async commitTransition(input: CatalogPipelineCommitInput) {
      const current = records.get(input.itemId);
      if (
        current === undefined ||
        current.item.moderation.pipelineState !== input.expectedState ||
        current.item.moderation.history.length !== input.expectedHistoryLength ||
        input.next.item.itemId !== input.itemId ||
        input.next.item.moderation.history.length !== input.expectedHistoryLength + 1
      ) {
        return refuse("CATALOG_SUBMISSION_RETRY_CONFLICT");
      }
      records.set(input.itemId, input.next);
      return ok(input.next);
    },
  };
  return Object.freeze(provider);
}

const demoDigest = (digit: string): string => `sha256:${digit.repeat(64)}`;

/** A deterministic, labeled TEST demonstration consumed by both honest `/publish` pages. */
export async function catalogTestPipelineDemo(
  surface: CatalogSurface,
): Promise<SiteResult<{ readonly intake: CatalogPipelineReadModel; readonly listed: CatalogPipelineReadModel }>> {
  const profile = SUPPORTED_PROFILE_BY_SURFACE[surface];
  const provider = createInMemoryCatalogTestPipelineProvider();
  const submitted = await submitEditorCatalogItem({
    access: {
      access: {
        principal: {
          user: {
            userId: "test-editor-submitter",
            email: "editor-fixture@sceneaxi.test",
            emailVerified: true,
            disabled: false,
          },
          role: "user",
          session: {
            sessionId: "test-editor-session",
            userId: "test-editor-submitter",
            surface: "site",
            issuedAt: "2026-08-06T09:00:00.000Z",
            expiresAt: "2026-08-06T11:00:00.000Z",
          },
        },
        identity: ok({
          user: {
            userId: "test-editor-submitter",
            email: "editor-fixture@sceneaxi.test",
            emailVerified: true,
            disabled: false,
          },
          role: "user",
          session: {
            sessionId: "test-editor-session",
            userId: "test-editor-submitter",
            surface: "site",
            issuedAt: "2026-08-06T09:00:00.000Z",
            expiresAt: "2026-08-06T11:00:00.000Z",
          },
        }),
        credits: ok({
          userId: "test-editor-submitter",
          balance: 10,
          starterGrantConsumed: true,
        }),
        entitlement: {
          entitled: true,
          basis: "credit-balance",
          starterCredits: null,
        },
      },
      decision: { granted: true, mode: "entitled", basis: "credit-balance" },
      previewEnabled: false,
    },
    profile,
    surface,
    evidence: {
      documentDigest: demoDigest(surface === "catalog-game" ? "a" : "b"),
      artifactDigest: demoDigest(surface === "catalog-game" ? "c" : "d"),
    },
    metadata: {
      itemId: `${profile}-editor-test-item`,
      packageId: `${profile}-editor-test-package`,
      rights: {
        license: "TEST fixture declaration",
        rightsHolder: "TEST editor submitter",
        commercialUseAllowed: false,
      },
      provenance: {
        origin: "umbrella Web editor TEST fixture",
        ingestedAt: "2026-08-06T10:00:00.000Z",
      },
      aiGenerationDisclosure: {
        aiGenerated: true,
        disclosureText: "Generated from the deterministic editor fixture; not a delivered asset.",
        tools: ["SceneAxi TEST fixture"],
      },
      compatibility: { coreRange: "0.0.0", profiles: [profile] },
    },
    idempotencyKey: `${surface}-editor-test-submission`,
    provider,
  });
  if (!submitted.ok) return submitted;
  const intake = await readCatalogPipelineItem({ provider, itemId: submitted.value.record.item.itemId });
  if (!intake.ok) return intake;

  const steps = [
    { to: "screening" as const, reason: "TEST screening handoff recorded." },
    { to: "curation" as const, reason: "TEST curation review opened." },
    {
      to: "listed" as const,
      reason: "Explicit TEST human approval recorded.",
      humanVerdict: {
        kind: "human" as const,
        decision: "approve" as const,
        curatorId: "test-curator-fixture",
        rationale: "Approved only for the labeled TEST read-model demonstration.",
        recordedAt: "2026-08-06T10:03:00.000Z",
      },
    },
  ];
  for (const [index, step] of steps.entries()) {
    const moved = await transitionTestCatalogItem({
      provider,
      itemId: submitted.value.record.item.itemId,
      to: step.to,
      reason: step.reason,
      at: `2026-08-06T10:0${String(index)}:00.000Z`,
      ...("humanVerdict" in step ? { humanVerdict: step.humanVerdict } : {}),
    });
    if (!moved.ok) return moved;
  }
  const listed = await readCatalogPipelineItem({
    provider,
    itemId: submitted.value.record.item.itemId,
  });
  if (!listed.ok) return listed;
  return ok(Object.freeze({ intake: intake.value, listed: listed.value }));
}
