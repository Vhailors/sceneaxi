import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  composeScene,
  createDocument,
  createModelProviderPort,
  runAssistantSculptAction,
  writeDocumentFile,
  type AssistantSculptProgress,
  type AssistantSculptResult,
  type ModelDescriptor,
} from "@sceneaxi/authoring-core";
import {
  EDITOR_COMMAND_REFUSALS,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  createEditorCommandInvocation,
  type SceneCompositionIntake,
} from "@sceneaxi/schemas";
import { createSculptMountApi } from "../../packages/engine-presentation/src/index.ts";
import {
  DESKTOP_BRIDGE_REFUSALS,
  createDesktopAssistantViewportController,
  createDesktopBridge,
  desktopOpenScene,
  type DesktopAssistantJobSnapshot,
} from "../../desktop/linux/src/index.ts";
import { createDesktopPresentationBackend } from "../../desktop/linux/src/renderer/viewport.ts";

const FIXED_NOW_MS = 1_753_920_000_000;
const fixedNow = (): number => FIXED_NOW_MS;
const BYO_MODEL: ModelDescriptor = Object.freeze({
  model: "fixture/desktop-byo",
  provider: "operator-byo",
  quantization: "pinned",
  version: "1",
});

const BYO_INTAKE = JSON.stringify({
  schemaVersion: 1,
  kind: "sceneaxi.sculpt-intake",
  intakeId: "desktop-byo-crate",
  mode: "structured-spec",
  structuredSpec: {
    schemaVersion: 1,
    kind: "sceneaxi.object-sculpt-spec",
    id: "desktop-byo-crate-spec",
    rootNodeId: "crate-root",
    components: [
      {
        id: "crate-body",
        primitive: "box",
        dimensions: [2, 2, 2],
        materialId: "crate-shell",
      },
    ],
    materials: [
      {
        id: "crate-shell",
        baseColor: "#3366cc",
        metallic: 0.1,
        roughness: 0.7,
      },
    ],
    sockets: [],
    hierarchy: [
      {
        id: "crate-root",
        parentId: null,
        componentId: "crate-body",
        transform: {
          translation: [0, 0, 0],
          rotationEulerDegrees: [0, 0, 0],
          scale: [1, 1, 1],
        },
      },
    ],
  },
});

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

function activeDocumentData(sceneId = "desktop-linux-open-scene") {
  const starter = desktopOpenScene();
  if (!starter.ok) throw new Error(`desktop scene refused: ${starter.reason}`);
  const intake: SceneCompositionIntake = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId,
    rootInstanceId: starter.composed.scene.rootInstanceId,
    placements: starter.composed.scene.instances.map((instance) => ({
      instanceId: instance.instanceId,
      artifactId: instance.artifactId,
      parentInstanceId: instance.parentInstanceId,
      transform: instance.localTransform,
    })),
  };
  const artifacts = [
    ...new Map(
      starter.composed.scene.instances.map((instance) => [instance.artifactId, instance.artifact]),
    ).values(),
  ];
  const composed = composeScene(intake, artifacts);
  if (!composed.ok) throw new Error(`active document composition refused: ${composed.code}`);
  return composed.document.data;
}

function authoringDir(
  sceneId = "desktop-linux-open-scene",
  extraData: Readonly<Record<string, unknown>> = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-golden-"));
  tmpDirs.push(dir);
  const doc = createDocument({
    id: "scene",
    data: {
      ...activeDocumentData(sceneId),
      ...extraData,
      entities: [{ id: "hero", x: 1, y: 2, rz: 0 }],
      material: { roughness: 0.4 },
    },
  });
  const written = writeDocumentFile(join(dir, "scene.json"), doc, { cwd: dir });
  if (!written.ok) throw new Error("golden fixture document refused");
  return dir;
}

function bridgeAt(dir: string) {
  return createDesktopBridge({ cwd: dir, nowMs: fixedNow });
}

