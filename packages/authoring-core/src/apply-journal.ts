/**
 * Durable E1 apply journal.
 *
 * A `prepared` entry is persisted before canonical documents change. A
 * successful commit advances it to `completed`; undo restores the exact prior
 * bytes and advances it to `undone`.
 */

import {
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import type { ApplyDiagnostic } from "@sceneaxi/schemas";
import { atomicWriteAll, atomicWriteFile, fileExists } from "./atomic-write.js";
import { contentHash } from "./content-hash.js";

export const APPLY_JOURNAL_SCHEMA_VERSION = 1 as const;
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
  readonly state: "prepared" | "completed" | "undone";
  readonly documents: readonly ApplyJournalDocument[];
};

export type JournalOperationOk = {
  readonly ok: true;
  readonly transactionId: string;
  readonly documentPaths: readonly string[];
};

export type JournalOperationResult =
  | JournalOperationOk
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] };

export type RecoveryOperationOk = {
  readonly ok: true;
  readonly transactionIds: readonly string[];
  readonly documentPaths: readonly string[];
};

export type RecoveryOperationResult =
  | RecoveryOperationOk
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] };

const TRANSACTION_ID_RE = /^\d{13}-[0-9a-f]{16}$/;
const JOURNAL_KEYS = new Set([
  "schemaVersion",
  "kind",
  "transactionId",
  "createdAt",
  "state",
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

function serializeJournal(entry: ApplyJournalEntry): string {
  return `${JSON.stringify(entry, null, 2)}\n`;
}

function writeJournal(cwd: string, entry: ApplyJournalEntry): void {
  mkdirSync(journalDirectory(cwd), { recursive: true });
  atomicWriteFile(
    journalPath(cwd, entry.transactionId),
    serializeJournal(entry),
    { token: `journal-${entry.transactionId}` },
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
  if (
    raw["schemaVersion"] !== APPLY_JOURNAL_SCHEMA_VERSION ||
    raw["kind"] !== APPLY_JOURNAL_KIND ||
    typeof raw["transactionId"] !== "string" ||
    !TRANSACTION_ID_RE.test(raw["transactionId"]) ||
    typeof raw["createdAt"] !== "string" ||
    !Number.isFinite(Date.parse(raw["createdAt"])) ||
    !["prepared", "completed", "undone"].includes(String(raw["state"])) ||
    !Array.isArray(raw["documents"]) ||
    raw["documents"].length === 0 ||
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

  return {
    schemaVersion: APPLY_JOURNAL_SCHEMA_VERSION,
    kind: APPLY_JOURNAL_KIND,
    transactionId: raw["transactionId"],
    createdAt: raw["createdAt"],
    state: raw["state"] as ApplyJournalEntry["state"],
    documents,
  };
}

export function prepareApplyJournal(
  cwd: string,
  documents: readonly {
    readonly documentPath: string;
    readonly beforeContent: string;
    readonly afterContent: string;
  }[],
): ApplyJournalEntry {
  const transactionId = `${Date.now()}-${randomBytes(8).toString("hex")}`;
  const entry: ApplyJournalEntry = {
    schemaVersion: APPLY_JOURNAL_SCHEMA_VERSION,
    kind: APPLY_JOURNAL_KIND,
    transactionId,
    createdAt: new Date().toISOString(),
    state: "prepared",
    documents: documents.map((document) => ({
      documentPath: document.documentPath,
      beforeContent: document.beforeContent,
      beforeContentHash: contentHash(document.beforeContent),
      afterContent: document.afterContent,
      afterContentHash: contentHash(document.afterContent),
    })),
  };
  writeJournal(cwd, entry);
  return entry;
}

export function completeApplyJournal(
  cwd: string,
  entry: ApplyJournalEntry,
): void {
  writeJournal(cwd, { ...entry, state: "completed" });
}

function readJournals(
  cwd: string,
):
  | { readonly ok: true; readonly entries: readonly ApplyJournalEntry[] }
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] } {
  const dir = journalDirectory(cwd);
  if (!fileExists(dir)) return { ok: true, entries: [] };

  const entries: ApplyJournalEntry[] = [];
  const canonicalName = /^\d{13}-[0-9a-f]{16}\.json$/;
  const names = readdirSync(dir)
    .filter((entry) => canonicalName.test(entry))
    .sort();
  for (const name of names) {
    const path = join(dir, name);
    const parsed = parseJournal(readFileSync(path, "utf8"));
    if (parsed === null) {
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

/**
 * Finish every prepared transaction from its durable after-image. Current
 * bytes must match either the before- or after-image, so recovery never
 * overwrites an unrelated edit.
 */
export function recoverIncompleteApplies(
  input: { readonly cwd?: string } = {},
): RecoveryOperationResult {
  const cwd = input.cwd ?? process.cwd();
  const journals = readJournals(cwd);
  if (!journals.ok) return journals;

  const prepared = journals.entries
    .filter((entry) => entry.state === "prepared")
    .sort((a, b) => a.transactionId.localeCompare(b.transactionId));
  const recoveredTransactions: string[] = [];
  const recoveredPaths: string[] = [];

  for (const entry of prepared) {
    for (const document of entry.documents) {
      const absolutePath = resolve(cwd, document.documentPath);
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
    }

    atomicWriteAll(
      entry.documents.map((document) => ({
        path: resolve(cwd, document.documentPath),
        contents: document.afterContent,
      })),
      { token: entry.transactionId },
    );
    completeApplyJournal(cwd, entry);
    recoveredTransactions.push(entry.transactionId);
    recoveredPaths.push(...entry.documents.map((document) => document.documentPath));
  }

  return {
    ok: true,
    transactionIds: recoveredTransactions,
    documentPaths: recoveredPaths,
  };
}

/** Restore the exact prior bytes from the most recent completed apply. */
export function undoLastApply(
  input: { readonly cwd?: string } = {},
): JournalOperationResult {
  const cwd = input.cwd ?? process.cwd();
  const journals = readJournals(cwd);
  if (!journals.ok) return journals;

  const latest = journals.entries
    .filter((entry) => entry.state === "completed")
    .sort((a, b) => b.transactionId.localeCompare(a.transactionId))[0];
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

  for (const document of latest.documents) {
    const absolutePath = resolve(cwd, document.documentPath);
    if (
      !fileExists(absolutePath) ||
      contentHash(readFileSync(absolutePath, "utf8")) !== document.afterContentHash
    ) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "journal-conflict",
            message: `Cannot undo ${document.documentPath}: current bytes no longer match the completed apply.`,
            documentPath: document.documentPath,
            reReadHint: `Re-read ${document.documentPath}; undo refused to overwrite newer content.`,
          },
        ],
      };
    }
  }

  atomicWriteAll(
    latest.documents.map((document) => ({
      path: resolve(cwd, document.documentPath),
      contents: document.beforeContent,
    })),
  );
  writeJournal(cwd, { ...latest, state: "undone" });

  return {
    ok: true,
    transactionId: latest.transactionId,
    documentPaths: latest.documents.map((document) => document.documentPath),
  };
}
