/** Contained local Git inspection and preparation for one selected native project. */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { devNull } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  PROJECT_GIT_DIAGNOSTICS,
  PROJECT_GIT_EVIDENCE_MAX_BYTES,
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
import {
  atomicWriteLockArtifactPaths,
  canonicalPath,
  type AtomicWriteLockSet,
} from "./atomic-write.js";
import {
  applyJournalRecoveryPending,
  applyJournalOperationResource,
  beginApplyJournalTransaction,
  endApplyJournalTransactionChecked,
} from "./apply-journal.js";

export const PROJECT_GIT_OPERATIONS = Object.freeze([
  "status",
  "diff",
  "stage",
  "commit-prepare",
] as const);

export const PROJECT_GIT_UNSUPPORTED_OPERATIONS = Object.freeze([
  "push",
  "fetch",
  "credential",
  "history-rewrite",
  "branch-delete",
  "hook-bypass",
] as const);

export type ProjectGitOperation = (typeof PROJECT_GIT_OPERATIONS)[number];
export type ProjectGitUnsupportedOperation =
  (typeof PROJECT_GIT_UNSUPPORTED_OPERATIONS)[number];

export type ProjectGitAuthoringState = Readonly<{
  reviewStaged: boolean;
  recoveryPending: boolean;
  transactionDirty: boolean;
}>;

declare const projectGitAuthoringAuthorityBrand: unique symbol;
export type ProjectGitAuthoringAuthority = Readonly<{
  [projectGitAuthoringAuthorityBrand]: true;
}>;

const projectGitAuthoringAuthorities = new WeakMap<object, () => ProjectGitAuthoringState>();

export function createProjectGitAuthoringAuthority(
  readState: () => ProjectGitAuthoringState,
): ProjectGitAuthoringAuthority {
  const authority = Object.freeze({}) as ProjectGitAuthoringAuthority;
  projectGitAuthoringAuthorities.set(authority, readState);
  return authority;
}

export type ProjectGitOptions = Readonly<{
  root: string;
  profile?: "game" | "web" | "kids";
  /** Injectable only for deterministic missing-host tests. */
  gitExecutable?: string;
}>;

export type ProjectGitMutationOptions = ProjectGitOptions & Readonly<{
  authoring: ProjectGitAuthoringAuthority;
}>;

type GitResult = Readonly<{
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  missing: boolean;
  overflow: boolean;
}>;

