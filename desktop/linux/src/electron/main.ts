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
import { execFileSync } from "node:child_process";
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
import { BrowserWindow, Menu, app, crashReporter, dialog, ipcMain, shell } from "electron";
import { DESKTOP_MINIMUM_WINDOW } from "@sceneaxi/desktop-shell";
import { inspectProjectModel } from "@sceneaxi/authoring-core";
import {
  createEditorCommandInvocation,
  EXTENSION_SEAM_REFUSALS,
  parseDeliveryHandoffText,
  PROJECT_MANIFEST_PATH,
} from "@sceneaxi/schemas";
import { DESKTOP_BYO_CONFIGURATION_CHANNEL } from "../lib/byo-configuration-contract.js";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_ASSET_IMPORT_CHANNEL,
  DESKTOP_BRIDGE_CHANNEL,
  DESKTOP_VIEWPORT_STOP_EVENT,
  bridgeRefuse,
} from "../lib/bridge-contract.js";
import { createDesktopBridge, type DesktopBridge } from "../lib/bridge.js";
import { initializeDesktopScenePhysics } from "../lib/desktop-scene.js";
import { createDesktopAssetPickerHost } from "../lib/asset-picker-host.js";
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

// The bundle is CJS (Electron's main entry), so the native `__dirname` is real.
declare const __dirname: string;

const SMOKE = process.argv.includes("--smoke");
const DIAGNOSTICS_SMOKE = process.argv.includes("--diagnostics-smoke");
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

pruneDesktopCrashDumps(crashDumpsDirectory);

