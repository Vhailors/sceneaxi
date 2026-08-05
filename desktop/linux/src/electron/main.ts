/**
 * Electron main process: window lifecycle, the bridge adapter, and the smoke mode.
 *
 * Everything decided lives in `src/lib/` (gate-tested without Electron); this file
 * adapts it: `ipcMain.handle` serves the synchronous bridge, the window loads the
 * build-time Engine Desktop chrome document, and `--smoke` runs the packaged-app
 * proof — handshake, real kernel open path, authoring propose/accept round trip in
 * a scratch project, and the renderer's real frame report — then prints one JSON
 * line and exits, so CI can assert the packaged binary is not a static HTML export.
 *
 * The window is locked down: context isolation on, sandbox on, no node integration,
 * and navigation away from the packaged document is refused.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { BrowserWindow, app, ipcMain } from "electron";
import { DESKTOP_MINIMUM_WINDOW } from "@sceneaxi/desktop-shell";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_CHANNEL,
} from "../lib/bridge-contract.js";
import { createDesktopBridge } from "../lib/bridge.js";
import {
  resolveDesktopLocalBridgePaths,
  startDesktopLocalBridgeServer,
  type DesktopLocalBridgeServer,
} from "../lib/local-rpc.js";
import { seedDesktopProject } from "../lib/project-seed.js";

// The bundle is CJS (Electron's main entry), so the native `__dirname` is real.
declare const __dirname: string;

const SMOKE = process.argv.includes("--smoke");
const SMOKE_TIMEOUT_MS = 45_000;

/** Sample document the authoring session works on, seeded on first launch. */
const SAMPLE_DOCUMENT = DESKTOP_ACTIVE_DOCUMENT_PATH;

function seedProject(dir: string): void {
  const seeded = seedDesktopProject(dir);
  if (!seeded.ok) console.error("desktop-linux: could not seed the sample document", seeded);
}

/** Where the launched application's own project lives: persistent, under userData. */
function persistentProjectDir(): string {
  return join(app.getPath("userData"), "project");
}

/** The launched application's own project: persistent, under the user's data dir. */
function projectDir(): string {
  const dir = persistentProjectDir();
  seedProject(dir);
  return dir;
}

/**
 * The smoke's project: a fresh directory per run, never the persistent one.
 *
 * The proof asserts what propose/accept/undo did to a document, so it has to own
 * that document: a persistent project can already hold an edited, invalid, or
 * mid-transaction file, and `undo()` there can resolve an earlier completed
 * journal this run never wrote — either of which would let the proof line report
 * a round trip it did not perform.
 */
function smokeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-smoke-"));
  seedProject(dir);
  return dir;
}

/** Read one own property off an unknown bridge payload, without asserting a shape. */
function payloadField(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

let reportedFailure = false;
let localBridgeServer: DesktopLocalBridgeServer | null = null;

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

  const cwd = SMOKE ? smokeProjectDir() : projectDir();
  const bridge = createDesktopBridge({
    cwd,
    onFrameReport: (report) => frameReported?.(report),
  });

  const localPaths = SMOKE
    ? {
        socketPath: join(cwd, ".sceneaxi-runtime", "desktop-v1.sock"),
        discoveryPath: join(cwd, ".sceneaxi-config", "desktop-bridge-v1.json"),
      }
    : resolveDesktopLocalBridgePaths({
        ...(process.env["XDG_RUNTIME_DIR"] === undefined
          ? {}
          : { runtimeDir: process.env["XDG_RUNTIME_DIR"] }),
        ...(process.env["XDG_CONFIG_HOME"] === undefined
          ? {}
          : { configDir: process.env["XDG_CONFIG_HOME"] }),
      });
  // The local agent bridge is an attachment point, not the application: a second
  // live host, an unusable runtime directory, or a refused socket must cost the
  // operator the CLI attachment, never the window and the authoring session in it.
  // The smoke proof asserts that attachment, so there it stays fatal.
  try {
    localBridgeServer = await startDesktopLocalBridgeServer({
      bridge,
      projectRoot: cwd,
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

  ipcMain.handle(DESKTOP_BRIDGE_CHANNEL, (_event, request: unknown) =>
    bridge.handle(request),
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

  await window.loadFile(join(__dirname, "index.html"));

  if (!SMOKE) return;

  // --- packaged-app smoke proof ---
  const handshake = bridge.handle({ action: "handshake" });
  if (!handshake.ok) fail(`handshake refused: ${handshake.reason}`);

  const openPath = bridge.handle({
    action: "open-path",
    payload: { documentPath: SAMPLE_DOCUMENT },
  });
  if (!openPath.ok) fail(`open-path refused: ${openPath.reason}`);

  // Isolation is observed, not declared: the proof owns the document it reports on
  // only if the round trip is running somewhere the persistent project is not, and
  // the directory is deleted below, so a wrong `cwd` here would take a real project
  // with it. Compared against the same path `projectDir()` resolves.
  const persistent = persistentProjectDir();
  const scratchProject = cwd !== persistent && !cwd.startsWith(`${persistent}${sep}`);
  if (!scratchProject) fail(`authoring proof would run on the persistent project ${cwd}`);

  // The envelope only says the bridge answered; a refused propose, a failed apply,
  // and an undo that restored nothing all arrive inside `{ok: true}`. So the proof
  // reads the session's own phases and the document bytes on disk.
  const documentFile = join(cwd, SAMPLE_DOCUMENT);
  const seededBytes = readFileSync(documentFile, "utf8");

  const proposed = bridge.handle({
    action: "authoring",
    payload: {
      op: "propose",
      documentPath: SAMPLE_DOCUMENT,
      jsonPointer: "/data/entities/0/x",
      newValue: 7,
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

  const accepted = bridge.handle({ action: "authoring", payload: { op: "accept" } });
  if (!accepted.ok) fail(`authoring accept refused: ${accepted.reason}`);
  const acceptedPhase = payloadField(accepted.data, "phase");
  if (acceptedPhase !== "applied") {
    fail(`authoring accept did not apply: phase ${JSON.stringify(acceptedPhase)}`);
  }
  if (readFileSync(documentFile, "utf8") === seededBytes) {
    fail("authoring accept reported applied but the document is unchanged");
  }

  const undone = bridge.handle({ action: "authoring", payload: { op: "undo" } });
  if (!undone.ok) fail(`authoring undo refused: ${undone.reason}`);
  if (payloadField(undone.data, "ok") !== true) fail("authoring undo did not succeed");
  const restored = readFileSync(documentFile, "utf8") === seededBytes;
  if (!restored) fail("authoring undo did not restore the document it applied to");

  const frameReport = await Promise.race([
    firstFrameReport,
    new Promise((resolve) => setTimeout(() => resolve(null), SMOKE_TIMEOUT_MS)),
  ]);
  if (frameReport === null) fail("no renderer frame report within the smoke timeout");

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
  rmSync(cwd, { recursive: true, force: true });

  console.log(
    JSON.stringify({
      ok: true,
      handshake: handshake.data,
      openPath: openPath.data,
      authoring: {
        proposed: true,
        accepted: true,
        undone: true,
        proposedPhase,
        acceptedPhase,
        restored,
        scratchProject,
        project: cwd,
      },
      frameReport,
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
  const closing = localBridgeServer?.close() ?? Promise.resolve();
  localBridgeServer = null;
  void closing.finally(() => app.quit());
});
