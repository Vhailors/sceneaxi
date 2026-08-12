/** Contained local Git inspection and preparation for one selected native project. */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { devNull } from "node:os";
import { TextDecoder } from "node:util";
import { delimiter, isAbsolute, relative, resolve, sep } from "node:path";
import {
  PROJECT_GIT_DIAGNOSTICS,
  PROJECT_GIT_EVIDENCE_MAX_BYTES,
  PROJECT_GIT_SCHEMA_VERSION,
  PROJECT_MANIFEST_PATH,
  parseProjectManifestText,
  type ProjectCapability,
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
  "credential",
  "history-rewrite",
  "branch-delete",
  "hook-bypass",
] as const);

export type ProjectGitOperation = (typeof PROJECT_GIT_OPERATIONS)[number];
export type ProjectGitUnsupportedOperation =
  (typeof PROJECT_GIT_UNSUPPORTED_OPERATIONS)[number];

export type ProjectGitOptions = Readonly<{
  root: string;
  profile?: "game" | "web" | "kids";
  /** Injectable only for deterministic missing-host tests. */
  gitExecutable?: string;
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
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

type GitProcessState = Readonly<{
  indexPath?: string;
  objectDirectory?: string;
  alternateObjectDirectories?: readonly string[];
  attributeSource?: string;
  input?: Buffer;
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
      ...(state.attributeSource === undefined ? {} : { GIT_ATTR_SOURCE: state.attributeSource }),
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
    input: state.input,
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
    const decoded = UTF8_DECODER.decode(bytes);
    return Buffer.from(decoded, "utf8").equals(Buffer.from(bytes)) ? decoded : null;
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
  objectIdLength: 40 | 64;
  attributeSource: string;
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

function validateGitObjectStore(root: string, directory: string): ProjectGitFailure | null {
  const looseDirectoryPattern = /^[0-9a-f]{2}$/u;
  try {
    for (const entry of readdirSync(directory)) {
      const path = resolve(directory, entry);
      const stat = lstatSync(path);
      if (
        stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) ||
        (looseDirectoryPattern.test(entry) && !stat.isDirectory()) ||
        !within(root, canonicalPath(path))
      ) {
        return repositoryEscape(
          "$git.objects",
          "Contained Git refuses object-store entries with an unsafe type or indirection.",
        );
      }
      if (looseDirectoryPattern.test(entry)) {
        for (const objectEntry of readdirSync(path)) {
          const objectPath = resolve(path, objectEntry);
          const objectStat = lstatSync(objectPath);
          if (
            objectStat.isSymbolicLink() || !objectStat.isFile() ||
            !within(root, canonicalPath(objectPath))
          ) {
            return repositoryEscape(
              "$git.objects",
              "Contained Git refuses loose-object entries with an unsafe type or indirection.",
            );
          }
        }
      }
    }
    return null;
  } catch {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.objects",
      "Contained Git could not verify immediate object-store entries.",
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
  const invalidObjects = validateGitObjectStore(root, resolve(gitDirectory, "objects"));
  if (invalidObjects !== null) return invalidObjects;
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
    "--show-object-format",
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
  let objectIdLength: 40 | 64;
  try {
    const reported = repository.stdout.trim().split("\n");
    if (reported.length !== 6 || reported.slice(0, 5).some((path) => !isAbsolute(path))) {
      throw new Error("incomplete repository paths");
    }
    repositoryPaths = reported.slice(0, 5).map((path) => canonicalPath(path));
    if (reported[5] === "sha1") {
      objectIdLength = 40;
    } else if (reported[5] === "sha256") {
      objectIdLength = 64;
    } else {
      throw new Error("unsupported object format");
    }
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
  const head = runGit(executable, root, ["rev-parse", "--verify", "HEAD"]);
  const trackedPaths = runGit(executable, root, ["ls-tree", "-r", "-z", "HEAD"]);
  if (!head.ok || !trackedPaths.ok || head.timedOut || trackedPaths.timedOut) {
    return failure(
      PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
      "$git.HEAD",
      "Contained Git could not establish a filter-inert repository attribute source.",
    );
  }
  for (const field of nulFields(trackedPaths.stdoutBytes)) {
    const tab = field.indexOf(9);
    const header = tab < 0 ? [] : field.subarray(0, tab).toString("ascii").split(" ");
    const path = tab < 0 ? null : decodeGitPath(field.subarray(tab + 1));
    if (path === null || header.length !== 3) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
        "$git.attributes",
        "Contained Git could not validate repository attribute metadata.",
      );
    }
    if (path !== ".gitattributes" && !path.endsWith("/.gitattributes")) continue;
    const objectId = header[2];
    if (objectId === undefined || !/^[0-9a-f]+$/u.test(objectId)) {
      return failure(PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable, "$git.attributes", "Contained Git could not validate repository attribute metadata.");
    }
    const attributes = runGit(executable, root, ["cat-file", "blob", objectId]);
    if (!attributes.ok || attributes.overflow || /(?:^|\s)[-!]?filter(?:=|\s|$)/mu.test(attributes.stdout)) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.commandFailed,
        "$git.attributes",
        "Contained Git refuses repository-controlled filters before producing evidence.",
      );
    }
  }
  try {
    if (/(?:^|\s)[-!]?filter(?:=|\s|$)/mu.test(readFileSync(resolve(gitDirectory, "info", "attributes"), "utf8"))) {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.commandFailed,
        "$git.attributes",
        "Contained Git refuses repository-controlled attribute files before producing evidence.",
      );
    }
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    if (code !== "ENOENT") {
      return failure(
        PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable,
        "$git.attributes",
        "Contained Git could not verify repository attribute metadata.",
      );
    }
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
    objectIdLength,
    attributeSource: head.stdout.trim(),
    projectId: manifest.projectId,
    canonicalFiles,
    excludedPaths: new Set(),
  });
}

 function repositoryState(
  ctx: Context,
  excludedPaths: ReadonlySet<string> = new Set(),
  processState: GitProcessState = {},
): ProjectGitStateResult {
  const allExcludedPaths = new Set([...ctx.excludedPaths, ...excludedPaths]);
  const evidenceProcessState = Object.freeze({ ...processState, attributeSource: ctx.attributeSource });
  const status = runGit(ctx.executable, ctx.root, [
    "-c", "core.quotepath=false",
    "-c", "status.renames=true",
    "status", "--porcelain=v1", "-z", "--untracked-files=all", "--renames", "--", ".",
  ], evidenceProcessState);
  const working = runGit(ctx.executable, ctx.root, [
    "-c", "core.quotepath=false",
    "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--full-index", "--no-color", "--binary", "--src-prefix=a/", "--dst-prefix=b/", "--", ".",
  ], evidenceProcessState);
  const staged = runGit(ctx.executable, ctx.root, [
    "-c", "core.quotepath=false",
    "diff", "--cached", "--no-ext-diff", "--no-textconv", "--no-renames", "--full-index", "--no-color", "--binary", "--src-prefix=a/", "--dst-prefix=b/", "--", ".",
  ], evidenceProcessState);
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