crashReporter.start({ uploadToServer: false });

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
    for (let attempt = 0; attempt < 500; attempt += 1) {
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
  const volumePointerHit = await clickRendererControl(window, '[aria-label="Audio volume"]', undefined, 0.35);
  await window.webContents.executeJavaScript(`(() => {
    const slider = document.querySelector('[aria-label="Audio volume"]');
    slider.value = '0.35';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
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

function smokeAssetBytes(): Buffer {
  const positions = Buffer.from(new Float32Array([
    -1, 0, 0,
    1, 0, 0,
    0, 1, 0,
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
function payloadField(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

let reportedFailure = false;
let localBridgeServer: DesktopLocalBridgeServer | null = null;
let closeActiveDesktopBridge: (() => boolean) | null = null;

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
  const physicsWorldHost = await initializeDesktopScenePhysics().catch((error: unknown) => {
    console.error("PHYSICS_HOST_NOT_READY", error instanceof Error ? error.message : "Rapier initialization failed.");
    return undefined;
  });

  let frameReported: ((report: unknown) => void) | null = null;
  const firstFrameReport = new Promise((resolve) => {
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
  let desktopWindow: BrowserWindow | null = null;
  closeActiveDesktopBridge = () => bridge?.close() ?? true;
  let inputActions: DesktopInputActionHost | null = null;
  let projectBrowser: DesktopProjectBrowser | null = null;
  let activeRoot: string | null = null;

  const activateProject = async (root: string): Promise<DesktopBridge> => {
    if (bridge !== null && activeRoot === root) return bridge;
    if (bridge !== null && desktopWindow !== null) {
      void desktopWindow.webContents.executeJavaScript(
        `document.dispatchEvent(new CustomEvent(${JSON.stringify(DESKTOP_VIEWPORT_STOP_EVENT)}))`,
      ).catch(() => undefined);
    }
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
      ...(physicsWorldHost === undefined ? {} : { physicsWorldHost }),
      ...(commandCapabilities === undefined ? {} : { commandCapabilities }),
      inputActions: nextInputActions,
      projectBrowser: nextProjectBrowser,
      onFrameReport: (report) => frameReported?.(report),
      ...(byoRuntime.runByoAssistant === undefined
        ? {}
        : { runByoAssistant: byoRuntime.runByoAssistant }),
      runRarityProvider,
      webExportPlatform: process.platform,
      ...(webExportPublisherExecutable === undefined
        ? {}
        : { webExportPublisherExecutable }),
      ...(webExportRuntime === undefined ? {} : { webExportRuntime }),
    });
    activeBridgeForDirtyCheck = next;
    const localPaths = SMOKE
      ? {
          socketPath: join(root, ".sceneaxi-runtime", "desktop-v1.sock"),
          discoveryPath: join(root, ".sceneaxi-config", "desktop-bridge-v1.json"),
        }
      : resolveDesktopLocalBridgePaths({
        ...(process.env["XDG_RUNTIME_DIR"] === undefined
          ? {}
          : { runtimeDir: process.env["XDG_RUNTIME_DIR"] }),
        ...(process.env["XDG_CONFIG_HOME"] === undefined
          ? {}
          : { configDir: process.env["XDG_CONFIG_HOME"] }),
      });
    // The local agent bridge is an attachment point, not the application: a
    // refused socket costs the operator that attachment, never the selected root.
    try {
      localBridgeServer = await startDesktopLocalBridgeServer({
        bridge: next,
        projectRoot: root,
        ...localPaths,
      });
    } catch (error) {
      if (SMOKE) throw error;
      localBridgeServer = null;
      console.error(
        "desktop-linux: the local agent bridge did not start; Engine Desktop continues without CLI attachment:",
        error instanceof Error ? error.message : String(error),
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
  let smokeBridge: DesktopBridge | null = null;
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

  ipcMain.handle(DESKTOP_BRIDGE_CHANNEL, (_event, request: unknown) =>
    bridge?.handle(request) ??
      bridgeRefuse(
        DESKTOP_PROJECT_REFUSALS.projectRequired,
        "Choose New Project, Open Project, or a validated recent project before using the engine bridge.",
      ),
  );
  ipcMain.handle(DESKTOP_INPUT_ACTIONS_CHANNEL, () =>
    inputActions?.inspect() ?? {
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.projectRequired,
      message: "Choose a validated project before reading input actions.",
      detail: null,
    },
  );
  ipcMain.handle(DESKTOP_ASSET_IMPORT_CHANNEL, async (_event, request: unknown) => {
    if (bridge === null || activeRoot === null) {
      return bridgeRefuse(
        DESKTOP_PROJECT_REFUSALS.projectRequired,
        "Choose a validated project before importing an asset.",
      );
    }
    const picker = createDesktopAssetPickerHost({
      chooseFile: () => SMOKE && smokeGuiAssetPickerPath !== null
        ? Promise.resolve({ canceled: false, filePaths: [smokeGuiAssetPickerPath] })
        : dialog.showOpenDialog(window, {
            title: "Import validated project asset",
            buttonLabel: "Stage Import",
            properties: ["openFile"],
            filters: [{
              name: "SceneAxi project assets",
              extensions: ["glb", "gltf", "json", "png", "jpg", "jpeg", "webp", "wav", "ogg", "mp3", "woff2", "woff", "ttf", "otf"],
            }],
          }),
      stage: (selection) => bridge?.handle(selection) ?? bridgeRefuse(
        DESKTOP_PROJECT_REFUSALS.projectRequired,
        "The selected project was closed before the asset could be staged.",
      ),
    });
    return picker.chooseAndStage(payloadField(request, "profile"));
  });
  ipcMain.handle(DESKTOP_PROJECT_BROWSER_CHANNEL, (_event, request: unknown) =>
    projectBrowser?.handle(request) ??
      projectBrowserRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.projectRequired,
        "Choose New Project, Open Project, or a validated recent project before browsing project files.",
      ),
  );
  ipcMain.handle(DESKTOP_BYO_CONFIGURATION_CHANNEL, (_event, request: unknown) =>
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
    backgroundColor: "#111113",
    title: "SceneAxi Engine Desktop",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  desktopWindow = window;

  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

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
        if (SMOKE) return null;
        const selected = await dialog.showOpenDialog(window, {
          title: "New SceneAxi Project",
          buttonLabel: "Create starter project here",
          properties: ["openDirectory", "createDirectory"],
        });
        return selected.canceled ? null : (selected.filePaths[0] ?? null);
      },
      async chooseOpenProjectRoot() {
        if (SMOKE) return null;
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
  ipcMain.handle(DESKTOP_PROJECT_CHANNEL, async (_event, request: unknown) => {
    const before = activeRoot;
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
  if (typeof openedHash !== "string" || initialPropertyValue !== -4.4) {
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
    if (typeof contentHash !== "string") fail("authoring status returned no content hash");
    return contentHash;
  };
  const stageSceneOperation = (operation: unknown) => {
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
  const copiedInstanceId = `${DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId}-copy-1`;

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
  if (reopenedValue !== -3.25 || readFileSync(documentFile, "utf8") !== savedBytes) {
    fail("authoring reopen did not prove the saved translation bytes");
  }

  const invokeProjectBrowser = async (request: unknown) =>
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
    typeof browserAssetPath !== "string" ||
    typeof browserAssetInstanceId !== "string" ||
    typeof browserAssetDigest !== "string"
  ) {
    fail("project browser preload channel did not list the canonical document and asset");
  }
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
      selector.value = ${JSON.stringify(browserAssetPath)};
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      const selected = await waitFor(() =>
        document.querySelector('[data-busy]') === null &&
        document.querySelector('#project-browser-file-select')?.value === ${JSON.stringify(browserAssetPath)} &&
        document.querySelector('[data-project-browser-path]')?.textContent?.startsWith(${JSON.stringify(browserAssetPath)}));
      if (!selected) return { selected, opened: false, frame: null, instanceId: null, digest: null };
      opener.click();
      const opened = await waitFor(() =>
        document.querySelector('[data-busy]') === null &&
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
    typeof browserUiOpen.frame !== "number" ||
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
  let exportDirectory: unknown = null;
  let bundleDigest: unknown = null;
  let sourceDigest: unknown = null;
  if (process.platform === "linux") {
    if (!shipped.ok) fail(`Web export refused: ${shipped.reason}`);
    exportDirectory = payloadField(shipped.data, "outputDirectory");
    const handoffPath = payloadField(shipped.data, "handoffPath");
    bundleDigest = payloadField(shipped.data, "bundleDigest");
    const sourceProject = payloadField(shipped.data, "sourceProject");
    sourceDigest = payloadField(sourceProject, "contentHash");
    const parsedHandoff = typeof handoffPath === "string" && existsSync(handoffPath)
      ? parseDeliveryHandoffText(readFileSync(handoffPath, "utf8"))
      : null;
    const verifiedExportDirectory = typeof exportDirectory === "string"
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
      typeof exportDirectory !== "string" ||
      !exportDirectory.startsWith(`${cwd}${sep}exports${sep}web${sep}`) ||
      typeof handoffPath !== "string" ||
      !existsSync(handoffPath) ||
      typeof bundleDigest !== "string" ||
      typeof sourceDigest !== "string" ||
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

  const playbackDom = (await window.webContents.executeJavaScript(
    `(async () => {
      const waitFor = async (predicate) => {
        for (let attempt = 0; attempt < 500; attempt += 1) {
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
    typeof playbackDom.frame !== "number"
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
  const viewportDom = (await window.webContents.executeJavaScript(
    `({ canvases: document.querySelectorAll('[data-live-viewport="canvas"]').length,
        inertNotePresent: document.querySelector('.viewport-note-inert') !== null,
        reportText: document.getElementById('desktop-live-viewport-report')?.textContent ?? null })`,
  )) as { canvases: number; inertNotePresent: boolean; reportText: string | null };

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
      for (let attempt = 0; attempt < 500; attempt += 1) {
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
      for (let attempt = 0; attempt < 500; attempt += 1) {
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

  const guiFeatures = (await window.webContents.executeJavaScript(
    `(async () => {
      const waitFor = async (predicate) => {
        for (let attempt = 0; attempt < 500; attempt += 1) {
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
  const frameReportAtProfile = bridge?.lastFrameReport() ?? null;


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
  bridge = null;
  rmSync(cwd, { recursive: true, force: true });
  rmSync(audioSwitchRoot, { recursive: true, force: true });

  console.log(
    JSON.stringify({
      ok: true,
      handshake: handshake.data,
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
      ...(screenshotBytes > 0 ? { screenshotBytes } : {}),
    }),
  );
  app.exit(0);
}

const errorName = (error: unknown) => (error instanceof Error ? error.name : typeof error);

process.on("uncaughtException", (error) => {
  recordDesktopDiagnostic(logsDirectory, "main-exception", { errorName: errorName(error) });
  // A blocking dialog would hang a headless smoke until its launcher timeout.
  if (SMOKE) {
    reportFailure("An uncaught exception stopped the packaged smoke. See local logs.");
    return;
  }
  dialog.showErrorBox("Desktop stopped", "A local error occurred. Open Help → Reveal logs after restarting.");
  app.exit(1);
});

// Normal startup never echoes an exception; the smoke names the failing step.
void start().catch((error: unknown) => {
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
  const closing = localBridgeServer?.close() ?? Promise.resolve();
  localBridgeServer = null;
  void closing.finally(() => app.quit());
});
