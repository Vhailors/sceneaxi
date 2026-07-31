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
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow, app, ipcMain } from "electron";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";
import { DESKTOP_BRIDGE_CHANNEL } from "../lib/bridge-contract.js";
import { createDesktopBridge } from "../lib/bridge.js";

// The bundle is CJS (Electron's main entry), so the native `__dirname` is real.
declare const __dirname: string;

const SMOKE = process.argv.includes("--smoke");
const SMOKE_TIMEOUT_MS = 45_000;

/** Sample document the authoring session works on, seeded on first launch. */
const SAMPLE_DOCUMENT = "scene.json";

function projectDir(): string {
  const dir = join(app.getPath("userData"), "project");
  mkdirSync(dir, { recursive: true });
  const documentPath = join(dir, SAMPLE_DOCUMENT);
  if (!existsSync(documentPath)) {
    const doc = createDocument({
      id: "scene",
      data: {
        entities: [{ id: "hero", x: 1, y: 2, rz: 0 }],
        material: { roughness: 0.4 },
      },
    });
    const written = writeDocumentFile(documentPath, doc, { cwd: dir });
    if (!written.ok) {
      // Fail visible, not silent: the authoring path needs its document.
      console.error("desktop-linux: could not seed the sample document", written);
    }
  }
  return dir;
}

let reportedFailure = false;

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

  const bridge = createDesktopBridge({
    cwd: projectDir(),
    onFrameReport: (report) => frameReported?.(report),
  });

  ipcMain.handle(DESKTOP_BRIDGE_CHANNEL, (_event, request: unknown) =>
    bridge.handle(request),
  );

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 560,
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

  const openPath = bridge.handle({ action: "open-path" });
  if (!openPath.ok) fail(`open-path refused: ${openPath.reason}`);

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
  const accepted = bridge.handle({ action: "authoring", payload: { op: "accept" } });
  if (!accepted.ok) fail(`authoring accept refused: ${accepted.reason}`);
  const undone = bridge.handle({ action: "authoring", payload: { op: "undo" } });
  if (!undone.ok) fail(`authoring undo refused: ${undone.reason}`);

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

  console.log(
    JSON.stringify({
      ok: true,
      handshake: handshake.data,
      openPath: openPath.data,
      authoring: { proposed: true, accepted: true, undone: true },
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
  app.quit();
});
