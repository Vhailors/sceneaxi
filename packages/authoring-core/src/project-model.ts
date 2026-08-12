/** Node host for the SceneAxi-native versioned project manifest. */
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import {
  PROJECT_MANIFEST_DIAGNOSTICS,
  PROJECT_MANIFEST_PATH,
  PROJECT_MIGRATION_ID,
  createProjectManifest,
  parseDocumentText,
  parseProjectManifestText,
  projectManifestDigest,
  projectVersionCapabilityResult,
  serializeProjectManifest,
  type ProjectManifest,
  type ProjectManifestDiagnostic,
  type ProjectManifestDiagnosticCode,
  type ProjectVersionCapabilityResult,
  type SceneDocument,
} from "@sceneaxi/schemas";
import {
  atomicWriteAll,
  atomicWriteFile,
  canonicalPath,
  type AtomicWriteLockSet,
} from "./atomic-write.js";
import {
  beginApplyJournalTransaction,
  endApplyJournalTransactionChecked,
} from "./apply-journal.js";
import { contentHash } from "./content-hash.js";

export const PROJECT_MIGRATION_PROPOSAL_PATH =
  ".sceneaxi/project-migration-proposal.json" as const;
export const PROJECT_MIGRATION_JOURNAL_PATH =
  ".sceneaxi/project-migration-journal.json" as const;
export const PROJECT_MIGRATION_EVIDENCE_PATH =
  ".sceneaxi/project-migration-evidence.json" as const;

export type ProjectMigrationProposal = Readonly<{
  schemaVersion: 1;
  kind: "sceneaxi.project-migration-proposal";
  migrationId: typeof PROJECT_MIGRATION_ID;
  sourceDigest: string;
  targetManifest: ProjectManifest;
  targetDigest: string;
  proposalDigest: string;
}>;

export type ProjectMigrationEvidence = Readonly<{
  schemaVersion: 1;
  kind: "sceneaxi.project-migration-evidence";
  migrationId: typeof PROJECT_MIGRATION_ID;
  sourceDigest: string;
  targetDigest: string;
  proposalDigest: string;
  result: "committed";
}>;

export type ProjectModelFailure = Readonly<{
  ok: false;
  diagnostic: ProjectManifestDiagnostic;
}>;

export type ProjectInspectionResult =
  | Readonly<{
      ok: true;
      inspection: ProjectVersionCapabilityResult;
      document: SceneDocument;
      documentBytes: string;
      manifest: ProjectManifest | null;
    }>
  | ProjectModelFailure;

export type ProjectMigrationProposalResult =
  | Readonly<{ ok: true; proposal: ProjectMigrationProposal; replayed: boolean }>
  | ProjectModelFailure;

export type ProjectMigrationCommitResult =
  | Readonly<{
      ok: true;
      inspection: ProjectVersionCapabilityResult;
      evidence: ProjectMigrationEvidence;
      recovered: boolean;
    }>
  | ProjectModelFailure;

type MigrationJournal = Readonly<{
  schemaVersion: 1;
  kind: "sceneaxi.project-migration-journal";
  state: "prepared" | "completed";
  proposal: ProjectMigrationProposal;
}>;

function failure(
  code: ProjectManifestDiagnosticCode,
  path: string,
  message: string,
): ProjectModelFailure {
  return Object.freeze({
    ok: false as const,
    diagnostic: Object.freeze({ code, path, message }),
  });
}

function within(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function rootPath(root: string): string | ProjectModelFailure {
  try {
    const canonical = realpathSync(root);
    if (!lstatSync(canonical).isDirectory()) {
      return failure(PROJECT_MANIFEST_DIAGNOSTICS.canonicalPathEscape, "$root", "Project root is not a directory.");
    }
    return canonical;
  } catch {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.canonicalPathEscape, "$root", "Project root cannot be resolved.");
  }
}

