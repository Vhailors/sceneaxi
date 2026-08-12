/** Contained local Git inspection and preparation for one selected native project. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  PROJECT_GIT_DIAGNOSTICS,
  PROJECT_GIT_SCHEMA_VERSION,
  PROJECT_MANIFEST_PATH,
  isCanonicalProjectPath,
  parseProjectManifestText,
  type ProjectCapability,
  type ProjectGitCommitPreparationResult,
  type ProjectGitDiagnosticCode,
  type ProjectGitEntry,
  type ProjectGitFailure,
  type ProjectGitRepositoryState,
  type ProjectGitStateResult,
} from "@sceneaxi/schemas";
import { canonicalPath } from "./atomic-write.js";

export const PROJECT_GIT_OPERATIONS = Object.freeze([
  "status",
  "diff",
  "stage",
  "commit-prepare",
] as const);

export const PROJECT_GIT_UNSUPPORTED_OPERATIONS = Object.freeze([
  "push",
  "fetch",
  "history-rewrite",
  "branch-delete",
] as const);

export type ProjectGitOperation = (typeof PROJECT_GIT_OPERATIONS)[number];
export type ProjectGitUnsupportedOperation =
  (typeof PROJECT_GIT_UNSUPPORTED_OPERATIONS)[number];

export type ProjectGitAuthoringState = Readonly<{
  reviewStaged: boolean;
  recoveryPending: boolean;
  transactionDirty: boolean;
}>;

export type ProjectGitOptions = Readonly<{
  root: string;
  profile?: "game" | "web" | "kids";
  authoring?: ProjectGitAuthoringState;
  /** Injectable only for deterministic missing-host tests. */
  gitExecutable?: string;
}>;

type GitResult = Readonly<{
  ok: boolean;
  stdout: string;
  stderr: string;
  missing: boolean;
}>;

const REQUIRED_CAPABILITY: Readonly<Record<ProjectGitOperation, ProjectCapability>> =
  Object.freeze({
    status: "project.git.read",
    diff: "project.git.read",
    stage: "project.git.stage",
    "commit-prepare": "project.git.commit-prepare",
  });

function failure(
  code: ProjectGitDiagnosticCode,
  path: string,
  message: string,
): ProjectGitFailure {
  return Object.freeze({
    ok: false as const,
    diagnostic: Object.freeze({ code, path, message }),
  });
}

function runGit(
  executable: string,
  root: string,
  args: readonly string[],
): GitResult {
  const result = spawnSync(executable, [
    "-c", "core.fsmonitor=false",
    "-c", "core.untrackedCache=false",
    "-c", "diff.algorithm=myers",
    "-c", "diff.renames=false",
    ...args,
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      LC_ALL: "C",
    },
    maxBuffer: 16 * 1024 * 1024,
  });
  return Object.freeze({
    ok: result.status === 0 && result.error === undefined,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    missing: result.error !== undefined && "code" in result.error && result.error.code === "ENOENT",
  });
}

function within(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function selectedPaths(
  root: string,
  paths: readonly string[],
): readonly string[] | ProjectGitFailure {
  if (paths.length === 0 || new Set(paths).size !== paths.length) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.selectionRequired,
      "$input.paths",
      "Git staging and commit preparation require a non-empty explicit path selection.",
    );
  }
  const canonicalRoot = realpathSync(root);
  const normalized: string[] = [];
  for (const path of paths) {
    if (!isCanonicalProjectPath(path)) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.pathEscape,
        path,
        "A selected Git path is not canonical and project-relative.",
      );
    }
    const candidate = canonicalPath(resolve(canonicalRoot, ...path.split("/")));
    if (!within(canonicalRoot, candidate)) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.pathEscape,
        path,
        "A selected Git path resolves outside the canonical project root.",
      );
    }
    normalized.push(path);
  }
  return Object.freeze(normalized.sort());
}

function mutationGuard(
  root: string,
  authoring: ProjectGitAuthoringState | undefined,
): ProjectGitFailure | null {
  if (authoring?.reviewStaged === true) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.reviewStaged,
      "scene.json",
      "A SceneAxi proposal is staged for review; accept or reject it before changing the Git index.",
    );
  }
  if (authoring?.recoveryPending === true) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.recoveryPending,
      ".sceneaxi/journal/.active",
      "SceneAxi authoring recovery is pending; resolve it before changing the Git index.",
    );
  }
  if (authoring?.transactionDirty === true ||
    existsSync(resolve(root, ".sceneaxi", "journal", ".active")) ||
    existsSync(resolve(root, ".sceneaxi", "journal", ".operation"))) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.transactionDirty,
      ".sceneaxi/journal",
      "A SceneAxi authoring transaction is active; Git preparation cannot race it.",
    );
  }
  return null;
}

