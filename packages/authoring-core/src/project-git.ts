/** Contained local Git inspection and preparation for one selected native project. */
import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { devNull } from "node:os";
import { TextDecoder } from "node:util";
import { delimiter, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  PROJECT_GIT_DIAGNOSTICS,
  PROJECT_GIT_EVIDENCE_MAX_BYTES,
  PROJECT_GIT_SCHEMA_VERSION,
  PROJECT_MANIFEST_PATH,
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
  acquireAtomicWriteLocks,
  atomicWriteLockArtifactPaths,
  canonicalPath,
  releaseAtomicWriteLocksChecked,
  type AtomicWriteLockSet,
} from "./atomic-write.js";
import {
  applyJournalRecoveryPending,
  applyJournalOperationResource,
  beginApplyJournalTransaction,
  endApplyJournalTransactionChecked,
} from "./apply-journal.js";
import { projectMigrationRecoveryPending } from "./project-model.js";

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

const projectGitAuthoringAuthorities = new WeakMap<
  object,
  Readonly<{ root: string; readState: () => ProjectGitAuthoringState }>
>();

export function createProjectGitAuthoringAuthority(
  root: string,
  readState: () => ProjectGitAuthoringState,
): ProjectGitAuthoringAuthority {
  const authority = Object.freeze({}) as ProjectGitAuthoringAuthority;
  projectGitAuthoringAuthorities.set(authority, Object.freeze({
    root: canonicalPath(root),
    readState,
  }));
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
  stdoutBytes: Buffer;
  stderr: string;
  missing: boolean;
  overflow: boolean;
  timedOut: boolean;
}>;

const PROJECT_GIT_OUTPUT_LIMIT = PROJECT_GIT_EVIDENCE_MAX_BYTES;
const PROJECT_GIT_PROCESS_TIMEOUT_MS = 10_000;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

type GitProcessState = Readonly<{
  indexPath?: string;
  objectDirectory?: string;
  alternateObjectDirectories?: readonly string[];
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
  state: GitProcessState = {},
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
    env: {
      ...environment,
      GIT_CONFIG_GLOBAL: devNull,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_NO_LAZY_FETCH: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      ...(state.indexPath === undefined ? {} : { GIT_INDEX_FILE: state.indexPath }),
      ...(state.objectDirectory === undefined
        ? {}
        : { GIT_OBJECT_DIRECTORY: state.objectDirectory }),
      ...(state.alternateObjectDirectories === undefined
        ? {}
        : { GIT_ALTERNATE_OBJECT_DIRECTORIES: state.alternateObjectDirectories.join(delimiter) }),
      LC_ALL: "C",
    },
    maxBuffer: PROJECT_GIT_OUTPUT_LIMIT,
    timeout: PROJECT_GIT_PROCESS_TIMEOUT_MS,
  });
  const errorCode = result.error !== undefined && "code" in result.error
    ? result.error.code
    : undefined;
  const stdoutBytes = Buffer.isBuffer(result.stdout)
    ? result.stdout
    : Buffer.from(result.stdout ?? "", "utf8");
  const stderrBytes = Buffer.isBuffer(result.stderr)
    ? result.stderr
    : Buffer.from(result.stderr ?? "", "utf8");
  return Object.freeze({
    ok: result.status === 0 && result.error === undefined,
    status: result.status,
    stdout: stdoutBytes.toString("utf8"),
    stdoutBytes,
    stderr: stderrBytes.toString("utf8"),
    missing: errorCode === "ENOENT",
    overflow: errorCode === "ENOBUFS",
    timedOut: errorCode === "ETIMEDOUT",
  });
}

function decodeGitPath(bytes: Uint8Array): string | null {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    return null;
  }
}

function nulFields(bytes: Buffer): readonly Buffer[] {
  const fields: Buffer[] = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0) continue;
    fields.push(bytes.subarray(start, index));
    start = index + 1;
  }
  if (start < bytes.length) fields.push(bytes.subarray(start));
  return fields;
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
    const segments = path.split("/");
    if (
      path.length === 0 || path.includes("\0") || isAbsolute(path) ||
      segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
    ) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.pathEscape,
        path,
        "A selected Git path must be an exact project-relative path reported by Git.",
      );
    }
    const candidate = canonicalPath(resolve(canonicalRoot, ...segments));
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
  root: string;
  lockSet: AtomicWriteLockSet;
  excludedPaths: ReadonlySet<string>;
}>;