const PROJECT_GIT_OUTPUT_LIMIT = PROJECT_GIT_EVIDENCE_MAX_BYTES;

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
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
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
      ...environment,
      GIT_CONFIG_GLOBAL: devNull,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_NO_LAZY_FETCH: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      LC_ALL: "C",
    },
    maxBuffer: PROJECT_GIT_OUTPUT_LIMIT,
  });
  const errorCode = result.error !== undefined && "code" in result.error
    ? result.error.code
    : undefined;
  return Object.freeze({
    ok: result.status === 0 && result.error === undefined,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    missing: errorCode === "ENOENT",
    overflow: errorCode === "ENOBUFS",
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

type MutationGuard = Readonly<{
  lockSet: AtomicWriteLockSet;
  excludedPaths: ReadonlySet<string>;
}>;

function transactionDirtyFailure(): ProjectGitFailure {
  return failure(
    PROJECT_GIT_DIAGNOSTICS.transactionDirty,
    ".sceneaxi/journal",
    "A SceneAxi authoring transaction is active; Git preparation cannot race it.",
  );
}

function mutationGuard(
  root: string,
  authoring: ProjectGitAuthoringAuthority | undefined,
): ProjectGitFailure | MutationGuard {
  const readAuthoring = authoring === undefined
    ? undefined
    : projectGitAuthoringAuthorities.get(authoring);
  if (readAuthoring === undefined) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.transactionDirty,
      "$authoring",
      "Authoritative SceneAxi review and recovery state is required before changing the Git index.",
    );
  }
  let authoringState: ProjectGitAuthoringState;
  try {
    authoringState = readAuthoring();
  } catch {
    return transactionDirtyFailure();
  }
  if (authoringState.reviewStaged) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.reviewStaged,
      "scene.json",
      "A SceneAxi proposal is staged for review; accept or reject it before changing the Git index.",
    );
  }
  if (authoringState.recoveryPending) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.recoveryPending,
      ".sceneaxi/journal/.active",
      "SceneAxi authoring recovery is pending; resolve it before changing the Git index.",
    );
  }
  if (authoringState.transactionDirty) {
    return transactionDirtyFailure();
  }
  const operationPath = canonicalPath(applyJournalOperationResource(root));
  if (!within(root, operationPath)) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.pathEscape,
      ".sceneaxi-authoring-operation",
      "The SceneAxi authoring lock resolves outside the selected project root.",
    );
  }
  const activeJournalPath = canonicalPath(resolve(root, ".sceneaxi", "journal", ".active"));
  if (!within(root, activeJournalPath)) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.pathEscape,
      ".sceneaxi/journal/.active",
      "The SceneAxi authoring journal resolves outside the selected project root.",
    );
  }
  for (const directory of [resolve(root, ".sceneaxi"), resolve(root, ".sceneaxi", "journal")]) {
    try {
      if (!lstatSync(directory).isDirectory()) {
        return failure(
          PROJECT_GIT_DIAGNOSTICS.recoveryPending,
          ".sceneaxi/journal",
          "SceneAxi authoring journal storage is invalid; resolve recovery before changing the Git index.",
        );
      }
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (code !== "ENOENT") {
        return failure(
          PROJECT_GIT_DIAGNOSTICS.recoveryPending,
          ".sceneaxi/journal",
          "SceneAxi authoring journal storage cannot be verified; resolve recovery before changing the Git index.",
        );
      }
    }
  }
  let lockSet: AtomicWriteLockSet;
  try {
    lockSet = beginApplyJournalTransaction(root, []);
  } catch {
    return transactionDirtyFailure();
  }
  if (applyJournalRecoveryPending(root)) {
    const releaseFailures = endApplyJournalTransactionChecked(lockSet);
    if (releaseFailures.length > 0) return transactionDirtyFailure();
    return failure(
      PROJECT_GIT_DIAGNOSTICS.recoveryPending,
      ".sceneaxi/journal/.active",
      "SceneAxi authoring recovery is pending; resolve it before changing the Git index.",
    );
  }
  const excludedPaths = new Set(
    atomicWriteLockArtifactPaths(lockSet).map((path) =>
      relative(root, path).split(sep).join("/"),
    ),
  );
  return Object.freeze({ lockSet, excludedPaths });
}

function parseStatus(
  output: string,
  canonicalFiles: ReadonlySet<string>,
  excludedPaths: ReadonlySet<string>,
): readonly ProjectGitEntry[] {
  const tokens = output.split("\0");
  const entries: ProjectGitEntry[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined || token.length < 4) continue;
    const indexState = token[0] ?? " ";
    const worktreeState = token[1] ?? " ";
    const path = token.slice(3);
    let sourcePath: string | undefined;
    if (indexState === "R" || indexState === "C" || worktreeState === "R" || worktreeState === "C") {
      index += 1;
      sourcePath = tokens[index];
    }
    if (excludedPaths.has(path) || (sourcePath !== undefined && excludedPaths.has(sourcePath))) continue;
    const conflict = indexState === "U" || worktreeState === "U" ||
      (indexState === "A" && worktreeState === "A") ||
      (indexState === "D" && worktreeState === "D");
    entries.push(Object.freeze({
      path,
      ...(sourcePath === undefined ? {} : { sourcePath }),
      index: indexState,
      worktree: worktreeState,
      canonical: canonicalFiles.has(path) ||
        (sourcePath !== undefined && canonicalFiles.has(sourcePath)),
      conflict,
    }));
  }
  return Object.freeze(entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

type Context = Readonly<{
  root: string;
  executable: string;
  indexPath: string;
  projectId: string;
  canonicalFiles: readonly string[];
}>;

function repositoryEscape(path: string, message: string): ProjectGitFailure {
  return failure(PROJECT_GIT_DIAGNOSTICS.repositoryEscape, path, message);
}

function validateGitNode(
  root: string,
  path: string,
  diagnosticPath: string,
  kind: "file" | "directory",
  required = false,
): ProjectGitFailure | null {
  try {
    const stat = lstatSync(path);
    const expected = kind === "file" ? stat.isFile() : stat.isDirectory();
    if (stat.isSymbolicLink() || !expected || !within(root, canonicalPath(path))) {
      return repositoryEscape(
        diagnosticPath,
        "Contained Git refuses repository control nodes with an unsafe type or indirection.",
      );
    }
    return null;
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    if (code === "ENOENT" && !required) return null;
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      diagnosticPath,
      "Contained Git could not verify a repository control node.",
    );
  }
}

