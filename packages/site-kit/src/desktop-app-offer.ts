/**
 * The Linux desktop application offer: every fact the umbrella may print about it.
 *
 * The packaged app (ADR 0024, `desktop/linux`) is built by electron-builder, which
 * is not bit-reproducible. The first-download record therefore names one successful
 * main-branch GitHub Actions run and the exact files downloaded from its
 * `sceneaxi-desktop-linux` artifact. `docs/desktop-linux.md` records the same run,
 * source commit, byte sizes, and checksums; `tests/sites/` keeps both in lockstep.
 *
 * `resolveDesktopAppOffer()` is the fail-closed edge. A missing record or a link that
 * does not name the recorded repository/run yields a named refusal, so `/engine`
 * cannot turn malformed release metadata into a download button.
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

/** Validate an artifact record before a page is allowed to render its CTA. */
export function resolveDesktopAppOffer(candidate: unknown): SiteResult<DesktopAppOffer> {
  if (candidate === undefined || candidate === null) {
    return refuse("DESKTOP_APP_ARTIFACT_UNAVAILABLE");
  }
  if (!isRecord(candidate)) return refuse("DESKTOP_APP_ARTIFACT_LINK_INVALID");

  const repository = candidate["repository"];
  const workflowRunId = candidate["workflowRunId"];
  const downloadHref = candidate["downloadHref"];
  const expectedHref =
    typeof repository === "string" && Number.isSafeInteger(workflowRunId)
      ? `https://github.com/${repository}/actions/runs/${String(workflowRunId)}`
      : null;

  if (
    repository !== REPOSITORY ||
    !Number.isSafeInteger(workflowRunId) ||
    (workflowRunId as number) <= 0 ||
    downloadHref !== expectedHref
  ) {
    return refuse("DESKTOP_APP_ARTIFACT_LINK_INVALID");
  }

  const artifacts = candidate["artifacts"];
  if (
    candidate["version"] !== "0.0.0" ||
    candidate["platform"] !== "Linux x86_64" ||
    typeof candidate["sourceCommit"] !== "string" ||
    !/^[0-9a-f]{40}$/.test(candidate["sourceCommit"]) ||
    candidate["ciArtifactName"] !== "sceneaxi-desktop-linux" ||
    candidate["checksumFileName"] !== "SHA256SUMS" ||
    !Array.isArray(artifacts) ||
    artifacts.length === 0 ||
    !artifacts.every(
      (artifact) =>
        isRecord(artifact) &&
        artifact["platform"] === "Linux x86_64" &&
        typeof artifact["fileName"] === "string" &&
        artifact["fileName"].includes("linux") &&
        typeof artifact["sha256"] === "string" &&
        /^[0-9a-f]{64}$/.test(artifact["sha256"]) &&
        Number.isSafeInteger(artifact["byteSize"]) &&
        (artifact["byteSize"] as number) > 0 &&
        typeof artifact["verifyCommand"] === "string" &&
        artifact["verifyCommand"].includes(artifact["sha256"]),
    )
  ) {
    return refuse("DESKTOP_APP_ARTIFACT_UNAVAILABLE");
  }

  return ok(candidate as DesktopAppOffer);
}

/** The validated offer the umbrella engine page renders. */
export function desktopLinuxAppOffer(): SiteResult<DesktopAppOffer> {
  return resolveDesktopAppOffer(DESKTOP_LINUX_APP_OFFER);
}
