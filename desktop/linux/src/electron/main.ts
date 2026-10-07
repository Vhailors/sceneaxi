/**
 * Electron main process: window lifecycle, the bridge adapter, and the smoke mode.
 *
 * Everything decided lives in `src/lib/` (gate-tested without Electron); this file
 * adapts it: `ipcMain.handle` serves the synchronous bridge, the window loads the
 * build-time Engine Desktop chrome document, and `--smoke` runs the packaged-app
 * proof — handshake, real kernel open path, typed edit/review/save/reopen/Play in
 * a scratch project, a verified static Web export, and the renderer's real frame
 * report — then prints one JSON line and exits, so CI can assert the packaged
 * binary is not only a static HTML document.
 *
 * The window is locked down: context isolation on, sandbox on, no node integration,
 * and navigation away from the packaged document is refused.
 */
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { types } from "node:util";
import { BrowserWindow, Menu, app, crashReporter, dialog, ipcMain, shell } from "electron";
import { DESKTOP_MINIMUM_WINDOW, SURFACE } from "@sceneaxi/desktop-shell";
import { runAssistantSculptAction, inspectProjectModel } from "@sceneaxi/authoring-core";
import {
  createEditorCommandInvocation,
  EXTENSION_SEAM_REFUSALS,
  parseDeliveryHandoffText,
  PROJECT_MANIFEST_PATH,
} from "@sceneaxi/schemas";
import { CONTAINED_GLTF_REFUSALS, PROJECT_ASSET_MAX_BYTES,
  ASSET_PREPARATION_REFUSALS } from "@sceneaxi/importers";
import { DESKTOP_BYO_CONFIGURATION_CHANNEL } from "../lib/byo-configuration-contract.js";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_ASSET_IMPORT_CHANNEL,
  DESKTOP_BRIDGE_CHANNEL,
  DESKTOP_VIEWPORT_STOP_EVENT,
  bridgeRefuse,
  bridgeOk,
  type DesktopBridgeResponse,
  type DesktopFrameReport,
} from "../lib/bridge-contract.js";
import { createDesktopBridge, type DesktopBridge } from "../lib/bridge.js";
import { initializeDesktopScenePhysics } from "../lib/desktop-scene.js";
import { DESKTOP_SCENE_TRANSLATION_X_PROPERTY } from "../lib/desktop-scene.js";
import {
  resolveDesktopLocalBridgePaths,
  startDesktopLocalBridgeServer,
  type DesktopLocalBridgeServer,
} from "../lib/local-rpc.js";
import { seedDesktopProject } from "../lib/project-seed.js";
import { DESKTOP_INPUT_ACTIONS_CHANNEL } from "../lib/input-action-contract.js";
import {
  desktopProcessLossNeedsRecovery,
  mapDesktopDiagnosticEvent,
  pruneDesktopCrashDumps,
  recordDesktopDiagnostic,
} from "../lib/diagnostics.js";
import {
  createDesktopInputActionHost,
  type DesktopInputActionHost,
} from "../lib/input-action-host.js";
import {
  createDesktopProjectHost,
  desktopProjectReloadRequired,
} from "../lib/project-host.js";
import {
  DESKTOP_PROJECT_CHANNEL,
  DESKTOP_PROJECT_REFUSALS,
} from "../lib/project-lifecycle-contract.js";
import { createDesktopProjectLifecycle } from "../lib/project-lifecycle.js";
import {
  DESKTOP_PROJECT_BROWSER_CHANNEL,
  DESKTOP_PROJECT_BROWSER_REFUSALS,
  projectBrowserRefuse,
} from "../lib/project-browser-contract.js";
import {
  createDesktopProjectBrowser,
  type DesktopProjectBrowser,
} from "../lib/project-browser.js";
import { DESKTOP_WEB_EXPORT_REFUSALS } from "../lib/web-export.js";
import { createElectronProviderKeyStore } from "./provider-key-store.js";
import {
  createDesktopOpenCodeProviderSession,
  createDesktopRarityFixtureProvider,
  createPrivilegedDesktopByoRuntime,
} from "./provider-runtime.js";

/** Mutable, presence-sensitive fields retain their owner types without present undefined values. */
type DesktopOptionalFields<Value> = { -readonly [Key in keyof Value]?: Exclude<Value[Key], undefined> };

/** Values crossing desktop IPC, event, and exception boundaries before field validation. */
type NativePerformanceProof = {
  samples: readonly Record<"Buffer" | "Texture" | "Program" | "Framebuffer" | "Renderbuffer", number>[];
  latencyMs: readonly number[];
  maximumAssetBytes: number;
  oversizeRefusal: string;
  importReloadCycles: number;
  canvases: number;
};

/** The bridge owns validation of raw native IPC and script proof payloads. */
type DesktopBoundaryValue = Parameters<ReturnType<typeof createDesktopBridge>["handle"]>[0];

function isDesktopText<Value>(value: Value): value is Value & string {
  return typeof value === "string";
}

function isDesktopNumber<Value>(value: Value): value is Value & number {
  return typeof value === "number";
}

// The bundle is CJS (Electron's main entry), so the native `__dirname` is real.
declare const __dirname: string;

const SMOKE = process.argv.includes("--smoke");

const DIAGNOSTICS_SMOKE = process.argv.includes("--diagnostics-smoke");

const ASSET_CAPACITY_SMOKE = SMOKE && (process.argv.includes("--asset-capacity") || process.env["SCENEAXI_SMOKE_ASSET_CAPACITY"] === "1");

const SMOKE_TIMEOUT_MS = 45_000;

if (process.platform === "linux") {
  // Cinnamon/GNOME otherwise select Chromium basic_text, which this host refuses.
  app.commandLine.appendSwitch("password-store", "gnome-libsecret");
}

/**
 * Unpackaged `electron dist/main.cjs` otherwise writes to ~/.config/Electron,
 * so a key saved by the packaged app is invisible and Send looks dead.
 * Pin the same userData the packaged productName already uses.
 */
if (!app.isPackaged) {
  app.setName("sceneaxi-engine-desktop");
  app.setPath("userData", join(app.getPath("appData"), "sceneaxi-engine-desktop"));
}

if (DIAGNOSTICS_SMOKE && (
  !process.env["XDG_CONFIG_HOME"] ||
  !app.getPath("userData").startsWith(`${process.env["XDG_CONFIG_HOME"]}${sep}`)
)) {
  throw new Error("Diagnostics smoke requires an isolated XDG_CONFIG_HOME.");
}

const logsDirectory = join(app.getPath("userData"), "logs");

mkdirSync(logsDirectory, { recursive: true, mode: 0o700 });

const crashDumpsDirectory = join(logsDirectory, "crashDumps");

mkdirSync(crashDumpsDirectory, { recursive: true, mode: 0o700 });

app.setAppLogsPath(logsDirectory);

app.setPath("crashDumps", crashDumpsDirectory);

// Raw minidumps can contain decrypted credentials. Explicit local diagnostic consent
// is the only opt-in; structured redacted crash/recovery events remain default-on.
const sensitiveDumpConsent = process.env["SCENEAXI_LOCAL_CRASH_DUMPS"] === "1";

pruneDesktopCrashDumps(crashDumpsDirectory, sensitiveDumpConsent ? 5 : 0);

if (sensitiveDumpConsent) crashReporter.start({ uploadToServer: false });

/** Active document name shared by explicit projects and the isolated smoke. */
const SAMPLE_DOCUMENT = DESKTOP_ACTIVE_DOCUMENT_PATH;

function seedProject(dir: string): void {
  const seeded = seedDesktopProject(dir);

  if (!seeded.ok) console.error("desktop-linux: could not seed the sample document", seeded);
}

/** The retired implicit seed location, retained only as a smoke safety boundary. */
function retiredImplicitProjectDir(): string {
  return join(app.getPath("userData"), "project");
}

/**
 * The smoke's project: a fresh directory per run, never the persistent one.
 *
 * The proof asserts what staging and Save did to a document, then reopens and
 * plays it, so it has to own that document: a selected project can already hold
 * an edited, invalid, or mid-transaction file, any of which could make the proof
 * line report a round trip it did not perform.
 */
function smokeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-smoke-"));
  seedProject(dir);
  execFileSync("git", ["init", "--quiet", dir], { stdio: "ignore" });
  execFileSync("git", [
    "-C", dir,
    "-c", "user.name=SceneAxi Smoke",
    "-c", "user.email=smoke@sceneaxi.invalid",
    "commit", "--allow-empty", "--quiet", "-m", "smoke fixture baseline",
  ], { stdio: "ignore" });

  return dir;
}

function smokeUndecodableOggBytes(): Buffer {
  const bytes = Buffer.alloc(27);
  bytes.write("OggS", 0, "ascii");

  return bytes;
}

function smokeAudioBytes(): Buffer {
  const sampleRate = 44_100;
  const frames = sampleRate * 2;
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(bytes.byteLength - 8, 4);
  bytes.write("WAVEfmt ", 8, "ascii");
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36, "ascii");
  bytes.writeUInt32LE(frames * 2, 40);

  for (let frame = 0; frame < frames; frame += 1) {
    bytes.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * frame) / sampleRate) * 12_000), 44 + frame * 2);
  }

  return bytes;
}

async function clickRendererControl(
  window: BrowserWindow,
  selector: string,
  text?: string,
  position = 0.5,
): Promise<boolean> {
  const target = await window.webContents.executeJavaScript(`(() => {
    const elements = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const element = elements.find((candidate) =>
      candidate instanceof HTMLElement &&
      candidate.getBoundingClientRect().width > 0 &&
      candidate.getBoundingClientRect().height > 0 &&
      ${text === undefined ? "true" : `candidate.textContent?.trim() === ${JSON.stringify(text)}`});
    if (!(element instanceof HTMLElement)) return null;
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = element.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width * ${position});
    const y = Math.round(rect.top + rect.height / 2);
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: hit === element || element.contains(hit), hitTag: hit?.tagName ?? null };
  })()`);

  if (target === null || target.hit !== true) {
    const candidates = await window.webContents.executeJavaScript(`(() => [...document.querySelectorAll(${JSON.stringify(selector)})].map((element) => ({
      tag: element.tagName,
      text: element.textContent?.trim().slice(0, 80),
      hidden: element.hidden,
      parentHidden: element.closest('[hidden]')?.tagName ?? null,
      rect: (() => { const rect = element.getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height]; })(),
      mode: document.querySelector('.shell')?.dataset.mode,
      inspectorVisible: getComputedStyle(document.querySelector('.inspector')).display,
    })))()`);

    throw new Error(`Electron pointer hit-test failed for ${selector}: ${JSON.stringify({ target, candidates })}`);
  }

  const point = { x: target.x, y: target.y };
  window.webContents.sendInputEvent({ type: "mouseMove", ...point });
  window.webContents.sendInputEvent({ type: "mouseDown", ...point, button: "left", clickCount: 1 });
  window.webContents.sendInputEvent({ type: "mouseUp", ...point, button: "left", clickCount: 1 });

  return true;
}

async function waitForRenderer(window: BrowserWindow, expression: string): Promise<boolean> {
  return await window.webContents.executeJavaScript(`(async () => {
    for (let attempt = 0; attempt < 1500; attempt += 1) {
      if (${expression}) return true;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return false;
  })()`);
}

async function fillRendererCommandField(
  window: BrowserWindow,
  commandId: string,
  fieldName: string,
  value: string,
): Promise<boolean> {
  return await window.webContents.executeJavaScript(`(() => {
    const selector = ${JSON.stringify(commandId === "viewport-source-set"
      ? `[data-command-field="${fieldName}"]`
      : `[data-editor-command-form="${commandId}"] [data-command-field="${fieldName}"]`)};
    const field = document.querySelector(selector);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return false;
    if (field instanceof HTMLSelectElement && ![...field.options].some((option) => option.value === ${JSON.stringify(value)})) return false;
    field.focus();
    field.value = ${JSON.stringify(value)};
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return field.value === ${JSON.stringify(value)};
  })()`);
}

async function rendererOutcome(window: BrowserWindow) {
  return await window.webContents.executeJavaScript(`(() => {
    const dialog = document.querySelector('[data-overlay="outcome"]');
    return {
      visible: dialog instanceof HTMLElement && !dialog.hidden,
      title: document.querySelector('[data-outcome-title]')?.textContent ?? '',
      code: document.querySelector('[data-outcome-code]')?.textContent ?? '',
      message: document.querySelector('[data-outcome-message]')?.textContent ?? '',
    };
  })()`);
}

async function dismissRendererOutcome(window: BrowserWindow): Promise<void> {
  const outcome = await rendererOutcome(window);

  if (!outcome.visible) return;
  await clickRendererControl(window, '[data-overlay="outcome"] [data-action="overlay"][data-value="none"]');

  if (!await waitForRenderer(window, "document.querySelector('[data-overlay=\"outcome\"]')?.hidden === true")) {
    throw new Error("the outcome dialog did not close through its own GUI control");
  }
}

async function runAudioResetSmokeProof(window: BrowserWindow): Promise<boolean> {
  await clickRendererControl(window, '[data-command="run-play"]');

  if (!await waitForRenderer(window, "document.querySelector('[data-audio-playback]') !== null")) return false;
  await clickRendererControl(window, '[data-audio-playback] button', 'Play tone');

  if (!await waitForRenderer(window, "document.querySelector('[data-audio-playback] button')?.dataset.audioState === 'started'")) return false;
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('[data-audio-playback] button')].find((item) => item.textContent === 'Play tone');
    globalThis.__sceneaxiAudioResetButton = button;
    globalThis.__sceneaxiAudioResetControls = button?.closest('[data-audio-playback]');
  })()`);
  await clickRendererControl(window, '[data-command="run-reset"]');

  return await waitForRenderer(window, "globalThis.__sceneaxiAudioResetButton?.dataset.audioState === 'stopped' && globalThis.__sceneaxiAudioResetControls?.dataset.audioContextDisposed === 'true' && document.querySelector('[data-audio-playback]') === null");
}

async function runAudioDecodeRefusalSmokeProof(window: BrowserWindow): Promise<boolean> {
  await clickRendererControl(window, '[data-command="run-play"]');

  if (!await waitForRenderer(window, "document.querySelector('[data-audio-playback]') !== null")) return false;
  await clickRendererControl(window, '[data-audio-playback] button', 'Play undecodable');

  if (!await waitForRenderer(window, "document.getElementById('desktop-live-viewport-open-path')?.textContent?.includes('AUDIO_DECODE_FAILED undecodable') === true")) return false;
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('[data-audio-playback] button')].find((item) => item.textContent === 'Play undecodable');
    globalThis.__sceneaxiAudioDecodeButton = button;
    globalThis.__sceneaxiAudioDecodeControls = button?.closest('[data-audio-playback]');
  })()`);
  await clickRendererControl(window, '[data-command="run-stop"]');

  return await waitForRenderer(window, "globalThis.__sceneaxiAudioDecodeControls?.dataset.audioContextDisposed === 'true'");
}

/**
 * Bring the window to where a user would press Play for audio: no outcome dialog
 * over the stage and, unless the caller only needs Play, the Game Run room.
 */
async function prepareAudioPlay(window: BrowserWindow, gameRunRoom = true): Promise<void> {
  if (await window.webContents.executeJavaScript(`document.querySelector('.shell')?.dataset.overlay === 'outcome'`)) {
    await clickRendererControl(window, '[data-overlay="outcome"] [data-action="overlay"][data-value="none"]');

    if (!await waitForRenderer(window, "document.querySelector('.shell')?.dataset.overlay === 'none'")) {
      throw new Error("the outcome dialog did not close before audio Play");
    }
  }

  if (!gameRunRoom) return;

  // Stop and Reset live in the Game profile's Run room.
  if (await window.webContents.executeJavaScript(`document.querySelector('.shell')?.dataset.profile !== 'game'`)) {
    await clickRendererControl(window, '.profile-chip[data-value="game"]');

    if (!await waitForRenderer(window, "document.querySelector('.shell')?.dataset.profile === 'game'")) {
      throw new Error("the Game profile did not open before audio Play");
    }
  }

  if (await window.webContents.executeJavaScript(`document.querySelector('.shell')?.dataset.mode !== 'run'`)) {
    await clickRendererControl(window, '[data-action="mode"][data-value="run"]');

    if (!await waitForRenderer(window, "document.querySelector('.shell')?.dataset.mode === 'run'")) {
      throw new Error("the Run room did not open before audio Play");
    }
  }
}

async function runAudioKidsProfileSmokeProof(window: BrowserWindow): Promise<boolean> {
  await clickRendererControl(window, '[data-command="run-play"]');

  if (!await waitForRenderer(window, "document.querySelector('[data-audio-playback]') !== null")) return false;
  await clickRendererControl(window, '[data-audio-playback] button', 'Play tone');

  if (!await waitForRenderer(window, "document.querySelector('[data-audio-playback] button')?.dataset.audioState === 'started'")) return false;
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('[data-audio-playback] button')].find((item) => item.textContent === 'Play tone');
    globalThis.__sceneaxiAudioKidsButton = button;
    globalThis.__sceneaxiAudioKidsControls = button?.closest('[data-audio-playback]');
  })()`);
  await clickRendererControl(window, '.profile-chip[data-value="kids"]');
  const stopped = await waitForRenderer(window, "document.querySelector('.shell')?.dataset.profile === 'kids' && globalThis.__sceneaxiAudioKidsButton?.dataset.audioState === 'stopped' && globalThis.__sceneaxiAudioKidsControls?.dataset.audioContextDisposed === 'true' && document.querySelector('.profile-refusal[role=alert]')?.textContent?.includes('OPEN_PATH_KIDS_REFUSED') === true && document.querySelector('[data-audio-playback]') === null");
  await clickRendererControl(window, '.profile-chip[data-value="game"]');

  return stopped && await waitForRenderer(window, "document.querySelector('.shell')?.dataset.profile === 'game'");
}

async function runAudioProjectSwitchSmokeProof(
  window: BrowserWindow,
  switchProject: () => Promise<void>,
): Promise<boolean> {
  await prepareAudioPlay(window);
  await clickRendererControl(window, '[data-command="run-play"]');

  if (!await waitForRenderer(window, "document.querySelector('[data-audio-playback]') !== null")) {
    throw new Error(`project-switch audio: Play mounted no audio controls: ${await window.webContents.executeJavaScript("document.querySelector('[data-product-run-report]')?.textContent ?? document.querySelector('[data-project-status]')?.textContent ?? ''")}`);
  }

  await clickRendererControl(window, '[data-audio-playback] button', 'Play tone');
  let toneStarted = false;

  for (let attempt = 0; attempt < 3 && !toneStarted; attempt += 1) {
    toneStarted = await waitForRenderer(window, "document.querySelector('[data-audio-playback] button')?.dataset.audioState === 'started'");
  }

  if (!toneStarted) {
    throw new Error(`project-switch audio: the tone did not start: ${await window.webContents.executeJavaScript("[document.getElementById('desktop-live-viewport-open-path')?.textContent, [...document.querySelectorAll('[data-audio-playback] button')].map((b) => b.textContent + '=' + (b.dataset.audioState ?? '')).join(','), document.querySelector('.shell')?.dataset.profile].join(' | ')")}`);
  }

  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('[data-audio-playback] button')].find((item) => item.textContent === 'Play tone');
    globalThis.__sceneaxiAudioSmokeButton = button;
    globalThis.__sceneaxiAudioSmokeControls = button?.closest('[data-audio-playback]');
  })()`);
  await switchProject();

  return await waitForRenderer(window, "globalThis.__sceneaxiAudioSmokeButton?.dataset.audioState === 'stopped' && globalThis.__sceneaxiAudioSmokeControls?.dataset.audioContextDisposed === 'true' && document.querySelector('[data-audio-playback]') === null");
}

