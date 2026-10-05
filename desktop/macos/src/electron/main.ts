/**
 * macOS-only bootstrap around the unchanged staged desktop runtime.
 *
 * All current builds carry a disabled policy; signing does not authorize a public feed.
 * A future separately verified publication must embed a version/hash/feed policy. Smoke
 * mode never reaches the network. The existing application remains authoritative
 * for the window, bridge, desktop-shell chrome, and engine behavior.
 */
import { app } from "electron";
import { autoUpdater } from "electron-updater";
import { readFileSync } from "node:fs";
import { join } from "node:path";

declare const require: (specifier: string) => void;

declare const __dirname: string;

function isPolicyObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

const policy = (() => {
  try {
    const candidate: unknown = JSON.parse(
      readFileSync(join(__dirname, "update-policy.json"), "utf8"),
    );

    if (!isPolicyObject(candidate)) return { enabled: false };
    const enabled = Object.getOwnPropertyDescriptor(candidate, "enabled")?.value;

    return { enabled: enabled === true };
  } catch {
    return { enabled: false };
  }
})();

require("./runtime/main.cjs");

if (policy.enabled && app.isPackaged && !process.argv.includes("--smoke")) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("error", () => {
    console.error("desktop-macos update refused — MACOS_UPDATE_CHECK_FAILED");
  });
  void app.whenReady().then(async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      console.error("desktop-macos update refused — MACOS_UPDATE_CHECK_FAILED");
    }
  });
}

if (!policy.enabled) console.error("desktop-macos update refused — MACOS_UPDATE_RELEASE_NOT_VERIFIED");
