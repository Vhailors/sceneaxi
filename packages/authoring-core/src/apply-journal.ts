/**
 * Durable E1 apply journal.
 *
 * A `prepared` entry is persisted before canonical documents change. A
 * successful commit advances it to `completed`; undo restores the exact prior
 * bytes and advances it to `undone`.
 */

import {
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import type { ApplyDiagnostic } from "@sceneaxi/schemas";
import {
  AtomicWriteConflictError,
  AtomicWriteError,
  AtomicWriteLockError,
  acquireAtomicWriteLocks,
  atomicWriteAll,
  atomicWriteFile,
  canonicalPath,
  fileExists,
  releaseAtomicWriteLocks,
  verifyAtomicWritePreconditions,
  type AtomicWriteLockSet,
} from "./atomic-write.js";
import { contentHash } from "./content-hash.js";

export const APPLY_JOURNAL_SCHEMA_VERSION = 4 as const;
export const APPLY_JOURNAL_KIND = "sceneaxi.authoring-apply-journal" as const;

export type ApplyJournalDocument = {
  readonly documentPath: string;
  readonly beforeContent: string;
  readonly beforeContentHash: string;
  readonly afterContent: string;
  readonly afterContentHash: string;
};

export type ApplyJournalEntry = {
  readonly schemaVersion: typeof APPLY_JOURNAL_SCHEMA_VERSION;
  readonly kind: typeof APPLY_JOURNAL_KIND;
  readonly transactionId: string;
  readonly createdAt: string;
  readonly state: "prepared" | "completed" | "undoing" | "undone" | "aborted";
  readonly completedAt?: string;
  readonly completionOrder?: number;
  readonly documents: readonly ApplyJournalDocument[];
};

export type JournalOperationOk = {
  readonly ok: true;
  readonly transactionId: string;
  readonly documentPaths: readonly string[];
  readonly journalRecoveryPending?: true;
};

export type JournalOperationResult =
  | JournalOperationOk
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] };

export type RecoveryOperationOk = {
  readonly ok: true;
  readonly transactionIds: readonly string[];
  readonly documentPaths: readonly string[];
  readonly journalRecoveryPending?: true;
};

export type RecoveryOperationResult =
  | RecoveryOperationOk
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] };

export type ApplyTransactionState =
  | "pending"
  | "completed"
  | "aborted"
  | "undone"
  | "missing";

export type ApplyTransactionResolutionOk = {
  readonly ok: true;
  readonly transactionId: string;
  readonly state: ApplyTransactionState;
  readonly documentPaths: readonly string[];
};

export type ApplyTransactionResolutionResult =
  | ApplyTransactionResolutionOk
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] };

export function journalRecoveryPendingDiagnostics(): readonly ApplyDiagnostic[] {
  return [
    {
      code: "apply-in-progress",
      message:
        "Canonical documents are consistent, but journal finalization is pending.",
      reReadHint:
        "Resolve the journal storage error and complete recovery before another authoring operation.",
    },
  ];
}

const TRANSACTION_ID_RE = /^\d{13}-[0-9a-f]{16}$/;
const CANONICAL_JOURNAL_NAME_RE = /^\d{13}-[0-9a-f]{16}\.json$/;
const JOURNAL_KEYS = new Set([
  "schemaVersion",
  "kind",
  "transactionId",
  "createdAt",
  "state",
  "completedAt",
  "completionOrder",
  "documents",
]);
const JOURNAL_DOCUMENT_KEYS = new Set([
  "documentPath",
  "beforeContent",
  "beforeContentHash",
  "afterContent",
  "afterContentHash",
]);

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

function journalDirectory(cwd: string): string {
  return resolve(cwd, ".sceneaxi", "journal");
}

function journalPath(cwd: string, transactionId: string): string {
  return join(journalDirectory(cwd), `${transactionId}.json`);
}

function journalOperationResource(cwd: string): string {
  return join(journalDirectory(cwd), ".operation");
}

function activeJournalPath(cwd: string): string {
  return join(journalDirectory(cwd), ".active");
}

function completionSequencePath(cwd: string): string {
  return join(journalDirectory(cwd), ".completion-sequence");
}

type ApplyUndoCandidate = Readonly<{
  completionOrder: number;
  documents: readonly Readonly<{
    documentPath: string;
    afterContentHash: string;
  }>[];
}>;

