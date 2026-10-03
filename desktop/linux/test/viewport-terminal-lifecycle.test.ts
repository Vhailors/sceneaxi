import type { DesktopBridge } from "../src/lib/bridge.js";

/** The VM carries native IPC replies to the unchanged renderer boundary parsers. */
type ViewportProtocolInput = Parameters<DesktopBridge["handle"]>[0];

function createElementDataset(): DOMStringMap { return {}; }

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createAudioPlaybackPort, createSculptMountApi } from "@sceneaxi/engine-presentation";
import { describe, expect, it } from "vitest";

const typescript = createRequire(import.meta.url)("typescript");

const bytes = new Uint8Array([79, 103, 103, 83]);

const clip = { assetId: "voice", mediaType: "audio/ogg", digest: "sha256:" + createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.length };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });

  return { promise, resolve, reject };
}

type Mode = "ready" | "input" | "scene" | "open" | "request" | "digest" | "resume" | "decode" | "mount-failure" | "observe-failure" | "cleanup-failure";

/** Execute production modules. Only external DOM/GPU/codec/IPC ports are instrumented;
 * no disposal algorithm or audio/play/open/report implementation is reproduced here. */
function host(mode: Mode = "ready") {
  const calls = { render: 0, resize: 0, loopStop: 0, detach: 0, backendDispose: 0, mountsDispose: 0, release: 0, remove: 0, disconnect: 0, backendCreate: 0, input: 0, contextCreate: 0, close: 0, decode: 0, start: 0, stop: 0, writes: 0, callbacks: 0 };
  const requests: string[] = [];
  const timers: Array<() => void> = [];
  const timerIds = new Map<number, () => void>();
  let nextTimer = 0;
  const raf: Array<() => void> = [];
  const inputWait = deferred<unknown>(), sceneWait = deferred<unknown>(), openWait = deferred<unknown>(), audioWait = deferred<unknown>(), digestWait = deferred<ArrayBuffer>(), resumeWait = deferred<undefined>(), decodeWait = deferred<object>(), frameWait = deferred<unknown>();

  class ElementPort extends EventTarget {
    style = {};
    dataset = new Proxy(createElementDataset(), { set(target, key: string, value: string) { calls.writes++; Reflect.set(target, key, value);

 return true; } });
    parent: ElementPort | null = null;
    children: ElementPort[] = [];
    id = "";
    value = "";
    text = "";
    clientWidth = 100;
    clientHeight = 100;
    ownerDocument!: typeof document;
    set textContent(value: string) { this.text = value; calls.writes++; }
    get textContent() { return this.text; }
    setAttribute() {}
    append(...children: ElementPort[]) { for (const child of children) child.parent = this; this.children.push(...children); }
    prepend(child: ElementPort) { child.parent = this; this.children.unshift(child); }
    querySelector() { return null; }
    remove() { if (this === canvas) calls.remove++;

 if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  }

  const window = new EventTarget();
  const stage = new ElementPort(), canvas = new ElementPort();

  const document = Object.assign(new EventTarget(), {
    readyState: "complete",
    querySelector(selector: string) { return selector === ".viewport" ? stage : null; },
    getElementById(id: string): ElementPort | null { return stage.children.find(child => child.id === id) ?? null; },
    createElement(tag: string) { const element = tag === "canvas" ? canvas : new ElementPort(); element.ownerDocument = document;

 return element; },
  });

  stage.ownerDocument = canvas.ownerDocument = document;
  let frame = () => {}, resize = () => {};

  let services: { signal: AbortSignal; request: (input: ViewportProtocolInput) => Promise<ViewportProtocolInput>; frameMountedContent: () => void; report: { reportFrame: (frame: ViewportProtocolInput, id: string) => void; openPathLine: (text: string) => void } };
  const scene = { ok: true, data: { sceneId: "lifecycle-fixture" } };
  const open = { ok: true, data: { initialDigest: "a".repeat(64), tickDigests: ["b".repeat(64)] } };
  const audioResponse = { ok: true, data: { ...clip, bytesBase64: Buffer.from(bytes).toString("base64") } };

  const backend = { id: "null" as const, label: "instrumented GPU port (no pixels claimed)", camera: {}, mount() {}, update() {}, unmount() {}, frameMountedContent() {}, resize() { calls.resize++; }, render(instanceIds: readonly string[]) { calls.render++;

 return { frame: calls.render, instanceIds, backend: "null" as const, label: "ownership test", drawCalls: 0 }; }, dispose() { calls.backendDispose++;

 if (mode === "cleanup-failure") throw Error("cleanup sentinel"); } };

  const actualMounts = createSculptMountApi(backend);
  const mounts = { ...actualMounts, dispose() { calls.mountsDispose++; actualMounts.dispose(); } };

  class BufferPort { readonly hostBuffer = true; }

  class ContextPort {
    destination = { connect() {} };
    constructor() { calls.contextCreate++; }
    resume() { return mode === "resume" ? resumeWait.promise : Promise.resolve(); }
    async decodeAudioData() { calls.decode++;

 if (mode === "decode") await decodeWait.promise;

 return new BufferPort(); }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createAnalyser() { return { fftSize: 16, connect() {}, getFloatTimeDomainData() {} }; }
    createBufferSource() { return { buffer: null, onended: null, connect() {}, start() { calls.start++; }, stop() { calls.stop++; } }; }
    close() { calls.close++;

 return Promise.resolve(); }
  }

  class CustomEventPort extends Event { constructor(type: string, readonly detail: ViewportProtocolInput) { super(type); } }

  const modules = {
    "@sceneaxi/engine-presentation": { createAudioPlaybackPort, createSculptMountApi() { return mounts; }, createThreeRenderLoop(options: { onFrame: () => void }) { frame = options.onFrame;

 return { start() {}, stop() { calls.loopStop++; } }; }, createThreeSculptPresentationBackend() { calls.backendCreate++;

 return backend; }, releaseThreeCanvas() { calls.release++; } },
    "@sceneaxi/schemas": { DEFAULT_INPUT_ACTION_MAP: {} },
    "@sceneaxi/authoring-core/rarity-evidence": { formatSafeRarityEvidence() { return null; } },
    "../lib/bridge-contract.js": { DESKTOP_BRIDGE_GLOBAL: "sceneaxiDesktopLinux", DESKTOP_ACTIVE_DOCUMENT_PATH: "scene.json" },
    "../../lib/bridge-contract.js": { DESKTOP_ACTIVE_DOCUMENT_PATH: "scene.json", DESKTOP_VIEWPORT_PLAY_EVENT: "play", DESKTOP_VIEWPORT_STOP_EVENT: "stop", DESKTOP_RARITY_PROPOSAL_EVENT: "rarity", PIXELS_META_NAME: "pixels" },
    "./viewport-playback.js": { desktopMountablePayload() { return true; }, mountDesktopScene() { if (mode === "mount-failure") throw Error("mount sentinel");

 return { refusedMaterialOverrides: [] }; } },
    "../viewport-playback.js": { playDesktopSceneAnimations() {}, resetDesktopSceneAnimations() {} },
    "../assistant-inspection.js": { rarityInvalidationMatches() { return false; } },
    "../playback-report.js": { pixelsMetaContent() { return null; }, playableExercise(detail: ViewportProtocolInput) { return detail; } },
    "./byo-configuration.js": { installDesktopByoConfigurationSurface() { return true; } },
    "./features/camera-input.js": { installCameraInput() { const listener = () => { calls.input++; };

 canvas.addEventListener("pointerdown", listener);

 return () => { calls.detach++; canvas.removeEventListener("pointerdown", listener); }; } },
    "./features/play-input.js": { installPlayInput(value: typeof services & { onFrame: (callback: () => void) => void }) { services = value; value.onFrame(() => { calls.callbacks++; }); } },
    "./features/selection.js": { installSelection() {} },
    "./features/gizmo.js": { installGizmo() {} },
    "./features/scene-sync.js": { installSceneSync() {} },
    "./scene-sync.js": { synchronizeScene() { return true; } },
    "./features/assistant-flow.js": { installAssistantFlow() {}, signalAssistantRuntimeUnavailable() {} },
  };

  const globals = {
    document, window, AbortController, Event, CustomEvent: CustomEventPort, AudioContext: ContextPort, AudioBuffer: BufferPort, Uint8Array, Float32Array, Error, AggregateError,
    ResizeObserver: class { constructor(callback: () => void) { resize = callback; } observe() { if (mode === "observe-failure") throw Error("observe sentinel"); } disconnect() { calls.disconnect++; } },
    performance, devicePixelRatio: 1, atob,
    crypto: { subtle: { digest: (_name: string, data: ArrayBuffer) => mode === "digest" ? digestWait.promise : Promise.resolve(Uint8Array.from(createHash("sha256").update(new Uint8Array(data)).digest()).buffer) } },
    setTimeout(callback: () => void) { timers.push(callback); timerIds.set(++nextTimer, callback);

 return nextTimer; },
    clearTimeout(id: number) { const callback = timerIds.get(id);

 if (callback) { const index = timers.indexOf(callback);

 if (index >= 0) timers.splice(index, 1); }

 timerIds.delete(id); }, requestAnimationFrame(callback: () => void) { raf.push(callback);

 return raf.length; }, cancelAnimationFrame() {},
    sceneaxiDesktopLinux: {
      inputActions: () => mode === "input" ? inputWait.promise : Promise.resolve({ ok: true, data: { map: {} } }),
      async request(input: { action: string }) {
        requests.push(input.action);

        if (input.action === "scene") return mode === "scene" ? sceneWait.promise : scene;

        if (input.action === "open-path") return mode === "open" ? openWait.promise : open;

        if (input.action === "audio-asset") return mode === "request" ? audioWait.promise : audioResponse;

        if (input.action === "frame-report") return frameWait.promise;
        throw Error("unexpected IPC: " + input.action);
      },
    },
  };

  function load(path: string) {
    const source = readFileSync(new URL("../src/renderer/" + path, import.meta.url), "utf8");
    const exports = {};
    const code = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(code, { ...globals, exports, require(id: string) { if (!(id in modules)) throw Error("unwired dependency: " + id);

 return Object.getOwnPropertyDescriptor(modules, id)?.value; } });

    return exports;
  }

  const overlay = load("features/overlay-report.ts");
  Object.assign(modules, { "./features/overlay-report.js": overlay, "./overlay-report.js": overlay });
  Object.assign(modules, { "./features/audio-playback.js": load("features/audio-playback.ts") });
  Object.assign(modules, { "./features/play-loop.js": load("features/play-loop.ts") });
  load("viewport.ts");

  const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); await new Promise<void>(resolve => setImmediate(resolve));

 for (let i = 0; i < 30; i++) await Promise.resolve(); };

  return {
    calls, requests, stage, canvas, document, timers, raf, settle,
    hide() { window.dispatchEvent(new Event("pagehide")); },
    frame: () => frame(), resize: () => resize(),
    get services() { return services; },
    get controls() { const controls = stage.children.find(child => child.dataset.audioPlayback === "true");

 if (!controls) throw Error("actual audio controls missing");

 return controls; },
    rejectFrame() { frameWait.reject(Error("frame sentinel")); },
    rejectReadiness() { (mode === "input" ? inputWait : sceneWait).reject(Error("readiness sentinel")); },
    play() { document.dispatchEvent(new CustomEventPort("sceneaxi:desktop-audio-invalidate", { profile: "game" })); document.dispatchEvent(new CustomEventPort("play", { mountable: { audioClips: [clip] }, initialDigest: "a".repeat(64), tickDigests: ["b".repeat(64)] })); },
    clickPlay() { const controls = stage.children.find(child => child.dataset.audioPlayback === "true");

 if (!controls) throw Error("actual audio controls missing"); const button = controls.children[1];

 if (!button) throw Error("actual play button missing"); button.dispatchEvent(new Event("click")); },
    stop() { document.dispatchEvent(new CustomEventPort("stop", null)); },
    resolveAll() { inputWait.resolve({ ok: true, data: { map: {} } }); sceneWait.resolve(scene); openWait.resolve(open); audioWait.resolve(audioResponse); digestWait.resolve(Uint8Array.from(createHash("sha256").update(bytes).digest()).buffer); resumeWait.resolve(undefined); decodeWait.resolve({}); frameWait.resolve({ ok: true }); },
  };
}

