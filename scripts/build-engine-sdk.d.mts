/** Types for the dependency-free engine SDK builder in `build-engine-sdk.mjs`. */

export const SDK_PACKAGES: readonly string[];
export const SDK_DOCS: readonly string[];

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
};

export function buildEngineSdk(options?: EngineSdkBuildOptions): BuiltEngineSdk;