const pendingMutationCleanups = new Map<string, AtomicWriteLockSet>();

declare const projectGitDesktopOwnerBrand: unique symbol;
export type ProjectGitDesktopOwner = Readonly<{
  [projectGitDesktopOwnerBrand]: true;
}>;

const projectGitDesktopOwners = new WeakMap<
  object,
  Readonly<{
    root: string;
    lockSet: AtomicWriteLockSet;
    excludedPaths: ReadonlySet<string>;
  }>
>();
const projectGitDesktopOwnerPaths = new Map<string, ReadonlySet<string>>();

export function acquireProjectGitDesktopOwner(
  root: string,
): ProjectGitDesktopOwner | ProjectGitFailure {
  const canonicalRoot = canonicalPath(root);
  const resource = canonicalPath(resolve(canonicalRoot, ".sceneaxi-desktop-mutation-owner"));
  if (!within(canonicalRoot, resource)) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.pathEscape,
      ".sceneaxi-desktop-mutation-owner",
      "The desktop mutation-owner lease resolves outside the selected project root.",
    );
  }
  let lockSet: AtomicWriteLockSet;
  try {
    lockSet = acquireAtomicWriteLocks([resource]);
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.transactionDirty,
      ".sceneaxi-desktop-mutation-owner",
      "Another desktop process owns mutation authority for the selected project root.",
    );
  }
  const owner = Object.freeze({}) as ProjectGitDesktopOwner;
  const excludedPaths = new Set(
    atomicWriteLockArtifactPaths(lockSet).map((path) =>
      relative(canonicalRoot, path).split(sep).join("/"),
    ),
  );
  projectGitDesktopOwners.set(owner, Object.freeze({
    root: canonicalRoot,
    lockSet,
    excludedPaths,
  }));
  projectGitDesktopOwnerPaths.set(canonicalRoot, excludedPaths);
  return owner;
}

