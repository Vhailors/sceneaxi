import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Window as HappyWindow } from "happy-dom";
import { EDITOR_COMMAND_REGISTRY, isJsonObject, validateEditorCommandInvocation, type EditorCommandInvocation } from "@sceneaxi/schemas";
import {
  DESKTOP_ASSISTANT_RUNTIME_EVENT,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
} from "@sceneaxi/desktop-shell";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  createDesktopBridge,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";
import { createSculptMountApi, createThreeSculptPresentationBackend } from "../../packages/engine-presentation/src/index.ts";
import { runAssistantSculptAction } from "@sceneaxi/authoring-core";
import { installAssistantProductFlow } from "../../desktop/linux/src/renderer/viewport.ts";

export const GUI_REAL_BRIDGE_COMMANDS = [
  "animation-apply",
  "animation-evaluate",
  "animation-inspect",
  "animation-scrub",
  "assistant-byo-build",
  "assistant-cancel",
  "assistant-local-agent",
  "assistant-local-build",
  "assistant-status",
  "change-review-accept",
  "change-review-reject",
  "effect-apply",
  "effect-inspect",
  "environment-apply",
  "environment-inspect",
  "material-apply",
  "material-inspect",
  "physics-apply",
  "physics-inspect",
  "play-inspect",
  "run-reset",
  "run-stop",
  "scene-hierarchy-inspect",
  "scene-object-create",
  "scene-object-remove",
  "scene-object-reparent",
  "scene-property-set",
  "scene-selection-set",
  "scene-transform-apply",
] as const;

type ProvenCommand = typeof GUI_REAL_BRIDGE_COMMANDS[number];

type BridgeResponse = ReturnType<ReturnType<typeof createDesktopBridge>["handle"]>;

type Exchange = { request: unknown; response: BridgeResponse };

const roots: string[] = [];

const windows: HappyWindow[] = [];

const disposers: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.unstubAllGlobals();

  for (const window of windows.splice(0)) window.close();

  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function settle(window: HappyWindow) {
  for (let turn = 0; turn < 100; turn += 1) {
    await Promise.resolve();

    if (turn >= 30 && window.document.querySelector("[data-busy]") === null) return;
  }

  throw new Error("mounted desktop command did not settle");
}

function element(window: HappyWindow, selector: string) {
  const control = window.document.querySelector(selector);

  if (!(control instanceof window.HTMLElement)) throw new Error(`missing control ${selector}`);

  return control;
}

async function click(window: HappyWindow, selector: string) {
  const control = element(window, selector);
  expect(control.closest("[hidden]") === null, `${selector} is visible`).toBe(true);
  expect(control.getAttribute("aria-disabled"), selector).not.toBe("true");
  expect(control.hasAttribute("disabled"), selector).toBe(false);
  control.click();
  await settle(window);
}

async function fill(window: HappyWindow, selector: string, value: string) {
  const field = element(window, selector);

  if (!(field instanceof window.HTMLInputElement || field instanceof window.HTMLTextAreaElement ||
      field instanceof window.HTMLSelectElement)) throw new Error(`not a field ${selector}`);
  field.value = value;
  field.dispatchEvent(new window.Event("input", { bubbles: true }));
  field.dispatchEvent(new window.Event("change", { bubbles: true }));
  await settle(window);
}

