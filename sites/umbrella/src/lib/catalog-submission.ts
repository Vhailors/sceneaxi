/**
 * Umbrella-owned adapter from the entitled editor render to catalog intake.
 *
 * Identity and entitlement are carried from the request's already-resolved access;
 * this module reads no environment, provider credential, or deployment store. The
 * only persistence boundary is the explicitly injected TEST provider.
 *
 * Submitting is an **action**, never a render. `buildUmbrellaCatalogIntakeView()`
 * writes, so it is reachable only from the POST handler at
 * `UMBRELLA_CATALOG_INTAKE_ACTION`; a GET of `/editor` calls
 * `readUmbrellaCatalogIntakePanel()`, which reads and never submits. That split is
 * what keeps merely loading the page — a prefetch, a refresh, a crawler — from
 * writing to a deployment's intake store.
 *
 * The whole input on both paths is one injection: the TEST provider that would store
 * the record and the submitter's own declaration. This repository ships no catalog
 * store and no declaration form, so `umbrellaCatalogIntake()` resolves to `null`, the
 * page renders `CATALOG_INTAKE_STORAGE_UNAVAILABLE` without touching a provider, and
 * the action offers no control to press. Nothing here invents a licence, a rights
 * holder, a disclosure, or a curation verdict on a visitor's behalf.
 */
import {
  ok,
  readCatalogPipelineItem,
  refuse,
  submitEditorCatalogItem,
  type CatalogListedProjection,
  type CatalogSubmissionMetadata,
  type CatalogSubmissionProfile,
  type CatalogSubmissionReceipt,
  type CatalogTestPipelineProvider,
  type EditorRender,
  type EditorSessionAccess,
  type PipelineState,
  type SearchParams,
  type SiteResult,
} from "@sceneaxi/site-kit";

export async function submitUmbrellaEditorToCatalog(input: {
  readonly access: EditorSessionAccess;
  readonly render: EditorRender;
  readonly profile: CatalogSubmissionProfile;
  readonly surface: string;
  readonly metadata: CatalogSubmissionMetadata;
  readonly idempotencyKey: string;
  readonly provider: CatalogTestPipelineProvider;
}): Promise<SiteResult<CatalogSubmissionReceipt>> {
  return submitEditorCatalogItem({
    access: input.access,
    profile: input.profile,
    surface: input.surface,
    evidence: {
      documentDigest: input.render.documentDigest,
      artifactDigest: input.render.artifactDigest,
    },
    metadata: input.metadata,
    idempotencyKey: input.idempotencyKey,
    provider: input.provider,
  });
}

/** Everything a deployment would have to supply before one submission may happen. */
export type UmbrellaCatalogIntakeInjection = {
  readonly provider: CatalogTestPipelineProvider;
  /** The submitter's own Catalog Item declarations. Never derived from the render. */
  readonly declaration: CatalogSubmissionMetadata;
};

/** What a stored record honestly says, whether it was just written or only read back. */
export type UmbrellaCatalogIntakeRecordView = {
  readonly itemId: string;
  readonly pipelineState: PipelineState;
  readonly recordedTransitions: number;
  readonly documentDigest: string;
  readonly artifactDigest: string;
  readonly listing: CatalogListedProjection | null;
};

/** What the action reports after one submission: honest state, never a listing it invented. */
export type UmbrellaCatalogIntakeView = UmbrellaCatalogIntakeRecordView & {
  readonly replayed: boolean;
};

/** The POST-only endpoint that owns every submission this site can make. */
export const UMBRELLA_CATALOG_INTAKE_ACTION = "/api/editor/catalog-intake";

/**
 * What a GET of `/editor` may say about intake.
 *
 * Four honest answers and no fifth: the deployment injects nothing, it injects a
 * provider but holds no record for this render yet, it holds one, or the read itself
 * refused. None of them submits, so the state a visitor sees is either what the
 * provider returned or a named refusal.
 */
export type UmbrellaCatalogIntakePanel =
  | { readonly kind: "unavailable"; readonly reason: string; readonly message: string }
  | { readonly kind: "offered" }
  | { readonly kind: "recorded"; readonly record: UmbrellaCatalogIntakeRecordView }
  | { readonly kind: "read-refused"; readonly reason: string; readonly message: string };

/**
 * This deployment's catalog intake injection.
 *
 * Absent by construction: there is no production store to write to and no form that
 * collects the declarations intake requires, so the honest answer is `null` rather
 * than a process-local stand-in pretending to be persistence.
 */
export function umbrellaCatalogIntake(): UmbrellaCatalogIntakeInjection | null {
  return null;
}

/**
 * The idempotency key for one editor render.
 *
 * Derived from the render's own digests, so re-opening the same editor URL replays
 * the submission it already made instead of conflicting with it. The submitter is
 * not part of this key: the seam scopes it by the request's authenticated principal.
 */
export function umbrellaCatalogIntakeKey(render: EditorRender): string {
  return `editor-render:${render.documentDigest}:${render.artifactDigest}`;
}

