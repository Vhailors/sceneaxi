export const WINDOWS_SIGNING_ENV: readonly ["WIN_CSC_LINK", "WIN_CSC_KEY_PASSWORD"];

export const WINDOWS_RELEASE_ENV: readonly [
  "GITHUB_RELEASE_TOKEN",
  "SCENEAXI_WINDOWS_RELEASE_TAG",
];

export type WindowsReleasePreflightOptions = Readonly<{
  env?: Readonly<Record<string, string | undefined>>;
  platform?: NodeJS.Platform;
  commandAvailable?: (command: string) => boolean;
  publishing?: boolean;
}>;

export type WindowsReleasePreflight = Readonly<{
  ok: boolean;
  reasons: readonly string[];
}>;

export function windowsReleasePreflight(
  options?: WindowsReleasePreflightOptions,
): WindowsReleasePreflight;

export function requireWindowsReleaseEnvironment(
  options?: WindowsReleasePreflightOptions,
): void;