describe("desktop bridge assistant job golden", () => {
  it("mounts, transforms, and resets a replacement local assistant artifact", async () => {
    const bridge = bridgeAt(authoringDir());
    const readyResult = async (prompt: string) => {
      const started = bridge.handle({
        action: "assistant",
        payload: {
          op: "start",
          route: "local",
          profile: "@sceneaxi/profile-game",
          prompt,
        },
      });
      expect(started.ok).toBe(true);
      if (!started.ok) throw new Error(started.message);
      expect(started.data).toMatchObject({ status: "running", route: "local" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const status = bridge.handle({ action: "assistant", payload: { op: "status" } });
      expect(status.ok).toBe(true);
      if (!status.ok) throw new Error(status.message);
      const job = status.data as DesktopAssistantJobSnapshot | null;
      if (job?.status !== "ready" || job.result === undefined) {
        throw new Error("local assistant job did not produce a mountable result");
      }
      if (!("mountable" in job.result)) {
        throw new Error("local Build unexpectedly produced a rarity proposal");
      }
      return job.result;
    };

    const first = await readyResult("A tall blue service cylinder");
    expect(first.inspection).toMatchObject({
      physics: { supported: true },
      materials: { supported: true },
      settings: { supported: true },
    });

    const backend = createDesktopPresentationBackend();
    const mounts = createSculptMountApi(backend);
    const viewport = createDesktopAssistantViewportController(mounts);
    expect(first.mountable.instances).toHaveLength(1);
    viewport.replace(first.mountable);
    viewport.manipulate("move-x");
    const firstMovedAgain = viewport.manipulate("move-x");
    expect(firstMovedAgain?.transform).toMatchObject({
      translation: [0.5, 0, 0],
      rotationEulerDegrees: [0, 0, 0],
      scale: [1, 1, 1],
    });

    const second = await readyResult("A green sphere");
    expect(second.artifactDigest).not.toBe(first.artifactDigest);
    const replacement = viewport.replace(second.mountable);
    expect(replacement.transform).toMatchObject({
      translation: [0, 0, 0],
      rotationEulerDegrees: [0, 0, 0],
      scale: [1, 1, 1],
    });
    const replacementMoved = viewport.manipulate("move-x");
    expect(replacementMoved?.transform).toMatchObject({
      translation: [0.25, 0, 0],
      rotationEulerDegrees: [0, 0, 0],
      scale: [1, 1, 1],
    });
    expect(mounts.render()).toMatchObject({
      backend: "three",
      instanceIds: [second.mountable.instances[0]?.instanceId],
      surface: "headless",
      pixelsDrawn: false,
    });
    mounts.dispose();
  });

  it("refuses hosted desktop assistant work at the missing metering seam", () => {
    const bridge = bridgeAt(authoringDir());
    const hosted = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "hosted",
        profile: "@sceneaxi/profile-game",
        prompt: "Build a crate",
      },
    });
    expect(hosted.ok).toBe(false);
    if (!hosted.ok) {
      expect(hosted.reason).toBe("DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE");
    }
  });

  it("runs an injected BYOK Model Provider Port through the desktop job seam", async () => {
    const port = createModelProviderPort({
      adapter: {
        routeKind: "third-party",
        capabilities: {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operations: ["complete"],
        },
        async complete() {
          return {
            response: {
              schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
              operation: "complete" as const,
              text: BYO_INTAKE,
              finishReason: "stop" as const,
            },
            executedModel: BYO_MODEL,
          };
        },
      },
      profilePolicies: {
        "@sceneaxi/profile-game": () => ({ ok: true }),
      },
    });
    const bridge = createDesktopBridge({
      cwd: authoringDir(),
      nowMs: fixedNow,
      runByoAssistant: (request) =>
        runAssistantSculptAction({
          route: "byo",
          operation: "complete",
          model: BYO_MODEL,
          port,
          ...request,
        }),
    });

    const started = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-game",
        prompt: "Build a blue crate",
      },
    });
    expect(started.ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const status = bridge.handle({ action: "assistant", payload: { op: "status" } });
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.data).toMatchObject({
      route: "byo",
      status: "ready",
      result: {
        route: "byo",
        mountable: {
          artifacts: {
            "desktop-byo-crate-artifact": { kind: "sceneaxi.sculpt-artifact" },
          },
          instances: [{ artifactId: "desktop-byo-crate-artifact" }],
        },
        providerEvidence: { operation: "complete" },
      },
    });
  });

  it("redacts provider detail from a BYOK failure the runner returns, not only one it throws", async () => {
    // `runAssistantSculptAction` returns rather than throws on PROVIDER_FAILED,
    // PROVIDER_REFUSED, and OUTPUT_INVALID, each carrying provider-authored detail
    // that may echo request headers or credential material. The bridge owns that
    // policy for every injected runner, so the returned path must redact too.
    const bridge = createDesktopBridge({
      cwd: authoringDir(),
      nowMs: fixedNow,
      runByoAssistant: async () =>
        Object.freeze({
          ok: false as const,
          reason: "ASSISTANT_SCULPT_PROVIDER_REFUSED" as const,
          message: "The BYOK Model Provider Port refused the assistant action.",
          recoverable: true,
          detail: "upstream said: authorization Bearer leaked-provider-text",
        }),
    });
    expect(
      bridge.handle({
        action: "assistant",
        payload: {
          op: "start",
          route: "byo",
          profile: "@sceneaxi/profile-game",
          prompt: "Provider returns a refusal carrying detail",
        },
      }).ok,
    ).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const status = bridge.handle({ action: "assistant", payload: { op: "status" } });
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.data).toMatchObject({
      route: "byo",
      status: "refused",
      refusal: {
        reason: "ASSISTANT_SCULPT_PROVIDER_REFUSED",
        message: "The BYOK Model Provider Port refused the assistant action.",
        recoverable: true,
      },
    });
    const job = status.data as DesktopAssistantJobSnapshot | null;
    expect(job?.refusal).not.toHaveProperty("detail");
    expect(JSON.stringify(status)).not.toContain("leaked-provider-text");
  });

  it("settles a synchronous BYOK runner throw so Retry can start fresh work", async () => {
    const bridge = createDesktopBridge({
      cwd: authoringDir(),
      nowMs: fixedNow,
      runByoAssistant: () => {
        throw new Error("synchronous provider failure");
      },
    });
    const failed = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-game",
        prompt: "Provider throws before returning a promise",
      },
    });
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    expect(failed.data).toMatchObject({
      route: "byo",
      status: "refused",
      refusal: {
        reason: DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
        message: "The configured assistant runner failed.",
        recoverable: true,
      },
    });
    expect(JSON.stringify(failed)).not.toContain("synchronous provider failure");

    const retried = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "local",
        profile: "@sceneaxi/profile-game",
        prompt: "A green sphere",
      },
    });
    expect(retried.ok).toBe(true);
    if (retried.ok) expect(retried.data).toMatchObject({ status: "running" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const status = bridge.handle({ action: "assistant", payload: { op: "status" } });
    expect(status.ok).toBe(true);
    if (status.ok) expect(status.data).toMatchObject({ status: "ready" });
  });

  it("abandons a hung BYOK job so Retry can start fresh work", async () => {
    let rejectHung: ((reason: Error) => void) | undefined;
    let reportProgress: ((snapshot: AssistantSculptProgress) => void) | undefined;
    const bridge = createDesktopBridge({
      cwd: authoringDir(),
      nowMs: fixedNow,
      runByoAssistant: (request) =>
        new Promise<AssistantSculptResult>((_resolve, reject) => {
          rejectHung = reject;
          reportProgress = request.onProgress;
        }),
    });
    const started = bridge.handle({
      action: "command",
      payload: createEditorCommandInvocation(
        "assistant-byo-build",
        "desktop-control",
        { profile: "@sceneaxi/profile-game", prompt: "Never finishes" },
      ),
    });
    expect(started.ok).toBe(true);
    if (!started.ok || started.data === null) return;
    const jobId = (started.data as DesktopAssistantJobSnapshot).jobId;
    reportProgress?.({ phase: "waiting-provider", percent: 20, message: "Waiting" });
    expect(
      bridge.handle({
        action: "command",
        payload: {
          schemaVersion: 1,
          commandId: "assistant-cancel",
          client: "desktop-control",
          permission: "assistant:run",
          input: {},
        },
      }),
    ).toMatchObject({
      ok: false,
      reason: EDITOR_COMMAND_REFUSALS.inputInvalid,
    });
    expect(
      bridge.handle({ action: "assistant", payload: { op: "status" } }),
    ).toMatchObject({ ok: true, data: { jobId, status: "running" } });
    expect(bridge.handle({
      action: "command",
      payload: createEditorCommandInvocation(
        "assistant-cancel",
        "desktop-control",
        { jobId: "desktop-assistant-wrong" },
      ),
    })).toMatchObject({
      ok: false,
      reason: EDITOR_COMMAND_REFUSALS.activeJobMismatch,
    });
    const abandoned = bridge.handle({
      action: "command",
      payload: createEditorCommandInvocation(
        "assistant-cancel",
        "desktop-control",
        { jobId },
      ),
    });
    expect(abandoned.ok).toBe(true);
    if (abandoned.ok) {
      expect(abandoned.data).toMatchObject({
        status: "refused",
        refusal: { reason: DESKTOP_BRIDGE_REFUSALS.assistantAbandoned },
        terminal: {
          jobId,
          status: "cancelled",
          progress: { percent: 100, terminal: true },
        },
      });
    }
    reportProgress?.({
      phase: "streaming-provider",
      percent: 45,
      message: "Late chunk",
      delta: "ignored",
    });
    const abandonedStatus = bridge.handle({
      action: "assistant",
      payload: { op: "status" },
    });
    expect(abandonedStatus.ok).toBe(true);
    if (abandonedStatus.ok) {
      expect(abandonedStatus.data).toMatchObject({
        progressCount: 1,
        latestProgress: { message: "Waiting" },
      });
    }

    const retried = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "local",
        profile: "@sceneaxi/profile-game",
        prompt: "A green sphere",
      },
    });
    expect(retried.ok).toBe(true);
    rejectHung?.(new Error("late provider failure"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const status = bridge.handle({ action: "assistant", payload: { op: "status" } });
    expect(status.ok).toBe(true);
    if (status.ok) expect(status.data).toMatchObject({ status: "ready" });
  });

  it("denies Kids before an injected BYOK runner can be reached", () => {
    let dispatches = 0;
    const bridge = createDesktopBridge({
      cwd: authoringDir(),
      nowMs: fixedNow,
      runByoAssistant: async () => {
        dispatches += 1;
        throw new Error("Kids reached the provider runner");
      },
    });
    const denied = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-kids",
        prompt: "Build a toy",
      },
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe("ASSISTANT_SCULPT_KIDS_DENIED");
    expect(dispatches).toBe(0);
  });

  it("bounds a status poll to the newest progress entry, never the accumulated log", async () => {
    const bridge = createDesktopBridge({
      cwd: authoringDir(),
      nowMs: fixedNow,
      runByoAssistant: async (request) => {
        for (let chunk = 1; chunk <= 40; chunk += 1) {
          request.onProgress({
            phase: "streaming-provider",
            percent: chunk,
            message: `chunk ${String(chunk)}`,
            delta: "x".repeat(512),
          });
        }
        throw new Error("progress only");
      },
    });
    expect(
      bridge.handle({
        action: "assistant",
        payload: {
          op: "start",
          route: "byo",
          profile: "@sceneaxi/profile-game",
          prompt: "Stream a lot",
        },
      }).ok,
    ).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const status = bridge.handle({ action: "assistant", payload: { op: "status" } });
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    const job = status.data as {
      latestProgress: { percent: number; message: string } | null;
      progressCount: number;
    };
    expect(job.progressCount).toBe(40);
    expect(job.latestProgress).toMatchObject({ percent: 40, message: "chunk 40" });
    // The whole log never crosses the seam, so a poll cannot clone the stream so far.
    expect(Object.keys(job)).not.toContain("progress");
  });

  it("does not strand the seam when an injected runner dispatches nothing", () => {
    const bridge = createDesktopBridge({
      cwd: authoringDir(),
      nowMs: fixedNow,
      // A runner that answers with nothing rather than a job: the bridge claimed
      // "running" one call before dispatch was known, and must take it back.
      runByoAssistant: (() => undefined) as unknown as NonNullable<
        Parameters<typeof createDesktopBridge>[0]["runByoAssistant"]
      >,
    });
    const started = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-game",
        prompt: "Never dispatched",
      },
    });
    expect(started.ok).toBe(false);
    if (!started.ok) expect(started.reason).toBe(DESKTOP_BRIDGE_REFUSALS.assistantByoUnavailable);
    // No phantom job is left behind, so the next start is not refused BUSY.
    const idle = bridge.handle({ action: "assistant", payload: { op: "status" } });
    expect(idle.ok).toBe(true);
    if (idle.ok) expect(idle.data).toBeNull();

    const retried = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "local",
        profile: "@sceneaxi/profile-game",
        prompt: "A green sphere",
      },
    });
    expect(retried.ok).toBe(true);
    if (retried.ok) expect(retried.data).toMatchObject({ status: "running", route: "local" });
  });
});