function containedPath(root: string, projectPath: string, mustExist: boolean): string | ProjectModelFailure {
  const candidate = join(root, ...projectPath.split("/"));
  try {
    const canonical = mustExist ? realpathSync(candidate) : canonicalPath(candidate);
    if (!within(root, canonical)) {
      return failure(
        PROJECT_MANIFEST_DIAGNOSTICS.canonicalPathEscape,
        projectPath,
        "Project path resolves outside the canonical project root.",
      );
    }
    return canonical;
  } catch {
    return failure(
      PROJECT_MANIFEST_DIAGNOSTICS.canonicalPathEscape,
      projectPath,
      "Project path cannot be resolved inside the canonical project root.",
    );
  }
}

function readJson(path: string): unknown | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length &&
    [...keys].sort().every((key, index) => actual[index] === key);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function legacyAssets(document: SceneDocument):
  | readonly Readonly<{ sourceId: string; path: string; mediaType: string; digest: string }>[]
  | ProjectModelFailure {
  const assetManifest = document.data["assetManifest"];
  if (assetManifest === undefined) return Object.freeze([]);
  if (!record(assetManifest) || !Array.isArray(assetManifest["assets"])) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "$.document.data.assetManifest", "The legacy asset manifest is invalid.");
  }
  const assets = [];
  for (let index = 0; index < assetManifest["assets"].length; index += 1) {
    const entry = assetManifest["assets"][index];
    if (!record(entry) || typeof entry["assetId"] !== "string" ||
      typeof entry["relativePath"] !== "string" || typeof entry["mediaType"] !== "string" ||
      typeof entry["digest"] !== "string") {
      return failure(PROJECT_MANIFEST_DIAGNOSTICS.malformed, `$.document.data.assetManifest.assets[${index}]`, "A legacy asset identity is invalid.");
    }
    assets.push(Object.freeze({
      sourceId: entry["assetId"],
      path: entry["relativePath"],
      mediaType: entry["mediaType"],
      digest: entry["digest"],
    }));
  }
  return Object.freeze(assets);
}

export function inspectProjectModel(root: string): ProjectInspectionResult {
  const canonicalRoot = rootPath(root);
  if (typeof canonicalRoot !== "string") return canonicalRoot;
  const documentPath = containedPath(canonicalRoot, "scene.json", true);
  if (typeof documentPath !== "string") return documentPath;
  let documentBytes: string;
  try {
    if (!lstatSync(documentPath).isFile()) {
      return failure(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "scene.json", "The active Scene Document is not a regular file.");
    }
    documentBytes = readFileSync(documentPath, "utf8");
  } catch {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "scene.json", "The active Scene Document cannot be read.");
  }
  const parsedDocument = parseDocumentText(documentBytes);
  if (!parsedDocument.ok) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "scene.json", parsedDocument.message);
  }

  const manifestCandidate = join(canonicalRoot, PROJECT_MANIFEST_PATH);
  if (!existsSync(manifestCandidate)) {
    return Object.freeze({
      ok: true as const,
      inspection: projectVersionCapabilityResult(null),
      document: parsedDocument.document,
      documentBytes,
      manifest: null,
    });
  }
  const manifestPath = containedPath(canonicalRoot, PROJECT_MANIFEST_PATH, true);
  if (typeof manifestPath !== "string") return manifestPath;
  if (!lstatSync(manifestCandidate).isFile()) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.malformed, PROJECT_MANIFEST_PATH, "The project manifest is not a regular file.");
  }
  const parsedManifest = parseProjectManifestText(readFileSync(manifestPath, "utf8"));
  if (!parsedManifest.ok) return Object.freeze({ ok: false as const, diagnostic: parsedManifest.diagnostic });
  const documentObject = parsedManifest.manifest.objects.find((object) => object.path === "scene.json");
  if (documentObject?.sourceId !== parsedDocument.document.id) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.malformed, "$.objects", "The manifest scene identity does not match scene.json.");
  }
  for (const asset of parsedManifest.manifest.assets) {
    const assetPath = containedPath(canonicalRoot, asset.path, existsSync(join(canonicalRoot, ...asset.path.split("/"))));
    if (typeof assetPath !== "string") return assetPath;
  }
  return Object.freeze({
    ok: true as const,
    inspection: projectVersionCapabilityResult(parsedManifest.manifest),
    document: parsedDocument.document,
    documentBytes,
    manifest: parsedManifest.manifest,
  });
}