function validateGitRefTree(
  root: string,
  directory: string,
): ProjectGitFailure | null {
  const pending = [directory];
  try {
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined) continue;
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const path = resolve(current, entry.name);
        if (
          entry.isSymbolicLink() ||
          (!entry.isDirectory() && !entry.isFile()) ||
          !within(root, canonicalPath(path))
        ) {
          return repositoryEscape(
            "$git.refs",
            "Contained Git refuses repository reference nodes with an unsafe type or indirection.",
          );
        }
        if (entry.isDirectory()) pending.push(path);
      }
    }
    return null;
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.refs",
      "Contained Git could not verify repository references.",
    );
  }
}

function validateGitFileDirectory(
  root: string,
  directory: string,
  diagnosticPath: string,
): ProjectGitFailure | null {
  try {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink() || !entry.isFile() || !within(root, canonicalPath(path))) {
        return repositoryEscape(
          diagnosticPath,
          "Contained Git refuses repository metadata files with an unsafe type or indirection.",
        );
      }
    }
    return null;
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    return code === "ENOENT"
      ? null
      : failure(
          PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
          diagnosticPath,
          "Contained Git could not verify repository metadata files.",
        );
  }
}

function containedGitDirectory(root: string): string | ProjectGitFailure {
  const gitPath = resolve(root, ".git");
  let gitStat: ReturnType<typeof lstatSync>;
  try {
    gitStat = lstatSync(gitPath);
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$root",
      "The selected project root is not a readable Git worktree.",
    );
  }
  if (!gitStat.isDirectory() || gitStat.isSymbolicLink()) {
    return repositoryEscape(
      "$git.directory",
      "Contained Git requires repository metadata to be a real directory inside the selected project.",
    );
  }
  const gitDirectory = canonicalPath(gitPath);
  if (!within(root, gitDirectory)) {
    return repositoryEscape(
      "$git.directory",
      "The selected repository metadata resolves outside the project root.",
    );
  }
  for (const pointer of ["commondir", "gitdir", "config.worktree"] as const) {
    try {
      lstatSync(resolve(gitDirectory, pointer));
      return repositoryEscape(
        `$git.${pointer}`,
        "Contained Git refuses repository metadata pointer files.",
      );
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (code !== "ENOENT") {
        return failure(
          PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
          `$git.${pointer}`,
          "Contained Git could not verify repository metadata pointers.",
        );
      }
    }
  }
  const controlNodes = [
    ["config", "file", true],
    ["HEAD", "file", true],
    ["index", "file", false],
    ["packed-refs", "file", false],
    ["shallow", "file", false],
    ["objects", "directory", true],
    ["objects/info", "directory", false],
    ["objects/info/alternates", "file", false],
    ["objects/info/http-alternates", "file", false],
    ["objects/pack", "directory", false],
    ["refs", "directory", true],
  ] as const;
  for (const [name, kind, required] of controlNodes) {
    const invalid = validateGitNode(
      root,
      resolve(gitDirectory, ...name.split("/")),
      `$git.${name.replaceAll("/", ".")}`,
      kind,
      required,
    );
    if (invalid !== null) return invalid;
  }
  const invalidRefs = validateGitRefTree(root, resolve(gitDirectory, "refs"));
  if (invalidRefs !== null) return invalidRefs;
  const invalidPacks = validateGitFileDirectory(
    root,
    resolve(gitDirectory, "objects", "pack"),
    "$git.objects.pack",
  );
  if (invalidPacks !== null) return invalidPacks;
  let config: string;
  try {
    config = readFileSync(resolve(gitDirectory, "config"), "utf8");
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.config",
      "Contained Git could not read the repository configuration.",
    );
  }
  if (/^\s*\[\s*include(?:if\b[^\]]*)?\s*\]\s*$/imu.test(config)) {
    return repositoryEscape(
      "$git.config",
      "Contained Git refuses repository configuration includes.",
    );
  }
  return gitDirectory;
}