async function runAudioSmokeProof(window: BrowserWindow): Promise<{
  duration: number;
  sampleRate: number;
  channels: number;
  volume: number;
  gain: number;
  sourceStarted: boolean;
  offlineRms: number;
  liveRms: number;
  stoppedRms: number;
  stopped: boolean;
  contextDisposed: boolean;
  pointerTargets: Readonly<{ volume: boolean; play: boolean }>;
}> {
  // The feature proofs end with Stop and Reset, which dispose the audio controls;
  await prepareAudioPlay(window);
  await clickRendererControl(window, '[data-command="run-play"]');

  if (!await waitForRenderer(window, "document.querySelector('[data-audio-playback]') !== null")) {
    const status = await window.webContents.executeJavaScript(
      `[document.querySelector('[data-product-status]')?.textContent, document.querySelector('[data-product-run-report]')?.textContent, document.querySelector('.viewport')?.dataset.playback, document.querySelector('[data-outcome-message]')?.textContent, document.querySelector('[data-run-live-report]')?.textContent].join(' | ')`,
    );

    throw new Error(`Play did not mount the session audio controls: ${status}`);
  }

  // The pointer sets the level: a click at 35% of the slider's width, nothing written from script.
  const volumePointerHit = await clickRendererControl(window, '[aria-label="Audio volume"]', undefined, 0.35);

  if (!await waitForRenderer(window, "document.querySelector('[aria-label=\"Audio volume\"]')?.value !== '1'")) {
    throw new Error("the pointer did not move the audio volume slider");
  }

  const volume = await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Audio volume"]').value`);
  const controlsBeforePlay = await window.webContents.executeJavaScript(`document.querySelector('[data-audio-playback]') !== null`);
  const playPointerHit = await clickRendererControl(window, '[data-audio-playback] button', 'Play tone');

  if (!await waitForRenderer(window, "document.querySelector('[data-audio-playback] button')?.dataset.audioState === 'started'")) {
    throw new Error('real Electron pointer did not start the selected clip');
  }

  if (!await waitForRenderer(window, "Number(document.querySelector('[data-audio-playback]')?.dataset.audioRms) >= 0.07 && Number(document.querySelector('[data-audio-playback]')?.dataset.audioRms) <= 0.11")) {
    throw new Error('live playback graph RMS did not reach the expected volume-scaled signal');
  }

  // Read the live level while the tone is still playing, before the slower
  // offline decode below.
  const liveRmsWhilePlaying = await window.webContents.executeJavaScript(
    "Number(document.querySelector('[data-audio-playback]')?.dataset.audioRms)",
  );

  const playback = await window.webContents.executeJavaScript(`(async () => {
    const audioButton = [...document.querySelectorAll('[data-audio-playback] button')].find((button) => button.textContent === 'Play tone');
    const response = await globalThis.sceneaxiDesktopLinux.request({ action: 'audio-asset', payload: { assetId: 'tone', documentPath: 'scene.json' } });
    if (!response.ok || typeof response.data?.bytesBase64 !== 'string') throw new Error('audio bytes refused');
    const audioControls = audioButton.closest('[data-audio-playback]');
    const liveRms = ${liveRmsWhilePlaying};
    const bytes = Uint8Array.from(atob(response.data.bytesBase64), (character) => character.charCodeAt(0));
    const decodeContext = new AudioContext();
    const decoded = await decodeContext.decodeAudioData(bytes.slice().buffer);
    const offline = new OfflineAudioContext(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    let energy = 0;
    let samples = 0;
    for (let channel = 0; channel < rendered.numberOfChannels; channel += 1) {
      for (const sample of rendered.getChannelData(channel)) { energy += sample * sample; samples += 1; }
    }
    globalThis.__sceneaxiAudioSmokeButton = audioButton;
    globalThis.__sceneaxiAudioSmokeControls = audioControls;
    const result = {
      duration: decoded.duration,
      sampleRate: decoded.sampleRate,
      channels: decoded.numberOfChannels,
      sourceStarted: audioButton.dataset.audioState === 'started',
      offlineRms: Math.sqrt(energy / samples),
      liveRms,
      gain: Number(audioControls.dataset.audioVolume),
    };
    await decodeContext.close();
    return result;
  })()`);

  await clickRendererControl(window, '[data-command="run-stop"]');
  const stopped = await waitForRenderer(window, "globalThis.__sceneaxiAudioSmokeButton?.dataset.audioState === 'stopped' && globalThis.__sceneaxiAudioSmokeControls?.dataset.audioContextDisposed === 'true' && document.querySelector('[data-audio-playback]') === null");
  const stoppedRms = await window.webContents.executeJavaScript("Number(globalThis.__sceneaxiAudioSmokeControls?.dataset.audioRms)");

  return {
    ...playback,
    stoppedRms,
    volume: Number(volume),
    stopped,
    contextDisposed: await window.webContents.executeJavaScript("globalThis.__sceneaxiAudioSmokeControls?.dataset.audioContextDisposed === 'true'"),
    pointerTargets: { volume: controlsBeforePlay && volumePointerHit, play: playPointerHit },
  };
}

function smokeAssetBytes(height = 1): Buffer {
  const positions = Buffer.from(new Float32Array([
    -1, 0, 0,
    1, 0, 0,
    0, height, 0,
  ]).buffer);

  return Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    buffers: [{
      byteLength: positions.byteLength,
      uri: `data:application/octet-stream;base64,${positions.toString("base64")}`,
    }],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }));
}

