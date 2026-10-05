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
import { BrowserWindow, Menu, app, crashReporter, dialog, ipcMain, shell } from "electron";
import { DESKTOP_MINIMUM_WINDOW } from "@sceneaxi/desktop-shell";
import { runAssistantSculptAction, inspectProjectModel } from "@sceneaxi/authoring-core";
import { createEditorCommandInvocation, parseDeliveryHandoffText } from "@sceneaxi/schemas";
import { CONTAINED_GLTF_REFUSALS, PROJECT_ASSET_MAX_BYTES } from "@sceneaxi/importers";
import { DESKTOP_BYO_CONFIGURATION_CHANNEL } from "../lib/byo-configuration-contract.js";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_ASSET_IMPORT_CHANNEL,
  DESKTOP_BRIDGE_CHANNEL,
  DESKTOP_VIEWPORT_PLAY_EVENT,
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

  return dir;
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
  const smokeNewRoot = SMOKE ? mkdtempSync(join(tmpdir(), "sceneaxi-desktop-new-")) : null;
  const smokeAssetSource = smokeNewRoot === null ? null : join(smokeNewRoot, "gui-smoke-source.gltf");

  if (smokeAssetSource !== null) writeFileSync(smokeAssetSource, smokeAssetBytes());
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
  closeActiveDesktopBridge = () => bridge?.close() ?? true;
  let inputActions: DesktopInputActionHost | null = null;
  let projectBrowser: DesktopProjectBrowser | null = null;
  let activeRoot: string | null = null;

  const activateProject = async (root: string): Promise<DesktopBridge> => {
    if (bridge !== null && activeRoot === root) return bridge;

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
      ...(smokeLocalExecutor === undefined ? {} : { runLocalAssistant: smokeLocalExecutor }),
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

  let smokeBridge: DesktopBridge | null;

  if (smokeRoot !== null) {
    smokeBridge = await activateProject(smokeRoot);
    const sourcePath = join(smokeRoot, "smoke-source.gltf");
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

  const trustedHandle = (channel: string, handler: (event: Electron.IpcMainInvokeEvent, request: unknown) => unknown) => {
    ipcMain.handle(channel, (event, request: unknown) => {
      if (window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame ||
          event.senderFrame.url !== documentUrl) {
        return bridgeRefuse("DESKTOP_BRIDGE_REQUEST_MALFORMED", "Only the packaged main document may use the desktop bridge.");
      }

      return handler(event, request);
    });
  };

  trustedHandle(DESKTOP_BRIDGE_CHANNEL, (_event, request: unknown) =>
    bridge?.handle(request) ??
      bridgeRefuse(
        DESKTOP_PROJECT_REFUSALS.projectRequired,
        "Choose New Project, Open Project, or a validated recent project before using the engine bridge.",
      ),
  );
  trustedHandle(DESKTOP_INPUT_ACTIONS_CHANNEL, () =>
    inputActions?.inspect() ?? {
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.projectRequired,
      message: "Choose a validated project before reading input actions.",
      detail: null,
    },
  );
  trustedHandle(DESKTOP_ASSET_IMPORT_CHANNEL, async (_event, request: unknown) => {
    if (bridge === null || activeRoot === null) {
      return bridgeRefuse(
        DESKTOP_PROJECT_REFUSALS.projectRequired,
        "Choose a validated project before importing an asset.",
      );
    }

    const picker = createDesktopAssetPickerHost({
      chooseFile: () => SMOKE ? Promise.resolve({ canceled: false, filePaths: smokeAssetSource === null ? [] : [smokeAssetSource] }) : dialog.showOpenDialog(window, {
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
  trustedHandle(DESKTOP_PROJECT_BROWSER_CHANNEL, (_event, request: unknown) =>
    projectBrowser?.handle(request) ??
      projectBrowserRefuse(
        DESKTOP_PROJECT_BROWSER_REFUSALS.projectRequired,
        "Choose New Project, Open Project, or a validated recent project before browsing project files.",
      ),
  );
  trustedHandle(DESKTOP_BYO_CONFIGURATION_CHANNEL, (_event, request: unknown) =>
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

  trustedHandle(DESKTOP_PROJECT_CHANNEL, async (_event, request: unknown) => {
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

  // --- native front-door coverage: the existing typed dialog port gets isolated
  // fixture choices in smoke only; no renderer path/credential bypass is exposed.
  const gui = async (body: string): Promise<unknown> => window.webContents.executeJavaScript(`(async () => {
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
  await gui(`await wait(() => document.querySelector('[data-action="profile"][data-value="web"]')?.getAttribute('aria-disabled') !== 'true', 'profile switch admitted'); await click('[data-action="profile"][data-value="web"]'); await wait(() => document.querySelector('[data-action="web-inject-asset"]')?.getAttribute('aria-disabled') !== 'true', 'Web import admitted'); await click('[data-action="web-inject-asset"]'); await wait(() => document.querySelector('[data-change-proposal]')?.hidden === false, 'GUI import review'); return true;`);

  if (readFileSync(guiDocument, "utf8") !== guiSaved) fail("GUI import wrote before approval.");
  await gui(`await click('[data-action="change-accept"]'); await wait(() => document.querySelector('[data-change-proposal]')?.hidden === true, 'import apply'); return true;`);
  console.error("SMOKE_PHASE maximum-asset canonical reload");
  const guiImported = readFileSync(guiDocument, "utf8");

  if (guiImported === guiSaved || !guiImported.includes('gui-smoke-source')) fail("Native fixture dialog did not apply a real manifest asset.");
  await gui(`const revision = Number(document.querySelector('.shell')?.dataset.projectBrowserRevision || 0); await click('[data-action="document-reload"]'); await wait(() => Number(document.querySelector('.shell')?.dataset.projectBrowserRevision) > revision && document.querySelector('.shell')?.dataset.projectBrowserSelectedPath === 'scene.json', 'import reload canonical document revision'); return true;`);

  if (readFileSync(guiDocument, "utf8") !== guiImported) fail("GUI reload rewrote canonical import bytes.");
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

  if (typeof guiExport !== "string" || !guiExport.startsWith(join(smokeNewRoot, "exports", "web") + sep) || !existsSync(join(guiExport, "delivery-handoff.json"))) fail("GUI Export did not write a contained handoff.");
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
      // Wait for the active root's asynchronous file projection before selecting.
      // An empty/stale select silently drops .value and cannot exercise Open.
      const ready = await waitFor(() => {
        const list = document.querySelector('#project-browser-file-select');
        const open = document.querySelector('[data-action="project-browser-open"]');
        return list instanceof HTMLSelectElement && !list.disabled &&
          Array.from(list.options).some(option => option.value === ${JSON.stringify(browserAssetPath)}) &&
          open instanceof HTMLButtonElement && !open.disabled &&
          open.getAttribute('aria-disabled') !== 'true' && Number(document.querySelector('.shell')?.dataset.projectBrowserRevision) > 0;
      });
      if (!ready) throw new Error('SMOKE_PROJECT_BROWSER_NOT_READY');
      const selector = document.querySelector('#project-browser-file-select');
      const opener = document.querySelector('[data-action="project-browser-open"]');
      if (!(selector instanceof HTMLSelectElement) || !(opener instanceof HTMLButtonElement)) {
        return { selected: false, opened: false, frame: null, instanceId: null, digest: null };
      }
      const revision = Number(document.querySelector('.shell')?.dataset.projectBrowserRevision);
      selector.value = ${JSON.stringify(browserAssetPath)};
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      const selected = await waitFor(() =>
        Number(document.querySelector('.shell')?.dataset.projectBrowserRevision) > revision &&
        document.querySelector('.shell')?.dataset.projectBrowserSelectedPath === ${JSON.stringify(browserAssetPath)} &&
        document.querySelector('#project-browser-file-select')?.value === ${JSON.stringify(browserAssetPath)});
      document.querySelector('[data-action="project-browser-open"]')?.click();
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
        const imported = await globalThis.sceneaxiDesktopLinux.request({ action: 'asset-import', payload: { profile: 'web', documentPath: 'scene.json', sourcePath: ${JSON.stringify(plateauSource)} } });
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
      plateauLatencies.length !== 12 || plateauLatencies.some(ms => typeof ms !== "number" || !Number.isFinite(ms) || ms > 4000) ||
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
    `(() => {
      const detail = { exercise: ${JSON.stringify(openPath.data)}, accepted: false, frame: null };
      document.dispatchEvent(new CustomEvent(${JSON.stringify(DESKTOP_VIEWPORT_PLAY_EVENT)}, { detail }));
      return {
        accepted: detail.accepted,
        frame: detail.frame,
        state: document.querySelector('.viewport')?.dataset.playback ?? null,
      };
    })()`,
  )) as { accepted: boolean; frame: number | null; state: string | null };

  if (
    playbackDom.accepted !== true ||
    playbackDom.state !== "acknowledged" ||
    typeof playbackDom.frame !== "number"
  ) {
    fail("Play did not redraw the saved composition in the packaged viewport");
  }

  // The window's own DOM must agree with the frame report: one live canvas, the
  // inert note gone, the report line printed. Asserted by scripts/smoke.mjs.
  const viewportDom = (await window.webContents.executeJavaScript(
    `({ canvases: document.querySelectorAll('[data-live-viewport="canvas"]').length,
        inertNotePresent: document.querySelector('.viewport-note-inert') !== null,
        reportText: document.getElementById('desktop-live-viewport-report')?.textContent ?? null })`,
  )) as { canvases: number; inertNotePresent: boolean; reportText: string | null };

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

  if (!proofBridge.close()) {
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
      return { canvases: 0, deleted };
    } finally { for (const [name, original] of originals) gl[name] = original; }
  `);

  bridge = null;
  rmSync(cwd, { recursive: true, force: true });
  rmSync(smokeNewRoot, { recursive: true, force: true });

  console.log(
    JSON.stringify({
      ok: true,
      handshake: handshake.data,
      nativeGui,
      security: { cspEnforced: true, permissionDenied: true, foreignSenderChannelsDenied: foreignRefusals.length, rawDumpConsent: sensitiveDumpConsent },
      performance: { ...(plateau as Record<string, unknown>), teardown },
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
      playbackDom,
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

// Smoke prints its own fixed proof failure. Normal startup never echoes an exception.
void start().catch((error: unknown) => {
  recordDesktopDiagnostic(logsDirectory, "main-exception", { errorName: errorName(error) });
  reportFailure("Desktop startup failed. See local logs.");
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
