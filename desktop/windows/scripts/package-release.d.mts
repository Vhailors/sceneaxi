export interface ReleaseArtifact { fileName: string; bytes: number; sha256: string }

export interface ReleaseManifest { schemaVersion: number; version: string; sourceCommit: string; artifacts: ReleaseArtifact[]; recordKind?: string; iaLinkable?: boolean; signed?: boolean }

export function validateReleaseArtifacts(input: { release: string; manifest: ReleaseManifest; version: string; expectedNames: string[]; updateFile: string; updateArtifact: string; metadataNames?: string[]; stagedDirectories?: string[] }): Readonly<{ artifacts: readonly ReleaseArtifact[]; version: string }>;
export function packageWindowsRelease(input: { appRoot: string; publish?: string; env?: Record<string, string | undefined> }): unknown;
export function hashReleaseFile(path: string, algorithm?: string, encoding?: string): string;
export function validateWindowsCandidate(appRoot: string): Readonly<{ expected: string; digest: string; manifest: ReleaseManifest; files: readonly string[]; checksumFile: string }>;
export function uploadVerifiedWindowsDraft(input: { appRoot: string; sourceCommit: string; tag: string; verifyCandidate?: () => ReturnType<typeof validateWindowsCandidate>; verifyNative: () => void; readDraft: () => { tagName: string; isDraft: boolean; targetCommitish: string }; upload: (files: readonly string[]) => void }): void;