export function releaseProjectGitDesktopOwner(owner: ProjectGitDesktopOwner): boolean {
  const held = projectGitDesktopOwners.get(owner);
  if (held === undefined) return true;
  try {
    if (releaseAtomicWriteLocksChecked(held.lockSet).length > 0) return false;
    projectGitDesktopOwners.delete(owner);
    projectGitDesktopOwnerPaths.delete(held.root);
    return true;
  } catch {
    return false;
  }
}

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
  const authoringAuthority = authoring === undefined
    ? undefined
    : projectGitAuthoringAuthorities.get(authoring);
  if (authoringAuthority === undefined || authoringAuthority.root !== root) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.transactionDirty,
      "$authoring",
      "Authoritative SceneAxi review and recovery state is required before changing the Git index.",
    );
  }
  let authoringState: ProjectGitAuthoringState;
  try {
    authoringState = authoringAuthority.readState();
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
  const pendingCleanup = pendingMutationCleanups.get(root);
  if (pendingCleanup !== undefined) {
    try {
      if (endApplyJournalTransactionChecked(pendingCleanup).length > 0) {
        return transactionDirtyFailure();
      }
      pendingMutationCleanups.delete(root);
    } catch {
      return transactionDirtyFailure();
    }
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
  if (projectMigrationRecoveryPending(root)) {
    const releaseFailures = endApplyJournalTransactionChecked(lockSet);
    if (releaseFailures.length > 0) return transactionDirtyFailure();
    return failure(
      PROJECT_GIT_DIAGNOSTICS.recoveryPending,
      ".sceneaxi/project-migration-journal.json",
      "SceneAxi project migration recovery is pending; resolve it before changing the Git index.",
    );
  }
  const excludedPaths = new Set(
    atomicWriteLockArtifactPaths(lockSet).map((path) =>
      relative(root, path).split(sep).join("/"),
    ),
  );
  return Object.freeze({ root, lockSet, excludedPaths });
}

function parseStatus(
  output: Buffer,
  canonicalFiles: ReadonlySet<string>,
  excludedPaths: ReadonlySet<string>,
): readonly ProjectGitEntry[] | ProjectGitFailure {
  const tokens = nulFields(output);
  const entries: ProjectGitEntry[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined || token.length < 4) continue;
    const indexState = String.fromCharCode(token[0] ?? 32);
    const worktreeState = String.fromCharCode(token[1] ?? 32);
    const path = decodeGitPath(token.subarray(3));
    if (path === null) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.filenameEncodingUnsupported,
        "$git.status",
        "Contained Git refuses filenames that cannot round-trip losslessly as UTF-8.",
      );
    }
    let sourcePath: string | undefined;
    if (indexState === "R" || indexState === "C" || worktreeState === "R" || worktreeState === "C") {
      index += 1;
      const source = tokens[index];
      if (source === undefined) {
        return failure(
          PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
          "$git.status",
          "Git reported an incomplete rename or copy path.",
        );
      }
      sourcePath = decodeGitPath(source) ?? undefined;
      if (sourcePath === undefined) {
        return failure(
          PROJECT_GIT_DIAGNOSTICS.filenameEncodingUnsupported,
          "$git.status",
          "Contained Git refuses filenames that cannot round-trip losslessly as UTF-8.",
        );
      }
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
  objectDirectory: string;
  projectId: string;
  canonicalFiles: readonly string[];
  excludedPaths: ReadonlySet<string>;
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
  diagnosticPath = "$git.refs",
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
            diagnosticPath,
            "Contained Git refuses repository metadata nodes with an unsafe type or indirection.",
          );
        }
        if (entry.isDirectory()) pending.push(path);
      }
    }
    return null;
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      diagnosticPath,
      "Contained Git could not verify repository metadata.",
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
    ["AUTO_MERGE", "file", false],
    ["BISECT_LOG", "file", false],
    ["BISECT_NAMES", "file", false],
    ["BISECT_START", "file", false],
    ["CHERRY_PICK_HEAD", "file", false],
    ["FETCH_HEAD", "file", false],
    ["MERGE_HEAD", "file", false],
    ["MERGE_MODE", "file", false],
    ["MERGE_MSG", "file", false],
    ["ORIG_HEAD", "file", false],
    ["REBASE_HEAD", "file", false],
    ["REVERT_HEAD", "file", false],
    ["SQUASH_MSG", "file", false],
    ["packed-refs", "file", false],
    ["shallow", "file", false],
    ["objects", "directory", true],
    ["objects/info", "directory", false],
    ["objects/info/alternates", "file", false],
    ["objects/info/commit-graph", "file", false],
    ["objects/info/commit-graphs", "directory", false],
    ["objects/info/http-alternates", "file", false],
    ["objects/pack", "directory", false],
    ["info", "directory", false],
    ["info/exclude", "file", false],
    ["info/attributes", "file", false],
    ["info/sparse-checkout", "file", false],
    ["info/grafts", "file", false],
    ["refs", "directory", true],
    ["rebase-apply", "directory", false],
    ["rebase-merge", "directory", false],
    ["sequencer", "directory", false],
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
  for (const name of ["rebase-apply", "rebase-merge", "sequencer"] as const) {
    if (!existsSync(resolve(gitDirectory, name))) continue;
    const invalid = validateGitRefTree(
      root,
      resolve(gitDirectory, name),
      `$git.${name}`,
    );
    if (invalid !== null) return invalid;
  }
  try {
    const splitIndex = readdirSync(gitDirectory, { withFileTypes: true })
      .find((entry) => entry.name.startsWith("sharedindex."));
    if (splitIndex !== undefined) {
      return repositoryEscape(
        "$git.index",
        "Contained Git refuses split-index metadata and shared index indirection.",
      );
    }
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.directory",
      "Contained Git could not verify repository metadata entries.",
    );
  }
  const invalidPacks = validateGitFileDirectory(
    root,
    resolve(gitDirectory, "objects", "pack"),
    "$git.objects.pack",
  );
  if (invalidPacks !== null) return invalidPacks;
  const invalidCommitGraphs = validateGitFileDirectory(
    root,
    resolve(gitDirectory, "objects", "info", "commit-graphs"),
    "$git.objects.info.commit-graphs",
  );
  if (invalidCommitGraphs !== null) return invalidCommitGraphs;
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
  const pathValuedConfiguration = /^\s*(?:(?:core\.)?(?:excludesfile|attributesfile|worktree|hookspath|alternaterefscommand)|include(?:if\.[^.\s]+)*\.path)\s*(?:=|\s)/imu;
  if (pathValuedConfiguration.test(config)) {
    return repositoryEscape(
      "$git.config",
      "Contained Git refuses local configuration that redirects metadata, worktree, hooks, or alternate-ref commands.",
    );
  }
  return gitDirectory;
}