function parseStatus(output: string, canonicalFiles: ReadonlySet<string>): readonly ProjectGitEntry[] {
  const tokens = output.split("\0");
  const entries: ProjectGitEntry[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined || token.length < 4) continue;
    const indexState = token[0] ?? " ";
    const worktreeState = token[1] ?? " ";
    const path = token.slice(3);
    if (indexState === "R" || indexState === "C" || worktreeState === "R" || worktreeState === "C") {
      index += 1;
    }
    const conflict = indexState === "U" || worktreeState === "U" ||
      (indexState === "A" && worktreeState === "A") ||
      (indexState === "D" && worktreeState === "D");
    entries.push(Object.freeze({
      path,
      index: indexState,
      worktree: worktreeState,
      canonical: canonicalFiles.has(path),
      conflict,
    }));
  }
  return Object.freeze(entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

type Context = Readonly<{
  root: string;
  executable: string;
  projectId: string;
  canonicalFiles: readonly string[];
}>;

function context(
  operation: ProjectGitOperation,
  options: ProjectGitOptions,
): Context | ProjectGitFailure {
  if (options.profile === "kids") {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.kidsDenied,
      "$profile",
      "The contained Git workflow is denied for Kids before project or Git access.",
    );
  }
  let root: string;
  try {
    root = realpathSync(options.root);
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$root",
      "The selected project root cannot be resolved.",
    );
  }
  let manifestBytes: string;
  try {
    const manifestPath = canonicalPath(resolve(root, PROJECT_MANIFEST_PATH));
    if (!within(root, manifestPath)) throw new Error("manifest escape");
    manifestBytes = readFileSync(manifestPath, "utf8");
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.capabilityMissing,
      PROJECT_MANIFEST_PATH,
      "Contained Git requires a native project manifest with an explicit capability grant.",
    );
  }
  const parsedManifest = parseProjectManifestText(manifestBytes);
  if (!parsedManifest.ok) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      parsedManifest.diagnostic.path,
      parsedManifest.diagnostic.message,
    );
  }
  const manifest = parsedManifest.manifest;
  const required = REQUIRED_CAPABILITY[operation];
  if (!manifest.capabilities.some((grant) => grant.id === required && grant.version === 1)) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.capabilityMissing,
      `$.capabilities.${required}`,
      `The selected project does not grant ${required} v1.`,
    );
  }
  const executable = options.gitExecutable ?? "git";
  const repository = runGit(executable, root, ["rev-parse", "--show-toplevel"]);
  if (repository.missing) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.missingGit,
      "$host.git",
      "Git is not available on the desktop host.",
    );
  }
  if (!repository.ok) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$root",
      "The selected project root is not a readable Git worktree.",
    );
  }
  let gitRoot: string;
  try {
    gitRoot = realpathSync(repository.stdout.trim());
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$root",
      "Git reported a worktree root that cannot be resolved.",
    );
  }
  if (gitRoot !== root) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryEscape,
      "$root",
      "The selected project is nested in or resolves through a different Git worktree root.",
    );
  }
  const canonicalFiles = Object.freeze([
    PROJECT_MANIFEST_PATH,
    ...manifest.objects.map((object) => object.path),
    ...manifest.assets.map((asset) => asset.path),
  ].filter((path, index, all) => all.indexOf(path) === index).sort());
  for (const path of canonicalFiles) {
    const candidate = canonicalPath(resolve(root, ...path.split("/")));
    if (!within(root, candidate)) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.pathEscape,
        path,
        "A canonical SceneAxi project path resolves outside the selected root.",
      );
    }
  }
  return Object.freeze({
    root,
    executable,
    projectId: manifest.projectId,
    canonicalFiles,
  });
}

function repositoryState(ctx: Context): ProjectGitStateResult {
  const status = runGit(ctx.executable, ctx.root, [
    "-c", "core.quotepath=false",
    "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ".",
  ]);
  const working = runGit(ctx.executable, ctx.root, [
    "-c", "core.quotepath=false",
    "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--full-index", "--no-color", "--binary", "--src-prefix=a/", "--dst-prefix=b/", "--", ".",
  ]);
  const staged = runGit(ctx.executable, ctx.root, [
    "-c", "core.quotepath=false",
    "diff", "--cached", "--no-ext-diff", "--no-textconv", "--no-renames", "--full-index", "--no-color", "--binary", "--src-prefix=a/", "--dst-prefix=b/", "--", ".",
  ]);
  if (!status.ok || !working.ok || !staged.ok) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.commandFailed,
      "$root",
      "Git could not produce canonical project status and diff evidence.",
    );
  }
  const branchResult = runGit(ctx.executable, ctx.root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const headResult = runGit(ctx.executable, ctx.root, ["rev-parse", "--verify", "HEAD"]);
  const canonical = new Set(ctx.canonicalFiles);
  const entries = parseStatus(status.stdout, canonical);
  const conflicts = Object.freeze(entries.filter((entry) => entry.conflict).map((entry) => entry.path));
  const state: ProjectGitRepositoryState = Object.freeze({
    schemaVersion: PROJECT_GIT_SCHEMA_VERSION,
    kind: "sceneaxi.project-git-state",
    projectId: ctx.projectId,
    branch: branchResult.ok ? branchResult.stdout.trim() : null,
    head: headResult.ok ? headResult.stdout.trim() : null,
    detached: !branchResult.ok && headResult.ok,
    canonicalFiles: ctx.canonicalFiles,
    entries,
    canonicalChanges: Object.freeze(entries.filter((entry) => entry.canonical)),
    unrelatedChanges: Object.freeze(entries.filter((entry) => !entry.canonical)),
    conflicts,
    workingTreeDiff: working.stdout,
    stagedDiff: staged.stdout,
    clean: entries.length === 0,
    undoScope: "sceneaxi-document-only",
  });
  return Object.freeze({ ok: true as const, state });
}