function proposalWithoutDigest(input: Readonly<{
  sourceDigest: string;
  targetManifest: ProjectManifest;
}>): Omit<ProjectMigrationProposal, "proposalDigest"> {
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.project-migration-proposal" as const,
    migrationId: PROJECT_MIGRATION_ID,
    sourceDigest: input.sourceDigest,
    targetManifest: input.targetManifest,
    targetDigest: projectManifestDigest(input.targetManifest),
  });
}

function buildProposal(document: SceneDocument, documentBytes: string): ProjectMigrationProposal | ProjectModelFailure {
  const assets = legacyAssets(document);
  if (!Array.isArray(assets)) return assets as ProjectModelFailure;
  const sourceDigest = contentHash(documentBytes);
  let targetManifest: ProjectManifest;
  try {
    targetManifest = createProjectManifest({
      document,
      assets: assets as readonly Readonly<{
        sourceId: string;
        path: string;
        mediaType: string;
        digest: string;
      }>[],
      migrationSourceDigest: sourceDigest,
    });
  } catch (error) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.malformed, PROJECT_MANIFEST_PATH, error instanceof Error ? error.message : String(error));
  }
  const body = proposalWithoutDigest({ sourceDigest, targetManifest });
  return Object.freeze({ ...body, proposalDigest: contentHash(`${JSON.stringify(body)}\n`) });
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseProposal(value: unknown): ProjectMigrationProposal | null {
  if (!record(value) || !exactKeys(value, [
    "schemaVersion", "kind", "migrationId", "sourceDigest", "targetManifest", "targetDigest", "proposalDigest",
  ]) || value["schemaVersion"] !== 1 || value["kind"] !== "sceneaxi.project-migration-proposal" ||
    value["migrationId"] !== PROJECT_MIGRATION_ID || typeof value["sourceDigest"] !== "string" ||
    typeof value["targetDigest"] !== "string" || typeof value["proposalDigest"] !== "string") return null;
  const manifest = parseProjectManifestText(JSON.stringify(value["targetManifest"]));
  if (!manifest.ok) return null;
  const body = proposalWithoutDigest({ sourceDigest: value["sourceDigest"], targetManifest: manifest.manifest });
  const expectedProposalDigest = contentHash(`${JSON.stringify(body)}\n`);
  if (value["targetDigest"] !== projectManifestDigest(manifest.manifest) || value["proposalDigest"] !== expectedProposalDigest) return null;
  return Object.freeze({ ...body, proposalDigest: expectedProposalDigest });
}

export function proposeProjectMigration(root: string): ProjectMigrationProposalResult {
  const inspected = inspectProjectModel(root);
  if (!inspected.ok) return inspected;
  if (inspected.manifest !== null) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict, PROJECT_MANIFEST_PATH, "The project is already on the native v1 format.");
  }
  const proposal = buildProposal(inspected.document, inspected.documentBytes);
  if (!("proposalDigest" in proposal)) return proposal;
  const canonicalRoot = rootPath(root);
  if (typeof canonicalRoot !== "string") return canonicalRoot;
  const path = containedPath(canonicalRoot, PROJECT_MIGRATION_PROPOSAL_PATH, false);
  if (typeof path !== "string") return path;
  if (existsSync(path)) {
    const existing = parseProposal(readJson(path));
    if (existing?.proposalDigest === proposal.proposalDigest) {
      return Object.freeze({ ok: true as const, proposal: existing, replayed: true });
    }
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict, PROJECT_MIGRATION_PROPOSAL_PATH, "A different migration proposal already exists.");
  }
  try {
    atomicWriteFile(path, serialize(proposal), { mustBeAbsent: true, token: `migration-proposal-${proposal.proposalDigest.slice(-16)}` });
  } catch (error) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.writeFailed, PROJECT_MIGRATION_PROPOSAL_PATH, error instanceof Error ? error.message : String(error));
  }
  return Object.freeze({ ok: true as const, proposal, replayed: false });
}