function refuseGitlinks(
  executable: string,
  root: string,
): ProjectGitFailure | null {
  const index = runGit(executable, root, ["ls-files", "--stage", "-z"]);
  if (index.timedOut) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.index",
      "Contained Git timed out while verifying repository index entries.",
    );
  }
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
  const entries = nulFields(index.stdoutBytes);
  for (const entry of entries) {
    const tab = entry.indexOf(9);
    if (tab < 0 || decodeGitPath(entry.subarray(tab + 1)) === null) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.filenameEncodingUnsupported,
        "$git.index",
        "Contained Git refuses filenames that cannot round-trip losslessly as UTF-8.",
      );
    }
  }
  if (entries.some((entry) => entry.subarray(0, 7).toString("ascii") === "160000 ")) {
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
  if (repository.timedOut) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$root",
      "Contained Git timed out while verifying the selected repository.",
    );
  }
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
  if (objectDirectory.includes(delimiter)) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryEscape,
      "$git.objects",
      "Contained Git refuses object-directory paths that cannot be represented as one alternate object store.",
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
  if (configuredFilters.timedOut) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.config",
      "Contained Git timed out while verifying repository filter configuration.",
    );
  }
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
    objectDirectory,
    projectId: manifest.projectId,
    canonicalFiles,
    excludedPaths: projectGitDesktopOwnerPaths.get(root) ?? new Set(),
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
  mode: number;
}>;

function captureGitIndex(ctx: Context): GitIndexSnapshot | ProjectGitFailure {
  try {
    if (!existsSync(ctx.indexPath)) {
      return Object.freeze({ existed: false, bytes: null, mode: 0o666 });
    }
    const stat = lstatSync(ctx.indexPath);
    if (!stat.isFile()) {
      return repositoryEscape("$git.index", "Contained Git requires the repository index to be a regular file.");
    }
    return Object.freeze({
      existed: true,
      bytes: readFileSync(ctx.indexPath),
      mode: stat.mode & 0o777,
    });
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.index",
      "Contained Git could not snapshot the repository index before staging.",
    );
  }
}

type TemporaryGitIndex = Readonly<{
  directory: string;
  path: string;
  objectDirectory: string;
}>;

function createTemporaryGitIndex(
  ctx: Context,
  snapshot: GitIndexSnapshot,
): TemporaryGitIndex | ProjectGitFailure {
  try {
    const directory = mkdtempSync(resolve(dirname(ctx.indexPath), ".sceneaxi-index-"));
    const path = resolve(directory, "index");
    const objectDirectory = resolve(directory, "objects");
    mkdirSync(objectDirectory);
    if (snapshot.existed) {
      if (snapshot.bytes === null) throw new Error("missing index snapshot");
      writeFileSync(path, snapshot.bytes, { mode: snapshot.mode });
    }
    return Object.freeze({ directory, path, objectDirectory });
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.index",
      "Contained Git could not create a project-contained temporary index.",
    );
  }
}