async function mount(options: Pick<Parameters<typeof createDesktopBridge>[0], "runByoAssistant"> = {}) {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-control-dispatch-"));
  roots.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });

  const bridge = createDesktopBridge({
    ...options,
    cwd: root,
    commandCapabilities: [...new Set(EDITOR_COMMAND_REGISTRY.map((command) => command.capability.id))],
  });

  disposers.push(() => { bridge.close(); });
  const window = new HappyWindow({ width: 1600, height: 1000 });
  windows.push(window);
  const exchanges: Exchange[] = [];
  const clone = <T>(value: T): T => window.eval(`(${JSON.stringify(value)})`);
  const active = { root, name: "Dispatch golden", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, source: "opened" };
  Object.defineProperty(window, "structuredClone", { value: clone });

  const port = {
    project: async () => clone({ ok: true, data: { status: { active, recents: [active], recovery: null } } }),
    request: async (value: Parameters<typeof bridge.handle>[0]) => {
      const request = clone(value);
      const response = bridge.handle(request);
      exchanges.push({ request: structuredClone(request), response });

      return clone(response);
    },
  };

  Object.defineProperty(window, "sceneaxiDesktop", { value: port });

  const html = renderDesktopChrome(desktopVisualView(createDesktopVisualState({
    profile: "game",
    detailsOpen: true,
    window: { width: 1600, height: 1000 },
  })));

  const script = /<script>([\s\S]*?)<\/script>/.exec(html);

  if (script?.[1] === undefined) throw new Error("desktop chrome script missing");
  window.document.write(html.replace(script[0], ""));
  window.eval(script[1]);
  await settle(window);
  exchanges.splice(0);
  await click(window, '[data-action="document-reload"]');

  return { window, root, exchanges, port };
}

function observed(exchanges: Exchange[], id: ProvenCommand, input: EditorCommandInvocation["input"], response: Partial<BridgeResponse>) {
  const matches = exchanges.flatMap((exchange) => {
    const request = exchange.request;

    if (!isJsonObject(request) || request.action !== "command") return [];
    const payload = request.payload;

    if (!isJsonObject(payload) || payload.commandId !== id) return [];
    const validated = validateEditorCommandInvocation(payload);
    expect(validated.ok, `${id} registry validation`).toBe(true);

    if (!validated.ok) throw new Error(`${id}: ${validated.reason}`);

    return [{ ...exchange, invocation: validated.invocation }];
  });

  expect(matches.length, `${id} must leave a valid desktop-control invocation`).toBeGreaterThan(0);
  const match = matches.at(-1);

  if (match === undefined) throw new Error(`no valid invocation for ${id}`);
  expect(match.invocation).toMatchObject({ commandId: id, client: "desktop-control", input });
  expect(match.response).toMatchObject(response);

  if (match.response.ok && isJsonObject(match.response.data)) expect(match.response.data.ok).not.toBe(false);

  return match.response;
}

const catalogCases = {
  physics: {
    mutation: { kind: "world-set", gravityY: -7, stepMs: 16, seed: 13, engine: "rapier" },
    kind: "sceneaxi.scene-physics-inspection",
    saved: '"gravityY": -7',
  },
  environment: {
    mutation: { kind: "set", background: "#123456", exposure: 2 },
    kind: "sceneaxi.scene-environment-inspection",
    saved: '"background": "#123456"',
  },
  material: {
    mutation: { kind: "upsert", instanceId: "desktop-crate-beside", emissiveColor: "#123456",
      emissiveIntensity: 2, opacity: 0.5, baseColorMapAssetId: null, normalMapAssetId: null, roughnessMapAssetId: null },
    kind: "sceneaxi.scene-materials-inspection",
    saved: '"opacity": 0.5',
  },
  effect: {
    mutation: { kind: "seed-set", seed: 17 },
    kind: "sceneaxi.scene-effects-inspection",
    saved: '"seed": 17',
  },
} as const;

async function stageProperty(window: HappyWindow) {
  await click(window, '[data-scene-identity="desktop-crate-beside"]');
  await fill(window, "#scene-property-translation-x", "7");
  await click(window, "#scene-property-stage");
  expect(element(window, "[data-change-proposal]").hidden).toBe(false);
}

