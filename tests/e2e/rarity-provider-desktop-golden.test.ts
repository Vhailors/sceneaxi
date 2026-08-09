import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_RARITY_EVENT_ID,
  createDesktopBridge,
  seedDesktopProject,
  type DesktopAssistantJobSnapshot,
  type DesktopBridge,
} from "../../desktop/linux/src/index.ts";
import {
  DESKTOP_RARITY_FIXTURE_INPUT,
  DESKTOP_RARITY_FIXTURE_MODEL,
  createDesktopRarityFixtureProvider,
} from "../../desktop/linux/src/electron/provider-runtime.ts";
import { RARITY_REFUSE_CODES } from "@sceneaxi/schemas";
import {
  RARITY_AUTHORING_REFUSALS,
  type RarityProviderContributionResult,
} from "@sceneaxi/authoring-core";

const acceptanceVector = JSON.parse(
  readFileSync(
    new URL("./fixtures/rarity-provider/wayfinder-desktop.json", import.meta.url),
    "utf8",
  ),
) as {
  readonly projectSeed: number;
  readonly scope: string;
  readonly eventId: string;
  readonly model: typeof DESKTOP_RARITY_FIXTURE_MODEL;
  readonly policy: typeof DESKTOP_RARITY_FIXTURE_INPUT.policy;
  readonly request: typeof DESKTOP_RARITY_FIXTURE_INPUT.request;
  readonly expected: Readonly<{
    tier: string;
    candidateId: string;
    policyDigest: string;
    requestDigest: string;
    outcomeDigest: string;
    provenanceDigest: string;
    namespaceDigest: string;
    tierRollDigest: string;
    candidateRollDigest: string;
    tierDraw: number;
    tierTotalWeight: number;
    candidateDraw: number;
    candidateTotalWeight: number;
  }>;
};

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function projectRoot() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-rarity-desktop-"));
  roots.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

function documentBytes(root: string) {
  return readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
}

function startRarity(bridge: DesktopBridge, profile = "@sceneaxi/profile-game", route = "local") {
  return bridge.handle({
    action: "assistant",
    payload: {
      op: "start",
      mode: "agent",
      route,
      profile,
      prompt: "credential-sentinel-never-persisted",
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    },
  });
}

async function settledJob(bridge: DesktopBridge) {
  await vi.waitFor(() => {
    const response = bridge.handle({ action: "assistant", payload: { op: "status" } });
    expect(response.ok).toBe(true);
    const job = response.ok ? response.data as DesktopAssistantJobSnapshot | null : null;
    expect(job?.status).not.toBe("running");
  });
  const response = bridge.handle({ action: "assistant", payload: { op: "status" } });
  if (!response.ok) throw new Error(response.reason);
  const job = response.data as DesktopAssistantJobSnapshot | null;
  if (job === null || job.status === "running") {
    throw new Error("assistant job did not settle");
  }
  return job;
}