function syncDirectory(path: string): void {
  const directory = openSync(path, "r");
  try {
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
}

function publishGitObjects(ctx: Context, temporary: TemporaryGitIndex): boolean {
  const looseDirectoryPattern = /^[0-9a-f]{2}$/u;
  const looseObjectPattern = /^[0-9a-f]{38}$/u;
  try {
    if (
      !lstatSync(ctx.objectDirectory).isDirectory() ||
      canonicalPath(ctx.objectDirectory) !== ctx.objectDirectory ||
      !within(ctx.root, ctx.objectDirectory)
    ) return false;
    for (const directoryEntry of readdirSync(temporary.objectDirectory, { withFileTypes: true })) {
      if (!directoryEntry.isDirectory() || !looseDirectoryPattern.test(directoryEntry.name)) {
        return false;
      }
      const sourceDirectory = resolve(temporary.objectDirectory, directoryEntry.name);
      const targetDirectory = resolve(ctx.objectDirectory, directoryEntry.name);
      if (!existsSync(targetDirectory)) mkdirSync(targetDirectory);
      if (!lstatSync(targetDirectory).isDirectory()) return false;
      for (const objectEntry of readdirSync(sourceDirectory, { withFileTypes: true })) {
        if (!objectEntry.isFile() || !looseObjectPattern.test(objectEntry.name)) return false;
        const source = resolve(sourceDirectory, objectEntry.name);
        const target = resolve(targetDirectory, objectEntry.name);
        try {
          linkSync(source, target);
        } catch (error) {
          const code = error instanceof Error && "code" in error
            ? (error as NodeJS.ErrnoException).code
            : undefined;
          if (code !== "EEXIST" || !readFileSync(source).equals(readFileSync(target))) {
            return false;
          }
        }
      }
      syncDirectory(targetDirectory);
    }
    syncDirectory(ctx.objectDirectory);
    return true;
  } catch {
    return false;
  }
}

type SelectedPathKind = "file" | "symlink" | "missing";
type SelectedPathSnapshot = Readonly<{
  kind: SelectedPathKind;
  bytes: Buffer | null;
}>;

function selectedPathSnapshots(
  root: string,
  selection: readonly string[],
  entries: readonly ProjectGitEntry[],
): ReadonlyMap<string, SelectedPathSnapshot> | ProjectGitFailure {
  const snapshots = new Map<string, SelectedPathSnapshot>();
  let byteLength = 0;
  for (const path of selection) {
    const candidate = resolve(root, ...path.split("/"));
    try {
      const stat = lstatSync(candidate);
      if (stat.isDirectory() || (!stat.isFile() && !stat.isSymbolicLink())) {
        return failure(
          PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
          path,
          "Every selected Git path must remain the same concrete file type reported by shared evidence.",
        );
      }
      const kind = stat.isSymbolicLink() ? "symlink" : "file";
      const bytes = kind === "symlink"
        ? readlinkSync(candidate, { encoding: "buffer" })
        : readFileSync(candidate);
      byteLength += bytes.byteLength;
      if (byteLength > PROJECT_GIT_EVIDENCE_MAX_BYTES) {
        return failure(
          PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge,
          path,
          "The exact selected-file evidence exceeds the shared local-client response limit.",
        );
      }
      snapshots.set(path, Object.freeze({ kind, bytes }));
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      const deletion = entries.some((entry) =>
        (entry.path === path && entry.worktree === "D") || entry.sourcePath === path,
      );
      if (code !== "ENOENT" || !deletion) {
        return failure(
          PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
          path,
          "Every selected Git path must remain the same concrete file type reported by shared evidence.",
        );
      }
      snapshots.set(path, Object.freeze({ kind: "missing", bytes: null }));
    }
  }
  return snapshots;
}

function currentPathKind(path: string): SelectedPathKind | "unsupported" {
  try {
    const stat = lstatSync(path);
    if (stat.isFile()) return "file";
    if (stat.isSymbolicLink()) return "symlink";
    return "unsupported";
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    return code === "ENOENT" ? "missing" : "unsupported";
  }
}

function indexEvidence(entries: readonly ProjectGitEntry[]): ReadonlyMap<string, string> {
  const evidence = new Map<string, string>();
  for (const entry of entries) {
    const signature = `${entry.index}\0${entry.path}\0${entry.sourcePath ?? ""}`;
    evidence.set(entry.path, signature);
    if (entry.sourcePath !== undefined) evidence.set(entry.sourcePath, signature);
  }
  return evidence;
}

function prospectiveSelectionFailure(
  ctx: Context,
  processState: GitProcessState,
  selection: readonly string[],
  snapshots: ReadonlyMap<string, SelectedPathSnapshot>,
  before: ProjectGitRepositoryState,
  prospective: ProjectGitRepositoryState,
): ProjectGitFailure | null {
  const selected = new Set(selection);
  for (const [path, snapshot] of snapshots) {
    const candidate = resolve(ctx.root, ...path.split("/"));
    if (currentPathKind(candidate) !== snapshot.kind) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
        path,
        "A selected path changed file type after shared repository evidence was captured.",
      );
    }
    if (snapshot.bytes !== null) {
      const currentBytes = snapshot.kind === "symlink"
        ? readlinkSync(candidate, { encoding: "buffer" })
        : readFileSync(candidate);
      if (!currentBytes.equals(snapshot.bytes)) {
        return failure(
          PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
          path,
          "A selected path changed bytes after shared repository evidence was captured.",
        );
      }
    }
  }
  const beforeIndex = indexEvidence(before.entries);
  const nextIndex = indexEvidence(prospective.entries);
  const allPaths = new Set([...beforeIndex.keys(), ...nextIndex.keys()]);
  for (const path of allPaths) {
    if (!selected.has(path) && beforeIndex.get(path) !== nextIndex.get(path)) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
        path,
        "Prospective staging changed an index path outside the exact selected evidence.",
      );
    }
  }
  const stagedPaths = new Set(
    prospective.entries
      .filter((entry) => entry.index !== " " && entry.index !== "?")
      .flatMap(entryPaths),
  );
  for (const path of selection) {
    if (!stagedPaths.has(path)) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
        path,
        "Prospective staging did not preserve the exact selected path set.",
      );
    }
    const snapshot = snapshots.get(path);
    if (snapshot === undefined || snapshot.bytes === null) continue;
    const listed = runGit(ctx.executable, ctx.root, [
      "--literal-pathspecs", "ls-files", "--stage", "-z", "--", path,
    ], processState);
    if (listed.overflow) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge,
        path,
        "Prospective selected-file evidence exceeds the shared local-client response limit.",
      );
    }
    const fields = nulFields(listed.stdoutBytes).filter((field) => field.length > 0);
    if (!listed.ok || fields.length !== 1) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
        path,
        "Prospective staging did not produce one exact index entry for the selected path.",
      );
    }
    const tab = fields[0]?.indexOf(9) ?? -1;
    const header = tab < 0 ? "" : fields[0]?.subarray(0, tab).toString("ascii") ?? "";
    const objectId = header.split(" ")[1];
    const listedPath = tab < 0 ? null : decodeGitPath(fields[0]?.subarray(tab + 1) ?? Buffer.alloc(0));
    if (objectId === undefined || !/^[0-9a-f]{40,64}$/u.test(objectId) || listedPath !== path) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
        path,
        "Prospective staging did not bind the selected path to one exact Git object.",
      );
    }
    const object = runGit(ctx.executable, ctx.root, ["cat-file", "blob", objectId], processState);
    if (object.overflow) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge,
        path,
        "Prospective selected-file evidence exceeds the shared local-client response limit.",
      );
    }
    if (!object.ok || !object.stdoutBytes.equals(snapshot.bytes)) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.selectionMismatch,
        path,
        "The prospective Git object differs from the captured selected-file evidence.",
      );
    }
  }
  return null;
}