let latestCompletedJournalCache:
  | Readonly<{
      directory: string;
      signature: string;
      entry: ApplyUndoCandidate | undefined;
    }>
  | undefined;

export function beginApplyJournalTransaction(
  cwd: string,
  absoluteDocumentPaths: readonly string[],
): AtomicWriteLockSet {
  return acquireAtomicWriteLocks([
    journalOperationResource(cwd),
    ...absoluteDocumentPaths,
  ]);
}

export function endApplyJournalTransaction(lockSet: AtomicWriteLockSet): void {
  releaseAtomicWriteLocks(lockSet);
}

function serializeJournal(entry: ApplyJournalEntry): string {
  return `${JSON.stringify(entry, null, 2)}\n`;
}

function writeJournal(cwd: string, entry: ApplyJournalEntry): void {
  atomicWriteFile(
    journalPath(cwd, entry.transactionId),
    serializeJournal(entry),
    { token: `journal-${entry.transactionId}` },
  );
  if (latestCompletedJournalCache?.directory === journalDirectory(cwd)) {
    latestCompletedJournalCache = undefined;
  }
}

function writeActiveJournal(cwd: string, entry: ApplyJournalEntry | null): void {
  atomicWriteFile(
    activeJournalPath(cwd),
    entry === null ? "null\n" : serializeJournal(entry),
    { token: "active-journal" },
  );
}

function parseJournal(text: string): ApplyJournalEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const state = String(raw["state"]);
  const isCompletedState =
    state === "completed" || state === "undoing" || state === "undone";
  const hasReservedOrder = state === "prepared" || isCompletedState;
  if (
    raw["schemaVersion"] !== APPLY_JOURNAL_SCHEMA_VERSION ||
    raw["kind"] !== APPLY_JOURNAL_KIND ||
    typeof raw["transactionId"] !== "string" ||
    !TRANSACTION_ID_RE.test(raw["transactionId"]) ||
    typeof raw["createdAt"] !== "string" ||
    !Number.isFinite(Date.parse(raw["createdAt"])) ||
    !["prepared", "completed", "undoing", "undone", "aborted"].includes(
      String(raw["state"]),
    ) ||
    !Array.isArray(raw["documents"]) ||
    raw["documents"].length === 0 ||
    (hasReservedOrder &&
      (!Number.isSafeInteger(raw["completionOrder"]) ||
        (raw["completionOrder"] as number) <= 0)) ||
    (!hasReservedOrder && Object.hasOwn(raw, "completionOrder")) ||
    (isCompletedState &&
      (typeof raw["completedAt"] !== "string" ||
        !Number.isFinite(Date.parse(raw["completedAt"])))) ||
    (!isCompletedState && Object.hasOwn(raw, "completedAt")) ||
    !hasOnlyKeys(raw, JOURNAL_KEYS)
  ) {
    return null;
  }

  const documents: ApplyJournalDocument[] = [];
  const documentPaths = new Set<string>();
  for (const value of raw["documents"]) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const document = value as Record<string, unknown>;
    if (
      typeof document["documentPath"] !== "string" ||
      document["documentPath"].length === 0 ||
      typeof document["beforeContent"] !== "string" ||
      typeof document["beforeContentHash"] !== "string" ||
      typeof document["afterContent"] !== "string" ||
      typeof document["afterContentHash"] !== "string" ||
      !hasOnlyKeys(document, JOURNAL_DOCUMENT_KEYS) ||
      documentPaths.has(document["documentPath"])
    ) {
      return null;
    }
    if (
      contentHash(document["beforeContent"]) !== document["beforeContentHash"] ||
      contentHash(document["afterContent"]) !== document["afterContentHash"]
    ) {
      return null;
    }
    documents.push({
      documentPath: document["documentPath"],
      beforeContent: document["beforeContent"],
      beforeContentHash: document["beforeContentHash"],
      afterContent: document["afterContent"],
      afterContentHash: document["afterContentHash"],
    });
    documentPaths.add(document["documentPath"]);
  }

  const base = {
    schemaVersion: APPLY_JOURNAL_SCHEMA_VERSION,
    kind: APPLY_JOURNAL_KIND,
    transactionId: raw["transactionId"],
    createdAt: raw["createdAt"],
    state: raw["state"] as ApplyJournalEntry["state"],
    documents,
  };
  if (isCompletedState) {
    return {
      ...base,
      completedAt: raw["completedAt"] as string,
      completionOrder: raw["completionOrder"] as number,
    };
  }
  return hasReservedOrder
    ? { ...base, completionOrder: raw["completionOrder"] as number }
    : base;
}

