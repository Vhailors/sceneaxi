/**
 * Mounted control inventory for the Engine Desktop chrome.
 *
 * This deliberately observes the emitted document rather than checking that a
 * handler name appears in source. A presentation control must change mounted
 * state; a product control must produce a host request or named refusal; an
 * unsupported control must already carry an accessible refusal.
 */
import { afterEach, describe, expect, it } from "vitest";
import { Window as HappyWindow, type HTMLElement as HappyHTMLElement } from "happy-dom";
import { DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS } from "@sceneaxi/schemas";
import {
  DESKTOP_MODE_IDS,
  DESKTOP_PRODUCT_REFUSALS,
  DESKTOP_VISUAL_REFUSALS,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
} from "@sceneaxi/desktop-shell";

const windows: HappyWindow[] = [];

afterEach(() => {
  for (const window of windows.splice(0)) window.close();
});

function mount(
  state = createDesktopVisualState({
    window: { width: 1000, height: 700 },
  }),
  runtime?: Readonly<{
    request(request: unknown): Promise<unknown>;
    project(request: unknown): Promise<unknown>;
  }>,
) {
  const window = new HappyWindow({ width: 1000, height: 700 });
  windows.push(window);
  if (runtime !== undefined) {
    Object.assign(window, { sceneaxiDesktop: runtime });
  }
  const html = renderDesktopChrome(desktopVisualView(state));
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (match?.[1] === undefined) throw new Error("desktop chrome script missing");
  window.document.write(html.replace(match[0], ""));
  window.eval(match[1]);
  return window;
}

function element(window: HappyWindow, selector: string) {
  const found = window.document.querySelector(selector) as HappyHTMLElement | null;
  if (found === null) throw new Error(`missing desktop control ${selector}`);
  return found;
}

async function settle() {
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
}

async function click(window: HappyWindow, selector: string) {
  element(window, selector).click();
  await settle();
}

async function escape(window: HappyWindow) {
  window.document.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  await settle();
}

