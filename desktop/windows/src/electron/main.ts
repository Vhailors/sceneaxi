import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { autoUpdater } from "electron-updater";
import { runWindowsUpdateCheck } from "../lib/update-policy.js";

// The staged desktop application remains the one implementation. This wrapper adds
// only the Windows updater bootstrap, then lets the existing main process own every
// window, bridge, session, and smoke behaviour unchanged.
const existingDesktopMain = "./desktop-main.cjs";

void import(existingDesktopMain).then(() => {
  void app.whenReady().then(async () => {
    autoUpdater.on("error", () => undefined);
    await runWindowsUpdateCheck({
      packaged: app.isPackaged,
      smokeMode: process.argv.includes("--smoke"),
      configurationExists: existsSync(join(process.resourcesPath, "app-update.yml")),
      checkForUpdates: () => autoUpdater.checkForUpdatesAndNotify(),
    });
  });
});