/**
 * What `/editor` may say about intake on a **GET**, without submitting anything.
 *
 * An absent injection is answered from the injection alone, so the shipped deployment
 * reaches no provider at all. When one is injected, this reads the declared item back
 * — a read, never a write — so a visitor returning from the action sees the record the
 * provider actually holds rather than a claim carried in the URL. The item id comes
 * from the deployment's own declaration, never from the request, so no crafted link
 * can turn this panel into a lookup of somebody else's submission.
 */
export async function readUmbrellaCatalogIntakePanel(input: {
  readonly injection: UmbrellaCatalogIntakeInjection | null;
}): Promise<UmbrellaCatalogIntakePanel> {
  if (input.injection === null) {
    const absent = refuse("CATALOG_INTAKE_STORAGE_UNAVAILABLE");
    return Object.freeze({
      kind: "unavailable" as const,
      reason: absent.reason,
      message: absent.message,
    });
  }
  const stored = await readCatalogPipelineItem({
    provider: input.injection.provider,
    itemId: input.injection.declaration.itemId,
  });
  if (!stored.ok) {
    // Nothing recorded yet is not a fault: it is the state before the visitor has
    // pressed the one control that submits.
    if (stored.reason === "CATALOG_ITEM_NOT_FOUND") return Object.freeze({ kind: "offered" as const });
    return Object.freeze({
      kind: "read-refused" as const,
      reason: stored.reason,
      message: stored.message,
    });
  }
  return Object.freeze({
    kind: "recorded" as const,
    record: Object.freeze({
      itemId: stored.value.itemId,
      pipelineState: stored.value.pipelineState,
      recordedTransitions: stored.value.history.length,
      documentDigest: stored.value.documentDigest,
      artifactDigest: stored.value.artifactDigest,
      listing: stored.value.listing,
    }),
  });
}

/**
 * The current editor URL state, flattened to hidden form fields.
 *
 * The intake action re-renders the same session server-side, so the digests it submits
 * are the digests the panel was showing. Only parameters this request already carried
 * are echoed — the page reached this point by rendering them — and the action reads
 * the state back through `readEditorState()` exactly like the page did, so a tampered
 * field refuses there rather than reaching intake.
 */
export function umbrellaEditorStateFields(
  params: SearchParams,
): ReadonlyArray<{ readonly name: string; readonly value: string }> {
  return Object.entries(params).flatMap(([name, value]) => {
    if (value === undefined) return [];
    const values = typeof value === "string" ? [value] : value;
    return values.map((entry) => Object.freeze({ name, value: entry }));
  });
}

/** The same fields read back off the submitted form, as one request's query state. */
export function umbrellaEditorStateFromFields(
  fields: ReadonlyArray<{ readonly name: string; readonly value: string }>,
): SearchParams {
  const params: Record<string, string | string[]> = {};
  for (const field of fields) {
    const existing = params[field.name];
    if (existing === undefined) params[field.name] = field.value;
    else if (typeof existing === "string") params[field.name] = [existing, field.value];
    else existing.push(field.value);
  }
  return params;
}

/**
 * Submit the current entitled render and read back what the pipeline actually holds.
 *
 * **This writes.** Only the POST handler at `UMBRELLA_CATALOG_INTAKE_ACTION` calls it;
 * a page render calls `readUmbrellaCatalogIntakePanel()` instead.
 *
 * Listing is not part of this path: a fresh record is `intake` with no history, and
 * `listing` stays `null` until screening, curation, and an explicit human approval
 * have each been recorded elsewhere.
 */
export async function buildUmbrellaCatalogIntakeView(input: {
  readonly access: EditorSessionAccess;
  readonly render: EditorRender;
  readonly profile: CatalogSubmissionProfile;
  readonly surface: string;
  readonly injection: UmbrellaCatalogIntakeInjection | null;
}): Promise<SiteResult<UmbrellaCatalogIntakeView>> {
  if (input.injection === null) return refuse("CATALOG_INTAKE_STORAGE_UNAVAILABLE");
  const provider = input.injection.provider;
  const submitted = await submitUmbrellaEditorToCatalog({
    access: input.access,
    render: input.render,
    profile: input.profile,
    surface: input.surface,
    metadata: input.injection.declaration,
    idempotencyKey: umbrellaCatalogIntakeKey(input.render),
    provider,
  });
  if (!submitted.ok) return submitted;

  const stored = await readCatalogPipelineItem({
    provider,
    itemId: submitted.value.record.item.itemId,
  });
  if (!stored.ok) return stored;

  return ok(
    Object.freeze({
      itemId: stored.value.itemId,
      pipelineState: stored.value.pipelineState,
      recordedTransitions: stored.value.history.length,
      documentDigest: submitted.value.record.documentDigest,
      artifactDigest: submitted.value.record.artifactDigest,
      replayed: submitted.value.replayed,
      listing: stored.value.listing,
    }),
  );
}
