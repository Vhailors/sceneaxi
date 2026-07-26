/** Types for the dependency-free engine SDK builder in `build-engine-sdk.mjs`. */

export const SDK_PACKAGES: readonly string[];
export const SDK_DOCS: readonly string[];
export const SDK_GENERATED_FILES: readonly string[];

/** One archived package as its own shipped manifest describes it. */
export type SdkPackageSummary = {
  readonly dir: string;
  readonly name: string;
  readonly version: string | null;
  readonly releaseGroup: string | null;
  readonly corePin: string | null;
  readonly rootExports: readonly string[];
  readonly subpaths: readonly string[];
};

export type EngineSdkManifest = {
  readonly schemaVersion: 1;
  readonly kind: "sceneaxi.engine-sdk-manifest";
  readonly sdkVersion: string;
  readonly generatedFrom: string;
  readonly archiveFileName: string;
  readonly entryCount: number;
  readonly byteSize: number;
  readonly sha256: string;
  readonly packages: readonly string[];
  readonly notes: string;
};

export type BuiltEngineSdk = {
  readonly version: string;
  readonly fileName: string;
  readonly archive: Buffer;
  readonly sha256: string;
  readonly manifest: EngineSdkManifest;
  readonly entryNames: readonly string[];
};

export type EngineSdkBuildOptions = {
  readonly repoRoot?: string;
  readonly version?: string;
};

export function collectSdkEntries(options?: EngineSdkBuildOptions): {
  readonly entries: ReadonlyArray<{ readonly name: string; readonly data: Buffer }>;
  readonly packages: readonly string[];
  readonly packageSummaries: readonly SdkPackageSummary[];
};

export function buildEngineSdk(options?: EngineSdkBuildOptions): BuiltEngineSdk;

/** The archive-scoped readiness statement generated into the archive at build time. */
export function sdkReadinessDoc(
  version: string,
  packageSummaries: readonly SdkPackageSummary[],
): string;

export function eligibleSdkFiles(repoRoot?: string): readonly string[];