function removeTemporaryGitIndex(temporary: TemporaryGitIndex): boolean {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      rmSync(temporary.directory, { recursive: true, force: false });
      return !existsSync(temporary.directory);
    } catch {
      if (!existsSync(temporary.directory)) return true;
    }
  }
  return false;
}

function currentIndexMatches(ctx: Context, snapshot: GitIndexSnapshot): boolean {
  if (!existsSync(ctx.indexPath)) return !snapshot.existed;
  if (!snapshot.existed || snapshot.bytes === null || !lstatSync(ctx.indexPath).isFile()) {
    return false;
  }
  return readFileSync(ctx.indexPath).equals(snapshot.bytes);
}

function syncIndexDirectory(ctx: Context): void {
  syncDirectory(dirname(ctx.indexPath));
}

type IndexPublishResult = Readonly<{ published: boolean; safe: boolean }>;

function publishGitIndex(
  ctx: Context,
  original: GitIndexSnapshot,
  nextBytes: Buffer,
): IndexPublishResult {
  const lockPath = `${ctx.indexPath}.lock`;
  let lock: number | undefined;
  let ownsLock = false;
  let published = false;
  try {
    lock = openSync(lockPath, "wx", original.mode);
    ownsLock = true;
    if (!currentIndexMatches(ctx, original)) {
      closeSync(lock);
      lock = undefined;
      unlinkSync(lockPath);
      ownsLock = false;
      return Object.freeze({ published: false, safe: true });
    }
    writeFileSync(lock, nextBytes);
    fsyncSync(lock);
    closeSync(lock);
    lock = undefined;
    renameSync(lockPath, ctx.indexPath);
    ownsLock = false;
    published = true;
    syncIndexDirectory(ctx);
    return Object.freeze({ published: true, safe: true });
  } catch {
    try {
      if (lock !== undefined) closeSync(lock);
      if (ownsLock && existsSync(lockPath)) unlinkSync(lockPath);
    } catch {
      return Object.freeze({ published, safe: false });
    }
    return Object.freeze({ published, safe: !published });
  }
}

