/**
 * Golden path for the packaged Linux desktop application (ADR 0024, sceneaxi#183).
 *
 * The Electron layer adds a window, IPC, and `requestAnimationFrame` and nothing
 * else, so everything between the packaged binary and the engine is provable here:
 * the bridge's synchronous `handle()` is the exact object `ipcMain.handle` serves,
 * the scene payload is the exact `MountableScene` the renderer mounts, and the
 * kernel open path runs through `@sceneaxi/engine-orchestrator` unchanged.
 *
 * WebGL cannot run in node, so the mount is proven on the **headless** surface of
 * the same Three core and asserted to never claim pixels; that the canvas path
 * builds a real `WebGLRenderer` is proven by it failing in node. The pixel claim
 * for the packaged app is the recorded smoke/browser observation in
 * `docs/desktop-linux.md`, never a gate inference — the same split the umbrella
 * live open path uses.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { afterAll, describe, expect, it, vi } from "vitest";
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
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  type SceneCompositionIntake,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ASSISTANT_RUNTIME_EVENT,
  DESKTOP_RARITY_PROPOSAL_EVENT as SHELL_RARITY_PROPOSAL_EVENT,
  DESKTOP_VIEWPORT_PLAY_EVENT as SHELL_VIEWPORT_PLAY_EVENT,
  DESKTOP_VISUAL_REFUSALS,
} from "@sceneaxi/desktop-shell";
import {
  THREE_HEADLESS_SURFACE_LABEL,
  createSculptMountApi,
  createThreeSculptPresentationBackend,
} from "../../packages/engine-presentation/src/index.ts";
import {
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_REFUSALS,
  DESKTOP_RARITY_PROPOSAL_EVENT,
  DESKTOP_VIEWPORT_PLAY_EVENT,
  createDesktopAssistantViewportController,
  createDesktopBridge,
  desktopOpenScene,
  desktopSceneFromDocumentData,
  seedDesktopProject,
  type DesktopAssistantJobSnapshot,
  type DesktopFrameReport,
} from "../../desktop/linux/src/index.ts";
import {
  DESKTOP_RUNTIME_META,
  RENDERER_SCRIPT_TAG,
  desktopLinuxIndexHtml,
} from "../../desktop/linux/src/lib/chrome-document.ts";
import {
  mountDesktopScene,
  synchronizeViewportScene,
} from "../../desktop/linux/src/renderer/viewport-playback.ts";
import { decideAssistantStart } from "../../desktop/linux/src/renderer/assistant-start.ts";
import { assistantInspectionText } from "../../desktop/linux/src/renderer/assistant-inspection.ts";
import { formatSafeRarityEvidence } from "@sceneaxi/authoring-core/rarity-evidence";
import { pollAssistantJob } from "../../desktop/linux/src/renderer/assistant-poll.ts";
import { createDesktopRarityFixtureProvider } from "../../desktop/linux/src/electron/provider-runtime.ts";

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

class FakeClassList {
  readonly values = new Set<string>();

  add(value: string): void {
    this.values.add(value);
  }

  remove(value: string): void {
    this.values.delete(value);
  }

  contains(value: string): boolean {
    return this.values.has(value);
  }
}

class FakeElement {
  readonly classList = new FakeClassList();
  readonly dataset: Record<string, string>;
  readonly attributes = new Map<string, string>();
  hidden = false;
  tabIndex = 0;
  textContent: string | null = "";

  constructor(
    readonly id = "",
    dataset: Record<string, string> = {},
    private readonly selectorMatches: ReadonlyMap<string, readonly FakeElement[]> = new Map(),
  ) {
    this.dataset = { ...dataset };
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  closest(selector: string): FakeElement | null {
    if (selector === "[data-command]") {
      return this.dataset.command === undefined ? null : this;
    }
    return selector === "[data-action]" ? this : null;
  }

  querySelector(selector: string): FakeElement | null {
    return this.selectorMatches.get(selector)?.[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    return [...(this.selectorMatches.get(selector) ?? [])];
  }

  focus(): void {}

  contains(element: FakeElement | null): boolean {
    return element !== null;
  }

  replaceChildren(): void {}

  append(): void {}
}

class FakeSelectElement extends FakeElement {
  value = "";
}

class FakeTextAreaElement extends FakeElement {
  readOnly = false;
}

class FakeShell extends FakeElement {
  clickListener?: (event: { readonly target: FakeElement }) => void;

  constructor(
    controls: readonly FakeElement[],
    profileChips: readonly FakeElement[],
    selectorMatches: ReadonlyMap<string, readonly FakeElement[]> = new Map(),
  ) {
    super(
      "shell",
      {
        assistant: "open",
        assistantRuntime: "none",
        drawerAssistant: "open",
        overlay: "none",
        profile: "game",
      },
      new Map([
        ["[data-kind]", controls],
        [".profile-chip", profileChips],
        ...selectorMatches,
      ]),
    );
  }

  addEventListener(
    name: string,
    listener: (event: { readonly target: FakeElement }) => void,
  ): void {
    if (name === "click") this.clickListener = listener;
  }
}

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

function authoringDir(sceneId = "desktop-linux-open-scene"): string {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-golden-"));
  tmpDirs.push(dir);
  const doc = createDocument({
    id: "scene",
    data: {
      ...activeDocumentData(sceneId),
      entities: [{ id: "hero", x: 1, y: 2, rz: 0 }],
      material: { roughness: 0.4 },
    },
  });
  const written = writeDocumentFile(join(dir, "scene.json"), doc, { cwd: dir });
  if (!written.ok) throw new Error("golden fixture document refused");
  return dir;
}

function bridgeAt(dir: string, onFrameReport?: (report: DesktopFrameReport) => void) {
  return createDesktopBridge({ cwd: dir, nowMs: fixedNow, ...(onFrameReport ? { onFrameReport } : {}) });
}

describe("desktop bridge — the packaged app's engine paths are real", () => {
  it("migrates a legacy seeded project without replacing its existing data", () => {
    const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-legacy-"));
    tmpDirs.push(dir);
    const legacy = createDocument({
      id: "legacy-scene",
      title: "Existing project",
      data: { entities: [{ id: "legacy-hero", x: 9 }], material: { roughness: 0.8 } },
    });
    const written = writeDocumentFile(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), legacy, {
      cwd: dir,
    });
    if (!written.ok) {
      throw new Error(written.diagnostics.map((entry) => entry.message).join("; "));
    }

    expect(seedDesktopProject(dir)).toEqual({ ok: true, migrated: true });
    const bridge = bridgeAt(dir);
    const status = bridge.handle({
      action: "authoring",
      payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (!status.ok) throw new Error(status.reason);
    expect(status.data).toMatchObject({
      ok: true,
      documentId: "legacy-scene",
      data: {
        entities: [{ id: "legacy-hero", x: 9 }],
        material: { roughness: 0.8 },
      },
    });
    const scene = bridge.handle({
      action: "scene",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(scene.ok).toBe(true);
    const migratedBytes = readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    expect(seedDesktopProject(dir)).toEqual({ ok: true, migrated: false });
    expect(readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(migratedBytes);
  });

  it("handshakes with its identity and the closed action set", () => {
    const bridge = bridgeAt(authoringDir());
    const res = bridge.handle({ action: "handshake" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({
      app: "@sceneaxi/desktop-linux",
      runtime: "electron",
      bridgeVersion: 1,
      actions: DESKTOP_BRIDGE_ACTIONS,
    });
  });

  it("serves the composed MountableScene the renderer mounts", () => {
    const data = activeDocumentData("opened-project-scene");
    const expected = desktopSceneFromDocumentData(data);
    if (!expected.ok) throw new Error(expected.reason);
    const dir = authoringDir("opened-project-scene");
    const bridge = bridgeAt(dir);
    const res = bridge.handle({
      action: "scene",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const scene = res.data as ComposedScene;
    expect(scene.sceneId).toBe("opened-project-scene");
    expect(scene.instances).toHaveLength(3);
    expect(scene.sceneDigest).toBe(expected.mountable.sceneDigest);
    expect(scene.instances.map((i) => i.instanceId)).toEqual(
      expected.mountable.instances.map((i) => i.instanceId),
    );
    expect(scene.instances.map((instance) => instance.label)).toEqual([
      "Root instance",
      "Placed beside the root",
      "Stacked on the root",
    ]);
  });

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

    const backend = createThreeSculptPresentationBackend();
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
    expect(
      bridge.handle({
        action: "assistant",
        payload: {
          op: "start",
          route: "byo",
          profile: "@sceneaxi/profile-game",
          prompt: "Never finishes",
        },
      }).ok,
    ).toBe(true);
    reportProgress?.({ phase: "waiting-provider", percent: 20, message: "Waiting" });
    const abandoned = bridge.handle({
      action: "assistant",
      payload: { op: "abandon" },
    });
    expect(abandoned.ok).toBe(true);
    if (abandoned.ok) {
      expect(abandoned.data).toMatchObject({
        status: "refused",
        refusal: { reason: DESKTOP_BRIDGE_REFUSALS.assistantAbandoned },
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

  it("mounts the served scene on the one Three core without claiming pixels", () => {
    const bridge = bridgeAt(authoringDir());
    const res = bridge.handle({
      action: "scene",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (!res.ok) throw new Error(res.reason);
    const scene = res.data as ComposedScene;

    const backend = createThreeSculptPresentationBackend();
    const mounts = createSculptMountApi(backend);
    for (const instance of scene.instances) {
      mounts.mount({
        instanceId: instance.instanceId,
        artifact: scene.artifacts[instance.artifactId],
        transform: instance.worldTransform,
      } as Parameters<typeof mounts.mount>[0]);
    }
    const frame = mounts.render();
    expect(frame.backend).toBe("three");
    const expectedDrawCalls = scene.instances.reduce(
      (sum, instance) =>
        sum + (scene.artifacts[instance.artifactId]?.runtimeHierarchy.nodes.length ?? 0),
      0,
    );
    expect(frame.drawCalls).toBe(expectedDrawCalls);
    expect(frame.drawCalls).toBeGreaterThan(0);
    expect(frame.surface).toBe("headless");
    expect(frame.pixelsDrawn).toBe(false);
    expect(frame.label).toBe(THREE_HEADLESS_SURFACE_LABEL);
    expect(backend.capture()).toBeNull();
    mounts.dispose();
  });

  it("builds a real WebGLRenderer on the canvas path, so node must refuse it", () => {
    expect(() =>
      createThreeSculptPresentationBackend({
        canvas: {
          width: 960,
          height: 540,
          getContext: () => null,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as never,
      }),
    ).toThrow(/webgl/i);
  });

  it("opens a real kernel scene session through the orchestrator, deterministically", () => {
    const bridge = bridgeAt(authoringDir("active-kernel-scene"));
    const res = bridge.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const exercise = res.data as {
      bootstrap: Record<string, unknown>;
      initialDigest: string;
      tickDigests: string[];
      instanceCount: number;
      closed: boolean;
      mountable: { sceneId: string };
    };

    expect(exercise.bootstrap["kind"]).toBe("scene");
    expect(exercise.bootstrap["subjectId"]).toBe("active-kernel-scene");
    expect(exercise.bootstrap["openedAtMs"]).toBe(FIXED_NOW_MS);
    expect(exercise.bootstrap["resumed"]).toBe(false);
    expect(exercise.bootstrap["sessionId"]).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(exercise.instanceCount).toBe(3);
    expect(exercise.mountable.sceneId).toBe("active-kernel-scene");
    expect(exercise.closed).toBe(true);

    // Only `advance` moves state, and it really does: digests move tick over tick.
    expect(exercise.tickDigests).toHaveLength(4);
    expect(new Set([exercise.initialDigest, ...exercise.tickDigests]).size).toBe(5);

    // Deterministic under a fixed clock: the same request opens the same session.
    const again = bridge.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (!again.ok) throw new Error(again.reason);
    expect((again.data as typeof exercise).bootstrap["sessionId"]).toBe(
      exercise.bootstrap["sessionId"],
    );
    expect((again.data as typeof exercise).tickDigests).toEqual(exercise.tickDigests);
  });

  it("runs the shared authoring session: propose, accept, undo — never a fork", () => {
    const dir = authoringDir();
    const bridge = bridgeAt(dir);
    const before = readFileSync(join(dir, "scene.json"), "utf8");

    const proposed = bridge.handle({
      action: "authoring",
      payload: {
        op: "propose",
        documentPath: "scene.json",
        jsonPointer: "/data/entities/0/x",
        newValue: 7,
      },
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect((proposed.data as { phase: string }).phase).toBe("reviewing");
    // Proposing writes nothing.
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(before);

    const accepted = bridge.handle({ action: "authoring", payload: { op: "accept" } });
    if (!accepted.ok) throw new Error(accepted.reason);
    expect((accepted.data as { phase: string }).phase).toBe("applied");
    const recovered = bridge.handle({
      action: "authoring",
      payload: { op: "recover" },
    });
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;
    expect((recovered.data as { phase: string }).phase).toBe("applied");
    const after = readFileSync(join(dir, "scene.json"), "utf8");
    expect(after).not.toBe(before);
    expect(after).toContain('"x": 7');

    const undone = bridge.handle({ action: "authoring", payload: { op: "undo" } });
    if (!undone.ok) throw new Error(undone.reason);
    expect((undone.data as { ok: boolean }).ok).toBe(true);
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(before);
  });

  it("restarts the authoring session and re-reads the active document", () => {
    const dir = authoringDir();
    const bridge = bridgeAt(dir);
    const proposed = bridge.handle({
      action: "authoring",
      payload: {
        op: "propose",
        documentPath: "scene.json",
        jsonPointer: "/data/entities/0/x",
        newValue: 7,
      },
    });
    expect(proposed.ok).toBe(true);

    const restarted = bridge.handle({
      action: "authoring",
      payload: { op: "restart", documentPath: "scene.json" },
    });
    expect(restarted.ok).toBe(true);
    if (!restarted.ok) return;
    expect(restarted.data).toMatchObject({ ok: true, documentId: "scene" });

    const accepted = bridge.handle({ action: "authoring", payload: { op: "accept" } });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.data).toMatchObject({
      phase: "idle",
      diagnostics: [{ code: "invalid-proposal" }],
    });
  });

  it("refuses an authoring documentPath that leaves the project directory", () => {
    // The path arrives from the renderer across IPC and the authoring core resolves it
    // against `cwd` with no containment check of its own, so the bridge owns it.
    const dir = authoringDir();
    const bridge = bridgeAt(dir);
    const escapes = [
      "/etc/passwd",
      "../scene.json",
      "nested/../scene.json",
      "nested/../../scene.json",
      join(dir, "scene.json"),
    ];

    for (const documentPath of escapes) {
      const proposed = bridge.handle({
        action: "authoring",
        payload: { op: "propose", documentPath, jsonPointer: "/data/entities/0/x", newValue: 7 },
      });
      expect(proposed.ok, documentPath).toBe(false);
      if (!proposed.ok) expect(proposed.reason).toBe(DESKTOP_BRIDGE_REFUSALS.requestMalformed);

      const status = bridge.handle({ action: "authoring", payload: { op: "status", documentPath } });
      expect(status.ok, documentPath).toBe(false);
      if (!status.ok) expect(status.reason).toBe(DESKTOP_BRIDGE_REFUSALS.requestMalformed);
    }

    // A contained path still works: the constraint refuses escapes, not authoring.
    const contained = bridge.handle({ action: "authoring", payload: { op: "status", documentPath: "scene.json" } });
    expect(contained.ok).toBe(true);
  });

  it("refuses a documentPath that leaves the project through a symlink", () => {
    // A lexical check passes `link/scene.json` while the authoring core follows the
    // link and reads and writes outside the project, so containment is judged on the
    // canonical path — where the bytes actually land.
    const dir = authoringDir();
    const outside = authoringDir();
    symlinkSync(outside, join(dir, "link"), "dir");
    symlinkSync(join(outside, "scene.json"), join(dir, "elsewhere.json"), "file");
    const bridge = bridgeAt(dir);

    for (const documentPath of ["link/scene.json", "link", "elsewhere.json"]) {
      const proposed = bridge.handle({
        action: "authoring",
        payload: { op: "propose", documentPath, jsonPointer: "/data/entities/0/x", newValue: 7 },
      });
      expect(proposed.ok, documentPath).toBe(false);
      if (!proposed.ok) expect(proposed.reason).toBe(DESKTOP_BRIDGE_REFUSALS.requestMalformed);

      const status = bridge.handle({ action: "authoring", payload: { op: "status", documentPath } });
      expect(status.ok, documentPath).toBe(false);
      if (!status.ok) expect(status.reason).toBe(DESKTOP_BRIDGE_REFUSALS.requestMalformed);
    }

    // A symlink that stays inside the project is not an escape, and a not-yet-created
    // document inside it still resolves — containment is not an existence check.
    symlinkSync(dir, join(dir, "self"), "dir");
    for (const documentPath of ["self/scene.json", "new/scene.json"]) {
      const status = bridge.handle({ action: "authoring", payload: { op: "status", documentPath } });
      expect(status.ok, documentPath).toBe(true);
    }
  });

  it("accepts only a real frame-report shape, and hands it to the observer", () => {
    const seen: DesktopFrameReport[] = [];
    const bridge = bridgeAt(authoringDir(), (report) => seen.push(report));
    expect(bridge.lastFrameReport()).toBeNull();

    const bad = bridge.handle({ action: "frame-report", payload: { backend: "three" } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe(DESKTOP_BRIDGE_REFUSALS.requestMalformed);

    const report = {
      backend: "three",
      label: "Three presentation core",
      frame: 1,
      instanceIds: ["desktop-crate-root"],
      drawCalls: 5,
      surface: "webgl-canvas",
      pixelsDrawn: true,
    };
    const good = bridge.handle({ action: "frame-report", payload: report });
    expect(good.ok).toBe(true);
    expect(bridge.lastFrameReport()).toEqual(report);
    expect(seen).toHaveLength(1);
  });

  it("refuses unknown actions, malformed requests, and unknown authoring ops by name", () => {
    const bridge = bridgeAt(authoringDir());

    const unknown = bridge.handle({ action: "install-plugins" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toBe(DESKTOP_BRIDGE_REFUSALS.actionUnknown);

    const malformed = bridge.handle("open sesame");
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.reason).toBe(DESKTOP_BRIDGE_REFUSALS.requestMalformed);

    const badOp = bridge.handle({ action: "authoring", payload: { op: "publish" } });
    expect(badOp.ok).toBe(false);
    if (!badOp.ok) expect(badOp.reason).toBe(DESKTOP_BRIDGE_REFUSALS.authoringOpUnknown);
  });
});

describe("desktop chrome document — the shell's chrome, unforked, plus two injections", () => {
  it("derives the document from renderDesktopChrome and injects runtime marker and renderer", () => {
    const html = desktopLinuxIndexHtml();
    expect(html).toContain('<meta name="generator" content="@sceneaxi/desktop-shell chrome">');
    expect(html).toContain('<meta name="sceneaxi-pixels-drawn" content="false">');
    expect(html).toContain(DESKTOP_RUNTIME_META);
    expect(html).toContain(RENDERER_SCRIPT_TAG);
    // The chrome's own interactive controls are intact — not a re-implementation.
    expect(html).toContain('data-action="mode"');
    expect(html).toContain('data-action="profile"');
    // The markup the renderer viewport and the packaged smoke read but do not own.
    expect(html).toContain('<div class="viewport">');
    expect(html).toContain("viewport-note-inert");
    expect(html).toContain("<title>SceneAxi Engine Desktop</title>");
    expect(html).toContain('data-assistant-runtime="none"');
    expect(html).toContain(
      `<textarea id="assistant-prompt" data-kind="inert" aria-disabled="true" data-refusal="${DESKTOP_VISUAL_REFUSALS.noPresentationRuntime}"`,
    );
    expect(html).toContain(
      `data-assistant-runtime-event="${DESKTOP_ASSISTANT_RUNTIME_EVENT}"`,
    );
    expect(html).toContain("Hosted · metered");
  });

  it("activates only after runtime binding and preserves refusal across profiles", async () => {
    const runtimeRefusal = DESKTOP_BRIDGE_REFUSALS.presentationRuntimeUnavailable;
    const prompt = new FakeTextAreaElement("assistant-prompt", { kind: "inert" });
    const send = new FakeElement("assistant-send", { kind: "inert" });
    const retry = new FakeElement("assistant-retry", { kind: "inert" });
    const controls = [prompt, send, retry];
    const profileChips = ["game", "web", "kids"].map(
      (profile) =>
        new FakeElement(`profile-${profile}`, {
          action: "profile",
          value: profile,
        }),
    );
    const shell = new FakeShell(controls, profileChips);
    const documentListeners = new Map<string, (event: { readonly detail?: unknown }) => void>();
    const script = /<script>([\s\S]*?)<\/script>/.exec(desktopLinuxIndexHtml())?.[1];
    expect(script).toBeDefined();
    runInNewContext(script ?? "", {
      document: {
        activeElement: null,
        addEventListener: (
          name: string,
          listener: (event: { readonly detail?: unknown }) => void,
        ) => documentListeners.set(name, listener),
        querySelector: (selector: string) => (selector === ".shell" ? shell : null),
      },
      Element: FakeElement,
      HTMLTextAreaElement: FakeTextAreaElement,
      window: {
        matchMedia: () => ({
          addEventListener: () => undefined,
          matches: false,
        }),
      },
    });

    // The chrome serializes a profile switch with the project actions, so the
    // click resolves through the document's in-flight guard rather than in the
    // click handler itself: a real operator's next click is a later event-loop
    // turn, and asserting inside this one would read the pre-switch document.
    const switchTo = async (profile: string): Promise<void> => {
      const chip = profileChips.find((candidate) => candidate.dataset.value === profile);
      if (chip === undefined || shell.clickListener === undefined) {
        throw new Error(`profile switch harness missing ${profile}`);
      }
      shell.clickListener({ target: chip });
      await Promise.resolve();
      await Promise.resolve();
    };
    const expectRefusal = (reason: string): void => {
      for (const control of controls) {
        expect(control.dataset.kind).toBe("inert");
        expect(control.dataset.refusal).toBe(reason);
        expect(control.getAttribute("aria-disabled")).toBe("true");
        expect(control.getAttribute("aria-describedby")).toBe(`refusal-${reason}`);
        expect(control.classList.contains("is-inert")).toBe(true);
      }
      expect(prompt.readOnly).toBe(true);
    };

    const expectLive = (): void => {
      for (const control of controls) {
        expect(control.dataset.kind).toBe("live");
        expect(control.dataset.refusal).toBeUndefined();
        expect(control.getAttribute("aria-disabled")).toBeNull();
        expect(control.getAttribute("aria-describedby")).toBeNull();
        expect(control.classList.contains("is-inert")).toBe(false);
      }
      expect(prompt.readOnly).toBe(false);
    };

    documentListeners.get(DESKTOP_ASSISTANT_RUNTIME_EVENT)?.({
      detail: { runtime: "local" },
    });
    expectLive();
    await switchTo("web");
    expectLive();
    await switchTo("kids");
    expectRefusal(DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied);
    await switchTo("game");
    expectLive();

    documentListeners.get(DESKTOP_ASSISTANT_RUNTIME_EVENT)?.({
      detail: { runtime: "none", message: "Viewport unavailable" },
    });
    expectRefusal(runtimeRefusal);

    await switchTo("web");
    expectRefusal(runtimeRefusal);
    await switchTo("kids");
    expectRefusal(DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied);
    await switchTo("game");
    expectRefusal(runtimeRefusal);
  });

  function mountRarityChrome(port?: unknown) {
    const reject = new FakeElement("change-reject", { action: "change-reject" });
    const reload = new FakeElement("document-reload", { action: "document-reload" });
    const openRecent = new FakeElement("project-open-recent", { action: "project-open-recent" });
    const recentSelect = new FakeSelectElement("project-recent-select");
    const play = new FakeElement("run-play", { command: "run-play" });
    const runSession = new FakeElement("run-session");
    const runLive = new FakeElement("run-live");
    const runEvidence = new FakeElement("run-evidence");
    runEvidence.hidden = true;
    const proposal = new FakeElement("proposal");
    proposal.hidden = true;
    const empty = new FakeElement("empty");
    const documentPath = new FakeElement("document");
    const contentHash = new FakeElement("hash");
    const diff = new FakeElement("diff");
    const reviewEvidence = new FakeElement("review-evidence");
    reviewEvidence.hidden = true;
    const evidence = new FakeElement("evidence");
    evidence.hidden = true;
    const evidenceEmpty = new FakeElement("evidence-empty");
    const projectState = new FakeElement("project-state");
    const status = new FakeElement("status");
    const fileStatus = new FakeElement("file-status");
    const badge = new FakeElement("badge");
    const changesTab = new FakeElement("dock-changes", { value: "changes" });
    const evidenceTab = new FakeElement("dock-evidence", { value: "evidence" });
    const changesPanel = new FakeElement("dock-panel-changes", { dockPanel: "changes" });
    const evidencePanel = new FakeElement("dock-panel-evidence", { dockPanel: "evidence" });
    const shell = new FakeShell(
      [],
      [],
      new Map([
        ["[data-change-proposal]", [proposal]],
        ["[data-change-empty]", [empty]],
        ["[data-change-document]", [documentPath]],
        ["[data-change-content-hash]", [contentHash]],
        ["[data-change-diff]", [diff]],
        ["[data-change-rarity-evidence]", [reviewEvidence]],
        ["[data-rarity-evidence]", [evidence]],
        ["[data-rarity-evidence-empty]", [evidenceEmpty]],
        ["[data-project-state]", [projectState]],
        ["[data-project-status]", [status]],
        ["[data-project-file-state]", [fileStatus]],
        ["[data-change-badge]", [badge]],
        ["[data-command]", [play]],
        ["#project-recent-select", [recentSelect]],
        ["[data-run-session-report]", [runSession]],
        ["[data-run-live-report]", [runLive]],
        ["[data-run-rarity-evidence]", [runEvidence]],
        [".dock-tab", [changesTab, evidenceTab]],
        ["[data-dock-panel]", [changesPanel, evidencePanel]],
      ]),
    );
    const documentListeners = new Map<string, (event: { readonly detail?: unknown }) => void>();
    const script = /<script>([\s\S]*?)<\/script>/.exec(desktopLinuxIndexHtml())?.[1];
    expect(script).toBeDefined();
    runInNewContext(script ?? "", {
      document: {
        activeElement: null,
        addEventListener: (
          name: string,
          listener: (event: { readonly detail?: unknown }) => void,
        ) => documentListeners.set(name, listener),
        // The chrome dispatches the viewport play event and the renderer answers
        // it by marking the detail accepted. Routing it back through the same
        // listener map lets a test stand in for that renderer.
        dispatchEvent: (event: { readonly type: string; readonly detail?: unknown }) => {
          documentListeners.get(event.type)?.(event);
          return true;
        },
        createElement: () => new FakeElement("created"),
        querySelector: (selector: string) => (selector === ".shell" ? shell : null),
      },
      CustomEvent: class {
        readonly type: string;
        readonly detail: unknown;
        constructor(type: string, init?: { readonly detail?: unknown }) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
      Element: FakeElement,
      HTMLTextAreaElement: FakeTextAreaElement,
      window: {
        matchMedia: () => ({ addEventListener: () => undefined, matches: false }),
      },
      ...(port === undefined ? {} : { sceneaxiDesktop: port }),
    });
    return {
      shell, reject, reload, openRecent, recentSelect, play, runSession, runLive,
      runEvidence, proposal, empty, documentPath,
      contentHash, diff, reviewEvidence, evidence, evidenceEmpty, projectState, status,
      fileStatus, badge, changesTab, evidenceTab, changesPanel, evidencePanel,
      documentListeners,
    };
  }

  const RARITY_EVIDENCE_FIXTURE = Object.freeze({
    eventId: "wayfinder-drop-001",
    tier: "uncommon",
    candidateId: "wayfinder-copper",
    scope: "desktop-linux-rarity",
    algorithmId: "sceneaxi.rarity.weighted-sha256-v1",
    projectSeed: 20260809,
    policyDigest: "sha256:policy",
    requestDigest: "sha256:request",
    outcomeDigest: "sha256:outcome",
    provenanceDigest: "sha256:provenance",
    namespaceDigest: "sha256:namespace",
    tierRollDigest: "sha256:tier-roll",
    candidateRollDigest: "sha256:candidate-roll",
    tierDraw: 69,
    tierTotalWeight: 100,
    candidateDraw: 2,
    candidateTotalWeight: 5,
    providerEvidence: {
      model: {
        provider: "sceneaxi-fixture",
        model: "wayfinder-rarity-fixture",
        quantization: "deterministic-json",
        version: "2026-08-09",
      },
    },
  });

  const RARITY_PROPOSAL_SNAPSHOT = Object.freeze({
    phase: "reviewing",
    proposal: {
      edits: [{ documentPath: "scene.json", baseContentHash: "sha256:base" }],
    },
    unifiedDiff: "--- scene.json",
    renderedDiff: "rarity: + uncommon / wayfinder-copper",
    appliedPaths: null,
    journalRecoveryPending: false,
    transactionId: null,
    diagnostics: [],
  });

  it("moves a rarity proposal into actionable review and both safe evidence views", () => {
    const {
      proposal, empty, documentPath, diff, reviewEvidence, evidence, evidenceEmpty,
      projectState, status, fileStatus, badge, changesTab, evidenceTab, changesPanel,
      evidencePanel, documentListeners,
    } = mountRarityChrome();

    const rarityEvidence = RARITY_EVIDENCE_FIXTURE;
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        replayed: false,
        evidence: rarityEvidence,
        snapshot: { ...RARITY_PROPOSAL_SNAPSHOT, rarityEvidence },
      },
    });

    expect(proposal.hidden).toBe(false);
    expect(empty.hidden).toBe(true);
    expect(documentPath.textContent).toBe("scene.json");
    expect(diff.textContent).toContain("wayfinder-copper");
    expect(reviewEvidence.textContent).toContain("provenance sha256:provenance");
    expect(evidence.textContent).toContain(
      "provider sceneaxi-fixture · model wayfinder-rarity-fixture",
    );
    expect(reviewEvidence.hidden).toBe(false);
    expect(evidence.hidden).toBe(false);
    expect(evidenceEmpty.hidden).toBe(true);
    expect(changesTab.getAttribute("aria-selected")).toBe("true");
    expect(evidenceTab.getAttribute("aria-selected")).toBe("false");
    expect(changesPanel.hidden).toBe(false);
    expect(evidencePanel.hidden).toBe(true);
    expect(projectState.dataset.projectState).toBe("dirty");
    expect(status.textContent).toContain("review before Save");
    expect(fileStatus.textContent).toContain("review before Save");
    expect(badge.textContent).toBe("1");
  });

  it("reports an idempotent rarity replay as a replay, not as a staged proposal", () => {
    const {
      proposal, empty, evidence, evidenceEmpty, projectState, status, badge,
      changesTab, evidenceTab, changesPanel, evidencePanel, documentListeners,
    } = mountRarityChrome();

    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: { replayed: true, snapshot: null, evidence: RARITY_EVIDENCE_FIXTURE },
    });

    expect(evidence.textContent).toContain("provenance sha256:provenance");
    expect(evidence.hidden).toBe(false);
    expect(evidenceEmpty.hidden).toBe(true);
    expect(evidenceTab.getAttribute("aria-selected")).toBe("true");
    expect(evidencePanel.hidden).toBe(false);
    expect(changesTab.getAttribute("aria-selected")).toBe("false");
    expect(changesPanel.hidden).toBe(true);
    expect(proposal.hidden).toBe(true);
    expect(empty.hidden).toBe(false);
    expect(badge.textContent).toBe("0");
    expect(projectState.dataset.projectState).not.toBe("dirty");
    expect(status.textContent).toContain("nothing staged");
    expect(status.textContent).not.toContain("review before Save");
  });

  // Reject is driven through the real click handler and a fake desktop port, so
  // the assertion covers the chrome's own decision rather than a helper called
  // directly. The proposal under review is installed through the rarity event in
  // both cases; only its `rarityEvidence` member differs, which is exactly the
  // difference the clear is supposed to key on.
  const rejectingPort = () => {
    const rejected = {
      phase: "rejected",
      proposal: null,
      unifiedDiff: null,
      renderedDiff: null,
      appliedPaths: null,
      journalRecoveryPending: false,
      transactionId: null,
      diagnostics: [],
    };
    return {
      request: (request: { readonly payload?: { readonly op?: string } }) =>
        Promise.resolve(
          request.payload?.op === "reject"
            ? { ok: true, data: rejected }
            : { ok: false, reason: "DESKTOP_TEST_NO_RUNTIME", message: "no runtime" },
        ),
    };
  };

  // Reject completes asynchronously and ends by reporting the re-open it could
  // not perform against this fake port, so that status is the signal that
  // `syncReview` has already seen the rejected snapshot. Asserting before it
  // would read the pre-click state and pass either way.
  const rejectSettled = async (status: FakeElement): Promise<void> => {
    await vi.waitFor(() => {
      expect(status.textContent).toContain("Open refused");
    });
  };

  it("keeps accepted rarity evidence when an unrelated proposal is rejected", async () => {
    const { reject, shell, evidence, evidenceEmpty, status, documentListeners } =
      mountRarityChrome(rejectingPort());

    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        replayed: false,
        evidence: RARITY_EVIDENCE_FIXTURE,
        snapshot: { ...RARITY_PROPOSAL_SNAPSHOT, rarityEvidence: RARITY_EVIDENCE_FIXTURE },
      },
    });
    expect(evidence.hidden).toBe(false);

    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        replayed: false,
        evidence: RARITY_EVIDENCE_FIXTURE,
        snapshot: { ...RARITY_PROPOSAL_SNAPSHOT, renderedDiff: "translation.x: 0 → 3" },
      },
    });

    shell.clickListener?.({ target: reject });
    await rejectSettled(status);
    expect(evidence.textContent).toContain("provenance sha256:provenance");
    expect(evidence.hidden).toBe(false);
    expect(evidenceEmpty.hidden).toBe(true);
  });

  it("keeps a staged rarity proposal's evidence on screen through Play", async () => {
    // Play reports the open path it just ran. Staging changed no project bytes, so
    // that run carries no rarity — but the staged proposal is still pending Accept
    // and its provenance is still rendered in Change Review.
    const openPath = {
      closed: true,
      initialDigest: "sha256:initial",
      tickDigests: ["sha256:tick"],
      instanceCount: 1,
      mountable: { sceneId: "desktop-scene" },
    };
    const port = {
      request: (request: { readonly action?: string; readonly payload?: { readonly op?: string } }) =>
        Promise.resolve(
          request.action === "open-path"
            ? { ok: true, action: "open-path", data: openPath }
            : request.payload?.op === "status"
              ? {
                  ok: true,
                  action: "authoring",
                  data: {
                    ok: true,
                    documentId: "scene",
                    contentHash: "sha256:base",
                    data: {},
                    undoAvailability: "unavailable",
                  },
                }
              : { ok: false, reason: "DESKTOP_TEST_NO_RUNTIME", message: "no runtime" },
        ),
    };
    const { shell, play, reload, status, evidence, evidenceEmpty, runSession, documentListeners } =
      mountRarityChrome(port);

    documentListeners.set(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
      const detail = event.detail as { accepted: boolean; frame: number | null };
      detail.accepted = true;
      detail.frame = 1;
    });
    // Open the project first, so Play does not take the branch that discards a
    // staged proposal on the operator's behalf — the sequence under test is
    // Agent stages, then Play, on an already-open document.
    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("· open ·");
    });
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        replayed: false,
        evidence: RARITY_EVIDENCE_FIXTURE,
        snapshot: { ...RARITY_PROPOSAL_SNAPSHOT, rarityEvidence: RARITY_EVIDENCE_FIXTURE },
      },
    });
    expect(evidence.hidden).toBe(false);

    shell.clickListener?.({ target: play });
    await vi.waitFor(() => {
      expect(runSession.textContent).toContain("terminal digest sha256:tick");
    });
    expect(evidence.textContent).toContain("provenance sha256:provenance");
    expect(evidence.hidden).toBe(false);
    expect(evidenceEmpty.hidden).toBe(true);
    // The run itself carried no rarity, so its own report must not claim one.
    expect(runSession.textContent).not.toContain("rarity uncommon");
  });

  it("renders the run's full safe provenance through the shared formatter", async () => {
    const openPath = {
      closed: true,
      initialDigest: "sha256:initial",
      tickDigests: ["sha256:tick"],
      instanceCount: 1,
      mountable: { sceneId: "desktop-scene" },
      rarity: RARITY_EVIDENCE_FIXTURE,
      raritySession: { replayDigest: "sha256:rarity-replay" },
    };
    const port = {
      request: (request: { readonly action?: string; readonly payload?: { readonly op?: string } }) =>
        Promise.resolve(
          request.action === "open-path"
            ? { ok: true, action: "open-path", data: openPath }
            : request.payload?.op === "status"
              ? {
                  ok: true,
                  action: "authoring",
                  data: {
                    ok: true,
                    documentId: "scene",
                    contentHash: "sha256:base",
                    data: {},
                    undoAvailability: "unavailable",
                  },
                }
              : { ok: false, reason: "DESKTOP_TEST_NO_RUNTIME", message: "no runtime" },
        ),
    };
    const { shell, play, runSession, runEvidence, documentListeners } =
      mountRarityChrome(port);
    documentListeners.set(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
      const detail = event.detail as { accepted: boolean; frame: number | null };
      detail.accepted = true;
      detail.frame = 1;
    });

    shell.clickListener?.({ target: play });
    await vi.waitFor(() => {
      expect(runEvidence.hidden).toBe(false);
    });

    // Every field the shared formatter prints, on the Run surface — not the
    // tier/candidate/provenance summary it used to paraphrase.
    const shared = formatSafeRarityEvidence(RARITY_EVIDENCE_FIXTURE);
    expect(shared).not.toBeNull();
    expect(runEvidence.textContent).toContain(shared ?? "");
    expect(runEvidence.textContent).toContain("scope desktop-linux-rarity");
    expect(runEvidence.textContent).toContain("seed 20260809");
    expect(runEvidence.textContent).toContain("tier draw 69 / 100");
    expect(runEvidence.textContent).toContain("namespace sha256:namespace");
    expect(runEvidence.textContent).toContain(
      "provider sceneaxi-fixture · model wayfinder-rarity-fixture",
    );
    // The rarity product session is named, and the run report line claims none of
    // the rarity facts as its own.
    expect(runEvidence.textContent).toContain(
      "verified in a separate product session replayed to sha256:rarity-replay",
    );
    expect(runSession.textContent).toContain("terminal digest sha256:tick");
    expect(runSession.textContent).not.toContain("rarity");
  });

  it("clears rarity evidence when the bound project root changes", async () => {
    const lifecycleStatus = {
      recents: [{ root: "/tmp/project-b", name: "project-b" }],
      active: { name: "project-b", root: "/tmp/project-b", documentPath: "scene.json" },
    };
    const port = {
      request: () =>
        Promise.resolve({ ok: false, reason: "DESKTOP_TEST_NO_RUNTIME", message: "no runtime" }),
      project: () =>
        Promise.resolve({ ok: true, data: { status: lifecycleStatus, outcome: "opened" } }),
    };
    const { shell, openRecent, recentSelect, evidence, evidenceEmpty, documentListeners } =
      mountRarityChrome(port);

    // Project A's accepted provenance is on screen.
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: { replayed: true, snapshot: null, evidence: RARITY_EVIDENCE_FIXTURE },
    });
    expect(evidence.hidden).toBe(false);
    expect(evidence.textContent).toContain("provenance sha256:provenance");

    recentSelect.value = "/tmp/project-b";
    shell.clickListener?.({ target: openRecent });
    await vi.waitFor(() => {
      expect(evidence.hidden).toBe(true);
    });
    expect(evidence.textContent).toBe("");
    expect(evidenceEmpty.hidden).toBe(false);
  });

  it("retires rarity evidence when the rarity proposal itself is rejected", async () => {
    const { reject, shell, evidence, evidenceEmpty, status, documentListeners } =
      mountRarityChrome(rejectingPort());

    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        replayed: false,
        evidence: RARITY_EVIDENCE_FIXTURE,
        snapshot: { ...RARITY_PROPOSAL_SNAPSHOT, rarityEvidence: RARITY_EVIDENCE_FIXTURE },
      },
    });
    expect(evidence.hidden).toBe(false);

    shell.clickListener?.({ target: reject });
    await rejectSettled(status);
    expect(evidence.hidden).toBe(true);
    expect(evidenceEmpty.hidden).toBe(false);
  });
});

describe("desktop renderer module accounting", () => {
  const desktopRoot = fileURLToPath(new URL("../../desktop", import.meta.url));

  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist" || entry === "release") continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) sourceFiles(path, out);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
    }
    return out;
  }

  it("exactly one desktop module constructs the presentation backend: the renderer viewport", () => {
    const owners = sourceFiles(desktopRoot).filter((file) =>
      readFileSync(file, "utf8").includes("createThreeSculptPresentationBackend"),
    );
    expect(owners.map((file) => file.slice(desktopRoot.length + 1))).toEqual([
      "linux/src/renderer/viewport.ts",
    ]);
  });

  it("wires the assistant job into the existing mount and manipulator seams", () => {
    const source = readFileSync(
      join(desktopRoot, "linux/src/renderer/viewport.ts"),
      "utf8",
    );
    expect(source).toContain('action: "assistant"');
    expect(source).toContain("createDesktopAssistantViewportController(mounts)");
    expect(source).toContain("assistantViewport.manipulate(control.dataset.value)");
    expect(source).toContain('data-assistant-manipulators');
  });

  it("abandons a job that never settles and names the timeout", async () => {
    const requests: unknown[] = [];
    const outcome = await pollAssistantJob({
      attempts: 3,
      wait: () => Promise.resolve(),
      request: (request) => {
        requests.push(request);
        return Promise.resolve({
          ok: true as const,
          action: "assistant" as const,
          data: {
            jobId: "desktop-assistant-1",
            route: "local",
            status: "running",
            latestProgress: null,
            progressCount: 0,
          },
        });
      },
    });
    expect(outcome).toEqual({
      ok: false,
      reason: DESKTOP_BRIDGE_REFUSALS.assistantStatusTimeout,
      message:
        "The assistant job did not finish in time; it was abandoned and Retry may start a fresh job.",
    });
    // The abandon is the point: without it the job stays running and the next
    // Retry is met with DESKTOP_ASSISTANT_BUSY.
    expect(requests).toHaveLength(4);
    expect(requests.at(-1)).toEqual({ action: "assistant", payload: { op: "abandon" } });
    expect(requests.slice(0, 3)).toEqual(
      Array.from({ length: 3 }, () => ({ action: "assistant", payload: { op: "status" } })),
    );
  });

  it("carries a refused job's redacted reason and detail into one poll outcome", async () => {
    const settled = async (job: unknown) =>
      pollAssistantJob({
        attempts: 2,
        wait: () => Promise.resolve(),
        request: () =>
          Promise.resolve({ ok: true as const, action: "assistant" as const, data: job }),
      });

    expect(
      await settled({
        jobId: "j",
        route: "local",
        status: "refused",
        latestProgress: null,
        progressCount: 0,
        refusal: { ok: false, reason: "SOME_REFUSAL", message: "it refused", recoverable: true },
      }),
    ).toEqual({ ok: false, reason: "SOME_REFUSAL", message: "it refused" });

    expect(
      await settled({
        jobId: "j",
        route: "local",
        status: "refused",
        latestProgress: null,
        progressCount: 0,
        refusal: {
          ok: false,
          reason: "SOME_REFUSAL",
          message: "it refused",
          recoverable: true,
          detail: "local detail",
        },
      }),
    ).toMatchObject({ ok: false, message: "it refused — local detail" });

    expect(await settled(null)).toEqual({
      ok: false,
      reason: DESKTOP_BRIDGE_REFUSALS.assistantJobMissing,
      message: "The assistant job disappeared; retry the prompt.",
    });
  });

  it("projects a settled Build job into the read-only inspection view", () => {
    const job = {
      jobId: "j",
      route: "local" as const,
      status: "ready" as const,
      latestProgress: null,
      progressCount: 0,
      result: {
        ok: true as const,
        route: "local" as const,
        artifactBytes: 0,
        artifactDigest: "sha256:artifact",
        inspection: {
          materials: {
            values: [{ id: "crate-shell", baseColor: "#3366cc", metallic: 0.1, roughness: 0.7 }],
          },
          physics: {
            supported: false,
            reason: "PHYSICS_UNSUPPORTED",
            message: "no collider authority on this surface",
          },
          settings: {
            proceduralModule: { moduleId: "crate", exportName: "buildCrate" },
            edit: { refusal: "SETTINGS_READ_ONLY" },
          },
        },
        mountable: undefined,
      },
    } as unknown as DesktopAssistantJobSnapshot;

    const text = assistantInspectionText(job);
    expect(text.split("\n")).toEqual([
      "MATERIALS (read-only)",
      "crate-shell: #3366cc, metal 0.1, rough 0.7",
      "",
      "PHYSICS (read-only)",
      "PHYSICS_UNSUPPORTED: no collider authority on this surface",
      "",
      "SETTINGS (read-only)",
      "crate · buildCrate",
      "SETTINGS_READ_ONLY",
    ]);

    // A rarity proposal carries no artifact to inspect, so this view stays empty
    // and its provenance is rendered by the shared safe-evidence formatter.
    expect(
      assistantInspectionText({
        ...job,
        result: { ok: true, kind: "rarity-proposal", replayed: false, evidence: {} },
      } as unknown as DesktopAssistantJobSnapshot),
    ).toBe("");
  });

  it("starts Build and Agent through the bridge and refuses every other composer mode", async () => {
    const profile = "@sceneaxi/profile-game" as const;
    const agent = decideAssistantStart({
      mode: "agent",
      route: "local",
      profile,
      prompt: "  stage a drop  ",
    });
    expect(agent).toEqual({
      ok: true,
      payload: {
        op: "start",
        route: "local",
        profile,
        prompt: "stage a drop",
        mode: "agent",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      },
    });
    const build = decideAssistantStart({
      mode: "build",
      route: undefined,
      profile,
      prompt: "a crate",
    });
    expect(build).toEqual({
      ok: true,
      payload: { op: "start", route: "local", profile, prompt: "a crate", mode: "build" },
    });

    for (const mode of [undefined, "", "ask", "Agent", "agent "]) {
      expect(decideAssistantStart({ mode, route: "local", profile, prompt: "a crate" })).toEqual({
        ok: false,
        reason: DESKTOP_BRIDGE_REFUSALS.assistantBuildModeRequired,
        message:
          "Choose Build for a Sculpt Artifact or Agent for a fixture-backed rarity proposal; Ask is not implemented.",
      });
    }
    expect(
      decideAssistantStart({ mode: "agent", route: "local", profile, prompt: "   " }),
    ).toMatchObject({ ok: false, reason: "ASSISTANT_SCULPT_PROMPT_INVALID" });

    const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-composer-mode-"));
    try {
      expect(seedDesktopProject(dir)).toEqual({ ok: true, migrated: false });
      const bridge = createDesktopBridge({
        cwd: dir,
        nowMs: fixedNow,
        runRarityProvider: createDesktopRarityFixtureProvider(),
      });
      if (!agent.ok) throw new Error("agent start refused");
      expect(bridge.handle({ action: "assistant", payload: agent.payload })).toMatchObject({
        ok: true,
        action: "assistant",
      });
      await vi.waitFor(() => {
        const response = bridge.handle({ action: "assistant", payload: { op: "status" } });
        const job = response.ok ? (response.data as DesktopAssistantJobSnapshot | null) : null;
        expect(job?.status).toBe("ready");
      });
      const settled = bridge.handle({ action: "assistant", payload: { op: "status" } });
      const job = settled.ok ? (settled.data as DesktopAssistantJobSnapshot | null) : null;
      expect(job?.result).toMatchObject({ kind: "rarity-proposal", replayed: false });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("leaves no composer control live-but-unbound when the viewport refuses", () => {
    const source = readFileSync(
      join(desktopRoot, "linux/src/renderer/viewport.ts"),
      "utf8",
    );
    // The chrome starts the composer inert. The runtime promotes it only after
    // the scene request, backend construction, first mount, and handler binding.
    // Every earlier return keeps the model-owned unavailable transition.
    expect(source).toContain("signalAssistantRuntimeUnavailable");
    expect(source).toContain('signalAssistantRuntime("local")');
    expect(source).toContain("const assistantBound = installAssistantProductFlow");
    expect(source.indexOf("const assistantBound = installAssistantProductFlow")).toBeLessThan(
      source.indexOf('signalAssistantRuntime("local")'),
    );
    expect(source).toContain("shell?.dataset.assistantRuntimeEvent");
    expect(source).toContain('signalAssistantRuntime("none", message)');
    expect(source).not.toContain("ASSISTANT_CONTROL_IDS");
    // One place says it, and that place settles the composer too — a second
    // refusal sentence would be a path that reports without disarming Send.
    expect(source.match(/Live viewport refused/g)).toHaveLength(1);
  });

  it("synchronizes the mounted viewport scene and restores it after a refused replacement", () => {
    const initial = desktopOpenScene();
    const replacement = desktopSceneFromDocumentData(activeDocumentData("viewport-replacement"));
    if (!initial.ok || !replacement.ok) throw new Error("viewport scene fixture refused");
    const backend = createThreeSculptPresentationBackend();
    const mounts = createSculptMountApi(backend);
    mountDesktopScene(mounts, initial.mountable);
    let reframes = 0;
    const synchronized = synchronizeViewportScene({
      mounts,
      frameMountedContent: () => {
        reframes += 1;
      },
      current: initial.mountable,
      next: replacement.mountable,
    });
    expect(synchronized).toMatchObject({
      ok: true,
      scene: { sceneId: "viewport-replacement" },
    });
    if (!synchronized.ok) return;
    expect(mounts.list().map((instance) => instance.instanceId)).toEqual(
      replacement.mountable.instances.map((instance) => instance.instanceId),
    );

    const invalid = {
      ...replacement.mountable,
      sceneDigest: "sha256:invalid-replacement",
      instances: replacement.mountable.instances.map((instance, index) =>
        index === 0 ? { ...instance, worldTransform: {} } : instance,
      ),
    };
    const refused = synchronizeViewportScene({
      mounts,
      frameMountedContent: () => {
        reframes += 1;
      },
      current: synchronized.scene,
      next: invalid,
    });
    expect(refused.ok).toBe(false);
    expect(mounts.list().map((instance) => instance.instanceId)).toEqual(
      replacement.mountable.instances.map((instance) => instance.instanceId),
    );
    expect(reframes).toBe(2);
    mounts.dispose();
  });

  it("updates the pixels meta only from the real frame, and never imports Electron", () => {
    const viewport = readFileSync(
      join(desktopRoot, "linux/src/renderer/viewport.ts"),
      "utf8",
    );
    expect(viewport).toContain("frame.pixelsDrawn");
    expect(viewport).toContain("PIXELS_META_NAME");
    expect(viewport).toContain("document.addEventListener(DESKTOP_VIEWPORT_PLAY_EVENT");
    expect(viewport).toContain('stage.dataset.playback = "acknowledged"');
    expect(DESKTOP_VIEWPORT_PLAY_EVENT).toBe("sceneaxi:desktop-viewport-play");
    expect(DESKTOP_VIEWPORT_PLAY_EVENT).toBe(SHELL_VIEWPORT_PLAY_EVENT);
    expect(DESKTOP_RARITY_PROPOSAL_EVENT).toBe(SHELL_RARITY_PROPOSAL_EVENT);
    expect(viewport).not.toContain('from "@sceneaxi/desktop-shell"');
    expect(viewport).not.toMatch(/from\s+"electron"/);
    // No Three type crosses the seam into this consumer either.
    expect(viewport).not.toMatch(/from\s+"three"/);
    expect(viewport).not.toContain("THREE.");
  });
});

/** The browser payload a successful scene composition serves. */
type ComposedScene = Extract<
  ReturnType<typeof desktopOpenScene>,
  { ok: true }
>["mountable"];
