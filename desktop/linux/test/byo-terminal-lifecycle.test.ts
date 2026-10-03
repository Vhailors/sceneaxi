import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { Window, EventTarget as DomEventTarget } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installDesktopByoConfigurationSurface, type DesktopByoConfigurationPort } from "../src/renderer/byo-configuration.js";
import type { DesktopByoConfigurationRequest, DesktopByoConfigurationResponse } from "../src/lib/byo-configuration-contract.js";

const typescript = createRequire(import.meta.url)("typescript");

const windows: Window[] = [];

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals();

 for (const window of windows.splice(0)) window.close(); });

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });

  return { promise, resolve, reject };
}

const response: DesktopByoConfigurationResponse = { ok: true, action: "status", provider: "opencode", providerLabel: "OpenCode", keyStatus: "configured", operation: "status", storageStatus: "ready", runtimeStatus: "ready" };

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise<void>(resolve => setImmediate(resolve)); };

function fixture(route = "byo", profile = "game") {
  const window = new Window(); windows.push(window);
  vi.stubGlobal("document", window.document); vi.stubGlobal("Element", window.Element);
  window.document.body.innerHTML = `<div class="shell" data-profile="${profile}" data-assistant-route="${route}"><div class="viewport"></div><div class="assistant-routes"><button id="assistant-route-byo" data-action="assistant-route" aria-controls="prior" aria-expanded="false"></button></div></div>`;
  const shell = window.document.querySelector(".shell");
  const routeButton = window.document.querySelector("#assistant-route-byo");

  if (!shell || !routeButton) throw Error("missing fixture shell");

  return { window, shell, routeButton };
}

function controls(window: Window) {
  const surface = window.document.querySelector("#desktop-byo-configuration");
  const key = surface?.querySelector("input"), provider = surface?.querySelector("select");
  const buttons = surface?.querySelectorAll("button");
  const save = buttons?.[0], remove = buttons?.[1];

  if (!surface || !key || !provider || !save || !remove) throw Error("missing actual BYOK controls");

  return { surface, key, provider, save, remove };
}

/** Production root module, actual imported BYOK installer. Scene readiness is the
 * deferred external IPC port; GPU/features never reached, and are not claimed. */
type RootPort = DesktopByoConfigurationPort & Readonly<{ otherCapability?: () => string }>;

function startRoot(window: Window, port: RootPort) {
  const scene = deferred<unknown>();
  const requests: string[] = [];

  const deps = {
    "@sceneaxi/engine-presentation": {}, "@sceneaxi/schemas": { DEFAULT_INPUT_ACTION_MAP: {} },
    "../lib/bridge-contract.js": { DESKTOP_BRIDGE_GLOBAL: "sceneaxiDesktopLinux", DESKTOP_ACTIVE_DOCUMENT_PATH: "scene.json" },
    "./byo-configuration.js": { installDesktopByoConfigurationSurface },
    "./features/audio-playback.js": { installDesktopAudioProfileBoundary: () => ({ dispose() {} }) },
    "./features/overlay-report.js": { openPathLine() {}, reportLine() {}, refusalText: String },
    "./features/assistant-flow.js": { signalAssistantRuntimeUnavailable() {} },
  };

  type FixtureModule = (typeof deps)[keyof typeof deps];

  const modules = new Map<string, FixtureModule>(Object.entries(deps));

  const source = readFileSync(new URL("../src/renderer/viewport.ts", import.meta.url), "utf8");
  const code = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, {
    exports: {}, require: (id: string) => modules.get(id) ?? {}, document: window.document, window,
    AbortController, Error, AggregateError,
    sceneaxiDesktopLinux: { ...port, async request(input: { action: string }) { requests.push(input.action);

 return scene.promise; } },
  });

  return { requests, hide: () => window.dispatchEvent(new window.Event("pagehide")), finish: () => scene.resolve({ ok: false }) };
}

