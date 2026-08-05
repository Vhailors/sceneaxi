/**
 * The Linux desktop application offer: every fact the umbrella may print about it.
 *
 * The packaged app (ADR 0024, `desktop/linux`) is built by electron-builder, which
 * is not bit-reproducible. The first-download record therefore names one successful
 * main-branch GitHub Actions run and the exact files downloaded from its
 * `sceneaxi-desktop-linux` artifact. `docs/desktop-linux.md` records the same run,
 * source commit, byte sizes, and checksums; `tests/sites/` keeps both in lockstep.
 *
 * `resolveDesktopAppOffer()` is the fail-closed edge, and it validates every field a
 * page may print — not only the link. A missing record, a link that does not name the
 * recorded repository/run, or any incomplete honesty field yields a named refusal, so
 * `/engine` cannot turn malformed release metadata into a download button, and can
 * never reach a rendered field the resolver let through unchecked.
 *
 * Every `Object.freeze` below is annotated `@__PURE__` so this record can never
 * reach the packaged application it describes. `desktop/linux` bundles `site-kit`
 * for the scene payload, and without the annotation esbuild keeps this module in
 * `dist/main.cjs`: the digest of a build would then be inside that build, and
 * recording a fresh one would invalidate itself on the next rebuild. Held by
 * `tests/sites/desktop-offer-lockstep.test.ts`.
 */
import { type SiteResult, ok, refuse } from "./refusals.js";

export type DesktopAppArtifact = {
  readonly kind: "AppImage" | "deb";
  readonly platform: "Linux x86_64";
  readonly fileName: string;
  /** SHA-256 from the downloaded workflow artifact's `SHA256SUMS`. */
  readonly sha256: string;
  readonly byteSize: number;
  /** Copy-pasteable one-file verification command. */
  readonly verifyCommand: string;
};

export type DesktopUnavailablePlatform = {
  readonly platform: "macOS" | "Windows";
  readonly status: "coming-soon";
  readonly reason: string;
};

export type DesktopAppOffer = {
  readonly productName: string;
  readonly version: string;
  readonly platform: "Linux x86_64";
  readonly verifiedOn: string;
  readonly repository: "Vhailors/sceneaxi";
  readonly sourceCommit: string;
  readonly workflowRunId: number;
  /** The real repository artifact page. GitHub may require repository access. */
  readonly downloadHref: string;
  readonly ciWorkflow: "desktop-linux";
  readonly ciArtifactName: "sceneaxi-desktop-linux";
  readonly checksumFileName: "SHA256SUMS";
  readonly artifacts: readonly DesktopAppArtifact[];
  readonly verifyCommand: string;
  readonly sourceDir: "desktop/linux";
  readonly unavailablePlatforms: readonly DesktopUnavailablePlatform[];
  /** Why the digests identify this workflow artifact instead of every rebuild. */
  readonly reproducibilityNote: string;
};

const REPOSITORY = "Vhailors/sceneaxi" as const;
const WORKFLOW_RUN_ID = 30739014112;
const DOWNLOAD_HREF = `https://github.com/${REPOSITORY}/actions/runs/${WORKFLOW_RUN_ID}`;