function refuseGitlinks(
  executable: string,
  root: string,
): ProjectGitFailure | null {
  const index = runGit(executable, root, ["ls-files", "--stage", "-z"]);
  if (index.overflow) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge,
      "$git.index",
      "The Git index exceeds the contained evidence limit.",
    );
  }
  if (!index.ok) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.index",
      "Contained Git could not verify repository index entries.",
    );
  }
  if (index.stdout.split("\0").some((entry) => entry.startsWith("160000 "))) {
    return repositoryEscape(
      "$git.index",
      "Contained Git refuses repositories with submodule or gitlink entries.",
    );
  }
  return null;
}

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
  let manifestPath: string;
  try {
    const unresolvedManifestPath = resolve(root, PROJECT_MANIFEST_PATH);
    const manifestStat = lstatSync(unresolvedManifestPath);
    manifestPath = canonicalPath(unresolvedManifestPath);
    if (!within(root, manifestPath)) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.pathEscape,
        PROJECT_MANIFEST_PATH,
        "The native project manifest resolves outside the selected project root.",
      );
    }
    if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.pathEscape,
        PROJECT_MANIFEST_PATH,
        "Contained Git requires a regular native project manifest with an explicit capability grant.",
      );
    }
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.capabilityMissing,
      PROJECT_MANIFEST_PATH,
      "Contained Git requires a native project manifest with an explicit capability grant.",
    );
  }
  if (!within(root, manifestPath)) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.pathEscape,
      PROJECT_MANIFEST_PATH,
      "The native project manifest resolves outside the selected project root.",
    );
  }
  let manifestBytes: string;
  try {
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
  const gitDirectoryBeforeInspection = containedGitDirectory(root);
  if (typeof gitDirectoryBeforeInspection !== "string") return gitDirectoryBeforeInspection;
  const repository = runGit(executable, root, [
    "rev-parse",
    "--path-format=absolute",
    "--show-toplevel",
    "--git-dir",
    "--git-common-dir",
    "--git-path", "objects",
    "--git-path", "index",
  ]);
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
  let repositoryPaths: readonly string[];
  try {
    const reported = repository.stdout.trim().split("\n");
    if (reported.length !== 5 || reported.some((path) => !isAbsolute(path))) {
      throw new Error("incomplete repository paths");
    }
    repositoryPaths = reported.map((path) => canonicalPath(path));
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$root",
      "Git reported a worktree root that cannot be resolved.",
    );
  }
  const [gitRoot, gitDirectory, gitCommonDirectory, objectDirectory, indexPath] = repositoryPaths;
  if (gitRoot !== root) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryEscape,
      "$root",
      "The selected project is nested in or resolves through a different Git worktree root.",
    );
  }
  if (
    gitDirectory === undefined || gitCommonDirectory === undefined ||
    objectDirectory === undefined || indexPath === undefined ||
    !within(root, gitDirectory) || !within(root, gitCommonDirectory) ||
    !within(root, objectDirectory) || !within(root, indexPath)
  ) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryEscape,
      "$root",
      "The selected worktree stores Git repository, object, or index state outside the project root.",
    );
  }
  if (gitDirectory !== gitDirectoryBeforeInspection) {
    return repositoryEscape(
      "$git.directory",
      "Git reported repository metadata different from the contained directory verified before inspection.",
    );
  }
  const alternatesPath = canonicalPath(resolve(objectDirectory, "info", "alternates"));
  if (!within(root, alternatesPath)) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryEscape,
      "$git.objects.alternates",
      "The selected repository resolves alternate object storage outside the project root.",
    );
  }
  const httpAlternatesPath = resolve(objectDirectory, "info", "http-alternates");
  if (existsSync(httpAlternatesPath)) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryEscape,
      "$git.objects.http-alternates",
      "Contained Git refuses repositories that use HTTP alternate object storage.",
    );
  }
  try {
    if (readFileSync(alternatesPath, "utf8").trim().length > 0) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.repositoryEscape,
        "$git.objects.alternates",
        "Contained Git refuses repositories that use alternate object storage.",
      );
    }
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    if (code !== "ENOENT") {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
        "$git.objects.alternates",
        "Contained Git could not verify alternate object storage.",
      );
    }
  }
  const configuredFilters = runGit(executable, root, [
    "config", "--local", "--get-regexp",
    "^filter\\..*\\.(clean|process)$",
  ]);
  if (configuredFilters.overflow) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge,
      "$git.config",
      "Git filter configuration exceeds the contained evidence limit.",
    );
  }
  if (configuredFilters.stdout.trim().length > 0) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.commandFailed,
      "$git.filter",
      "Contained Git refuses repositories with configured clean or process filters.",
    );
  }
  if (configuredFilters.status !== 1) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.config",
      "Contained Git could not verify repository filter configuration.",
    );
  }
  const gitlinkFailure = refuseGitlinks(executable, root);
  if (gitlinkFailure !== null) return gitlinkFailure;
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
    indexPath,
    projectId: manifest.projectId,
    canonicalFiles,
  });
}