describe("actual BYOK installer terminal lifetime", () => {
  for (const root of [false, true]) {
    for (const action of ["status", "save", "remove"] as const) {
      it.each(["success", "rejection"] as const)(`${root ? "root pagehide" : "installer abort"}: pending ${action} %s settles without late DOM or IPC`, async outcome => {
        const f = fixture(action === "status" ? "byo" : "local");
        const wait = deferred<DesktopByoConfigurationResponse>();
        let settled = 0;
        void wait.promise.then(() => { settled++; }, () => { settled++; });
        const configureByo = vi.fn<(input: DesktopByoConfigurationRequest) => Promise<DesktopByoConfigurationResponse>>(() => wait.promise);
        const lifetime = new AbortController();
        const h = root ? startRoot(f.window, { configureByo, otherCapability: () => "preserved" }) : null;

        if (!root) expect(installDesktopByoConfigurationSurface({ configureByo }, { signal: lifetime.signal })).toBe(true);
        const c = controls(f.window);

        if (action === "save") { c.key.value = "synthetic-private-key"; c.save.click(); expect(c.key.value).toBe(""); }

        if (action === "remove") c.remove.click();
        expect(configureByo).toHaveBeenCalledTimes(1);
        expect(configureByo.mock.calls[0]?.[0]).toMatchObject({ action, profile: "@sceneaxi/profile-game", provider: "opencode" });

        if (root) h?.hide(); else lifetime.abort();
        expect(c.surface.isConnected).toBe(false);
        expect(f.routeButton.getAttribute("aria-controls")).toBe("prior");
        expect(f.routeButton.getAttribute("aria-expanded")).toBe("false");
        const before = c.surface.outerHTML;
        c.key.value = "disposed sentinel";
        const mutations: unknown[] = [];
        const observer = new f.window.MutationObserver(records => mutations.push(...records));
        observer.observe(c.surface, { subtree: true, attributes: true, childList: true, characterData: true });

        if (outcome === "success") wait.resolve(response); else wait.reject(Error("synthetic-private-key"));
        h?.finish(); await settle();
        c.save.dispatchEvent(new f.window.Event("click")); c.remove.dispatchEvent(new f.window.Event("click"));
        c.provider.dispatchEvent(new f.window.Event("change")); f.routeButton.dispatchEvent(new f.window.Event("click", { bubbles: true }));

        if (root) h?.hide(); else lifetime.abort();
        await settle();
        expect(settled).toBe(1); expect(configureByo).toHaveBeenCalledTimes(1);
        expect(c.surface.outerHTML).toBe(before); expect(c.key.value).toBe("disposed sentinel");
        expect([...mutations, ...observer.takeRecords()]).toHaveLength(0); observer.disconnect();

        if (h) expect(h.requests).toEqual(["scene"]);
      });
    }
  }

  it.each(["status", "save", "remove"] as const)("abort settles the pending %s renderer task before the IPC promise resolves", async action => {
    const f = fixture(action === "status" ? "byo" : "local");
    const lifetime = new AbortController();
    const wait = deferred<DesktopByoConfigurationResponse>();
    const add = vi.spyOn(lifetime.signal, "addEventListener");
    const remove = vi.spyOn(lifetime.signal, "removeEventListener");
    const configureByo = vi.fn<(input: DesktopByoConfigurationRequest) => Promise<DesktopByoConfigurationResponse>>(() => wait.promise);
    expect(installDesktopByoConfigurationSurface({ configureByo }, { signal: lifetime.signal })).toBe(true);
    const c = controls(f.window);

    if (action === "save") { c.key.value = "synthetic-key"; c.save.click(); }

    if (action === "remove") c.remove.click();
    expect(configureByo).toHaveBeenCalledTimes(1);
    // The real request's abort listener is released in its finally, proving its
    // await completed without resolving the privileged IPC promise below.
    const bindings = add.mock.calls.filter(call => call[0] === "abort");
    expect(bindings).toHaveLength(2);
    lifetime.abort();
    await settle();
    expect(c.surface.isConnected).toBe(false);

    for (const binding of bindings) {
      expect(remove.mock.calls.some(call => call[0] === "abort" && call[1] === binding[1])).toBe(true);
    }

    const before = c.surface.outerHTML;
    wait.reject(Error("late private IPC error"));
    await settle();
    expect(c.surface.outerHTML).toBe(before);
    expect(configureByo).toHaveBeenCalledTimes(1);
  });

  it.each(["success", "rejection"] as const)("a live %s releases the per-request abort binding and still renders", async outcome => {
    const f = fixture();
    const lifetime = new AbortController();
    const wait = deferred<DesktopByoConfigurationResponse>();
    const add = vi.spyOn(lifetime.signal, "addEventListener");
    const remove = vi.spyOn(lifetime.signal, "removeEventListener");
    expect(installDesktopByoConfigurationSurface({ configureByo: () => wait.promise }, { signal: lifetime.signal })).toBe(true);
    const c = controls(f.window);
    const bindings = add.mock.calls.filter(call => call[0] === "abort");
    expect(bindings).toHaveLength(2);

    if (outcome === "success") wait.resolve(response);
    else wait.reject(Error("private IPC error"));
    await settle();
    expect(lifetime.signal.aborted).toBe(false);
    expect(c.surface.isConnected).toBe(true);
    expect(c.surface.textContent).toContain(outcome === "success" ? "BYOK is ready for this provider." : "request failed");
    expect(remove.mock.calls).toHaveLength(1);
    expect(remove.mock.calls[0]?.[1]).toBe(bindings[1]?.[1]);
    lifetime.abort();
    expect(c.surface.isConnected).toBe(false);
  });

  it("physically removes all registered listeners and fences a queued route microtask", async () => {
    const f = fixture("local"), lifetime = new AbortController(), configureByo = vi.fn<(input: DesktopByoConfigurationRequest) => Promise<DesktopByoConfigurationResponse>>(async () => response);
    const add = vi.spyOn(DomEventTarget.prototype, "addEventListener");
    const remove = vi.spyOn(DomEventTarget.prototype, "removeEventListener");
    expect(installDesktopByoConfigurationSurface({ configureByo }, { signal: lifetime.signal })).toBe(true);
    const bound = add.mock.calls.map((args, i) => ({ args, target: add.mock.instances[i] })).filter(({ args }) => args[0] === "click" || args[0] === "change");
    expect(bound).toHaveLength(4);
    f.shell.setAttribute("data-assistant-route", "byo"); f.routeButton.dispatchEvent(new f.window.Event("click", { bubbles: true })); lifetime.abort();

    for (const { args, target } of bound) expect(remove.mock.calls.some((call, i) => remove.mock.instances[i] === target && call[0] === args[0] && call[1] === args[1])).toBe(true);
    await settle(); expect(configureByo).not.toHaveBeenCalled();
  });
  it("a pre-aborted lifetime refuses installation before DOM allocation or IPC", () => {
    const f = fixture(), lifetime = new AbortController(), configureByo = vi.fn<(input: DesktopByoConfigurationRequest) => Promise<DesktopByoConfigurationResponse>>(async () => response);
    lifetime.abort(); const before = f.window.document.documentElement.outerHTML;
    expect(installDesktopByoConfigurationSurface({ configureByo }, { signal: lifetime.signal })).toBe(false);
    expect(f.window.document.documentElement.outerHTML).toBe(before); expect(configureByo).not.toHaveBeenCalled();
  });
  it("the original boolean/no-options API retains normal status, provider, save and remove behavior", async () => {
    const f = fixture(), configureByo = vi.fn<(input: DesktopByoConfigurationRequest) => Promise<DesktopByoConfigurationResponse>>(async () => response);
    expect(installDesktopByoConfigurationSurface({ configureByo })).toBe(true); await settle();
    const c = controls(f.window); expect(c.key.disabled).toBe(false); expect(c.remove.disabled).toBe(false);
    c.provider.value = "openrouter"; c.key.value = "synthetic-key"; c.save.click(); expect(c.key.value).toBe(""); await settle();
    expect(configureByo.mock.calls[1]?.[0]).toEqual({ action: "save", profile: "@sceneaxi/profile-game", provider: "openrouter", key: "synthetic-key" });
    c.remove.click(); await settle(); expect(configureByo.mock.calls[2]?.[0]).toMatchObject({ action: "remove", provider: "openrouter" });
    expect(c.surface.textContent).not.toContain("synthetic-key"); expect(f.shell.getAttribute("data-assistant-route")).toBe("byo");
  });
  it("same-turn Kids save clears the field without secure-storage admission", async () => {
    const f = fixture("local"), configureByo = vi.fn<(input: DesktopByoConfigurationRequest) => Promise<DesktopByoConfigurationResponse>>(async () => response);
    expect(installDesktopByoConfigurationSurface({ configureByo })).toBe(true); const c = controls(f.window);
    c.key.value = "synthetic-key"; f.shell.setAttribute("data-profile", "kids"); c.save.click(); c.remove.click(); c.provider.dispatchEvent(new f.window.Event("change"));
    await settle(); expect(c.key.value).toBe(""); expect(configureByo).not.toHaveBeenCalled();
  });
  it("live IPC failure still renders a generic refusal without thrown key internals", async () => {
    const f = fixture(); expect(installDesktopByoConfigurationSurface({ configureByo: async () => { throw Error("synthetic-private-key"); } })).toBe(true);
    await settle(); const c = controls(f.window); expect(c.surface.textContent).toContain("request failed"); expect(c.surface.textContent).not.toContain("synthetic-private-key");
  });
  it("missing privileged channel retains the named unavailable surface", async () => {
    const f = fixture(); expect(installDesktopByoConfigurationSurface({})).toBe(true); await settle();
    expect(controls(f.window).surface.textContent).toContain("not exposed");
  });
});