export const DESKTOP_LINUX_APP_OFFER: DesktopAppOffer = /* @__PURE__ */ Object.freeze({
  productName: "SceneAxi Engine Desktop",
  version: "0.0.0",
  platform: "Linux x86_64",
  verifiedOn: "2026-08-05",
  repository: REPOSITORY,
  sourceCommit: "b338a911b1e2646d815538c75daf82db5d8d6cd9",
  workflowRunId: WORKFLOW_RUN_ID,
  downloadHref: DOWNLOAD_HREF,
  ciWorkflow: "desktop-linux",
  ciArtifactName: "sceneaxi-desktop-linux",
  checksumFileName: "SHA256SUMS",
  artifacts: /* @__PURE__ */ Object.freeze([
    /* @__PURE__ */ Object.freeze({
      kind: "AppImage" as const,
      platform: "Linux x86_64" as const,
      fileName: "SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage",
      sha256: "ea962d2a44a5d141bfca8aee5d650575b3e4d1123f01c68d3bd0c3791e194527",
      byteSize: 115165695,
      verifyCommand:
        "echo 'ea962d2a44a5d141bfca8aee5d650575b3e4d1123f01c68d3bd0c3791e194527  SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage' | sha256sum -c -",
    }),
    /* @__PURE__ */ Object.freeze({
      kind: "deb" as const,
      platform: "Linux x86_64" as const,
      fileName: "SceneAxi-Engine-Desktop-0.0.0-linux-amd64.deb",
      sha256: "0b5b4ba2f2df41200087300f60543675d26357bbd22fd8cf19a5473ee17b99ac",
      byteSize: 89870252,
      verifyCommand:
        "echo '0b5b4ba2f2df41200087300f60543675d26357bbd22fd8cf19a5473ee17b99ac  SceneAxi-Engine-Desktop-0.0.0-linux-amd64.deb' | sha256sum -c -",
    }),
  ]),
  verifyCommand: "sha256sum -c SHA256SUMS",
  sourceDir: "desktop/linux",
  unavailablePlatforms: /* @__PURE__ */ Object.freeze([
    /* @__PURE__ */ Object.freeze({
      platform: "macOS" as const,
      status: "coming-soon" as const,
      reason: "No macOS package or signing evidence exists yet.",
    }),
    /* @__PURE__ */ Object.freeze({
      platform: "Windows" as const,
      status: "coming-soon" as const,
      reason: "No Windows package or signing evidence exists yet.",
    }),
  ]),
  reproducibilityNote:
    "Electron packaging is not bit-reproducible. These checksums identify workflow run 30739014112 only; a source rebuild produces its own SHA256SUMS beside its own files.",
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const isFilledString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/**
 * A file name a page may print inside a copy-pasteable shell command, so it carries
 * no shell metacharacter, quote, or space that would make an unquoted command lie.
 */
const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

const isValidArtifact = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  const fileName = value["fileName"];
  const sha256 = value["sha256"];
  const verifyCommand = value["verifyCommand"];
  return (
    (value["kind"] === "AppImage" || value["kind"] === "deb") &&
    value["platform"] === "Linux x86_64" &&
    typeof fileName === "string" &&
    SAFE_FILE_NAME.test(fileName) &&
    fileName.includes("linux") &&
    typeof sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(sha256) &&
    isPositiveSafeInteger(value["byteSize"]) &&
    typeof verifyCommand === "string" &&
    verifyCommand.includes(sha256) &&
    verifyCommand.includes(fileName)
  );
};

/**
 * The platforms `/engine` names in prose as coming soon, so a record that omits one
 * would print that sentence over a shorter list than it promises.
 */
const UNAVAILABLE_PLATFORMS: readonly string[] = /* @__PURE__ */ Object.freeze([
  "macOS",
  "Windows",
]);

const isValidUnavailablePlatform = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  const platform = value["platform"];
  return (
    typeof platform === "string" &&
    UNAVAILABLE_PLATFORMS.includes(platform) &&
    value["status"] === "coming-soon" &&
    isFilledString(value["reason"])
  );
};

const namesEveryUnavailablePlatform = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === UNAVAILABLE_PLATFORMS.length &&
  value.every(isValidUnavailablePlatform) &&
  UNAVAILABLE_PLATFORMS.every((platform) =>
    value.some((row) => isRecord(row) && row["platform"] === platform),
  );

/** Validate an artifact record before a page is allowed to render its CTA. */
export function resolveDesktopAppOffer(candidate: unknown): SiteResult<DesktopAppOffer> {
  if (!isRecord(candidate) || Array.isArray(candidate)) {
    return refuse("DESKTOP_APP_ARTIFACT_UNAVAILABLE");
  }

  const workflowRunId = candidate["workflowRunId"];
  if (
    candidate["repository"] !== REPOSITORY ||
    !isPositiveSafeInteger(workflowRunId) ||
    candidate["downloadHref"] !==
      `https://github.com/${REPOSITORY}/actions/runs/${String(workflowRunId)}`
  ) {
    return refuse("DESKTOP_APP_ARTIFACT_LINK_INVALID");
  }

  const sourceCommit = candidate["sourceCommit"];
  const verifyCommand = candidate["verifyCommand"];
  const artifacts = candidate["artifacts"];
  const unavailablePlatforms = candidate["unavailablePlatforms"];
  if (
    candidate["version"] !== "0.0.0" ||
    candidate["platform"] !== "Linux x86_64" ||
    !isFilledString(candidate["productName"]) ||
    !isFilledString(candidate["reproducibilityNote"]) ||
    typeof candidate["verifiedOn"] !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(candidate["verifiedOn"]) ||
    typeof sourceCommit !== "string" ||
    !/^[0-9a-f]{40}$/.test(sourceCommit) ||
    candidate["ciWorkflow"] !== "desktop-linux" ||
    candidate["ciArtifactName"] !== "sceneaxi-desktop-linux" ||
    candidate["checksumFileName"] !== "SHA256SUMS" ||
    candidate["sourceDir"] !== "desktop/linux" ||
    typeof verifyCommand !== "string" ||
    !verifyCommand.includes("SHA256SUMS") ||
    !Array.isArray(artifacts) ||
    artifacts.length === 0 ||
    !artifacts.every(isValidArtifact) ||
    !namesEveryUnavailablePlatform(unavailablePlatforms)
  ) {
    return refuse("DESKTOP_APP_ARTIFACT_UNAVAILABLE");
  }

  return ok(candidate as DesktopAppOffer);
}

/** The validated offer the umbrella engine page renders. */
export function desktopLinuxAppOffer(): SiteResult<DesktopAppOffer> {
  return resolveDesktopAppOffer(DESKTOP_LINUX_APP_OFFER);
}
