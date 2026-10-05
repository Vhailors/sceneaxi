import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { app } from "electron";
import { autoUpdater } from "electron-updater";
import { runWindowsUpdateCheck } from "../lib/update-policy.js";

// The staged desktop application remains the one implementation. This wrapper adds
// only the Windows updater bootstrap, then lets the existing main process own every
// window, bridge, session, and smoke behaviour unchanged.
const existingDesktopMain = "./desktop-main.cjs";

const bootstrap = () => {
  try {
    createRequire(__filename)(existingDesktopMain);
  } catch (error) {
    console.error(
      `desktop-windows FAILED — the staged desktop application did not load: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    app.exit(1);

    return;
  }

  void app.whenReady().then(async () => {
    autoUpdater.on("error", () => {
      console.error("desktop-windows update error — WINDOWS_UPDATE_CHECK_FAILED");
    });
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    let releasePolicy: unknown;

    try {
      releasePolicy = JSON.parse(readFileSync(join(__dirname, "update-policy.json"), "utf8"));
    } catch {
      releasePolicy = undefined;
    }

    const result = await runWindowsUpdateCheck({
      packaged: app.isPackaged,
      smokeMode: process.argv.includes("--smoke"),
      configurationExists: existsSync(join(process.resourcesPath, "app-update.yml")),
      releasePolicy,
      version: app.getVersion(),
      checkForUpdates: () => autoUpdater.checkForUpdatesAndNotify(),
    });

    if (!result.ok) console.error(`desktop-windows update refused — ${result.reason}`);
  });
};

bootstrap();
