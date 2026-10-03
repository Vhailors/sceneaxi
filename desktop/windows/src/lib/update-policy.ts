import type { UpdateCheckResult } from "electron-updater";

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
  checkForUpdates: () => Promise<UpdateCheckResult | null> | Promise<void>;
}>;

/** Packaging writes disabled policy. No generated provider config or environment enables updates. */
type VerifiedWindowsUpdatePolicy = Readonly<{
  schemaVersion: 1;
  enabled: true;
  platform: "windows-x64";
  version: string;
  sourceCommit: string;
  artifactSha256: string;
  feedUrl: "https://github.com/Vhailors/sceneaxi/releases";
}>;

function isPolicyText(value: unknown): value is string {
  return typeof value === "string";
}

export function isVerifiedWindowsUpdatePolicy(
  value: unknown,
  version: string | undefined,
): value is VerifiedWindowsUpdatePolicy {
  if (!(isBoundaryObjectValue(value)) || value === null || Array.isArray(value)) return false;
  const schemaVersion = Object.getOwnPropertyDescriptor(value, "schemaVersion")?.value;
  const enabled = Object.getOwnPropertyDescriptor(value, "enabled")?.value;
  const platform = Object.getOwnPropertyDescriptor(value, "platform")?.value;
  const policyVersion = Object.getOwnPropertyDescriptor(value, "version")?.value;
  const sourceCommit = Object.getOwnPropertyDescriptor(value, "sourceCommit")?.value;
  const artifactSha256 = Object.getOwnPropertyDescriptor(value, "artifactSha256")?.value;
  const feedUrl = Object.getOwnPropertyDescriptor(value, "feedUrl")?.value;

  return schemaVersion === 1 && enabled === true &&
    platform === "windows-x64" && policyVersion === version &&
    isBoundaryTextValue(version) && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/.test(version) &&
    isPolicyText(sourceCommit) && /^[a-f0-9]{40}$/.test(sourceCommit) &&
    isPolicyText(artifactSha256) && /^[a-f0-9]{64}$/.test(artifactSha256) &&
    feedUrl === "https://github.com/Vhailors/sceneaxi/releases";
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

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}

function isBoundaryTextValue<Input>(value: Input): value is Input & string {
  return typeof value === "string";
}