function evidenceFor(proposal: ProjectMigrationProposal): ProjectMigrationEvidence {
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.project-migration-evidence" as const,
    migrationId: PROJECT_MIGRATION_ID,
    sourceDigest: proposal.sourceDigest,
    targetDigest: proposal.targetDigest,
    proposalDigest: proposal.proposalDigest,
    result: "committed" as const,
  });
}

function parseJournal(value: unknown): MigrationJournal | null {
  if (!record(value) || !exactKeys(value, ["schemaVersion", "kind", "state", "proposal"]) ||
    value["schemaVersion"] !== 1 || value["kind"] !== "sceneaxi.project-migration-journal" ||
    (value["state"] !== "prepared" && value["state"] !== "completed")) return null;
  const proposal = parseProposal(value["proposal"]);
  return proposal === null ? null : Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.project-migration-journal" as const,
    state: value["state"],
    proposal,
  });
}

export function projectMigrationRecoveryPending(root: string): boolean {
  const canonicalRoot = rootPath(root);
  if (typeof canonicalRoot !== "string") return true;
  const candidate = join(canonicalRoot, ...PROJECT_MIGRATION_JOURNAL_PATH.split("/"));
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      candidate,
      constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
    );
    const initial = fstatSync(descriptor);
    if (!initial.isFile() || initial.size > 1024 * 1024) return true;
    const bytes = Buffer.alloc(initial.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (count === 0) return true;
      offset += count;
    }
    const final = fstatSync(descriptor);
    if (
      initial.dev !== final.dev || initial.ino !== final.ino || initial.mode !== final.mode ||
      initial.size !== final.size || initial.mtimeMs !== final.mtimeMs ||
      initial.ctimeMs !== final.ctimeMs
    ) return true;
    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString("utf8"));
    } catch {
      return true;
    }
    const journal = parseJournal(parsed);
    return journal === null || journal.state !== "completed";
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    return code !== "ENOENT";
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

const pendingMigrationOperationCleanups = new Map<string, AtomicWriteLockSet>();

function withMigrationOperation(
  root: string,
  operation: () => ProjectMigrationCommitResult,
): ProjectMigrationCommitResult {
  const pendingCleanup = pendingMigrationOperationCleanups.get(root);
  if (pendingCleanup !== undefined) {
    try {
      if (endApplyJournalTransactionChecked(pendingCleanup).length > 0) {
        return failure(
          PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict,
          ".sceneaxi-authoring-operation",
          "The previous migration operation lock still requires cleanup.",
        );
      }
      pendingMigrationOperationCleanups.delete(root);
    } catch {
      return failure(
        PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict,
        ".sceneaxi-authoring-operation",
        "The previous migration operation lock still requires cleanup.",
      );
    }
  }
  let lockSet: AtomicWriteLockSet;
  try {
    lockSet = beginApplyJournalTransaction(root, []);
  } catch {
    return failure(
      PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict,
      ".sceneaxi-authoring-operation",
      "Another authoring or migration operation owns the selected project root.",
    );
  }
  let result: ProjectMigrationCommitResult;
  try {
    result = operation();
  } catch (error) {
    result = failure(
      PROJECT_MANIFEST_DIAGNOSTICS.writeFailed,
      PROJECT_MIGRATION_JOURNAL_PATH,
      error instanceof Error ? error.message : String(error),
    );
  }
  try {
    if (endApplyJournalTransactionChecked(lockSet).length === 0) return result;
    pendingMigrationOperationCleanups.set(root, lockSet);
    return failure(
      PROJECT_MANIFEST_DIAGNOSTICS.writeFailed,
      ".sceneaxi-authoring-operation",
      "The migration operation lock could not be released cleanly.",
    );
  } catch {
    pendingMigrationOperationCleanups.set(root, lockSet);
    return failure(
      PROJECT_MANIFEST_DIAGNOSTICS.writeFailed,
      ".sceneaxi-authoring-operation",
      "The migration operation lock could not be released cleanly.",
    );
  }
}

