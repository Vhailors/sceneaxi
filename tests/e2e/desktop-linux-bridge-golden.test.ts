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
import { afterAll, describe, expect, it } from "vitest";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  createDocument,
  createModelProviderPort,
  runAssistantSculptAction,
  writeDocumentFile,
  type AssistantSculptProgress,
  type AssistantSculptResult,
  type ModelDescriptor,
} from "@sceneaxi/authoring-core";
import {
  DESKTOP_ASSISTANT_RUNTIME_EVENT,
  DESKTOP_VISUAL_REFUSALS,
} from "@sceneaxi/desktop-shell";
import {
  THREE_HEADLESS_SURFACE_LABEL,
  createSculptMountApi,
  createThreeSculptPresentationBackend,
} from "../../packages/engine-presentation/src/index.ts";
import {
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_REFUSALS,
  createDesktopBridge,
  desktopOpenScene,
  type DesktopFrameReport,
} from "../../desktop/linux/src/index.ts";
import {
  DESKTOP_RUNTIME_META,
  RENDERER_SCRIPT_TAG,
  desktopLinuxIndexHtml,
} from "../../desktop/linux/src/lib/chrome-document.ts";

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
    return selector === "[data-action]" ? this : null;
  }

  querySelector(): FakeElement | null {
    return null;
  }

  querySelectorAll(): FakeElement[] {
    return [];
  }

  focus(): void {}

  contains(element: FakeElement | null): boolean {
    return element !== null;
  }
}

class FakeTextAreaElement extends FakeElement {
  readOnly = false;
}

class FakeShell extends FakeElement {
  clickListener?: (event: { readonly target: FakeElement }) => void;

  constructor(
    private readonly controls: readonly FakeElement[],
    private readonly profileChips: readonly FakeElement[],
  ) {
    super("shell", {
      assistant: "open",
      assistantRuntime: "local",
      drawerAssistant: "open",
      overlay: "none",
      profile: "game",
    });
  }

