/**
 * The Linux desktop application offer: every fact the umbrella may print about it.
 *
 * The packaged app (ADR 0024, `desktop/linux`) is built by electron-builder, which
 * is not bit-reproducible. The first-download record therefore names one successful
 * main-branch GitHub Actions run and the exact files downloaded from its
 * `sceneaxi-desktop-linux` artifact. `docs/desktop-linux.md` records the same run,
 * source commit, byte sizes, and checksums; `tests/sites/` keeps both in lockstep.
 *
 * A workflow artifact is not permanent, so the record states its own expiry:
 * `artifactRetentionDays` mirrors the retention the upload step declares, and
 * `artifactExpiresBy` is the last day this recorded run's download can still exist
 * under that declared retention window. Nothing here reads a clock — a page must
 * render the same record for every visitor, and no code in this repository can
 * observe GitHub deleting the artifact — so the honest move is to print the date
 * and keep the record re-recordable, which `retentionNote` says out loud.
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
  /**
   * The retention window `.github/workflows/desktop-linux.yml` declares on the upload.
   * The recorded workflow run applied this declaration — see `retentionNote`.
   */
  readonly artifactRetentionDays: number;
  /** `verifiedOn` plus the retention window: the last day the download can still exist. */
  readonly artifactExpiresBy: string;
  /** What the run page still shows after that date, and what to do instead. */
  readonly retentionNote: string;
};

const REPOSITORY = "Vhailors/sceneaxi" as const;
const WORKFLOW_RUN_ID = 31629556282;
const DOWNLOAD_HREF = `https://github.com/${REPOSITORY}/actions/runs/${WORKFLOW_RUN_ID}`;
/** Declared on the upload step in `.github/workflows/desktop-linux.yml`. */
const ARTIFACT_RETENTION_DAYS = 90;

export const DESKTOP_LINUX_APP_OFFER: DesktopAppOffer = /* @__PURE__ */ Object.freeze({
  productName: "SceneAxi Engine Desktop",
  version: "0.0.0",
  platform: "Linux x86_64",
  verifiedOn: "2026-08-12",
  repository: REPOSITORY,
  sourceCommit: "364b66632b155e02a831b7ab968840e8622a13c4",
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
      sha256: "a7fa01895cc61c643cd53c199d952c469a2750d814c0c0d21d2ec0d2c72f4626",
      byteSize: 115350176,
      verifyCommand:
        "echo 'a7fa01895cc61c643cd53c199d952c469a2750d814c0c0d21d2ec0d2c72f4626  SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage' | sha256sum -c -",
    }),
    /* @__PURE__ */ Object.freeze({
      kind: "deb" as const,
      platform: "Linux x86_64" as const,
      fileName: "SceneAxi-Engine-Desktop-0.0.0-linux-amd64.deb",
      sha256: "f304334b83f663d17a8b420b1a138fe4a58755debf7b20626f2cdc154ca34509",
      byteSize: 89999508,
      verifyCommand:
        "echo 'f304334b83f663d17a8b420b1a138fe4a58755debf7b20626f2cdc154ca34509  SceneAxi-Engine-Desktop-0.0.0-linux-amd64.deb' | sha256sum -c -",
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
    "Electron packaging is not bit-reproducible. These checksums identify workflow run 31629556282 only; a source rebuild produces its own SHA256SUMS beside its own files.",
  artifactRetentionDays: ARTIFACT_RETENTION_DAYS,
  artifactExpiresBy: "2026-11-10",
  retentionNote:
    "This is a workflow artifact rather than a release. GitHub applies the workflow's declared 90-day retention window to this run; the run page may remain after the artifact expires, so build from the repository or wait for a re-recorded run rather than trusting this page's checksums forever.",
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

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A calendar day this many days after `isoDay`, or `null` when `isoDay` is not a real
 * day. Pure arithmetic on committed strings — the offer states an expiry rather than
 * reading a clock, because a page must render the same record for every visitor.
 */
const dayAfter = (isoDay: string, days: number): string | null => {
  const parts = CALENDAR_DAY.exec(isoDay);
  if (parts === null) return null;
  const shifted = new Date(
    Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) + days * 86_400_000,
  );
  if (Number.isNaN(shifted.getTime())) return null;
  const day = shifted.toISOString().slice(0, 10);
  return days === 0 && day !== isoDay ? null : day;
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
  const verifiedOn = candidate["verifiedOn"];
  const retentionDays = candidate["artifactRetentionDays"];
  const verifyCommand = candidate["verifyCommand"];
  const artifacts = candidate["artifacts"];
  const unavailablePlatforms = candidate["unavailablePlatforms"];
  if (
    candidate["version"] !== "0.0.0" ||
    candidate["platform"] !== "Linux x86_64" ||
    !isFilledString(candidate["productName"]) ||
    !isFilledString(candidate["reproducibilityNote"]) ||
    !isFilledString(candidate["retentionNote"]) ||
    typeof verifiedOn !== "string" ||
    dayAfter(verifiedOn, 0) === null ||
    !isPositiveSafeInteger(retentionDays) ||
    retentionDays > ARTIFACT_RETENTION_DAYS ||
    candidate["artifactExpiresBy"] !== dayAfter(verifiedOn, retentionDays) ||
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
