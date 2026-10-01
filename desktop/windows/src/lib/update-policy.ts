export const WINDOWS_UPDATE_REFUSALS = /* @__PURE__ */ Object.freeze({
  notPackaged: "WINDOWS_UPDATE_NOT_PACKAGED",
  smokeMode: "WINDOWS_UPDATE_SMOKE_DISABLED",
  configurationMissing: "WINDOWS_UPDATE_CONFIGURATION_MISSING",
  releaseNotVerified: "WINDOWS_UPDATE_RELEASE_NOT_VERIFIED",
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
  /** Embedded by a separately authorized, verified public release; config alone is not proof. */
  releasePolicy?: unknown;
  version?: string;
  checkForUpdates: () => Promise<unknown>;
}>;

/** Packaging writes disabled policy. No generated provider config or environment enables updates. */
export function isVerifiedWindowsUpdatePolicy(value: unknown, version: string | undefined): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const field = (name: string): unknown => Object.getOwnPropertyDescriptor(value, name)?.value;

  return field("schemaVersion") === 1 && field("enabled") === true &&
    field("platform") === "windows-x64" && field("version") === version &&
    typeof version === "string" && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/.test(version) &&
    typeof field("sourceCommit") === "string" && /^[a-f0-9]{40}$/.test(field("sourceCommit") as string) &&
    typeof field("artifactSha256") === "string" && /^[a-f0-9]{64}$/.test(field("artifactSha256") as string) &&
    field("feedUrl") === "https://github.com/Vhailors/sceneaxi/releases";
}

export async function runWindowsUpdateCheck(input: WindowsUpdateInput): Promise<WindowsUpdateResult> {
  if (!input.packaged) return Object.freeze({ ok: false, reason: WINDOWS_UPDATE_REFUSALS.notPackaged });

  if (input.smokeMode) return Object.freeze({ ok: false, reason: WINDOWS_UPDATE_REFUSALS.smokeMode });

  if (!input.configurationExists) return Object.freeze({ ok: false, reason: WINDOWS_UPDATE_REFUSALS.configurationMissing });

  if (!isVerifiedWindowsUpdatePolicy(input.releasePolicy, input.version)) {
    return Object.freeze({ ok: false, reason: WINDOWS_UPDATE_REFUSALS.releaseNotVerified });
  }

  try {
    await input.checkForUpdates();

    return Object.freeze({ ok: true, checked: true });
  } catch {
    return Object.freeze({ ok: false, reason: WINDOWS_UPDATE_REFUSALS.checkFailed });
  }
}