/** Read one own property off an unknown bridge payload, without asserting a shape. */
function payloadField(value: DesktopBoundaryValue, name: string): DesktopBoundaryValue {
  if (!isProtocolObject(value) || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);

  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

let reportedFailure = false;

let localBridgeServer: DesktopLocalBridgeServer | null = null;

let closeActiveDesktopBridge: (() => boolean) | null = null;

let cancelActiveAssetPreparation: (() => Promise<void>) | null = null;

/** Print the one `{ok:false}` proof line and exit; later callers stay silent. */
function reportFailure(message: string): void {
  if (reportedFailure) return;
  reportedFailure = true;
  console.error(JSON.stringify({ ok: false, message }));
  app.exit(1);
}

function fail(message: string): never {
  reportFailure(message);
  throw new Error(message);
}

async function start(): Promise<void> {
  await app.whenReady();

  const physicsWorldHost = await initializeDesktopScenePhysics().catch((cause: unknown) => {
    console.error("PHYSICS_HOST_NOT_READY", cause instanceof Error ? cause.message : "Rapier initialization failed.");

    return undefined;
  });

  let frameReported: ((report: DesktopFrameReport) => void) | null = null;

  const firstFrameReport = new Promise<DesktopFrameReport>((resolve) => {
    frameReported = resolve;
  });

  const smokeRoot = SMOKE ? smokeProjectDir() : null;

  const smokeGuiAssetPath = smokeRoot === null
    ? null
    : join(smokeRoot, ".sceneaxi-runtime", "smoke-gui-source.gltf");

  const smokeGuiAssetRevisionPath = smokeRoot === null
    ? null
    : join(smokeRoot, ".sceneaxi-runtime", "smoke-gui-source-revision-2.gltf");

  let smokeGuiAssetPickerPath = smokeGuiAssetPath;
  const smokeNewRoot = SMOKE ? mkdtempSync(join(tmpdir(), "sceneaxi-desktop-new-")) : null;
  const smokeAssetSource = smokeNewRoot === null ? null : join(smokeNewRoot, "gui-smoke-source.gltf");

  if (smokeAssetSource !== null) {
    const asset = smokeAssetBytes();
    writeFileSync(smokeAssetSource, ASSET_CAPACITY_SMOKE ? Buffer.concat([asset, Buffer.alloc(PROJECT_ASSET_MAX_BYTES - asset.byteLength, 0x20)]) : asset);
  }

  const heldLocalExecutors: Array<() => Promise<void>> = [];

  const smokeLocalExecutor = SMOKE ? (request: import("../lib/bridge.js").DesktopAssistantRunRequest) => {
    if (!request.prompt.startsWith("SCENEAXI_SMOKE_")) return runAssistantSculptAction({ ...request, route: "local" });

    return new Promise<Awaited<ReturnType<typeof runAssistantSculptAction>>>((resolve) => {
      heldLocalExecutors.push(async () => resolve(await runAssistantSculptAction({ ...request, prompt: "a stone arch", route: "local" })));
    });
  } : undefined;

  const providerKeyStore = createElectronProviderKeyStore(app.getPath("userData"));

  const byoRuntime = createPrivilegedDesktopByoRuntime({
    keyStore: providerKeyStore,
    provider: "opencode",
    createProviderSession: createDesktopOpenCodeProviderSession(),
  });

  const runRarityProvider = createDesktopRarityFixtureProvider();
  let webExportRuntime: Uint8Array | undefined;
  let webExportPublisherExecutable: string | undefined;

  if (process.platform === "linux") {
    try {
      webExportRuntime = readFileSync(join(__dirname, "renderer.js"));
    } catch {
      webExportRuntime = undefined;
    }

    webExportPublisherExecutable = app.isPackaged
      ? join(
          process.resourcesPath,
          "app.asar.unpacked",
          "dist",
          "sceneaxi-publish-no-replace",
        )
      : join(__dirname, "sceneaxi-publish-no-replace");
  }

  let bridge: DesktopBridge | null = null;
  const activeFrameReport = () => bridge?.lastFrameReport() ?? null;
  let desktopWindow: BrowserWindow | null = null;
  closeActiveDesktopBridge = () => bridge?.close() ?? true;
  let inputActions: DesktopInputActionHost | null = null;
  let projectBrowser: DesktopProjectBrowser | null = null;
  let activeRoot: string | null = null;

  let pendingPreparation: Readonly<{ job: ReturnType<DesktopBridge["prepareAssetImport"]>; bridge: DesktopBridge; root: string }> | null = null;
  let assetGeneration = 0;

  const cancelPreparation = async () => {
    assetGeneration += 1; // Fence before awaiting exit or allowing the old picker to resolve.
    const pending = pendingPreparation;
    pendingPreparation = null;

    if (pending !== null) await pending.job.cancel();
  };

  cancelActiveAssetPreparation = cancelPreparation;

  const prepareAssetImport = async (selectedBridge: DesktopBridge, root: string,
    input: Readonly<{ profile: "game" | "web"; documentPath: string; sourcePath: string; assetId?: string; hotReload?: boolean }>): Promise<DesktopBridgeResponse> => {
    if (pendingPreparation !== null) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.busy, "One asset preparation is already pending.");
    const token = ++assetGeneration;
    const job = selectedBridge.prepareAssetImport(input);
    const pending = Object.freeze({ job, bridge: selectedBridge, root });
    pendingPreparation = pending;
    const outcome = await job.result;

    if (pendingPreparation !== pending || assetGeneration !== token || bridge !== selectedBridge || activeRoot !== root || window.isDestroyed()) {
      return bridgeRefuse(ASSET_PREPARATION_REFUSALS.cancelled, "The asset preparation generation was retired.");
    }

    pendingPreparation = null;

    return outcome;
  };

  const activateProject = async (root: string): Promise<DesktopBridge> => {
    if (bridge !== null && activeRoot === root) return bridge;

    if (bridge !== null && desktopWindow !== null) {
      void desktopWindow.webContents.executeJavaScript(
        `document.dispatchEvent(new CustomEvent(${JSON.stringify(DESKTOP_VIEWPORT_STOP_EVENT)}))`,
      ).catch(() => undefined);
    }

    await cancelPreparation();

    if (bridge !== null && !bridge.close()) {
      throw new Error("The active project's desktop mutation-owner lease could not be released.");
    }

    bridge = null;
    inputActions = null;
    projectBrowser = null;
    activeRoot = null;
    await localBridgeServer?.close();
    localBridgeServer = null;
    let activeBridgeForDirtyCheck: DesktopBridge | null = null;

    const nextProjectBrowser = createDesktopProjectBrowser({
      root,
      stateDirectory: SMOKE
        ? join(root, ".sceneaxi-runtime")
        : join(app.getPath("userData"), "project-lifecycle"),
      isDirty: () => {
        const response = activeBridgeForDirtyCheck?.handle({
          action: "authoring",
          payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
        });

        if (response === undefined || !response.ok) return true;
        const snapshot = payloadField(response.data, "authoringSnapshot");
        const phase = payloadField(snapshot, "phase");

        return phase === "reviewing" || phase === "pending" ||
          payloadField(snapshot, "journalRecoveryPending") === true;
      },
    });

    const inspectedProject = inspectProjectModel(root);

    const commandCapabilities = inspectedProject.ok && inspectedProject.inspection.state === "native"
      ? inspectedProject.inspection.capabilities.map((grant) => grant.id)
      : undefined;

    const nextInputActions = createDesktopInputActionHost({
      projectRoot: root,
      workspaceDirectory: join(app.getPath("userData"), "input-actions"),
    });

    const next = createDesktopBridge({
      cwd: root,
      ...(() => {
        const optional: DesktopOptionalFields<{ physicsWorldHost?: Parameters<typeof createDesktopBridge>[0]["physicsWorldHost"] }> = {};

        if (!(physicsWorldHost === undefined)) {
          optional.physicsWorldHost = physicsWorldHost;
        }

        return optional;
      })(),
      ...(() => {
        const optional: DesktopOptionalFields<{ commandCapabilities?: Parameters<typeof createDesktopBridge>[0]["commandCapabilities"] }> = {};

        if (!(commandCapabilities === undefined)) {
          optional.commandCapabilities = commandCapabilities;
        }

        return optional;
      })(),
      inputActions: nextInputActions,
      projectBrowser: nextProjectBrowser,
      onFrameReport: (report) => frameReported?.(report),
      ...(() => {
        const optional: DesktopOptionalFields<{ runByoAssistant?: Parameters<typeof createDesktopBridge>[0]["runByoAssistant"] }> = {};

        if (!(byoRuntime.runByoAssistant === undefined)) {
          optional.runByoAssistant = byoRuntime.runByoAssistant;
        }

        return optional;
      })(),
      runRarityProvider,
      ...(() => {
        const optional: DesktopOptionalFields<{ runLocalAssistant?: Parameters<typeof createDesktopBridge>[0]["runLocalAssistant"] }> = {};

        if (!(smokeLocalExecutor === undefined)) {
          optional.runLocalAssistant = smokeLocalExecutor;
        }

        return optional;
      })(),
      webExportPlatform: process.platform,
      ...(() => {
        const optional: DesktopOptionalFields<{ webExportPublisherExecutable?: Parameters<typeof createDesktopBridge>[0]["webExportPublisherExecutable"] }> = {};

        if (!(webExportPublisherExecutable === undefined)) {
          optional.webExportPublisherExecutable = webExportPublisherExecutable;
        }

        return optional;
      })(),
      ...(() => {
        const optional: DesktopOptionalFields<{ webExportRuntime?: Parameters<typeof createDesktopBridge>[0]["webExportRuntime"] }> = {};

        if (!(webExportRuntime === undefined)) {
          optional.webExportRuntime = webExportRuntime;
        }

        return optional;
      })(),
    });

    activeBridgeForDirtyCheck = next;

    const localPaths = SMOKE
      ? {
          socketPath: join(root, ".sceneaxi-runtime", "desktop-v1.sock"),
          discoveryPath: join(root, ".sceneaxi-config", "desktop-bridge-v1.json"),
        }
      : resolveDesktopLocalBridgePaths({
        ...(() => {
          const optional: DesktopOptionalFields<{ runtimeDir?: string }> = {};

          if (!(process.env["XDG_RUNTIME_DIR"] === undefined)) {
            optional.runtimeDir = process.env["XDG_RUNTIME_DIR"];
          }

          return optional;
        })(),
        ...(() => {
          const optional: DesktopOptionalFields<{ configDir?: string }> = {};

          if (!(process.env["XDG_CONFIG_HOME"] === undefined)) {
            optional.configDir = process.env["XDG_CONFIG_HOME"];
          }

          return optional;
        })(),
      });

    // The local agent bridge is an attachment point, not the application: a
    // refused socket costs the operator that attachment, never the selected root.
    try {
      localBridgeServer = await startDesktopLocalBridgeServer({
        bridge: next,
        projectRoot: root,
        ...localPaths,
      });
    } catch (cause) {
      if (SMOKE) throw cause;
      localBridgeServer = null;
      console.error(
        "desktop-linux: the local agent bridge did not start; Engine Desktop continues without CLI attachment:",
        cause instanceof Error ? cause.message : String(cause),
      );
    }

    bridge = next;
    inputActions = nextInputActions;
    projectBrowser = nextProjectBrowser;
    activeRoot = root;

    return next;
  };

  const lifecycle = createDesktopProjectLifecycle({
    stateDirectory: smokeRoot === null
      ? join(app.getPath("userData"), "project-lifecycle")
      : join(smokeRoot, ".sceneaxi-runtime"),
  });

  let smokeBridge: DesktopBridge | null;

  if (smokeRoot !== null) {
    smokeBridge = await activateProject(smokeRoot);
    const sourcePath = join(smokeRoot, "smoke-source.gltf");
    mkdirSync(join(smokeRoot, ".sceneaxi-runtime"), { recursive: true });

    if (smokeGuiAssetPath === null) fail("GUI import fixture path was not configured");
    const guiAssetSource = JSON.parse(smokeAssetBytes().toString("utf8"));
    guiAssetSource.extras = { sceneaxiSmokeRevision: 1 };
    writeFileSync(smokeGuiAssetPath, JSON.stringify(guiAssetSource));
    writeFileSync(sourcePath, smokeAssetBytes());

    const stagedAsset = smokeBridge.handle({
      action: "asset-import",
      payload: {
        profile: "web",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        sourcePath,
      },
    });

    if (!stagedAsset.ok || payloadField(stagedAsset.data, "outcome") !== "reviewing") {
      fail("smoke asset did not reach Change Review");
    }

    const acceptedAsset = smokeBridge.handle({
      action: "authoring",
      payload: { op: "accept" },
    });

    if (!acceptedAsset.ok || payloadField(acceptedAsset.data, "phase") !== "applied") {
      fail("smoke asset did not apply through the existing authoring bridge");
    }

    unlinkSync(sourcePath);
    const audioSourcePath = join(smokeRoot, "tone.wav");
    writeFileSync(audioSourcePath, smokeAudioBytes());

    const stagedAudio = smokeBridge.handle({
      action: "asset-import",
      payload: { profile: "game", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, sourcePath: audioSourcePath },
    });

    if (!stagedAudio.ok || payloadField(stagedAudio.data, "outcome") !== "reviewing") {
      fail("deterministic WAV did not enter the existing asset-import review");
    }

    const acceptedAudio = smokeBridge.handle({ action: "authoring", payload: { op: "accept" } });

    if (!acceptedAudio.ok || payloadField(acceptedAudio.data, "phase") !== "applied") {
      fail("deterministic WAV did not apply through the existing asset-import bridge");
    }

    unlinkSync(audioSourcePath);
    const invalidAudioPath = join(smokeRoot, "undecodable.ogg");
    writeFileSync(invalidAudioPath, smokeUndecodableOggBytes());

    const stagedInvalidAudio = smokeBridge.handle({
      action: "asset-import",
      payload: { profile: "game", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, sourcePath: invalidAudioPath },
    });

    if (!stagedInvalidAudio.ok || payloadField(stagedInvalidAudio.data, "outcome") !== "reviewing") {
      fail("metadata-valid Ogg fixture did not enter asset review");
    }

    const acceptedInvalidAudio = smokeBridge.handle({ action: "authoring", payload: { op: "accept" } });

    if (!acceptedInvalidAudio.ok || payloadField(acceptedInvalidAudio.data, "phase") !== "applied") {
      fail("metadata-valid Ogg fixture did not apply through the asset-import bridge");
    }

    unlinkSync(invalidAudioPath);
    const openedSmokeProject = lifecycle.openProject(smokeRoot);

    if (!openedSmokeProject.ok) {
      fail(`smoke project lifecycle did not bind the contained root: ${openedSmokeProject.reason}`);
    }
  } else {
    const startup = lifecycle.startup();

    if (startup.ok && startup.data.status.active !== null) {
      await activateProject(startup.data.status.active.root);
    }
  }

  const documentUrl = pathToFileURL(join(__dirname, "index.html")).href;

  const trustedHandle = <Result>(channel: string, handler: (event: Electron.IpcMainInvokeEvent, request: DesktopBoundaryValue) => Result) => {
    ipcMain.handle(channel, (event, request: DesktopBoundaryValue) => {
      if (window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame ||
          event.senderFrame.url !== documentUrl) {
        return bridgeRefuse("DESKTOP_BRIDGE_REQUEST_MALFORMED", "Only the packaged main document may use the desktop bridge.");
      }

      return handler(event, request);
    });
  };

  trustedHandle(DESKTOP_BRIDGE_CHANNEL, async (_event, request: DesktopBoundaryValue) => {
    const action = payloadField(request, "action");
    const payload = payloadField(request, "payload");

    if (action === "profile" || (action === "authoring" && payloadField(payload, "op") === "reject") || action === "project-browser-open") await cancelPreparation();

    if (action === "asset-import") {
      if (bridge === null || activeRoot === null) return bridgeRefuse(DESKTOP_PROJECT_REFUSALS.projectRequired, "Choose a validated project before importing an asset.");

      if (payload === null || !isProtocolObject(payload) || Array.isArray(payload) || types.isProxy(payload)) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.inputInvalid, "Invalid asset preparation envelope.");
      const descriptors = Object.getOwnPropertyDescriptors(payload);

      if (Reflect.ownKeys(descriptors).some(key => !isProtocolText(key) || !["profile", "documentPath", "sourcePath", "assetId", "hotReload"].includes(key)) ||
        Object.values(descriptors).some(descriptor => !("value" in descriptor))) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.inputInvalid, "Invalid asset preparation fields.");
      const profile: unknown = descriptors["profile"]?.value;
      const documentPath: unknown = descriptors["documentPath"]?.value;
      const sourcePath: unknown = descriptors["sourcePath"]?.value;
      const assetId: unknown = descriptors["assetId"]?.value;
      const hotReload: unknown = descriptors["hotReload"]?.value;

      if (profile === "kids") return bridgeRefuse(ASSET_PREPARATION_REFUSALS.kidsDenied, "Kids asset work is denied before allocation.");

      if ((profile !== "game" && profile !== "web") || !isProtocolText(documentPath) || !isProtocolText(sourcePath) ||
        (assetId !== undefined && !isProtocolText(assetId)) || (hotReload !== undefined && !isProtocolBoolean(hotReload))) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.inputInvalid, "Invalid asset preparation scalars.");

      const preparationInput: MutableNativeFields<Parameters<typeof prepareAssetImport>[2]> = { profile, documentPath, sourcePath };

      if (assetId !== undefined) preparationInput.assetId = assetId;

      if (hotReload !== undefined) preparationInput.hotReload = hotReload;

      return prepareAssetImport(bridge, activeRoot, preparationInput);
    }

    return bridge?.handle(request) ?? bridgeRefuse(DESKTOP_PROJECT_REFUSALS.projectRequired,
      "Choose New Project, Open Project, or a validated recent project before using the engine bridge.");
  });
  trustedHandle(DESKTOP_INPUT_ACTIONS_CHANNEL, () =>
    inputActions?.inspect() ?? {
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.projectRequired,
      message: "Choose a validated project before reading input actions.",
      detail: null,
    },
  );
  trustedHandle(DESKTOP_ASSET_IMPORT_CHANNEL, async (_event, request: DesktopBoundaryValue) => {
    // Descriptor-only route admission precedes even a profile read.
    if (request === null || !isProtocolObject(request) || Array.isArray(request) || types.isProxy(request)) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.inputInvalid, "Invalid asset picker envelope.");
    const descriptors = Object.getOwnPropertyDescriptors(request);

    if (Reflect.ownKeys(descriptors).some(key => !isProtocolText(key) || !["profile", "op", "generation"].includes(key)) ||
      Object.values(descriptors).some(descriptor => !("value" in descriptor))) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.inputInvalid, "Invalid asset picker fields.");
    const profile: unknown = descriptors["profile"]?.value;
    const operation: unknown = descriptors["op"]?.value;

    if (profile !== "game" && profile !== "web") return bridgeRefuse(profile === "kids" ? ASSET_PREPARATION_REFUSALS.kidsDenied : ASSET_PREPARATION_REFUSALS.inputInvalid,
      "Asset picker admission requires an allowed profile.");

    if (operation === "status") {
      if (payloadField(request, "generation") !== undefined) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.inputInvalid, "Status cannot supply a generation.");

      return bridgeOk("asset-import", Object.freeze({ outcome: pendingPreparation === null ? "idle" : "preparing", generation: pendingPreparation?.job.generation ?? null }));
    }

    if (operation === "cancel") {
      const generation = payloadField(request, "generation");

      if (pendingPreparation === null || generation !== pendingPreparation.job.generation) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.inputInvalid, "Only the active generation may be cancelled.");
      await cancelPreparation();

      return bridgeOk("asset-import", Object.freeze({ outcome: "cancelled", generation }));
    }

    if (operation !== undefined || payloadField(request, "generation") !== undefined) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.inputInvalid, "Unknown asset picker operation.");

    if (bridge === null || activeRoot === null) return bridgeRefuse(DESKTOP_PROJECT_REFUSALS.projectRequired, "Choose a validated project before importing an asset.");

    if (pendingPreparation !== null) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.busy, "One asset preparation is already pending.");
    const selectedBridge = bridge;
    const root = activeRoot;
    const token = assetGeneration;

    const selected = SMOKE ? { canceled: false, filePaths: smokeGuiAssetPickerPath === null ? [] : [smokeGuiAssetPickerPath] } : await dialog.showOpenDialog(window, {
      title: "Import validated project asset", buttonLabel: "Stage Import", properties: ["openFile"],
      filters: [{ name: "SceneAxi project assets", extensions: ["glb", "gltf", "json", "png", "jpg", "jpeg", "webp", "wav", "ogg", "mp3", "woff2", "woff", "ttf", "otf"] }],
    });

    if (selected.canceled || selected.filePaths[0] === undefined) return bridgeOk("asset-import", Object.freeze({ outcome: "cancelled" }));

    if (bridge !== selectedBridge || activeRoot !== root || assetGeneration !== token || window.isDestroyed()) return bridgeRefuse(ASSET_PREPARATION_REFUSALS.cancelled, "The picker project was retired before selection.");

    return prepareAssetImport(selectedBridge, root, { profile, documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, sourcePath: selected.filePaths[0] });
  });
  trustedHandle(DESKTOP_PROJECT_BROWSER_CHANNEL, (_event, request: DesktopBoundaryValue) =>
    projectBrowser?.handle(request) ??
      projectBrowserRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.projectRequired,
        "Choose New Project, Open Project, or a validated recent project before browsing project files.",
      ),
  );
  trustedHandle(DESKTOP_BYO_CONFIGURATION_CHANNEL, (_event, request: DesktopBoundaryValue) =>
    byoRuntime.configuration.handle(request),
  );

  const window = new BrowserWindow({
    // Content-box sizing, and the floor taken from the chrome's own published
    // minimum: any smaller and the document this window renders hides its shell
    // behind the "window below the minimum size" refusal, so the window must not
    // be able to reach a size its own chrome refuses to lay out.
    useContentSize: true,
    width: 1440,
    height: 900,
    minWidth: DESKTOP_MINIMUM_WINDOW.width,
    minHeight: DESKTOP_MINIMUM_WINDOW.height,
    // Shown in smoke mode too: a hidden window throttles painting, and the smoke
    // exists to observe the real one (under xvfb on headless hosts).
    show: true,
    // The v6 canvas (signal-box quadrant well) the chrome paints behind every
    // panel, read from the shell's tokens so the first frame matches the page.
    backgroundColor: SURFACE.backdrop,
    title: "SceneAxi Engine Desktop",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  desktopWindow = window;

  if (SMOKE) window.webContents.on("console-message", (details) => {
    // Smoke's own fixed labels only, never arbitrary provider/script messages.
    if (/^SMOKE_(WAIT|CONTROL|MENU)_FAILED /.test(details.message)) console.error(details.message);
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      label: "Help",
      submenu: [{
        label: "Reveal logs",
        click: () => {
          void shell.openPath(logsDirectory).then((failure) => {
            if (failure) dialog.showErrorBox("Logs unavailable", "The local logs folder could not be opened.");
          }).catch(() => dialog.showErrorBox("Logs unavailable", "The local logs folder could not be opened."));
        },
      }],
    },
  ]));

  let recoveryOffered = false;

  const offerReload = () => {
    if (window.isDestroyed() || recoveryOffered) return;

    recoveryOffered = true;

    if (DIAGNOSTICS_SMOKE) {
      window.webContents.reload();

      return;
    }

    void dialog.showMessageBox(window, {
      type: "warning",
      buttons: ["Reload window", "Not now"],
      defaultId: 0,
      cancelId: 1,
      title: "Desktop window stopped",
      message: "The desktop window stopped responding or a process exited. Reload the window?",
    }).then(({ response }) => {
      if (response === 0 && !window.isDestroyed()) window.webContents.reload();
    }).catch(() => {
      dialog.showErrorBox("Recovery unavailable", "The window could not be reloaded.");
    }).finally(() => { recoveryOffered = false; });
  };

  window.webContents.on("render-process-gone", (_event, details) => {
    recordDesktopDiagnostic(logsDirectory, mapDesktopDiagnosticEvent("renderer"), {
      reason: details.reason,
      exitCode: details.exitCode,
    });

    if (SMOKE) reportFailure("The renderer exited during the packaged smoke.");
    else if (desktopProcessLossNeedsRecovery(details.reason)) offerReload();
  });

  window.on("unresponsive", () => {
    recordDesktopDiagnostic(logsDirectory, "window-unresponsive");

    offerReload();
  });

  app.on("child-process-gone", (_event, details) => {
    recordDesktopDiagnostic(logsDirectory, mapDesktopDiagnosticEvent("child"), {
      reason: details.reason,
      exitCode: details.exitCode,
      processType: details.type,
    });

    if (!SMOKE && desktopProcessLossNeedsRecovery(details.reason)) offerReload();
  });

  const projectHost = createDesktopProjectHost({
    lifecycle,
    dialogs: {
      async chooseNewProjectRoot() {
        if (SMOKE) return smokeNewRoot;

        const selected = await dialog.showOpenDialog(window, {
          title: "New SceneAxi Project",
          buttonLabel: "Create starter project here",
          properties: ["openDirectory", "createDirectory"],
        });

        return selected.canceled ? null : (selected.filePaths[0] ?? null);
      },
      async chooseOpenProjectRoot() {
        if (SMOKE) return smokeRoot;

        const selected = await dialog.showOpenDialog(window, {
          title: "Open SceneAxi Project",
          buttonLabel: "Open Project",
          properties: ["openDirectory"],
        });

        return selected.canceled ? null : (selected.filePaths[0] ?? null);
      },
    },
    activate: activateProject,
  });

  trustedHandle(DESKTOP_PROJECT_CHANNEL, async (_event, request: DesktopBoundaryValue) => {
    const before = activeRoot;

    if (payloadField(request, "action") !== "status") await cancelPreparation();
    const response = await projectHost.handle(request);

    if (desktopProjectReloadRequired(before, response)) {
      // Let the invoke response cross the preload boundary, then reload the
      // unforked chrome so its one renderer owner mounts the newly active root.
      setTimeout(() => window.webContents.reload(), 0);
    }

    return response;
  });

  await window.loadFile(join(__dirname, "index.html"));

  if (DIAGNOSTICS_SMOKE) {
    const reloaded = new Promise<void>((resolve, reject) => {
      window.webContents.once("did-finish-load", () => resolve());
      setTimeout(() => reject(new Error("renderer reload timed out")), 15_000);
    });

    window.webContents.forcefullyCrashRenderer();
    await reloaded;

    const log = readFileSync(join(logsDirectory, "diagnostics.log"), "utf8");
    const help = Menu.getApplicationMenu()?.items.find((item) => item.label === "Help");
    const reveal = help?.submenu?.items.find((item) => item.label === "Reveal logs");

    if (!log.includes("RENDER_PROCESS_LOST") || !window.webContents.getURL().startsWith("file:") || !reveal?.enabled) {
      fail("renderer crash did not record a safe event and reload the window");
    }

    console.log(JSON.stringify({ ok: true, diagnostics: "renderer reloaded; local event recorded" }));

    app.exit(0);

    return;
  }

  if (!SMOKE) return;

  // --- native front-door coverage: the existing typed dialog port gets isolated
  // fixture choices in smoke only; no renderer path/credential bypass is exposed.
  const gui = async (body: string): Promise<DesktopBoundaryValue> => window.webContents.executeJavaScript(`(async () => {
    const wait = async (predicate, label) => {
      for (let attempt = 0; attempt < 400; attempt += 1) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const shell = document.querySelector('.shell');
      console.error('SMOKE_WAIT_FAILED', label, JSON.stringify({ browserRevision: shell?.dataset.projectBrowserRevision, selectedPath: shell?.dataset.projectBrowserSelectedPath, playback: document.querySelector('.viewport')?.dataset.playback, playbackFrame: document.querySelector('.viewport')?.dataset.playbackFrame }));
      throw new Error('SMOKE_WAIT_FAILED');
    };
    const click = async (selector) => {
      await wait(() => {
        const candidate = document.querySelector(selector);
        return candidate instanceof HTMLButtonElement && !candidate.disabled && candidate.getAttribute('aria-disabled') !== 'true';
      }, 'admitted control ' + selector);
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLButtonElement) || element.disabled || element.getAttribute('aria-disabled') === 'true') { console.error('SMOKE_CONTROL_FAILED', selector); throw new Error('SMOKE_CONTROL_FAILED'); }
      element.click();
    };
    const menuCommand = async (id) => {
      const command = document.querySelector('.menu-panel [data-command="' + id + '"]');
      await wait(() => command instanceof HTMLButtonElement && command.getAttribute('aria-disabled') !== 'true', 'menu ready ' + id);
      const root = command?.closest('[data-menu-root]');
      root?.querySelector('[data-menu-trigger]')?.click();
      if (!(command instanceof HTMLButtonElement) || command.closest('[hidden]') !== null || command.getAttribute('aria-disabled') === 'true') { console.error('SMOKE_MENU_FAILED', id); throw new Error('SMOKE_MENU_FAILED'); }
      command.click();
    };
    ${body}
  })()`);

  // The smoke executes through the real BrowserWindow: observe enforced CSP,
  // not only a generated policy string. All injected probes are synthetic.
  let blockedProbeRequests = 0;
  window.webContents.session.webRequest.onBeforeRequest(
    { urls: ['https://sceneaxi-blocked.invalid/*'] },
    (_details, callback) => { blockedProbeRequests += 1; callback({ cancel: true }); },
  );
  await gui(`
    const violations = [];
    const onViolation = (event) => violations.push(event.effectiveDirective);
    document.addEventListener('securitypolicyviolation', onViolation);
    globalThis.__sceneaxiBlockedScript = false;
    const inline = document.createElement('script');
    inline.textContent = 'globalThis.__sceneaxiBlockedScript = true';
    document.body.append(inline);
    const remote = document.createElement('script');
    remote.src = 'https://sceneaxi-blocked.invalid/probe.js';
    document.body.append(remote);
    const frame = document.createElement('iframe');
    frame.src = 'https://sceneaxi-blocked.invalid/';
    document.body.append(frame);
    await wait(() => violations.filter(directive => directive.startsWith('script-src')).length >= 2, 'enforced inline and remote script refusals');
    if (globalThis.__sceneaxiBlockedScript !== false) throw new Error('SMOKE_CSP_INLINE_EXECUTED');
    if (await Notification.requestPermission() !== 'denied') throw new Error('SMOKE_PERMISSION_NOT_DENIED');
    document.removeEventListener('securitypolicyviolation', onViolation);
    inline.remove(); remote.remove(); frame.remove();
    delete globalThis.__sceneaxiBlockedScript;
    return true;
  `);
  window.webContents.session.webRequest.onBeforeRequest(null);

  if (blockedProbeRequests !== 0) fail('CSP allowed a remote script/frame network request.');

  // Genuine foreign WebContents carries the same packaged document and preload,
  // yet no privileged handler may run for that sender (all six actual channels).
  const foreign = new BrowserWindow({ show: false, webPreferences: {
    preload: join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false,
  } });

  await foreign.loadFile(join(__dirname, "index.html"));

  const foreignRefusals = await foreign.webContents.executeJavaScript(`Promise.all([
    globalThis.sceneaxiDesktopLinux.request({action:'handshake'}),
    globalThis.sceneaxiDesktopLinux.project({action:'status'}),
    globalThis.sceneaxiDesktopLinux.browseProject({action:'status', profile:'web'}),
    globalThis.sceneaxiDesktopLinux.inputActions(),
    globalThis.sceneaxiDesktopLinux.importAsset({profile:'web'}),
    globalThis.sceneaxiDesktopLinux.configureByo({action:'status', provider:'opencode', profile:'@sceneaxi/profile-game'})
  ])`);

  foreign.destroy();

  if (!Array.isArray(foreignRefusals) || foreignRefusals.length !== 6 ||
      foreignRefusals.some((response) => payloadField(response, "ok") !== false ||
        payloadField(response, "reason") !== "DESKTOP_BRIDGE_REQUEST_MALFORMED")) fail("Foreign packaged-document IPC sender was not refused on every privileged channel.");

  const waitForRoot = async (root: string) => {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      try {
        const ready = await window.webContents.executeJavaScript(`document.querySelector('[data-project-root]')?.textContent === ${JSON.stringify(root)} && document.querySelector('select[data-action="scene-entity-select"]')?.options.length > 0`);

        if (ready === true) return;
      } catch { /* A committed project rebind reloads the document. */ }

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const observed = await window.webContents.executeJavaScript(`({ root: document.querySelector('[data-project-root]')?.textContent, options: document.querySelector('select[data-action="scene-entity-select"]')?.options.length, status: document.querySelector('[data-project-status]')?.textContent })`);
    fail(`The native window did not mount the exact rebound project: ${JSON.stringify(observed)}`);
  };

  if (smokeRoot === null || smokeNewRoot === null) fail("Native GUI smoke lost isolated dialog choices.");
  await waitForRoot(smokeRoot);
  await gui(`await menuCommand('project-new'); return true;`);
  await waitForRoot(smokeNewRoot);

  if (existsSync(join(smokeRoot, ".sceneaxi-config", "desktop-bridge-v1.json")) ||
      !existsSync(join(smokeNewRoot, ".sceneaxi-config", "desktop-bridge-v1.json"))) {
    fail("Project New did not retire old CLI discovery and publish the new bound root.");
  }

  console.error("SMOKE_PHASE maximum-asset boundary");
  const guiDocument = join(smokeNewRoot, SAMPLE_DOCUMENT);
  // SAFETY: the awaited native New Project action rebound the bridge through activateProject above; the callback assignment is not visible to TypeScript control flow, and the null guard follows immediately.
  const guiBridge = bridge as DesktopBridge | null;

  if (guiBridge === null || smokeAssetSource === null) fail("Maximum-asset smoke lost its bound bridge.");
  const oversizeSource = join(smokeNewRoot, "oversize-smoke-source.gltf");
  const beforeOversize = readFileSync(guiDocument, "utf8");
  writeFileSync(oversizeSource, Buffer.alloc(PROJECT_ASSET_MAX_BYTES + 1, 0x20));
  const oversize = guiBridge.handle({ action: "asset-import", payload: { profile: "web", documentPath: SAMPLE_DOCUMENT, sourcePath: oversizeSource } });

  if (oversize.ok || oversize.reason !== CONTAINED_GLTF_REFUSALS.oversize || readFileSync(guiDocument, "utf8") !== beforeOversize) {
    fail("Maximum-plus-one asset was not refused without canonical mutation.");
  }

  unlinkSync(oversizeSource);
  // Maximum-byte admission has its own contained golden project. Keep the GUI
  // fixture small: this receipt is byte-boundary admission, not a maximum-scene render claim.
  const maximumRoot = smokeProjectDir();
  const maximumBridge = createDesktopBridge({ cwd: maximumRoot });

  try {
    const maximumSource = join(maximumRoot, "maximum-source.gltf");
    const asset = smokeAssetBytes();
    writeFileSync(maximumSource, Buffer.concat([asset, Buffer.alloc(PROJECT_ASSET_MAX_BYTES - asset.byteLength, 0x20)]));
    const before = readFileSync(join(maximumRoot, SAMPLE_DOCUMENT), "utf8");
    const started = Date.now();
    const maximum = maximumBridge.handle({ action: "asset-import", payload: { profile: "web", documentPath: SAMPLE_DOCUMENT, sourcePath: maximumSource } });

    if (!maximum.ok || payloadField(maximum.data, "outcome") !== "reviewing" || Date.now() - started > 4000) fail("Maximum-byte source was not admitted within the existing latency budget.");
    const rejected = maximumBridge.handle({ action: "authoring", payload: { op: "reject" } });

    if (!rejected.ok || readFileSync(join(maximumRoot, SAMPLE_DOCUMENT), "utf8") !== before) fail("Maximum-byte rejection changed canonical bytes.");
  } finally {
    if (!maximumBridge.close()) fail("Maximum-byte golden retained its mutation-owner lease.");
    rmSync(maximumRoot, { recursive: true, force: true });
  }

  const guiBefore = readFileSync(guiDocument, "utf8");
  await gui(`
    const select = document.querySelector('select[data-action="scene-entity-select"]');
    select.value = ${JSON.stringify(DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(() => !document.querySelector('[data-scene-property-editor]')?.hidden, 'selected hierarchy');
    const input = document.querySelector('#scene-property-translation-x');
    input.value = '-3.5'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await click('[data-action="scene-property-stage"]');
    await wait(() => !document.querySelector('[data-change-proposal]')?.hidden, 'transform review');
    return true;
  `);

  if (readFileSync(guiDocument, "utf8") !== guiBefore) fail("GUI transform staging wrote before Save.");
  await gui(`await click('.title-actions [data-command="project-save"]'); await wait(() => document.querySelector('[data-change-proposal]')?.hidden === true, 'Save apply'); return true;`);
  console.error("SMOKE_PHASE maximum-asset native import");
  const guiSaved = readFileSync(guiDocument, "utf8");

  if (guiSaved === guiBefore || !guiSaved.includes('-3.5')) fail("GUI Save did not persist the typed transform.");
  await gui(`await menuCommand('edit-undo'); return true;`);

  for (let n = 0; n < 400 && readFileSync(guiDocument, "utf8") !== guiBefore; n += 1) await new Promise(resolve => setTimeout(resolve, 10));

  if (readFileSync(guiDocument, "utf8") !== guiBefore) fail("GUI Undo did not restore exact prior bytes.");
  await gui(`await menuCommand('edit-redo'); return true;`);

  for (let n = 0; n < 400 && readFileSync(guiDocument, "utf8") !== guiSaved; n += 1) await new Promise(resolve => setTimeout(resolve, 10));

  if (readFileSync(guiDocument, "utf8") !== guiSaved) fail("GUI Redo did not restore exact saved bytes.");

  const nativeResidentBytes = () => {
      const metrics = app.getAppMetrics();

      if (metrics.length === 0 || metrics.some(metric => !Number.isFinite(metric.memory.workingSetSize) || metric.memory.workingSetSize <= 0)) fail("Native process RSS observation missing.");

      return metrics.reduce((sum, metric) => sum + metric.memory.workingSetSize * 1024, 0);
    };

    const capacityRss: number[] = [];
    const capacityReloadMs: number[] = [];
    const capacityReloadRss: number[] = [];

    const assetCapacity = { enabled: ASSET_CAPACITY_SMOKE, sourceBytes: ASSET_CAPACITY_SMOKE ? PROJECT_ASSET_MAX_BYTES : smokeAssetBytes().byteLength,
      phaseMs: { import: 0, apply: 0, reload: 0, hotReload: 0, cancel: 0 }, mainHeartbeatMs: 0, rendererHeartbeatMs: 0 };

    let capacityPrevious = performance.now();

    const capacityHeartbeat = ASSET_CAPACITY_SMOKE ? setInterval(() => {
      const now = performance.now(); assetCapacity.mainHeartbeatMs = Math.max(assetCapacity.mainHeartbeatMs, now - capacityPrevious); capacityPrevious = now;
      capacityRss.push(nativeResidentBytes());
    }, 10) : null;

    if (ASSET_CAPACITY_SMOKE) {
      capacityRss.push(nativeResidentBytes());
      await gui(`globalThis.__sceneaxiAssetHeartbeat = { max: 0, previous: performance.now(), timer: null };
        const sample = globalThis.__sceneaxiAssetHeartbeat;
        sample.timer = setInterval(() => { const now = performance.now(); sample.max = Math.max(sample.max, now - sample.previous); sample.previous = now; }, 10); return true;`);
    }

    let capacityStarted = performance.now();
    await gui(`await wait(() => document.querySelector('[data-action="profile"][data-value="web"]')?.getAttribute('aria-disabled') !== 'true', 'profile switch admitted'); await click('[data-action="profile"][data-value="web"]'); await wait(() => document.querySelector('[data-action="web-inject-asset"]')?.getAttribute('aria-disabled') !== 'true', 'Web import admitted'); await click('[data-action="web-inject-asset"]'); await wait(() => document.querySelector('[data-change-proposal]')?.hidden === false, 'GUI import review'); return true;`);

  assetCapacity.phaseMs.import = performance.now() - capacityStarted;

    if (readFileSync(guiDocument, "utf8") !== guiSaved) fail("GUI import wrote before approval.");
    capacityStarted = performance.now();
  await gui(`await click('[data-action="change-accept"]'); await wait(() => document.querySelector('[data-change-proposal]')?.hidden === true, 'import apply'); return true;`);
  assetCapacity.phaseMs.apply = performance.now() - capacityStarted;
    console.error("SMOKE_PHASE maximum-asset canonical reload");
  let guiImported = readFileSync(guiDocument, "utf8");

  if (guiImported === guiSaved || !guiImported.includes('gui-smoke-source')) fail("Native fixture dialog did not apply a real manifest asset.");
  capacityStarted = performance.now();
    await gui(`const revision = Number(document.querySelector('.shell')?.dataset.projectBrowserRevision || 0); await click('[data-action="document-reload"]'); await wait(() => Number(document.querySelector('.shell')?.dataset.projectBrowserRevision) > revision && document.querySelector('.shell')?.dataset.projectBrowserSelectedPath === 'scene.json', 'import reload canonical document revision'); return true;`);

  assetCapacity.phaseMs.reload = performance.now() - capacityStarted;

    if (readFileSync(guiDocument, "utf8") !== guiImported) fail("GUI reload rewrote canonical import bytes.");

    if (ASSET_CAPACITY_SMOKE) {
      // Change original bytes without changing source/path/identity or the 8MiB budget.
      const changedSource = readFileSync(smokeAssetSource);
      changedSource[changedSource.byteLength - 1] = 0x09;
      writeFileSync(smokeAssetSource, changedSource);
      const changedDigest = `sha256:${createHash("sha256").update(changedSource).digest("hex")}`;
      const hotReloadStarted = performance.now();
      await gui(`const stage = await globalThis.sceneaxiDesktopLinux.request({ action: 'asset-import', payload: {
        profile: 'web', documentPath: ${JSON.stringify(SAMPLE_DOCUMENT)}, sourcePath: ${JSON.stringify(smokeAssetSource)}, hotReload: true } });
        if (!stage.ok || stage.data.outcome !== 'reviewing' || stage.data.hotReload !== true || stage.data.entry.digest !== ${JSON.stringify(changedDigest)}) throw new Error('SMOKE_ASSET_HOT_RELOAD_NOT_REVIEWED');
        const accepted = await globalThis.sceneaxiDesktopLinux.request({ action: 'authoring', payload: { op: 'accept' } });
        if (!accepted.ok || accepted.data.phase !== 'applied') throw new Error('SMOKE_ASSET_HOT_RELOAD_NOT_APPLIED'); return true;`);
      assetCapacity.phaseMs.hotReload = performance.now() - hotReloadStarted;
      const hotReloadCanonical = readFileSync(guiDocument, "utf8");

      if (hotReloadCanonical === guiImported || !hotReloadCanonical.includes(changedDigest)) fail("Native changed-source hot reload did not persist original byte digest.");
      guiImported = hotReloadCanonical;

      for (let cycle = 0; cycle < 3; cycle += 1) {
        const started = performance.now();
        await gui(`const revision = Number(document.querySelector('.shell')?.dataset.projectBrowserRevision || 0); await click('[data-action="document-reload"]'); await wait(() => Number(document.querySelector('.shell')?.dataset.projectBrowserRevision) > revision, 'capacity canonical reload'); return true;`);
        capacityReloadMs.push(performance.now() - started); capacityReloadRss.push(nativeResidentBytes()); capacityRss.push(nativeResidentBytes());
      }

      const cancellationStarted = performance.now();
      const cancelledPreparation = prepareAssetImport(guiBridge, smokeNewRoot, { profile: "web", documentPath: SAMPLE_DOCUMENT, sourcePath: smokeAssetSource });
      await gui(`const status = await globalThis.sceneaxiDesktopLinux.importAsset({ profile: 'web', op: 'status' });
        if (!status.ok || status.data.outcome !== 'preparing' || !Number.isSafeInteger(status.data.generation)) throw new Error('SMOKE_ASSET_CANCEL_GENERATION_ABSENT');
        const cancelled = await globalThis.sceneaxiDesktopLinux.importAsset({ profile: 'web', op: 'cancel', generation: status.data.generation });
        if (!cancelled.ok || cancelled.data.outcome !== 'cancelled') throw new Error('SMOKE_ASSET_CANCEL_NOT_TERMINAL'); return true;`);
      const cancelled = await cancelledPreparation;
      assetCapacity.phaseMs.cancel = performance.now() - cancellationStarted;

      if (cancelled.ok || cancelled.reason !== ASSET_PREPARATION_REFUSALS.cancelled) fail("Cancelled asset generation published late work.");
      const rendererHeartbeat = await gui(`const sample = globalThis.__sceneaxiAssetHeartbeat; clearInterval(sample.timer); delete globalThis.__sceneaxiAssetHeartbeat; return sample.max;`);

      if (!isDesktopNumber(rendererHeartbeat)) fail("Renderer capacity heartbeat observation missing.");
      assetCapacity.rendererHeartbeatMs = rendererHeartbeat;

      if (capacityHeartbeat !== null) clearInterval(capacityHeartbeat);
      console.error("ASSET_CAPACITY_METRICS", JSON.stringify({ ...assetCapacity, rssBytes: capacityRss, warmedReloadRssBytes: capacityReloadRss, reloadMs: capacityReloadMs }));

      if (Object.entries(assetCapacity.phaseMs).some(([phase, ms]) => ms > (phase === "cancel" ? 500 : 4000)) || capacityReloadMs.some(ms => ms > 4000) ||
        assetCapacity.mainHeartbeatMs > 100 || assetCapacity.rendererHeartbeatMs > 100 ||
        Math.max(...capacityRss) - (capacityRss[0] ?? 0) > 256 * 1024 * 1024 || (capacityReloadRss.at(-1) ?? 0) - (capacityReloadRss[0] ?? 0) > 32 * 1024 * 1024) fail("Native asset capacity exceeded unchanged phase/heartbeat/RSS budgets.");

      if (readFileSync(guiDocument, "utf8") !== hotReloadCanonical) fail("Cancelled capacity generation changed canonical bytes.");
    }

  await gui(`await wait(() => document.querySelector('[data-action="profile"][data-value="game"]')?.getAttribute('aria-disabled') !== 'true', 'profile restored'); await click('[data-action="profile"][data-value="game"]'); return true;`);
  await gui(`
    await click('[data-action="assistant-route"][data-value="local"]');
    await click('[data-action="assistant-mode"][data-value="ask"]');
    const prompt = document.querySelector('.assistant-prompt'); prompt.value = 'What is in this scene?';
    await click('[aria-label="Send"]');
    await wait(() => document.querySelector('[data-assistant-result]')?.hidden === false, 'Local Ask result');
    return true;
  `);

  if (readFileSync(guiDocument, "utf8") !== guiImported) fail("Local Ask mutated the document.");
  await gui(`
    await click('[data-action="assistant-mode"][data-value="build"]');
    document.querySelector('.assistant-prompt').value = 'a stone arch';
    await click('[aria-label="Send"]');
    await wait(() => document.querySelector('[data-assistant-manipulators]')?.hidden === false && document.querySelector('[data-assistant-result]')?.hidden === false && document.querySelector('[data-change-proposal]')?.hidden === false && document.querySelector('.shell')?.dataset.assistantBusy === 'false', 'Local Build mount');
    return true;
  `);

  if (readFileSync(guiDocument, "utf8") !== guiImported) fail("Assistant Build wrote bytes without review approval.");
  await gui(`await click('[data-action="change-accept"]'); await wait(() => document.querySelector('[data-change-proposal]')?.hidden === true, 'assistant approved apply'); return true;`);

  for (let n = 0; n < 400 && readFileSync(guiDocument, "utf8") === guiImported; n += 1) await new Promise(resolve => setTimeout(resolve, 10));

  if (readFileSync(guiDocument, "utf8") === guiImported) fail("Assistant approval did not apply the actual artifact bytes.");
  const beforeCancelled = readFileSync(guiDocument, "utf8");
  await gui(`
    document.querySelector('.assistant-prompt').value = 'SCENEAXI_SMOKE_CANCEL'; await click('[aria-label="Send"]');
    await wait(() => document.querySelector('.shell')?.dataset.assistantBusy === 'true' && document.querySelector('[data-action="sculpt-cancel"]')?.getAttribute('aria-disabled') !== 'true', 'exact cancellable job');
    await click('[data-action="sculpt-cancel"]');
    await wait(() => document.querySelector('[data-assistant-status]')?.textContent.includes('abandoned'), 'cancel acknowledged'); return true;
  `);
  await gui(`
    await wait(() => document.querySelector('.shell')?.dataset.assistantBusy === 'false', 'cancelled poll settled');
    document.querySelector('.assistant-prompt').value = 'SCENEAXI_SMOKE_TIMEOUT'; await click('[aria-label="Send"]');
    const deadline = performance.now() + 65000;
    while (!document.querySelector('[data-assistant-status]')?.textContent.includes('DESKTOP_ASSISTANT_STATUS_TIMEOUT')) {
      if (performance.now() > deadline) throw new Error('SMOKE_REAL_POLL_TIMEOUT_NOT_REPORTED');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return true;
  `);

  for (const release of heldLocalExecutors.splice(0)) await release();
  await gui(`await wait(() => document.querySelector('.shell')?.dataset.assistantBusy === 'false', 'late jobs retired'); return true;`);

  if (readFileSync(guiDocument, "utf8") !== beforeCancelled) fail("Cancelled/timed-out late work changed canonical bytes.");
  await gui(`await menuCommand('run-play'); await wait(() => document.querySelector('.viewport')?.dataset.playback === 'acknowledged', 'GUI Play frame'); return true;`);
  await gui(`await click('[data-action="mode"][data-value="ship"]'); await click('[data-command="ship-export-web"]'); await wait(() => document.querySelector('[data-ship-export-evidence]')?.hidden === false, 'GUI Web export'); return true;`);
  const guiExport = await gui(`return document.querySelector('[data-ship-output]')?.textContent;`);

  if (!isDesktopText(guiExport) || !guiExport.startsWith(join(smokeNewRoot, "exports", "web") + sep) || !existsSync(join(guiExport, "delivery-handoff.json"))) fail("GUI Export did not write a contained handoff.");
  const capturePath = process.env["SCENEAXI_SMOKE_CAPTURE_PATH"];

  if (capturePath !== undefined) {
    window.show();
    await gui(`return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));`);
    const capture = await window.webContents.capturePage();

    if (capture.isEmpty()) fail("Native smoke screenshot was empty.");
    writeFileSync(capturePath, capture.toPNG());
  }

  await gui(`await menuCommand('project-open'); return true;`);
  await waitForRoot(smokeRoot);

  if (!existsSync(join(smokeRoot, ".sceneaxi-config", "desktop-bridge-v1.json")) || existsSync(join(smokeNewRoot, ".sceneaxi-config", "desktop-bridge-v1.json"))) fail("GUI Open did not rebind CLI discovery.");
  await gui(`
    const recent = document.querySelector('#project-recent-select');
    await wait(() => Array.from(recent.options).some(option => option.value === ${JSON.stringify(smokeNewRoot)}), 'validated Recent root');
    recent.value = ${JSON.stringify(smokeNewRoot)}; recent.dispatchEvent(new Event('change', { bubbles: true }));
    await click('[data-action="project-open-recent"]'); return true;
  `);
  await waitForRoot(smokeNewRoot);

  if (readFileSync(guiDocument, "utf8") !== beforeCancelled) fail("Recent did not preserve approved bytes.");
  await gui(`await menuCommand('project-open'); return true;`);
  await waitForRoot(smokeRoot);
  smokeBridge = await activateProject(smokeRoot);
  const nativeGui = { newProject: true, openProject: true, recentProject: true, assetImport: true, documentReload: true, cancel: true, timeout: true, lateWorkRetired: true, hierarchySelection: true, transform: -3.5, save: true, undo: true, redo: true, localAsk: true, localBuild: true, approvedApply: true, play: true, exportWeb: true, bridgeRebind: true, dialogTransport: "isolated-typed-fixture", providerTransport: "offline-local" };

  // --- packaged-app smoke proof ---
  if (smokeBridge === null || smokeRoot === null) fail("smoke project bridge is unavailable");
  const proofBridge = smokeBridge;
  const handshake = proofBridge.handle({ action: "handshake" });

  if (!handshake.ok) fail(`handshake refused: ${handshake.reason}`);

  // Isolation is observed, not declared: the proof owns the document it reports on
  // only if the round trip is outside the retired implicit location, and the
  // directory is deleted below, so a wrong `cwd` here would take user data with it.
  const persistent = retiredImplicitProjectDir();
  const cwd = smokeRoot;
  const scratchProject = cwd !== persistent && !cwd.startsWith(`${persistent}${sep}`);

  if (!scratchProject) fail(`authoring proof would run on the retired implicit project ${cwd}`);

  // The envelope only says the bridge answered; a refused proposal or failed apply
  // also arrives inside `{ok: true}`. Read selected-instance values, session
  // phases, and document bytes, then start a fresh session and play only what it
  // re-read.
  const documentFile = join(cwd, SAMPLE_DOCUMENT);
  const seededBytes = readFileSync(documentFile, "utf8");

  const opened = proofBridge.handle({
    action: "authoring",
    payload: { op: "status", documentPath: SAMPLE_DOCUMENT },
  });

  if (!opened.ok) fail(`authoring status refused: ${opened.reason}`);
  const openedHash = payloadField(opened.data, "contentHash");

  const openedHierarchy = proofBridge.handle({
    action: "command",
    payload: createEditorCommandInvocation("scene-hierarchy-inspect", "desktop-control", {
      documentPath: SAMPLE_DOCUMENT,
      profile: "game",
    }),
  });

  if (!openedHierarchy.ok) fail(`hierarchy inspection refused: ${openedHierarchy.reason}`);
  const editableScene = openedHierarchy.data;
  const editableEntities = payloadField(editableScene, "entities");

  const editableEntity = Array.isArray(editableEntities)
    ? editableEntities.find(
        (entity) =>
          payloadField(entity, "id") === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      )
    : undefined;

  const editableProperties = payloadField(editableEntity, "properties");

  const editableProperty = Array.isArray(editableProperties)
    ? editableProperties.find(
        (property) =>
          payloadField(property, "id") === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
      )
    : undefined;

  const initialPropertyValue = payloadField(editableProperty, "value");

  if (!isDesktopText(openedHash) || initialPropertyValue !== -4.4) {
    fail("authoring status did not expose the typed starter translation");
  }

  const proposed = proofBridge.handle({
    action: "authoring",
    payload: {
      op: "edit-property",
      documentPath: SAMPLE_DOCUMENT,
      expectedContentHash: openedHash,
      profile: "game",
      entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
      newValue: -3.25,
    },
  });

  if (!proposed.ok) fail(`authoring propose refused: ${proposed.reason}`);
  const proposedPhase = payloadField(proposed.data, "phase");

  if (proposedPhase !== "reviewing") {
    fail(`authoring propose did not open a review: phase ${JSON.stringify(proposedPhase)}`);
  }

  if (readFileSync(documentFile, "utf8") !== seededBytes) {
    fail("authoring propose wrote to the document before it was accepted");
  }

  const accepted = proofBridge.handle({ action: "authoring", payload: { op: "accept" } });

  if (!accepted.ok) fail(`authoring accept refused: ${accepted.reason}`);
  const acceptedPhase = payloadField(accepted.data, "phase");

  if (acceptedPhase !== "applied") {
    fail(`authoring accept did not apply: phase ${JSON.stringify(acceptedPhase)}`);
  }

  if (readFileSync(documentFile, "utf8") === seededBytes) {
    fail("authoring accept reported applied but the document is unchanged");
  }

  const currentContentHash = () => {
    const response = proofBridge.handle({
      action: "authoring",
      payload: { op: "status", documentPath: SAMPLE_DOCUMENT },
    });

    if (!response.ok) fail(`authoring status refused: ${response.reason}`);
    const contentHash = payloadField(response.data, "contentHash");

    if (!isDesktopText(contentHash)) fail("authoring status returned no content hash");

    return contentHash;
  };

  const stageSceneOperation = <Input>(operation: Input) => {
    const response = proofBridge.handle({
      action: "authoring",
      payload: {
        op: "edit-scene",
        documentPath: SAMPLE_DOCUMENT,
        expectedContentHash: currentContentHash(),
        profile: "game",
        operation,
      },
    });

    if (!response.ok) fail(`selected-instance edit refused: ${response.reason}`);

    if (payloadField(response.data, "phase") !== "reviewing") {
      fail("selected-instance edit did not reach Change Review");
    }

    return response;
  };

  const acceptSceneOperation = () => {
    const response = proofBridge.handle({ action: "authoring", payload: { op: "accept" } });

    if (!response.ok || payloadField(response.data, "phase") !== "applied") {
      fail("selected-instance edit did not apply atomically");
    }
  };

  const smokeCommand = (id: Parameters<typeof createEditorCommandInvocation>[0], input: Parameters<typeof createEditorCommandInvocation>[2] = {}) => {
    const document: SmokeCommandDocument = {};

    if (id !== "run-stop" && id !== "run-reset") document.documentPath = SAMPLE_DOCUMENT;

    return proofBridge.handle({
      action: "command",
      payload: createEditorCommandInvocation(id, "desktop-control", { ...document, ...input }),
    });
  };

  const hierarchySourceId = "desktop-crate-beside";

  const created = smokeCommand("scene-object-create", {
    expectedContentHash: currentContentHash(),
    profile: "game",
    sourceInstanceId: hierarchySourceId,
    parentInstanceId: "desktop-crate-root",
  });

  const hierarchyCopyId = `${hierarchySourceId}-copy-1`;

  if (!created.ok || payloadField(created.data, "phase") !== "reviewing") {
    fail("hierarchy create did not stage through Change Review");
  }

  acceptSceneOperation();

  const reparented = smokeCommand("scene-object-reparent", {
    expectedContentHash: currentContentHash(),
    profile: "game",
    instanceId: hierarchyCopyId,
    parentInstanceId: "desktop-crate-stacked",
    transformPolicy: "preserve-local",
  });

  if (!reparented.ok || payloadField(reparented.data, "phase") !== "reviewing") {
    fail("hierarchy reparent did not stage through Change Review");
  }

  acceptSceneOperation();
  const verifiedHierarchy = smokeCommand("scene-hierarchy-inspect", { profile: "game" });

  if (!verifiedHierarchy.ok) fail(`hierarchy inspection refused: ${verifiedHierarchy.reason}`);
  const verifiedHierarchyObjects = payloadField(payloadField(verifiedHierarchy.data, "hierarchy"), "objects");

  if (
    !verifiedHierarchy.ok || !Array.isArray(verifiedHierarchyObjects) ||
    !verifiedHierarchyObjects.some((item) =>
      payloadField(item, "id") === hierarchyCopyId &&
      payloadField(item, "parentId") === "desktop-crate-stacked")
  ) fail("hierarchy create/reparent outcome was not visible in bridge inspection");

  const initialYProperty = Array.isArray(editableProperties) ? editableProperties.find(property => payloadField(property, "id") === "translation-y") : undefined;
  const initialY = payloadField(initialYProperty, "value");

  if (!isDesktopNumber(initialY)) fail("selected instance has no initial Y transform");

  const transformed = smokeCommand("scene-transform-apply", {
    expectedContentHash: currentContentHash(),
    profile: "game",
    instanceIds: [DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId],
    mode: "translate",
    space: "local",
    pivot: "individual",
    axes: "y",
    snapIncrement: null,
    valueKind: "delta",
    values: [0, 0.5, 0],
  });

  if (!transformed.ok || payloadField(transformed.data, "affectedIds") === undefined) {
    fail("transform command did not affect the selected packaged scene instance");
  }

  acceptSceneOperation();

  const animation = smokeCommand("animation-apply", {
    expectedContentHash: currentContentHash(),
    profile: "game",
    mutation: { kind: "clip-upsert", clipId: "smoke-idle", name: "Smoke idle", startMs: 0, durationMs: 1000 },
  });

  if (!animation.ok || payloadField(payloadField(animation.data, "authoringSnapshot"), "phase") !== "reviewing") {
    fail("animation apply did not stage through Change Review");
  }

  acceptSceneOperation();
  const inspectedAnimation = smokeCommand("animation-inspect", { profile: "game" });

  if (!inspectedAnimation.ok) fail(`animation inspection refused: ${inspectedAnimation.reason}`);
  const animationCatalog = payloadField(inspectedAnimation.data, "catalog");
  const animationClips = payloadField(animationCatalog, "clips");

  if (!inspectedAnimation.ok || !Array.isArray(animationClips) ||
      !animationClips.some((clip) => payloadField(clip, "clipId") === "smoke-idle")) {
    fail("animation apply did not persist the named clip");
  }

  const physics = smokeCommand("physics-apply", {
    expectedContentHash: currentContentHash(),
    profile: "game",
    mutation: {
      kind: "body-upsert",
      bodyId: "smoke-body",
      instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      bodyKind: "dynamic",
      mass: 1,
    },
  });

  if (!physics.ok || payloadField(payloadField(physics.data, "authoringSnapshot"), "phase") !== "reviewing") {
    fail("physics apply did not stage through Change Review");
  }

  acceptSceneOperation();
  const inspectedPhysics = smokeCommand("physics-inspect", { profile: "game" });

  if (!inspectedPhysics.ok) fail(`physics inspection refused: ${inspectedPhysics.reason}`);
  const physicsBodies = payloadField(payloadField(inspectedPhysics.data, "catalog"), "bodies");

  if (!inspectedPhysics.ok || !Array.isArray(physicsBodies) ||
      !physicsBodies.some((body) => payloadField(body, "bodyId") === "smoke-body")) {
    fail("physics apply did not persist the named body");
  }

  const play = smokeCommand("run-play");

  if (!play.ok) fail(`run-play refused: ${play.reason}`);
  const playSession = payloadField(play.data, "playSession");

  if (payloadField(playSession, "state") !== "playing") {
    fail("run-play did not start an isolated Play session");
  }

  const stoppedPlay = smokeCommand("run-stop");

  if (!stoppedPlay.ok || payloadField(stoppedPlay.data, "state") !== "stopped") {
    fail("run-stop did not stop the Play session");
  }

  const resetPlay = smokeCommand("run-reset");

  if (!resetPlay.ok || payloadField(resetPlay.data, "state") !== "playing") {
    fail("run-reset did not restore the isolated Play session");
  }

  const finalStoppedPlay = smokeCommand("run-stop");

  if (!finalStoppedPlay.ok || payloadField(finalStoppedPlay.data, "state") !== "stopped") {
    fail("Play session did not stop after reset");
  }

  const cliEntry = process.env["SCENEAXI_CLI_ENTRYPOINT"];

  if (!isProtocolText(cliEntry)) fail("smoke launcher did not provide the built CLI entrypoint");

  const cliHandshake = await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolveResult) => {
    const child = spawn("node", [
      cliEntry,
      "desktop", "bridge", "status", "--descriptor", join(cwd, ".sceneaxi-config", "desktop-bridge-v1.json"), "--json",
    ], { cwd, env: process.env });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", (error: Error) => {
      clearTimeout(timer);
      resolveResult({ status: null, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolveResult({ status, stdout, stderr });
    });
  });

  let cliHandshakeProof: unknown;

  try {
    cliHandshakeProof = JSON.parse(cliHandshake.stdout.trim());
  } catch {
    fail(`local CLI bridge handshake returned invalid JSON: ${cliHandshake.stderr}`);
  }

  const cliResult = payloadField(cliHandshakeProof, "result");
  const cliResponse = payloadField(cliResult, "response");

  if (cliHandshake.status !== 0 || cliHandshake.stderr !== "" || payloadField(cliHandshakeProof, "ok") !== true ||
      payloadField(cliResult, "connected") !== true || payloadField(cliResult, "tool") !== "sceneaxi.bridge.handshake" ||
      payloadField(cliResponse, "app") !== "@sceneaxi/desktop-linux" || payloadField(cliResponse, "localProtocolVersion") !== 1 ||
      payloadField(cliResponse, "creditRoute") !== "none") {
    fail(`local CLI bridge handshake failed: ${cliHandshake.stdout} ${cliHandshake.stderr}`);
  }


  stageSceneOperation({
    kind: "set-transform-component",
    instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
    propertyId: "rotation-y",
    value: 45,
  });
  acceptSceneOperation();
  stageSceneOperation({
    kind: "set-transform-component",
    instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
    propertyId: "scale-z",
    value: 1.5,
  });
  acceptSceneOperation();
  stageSceneOperation({
    kind: "add-instance",
    sourceInstanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
  });
  acceptSceneOperation();
  const afterAddBytes = readFileSync(documentFile, "utf8");
  const copiedInstanceId = `${DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId}-copy-${DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId === hierarchySourceId ? 2 : 1}`;

  stageSceneOperation({ kind: "remove-instance", instanceId: copiedInstanceId });

  const rejectedRemove = proofBridge.handle({
    action: "authoring",
    payload: { op: "reject" },
  });

  if (
    !rejectedRemove.ok ||
    payloadField(rejectedRemove.data, "phase") !== "rejected" ||
    readFileSync(documentFile, "utf8") !== afterAddBytes
  ) {
    fail("Remove Reject changed project bytes");
  }

  stageSceneOperation({ kind: "remove-instance", instanceId: copiedInstanceId });
  acceptSceneOperation();

  if (readFileSync(documentFile, "utf8") === afterAddBytes) {
    fail("accepted Remove left project bytes unchanged");
  }

  const undoneRemove = proofBridge.handle({ action: "authoring", payload: { op: "undo" } });

  if (
    !undoneRemove.ok ||
    payloadField(undoneRemove.data, "ok") !== true ||
    readFileSync(documentFile, "utf8") !== afterAddBytes
  ) {
    fail("Undo did not restore the accepted local instance bytes");
  }

  const malformed = proofBridge.handle({
    action: "authoring",
    payload: {
      op: "edit-scene",
      documentPath: SAMPLE_DOCUMENT,
      expectedContentHash: currentContentHash(),
      profile: "game",
      operation: {
        kind: "set-transform-component",
        instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
        propertyId: "scale-x",
        value: 0,
      },
    },
  });

  if (
    malformed.ok ||
    malformed.reason !== "SCENE_HIERARCHY_INPUT_UNSUPPORTED"
  ) {
    fail("out-of-range selected-instance input did not refuse by name");
  }

  const savedBytes = readFileSync(documentFile, "utf8");

  const reopened = proofBridge.handle({
    action: "authoring",
    payload: { op: "restart", documentPath: SAMPLE_DOCUMENT },
  });

  if (!reopened.ok) fail(`authoring reopen refused: ${reopened.reason}`);

  const reopenedHierarchy = proofBridge.handle({
    action: "command",
    payload: createEditorCommandInvocation("scene-hierarchy-inspect", "desktop-control", {
      documentPath: SAMPLE_DOCUMENT,
      profile: "game",
    }),
  });

  if (!reopenedHierarchy.ok) fail(`reopened hierarchy inspection refused: ${reopenedHierarchy.reason}`);
  const reopenedScene = reopenedHierarchy.data;
  const reopenedEntities = payloadField(reopenedScene, "entities");

  const reopenedEntity = Array.isArray(reopenedEntities)
    ? reopenedEntities.find(
        (entity) =>
          payloadField(entity, "id") === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      )
    : undefined;

  const reopenedProperties = payloadField(reopenedEntity, "properties");

  const reopenedProperty = Array.isArray(reopenedProperties)
    ? reopenedProperties.find(
        (property) =>
          payloadField(property, "id") === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
      )
    : undefined;

  const reopenedValue = payloadField(reopenedProperty, "value");
  const reopenedY = Array.isArray(reopenedProperties) ? payloadField(reopenedProperties.find(property => payloadField(property, "id") === "translation-y"), "value") : undefined;
  const persistedHierarchyObjects = payloadField(payloadField(reopenedScene, "hierarchy"), "objects");
  const persistedParent = Array.isArray(persistedHierarchyObjects) ? payloadField(persistedHierarchyObjects.find(object => payloadField(object, "id") === hierarchyCopyId), "parentId") : undefined;

  if (reopenedY !== initialY + 0.5 || persistedParent !== "desktop-crate-stacked") fail("fresh-session reopen lost persisted Y transform or nonroot parent");
  const persistedPhysics = smokeCommand("physics-inspect", { profile: "game" });
  const persistedBodies = persistedPhysics.ok ? payloadField(payloadField(persistedPhysics.data, "catalog"), "bodies") : undefined;

  if (!Array.isArray(persistedBodies) || !persistedBodies.some(body => payloadField(body, "bodyId") === "smoke-body")) fail("fresh-session reopen lost named smoke-body");

  if (reopenedValue !== -3.25 || readFileSync(documentFile, "utf8") !== savedBytes) {
    fail("authoring reopen did not prove the saved translation bytes");
  }

  const invokeProjectBrowser = async <DesktopRequest>(request: DesktopRequest) =>
    await window.webContents.executeJavaScript(
      `globalThis.sceneaxiDesktopLinux.browseProject(${JSON.stringify(request)})`,
    );

  const browserListed: unknown = await invokeProjectBrowser({
    action: "status",
    profile: "web",
  });

  const browserListedData = payloadField(browserListed, "data");
  const browserListedStatus = payloadField(browserListedData, "status");
  const browserFiles = payloadField(browserListedStatus, "files");

  const browserAsset = Array.isArray(browserFiles)
    ? browserFiles.find((file) => payloadField(file, "kind") === "asset")
    : undefined;

  const browserAssetPath = payloadField(browserAsset, "path");
  const browserAssetInstanceId = payloadField(browserAsset, "instanceId");
  const browserAssetDigest = payloadField(browserAsset, "digest");

  if (
    payloadField(browserListed, "ok") !== true ||
    payloadField(browserListedStatus, "activeDocumentPath") !== SAMPLE_DOCUMENT ||
    !Array.isArray(browserFiles) ||
    !isDesktopText(browserAssetPath) ||
    !isDesktopText(browserAssetInstanceId) ||
    !isDesktopText(browserAssetDigest)
  ) {
    fail("project browser preload channel did not list the canonical document and asset");
  }

  // SAFETY: the isolated packaged-document script constructs these acknowledgement/frame/DOM-state fields; the native smoke checks the returned acknowledgement and redraw before publishing proof.
  const browserUiOpen = (await window.webContents.executeJavaScript(
    `(async () => {
      const waitFor = async (predicate) => {
        for (let attempt = 0; attempt < 400; attempt += 1) {
          if (predicate()) return true;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return false;
      };
      const selectorReady = await waitFor(() => {
        const candidate = document.querySelector('#project-browser-file-select');
        return candidate instanceof HTMLSelectElement &&
          [...candidate.options].some((option) => option.value === ${JSON.stringify(browserAssetPath)});
      });
      const selector = document.querySelector('#project-browser-file-select');
      const opener = document.querySelector('[data-action="project-browser-open"]');
      if (!selectorReady || !(selector instanceof HTMLSelectElement) || !(opener instanceof HTMLButtonElement)) {
        return { selected: false, opened: false, frame: null, instanceId: null, digest: null };
      }
      const revision = Number(document.querySelector('.shell')?.dataset.projectBrowserRevision);
      selector.value = ${JSON.stringify(browserAssetPath)};
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      const selected = await waitFor(() =>
        document.querySelector('[data-busy]') === null &&
        document.querySelector('#project-browser-file-select')?.value === ${JSON.stringify(browserAssetPath)} &&
        document.querySelector('[data-project-browser-path]')?.textContent?.startsWith(${JSON.stringify(browserAssetPath)}));
      if (!selected) return { selected, opened: false, frame: null, instanceId: null, digest: null };
      opener.click();
      const opened = await waitFor(() =>
        Number(document.querySelector('.shell')?.dataset.projectBrowserRevision) > revision + 1 &&
        document.querySelector('.viewport')?.dataset.assetOpen === ${JSON.stringify(browserAssetInstanceId)} &&
        document.querySelector('.viewport')?.dataset.assetDigest === ${JSON.stringify(browserAssetDigest)});
      const status = document.querySelector('[data-project-status]')?.textContent ?? '';
      const frame = /opened at viewport frame ([0-9]+)/.exec(status);
      return {
        selected,
        opened,
        frame: frame === null ? null : Number(frame[1]),
        instanceId: document.querySelector('.viewport')?.dataset.assetOpen ?? null,
        digest: document.querySelector('.viewport')?.dataset.assetDigest ?? null,
      };
    })()`,
  )) as {
    selected: boolean;
    opened: boolean;
    frame: number | null;
    instanceId: string | null;
    digest: string | null;
  };

  const browserUnconfirmed: unknown = await invokeProjectBrowser({
    action: "delete",
    profile: "web",
    path: browserAssetPath,
  });

  const browserProtected: unknown = await invokeProjectBrowser({
    action: "delete",
    profile: "web",
    path: browserAssetPath,
    confirmed: true,
  });

  const restartedBrowser = createDesktopProjectBrowser({
    root: cwd,
    stateDirectory: join(cwd, ".sceneaxi-runtime"),
  }).handle({ action: "status", profile: "web" });

  if (
    browserUiOpen.selected !== true ||
    browserUiOpen.opened !== true ||
    !isDesktopNumber(browserUiOpen.frame) ||
    browserUiOpen.instanceId !== browserAssetInstanceId ||
    browserUiOpen.digest !== browserAssetDigest ||
    payloadField(browserUnconfirmed, "ok") !== false ||
    payloadField(browserUnconfirmed, "reason") !==
      DESKTOP_PROJECT_BROWSER_REFUSALS.confirmationRequired ||
    payloadField(browserProtected, "ok") !== false ||
    payloadField(browserProtected, "reason") !==
      DESKTOP_PROJECT_BROWSER_REFUSALS.operationNotPermitted ||
    !restartedBrowser.ok || restartedBrowser.data.status.selectedPath !== browserAssetPath ||
    readFileSync(documentFile, "utf8") !== savedBytes
  ) {
    fail(`project browser asset selection, bridge open, recovery, or protected mutation evidence is incomplete: ${JSON.stringify({
      browserUiOpen,
      browserAssetInstanceId,
      browserAssetDigest,
      browserUnconfirmed,
      browserProtected,
      restartedBrowser,
      documentBytesPreserved: readFileSync(documentFile, "utf8") === savedBytes,
    })}`);
  }

  const browserConfirmationRefusal = payloadField(browserUnconfirmed, "reason");
  const browserProtectedRefusal = payloadField(browserProtected, "reason");

  console.error("SMOKE_PHASE repeated import/reload/play/export plateau");
  const plateauSource = join(cwd, "smoke-source.gltf");
  writeFileSync(plateauSource, smokeAssetBytes());

  const plateau = await gui(`
    const canvas = document.querySelector('[data-live-viewport="canvas"]');
    const gl = canvas?.getContext('webgl2');
    if (!gl) throw new Error('SMOKE_RESOURCE_CONTEXT_ABSENT');
    const resources = new Map();
    const originals = [];
    for (const kind of ['Buffer', 'Texture', 'Program', 'Framebuffer', 'Renderbuffer']) {
      const live = new Set(); resources.set(kind, live);
      const create = gl['create' + kind].bind(gl); const dispose = gl['delete' + kind].bind(gl);
      originals.push(['create' + kind, gl['create' + kind]], ['delete' + kind, gl['delete' + kind]]);
      gl['create' + kind] = (...args) => { const handle = create(...args); if (handle) live.add(handle); return handle; };
      gl['delete' + kind] = (handle) => { live.delete(handle); return dispose(handle); };
    }
    const samples = []; const latencyMs = [];
    try {
      for (let cycle = 0; cycle < 12; cycle += 1) {
        const start = performance.now();
        const imported = await globalThis.sceneaxiDesktopLinux.request({ action: 'asset-import', payload: { profile: 'game', documentPath: 'scene.json', sourcePath: ${JSON.stringify(plateauSource)} } });
        if (!imported?.ok) throw new Error('SMOKE_REPEAT_IMPORT_REFUSED ' + imported?.reason);
        if (imported.data.outcome === 'reviewing') {
          const applied = await globalThis.sceneaxiDesktopLinux.request({ action: 'authoring', payload: { op: 'accept' } });
          if (!applied?.ok || applied.data.phase !== 'applied') throw new Error('SMOKE_REPEAT_IMPORT_NOT_APPLIED');
        } else if (imported.data.outcome !== 'replayed') throw new Error('SMOKE_REPEAT_IMPORT_NO_RESULT');
        if (document.querySelector('.shell')?.dataset.projectBrowserSelectedPath !== 'scene.json') {
          const selectedRevision = Number(document.querySelector('.shell')?.dataset.projectBrowserRevision || 0);
          const selector = document.querySelector('#project-browser-file-select');
          if (!selector) throw new Error('SMOKE_REPEAT_DOCUMENT_SELECTOR_ABSENT');
          selector.value = 'scene.json'; selector.dispatchEvent(new Event('change', { bubbles: true }));
          await wait(() => Number(document.querySelector('.shell')?.dataset.projectBrowserRevision) > selectedRevision && document.querySelector('.shell')?.dataset.projectBrowserSelectedPath === 'scene.json', 'plateau selected canonical document revision');
        }
        const revision = Number(document.querySelector('.shell')?.dataset.projectBrowserRevision || 0);
        await click('[data-action="document-reload"]');
        await wait(() => Number(document.querySelector('.shell')?.dataset.projectBrowserRevision) > revision && document.querySelector('.shell')?.dataset.projectBrowserSelectedPath === 'scene.json', 'plateau import/reload exact revision');
        const frameBefore = Number(document.querySelector('.viewport')?.dataset.playbackFrame || 0);
        await menuCommand('run-play');
        await wait(() => document.querySelector('.viewport')?.dataset.playback === 'acknowledged' && Number(document.querySelector('.viewport')?.dataset.playbackFrame) > frameBefore, 'plateau Play new frame');
        await click('[data-action="mode"][data-value="ship"]');
        await click('[data-command="ship-export-web"]');
        await wait(() => document.querySelector('[data-ship-export-evidence]')?.hidden === false && document.querySelector('[data-command="ship-export-web"]')?.getAttribute('aria-disabled') !== 'true', 'plateau export completed');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        samples.push(Object.fromEntries(Array.from(resources, ([kind, live]) => [kind, live.size])));
        latencyMs.push(performance.now() - start);
      }
    } finally { for (const [name, original] of originals) gl[name] = original; }
    return { samples, latencyMs, maximumAssetBytes: ${PROJECT_ASSET_MAX_BYTES}, oversizeRefusal: ${JSON.stringify(CONTAINED_GLTF_REFUSALS.oversize)}, importReloadCycles: samples.length, canvases: document.querySelectorAll('[data-live-viewport="canvas"]').length };
  `);

  const plateauSamples = payloadField(plateau, "samples");
  const plateauLatencies = payloadField(plateau, "latencyMs");

  if (!Array.isArray(plateauSamples) || plateauSamples.length !== 12 || !Array.isArray(plateauLatencies) ||
      plateauLatencies.length !== 12 || plateauLatencies.some(ms => !isDesktopNumber(ms) || !Number.isFinite(ms) || ms > 4000) ||
      payloadField(plateau, "canvases") !== 1 ||
      plateauSamples.slice(3).some(sample => JSON.stringify(sample) !== JSON.stringify(plateauSamples[3]))) fail("Repeated actual Play/export did not plateau within the existing 4-second per-control budget.");

  const openPath = proofBridge.handle({
    action: "open-path",
    payload: { documentPath: SAMPLE_DOCUMENT },
  });

  if (!openPath.ok) fail(`saved open-path refused: ${openPath.reason}`);

  const shipped = proofBridge.handle({
    action: "ship",
    payload: {
      op: "export-web",
      documentPath: SAMPLE_DOCUMENT,
      expectedContentHash: currentContentHash(),
    },
  });

  let exportDirectory: string | null = null;
  let bundleDigest: string | null = null;
  let sourceDigest: string | null = null;

  if (process.platform === "linux") {
    if (!shipped.ok) fail(`Web export refused: ${shipped.reason}`);
    const exportDirectoryField = payloadField(shipped.data, "outputDirectory");
      exportDirectory = isDesktopText(exportDirectoryField) ? exportDirectoryField : null;
    const handoffPath = payloadField(shipped.data, "handoffPath");
    const bundleDigestField = payloadField(shipped.data, "bundleDigest");
      bundleDigest = isDesktopText(bundleDigestField) ? bundleDigestField : null;
    const sourceProject = payloadField(shipped.data, "sourceProject");
    const sourceDigestField = payloadField(sourceProject, "contentHash");
      sourceDigest = isDesktopText(sourceDigestField) ? sourceDigestField : null;

    const parsedHandoff = isDesktopText(handoffPath) && existsSync(handoffPath)
      ? parseDeliveryHandoffText(readFileSync(handoffPath, "utf8"))
      : null;

    const verifiedExportDirectory = isDesktopText(exportDirectory)
      ? exportDirectory
      : null;

    const handoffArtifactsMatch = verifiedExportDirectory !== null &&
      parsedHandoff?.ok === true &&
      Object.entries(parsedHandoff.handoff.artifacts).every(([path, artifact]) => {
        const artifactPath = join(verifiedExportDirectory, ...path.split("/"));

        return existsSync(artifactPath) &&
          `sha256:${createHash("sha256").update(readFileSync(artifactPath)).digest("hex")}` ===
            artifact.digest;
      });

    if (
      !isDesktopText(exportDirectory) ||
      !exportDirectory.startsWith(`${cwd}${sep}exports${sep}web${sep}`) ||
      !isDesktopText(handoffPath) ||
      !existsSync(handoffPath) ||
      !isDesktopText(bundleDigest) ||
      !isDesktopText(sourceDigest) ||
      readFileSync(join(exportDirectory, "source", SAMPLE_DOCUMENT), "utf8") !== savedBytes ||
      !readFileSync(join(exportDirectory, "index.html"), "utf8").includes("sceneaxi-web.js") ||
      parsedHandoff?.ok !== true ||
      parsedHandoff.handoff.target !== "web" ||
      parsedHandoff.handoff.artifactSetDigest !== bundleDigest ||
      parsedHandoff.handoff.artifacts[`source/${SAMPLE_DOCUMENT}`]?.digest !== sourceDigest ||
      !handoffArtifactsMatch
    ) {
      fail("Web export did not preserve source bytes, local runtime, and Delivery Handoff evidence");
    }
  } else if (
    shipped.ok ||
    shipped.reason !== DESKTOP_WEB_EXPORT_REFUSALS.platformUnsupported
  ) {
    fail("Non-Linux Web export did not refuse its unsupported platform by name");
  }

  const mountable = payloadField(openPath.data, "mountable");
  const mountedInstances = payloadField(mountable, "instances");

  const playedEntity = Array.isArray(mountedInstances)
    ? mountedInstances.find(
        (instance) =>
          payloadField(instance, "instanceId") ===
          DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      )
    : undefined;

  const playedTransform = payloadField(playedEntity, "worldTransform");
  const playedTranslation = payloadField(playedTransform, "translation");
  const playedRotation = payloadField(playedTransform, "rotationEulerDegrees");
  const playedScale = payloadField(playedTransform, "scale");

  const playedCopy = Array.isArray(mountedInstances)
    ? mountedInstances.find(
        (instance) => payloadField(instance, "instanceId") === copiedInstanceId,
      )
    : undefined;

  if (
    !Array.isArray(playedTranslation) || playedTranslation[0] !== -3.25 ||
    !Array.isArray(playedRotation) || playedRotation[1] !== 45 ||
    !Array.isArray(playedScale) || playedScale[2] !== 1.5 ||
    playedCopy === undefined
  ) {
    fail("Play did not reopen the saved translation, rotation, scale, and local instance");
  }

  const frameReport = await Promise.race([
    firstFrameReport,
    new Promise((resolve) => setTimeout(() => resolve(null), SMOKE_TIMEOUT_MS)),
  ]);

  if (frameReport === null) fail("no renderer frame report within the smoke timeout");

  // SAFETY: the isolated packaged-document script constructs these acknowledgement/frame/DOM-state fields; the native smoke checks the returned acknowledgement and redraw before publishing proof.
  const playbackDom = (await window.webContents.executeJavaScript(
    `(async () => {
      const waitFor = async (predicate) => {
        for (let attempt = 0; attempt < 1500; attempt += 1) {
          if (predicate()) return true;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return false;
      };
      const play = [...document.querySelectorAll('[data-command]')]
        .find((element) => element.dataset.command === 'run-play');
      if (!(play instanceof HTMLElement)) return { clicked: false, accepted: false, frame: null, state: null };
      play.click();
      const accepted = await waitFor(() => document.querySelector('.viewport')?.dataset.playback === 'acknowledged');
      const frame = /Viewport frame ([0-9]+) acknowledged/.exec(document.querySelector('[data-run-live-report]')?.textContent ?? '');
      const stop = [...document.querySelectorAll('[data-command]')]
        .find((element) => element.dataset.command === 'run-stop');
      const reset = [...document.querySelectorAll('[data-command]')]
        .find((element) => element.dataset.command === 'run-reset');
      if (!(stop instanceof HTMLElement) || !(reset instanceof HTMLElement)) {
        return { clicked: true, accepted, frame: frame === null ? null : Number(frame[1]), state: document.querySelector('.viewport')?.dataset.playback ?? null, stop: '', reset: '' };
      }
      stop.click();
      await waitFor(() => (document.querySelector('[data-product-run-report]')?.textContent ?? '').startsWith('Stopped ·'));
      const stopState = document.querySelector('[data-product-run-report]')?.textContent ?? '';
      reset.click();
      await waitFor(() => (document.querySelector('[data-product-run-report]')?.textContent ?? '').startsWith('Reset ·'));
      const resetState = document.querySelector('[data-product-run-report]')?.textContent ?? '';
      return {
        clicked: true,
        accepted,
        frame: frame === null ? null : Number(frame[1]),
        state: document.querySelector('.viewport')?.dataset.playback ?? null,
        stop: stopState,
        reset: resetState,
      };
    })()`,
  )) as {
    clicked: boolean;
    accepted: boolean;
    frame: number | null;
    state: string | null;
    stop: string;
    reset: string;
  };

  if (
    playbackDom.clicked !== true ||
    playbackDom.accepted !== true ||
    playbackDom.state !== "acknowledged" ||
    !isDesktopNumber(playbackDom.frame)
  ) {
    fail(`Play did not redraw the saved composition in the packaged viewport: ${JSON.stringify(playbackDom)}`);
  }


  // Audio: the session proofs run while the window is still in the clean Game
  // state; the project-switch proof then rebinds the smoke project.
  const audioProof = await runAudioSmokeProof(window);
  const audioResetStopped = await runAudioResetSmokeProof(window);
  const audioDecodeRefused = await runAudioDecodeRefusalSmokeProof(window);
  const audioKidsSwitchStopped = await runAudioKidsProfileSmokeProof(window);
  const audioSwitchRoot = mkdtempSync(join(tmpdir(), "sceneaxi-audio-switch-"));
  seedProject(audioSwitchRoot);

  const audioProjectSwitchStopped = await runAudioProjectSwitchSmokeProof(
    window,
    async () => { await activateProject(audioSwitchRoot); },
  );

  // Rebind the smoke project for the feature proofs. The chrome never saw the
  // switch (the host only stopped its viewport), and the smoke bytes are unchanged.
  if (cwd === null) fail("smoke project root missing");
  await activateProject(cwd);
  const audioStatusBeforeRestore = await window.webContents.executeJavaScript(`document.querySelector('[data-project-status]')?.textContent ?? ''`);
  await clickRendererControl(window, '[data-action="document-reload"]');

  if (!await waitForRenderer(window, `document.querySelector('[data-project-status]')?.textContent !== ${JSON.stringify(audioStatusBeforeRestore)} && document.querySelector('[data-project-state]')?.getAttribute('data-project-state') === 'open' && document.querySelector('[data-product-action][data-busy="true"]') === null`)) {
    fail("GUI Reload did not restore the smoke document after the audio project switch");
  }

  if (
    audioProof.duration !== 2 || audioProof.sampleRate !== 44_100 ||
    audioProof.channels !== 1 || audioProof.volume < 0.3 || audioProof.volume > 0.4 || audioProof.gain < 0.3 || audioProof.gain > 0.4 || audioProof.sourceStarted !== true || audioProof.pointerTargets.volume !== true || audioProof.pointerTargets.play !== true ||
    audioProof.offlineRms <= 0.01 || audioProof.liveRms < 0.07 || audioProof.liveRms > 0.11 || audioProof.stoppedRms > 0.01 || audioProof.stopped !== true || audioProof.contextDisposed !== true ||
    audioResetStopped !== true || audioDecodeRefused !== true || audioKidsSwitchStopped !== true || audioProjectSwitchStopped !== true
  ) {
    fail(`renderer audio proof failed: ${JSON.stringify({ audioProof, audioResetStopped, audioDecodeRefused, audioKidsSwitchStopped, audioProjectSwitchStopped })}`);
  }

  // The window's own DOM must agree with the frame report: one live canvas, the
  // inert note gone, the report line printed. Asserted by scripts/smoke.mjs.
  // SAFETY: the isolated packaged-document script constructs exactly the canvas count, boolean inert-note flag, and nullable DOM text fields returned here.
  const viewportDom = (await window.webContents.executeJavaScript(
    `({ canvases: document.querySelectorAll('[data-live-viewport="canvas"]').length,
        inertNotePresent: document.querySelector('.viewport-note-inert') !== null,
        reportText: document.getElementById('desktop-live-viewport-report')?.textContent ?? null })`,
  )) as { canvases: number; inertNotePresent: boolean; reportText: string | null };

  // SAFETY: This main-process-only smoke script is defined here and constructs the asserted proof fields from the isolated packaged document; the resulting values are checked by the smoke assertions below.
  const waitForGui = async <T>(script: string) =>
    await window.webContents.executeJavaScript(script) as T;

  const guiTransformProof = await waitForGui<{
    gui: boolean;
    selectedEntity: string;
    nudgeAccepted: boolean;
    staged: boolean;
    diagnostic: string;
    valueBefore: number;
    stagedValue: number;
    snapIncrement?: string;
    status?: string;
    transformMode?: string;
    outcome?: string;
    outcomeCode?: string;
    badge?: string;
  }>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 1500; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    const click = (selector) => document.querySelector(selector)?.click();
    const priorReloadStatus = document.querySelector('[data-project-status]')?.textContent ?? '';
    click('[data-action="document-reload"]');
    await waitFor(() => document.querySelector('[data-project-status]')?.textContent !== priorReloadStatus &&
      document.querySelector('[data-project-state]')?.getAttribute('data-project-state') === 'open' &&
      document.querySelector('[data-busy]') === null);
    click('[data-action="profile"][data-value="game"]');
    await waitFor(() => document.querySelector('.shell')?.dataset.profile === 'game');
    click('[data-action="mode"][data-value="build"]');
    await waitFor(() => document.querySelector('[data-mode-panel="build"]')?.hidden === false);
    const entity = document.querySelector('[data-action="scene-entity-select"]');
    const entityId = ${JSON.stringify(DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId)};
    if (!(entity instanceof HTMLSelectElement) || ![...entity.options].some((option) => option.value === entityId)) {
      return { gui: false, selectedEntity: '', nudgeAccepted: false, staged: false, diagnostic: '', valueBefore: NaN, stagedValue: NaN };
    }
    entity.value = entityId;
    entity.dispatchEvent(new Event('change', { bubbles: true }));
    const inputSelector = '#scene-property-translation-x';
    const hasInput = await waitFor(() => document.querySelector(inputSelector) instanceof HTMLInputElement);
    if (!hasInput) return { gui: false, selectedEntity: '', nudgeAccepted: false, staged: false, diagnostic: '', valueBefore: NaN, stagedValue: NaN };
    const input = document.querySelector(inputSelector);
    const valueBefore = input.valueAsNumber;
    const snap = document.querySelector('[data-scene-transform-snap]');
    if (snap instanceof HTMLInputElement) {
      snap.value = '0.1';
      snap.dispatchEvent(new Event('input', { bubbles: true }));
    }
    click('[data-action="scene-transform-mode"][data-value="rotate"]');
    const stagedValue = Number((valueBefore + 0.2).toFixed(6));
    input.value = String(stagedValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Selecting the entity sent a selection request; Stage is a second request,
    // which the chrome refuses while the first is in flight.
    await waitFor(() => document.querySelector('[data-product-action][data-busy="true"]') === null);
    click('[data-action="scene-property-stage"]');
    const staged = await waitFor(() => document.querySelector('[data-change-badge]')?.textContent === '1' &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
    return {
      gui: true,
      selectedEntity: entityId,
      nudgeAccepted: false,
      staged,
      diagnostic: document.querySelector('[data-scene-property-diagnostic]')?.textContent ?? '',
      valueBefore,
      stagedValue,
      transformMode: document.querySelector('.shell')?.dataset.transformMode ?? '',
      snapIncrement: snap instanceof HTMLInputElement ? snap.value : '',
    };
  })()`);

  const sceneStageBytes = readFileSync(documentFile, "utf8");
  const sceneStageDigest = createHash("sha256").update(sceneStageBytes).digest("hex");

  if (!guiTransformProof.gui || !guiTransformProof.staged ||
      guiTransformProof.transformMode !== "rotate" ||
      guiTransformProof.stagedValue === guiTransformProof.valueBefore) {
    fail(`GUI transform/property staging did not reach review: ${JSON.stringify(guiTransformProof)}`);
  }

  const guiStageUnchangedBytes = readFileSync(documentFile, "utf8") === sceneStageBytes;
  await waitForGui<boolean>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 1500; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    document.querySelector('[data-action="dock-tab"][data-value="changes"]')?.click();
    document.querySelector('[data-action="change-accept"]')?.click();
    return await waitFor(() => document.querySelector('[data-change-badge]')?.textContent === '0' &&
      document.querySelector('[data-product-status]')?.textContent?.includes('saved') &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
  })()`);
  const sceneAcceptedBytes = readFileSync(documentFile, "utf8");
  const sceneAcceptedDigest = createHash("sha256").update(sceneAcceptedBytes).digest("hex");
  const acceptedSceneDocument = JSON.parse(sceneAcceptedBytes);

  const acceptedSceneEntity = acceptedSceneDocument.data?.composedScene?.instances?.find(
    (entity: { instanceId?: string }) => entity.instanceId === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
  );

  const acceptedSceneValue = acceptedSceneEntity?.localTransform?.translation?.[0];

  if (!guiStageUnchangedBytes || sceneAcceptedBytes === sceneStageBytes ||
      acceptedSceneValue !== guiTransformProof.stagedValue) {
    fail(`GUI scene property Accept did not preserve-before-accept and persist the expected value: ${JSON.stringify({
      guiTransformProof,
      guiStageUnchangedBytes,
      changed: sceneAcceptedBytes !== sceneStageBytes,
      acceptedSceneValue,
      sceneStageDigest,
      sceneAcceptedDigest,
    })}`);
  }

  const guiPhysicsStage = await waitForGui<{
    staged: boolean;
    diagnostic: string;
  }>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 700; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    const mutation = document.querySelector('[data-catalog-mutation="physics"]');
    if (!(mutation instanceof HTMLTextAreaElement)) return { staged: false, diagnostic: 'physics mutation control missing' };
    mutation.value = JSON.stringify({ kind: 'world-set', gravityY: -10.25, stepMs: 16, seed: 1, engine: 'toy' });
    mutation.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-action="catalog-stage"][data-value="physics"]')?.click();
    return {
      staged: await waitFor(() => document.querySelector('[data-change-badge]')?.textContent === '1' &&
        document.querySelector('[data-product-action][data-busy="true"]') === null),
      diagnostic: document.querySelector('[data-project-status]')?.textContent ?? '',
    };
  })()`);

  const physicsBeforeAccept = readFileSync(documentFile, "utf8");
  const physicsUnchangedBeforeAccept = physicsBeforeAccept === sceneAcceptedBytes;
  await waitForGui<boolean>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 700; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    document.querySelector('[data-action="dock-tab"][data-value="changes"]')?.click();
    document.querySelector('[data-action="change-accept"]')?.click();
    return await waitFor(() => document.querySelector('[data-change-badge]')?.textContent === '0' &&
      document.querySelector('[data-project-status]')?.textContent?.includes('saved') &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
  })()`);
  const physicsAcceptedBytes = readFileSync(documentFile, "utf8");
  const physicsAcceptedDigest = createHash("sha256").update(physicsAcceptedBytes).digest("hex");

  if (!guiPhysicsStage.staged || !physicsUnchangedBeforeAccept || physicsAcceptedBytes === physicsBeforeAccept ||
      !physicsAcceptedBytes.includes('"gravityY": -10.25')) {
    fail(`GUI physics proposal did not stage without writes and persist on Accept: ${JSON.stringify({
      guiPhysicsStage,
      physicsUnchangedBeforeAccept,
      changedAfterAccept: physicsAcceptedBytes !== physicsBeforeAccept,
      expectedWorldValue: physicsAcceptedBytes.includes('"gravityY": -10.25'),
    })}`);
  }

  const guiAnimationStage = await waitForGui<{
    staged: boolean;
    result: string;
    status?: string;
    kind?: string;
    disabled?: boolean;
    outcome?: string;
    outcomeCode?: string;
  }>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 700; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    document.querySelector('[data-action="mode"][data-value="animate"]')?.click();
    const modeReady = await waitFor(() => document.querySelector('.shell')?.dataset.mode === 'animate' &&
      document.querySelector('[data-action="dock-tab"][data-value="timeline"]') instanceof HTMLElement);
    if (!modeReady) return { staged: false, result: 'animation mode did not expose Timeline' };
    document.querySelector('[data-action="dock-tab"][data-value="timeline"]')?.click();
    const timelineOpened = await waitFor(() => document.querySelector('[data-dock-panel="timeline"]')?.hidden === false &&
      document.querySelector('[data-timeline-result]')?.textContent !== 'Open Timeline to inspect clips, tracks, and keyframes.' &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
    if (!timelineOpened) return {
      staged: false,
      result: document.querySelector('[data-timeline-result]')?.textContent ?? '',
      status: document.querySelector('[data-project-status]')?.textContent ?? '',
    };
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const mutation = document.querySelector('[data-timeline-mutation]');
    if (!(mutation instanceof HTMLTextAreaElement)) return { staged: false, result: 'timeline mutation control missing' };
    mutation.value = JSON.stringify({ kind: 'clip-upsert', clipId: 'smoke-idle', name: 'Smoke Idle', startMs: 0, durationMs: 1200 });
    mutation.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-action="timeline-apply"]')?.click();
    const staged = await waitFor(() => document.querySelector('[data-change-badge]')?.textContent === '1' &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
    return {
      staged,
      result: document.querySelector('[data-timeline-result]')?.textContent ?? '',
      status: document.querySelector('[data-project-status]')?.textContent ?? '',
      kind: mutation.dataset.kind,
      disabled: mutation.disabled,
      outcome: document.querySelector('[data-outcome-title]')?.textContent ?? '',
      outcomeCode: document.querySelector('[data-outcome-code]')?.textContent ?? '',
    };
  })()`);

  const animationBeforeAccept = readFileSync(documentFile, "utf8");
  const animationUnchangedBeforeAccept = animationBeforeAccept === physicsAcceptedBytes;
  await waitForGui<boolean>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 700; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    document.querySelector('[data-action="dock-tab"][data-value="changes"]')?.click();
    document.querySelector('[data-action="change-accept"]')?.click();
    return await waitFor(() => document.querySelector('[data-change-badge]')?.textContent === '0' &&
      document.querySelector('[data-project-status]')?.textContent?.includes('saved') &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
  })()`);
  const animationAcceptedBytes = readFileSync(documentFile, "utf8");
  const animationAcceptedDigest = createHash("sha256").update(animationAcceptedBytes).digest("hex");

  if (!guiAnimationStage.staged || !animationUnchangedBeforeAccept || animationAcceptedBytes === animationBeforeAccept ||
      !animationAcceptedBytes.includes('"clipId": "smoke-idle"') ||
      !animationAcceptedBytes.includes('"name": "Smoke Idle"') ||
      !animationAcceptedBytes.includes('"durationMs": 1200')) {
    fail(`GUI animation proposal did not stage without writes and persist on Accept: ${JSON.stringify({
      guiAnimationStage,
      animationUnchangedBeforeAccept,
      changedAfterAccept: animationAcceptedBytes !== animationBeforeAccept,
    })}`);
  }

  const guiAnimationEvaluation = await waitForGui<string>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 700; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    document.querySelector('[data-action="dock-tab"][data-value="timeline"]')?.click();
    const output = document.querySelector('[data-timeline-result]');
    const inspectionReady = await waitFor(() => output?.textContent?.includes('sceneaxi.scene-animation-inspection') &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
    if (!inspectionReady) return JSON.stringify({ evaluated: false, output: output?.textContent ?? '', status: document.querySelector('[data-project-status]')?.textContent ?? '', buttonFound: false, buttonDisabled: null });
    const evaluateButton = document.querySelector('[data-action="timeline-evaluate"]');
    const priorResult = output?.textContent ?? '';
    evaluateButton?.click();
    const evaluated = await waitFor(() => output?.textContent !== priorResult &&
      (output?.textContent?.includes('sceneaxi.scene-animation-evaluation') ||
        output?.textContent?.includes('ANIMATION_')) &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
    return JSON.stringify({
      evaluated,
      output: output?.textContent ?? '',
      status: document.querySelector('[data-project-status]')?.textContent ?? '',
      buttonFound: evaluateButton instanceof HTMLElement,
      buttonDisabled: evaluateButton instanceof HTMLButtonElement ? evaluateButton.disabled : null,
    });
  })()`);

  const animationEvaluationProof = JSON.parse(guiAnimationEvaluation);

  if (animationEvaluationProof.evaluated !== true ||
      !animationEvaluationProof.output.includes('sceneaxi.scene-animation-evaluation') ||
      animationEvaluationProof.output.includes('ANIMATION_STALE_VERSION')) {
    fail(`Animation evaluate used a stale content version after the GUI proposal was accepted: ${guiAnimationEvaluation}`);
  }

  const guiCommandFormProofs = new Map<string, object>();
  const fileBytes = () => readFileSync(documentFile, "utf8");
  const digestBytes = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

  const readCommandFieldOptions = async (commandId: string, fieldName: string) =>
    await window.webContents.executeJavaScript(`(() => {
      const field = document.querySelector('[data-editor-command-form="${commandId}"] [data-command-field="${fieldName}"]');
      return field instanceof HTMLSelectElement ? [...field.options].map((option) => option.value).filter(Boolean) : [];
    })()`);

  const readGuiOutcomeAfter = async () => {
    if (!await waitForRenderer(window, "document.querySelector('[data-overlay=\"outcome\"]')?.hidden === false")) {
      fail("GUI command did not open its outcome dialog");
    }

    const outcome = await rendererOutcome(window);

    if (!await waitForRenderer(window, "document.querySelector('[data-product-action][data-busy=\"true\"]') === null")) {
      fail(`GUI command action did not settle after its outcome: ${JSON.stringify(outcome)}`);
    }

    return outcome;
  };

  const submitGuiForm = async (commandId: string) => {
    await dismissRendererOutcome(window);

    const ready = await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelector('[data-editor-command-submit="${commandId}"]');
      return button instanceof HTMLButtonElement && !button.disabled;
    })()`);

    if (!ready) fail(`${commandId} form is not enabled after its GUI prerequisites`);
    await clickRendererControl(window, `[data-editor-command-submit="${commandId}"]`);

    return await readGuiOutcomeAfter();
  };

  const runGuiMenuCommand = async (commandId: string) => {
    await dismissRendererOutcome(window);
    await clickRendererControl(window, '[data-menu-trigger="file"]');

    if (!await waitForRenderer(window, "document.querySelector('#menu-panel-file')?.hidden === false")) fail("File menu did not open through the GUI");
    await clickRendererControl(window, `#menu-command-${commandId}`);

    return await readGuiOutcomeAfter();
  };

  const acceptGuiSceneReview = async (label = "scene command") => {
    await dismissRendererOutcome(window);
    await clickRendererControl(window, '[data-action="dock-tab"][data-value="changes"]');

    if (!await waitForRenderer(window, "document.querySelector('[data-change-proposal]')?.hidden === false")) {
      fail("GUI Change Review did not show the staged proposal");
    }

    await clickRendererControl(window, '[data-action="change-accept"]');

    if (!await waitForRenderer(window, "document.querySelector('[data-change-badge]')?.textContent === '0' && document.querySelector('[data-project-status]')?.textContent?.includes('saved') && document.querySelector('[data-product-action][data-busy=\"true\"]') === null")) {
      const state = await window.webContents.executeJavaScript(`({ badge: document.querySelector('[data-change-badge]')?.textContent, status: document.querySelector('[data-project-status]')?.textContent, outcome: document.querySelector('[data-outcome-code]')?.textContent, proposalHidden: document.querySelector('[data-change-proposal]')?.hidden })`);
      fail(`GUI Change Review Accept did not save ${label}: ${JSON.stringify(state)}`);
    }

    await dismissRendererOutcome(window);
  };

  const setProfileAndMode = async () => {
    await dismissRendererOutcome(window);
    await clickRendererControl(window, '[data-action="profile"][data-value="game"]');

    if (!await waitForRenderer(window, "document.querySelector('.shell')?.dataset.profile === 'game'")) fail("Game profile did not open for command forms");
    await clickRendererControl(window, '[data-action="mode"][data-value="build"]');

    if (!await waitForRenderer(window, "document.querySelector('[data-mode-panel=\"build\"]')?.hidden === false")) fail("Build mode did not open for command forms");
  };

  const submitAndAcceptMutation = async (commandId: string) => {
    const before = fileBytes();
    const result = await submitGuiForm(commandId);

    if (result.code !== "COMMAND_COMPLETED") fail(`${commandId} did not stage through its GUI form: ${JSON.stringify(result)}`);
    const unchangedBeforeAccept = fileBytes() === before;
    await acceptGuiSceneReview(commandId);
    const after = fileBytes();

    if (!unchangedBeforeAccept || after === before) fail(`${commandId} did not defer persisted bytes until GUI Accept`);

    return { result, unchangedBeforeAccept, digestBefore: digestBytes(before), digestAfter: digestBytes(after), changed: after !== before };
  };

  await setProfileAndMode();

  const viewportBefore = fileBytes();
  await dismissRendererOutcome(window);
  await clickRendererControl(window, '[data-command="run-play"]');

  if (!await waitForRenderer(window, "document.querySelector('.viewport')?.dataset.playback === 'acknowledged'")) fail("Play did not create a viewport session for viewport-source-set");

  if (!await fillRendererCommandField(window, "viewport-source-set", "source", "scene")) fail("viewport-source-set source field was not available through the GUI");
  const viewportSourceResult = await submitGuiForm("viewport-source-set");
  const viewportAfter = fileBytes();

  if (viewportSourceResult.code !== "COMMAND_COMPLETED" || viewportAfter !== viewportBefore) fail(`viewport-source-set changed authoring bytes or refused: ${JSON.stringify(viewportSourceResult)}`);
  guiCommandFormProofs.set("#258", {
    gui: true,
    state: "viewport-source-set-completed",
    source: "scene",
    code: viewportSourceResult.code,
    authoringBytesUnchanged: viewportAfter === viewportBefore,
    digest: digestBytes(viewportAfter),
  });
  await dismissRendererOutcome(window);
  await clickRendererControl(window, '[data-action="mode"][data-value="run"]');
  await clickRendererControl(window, '[data-command="run-stop"]');

  if (!await waitForRenderer(window, "(document.querySelector('[data-product-run-report]')?.textContent ?? '').startsWith('Stopped ·')")) fail("viewport-source smoke Play did not stop through the GUI");
  await setProfileAndMode();

  await clickRendererControl(window, '[data-command="physics-inspect"]');

  if (!await waitForRenderer(window, "document.querySelector('[data-catalog-report=\"physics\"]')?.textContent !== ''")) fail("physics inspection did not render its GUI catalog");
  const physicsInspectionMessage = await window.webContents.executeJavaScript(`document.querySelector('[data-catalog-report="physics"]')?.textContent ?? ''`);

  if (!physicsInspectionMessage.includes('"physicsHostReady": true')) fail(`physics inspection did not ready the evaluator: ${physicsInspectionMessage}`);
  const physicsBeforeEvaluate = fileBytes();

  if (!await fillRendererCommandField(window, "physics-evaluate", "steps", "1")) fail("physics-evaluate steps field was unavailable");
  const physicsEvaluation = await submitGuiForm("physics-evaluate");
  const physicsAfterEvaluate = fileBytes();
  const physicsReport = JSON.parse(physicsEvaluation.message);
  const physicsEvaluatedSteps = physicsReport.snapshots?.length ?? 0;

  if (physicsEvaluation.code !== "COMMAND_COMPLETED" || physicsReport.kind !== "sceneaxi.scene-physics-evaluation" || physicsEvaluatedSteps !== 1 || physicsReport.snapshots[0]?.step !== 1 || physicsAfterEvaluate !== physicsBeforeEvaluate) {
    fail(`physics-evaluate did not return a read-only one-step evaluation: ${JSON.stringify({ physicsEvaluation, authoringUnchanged: physicsAfterEvaluate === physicsBeforeEvaluate })}`);
  }

  guiCommandFormProofs.set("#260", {
    evaluate: { gui: true, code: physicsEvaluation.code, kind: physicsReport.kind, steps: physicsEvaluatedSteps, finalStep: physicsReport.snapshots[0].step, authoringBytesUnchanged: physicsAfterEvaluate === physicsBeforeEvaluate, digest: digestBytes(physicsAfterEvaluate) },
  });
  await dismissRendererOutcome(window);

  if (!await fillRendererCommandField(window, "scene-prefab-define", "definitionId", "smoke-prefab")) fail("prefab definition ID field was unavailable");
  const prefabDefine = await submitAndAcceptMutation("scene-prefab-define");
  const prefabAfterDefine = fileBytes();

  if (!prefabAfterDefine.includes("smoke-prefab")) fail("accepted prefab definition was not persisted");
  const prefabInspect = await submitGuiForm("scene-prefab-inspect");
  const prefabCatalog = JSON.parse(prefabInspect.message);

  if (prefabInspect.code !== "COMMAND_COMPLETED" || prefabCatalog.kind !== "sceneaxi.scene-prefab-inspection" || !prefabCatalog.catalog?.definitions?.some((definition: { definitionId?: string }) => definition.definitionId === "smoke-prefab")) {
    fail(`GUI prefab inspection did not return the accepted definition: ${JSON.stringify(prefabInspect)}`);
  }

  await dismissRendererOutcome(window);
  const prefabDefinitionOptions = await readCommandFieldOptions("scene-prefab-instance", "definitionId");
  const prefabParentOptions = await readCommandFieldOptions("scene-prefab-instance", "parentInstanceId");

  if (!prefabDefinitionOptions.includes("smoke-prefab") || prefabParentOptions.length === 0) fail("GUI prefab instance prerequisites were not populated by inspection");

  for (const [fieldName, value] of [["definitionId", "smoke-prefab"], ["parentInstanceId", prefabParentOptions[0]], ["instanceKey", "smoke-copy"]]) {
    if (!await fillRendererCommandField(window, "scene-prefab-instance", fieldName, value)) fail(`could not fill prefab instance field ${fieldName}`);
  }

  const prefabInstance = await submitAndAcceptMutation("scene-prefab-instance");
  const prefabAfterInstance = fileBytes();

  if (!prefabAfterInstance.includes("smoke-copy")) fail("accepted prefab instance was not persisted");
  const inspectForOverride = await submitGuiForm("scene-prefab-inspect");
  const instanceOptions = await readCommandFieldOptions("scene-prefab-override", "instanceId");
  const sourceOptions = await readCommandFieldOptions("scene-prefab-override", "sourceInstanceId");

  if (inspectForOverride.code !== "COMMAND_COMPLETED" || instanceOptions.length === 0 || sourceOptions.length === 0) fail("GUI prefab inspection did not populate override prerequisites");
  await dismissRendererOutcome(window);

  const overrideValues: ReadonlyArray<readonly [string, string]> = [
    ["instanceId", instanceOptions.at(-1) ?? ""],
    ["sourceInstanceId", DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId],
    ["propertyId", "translation-x"],
    ["newValue", "2.75"],
  ];

  for (const [fieldName, value] of overrideValues) {
    if (!await fillRendererCommandField(window, "scene-prefab-override", fieldName, value)) fail(`could not fill prefab override field ${fieldName}`);
  }

  const prefabOverride = await submitAndAcceptMutation("scene-prefab-override");

  if (!fileBytes().includes('"value": 2.75')) fail("accepted prefab override did not persist its exact value");
  const prefabRefreshInspect = await submitGuiForm("scene-prefab-inspect");
  await dismissRendererOutcome(window);

  const sourceProperty = await waitForGui<boolean>(`(() => {
    const field = document.querySelector('#scene-property-translation-x');
    if (!(field instanceof HTMLInputElement)) return false;
    field.value = String(Number(field.value) + 0.1);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);

  if (!sourceProperty) fail("could not edit prefab source through the scene inspector");
  await clickRendererControl(window, '[data-action="scene-property-stage"]');
  await acceptGuiSceneReview("prefab source edit");
  const refreshDefinitionOptions = await readCommandFieldOptions("scene-prefab-refresh", "definitionId");

  if (prefabRefreshInspect.code !== "COMMAND_COMPLETED" || !refreshDefinitionOptions.includes("smoke-prefab")) fail("GUI prefab refresh prerequisite was not available");

  if (!await fillRendererCommandField(window, "scene-prefab-refresh", "definitionId", "smoke-prefab")) fail("could not fill prefab refresh definition");
  const prefabRefresh = await submitAndAcceptMutation("scene-prefab-refresh");
  const prefabFinalBytes = fileBytes();
  const prefabFinalInspection = await submitGuiForm("scene-prefab-inspect");
  const finalPrefabReport = JSON.parse(prefabFinalInspection.message);
  const refreshedPrefab = finalPrefabReport.resolved?.find((item: { definitionId: string; stale: boolean }) => item.definitionId === "smoke-prefab");

  if (!prefabFinalBytes.includes("smoke-prefab") || prefabFinalInspection.code !== "COMMAND_COMPLETED" || refreshedPrefab === undefined || refreshedPrefab.stale) fail("prefab refresh did not update the stale definition");
  await dismissRendererOutcome(window);
  guiCommandFormProofs.set("#255", {
    gui: true,
    state: "prefab-define-instance-override-refresh-accepted",
    define: { result: { code: prefabDefine.result.code }, unchangedBeforeAccept: prefabDefine.unchangedBeforeAccept, changed: prefabDefine.changed, digestBefore: prefabDefine.digestBefore, digestAfter: prefabDefine.digestAfter, definitionId: "smoke-prefab", persisted: prefabAfterDefine.includes("smoke-prefab") },
    inspect: { code: prefabInspect.code, definitionId: prefabCatalog.catalog.definitions.find((definition: { definitionId: string }) => definition.definitionId === "smoke-prefab").definitionId },
    instance: { result: { code: prefabInstance.result.code }, unchangedBeforeAccept: prefabInstance.unchangedBeforeAccept, changed: prefabInstance.changed, digestBefore: prefabInstance.digestBefore, digestAfter: prefabInstance.digestAfter, instanceKey: "smoke-copy", persisted: prefabAfterInstance.includes("smoke-copy") },
    override: { result: { code: prefabOverride.result.code }, unchangedBeforeAccept: prefabOverride.unchangedBeforeAccept, changed: prefabOverride.changed, digestBefore: prefabOverride.digestBefore, digestAfter: prefabOverride.digestAfter, value: 2.75 },
    refresh: { result: { code: prefabRefresh.result.code }, unchangedBeforeAccept: prefabRefresh.unchangedBeforeAccept, changed: prefabRefresh.changed, inspectionCode: prefabFinalInspection.code, stale: refreshedPrefab.stale, digestAfter: digestBytes(prefabFinalBytes) },
  });

  const packageDigest = `sha256:${createHash("sha256").update("contained-package-lock").digest("hex")}`;
  const packageManifest = { pluginId: "dev.sceneaxi.sample.intake-source", pluginVersion: "0.1.0", capabilities: ["sceneaxi.sculpt.intake-source.v1"] };

  if (!await fillRendererCommandField(window, "package-install", "locator", "fixtures/plugin-host/sculpt-intake-source") ||
      !await fillRendererCommandField(window, "package-install", "manifest", JSON.stringify(packageManifest)) ||
      !await fillRendererCommandField(window, "package-install", "digest", packageDigest)) fail("could not fill contained package install form");
  const packageInstall = await submitAndAcceptMutation("package-install");
  const packageAfterInstall = fileBytes();

  if (!packageAfterInstall.includes(packageManifest.pluginId)) fail("accepted package install was not persisted");
  const packageInspection = await runGuiMenuCommand("package-inspect");
  const packageOptions = await readCommandFieldOptions("package-remove", "packageId");

  if (packageInspection.code !== "COMMAND_COMPLETED" || !packageInspection.message.includes(packageManifest.pluginId) || !packageOptions.includes(packageManifest.pluginId)) fail("package inspection did not enable GUI removal of the installed package");
  await dismissRendererOutcome(window);

  if (!await fillRendererCommandField(window, "package-remove", "packageId", packageManifest.pluginId)) fail("could not select the inspected package for removal");
  const packageRemove = await submitAndAcceptMutation("package-remove");
  const packageAfterRemove = fileBytes();

  if (packageAfterRemove.includes(packageManifest.pluginId)) fail("accepted package removal left the package in project bytes");
  guiCommandFormProofs.set("#262", {
    gui: true,
    state: "package-installed-inspected-and-removed",
    install: { result: { code: packageInstall.result.code }, unchangedBeforeAccept: packageInstall.unchangedBeforeAccept, changed: packageInstall.changed, digestBefore: packageInstall.digestBefore, digestAfter: packageInstall.digestAfter, pluginId: packageManifest.pluginId, persisted: packageAfterInstall.includes(packageManifest.pluginId) },
    inspect: { code: packageInspection.code, packageId: packageManifest.pluginId },
    remove: { result: { code: packageRemove.result.code }, unchangedBeforeAccept: packageRemove.unchangedBeforeAccept, changed: packageRemove.changed, digestBefore: packageRemove.digestBefore, digestAfter: packageRemove.digestAfter, packageId: packageManifest.pluginId, persistedRemoved: !packageAfterRemove.includes(packageManifest.pluginId) },
  });

  const extensionBytesBefore = fileBytes();
  const extensionInspection = await runGuiMenuCommand("extension-inspect");
  const seamOptions = await readCommandFieldOptions("extension-start", "seamId");

  if (extensionInspection.code !== "COMMAND_COMPLETED" || !extensionInspection.message.includes("networking") || !seamOptions.includes("networking")) fail("extension inspect did not populate the networking seam in the GUI");
  await dismissRendererOutcome(window);

  if (!await fillRendererCommandField(window, "extension-start", "seamId", "networking")) fail("could not select inspected extension seam");
  const extensionStart = await submitGuiForm("extension-start");
  const extensionBytesAfter = fileBytes();

  if (extensionStart.code !== EXTENSION_SEAM_REFUSALS.adapterAbsent || extensionBytesAfter !== extensionBytesBefore) fail(`extension-start did not show its named adapter-absent refusal without writing project bytes: ${JSON.stringify(extensionStart)}`);
  guiCommandFormProofs.set("#269", {
    gui: true,
    state: "inspected-seam-refused-without-adapter",
    inspectCode: extensionInspection.code,
    seamId: "networking",
    code: extensionStart.code,
    authoringBytesUnchanged: extensionBytesAfter === extensionBytesBefore,
    digest: digestBytes(extensionBytesAfter),
  });
  await dismissRendererOutcome(window);

  const actionsPath = join(cwd, ".sceneaxi/input-actions.v1.json");
  const inputBytesBefore = existsSync(actionsPath) ? readFileSync(actionsPath, "utf8") : null;
  const inputInspect = await submitGuiForm("input-actions-inspect");

  if (inputInspect.code !== "COMMAND_COMPLETED" || !inputInspect.message.includes("baseVersions") || !inputInspect.message.includes("editor.project.save")) fail("GUI input-action inspection did not return base versions and the save action");
  await dismissRendererOutcome(window);

  const rebindFields: ReadonlyArray<readonly [string, string]> = [
    ["scope", "project"],
    ["actionId", "editor.project.save"],
    ["binding", JSON.stringify({ device: "keyboard", code: "KeyB", modifiers: ["primary"] })],
  ];

  for (const [fieldName, value] of rebindFields) {
    if (!await fillRendererCommandField(window, "input-action-rebind", fieldName, value)) fail(`could not fill input-action rebind field ${fieldName}`);
  }

  const rebindStage = await submitGuiForm("input-action-rebind");
  const rebindBeforeReview = existsSync(actionsPath) ? readFileSync(actionsPath, "utf8") : null;
  const rebindUnchanged = rebindBeforeReview === inputBytesBefore;

  if (rebindStage.code !== "INPUT_ACTION_REVIEW_REQUIRED" || !rebindUnchanged) fail(`input-action rebind wrote before its GUI review or used an unexpected result: ${JSON.stringify(rebindStage)}`);
  await dismissRendererOutcome(window);
  await clickRendererControl(window, '[data-editor-command-review="input-action-rebind"]');
  const rebindReview = await readGuiOutcomeAfter();
  const inputBytesAfterRebind = existsSync(actionsPath) ? readFileSync(actionsPath, "utf8") : null;

  if (rebindReview.code !== "COMMAND_COMPLETED" || inputBytesAfterRebind === null || !inputBytesAfterRebind.includes('"code": "KeyB"')) fail("GUI input-action review did not persist the selected binding");
  await dismissRendererOutcome(window);
  const resetInspect = await submitGuiForm("input-actions-inspect");

  if (resetInspect.code !== "COMMAND_COMPLETED") fail("GUI input-action reinspection failed before reset");
  await dismissRendererOutcome(window);

  if (!await fillRendererCommandField(window, "input-actions-reset", "scope", "project")) fail("could not fill input-actions reset scope");
  const resetStage = await submitGuiForm("input-actions-reset");
  const inputBytesBeforeReset = existsSync(actionsPath) ? readFileSync(actionsPath, "utf8") : null;

  if (resetStage.code !== "INPUT_ACTION_REVIEW_REQUIRED" || inputBytesBeforeReset !== inputBytesAfterRebind) fail(`input-actions reset was not held for review: ${JSON.stringify(resetStage)}`);
  await dismissRendererOutcome(window);
  await clickRendererControl(window, '[data-editor-command-review="input-actions-reset"]');
  const resetReview = await readGuiOutcomeAfter();
  const inputBytesAfterReset = existsSync(actionsPath) ? readFileSync(actionsPath, "utf8") : null;

  if (resetReview.code !== "COMMAND_COMPLETED" || inputBytesAfterReset === null || inputBytesAfterReset === inputBytesBeforeReset || !inputBytesAfterReset.includes('"schemaVersion"')) fail("GUI input-action reset did not persist the reviewed default map");
  guiCommandFormProofs.set("#257", {
    gui: true,
    state: "input-actions-inspected-rebound-and-reset",
    inspectCode: inputInspect.code,
    actionId: "editor.project.save",
    reviewCode: rebindReview.code,
    bindingPersisted: inputBytesAfterRebind?.includes('"code": "KeyB"') === true,
    unchangedBeforeReview: rebindUnchanged,
    resetReviewCode: resetReview.code,
    resetUnchangedBeforeReview: inputBytesBeforeReset === inputBytesAfterRebind,
    resetPersistedChangedBytes: inputBytesAfterReset !== inputBytesBeforeReset,
    resetDigestBefore: inputBytesBeforeReset === null ? null : digestBytes(inputBytesBeforeReset),
    finalDigest: inputBytesAfterReset === null ? null : digestBytes(inputBytesAfterReset),
  });
  await dismissRendererOutcome(window);

  const migrationRoot = smokeProjectDir();
  const migrationDocument = join(migrationRoot, DESKTOP_ACTIVE_DOCUMENT_PATH);
  const migrationManifest = join(migrationRoot, PROJECT_MANIFEST_PATH);
  unlinkSync(migrationManifest);
  await activateProject(migrationRoot);
  await dismissRendererOutcome(window);
  const migrationStatusBeforeReload = await window.webContents.executeJavaScript(`document.querySelector('[data-project-status]')?.textContent ?? ''`);
  await clickRendererControl(window, '[data-action="document-reload"]');

  if (!await waitForRenderer(window, `document.querySelector('[data-project-status]')?.textContent !== ${JSON.stringify(migrationStatusBeforeReload)} && document.querySelector('[data-project-state]')?.getAttribute('data-project-state') === 'open' && document.querySelector('[data-product-action][data-busy="true"]') === null`)) fail("GUI Reload did not reopen the migration scratch document");
  const migrationBefore = readFileSync(migrationDocument, "utf8");
  const migrationProposal = await runGuiMenuCommand("project-migration-propose");

  if (migrationProposal.code !== "COMMAND_COMPLETED" || !existsSync(join(migrationRoot, ".sceneaxi/project-migration-proposal.json"))) fail(`GUI migration proposal did not persist its review artifact: ${JSON.stringify(migrationProposal)}`);
  await dismissRendererOutcome(window);
  const migrationCommit = await submitGuiForm("project-migration-commit");
  const migrationAfter = readFileSync(migrationDocument, "utf8");
  const migrationManifestBytes = readFileSync(migrationManifest, "utf8");

  if (migrationCommit.code !== "COMMAND_COMPLETED" || migrationAfter !== migrationBefore || !migrationManifestBytes.includes('"schemaVersion"')) fail(`GUI migration commit did not persist a native manifest without rewriting source bytes: ${JSON.stringify(migrationCommit)}`);
  guiCommandFormProofs.set("#263", {
    migration: { gui: true, state: "legacy-project-migrated", proposalCode: migrationProposal.code, commitCode: migrationCommit.code, sourceBytesUnchanged: migrationAfter === migrationBefore, manifestPersisted: migrationManifestBytes.includes('"schemaVersion"'), digest: digestBytes(migrationManifestBytes) },
  });
  await dismissRendererOutcome(window);
  await activateProject(cwd);
  const migrationStatusBeforeRestore = await window.webContents.executeJavaScript(`document.querySelector('[data-project-status]')?.textContent ?? ''`);
  await clickRendererControl(window, '[data-action="document-reload"]');

  if (!await waitForRenderer(window, `document.querySelector('[data-project-status]')?.textContent !== ${JSON.stringify(migrationStatusBeforeRestore)} && document.querySelector('[data-project-state]')?.getAttribute('data-project-state') === 'open' && document.querySelector('[data-product-action][data-busy="true"]') === null`)) fail("GUI Reload did not restore the main smoke document after migration proof");
  rmSync(migrationRoot, { recursive: true, force: true });

  const guiAssetImport = async () => await waitForGui<{
    staged: boolean;
    status: string;
  }>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 800; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    document.querySelector('[data-action="web-inject-asset"]')?.click();
    return {
      staged: await waitFor(() => document.querySelector('[data-project-status]')?.textContent?.includes('import staged') &&
        document.querySelector('[data-change-badge]')?.textContent === '1' &&
        document.querySelector('[data-product-action][data-busy="true"]') === null),
      status: document.querySelector('[data-project-status]')?.textContent ?? '',
    };
  })()`);

  const guiAssetAccept = async () => await waitForGui<boolean>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 800; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    document.querySelector('[data-action="dock-tab"][data-value="changes"]')?.click();
    document.querySelector('[data-action="change-accept"]')?.click();
    return await waitFor(() => document.querySelector('[data-change-badge]')?.textContent === '0' &&
      document.querySelector('[data-project-status]')?.textContent?.includes('saved') &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
  })()`);

  const guiAssetDigest = async (path: string) => await waitForGui<string>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 800; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    const selector = document.querySelector('#project-browser-file-select');
    const path = ${JSON.stringify("__PATH__")};
    const ready = await waitFor(() => selector instanceof HTMLSelectElement &&
      [...selector.options].some((option) => option.value === path));
    if (!ready || !(selector instanceof HTMLSelectElement)) return '';
    selector.value = path;
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    const detail = await waitFor(() => document.querySelector('[data-project-browser-path]')?.textContent?.startsWith(path) &&
      /^sha256:[0-9a-f]{64}$/.test(document.querySelector('[data-project-browser-digest]')?.textContent ?? ''));
    return detail ? document.querySelector('[data-project-browser-digest]')?.textContent ?? '' : '';
  })()`.replace(JSON.stringify("__PATH__"), JSON.stringify(path)));

  const guiAssetPath = "assets/smoke-gui-source.gltf";
  const guiAssetRevisionPath = "assets/smoke-gui-source-revision-2.gltf";
  await waitForGui<boolean>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 800; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    document.querySelector('[data-action="profile"][data-value="web"]')?.click();
    return await waitFor(() => document.querySelector('.shell')?.dataset.profile === 'web' &&
      document.querySelector('[data-action="web-inject-asset"]') instanceof HTMLElement &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
  })()`);
  const guiFeatureBytesBeforeAsset = fileBytes();
  const guiAssetFirstStage = await guiAssetImport();
  const assetFirstBeforeAccept = readFileSync(documentFile, "utf8");
  const assetFirstStagedUnchanged = assetFirstBeforeAccept === guiFeatureBytesBeforeAsset;
  const guiAssetFirstAccepted = await guiAssetAccept();
  const assetFirstAcceptedBytes = readFileSync(documentFile, "utf8");
  const guiAssetFirstDigest = await guiAssetDigest(guiAssetPath);
  const editedSource = JSON.parse(readFileSync(smokeGuiAssetPath ?? "", "utf8"));
  editedSource.extras = { sceneaxiSmokeRevision: 2 };
  writeFileSync(smokeGuiAssetPath ?? "", JSON.stringify(editedSource));
  const statusBeforeGuiReload = await waitForGui<string>(`document.querySelector('[data-project-status]')?.textContent ?? ''`);

  const guiReloadCompleted = await waitForGui<boolean>(`(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 800; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return false;
    };
    document.querySelector('[data-action="document-reload"]')?.click();
    return await waitFor(() => document.querySelector('[data-project-status]')?.textContent !== ${JSON.stringify(statusBeforeGuiReload)} &&
      document.querySelector('[data-project-state]')?.getAttribute('data-project-state') === 'open' &&
      document.querySelector('[data-product-action][data-busy="true"]') === null);
  })()`);

  if (smokeGuiAssetRevisionPath === null || smokeGuiAssetPath === null) fail("GUI asset revision fixture path was not configured");
  writeFileSync(smokeGuiAssetRevisionPath, readFileSync(smokeGuiAssetPath));
  smokeGuiAssetPickerPath = smokeGuiAssetRevisionPath;
  const guiAssetSecondStage = await guiAssetImport();
  const assetSecondBeforeAccept = readFileSync(documentFile, "utf8");
  const assetSecondStagedUnchanged = assetSecondBeforeAccept === assetFirstAcceptedBytes;
  const guiAssetSecondAccepted = await guiAssetAccept();
  const guiAssetSecondDigest = await guiAssetDigest(guiAssetRevisionPath);
  const guiAssetFinalProjectDigest = createHash("sha256").update(readFileSync(documentFile, "utf8")).digest("hex");

  if (!guiAssetFirstStage.staged || !assetFirstStagedUnchanged || !guiAssetFirstAccepted ||
      !/^sha256:[0-9a-f]{64}$/.test(guiAssetFirstDigest) || !guiReloadCompleted ||
      !guiAssetSecondStage.staged || !assetSecondStagedUnchanged || !guiAssetSecondAccepted ||
      !/^sha256:[0-9a-f]{64}$/.test(guiAssetSecondDigest) || guiAssetFirstDigest === guiAssetSecondDigest) {
    fail(`GUI asset import/reload did not prove contained source revision and changed manifest digest: ${JSON.stringify({
      guiAssetFirstStage, assetFirstStagedUnchanged, guiAssetFirstAccepted, guiAssetFirstDigest,
      guiReloadCompleted, guiAssetSecondStage, assetSecondStagedUnchanged, guiAssetSecondAccepted,
      guiAssetSecondDigest,
    })}`);
  }

  // SAFETY: This main-process-only smoke script is defined here and constructs the asserted proof fields from the isolated packaged document; the resulting values are checked by the smoke assertions below.
  const guiFeatures = (await window.webContents.executeJavaScript(
    `(async () => {
      const waitFor = async (predicate) => {
        for (let attempt = 0; attempt < 1500; attempt += 1) {
          if (predicate()) return true;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return false;
      };
      const run = async (commandId) => {
        // One request at a time, as the chrome enforces: wait for the last to finish.
        await waitFor(() => document.querySelector('[data-product-action][data-busy="true"]') === null);
        const button = [...document.querySelectorAll('[data-command]')]
          .find((element) => element.dataset.command === commandId);
        if (!(button instanceof HTMLElement)) return { gui: false, state: 'control-not-found' };
        const previous = document.querySelector('[data-outcome-title]')?.textContent ?? '';
        const previousGit = document.querySelector('[data-project-git-evidence]')?.textContent ?? '';
        button.click();
        if (commandId.startsWith('project-git-')) {
          const evidence = document.querySelector('[data-project-git-evidence]');
          const completed = await waitFor(() =>
            (evidence?.textContent !== '' && evidence?.textContent !== previousGit) ||
            (document.querySelector('[data-outcome-title]')?.textContent ?? '') !== previous,
          );
          const rawEvidence = evidence?.textContent ?? '';
          const gitState = rawEvidence === '' ? null : JSON.parse(rawEvidence);
          return {
            gui: true,
            completed,
            title: commandId,
            code: completed && gitState !== null
              ? 'PROJECT_GIT_EVIDENCE'
              : document.querySelector('[data-outcome-code]')?.textContent ?? '',
            message: gitState === null
              ? document.querySelector('[data-outcome-message]')?.textContent ?? ''
              : JSON.stringify({
                  kind: gitState.kind,
                  entries: gitState.entries
                    .filter((entry) => entry.index !== '?')
                    .map((entry) => ({ path: entry.path, index: entry.index })),
                  stagedDiffPresent: gitState.stagedDiff.length > 0,
                }),
          };
        }
        if (commandId === 'physics-inspect') {
          const report = document.querySelector('[data-catalog-report="physics"]');
          const completed = await waitFor(() => report?.textContent !== '');
          return { gui: true, completed, title: commandId, code: 'COMMAND_COMPLETED', message: report?.textContent ?? '' };
        }
        const completed = await waitFor(() => {
          const title = document.querySelector('[data-outcome-title]')?.textContent ?? '';
          return title !== '' && title !== previous;
        });
        return {
          gui: true,
          completed,
          title: document.querySelector('[data-outcome-title]')?.textContent ?? '',
          code: document.querySelector('[data-outcome-code]')?.textContent ?? '',
          message: document.querySelector('[data-outcome-message]')?.textContent ?? '',
        };
      };
      const results = {};
      results['#260'] = await run('physics-inspect');
      results['#262'] = await run('package-inspect');
      results['#263'] = await run('project-git-status');
      const gitStatus = results['#263'];
      await run('project-git-diff');
      const gitPath = document.querySelector('[data-project-git-path]');
      if (gitPath instanceof HTMLInputElement) {
        gitPath.checked = true;
        gitPath.dispatchEvent(new Event('change', { bubbles: true }));
        const staged = await run('project-git-stage');
        results['#263'] = { ...gitStatus, stage: staged, selectedPath: gitPath.value };
      }
      results['#265'] = await run('workspace-layout-inspect');
      results['#265'].apply = await run('workspace-layout-apply');
      results['#265'].reset = await run('workspace-layout-reset');
      results['#266'] = await run('project-build');
      results['#269'] = await run('extension-inspect');
      // Profiling measures an isolated Play clone of the exact current version;
      // the edits above changed it, so Play it again first as a user would.
      const playForProfile = [...document.querySelectorAll('[data-command]')]
        .find((element) => element.dataset.command === 'run-play');
      if (playForProfile instanceof HTMLElement) {
        const before = document.querySelector('[data-run-live-report]')?.textContent ?? '';
        const reportedBefore = document.querySelector('[data-frame-reported]')?.dataset.frameReported ?? '';
        playForProfile.click();
        await waitFor(() => (document.querySelector('[data-run-live-report]')?.textContent ?? '') !== before &&
          document.querySelector('.viewport')?.dataset.playback === 'acknowledged');
        // Profile only once the host holds a frame report for this Play.
        await waitFor(() => (document.querySelector('[data-frame-reported]')?.dataset.frameReported ?? '') !== reportedBefore);
      }
      results['#270'] = await run('profile-inspect');
      const timelineButton = document.querySelector('[data-action="timeline-evaluate"]');
      if (timelineButton instanceof HTMLElement) {
        const output = document.querySelector('[data-timeline-result]');
        timelineButton.click();
        await waitFor(() => output?.textContent !== 'Open Timeline to inspect clips, tracks, and keyframes.');
        results['#259'] = { gui: true, state: 'animation-evaluation-result', result: output?.textContent ?? '' };
      } else {
        results['#259'] = { gui: false, state: 'pending-gui-control' };
      }
      const prompt = document.querySelector('.assistant-prompt');
      const localRoute = document.querySelector('[data-action="assistant-route"][data-value="local"]');
      const agentMode = document.querySelector('[data-action="assistant-mode"][data-value="agent"]');
      const assistantSend = document.querySelector('[data-action="assistant-send"]');
      if (prompt instanceof HTMLTextAreaElement && localRoute instanceof HTMLElement &&
          agentMode instanceof HTMLElement && assistantSend instanceof HTMLElement) {
        prompt.value = 'Inspect the scratch project and propose one small safe improvement.';
        prompt.dispatchEvent(new Event('input', { bubbles: true }));
        localRoute.click();
        agentMode.click();
        const status = document.querySelector('[data-assistant-status]');
        const previousStatus = status?.textContent ?? '';
        assistantSend.click();
        const completed = await waitFor(() => status?.textContent !== previousStatus &&
          (document.querySelector('.shell')?.getAttribute('data-assistant-busy') !== 'true'));
        results['#261'] = { gui: true, completed, state: status?.textContent ?? '' };
      } else {
        results['#261'] = { gui: false, state: 'pending-gui-control' };
      }
      return results;
    })()`,
  )) as Record<string, {
    gui: boolean;
    state?: string;
    completed?: boolean;
    title?: string;
    code?: string;
    message?: string;
    result?: string;
  }>;

  // Profiling measured the project as it stood after every edit above.
  const projectDigestAtProfile = `sha256:${createHash("sha256").update(readFileSync(documentFile)).digest("hex")}`;
  const frameReportAtProfile = activeFrameReport();


  // Optional visual evidence: capture the real window once the live frame exists.
  const shotPath = process.env["SCENEAXI_SMOKE_SHOT"];
  let screenshotBytes = 0;

  if (shotPath !== undefined && shotPath.length > 0) {
    // A headless compositor can lag the DOM; force a repaint and let it settle
    // so the capture shows the frame the report described.
    window.webContents.invalidate();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const image = await window.webContents.capturePage();
    const png = image.toPNG();
    screenshotBytes = png.byteLength;
    const { writeFileSync } = await import("node:fs");
    writeFileSync(shotPath, png);
  }

  await localBridgeServer?.close();
  localBridgeServer = null;

  if (closeActiveDesktopBridge !== null && !closeActiveDesktopBridge()) {
    fail("The desktop mutation-owner lease could not be released after smoke verification.");
  }

  const teardown = await gui(`
    const canvas = document.querySelector('[data-live-viewport="canvas"]');
    const gl = canvas?.getContext('webgl2');
    if (!gl) throw new Error('SMOKE_TEARDOWN_CONTEXT_ABSENT');
    const deleted = { Buffer: 0, Program: 0, Texture: 0 };
    const originals = [];
    for (const kind of Object.keys(deleted)) {
      const name = 'delete' + kind;
      originals.push([name, gl[name]]);
      const dispose = gl[name].bind(gl);
      gl[name] = (handle) => { if (handle) deleted[kind] += 1; return dispose(handle); };
    }
    try {
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      await wait(() => document.querySelectorAll('[data-live-viewport="canvas"]').length === 0, 'viewport teardown removed canvas');
      if (deleted.Buffer === 0 || deleted.Program === 0) throw new Error('SMOKE_TEARDOWN_GPU_RESOURCES_RETAINED');
      // Removing a canvas or deleting some handles does not release its WebGL context.
      await wait(() => gl.isContextLost(), 'viewport teardown released WebGL context');
      return { canvases: 0, deleted, contextLost: gl.isContextLost() };
    } finally { for (const [name, original] of originals) gl[name] = original; }
  `);

  bridge = null;
  rmSync(cwd, { recursive: true, force: true });
  rmSync(audioSwitchRoot, { recursive: true, force: true });
  rmSync(smokeNewRoot, { recursive: true, force: true });

  // SAFETY: the isolated packaged-window probe above constructs these resource-count and latency fields; the twelve samples, latency budget, canvas count, and resource plateau were checked before publication.
  console.log(
    JSON.stringify({
      ok: true,
      handshake: handshake.data,
      newerEditor: {
        hierarchyCreated: true, hierarchyReparented: true, transformApplied: true,
        playStarted: true, playStopped: true, playReset: true,
        physicsReviewed: true, animationReviewed: true, cliHandshake: true,
        hierarchySourceId, hierarchyCopyId, persistedParent, initialY, reopenedY,
        physicsBodyId: "smoke-body", cli: cliResult,
      },
      nativeGui,
        assetCapacity: { ...assetCapacity, rssBytes: capacityRss, warmedReloadRssBytes: capacityReloadRss, reloadMs: capacityReloadMs, hotReloadTransport: "actual trusted bridge IPC; dedicated GUI hot-reload control not certified", rssScope: "sum of actual Electron process resident working sets, including main Worker isolates, renderer and GPU; shared pages conservatively counted per process" },
      security: { cspEnforced: true, permissionDenied: true, foreignSenderChannelsDenied: foreignRefusals.length, rawDumpConsent: sensitiveDumpConsent },
      performance: { ...(plateau as NativePerformanceProof), teardown },
      openPath: openPath.data,
      authoring: {
        selected: true,
        proposed: true,
        accepted: true,
        reopened: true,
        played: true,
        proposedPhase,
        acceptedPhase,
        initialPropertyValue,
        reopenedValue,
        playedTranslation: playedTranslation[0],
        playedRotationY: playedRotation[1],
        playedScaleZ: playedScale[2],
        addedInstance: playedCopy !== undefined,
        removeRejected: true,
        removeApplied: true,
        undoRestored: true,
        malformedRefused: true,
        persisted: savedBytes !== seededBytes,
        scratchProject,
        project: cwd,
      },
      projectBrowser: {
        listed: true,
        selected: true,
        opened: true,
        assetPath: browserAssetPath,
        assetDigest: browserAssetDigest,
        assetFrame: browserUiOpen.frame,
        restored: true,
        activeDocumentPath: SAMPLE_DOCUMENT,
        confirmationRefusal: browserConfirmationRefusal,
        protectedRefusal: browserProtectedRefusal,
      },
      ship: shipped.ok
        ? {
            exported: true,
            outputDirectory: exportDirectory,
            bundleDigest,
            sourceDigest,
            handoffPresent: true,
          }
        : {
            exported: false,
            refusal: shipped.reason,
          },
      frameReport,
      features: {
        ...guiFeatures,
        '#255': guiCommandFormProofs.get('#255'),
        '#257': guiCommandFormProofs.get('#257'),
        '#254': {
          gui: true,
          state: 'scene-property-staged-and-accepted',
          selectedEntity: guiTransformProof.selectedEntity,
          transformMode: guiTransformProof.transformMode,
          snapIncrement: guiTransformProof.snapIncrement,
          inspectorEditStaged: guiTransformProof.staged,
          staged: guiTransformProof.staged,
          unchangedBeforeAccept: guiStageUnchangedBytes,
          valueBefore: guiTransformProof.valueBefore,
          valueAfter: acceptedSceneValue,
          digestBeforeAccept: `sha256:${sceneStageDigest}`,
          digestAfterAccept: `sha256:${sceneAcceptedDigest}`,
        },
        '#256': {
          gui: true,
          state: 'gui-import-source-edit-reload-reimport',
          importedPath: guiAssetPath,
          importedRevisionPath: guiAssetRevisionPath,
          initialDigest: guiAssetFirstDigest,
          editedDigest: guiAssetSecondDigest,
          finalProjectDigest: `sha256:${guiAssetFinalProjectDigest}`,
          reloadCompleted: guiReloadCompleted,
          unchangedBeforeAccept: assetFirstStagedUnchanged && assetSecondStagedUnchanged,
        },
        '#258': { gui: true, state: playbackDom.state, frame: playbackDom.frame, stop: playbackDom.stop, reset: playbackDom.reset, sourceSet: guiCommandFormProofs.get('#258') },
        '#259': {
          gui: true,
          state: 'animation-applied-and-evaluated',
          staged: guiAnimationStage.staged,
          unchangedBeforeAccept: animationUnchangedBeforeAccept,
          digestAfterAccept: `sha256:${animationAcceptedDigest}`,
          mutation: { clipId: 'smoke-idle', name: 'Smoke Idle', durationMs: 1200 },
          evaluation: animationEvaluationProof.output,
        },
        '#260': {
          ...guiFeatures['#260'],
          state: 'physics-applied',
          applied: guiPhysicsStage.staged,
          unchangedBeforeAccept: physicsUnchangedBeforeAccept,
          digestAfterAccept: `sha256:${physicsAcceptedDigest}`,
          ...guiCommandFormProofs.get('#260'),
        },
        '#261': { ...guiFeatures['#261'] },
        '#263': { ...guiFeatures['#263'], ...guiCommandFormProofs.get('#263') },
        '#264': { gui: true, state: 'profile-evidence', digest: JSON.parse(guiFeatures['#270']?.message ?? '{}').digest, result: guiFeatures['#270']?.message },
        '#265': { ...guiFeatures['#265'] },
        '#266': { ...guiFeatures['#266'] },
        '#267': { gui: false, state: 'unsupported-host-macos' },
        '#268': { gui: false, state: 'unsupported-host-windows' },
        '#262': { ...guiCommandFormProofs.get('#262'), catalogInspect: guiFeatures['#262'] },
        '#269': { ...guiCommandFormProofs.get('#269'), catalogInspect: guiFeatures['#269'] },
        '#270': { ...guiFeatures['#270'], projectDigestAtProfile, drawCallsAtProfile: frameReportAtProfile?.drawCalls ?? null },
      },
      playbackDom,
      audioProof: { ...audioProof, resetStopped: audioResetStopped, decodeRefused: audioDecodeRefused, kidsSwitchStopped: audioKidsSwitchStopped, projectSwitchStopped: audioProjectSwitchStopped },
      viewportDom,
      ...(() => {
        const optional: DesktopOptionalFields<{ screenshotBytes?: number }> = {};

        if (screenshotBytes > 0) {
          optional.screenshotBytes = screenshotBytes;
        }

        return optional;
      })(),
    }),
  );
  app.exit(0);
}

type DesktopDiagnosticTypes = {
  string: string;
  number: number;
  boolean: boolean;
  undefined: undefined;
  bigint: bigint;
  symbol: symbol;
  function: (...args: never[]) => void;
  object: object | null;
};

function isDiagnosticPrimitive<Kind extends keyof DesktopDiagnosticTypes>(value: DesktopBoundaryValue, kind: Kind): value is DesktopDiagnosticTypes[Kind] {
  return (
    (kind === "string" && isBoundaryTextValue(value)) ||
    (kind === "number" && isBoundaryNumericValue(value)) ||
    (kind === "boolean" && isBoundaryBooleanValue(value)) ||
    (kind === "bigint" && isBoundaryBigIntValue(value)) ||
    (kind === "symbol" && isBoundarySymbolValue(value)) ||
    (kind === "object" && isBoundaryObjectValue(value)) ||
    (kind === "function" && isBoundaryCallableValue(value)) ||
    (kind === "undefined" && isBoundaryUndefinedValue(value))
  );
}

const errorName = (cause: unknown) => cause instanceof Error
  ? cause.name
  : (["string", "number", "boolean", "undefined", "bigint", "symbol", "function", "object"] as const)
      .find((kind) => isDiagnosticPrimitive(cause, kind)) ?? "undefined";

process.on("uncaughtException", (cause) => {
  recordDesktopDiagnostic(logsDirectory, "main-exception", { errorName: errorName(cause) });

  // A blocking dialog would hang a headless smoke until its launcher timeout.
  if (SMOKE) {
    reportFailure("An uncaught exception stopped the packaged smoke. See local logs.");

    return;
  }

  dialog.showErrorBox("Desktop stopped", "A local error occurred. Open Help → Reveal logs after restarting.");
  app.exit(1);
});

// Normal startup never echoes an exception; the smoke names the failing step.
void start().catch((error: DesktopBoundaryValue) => {
  recordDesktopDiagnostic(logsDirectory, "main-exception", { errorName: errorName(error) });
  // The smoke runs on a scratch project with no user data, so its proof line may
  // name the failing step; a user's startup still echoes nothing.
  reportFailure(SMOKE && error instanceof Error
    ? `Desktop startup failed: ${error.message}`
    : "Desktop startup failed. See local logs.");
});

app.on("window-all-closed", () => {
  if (
    closeActiveDesktopBridge !== null &&
    !closeActiveDesktopBridge() &&
    !closeActiveDesktopBridge()
  ) {
    reportFailure("The desktop mutation-owner lease could not be released during shutdown.");

    return;
  }

  const closing = Promise.all([localBridgeServer?.close() ?? Promise.resolve(), cancelActiveAssetPreparation?.() ?? Promise.resolve()]);
  localBridgeServer = null;
  void closing.finally(() => app.quit());
});

function isProtocolObject<Value>(value: Value): value is Value & (object | null) {
  return isBoundaryObjectValue(value);
}

function isProtocolText<Value>(value: Value): value is Value & (string) {
  return typeof value === "string";
}

function isProtocolBoolean<Value>(value: Value): value is Value & (boolean) {
  return typeof value === "boolean";
}

type MutableNativeFields<Owner> = { -readonly [Key in keyof Owner]: Owner[Key] };

type SmokeCommandDocument = { documentPath?: string };

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryTextValue<Input>(value: Input): value is Input & string {
  return typeof value === "string";
}

function isBoundaryNumericValue<Input>(value: Input): value is Input & number {
  return typeof value === "number";
}

function isBoundaryBooleanValue<Input>(value: Input): value is Input & boolean {
  return typeof value === "boolean";
}

function isBoundaryBigIntValue<Input>(value: Input): value is Input & bigint {
  return typeof value === "bigint";
}

function isBoundarySymbolValue<Input>(value: Input): value is Input & symbol {
  return typeof value === "symbol";
}

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}

function isBoundaryUndefinedValue<Input>(value: Input): value is Input & undefined {
  return typeof value === "undefined";
}