function recoverLocked(
  canonicalRoot: string,
  expectedProposalDigest?: string,
): ProjectMigrationCommitResult {
  const journalPath = containedPath(canonicalRoot, PROJECT_MIGRATION_JOURNAL_PATH, true);
  if (typeof journalPath !== "string") {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.proposalRequired, PROJECT_MIGRATION_JOURNAL_PATH, "No prepared project migration exists.");
  }
  const journal = parseJournal(readJson(journalPath));
  if (journal === null) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.recoveryInvalid, PROJECT_MIGRATION_JOURNAL_PATH, "The project migration journal is invalid.");
  }
  if (expectedProposalDigest !== undefined && journal.proposal.proposalDigest !== expectedProposalDigest) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.approvalMismatch, PROJECT_MIGRATION_JOURNAL_PATH, "The prepared migration does not match the approved proposal digest.");
  }
  const documentPath = containedPath(canonicalRoot, "scene.json", true);
  if (typeof documentPath !== "string") return documentPath;
  if (contentHash(readFileSync(documentPath, "utf8")) !== journal.proposal.sourceDigest) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.sourceChanged, "scene.json", "The source Scene Document changed after migration review.");
  }
  const manifestPath = containedPath(canonicalRoot, PROJECT_MANIFEST_PATH, false);
  const evidencePath = containedPath(canonicalRoot, PROJECT_MIGRATION_EVIDENCE_PATH, false);
  if (typeof manifestPath !== "string") return manifestPath;
  if (typeof evidencePath !== "string") return evidencePath;
  const manifestBytes = serializeProjectManifest(journal.proposal.targetManifest);
  const evidence = evidenceFor(journal.proposal);
  const evidenceBytes = serialize(evidence);
  if (existsSync(manifestPath) && readFileSync(manifestPath, "utf8") !== manifestBytes) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict, PROJECT_MANIFEST_PATH, "A different native manifest occupies the migration target.");
  }
  if (existsSync(evidencePath) && readFileSync(evidencePath, "utf8") !== evidenceBytes) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.recoveryInvalid, PROJECT_MIGRATION_EVIDENCE_PATH, "Migration evidence does not match the prepared journal.");
  }
  try {
    const plans = [];
    if (!existsSync(manifestPath)) plans.push({ path: manifestPath, contents: manifestBytes, mustBeAbsent: true });
    if (!existsSync(evidencePath)) plans.push({ path: evidencePath, contents: evidenceBytes, mustBeAbsent: true });
    atomicWriteAll(plans, { token: `migration-commit-${journal.proposal.proposalDigest.slice(-16)}` });
    const completed: MigrationJournal = Object.freeze({ ...journal, state: "completed" as const });
    atomicWriteFile(journalPath, serialize(completed), { token: `migration-complete-${journal.proposal.proposalDigest.slice(-16)}` });
  } catch (error) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.writeFailed, PROJECT_MANIFEST_PATH, error instanceof Error ? error.message : String(error));
  }
  const inspected = inspectProjectModel(canonicalRoot);
  if (!inspected.ok) return inspected;
  return Object.freeze({ ok: true as const, inspection: inspected.inspection, evidence, recovered: journal.state === "prepared" });
}

export function commitProjectMigration(input: Readonly<{
  root: string;
  approved: boolean;
  proposalDigest: string;
}>): ProjectMigrationCommitResult {
  if (!input.approved) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.approvalRequired, PROJECT_MIGRATION_PROPOSAL_PATH, "Migration commit requires explicit review approval.");
  }
  const canonicalRoot = rootPath(input.root);
  if (typeof canonicalRoot !== "string") return canonicalRoot;
  return withMigrationOperation(canonicalRoot, () => commitProjectMigrationLocked(
    canonicalRoot,
    input.proposalDigest,
  ));
}

