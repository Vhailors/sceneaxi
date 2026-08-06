/** Editor -> TEST catalog intake -> explicit curation -> listed read-model proof. */
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  attemptCatalogPurchase,
  catalogSubmissionScopeKey,
  catalogTestPipelineDemo,
  createInMemoryCatalogTestPipelineProvider,
  ok,
  readCatalogPipelineItem,
  readEditorState,
  renderEditorState,
  submitEditorCatalogItem,
  transitionTestCatalogItem,
  type CatalogIntakeRecord,
  type CatalogSubmissionMetadata,
  type CatalogTestPipelineProvider,
  type EditorRender,
  type EditorSessionAccess,
} from "@sceneaxi/site-kit";
import {
  buildUmbrellaCatalogIntakeView,
  readUmbrellaCatalogIntakePanel,
  submitUmbrellaEditorToCatalog,
  umbrellaCatalogIntake,
  umbrellaEditorStateFields,
  umbrellaEditorStateFromFields,
} from "../../sites/umbrella/src/lib/catalog-submission.ts";

const NOW = "2026-08-06T10:00:00.000Z";

function entitledAccess(userId = "user-editor-218"): EditorSessionAccess {
  const principal = {
    user: {
      userId,
      email: "editor-218@sceneaxi.test",
      emailVerified: true,
      disabled: false,
    },
    role: "user" as const,
    session: {
      sessionId: "session-editor-218",
      userId,
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

  it("refuses by name when the commit boundary throws instead of refusing", async () => {
    const backing = createInMemoryCatalogTestPipelineProvider();
    expect((await submit(backing)).ok).toBe(true);
    const throwingCommit: CatalogTestPipelineProvider = {
      mode: "test",
      submit: (input) => backing.submit(input),
      read: (itemId) => backing.read(itemId),
      async commitTransition() {
        throw new Error("commit boundary unavailable");
      },
    };
    expect(
      await transitionTestCatalogItem({
        provider: throwingCommit,
        itemId: "web-editor-submission-218",
        to: "screening",
        reason: "TEST screening complete.",
        at: NOW,
      }),
    ).toMatchObject({ ok: false, reason: "CATALOG_PIPELINE_PROVIDER_FAILED" });
    expect(
      await readCatalogPipelineItem({ provider: backing, itemId: "web-editor-submission-218" }),
    ).toMatchObject({ ok: true, value: { pipelineState: "intake", history: [] } });
  });

  it("refuses a commit that returns anything but the transition it was asked to commit", async () => {
    const backing = createInMemoryCatalogTestPipelineProvider();
    expect((await submit(backing)).ok).toBe(true);
    const driftingCommit: CatalogTestPipelineProvider = {
      mode: "test",
      submit: (input) => backing.submit(input),
      read: (itemId) => backing.read(itemId),
      async commitTransition(input) {
        const committed = await backing.commitTransition(input);
        return committed.ok
          ? ok({ ...committed.value, documentDigest: `sha256:${"f".repeat(64)}` })
          : committed;
      },
    };
    expect(
      await transitionTestCatalogItem({
        provider: driftingCommit,
        itemId: "web-editor-submission-218",
        to: "screening",
        reason: "TEST screening complete.",
        at: NOW,
      }),
    ).toMatchObject({ ok: false, reason: "CATALOG_PIPELINE_PROVIDER_FAILED" });
  });

  it("accepts a provider that rebuilds the same record with a different key order", async () => {
    const reorder = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reorder);
      if (value === null || typeof value !== "object") return value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .reverse()
          .map(([key, inner]) => [key, reorder(inner)]),
      );
    };
    const backing = createInMemoryCatalogTestPipelineProvider();
    const roundTripping: CatalogTestPipelineProvider = {
      mode: "test",
      async submit(input) {
        const result = await backing.submit(input);
        return result.ok
          ? ok({
              ...result.value,
              record: reorder(result.value.record) as CatalogIntakeRecord,
            })
          : result;
      },
      async read(itemId) {
        const found = await backing.read(itemId);
        return found.ok && found.value !== null
          ? ok(reorder(found.value) as CatalogIntakeRecord)
          : found;
      },
      async commitTransition(input) {
        const committed = await backing.commitTransition(input);
        return committed.ok ? ok(reorder(committed.value) as CatalogIntakeRecord) : committed;
      },
    };

    expect(await submit(roundTripping)).toMatchObject({ ok: true, value: { replayed: false } });
    expect(await submit(roundTripping)).toMatchObject({ ok: true, value: { replayed: true } });
    expect(
      await transitionTestCatalogItem({
        provider: roundTripping,
        itemId: "web-editor-submission-218",
        to: "screening",
        reason: "TEST screening complete.",
        at: NOW,
      }),
    ).toMatchObject({ ok: true, value: { item: { moderation: { pipelineState: "screening" } } } });
  });

  it("scopes one idempotency key to the authenticated submitter", async () => {
    const provider = createInMemoryCatalogTestPipelineProvider();
    const mine = { access: entitledAccess("user-editor-218") };
    const theirs = {
      access: entitledAccess("user-editor-999"),
      metadata: metadata({ itemId: "web-editor-submission-999" }),
    };

    // Both principals use the same client-chosen key. Neither may be told the other's
    // unrelated submission was a conflicting retry of theirs.
    expect(await submit(provider, mine)).toMatchObject({
      ok: true,
      value: { replayed: false, record: { submittedBy: "user-editor-218" } },
    });
    expect(await submit(provider, theirs)).toMatchObject({
      ok: true,
      value: { replayed: false, record: { submittedBy: "user-editor-999" } },
    });
    // Same principal, same key, same evidence still replays...
    expect(await submit(provider, theirs)).toMatchObject({ ok: true, value: { replayed: true } });
    // ...and same principal, same key, different evidence still conflicts.
    expect(
      await submit(provider, {
        access: entitledAccess("user-editor-999"),
        metadata: metadata({ itemId: "web-editor-other-999" }),
      }),
    ).toMatchObject({ ok: false, reason: "CATALOG_SUBMISSION_RETRY_CONFLICT" });

    expect(catalogSubmissionScopeKey({ submittedBy: "a", key: "k" })).not.toBe(
      catalogSubmissionScopeKey({ submittedBy: "b", key: "k" }),
    );
  });

  it("refuses unusable or inconsistent principal evidence before any write", async () => {
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
    const base = entitledAccess();

    const mismatched: EditorSessionAccess = {
      ...base,
      access: { ...base.access, identity: entitledAccess("user-editor-other").access.identity },
    };
    expect(await submit(counting, { access: mismatched })).toMatchObject({
      ok: false,
      reason: "CATALOG_SUBMISSION_PRINCIPAL_INVALID",
    });

    expect(await submit(counting, { access: entitledAccess("   ") })).toMatchObject({
      ok: false,
      reason: "CATALOG_SUBMISSION_PRINCIPAL_INVALID",
    });

    const unavailableIdentity: EditorSessionAccess = {
      ...base,
      access: {
        ...base.access,
        identity: {
          ok: false,
          reason: "IDENTITY_PLANE_UNAVAILABLE",
          message: "the identity store is unreachable",
        },
      },
    };
    expect(await submit(counting, { access: unavailableIdentity })).toMatchObject({
      ok: false,
      reason: "IDENTITY_PLANE_UNAVAILABLE",
    });
    expect(writes).toBe(0);

    // The reference provider holds the same rule on its own, so a caller that reaches
    // it directly cannot store a record under another principal's scope.
    const submitted = await submit(backing);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(
      await backing.submit({
        idempotency: { submittedBy: "someone-else", key: "editor-submit-218" },
        record: submitted.value.record,
      }),
    ).toMatchObject({ ok: false, reason: "CATALOG_SUBMISSION_PRINCIPAL_INVALID" });
    expect(
      await backing.submit({
        idempotency: { submittedBy: submitted.value.record.submittedBy, key: "  " },
        record: submitted.value.record,
      }),
    ).toMatchObject({ ok: false, reason: "CATALOG_SUBMISSION_REQUEST_INVALID" });
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

  it("shows digests the demo computed from a real editor render, not constants", async () => {
    const state = readEditorState({});
    if (!state.ok) throw new Error(state.message);
    const rendered = renderEditorState(state.value);
    if (!rendered.ok) throw new Error(rendered.message);

    for (const surface of ["catalog-game", "catalog-web"] as const) {
      const demo = await catalogTestPipelineDemo(surface);
      expect(demo.ok).toBe(true);
      if (!demo.ok) return;
      const listing = demo.value.listed.listing;
      expect(listing).not.toBeNull();
      expect(listing?.documentDigest).toBe(rendered.value.documentDigest);
      expect(listing?.assetPackage.contentHash).toBe(rendered.value.artifactDigest);
      // A placeholder of one repeated character is exactly what this path may not print.
      expect(listing?.documentDigest).not.toMatch(/^sha256:(.)\1{63}$/);
      expect(listing?.assetPackage.contentHash).not.toMatch(/^sha256:(.)\1{63}$/);
    }
  });

  it("hands the storefront a refusal, not an exception, when the render cannot run", async () => {
    // The demo reaches the filesystem now, so the `/publish` proof must still be able to
    // render its refusal branch rather than failing the whole page.
    const previous = process.env["TMPDIR"];
    process.env["TMPDIR"] = join(previous ?? tmpdir(), "sceneaxi-absent-temporary-root");
    try {
      for (const surface of ["catalog-game", "catalog-web"] as const) {
        await expect(catalogTestPipelineDemo(surface)).resolves.toMatchObject({
          ok: false,
          reason: "EDITOR_WORKSPACE_UNAVAILABLE",
        });
      }
    } finally {
      if (previous === undefined) delete process.env["TMPDIR"];
      else process.env["TMPDIR"] = previous;
    }
  });
});