function readActiveJournal(
  cwd: string,
):
  | { readonly ok: true; readonly entry: ApplyJournalEntry | null }
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] } {
  const path = activeJournalPath(cwd);
  if (!fileExists(path)) return { ok: true, entry: null };
  const text = readFileSync(path, "utf8");
  if (text.trim() === "null") return { ok: true, entry: null };
  const entry = parseJournal(text);
  if (
    entry === null ||
    (entry.state !== "prepared" && entry.state !== "undoing")
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "journal-invalid",
          message: "The active apply journal is invalid or corrupt.",
        },
      ],
    };
  }
  return { ok: true, entry };
}

export function prepareApplyJournal(
  cwd: string,
  documents: readonly {
    readonly documentPath: string;
    readonly beforeContent: string;
    readonly afterContent: string;
  }[],
): ApplyJournalEntry {
  if (documents.length === 0) {
    throw new Error("Apply journal requires at least one document.");
  }
  const active = readActiveJournal(cwd);
  if (!active.ok || active.entry !== null) {
    throw new Error(
      active.ok
        ? "Another apply journal is already active."
        : (active.diagnostics[0]?.message ?? "Apply journal is invalid."),
    );
  }
  const transactionId = `${Date.now()}-${randomBytes(8).toString("hex")}`;
  const completionOrder = reserveCompletionOrder(cwd);
  const entry: ApplyJournalEntry = {
    schemaVersion: APPLY_JOURNAL_SCHEMA_VERSION,
    kind: APPLY_JOURNAL_KIND,
    transactionId,
    createdAt: new Date().toISOString(),
    state: "prepared",
    completionOrder,
    documents: documents.map((document) => ({
      documentPath: document.documentPath,
      beforeContent: document.beforeContent,
      beforeContentHash: contentHash(document.beforeContent),
      afterContent: document.afterContent,
      afterContentHash: contentHash(document.afterContent),
    })),
  };
  writeActiveJournal(cwd, entry);
  return entry;
}

export function completeApplyJournal(
  cwd: string,
  entry: ApplyJournalEntry,
): void {
  if (entry.completionOrder === undefined) {
    throw new Error("Apply journal completion order was not reserved.");
  }
  const completed = {
    ...entry,
    state: "completed" as const,
    completedAt: new Date().toISOString(),
  };
  writeJournal(cwd, completed);
  writeActiveJournal(cwd, null);
  cacheLatestCompletedJournal(cwd, completed);
}