describe("fixture provider → authoring → kernel → desktop rarity acceptance", () => {
  it("stages a real diff, accepts atomically, reopens, and presents the replayed kernel evidence", async () => {
    const root = projectRoot();
    const before = documentBytes(root);
    const bridge = createDesktopBridge({
      cwd: root,
      nowMs: () => 1_726_000_000_000,
      runRarityProvider: createDesktopRarityFixtureProvider(),
    });

    expect(startRarity(bridge)).toMatchObject({ ok: true, action: "assistant" });
    const job = await settledJob(bridge);
    expect(job.refusal).toBeUndefined();
    expect(job).toMatchObject({ status: "ready" });
    expect(job.result).toMatchObject({
      kind: "rarity-proposal",
      evidence: {
        eventId: DESKTOP_RARITY_EVENT_ID,
        providerEvidence: {
          operation: "tool-call",
          model: DESKTOP_RARITY_FIXTURE_MODEL,
        },
      },
      authoring: { phase: "reviewing" },
    });
    if (job.result === undefined || !("kind" in job.result)) throw new Error("missing rarity result");
    expect(DESKTOP_RARITY_FIXTURE_INPUT).toEqual({
      policy: acceptanceVector.policy,
      request: acceptanceVector.request,
    });
    expect(DESKTOP_RARITY_FIXTURE_MODEL).toEqual(acceptanceVector.model);
    expect(job.result.evidence).toMatchObject({
      eventId: acceptanceVector.eventId,
      scope: acceptanceVector.scope,
      projectSeed: acceptanceVector.projectSeed,
      ...acceptanceVector.expected,
    });
    expect(job.result.replayed).toBe(false);
    expect(job.result.authoring?.renderedDiff).toContain('"rarity"');
    expect(job.result.authoring?.renderedDiff).toContain(job.result.evidence.outcomeDigest);
    expect(documentBytes(root)).toBe(before);

    const accepted = bridge.handle({ action: "authoring", payload: { op: "accept" } });
    expect(accepted).toMatchObject({ ok: true, data: { phase: "applied" } });
    const acceptedBytes = documentBytes(root);
    expect(acceptedBytes).not.toBe(before);
    expect(acceptedBytes).not.toContain("credential-sentinel-never-persisted");
    expect(acceptedBytes).not.toContain("providerResponse");

    const reopened = createDesktopBridge({ cwd: root, nowMs: () => 1_726_000_000_000 });
    const played = reopened.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(played.ok).toBe(true);
    if (!played.ok) throw new Error(played.reason);
    expect(played.data).toMatchObject({
      closed: true,
      rarity: {
        eventId: DESKTOP_RARITY_EVENT_ID,
        tier: job.result.evidence.tier,
        candidateId: job.result.evidence.candidateId,
        outcomeDigest: job.result.evidence.outcomeDigest,
        provenanceDigest: job.result.evidence.provenanceDigest,
        namespaceDigest: job.result.evidence.namespaceDigest,
        providerEvidence: { model: DESKTOP_RARITY_FIXTURE_MODEL },
      },
    });
    const exercise = played.data as {
      instanceCount: number;
      initialDigest: string;
      tickDigests: readonly string[];
      raritySession: { replayDigest: string; initialDigest: string; tickDigests: readonly string[] };
    };
    // The rarity product session is reported beside the composed scene session,
    // not in place of it: the scene the viewport draws still has its instances and
    // its own advance, and the rarity replay digest belongs to the other session.
    expect(exercise.instanceCount).toBeGreaterThan(0);
    expect(exercise.raritySession.replayDigest).toBe(exercise.raritySession.tickDigests.at(-1));
    expect(exercise.raritySession.initialDigest).not.toBe(exercise.initialDigest);
    expect(exercise.tickDigests).not.toContain(exercise.raritySession.replayDigest);
    expect(JSON.stringify({ job, played })).not.toContain("credential-sentinel-never-persisted");
  });

  it("keeps the composed scene open path identical whether or not rarity is accepted", async () => {
    const root = projectRoot();
    const before = createDesktopBridge({ cwd: root, nowMs: () => 1_726_000_000_000 });
    const beforeAccept = before.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (!beforeAccept.ok) throw new Error(beforeAccept.reason);
    const plain = beforeAccept.data as {
      instanceCount: number;
      initialDigest: string;
      tickDigests: readonly string[];
      rarity?: unknown;
      raritySession?: unknown;
    };
    expect(plain.rarity).toBeUndefined();
    expect(plain.raritySession).toBeUndefined();

    const bridge = createDesktopBridge({
      cwd: root,
      nowMs: () => 1_726_000_000_000,
      runRarityProvider: createDesktopRarityFixtureProvider(),
    });
    startRarity(bridge);
    expect((await settledJob(bridge)).status).toBe("ready");
    bridge.handle({ action: "authoring", payload: { op: "accept" } });

    const after = createDesktopBridge({ cwd: root, nowMs: () => 1_726_000_000_000 });
    const played = after.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (!played.ok) throw new Error(played.reason);
    const withRarity = played.data as {
      instanceCount: number;
      initialDigest: string;
      tickDigests: readonly string[];
    };
    expect(withRarity.instanceCount).toBe(plain.instanceCount);
    expect(withRarity.initialDigest).toBe(plain.initialDigest);
    expect(withRarity.tickDigests).toEqual(plain.tickDigests);
  });

  it("rejects the staged proposal without changing project bytes or creating a roll", async () => {
    const root = projectRoot();
    const before = documentBytes(root);
    const bridge = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider(),
    });
    startRarity(bridge);
    expect((await settledJob(bridge)).status).toBe("ready");
    expect(bridge.handle({ action: "authoring", payload: { op: "reject" } })).toMatchObject({
      ok: true,
      data: { phase: "rejected" },
    });
    expect(documentBytes(root)).toBe(before);
    const played = bridge.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(played.ok).toBe(true);
    if (played.ok) expect((played.data as { rarity?: unknown }).rarity).toBeUndefined();
  });

  it("refuses provider entropy and malformed input without staging or persisting it", async () => {
    const root = projectRoot();
    const before = documentBytes(root);
    const bridge = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider({
        arguments: {
          ...DESKTOP_RARITY_FIXTURE_INPUT,
          projectSeed: 7,
        } as unknown as import("@sceneaxi/schemas").JsonObject,
      }),
    });
    startRarity(bridge);
    const job = await settledJob(bridge);
    expect(job).toMatchObject({
      status: "refused",
      refusal: { reason: RARITY_REFUSE_CODES.providerEntropyForbidden },
    });
    expect(JSON.stringify(job)).not.toContain("projectSeed\":7");
    expect(documentBytes(root)).toBe(before);
  });

  it("classifies a raw provider response key as forbidden entropy", async () => {
    const root = projectRoot();
    const before = documentBytes(root);
    const bridge = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider({
        arguments: {
          ...DESKTOP_RARITY_FIXTURE_INPUT,
          providerResponse: "raw-transcript-never-accepted",
        } as unknown as import("@sceneaxi/schemas").JsonObject,
      }),
    });
    startRarity(bridge);
    const job = await settledJob(bridge);
    expect(job).toMatchObject({
      status: "refused",
      refusal: { reason: RARITY_REFUSE_CODES.providerEntropyForbidden },
    });
    expect(JSON.stringify(job)).not.toContain("raw-transcript-never-accepted");
    expect(documentBytes(root)).toBe(before);
  });

  it("refuses a replayed event whose accepted provider evidence was stripped, and stays available", async () => {
    const root = projectRoot();
    const first = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider(),
    });
    startRarity(first);
    expect((await settledJob(first)).status).toBe("ready");
    first.handle({ action: "authoring", payload: { op: "accept" } });

    const path = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const document = JSON.parse(readFileSync(path, "utf8")) as {
      data: { rarity: { providerEvidence?: unknown } };
    };
    expect(document.data.rarity.providerEvidence).toBeDefined();
    delete document.data.rarity.providerEvidence;
    writeFileSync(path, `${JSON.stringify(document)}\n`);
    const tampered = documentBytes(root);

    const replayed = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider(),
    });
    startRarity(replayed);
    expect(await settledJob(replayed)).toMatchObject({
      status: "refused",
      refusal: {
        reason: RARITY_AUTHORING_REFUSALS.providerEvidenceAbsent,
        recoverable: true,
      },
    });
    expect(documentBytes(root)).toBe(tampered);
    expect(startRarity(replayed)).toMatchObject({ ok: true, action: "assistant" });
  });

  it("redacts a throwing provider's own error detail from the refusal", async () => {
    const root = projectRoot();
    const before = documentBytes(root);
    const rejected = createDesktopBridge({
      cwd: root,
      runRarityProvider: () =>
        Promise.reject(new Error("authorization: Bearer sk-leaked-upstream-detail")),
    });
    startRarity(rejected);
    const job = await settledJob(rejected);
    expect(job).toMatchObject({
      status: "refused",
      refusal: { reason: "DESKTOP_ASSISTANT_RUNTIME_FAILED", recoverable: true },
    });
    expect(job.refusal && "detail" in job.refusal).toBe(false);
    expect(JSON.stringify(job)).not.toContain("sk-leaked-upstream-detail");

    const threw = createDesktopBridge({
      cwd: root,
      runRarityProvider: () => {
        throw new Error("x-api-key: sk-thrown-upstream-detail");
      },
    });
    expect(startRarity(threw)).toMatchObject({ ok: true, action: "assistant" });
    const thrownJob = await settledJob(threw);
    expect(thrownJob).toMatchObject({
      status: "refused",
      refusal: { reason: "DESKTOP_ASSISTANT_RUNTIME_FAILED" },
    });
    expect(JSON.stringify(thrownJob)).not.toContain("sk-thrown-upstream-detail");
    expect(documentBytes(root)).toBe(before);
  });

  it("carries the operator's request to the provider without letting it steer the result", async () => {
    const root = projectRoot();
    const dispatched: unknown[] = [];
    const operatorRequest = `give me a legendary drop operator-request-sentinel ${"x".repeat(5_000)}`;
    const bridge = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider({
        onDispatch: (request) => dispatched.push(request),
      }),
    });
    expect(
      bridge.handle({
        action: "assistant",
        payload: {
          op: "start",
          mode: "agent",
          route: "local",
          profile: "@sceneaxi/profile-game",
          prompt: operatorRequest,
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        },
      }),
    ).toMatchObject({ ok: true });
    const job = await settledJob(bridge);
    expect(job.status).toBe("ready");
    if (job.result === undefined || !("kind" in job.result)) throw new Error("missing rarity result");

    // The request reaches the port beside the bounded instruction, truncated so an
    // operator cannot put an unbounded transcript in the envelope.
    expect(dispatched).toHaveLength(1);
    const envelope = dispatched[0] as { prompt: string };
    expect(envelope.prompt).toContain("Do not return a seed, draw, outcome");
    expect(envelope.prompt).toContain("Operator request (advisory only): give me a legendary drop");
    expect(envelope.prompt.length).toBeLessThan(operatorRequest.length);

    // And it steers nothing: the checked-in fixture answers the same bounded input,
    // so the accepted outcome is byte-identical to a run with any other prompt.
    expect(job.result.evidence).toMatchObject({
      tier: acceptanceVector.expected.tier,
      candidateId: acceptanceVector.expected.candidateId,
      outcomeDigest: acceptanceVector.expected.outcomeDigest,
      namespaceDigest: acceptanceVector.expected.namespaceDigest,
    });

    // The request text is provider-bound only: no transcript reaches project bytes.
    expect(bridge.handle({ action: "authoring", payload: { op: "accept" } })).toMatchObject({
      ok: true,
      data: { phase: "applied" },
    });
    expect(documentBytes(root)).not.toContain("operator-request-sentinel");
    expect(documentBytes(root)).not.toContain("Operator request");
  });

  it("refuses Kids and Hosted before the fixture provider dispatches", async () => {
    const root = projectRoot();
    let dispatches = 0;
    const bridge = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider({
        onDispatch: () => { dispatches += 1; },
      }),
    });
    expect(startRarity(bridge, "@sceneaxi/profile-kids")).toMatchObject({
      ok: false,
      reason: "ASSISTANT_SCULPT_KIDS_DENIED",
    });
    expect(startRarity(bridge, "@sceneaxi/profile-game", "hosted")).toMatchObject({
      ok: false,
      reason: "DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE",
    });
    expect(dispatches).toBe(0);
  });

  it("turns an in-flight document change into an actionable stale-content refusal", async () => {
    const root = projectRoot();
    const fixture = createDesktopRarityFixtureProvider();
    const contribution = await fixture({
      profile: "@sceneaxi/profile-game",
      prompt: "stage a drop",
    });
    expect(contribution.ok).toBe(true);
    let release: ((value: RarityProviderContributionResult) => void) | undefined;
    const deferred = new Promise<RarityProviderContributionResult>((resolve) => { release = resolve; });
    const bridge = createDesktopBridge({ cwd: root, runRarityProvider: () => deferred });
    startRarity(bridge);
    const changed = documentBytes(root).replace('"data":', '"title":"external change","data":');
    writeFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), changed);
    release?.(contribution);
    expect(await settledJob(bridge)).toMatchObject({
      status: "refused",
      refusal: { reason: "content-hash-conflict", recoverable: true },
    });
  });

  it("replays an identical event and refuses changed request bytes under that event id", async () => {
    const root = projectRoot();
    const first = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider(),
    });
    startRarity(first);
    const initial = await settledJob(first);
    expect(initial.status).toBe("ready");
    first.handle({ action: "authoring", payload: { op: "accept" } });
    const acceptedBytes = documentBytes(root);

    const identical = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider(),
    });
    startRarity(identical);
    const replay = await settledJob(identical);
    expect(replay).toMatchObject({
      status: "ready",
      result: { kind: "rarity-proposal", replayed: true },
    });
    // A replay staged nothing, so it hands back no authoring snapshot at all —
    // there is no proposal of its own to attach, and stamping this evidence onto
    // whatever review happened to be open would describe an unrelated diff.
    if (replay.result === undefined || !("kind" in replay.result)) {
      throw new Error("missing rarity result");
    }
    expect(replay.result.authoring).toBeUndefined();
    expect(documentBytes(root)).toBe(acceptedBytes);

    // The same holds when an unrelated proposal is mid-review: the replay must not
    // borrow it. Project bytes are unchanged by staging, so the content-hash guard
    // does not catch this case.
    const withOpenReview = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider(),
    });
    const current = withOpenReview.handle({
      action: "authoring",
      payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (!current.ok) throw new Error(current.reason);
    const inspected = current.data as { contentHash: string };
    const staged = withOpenReview.handle({
      action: "authoring",
      payload: {
        op: "edit-property",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: inspected.contentHash,
        entityId: "desktop-crate-beside",
        propertyId: "translation-x",
        newValue: 3,
      },
    });
    expect(staged).toMatchObject({ ok: true, data: { phase: "reviewing" } });
    startRarity(withOpenReview);
    const borrowed = await settledJob(withOpenReview);
    expect(borrowed).toMatchObject({
      status: "ready",
      result: { kind: "rarity-proposal", replayed: true },
    });
    if (borrowed.result === undefined || !("kind" in borrowed.result)) {
      throw new Error("missing rarity result");
    }
    expect(borrowed.result.authoring).toBeUndefined();
    expect(documentBytes(root)).toBe(acceptedBytes);

    const changedRequest = {
      ...DESKTOP_RARITY_FIXTURE_INPUT,
      request: {
        ...DESKTOP_RARITY_FIXTURE_INPUT.request,
        candidates: DESKTOP_RARITY_FIXTURE_INPUT.request.candidates.map((candidate, index) =>
          index === 0 ? { ...candidate, weight: candidate.weight + 1 } : candidate,
        ),
      },
    } as unknown as import("@sceneaxi/schemas").JsonObject;
    const changed = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider({ arguments: changedRequest }),
    });
    startRarity(changed);
    expect(await settledJob(changed)).toMatchObject({
      status: "refused",
      refusal: { reason: RARITY_REFUSE_CODES.eventInputConflict },
    });
    expect(documentBytes(root)).toBe(acceptedBytes);
  });

  it("refuses to extend an accepted namespace from a call with different model evidence", async () => {
    const root = projectRoot();
    const first = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider(),
    });
    startRarity(first);
    expect((await settledJob(first)).status).toBe("ready");
    first.handle({ action: "authoring", payload: { op: "accept" } });
    const acceptedBytes = documentBytes(root);
    expect(acceptedBytes).toContain(DESKTOP_RARITY_FIXTURE_MODEL.version);

    // `providerEvidence` is a namespace property, so every roll it holds is
    // described by one descriptor. A second call from a different model may not
    // extend it, because the rolls already stored would then report a descriptor
    // that is not theirs.
    const requoted = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider({
        executedModel: { ...DESKTOP_RARITY_FIXTURE_MODEL, version: "2026-09-01" },
      }),
    });
    startRarity(requoted);
    expect(await settledJob(requoted)).toMatchObject({
      status: "refused",
      refusal: {
        reason: RARITY_AUTHORING_REFUSALS.providerEvidenceConflict,
        recoverable: true,
      },
    });
    expect(documentBytes(root)).toBe(acceptedBytes);
    expect(documentBytes(root)).not.toContain("2026-09-01");
  });

  it("refuses a tampered accepted provenance before Run can claim a result", async () => {
    const root = projectRoot();
    const bridge = createDesktopBridge({
      cwd: root,
      runRarityProvider: createDesktopRarityFixtureProvider(),
    });
    startRarity(bridge);
    expect((await settledJob(bridge)).status).toBe("ready");
    bridge.handle({ action: "authoring", payload: { op: "accept" } });
    const path = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const document = JSON.parse(readFileSync(path, "utf8")) as {
      data: { rarity: { rolls: Array<{ provenance: { outcomeDigest: string } }> } };
    };
    const roll = document.data.rarity.rolls[0];
    if (roll === undefined) throw new Error("accepted rarity roll missing");
    roll.provenance.outcomeDigest = `sha256:${"0".repeat(64)}`;
    writeFileSync(path, `${JSON.stringify(document)}\n`);

    const reopened = createDesktopBridge({ cwd: root });
    const played = reopened.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(played).toMatchObject({
      ok: false,
      reason: "OPEN_PATH_KERNEL_REFUSED",
    });
    if (played.ok) throw new Error("tampered rarity unexpectedly opened");
    expect(played.detail).toContain(RARITY_REFUSE_CODES.provenanceMismatch);
  });
});
