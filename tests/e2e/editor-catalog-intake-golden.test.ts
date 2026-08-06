/** Editor -> TEST catalog intake -> explicit curation -> listed read-model proof. */
import { describe, expect, it } from "vitest";
import {
  attemptCatalogPurchase,
  catalogTestPipelineDemo,
  createInMemoryCatalogTestPipelineProvider,
  ok,
  readCatalogPipelineItem,
  readEditorState,
  renderEditorState,
  submitEditorCatalogItem,
  transitionTestCatalogItem,
  type CatalogSubmissionMetadata,
  type CatalogTestPipelineProvider,
  type EditorRender,
  type EditorSessionAccess,
} from "@sceneaxi/site-kit";
import { submitUmbrellaEditorToCatalog } from "../../sites/umbrella/src/lib/catalog-submission.ts";

const NOW = "2026-08-06T10:00:00.000Z";

function entitledAccess(): EditorSessionAccess {
  const principal = {
    user: {
      userId: "user-editor-218",
      email: "editor-218@sceneaxi.test",
      emailVerified: true,
      disabled: false,
    },
    role: "user" as const,
    session: {
      sessionId: "session-editor-218",
      userId: "user-editor-218",
      surface: "site" as const,
      issuedAt: "2026-08-06T09:00:00.000Z",
      expiresAt: "2026-08-06T11:00:00.000Z",
    },
  };
  return {
    access: {
      principal,
      identity: ok(principal),
      credits: ok({ userId: principal.user.userId, balance: 12, starterGrantConsumed: true }),
      entitlement: { entitled: true, basis: "credit-balance", starterCredits: null },
    },
    decision: { granted: true, mode: "entitled", basis: "credit-balance" },
    previewEnabled: false,
  };
}

function editorRender(): EditorRender {
  const state = readEditorState({ profile: "web" });
  if (!state.ok) throw new Error(state.message);
  const rendered = renderEditorState(state.value);
  if (!rendered.ok) throw new Error(rendered.message);
  expect(rendered.value.save.ok).toBe(true);
  expect(rendered.value.composition.ok).toBe(true);
  return rendered.value;
}

function metadata(overrides: Partial<CatalogSubmissionMetadata> = {}): CatalogSubmissionMetadata {
  return {
    itemId: "web-editor-submission-218",
    packageId: "web-editor-package-218",
    rights: {
      license: "CC-BY-4.0",
      rightsHolder: "SceneAxi TEST creator",
      commercialUseAllowed: true,
    },
    provenance: { origin: "umbrella Web editor", ingestedAt: NOW },
    aiGenerationDisclosure: {
      aiGenerated: true,
      disclosureText: "Built with the bounded SceneAxi editor fixture.",
      tools: ["SceneAxi"],
    },
    compatibility: { coreRange: "0.0.0", profiles: ["web"] },
    ...overrides,
  };
}

async function submit(
  provider: CatalogTestPipelineProvider,
  overrides: Partial<Parameters<typeof submitUmbrellaEditorToCatalog>[0]> = {},
) {
  return submitUmbrellaEditorToCatalog({
    access: entitledAccess(),
    render: editorRender(),
    profile: "web",
    surface: "catalog-web",
    metadata: metadata(),
    idempotencyKey: "editor-submit-218",
    provider,
    ...overrides,
  });
}