function rollbackPublishedGitIndex(
  ctx: Context,
  original: GitIndexSnapshot,
  publishedBytes: Buffer,
): boolean {
  const lockPath = `${ctx.indexPath}.lock`;
  let lock: number | undefined;
  let ownsLock = false;
  try {
    lock = openSync(lockPath, "wx", original.mode);
    ownsLock = true;
    const publishedSnapshot: GitIndexSnapshot = Object.freeze({
      existed: true,
      bytes: publishedBytes,
      mode: original.mode,
    });
    if (!currentIndexMatches(ctx, publishedSnapshot)) {
      closeSync(lock);
      lock = undefined;
      unlinkSync(lockPath);
      ownsLock = false;
      return false;
    }
    if (original.existed) {
      if (original.bytes === null) throw new Error("missing original index bytes");
      writeFileSync(lock, original.bytes);
      fsyncSync(lock);
      closeSync(lock);
      lock = undefined;
      renameSync(lockPath, ctx.indexPath);
      ownsLock = false;
    } else {
      closeSync(lock);
      lock = undefined;
      unlinkSync(ctx.indexPath);
      unlinkSync(lockPath);
      ownsLock = false;
    }
    syncIndexDirectory(ctx);
    return currentIndexMatches(ctx, original);
  } catch {
    try {
      if (lock !== undefined) closeSync(lock);
      if (ownsLock && existsSync(lockPath)) unlinkSync(lockPath);
    } catch {
      return false;
    }
    return false;
  }
}

function stageRolledBack(message: string): ProjectGitFailure {
  return failure(
    PROJECT_GIT_DIAGNOSTICS.stageRolledBack,
    "$git.index",
    message,
  );
}

function stageRollbackFailed(message: string): ProjectGitFailure {
  return failure(
    PROJECT_GIT_DIAGNOSTICS.stageRollbackFailed,
    "$git.index",
    message,
  );
}

function releaseMutationGuard(guard: MutationGuard): readonly string[] {
  try {
    const failures = endApplyJournalTransactionChecked(guard.lockSet);
    if (failures.length === 0) pendingMutationCleanups.delete(guard.root);
    else pendingMutationCleanups.set(guard.root, guard.lockSet);
    return failures;
  } catch {
    pendingMutationCleanups.set(guard.root, guard.lockSet);
    return Object.freeze(["$authoring.lock"]);
  }
}

