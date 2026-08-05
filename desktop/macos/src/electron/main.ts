/**
 * macOS-only bootstrap around the unchanged staged desktop runtime.
 *
 * Local builds carry a disabled policy. The release command supplies an HTTPS
 * update location only after its signing/notarization preflight succeeds. Smoke
 * mode never reaches the network. The existing application remains authoritative
 * for the window, bridge, desktop-shell chrome, and engine behavior.
 */
import { app } from "electron";
import { autoUpdater } from "electron-updater";
import { readFileSync } from "node:fs";
import { join } from "node:path";

declare const require: (specifier: string) => unknown;
declare const __dirname: string;

const policy = (() => {
  try {
    const candidate: unknown = JSON.parse(
      readFileSync(join(__dirname, "update-policy.json"), "utf8"),
    );
    if (typeof candidate !== "object" || candidate === null) return { enabled: false };
    const enabled = Object.getOwnPropertyDescriptor(candidate, "enabled")?.value;
    return { enabled: enabled === true };
  } catch {
    return { enabled: false };
  }
})();

require("./runtime/main.cjs");

if (policy.enabled && !process.argv.includes("--smoke")) {
  autoUpdater.on("error", () => {
    // A failed update check leaves the current signed application untouched.
  });
  void app.whenReady().then(async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      // Fail closed: an unavailable or invalid feed never mutates the installed app.
    }
  });
}
