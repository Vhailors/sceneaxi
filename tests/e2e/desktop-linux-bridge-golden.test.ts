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
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { Window as HappyWindow } from "happy-dom";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  RARITY_PROVIDER_REQUEST_MAX_CHARS,
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
  EDITOR_SHELL_ASSISTANT_MODE_IDS,
  PROPOSAL_KIND,
  PROPOSAL_SCHEMA_VERSION,
  RARITY_NAMESPACE_KIND,
  RARITY_POLICY_KIND,
  RARITY_REFUSE_CODES,
  RARITY_SCHEMA_VERSION,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  type SceneCompositionIntake,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ASSISTANT_RUNTIME_EVENT,
  DESKTOP_PRODUCT_REFUSALS,
  DESKTOP_RARITY_PROPOSAL_EVENT as SHELL_RARITY_PROPOSAL_EVENT,
  DESKTOP_VIEWPORT_PLAY_EVENT as SHELL_VIEWPORT_PLAY_EVENT,
  DESKTOP_VIEWPORT_SCENE_OPEN_EVENT as SHELL_VIEWPORT_SCENE_OPEN_EVENT,
  DESKTOP_VISUAL_REFUSALS,
  type DesktopSnapshot,
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
  DESKTOP_RARITY_PRODUCT_ID,
  DESKTOP_RARITY_PROJECT_SEED,
  DESKTOP_RARITY_PROPOSAL_EVENT,
  DESKTOP_VIEWPORT_PLAY_EVENT,
  DESKTOP_VIEWPORT_SCENE_OPEN_EVENT,
  createDesktopAssistantViewportController,
  createDesktopBridge,
  desktopAssistantScene,
  desktopOpenScene,
  desktopSceneFromDocumentData,
  seedDesktopProject,
  type DesktopAssistantJobSnapshot,
  type DesktopBridgeResponse,
  type DesktopFrameReport,
  type DesktopRarityEvidence,
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
import {
  createDesktopPresentationBackend,
  installAssistantProductFlow,
} from "../../desktop/linux/src/renderer/viewport.ts";
import {
  DESKTOP_ASSISTANT_START_MODES,
  decideAssistantStart,
} from "../../desktop/linux/src/renderer/assistant-start.ts";
import { desktopAssistantRuntimeSignal } from "../../desktop/linux/src/renderer/assistant-runtime.ts";
import {
  assistantInspectionText,
  assistantRarityInvalidation,
  assistantRarityResultDigest,
  assistantRarityResultEvent,
  assistantRarityResultSettlement,
  assistantRaritySettlement,
  rarityInvalidationMatches,
} from "../../desktop/linux/src/renderer/assistant-inspection.ts";
import { formatSafeRarityEvidence } from "@sceneaxi/authoring-core/rarity-evidence";
import {
  acknowledgeAssistantRaritySettlement,
  pollAssistantJob,
  watchAssistantRaritySettlement,
} from "../../desktop/linux/src/renderer/assistant-poll.ts";
import {
  pixelsMetaContent,
  playableExercise,
} from "../../desktop/linux/src/renderer/playback-report.ts";
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
  it("preserves an existing composed document without adding rarity identity", () => {
    const dir = authoringDir("existing-composed-scene");
    const before = readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    expect(seedDesktopProject(dir)).toEqual({ ok: true, migrated: false });
    expect(readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(before);
  });

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
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-game",
        prompt: "Never finishes",
      },
    });
    expect(started.ok).toBe(true);
    if (!started.ok || started.data === null) return;
    const jobId = (started.data as DesktopAssistantJobSnapshot).jobId;
    reportProgress?.({ phase: "waiting-provider", percent: 20, message: "Waiting" });
    expect(
      bridge.handle({
        action: "assistant",
        payload: { op: "abandon" },
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_BRIDGE_REFUSALS.requestMalformed,
    });
    expect(
      bridge.handle({ action: "assistant", payload: { op: "status" } }),
    ).toMatchObject({ ok: true, data: { jobId, status: "running" } });
    const abandoned = bridge.handle({
      action: "assistant",
      payload: { op: "abandon", jobId },
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

  it("opens the composed scene when rarity has no accepted roll", () => {
    const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-preroll-"));
    tmpDirs.push(dir);
    const document = createDocument({
      id: "scene",
      data: {
        ...activeDocumentData("pre-roll-scene"),
        productId: DESKTOP_RARITY_PRODUCT_ID,
        seed: DESKTOP_RARITY_PROJECT_SEED,
        rarity: {
          schemaVersion: RARITY_SCHEMA_VERSION,
          kind: RARITY_NAMESPACE_KIND,
          policy: {
            schemaVersion: RARITY_SCHEMA_VERSION,
            kind: RARITY_POLICY_KIND,
            tierWeights: { common: 1, uncommon: 1, rare: 1, epic: 1, legendary: 1 },
          },
          rolls: [],
        },
      },
    });
    const written = writeDocumentFile(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), document, {
      cwd: dir,
    });
    if (!written.ok) throw new Error("pre-roll desktop document refused");

    const response = bridgeAt(dir).handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data).toMatchObject({
      bootstrap: { kind: "scene", subjectId: "pre-roll-scene" },
      closed: true,
    });
    expect(response.data).not.toHaveProperty("rarity");
    expect(response.data).not.toHaveProperty("raritySession");
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
    const accept = new FakeElement("change-accept", { action: "change-accept" });
    const reject = new FakeElement("change-reject", { action: "change-reject" });
    const reload = new FakeElement("document-reload", { action: "document-reload" });
    const openRecent = new FakeElement("project-open-recent", { action: "project-open-recent" });
    const removeRecent = new FakeElement("project-remove-recent", {
      action: "project-remove-recent",
    });
    const undo = new FakeElement("edit-undo", { command: "edit-undo" });
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
        ["[data-command]", [play, undo]],
        ["[data-product-action]", [accept, reject, reload, openRecent, removeRecent]],
        ["#project-recent-select", [recentSelect]],
        ["[data-run-session-report]", [runSession]],
        ["[data-run-live-report]", [runLive]],
        ["[data-run-rarity-evidence]", [runEvidence]],
        [".dock-tab", [changesTab, evidenceTab]],
        ["[data-dock-panel]", [changesPanel, evidencePanel]],
      ]),
    );
    const documentListeners = new Map<string, (event: { readonly detail?: unknown }) => void>();
    const dispatchedEvents: Array<{ readonly type: string; readonly detail?: unknown }> = [];
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
          dispatchedEvents.push(event);
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
      shell, accept, reject, reload, openRecent, removeRecent, recentSelect, play, undo,
      runSession, runLive,
      runEvidence, proposal, empty, documentPath,
      contentHash, diff, reviewEvidence, evidence, evidenceEmpty, projectState, status,
      fileStatus, badge, changesTab, evidenceTab, changesPanel, evidencePanel,
      documentListeners, dispatchedEvents,
    };
  }

  it("reports runtime absence, request failure, and in-flight product state through mounted chrome", async () => {
    const absent = mountRarityChrome();
    absent.shell.clickListener?.({ target: absent.reload });
    await vi.waitFor(() => {
      expect(absent.status.textContent).toContain(DESKTOP_PRODUCT_REFUSALS.runtimeUnavailable);
    });

    const failed = mountRarityChrome({
      request: () => Promise.reject(new Error("ipc channel closed")),
    });
    failed.shell.clickListener?.({ target: failed.reload });
    await vi.waitFor(() => {
      expect(failed.status.textContent).toContain(DESKTOP_PRODUCT_REFUSALS.runtimeRequestFailed);
    });

    let resolveRequest: ((response: unknown) => void) | undefined;
    const pending = mountRarityChrome({
      request: () => new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    });
    pending.shell.clickListener?.({ target: pending.reload });
    expect(pending.reload.dataset.busy).toBe("true");
    expect(pending.reload.getAttribute("aria-describedby")).toBe(
      `refusal-${DESKTOP_PRODUCT_REFUSALS.requestInFlight}`,
    );
    await vi.waitFor(() => expect(resolveRequest).toBeTypeOf("function"));
    resolveRequest?.({ ok: false, reason: "DESKTOP_TEST_DONE", message: "done" });
    await vi.waitFor(() => {
      expect(pending.reload.dataset.busy).toBeUndefined();
    });
  });

  const RARITY_EVIDENCE_FIXTURE: DesktopRarityEvidence = Object.freeze({
    eventId: "wayfinder-drop-001",
    tier: "uncommon",
    candidateId: "wayfinder-copper",
    scope: "desktop-linux-rarity",
    algorithmId: "sceneaxi.rarity.weighted-sha256-v1",
    projectSeed: 20260809,
    policyDigest: `sha256:${"1".repeat(64)}`,
    requestDigest: `sha256:${"2".repeat(64)}`,
    outcomeDigest: `sha256:${"3".repeat(64)}`,
    provenanceDigest: `sha256:${"4".repeat(64)}`,
    providerEvidenceDigest: `sha256:${"e".repeat(64)}`,
    namespaceDigest: `sha256:${"5".repeat(64)}`,
    tierRollDigest: `sha256:${"6".repeat(64)}`,
    candidateRollDigest: `sha256:${"7".repeat(64)}`,
    tierDraw: 69,
    tierTotalWeight: 100,
    candidateDraw: 2,
    candidateTotalWeight: 5,
    providerEvidence: {
      schemaVersion: 1,
      kind: "sceneaxi.model-provider-call-evidence",
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model: {
        provider: "sceneaxi-fixture",
        model: "wayfinder-rarity-fixture",
        quantization: "deterministic-json",
        version: "2026-08-09",
      },
    },
  } satisfies DesktopRarityEvidence);

  const RARITY_REPLAY_DIGEST = `sha256:${"a".repeat(64)}`;
  const RARITY_PRODUCT_SESSION = Object.freeze({
    bootstrap: Object.freeze({
      kind: "product",
      subjectId: "desktop-linux-rarity",
      sessionId: `sha256:${"b".repeat(64)}`,
      openedAtMs: FIXED_NOW_MS,
      resumed: false,
      kernelVersion: "0.0.0",
      bomVersion: "0.0.0",
    }),
    initialDigest: `sha256:${"c".repeat(64)}`,
    tickDigests: Object.freeze([`sha256:${"d".repeat(64)}`, RARITY_REPLAY_DIGEST]),
    replayDigest: RARITY_REPLAY_DIGEST,
  });

  const RARITY_PROPOSAL_SNAPSHOT: DesktopSnapshot = Object.freeze({
    phase: "reviewing",
    proposal: {
      schemaVersion: PROPOSAL_SCHEMA_VERSION,
      kind: PROPOSAL_KIND,
      edits: [{
        documentPath: "scene.json",
        baseContentHash: `sha256:${"0".repeat(64)}`,
        jsonPointer: "/data",
        oldValue: {},
        newValue: {},
      }],
      diffs: [{ documentPath: "scene.json", unifiedDiff: "--- scene.json" }],
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
    expect(reviewEvidence.textContent).toContain(
      `provenance ${RARITY_EVIDENCE_FIXTURE.provenanceDigest}`,
    );
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

    expect(evidence.textContent).toContain(
      `provenance ${RARITY_EVIDENCE_FIXTURE.provenanceDigest}`,
    );
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
  const rejectingPort = (rarityEvidence?: DesktopRarityEvidence) => {
    const rejected = {
      phase: "rejected",
      proposal: null,
      unifiedDiff: null,
      renderedDiff: null,
      appliedPaths: null,
      journalRecoveryPending: false,
      transactionId: null,
      diagnostics: [],
      ...(rarityEvidence === undefined ? {} : { rarityEvidence }),
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
    expect(evidence.textContent).toContain(
      `provenance ${RARITY_EVIDENCE_FIXTURE.provenanceDigest}`,
    );
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
    expect(evidence.textContent).toContain(
      `provenance ${RARITY_EVIDENCE_FIXTURE.provenanceDigest}`,
    );
    expect(evidence.hidden).toBe(false);
    expect(evidenceEmpty.hidden).toBe(true);
    // The run itself carried no rarity, so its own report must not claim one.
    expect(runSession.textContent).not.toContain("rarity uncommon");
  });

  it("keeps staged evidence in the dock while Play reports accepted evidence", async () => {
    const stagedEvidence = Object.freeze({
      ...RARITY_EVIDENCE_FIXTURE,
      eventId: "wayfinder-drop-002",
      candidateId: "wayfinder-silver",
      provenanceDigest: `sha256:${"8".repeat(64)}`,
      namespaceDigest: `sha256:${"9".repeat(64)}`,
    });
    const openPath = {
      closed: true,
      initialDigest: "sha256:initial",
      tickDigests: ["sha256:tick"],
      instanceCount: 1,
      mountable: { sceneId: "desktop-scene" },
      rarity: RARITY_EVIDENCE_FIXTURE,
      raritySession: RARITY_PRODUCT_SESSION,
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
                    contentHash: "sha256:accepted",
                    data: { rarity: { kind: "sceneaxi.rarity.namespace" } },
                    rarityNamespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
                    acceptedRarityEvidence: RARITY_EVIDENCE_FIXTURE,
                    undoAvailability: "unavailable",
                  },
                }
              : { ok: false, reason: "DESKTOP_TEST_NO_RUNTIME", message: "no runtime" },
        ),
    };
    const {
      shell, play, reload, status, evidence, runEvidence, documentListeners,
    } = mountRarityChrome(port);
    documentListeners.set(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
      const detail = event.detail as { accepted: boolean; frame: number | null };
      detail.accepted = true;
      detail.frame = 1;
    });

    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("· open ·");
    });
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        replayed: false,
        evidence: stagedEvidence,
        snapshot: { ...RARITY_PROPOSAL_SNAPSHOT, rarityEvidence: stagedEvidence },
      },
    });
    expect(evidence.textContent).toContain("wayfinder-silver");

    shell.clickListener?.({ target: play });
    await vi.waitFor(() => {
      expect(runEvidence.hidden).toBe(false);
    });
    expect(runEvidence.textContent).toContain("wayfinder-copper");
    expect(evidence.textContent).toContain("wayfinder-silver");
    expect(evidence.textContent).not.toContain("wayfinder-copper");
  });

  it("renders the run's full safe provenance through the shared formatter", async () => {
    const openPath = {
      closed: true,
      initialDigest: "sha256:initial",
      tickDigests: ["sha256:tick"],
      instanceCount: 1,
      mountable: { sceneId: "desktop-scene" },
      rarity: RARITY_EVIDENCE_FIXTURE,
      raritySession: RARITY_PRODUCT_SESSION,
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
    expect(runEvidence.textContent).toContain(
      `namespace ${RARITY_EVIDENCE_FIXTURE.namespaceDigest}`,
    );
    expect(runEvidence.textContent).toContain(
      "provider sceneaxi-fixture · model wayfinder-rarity-fixture",
    );
    // The rarity product session is named, and the run report line claims none of
    // the rarity facts as its own.
    expect(runEvidence.textContent).toContain(
      `verified in a separate product session ${RARITY_PRODUCT_SESSION.bootstrap.subjectId}`,
    );
    expect(runEvidence.textContent).toContain(`replayed to ${RARITY_REPLAY_DIGEST}`);
    expect(runSession.textContent).toContain("terminal digest sha256:tick");
    expect(runSession.textContent).not.toContain("rarity");
  });

  it("refuses malformed numeric evidence and owns product-session attribution", () => {
    const withSession = formatSafeRarityEvidence(
      RARITY_EVIDENCE_FIXTURE,
      RARITY_PRODUCT_SESSION,
    );
    expect(withSession).toContain(
      `verified in a separate product session ${RARITY_PRODUCT_SESSION.bootstrap.subjectId}`,
    );
    expect(withSession).toContain(`replayed to ${RARITY_REPLAY_DIGEST}`);
    for (const [field, value] of [
      ["projectSeed", undefined],
      ["tierDraw", -1],
      ["tierDraw", 1.5],
      ["tierTotalWeight", 0],
      ["candidateDraw", 5],
      ["candidateTotalWeight", Number.NaN],
    ] as const) {
      expect(
        formatSafeRarityEvidence({ ...RARITY_EVIDENCE_FIXTURE, [field]: value }),
        field,
      ).toBeNull();
    }
    for (const malformed of [
      { ...RARITY_EVIDENCE_FIXTURE, eventId: "Invalid event" },
      { ...RARITY_EVIDENCE_FIXTURE, eventId: "valid-event\n" },
      { ...RARITY_EVIDENCE_FIXTURE, tier: "mythic" },
      { ...RARITY_EVIDENCE_FIXTURE, algorithmId: "other-algorithm" },
      { ...RARITY_EVIDENCE_FIXTURE, namespaceDigest: "sha256:short" },
      { ...RARITY_EVIDENCE_FIXTURE, providerEvidenceDigest: "sha256:short" },
      {
        ...RARITY_EVIDENCE_FIXTURE,
        providerEvidenceDigest: `${RARITY_EVIDENCE_FIXTURE.providerEvidenceDigest}\n`,
      },
      {
        ...RARITY_EVIDENCE_FIXTURE,
        providerEvidence: {
          ...RARITY_EVIDENCE_FIXTURE.providerEvidence,
          profile: "@sceneaxi/profile-kids",
        },
      },
      {
        ...RARITY_EVIDENCE_FIXTURE,
        providerEvidence: {
          ...RARITY_EVIDENCE_FIXTURE.providerEvidence,
          model: {
            ...RARITY_EVIDENCE_FIXTURE.providerEvidence.model,
            model: "wayfinder\nraw-detail",
          },
        },
      },
      {
        ...RARITY_EVIDENCE_FIXTURE,
        providerEvidence: {
          ...RARITY_EVIDENCE_FIXTURE.providerEvidence,
          model: {
            ...RARITY_EVIDENCE_FIXTURE.providerEvidence.model,
            provider: "sceneaxi-fixture\n",
          },
        },
      },
      {
        ...RARITY_EVIDENCE_FIXTURE,
        providerEvidence: {
          ...RARITY_EVIDENCE_FIXTURE.providerEvidence,
          model: {
            ...RARITY_EVIDENCE_FIXTURE.providerEvidence.model,
            provider: "sk_live_fixture",
          },
        },
      },
      {
        ...RARITY_EVIDENCE_FIXTURE,
        providerEvidence: {
          ...RARITY_EVIDENCE_FIXTURE.providerEvidence,
          model: {
            ...RARITY_EVIDENCE_FIXTURE.providerEvidence.model,
            provider: "whsec_abcdefgh",
          },
        },
      },
      {
        ...RARITY_EVIDENCE_FIXTURE,
        providerEvidence: {
          ...RARITY_EVIDENCE_FIXTURE.providerEvidence,
          model: {
            ...RARITY_EVIDENCE_FIXTURE.providerEvidence.model,
            provider: "xoxb-12345678-abcdefghijklmnop",
          },
        },
      },
      {
        ...RARITY_EVIDENCE_FIXTURE,
        providerEvidence: {
          ...RARITY_EVIDENCE_FIXTURE.providerEvidence,
          model: {
            ...RARITY_EVIDENCE_FIXTURE.providerEvidence.model,
            version: "v".repeat(129),
          },
        },
      },
    ]) {
      expect(formatSafeRarityEvidence(malformed)).toBeNull();
    }
    expect(
      formatSafeRarityEvidence(RARITY_EVIDENCE_FIXTURE, {
        replayDigest: RARITY_REPLAY_DIGEST,
      }),
    ).toBeNull();
    expect(
      formatSafeRarityEvidence(RARITY_EVIDENCE_FIXTURE, {
        ...RARITY_PRODUCT_SESSION,
        replayDigest: `sha256:${"e".repeat(64)}`,
      }),
    ).toBeNull();
  });

  it("updates Assistant output when its rarity proposal settles", () => {
    expect(
      assistantRaritySettlement(RARITY_EVIDENCE_FIXTURE.namespaceDigest, {
        settled: "applied",
        evidence: RARITY_EVIDENCE_FIXTURE,
      }),
    ).toMatchObject({
      activeNamespaceDigest: null,
      evidenceVisible: true,
      evidenceText: expect.stringContaining(
        `namespace ${RARITY_EVIDENCE_FIXTURE.namespaceDigest}`,
      ),
      status: expect.stringContaining("accepted"),
    });
    expect(
      assistantRaritySettlement(RARITY_EVIDENCE_FIXTURE.namespaceDigest, {
        settled: "rejected",
        evidence: RARITY_EVIDENCE_FIXTURE,
      }),
    ).toEqual({
      activeNamespaceDigest: null,
      evidenceText: "",
      evidenceVisible: false,
      status: "Rarity proposal rejected · project bytes and kernel state unchanged.",
    });
    expect(
      assistantRaritySettlement(`sha256:${"f".repeat(64)}`, {
        settled: "rejected",
        evidence: RARITY_EVIDENCE_FIXTURE,
      }),
    ).toBeNull();
    const invalidation = {
      invalidated: true,
      namespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
    };
    expect(
      assistantRarityInvalidation(RARITY_EVIDENCE_FIXTURE.namespaceDigest, invalidation),
    ).toMatchObject({
      activeNamespaceDigest: null,
      evidenceVisible: false,
      status: expect.stringContaining("retired"),
    });
    expect(
      rarityInvalidationMatches(RARITY_EVIDENCE_FIXTURE.namespaceDigest, invalidation),
    ).toBe(true);
    expect(rarityInvalidationMatches(`sha256:${"f".repeat(64)}`, invalidation)).toBe(false);
  });

  it("associates settlement only with the displayed rarity result", () => {
    const staged = {
      ok: true as const,
      kind: "rarity-proposal" as const,
      replayed: false,
      evidence: RARITY_EVIDENCE_FIXTURE,
    };
    expect(assistantRarityResultDigest(staged)).toBe(
      RARITY_EVIDENCE_FIXTURE.namespaceDigest,
    );
    expect(assistantRarityResultDigest({ ...staged, replayed: true })).toBeNull();
    const rejected = {
      ...staged,
      authoring: {
        ...RARITY_PROPOSAL_SNAPSHOT,
        phase: "rejected" as const,
        rarityEvidence: RARITY_EVIDENCE_FIXTURE,
      },
    };
    expect(assistantRarityResultDigest(rejected)).toBeNull();
    expect(assistantRarityResultSettlement(rejected)).toMatchObject({
      evidenceVisible: false,
      status: expect.stringContaining("rejected"),
    });
    const applied = {
      ...staged,
      authoring: {
        ...RARITY_PROPOSAL_SNAPSHOT,
        phase: "applied" as const,
        rarityEvidence: RARITY_EVIDENCE_FIXTURE,
      },
    };
    expect(assistantRarityResultDigest(applied)).toBeNull();
    expect(assistantRarityResultSettlement(applied)).toMatchObject({
      evidenceVisible: true,
      status: expect.stringContaining("accepted"),
    });
    const retired = { ...applied, retirement: { reason: "undo" as const } };
    expect(assistantRarityResultDigest(retired)).toBeNull();
    expect(assistantRarityResultSettlement(retired)).toMatchObject({
      evidenceVisible: false,
      status: expect.stringContaining("Undo"),
    });
    expect(assistantRarityResultEvent(applied)).toMatchObject({
      settled: "applied",
      refreshAuthoring: true,
      evidence: RARITY_EVIDENCE_FIXTURE,
    });
    expect(
      assistantRarityResultEvent({
        ...staged,
        retirement: { reason: "session-restarted" as const },
      }),
    ).toEqual({
      retired: "session-restarted",
      refreshAuthoring: true,
      evidence: RARITY_EVIDENCE_FIXTURE,
    });
    expect(assistantRarityResultDigest(null)).toBeNull();
    expect(
      assistantRarityResultDigest({
        ok: true,
        artifactDigest: `sha256:${"a".repeat(64)}`,
        mountable: { instances: [] },
      } as unknown as DesktopAssistantJobSnapshot["result"]),
    ).toBeNull();
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
    expect(evidence.textContent).toContain(
      `provenance ${RARITY_EVIDENCE_FIXTURE.provenanceDigest}`,
    );

    recentSelect.value = "/tmp/project-b";
    shell.clickListener?.({ target: openRecent });
    await vi.waitFor(() => {
      expect(evidence.hidden).toBe(true);
    });
    expect(evidence.textContent).toBe("");
    expect(evidenceEmpty.hidden).toBe(false);
  });

  it("keeps rarity evidence when Remove Recent leaves the active project bound", async () => {
    const lifecycleStatus = {
      recents: [],
      active: { name: "project-a", root: "/tmp/project-a", documentPath: "scene.json" },
    };
    const port = {
      request: () =>
        Promise.resolve({ ok: false, reason: "DESKTOP_TEST_NO_RUNTIME", message: "no runtime" }),
      project: () =>
        Promise.resolve({ ok: true, data: { status: lifecycleStatus, outcome: "removed" } }),
    };
    const { shell, removeRecent, recentSelect, status, evidence, evidenceEmpty, documentListeners } =
      mountRarityChrome(port);

    // The chrome syncs project lifecycle on load; let that settle so the status
    // this test reads is the one its own click produced.
    await vi.waitFor(() => {
      expect(status.textContent).toContain("Open refused");
    });
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: { replayed: true, snapshot: null, evidence: RARITY_EVIDENCE_FIXTURE },
    });
    expect(evidence.hidden).toBe(false);

    recentSelect.value = "/tmp/project-b";
    shell.clickListener?.({ target: removeRecent });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("Recent project removed");
    });
    // Forgetting a recent entry binds nothing, so the bound project's own
    // provenance is still exactly as real as it was.
    expect(evidence.hidden).toBe(false);
    expect(evidence.textContent).toContain(
      `provenance ${RARITY_EVIDENCE_FIXTURE.provenanceDigest}`,
    );
    expect(evidenceEmpty.hidden).toBe(true);
  });

  it("keeps rarity evidence when Undo reverts an unrelated Save", async () => {
    // The reopened document still carries the accepted namespace, so the dock's
    // provenance still describes real bytes and the empty state would be false.
    const port = {
      request: (request: { readonly payload?: { readonly op?: string } }) =>
        Promise.resolve(
          request.payload?.op === "undo"
            ? { ok: true, action: "authoring", data: { ok: true, restoredPaths: ["scene.json"] } }
            : request.payload?.op === "status"
              ? {
                  ok: true,
                  action: "authoring",
                  data: {
                    ok: true,
                    documentId: "scene",
                    contentHash: "sha256:base",
                    data: { rarity: { kind: "sceneaxi.rarity.namespace" } },
                    rarityNamespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
                    acceptedRarityEvidence: RARITY_EVIDENCE_FIXTURE,
                    undoAvailability: "available",
                  },
                }
              : { ok: false, reason: "DESKTOP_TEST_NO_RUNTIME", message: "no runtime" },
        ),
    };
    const { shell, reload, undo, status, evidence, evidenceEmpty, documentListeners } =
      mountRarityChrome(port);

    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("· open ·");
    });
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: { replayed: true, snapshot: null, evidence: RARITY_EVIDENCE_FIXTURE },
    });
    expect(evidence.hidden).toBe(false);

    shell.clickListener?.({ target: undo });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("Undid last Save");
    });
    expect(evidence.hidden).toBe(false);
    expect(evidence.textContent).toContain(
      `provenance ${RARITY_EVIDENCE_FIXTURE.provenanceDigest}`,
    );
    expect(evidenceEmpty.hidden).toBe(true);
  });

  it("reconciles displayed evidence to the namespace returned by Reload", async () => {
    const replacement = Object.freeze({
      ...RARITY_EVIDENCE_FIXTURE,
      candidateId: "wayfinder-silver",
      namespaceDigest: `sha256:${"8".repeat(64)}`,
      provenanceDigest: `sha256:${"9".repeat(64)}`,
    });
    const port = {
      request: () =>
        Promise.resolve({
          ok: true,
          action: "authoring",
          data: {
            ok: true,
            documentId: "scene",
            contentHash: "sha256:replacement",
            data: { rarity: { kind: "sceneaxi.rarity.namespace" } },
            rarityNamespaceDigest: replacement.namespaceDigest,
            acceptedRarityEvidence: replacement,
            undoAvailability: "unavailable",
          },
        }),
    };
    const { shell, reload, status, evidence, documentListeners } = mountRarityChrome(port);
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: { replayed: true, snapshot: null, evidence: RARITY_EVIDENCE_FIXTURE },
    });
    expect(evidence.textContent).toContain("wayfinder-copper");

    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("· open ·");
      expect(evidence.textContent).toContain("wayfinder-silver");
    });
    expect(evidence.textContent).toContain(`namespace ${replacement.namespaceDigest}`);
    expect(evidence.textContent).not.toContain("wayfinder-copper");
  });

  it("reconciles each rarity presentation surface to accepted provenance", async () => {
    const replacement = Object.freeze({
      ...RARITY_EVIDENCE_FIXTURE,
      candidateId: "wayfinder-silver",
      namespaceDigest: `sha256:${"8".repeat(64)}`,
      provenanceDigest: `sha256:${"9".repeat(64)}`,
    });
    let acceptedEvidence = RARITY_EVIDENCE_FIXTURE;
    const port = {
      request: (request: { readonly action?: string }) =>
        Promise.resolve(
          request.action === "open-path"
            ? {
                ok: true,
                action: "open-path",
                data: {
                  closed: true,
                  initialDigest: "sha256:initial",
                  tickDigests: ["sha256:tick"],
                  instanceCount: 1,
                  mountable: { sceneId: "desktop-scene" },
                  rarity: RARITY_EVIDENCE_FIXTURE,
                  raritySession: RARITY_PRODUCT_SESSION,
                },
              }
            : {
                ok: true,
                action: "authoring",
                data: {
                  ok: true,
                  documentId: "scene",
                  contentHash: "sha256:accepted",
                  data: { rarity: { kind: "sceneaxi.rarity.namespace" } },
                  rarityNamespaceDigest: acceptedEvidence.namespaceDigest,
                  acceptedRarityEvidence: acceptedEvidence,
                  undoAvailability: "unavailable",
                },
              },
        ),
    };
    const {
      shell, reload, play, evidence, runEvidence, status,
      documentListeners, dispatchedEvents,
    } = mountRarityChrome(port);
    documentListeners.set(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
      const detail = event.detail as { accepted: boolean; frame: number | null };
      detail.accepted = true;
      detail.frame = 1;
    });

    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("· open ·");
    });
    shell.clickListener?.({ target: play });
    await vi.waitFor(() => {
      expect(runEvidence.textContent).toContain("wayfinder-copper");
    });
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: { replayed: true, snapshot: null, evidence: replacement },
    });
    expect(evidence.textContent).toContain("wayfinder-silver");

    const firstInvalidation = dispatchedEvents.length;
    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(evidence.textContent).toContain("wayfinder-copper");
    });
    expect(runEvidence.textContent).toContain("wayfinder-copper");
    expect(dispatchedEvents.slice(firstInvalidation)).toContainEqual({
      type: DESKTOP_RARITY_PROPOSAL_EVENT,
      detail: { invalidated: true, namespaceDigest: replacement.namespaceDigest },
    });
    expect(dispatchedEvents.slice(firstInvalidation)).not.toContainEqual({
      type: DESKTOP_RARITY_PROPOSAL_EVENT,
      detail: { invalidated: true, namespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest },
    });

    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: { replayed: true, snapshot: null, evidence: replacement },
    });
    acceptedEvidence = replacement;
    const secondInvalidation = dispatchedEvents.length;
    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(evidence.textContent).toContain("wayfinder-silver");
      expect(runEvidence.hidden).toBe(true);
    });
    expect(runEvidence.textContent).toBe("");
    expect(dispatchedEvents.slice(secondInvalidation)).toContainEqual({
      type: DESKTOP_RARITY_PROPOSAL_EVENT,
      detail: {
        invalidated: true,
        namespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
      },
    });
    expect(dispatchedEvents.slice(secondInvalidation)).not.toContainEqual({
      type: DESKTOP_RARITY_PROPOSAL_EVENT,
      detail: { invalidated: true, namespaceDigest: replacement.namespaceDigest },
    });
  });

  it.each([
    "document-not-found",
    RARITY_REFUSE_CODES.outcomeMismatch,
  ])("retires displayed evidence when Reload proves %s", async (diagnosticCode) => {
    let statusReads = 0;
    const port = {
      request: (request: { readonly action?: string; readonly payload?: { readonly op?: string } }) => {
        if (request.action === "open-path") {
          return Promise.resolve({
            ok: true,
            action: "open-path",
            data: {
              closed: true,
              initialDigest: "sha256:initial",
              tickDigests: ["sha256:tick"],
              instanceCount: 1,
              mountable: { sceneId: "desktop-scene" },
              rarity: RARITY_EVIDENCE_FIXTURE,
              raritySession: RARITY_PRODUCT_SESSION,
            },
          });
        }
        statusReads += 1;
        return Promise.resolve(statusReads === 1
          ? {
              ok: true,
              action: "authoring",
              data: {
                ok: true,
                documentId: "scene",
                contentHash: "sha256:accepted",
                data: { rarity: { kind: "sceneaxi.rarity.namespace" } },
                rarityNamespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
                acceptedRarityEvidence: RARITY_EVIDENCE_FIXTURE,
                undoAvailability: "unavailable",
              },
            }
          : {
              ok: true,
              action: "authoring",
              data: {
                ok: false,
                diagnostics: [{ code: diagnosticCode, message: "accepted rarity is unavailable" }],
              },
            });
      },
    };
    const {
      shell, reload, play, status, evidence, evidenceEmpty, runEvidence,
      documentListeners, dispatchedEvents,
    } =
      mountRarityChrome(port);
    documentListeners.set(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
      const detail = event.detail as { accepted: boolean; frame: number | null };
      detail.accepted = true;
      detail.frame = 1;
    });

    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("· open ·");
    });
    shell.clickListener?.({ target: play });
    await vi.waitFor(() => {
      expect(runEvidence.hidden).toBe(false);
    });
    expect(evidence.hidden).toBe(false);

    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain(`Open refused · ${diagnosticCode}`);
    });
    expect(evidence.hidden).toBe(true);
    expect(evidence.textContent).toBe("");
    expect(evidenceEmpty.hidden).toBe(false);
    expect(runEvidence.hidden).toBe(true);
    expect(runEvidence.textContent).toBe("");
    expect(dispatchedEvents).toContainEqual({
      type: DESKTOP_RARITY_PROPOSAL_EVENT,
      detail: {
        invalidated: true,
        namespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
      },
    });
  });

  it("retains displayed evidence when Reload cannot read the document", async () => {
    const port = {
      request: () =>
        Promise.resolve({
          ok: true,
          action: "authoring",
          data: {
            ok: false,
            diagnostics: [{ code: "document-read-failed", message: "scene.json is unreadable" }],
          },
        }),
    };
    const { shell, reload, status, evidence, documentListeners, dispatchedEvents } =
      mountRarityChrome(port);
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: { replayed: true, snapshot: null, evidence: RARITY_EVIDENCE_FIXTURE },
    });

    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("Open refused · document-read-failed");
    });
    expect(evidence.hidden).toBe(false);
    expect(evidence.textContent).toContain(RARITY_EVIDENCE_FIXTURE.namespaceDigest);
    expect(dispatchedEvents).not.toContainEqual({
      type: DESKTOP_RARITY_PROPOSAL_EVENT,
      detail: {
        invalidated: true,
        namespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
      },
    });
  });

  it("retains accepted evidence through unreadable recovery restart", async () => {
    const pending = {
      ...RARITY_PROPOSAL_SNAPSHOT,
      phase: "pending",
      journalRecoveryPending: true,
      transactionId: "tx-recovery",
      diagnostics: [{ code: "journal-write-failed", message: "recovery required" }],
    };
    const port = {
      request: (request: { readonly payload?: { readonly op?: string } }) =>
        Promise.resolve(
          request.payload?.op === "accept"
            ? { ok: true, action: "authoring", data: pending }
            : request.payload?.op === "restart"
              ? {
                  ok: true,
                  action: "authoring",
                  data: {
                    ok: false,
                    diagnostics: [
                      { code: "document-read-failed", message: "scene.json is unreadable" },
                    ],
                  },
                }
              : { ok: false, reason: "DESKTOP_TEST_NO_RUNTIME", message: "no runtime" },
        ),
    };
    const {
      shell, accept, reload, status, evidence,
      documentListeners, dispatchedEvents,
    } =
      mountRarityChrome(port);
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: { replayed: true, snapshot: null, evidence: RARITY_EVIDENCE_FIXTURE },
    });
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        replayed: false,
        evidence: RARITY_EVIDENCE_FIXTURE,
        snapshot: { ...RARITY_PROPOSAL_SNAPSHOT, renderedDiff: "translation.x: 0 → 3" },
      },
    });

    shell.clickListener?.({ target: accept });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("recovery pending");
    });
    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("Recovery reset · recovery-pending");
      expect(status.textContent).toContain("document-read-failed");
    });
    expect(evidence.hidden).toBe(false);
    expect(evidence.textContent).toContain(RARITY_EVIDENCE_FIXTURE.namespaceDigest);
    expect(dispatchedEvents).not.toContainEqual({
      type: DESKTOP_RARITY_PROPOSAL_EVENT,
      detail: {
        invalidated: true,
        namespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
      },
    });
  });

  it("settles and invalidates a staged rarity proposal on recovery restart", async () => {
    const pending = {
      ...RARITY_PROPOSAL_SNAPSHOT,
      phase: "pending",
      journalRecoveryPending: true,
      transactionId: "tx-rarity-recovery",
      diagnostics: [{ code: "journal-write-failed", message: "recovery required" }],
      rarityEvidence: RARITY_EVIDENCE_FIXTURE,
    };
    const port = {
      request: (request: { readonly payload?: { readonly op?: string } }) =>
        Promise.resolve(
          request.payload?.op === "accept"
            ? { ok: true, action: "authoring", data: pending }
            : request.payload?.op === "restart"
              ? {
                  ok: true,
                  action: "authoring",
                  data: {
                    ok: false,
                    diagnostics: [
                      { code: "document-read-failed", message: "scene.json is unreadable" },
                    ],
                  },
                }
              : { ok: false, reason: "DESKTOP_TEST_NO_RUNTIME", message: "no runtime" },
        ),
    };
    const {
      shell, accept, reload, status, evidence, reviewEvidence,
      documentListeners, dispatchedEvents,
    } = mountRarityChrome(port);
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        replayed: false,
        evidence: RARITY_EVIDENCE_FIXTURE,
        snapshot: { ...RARITY_PROPOSAL_SNAPSHOT, rarityEvidence: RARITY_EVIDENCE_FIXTURE },
      },
    });

    shell.clickListener?.({ target: accept });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("recovery pending");
    });
    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("Recovery reset · recovery-pending");
    });
    expect(evidence.hidden).toBe(true);
    expect(reviewEvidence.hidden).toBe(true);
    expect(dispatchedEvents).toContainEqual({
      type: DESKTOP_RARITY_PROPOSAL_EVENT,
      detail: { retired: "session-restarted", evidence: RARITY_EVIDENCE_FIXTURE },
    });
    expect(dispatchedEvents).toContainEqual({
      type: DESKTOP_RARITY_PROPOSAL_EVENT,
      detail: {
        invalidated: true,
        namespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
      },
    });
  });

  it("refreshes mounted chrome after a late local-RPC settlement", async () => {
    const currentProposal = {
      ...RARITY_PROPOSAL_SNAPSHOT,
      proposal: {
        edits: [{ documentPath: "scene.json", baseContentHash: "sha256:accepted" }],
      },
      renderedDiff: "translation.x: 1 → 4",
    };
    let statusReads = 0;
    const port = {
      request: (request: { readonly payload?: { readonly op?: string } }) => {
        if (request.payload?.op !== "status") {
          return Promise.resolve({
            ok: false,
            reason: "DESKTOP_TEST_NO_RUNTIME",
            message: "no runtime",
          });
        }
        statusReads += 1;
        return Promise.resolve({
          ok: true,
          action: "authoring",
          data: {
            ok: true,
            documentId: "scene",
            contentHash: "sha256:accepted",
            data: { rarity: { kind: "sceneaxi.rarity.namespace" } },
            undoAvailability: "available",
            rarityNamespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
            acceptedRarityEvidence: RARITY_EVIDENCE_FIXTURE,
            authoringSnapshot: currentProposal,
          },
        });
      },
    };
    const {
      proposal, diff, evidence, status, projectState, documentListeners,
    } = mountRarityChrome(port);
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        replayed: false,
        evidence: RARITY_EVIDENCE_FIXTURE,
        snapshot: { ...RARITY_PROPOSAL_SNAPSHOT, rarityEvidence: RARITY_EVIDENCE_FIXTURE },
      },
    });

    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        settled: "applied",
        refreshAuthoring: true,
        evidence: RARITY_EVIDENCE_FIXTURE,
      },
    });

    await vi.waitFor(() => {
      expect(statusReads).toBe(1);
      expect(status.textContent).toContain("current proposal restored");
    });
    expect(proposal.hidden).toBe(false);
    expect(diff.textContent).toBe("translation.x: 1 → 4");
    expect(projectState.dataset.projectState).toBe("dirty");
    expect(evidence.hidden).toBe(false);
    expect(evidence.textContent).toContain(RARITY_EVIDENCE_FIXTURE.namespaceDigest);
  });

  it("refreshes every mounted surface after a rarity retirement event", async () => {
    let statusReads = 0;
    const idleSnapshot = {
      ...RARITY_PROPOSAL_SNAPSHOT,
      phase: "idle",
      proposal: null,
      unifiedDiff: "",
      renderedDiff: "",
    };
    const port = {
      request: (request: { readonly action?: string; readonly payload?: { readonly op?: string } }) => {
        if (request.action === "open-path") {
          return Promise.resolve({
            ok: true,
            action: "open-path",
            data: {
              closed: true,
              initialDigest: "sha256:initial",
              tickDigests: ["sha256:tick"],
              instanceCount: 1,
              mountable: { sceneId: "desktop-scene" },
              rarity: RARITY_EVIDENCE_FIXTURE,
              raritySession: RARITY_PRODUCT_SESSION,
            },
          });
        }
        statusReads += 1;
        return Promise.resolve(statusReads === 1
          ? {
              ok: true,
              action: "authoring",
              data: {
                ok: true,
                documentId: "scene",
                contentHash: "sha256:accepted",
                data: { rarity: { kind: "sceneaxi.rarity.namespace" } },
                rarityNamespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
                acceptedRarityEvidence: RARITY_EVIDENCE_FIXTURE,
                undoAvailability: "available",
                authoringSnapshot: idleSnapshot,
              },
            }
          : {
              ok: true,
              action: "authoring",
              data: {
                ok: true,
                documentId: "scene",
                contentHash: "sha256:base",
                data: {},
                rarityNamespaceDigest: null,
                acceptedRarityEvidence: null,
                undoAvailability: "unavailable",
                authoringSnapshot: idleSnapshot,
              },
            });
      },
    };
    const {
      shell, reload, play, proposal, evidence, runEvidence, projectState, status,
      documentListeners, dispatchedEvents,
    } = mountRarityChrome(port);
    documentListeners.set(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
      const detail = event.detail as { accepted: boolean; frame: number | null };
      detail.accepted = true;
      detail.frame = 1;
    });
    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => expect(status.textContent).toContain("· open ·"));
    shell.clickListener?.({ target: play });
    await vi.waitFor(() => expect(runEvidence.hidden).toBe(false));
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        replayed: false,
        evidence: RARITY_EVIDENCE_FIXTURE,
        snapshot: { ...RARITY_PROPOSAL_SNAPSHOT, rarityEvidence: RARITY_EVIDENCE_FIXTURE },
      },
    });
    expect(proposal.hidden).toBe(false);

    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: {
        retired: "undo",
        refreshAuthoring: true,
        evidence: RARITY_EVIDENCE_FIXTURE,
      },
    });
    await vi.waitFor(() => {
      expect(statusReads).toBe(2);
      expect(status.textContent).toContain("authoring state refreshed");
    });
    expect(proposal.hidden).toBe(true);
    expect(evidence.hidden).toBe(true);
    expect(runEvidence.hidden).toBe(true);
    expect(projectState.dataset.projectState).toBe("open");
    expect(dispatchedEvents).toContainEqual({
      type: DESKTOP_RARITY_PROPOSAL_EVENT,
      detail: {
        invalidated: true,
        namespaceDigest: RARITY_EVIDENCE_FIXTURE.namespaceDigest,
      },
    });
  });

  it("retires rarity evidence when Undo takes the accepted namespace back out", async () => {
    const port = {
      request: (request: { readonly payload?: { readonly op?: string } }) =>
        Promise.resolve(
          request.payload?.op === "undo"
            ? { ok: true, action: "authoring", data: { ok: true, restoredPaths: ["scene.json"] } }
            : request.payload?.op === "status"
              ? {
                  ok: true,
                  action: "authoring",
                  data: {
                    ok: true,
                    documentId: "scene",
                    contentHash: "sha256:base",
                    data: {},
                    undoAvailability: "available",
                  },
                }
              : { ok: false, reason: "DESKTOP_TEST_NO_RUNTIME", message: "no runtime" },
        ),
    };
    const { shell, reload, undo, status, evidence, evidenceEmpty, documentListeners } =
      mountRarityChrome(port);

    // Open the project so a completed Save is undoable, then show the accepted
    // provenance the way Play or a staged replay would.
    shell.clickListener?.({ target: reload });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("· open ·");
    });
    documentListeners.get(DESKTOP_RARITY_PROPOSAL_EVENT)?.({
      detail: { replayed: true, snapshot: null, evidence: RARITY_EVIDENCE_FIXTURE },
    });
    expect(evidence.hidden).toBe(false);

    shell.clickListener?.({ target: undo });
    await vi.waitFor(() => {
      expect(status.textContent).toContain("Undid last Save");
    });
    // The Save that wrote the namespace has been reverted, so provenance for it
    // must not stay on screen describing bytes the file no longer holds.
    expect(evidence.hidden).toBe(true);
    expect(evidence.textContent).toBe("");
    expect(evidenceEmpty.hidden).toBe(false);
  });

  it("retires rarity evidence when the rarity proposal itself is rejected", async () => {
    const { reject, shell, evidence, evidenceEmpty, status, documentListeners, dispatchedEvents } =
      mountRarityChrome(rejectingPort(RARITY_EVIDENCE_FIXTURE));

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
    expect(
      dispatchedEvents
        .filter((event) => event.type === DESKTOP_RARITY_PROPOSAL_EVENT)
        .map((event) => {
          const detail = event.detail as Record<string, unknown>;
          return detail["settled"] ?? (detail["invalidated"] === true ? "invalidated" : null);
        }),
    ).toEqual(["rejected", "invalidated"]);
  });
});