function entryPaths(entry: ProjectGitEntry): readonly string[] {
  return entry.sourcePath === undefined
    ? Object.freeze([entry.path])
    : Object.freeze([entry.path, entry.sourcePath].sort());
}

type GitIndexSnapshot = Readonly<{
  existed: boolean;
  bytes: Buffer | null;
}>;

function captureGitIndex(ctx: Context): GitIndexSnapshot | ProjectGitFailure {
  try {
    if (!existsSync(ctx.indexPath)) return Object.freeze({ existed: false, bytes: null });
    if (!lstatSync(ctx.indexPath).isFile()) {
      return repositoryEscape("$git.index", "Contained Git requires the repository index to be a regular file.");
    }
    return Object.freeze({ existed: true, bytes: readFileSync(ctx.indexPath) });
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.index",
      "Contained Git could not snapshot the repository index before staging.",
    );
  }
}

function restoreGitIndex(ctx: Context, snapshot: GitIndexSnapshot): boolean {
  try {
    if (snapshot.existed) {
      if (snapshot.bytes === null) return false;
      writeFileSync(ctx.indexPath, snapshot.bytes);
    } else if (existsSync(ctx.indexPath)) {
      unlinkSync(ctx.indexPath);
    }
    return true;
  } catch {
    return false;
  }
}

function releaseMutationGuard(guard: MutationGuard): readonly string[] {
  try {
    return endApplyJournalTransactionChecked(guard.lockSet);
  } catch {
    return Object.freeze(["$authoring.lock"]);
  }
}

function repositoryState(
  ctx: Context,
  excludedPaths: ReadonlySet<string> = new Set(),
): ProjectGitStateResult {
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
  if (status.overflow || working.overflow || staged.overflow) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge,
      "$root",
      "Git status or diff evidence exceeds the shared local-client response limit.",
    );
  }
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
  const entries = parseStatus(status.stdout, canonical, excludedPaths);
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
  if (Buffer.byteLength(JSON.stringify(state), "utf8") > PROJECT_GIT_EVIDENCE_MAX_BYTES) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge,
      "$root",
      "Git repository evidence exceeds the shared local-client response limit.",
    );
  }
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
  options: ProjectGitMutationOptions,
  paths: readonly string[],
): ProjectGitStateResult {
  const prepared = context("stage", options);
  if ("diagnostic" in prepared) return prepared;
  const selection = selectedPaths(prepared.root, paths);
  if ("diagnostic" in selection) return selection;
  const guard = mutationGuard(prepared.root, options.authoring);
  if ("diagnostic" in guard) return guard;
  let result: ProjectGitStateResult;
  let indexSnapshot: GitIndexSnapshot | undefined;
  let indexMayHaveChanged = false;
  const before = repositoryState(prepared, guard.excludedPaths);
  if (!before.ok) {
    result = before;
  } else if (before.state.detached) {
    result = failure(PROJECT_GIT_DIAGNOSTICS.detachedWorktree, "$git.HEAD", "Git staging is refused on a detached worktree.");
  } else if (before.state.conflicts.length > 0) {
    result = failure(PROJECT_GIT_DIAGNOSTICS.mergeConflict, before.state.conflicts[0] ?? "$git.index", "Resolve the reported merge conflict before staging project paths.");
  } else {
    const changedPaths = new Set(before.state.entries.flatMap(entryPaths));
    const selectedSet = new Set(selection);
    const incompleteRename = before.state.entries.some((entry) => {
      if (entry.sourcePath === undefined) return false;
      const destinationSelected = selectedSet.has(entry.path);
      const sourceSelected = selectedSet.has(entry.sourcePath);
      return destinationSelected !== sourceSelected;
    });
    if (selection.some((path) => !changedPaths.has(path)) || incompleteRename) {
      result = failure(
        PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
        "$input.paths",
        "Every selected path must exactly name a concrete file in the shared repository evidence, including both sides of a rename or copy.",
      );
    } else {
      const pathsToStage = [...new Set(
        before.state.entries
          .filter((entry) => entry.worktree !== " " && entryPaths(entry).some((path) => selectedSet.has(path)))
          .flatMap(entryPaths),
      )].sort();
      if (pathsToStage.length === 0) {
        result = before;
      } else {
        const captured = captureGitIndex(prepared);
        if ("diagnostic" in captured) {
          result = captured;
        } else {
          indexSnapshot = captured;
          indexMayHaveChanged = true;
          const staged = runGit(prepared.executable, prepared.root, ["--literal-pathspecs", "add", "-A", "--", ...pathsToStage]);
          result = staged.ok
            ? repositoryState(prepared, guard.excludedPaths)
            : failure(PROJECT_GIT_DIAGNOSTICS.commandFailed, "$input.paths", "Git refused the explicit selected-path staging operation.");
        }
      }
    }
  }
  const releaseFailures = releaseMutationGuard(guard);
  if ((!result.ok || releaseFailures.length > 0) && indexMayHaveChanged && indexSnapshot !== undefined) {
    if (!restoreGitIndex(prepared, indexSnapshot)) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.commandFailed,
        "$git.index",
        "Contained Git could not restore the exact prior index after staging failed; the index may remain changed.",
      );
    }
  }
  if (releaseFailures.length > 0) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.transactionDirty,
      ".sceneaxi-authoring-operation",
      indexMayHaveChanged
        ? "The authoring operation lock could not be released; the exact prior Git index was restored."
        : "The authoring operation lock could not be released.",
    );
  }
  return result;
}