function reserveCompletionOrder(cwd: string): number {
  const path = completionSequencePath(cwd);
  let current = 0;
  if (fileExists(path)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch {
      parsed = null;
    }
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      Object.keys(parsed).length !== 3 ||
      (parsed as Record<string, unknown>)["schemaVersion"] !== 1 ||
      (parsed as Record<string, unknown>)["kind"] !==
        "sceneaxi.authoring-completion-sequence" ||
      !Number.isSafeInteger((parsed as Record<string, unknown>)["value"]) ||
      ((parsed as Record<string, unknown>)["value"] as number) < 0
    ) {
      // Fall back to the journal scan below.
    } else {
      current = (parsed as Record<string, unknown>)["value"] as number;
    }
  }
  if (!fileExists(path) || current === 0) {
    const journals = readJournals(cwd);
    if (!journals.ok) {
      throw new Error(
        journals.diagnostics[0]?.message ?? "Apply journal is invalid.",
      );
    }
    current = Math.max(
      0,
      ...journals.entries.map((candidate) => candidate.completionOrder ?? 0),
    );
  }
  if (current >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Apply journal completion sequence is exhausted.");
  }
  const next = current + 1;
  atomicWriteFile(
    path,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        kind: "sceneaxi.authoring-completion-sequence",
        value: next,
      },
      null,
      2,
    )}\n`,
    { token: "completion-sequence" },
  );
  return next;
}

export function abortApplyJournal(
  cwd: string,
  entry: ApplyJournalEntry,
): void {
  writeJournal(cwd, {
    schemaVersion: entry.schemaVersion,
    kind: entry.kind,
    transactionId: entry.transactionId,
    createdAt: entry.createdAt,
    state: "aborted",
    documents: entry.documents,
  });
  writeActiveJournal(cwd, null);
}

function readJournals(
  cwd: string,
):
  | { readonly ok: true; readonly entries: readonly ApplyJournalEntry[] }
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] } {
  const dir = journalDirectory(cwd);
  if (!fileExists(dir)) return { ok: true, entries: [] };

  const entries: ApplyJournalEntry[] = [];
  const names = readdirSync(dir)
    .filter((entry) => CANONICAL_JOURNAL_NAME_RE.test(entry))
    .sort();
  for (const name of names) {
    const path = join(dir, name);
    const parsed = parseJournal(readFileSync(path, "utf8"));
    if (
      parsed === null ||
      `${parsed.transactionId}.json` !== name ||
      parsed.state === "prepared" ||
      parsed.state === "undoing"
    ) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "journal-invalid",
            message: `Apply journal is invalid or corrupt: ${name}`,
          },
        ],
      };
    }
    entries.push(parsed);
  }
  return { ok: true, entries };
}

export type ApplyUndoAvailability =
  | "available"
  | "unavailable"
  | "recovery-pending";

function latestCompletedJournal(
  entries: readonly ApplyJournalEntry[],
): ApplyJournalEntry | undefined {
  return entries
    .filter((entry) => entry.state === "completed")
    .sort(
      (a, b) => (b.completionOrder ?? 0) - (a.completionOrder ?? 0),
    )[0];
}

function applyUndoCandidate(
  entry: ApplyJournalEntry | undefined,
): ApplyUndoCandidate | undefined {
  if (entry?.completionOrder === undefined) return undefined;
  return Object.freeze({
    completionOrder: entry.completionOrder,
    documents: Object.freeze(
      entry.documents.map((document) =>
        Object.freeze({
          documentPath: document.documentPath,
          afterContentHash: document.afterContentHash,
        }),
      ),
    ),
  });
}

function journalFileSignature(cwd: string): string | undefined {
  const directory = journalDirectory(cwd);
  if (!fileExists(directory)) return undefined;
  return JSON.stringify(
    readdirSync(directory)
      .filter((name) => CANONICAL_JOURNAL_NAME_RE.test(name))
      .sort()
      .map((name) => {
        const stat = statSync(join(directory, name), { bigint: true });
        return [name, stat.mtimeNs.toString(), stat.size.toString()];
      }),
  );
}

function cacheLatestCompletedJournal(
  cwd: string,
  entry: ApplyJournalEntry | undefined,
  capturedSignature?: string,
): void {
  const directory = journalDirectory(cwd);
  let signature: string | undefined;
  try {
    signature = capturedSignature ?? journalFileSignature(cwd);
  } catch {
    signature = undefined;
  }
  if (signature === undefined) {
    if (latestCompletedJournalCache?.directory === directory) {
      latestCompletedJournalCache = undefined;
    }
    return;
  }
  latestCompletedJournalCache = Object.freeze({
    directory,
    signature,
    entry: applyUndoCandidate(entry),
  });
}

function readLatestCompletedJournal(
  cwd: string,
):
  | { readonly ok: true; readonly entry: ApplyUndoCandidate | undefined }
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] } {
  const directory = journalDirectory(cwd);
  const signature = journalFileSignature(cwd);
  if (signature === undefined) return { ok: true, entry: undefined };
  if (
    latestCompletedJournalCache?.directory === directory &&
    latestCompletedJournalCache.signature === signature
  ) {
    return { ok: true, entry: latestCompletedJournalCache.entry };
  }
  const journals = readJournals(cwd);
  if (!journals.ok) return journals;
  const entry = latestCompletedJournal(journals.entries);
  cacheLatestCompletedJournal(cwd, entry, signature);
  return { ok: true, entry: applyUndoCandidate(entry) };
}

export function applyUndoAvailability(
  input: { readonly cwd?: string } = {},
): ApplyUndoAvailability {
  try {
    const cwd = input.cwd ?? process.cwd();
    const active = readActiveJournal(cwd);
    if (!active.ok) return "unavailable";
    if (active.entry !== null) return "recovery-pending";
    const latestJournal = readLatestCompletedJournal(cwd);
    if (!latestJournal.ok) return "unavailable";
    const latest = latestJournal.entry;
    return latest !== undefined && latest.documents.every((document) => {
      const path = canonicalPath(resolve(cwd, document.documentPath));
      return (
        fileExists(path) &&
        contentHash(readFileSync(path, "utf8")) === document.afterContentHash
      );
    })
      ? "available"
      : "unavailable";
  } catch {
    return "unavailable";
  }
}

function recoverJournalEntry(
  cwd: string,
  entry: ApplyJournalEntry,
  target: "before" | "after",
  lockSet?: AtomicWriteLockSet,
): JournalOperationResult {
  const expectedHashes = new Map<string, string>();
  for (const document of entry.documents) {
    const absolutePath = canonicalPath(resolve(cwd, document.documentPath));
    if (!fileExists(absolutePath)) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "journal-conflict",
            message: `Cannot recover ${document.documentPath}: the canonical document is missing.`,
            documentPath: document.documentPath,
            reReadHint: `Restore or re-read ${document.documentPath}; recovery refused to guess its state.`,
          },
        ],
      };
    }
    const currentHash = contentHash(readFileSync(absolutePath, "utf8"));
    if (
      currentHash !== document.beforeContentHash &&
      currentHash !== document.afterContentHash
    ) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "journal-conflict",
            message: `Cannot recover ${document.documentPath}: current bytes match neither journal image.`,
            documentPath: document.documentPath,
            reReadHint: `Re-read ${document.documentPath}; recovery refused to overwrite newer content.`,
          },
        ],
      };
    }
    expectedHashes.set(document.documentPath, currentHash);
  }

  try {
    atomicWriteAll(
      entry.documents.map((document) => ({
        path: canonicalPath(resolve(cwd, document.documentPath)),
        contents:
          target === "after" ? document.afterContent : document.beforeContent,
        expectedContentHash: expectedHashes.get(document.documentPath) as string,
      })),
      {
        token: entry.transactionId,
        ...(lockSet === undefined ? {} : { lockSet }),
      },
    );
  } catch (error) {
    if (
      error instanceof AtomicWriteConflictError ||
      error instanceof AtomicWriteLockError ||
      error instanceof AtomicWriteError
    ) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "journal-conflict",
            message: `Cannot recover ${entry.transactionId}: canonical documents changed or are busy.`,
            reReadHint:
              "Re-read the affected documents after the active writer completes; recovery refused to overwrite them.",
          },
        ],
      };
    }
    throw error;
  }
  try {
    if (target === "after") {
      completeApplyJournal(cwd, entry);
    } else {
      writeJournal(cwd, { ...entry, state: "undone" });
      writeActiveJournal(cwd, null);
    }
  } catch {
    return {
      ok: true,
      transactionId: entry.transactionId,
      documentPaths: entry.documents.map((document) => document.documentPath),
      journalRecoveryPending: true,
    };
  }
  return {
    ok: true,
    transactionId: entry.transactionId,
    documentPaths: entry.documents.map((document) => document.documentPath),
  };
}

export function recoverPreparedApply(
  cwd: string,
  entry: ApplyJournalEntry,
  lockSet: AtomicWriteLockSet,
): JournalOperationResult {
  return recoverJournalEntry(cwd, entry, "after", lockSet);
}

function recoverIncompleteAppliesLocked(cwd: string): RecoveryOperationResult {
  const active = readActiveJournal(cwd);
  if (!active.ok) return active;
  if (active.entry === null) {
    return { ok: true, transactionIds: [], documentPaths: [] };
  }
  const recovered = recoverJournalEntry(
    cwd,
    active.entry,
    active.entry.state === "prepared" ? "after" : "before",
  );
  if (!recovered.ok) return recovered;
  return {
    ok: true,
    transactionIds: [recovered.transactionId],
    documentPaths: recovered.documentPaths,
    ...(recovered.journalRecoveryPending === true
      ? { journalRecoveryPending: true }
      : {}),
  };
}

function readApplyTransactionLocked(
  cwd: string,
  transactionId: string,
): ApplyTransactionResolutionResult {
  const active = readActiveJournal(cwd);
  if (!active.ok) return active;
  if (active.entry?.transactionId === transactionId) {
    return {
      ok: true,
      transactionId,
      state: "pending",
      documentPaths: active.entry.documents.map(
        (document) => document.documentPath,
      ),
    };
  }

  const path = journalPath(cwd, transactionId);
  if (!fileExists(path)) {
    return {
      ok: true,
      transactionId,
      state: "missing",
      documentPaths: [],
    };
  }
  const entry = parseJournal(readFileSync(path, "utf8"));
  if (
    entry === null ||
    entry.transactionId !== transactionId ||
    entry.state === "prepared" ||
    entry.state === "undoing"
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "journal-invalid",
          message: `Apply journal is invalid or corrupt: ${transactionId}.json`,
        },
      ],
    };
  }
  return {
    ok: true,
    transactionId,
    state: entry.state,
    documentPaths: entry.documents.map((document) => document.documentPath),
  };
}

export function resolveApplyTransaction(input: {
  readonly transactionId: string;
  readonly cwd?: string;
}): ApplyTransactionResolutionResult {
  if (!TRANSACTION_ID_RE.test(input.transactionId)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "journal-invalid",
          message: "The apply transaction ID is invalid.",
        },
      ],
    };
  }
  const cwd = canonicalPath(resolve(input.cwd ?? process.cwd()));
  if (!fileExists(journalDirectory(cwd))) {
    return {
      ok: true,
      transactionId: input.transactionId,
      state: "missing",
      documentPaths: [],
    };
  }
  let operationLock: AtomicWriteLockSet;
  try {
    operationLock = acquireAtomicWriteLocks([journalOperationResource(cwd)]);
  } catch (error) {
    if (error instanceof AtomicWriteLockError) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "apply-in-progress",
            message: "Another apply or journal operation is in progress.",
            reReadHint: "Retry after the active authoring operation completes.",
          },
        ],
      };
    }
    throw error;
  }
  try {
    const recovered = recoverIncompleteAppliesLocked(cwd);
    if (!recovered.ok) return recovered;
    return readApplyTransactionLocked(cwd, input.transactionId);
  } finally {
    releaseAtomicWriteLocks(operationLock);
  }
}

export function recoverIncompleteApplies(
  input: { readonly cwd?: string } = {},
): RecoveryOperationResult {
  const cwd = input.cwd ?? process.cwd();
  if (!fileExists(journalDirectory(cwd))) {
    return { ok: true, transactionIds: [], documentPaths: [] };
  }
  let operationLock: AtomicWriteLockSet;
  try {
    operationLock = acquireAtomicWriteLocks([journalOperationResource(cwd)]);
  } catch (error) {
    if (error instanceof AtomicWriteLockError) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "apply-in-progress",
            message: "Another apply or journal operation is in progress.",
            reReadHint: "Retry after the active authoring operation completes.",
          },
        ],
      };
    }
    throw error;
  }
  try {
    return recoverIncompleteAppliesLocked(cwd);
  } finally {
    releaseAtomicWriteLocks(operationLock);
  }
}

export function writeCanonicalDocument(input: {
  readonly cwd: string;
  readonly path: string;
  readonly contents: string;
  readonly expectedContentHash?: string;
  readonly mustBeAbsent?: boolean;
}):
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] } {
  let operationLock: AtomicWriteLockSet;
  try {
    operationLock = acquireAtomicWriteLocks([
      journalOperationResource(input.cwd),
    ]);
  } catch (error) {
    if (error instanceof AtomicWriteLockError) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "apply-in-progress",
            message: "Another apply or journal operation is in progress.",
            reReadHint: "Retry after the active authoring operation completes.",
          },
        ],
      };
    }
    throw error;
  }
  try {
    const recovered = recoverIncompleteAppliesLocked(input.cwd);
    if (!recovered.ok) return recovered;
    if (recovered.journalRecoveryPending === true) {
      return {
        ok: false,
        diagnostics: journalRecoveryPendingDiagnostics(),
      };
    }

    let documentLock: AtomicWriteLockSet;
    try {
      documentLock = acquireAtomicWriteLocks([input.path]);
    } catch (error) {
      if (error instanceof AtomicWriteLockError) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "apply-in-progress",
              message: "Another document write is in progress.",
              reReadHint: "Retry after the active authoring operation completes.",
            },
          ],
        };
      }
      throw error;
    }
    try {
      atomicWriteFile(input.path, input.contents, {
        ...(input.expectedContentHash === undefined
          ? {}
          : { expectedContentHash: input.expectedContentHash }),
        ...(input.mustBeAbsent === undefined
          ? {}
          : { mustBeAbsent: input.mustBeAbsent }),
        lockSet: documentLock,
      });
    } finally {
      releaseAtomicWriteLocks(documentLock);
    }
    return { ok: true };
  } finally {
    releaseAtomicWriteLocks(operationLock);
  }
}

/** Restore the exact prior bytes from the most recent completed apply. */
export function undoLastApply(
  input: { readonly cwd?: string } = {},
): JournalOperationResult {
  const cwd = input.cwd ?? process.cwd();
  if (!fileExists(journalDirectory(cwd))) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "journal-not-found",
          message: "No completed apply journal is available to undo.",
        },
      ],
    };
  }
  let operationLock: AtomicWriteLockSet;
  try {
    operationLock = acquireAtomicWriteLocks([journalOperationResource(cwd)]);
  } catch (error) {
    if (error instanceof AtomicWriteLockError) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "apply-in-progress",
            message: "Another apply or journal operation is in progress.",
            reReadHint: "Retry undo after the active authoring operation completes.",
          },
        ],
      };
    }
    throw error;
  }
  try {
    const recovered = recoverIncompleteAppliesLocked(cwd);
    if (!recovered.ok) return recovered;
    if (recovered.journalRecoveryPending === true) {
      return {
        ok: false,
        diagnostics: journalRecoveryPendingDiagnostics(),
      };
    }
    const journals = readJournals(cwd);
    if (!journals.ok) return journals;

    const latest = latestCompletedJournal(journals.entries);
    if (latest === undefined) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "journal-not-found",
            message: "No completed apply journal is available to undo.",
          },
        ],
      };
    }
    const nextLatest = latestCompletedJournal(
      journals.entries.filter(
        (entry) => entry.transactionId !== latest.transactionId,
      ),
    );

    const plans = latest.documents.map((document) => ({
      path: canonicalPath(resolve(cwd, document.documentPath)),
      contents: document.beforeContent,
      expectedContentHash: document.afterContentHash,
    }));
    let documentLocks: AtomicWriteLockSet;
    try {
      documentLocks = acquireAtomicWriteLocks(plans.map((plan) => plan.path));
    } catch (error) {
      if (error instanceof AtomicWriteLockError) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "journal-conflict",
              message:
                "Cannot undo the completed apply: canonical documents changed or are busy.",
              reReadHint:
                "Re-read the affected documents after the active writer completes; undo refused to overwrite them.",
            },
          ],
        };
      }
      throw error;
    }
    try {
      verifyAtomicWritePreconditions(plans, documentLocks);
    } catch (error) {
      releaseAtomicWriteLocks(documentLocks);
      if (
        error instanceof AtomicWriteConflictError ||
        error instanceof AtomicWriteLockError
      ) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "journal-conflict",
              message:
                "Cannot undo the completed apply: canonical documents changed or are busy.",
              reReadHint:
                "Re-read the affected documents after the active writer completes; undo refused to overwrite them.",
            },
          ],
        };
      }
      throw error;
    }
    try {
      const undoing = { ...latest, state: "undoing" as const };
      writeActiveJournal(cwd, undoing);
      try {
        atomicWriteAll(plans, {
          token: latest.transactionId,
          lockSet: documentLocks,
        });
      } catch (error) {
        if (error instanceof AtomicWriteError && !error.rollbackComplete) {
          return recoverJournalEntry(cwd, undoing, "before", documentLocks);
        }
        writeActiveJournal(cwd, null);
        if (
          error instanceof AtomicWriteConflictError ||
          error instanceof AtomicWriteLockError ||
          error instanceof AtomicWriteError
        ) {
          return {
            ok: false,
            diagnostics: [
              {
                code: "journal-conflict",
                message:
                  "Cannot undo the completed apply: canonical documents changed or are busy.",
                reReadHint:
                  "Re-read the affected documents after the active writer completes; undo refused to overwrite them.",
              },
            ],
          };
        }
        throw error;
      }
      try {
        writeJournal(cwd, { ...undoing, state: "undone" });
        writeActiveJournal(cwd, null);
        cacheLatestCompletedJournal(cwd, nextLatest);
      } catch {
        return {
          ok: true,
          transactionId: latest.transactionId,
          documentPaths: latest.documents.map(
            (document) => document.documentPath,
          ),
          journalRecoveryPending: true,
        };
      }
      return {
        ok: true,
        transactionId: latest.transactionId,
        documentPaths: latest.documents.map((document) => document.documentPath),
      };
    } finally {
      releaseAtomicWriteLocks(documentLocks);
    }
  } finally {
    releaseAtomicWriteLocks(operationLock);
  }
}