describe("editor catalog intake", () => {
  it("creates one validated digest-bound CatalogItem at intake", async () => {
    const provider = createInMemoryCatalogTestPipelineProvider();
    const render = editorRender();
    const result = await submit(provider, { render });

    expect(result).toMatchObject({
      ok: true,
      value: {
        replayed: false,
        record: {
          mode: "test",
          surface: "catalog-web",
          submittedBy: "user-editor-218",
          item: { moderation: { pipelineState: "intake", history: [] } },
        },
      },
    });
    if (!result.ok) return;
    expect(result.value.record.documentDigest).toBe(render.documentDigest);
    expect(result.value.record.item.provenance.sourceDigest).toBe(render.documentDigest);
    expect(result.value.record.item.assetPackage.contentHash).toBe(render.artifactDigest);
    expect(result.value.record.item.commerce).toEqual({ activation: "inert" });
  });

  it("replays an identical retry and refuses conflicting retries without mutation", async () => {
    const provider = createInMemoryCatalogTestPipelineProvider();
    const first = await submit(provider);
    const replay = await submit(provider);
    const conflict = await submit(provider, {
      metadata: metadata({ itemId: "different-editor-item" }),
    });

    expect(first).toMatchObject({ ok: true, value: { replayed: false } });
    expect(replay).toMatchObject({ ok: true, value: { replayed: true } });
    expect(conflict).toMatchObject({ ok: false, reason: "CATALOG_SUBMISSION_RETRY_CONFLICT" });
    const untouched = await readCatalogPipelineItem({
      provider,
      itemId: "web-editor-submission-218",
    });
    expect(untouched).toMatchObject({
      ok: true,
      value: { pipelineState: "intake", history: [], listing: null },
    });
  });

  it("records each directed transition and requires an explicit human approval", async () => {
    const provider = createInMemoryCatalogTestPipelineProvider();
    const submitted = await submit(provider);
    expect(submitted.ok).toBe(true);

    const skipped = await transitionTestCatalogItem({
      provider,
      itemId: "web-editor-submission-218",
      to: "listed",
      reason: "skip",
      at: NOW,
      humanVerdict: {
        kind: "human",
        decision: "approve",
        curatorId: "curator-test",
        rationale: "test",
        recordedAt: NOW,
      },
    });
    expect(skipped).toMatchObject({
      ok: false,
      reason: "CATALOG_PIPELINE_TRANSITION_INVALID",
      transitionCode: "illegal-transition",
    });

    const screening = await transitionTestCatalogItem({
      provider,
      itemId: "web-editor-submission-218",
      to: "screening",
      reason: "TEST screening complete.",
      at: "2026-08-06T10:01:00.000Z",
    });
    const curation = await transitionTestCatalogItem({
      provider,
      itemId: "web-editor-submission-218",
      to: "curation",
      reason: "TEST curation opened.",
      at: "2026-08-06T10:02:00.000Z",
    });
    expect(screening.ok).toBe(true);
    expect(curation.ok).toBe(true);

    const rejected = await transitionTestCatalogItem({
      provider,
      itemId: "web-editor-submission-218",
      to: "listed",
      reason: "TEST verdict recorded.",
      at: "2026-08-06T10:03:00.000Z",
      humanVerdict: {
        kind: "human",
        decision: "reject",
        curatorId: "curator-test",
        rationale: "Required revision.",
        recordedAt: "2026-08-06T10:03:00.000Z",
      },
    });
    expect(rejected).toMatchObject({
      ok: false,
      reason: "CATALOG_PIPELINE_TRANSITION_INVALID",
      transitionCode: "human-verdict-rejected",
    });
    expect(await readCatalogPipelineItem({ provider, itemId: "web-editor-submission-218" })).toMatchObject({
      ok: true,
      value: { pipelineState: "curation", history: [{ to: "screening" }, { to: "curation" }], listing: null },
    });

    const approved = await transitionTestCatalogItem({
      provider,
      itemId: "web-editor-submission-218",
      to: "listed",
      reason: "TEST human approval recorded.",
      at: "2026-08-06T10:04:00.000Z",
      humanVerdict: {
        kind: "human",
        decision: "approve",
        curatorId: "curator-test",
        rationale: "Required metadata reviewed in TEST.",
        recordedAt: "2026-08-06T10:04:00.000Z",
      },
    });
    expect(approved.ok).toBe(true);
    const listed = await readCatalogPipelineItem({ provider, itemId: "web-editor-submission-218" });
    expect(listed).toMatchObject({
      ok: true,
      value: {
        pipelineState: "listed",
        history: [
          { from: "intake", to: "screening" },
          { from: "screening", to: "curation" },
          { from: "curation", to: "listed", humanVerdict: { decision: "approve" } },
        ],
        listing: {
          mode: "test",
          status: "listed",
          availability: {
            assetDelivery: "not-provided",
            purchase: "refused",
            reason: "CATALOG_COMMERCE_INERT",
          },
        },
      },
    });
    expect(
      attemptCatalogPurchase({
        surface: "catalog-web",
        itemId: "web-editor-submission-218",
        payWith: "credits",
      }),
    ).toMatchObject({ ok: false, reason: "CATALOG_ITEM_NOT_FOUND" });
  });

  it("refuses anonymous, preview, Kids, unsupported, malformed, and unavailable inputs before writes", async () => {
    let writes = 0;
    const backing = createInMemoryCatalogTestPipelineProvider();
    const counting: CatalogTestPipelineProvider = {
      mode: "test",
      async submit(input) {
        writes += 1;
        return backing.submit(input);
      },
      read: (itemId) => backing.read(itemId),
      commitTransition: (input) => backing.commitTransition(input),
    };
    const anonymous = entitledAccess();
    const anonymousAccess: EditorSessionAccess = {
      ...anonymous,
      access: { ...anonymous.access, principal: null },
      decision: {
        granted: false,
        reason: "EDITOR_ENTITLEMENT_ANONYMOUS",
        message: "anonymous",
      },
    };
    expect(await submit(counting, { access: anonymousAccess })).toMatchObject({
      reason: "EDITOR_ENTITLEMENT_ANONYMOUS",
    });
    const noCredits: EditorSessionAccess = {
      ...entitledAccess(),
      decision: {
        granted: false,
        reason: "EDITOR_ENTITLEMENT_NO_CREDITS",
        message: "no credits",
      },
    };
    expect(await submit(counting, { access: noCredits })).toMatchObject({
      reason: "EDITOR_ENTITLEMENT_NO_CREDITS",
    });
    const preview: EditorSessionAccess = {
      ...entitledAccess(),
      decision: { granted: true, mode: "preview", basis: "preview-flag" },
      previewEnabled: true,
    };
    expect(await submit(counting, { access: preview })).toMatchObject({
      reason: "CATALOG_SUBMISSION_ENTITLEMENT_REQUIRED",
    });
    expect(await submit(counting, { profile: "kids" })).toMatchObject({
      reason: "KIDS_SURFACE_DENIED",
    });
    expect(await submit(counting, { surface: "catalog-unknown" })).toMatchObject({
      reason: "CATALOG_SUBMISSION_SURFACE_UNSUPPORTED",
    });
    expect(
      await submit(counting, {
        metadata: metadata({ rights: { license: "", rightsHolder: "", commercialUseAllowed: true } }),
      }),
    ).toMatchObject({ reason: "CATALOG_SUBMISSION_METADATA_INVALID" });
    const badRender = { ...editorRender(), documentDigest: "not-a-digest" };
    expect(await submit(counting, { render: badRender })).toMatchObject({
      reason: "CATALOG_SUBMISSION_DIGEST_INVALID",
    });
    expect(writes).toBe(0);

    const unavailable: CatalogTestPipelineProvider = {
      mode: "test",
      async submit() {
        return { ok: false, reason: "CATALOG_INTAKE_STORAGE_UNAVAILABLE", message: "offline" };
      },
      async read() {
        return { ok: false, reason: "CATALOG_INTAKE_STORAGE_UNAVAILABLE", message: "offline" };
      },
      async commitTransition() {
        return { ok: false, reason: "CATALOG_INTAKE_STORAGE_UNAVAILABLE", message: "offline" };
      },
    };
    expect(await submit(unavailable)).toMatchObject({
      reason: "CATALOG_INTAKE_STORAGE_UNAVAILABLE",
    });

    const failed: CatalogTestPipelineProvider = {
      ...unavailable,
      async submit() {
        throw new Error("provider failed");
      },
    };
    expect(await submit(failed)).toMatchObject({ reason: "CATALOG_PIPELINE_PROVIDER_FAILED" });
  });

  it.each([
    ["item id", { itemId: "" }],
    ["package id", { packageId: "" }],
    ["rights", { rights: { license: "", rightsHolder: "", commercialUseAllowed: true } }],
    ["provenance", { provenance: { origin: "", ingestedAt: "not-a-date" } }],
    ["AI disclosure", { aiGenerationDisclosure: { aiGenerated: true, disclosureText: "" } }],
    ["compatibility", { compatibility: { coreRange: "", profiles: [] } }],
  ])("refuses incomplete %s metadata without writing", async (_label, malformed) => {
    let writes = 0;
    const backing = createInMemoryCatalogTestPipelineProvider();
    const provider: CatalogTestPipelineProvider = {
      mode: "test",
      async submit(input) {
        writes += 1;
        return backing.submit(input);
      },
      read: (itemId) => backing.read(itemId),
      commitTransition: (input) => backing.commitTransition(input),
    };
    const result = await submit(provider, {
      metadata: metadata(malformed as Partial<CatalogSubmissionMetadata>),
    });
    expect(result).toMatchObject({
      ok: false,
      reason: "CATALOG_SUBMISSION_METADATA_INVALID",
    });
    expect(writes).toBe(0);
  });

  it("refuses a failed transition commit without partially mutating the record", async () => {
    const backing = createInMemoryCatalogTestPipelineProvider();
    expect((await submit(backing)).ok).toBe(true);
    const refusingCommit: CatalogTestPipelineProvider = {
      mode: "test",
      submit: (input) => backing.submit(input),
      read: (itemId) => backing.read(itemId),
      async commitTransition() {
        return {
          ok: false,
          reason: "CATALOG_INTAKE_STORAGE_UNAVAILABLE",
          message: "atomic commit unavailable",
        };
      },
    };
    expect(
      await transitionTestCatalogItem({
        provider: refusingCommit,
        itemId: "web-editor-submission-218",
        to: "screening",
        reason: "TEST screening complete.",
        at: NOW,
      }),
    ).toMatchObject({ reason: "CATALOG_INTAKE_STORAGE_UNAVAILABLE" });
    expect(await readCatalogPipelineItem({ provider: backing, itemId: "web-editor-submission-218" })).toMatchObject({
      ok: true,
      value: { pipelineState: "intake", history: [] },
    });
  });

  it("keeps the lower-level seam typed and provider-injected", async () => {
    const provider = createInMemoryCatalogTestPipelineProvider();
    const render = editorRender();
    const result = await submitEditorCatalogItem({
      access: entitledAccess(),
      profile: "web",
      surface: "catalog-web",
      evidence: {
        documentDigest: render.documentDigest,
        artifactDigest: render.artifactDigest,
      },
      metadata: metadata(),
      idempotencyKey: "direct-seam-218",
      provider,
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a malformed injected read model and renders only the labeled TEST demo", async () => {
    const invalidProvider: CatalogTestPipelineProvider = {
      mode: "test",
      async submit() {
        return { ok: false, reason: "CATALOG_INTAKE_STORAGE_UNAVAILABLE", message: "unused" };
      },
      async read() {
        return ok({
          mode: "test",
          surface: "catalog-web",
          submittedBy: "test",
          documentDigest: `sha256:${"a".repeat(64)}`,
          artifactDigest: `sha256:${"b".repeat(64)}`,
          item: { broken: true },
        } as never);
      },
      async commitTransition() {
        return { ok: false, reason: "CATALOG_INTAKE_STORAGE_UNAVAILABLE", message: "unused" };
      },
    };
    expect(
      await readCatalogPipelineItem({ provider: invalidProvider, itemId: "bad" }),
    ).toMatchObject({ reason: "CATALOG_PIPELINE_READ_MODEL_INVALID" });

    for (const surface of ["catalog-game", "catalog-web"] as const) {
      const demo = await catalogTestPipelineDemo(surface);
      expect(demo).toMatchObject({
        ok: true,
        value: {
          intake: { mode: "test", pipelineState: "intake", history: [], listing: null },
          listed: {
            mode: "test",
            pipelineState: "listed",
            history: [{ to: "screening" }, { to: "curation" }, { to: "listed" }],
            listing: {
              mode: "test",
              availability: { assetDelivery: "not-provided", purchase: "refused" },
            },
          },
        },
      });
    }
  });
});
