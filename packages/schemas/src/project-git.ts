/** Browser-safe result vocabulary for the contained project Git workflow. */

export const PROJECT_GIT_SCHEMA_VERSION = 1 as const;

export const PROJECT_GIT_DIAGNOSTICS = Object.freeze({
  missingGit: "PROJECT_GIT_MISSING",
  repositoryUnavailable: "PROJECT_GIT_REPOSITORY_UNAVAILABLE",
  repositoryEscape: "PROJECT_GIT_REPOSITORY_ESCAPE",
  pathEscape: "PROJECT_GIT_PATH_ESCAPE",
  capabilityMissing: "PROJECT_GIT_CAPABILITY_MISSING",
  kidsDenied: "PROJECT_GIT_KIDS_DENIED",
  detachedWorktree: "PROJECT_GIT_DETACHED_WORKTREE",
  mergeConflict: "PROJECT_GIT_MERGE_CONFLICT",
  reviewStaged: "PROJECT_GIT_SCENEAXI_REVIEW_STAGED",
  recoveryPending: "PROJECT_GIT_SCENEAXI_RECOVERY_PENDING",
  transactionDirty: "PROJECT_GIT_AUTHORING_TRANSACTION_DIRTY",
  selectionRequired: "PROJECT_GIT_SELECTION_REQUIRED",
  selectionMismatch: "PROJECT_GIT_SELECTION_MISMATCH",
  commitMessageInvalid: "PROJECT_GIT_COMMIT_MESSAGE_INVALID",
  operationUnsupported: "PROJECT_GIT_OPERATION_UNSUPPORTED",
  commandFailed: "PROJECT_GIT_COMMAND_FAILED",
} as const);

export type ProjectGitDiagnosticCode =
  (typeof PROJECT_GIT_DIAGNOSTICS)[keyof typeof PROJECT_GIT_DIAGNOSTICS];

export type ProjectGitEntry = Readonly<{
  path: string;
  index: string;
  worktree: string;
  canonical: boolean;
  conflict: boolean;
}>;

export type ProjectGitRepositoryState = Readonly<{
  schemaVersion: typeof PROJECT_GIT_SCHEMA_VERSION;
  kind: "sceneaxi.project-git-state";
  projectId: string;
  branch: string | null;
  head: string | null;
  detached: boolean;
  canonicalFiles: readonly string[];
  entries: readonly ProjectGitEntry[];
  canonicalChanges: readonly ProjectGitEntry[];
  unrelatedChanges: readonly ProjectGitEntry[];
  conflicts: readonly string[];
  workingTreeDiff: string;
  stagedDiff: string;
  clean: boolean;
  /** Document undo/redo never consumes or rewrites a Git commit. */
  undoScope: "sceneaxi-document-only";
}>;

export type ProjectGitCommitPreparation = Readonly<{
  schemaVersion: typeof PROJECT_GIT_SCHEMA_VERSION;
  kind: "sceneaxi.project-git-commit-preparation";
  message: string;
  selectedPaths: readonly string[];
  stagedDiff: string;
  state: ProjectGitRepositoryState;
  commitCreated: false;
  hooksBypassed: false;
  undoScope: "sceneaxi-document-only";
}>;

export type ProjectGitFailure = Readonly<{
  ok: false;
  diagnostic: Readonly<{
    code: ProjectGitDiagnosticCode;
    path: string;
    message: string;
  }>;
}>;

export type ProjectGitStateResult =
  | Readonly<{ ok: true; state: ProjectGitRepositoryState }>
  | ProjectGitFailure;

export type ProjectGitCommitPreparationResult =
  | Readonly<{ ok: true; preparation: ProjectGitCommitPreparation }>
  | ProjectGitFailure;
