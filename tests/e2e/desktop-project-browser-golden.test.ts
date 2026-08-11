/** End-to-end project browser over lifecycle, preload-shaped ports, and authoring bridge. */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Window as HappyWindow, type HTMLElement as HappyHTMLElement } from "happy-dom";
import {
  DESKTOP_PRODUCT_REFUSALS,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
} from "@sceneaxi/desktop-shell";
import {
  DESKTOP_PROJECT_BROWSER_REFUSALS,
  DESKTOP_VIEWPORT_SCENE_OPEN_EVENT,
  createDesktopBridge,
  createDesktopProjectBrowser,
  createDesktopProjectHost,
  createDesktopProjectLifecycle,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";

const roots: string[] = [];
const windows: HappyWindow[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  for (const window of windows.splice(0)) window.close();
});

function temporary(label: string) {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-project-browser-golden-${label}-`));
  roots.push(root);
  return root;
}

function containedTriangle(offset = 0) {
  const positions = new Float32Array([
    -1 + offset, 0, 0,
    1 + offset, 0, 0,
    offset, 1, 0,
  ]);
  const bytes = Buffer.from(positions.buffer);
  return Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{
      byteLength: bytes.byteLength,
      uri: `data:application/octet-stream;base64,${bytes.toString("base64")}`,
    }],
    bufferViews: [{ buffer: 0, byteLength: bytes.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }));
}

function query(window: HappyWindow, selector: string) {
  return window.document.querySelector(selector) as HappyHTMLElement | null;
}

async function settle() {
  for (let turn = 0; turn < 50; turn += 1) await Promise.resolve();
}

async function click(window: HappyWindow, selector: string) {
  const element = query(window, selector);
  if (element === null) throw new Error(`missing project-browser control ${selector}`);
  element.click();
  for (let turn = 0; turn < 60; turn += 1) {
    await Promise.resolve();
    if (window.document.querySelector("[data-busy]") === null) return;
  }
  throw new Error(`project-browser control did not settle ${selector}`);
}

async function selectProjectFile(window: HappyWindow, path: string) {
  const element = query(window, "#project-browser-file-select") as unknown as {
    value: string;
    dispatchEvent(event: Event): boolean;
  } | null;
  if (element === null) throw new Error("missing project-browser file selector");
  element.value = path;
  element.dispatchEvent(new window.Event("change", { bubbles: true }) as unknown as Event);
  for (let turn = 0; turn < 60; turn += 1) {
    await Promise.resolve();
    if (window.document.querySelector("[data-busy]") === null) return;
  }
  throw new Error(`project-browser selection did not settle ${path}`);
}

describe("desktop project and asset browser golden path", () => {
  it("lists, selects, opens, restores, and safely refuses protected mutation through the real seams", async () => {
    const root = temporary("project");
    const stateDirectory = temporary("state");
    const source = join(temporary("source"), "triangle.gltf");
    writeFileSync(source, containedTriangle());
    expect(seedDesktopProject(root).ok).toBe(true);
    let dirty = false;
    let bridgeForDirtyCheck: ReturnType<typeof createDesktopBridge> | null = null;
    const browser = createDesktopProjectBrowser({
      root,
      stateDirectory,
      isDirty: () => {
        if (dirty) return true;
        const response = bridgeForDirtyCheck?.handle({
          action: "authoring",
          payload: { op: "status", documentPath: "scene.json" },
        });
        if (response === undefined || !response.ok) return true;
        const snapshot = (response.data as { authoringSnapshot?: {
          phase?: unknown;
          journalRecoveryPending?: unknown;
        } }).authoringSnapshot;
        return snapshot?.phase === "reviewing" || snapshot?.phase === "pending" ||
          snapshot?.journalRecoveryPending === true;
      },
    });
    const bridge = createDesktopBridge({ cwd: root, projectBrowser: browser });
    bridgeForDirtyCheck = bridge;
    expect(bridge.handle({
      action: "asset-import",
      payload: { profile: "web", documentPath: "scene.json", sourcePath: source },
    }).ok).toBe(true);
    expect(bridge.handle({ action: "authoring", payload: { op: "accept" } })).toMatchObject({
      ok: true,
      data: { phase: "applied" },
    });

    const lifecycle = createDesktopProjectLifecycle({ stateDirectory });
    expect(lifecycle.openProject(root).ok).toBe(true);
    const host = createDesktopProjectHost({
      lifecycle,
      dialogs: {
        chooseNewProjectRoot: async () => null,
        chooseOpenProjectRoot: async () => null,
      },
      activate: () => undefined,
    });
    const sceneRequests: unknown[] = [];
    let openedAssetInstance: string | null = null;
    let openedAssetDigest: string | null = null;

    const window = new HappyWindow({ width: 1200, height: 800 });
    windows.push(window);
    const clone = <T>(value: T): T => window.eval(`(${JSON.stringify(value)})`) as T;
    Object.defineProperty(window, "structuredClone", { value: clone });
    Object.defineProperty(window, "confirm", { value: () => true });
    Object.defineProperty(window, "prompt", { value: () => "assets/renamed.gltf" });
    Object.defineProperty(window, "sceneaxiDesktopLinux", {
      value: {
        project: async (request: unknown) => clone(await host.handle(clone(request))),
        request: async (request: unknown) => {
          if ((request as { action?: unknown }).action === "project-browser-open") {
            sceneRequests.push(request);
          }
          return clone(bridge.handle(clone(request)));
        },
        browseProject: async (request: unknown) => clone(browser.handle(clone(request))),
      },
    });

    const html = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({
        profile: "web",
        window: { width: 1200, height: 800 },
      })),
    );
    const match = /<script>([\s\S]*?)<\/script>/.exec(html);
    if (match?.[1] === undefined) throw new Error("desktop chrome script missing");
    window.document.write(html.replace(match[0], ""));
    window.document.addEventListener(DESKTOP_VIEWPORT_SCENE_OPEN_EVENT, (event) => {
      const detail = (event as CustomEvent).detail as {
        mountable?: {
          instances?: Array<{ instanceId?: string }>;
          importedAssets?: Array<{ instanceId?: string; digest?: string }>;
        };
        asset?: { instanceId?: string; digest?: string };
        accepted: boolean;
        frame: number | null;
      };
      if (detail.mountable?.instances?.some((instance) =>
        instance.instanceId === detail.asset?.instanceId) &&
        detail.mountable.importedAssets?.some((asset) =>
          asset.instanceId === detail.asset?.instanceId && asset.digest === detail.asset.digest)) {
        openedAssetInstance = detail.asset?.instanceId ?? null;
        openedAssetDigest = detail.asset?.digest ?? null;
        detail.accepted = true;
        detail.frame = 7;
      }
    });
    window.eval(match[1]);
    await settle();

    expect(query(window, "#project-browser-file-select")?.textContent).toContain(
      "scene-document · valid",
    );
    expect(query(window, "#project-browser-file-select")?.textContent)
      .toContain("contained-gltf · valid");
    expect(query(window, "[data-project-browser-digest]")?.textContent).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
    expect(query(window, "[data-project-browser-provenance]")?.textContent)
      .toContain("scene-document");

    await selectProjectFile(window, "assets/triangle.gltf");
    expect(query(window, "[data-project-browser-path]")?.textContent).toContain(
      "manifest asset",
    );
    expect(query(window, "[data-project-browser-provenance]")?.textContent)
      .toContain("@sceneaxi/importers");
    await click(window, "#dock-assets");
    expect(query(window, '[data-project-asset="assets/triangle.gltf"]')?.textContent)
      .toContain("@sceneaxi/importers");
    expect(query(window, '[data-project-asset="assets/triangle.gltf"]')?.textContent)
      .toMatch(/sha256:[0-9a-f]{64}/);
    await click(window, '[data-action="project-browser-open"]');
    expect(sceneRequests).toHaveLength(1);
    expect(openedAssetInstance).toBe("triangle-instance");
    expect(openedAssetDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      "opened at viewport frame 7 · active authoring target remains scene.json",
    );

    const runtimePort = (
      window as unknown as {
        sceneaxiDesktopLinux: {
          request: (request: unknown) => Promise<unknown>;
        };
      }
    ).sceneaxiDesktopLinux;
    const runtimeRequest = runtimePort.request;
    runtimePort.request = async (request: unknown) => {
      const response = await runtimeRequest(request) as {
        ok?: boolean;
        data?: { mountable?: { importedAssets?: Array<{ digest?: string }> } };
      };
      if ((request as { action?: unknown }).action === "project-browser-open" && response.ok === true) {
        const replacement = clone(response);
        if (replacement.data?.mountable?.importedAssets?.[0] !== undefined) {
          replacement.data.mountable.importedAssets[0].digest = `sha256:${"0".repeat(64)}`;
        }
        return replacement;
      }
      return response;
    };
    openedAssetInstance = null;
    openedAssetDigest = null;
    await click(window, '[data-action="project-browser-open"]');
    expect(openedAssetInstance).toBeNull();
    expect(openedAssetDigest).toBeNull();
    expect(query(window, "[data-project-status]")?.textContent).toContain("Asset open refused");
    runtimePort.request = runtimeRequest;

    await click(window, '[data-action="project-browser-rename"]');
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      DESKTOP_PROJECT_BROWSER_REFUSALS.operationNotPermitted,
    );

    await selectProjectFile(window, "scene.json");
    await click(window, '[data-action="project-browser-open"]');
    expect(query(window, "[data-project-status]")?.textContent).toContain("scene.json · open");

    const desktopPort = (
      window as unknown as {
        sceneaxiDesktopLinux: {
          browseProject?: (request: unknown) => Promise<unknown>;
        };
      }
    ).sceneaxiDesktopLinux;
    const browseProject = desktopPort.browseProject;
    if (browseProject === undefined) throw new Error("project-browser port missing");
    const racedSource = join(temporary("raced-source"), "raced.gltf");
    writeFileSync(racedSource, containedTriangle(0.5));
    let raced = false;
    desktopPort.browseProject = async (request: unknown) => {
      const response = await browseProject(request);
      if (!raced && (request as { action?: unknown; path?: unknown }).action === "open" &&
          (request as { path?: unknown }).path === "scene.json") {
        raced = true;
        expect(bridge.handle({
          action: "asset-import",
          payload: { profile: "web", documentPath: "scene.json", sourcePath: racedSource },
        })).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
      }
      return response;
    };
    await click(window, '[data-action="project-browser-open"]');
    expect(raced).toBe(false);
    expect(query(window, "[data-project-status]")?.textContent).toContain("scene.json · open");
    desktopPort.browseProject = browseProject;
    expect(bridge.handle({
      action: "asset-import",
      payload: { profile: "web", documentPath: "scene.json", sourcePath: racedSource },
    })).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
    await click(window, '[data-action="project-browser-open"]');
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      DESKTOP_PROJECT_BROWSER_REFUSALS.dirty,
    );
    expect(bridge.handle({
      action: "authoring",
      payload: { op: "status", documentPath: "scene.json" },
    })).toMatchObject({ data: { authoringSnapshot: { phase: "reviewing" } } });
    await click(window, '[data-action="change-reject"]');

    let releaseOpen: (() => void) | undefined;
    runtimePort.request = (request: unknown) => {
      if ((request as { action?: unknown }).action !== "project-browser-open") {
        return runtimeRequest(request);
      }
      return new Promise((resolve) => {
        releaseOpen = () => resolve(clone(bridge.handle(clone(request))));
      });
    };
    query(window, '[data-action="project-browser-open"]')?.click();
    await settle();
    for (const selector of [
      "#project-browser-file-select",
      '[data-action="project-browser-open"]',
      '[data-action="project-browser-rename"]',
      '[data-action="project-browser-delete"]',
    ]) {
      expect(query(window, selector)?.dataset.busy).toBe("true");
      expect(query(window, selector)?.getAttribute("aria-disabled")).toBe("true");
    }
    const fileSelect = query(window, "#project-browser-file-select") as unknown as {
      value: string;
      dispatchEvent(event: Event): boolean;
    };
    fileSelect.value = "assets/triangle.gltf";
    fileSelect.dispatchEvent(new window.Event("change", { bubbles: true }) as unknown as Event);
    expect(fileSelect.value).toBe("scene.json");
    releaseOpen?.();
    await settle();
    expect(query(window, "[data-busy]")).toBeNull();
    runtimePort.request = runtimeRequest;

    delete desktopPort.browseProject;
    const refusedSelect = query(window, "#project-browser-file-select") as unknown as {
      value: string;
      dispatchEvent(event: Event): boolean;
    };
    refusedSelect.value = "assets/triangle.gltf";
    refusedSelect.dispatchEvent(new window.Event("change", { bubbles: true }) as unknown as Event);
    expect(refusedSelect.value).toBe("scene.json");
    await settle();
    expect(query(window, "[data-outcome-code]")?.textContent).toBe(
      DESKTOP_PRODUCT_REFUSALS.runtimeRequestRefused,
    );
    expect(refusedSelect.value).toBe("scene.json");
    await click(window, '[data-action="project-browser-open"]');
    expect(query(window, "[data-project-status]")?.textContent).toContain("scene.json · open");
    desktopPort.browseProject = browseProject;

    const restarted = createDesktopProjectBrowser({ root, stateDirectory });
    expect(restarted.handle({ action: "status", profile: "web" })).toMatchObject({
      ok: true,
      data: { status: { selectedPath: "scene.json" } },
    });

    dirty = true;
    await click(window, '[data-action="project-browser-delete"]');
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      DESKTOP_PROJECT_BROWSER_REFUSALS.dirty,
    );

    dirty = false;
    desktopPort.browseProject = async (request: unknown) =>
      (request as { action?: unknown }).action === "status"
        ? { ok: false, reason: "DESKTOP_PROJECT_BROWSER_MANIFEST_INVALID", message: "invalid", detail: null }
        : browseProject(request);
    await click(window, '[data-action="project-browser-open"]');
    expect(query(window, "[data-project-status]")?.textContent).toContain("scene.json · open");
    expect(query(window, "#project-browser-file-select")?.textContent).toContain(
      "scene-document · valid",
    );
    desktopPort.browseProject = browseProject;
    await selectProjectFile(window, "assets/triangle.gltf");
    await click(window, '[data-command="edit-undo"]');
    expect((query(window, "#project-browser-file-select") as unknown as { value?: string }).value)
      .toBe("scene.json");
    expect(query(window, '[data-project-asset="assets/triangle.gltf"]')).toBeNull();
    expect(createDesktopProjectBrowser({ root, stateDirectory }).handle({
      action: "status",
      profile: "web",
    })).toMatchObject({
      ok: true,
      data: { status: { selectedPath: "scene.json" } },
    });
  });
});