function commitProjectMigrationLocked(
  canonicalRoot: string,
  proposalDigest: string,
): ProjectMigrationCommitResult {
  const proposalPath = containedPath(canonicalRoot, PROJECT_MIGRATION_PROPOSAL_PATH, true);
  if (typeof proposalPath !== "string") {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.proposalRequired, PROJECT_MIGRATION_PROPOSAL_PATH, "A persisted migration proposal is required before commit.");
  }
  const proposal = parseProposal(readJson(proposalPath));
  if (proposal === null) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.proposalRequired, PROJECT_MIGRATION_PROPOSAL_PATH, "The persisted migration proposal is invalid.");
  }
  if (proposal.proposalDigest !== proposalDigest) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.approvalMismatch, PROJECT_MIGRATION_PROPOSAL_PATH, "Approval does not bind the reviewed proposal digest.");
  }
  const inspected = inspectProjectModel(canonicalRoot);
  if (!inspected.ok) return inspected;
  if (inspected.manifest !== null) {
    const journalPath = join(canonicalRoot, ...PROJECT_MIGRATION_JOURNAL_PATH.split("/"));
    if (existsSync(journalPath)) return recoverLocked(canonicalRoot, proposalDigest);
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict, PROJECT_MANIFEST_PATH, "The project is already native and has no matching recovery journal.");
  }
  const rebuilt = buildProposal(inspected.document, inspected.documentBytes);
  if (!("proposalDigest" in rebuilt) || rebuilt.proposalDigest !== proposal.proposalDigest) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.sourceChanged, "scene.json", "The source bytes no longer reproduce the reviewed migration proposal.");
  }
  const journalPath = containedPath(canonicalRoot, PROJECT_MIGRATION_JOURNAL_PATH, false);
  if (typeof journalPath !== "string") return journalPath;
  if (!existsSync(journalPath)) {
    const journal: MigrationJournal = Object.freeze({
      schemaVersion: 1,
      kind: "sceneaxi.project-migration-journal",
      state: "prepared",
      proposal,
    });
    try {
      atomicWriteFile(journalPath, serialize(journal), {
        mustBeAbsent: true,
        token: `migration-prepare-${proposal.proposalDigest.slice(-16)}`,
      });
    } catch (error) {
      return failure(PROJECT_MANIFEST_DIAGNOSTICS.writeFailed, PROJECT_MIGRATION_JOURNAL_PATH, error instanceof Error ? error.message : String(error));
    }
  }
  return recoverLocked(canonicalRoot, proposalDigest);
}

export function recoverProjectMigration(root: string): ProjectMigrationCommitResult {
  const canonicalRoot = rootPath(root);
  if (typeof canonicalRoot !== "string") return canonicalRoot;
  return withMigrationOperation(canonicalRoot, () => recoverLocked(canonicalRoot));
}

export function writeNativeProjectSeed(input: Readonly<{
  root: string;
  document: SceneDocument;
  documentBytes: string;
}>): ProjectModelFailure | Readonly<{ ok: true; manifest: ProjectManifest }> {
  const canonicalRoot = rootPath(input.root);
  if (typeof canonicalRoot !== "string") return canonicalRoot;
  const documentPath = containedPath(canonicalRoot, "scene.json", false);
  const manifestPath = containedPath(canonicalRoot, PROJECT_MANIFEST_PATH, false);
  if (typeof documentPath !== "string") return documentPath;
  if (typeof manifestPath !== "string") return manifestPath;
  const manifest = createProjectManifest({ document: input.document });
  try {
    atomicWriteAll([
      { path: documentPath, contents: input.documentBytes, mustBeAbsent: true },
      { path: manifestPath, contents: serializeProjectManifest(manifest), mustBeAbsent: true },
    ], { token: `project-new-${manifest.projectId}` });
  } catch (error) {
    return failure(PROJECT_MANIFEST_DIAGNOSTICS.writeFailed, "$", error instanceof Error ? error.message : String(error));
  }
  return Object.freeze({ ok: true as const, manifest });
}