describe("desktop renderer behavior", () => {

  // The manipulator seam has two ends that have to agree: the emitted chrome
  // document — a generated public artifact this tier ships — declares the control
  // values, and the renderer's viewport controller is what has to answer them.
  // Asserting the document's own values against the controller's real transforms
  // proves the wiring; reading viewport.ts for the call site would not.
  it("answers every manipulator the emitted chrome document declares", () => {
    const bar = /<div class="assistant-manipulators"[\s\S]*?<\/div>/.exec(
      desktopLinuxIndexHtml(),
    )?.[0];
    expect(bar).toBeDefined();
    const declared = [
      ...(bar ?? "").matchAll(
        /data-action="assistant-manipulator" data-value="([^"]+)"/g,
      ),
    ].map((match) => match[1]);
    expect(declared.length).toBeGreaterThan(0);

    const starter = desktopOpenScene();
    if (!starter.ok) throw new Error(`desktop scene fixture refused: ${starter.reason}`);
    const mounted = starter.composed.scene.instances[0];
    if (mounted === undefined) throw new Error("desktop starter scene has no instance");
    const scene = desktopAssistantScene(mounted.artifact);

    const backend = createThreeSculptPresentationBackend();
    const mounts = createSculptMountApi(backend);
    const controller = createDesktopAssistantViewportController(mounts);
    controller.replace(scene);

    const identity = {
      translation: [0, 0, 0],
      rotationEulerDegrees: [0, 0, 0],
      scale: [1, 1, 1],
    };
    for (const value of declared) {
      const moved = controller.manipulate(value);
      expect(moved, value).not.toBeNull();
      expect(moved?.transform, value).not.toEqual(identity);
      controller.replace(scene);
    }
    // And a value the document does not declare is not silently accepted.
    expect(controller.manipulate("not-a-manipulator")).toBeNull();
  });

  it("abandons a job that never settles and names the timeout", async () => {
    const requests: unknown[] = [];
    const outcome = await pollAssistantJob({
      jobId: "desktop-assistant-1",
      attempts: 3,
      wait: () => Promise.resolve(),
      request: (request) => {
        requests.push(request);
        const abandoning =
          (request as { payload?: { op?: string } }).payload?.op === "abandon";
        if (!abandoning && requests.length === 1) {
          return Promise.reject(new Error("status transport unavailable"));
        }
        if (!abandoning && requests.length === 2) {
          return Promise.resolve({
            ok: false as const,
            reason: "DESKTOP_ASSISTANT_STATUS_UNAVAILABLE",
            message: "The assistant status is temporarily unavailable.",
            detail: null,
          });
        }
        return Promise.resolve({
          ok: true as const,
          action: "assistant" as const,
          data: {
            jobId: "desktop-assistant-1",
            route: "local",
            status: abandoning ? "refused" : "running",
            latestProgress: null,
            progressCount: 0,
            ...(abandoning
              ? {
                  refusal: {
                    ok: false as const,
                    reason: DESKTOP_BRIDGE_REFUSALS.assistantAbandoned,
                    message: "The unresolved assistant job was abandoned.",
                    recoverable: true,
                  },
                }
              : {}),
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
    expect(requests.at(-1)).toEqual({
      action: "assistant",
      payload: { op: "abandon", jobId: "desktop-assistant-1" },
    });
    expect(requests.slice(0, 3)).toEqual(
      Array.from({ length: 3 }, () => ({ action: "assistant", payload: { op: "status" } })),
    );
  });

  it("returns a ready job that wins the abandonment race", async () => {
    const result = {
      ok: true as const,
      kind: "rarity-proposal" as const,
      replayed: false,
      evidence: {},
    };
    const outcome = await pollAssistantJob({
      jobId: "desktop-assistant-1",
      attempts: 1,
      wait: () => Promise.resolve(),
      request: (request) => {
        const abandoning =
          (request as { payload?: { op?: string } }).payload?.op === "abandon";
        return Promise.resolve({
          ok: true as const,
          action: "assistant" as const,
          data: {
            jobId: "desktop-assistant-1",
            route: "local",
            status: abandoning ? "ready" : "running",
            latestProgress: null,
            progressCount: 0,
            ...(abandoning ? { result } : {}),
          },
        });
      },
    });
    expect(outcome).toMatchObject({
      ok: true,
      job: { status: "ready", result },
      result,
    });
  });

  it("does not consume a newer job that wins the abandonment race", async () => {
    const outcome = await pollAssistantJob({
      jobId: "desktop-assistant-1",
      attempts: 1,
      wait: () => Promise.resolve(),
      request: (request) => {
        const abandoning =
          (request as { payload?: { op?: string } }).payload?.op === "abandon";
        return Promise.resolve({
          ok: true as const,
          action: "assistant" as const,
          data: abandoning
            ? {
                jobId: "desktop-assistant-2",
                route: "local",
                status: "running",
                latestProgress: null,
                progressCount: 0,
              }
            : {
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
      reason: DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
      message:
        "The assistant job did not finish in time, and its abandonment could not be confirmed; wait before retrying.",
      retryJobId: "desktop-assistant-1",
    });
  });

  it("keeps a ready rarity job observable until local-RPC settlement", async () => {
    let statusReads = 0;
    const namespaceDigest = `sha256:${"5".repeat(64)}`;
    const evidence = { namespaceDigest } as DesktopRarityEvidence;
    const reviewing = {
      phase: "reviewing" as const,
      proposal: null,
      unifiedDiff: "",
      renderedDiff: "",
      appliedPaths: null,
      journalRecoveryPending: false,
      transactionId: null,
      diagnostics: [],
    };
    const applied = {
      ...reviewing,
      phase: "applied" as const,
      rarityEvidence: evidence,
    };
    const settled = await watchAssistantRaritySettlement({
      jobId: "desktop-assistant-1",
      namespaceDigest,
      active: () => true,
      wait: () => Promise.resolve(),
      request: () => {
        statusReads += 1;
        if (statusReads === 1) return Promise.reject(new Error("transport unavailable"));
        if (statusReads === 2) {
          return Promise.resolve({
            ok: false as const,
            reason: "DESKTOP_ASSISTANT_STATUS_UNAVAILABLE",
            message: "The assistant status is temporarily unavailable.",
            detail: null,
          });
        }
        return Promise.resolve({
          ok: true as const,
          action: "assistant" as const,
          data: {
            jobId: "desktop-assistant-1",
            route: "local" as const,
            status: "ready" as const,
            latestProgress: null,
            progressCount: 0,
            result: {
              ok: true as const,
              kind: "rarity-proposal" as const,
              replayed: false,
              evidence,
              authoring: statusReads === 3
                ? { ...reviewing, rarityEvidence: evidence }
                : applied,
            },
          },
        });
      },
    });
    expect(statusReads).toBe(4);
    expect(settled?.authoring?.phase).toBe("applied");
  });

  it("retries terminal rarity acknowledgement without targeting a newer job", async () => {
    const requests: unknown[] = [];
    let attempts = 0;
    const acknowledged = await acknowledgeAssistantRaritySettlement({
      jobId: "desktop-assistant-1",
      active: () => true,
      wait: () => Promise.resolve(),
      request: (request) => {
        requests.push(request);
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error("transport unavailable"));
        return Promise.resolve({
          ok: true as const,
          action: "assistant" as const,
          data: null,
        });
      },
    });
    expect(acknowledged).toBe(true);
    expect(requests).toEqual([
      {
        action: "assistant",
        payload: { op: "abandon", jobId: "desktop-assistant-1" },
      },
      {
        action: "assistant",
        payload: { op: "abandon", jobId: "desktop-assistant-1" },
      },
    ]);
  });

  it("does not claim Retry is safe when abandonment refuses or cannot be confirmed", async () => {
    const running = {
      ok: true as const,
      action: "assistant" as const,
      data: {
        jobId: "desktop-assistant-1",
        route: "local",
        status: "running",
        latestProgress: null,
        progressCount: 0,
      },
    };
    const refused = await pollAssistantJob({
      jobId: "desktop-assistant-1",
      attempts: 1,
      wait: () => Promise.resolve(),
      request: (request) =>
        Promise.resolve(
          (request as { payload?: { op?: string } }).payload?.op === "abandon"
            ? {
                ok: false as const,
                reason: "DESKTOP_ASSISTANT_ABANDON_DENIED",
                message: "The running job is still owned by another request.",
                detail: null,
              }
            : running,
        ),
    });
    expect(refused).toEqual({
      ok: false,
      reason: "DESKTOP_ASSISTANT_ABANDON_DENIED",
      message: "The running job is still owned by another request.",
      retryJobId: "desktop-assistant-1",
    });

    const rejected = await pollAssistantJob({
      jobId: "desktop-assistant-1",
      attempts: 1,
      wait: () => Promise.resolve(),
      request: (request) =>
        (request as { payload?: { op?: string } }).payload?.op === "abandon"
          ? Promise.reject(new Error("transport unavailable"))
          : Promise.resolve(running),
    });
    expect(rejected).toEqual({
      ok: false,
      reason: DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
      message:
        "The assistant job did not finish in time, and its abandonment could not be confirmed; wait before retrying.",
      retryJobId: "desktop-assistant-1",
    });
  });

  it("adopts a retained assistant job when the renderer initializes", async () => {
    const window = new HappyWindow();
    const backend = createThreeSculptPresentationBackend();
    const mounts = createSculptMountApi(backend);
    try {
      window.document.body.innerHTML = `
        <main class="shell" data-assistant-mode="build" data-assistant-route="local" data-profile="game">
          <textarea id="assistant-prompt">Build a blue crate</textarea>
          <button id="assistant-send" data-action="assistant-send"></button>
          <button id="assistant-retry" data-action="assistant-send" hidden></button>
          <p data-assistant-status></p>
          <pre data-assistant-result hidden></pre>
          <section class="viewport">
            <div data-assistant-manipulators>
              <button data-action="assistant-manipulator" data-value="move-x"></button>
            </div>
          </section>
        </main>
      `;
      vi.stubGlobal("document", window.document);

      let starts = 0;
      const retainedJob: DesktopBridgeResponse = {
        ok: true,
        action: "assistant",
        data: {
          jobId: "desktop-assistant-retained",
          route: "local",
          status: "running",
          latestProgress: null,
          progressCount: 0,
        },
      };
      const port = {
        request: (request: unknown): Promise<DesktopBridgeResponse> => {
          const operation = (request as { payload?: { op?: string } }).payload?.op;
          if (operation === "status") return Promise.resolve(retainedJob);
          if (operation === "start") starts += 1;
          return Promise.reject(new Error("unexpected assistant request"));
        },
      };
      const polledJobIds: string[] = [];
      const pollJob: typeof pollAssistantJob = (input) => {
        polledJobIds.push(input.jobId);
        return Promise.resolve({
          ok: false,
          reason: "DESKTOP_TEST_RECOVERED",
          message: "The retained renderer job was recovered.",
        });
      };
      const stage = window.document.querySelector(".viewport");
      if (stage === null) throw new Error("missing viewport fixture");
      expect(
        installAssistantProductFlow(stage as unknown as Element, port, mounts, backend, pollJob),
      ).toBe(true);
      const status = window.document.querySelector("[data-assistant-status]");
      if (status === null) throw new Error("missing assistant status");

      await vi.waitFor(() => {
        expect(status.textContent).toContain("DESKTOP_TEST_RECOVERED");
      });
      expect(polledJobIds).toEqual(["desktop-assistant-retained"]);
      expect(starts).toBe(0);
    } finally {
      mounts.dispose();
      window.close();
      vi.unstubAllGlobals();
    }
  });

  it("recovers a busy retained job before Retry starts fresh work", async () => {
    const window = new HappyWindow();
    const backend = createThreeSculptPresentationBackend();
    const mounts = createSculptMountApi(backend);
    try {
      window.document.body.innerHTML = `
        <main class="shell" data-assistant-mode="build" data-assistant-route="local" data-profile="game">
          <textarea id="assistant-prompt">Build a blue crate</textarea>
          <button id="assistant-send" data-action="assistant-send"></button>
          <button id="assistant-retry" data-action="assistant-send" hidden></button>
          <p data-assistant-status></p>
          <pre data-assistant-result hidden></pre>
          <section class="viewport">
            <div data-assistant-manipulators>
              <button data-action="assistant-manipulator" data-value="move-x"></button>
            </div>
          </section>
        </main>
      `;
      vi.stubGlobal("document", window.document);

      let starts = 0;
      let statusReads = 0;
      const runningJob = (jobId: string): DesktopBridgeResponse => ({
        ok: true,
        action: "assistant",
        data: {
          jobId,
          route: "local",
          status: "running",
          latestProgress: null,
          progressCount: 0,
        },
      });
      const port = {
        request: (request: unknown): Promise<DesktopBridgeResponse> => {
          const payload = (request as { payload?: { op?: string } }).payload;
          if (payload?.op === "status") {
            statusReads += 1;
            return Promise.resolve(
              statusReads === 1 ? { ok: true, action: "assistant", data: null } :
                runningJob("desktop-assistant-retained"),
            );
          }
          if (payload?.op !== "start") {
            return Promise.reject(new Error("unexpected direct assistant request"));
          }
          starts += 1;
          return Promise.resolve(
            starts === 1
              ? {
                  ok: false,
                  reason: DESKTOP_BRIDGE_REFUSALS.assistantBusy,
                  message: "A retained assistant job is still active.",
                  detail: null,
                }
              : runningJob("desktop-assistant-2"),
          );
        },
      };
      const polledJobIds: string[] = [];
      const pollJob: typeof pollAssistantJob = (input) => {
        polledJobIds.push(input.jobId);
        if (polledJobIds.length === 1) {
          return Promise.resolve({
            ok: false,
            reason: DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
            message: "The first abandonment could not be confirmed.",
            retryJobId: input.jobId,
          });
        }
        if (polledJobIds.length === 2) {
          return Promise.resolve({
            ok: false,
            reason: DESKTOP_BRIDGE_REFUSALS.assistantStatusTimeout,
            message: "The retained job was abandoned.",
          });
        }
        return Promise.resolve({
          ok: false,
          reason: "DESKTOP_TEST_COMPLETE",
          message: "The fresh job completed the test.",
        });
      };
      const stage = window.document.querySelector(".viewport");
      if (stage === null) throw new Error("missing viewport fixture");
      expect(
        installAssistantProductFlow(stage as unknown as Element, port, mounts, backend, pollJob),
      ).toBe(true);

      const send = window.document.querySelector("#assistant-send");
      const retry = window.document.querySelector("#assistant-retry");
      const status = window.document.querySelector("[data-assistant-status]");
      if (send === null || retry === null || status === null) {
        throw new Error("missing assistant fixture controls");
      }

      await vi.waitFor(() => expect(statusReads).toBe(1));
      await Promise.resolve();
      await Promise.resolve();
      send.dispatchEvent(new window.Event("click"));
      await vi.waitFor(() => {
        expect(status.textContent).toContain("abandonment could not be confirmed");
      });
      expect(starts).toBe(1);
      expect(statusReads).toBe(2);
      expect(polledJobIds).toEqual(["desktop-assistant-retained"]);

      retry.dispatchEvent(new window.Event("click"));
      await vi.waitFor(() => {
        expect(status.textContent).toContain(DESKTOP_BRIDGE_REFUSALS.assistantStatusTimeout);
      });
      expect(starts).toBe(1);
      expect(polledJobIds).toEqual([
        "desktop-assistant-retained",
        "desktop-assistant-retained",
      ]);

      retry.dispatchEvent(new window.Event("click"));
      await vi.waitFor(() => {
        expect(status.textContent).toContain("DESKTOP_TEST_COMPLETE");
      });
      expect(starts).toBe(2);
      expect(polledJobIds).toEqual([
        "desktop-assistant-retained",
        "desktop-assistant-retained",
        "desktop-assistant-2",
      ]);
    } finally {
      mounts.dispose();
      window.close();
      vi.unstubAllGlobals();
    }
  });

  it("carries a refused job's redacted reason and detail into one poll outcome", async () => {
    const settled = async (job: unknown) =>
      pollAssistantJob({
        jobId: "j",
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
    expect(DESKTOP_ASSISTANT_START_MODES).toEqual(
      EDITOR_SHELL_ASSISTANT_MODE_IDS.filter((mode) => mode !== "ask"),
    );
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
    const boundedAgent = decideAssistantStart({
      mode: "agent",
      route: "local",
      profile,
      prompt: "x".repeat(RARITY_PROVIDER_REQUEST_MAX_CHARS + 100),
    });
    expect(boundedAgent.ok).toBe(true);
    if (boundedAgent.ok) {
      expect(boundedAgent.payload.prompt).toHaveLength(RARITY_PROVIDER_REQUEST_MAX_CHARS);
    }
    const build = decideAssistantStart({
      mode: "build",
      route: undefined,
      profile,
      prompt: `a crate ${"x".repeat(RARITY_PROVIDER_REQUEST_MAX_CHARS)}`,
    });
    expect(build.ok).toBe(true);
    if (build.ok) {
      expect(build.payload.prompt).toBe(`a crate ${"x".repeat(RARITY_PROVIDER_REQUEST_MAX_CHARS)}`);
    }

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
      expect(
        bridge.handle({
          action: "assistant",
          payload: {
            op: "start",
            route: "local",
            profile,
            prompt: "ask a question",
            mode: "ask",
          },
        }),
      ).toMatchObject({
        ok: false,
        reason: DESKTOP_BRIDGE_REFUSALS.assistantBuildModeRequired,
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

  it("keeps the composer unavailable until viewport controls are bound", () => {
    expect(
      desktopAssistantRuntimeSignal({
        status: "refused",
        message: "the scene request refused",
      }),
    ).toEqual({ runtime: "none", message: "the scene request refused" });
    expect(
      desktopAssistantRuntimeSignal({ status: "mounted", controlsBound: false }),
    ).toEqual({
      runtime: "none",
      message: "the assistant controls could not be bound to the mounted presentation runtime.",
    });
    expect(
      desktopAssistantRuntimeSignal({ status: "mounted", controlsBound: true }),
    ).toEqual({ runtime: "local" });
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

  // The two tiers must name the same events or neither surface ever hears the
  // other; these are the constants both sides import, not a reading of a file.
  it("shares one event name per surface with the shell", () => {
    expect(DESKTOP_VIEWPORT_PLAY_EVENT).toBe("sceneaxi:desktop-viewport-play");
    expect(DESKTOP_VIEWPORT_PLAY_EVENT).toBe(SHELL_VIEWPORT_PLAY_EVENT);
    expect(DESKTOP_VIEWPORT_SCENE_OPEN_EVENT).toBe("sceneaxi:desktop-viewport-scene-open");
    expect(DESKTOP_VIEWPORT_SCENE_OPEN_EVENT).toBe(SHELL_VIEWPORT_SCENE_OPEN_EVENT);
    expect(DESKTOP_RARITY_PROPOSAL_EVENT).toBe(SHELL_RARITY_PROPOSAL_EVENT);
  });

  it("lets the pixels meta claim only what a frame really reported", () => {
    const frame = (pixelsDrawn: unknown) =>
      ({
        backend: "three",
        label: "desktop",
        drawCalls: 1,
        frame: 1,
        instanceIds: [],
        surface: "headless",
        ...(pixelsDrawn === undefined ? {} : { pixelsDrawn }),
      }) as unknown as Parameters<typeof pixelsMetaContent>[0];

    expect(pixelsMetaContent(frame(true))).toBe("true");
    expect(pixelsMetaContent(frame(false))).toBe("false");
    // A frame that reported nothing is not evidence, so the meta is left alone
    // rather than being written with a fabricated value.
    expect(pixelsMetaContent(frame(undefined))).toBeNull();
    expect(pixelsMetaContent(frame("true"))).toBeNull();
  });

  it("acknowledges a playback only for an exercise it can honour", () => {
    const starter = desktopOpenScene();
    if (!starter.ok) throw new Error(`desktop scene fixture refused: ${starter.reason}`);
    const exercise = {
      closed: true,
      initialDigest: "sha256:initial",
      tickDigests: ["sha256:tick"],
      mountable: starter.mountable,
    };
    expect(playableExercise({ exercise })).toBe(exercise);

    // Every field the acknowledgement line goes on to print is refused when it
    // cannot be trusted, before a single mount happens.
    expect(playableExercise(null)).toBeNull();
    expect(playableExercise({})).toBeNull();
    expect(playableExercise({ exercise: { ...exercise, closed: false } })).toBeNull();
    expect(playableExercise({ exercise: { ...exercise, initialDigest: 1 } })).toBeNull();
    expect(playableExercise({ exercise: { ...exercise, tickDigests: [] } })).toBeNull();
    expect(playableExercise({ exercise: { ...exercise, tickDigests: [7] } })).toBeNull();
    expect(playableExercise({ exercise: { ...exercise, mountable: { sceneId: "x" } } })).toBeNull();
  });
});

/** The browser payload a successful scene composition serves. */
type ComposedScene = Extract<
  ReturnType<typeof desktopOpenScene>,
  { ok: true }
>["mountable"];