describe("desktop mounted control inventory", () => {
  it("renders project-backed instance, object, and parent identities", async () => {
    const properties = DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS.map((definition) => ({
      id: definition.id,
      value: definition.id.startsWith("scale-") ? 1 : 0,
    }));
    const snapshot = {
      phase: "idle",
      unifiedDiff: null,
      renderedDiff: null,
      proposal: null,
      appliedPaths: null,
      journalRecoveryPending: false,
      transactionId: null,
      diagnostics: null,
    };
    const status = {
      ok: true,
      documentId: "scene",
      data: {},
      contentHash: `sha256:${"3".repeat(64)}`,
      authoringSnapshot: snapshot,
      editableScene: {
        ok: true,
        selection: { instanceIds: ["child-instance"], primaryInstanceId: "child-instance" },
        entities: [
          {
            id: "root-instance",
            label: "Root",
            artifactId: "root-object",
            parentInstanceId: null,
            depth: 0,
            properties,
          },
          {
            id: "child-instance",
            label: "Child",
            artifactId: "child-object",
            parentInstanceId: "root-instance",
            depth: 1,
            properties,
          },
        ],
      },
    };
    const window = mount(undefined, {
      project: async () => ({
        ok: true,
        data: {
          status: {
            active: { name: "Hierarchy", root: "/project", documentPath: "scene.json" },
            recents: [],
          },
        },
      }),
      request: async () => ({ ok: true, data: status }),
    });
    await settle();

    const select = element(window, '[data-action="scene-entity-select"]') as unknown as {
      options: ArrayLike<{ textContent: string | null }>;
    };
    expect(Array.from(select.options, (option) => option.textContent)).toEqual([
      "Root · instance root-instance · object root-object · root",
      "  Child · instance child-instance · object child-object · parent root-instance",
    ]);
  });

  it("makes every presentation control produce an observable state change", async () => {
    const window = mount();
    const shell = element(window, ".shell");

    for (const mode of DESKTOP_MODE_IDS) {
      await click(window, `#mode-${mode}`);
      expect(shell.dataset.mode).toBe(mode);
      expect(element(window, `#mode-${mode}`).getAttribute("aria-pressed")).toBe("true");
      if (!["build", "run", "ship"].includes(mode)) {
        expect(element(window, `[data-mode-panel="${mode}"]`).textContent).toContain(
          DESKTOP_VISUAL_REFUSALS.noDocumentBound,
        );
      }
    }

    await click(window, "#mode-build");
    for (const tab of ["changes", "assets", "console", "evidence"]) {
      await click(window, `#dock-${tab}`);
      expect(element(window, `#dock-${tab}`).getAttribute("aria-selected")).toBe("true");
      expect(element(window, `#dock-panel-${tab}`).hidden).toBe(false);
    }

    await click(window, "#drawer-left");
    expect(shell.dataset.drawerLeft).toBe("open");
    expect(element(window, "#drawer-left").getAttribute("aria-expanded")).toBe("true");
    await click(window, "#drawer-left");
    expect(shell.dataset.drawerLeft).toBe("closed");

    await click(window, "#assistant-route-byo");
    expect(shell.dataset.assistantRoute).toBe("byo");
    expect(element(window, "#assistant-route-byo").getAttribute("aria-pressed")).toBe("true");
    await click(window, "#assistant-mode-agent");
    expect(shell.dataset.assistantMode).toBe("agent");
    expect(element(window, "#assistant-mode-agent").getAttribute("aria-pressed")).toBe("true");
    await click(window, "#assistant-mode-ask");
    expect(shell.dataset.assistantMode).toBe("ask");

    await click(window, "#assistant-toggle");
    expect(shell.dataset.assistant).toBe("open");
    expect(shell.dataset.drawerAssistant).toBe("open");
    await click(window, "#assistant-toggle");
    expect(shell.dataset.assistant).toBe("closed");

    await click(window, "#status-refusal-help");
    expect(element(window, "#refusal-legend").hidden).toBe(false);
    await click(window, "#status-refusal-help");
    expect(element(window, "#refusal-legend").hidden).toBe(true);

    await click(window, "#overlay-open-palette");
    expect(element(window, '[data-overlay="palette"]').hidden).toBe(false);
    await escape(window);
    expect(element(window, '[data-overlay="palette"]').hidden).toBe(true);
    await click(window, "#status-overlay-palette");
    expect(element(window, '[data-overlay="palette"]').hidden).toBe(false);
  });

  it("keeps unsupported or unmounted controls at named refusal states", async () => {
    const window = mount(
      createDesktopVisualState({
        window: { width: 1000, height: 700 },
        sculpt: "running",
      }),
    );
    const refused = [
      "#viewport-source-scene",
      "#viewport-source-game",
      "#viewport-source-sculpt-preview",
      "#sculpt-start",
      "#sculpt-cancel",
      "#assistant-prompt",
      "#assistant-send",
      "#assistant-retry",
    ];

    for (const selector of refused) {
      const control = element(window, selector);
      expect(control.getAttribute("aria-disabled"), selector).toBe("true");
      const code = control.getAttribute("data-refusal");
      expect(code, selector).toBeTruthy();
      expect(element(window, `#refusal-${code}`).textContent).not.toBe("");
    }
    expect(element(window, "#assistant-prompt").getAttribute("readonly")).not.toBeNull();

    const progress = element(window, "[data-sculpt-progress]");
    expect(progress.hidden).toBe(false);
    await click(window, "#sculpt-cancel");
    expect(progress.hidden).toBe(false);

    await click(window, "#profile-kids");
    expect(element(window, ".profile-refusal").hidden).toBe(false);
    expect(element(window, "#mode-build").getAttribute("aria-disabled")).toBe("true");
    expect(element(window, "#drawer-left").getAttribute("aria-disabled")).toBe("true");
    await click(window, "#mode-build");
    expect(element(window, ".shell").dataset.mode).toBe("build");
    await click(window, "#profile-game");
    expect(element(window, ".shell").dataset.profile).toBe("game");
    expect(window.getComputedStyle(element(window, ".profile-refusal")).display).toBe("none");
  });

  it("turns standalone product actions into observable named outcomes", async () => {
    const window = mount();
    const status = () => element(window, "[data-project-status]").textContent ?? "";

    await click(window, '[data-menu-trigger="file"]');
    await click(window, "#menu-command-project-new");
    expect(status()).toContain(DESKTOP_PRODUCT_REFUSALS.runtimeUnavailable);
    expect(element(window, '[data-overlay="outcome"]').hidden).toBe(false);
    expect(element(window, "[data-outcome-code]").textContent).toBe(
      DESKTOP_PRODUCT_REFUSALS.runtimeUnavailable,
    );
    await click(window, "#overlay-close-outcome-dismiss");

    await click(window, "#overlay-open-palette");
    await click(window, "#palette-run-play");
    expect(status()).toContain(DESKTOP_PRODUCT_REFUSALS.runtimeUnavailable);
    expect(element(window, "[data-outcome-code]").textContent).toBe(
      DESKTOP_PRODUCT_REFUSALS.runtimeUnavailable,
    );
    await click(window, "#overlay-close-outcome-dismiss");

    await click(window, "#change-review-accept");
    expect(status()).toContain(DESKTOP_PRODUCT_REFUSALS.proposalNotReviewing);
  });

  it("projects the refuse-only profile without leaving live product controls", async () => {
    const window = mount();
    await click(window, "#profile-kids");
    const live = [...window.document.querySelectorAll('[data-kind]:not([data-kind="inert"])')] as HappyHTMLElement[];
    expect(live.map((control) => control.id).sort()).toEqual([
      "overlay-close-outcome-dismiss",
      "overlay-open-palette",
      "profile-game",
      "profile-kids",
      "profile-web",
      "status-overlay-palette",
      "status-refusal-help",
    ].sort());
  });
});