async function exerciseAssistant(id: ProvenCommand | "assistant-ask" | "assistant-apply-build") {
  let releaseProvider: (() => void) | undefined;
  const providerReady = new Promise<void>((resolve) => { releaseProvider = resolve; });

  const options = id === "assistant-cancel" ? {
    runByoAssistant: async (request: Parameters<NonNullable<Parameters<typeof createDesktopBridge>[0]["runByoAssistant"]>>[0]) => {
      await providerReady;

      return runAssistantSculptAction({ route: "local", prompt: request.prompt, profile: request.profile });
    },
  } : {};

  const { window, root, exchanges, port } = await mount(options);
  const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
  const backend = createThreeSculptPresentationBackend();
  const mounts = createSculptMountApi(backend);
  disposers.push(() => { releaseProvider?.(); mounts.dispose(); });
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("CustomEvent", window.CustomEvent);
  const stage = document.querySelector(".viewport");

  if (stage === null) throw new Error("mounted chrome has no viewport");
  // Imported renderer code runs in Node's realm, unlike the chrome script evaluated in happy-dom.
  const rendererPort = { request: async (request: Parameters<typeof port.request>[0]) => structuredClone(await port.request(request)) };
  expect(installAssistantProductFlow(stage, rendererPort, mounts, backend)).toBe(true);
  window.document.dispatchEvent(new window.CustomEvent(DESKTOP_ASSISTANT_RUNTIME_EVENT, {
    detail: { runtime: "local" },
  }));
  await settle(window);
  exchanges.splice(0);
  await click(window, "#assistant-toggle");
  await click(window, id === "assistant-local-agent" ? "#assistant-mode-agent" : id === "assistant-ask" ? "#assistant-mode-ask" : "#assistant-mode-build");
  await click(window, id === "assistant-byo-build" || id === "assistant-cancel" ? "#assistant-route-byo" : "#assistant-route-local");
  await fill(window, "#assistant-prompt", id === "assistant-ask" ? "What instances are in the hierarchy?" : "Make a service crate");
  await click(window, "#assistant-send");

  if (id === "assistant-ask") {
    await vi.waitFor(() => expect(element(window, ".shell").dataset.assistantBusy).toBe("false"));
    const start = exchanges.find(({ request }) => isJsonObject(request) && request.action === "assistant");
    expect(start).toMatchObject({
      request: { action: "assistant", payload: { op: "start", mode: "ask", route: "local", prompt: "What instances are in the hierarchy?" } },
      response: { ok: true, data: { commandId: "assistant-ask" } },
    });
    expect(exchanges.some(({ request }) => isJsonObject(request) && request.action === "command" &&
      isJsonObject(request.payload) && request.payload.commandId === "assistant-ask")).toBe(false);
    expect(element(window, "[data-assistant-status]").textContent).toBe("Ask answered from typed project state · no provider and no saved bytes.");
  } else if (id === "assistant-byo-build" || id === "assistant-local-agent") {
    const reason = id === "assistant-byo-build" ? "DESKTOP_ASSISTANT_BYO_UNAVAILABLE" : "DESKTOP_RARITY_PROVIDER_UNAVAILABLE";
    observed(exchanges, id, { profile: "@sceneaxi/profile-game", prompt: expect.stringContaining("Make a service crate") }, { ok: false, reason });
    expect(element(window, "[data-assistant-status]").textContent).toContain(reason);
  } else if (id === "assistant-cancel") {
    await click(window, "#sculpt-cancel");
    observed(exchanges, id, { jobId: expect.stringMatching(/^desktop-assistant-/) }, {
      ok: true, data: { status: "refused", refusal: { reason: "DESKTOP_ASSISTANT_ABANDONED" } },
    });
    await vi.waitFor(() => expect(element(window, ".shell").dataset.assistantBusy).toBe("false"));
    // The packaged handler falls back to Local Build after any BYO refusal, including cancellation.
    expect(element(window, "[data-assistant-status]").textContent).toContain("Mounted in the live center viewport");
    releaseProvider?.();
  } else {
    await vi.waitFor(() => expect(element(window, ".shell").dataset.assistantBusy).toBe("false"));

    if (id === "assistant-status") {
      observed(exchanges, id, {}, { ok: true, data: { status: "ready", commandId: "assistant-local-build", result: { ok: true, providerClass: "none" } } });
    } else {
      observed(exchanges, id === "assistant-apply-build" ? "assistant-local-build" : id, { profile: "@sceneaxi/profile-game", prompt: "Make a service crate" },
        { ok: true, data: { commandId: "assistant-local-build", route: "local", status: "running" } });
    }

    expect(element(window, "[data-assistant-status]").textContent).toContain("Mounted in the live center viewport");
    expect(mounts.render()).toMatchObject({ backend: "three", surface: "headless", pixelsDrawn: false, instanceIds: ["assistant-live-output"] });

    if (id === "assistant-apply-build") {
      expect(exchanges.some(({ request }) => isJsonObject(request) && request.action === "command" &&
        isJsonObject(request.payload) && request.payload.commandId === "assistant-apply-build")).toBe(false);
    }
  }

  expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(before);
}

