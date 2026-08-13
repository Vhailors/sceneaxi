/**
 * Shared user-project build target. Host, signing, notarization, and release
 * authority are checked before any shipping claim. This is not the editor app
 * package.
 */
export const PROJECT_BUILD_SCHEMA_VERSION = 1 as const;
export const PROJECT_BUILD_KIND = "sceneaxi.project-build" as const;

export const PROJECT_BUILD_PLATFORMS = Object.freeze(["linux", "macos", "windows"] as const);
export type ProjectBuildPlatform = (typeof PROJECT_BUILD_PLATFORMS)[number];

export const PROJECT_BUILD_REFUSALS = Object.freeze({
  hostUnsupported: "PROJECT_BUILD_HOST_UNSUPPORTED",
  signingMissing: "PROJECT_BUILD_SIGNING_MISSING",
  notarizationMissing: "PROJECT_BUILD_NOTARIZATION_MISSING",
  releaseAuthorityMissing: "PROJECT_BUILD_RELEASE_AUTHORITY_MISSING",
  kidsDenied: "PROJECT_BUILD_KIDS_DENIED",
  inputUnsupported: "PROJECT_BUILD_INPUT_UNSUPPORTED",
} as const);

export type ProjectBuildRefusal =
  (typeof PROJECT_BUILD_REFUSALS)[keyof typeof PROJECT_BUILD_REFUSALS];

export type ProjectBuildHost = Readonly<{
  platform: ProjectBuildPlatform | "unknown";
  signingReady: boolean;
  notarizationReady: boolean;
  releaseAuthority: boolean;
}>;

type Failure = Readonly<{
  ok: false;
  reason: ProjectBuildRefusal;
  message: string;
  releaseReady: false;
}>;

const fail = (reason: ProjectBuildRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message, releaseReady: false as const });

export function isProjectBuildPlatform(value: unknown): value is ProjectBuildPlatform {
  return typeof value === "string" &&
    (PROJECT_BUILD_PLATFORMS as readonly string[]).includes(value);
}

export function detectProjectBuildHost(platform = process.platform): ProjectBuildPlatform | "unknown" {
  if (platform === "linux") return "linux";
  if (platform === "darwin") return "macos";
  if (platform === "win32") return "windows";
  return "unknown";
}

export function evaluateProjectBuild(input: Readonly<{
  target: unknown;
  profile: unknown;
  host: ProjectBuildHost;
}>):
  | Failure {
  if (input.profile === "kids" || input.profile === "@sceneaxi/profile-kids") {
    return fail(PROJECT_BUILD_REFUSALS.kidsDenied, "Project build is denied for Kids before host or signing checks.");
  }
  if (!isProjectBuildPlatform(input.target)) {
    return fail(
      PROJECT_BUILD_REFUSALS.inputUnsupported,
      "Project build names one target: linux, macos, or windows.",
    );
  }
  if (input.host.platform !== input.target) {
    return fail(
      PROJECT_BUILD_REFUSALS.hostUnsupported,
      `The ${input.target} project target requires a ${input.target} host; this host is ${input.host.platform}.`,
    );
  }
  if (!input.host.signingReady) {
    return fail(
      PROJECT_BUILD_REFUSALS.signingMissing,
      `The ${input.target} project target refuses before packaging when signing inputs are absent.`,
    );
  }
  if (input.target === "macos" && !input.host.notarizationReady) {
    return fail(
      PROJECT_BUILD_REFUSALS.notarizationMissing,
      "The macOS project target refuses unnotarized output before any release-ready claim.",
    );
  }
  if (!input.host.releaseAuthority) {
    return fail(
      PROJECT_BUILD_REFUSALS.releaseAuthorityMissing,
      `The ${input.target} project target keeps local verification distinct from public release authority.`,
    );
  }
  return fail(
    PROJECT_BUILD_REFUSALS.releaseAuthorityMissing,
    "A signed public user-project artifact is not authorized from this command without a later release record.",
  );
}