/** Validate an exact staged selection and return commit evidence without creating a commit. */
export function prepareProjectGitCommit(
  options: ProjectGitMutationOptions,
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
  if ("diagnostic" in guard) return guard;
  let result: ProjectGitCommitPreparationResult;
  const stateResult = repositoryState(prepared, guard.excludedPaths);
  if (!stateResult.ok) {
    result = stateResult;
  } else if (stateResult.state.detached) {
    result = failure(PROJECT_GIT_DIAGNOSTICS.detachedWorktree, "$git.HEAD", "Commit preparation is refused on a detached worktree.");
  } else if (stateResult.state.conflicts.length > 0) {
    result = failure(PROJECT_GIT_DIAGNOSTICS.mergeConflict, stateResult.state.conflicts[0] ?? "$git.index", "Resolve the reported merge conflict before preparing a commit.");
  } else {
    const stagedPaths = [...new Set(
      stateResult.state.entries
        .filter((entry) => entry.index !== " " && entry.index !== "?")
        .flatMap(entryPaths),
    )].sort();
    if (selection.length !== stagedPaths.length || selection.some((path, index) => stagedPaths[index] !== path)) {
      result = failure(
        PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
        "$input.paths",
        "Commit preparation requires the explicit selection to equal the complete staged path set; unrelated staged paths remain visible and untouched.",
      );
    } else {
      const preparation = Object.freeze({
        schemaVersion: PROJECT_GIT_SCHEMA_VERSION,
        kind: "sceneaxi.project-git-commit-preparation" as const,
        message: message.trim(),
        selectedPaths: selection,
        stagedDiff: stateResult.state.stagedDiff,
        state: stateResult.state,
        commitCreated: false as const,
        hooksBypassed: false as const,
        undoScope: "sceneaxi-document-only" as const,
      });
      result = Buffer.byteLength(JSON.stringify(preparation), "utf8") > PROJECT_GIT_EVIDENCE_MAX_BYTES
        ? failure(
            PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge,
            "$root",
            "Git commit-preparation evidence exceeds the shared local-client response limit.",
          )
        : Object.freeze({ ok: true as const, preparation });
    }
  }
  const releaseFailures = releaseMutationGuard(guard);
  return releaseFailures.length === 0
    ? result
    : failure(
        PROJECT_GIT_DIAGNOSTICS.transactionDirty,
        ".sceneaxi-authoring-operation",
        "The authoring operation lock could not be released after commit preparation.",
      );
}

/** Dangerous or history-facing operations are outside the contained v1 surface. */
export function refuseUnsupportedProjectGitOperation(
  operation: ProjectGitUnsupportedOperation,
): ProjectGitFailure {
  return failure(
    PROJECT_GIT_DIAGNOSTICS.operationUnsupported,
    `$operation.${operation}`,
    `${operation} is unsupported: SceneAxi never pushes, fetches credentials, invokes credential operations, rewrites history, deletes branches, or bypasses hooks.`,
  );
}