/** Read-only status and canonical diff share one evidence result. */
export function inspectProjectGit(
  options: ProjectGitOptions,
  operation: "status" | "diff" = "status",
): ProjectGitStateResult {
  const prepared = context(operation, options);
  return "diagnostic" in prepared ? prepared : repositoryState(prepared);
}

/** Change only the Git index entries named by the caller's exact selection. */
export function stageProjectGitPaths(
  options: ProjectGitOptions,
  paths: readonly string[],
): ProjectGitStateResult {
  const prepared = context("stage", options);
  if ("diagnostic" in prepared) return prepared;
  const selection = selectedPaths(prepared.root, paths);
  if ("diagnostic" in selection) return selection;
  const guard = mutationGuard(prepared.root, options.authoring);
  if (guard !== null) return guard;
  const before = repositoryState(prepared);
  if (!before.ok) return before;
  if (before.state.detached) {
    return failure(PROJECT_GIT_DIAGNOSTICS.detachedWorktree, "$git.HEAD", "Git staging is refused on a detached worktree.");
  }
  if (before.state.conflicts.length > 0) {
    return failure(PROJECT_GIT_DIAGNOSTICS.mergeConflict, before.state.conflicts[0] ?? "$git.index", "Resolve the reported merge conflict before staging project paths.");
  }
  const staged = runGit(prepared.executable, prepared.root, ["--literal-pathspecs", "add", "--", ...selection]);
  if (!staged.ok) {
    return failure(PROJECT_GIT_DIAGNOSTICS.commandFailed, "$input.paths", "Git refused the explicit selected-path staging operation.");
  }
  return repositoryState(prepared);
}

/** Validate an exact staged selection and return commit evidence without creating a commit. */
export function prepareProjectGitCommit(
  options: ProjectGitOptions,
  paths: readonly string[],
  message: string,
): ProjectGitCommitPreparationResult {
  const prepared = context("commit-prepare", options);
  if ("diagnostic" in prepared) return prepared;
  if (message.trim().length === 0 || message.length > 4096 || message.includes("\0")) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.commitMessageInvalid,
      "$input.message",
      "Commit preparation requires a non-empty message of at most 4096 characters.",
    );
  }
  const selection = selectedPaths(prepared.root, paths);
  if ("diagnostic" in selection) return selection;
  const guard = mutationGuard(prepared.root, options.authoring);
  if (guard !== null) return guard;
  const stateResult = repositoryState(prepared);
  if (!stateResult.ok) return stateResult;
  if (stateResult.state.detached) {
    return failure(PROJECT_GIT_DIAGNOSTICS.detachedWorktree, "$git.HEAD", "Commit preparation is refused on a detached worktree.");
  }
  if (stateResult.state.conflicts.length > 0) {
    return failure(PROJECT_GIT_DIAGNOSTICS.mergeConflict, stateResult.state.conflicts[0] ?? "$git.index", "Resolve the reported merge conflict before preparing a commit.");
  }
  const stagedPaths = stateResult.state.entries
    .filter((entry) => entry.index !== " " && entry.index !== "?")
    .map((entry) => entry.path)
    .sort();
  if (selection.length !== stagedPaths.length || selection.some((path, index) => stagedPaths[index] !== path)) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
      "$input.paths",
      "Commit preparation requires the explicit selection to equal the complete staged path set; unrelated staged paths remain visible and untouched.",
    );
  }
  return Object.freeze({
    ok: true as const,
    preparation: Object.freeze({
      schemaVersion: PROJECT_GIT_SCHEMA_VERSION,
      kind: "sceneaxi.project-git-commit-preparation",
      message: message.trim(),
      selectedPaths: selection,
      stagedDiff: stateResult.state.stagedDiff,
      state: stateResult.state,
      commitCreated: false as const,
      hooksBypassed: false as const,
      undoScope: "sceneaxi-document-only" as const,
    }),
  });
}

/** Dangerous or history-facing operations are outside the contained v1 surface. */
export function refuseUnsupportedProjectGitOperation(
  operation: ProjectGitUnsupportedOperation,
): ProjectGitFailure {
  return failure(
    PROJECT_GIT_DIAGNOSTICS.operationUnsupported,
    `$operation.${operation}`,
    `${operation} is unsupported: SceneAxi never pushes, fetches credentials, rewrites history, or deletes branches.`,
  );
}