async function exercise(id: ProvenCommand) {
  if (id.startsWith("assistant-")) return exerciseAssistant(id);
  const { window, root, exchanges } = await mount();
  const bytes = () => readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
  const before = bytes();
  const documentInput = { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, profile: "game" };

  for (const [kind, fixture] of Object.entries(catalogCases)) {
    if (id !== `${kind}-inspect` && id !== `${kind}-apply`) continue;

    if (id === `${kind}-inspect`) {
      await click(window, `#${kind}-inspect`);
      observed(exchanges, id, documentInput, { ok: true, data: { kind: fixture.kind } });
      expect(element(window, `[data-catalog-report="${kind}"]`).textContent).toContain(fixture.kind);
      expect(bytes()).toBe(before);
    } else {
      await fill(window, `[data-catalog-mutation="${kind}"]`, JSON.stringify(fixture.mutation));
      await click(window, `#${kind}-stage`);
      observed(exchanges, id, { ...documentInput, mutation: fixture.mutation, expectedContentHash: expect.stringMatching(/^sha256:/) },
        { ok: true, data: { authoringSnapshot: { phase: "reviewing" } } });
      expect(element(window, "[data-change-proposal]").hidden).toBe(false);
      expect(bytes()).toBe(before);
      await click(window, "#change-review-accept");
      expect(bytes()).toContain(fixture.saved);
      expect(bytes()).not.toBe(before);
    }

    return;
  }

  if (id.startsWith("animation-")) {
    await click(window, "#mode-animate");
    await click(window, '[data-action="dock-tab"][data-value="timeline"]');

    if (id === "animation-inspect") {
      observed(exchanges, id, documentInput, { ok: true, data: { kind: "sceneaxi.scene-animation-inspection" } });
      expect(element(window, "[data-timeline-result]").textContent).toContain("sceneaxi.scene-animation-inspection");

      return;
    }

    if (id === "animation-apply") {
      const mutation = { kind: "clip-upsert", clipId: "golden", name: "Golden", startMs: 0, durationMs: 1000 };
      await fill(window, "#timeline-mutation", JSON.stringify(mutation));
      await click(window, "#timeline-apply");
      observed(exchanges, id, { ...documentInput, mutation }, { ok: true, data: { authoringSnapshot: { phase: "reviewing" } } });
      expect(element(window, "[data-change-proposal]").hidden).toBe(false);
      expect(element(window, "[data-timeline-result]").textContent).toContain("Animation edit staged in Change Review");
      expect(bytes()).toBe(before);

      return;
    }

    const saved = bytes();
    await fill(window, "#timeline-time", "250");
    await click(window, id === "animation-scrub" ? "#timeline-scrub" : "#timeline-evaluate");
    observed(exchanges, id, { ...documentInput, timeMs: 250 }, {
      ok: true, data: { kind: "sceneaxi.scene-animation-evaluation", timeMs: 250, savedBytesWritten: false },
    });
    expect(element(window, "[data-timeline-result]").textContent).toContain('"timeMs": 250');
    expect(bytes()).toBe(saved);

    return;
  }

  switch (id) {
    case "change-review-accept":
    case "change-review-reject": {
      await stageProperty(window);
      expect(bytes()).toBe(before);
      await click(window, `#${id}`);
      observed(exchanges, id, {}, { ok: true, data: { phase: id === "change-review-accept" ? "applied" : "rejected" } });
      expect(element(window, "[data-change-proposal]").hidden).toBe(true);

      if (id === "change-review-accept") expect(bytes()).not.toBe(before);
      else expect(bytes()).toBe(before);

      return;
    }

    case "scene-hierarchy-inspect":
      observed(exchanges, id, documentInput, { ok: true, data: { ok: true, hierarchy: { rootInstanceId: "desktop-crate-root" } } });
      expect(element(window, '[data-action="scene-entity-select"]').textContent).toContain("desktop-crate-beside");

      return;
    case "scene-selection-set":
      await click(window, '[data-scene-identity="desktop-crate-stacked"]');
      observed(exchanges, id, { ...documentInput, instanceIds: ["desktop-crate-stacked"] }, {
        ok: true, data: { ok: true, selection: { instanceIds: ["desktop-crate-stacked"], primaryInstanceId: "desktop-crate-stacked" } },
      });
      expect(element(window, "[data-scene-property-entity-id]").textContent).toBe("desktop-crate-stacked");
      expect(bytes()).toBe(before);

      return;
    case "scene-property-set":
      await stageProperty(window);
      observed(exchanges, id, { ...documentInput, instanceId: "desktop-crate-beside", propertyId: "translation-x", newValue: 7 },
        { ok: true, data: { phase: "reviewing" } });
      break;
    case "scene-transform-apply":
      await click(window, '[data-scene-identity="desktop-crate-beside"]');
      await fill(window, "#scene-transform-snap", "0.5");
      await click(window, "#scene-transform-nudge-x-plus");
      observed(exchanges, id, { ...documentInput, instanceIds: ["desktop-crate-beside"], mode: "translate", values: [0.5, 0, 0], snapIncrement: 0.5 },
        { ok: true, data: { phase: "reviewing" } });
      break;
    case "scene-object-create":
    case "scene-object-remove":
    case "scene-object-reparent": {
      await click(window, '[data-scene-identity="desktop-crate-beside"]');

      if (id === "scene-object-reparent") {
        await fill(window, "#scene-instance-parent", "desktop-crate-stacked");
        await fill(window, "#scene-instance-policy", "preserve-local");
      }

      const selector = id === "scene-object-create" ? "#scene-instance-add" : id === "scene-object-remove" ? "#scene-instance-remove" : "#scene-instance-reparent";
      await click(window, selector);

      const input = id === "scene-object-create" ? { sourceInstanceId: "desktop-crate-beside" }
        : id === "scene-object-remove" ? { instanceIds: ["desktop-crate-beside"] }
          : { instanceId: "desktop-crate-beside", parentInstanceId: "desktop-crate-stacked", transformPolicy: "preserve-local" };

      observed(exchanges, id, { ...documentInput, ...input }, { ok: true, data: { phase: "reviewing" } });
      break;
    }

    case "play-inspect":
    case "run-stop":
    case "run-reset": {
      await click(window, '[data-menu-trigger="run"]');
      await click(window, "#menu-command-run-play");
      observed(exchanges, "play-inspect", {}, { ok: true, data: { state: "playing", kind: "sceneaxi.play-session" } });
      // No renderer or frame acknowledgement is forged. The bridge Play session exists before chrome reports the missing viewport.
      expect(element(window, "[data-outcome-code]").textContent).toBe("DESKTOP_VIEWPORT_UNAVAILABLE");
      await click(window, "#overlay-close-outcome-dismiss");
      await click(window, "#mode-run");

      if (id !== "play-inspect") {
        await click(window, `#${id}`);
        observed(exchanges, id, {}, { ok: true, data: { state: id === "run-stop" ? "stopped" : "playing" } });
        expect(element(window, "[data-project-status]").textContent).toContain(id);
      }

      expect(bytes()).toBe(before);

      return;
    }

    default:
      throw new Error(`no GUI exercise for ${id}`);
  }

  expect(element(window, "[data-change-proposal]").hidden).toBe(false);
  expect(bytes()).toBe(before);
  await click(window, "#change-review-accept");
  expect(bytes()).not.toBe(before);
}

describe("mounted desktop controls dispatch through the real bridge", () => {
  it("excludes Ask because the real GUI uses the assistant action rather than a registered command invocation", async () => {
    await exerciseAssistant("assistant-ask");
  });

  it("does not claim Apply Build without the private live-viewport persistence callback", async () => {
    await exerciseAssistant("assistant-apply-build");
  });

  for (const commandId of GUI_REAL_BRIDGE_COMMANDS) {
    it(`proves ${commandId} from its GUI control`, async () => {
      await exercise(commandId);
    });
  }
});
