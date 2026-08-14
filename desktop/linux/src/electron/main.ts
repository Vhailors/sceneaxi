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
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { BrowserWindow, app, dialog, ipcMain } from "electron";
import { DESKTOP_MINIMUM_WINDOW } from "@sceneaxi/desktop-shell";
import { inspectProjectModel } from "@sceneaxi/authoring-core";
import { createEditorCommandInvocation, parseDeliveryHandoffText } from "@sceneaxi/schemas";
import { DESKTOP_BYO_CONFIGURATION_CHANNEL } from "../lib/byo-configuration-contract.js";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_ASSET_IMPORT_CHANNEL,
  DESKTOP_BRIDGE_CHANNEL,
  DESKTOP_VIEWPORT_PLAY_EVENT,
  bridgeRefuse,
} from "../lib/bridge-contract.js";
import { createDesktopBridge, type DesktopBridge } from "../lib/bridge.js";
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
const SMOKE_TIMEOUT_MS = 45_000;

if (process.platform === "linux") {
  // Cinnamon/GNOME otherwise select Chromium basic_text, which this host refuses.
  app.commandLine.appendSwitch("password-store", "gnome-libsecret");
}

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

  let frameReported: ((report: unknown) => void) | null = null;
  const firstFrameReport = new Promise((resolve) => {
    frameReported = resolve;
  });

  const smokeRoot = SMOKE ? smokeProjectDir() : null;
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
      chooseFile: () => dialog.showOpenDialog(window, {
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

  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

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
      const selector = document.querySelector('#project-browser-file-select');
      const opener = document.querySelector('[data-action="project-browser-open"]');
      if (!(selector instanceof HTMLSelectElement) || !(opener instanceof HTMLButtonElement)) {
        return { selected: false, opened: false, frame: null, instanceId: null, digest: null };
      }
      selector.value = ${JSON.stringify(browserAssetPath)};
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      const selected = await waitFor(() =>
        document.querySelector('[data-busy]') === null &&
        document.querySelector('#project-browser-file-select')?.value === ${JSON.stringify(browserAssetPath)});
      document.querySelector('[data-action="project-browser-open"]')?.click();
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
  bridge = null;
  rmSync(cwd, { recursive: true, force: true });

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
      playbackDom,
      viewportDom,
      ...(screenshotBytes > 0 ? { screenshotBytes } : {}),
    }),
  );
  app.exit(0);
}

// Every await above can reject; without this the process would keep an open window
// alive until the launcher's timeout and print no cause at all.
void start().catch((error: unknown) => {
  reportFailure(error instanceof Error ? error.message : String(error));
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
