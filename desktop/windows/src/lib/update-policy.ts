export const WINDOWS_UPDATE_REFUSALS = /* @__PURE__ */ Object.freeze({
  notPackaged: "WINDOWS_UPDATE_NOT_PACKAGED",
  smokeMode: "WINDOWS_UPDATE_SMOKE_DISABLED",
  configurationMissing: "WINDOWS_UPDATE_CONFIGURATION_MISSING",
  checkFailed: "WINDOWS_UPDATE_CHECK_FAILED",
} as const);

export type WindowsUpdateRefusal =
  (typeof WINDOWS_UPDATE_REFUSALS)[keyof typeof WINDOWS_UPDATE_REFUSALS];

export type WindowsUpdateResult =
  | Readonly<{ ok: true; checked: true }>
  | Readonly<{ ok: false; reason: WindowsUpdateRefusal }>;

export type WindowsUpdateInput = Readonly<{
  packaged: boolean;
  smokeMode: boolean;
  configurationExists: boolean;
  checkForUpdates: () => Promise<unknown>;
}>;

/**
 * The Windows wrapper reaches the network only for a packaged, non-smoke build
 * carrying electron-builder's generated app-update.yml. Missing configuration or
 * an updater error is a named refusal; it never falls back to an unsigned URL.
 */
export async function runWindowsUpdateCheck(
  input: WindowsUpdateInput,
): Promise<WindowsUpdateResult> {
  if (!input.packaged) {
    return Object.freeze({ ok: false, reason: WINDOWS_UPDATE_REFUSALS.notPackaged });
  }
  if (input.smokeMode) {
    return Object.freeze({ ok: false, reason: WINDOWS_UPDATE_REFUSALS.smokeMode });
  }
  if (!input.configurationExists) {
    return Object.freeze({
      ok: false,
      reason: WINDOWS_UPDATE_REFUSALS.configurationMissing,
    });
  }

  try {
    await input.checkForUpdates();
    return Object.freeze({ ok: true, checked: true });
  } catch {
    return Object.freeze({ ok: false, reason: WINDOWS_UPDATE_REFUSALS.checkFailed });
  }
}