describe("actual viewport terminal resource ownership", () => {
  it("stops all allocated root resources once and fences retained entry points", async () => {
    const h = host(); await h.settle();
    h.canvas.dispatchEvent(new Event("pointerdown")); h.frame(); h.resize();
    expect(h.calls).toMatchObject({ input: 1, render: 1, resize: 1, callbacks: 1 });
    h.hide(); h.hide();
    expect(h.calls).toMatchObject({ loopStop: 1, detach: 1, disconnect: 1, mountsDispose: 1, backendDispose: 1, release: 1, remove: 1 });
    const ipc = [...h.requests]; h.frame(); h.resize(); h.services.frameMountedContent(); h.canvas.dispatchEvent(new Event("pointerdown"));
    await expect(h.services.request({ action: "open-path" })).rejects.toThrow("DESKTOP_VIEWPORT_DISPOSED");
    expect(h.requests).toEqual(ipc);
    expect(h.calls).toMatchObject({ input: 1, render: 1, resize: 1, callbacks: 1 });
    const writes = h.calls.writes; h.resolveAll(); await h.settle();
    expect(h.calls.writes).toBe(writes);
  });

  it.each(["input", "scene"] as const)("pagehide during %s readiness cannot allocate or issue later IPC", async mode => {
    const h = host(mode); await h.settle(); const ipc = [...h.requests]; h.hide(); h.resolveAll(); await h.settle(); h.hide();
    expect(h.calls).toMatchObject({ backendCreate: 0, backendDispose: 0, release: 0, remove: 0, contextCreate: 0 });
    expect(h.requests).toEqual(ipc);
  });

  it.each(["input", "scene"] as const)("a rejected %s readiness after pagehide is cancellation, not a late refusal", async mode => {
    const h = host(mode); await h.settle(); h.hide(); const writes = h.calls.writes;
    h.rejectReadiness(); await h.settle();
    expect(h.calls.writes).toBe(writes); expect(h.calls.backendCreate).toBe(0);
  });

  it.each(["input", "scene"] as const)("a live rejected %s readiness still reports a genuine refusal", async mode => {
    const h = host(mode); await h.settle(); h.rejectReadiness(); await h.settle();
    expect(h.document.getElementById("desktop-live-viewport-report")?.textContent).toContain("readiness sentinel");
    expect(h.calls.backendCreate).toBe(0);
  });

  it("reports genuine pre-abort frame rejection but suppresses late rejection and retained reports", async () => {
    const live = host(); await live.settle(); live.frame(); live.rejectFrame(); await live.settle();
    expect(live.document.getElementById("desktop-live-viewport-frame-report")?.textContent).toContain("frame sentinel");
    live.hide();
    const h = host(); await h.settle(); h.frame(); h.hide(); const writes = h.calls.writes, ipc = [...h.requests];
    h.rejectFrame(); await h.settle();
    h.services.report.reportFrame({ frame: 2, instanceIds: [] }, "retained"); h.services.report.openPathLine("retained report");
    expect(h.calls.writes).toBe(writes); expect(h.requests).toEqual(ipc);
  });

  it("pagehide during actual openPath fences its late report", async () => {
    const h = host("open"); await h.settle(); expect(h.requests).toEqual(["scene", "open-path"]);
    h.hide(); const writes = h.calls.writes; h.resolveAll(); await h.settle();
    expect(h.calls.writes).toBe(writes); expect(h.calls.backendDispose).toBe(1);
  });

  it.each(["mount-failure", "observe-failure", "cleanup-failure"] as const)("releases partial allocations after %s even if a release throws", async mode => {
    const h = host(mode); await h.settle();

 if (mode === "cleanup-failure") h.hide(); h.hide();
    expect(h.calls).toMatchObject({ mountsDispose: 1, backendDispose: 1, release: 1, remove: 1 });
    expect(h.calls.detach).toBe(mode === "mount-failure" ? 0 : 1);
    expect(h.calls.disconnect).toBe(mode === "mount-failure" ? 0 : 1);
  });

  it.each(["ready", "request", "digest", "resume", "decode"] as const)("terminal shutdown initiates close synchronously during %s and suppresses late audio work", async mode => {
    const h = host(mode); await h.settle(); h.play(); h.clickPlay(); await h.settle();
    expect(h.calls.contextCreate).toBe(1);

    if (mode === "ready") expect(h.calls.start).toBe(1);

    if (mode === "decode") expect(h.calls.decode).toBe(1);
    const controls = h.controls;
    h.hide(); expect(h.calls.close).toBe(1); h.hide();
    const ipc = [...h.requests], writes = h.calls.writes, starts = h.calls.start, decodes = h.calls.decode;
    h.resolveAll(); await h.settle(); h.play(); h.stop();

    for (const child of controls.children) { child.dispatchEvent(new Event("click")); child.dispatchEvent(new Event("input")); }

    for (const callback of h.timers.splice(0)) callback();

 for (const callback of h.raf.splice(0)) callback(); await h.settle();
    expect(h.calls).toMatchObject({ close: 1, start: starts, decode: decodes, writes });
    expect(h.requests).toEqual(ipc);
  });

  it("terminal shutdown also closes controls retired by a normal stop before its 100ms measurement", async () => {
    const h = host(); await h.settle(); h.play(); h.clickPlay(); await h.settle(); h.stop();
    expect(h.calls.close).toBe(0); expect(h.timers.length).toBe(1);
    h.hide(); expect(h.calls.close).toBe(1); expect(h.timers).toHaveLength(0);

    for (const callback of h.timers.splice(0)) callback(); await h.settle(); expect(h.calls.close).toBe(1);
  });
});
