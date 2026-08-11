/** Packaged-like preload/bridge interaction for the Wave 1 desktop project lifecycle. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Window as HappyWindow, type HTMLElement as HappyHTMLElement } from "happy-dom";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";
import {
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
} from "@sceneaxi/desktop-shell";
import {
  DESKTOP_PROJECT_BROWSER_REFUSALS,
  DESKTOP_PROJECT_REFUSALS,
  createDesktopBridge,
  createDesktopProjectBrowser,
  createDesktopProjectHost,
  createDesktopProjectLifecycle,
  type DesktopBridge,
} from "../../desktop/linux/src/index.ts";

const roots: string[] = [];
const windows: HappyWindow[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  for (const window of windows.splice(0)) window.close();
});

function temporaryRoot(label: string) {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-lifecycle-golden-${label}-`));
  roots.push(root);
  return root;
}

function existingProject() {
  const root = temporaryRoot("existing");
  const written = writeDocumentFile(
    join(root, "scene.json"),
    createDocument({ id: "opened-project", title: "Opened project", data: {} }),
    { cwd: root },
  );
  if (!written.ok) throw new Error("existing project fixture refused");
  return root;
}

function query(window: HappyWindow, selector: string) {
  return window.document.querySelector(selector) as HappyHTMLElement | null;
}

async function settle() {
  for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
}

async function click(window: HappyWindow, selector: string) {
  const element = query(window, selector);
  if (element === null) throw new Error(`missing lifecycle control ${selector}`);
  element.click();
  for (let turn = 0; turn < 40; turn += 1) {
    await Promise.resolve();
    if (window.document.querySelector("[data-busy]") === null) return;
  }
  throw new Error(`lifecycle control did not settle ${selector}`);
}

describe("desktop project lifecycle packaged-like interaction", () => {
  it("drives first launch, create, cancel, open, recent removal, and restart over the preload-shaped host", async () => {
    const state = temporaryRoot("state");
    const created = temporaryRoot("created");
    const opened = existingProject();
    const invalid = temporaryRoot("invalid");
    const invalidBytes = "{ invalid project bytes";
    writeFileSync(join(invalid, "scene.json"), invalidBytes, "utf8");
    const newChoices: Array<string | null> = [created];
    const openChoices: Array<string | null> = [null, opened, invalid];
    const lifecycle = createDesktopProjectLifecycle({ stateDirectory: state });
    let activeBridge: DesktopBridge | null = null;
    let activeBrowser: ReturnType<typeof createDesktopProjectBrowser> | null = null;
    const host = createDesktopProjectHost({
      lifecycle,
      dialogs: {
        async chooseNewProjectRoot() {
          return newChoices.shift() ?? null;
        },
        async chooseOpenProjectRoot() {
          return openChoices.shift() ?? null;
        },
      },
      activate(root) {
        activeBrowser = createDesktopProjectBrowser({
          root,
          stateDirectory: join(state, "project-browser"),
          isDirty: () => false,
        });
        activeBridge = createDesktopBridge({ cwd: root, projectBrowser: activeBrowser });
      },
    });

    const window = new HappyWindow({ width: 1000, height: 700 });
    windows.push(window);
    const clone = <T>(value: T): T => window.eval(`(${JSON.stringify(value)})`) as T;
    Object.defineProperty(window, "structuredClone", { value: clone });
    Object.defineProperty(window, "sceneaxiDesktopLinux", {
      value: {
        project: async (request: unknown) => clone(await host.handle(clone(request))),
        request: async (request: unknown) => {
          const bridge = activeBridge;
          return clone(
            bridge === null
              ? {
                  ok: false,
                  reason: DESKTOP_PROJECT_REFUSALS.projectRequired,
                  message: "Choose a project first.",
                  detail: null,
                }
              : bridge.handle(clone(request)),
          );
        },
        browseProject: async (request: unknown) => {
          const browser = activeBrowser;
          return clone(
            browser === null
              ? {
                  ok: false,
                  reason: DESKTOP_PROJECT_BROWSER_REFUSALS.projectRequired,
                  message: "Choose a project first.",
                  detail: null,
                }
              : browser.handle(clone(request)),
          );
        },
      },
    });

    const html = renderDesktopChrome(
      desktopVisualView(
        createDesktopVisualState({ window: { width: 1000, height: 700 } }),
      ),
    );
    const match = /<script>([\s\S]*?)<\/script>/.exec(html);
    if (match?.[1] === undefined) throw new Error("desktop chrome script missing");
    window.document.write(html.replace(match[0], ""));
    window.eval(match[1]);
    await settle();

    expect(query(window, "[data-project-launcher]")?.hidden).toBe(false);
    expect(query(window, "[data-project-bound]")?.hidden).toBe(true);
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      "No project selected",
    );

    await click(window, "#project-new-root");
    expect(readFileSync(join(created, "scene.json"), "utf8")).toContain(
      '"schemaVersion": 1',
    );
    expect(query(window, "[data-project-launcher]")?.hidden).toBe(true);
    expect(query(window, "[data-project-bound]")?.hidden).toBe(false);
    expect(query(window, "[data-project-root]")?.textContent).toBe(resolve(created));
    expect(query(window, "#project-browser-file-select")?.textContent).toContain("scene.json");
    expect(window.document.title).toContain(resolve(created));
    expect(query(window, "[data-project-status]")?.textContent).toContain("open · scene");

    const beforeCancel = readFileSync(join(created, "scene.json"), "utf8");
    await click(window, "#project-open-root");
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      "selection cancelled",
    );
    expect(readFileSync(join(created, "scene.json"), "utf8")).toBe(beforeCancel);

    await click(window, "#project-open-root");
    expect(query(window, "[data-project-name]")?.textContent).toBe("Opened project");
    expect(query(window, "[data-project-root]")?.textContent).toBe(resolve(opened));
    expect(window.document.title).toContain("Opened project");

    const restored = createDesktopProjectLifecycle({ stateDirectory: state });
    const restart = restored.startup();
    expect(restart.ok).toBe(true);
    if (!restart.ok) return;
    expect(restart.data.status.active).toMatchObject({
      name: "Opened project",
      root: resolve(opened),
      source: "restored",
    });

    await click(window, "#project-open-root");
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      DESKTOP_PROJECT_REFUSALS.documentInvalid,
    );
    expect(readFileSync(join(invalid, "scene.json"), "utf8")).toBe(invalidBytes);

    const recent = query(window, "#project-recent-select") as unknown as {
      value: string;
    } | null;
    if (recent === null) throw new Error("recent chooser missing");
    recent.value = resolve(created);
    await click(window, "#project-remove-recent");
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      "Recent project removed",
    );
    expect(
      [...window.document.querySelectorAll("#project-recent-select option")].map(
        (option) => option.getAttribute("value"),
      ),
    ).not.toContain(resolve(created));
  });
});
