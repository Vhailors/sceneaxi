/**
 * Reading the public engine SDK offer a site serves.
 *
 * `scripts/build-engine-sdk.mjs` writes the archive, its `.sha256`, and a manifest
 * into the umbrella's `public/engine-sdk/` at build time. This module turns that into
 * the offer a page renders, and refuses when the artifact or manifest is absent or
 * malformed — so `/engine` shows a named reason rather than a download button that
 * leads nowhere.
 *
 * The archive build is deterministic, so the bytes a site serves and the bytes CI
 * builds carry the same checksum. `hashServedArchive` exists so a test can prove the
 * served file matches the published checksum, rather than proving the manifest agrees
 * with itself.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type SiteResult, ok, refuse } from "./refusals.js";

/** Where the build writes the archive inside a site's `public/` tree. */
export const SDK_PUBLIC_DIR = "public/engine-sdk";
export const SDK_MANIFEST_FILE = "sdk-manifest.json";

export type EngineSdkOffer = {
  readonly version: string;
  readonly fileName: string;
  readonly href: string;
  readonly checksumHref: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly entryCount: number;
  readonly packages: readonly string[];
  /** Copy-pasteable verification line for the download page. */
  readonly verifyCommand: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** Read the SDK offer from a site's built manifest. */
export function readEngineSdkOffer(siteRoot: string): SiteResult<EngineSdkOffer> {
  const manifestPath = join(siteRoot, SDK_PUBLIC_DIR, SDK_MANIFEST_FILE);
  if (!existsSync(manifestPath)) return refuse("ENGINE_SDK_ARTIFACT_MISSING");
  let manifest: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null) {
      return refuse("ENGINE_SDK_MANIFEST_INVALID");
    }
    manifest = parsed as Record<string, unknown>;
  } catch {
    return refuse("ENGINE_SDK_MANIFEST_INVALID");
  }

  const sdkVersion = manifest["sdkVersion"];
  const fileName = manifest["archiveFileName"];
  const byteSize = manifest["byteSize"];
  const sha256 = manifest["sha256"];
  const entryCount = manifest["entryCount"];
  const packages = manifest["packages"];
  if (
    !isNonEmptyString(sdkVersion) ||
    !isNonEmptyString(fileName) ||
    !isNonEmptyString(sha256) ||
    !/^[0-9a-f]{64}$/.test(sha256) ||
    !Number.isSafeInteger(byteSize) ||
    (byteSize as number) <= 0 ||
    !Number.isSafeInteger(entryCount) ||
    (entryCount as number) <= 0 ||
    !Array.isArray(packages) ||
    packages.length === 0 ||
    !packages.every(isNonEmptyString)
  ) {
    return refuse("ENGINE_SDK_MANIFEST_INVALID");
  }
  // A manifest that names an archive this build does not contain is not an offer.
  if (!existsSync(join(siteRoot, SDK_PUBLIC_DIR, fileName))) {
    return refuse("ENGINE_SDK_ARTIFACT_MISSING");
  }

  return ok(
    Object.freeze({
      version: sdkVersion,
      fileName,
      href: `/engine-sdk/${fileName}`,
      checksumHref: `/engine-sdk/${fileName}.sha256`,
      byteSize: byteSize as number,
      sha256,
      entryCount: entryCount as number,
      packages: Object.freeze([...(packages as readonly string[])]),
      verifyCommand: `sha256sum -c ${fileName}.sha256`,
    }),
  );
}

/** Hash the archive actually on disk, so served bytes can be checked. */
export function hashServedArchive(siteRoot: string, fileName: string): SiteResult<string> {
  const path = join(siteRoot, SDK_PUBLIC_DIR, fileName);
  if (!existsSync(path)) return refuse("ENGINE_SDK_ARTIFACT_MISSING");
  return ok(createHash("sha256").update(readFileSync(path)).digest("hex"));
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