function repositoryState(
  ctx: Context,
  excludedPaths: ReadonlySet<string> = new Set(),
  processState: GitProcessState = {},
): ProjectGitStateResult {
  const allExcludedPaths = new Set([...ctx.excludedPaths, ...excludedPaths]);
  const status = runGit(ctx.executable, ctx.root, [
    "-c", "core.quotepath=false",
    "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ".",
  ], processState);
  const working = runGit(ctx.executable, ctx.root, [
    "-c", "core.quotepath=false",
    "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--full-index", "--no-color", "--binary", "--src-prefix=a/", "--dst-prefix=b/", "--", ".",
  ], processState);
  const staged = runGit(ctx.executable, ctx.root, [
    "-c", "core.quotepath=false",
    "diff", "--cached", "--no-ext-diff", "--no-textconv", "--no-renames", "--full-index", "--no-color", "--binary", "--src-prefix=a/", "--dst-prefix=b/", "--", ".",
  ], processState);
  if (status.timedOut || working.timedOut || staged.timedOut) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$root",
      "Contained Git timed out while producing project status and diff evidence.",
    );
  }
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
  const branchResult = runGit(ctx.executable, ctx.root, ["symbolic-ref", "--quiet", "--short", "HEAD"], processState);
  const headResult = runGit(ctx.executable, ctx.root, ["rev-parse", "--verify", "HEAD"], processState);
  if (branchResult.timedOut || headResult.timedOut) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.HEAD",
      "Contained Git timed out while verifying the repository branch and head.",
    );
  }
  const canonical = new Set(ctx.canonicalFiles);
  const entries = parseStatus(status.stdoutBytes, canonical, allExcludedPaths);
  if ("diagnostic" in entries) return entries;
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
  let mutationAttempted = false;
  let publishedIndex: Readonly<{
    original: GitIndexSnapshot;
    bytes: Buffer;
  }> | undefined;
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
        const pathSnapshots = selectedPathSnapshots(prepared.root, selection, before.state.entries);
        if ("diagnostic" in pathSnapshots) {
          result = pathSnapshots;
        } else {
          const captured = captureGitIndex(prepared);
          if ("diagnostic" in captured) {
            result = captured;
          } else {
            const temporary = createTemporaryGitIndex(prepared, captured);
            if ("diagnostic" in temporary) {
              result = temporary;
            } else {
              mutationAttempted = true;
              const temporaryProcess = Object.freeze({
                indexPath: temporary.path,
                objectDirectory: temporary.objectDirectory,
                alternateObjectDirectories: Object.freeze([prepared.objectDirectory]),
              });
              const staged = runGit(
                prepared.executable,
                prepared.root,
                ["--literal-pathspecs", "add", "-A", "--", ...pathsToStage],
                temporaryProcess,
              );
              if (!staged.ok) {
                result = removeTemporaryGitIndex(temporary)
                  ? stageRolledBack(staged.timedOut
                      ? "Git staging timed out; temporary index and objects were removed without changing live repository state."
                      : "Git refused the selected-path staging operation; temporary index and objects were removed without changing live repository state.")
                  : stageRollbackFailed("Git refused staging and its temporary index or objects could not be removed.");
              } else {
                const prospective = repositoryState(
                  prepared,
                  guard.excludedPaths,
                  temporaryProcess,
                );
                let prospectiveBytes: Buffer | undefined;
                try {
                  prospectiveBytes = readFileSync(temporary.path);
                } catch {
                  prospectiveBytes = undefined;
                }
                if (!prospective.ok) {
                  const temporaryRemoved = removeTemporaryGitIndex(temporary);
                  result = !temporaryRemoved
                    ? stageRollbackFailed(
                        "Prospective staging was refused and its temporary index or objects could not be removed.",
                      )
                    : prospective.diagnostic.code === PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge
                      ? prospective
                      : stageRolledBack(
                          `Prospective staging was refused by ${prospective.diagnostic.code}; temporary index and objects were removed without changing live repository state.`,
                        );
                } else if (prospectiveBytes === undefined) {
                  result = removeTemporaryGitIndex(temporary)
                    ? stageRolledBack(
                        "The prospective index disappeared before publication; temporary objects were removed without changing live repository state.",
                      )
                    : stageRollbackFailed(
                        "The prospective index disappeared and its temporary objects could not be removed.",
                      );
                } else {
                  const selectionFailure = prospectiveSelectionFailure(
                    prepared,
                    temporaryProcess,
                    selection,
                    pathSnapshots,
                    before.state,
                    prospective.state,
                  );
                  if (selectionFailure !== null) {
                    result = removeTemporaryGitIndex(temporary)
                      ? selectionFailure
                      : stageRollbackFailed(
                          "The prospective selection no longer matched shared evidence and its temporary state could not be removed.",
                        );
                  } else if (!publishGitObjects(prepared, temporary)) {
                    const removed = removeTemporaryGitIndex(temporary);
                    result = stageRollbackFailed(removed
                      ? "Validated Git objects could not be published completely; the live index was not changed."
                      : "Validated Git objects could not be published completely and temporary state could not be removed; the live index was not changed.");
                  } else {
                    const temporaryRemoved = removeTemporaryGitIndex(temporary);
                    if (!temporaryRemoved) {
                      result = stageRollbackFailed(
                        "Validated Git objects were published, but temporary staging state could not be removed; the live index was not changed.",
                      );
                    } else {
                      const published = publishGitIndex(prepared, captured, prospectiveBytes);
                      if (!published.published) {
                        result = published.safe
                          ? stageRolledBack(
                              "The live index changed concurrently or was locked; validated objects may remain unreachable, but the live index was not changed.",
                            )
                          : stageRollbackFailed(
                              "Contained Git could not safely publish or discard the prospective index after object publication.",
                            );
                      } else if (!published.safe) {
                        result = rollbackPublishedGitIndex(prepared, captured, prospectiveBytes)
                          ? stageRolledBack(
                              "Publishing the prospective index failed durably; the exact prior index was restored and validated objects may remain unreachable.",
                            )
                          : stageRollbackFailed(
                              "Publishing the prospective index failed and the exact prior index could not be verified as restored.",
                            );
                      } else {
                        publishedIndex = Object.freeze({ original: captured, bytes: prospectiveBytes });
                        result = prospective;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  const releaseFailures = releaseMutationGuard(guard);
  if (releaseFailures.length > 0) {
    if (publishedIndex !== undefined) {
      return rollbackPublishedGitIndex(
        prepared,
        publishedIndex.original,
        publishedIndex.bytes,
      )
        ? stageRolledBack(
            "The authoring operation lock could not be released; the exact prior index was restored.",
          )
        : stageRollbackFailed(
            "The authoring operation lock could not be released and the exact prior index could not be verified as restored.",
          );
    }
    return mutationAttempted
      ? stageRollbackFailed(
          "Prospective staging did not publish, but the authoring operation lock could not be released cleanly.",
        )
      : failure(
          PROJECT_GIT_DIAGNOSTICS.transactionDirty,
          ".sceneaxi-authoring-operation",
          "The authoring operation lock could not be released.",
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
