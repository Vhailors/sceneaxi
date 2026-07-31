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
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";
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
    expect(html).toContain("<title>SceneAxi Engine Desktop</title>");
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
