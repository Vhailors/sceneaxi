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
import type { RarityProviderContributionResult } from "@sceneaxi/authoring-core";

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
    expect(job.result.authoring.renderedDiff).toContain('"rarity"');
    expect(job.result.authoring.renderedDiff).toContain(job.result.evidence.outcomeDigest);
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
    const exercise = played.data as { replayDigest: string; tickDigests: readonly string[] };
    expect(exercise.replayDigest).toBe(exercise.tickDigests.at(-1));
    expect(JSON.stringify({ job, played })).not.toContain("credential-sentinel-never-persisted");
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
    const contribution = await fixture({ profile: "@sceneaxi/profile-game" });
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
    expect(replay).toMatchObject({ status: "ready", result: { kind: "rarity-proposal" } });
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