  override querySelectorAll(selector: string): FakeElement[] {
    if (selector === "[data-kind]") return [...this.controls];
    if (selector === ".profile-chip") return [...this.profileChips];
    return [];
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

function authoringDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-golden-"));
  tmpDirs.push(dir);
  const doc = createDocument({
    id: "scene",
    data: { entities: [{ id: "hero", x: 1, y: 2, rz: 0 }], material: { roughness: 0.4 } },
  });
  const written = writeDocumentFile(join(dir, "scene.json"), doc, { cwd: dir });
  if (!written.ok) throw new Error("golden fixture document refused");
  return dir;
}

function bridgeAt(dir: string, onFrameReport?: (report: DesktopFrameReport) => void) {
  return createDesktopBridge({ cwd: dir, nowMs: fixedNow, ...(onFrameReport ? { onFrameReport } : {}) });
}

describe("desktop bridge — the packaged app's engine paths are real", () => {
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
    const bridge = bridgeAt(authoringDir());
    const res = bridge.handle({ action: "scene" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const scene = res.data as ReturnType<typeof composedScene>;
    const direct = composedScene();
    expect(scene.sceneId).toBe("desktop-linux-open-scene");
    expect(scene.instances).toHaveLength(3);
    expect(scene.sceneDigest).toBe(direct.sceneDigest);
    expect(scene.instances.map((i) => i.instanceId)).toEqual(
      direct.instances.map((i) => i.instanceId),
    );
  });

  it("runs a free local assistant job and returns the typed artifact the viewport mounts", async () => {
    const bridge = bridgeAt(authoringDir());
    const started = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "local",
        profile: "@sceneaxi/profile-game",
        prompt: "A tall blue service cylinder",
      },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.data).toMatchObject({ status: "running", route: "local" });

    // The bridge remains synchronous: provider/local work settles behind the
    // job, and the renderer polls the same status operation.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const status = bridge.handle({ action: "assistant", payload: { op: "status" } });
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    const job = status.data as {
      status: string;
      result: {
        mountable: ReturnType<typeof composedScene>;
        inspection: {
          physics: { supported: boolean };
          materials: { supported: boolean };
          settings: { supported: boolean };
        };
      };
    };
    expect(job.status).toBe("ready");
    expect(job.result.inspection).toMatchObject({
      physics: { supported: true },
      materials: { supported: true },
      settings: { supported: true },
    });

    const backend = createThreeSculptPresentationBackend();
    const mounts = createSculptMountApi(backend);
    expect(job.result.mountable.instances).toHaveLength(1);
    const instance = job.result.mountable.instances[0];
    if (instance === undefined) throw new Error("assistant composition has no root instance");
    mounts.mount({
      instanceId: instance.instanceId,
      artifact: job.result.mountable.artifacts[instance.artifactId],
      transform: instance.worldTransform,
    });
    const moved = mounts.updateTransform(instance.instanceId, {
      translation: [1, 0, 0],
      rotationEulerDegrees: [0, 15, 0],
      scale: [1, 1, 1],
    });
    expect(moved.transform.translation).toEqual([1, 0, 0]);
    expect(mounts.render()).toMatchObject({
      backend: "three",
      instanceIds: [instance.instanceId],
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
    const res = bridge.handle({ action: "scene" });
    if (!res.ok) throw new Error(res.reason);
    const scene = res.data as ReturnType<typeof composedScene>;

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
    const bridge = bridgeAt(authoringDir());
    const res = bridge.handle({ action: "open-path" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const exercise = res.data as {
      bootstrap: Record<string, unknown>;
      initialDigest: string;
      tickDigests: string[];
      instanceCount: number;
      closed: boolean;
    };

    expect(exercise.bootstrap["kind"]).toBe("scene");
    expect(exercise.bootstrap["subjectId"]).toBe("desktop-linux-open-scene");
    expect(exercise.bootstrap["openedAtMs"]).toBe(FIXED_NOW_MS);
    expect(exercise.bootstrap["resumed"]).toBe(false);
    expect(exercise.bootstrap["sessionId"]).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(exercise.instanceCount).toBe(3);
    expect(exercise.closed).toBe(true);

    // Only `advance` moves state, and it really does: digests move tick over tick.
    expect(exercise.tickDigests).toHaveLength(4);
    expect(new Set([exercise.initialDigest, ...exercise.tickDigests]).size).toBe(5);

    // Deterministic under a fixed clock: the same request opens the same session.
    const again = bridge.handle({ action: "open-path" });
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
    const after = readFileSync(join(dir, "scene.json"), "utf8");
    expect(after).not.toBe(before);
    expect(after).toContain('"x": 7');

    const undone = bridge.handle({ action: "authoring", payload: { op: "undo" } });
    if (!undone.ok) throw new Error(undone.reason);
    expect((undone.data as { ok: boolean }).ok).toBe(true);
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(before);
  });

  it("refuses an authoring documentPath that leaves the project directory", () => {
    // The path arrives from the renderer across IPC and the authoring core resolves it
    // against `cwd` with no containment check of its own, so the bridge owns it.
    const dir = authoringDir();
    const bridge = bridgeAt(dir);
    const escapes = ["/etc/passwd", "../scene.json", "nested/../../scene.json", join(dir, "scene.json")];

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
    expect(html).toContain('<textarea id="assistant-prompt" data-kind="live"');
    expect(html).toContain(
      `data-assistant-runtime-event="${DESKTOP_ASSISTANT_RUNTIME_EVENT}"`,
    );
    expect(html).toContain("Hosted · metered");
  });

  it("preserves runtime composer refusal across profile switches", () => {
    const runtimeRefusal = DESKTOP_BRIDGE_REFUSALS.presentationRuntimeUnavailable;
    const prompt = new FakeTextAreaElement("assistant-prompt", { kind: "live" });
    const send = new FakeElement("assistant-send", { kind: "live" });
    const retry = new FakeElement("assistant-retry", { kind: "live" });
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

    documentListeners.get(DESKTOP_ASSISTANT_RUNTIME_EVENT)?.({
      detail: { runtime: "none", message: "Viewport unavailable" },
    });

    const switchTo = (profile: string): void => {
      const chip = profileChips.find((candidate) => candidate.dataset.value === profile);
      if (chip === undefined || shell.clickListener === undefined) {
        throw new Error(`profile switch harness missing ${profile}`);
      }
      shell.clickListener({ target: chip });
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

    switchTo("web");
    expectRefusal(runtimeRefusal);
    switchTo("kids");
    expectRefusal(DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied);
    switchTo("game");
    expectRefusal(runtimeRefusal);
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
    expect(source).toContain("mounts.mount({");
    expect(source).toContain("mounts.updateTransform(assistantInstanceId");
    expect(source).toContain("job.result.mountable.instances");
    expect(source).toContain("instance.worldTransform");
    expect(source).toContain('data-assistant-manipulators');
    expect(source).toContain('shell.dataset.assistantMode !== "build"');
    expect(source).toContain("DESKTOP_BRIDGE_REFUSALS.assistantBuildModeRequired");
    expect(source).toContain('payload: { op: "abandon" }');
    expect(source).toContain("MATERIALS (read-only)");
    expect(source).toContain("PHYSICS (read-only)");
    expect(source).toContain("SETTINGS (read-only)");
  });

  it("leaves no composer control live-but-unbound when the viewport refuses", () => {
    const source = readFileSync(
      join(desktopRoot, "linux/src/renderer/viewport.ts"),
      "utf8",
    );
    // The chrome renders the composer live for the declared desktop runtime, and
    // the flow is bound only after the scene request, backend construction, and
    // first mount succeed. Every path that returns before that has to name a
    // refusal on those controls rather than leaving Send inert-looking-live.
    expect(source).toContain("signalAssistantRuntimeUnavailable");
    expect(source).toContain("shell?.dataset.assistantRuntimeEvent");
    expect(source).toContain('runtime: "none"');
    expect(source).not.toContain("ASSISTANT_CONTROL_IDS");
    // One place says it, and that place settles the composer too — a second
    // refusal sentence would be a path that reports without disarming Send.
    expect(source.match(/Live viewport refused/g)).toHaveLength(1);
  });

  it("updates the pixels meta only from the real frame, and never imports Electron", () => {
    const viewport = readFileSync(
      join(desktopRoot, "linux/src/renderer/viewport.ts"),
      "utf8",
    );
    expect(viewport).toContain("frame.pixelsDrawn");
    expect(viewport).toContain("PIXELS_META_NAME");
    expect(viewport).not.toMatch(/from\s+"electron"/);
    // No Three type crosses the seam into this consumer either.
    expect(viewport).not.toMatch(/from\s+"three"/);
    expect(viewport).not.toContain("THREE.");
  });
});

function composedScene() {
  const result = desktopOpenScene();
  if (!result.ok) throw new Error(`desktop scene refused: ${result.reason}`);
  return result.mountable;
}