describe("the shipped umbrella editor route reaches catalog intake", () => {
  const PAGE = readFileSync(
    new URL("../../sites/umbrella/src/app/editor/page.tsx", import.meta.url),
    "utf8",
  );
  const ACTION = readFileSync(
    new URL("../../sites/umbrella/src/app/api/editor/catalog-intake/route.ts", import.meta.url),
    "utf8",
  );

  it("submits only from the explicit POST action, never from a page render", () => {
    // The page reads. It names neither writing function, so opening `/editor` — a
    // refresh, a prefetch, a crawler — cannot reach a provider's `submit`.
    expect(PAGE).toContain("readUmbrellaCatalogIntakePanel");
    expect(PAGE).not.toContain("buildUmbrellaCatalogIntakeView");
    expect(PAGE).not.toContain("submitUmbrellaEditorToCatalog");
    // The one control that writes posts to the action.
    expect(PAGE).toContain('method="post"');
    expect(PAGE).toContain("UMBRELLA_CATALOG_INTAKE_ACTION");

    // The action is POST-only and submits through the seam with the empty plug point.
    expect(ACTION).toContain("export async function POST");
    expect(ACTION).not.toContain("export async function GET");
    expect(ACTION).toContain("buildUmbrellaCatalogIntakeView");
    expect(ACTION).toContain("injection: umbrellaCatalogIntake()");

    // The deployment holds no store and no declaration form, so the plug point is empty.
    expect(umbrellaCatalogIntake()).toBeNull();
  });

  it("keeps every route notice in the one stacked rail above the shell", () => {
    // `.edshell` is fixed, opaque, and full-viewport, so a notice in normal flow is
    // unreachable; and two independently fixed notes landed on identical coordinates.
    expect(PAGE).toContain('className="ed-overlay-notes"');
    expect(PAGE.match(/ed-preview-note/g)).toHaveLength(1);
  });

  it("refuses by name on the default deployment without reaching a provider", async () => {
    // The page's own read: no store injected, so it answers from the injection alone.
    expect(await readUmbrellaCatalogIntakePanel({ injection: umbrellaCatalogIntake() })).toMatchObject(
      { kind: "unavailable", reason: "CATALOG_INTAKE_STORAGE_UNAVAILABLE" },
    );
    // The action refuses the same way rather than inventing a store.
    expect(
      await buildUmbrellaCatalogIntakeView({
        access: entitledAccess(),
        render: editorRender(),
        profile: "web",
        surface: "catalog-web",
        injection: umbrellaCatalogIntake(),
      }),
    ).toMatchObject({ ok: false, reason: "CATALOG_INTAKE_STORAGE_UNAVAILABLE" });
  });

  it("renders honest intake state when a TEST provider and declaration are injected", async () => {
    const provider = createInMemoryCatalogTestPipelineProvider();
    const injection = { provider, declaration: metadata() };
    const render = editorRender();
    const request = {
      access: entitledAccess(),
      render,
      profile: "web" as const,
      surface: "catalog-web",
      injection,
    };

    // Before the control is pressed the page offers the submission and records nothing.
    expect(await readUmbrellaCatalogIntakePanel({ injection })).toMatchObject({ kind: "offered" });
    expect(
      await readCatalogPipelineItem({ provider, itemId: "web-editor-submission-218" }),
    ).toMatchObject({ ok: false, reason: "CATALOG_ITEM_NOT_FOUND" });

    const first = await buildUmbrellaCatalogIntakeView(request);
    expect(first).toMatchObject({
      ok: true,
      value: {
        itemId: "web-editor-submission-218",
        pipelineState: "intake",
        recordedTransitions: 0,
        replayed: false,
        listing: null,
      },
    });
    if (!first.ok) return;
    expect(first.value.documentDigest).toBe(render.documentDigest);
    expect(first.value.artifactDigest).toBe(render.artifactDigest);

    // Returning to `/editor` after the action reads the stored record back — the same
    // digests, still `intake`, still unlisted — without submitting again.
    expect(await readUmbrellaCatalogIntakePanel({ injection })).toMatchObject({
      kind: "recorded",
      record: {
        itemId: "web-editor-submission-218",
        pipelineState: "intake",
        recordedTransitions: 0,
        documentDigest: render.documentDigest,
        artifactDigest: render.artifactDigest,
        listing: null,
      },
    });

    // Pressing the control again replays rather than conflicting, and still lists
    // nothing: the action records no transition and no curation verdict.
    expect(await buildUmbrellaCatalogIntakeView(request)).toMatchObject({
      ok: true,
      value: { replayed: true, pipelineState: "intake", recordedTransitions: 0, listing: null },
    });
  });

  it("carries the current editor URL state through the action's own form fields", () => {
    const params = { profile: "web", objects: "2", "tx-object-1": "1,0,0" };
    const fields = umbrellaEditorStateFields(params);
    expect(umbrellaEditorStateFromFields(fields)).toEqual(params);
    // Repeated parameters stay repeated, so a malformed link stays malformed for
    // `readEditorState()` in the action instead of quietly becoming a different request.
    expect(umbrellaEditorStateFromFields(umbrellaEditorStateFields({ sel: ["a", "b"] }))).toEqual({
      sel: ["a", "b"],
    });
  });

  it("reports a refused read as a refusal rather than as nothing submitted", async () => {
    const failing = {
      mode: "test",
      submit: async () => ({ ok: false, reason: "CATALOG_PIPELINE_PROVIDER_FAILED", message: "x" }),
      read: async () => ({ ok: false, reason: "CATALOG_PIPELINE_PROVIDER_FAILED", message: "x" }),
      commitTransition: async () => ({
        ok: false,
        reason: "CATALOG_PIPELINE_PROVIDER_FAILED",
        message: "x",
      }),
    } as unknown as CatalogTestPipelineProvider;

    expect(
      await readUmbrellaCatalogIntakePanel({
        injection: { provider: failing, declaration: metadata() },
      }),
    ).toMatchObject({ kind: "read-refused", reason: "CATALOG_PIPELINE_PROVIDER_FAILED" });
  });

  it("keeps Kids and unentitled requests off the route seam", async () => {
    const provider = createInMemoryCatalogTestPipelineProvider();
    const injection = { provider, declaration: metadata() };
    const render = editorRender();

    expect(
      await buildUmbrellaCatalogIntakeView({
        access: entitledAccess(),
        render,
        profile: "kids",
        surface: "catalog-web",
        injection,
      }),
    ).toMatchObject({ ok: false, reason: "KIDS_SURFACE_DENIED" });

    const anonymous = entitledAccess();
    expect(
      await buildUmbrellaCatalogIntakeView({
        access: {
          ...anonymous,
          access: { ...anonymous.access, principal: null },
          decision: {
            granted: false,
            reason: "EDITOR_ENTITLEMENT_ANONYMOUS",
            message: "anonymous",
          },
        },
        render,
        profile: "web",
        surface: "catalog-web",
        injection,
      }),
    ).toMatchObject({ ok: false, reason: "EDITOR_ENTITLEMENT_ANONYMOUS" });

    expect(
      await readCatalogPipelineItem({ provider, itemId: "web-editor-submission-218" }),
    ).toMatchObject({ ok: false, reason: "CATALOG_ITEM_NOT_FOUND" });
  });
});
